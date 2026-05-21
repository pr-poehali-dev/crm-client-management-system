import base64
import json
import mimetypes
import os
import uuid

import boto3
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p71061117_crm_client_managemen")
CDN_BASE = f"https://cdn.poehali.dev/projects/{os.environ.get('AWS_ACCESS_KEY_ID', '')}/bucket"

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def get_s3():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def row_to_dict(row, cursor):
    cols = [d[0] for d in cursor.description]
    d = dict(zip(cols, row))
    d["id"] = str(d["id"])
    d["created_at"] = str(d["created_at"])
    for field in ("doc_photos", "relation_photos", "tickets", "contract_photos"):
        val = d[field]
        if isinstance(val, str):
            d[field] = json.loads(val)
        elif val is None:
            d[field] = []
    return d


def handle_upload(body: dict) -> dict:
    """Загружает файл из base64 в S3, возвращает CDN-ссылку."""
    file_data_b64 = body.get("data", "")
    original_name = body.get("name", "file")
    content_type = body.get("type", "application/octet-stream")

    if not file_data_b64:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "No file data"})}

    if "," in file_data_b64:
        file_data_b64 = file_data_b64.split(",", 1)[1]

    file_bytes = base64.b64decode(file_data_b64)

    ext = mimetypes.guess_extension(content_type) or os.path.splitext(original_name)[1] or ".bin"
    ext = ext.lstrip(".")
    ext = {"jpeg": "jpg", "jpe": "jpg"}.get(ext, ext)

    key = f"crm-files/{uuid.uuid4().hex}.{ext}"
    get_s3().put_object(Bucket="files", Key=key, Body=file_bytes, ContentType=content_type)

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({
            "url": f"{CDN_BASE}/{key}",
            "name": original_name,
            "type": content_type,
        }),
    }


def handler(event: dict, context) -> dict:
    """CRUD для кандидатов + загрузка файлов в S3."""
    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # POST /upload — загрузка файла
    if method == "POST" and path.rstrip("/").endswith("/upload"):
        body = json.loads(event.get("body") or "{}")
        return handle_upload(body)

    conn = get_conn()
    cur = conn.cursor()

    try:
        path_params = event.get("pathParameters") or {}
        candidate_id = path_params.get("id")

        # GET — список всех
        if method == "GET" and not candidate_id:
            cur.execute(f"SELECT * FROM {SCHEMA}.candidates ORDER BY created_at DESC, id DESC")
            rows = [row_to_dict(r, cur) for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(rows, ensure_ascii=False)}

        # POST — создать кандидата
        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            cur.execute(
                f"""INSERT INTO {SCHEMA}.candidates
                    (full_name, age, criminal_record, chronic_diseases, dispensary_record,
                     notes, doc_photos, relation_photos, tickets, contract_photos, employee_name, created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
                (
                    body.get("fullName", ""),
                    body.get("age", ""),
                    body.get("criminalRecord", ""),
                    body.get("chronicDiseases", ""),
                    body.get("dispensaryRecord", ""),
                    body.get("notes", ""),
                    json.dumps(body.get("docPhotos", []), ensure_ascii=False),
                    json.dumps(body.get("relationPhotos", []), ensure_ascii=False),
                    json.dumps(body.get("tickets", []), ensure_ascii=False),
                    json.dumps(body.get("contractPhotos", []), ensure_ascii=False),
                    body.get("employeeName", ""),
                    body.get("createdAt"),
                ),
            )
            row = row_to_dict(cur.fetchone(), cur)
            conn.commit()
            return {"statusCode": 201, "headers": CORS, "body": json.dumps(row, ensure_ascii=False)}

        # Извлекаем id из пути
        if not candidate_id:
            parts = [p for p in path.split("/") if p]
            candidate_id = parts[-1] if parts else None

        # PUT — обновить
        if method == "PUT" and candidate_id:
            body = json.loads(event.get("body") or "{}")
            cur.execute(
                f"""UPDATE {SCHEMA}.candidates SET
                    full_name=%s, age=%s, criminal_record=%s, chronic_diseases=%s,
                    dispensary_record=%s, notes=%s, doc_photos=%s, relation_photos=%s,
                    tickets=%s, contract_photos=%s, employee_name=%s
                    WHERE id=%s RETURNING *""",
                (
                    body.get("fullName", ""),
                    body.get("age", ""),
                    body.get("criminalRecord", ""),
                    body.get("chronicDiseases", ""),
                    body.get("dispensaryRecord", ""),
                    body.get("notes", ""),
                    json.dumps(body.get("docPhotos", []), ensure_ascii=False),
                    json.dumps(body.get("relationPhotos", []), ensure_ascii=False),
                    json.dumps(body.get("tickets", []), ensure_ascii=False),
                    json.dumps(body.get("contractPhotos", []), ensure_ascii=False),
                    body.get("employeeName", ""),
                    int(candidate_id),
                ),
            )
            row = row_to_dict(cur.fetchone(), cur)
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(row, ensure_ascii=False)}

        # DELETE — удалить
        if method == "DELETE" and candidate_id:
            cur.execute(f"DELETE FROM {SCHEMA}.candidates WHERE id=%s", (int(candidate_id),))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}

    finally:
        cur.close()
        conn.close()

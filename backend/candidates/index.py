import base64
import json
import mimetypes
import os
import uuid

import boto3
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p71061117_crm_client_managemen")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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


def get_cdn_base():
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket"


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


def action_upload(body):
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
        "body": json.dumps({"url": f"{get_cdn_base()}/{key}", "name": original_name, "type": content_type}),
    }


def action_create(body, cur, conn):
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


def action_update(body, cur, conn):
    candidate_id = int(body.get("id", 0))
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
            candidate_id,
        ),
    )
    row = row_to_dict(cur.fetchone(), cur)
    conn.commit()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(row, ensure_ascii=False)}


def action_delete(body, cur, conn):
    candidate_id = int(body.get("id", 0))
    cur.execute(f"DELETE FROM {SCHEMA}.candidates WHERE id=%s", (candidate_id,))
    conn.commit()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def handler(event: dict, context) -> dict:
    """CRUD для кандидатов + загрузка файлов. Все операции через action в теле POST."""
    method = event.get("httpMethod", "GET")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # GET — список всех кандидатов
    if method == "GET":
        conn = get_conn()
        cur = conn.cursor()
        try:
            cur.execute(f"SELECT * FROM {SCHEMA}.candidates ORDER BY created_at DESC, id DESC")
            rows = [row_to_dict(r, cur) for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(rows, ensure_ascii=False)}
        finally:
            cur.close()
            conn.close()

    # POST — все операции через action
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        if action == "upload":
            return action_upload(body)

        conn = get_conn()
        cur = conn.cursor()
        try:
            if action == "create":
                return action_create(body, cur, conn)
            if action == "update":
                return action_update(body, cur, conn)
            if action == "delete":
                return action_delete(body, cur, conn)
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": f"Unknown action: {action}"})}
        finally:
            cur.close()
            conn.close()

    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}

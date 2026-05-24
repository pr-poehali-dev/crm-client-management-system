import base64
import json
import mimetypes
import os
import uuid

import boto3
import psycopg2
import urllib.request

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p71061117_crm_client_managemen")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}

AUTH_SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p71061117_crm_client_managemen")


def get_session_user(conn, session_id: str):
    if not session_id:
        return None
    cur = conn.cursor()
    cur.execute(
        f"SELECT u.id, u.full_name, u.role FROM {AUTH_SCHEMA}.sessions s "
        f"JOIN {AUTH_SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.token = %s AND s.expires_at > NOW()",
        (session_id,),
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {"id": row[0], "fullName": row[1], "role": row[2]}


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


def send_telegram(text: str):
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return
    payload = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode()
    req = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    urllib.request.urlopen(req, timeout=5)


def action_create(body, cur, conn):
    cur.execute(
        f"""INSERT INTO {SCHEMA}.candidates
            (full_name, age, criminal_record, chronic_diseases, dispensary_record,
             notes, doc_photos, relation_photos, tickets, contract_photos, employee_name, company, created_at,
             birth_date, city, citizenship, has_inn, has_snils, relations, phone, arrival_date)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
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
            body.get("company", ""),
            body.get("createdAt"),
            body.get("birthDate", ""),
            body.get("city", ""),
            body.get("citizenship", ""),
            bool(body.get("hasInn", False)),
            bool(body.get("hasSnils", False)),
            body.get("relations", ""),
            body.get("phone", ""),
            body.get("arrivalDate", ""),
        ),
    )
    row = row_to_dict(cur.fetchone(), cur)
    conn.commit()

    try:
        g = lambda k, d="—": body.get(k) or d
        inn_str = "✅ есть" if body.get("hasInn") else "❌ нет"
        snils_str = "✅ есть" if body.get("hasSnils") else "❌ нет"
        send_telegram(
            f"👤 <b>Новый кандидат</b>\n\n"
            f"<b>1. ФИО:</b> {g('fullName')}\n"
            f"<b>2. Дата рождения:</b> {g('birthDate')}\n"
            f"<b>3. Город проживания:</b> {g('city')}\n"
            f"<b>4. Гражданство РФ:</b> {g('citizenship')}\n"
            f"<b>5. Документы:</b>\n"
            f"   ИНН — {inn_str}\n"
            f"   СНИЛС — {snils_str}\n"
            f"<b>6. Отношения:</b> {g('relations')}\n"
            f"<b>7. Заболевания:</b> {g('chronicDiseases')}\n"
            f"<b>8. Судимости:</b> {g('criminalRecord')}\n"
            f"<b>9. Телефон:</b> {g('phone')}\n"
            f"<b>10. Прибытие/билеты:</b> {g('arrivalDate')}\n\n"
            f"<i>Сотрудник: {g('employeeName')} | {g('company')}</i>"
        )
    except Exception:
        pass

    return {"statusCode": 201, "headers": CORS, "body": json.dumps(row, ensure_ascii=False)}


def action_update(body, cur, conn):
    candidate_id = int(body.get("id", 0))
    cur.execute(
        f"""UPDATE {SCHEMA}.candidates SET
            full_name=%s, age=%s, criminal_record=%s, chronic_diseases=%s,
            dispensary_record=%s, notes=%s, doc_photos=%s, relation_photos=%s,
            tickets=%s, contract_photos=%s, employee_name=%s, company=%s,
            birth_date=%s, city=%s, citizenship=%s, has_inn=%s, has_snils=%s,
            relations=%s, phone=%s, arrival_date=%s
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
            body.get("company", ""),
            body.get("birthDate", ""),
            body.get("city", ""),
            body.get("citizenship", ""),
            bool(body.get("hasInn", False)),
            bool(body.get("hasSnils", False)),
            body.get("relations", ""),
            body.get("phone", ""),
            body.get("arrivalDate", ""),
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

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    session_id = headers.get("x-session-id", "")

    # GET — список кандидатов (admin — все, employee — только свои)
    if method == "GET":
        conn = get_conn()
        try:
            session_user = get_session_user(conn, session_id)
            cur = conn.cursor()
            if session_user and session_user["role"] == "employee":
                cur.execute(
                    f"SELECT * FROM {SCHEMA}.candidates WHERE employee_name = %s ORDER BY created_at DESC, id DESC",
                    (session_user["fullName"],),
                )
            else:
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
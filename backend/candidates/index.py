import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p71061117_crm_client_managemen")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def row_to_dict(row, cursor):
    cols = [d[0] for d in cursor.description]
    d = dict(zip(cols, row))
    d["id"] = str(d["id"])
    d["created_at"] = str(d["created_at"])
    for field in ("doc_photos", "relation_photos", "tickets", "contract_photos"):
        if isinstance(d[field], str):
            d[field] = json.loads(d[field])
        elif d[field] is None:
            d[field] = []
    return d


def handler(event: dict, context) -> dict:
    """CRUD операции с кандидатами в базе данных."""
    method = event.get("httpMethod", "GET")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    conn = get_conn()
    cur = conn.cursor()

    try:
        path_params = event.get("pathParameters") or {}
        candidate_id = path_params.get("id")
        path = event.get("path", "/")

        # GET /candidates — список всех
        if method == "GET" and not candidate_id:
            cur.execute(
                f'SELECT * FROM {SCHEMA}.candidates ORDER BY created_at DESC, id DESC'
            )
            rows = [row_to_dict(r, cur) for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(rows, ensure_ascii=False)}

        # POST /candidates — создать
        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            cur.execute(
                f"""INSERT INTO {SCHEMA}.candidates
                    (full_name, age, criminal_record, chronic_diseases, dispensary_record,
                     notes, doc_photos, relation_photos, tickets, contract_photos, employee_name, created_at)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING *""",
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

        # Извлекаем id из пути /candidates/123
        if not candidate_id:
            parts = [p for p in path.split("/") if p]
            candidate_id = parts[-1] if parts else None

        # PUT /candidates/:id — обновить
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

        # DELETE /candidates/:id — удалить
        if method == "DELETE" and candidate_id:
            cur.execute(f'DELETE FROM {SCHEMA}.candidates WHERE id=%s', (int(candidate_id),))
            conn.commit()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}

        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}

    finally:
        cur.close()
        conn.close()

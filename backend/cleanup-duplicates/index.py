import json
import os
import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p71061117_crm_client_managemen")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def q(val) -> str:
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def handler(event: dict, context) -> dict:
    """Автоматическое удаление дублей по номеру телефона. Оставляет самую раннюю запись по каждому номеру."""

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    conn = get_conn()
    try:
        cur = conn.cursor()

        cur.execute(
            f"""SELECT array_agg(id) FROM {SCHEMA}.candidates
                WHERE phone IS NOT NULL AND phone != '' AND trashed_at IS NULL
                AND id NOT IN (
                    SELECT MIN(id) FROM {SCHEMA}.candidates
                    WHERE phone IS NOT NULL AND phone != '' AND trashed_at IS NULL
                    GROUP BY phone
                )"""
        )
        row = cur.fetchone()
        ids_to_delete = row[0] if row and row[0] else []

        deleted = 0
        if ids_to_delete:
            ids_sql = ",".join(str(i) for i in ids_to_delete)
            cur.execute(f"UPDATE {SCHEMA}.candidates SET trashed_at=NOW(), trashed_from='duplicates' WHERE id IN ({ids_sql}) AND trashed_at IS NULL")
            deleted = cur.rowcount
            conn.commit()

        cur.close()
    finally:
        conn.close()

    return {
        "statusCode": 200,
        "headers": CORS,
        "body": json.dumps({"ok": True, "deleted": deleted}),
    }
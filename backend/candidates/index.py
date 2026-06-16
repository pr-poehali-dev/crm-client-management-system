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
        f"WHERE s.token = {q(session_id)} AND s.expires_at > NOW()"
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {"id": row[0], "fullName": row[1], "role": row[2]}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def q(val) -> str:
    """Экранирует строку для безопасной подстановки в SQL (Simple Query Protocol)."""
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def qb(val) -> str:
    """Булево значение для SQL."""
    return "true" if val else "false"


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
    if "color_mark" not in d:
        d["color_mark"] = ""
    if d.get("color_mark") is None:
        d["color_mark"] = ""
    if "assigned_user_id" not in d:
        d["assigned_user_id"] = None
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
    get_s3().put_object(
        Bucket="files", Key=key, Body=file_bytes,
        ContentType=content_type,
        ContentDisposition=f'inline; filename="{original_name}"',
    )

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
    created_at = q(body.get("createdAt")) if body.get("createdAt") else "NOW()"
    is_lead = qb(body.get("isLead", False))
    cur.execute(
        f"""INSERT INTO {SCHEMA}.candidates
            (full_name, age, criminal_record, chronic_diseases, dispensary_record,
             notes, doc_photos, relation_photos, tickets, contract_photos, employee_name, company, created_at,
             birth_date, city, citizenship, has_inn, has_snils, relations, phone, arrival_date, is_lead)
            VALUES ({q(body.get("fullName",""))},{q(body.get("age",""))},{q(body.get("criminalRecord",""))},{q(body.get("chronicDiseases",""))},{q(body.get("dispensaryRecord",""))},
                    {q(body.get("notes",""))},{q(json.dumps(body.get("docPhotos",[]),ensure_ascii=False))},{q(json.dumps(body.get("relationPhotos",[]),ensure_ascii=False))},
                    {q(json.dumps(body.get("tickets",[]),ensure_ascii=False))},{q(json.dumps(body.get("contractPhotos",[]),ensure_ascii=False))},
                    {q(body.get("employeeName",""))},{q(body.get("company",""))},{created_at},
                    {q(body.get("birthDate",""))},{q(body.get("city",""))},{q(body.get("citizenship",""))},
                    {qb(body.get("hasInn",False))},{qb(body.get("hasSnils",False))},
                    {q(body.get("relations",""))},{q(body.get("phone",""))},{q(body.get("arrivalDate",""))},{is_lead})
            RETURNING *"""
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
            f"<b>6. Желаемая специальность:</b> {g('relations')}\n"
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
            full_name={q(body.get("fullName",""))}, age={q(body.get("age",""))},
            criminal_record={q(body.get("criminalRecord",""))}, chronic_diseases={q(body.get("chronicDiseases",""))},
            dispensary_record={q(body.get("dispensaryRecord",""))}, notes={q(body.get("notes",""))},
            doc_photos={q(json.dumps(body.get("docPhotos",[]),ensure_ascii=False))},
            relation_photos={q(json.dumps(body.get("relationPhotos",[]),ensure_ascii=False))},
            tickets={q(json.dumps(body.get("tickets",[]),ensure_ascii=False))},
            contract_photos={q(json.dumps(body.get("contractPhotos",[]),ensure_ascii=False))},
            employee_name={q(body.get("employeeName",""))}, company={q(body.get("company",""))},
            birth_date={q(body.get("birthDate",""))}, city={q(body.get("city",""))},
            citizenship={q(body.get("citizenship",""))},
            has_inn={qb(body.get("hasInn",False))}, has_snils={qb(body.get("hasSnils",False))},
            relations={q(body.get("relations",""))}, phone={q(body.get("phone",""))},
            arrival_date={q(body.get("arrivalDate",""))}
            WHERE id={candidate_id} RETURNING *"""
    )
    row = row_to_dict(cur.fetchone(), cur)
    conn.commit()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(row, ensure_ascii=False)}


def action_delete(body, cur, conn):
    candidate_id = int(body.get("id", 0))
    cur.execute(f"DELETE FROM {SCHEMA}.candidates WHERE id={candidate_id}")
    conn.commit()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def action_toggle_called(body, cur, conn, headers=None):
    candidate_id = int(body.get("id", 0))
    called = bool(body.get("called", False))
    called_sql = "true" if called else "false"
    cur.execute(
        f"UPDATE {SCHEMA}.candidates SET called={called_sql} WHERE id={candidate_id} RETURNING id, called"
    )
    row = cur.fetchone()
    if not row:
        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
    if called and headers:
        user = get_session_user(conn, headers.get("x-session-id", ""))
        user_name = user["fullName"] if user else ""
        user_id = user["id"] if user else None
        uid_sql = str(user_id) if user_id else "NULL"
        cur.execute(
            f"INSERT INTO {SCHEMA}.call_log (candidate_id, user_id, user_name, result, comment) "
            f"VALUES ({candidate_id}, {uid_sql}, {q(user_name)}, 'Прозвонен', '')"
        )
    conn.commit()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"id": str(row[0]), "called": row[1]})}


def action_set_call_result(body, cur, conn, headers=None):
    """Сохранение результата звонка, комментария и ФИО сотрудника по лиду."""
    candidate_id = int(body.get("id", 0))
    result = str(body.get("result", ""))
    comment = str(body.get("comment", ""))
    assigned_to = str(body.get("assignedTo", ""))
    called = "true" if result != "" else "false"
    cur.execute(
        f"UPDATE {SCHEMA}.candidates SET call_result={q(result)}, call_comment={q(comment)}, called={called}, assigned_to={q(assigned_to)} WHERE id={candidate_id} RETURNING id, call_result, call_comment, called, assigned_to"
    )
    row = cur.fetchone()
    if not row:
        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
    if result and headers:
        user = get_session_user(conn, headers.get("x-session-id", ""))
        user_name = user["fullName"] if user else assigned_to
        user_id = user["id"] if user else None
        uid_sql = str(user_id) if user_id else "NULL"
        cur.execute(
            f"INSERT INTO {SCHEMA}.call_log (candidate_id, user_id, user_name, result, comment) "
            f"VALUES ({candidate_id}, {uid_sql}, {q(user_name)}, {q(result)}, {q(comment)})"
        )
    conn.commit()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"id": str(row[0]), "call_result": row[1], "call_comment": row[2], "called": row[3], "assigned_to": row[4]})}


def action_get_call_log(params, cur):
    """Получение истории звонков по лиду/кандидату."""
    candidate_id = int(params.get("candidate_id") or 0)
    if not candidate_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "candidate_id required"})}
    cur.execute(
        f"SELECT id, user_name, called_at, result, comment FROM {SCHEMA}.call_log "
        f"WHERE candidate_id={candidate_id} ORDER BY called_at DESC"
    )
    rows = cur.fetchall()
    log = [{"id": r[0], "userName": r[1], "calledAt": r[2].isoformat() if r[2] else "", "result": r[3], "comment": r[4]} for r in rows]
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"log": log})}


def action_get_my_leads(params, cur):
    """Получение лидов сотрудника по его ФИО."""
    name = (params.get("name") or "").strip()
    if not name:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "name required"})}
    cur.execute(
        f"SELECT id, full_name, phone, city, citizenship, notes, created_at, call_result, call_comment, assigned_to "
        f"FROM {SCHEMA}.candidates WHERE is_lead=true AND assigned_to={q(name)} ORDER BY created_at DESC"
    )
    rows = cur.fetchall()
    result = []
    for row in rows:
        result.append({
            "id": str(row[0]),
            "fullName": row[1] or "",
            "phone": row[2] or "",
            "city": row[3] or "",
            "citizenship": row[4] or "",
            "notes": row[5] or "",
            "createdAt": str(row[6]),
            "callResult": row[7] or "",
            "callComment": row[8] or "",
            "assignedTo": row[9] or "",
        })
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(result, ensure_ascii=False)}


def action_convert_lead(body, cur, conn):
    candidate_id = int(body.get("id", 0))
    cur.execute(
        f"UPDATE {SCHEMA}.candidates SET is_lead = false WHERE id={candidate_id} RETURNING *"
    )
    row = row_to_dict(cur.fetchone(), cur)
    conn.commit()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(row, ensure_ascii=False)}


def action_assign_leads(body, cur, conn, headers):
    """Назначить выбранные лиды сотруднику (по user_id). Только для админов."""
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user or user["role"] != "admin":
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}
    ids = body.get("ids", [])
    assigned_user_id = body.get("assignedUserId")
    assigned_to = (body.get("assignedTo") or "").strip()
    if not ids:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "ids required"})}
    ids_sql = ",".join(str(int(i)) for i in ids)
    uid_sql = str(int(assigned_user_id)) if assigned_user_id else "NULL"
    cur.execute(
        f"UPDATE {SCHEMA}.candidates SET assigned_user_id={uid_sql}, assigned_to={q(assigned_to)} "
        f"WHERE id IN ({ids_sql}) AND is_lead=true RETURNING id"
    )
    updated = [r[0] for r in cur.fetchall()]
    conn.commit()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "updated": updated})}


def action_set_color(body, cur, conn, headers):
    """Установить цветовую пометку кандидату/лиду."""
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user:
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}
    candidate_id = int(body.get("id", 0))
    color = (body.get("color") or "").strip()
    cur.execute(
        f"UPDATE {SCHEMA}.candidates SET color_mark={q(color)} WHERE id={candidate_id} RETURNING id, color_mark"
    )
    row = cur.fetchone()
    if not row:
        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
    conn.commit()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "id": row[0], "colorMark": row[1]})}


def action_revert_to_lead(body, cur, conn):
    """Перевести кандидата обратно в лиды (отмена ошибочного перевода). Только для админов."""
    candidate_id = int(body.get("id", 0))
    cur.execute(
        f"UPDATE {SCHEMA}.candidates SET is_lead = true WHERE id={candidate_id} AND is_lead = false RETURNING id"
    )
    row = cur.fetchone()
    if not row:
        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
    conn.commit()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "id": row[0]})}


def action_dmp(event: dict, body: dict = None) -> dict:
    """Webhook от DMP.ONE — создаёт лида из входящего запроса."""
    from datetime import date

    if body is None:
        raw_body = event.get("body", "") or ""
        if event.get("isBase64Encoded"):
            import base64 as _b64
            raw_body = _b64.b64decode(raw_body).decode("utf-8")
        try:
            body = json.loads(raw_body) if raw_body else {}
        except Exception:
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Invalid JSON"})}

    phone = (body.get("phone") or body.get("tel") or "").strip()
    full_name = (body.get("name") or body.get("full_name") or body.get("fullName") or "").strip()
    city = (body.get("city") or "").strip()
    citizenship = (body.get("citizenship") or "").strip()
    comment = (body.get("comment") or body.get("notes") or "").strip()
    notes = f"Источник: DMP.ONE\n{comment}".strip() if comment else "Источник: DMP.ONE"

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {SCHEMA}.candidates
                (full_name, phone, city, citizenship, notes,
                 age, criminal_record, chronic_diseases, dispensary_record,
                 doc_photos, relation_photos, tickets, contract_photos,
                 employee_name, company, relations, birth_date, arrival_date,
                 has_inn, has_snils, created_at, is_lead)
                VALUES ({q(full_name)},{q(phone)},{q(city)},{q(citizenship)},{q(notes)},
                        '','','','',
                        '[]','[]','[]','[]',
                        '','','','','',
                        false, false, {q(str(date.today()))}, true)
                RETURNING id"""
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
    finally:
        conn.close()

    try:
        g = lambda v, d="—": v if v else d
        send_telegram(
            f"🔔 <b>Новый лид с DMP.ONE</b>\n\n"
            f"<b>ФИО:</b> {g(full_name)}\n"
            f"<b>Телефон:</b> {g(phone)}\n"
            f"<b>Город:</b> {g(city)}"
        )
    except Exception:
        pass

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "id": new_id})}


def action_mango(event: dict) -> dict:
    """Webhook от Манго Офис ВАТС — создаёт лида при входящем звонке с нового номера."""
    import hashlib
    import urllib.parse
    from datetime import date

    raw_body = event.get("body", "") or ""
    if event.get("isBase64Encoded"):
        import base64 as _b64
        raw_body = _b64.b64decode(raw_body).decode("utf-8")

    try:
        params = dict(urllib.parse.parse_qsl(raw_body))
    except Exception:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Bad request"})}

    vpbx_api_key = params.get("vpbx_api_key", "")
    sign = params.get("sign", "")
    json_str = params.get("json", "")

    mango_salt = os.environ.get("MANGO_API_SALT", "")
    if mango_salt:
        expected = hashlib.sha256((vpbx_api_key + json_str + mango_salt).encode()).hexdigest()
        if expected != sign:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Invalid sign"})}

    mango_key = os.environ.get("MANGO_API_KEY", "")
    if mango_key and vpbx_api_key != mango_key:
        return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Invalid api key"})}

    try:
        data = json.loads(json_str) if json_str else {}
    except Exception:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Invalid JSON"})}

    seq = str(data.get("seq", ""))
    call_state = data.get("call_state", "")
    if seq != "1" and call_state not in ("Appeared", ""):
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "skipped": True})}

    from_info = data.get("from") or {}
    if isinstance(from_info, str):
        phone = from_info
    else:
        phone = from_info.get("number", "") or from_info.get("extension", "")

    phone = (phone or "").strip()
    if not phone:
        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "skipped": "no_phone"})}

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"SELECT 1 FROM {SCHEMA}.candidates WHERE phone = {q(phone)} LIMIT 1")
        if cur.fetchone():
            cur.close()
            return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "skipped": "exists"})}

        cur.execute(
            f"""INSERT INTO {SCHEMA}.candidates
                (full_name, phone, city, citizenship, notes,
                 age, criminal_record, chronic_diseases, dispensary_record,
                 doc_photos, relation_photos, tickets, contract_photos,
                 employee_name, company, relations, birth_date, arrival_date,
                 has_inn, has_snils, created_at, is_lead)
                VALUES ('', {q(phone)}, '', '', 'Источник: Манго Офис (звонок)',
                        '', '', '', '',
                        '[]', '[]', '[]', '[]',
                        '', '', '', '', '',
                        false, false, {q(str(date.today()))}, true)
                RETURNING id"""
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
    finally:
        conn.close()

    try:
        send_telegram(
            f"📞 <b>Новый звонок — лид создан</b>\n\n"
            f"<b>Телефон:</b> {phone}\n"
            f"<b>Источник:</b> Манго Офис\n"
            f"<b>ID лида:</b> {new_id}"
        )
    except Exception:
        pass

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "id": new_id})}


def action_webhook(event: dict) -> dict:
    """Приём лида с внешнего сайта через webhook (без авторизации, опциональный секрет)."""
    from datetime import date

    webhook_secret = os.environ.get("WEBHOOK_SECRET", "")
    if webhook_secret:
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        if headers.get("x-webhook-secret", "") != webhook_secret:
            return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}

    raw_body = event.get("body", "") or ""
    if event.get("isBase64Encoded"):
        import base64 as _b64
        raw_body = _b64.b64decode(raw_body).decode("utf-8")

    try:
        body = json.loads(raw_body) if raw_body else {}
    except Exception:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Invalid JSON"})}

    full_name = body.get("full_name") or body.get("fullName") or body.get("name") or ""
    phone = body.get("phone") or body.get("tel") or ""
    city = body.get("city") or ""
    citizenship = body.get("citizenship") or ""
    source = body.get("source") or "Внешний сайт"
    comment = body.get("notes") or body.get("comment") or ""
    notes = f"Источник: {source}\n{comment}".strip() if comment else f"Источник: {source}"

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {SCHEMA}.candidates
                (full_name, phone, city, citizenship, notes,
                 age, criminal_record, chronic_diseases, dispensary_record,
                 doc_photos, relation_photos, tickets, contract_photos,
                 employee_name, company, relations, birth_date, arrival_date,
                 has_inn, has_snils, created_at, is_lead)
                VALUES ({q(full_name)},{q(phone)},{q(city)},{q(citizenship)},{q(notes)},
                        '','','','',
                        '[]','[]','[]','[]',
                        '','','','','',
                        false, false, {q(str(date.today()))}, true)
                RETURNING id"""
        )
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
    finally:
        conn.close()

    try:
        g = lambda v, d="—": v if v else d
        send_telegram(
            f"🔔 <b>Новый лид с сайта</b>\n\n"
            f"<b>ФИО:</b> {g(full_name)}\n"
            f"<b>Телефон:</b> {g(phone)}\n"
            f"<b>Город:</b> {g(city)}\n"
            f"<b>Гражданство:</b> {g(citizenship)}\n"
            f"<b>Примечание:</b> {g(notes)}"
        )
    except Exception:
        pass

    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "id": new_id})}


def action_import_leads(body, headers, conn):
    """Массовый импорт лидов из Excel (через JSON). Принимает массив записей, возвращает статистику."""
    from datetime import date

    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user or user["role"] != "admin":
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}

    rows = body.get("rows", [])
    if not rows:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Нет данных для импорта"})}

    imported = 0
    skipped = 0
    today = str(date.today())

    cur = conn.cursor()
    for row in rows:
        phone = (row.get("phone") or row.get("Телефон") or "").strip()
        full_name = (row.get("fullName") or row.get("ФИО") or "").strip()
        city = (row.get("city") or row.get("Город") or "").strip()
        citizenship = (row.get("citizenship") or row.get("Гражданство") or "").strip()
        notes = (row.get("notes") or row.get("Примечание") or "").strip()
        if notes and "DMP.ONE" not in notes:
            notes = f"Источник: DMP.ONE\n{notes}".strip()
        elif not notes:
            notes = "Источник: DMP.ONE"

        # Пропускаем дубли по номеру телефона
        if phone:
            cur.execute(f"SELECT 1 FROM {SCHEMA}.candidates WHERE phone = {q(phone)} AND is_lead = true LIMIT 1")
            if cur.fetchone():
                skipped += 1
                continue

        cur.execute(
            f"""INSERT INTO {SCHEMA}.candidates
                (full_name, phone, city, citizenship, notes,
                 age, criminal_record, chronic_diseases, dispensary_record,
                 doc_photos, relation_photos, tickets, contract_photos,
                 employee_name, company, relations, birth_date, arrival_date,
                 has_inn, has_snils, created_at, is_lead)
                VALUES ({q(full_name)},{q(phone)},{q(city)},{q(citizenship)},{q(notes)},
                        '','','','',
                        '[]','[]','[]','[]',
                        '','','','','',
                        false, false, {q(today)}, true)"""
        )
        imported += 1

    conn.commit()
    cur.close()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "imported": imported, "skipped": skipped})}


def action_delete_empty_leads(headers, conn):
    """Удаляет лиды без телефона и имени (мусорные записи от неудачного импорта). Только для админов."""
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user or user["role"] != "admin":
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}
    cur = conn.cursor()
    cur.execute(
        f"DELETE FROM {SCHEMA}.candidates WHERE is_lead = true AND (full_name = '' OR full_name IS NULL) AND ((phone = '' OR phone IS NULL) OR LENGTH(phone) > 15) RETURNING id"
    )
    deleted = len(cur.fetchall())
    conn.commit()
    cur.close()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True, "deleted": deleted})}


def action_announcements_get(event, conn):
    query = event.get("queryStringParameters") or {}
    last_id = query.get("last_id")
    cur = conn.cursor()
    if last_id:
        cur.execute(
            f"SELECT id, author_id, author_name, message, created_at, files FROM {SCHEMA}.announcements WHERE id > {int(last_id)} ORDER BY id ASC"
        )
    else:
        cur.execute(
            f"SELECT id, author_id, author_name, message, created_at, files FROM {SCHEMA}.announcements ORDER BY id ASC"
        )
    rows = cur.fetchall()
    cur.close()
    items = [{"id": r[0], "author_id": r[1], "author_name": r[2], "message": r[3], "created_at": r[4].isoformat(), "files": r[5] if r[5] else []} for r in rows]
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"items": items})}


def send_push_notifications(conn, title: str, body_text: str, exclude_user_id: int = None):
    vapid_private = os.environ.get("VAPID_PRIVATE_KEY", "")
    vapid_public = os.environ.get("VAPID_PUBLIC_KEY", "")
    vapid_email = os.environ.get("VAPID_EMAIL", "mailto:admin@example.com")
    if not vapid_private or not vapid_public:
        return
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        return
    cur = conn.cursor()
    if exclude_user_id:
        cur.execute(
            f"SELECT user_id, endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions WHERE user_id != {int(exclude_user_id)}"
        )
    else:
        cur.execute(f"SELECT user_id, endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions")
    rows = cur.fetchall()
    cur.close()
    dead_endpoints = []
    for user_id, endpoint, p256dh, auth_key in rows:
        try:
            webpush(
                subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth_key}},
                data=json.dumps({"title": title, "body": body_text}),
                vapid_private_key=vapid_private,
                vapid_claims={"sub": vapid_email},
            )
        except Exception as e:
            err_str = str(e)
            if "410" in err_str or "404" in err_str:
                dead_endpoints.append(endpoint)
    if dead_endpoints:
        cur2 = conn.cursor()
        for ep in dead_endpoints:
            cur2.execute(f"DELETE FROM {SCHEMA}.push_subscriptions WHERE endpoint = {q(ep)}")
        conn.commit()
        cur2.close()


def action_push_subscribe(body, user, conn):
    subscription = body.get("subscription") or {}
    endpoint = subscription.get("endpoint", "")
    keys = subscription.get("keys") or {}
    p256dh = keys.get("p256dh", "")
    auth_key = keys.get("auth", "")
    if not endpoint or not p256dh or not auth_key:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "Invalid subscription"})}
    cur = conn.cursor()
    cur.execute(
        f"""INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth)
            VALUES ({int(user["id"])},{q(endpoint)},{q(p256dh)},{q(auth_key)})
            ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh=EXCLUDED.p256dh, auth=EXCLUDED.auth"""
    )
    conn.commit()
    cur.close()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def action_push_vapid_key():
    public_key = os.environ.get("VAPID_PUBLIC_KEY", "")
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"publicKey": public_key})}


def action_help_get(conn):
    """Получить разделы инструкции."""
    cur = conn.cursor()
    cur.execute(f"SELECT id, sort_order, icon, title, items FROM {SCHEMA}.help_sections ORDER BY sort_order ASC")
    rows = cur.fetchall()
    cur.close()
    result = [{"id": r[0], "sortOrder": r[1], "icon": r[2], "title": r[3], "items": r[4] if isinstance(r[4], list) else json.loads(r[4])} for r in rows]
    return {"statusCode": 200, "headers": CORS, "body": json.dumps(result, ensure_ascii=False)}


def action_help_save(body, headers, conn):
    """Сохранить изменения в разделе инструкции. Только для администраторов."""
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user or user["role"] != "admin":
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}
    section_id = int(body.get("id", 0))
    title = body.get("title", "")
    icon = body.get("icon", "Info")
    items = body.get("items", [])
    cur = conn.cursor()
    cur.execute(
        f"UPDATE {SCHEMA}.help_sections SET title={q(title)}, icon={q(icon)}, items={q(json.dumps(items, ensure_ascii=False))} WHERE id={section_id} RETURNING id"
    )
    row = cur.fetchone()
    if not row:
        cur.close()
        return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
    conn.commit()
    cur.close()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def action_help_add_section(body, headers, conn):
    """Добавить новый раздел инструкции. Только для администраторов."""
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user or user["role"] != "admin":
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}
    title = body.get("title", "Новый раздел")
    icon = body.get("icon", "Info")
    cur = conn.cursor()
    cur.execute(f"SELECT COALESCE(MAX(sort_order),0)+1 FROM {SCHEMA}.help_sections")
    next_order = cur.fetchone()[0]
    cur.execute(
        f"INSERT INTO {SCHEMA}.help_sections (sort_order, icon, title, items) VALUES ({next_order},{q(icon)},{q(title)},'[]') RETURNING id, sort_order, icon, title, items"
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    return {"statusCode": 201, "headers": CORS, "body": json.dumps({"id": row[0], "sortOrder": row[1], "icon": row[2], "title": row[3], "items": []}, ensure_ascii=False)}


def action_help_delete_section(body, headers, conn):
    """Удалить раздел инструкции. Только для администраторов."""
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user or user["role"] != "admin":
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Нет доступа"})}
    section_id = int(body.get("id", 0))
    cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.help_sections WHERE id={section_id}")
    conn.commit()
    cur.close()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def action_announcements_post(body, user, conn):
    if user["role"] != "admin":
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Forbidden"})}
    message = (body.get("message") or "").strip()
    files = body.get("files") or []
    if not message and not files:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "message or files required"})}
    cur = conn.cursor()
    cur.execute(
        f"INSERT INTO {SCHEMA}.announcements (author_id, author_name, message, files) VALUES ({int(user['id'])},{q(user['fullName'])},{q(message)},{q(json.dumps(files))}) RETURNING id, created_at"
    )
    row = cur.fetchone()
    conn.commit()
    cur.close()
    try:
        push_text = message or f"Прикреплено файлов: {len(files)}"
        send_push_notifications(conn, "Новое объявление", push_text, exclude_user_id=user["id"])
    except Exception:
        pass
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"id": row[0], "author_id": user["id"], "author_name": user["fullName"], "message": message, "files": files, "created_at": row[1].isoformat()})}


def action_announcements_delete(query, user, conn):
    if user["role"] != "admin":
        return {"statusCode": 403, "headers": CORS, "body": json.dumps({"error": "Forbidden"})}
    ann_id = query.get("ann_id")
    if not ann_id:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "ann_id required"})}
    cur = conn.cursor()
    cur.execute(f"DELETE FROM {SCHEMA}.announcements WHERE id={int(ann_id)}")
    conn.commit()
    cur.close()
    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"ok": True})}


def handler(event: dict, context) -> dict:
    """CRUD для кандидатов + загрузка файлов + webhook + доска объявлений."""
    method = event.get("httpMethod", "GET")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    # Публичные webhook-эндпоинты через query-параметр ?action=
    query = event.get("queryStringParameters") or {}
    if query.get("action") == "webhook":
        return action_webhook(event)
    if query.get("action") == "dmp":
        return action_dmp(event)
    if query.get("action") == "mango":
        return action_mango(event)

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    session_id = headers.get("x-session-id", "")

    # GET — VAPID public key
    query_params = event.get("queryStringParameters") or {}
    if query_params.get("mode") == "vapid_key":
        return action_push_vapid_key()

    # GET — лиды конкретного сотрудника (без авторизации, по имени)
    if query_params.get("mode") == "my_leads":
        conn = get_conn()
        try:
            cur = conn.cursor()
            return action_get_my_leads(query_params, cur)
        finally:
            conn.close()

    # GET — история звонков по лиду
    if query_params.get("mode") == "call_log":
        conn = get_conn()
        try:
            cur = conn.cursor()
            return action_get_call_log(query_params, cur)
        finally:
            conn.close()

    # GET — инструкция
    if query_params.get("mode") == "help":
        conn = get_conn()
        try:
            return action_help_get(conn)
        finally:
            conn.close()

    # GET — объявления
    if query_params.get("mode") == "announcements":
        conn = get_conn()
        try:
            session_user = get_session_user(conn, session_id)
            if not session_user:
                return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}
            return action_announcements_get(event, conn)
        finally:
            conn.close()

    # GET — список кандидатов или лидов
    if method == "GET":
        query_params = event.get("queryStringParameters") or {}
        mode = query_params.get("mode", "candidates")
        conn = get_conn()
        try:
            session_user = get_session_user(conn, session_id)
            cur = conn.cursor()
            if mode == "leads":
                cur.execute(f"SELECT * FROM {SCHEMA}.candidates WHERE is_lead = true ORDER BY created_at DESC, id DESC")
            elif session_user and session_user["role"] == "employee":
                cur.execute(
                    f"SELECT * FROM {SCHEMA}.candidates WHERE is_lead = false AND employee_name = {q(session_user['fullName'])} ORDER BY created_at DESC, id DESC"
                )
            else:
                cur.execute(f"SELECT * FROM {SCHEMA}.candidates WHERE is_lead = false ORDER BY created_at DESC, id DESC")
            rows = [row_to_dict(r, cur) for r in cur.fetchall()]
            return {"statusCode": 200, "headers": CORS, "body": json.dumps(rows, ensure_ascii=False)}
        finally:
            cur.close()
            conn.close()

    # POST — все операции через action
    if method == "POST":
        body = json.loads(event.get("body") or "{}")
        action = body.get("action", "")

        if action == "dmp":
            return action_dmp(event, body)

        if action == "webhook":
            return action_webhook(event)

        if action == "upload":
            return action_upload(body)

        if action in ("announcements_post", "announcements_delete", "push_subscribe"):
            conn2 = get_conn()
            try:
                session_user = get_session_user(conn2, session_id)
                if not session_user:
                    return {"statusCode": 401, "headers": CORS, "body": json.dumps({"error": "Unauthorized"})}
                if action == "announcements_post":
                    return action_announcements_post(body, session_user, conn2)
                if action == "announcements_delete":
                    return action_announcements_delete(body, session_user, conn2)
                if action == "push_subscribe":
                    return action_push_subscribe(body, session_user, conn2)
            finally:
                conn2.close()

        conn = get_conn()
        cur = conn.cursor()
        try:
            if action == "create":
                return action_create(body, cur, conn)
            if action == "update":
                return action_update(body, cur, conn)
            if action == "delete":
                return action_delete(body, cur, conn)
            if action == "convert_lead":
                return action_convert_lead(body, cur, conn)
            if action == "revert_to_lead":
                return action_revert_to_lead(body, cur, conn)
            if action == "toggle_called":
                return action_toggle_called(body, cur, conn, headers)
            if action == "set_call_result":
                return action_set_call_result(body, cur, conn, headers)
            if action == "import_leads":
                return action_import_leads(body, headers, conn)
            if action == "delete_empty_leads":
                return action_delete_empty_leads(headers, conn)
            if action == "assign_leads":
                return action_assign_leads(body, cur, conn, headers)
            if action == "set_color":
                return action_set_color(body, cur, conn, headers)
            if action == "help_save":
                return action_help_save(body, headers, conn)
            if action == "help_add_section":
                return action_help_add_section(body, headers, conn)
            if action == "help_delete_section":
                return action_help_delete_section(body, headers, conn)
            return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": f"Unknown action: {action}"})}
        finally:
            cur.close()
            conn.close()

    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
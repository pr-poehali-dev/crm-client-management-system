import hashlib  # noqa
import json
import os
import secrets
import time

import psycopg2

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p71061117_crm_client_managemen")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Session-Id",
}

SESSION_TTL = 86400 * 7  # 7 дней


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def md5(s: str) -> str:
    return hashlib.md5(s.encode()).hexdigest()


def esc(s: str) -> str:
    return s.replace("'", "''")


def ok(data: dict, status=200):
    return {"statusCode": status, "headers": CORS, "body": json.dumps(data, ensure_ascii=False)}


def err(msg: str, status=400):
    return {"statusCode": status, "headers": CORS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def get_session_user(conn, session_id: str):
    if not session_id:
        return None
    cur = conn.cursor()
    cur.execute(
        f"SELECT u.id, u.login, u.full_name, u.role FROM {SCHEMA}.sessions s "
        f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.token = '{esc(session_id)}' AND s.expires_at > NOW() AND u.is_active = true"
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return None
    return {"id": row[0], "login": row[1], "fullName": row[2], "role": row[3]}


def action_login(body, conn):
    login = (body.get("login") or "").strip()
    password = (body.get("password") or "").strip()
    if not login or not password:
        return err("Введите логин и пароль")

    pw_hash = md5(password)
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, full_name, role, is_active FROM {SCHEMA}.users "
        f"WHERE login = '{esc(login)}' AND password_hash = '{esc(pw_hash)}'"
    )
    row = cur.fetchone()
    cur.close()
    if not row:
        return err("Неверный логин или пароль", 401)
    if not row[3]:
        return err("Аккаунт заблокирован. Обратитесь к администратору.", 403)

    user_id, full_name, role, _ = row
    token = secrets.token_hex(32)
    expires = int(time.time()) + SESSION_TTL

    cur = conn.cursor()
    # Удаляем старые сессии этого пользователя + все истёкшие сессии системы
    cur.execute(f"DELETE FROM {SCHEMA}.sessions WHERE user_id = {user_id} OR expires_at <= NOW()")
    cur.execute(
        f"INSERT INTO {SCHEMA}.sessions (user_id, token, expires_at) "
        f"VALUES ({user_id}, '{token}', to_timestamp({expires}))"
    )
    conn.commit()
    cur.close()

    return ok({"token": token, "user": {"id": user_id, "login": login, "fullName": full_name, "role": role}})


def action_me(headers, conn):
    session_id = headers.get("x-session-id", "")
    user = get_session_user(conn, session_id)
    if not user:
        return err("Не авторизован", 401)
    return ok({"user": user})


def action_logout(headers, conn):
    session_id = headers.get("x-session-id", "")
    if session_id:
        cur = conn.cursor()
        cur.execute(f"DELETE FROM {SCHEMA}.sessions WHERE token = '{esc(session_id)}'")
        conn.commit()
        cur.close()
    return ok({"ok": True})


def action_list_users(headers, conn):
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user or user["role"] != "admin":
        return err("Нет доступа", 403)
    cur = conn.cursor()
    cur.execute(
        f"SELECT id, login, full_name, role, created_at, is_active FROM {SCHEMA}.users "
        f"WHERE login NOT LIKE 'deleted_%' ORDER BY id"
    )
    rows = [{"id": r[0], "login": r[1], "fullName": r[2], "role": r[3], "createdAt": str(r[4]), "isActive": r[5]} for r in cur.fetchall()]
    cur.close()
    return ok({"users": rows})


def action_create_user(body, headers, conn):
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user or user["role"] != "admin":
        return err("Нет доступа", 403)
    login = (body.get("login") or "").strip()
    password = (body.get("password") or "").strip()
    full_name = (body.get("fullName") or "").strip()
    role = body.get("role", "employee")
    if role not in ("admin", "employee"):
        role = "employee"
    if not login or not password:
        return err("Логин и пароль обязательны")
    pw_hash = md5(password)
    cur = conn.cursor()
    try:
        cur.execute(
            f"INSERT INTO {SCHEMA}.users (login, password_hash, full_name, role) "
            f"VALUES ('{esc(login)}', '{esc(pw_hash)}', '{esc(full_name)}', '{role}') RETURNING id"
        )
        new_id = cur.fetchone()[0]
        conn.commit()
    except Exception:
        conn.rollback()
        return err("Логин уже занят", 409)
    finally:
        cur.close()
    return ok({"id": new_id, "login": login, "fullName": full_name, "role": role}, 201)


def action_toggle_user(body, headers, conn):
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user or user["role"] != "admin":
        return err("Нет доступа", 403)
    target_id = int(body.get("id", 0))
    if target_id == user["id"]:
        return err("Нельзя заблокировать самого себя")
    cur = conn.cursor()
    cur.execute(f"SELECT is_active FROM {SCHEMA}.users WHERE id = {target_id}")
    row = cur.fetchone()
    if not row:
        cur.close()
        return err("Пользователь не найден", 404)
    new_state = not row[0]
    if not new_state:
        cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE user_id = {target_id}")
    cur.execute(f"UPDATE {SCHEMA}.users SET is_active = {new_state} WHERE id = {target_id}")
    conn.commit()
    cur.close()
    return ok({"ok": True, "isActive": new_state})


def action_change_password(body, headers, conn):
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user or user["role"] != "admin":
        return err("Нет доступа", 403)
    target_id = int(body.get("id", 0))
    new_password = (body.get("password") or "").strip()
    if not new_password:
        return err("Пароль не может быть пустым")
    pw_hash = md5(new_password)
    cur = conn.cursor()
    cur.execute(f"UPDATE {SCHEMA}.users SET password_hash = '{esc(pw_hash)}' WHERE id = {target_id}")
    conn.commit()
    cur.close()
    return ok({"ok": True})


def action_change_own_password(body, headers, conn):
    user = get_session_user(conn, headers.get("x-session-id", ""))
    if not user:
        return err("Не авторизован", 401)
    old_password = (body.get("oldPassword") or "").strip()
    new_password = (body.get("newPassword") or "").strip()
    if not old_password or not new_password:
        return err("Заполните все поля")
    old_hash = md5(old_password)
    cur = conn.cursor()
    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE id = {user['id']} AND password_hash = '{esc(old_hash)}'")
    if not cur.fetchone():
        cur.close()
        return err("Неверный текущий пароль", 403)
    new_hash = md5(new_password)
    cur.execute(f"UPDATE {SCHEMA}.users SET password_hash = '{esc(new_hash)}' WHERE id = {user['id']}")
    conn.commit()
    cur.close()
    return ok({"ok": True})


def handler(event: dict, context) -> dict:
    """Авторизация: login, me, logout, управление пользователями."""
    method = event.get("httpMethod", "GET")

    if method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    body = {}
    if method == "POST":
        body = json.loads(event.get("body") or "{}")

    action = body.get("action", "") if method == "POST" else event.get("queryStringParameters", {}).get("action", "me")

    conn = get_conn()
    try:
        if action == "login":
            return action_login(body, conn)
        if action == "me":
            return action_me(headers, conn)
        if action == "logout":
            return action_logout(headers, conn)
        if action == "list_users":
            return action_list_users(headers, conn)
        if action == "create_user":
            return action_create_user(body, headers, conn)
        if action == "toggle_user":
            return action_toggle_user(body, headers, conn)
        if action == "change_password":
            return action_change_password(body, headers, conn)
        if action == "change_own_password":
            return action_change_own_password(body, headers, conn)
        return err(f"Unknown action: {action}")
    finally:
        conn.close()
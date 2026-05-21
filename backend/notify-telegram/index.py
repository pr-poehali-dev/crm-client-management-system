import json
import os
import urllib.request
import urllib.parse


def handler(event: dict, context) -> dict:
    """Отправляет уведомление в Telegram при добавлении нового кандидата."""
    cors_headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers, "body": ""}

    body = json.loads(event.get("body") or "{}")
    full_name = body.get("fullName", "—")
    age = body.get("age", "—")
    employee_name = body.get("employeeName", "—")
    created_at = body.get("createdAt", "—")

    bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

    if not bot_token or not chat_id:
        return {
            "statusCode": 500,
            "headers": cors_headers,
            "body": json.dumps({"error": "Telegram credentials not configured"}),
        }

    message = (
        f"📋 *Новый кандидат добавлен*\n\n"
        f"👤 *ФИО:* {full_name}\n"
        f"🎂 *Возраст:* {age} лет\n"
        f"👔 *Сотрудник:* {employee_name}\n"
        f"📅 *Дата:* {created_at}"
    )

    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read().decode("utf-8"))

    return {
        "statusCode": 200,
        "headers": cors_headers,
        "body": json.dumps({"ok": result.get("ok", False)}),
    }

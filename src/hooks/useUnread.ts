import { useState, useEffect, useCallback } from "react";
import func2url from "../../backend/func2url.json";

const API = (func2url as Record<string, string>)["candidates"];
const POLL_INTERVAL = 15000;

function seenKey(userId?: number) {
  return `chat_last_seen_${userId ?? "anon"}`;
}

export function useUnread(token: string | null, userId?: number) {
  const [unreadCount, setUnreadCount] = useState(0);

  const check = useCallback(() => {
    if (!token) return;
    fetch(`${API}?mode=announcements`, { headers: { "X-Session-Id": token } })
      .then((r) => r.json())
      .then((data) => {
        const items: { id: number }[] = data.items || [];
        const seen = parseInt(localStorage.getItem(seenKey(userId)) || "0", 10);
        setUnreadCount(items.filter((i) => i.id > seen).length);
      })
      .catch(() => {});
  }, [token, userId]);

  useEffect(() => {
    if (!token) return;
    check();
    const iv = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(iv);
  }, [check, token]);

  return { unreadCount, recheckUnread: check };
}
import { useEffect } from "react";
import func2url from "../../backend/func2url.json";

const API = (func2url as Record<string, string>)["candidates"];

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications(token: string | null) {
  useEffect(() => {
    if (!token) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") return;

    const subscribe = async () => {
      try {
        const res = await fetch(`${API}?mode=vapid_key`, {
          headers: { "X-Session-Id": token },
        });
        const { publicKey } = await res.json();
        if (!publicKey) return;

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
          if (Notification.permission === "default") {
            const perm = await Notification.requestPermission();
            if (perm !== "granted") return;
          }
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Session-Id": token },
          body: JSON.stringify({ action: "push_subscribe", subscription: sub.toJSON() }),
        });
      } catch (_e) { /* push subscription failed silently */ }
    };

    subscribe();
  }, [token]);
}
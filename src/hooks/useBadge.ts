import { useEffect } from "react";

export function useBadge(count: number) {
  useEffect(() => {
    const update = async () => {
      if ("setAppBadge" in navigator) {
        try {
          if (count > 0) {
            await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count);
          } else {
            await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge();
          }
        } catch (_e) {
          // Badge API недоступен или нет разрешения
        }
      }

      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: "SET_BADGE", count });
      }
    };

    update();
  }, [count]);
}
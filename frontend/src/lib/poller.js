import { get } from "../api/client.js";

export function startUnreadPolling(onCount) {
  let timer;
  async function tick() {
    if (document.hidden) {
      return;
    }
    try {
      const data = await get("/api/notifications/unread-count");
      onCount(data.unreadCount ?? 0);
    } catch {
      // keep last count
    }
  }
  function start() {
    clearInterval(timer);
    timer = setInterval(tick, 30000);
    void tick();
  }
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void tick();
    }
  });
  start();
  return () => clearInterval(timer);
}

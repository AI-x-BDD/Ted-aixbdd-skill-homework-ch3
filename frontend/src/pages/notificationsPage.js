import { get, post } from "../api/client.js";
import { mountPage } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { h } from "../lib/h.js";
import { formatTaipei } from "../../../shared/src/taipei.js";

const TYPE_LABELS = {
  booking_created: "預約成立",
  review_result: "審核結果",
  waitlist_offer: "候補遞補",
  booking_cancelled: "預約取消",
  review_pending: "待審核",
  booking_changed: "預約修改",
  suspension: "權限暫停",
  waitlist_expired: "候補失效",
  reminder: "開始前提醒",
};

export async function render(container) {
  const root = h("div", { testid: "notification-page" });
  mountPage(container, "#/notifications", root);
  root.append(h("h1", { text: "站內通知" }));
  const summary = h("p", { testid: "notification-summary" });
  const out = h("div");
  root.append(summary, out);
  let items = [];

  async function load(reset) {
    if (reset) {
      items = [];
      out.replaceChildren(
        h("div", {
          class: "skel skel-item",
          testid: "notification-page-loading",
        }),
      );
    }
    try {
      const before =
        !reset && items.length ? `&beforeId=${items.at(-1).id}` : "";
      const data = await get(`/api/notifications?limit=20${before}`);
      const next = data.items ?? [];
      items = reset ? next : items.concat(next);
      const unread =
        data.unreadCount ?? items.filter((item) => !item.readAt).length;
      summary.textContent = unread ? `共 ${unread} 則未讀` : "沒有未讀通知";
      draw(next.length >= 20);
    } catch {
      out.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "notification-page-error" },
          h("p", { text: "無法載入通知。請稍後按「重新載入」再試一次。" }),
          h("button", {
            class: "btn",
            type: "button",
            text: "重新載入",
            onClick: () => load(true),
          }),
        ),
      );
    }
  }

  function draw(hasMore) {
    if (!items.length) {
      out.replaceChildren(
        h(
          "div",
          { class: "state-box", testid: "notification-page-empty" },
          h("p", { text: "目前沒有通知" }),
          h("p", { text: "預約、審核與候補的消息會出現在這裡。" }),
        ),
      );
      return;
    }
    const list = h("ul", { class: "list", testid: "notification-list" });
    for (const item of items) {
      const unread = !item.readAt;
      const when = formatTaipei(new Date(item.createdAt), {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const row = h(
        "li",
        {
          class: "item",
          testid: "notification-item",
          "data-id": String(item.id),
          "aria-label": `${unread ? "未讀" : "已讀"}，${TYPE_LABELS[item.type] ?? item.type}，${when}，${item.message}`,
        },
        h(
          "div",
          { class: "top" },
          h("span", {
            class: unread ? "title" : "",
            text: TYPE_LABELS[item.type] ?? item.type,
          }),
          h("span", {
            class: `tag ${unread ? "warn" : ""}`,
            text: unread ? "未讀" : "已讀",
          }),
        ),
        h("p", { text: item.message }),
        h("div", { class: "meta", text: when }),
      );
      row.append(
        h("button", {
          class: "btn sm",
          type: "button",
          testid: "notification-open",
          text: unread ? "標為已讀" : "開啟",
          onClick: async () => {
            try {
              if (unread) {
                await post(`/api/notifications/${item.id}/read`, {});
                item.readAt = new Date().toISOString();
                const badge = document.querySelector(
                  '[data-testid="app-notification-badge"]',
                );
                if (badge && !badge.hidden) {
                  const next = Math.max(0, Number(badge.textContent) - 1);
                  badge.textContent = String(next);
                  badge.hidden = next === 0;
                }
              }
              if (item.bookingId) location.hash = "#/bookings";
              else if (item.waitlistEntryId) location.hash = "#/waitlist";
              else draw(hasMore);
            } catch {
              showToast("無法標記為已讀。請稍後再試一次。", "error");
            }
          },
        }),
      );
      if (item.bookingId) {
        row.append(
          h("a", { class: "btn sm", href: "#/bookings", text: "查看預約" }),
        );
      }
      if (item.waitlistEntryId) {
        row.append(
          h("a", { class: "btn sm", href: "#/waitlist", text: "查看候補" }),
        );
      }
      list.append(row);
    }
    out.replaceChildren(list);
    if (hasMore) {
      out.append(
        h("button", {
          class: "btn",
          type: "button",
          testid: "notification-load-more",
          text: "載入更多",
          onClick: () => load(false),
        }),
      );
    }
  }

  await load(true);
}

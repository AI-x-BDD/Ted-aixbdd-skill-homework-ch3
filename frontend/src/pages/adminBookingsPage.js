import { BOOKING_STATUS_LABELS } from "../../../shared/src/copy.js";
import { get, post } from "../api/client.js";
import { openDialog } from "../components/dialog.js";
import { mountPage, renderForbidden } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { h } from "../lib/h.js";
import { formatDate } from "../lib/time.js";
import { currentUser } from "../router.js";

export async function render(container) {
  if (!currentUser?.roles?.includes("admin")) {
    renderForbidden(container);
    return;
  }
  const root = h("div", { testid: "admin-bookings" });
  mountPage(container, "#/admin/bookings", root);
  root.append(h("h1", { text: "全部預約" }));
  const from = h("input", {
    testid: "admin-bookings-filter-from",
    type: "date",
  });
  const to = h("input", { testid: "admin-bookings-filter-to", type: "date" });
  const toErr = h("div", {
    class: "err",
    testid: "admin-bookings-filter-to-error",
  });
  const keyword = h("input", {
    testid: "admin-bookings-filter-keyword",
    type: "search",
  });
  const form = h(
    "form",
    { class: "card", novalidate: true, style: "margin-bottom:14px" },
    h(
      "div",
      { class: "grid2" },
      h(
        "div",
        { class: "field" },
        h("label", { text: "開始日期（起）" }, from),
      ),
      h(
        "div",
        { class: "field" },
        h("label", { text: "開始日期（迄）" }, to),
        toErr,
      ),
      h("div", { class: "field" }, h("label", { text: "預約者" }, keyword)),
    ),
    h("button", {
      class: "btn primary",
      type: "submit",
      testid: "admin-bookings-filter-submit",
      text: "篩選",
    }),
  );
  const out = h("div");
  root.append(form, out);
  let items = [];
  let total = 0;
  const openLogs = {};

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (from.value && to.value && to.value < from.value) {
      toErr.textContent =
        "日期區間不正確：結束日期不可早於開始日期。請重新選擇。";
      return;
    }
    toErr.textContent = "";
    void load(true);
  });

  async function load(reset) {
    if (reset) {
      items = [];
      out.replaceChildren(
        h("div", { class: "skel skel-item", testid: "admin-bookings-loading" }),
      );
    }
    const query = new URLSearchParams();
    if (from.value) query.set("from", from.value);
    if (to.value) query.set("to", to.value);
    if (keyword.value.trim()) query.set("keyword", keyword.value.trim());
    query.set("limit", "20");
    query.set("offset", String(reset ? 0 : items.length));
    try {
      const data = await get(`/api/admin/bookings?${query}`);
      total = data.total ?? 0;
      items = reset ? (data.items ?? []) : items.concat(data.items ?? []);
      draw();
    } catch {
      out.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "admin-bookings-error" },
          h("p", { text: "無法載入預約資料。請稍後按「重新載入」再試一次。" }),
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

  async function cancel(booking) {
    const reason = h("textarea", { testid: "admin-cancel-reason" });
    const err = h("div", {
      class: "err",
      testid: "admin-cancel-reason-error",
      role: "alert",
    });
    const result = await openDialog({
      title: "取消這筆預約",
      body: h(
        "div",
        {},
        h("p", {
          class: "lead",
          text: "取消後時段立即釋出，並通知預約者。管理員取消不會記為逾時取消。",
        }),
        h(
          "div",
          { class: "field" },
          h("label", { text: "取消原因（必填）" }, reason),
          err,
        ),
      ),
      actions: [
        {
          label: "先不要取消",
          value: null,
          testid: "admin-cancel-dialog-cancel",
        },
        {
          label: "確定取消",
          value: "ok",
          kind: "danger",
          testid: "admin-cancel-dialog-confirm",
        },
      ],
    });
    if (result !== "ok") return;
    if (!reason.value.trim()) {
      showToast("請填寫取消原因。", "error");
      return cancel(booking);
    }
    try {
      await post(`/api/admin/bookings/${booking.id}/cancel`, {
        reason: reason.value.trim(),
      });
      showToast("預約已取消，預約者會收到含原因的通知。");
      await load(true);
    } catch (error) {
      showToast(error.message ?? "無法取消這筆預約。", "error");
    }
  }

  async function toggleLog(booking) {
    openLogs[booking.id] = !openLogs[booking.id];
    if (openLogs[booking.id] && !booking.events) {
      const data = await get(`/api/admin/bookings/${booking.id}/events`);
      booking.events = data.items ?? [];
    }
    draw();
  }

  function draw() {
    if (!items.length) {
      out.replaceChildren(
        h("div", {
          class: "state-box",
          testid: "admin-bookings-empty",
          text: "沒有符合條件的預約",
        }),
      );
      return;
    }
    const table = h("table", { class: "tbl", testid: "admin-bookings-list" });
    table.append(
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          ...["場地", "時間", "主題", "狀態", "操作"].map((label) =>
            h("th", { text: label }),
          ),
        ),
      ),
    );
    const tbody = h("tbody");
    for (const booking of items) {
      const series = booking.seriesIndex
        ? `（第 ${booking.seriesIndex}／${booking.seriesTotal} 場）`
        : "";
      tbody.append(
        h(
          "tr",
          { testid: "admin-bookings-item", "data-id": String(booking.id) },
          h(
            "td",
            { "data-label": "場地" },
            h("strong", { text: booking.venueName }),
            h("div", { class: "hint", text: `預約者：${booking.bookerName}` }),
          ),
          h("td", {
            "data-label": "時間",
            text: `${formatDate(booking.date)} ${booking.startTime}–${booking.endTime}`,
          }),
          h("td", {
            "data-label": "主題",
            text: `${booking.subject}，${booking.attendees} 人${series}`,
          }),
          h(
            "td",
            { "data-label": "狀態" },
            h("span", {
              class: `tag ${booking.status}`,
              text: BOOKING_STATUS_LABELS[booking.status] ?? booking.status,
            }),
          ),
          h(
            "td",
            { "data-label": "操作" },
            h(
              "div",
              { class: "row" },
              h("button", {
                class: "btn sm",
                type: "button",
                testid: "admin-booking-log-toggle",
                text: openLogs[booking.id] ? "收合紀錄" : "操作紀錄",
                onClick: () => toggleLog(booking),
              }),
              booking.canAdminCancel
                ? h("button", {
                    class: "btn sm",
                    type: "button",
                    testid: "admin-booking-cancel-button",
                    text: "取消預約",
                    onClick: () => cancel(booking),
                  })
                : null,
            ),
          ),
        ),
      );
      if (openLogs[booking.id]) {
        const ul = h("ul", {
          testid: "admin-booking-log",
          "aria-label": `${booking.venueName}的操作紀錄`,
        });
        for (const event of booking.events ?? []) {
          ul.append(
            h("li", {
              text: `${event.occurredAt}｜${event.actorName ?? "系統"}｜${event.fromStatus ?? "（新建）"} → ${event.toStatus}｜${event.reason || "無"}`,
            }),
          );
        }
        ul.append(
          h("li", {
            style: "list-style:none;color:var(--muted)",
            text: "操作紀錄不可修改或刪除。",
          }),
        );
        tbody.append(h("tr", {}, h("td", { colspan: "5" }, ul)));
      }
    }
    table.append(tbody);
    out.replaceChildren(table);
    if (items.length < total) {
      out.append(
        h("button", {
          class: "btn",
          type: "button",
          testid: "admin-bookings-load-more",
          text: "載入更多",
          onClick: () => load(false),
        }),
      );
    }
  }

  await load(true);
}

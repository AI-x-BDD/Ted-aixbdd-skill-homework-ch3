import { get, post } from "../api/client.js";
import { openDialog } from "../components/dialog.js";
import { mountPage } from "../components/nav.js";
import { openWaitlistDialog } from "../components/waitlistDialog.js";
import { h } from "../lib/h.js";
import { formatDate, formatRange } from "../lib/time.js";
import { currentUser } from "../router.js";

const STATUS = {
  waiting: "等候中",
  offered: "保留中",
  confirmed: "已遞補成立",
  expired: "已失效",
  cancelled: "已取消",
};

const CLOSE = {
  offer_timeout: "逾時未確認",
  declined: "已放棄",
  started: "時段已開始",
  cancelled: "已取消",
  venue_disabled: "場地停用",
  account_disabled: "帳號停用",
  confirm_failed: "確認失敗",
};

export async function render(container) {
  const root = h("div", { testid: "waitlist-page" });
  mountPage(container, "#/waitlist", root);
  root.append(
    h(
      "div",
      { class: "row", style: "justify-content:space-between" },
      h("h1", { text: "我的候補" }),
      h("button", {
        class: "btn primary",
        type: "button",
        testid: "waitlist-register-open",
        text: "登記候補",
        onClick: async () => {
          const created = await openWaitlistDialog();
          if (created) await load();
        },
      }),
    ),
  );
  if (currentUser?.suspendedUntil) {
    root.append(
      h("div", {
        class: "alert warn",
        testid: "suspension-banner",
        text: `您的預約權限已暫停至 ${currentUser.suspendedUntil}。暫停期間無法新增預約、登記候補與確認遞補。`,
      }),
    );
  }
  const notice = h("div", { testid: "waitlist-notice", "aria-live": "polite" });
  const out = h("div");
  root.append(notice, out);

  function say(kind, text, link) {
    const box = h("div", {
      class: kind === "error" ? "alert danger" : "alert ok",
      role: kind === "error" ? "alert" : "status",
      text,
    });
    if (link) {
      box.append(
        h(
          "div",
          {},
          h("a", { class: "btn sm", href: "#/bookings", text: "前往我的預約" }),
        ),
      );
    }
    notice.replaceChildren(box);
  }

  async function load() {
    out.replaceChildren(
      h("div", { class: "skel skel-item", testid: "waitlist-page-loading" }),
    );
    out.setAttribute("aria-busy", "true");
    try {
      const data = await get("/api/waitlist");
      draw(data.items ?? []);
    } catch {
      out.removeAttribute("aria-busy");
      out.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "waitlist-page-error" },
          h("p", { text: "無法載入你的候補。請稍後按「重新載入」再試一次。" }),
          h("button", {
            class: "btn",
            type: "button",
            text: "重新載入",
            onClick: load,
          }),
        ),
      );
    }
  }

  function item(entry) {
    const statusText = STATUS[entry.status] ?? entry.status;
    const li = h("li", {
      class: "item",
      testid: "waitlist-item",
      "data-id": String(entry.id),
      "aria-label": `${entry.venueName}，${formatDate(entry.date)} ${entry.startTime}–${entry.endTime}，${statusText}`,
    });
    const tag =
      entry.status === "waiting" && entry.rank
        ? `等候中｜第 ${entry.rank} 順位`
        : statusText;
    li.append(
      h(
        "div",
        { class: "top" },
        h("span", { class: "title", text: entry.venueName }),
        h("span", { class: `tag ${entry.status}`, text: tag }),
      ),
      h("div", {
        class: "meta",
        text: `${formatDate(entry.date)} ${entry.startTime}–${entry.endTime}｜${entry.subject}，${entry.attendees} 人`,
      }),
    );
    if (entry.status === "offered") {
      li.append(
        h("div", {
          class: "alert warn",
          style: "margin:0",
          text: `時段已為你保留，請在 ${entry.offerExpiresAt ? formatRange(entry.offerExpiresAt, entry.offerExpiresAt) : ""} 前確認。`,
        }),
      );
      li.append(
        h(
          "div",
          { class: "row" },
          h("button", {
            class: "btn primary sm",
            type: "button",
            testid: "waitlist-confirm-button",
            text: "確認遞補",
            onClick: async (event) => {
              event.target.disabled = true;
              event.target.textContent = "處理中…";
              try {
                const created = await post(`/api/waitlist/${entry.id}/confirm`);
                say(
                  "ok",
                  created.status === "pending"
                    ? "遞補成功，預約申請已送出，等待審核（待審核）。"
                    : "遞補成功，預約已成立（已確認）。",
                  true,
                );
                await load();
              } catch (error) {
                say("error", error.message ?? "無法確認遞補。");
                await load();
              }
            },
          }),
          h("button", {
            class: "btn sm",
            type: "button",
            testid: "waitlist-decline-button",
            text: "放棄遞補",
            onClick: async () => {
              await post(`/api/waitlist/${entry.id}/decline`);
              say("ok", "已放棄遞補，系統會改通知下一位。");
              await load();
            },
          }),
        ),
      );
    }
    if (entry.status === "waiting") {
      li.append(
        h(
          "div",
          { class: "row" },
          h("button", {
            class: "btn sm",
            type: "button",
            testid: "waitlist-cancel-button",
            text: "取消候補",
            onClick: async () => {
              const ok = await openDialog({
                title: "要取消這個候補嗎？",
                body: "取消後會退出排序，後面的順位會依序往前。",
                actions: [
                  {
                    label: "先不要取消",
                    value: null,
                    testid: "waitlist-cancel-dialog-cancel",
                  },
                  {
                    label: "確定取消",
                    value: "ok",
                    kind: "danger",
                    testid: "waitlist-cancel-dialog-confirm",
                  },
                ],
              });
              if (ok !== "ok") return;
              await post(`/api/waitlist/${entry.id}/cancel`);
              say("ok", "已取消候補。");
              await load();
            },
          }),
        ),
      );
    }
    if (entry.status === "expired") {
      li.append(
        h("div", {
          class: "meta",
          text: `失效原因：${CLOSE[entry.closeReason] ?? entry.closeReason ?? ""}`,
        }),
      );
    }
    return li;
  }

  function draw(items) {
    out.removeAttribute("aria-busy");
    const active = items.filter(
      (entry) => entry.status === "waiting" || entry.status === "offered",
    );
    const dead = items.filter(
      (entry) => entry.status === "expired" || entry.status === "cancelled",
    );
    const nodes = [];
    if (!active.length) {
      nodes.push(
        h(
          "div",
          { class: "state-box", testid: "waitlist-page-empty" },
          h("p", { text: "目前沒有候補" }),
          h("p", { text: "在行事曆點選「已預約」的時段，就能登記候補。" }),
          h(
            "div",
            { class: "row", style: "justify-content:center" },
            h("button", {
              class: "btn primary",
              type: "button",
              text: "登記候補",
              onClick: async () => {
                const created = await openWaitlistDialog();
                if (created) await load();
              },
            }),
            h("a", { class: "btn", href: "#/venues", text: "查詢場地" }),
          ),
        ),
      );
    } else {
      const list = h("ul", { class: "list", testid: "waitlist-list" });
      for (const entry of active) list.append(item(entry));
      nodes.push(list);
    }
    if (dead.length) {
      const details = h(
        "details",
        { style: "margin-top:16px" },
        h("summary", { text: "已失效的候補" }),
      );
      const list = h("ul", { class: "list" });
      for (const entry of dead) list.append(item(entry));
      details.append(list);
      nodes.push(details);
    }
    out.replaceChildren(...nodes);
  }

  await load();
}

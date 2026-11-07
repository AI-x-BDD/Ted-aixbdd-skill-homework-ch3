import { get, post } from "../api/client.js";
import { openDialog } from "../components/dialog.js";
import { mountPage } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { h } from "../lib/h.js";
import { formatDate } from "../lib/time.js";

export async function render(container) {
  const root = h("div", { testid: "review-page" });
  mountPage(container, "#/reviews", root);
  root.append(h("h1", { text: "待審核" }));
  const out = h("div");
  root.append(out);

  async function load() {
    out.replaceChildren(
      h("div", { class: "skel skel-item", testid: "review-page-loading" }),
    );
    out.setAttribute("aria-busy", "true");
    try {
      const data = await get("/api/reviews");
      draw(data.items ?? []);
    } catch {
      out.removeAttribute("aria-busy");
      out.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "review-page-error" },
          h("p", {
            text: "無法載入待審核清單。請稍後按「重新載入」再試一次。",
          }),
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

  async function reject(item) {
    const reason = h("textarea", { testid: "review-reject-reason" });
    const err = h("div", {
      class: "err",
      testid: "review-reject-reason-error",
      role: "alert",
    });
    const result = await openDialog({
      title: "駁回申請",
      body: h(
        "div",
        {},
        h(
          "div",
          { class: "field" },
          h("label", { text: "駁回原因（必填）" }, reason),
          err,
        ),
      ),
      actions: [
        { label: "取消", value: null, testid: "review-reject-dialog-cancel" },
        {
          label: "確定駁回",
          value: "ok",
          kind: "danger",
          testid: "review-reject-dialog-confirm",
        },
      ],
    });
    if (result !== "ok") {
      return;
    }
    if (!reason.value.trim()) {
      showToast("請填寫駁回原因。", "error");
      return reject(item);
    }
    try {
      if (item.seriesId && item.sessions?.length) {
        await post(`/api/reviews/series/${item.seriesId}/reject`, {
          reason: reason.value.trim(),
        });
      } else {
        await post(`/api/reviews/bookings/${item.bookingId}/reject`, {
          reason: reason.value.trim(),
        });
      }
      showToast("已駁回，預約者會收到含原因的通知。");
      await load();
    } catch (error) {
      showToast(error.message ?? "此申請已被處理。清單已更新。", "error");
      await load();
    }
  }

  async function approve(item) {
    try {
      if (item.seriesId && item.sessions?.length) {
        const ok = await openDialog({
          title: "要核准整批申請嗎？",
          body: `核准後，未取消的 ${item.sessions.length} 個場次會一次變為已確認。`,
          actions: [
            {
              label: "先不要核准",
              value: null,
              testid: "review-approve-dialog-cancel",
            },
            {
              label: "確定核准",
              value: "ok",
              kind: "primary",
              testid: "review-approve-dialog-confirm",
            },
          ],
        });
        if (ok !== "ok") return;
        await post(`/api/reviews/series/${item.seriesId}/approve`);
        showToast(`已核准整批申請，共 ${item.sessions.length} 場。`);
      } else {
        await post(`/api/reviews/bookings/${item.bookingId}/approve`);
        showToast("已核准，預約者會收到通知。");
      }
      await load();
    } catch (error) {
      showToast(error.message ?? "此申請已被處理。清單已更新。", "error");
      await load();
    }
  }

  function draw(items) {
    out.removeAttribute("aria-busy");
    if (!items.length) {
      out.replaceChildren(
        h("div", {
          class: "state-box",
          testid: "review-page-empty",
          text: "目前沒有待審核的申請",
        }),
      );
      return;
    }
    const list = h("ul", { class: "list", testid: "review-list" });
    for (const item of items) {
      const li = h("li", {
        class: "item",
        testid: "review-item",
        "data-id": String(item.bookingId),
        "aria-label": `${item.bookerName}的申請，${item.venueName}，${formatDate(item.date)} ${item.startTime}–${item.endTime}`,
      });
      li.append(
        h(
          "div",
          { class: "top" },
          h("span", { class: "title", text: `${item.bookerName} 申請` }),
          item.sessions?.length
            ? h("span", { class: "tag accent", text: "整批週期性申請" })
            : null,
        ),
        h("div", {
          class: "meta",
          text: `${item.venueName}，${formatDate(item.date)} ${item.startTime}–${item.endTime}`,
        }),
        h("div", {
          class: "meta",
          text: `${item.subject}，${item.attendees} 人`,
        }),
      );
      if (item.assignedToAdmin) {
        li.append(
          h("div", {
            class: "tag warn",
            text: "此場地沒有其他審核者，由管理員審核",
          }),
        );
      }
      if (item.sessions?.length) {
        const dates = item.sessions.map((session) => session.date);
        li.append(
          h("div", {
            class: "meta",
            text: `共 ${dates.length} 場，${formatDate(dates[0])} 至 ${formatDate(dates.at(-1))}`,
          }),
        );
        const details = h("details");
        details.append(
          h("summary", {
            testid: "review-series-toggle",
            text: "查看全部場次",
          }),
        );
        const ul = h("ul");
        for (const session of item.sessions) {
          ul.append(
            h("li", {
              text: `${formatDate(session.date)} ${session.startTime}–${session.endTime}`,
            }),
          );
        }
        details.append(ul);
        li.append(details);
      }
      li.append(
        h(
          "div",
          { class: "row" },
          h("button", {
            class: "btn primary sm",
            type: "button",
            testid: "review-approve-button",
            text: item.sessions?.length ? "核准整批" : "核准",
            onClick: () => approve(item),
          }),
          h("button", {
            class: "btn sm",
            type: "button",
            testid: "review-reject-button",
            text: "駁回",
            onClick: () => reject(item),
          }),
        ),
      );
      list.append(li);
    }
    out.replaceChildren(list);
  }

  await load();
}

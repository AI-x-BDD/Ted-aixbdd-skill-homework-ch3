import {
  BOOKING_STATUS_LABELS,
  REBOOK_TEXT,
} from "../../../shared/src/copy.js";
import { post } from "../api/client.js";
import { h } from "../lib/h.js";
import { rebookState } from "../lib/rebook.js";
import { formatDate, formatRange } from "../lib/time.js";
import { openDialog } from "./dialog.js";
import { showToast } from "./toast.js";

const EDIT_WHY = {
  series_pending: "整批申請仍待審核，無法修改單一場次。",
  started: "預約已開始，無法修改。",
  status: "目前狀態無法修改。",
};

export function bookingCard(booking, { onChanged, suspendedUntil } = {}) {
  const statusLabel = BOOKING_STATUS_LABELS[booking.status] ?? booking.status;
  const dateLabel = formatDate(booking.date);
  const range = `${booking.startTime}–${booking.endTime}`;
  const item = h("li", {
    class: "item",
    testid: "my-bookings-item",
    "data-id": String(booking.id),
    "aria-label": `${booking.venueName}，${dateLabel} ${range}，${statusLabel}`,
  });
  const tags = h(
    "span",
    {},
    h("span", { class: `tag ${booking.status}`, text: statusLabel }),
  );
  if (booking.lateCancel) {
    tags.append(" ", h("span", { class: "tag warn", text: "逾時取消" }));
  }
  item.append(
    h(
      "div",
      { class: "top" },
      h("span", { class: "title", text: booking.venueName }),
      tags,
    ),
    h("div", { class: "meta", text: `${dateLabel} ${range}` }),
    h("div", {
      class: "meta",
      text: `${booking.subject}，${booking.attendees} 人`,
    }),
  );
  if (booking.series) {
    item.append(
      h("div", {
        class: "meta",
        text: `週期性場次：第 ${booking.series.index}／${booking.series.total} 場${booking.series.pendingApproval ? "（整批待審核）" : ""}`,
      }),
    );
  }
  if (booking.status === "rejected" && booking.statusReason) {
    item.append(
      h("div", {
        class: "meta",
        style: "color:var(--danger)",
        text: `駁回原因：${booking.statusReason}`,
      }),
    );
  }
  if (booking.status === "cancelled" && booking.statusReason) {
    const who =
      { user: "本人", reviewer: "審核者", admin: "管理員", system: "系統" }[
        booking.statusActor
      ] ?? booking.statusActor;
    item.append(
      h("div", {
        class: "meta",
        style: "color:var(--danger)",
        text: `取消原因：${booking.statusReason}（由${who}取消）`,
      }),
    );
  }
  const slot = h("div", { class: "row booking-card-actions" });
  const rebook = rebookState(booking, suspendedUntil);
  const reasonId = `rebook-reason-${booking.id}`;
  slot.append(
    h("button", {
      class: "btn sm",
      type: "button",
      testid: "booking-rebook-button",
      "aria-label": `${REBOOK_TEXT.buttonLabel}：${booking.venueName}，${booking.subject}`,
      "aria-describedby": rebook.enabled ? null : reasonId,
      disabled: !rebook.enabled,
      text: REBOOK_TEXT.buttonLabel,
      onClick: () => {
        window.location.hash = `#/bookings/new?from=${booking.id}`;
      },
    }),
  );
  if (!rebook.enabled) {
    slot.append(
      h("span", {
        class: "rebook-reason",
        testid: "booking-rebook-reason",
        id: reasonId,
        text: rebook.reason,
      }),
    );
  }
  if (booking.canCheckIn || booking.checkInWindow) {
    const windowText = booking.checkInWindow
      ? formatRange(booking.checkInWindow.startAt, booking.checkInWindow.endAt)
      : "";
    slot.append(
      h("button", {
        class: "btn sm",
        type: "button",
        testid: "booking-checkin-button",
        text: "報到",
        onClick: async () => {
          try {
            await post(`/api/bookings/${booking.id}/check-in`);
            showToast("已報到。");
            onChanged?.();
          } catch (error) {
            showToast(
              error.message ?? `目前不在報到時間（${windowText}）。`,
              "error",
            );
          }
        },
      }),
    );
    if (windowText) {
      slot.append(
        h("span", { class: "hint", text: `可報到時間：${windowText}` }),
      );
    }
  }
  if (booking.canEdit) {
    slot.append(
      h("a", {
        class: "btn sm",
        testid: "booking-edit-button",
        href: `#/bookings/${booking.id}/edit`,
        text: "修改",
      }),
    );
  } else if (booking.editBlockedReason) {
    slot.append(
      h("button", {
        class: "btn sm",
        type: "button",
        testid: "booking-edit-button",
        disabled: true,
        text: "修改",
      }),
      h("span", {
        class: "hint",
        text: EDIT_WHY[booking.editBlockedReason] ?? "目前無法修改。",
      }),
    );
  }
  if (booking.canCancel) {
    slot.append(
      h("button", {
        class: "btn sm",
        type: "button",
        testid: "booking-cancel-button",
        text: "取消預約",
        onClick: () => cancelBooking(booking, onChanged),
      }),
    );
  }
  item.append(slot);
  return item;
}

async function cancelBooking(booking, onChanged) {
  const scopeWrap = booking.series
    ? h(
        "div",
        {},
        h(
          "label",
          { class: "checks" },
          h("input", {
            type: "radio",
            name: "scope",
            testid: "booking-cancel-scope-single",
            checked: true,
            value: "single",
          }),
          "只取消這一場",
        ),
        h(
          "label",
          { class: "checks" },
          h("input", {
            type: "radio",
            name: "scope",
            testid: "booking-cancel-scope-following",
            value: "following",
          }),
          "取消這一場及之後所有場次",
        ),
      )
    : h("p", {
        class: "lead",
        text: "取消後時段立即釋出。開始前逾時取消門檻內取消會記為逾時取消。",
      });
  const result = await openDialog({
    title: "要取消這筆預約嗎？",
    body: scopeWrap,
    actions: [
      {
        label: "先不要取消",
        value: null,
        testid: "booking-cancel-dialog-cancel",
      },
      {
        label: "確定取消",
        value: "ok",
        kind: "danger",
        testid: "booking-cancel-dialog-confirm",
      },
    ],
  });
  if (result !== "ok") {
    return;
  }
  const scope =
    scopeWrap.querySelector?.('input[name="scope"]:checked')?.value ?? "single";
  try {
    const data = await post(`/api/bookings/${booking.id}/cancel`, { scope });
    showToast(data.lateCancel ? "預約已取消（逾時取消）。" : "預約已取消。");
    onChanged?.();
  } catch (error) {
    showToast(error.message ?? "無法取消這筆預約。", "error");
  }
}

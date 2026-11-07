import { BOOKING_STATUS_LABELS } from "../../../shared/src/copy.js";
import { h } from "../lib/h.js";
import { formatDate } from "../lib/time.js";
import { openDialog } from "./dialog.js";

function line(booking) {
  return `${booking.bookerName}，${formatDate(booking.date)} ${booking.startTime}–${booking.endTime}，${BOOKING_STATUS_LABELS[booking.status] ?? booking.status}`;
}

export async function confirmImpact({
  title,
  testid,
  intro,
  preview,
  submit,
  confirmLabel,
  cancelLabel,
}) {
  let impact = preview ?? { bookings: [], waitlistCount: 0 };
  if (!impact.bookings?.length) {
    return submit([]);
  }
  for (;;) {
    const list = h("ul", {
      testid: `${testid}-list`,
      style: "margin:0 0 6px;padding-left:20px;line-height:1.7",
    });
    for (const booking of impact.bookings) {
      list.append(h("li", { testid: `${testid}-item`, text: line(booking) }));
    }
    const changed = h("div", {
      class: "alert danger",
      role: "alert",
      hidden: true,
      testid: `${testid}-changed`,
      text: "受影響的預約已有變動，尚未執行。請確認最新清單後再試一次。",
    });
    const lead = h("p", {
      class: "lead",
      testid: `${testid}-intro`,
      text: intro(impact.bookings.length, impact.waitlistCount ?? 0),
    });
    const result = await openDialog({
      title,
      body: h("div", { testid }, changed, lead, list),
      actions: [
        { label: cancelLabel, value: null, testid: `${testid}-cancel` },
        {
          label: confirmLabel,
          value: "ok",
          kind: "danger",
          testid: `${testid}-confirm`,
        },
      ],
    });
    if (result !== "ok") {
      return null;
    }
    try {
      return await submit(impact.bookings.map((item) => item.bookingId));
    } catch (error) {
      if (error.status === 409 && error.impact) {
        impact = error.impact;
        continue;
      }
      throw error;
    }
  }
}

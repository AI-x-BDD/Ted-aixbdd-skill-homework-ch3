import { canCheckIn, checkInWindow } from "../domain/checkIn.js";
import { toBooking } from "./bookingService.js";

export function toMyBooking(row, rules, current) {
  const startAt = new Date(row.start_at);
  const notStarted = startAt > current;
  const pendingOrConfirmed =
    row.status === "pending" || row.status === "confirmed";
  const seriesPending = row.series_status === "pending";
  let editBlockedReason = null;
  if (!pendingOrConfirmed) {
    editBlockedReason = "status";
  } else if (!notStarted) {
    editBlockedReason = "started";
  } else if (seriesPending) {
    editBlockedReason = "series_pending";
  }
  const window = checkInWindow(row, rules);
  return {
    ...toBooking(row),
    venueActive: Boolean(row.venue_is_active),
    series: row.series_id
      ? {
          seriesId: Number(row.series_id),
          index: Number(row.series_index),
          total: Number(row.session_count ?? row.series_total ?? 0),
          lastDate: row.series_last_date ?? null,
          status: row.series_status ?? "confirmed",
          pendingApproval: row.series_status === "pending",
        }
      : null,
    statusReason: row.status_reason ?? null,
    statusActor: row.status_actor ?? null,
    canCancel: pendingOrConfirmed && notStarted,
    canEdit: pendingOrConfirmed && notStarted && !seriesPending,
    editBlockedReason: editBlockedReason,
    canCheckIn: canCheckIn(row, rules, current),
    checkInWindow: window,
  };
}

import { canTransition } from "../domain/bookingStateMachine.js";
import { HttpError } from "../lib/http.js";
import * as bookingRepository from "../repositories/bookingRepository.js";
import * as eventRepository from "../repositories/eventRepository.js";
import { release } from "./slotService.js";

export async function transition(
  conn,
  { bookingId, to, actor, reason, now: current, lateCancel, releaseFrom },
) {
  const booking = await bookingRepository.lockById(conn, bookingId);
  if (!booking) {
    throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
  }
  const from = booking.status;
  if (!canTransition(from, to)) {
    throw new HttpError(409, "此申請已被處理。清單已更新。");
  }
  if (to === "rejected" && !String(reason ?? "").trim()) {
    throw new HttpError(400, "請填寫駁回原因。", {
      fields: [{ field: "reason", message: "請填寫駁回原因。" }],
    });
  }
  const sets = ["status = :to", "updated_at = :now"];
  const params = { id: bookingId, from, to, now: current };
  if (to === "confirmed") {
    sets.push("confirmed_at = :now", "reminder_sent_at = NULL");
  }
  if (lateCancel !== undefined) {
    sets.push("late_cancel = :lateCancel");
    params.lateCancel = lateCancel ? 1 : 0;
  }
  const [result] = await conn.query(
    `UPDATE bookings SET ${sets.join(", ")} WHERE id = :id AND status = :from`,
    params,
  );
  if (!result.affectedRows) {
    throw new HttpError(409, "此申請已被處理。清單已更新。");
  }
  const actorType = actor?.type ?? "system";
  await eventRepository.insert(conn, {
    bookingId,
    actorUserId:
      actorType === "system" ? null : (actor?.userId ?? actor?.id ?? null),
    actorType,
    occurredAt: current,
    fromStatus: from,
    toStatus: to,
    reason,
  });
  if (to === "rejected" || to === "cancelled" || to === "no_show") {
    await release(conn, {
      venueId: booking.venue_id,
      holderType: "booking",
      holderId: bookingId,
      from: releaseFrom,
      now: current,
    });
  }
  return {
    ...booking,
    status: to,
    late_cancel: lateCancel ?? booking.late_cancel,
  };
}

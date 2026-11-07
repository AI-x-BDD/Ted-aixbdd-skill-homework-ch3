import { toTaipeiParts } from "../../../shared/src/taipei.js";
import { HttpError } from "../lib/http.js";
import * as bookingRepository from "../repositories/bookingRepository.js";
import * as waitlistRepository from "../repositories/waitlistRepository.js";
import { bookingTimeParams, notify } from "./notificationService.js";
import { transition } from "./bookingTransition.js";

export function toImpactBooking(row) {
  const start = toTaipeiParts(new Date(row.start_at));
  const end = toTaipeiParts(new Date(row.end_at));
  return {
    bookingId: Number(row.id),
    bookerName: row.booker_name,
    venueName: row.venue_name,
    date: start.date,
    startTime: start.time,
    endTime:
      end.time === "00:00" && end.date !== start.date ? "24:00" : end.time,
    status: row.status,
  };
}

export async function computeImpact(conn, target) {
  let bookings = [];
  let waitlistCount = 0;
  if (target.kind === "maintenance" || target.kind === "venue") {
    bookings =
      target.kind === "maintenance"
        ? await bookingRepository.listActiveInRange(
            conn,
            target.venueId,
            target.startAt,
            target.endAt,
          )
        : await bookingRepository.listActiveByVenue(
            conn,
            target.venueId,
            target.now,
          );
    const open = await waitlistRepository.listOpenByVenue(conn, target.venueId);
    waitlistCount = target.kind === "venue" ? open.length : 0;
  } else if (target.kind === "user") {
    bookings = await bookingRepository.listActiveByUser(
      conn,
      target.userId,
      target.now,
    );
    waitlistCount = (
      await waitlistRepository.listOpenByUser(conn, target.userId)
    ).length;
  }
  return {
    bookings: bookings.map(toImpactBooking),
    waitlistCount,
    rows: bookings,
  };
}

export function assertConfirmed(impact, bookingIds = []) {
  const current = impact.bookings
    .map((item) => item.bookingId)
    .sort((a, b) => a - b);
  const given = [...bookingIds].map(Number).sort((a, b) => a - b);
  if (
    current.length !== given.length ||
    current.some((id, index) => id !== given[index])
  ) {
    throw new HttpError(
      409,
      "受影響的預約已有變動，尚未停用。請確認最新清單後再試一次。",
      {
        impact: {
          bookings: impact.bookings,
          waitlistCount: impact.waitlistCount,
        },
      },
    );
  }
}

export async function cancelAffected(conn, impact, actor, reason, current) {
  for (const row of impact.rows ?? []) {
    await transition(conn, {
      bookingId: row.id,
      to: "cancelled",
      actor,
      reason,
      now: current,
      lateCancel: false,
    });
    await notify(conn, {
      userId: row.user_id,
      type: "booking_cancelled",
      bookingId: row.id,
      params: { ...bookingTimeParams(row), reason },
      now: current,
    });
  }
}

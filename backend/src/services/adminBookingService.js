import { fromTaipei } from "../../../shared/src/taipei.js";
import { now } from "../clock.js";
import { can } from "../domain/policy.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import * as bookingRepository from "../repositories/bookingRepository.js";
import * as eventRepository from "../repositories/eventRepository.js";
import * as seriesRepository from "../repositories/seriesRepository.js";
import { toIso } from "./authService.js";
import { toBooking } from "./bookingService.js";
import { bookingTimeParams, notify } from "./notificationService.js";
import { transition } from "./bookingTransition.js";

export async function listAdminBookings(user, query = {}) {
  if (!can(user, "admin:booking-view")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const current = now();
  void current;
  return withTransaction(async (conn) => {
    const fromAt = query.from ? fromTaipei(query.from, "00:00") : null;
    const toAt = query.to ? fromTaipei(query.to, "24:00") : null;
    const { items, total } = await bookingRepository.listAdmin(conn, {
      fromAt,
      toAt,
      venueId: query.venueId,
      status: query.status,
      keyword: query.keyword,
      limit: query.limit,
      offset: query.offset,
    });
    return {
      items: items.map((row) => ({
        ...toBooking(row),
        bookerId: Number(row.booker_id ?? row.user_id),
        bookerName: row.booker_name,
        seriesIndex: row.series_index ? Number(row.series_index) : null,
        seriesTotal: row.session_count ? Number(row.session_count) : null,
        canAdminCancel:
          (row.status === "pending" || row.status === "confirmed") &&
          new Date(row.start_at) > now(),
      })),
      total,
    };
  });
}

export async function listBookingEvents(user, bookingId) {
  if (!can(user, "admin:booking-view")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  return withTransaction(async (conn) => {
    const events = await eventRepository.listByBooking(conn, bookingId);
    return {
      items: events.map((row) => ({
        occurredAt: toIso(row.occurred_at),
        actorType: row.actor_type,
        actorName: row.actor_type === "system" ? null : row.actor_name,
        fromStatus: row.from_status,
        toStatus: row.to_status,
        reason: row.reason,
      })),
    };
  });
}

export async function adminCancelBooking(admin, bookingId, reason) {
  if (!can(admin, "admin:booking-cancel")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  if (!String(reason ?? "").trim()) {
    throw new HttpError(400, "請填寫取消原因。", {
      fields: [{ field: "reason", message: "請填寫取消原因。" }],
    });
  }
  const current = now();
  return withTransaction(async (conn) => {
    const booking = await bookingRepository.lockById(conn, bookingId);
    if (!booking) {
      throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
    }
    if (
      !["pending", "confirmed"].includes(booking.status) ||
      new Date(booking.start_at) <= current
    ) {
      throw new HttpError(
        409,
        "無法取消這筆預約：預約已開始。請重新整理後再試一次。",
      );
    }
    if (booking.series_id) {
      await seriesRepository.lockById(conn, booking.series_id);
    }
    await transition(conn, {
      bookingId,
      to: "cancelled",
      actor: { type: "admin", userId: admin.id },
      reason,
      now: current,
      lateCancel: false,
    });
    await notify(conn, {
      userId: booking.user_id,
      type: "booking_cancelled",
      bookingId,
      params: { ...bookingTimeParams(booking), reason },
      now: current,
    });
    if (booking.series_id) {
      const left = await bookingRepository.listUncancelledBySeries(
        conn,
        booking.series_id,
      );
      if (!left.length) {
        await seriesRepository.setStatus(conn, booking.series_id, "cancelled");
      }
    }
    return toBooking(await bookingRepository.findById(conn, bookingId));
  });
}

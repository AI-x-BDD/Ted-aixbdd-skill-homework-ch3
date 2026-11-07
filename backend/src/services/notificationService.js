import { formatTaipei, toTaipeiParts } from "../../../shared/src/taipei.js";
import { notificationMessage } from "../../../shared/src/copy.js";
import { now } from "../clock.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import { toIso } from "./authService.js";
import * as notificationRepository from "../repositories/notificationRepository.js";

function formatWhen(startAt, endAt) {
  const start = toTaipeiParts(new Date(startAt));
  const end = toTaipeiParts(new Date(endAt));
  const endTime =
    end.time === "00:00" && end.date !== start.date ? "24:00" : end.time;
  return { date: start.date, startTime: start.time, endTime };
}

export async function notify(
  conn,
  { userId, type, bookingId, waitlistEntryId, params = {}, now: current },
) {
  const message = notificationMessage(type, params);
  await notificationRepository.insert(conn, {
    user_id: userId,
    type,
    message,
    booking_id: bookingId ?? null,
    waitlist_entry_id: waitlistEntryId ?? null,
    created_at: current,
  });
}

export function bookingTimeParams(booking) {
  const times = formatWhen(
    booking.start_at ?? booking.startAt,
    booking.end_at ?? booking.endAt,
  );
  return {
    venueName: booking.venue_name ?? booking.venueName,
    ...times,
  };
}

export function formatUntil(date) {
  return formatTaipei(new Date(date), {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function listNotifications(user, query = {}) {
  const current = now();
  void current;
  return withTransaction(async (conn) => {
    const items = await notificationRepository.listByUser(conn, {
      userId: user.id,
      limit: Number(query.limit ?? 20),
      beforeId: query.beforeId ? Number(query.beforeId) : undefined,
    });
    const unread = await notificationRepository.unreadCount(conn, user.id);
    return {
      items: items.map((row) => ({
        id: Number(row.id),
        type: row.type,
        message: row.message,
        bookingId: row.booking_id ? Number(row.booking_id) : null,
        waitlistEntryId: row.waitlist_entry_id
          ? Number(row.waitlist_entry_id)
          : null,
        createdAt: toIso(row.created_at),
        readAt: row.read_at ? toIso(row.read_at) : null,
      })),
      unreadCount: unread,
    };
  });
}

export async function getUnreadCount(user) {
  return withTransaction(async (conn) => {
    const count = await notificationRepository.unreadCount(conn, user.id);
    return { unreadCount: count };
  });
}

export async function markNotificationRead(user, notificationId) {
  const current = now();
  return withTransaction(async (conn) => {
    const updated = await notificationRepository.markRead(conn, {
      userId: user.id,
      id: notificationId,
      now: current,
    });
    if (!updated) {
      const [rows] = await conn.query(
        "SELECT id FROM notifications WHERE id = :id AND user_id = :userId",
        { id: notificationId, userId: user.id },
      );
      if (!rows.length) {
        throw new HttpError(404, "找不到這則通知。請重新整理後再試一次。");
      }
    }
  });
}

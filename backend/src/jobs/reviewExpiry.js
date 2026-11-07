import { now } from "../clock.js";
import { processDue, registerJob } from "./scanner.js";
import * as bookingRepository from "../repositories/bookingRepository.js";
import * as seriesRepository from "../repositories/seriesRepository.js";
import { bookingTimeParams, notify } from "../services/notificationService.js";
import { transition } from "../services/bookingTransition.js";

export async function expirePendingReviews(current = now()) {
  await processDue(null, {
    select: async (conn) => {
      const [rows] = await conn.query(
        `SELECT * FROM bookings
         WHERE status = 'pending' AND series_id IS NULL AND start_at <= :now
         ORDER BY start_at LIMIT 100 FOR UPDATE SKIP LOCKED`,
        { now: current },
      );
      return [rows];
    },
    handle: async (conn, row) => {
      await transition(conn, {
        bookingId: row.id,
        to: "cancelled",
        actor: { type: "system" },
        reason: "未於開始前完成審核",
        now: current,
      });
      await notify(conn, {
        userId: row.user_id,
        type: "booking_cancelled",
        bookingId: row.id,
        params: {
          ...bookingTimeParams({ ...row, venue_name: row.venue_name }),
          reason: "未於開始前完成審核",
        },
        now: current,
      });
    },
  });
  await processDue(null, {
    select: async (conn) => {
      const [rows] = await conn.query(
        `SELECT s.* FROM booking_series s
         WHERE s.status = 'pending'
         ORDER BY s.id LIMIT 100 FOR UPDATE SKIP LOCKED`,
      );
      return [rows];
    },
    handle: async (conn, series) => {
      const sessions = await bookingRepository.listUncancelledBySeries(
        conn,
        series.id,
      );
      if (!sessions.length) {
        return;
      }
      const earliest = sessions.reduce(
        (min, item) =>
          new Date(item.start_at) < new Date(min.start_at) ? item : min,
        sessions[0],
      );
      if (new Date(earliest.start_at) > current) {
        return;
      }
      for (const session of sessions) {
        if (session.status === "pending") {
          await transition(conn, {
            bookingId: session.id,
            to: "cancelled",
            actor: { type: "system" },
            reason: "未於開始前完成審核",
            now: current,
          });
        }
      }
      await seriesRepository.setStatus(conn, series.id, "cancelled");
    },
  });
}

registerJob("expirePendingReviews", expirePendingReviews);

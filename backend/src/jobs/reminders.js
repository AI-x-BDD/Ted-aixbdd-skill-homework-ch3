import { now } from "../clock.js";
import { withTransaction } from "../db/pool.js";
import { processDue, registerJob } from "./scanner.js";
import { bookingTimeParams, notify } from "../services/notificationService.js";

export async function sendReminders(current = now()) {
  await processDue(null, {
    select: async (conn) => {
      const [rows] = await conn.query(
        `SELECT b.*, v.name AS venue_name, r.int_value AS reminder_minutes
         FROM bookings b
         JOIN venues v ON v.id = b.venue_id
         JOIN rules r ON r.rule_key = 'reminder_minutes'
         WHERE b.status = 'confirmed'
           AND b.reminder_sent_at IS NULL
           AND b.start_at > :now
           AND DATE_SUB(b.start_at, INTERVAL r.int_value MINUTE) <= :now
           AND b.confirmed_at <= DATE_SUB(b.start_at, INTERVAL r.int_value MINUTE)
         ORDER BY b.start_at
         LIMIT 100
         FOR UPDATE SKIP LOCKED`,
        { now: current },
      );
      return [rows];
    },
    handle: async (conn, row) => {
      await notify(conn, {
        userId: row.user_id,
        type: "reminder",
        bookingId: row.id,
        params: bookingTimeParams(row),
        now: current,
      });
      await conn.query(
        "UPDATE bookings SET reminder_sent_at = :now WHERE id = :id",
        {
          now: current,
          id: row.id,
        },
      );
    },
  });
}

registerJob("sendReminders", sendReminders);
void withTransaction;

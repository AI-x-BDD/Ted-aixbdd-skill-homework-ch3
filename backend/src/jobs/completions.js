import { now } from "../clock.js";
import { processDue, registerJob } from "./scanner.js";
import { transition } from "../services/bookingTransition.js";

export async function completeCheckedIn(current = now()) {
  await processDue(null, {
    select: async (conn) => {
      const [rows] = await conn.query(
        `SELECT * FROM bookings
         WHERE status = 'checked_in' AND end_at <= :now
         ORDER BY end_at LIMIT 100 FOR UPDATE SKIP LOCKED`,
        { now: current },
      );
      return [rows];
    },
    handle: async (conn, row) => {
      await transition(conn, {
        bookingId: row.id,
        to: "completed",
        actor: { type: "system" },
        now: current,
      });
    },
  });
}

registerJob("completeCheckedIn", completeCheckedIn);

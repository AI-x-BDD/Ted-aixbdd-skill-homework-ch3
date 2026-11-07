import { now } from "../clock.js";
import { checkInWindow } from "../domain/checkIn.js";
import { processDue, registerJob } from "./scanner.js";
import * as eventRepository from "../repositories/eventRepository.js";
import * as ruleRepository from "../repositories/ruleRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import { formatUntil, notify } from "../services/notificationService.js";
import { transition } from "../services/bookingTransition.js";

function nextSlot(date) {
  const ms = date.getTime();
  const slot = 30 * 60 * 1000;
  return new Date(Math.ceil(ms / slot) * slot);
}

export async function markNoShows(current = now()) {
  await processDue(null, {
    select: async (conn) => {
      const rules = await ruleRepository.loadAll(conn);
      const [rows] = await conn.query(
        `SELECT b.*, v.name AS venue_name FROM bookings b
         JOIN venues v ON v.id = b.venue_id
         WHERE b.status = 'confirmed' AND b.start_at < :now
         ORDER BY b.start_at LIMIT 100 FOR UPDATE SKIP LOCKED`,
        { now: current },
      );
      const due = rows.filter(
        (row) => new Date(checkInWindow(row, rules).endAt) <= current,
      );
      return [due];
    },
    handle: async (conn, row) => {
      const locked = await userRepository.lockById(conn, row.user_id);
      const rules = await ruleRepository.loadAll(conn);
      const from = nextSlot(current);
      await transition(conn, {
        bookingId: row.id,
        to: "no_show",
        actor: { type: "system" },
        reason: "未於報到截止前報到",
        now: current,
        releaseFrom: from,
      });
      const since =
        locked.no_show_counted_from_at &&
        new Date(locked.no_show_counted_from_at) >
          new Date(
            current.getTime() -
              (rules.no_show_window_days?.int_value ?? 30) * 86400000,
          )
          ? locked.no_show_counted_from_at
          : new Date(
              current.getTime() -
                (rules.no_show_window_days?.int_value ?? 30) * 86400000,
            );
      const count = await eventRepository.countNoShows(
        conn,
        row.user_id,
        since,
      );
      if (count >= (rules.no_show_threshold?.int_value ?? 3)) {
        const until = new Date(
          current.getTime() + (rules.suspend_days?.int_value ?? 7) * 86400000,
        );
        await userRepository.setSuspension(conn, row.user_id, {
          suspendedUntil: until,
          noShowCountedFrom: until,
        });
        await notify(conn, {
          userId: row.user_id,
          type: "suspension",
          params: { until: formatUntil(until) },
          now: current,
        });
      }
    },
  });
}

registerJob("markNoShows", markNoShows);

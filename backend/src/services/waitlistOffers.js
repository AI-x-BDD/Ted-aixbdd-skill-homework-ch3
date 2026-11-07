import {
  fromTaipei,
  formatTaipei,
  toTaipeiParts,
} from "../../../shared/src/taipei.js";
import { occupy, registerReleaseListener, release } from "./slotService.js";
import { OccupiedError } from "../repositories/slotRepository.js";
import * as waitlistRepository from "../repositories/waitlistRepository.js";
import * as slotRepository from "../repositories/slotRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import * as ruleRepository from "../repositories/ruleRepository.js";
import { notify } from "./notificationService.js";

function timeParams(entry) {
  const start = toTaipeiParts(new Date(entry.start_at));
  const end = toTaipeiParts(new Date(entry.end_at));
  const endTime =
    end.time === "00:00" && end.date !== start.date ? "24:00" : end.time;
  return {
    venueName: entry.venue_name,
    date: start.date,
    startTime: start.time,
    endTime,
  };
}

export async function offerFreedSlots(conn, venueId, range, current) {
  const rules = await ruleRepository.loadAll(conn);
  const cutoff = rules.waitlist_cutoff_minutes?.int_value ?? 60;
  const confirm = rules.waitlist_confirm_minutes?.int_value ?? 30;
  const fromAt = range?.from ?? fromTaipei("1970-01-01", "00:00");
  const toAt = range?.to ?? new Date(current.getTime() + 365 * 86400000);
  const waiting = await waitlistRepository.listOverlapping(conn, venueId, {
    from: fromAt,
    to: toAt,
  });
  for (const entry of waiting) {
    if (
      new Date(entry.start_at).getTime() - current.getTime() <=
      cutoff * 60000
    ) {
      continue;
    }
    const occupied = await slotRepository.listOccupied(
      conn,
      venueId,
      entry.start_at,
      entry.end_at,
    );
    if (occupied.length) {
      continue;
    }
    const user = await userRepository.lockById(conn, entry.user_id);
    if (
      user.suspended_until_at &&
      new Date(user.suspended_until_at) > current
    ) {
      await waitlistRepository.close(conn, entry.id, {
        status: "expired",
        closeReason: "confirm_failed",
        now: current,
      });
      continue;
    }
    const expiresAt = new Date(current.getTime() + confirm * 60000);
    try {
      await occupy(
        conn,
        venueId,
        new Date(entry.start_at),
        new Date(entry.end_at),
        "hold",
        entry.id,
      );
    } catch (error) {
      if (error instanceof OccupiedError) {
        continue;
      }
      throw error;
    }
    await waitlistRepository.setOffered(conn, entry.id, expiresAt);
    await notify(conn, {
      userId: entry.user_id,
      type: "waitlist_offer",
      waitlistEntryId: entry.id,
      params: {
        ...timeParams(entry),
        expiresAt: formatTaipei(expiresAt, {
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      now: current,
    });
    break;
  }
}

registerReleaseListener(offerFreedSlots);
void release;

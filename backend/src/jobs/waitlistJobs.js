import { now } from "../clock.js";
import { processDue, registerJob } from "./scanner.js";
import * as slotRepository from "../repositories/slotRepository.js";
import * as waitlistRepository from "../repositories/waitlistRepository.js";
import { offerFreedSlots } from "../services/waitlistOffers.js";
import { notify } from "../services/notificationService.js";
import { toTaipeiParts } from "../../../shared/src/taipei.js";

function params(entry) {
  const start = toTaipeiParts(new Date(entry.start_at));
  const end = toTaipeiParts(new Date(entry.end_at));
  return {
    venueName: entry.venue_name,
    date: start.date,
    startTime: start.time,
    endTime: end.time,
  };
}

export async function expireWaitlistOffers(current = now()) {
  await processDue(null, {
    select: async (conn) => [
      await waitlistRepository.listDueOffers(conn, current),
    ],
    handle: async (conn, row) => {
      await waitlistRepository.close(conn, row.id, {
        status: "expired",
        closeReason: "offer_timeout",
        now: current,
      });
      await slotRepository.deleteByHolder(conn, "hold", row.id);
      await offerFreedSlots(
        conn,
        row.venue_id,
        { from: row.start_at, to: row.end_at },
        current,
      );
      await notify(conn, {
        userId: row.user_id,
        type: "waitlist_expired",
        waitlistEntryId: row.id,
        params: { ...params(row), reason: "逾時未確認" },
        now: current,
      });
    },
  });
}

export async function expireStartedWaitlist(current = now()) {
  await processDue(null, {
    select: async (conn) => [
      await waitlistRepository.listStarted(conn, current),
    ],
    handle: async (conn, row) => {
      await waitlistRepository.close(conn, row.id, {
        status: "expired",
        closeReason: "started",
        now: current,
      });
      if (row.status === "offered") {
        await slotRepository.deleteByHolder(conn, "hold", row.id);
      }
      await notify(conn, {
        userId: row.user_id,
        type: "waitlist_expired",
        waitlistEntryId: row.id,
        params: { ...params(row), reason: "時段已開始" },
        now: current,
      });
    },
  });
}

export async function retryWaitlistOffers(current = now()) {
  await processDue(null, {
    select: async (conn) => {
      const [rows] = await conn.query(
        "SELECT DISTINCT venue_id FROM waitlist_entries WHERE status = 'waiting' LIMIT 20",
      );
      return [rows];
    },
    handle: async (conn, row) => {
      await offerFreedSlots(
        conn,
        row.venue_id,
        { from: current, to: new Date(current.getTime() + 90 * 86400000) },
        current,
      );
    },
  });
}

registerJob("expireWaitlistOffers", expireWaitlistOffers);
registerJob("expireStartedWaitlist", expireStartedWaitlist);
registerJob("retryWaitlistOffers", retryWaitlistOffers);

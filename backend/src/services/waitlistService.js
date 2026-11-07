import { fromTaipei, toTaipeiParts } from "../../../shared/src/taipei.js";
import { now } from "../clock.js";
import { validateBooking } from "../domain/bookingRules.js";
import { can } from "../domain/policy.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import * as bookingRepository from "../repositories/bookingRepository.js";
import * as eventRepository from "../repositories/eventRepository.js";
import * as ruleRepository from "../repositories/ruleRepository.js";
import * as slotRepository from "../repositories/slotRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import * as venueRepository from "../repositories/venueRepository.js";
import * as waitlistRepository from "../repositories/waitlistRepository.js";
import { toIso } from "./authService.js";
import { occupy } from "./slotService.js";
import { offerFreedSlots } from "./waitlistOffers.js";
import { notify } from "./notificationService.js";

function toEntry(row, rank) {
  const start = toTaipeiParts(new Date(row.start_at));
  const end = toTaipeiParts(new Date(row.end_at));
  return {
    id: Number(row.id),
    venueId: Number(row.venue_id),
    venueName: row.venue_name,
    date: start.date,
    startTime: start.time,
    endTime:
      end.time === "00:00" && end.date !== start.date ? "24:00" : end.time,
    subject: row.subject,
    attendees: Number(row.attendees),
    status: row.status,
    rank: rank ?? null,
    offerExpiresAt: row.offer_expires_at ? toIso(row.offer_expires_at) : null,
    closeReason: row.close_reason,
  };
}

export async function createWaitlistEntry(user, input) {
  if (!can(user, "waitlist:own")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const current = now();
  return withTransaction(async (conn) => {
    const venue = await venueRepository.findForBooking(conn, input.venueId);
    if (!venue?.is_active) {
      throw new HttpError(404, "找不到這個場地。請重新整理後再試一次。");
    }
    const rules = await ruleRepository.loadAll(conn);
    const locked = await userRepository.lockById(conn, user.id);
    if (
      locked.suspended_until_at &&
      new Date(locked.suspended_until_at) > current
    ) {
      throw new HttpError(409, "您的預約權限已暫停。", {
        violations: [{ rule: "suspended", message: "您的預約權限已暫停。" }],
      });
    }
    const violations = validateBooking(
      {
        venue,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        attendees: input.attendees,
        subject: input.subject,
      },
      rules,
      current,
    ).filter((item) => item.rule !== "status");
    if (violations.length) {
      throw new HttpError(400, violations[0].message, { violations });
    }
    const startAt = fromTaipei(input.date, input.startTime);
    const endAt = fromTaipei(input.date, input.endTime);
    const occupied = await slotRepository.listOccupied(
      conn,
      venue.id,
      startAt,
      endAt,
    );
    if (!occupied.length) {
      throw new HttpError(409, "此時段目前可直接預約，不必登記候補。", {
        violations: [
          {
            rule: "slot_free",
            message: "此時段目前可直接預約，不必登記候補。",
          },
        ],
      });
    }
    if (occupied.every((row) => row.holder_type === "maintenance")) {
      throw new HttpError(409, "此時段為維護中，無法登記候補。", {
        violations: [
          { rule: "maintenance", message: "此時段為維護中，無法登記候補。" },
        ],
      });
    }
    try {
      const id = await waitlistRepository.insert(conn, {
        user_id: user.id,
        venue_id: venue.id,
        start_at: startAt,
        end_at: endAt,
        subject: input.subject,
        attendees: input.attendees,
        created_at: current,
      });
      const overlapping = await waitlistRepository.listOverlapping(
        conn,
        venue.id,
        { from: startAt, to: endAt },
      );
      const rank =
        overlapping.findIndex((item) => Number(item.id) === Number(id)) + 1;
      return toEntry(
        {
          ...(await waitlistRepository.findById(conn, id)),
          venue_name: venue.name,
        },
        rank,
      );
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY" || error.errno === 1062) {
        throw new HttpError(409, "你已在此時段的候補中。", {
          violations: [
            { rule: "already_waiting", message: "你已在此時段的候補中。" },
          ],
        });
      }
      throw error;
    }
  });
}

export async function listMyWaitlist(user) {
  return withTransaction(async (conn) => {
    const rows = await waitlistRepository.listByUser(conn, user.id, {
      recentDays: 30,
    });
    const items = [];
    for (const row of rows) {
      const overlapping = await waitlistRepository.listOverlapping(
        conn,
        row.venue_id,
        { from: row.start_at, to: row.end_at },
      );
      const rank =
        overlapping.findIndex((item) => Number(item.id) === Number(row.id)) + 1;
      items.push(
        toEntry(
          row,
          row.status === "waiting" || row.status === "offered" ? rank : null,
        ),
      );
    }
    return { items };
  });
}

export async function cancelWaitlistEntry(user, entryId) {
  const current = now();
  return withTransaction(async (conn) => {
    const entry = await waitlistRepository.findById(conn, entryId);
    if (!entry || Number(entry.user_id) !== Number(user.id)) {
      throw new HttpError(404, "找不到這筆候補。請重新整理後再試一次。");
    }
    await waitlistRepository.close(conn, entryId, {
      status: "cancelled",
      closeReason: "cancelled",
      now: current,
    });
  });
}

export async function confirmWaitlistEntry(user, entryId) {
  const current = now();
  const fail = await withTransaction(async (conn) => {
    const entry = await waitlistRepository.findById(conn, entryId);
    if (!entry || Number(entry.user_id) !== Number(user.id)) {
      throw new HttpError(404, "找不到這筆候補。請重新整理後再試一次。");
    }
    if (entry.status !== "offered") {
      throw new HttpError(409, "這筆候補目前不是保留中。", {
        violations: [
          { rule: "not_offered", message: "這筆候補目前不是保留中。" },
        ],
      });
    }
    const locked = await userRepository.lockById(conn, user.id);
    const rules = await ruleRepository.loadAll(conn);
    const expired = new Date(entry.offer_expires_at) <= current;
    const suspended =
      locked.suspended_until_at &&
      new Date(locked.suspended_until_at) > current;
    const held = await bookingRepository.countHeld(conn, user.id, current);
    if (
      expired ||
      suspended ||
      held >= (rules.max_active_bookings?.int_value ?? 5)
    ) {
      await waitlistRepository.close(conn, entryId, {
        status: "expired",
        closeReason: expired ? "offer_timeout" : "confirm_failed",
        now: current,
      });
      await slotRepository.deleteByHolder(conn, "hold", entryId);
      await offerFreedSlots(
        conn,
        entry.venue_id,
        { from: entry.start_at, to: entry.end_at },
        current,
      );
      return expired ? "offer_expired" : suspended ? "suspended" : "quota";
    }
    return null;
  });
  if (fail) {
    const messages = {
      offer_expired: "保留已逾時，候補已失效。",
      suspended: "您的預約權限已暫停，候補已失效。",
      quota: "已達持有上限，候補已失效。",
    };
    throw new HttpError(409, messages[fail], {
      violations: [{ rule: fail, message: messages[fail] }],
    });
  }
  return withTransaction(async (conn) => {
    const entry = await waitlistRepository.findById(conn, entryId);
    const venue = await venueRepository.findForBooking(conn, entry.venue_id);
    const status = venue.requires_approval ? "pending" : "confirmed";
    const bookingId = await bookingRepository.insert(conn, {
      user_id: user.id,
      venue_id: venue.id,
      start_at: entry.start_at,
      end_at: entry.end_at,
      subject: entry.subject,
      attendees: entry.attendees,
      status,
      confirmed_at: status === "confirmed" ? current : null,
    });
    await conn.query(
      "UPDATE booking_slots SET holder_type = 'booking', holder_id = :bookingId WHERE holder_type = 'hold' AND holder_id = :entryId",
      { bookingId, entryId },
    );
    await waitlistRepository.close(conn, entryId, {
      status: "confirmed",
      bookingId,
      now: current,
    });
    await eventRepository.insert(conn, {
      bookingId,
      actorUserId: user.id,
      actorType: "user",
      occurredAt: current,
      fromStatus: null,
      toStatus: status,
    });
    void occupy;
    return { id: bookingId, status };
  });
}

export async function declineWaitlistEntry(user, entryId) {
  const current = now();
  return withTransaction(async (conn) => {
    const entry = await waitlistRepository.findById(conn, entryId);
    if (!entry || Number(entry.user_id) !== Number(user.id)) {
      throw new HttpError(404, "找不到這筆候補。請重新整理後再試一次。");
    }
    await waitlistRepository.close(conn, entryId, {
      status: "expired",
      closeReason: "declined",
      now: current,
    });
    await slotRepository.deleteByHolder(conn, "hold", entryId);
    await offerFreedSlots(
      conn,
      entry.venue_id,
      { from: entry.start_at, to: entry.end_at },
      current,
    );
    await notify(conn, {
      userId: user.id,
      type: "waitlist_expired",
      waitlistEntryId: entryId,
      params: {
        venueName: entry.venue_name,
        date: toTaipeiParts(new Date(entry.start_at)).date,
        startTime: toTaipeiParts(new Date(entry.start_at)).time,
        endTime: toTaipeiParts(new Date(entry.end_at)).time,
        reason: "主動放棄",
      },
      now: current,
    });
  });
}

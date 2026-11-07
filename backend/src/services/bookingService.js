import {
  fromTaipei,
  formatTaipei,
  toTaipeiParts,
} from "../../../shared/src/taipei.js";
import { now } from "../clock.js";
import { validateBooking } from "../domain/bookingRules.js";
import { can } from "../domain/policy.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import * as bookingRepository from "../repositories/bookingRepository.js";
import * as eventRepository from "../repositories/eventRepository.js";
import * as ruleRepository from "../repositories/ruleRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import * as venueRepository from "../repositories/venueRepository.js";
import {
  OccupiedError,
  occupy,
  notifyReleased,
  isRangeOccupied,
} from "./slotService.js";
import { buildSuggestions } from "./alternativeService.js";
import { toIso } from "./authService.js";
import { bookingTimeParams, notify } from "./notificationService.js";
import { canCheckIn, checkInWindow } from "../domain/checkIn.js";
import { isOwner } from "../domain/policy.js";
import * as slotRepository from "../repositories/slotRepository.js";
import { transition } from "./bookingTransition.js";
import { toMyBooking } from "./bookingView.js";

const VALIDATION_RULES = new Set([
  "time_unit",
  "end_not_after_start",
  "duration",
  "past",
  "advance",
  "opening_hours",
  "capacity",
]);
const OCCUPIED_MESSAGE = "該時段已被占用。請改選其他時段，或登記候補。";

// 400 類規則只要出現就回 400，否則回 409；400 類排在前面（FR-008、FR-017）
function throwViolations(violations, suggestions = null) {
  const ordered = [...violations].sort(
    (a, b) =>
      Number(!VALIDATION_RULES.has(a.rule)) -
      Number(!VALIDATION_RULES.has(b.rule)),
  );
  const status = VALIDATION_RULES.has(ordered[0].rule) ? 400 : 409;
  throw new HttpError(
    status,
    ordered[0].message,
    suggestions
      ? { violations: ordered, suggestions }
      : { violations: ordered },
  );
}

// 只有唯一未通過的規則是「時段被占用」時才附上建議（FR-001、FR-008）
async function suggestionsForOccupiedOnly(
  conn,
  violations,
  input,
  attendees,
  venue,
  rules,
  extra = {},
) {
  if (violations.length !== 1 || violations[0].rule !== "occupied") {
    return null;
  }
  return buildSuggestions(conn, {
    venue,
    input: {
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      attendees,
    },
    rules,
    current: now(),
    ...extra,
  });
}

// 修改預約寫入時才發現併發占用：交易回滾後由外層以新的唯讀交易重算建議
class RaceOccupied extends Error {
  constructor(context) {
    super("時段被占用（併發）");
    this.context = context;
  }
}

async function loadLatestUpdateSuggestions(bookingId, context) {
  return withTransaction(async (conn) => {
    const rules = await ruleRepository.loadAll(conn);
    const venue = await venueRepository.findForBooking(conn, context.venueId);
    if (!venue) {
      return null;
    }
    return buildSuggestions(conn, {
      venue,
      input: {
        date: context.date,
        startTime: context.startTime,
        endTime: context.endTime,
        attendees: context.attendees,
      },
      rules,
      current: now(),
      excludeWindow: context.excludeWindow,
      excludeHolder: { type: "booking", id: Number(bookingId) },
    });
  });
}

// 寫入時才發現併發占用：回滾後以最新占用狀況在新的唯讀交易內重算（FR-007、NFR-002）
async function loadLatestSuggestions(input, attendees) {
  return withTransaction(async (conn) => {
    const rules = await ruleRepository.loadAll(conn);
    const venue = await venueRepository.findForBooking(conn, input.venueId);
    if (!venue) {
      return null;
    }
    return buildSuggestions(conn, {
      venue,
      input: {
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        attendees,
      },
      rules,
      current: now(),
    });
  });
}

function requireCreate(user) {
  if (!can(user, "booking:create")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
}

function toBooking(row) {
  const start = toTaipeiParts(new Date(row.start_at));
  const end = toTaipeiParts(new Date(row.end_at));
  const endTime =
    end.time === "00:00" && end.date !== start.date ? "24:00" : end.time;
  return {
    id: Number(row.id),
    venueId: Number(row.venue_id),
    venueName: row.venue_name,
    date: start.date,
    startTime: start.time,
    endTime,
    startAt: toIso(row.start_at),
    endAt: toIso(row.end_at),
    subject: row.subject,
    attendees: Number(row.attendees),
    status: row.status,
    lateCancel: Boolean(row.late_cancel),
  };
}

export async function createBooking(user, input) {
  requireCreate(user);
  const current = now();
  const subject = String(input.subject ?? "").trim();
  const attendees = Number(input.attendees);
  const fields = [];
  if (!subject) {
    fields.push({ field: "subject", message: "請輸入主題。" });
  }
  if (!Number.isInteger(attendees) || attendees < 1) {
    fields.push({
      field: "attendees",
      message: "請輸入人數，須為 1 以上的整數。",
    });
  }
  if (fields.length) {
    throw new HttpError(400, "請修正標示的欄位後再送出。", { fields });
  }
  try {
    return await withTransaction(async (conn) => {
      const rules = await ruleRepository.loadAll(conn);
      const venue = await venueRepository.findForBooking(conn, input.venueId);
      if (!venue) {
        throw new HttpError(404, "找不到這個場地。請重新整理後再試一次。");
      }
      if (!venue.is_active) {
        throw new HttpError(409, "這個場地已停用，無法預約。", {
          violations: [
            { rule: "venue_inactive", message: "這個場地已停用，無法預約。" },
          ],
        });
      }
      const violations = validateBooking(
        {
          venue,
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          attendees,
          subject,
        },
        rules,
        current,
      ).filter((item) => item.rule !== "status");
      const locked = await userRepository.lockById(conn, user.id);
      if (
        locked.suspended_until_at &&
        new Date(locked.suspended_until_at) > current
      ) {
        const until = formatTaipei(new Date(locked.suspended_until_at), {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        violations.push({
          rule: "suspended",
          message: `您的預約權限已暫停，將於 ${until} 解除。解除前仍可報到、取消與修改既有預約。`,
        });
      }
      const held = await bookingRepository.countHeld(conn, user.id, current);
      const maxHeld = rules.max_active_bookings?.int_value ?? 5;
      if (held >= maxHeld) {
        violations.push({
          rule: "quota",
          message: `已達持有上限（最多 ${maxHeld} 筆）。請先取消或等待既有預約結束後再預約。`,
        });
      }
      const timeFormatValid = !violations.some(
        (item) =>
          item.rule === "time_unit" || item.rule === "end_not_after_start",
      );
      if (timeFormatValid && input.date) {
        const occupied = await isRangeOccupied(
          conn,
          venue.id,
          fromTaipei(input.date, input.startTime),
          fromTaipei(input.date, input.endTime),
        );
        if (occupied) {
          violations.push({ rule: "occupied", message: OCCUPIED_MESSAGE });
        }
      }
      if (violations.length) {
        const suggestions = await suggestionsForOccupiedOnly(
          conn,
          violations,
          input,
          attendees,
          venue,
          rules,
        );
        throwViolations(violations, suggestions);
      }
      const startAt = fromTaipei(input.date, input.startTime);
      const endAt = fromTaipei(input.date, input.endTime);
      const needsReview = Boolean(venue.requires_approval);
      const status = needsReview ? "pending" : "confirmed";
      const id = await bookingRepository.insert(conn, {
        user_id: user.id,
        venue_id: venue.id,
        start_at: startAt,
        end_at: endAt,
        subject,
        attendees,
        status,
        confirmed_at: needsReview ? null : current,
      });
      await occupy(conn, venue.id, startAt, endAt, "booking", id);
      await eventRepository.insert(conn, {
        bookingId: id,
        actorUserId: user.id,
        actorType: "user",
        occurredAt: current,
        fromStatus: null,
        toStatus: status,
        reason: null,
      });
      const created = await bookingRepository.findById(conn, id);
      if (status === "confirmed") {
        await notify(conn, {
          userId: user.id,
          type: "booking_created",
          bookingId: id,
          params: bookingTimeParams(created),
          now: current,
        });
      } else {
        const reviewerIds = await venueRepository.reviewerIdsOf(conn, venue.id);
        const targets = reviewerIds.filter(
          (idValue) => Number(idValue) !== Number(user.id),
        );
        if (!targets.length) {
          const admins = await userRepository.list(conn, {
            role: "admin",
            limit: 200,
          });
          targets.push(
            ...admins
              .filter(
                (item) => item.is_active && Number(item.id) !== Number(user.id),
              )
              .map((item) => item.id),
          );
        }
        for (const reviewerId of targets) {
          await notify(conn, {
            userId: reviewerId,
            type: "review_pending",
            bookingId: id,
            params: { ...bookingTimeParams(created), bookerName: user.name },
            now: current,
          });
        }
      }
      return toBooking(created);
    });
  } catch (error) {
    if (error instanceof OccupiedError || error.occupied) {
      const suggestions = await loadLatestSuggestions(input, attendees);
      throw new HttpError(409, OCCUPIED_MESSAGE, {
        violations: [{ rule: "occupied", message: OCCUPIED_MESSAGE }],
        ...(suggestions ? { suggestions } : {}),
      });
    }
    throw error;
  }
}

function assertOwner(user, booking) {
  if (!isOwner(user, booking) || !can(user, "booking:view", booking)) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
}

export async function getBooking(user, bookingId) {
  return withTransaction(async (conn) => {
    const booking = await bookingRepository.findById(conn, bookingId);
    if (!booking) {
      throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
    }
    if (!isOwner(user, booking)) {
      throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
    }
    const current = now();
    const snapshot = await ruleRepository.loadAll(conn);
    const events = await eventRepository.listByBooking(conn, booking.id);
    const last = [...events]
      .reverse()
      .find(
        (event) =>
          event.to_status === "rejected" || event.to_status === "cancelled",
      );
    return toMyBooking(
      {
        ...booking,
        status_reason: last?.reason ?? null,
        status_actor: last?.actor_type ?? null,
      },
      snapshot,
      current,
    );
  });
}

export async function cancelBooking(
  user,
  bookingId,
  { scope = "single" } = {},
) {
  if (!can(user, "booking:cancel")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const current = now();
  return withTransaction(async (conn) => {
    const booking = await bookingRepository.lockById(conn, bookingId);
    if (!booking) {
      throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
    }
    assertOwner(user, booking);
    if (
      !["pending", "confirmed"].includes(booking.status) ||
      new Date(booking.start_at) <= current
    ) {
      throw new HttpError(
        409,
        "無法取消這筆預約：預約已開始。請重新整理後再試一次。",
      );
    }
    const rules = await ruleRepository.loadAll(conn);
    const targets = [booking];
    if (scope === "following" && booking.series_id) {
      const rest = await bookingRepository.listBySeries(
        conn,
        booking.series_id,
      );
      targets.length = 0;
      targets.push(
        ...rest.filter(
          (item) =>
            item.series_index >= booking.series_index &&
            ["pending", "confirmed"].includes(item.status) &&
            new Date(item.start_at) > current,
        ),
      );
    }
    const cancelled = [];
    for (const item of targets) {
      const late =
        new Date(item.start_at).getTime() - current.getTime() <=
        (rules.late_cancel_minutes?.int_value ?? 60) * 60000;
      await bookingRepository.setLateCancel(conn, item.id, late);
      await transition(conn, {
        bookingId: item.id,
        to: "cancelled",
        actor: { type: "user", userId: user.id },
        reason: "預約者取消",
        now: current,
        lateCancel: late,
      });
      cancelled.push({ id: Number(item.id), lateCancel: late });
    }
    if (booking.series_id) {
      const left = await bookingRepository.listUncancelledBySeries(
        conn,
        booking.series_id,
      );
      if (!left.length) {
        await conn.query(
          "UPDATE booking_series SET status = 'cancelled' WHERE id = :id",
          { id: booking.series_id },
        );
      }
    }
    return { cancelledCount: cancelled.length, cancelled };
  });
}

export async function updateBooking(user, bookingId, input) {
  if (!can(user, "booking:update")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const current = now();
  try {
    return await withTransaction(async (conn) => {
      const booking = await bookingRepository.lockById(conn, bookingId);
      if (!booking) {
        throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
      }
      assertOwner(user, booking);
      if (
        !["pending", "confirmed"].includes(booking.status) ||
        new Date(booking.start_at) <= current
      ) {
        throw new HttpError(409, "這筆預約已開始或已結束，無法修改。", {
          violations: [
            { rule: "started", message: "這筆預約已開始或已結束，無法修改。" },
          ],
        });
      }
      const rules = await ruleRepository.loadAll(conn);
      const venue = await venueRepository.findForBooking(
        conn,
        input.venueId ?? booking.venue_id,
      );
      const scheduleChanged =
        Number(input.venueId ?? booking.venue_id) !==
          Number(booking.venue_id) ||
        input.date ||
        input.startTime ||
        input.endTime;
      const subject = String(input.subject ?? booking.subject).trim();
      const attendees = Number(input.attendees ?? booking.attendees);
      if (!scheduleChanged) {
        if (attendees > Number(venue.capacity)) {
          throw new HttpError(
            400,
            `人數超過容納人數（可容納 ${venue.capacity} 人）。請減少人數或改選其他場地。`,
            {
              violations: [
                {
                  rule: "capacity",
                  message: `人數超過容納人數（可容納 ${venue.capacity} 人）。請減少人數或改選其他場地。`,
                },
              ],
            },
          );
        }
        await bookingRepository.updateContent(conn, bookingId, {
          subject,
          attendees,
        });
        return toBooking(await bookingRepository.findById(conn, bookingId));
      }
      const date = input.date ?? toTaipeiParts(new Date(booking.start_at)).date;
      const startTime =
        input.startTime ?? toTaipeiParts(new Date(booking.start_at)).time;
      const endParts = toTaipeiParts(new Date(booking.end_at));
      const endTime =
        input.endTime ?? (endParts.time === "00:00" ? "24:00" : endParts.time);
      // 先釋出這筆預約自己的原時段，再判定占用（FR-005：原時段不算被占用）；
      // 任一規則未通過時整個交易回滾，原預約維持不變
      await slotRepository.deleteByHolder(conn, "booking", bookingId);
      const violations = validateBooking(
        { venue, date, startTime, endTime, attendees, subject },
        rules,
        current,
      ).filter((item) => item.rule !== "status");
      const timeFormatValid = !violations.some(
        (item) =>
          item.rule === "time_unit" || item.rule === "end_not_after_start",
      );
      if (timeFormatValid) {
        const occupied = await isRangeOccupied(
          conn,
          venue.id,
          fromTaipei(date, startTime),
          fromTaipei(date, endTime),
        );
        if (occupied) {
          violations.push({ rule: "occupied", message: OCCUPIED_MESSAGE });
        }
      }
      if (violations.length) {
        const originalStartParts = toTaipeiParts(new Date(booking.start_at));
        const originalEndParts = toTaipeiParts(new Date(booking.end_at));
        // 場地未改時，原時段不列為建議（FR-005 後半）
        const excludeWindow =
          Number(venue.id) === Number(booking.venue_id)
            ? {
                date: originalStartParts.date,
                startTime: originalStartParts.time,
                endTime:
                  originalEndParts.time === "00:00"
                    ? "24:00"
                    : originalEndParts.time,
              }
            : null;
        const suggestions = await suggestionsForOccupiedOnly(
          conn,
          violations,
          { date, startTime, endTime },
          attendees,
          venue,
          rules,
          { excludeWindow },
        );
        throwViolations(violations, suggestions);
      }
      const startAt = fromTaipei(date, startTime);
      const endAt = fromTaipei(date, endTime);
      try {
        await occupy(conn, venue.id, startAt, endAt, "booking", bookingId);
      } catch (error) {
        if (error instanceof OccupiedError || error.occupied) {
          throw new RaceOccupied({
            venueId: venue.id,
            date,
            startTime,
            endTime,
            attendees,
            excludeWindow:
              Number(venue.id) === Number(booking.venue_id)
                ? {
                    date: toTaipeiParts(new Date(booking.start_at)).date,
                    startTime: toTaipeiParts(new Date(booking.start_at)).time,
                    endTime:
                      toTaipeiParts(new Date(booking.end_at)).time === "00:00"
                        ? "24:00"
                        : toTaipeiParts(new Date(booking.end_at)).time,
                  }
                : null,
          });
        }
        throw error;
      }
      await bookingRepository.updateContent(conn, bookingId, {
        subject,
        attendees,
      });
      await bookingRepository.updateSchedule(conn, bookingId, {
        venueId: venue.id,
        startAt,
        endAt,
      });
      await conn.query(
        "UPDATE bookings SET confirmed_at = :now, reminder_sent_at = NULL WHERE id = :id",
        {
          now: current,
          id: bookingId,
        },
      );
      if (venue.requires_approval && booking.status !== "pending") {
        await transition(conn, {
          bookingId,
          to: "pending",
          actor: { type: "user", userId: user.id },
          reason: "修改後需重新審核",
          now: current,
        });
      }
      await notify(conn, {
        userId: user.id,
        type: "booking_changed",
        bookingId,
        params: { venueName: venue.name, date, startTime, endTime },
        now: current,
      });
      await notifyReleased(
        conn,
        booking.venue_id,
        { from: booking.start_at, to: booking.end_at },
        current,
      );
      return toBooking(await bookingRepository.findById(conn, bookingId));
    });
  } catch (error) {
    if (error instanceof RaceOccupied) {
      const suggestions = await loadLatestUpdateSuggestions(
        bookingId,
        error.context,
      );
      throw new HttpError(409, OCCUPIED_MESSAGE, {
        violations: [{ rule: "occupied", message: OCCUPIED_MESSAGE }],
        ...(suggestions ? { suggestions } : {}),
      });
    }
    throw error;
  }
}

export async function checkInBooking(user, bookingId) {
  if (!can(user, "booking:check-in")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const current = now();
  return withTransaction(async (conn) => {
    const booking = await bookingRepository.lockById(conn, bookingId);
    if (!booking) {
      throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
    }
    if (!isOwner(user, booking)) {
      throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
    }
    const rules = await ruleRepository.loadAll(conn);
    const window = checkInWindow(booking, rules);
    if (!canCheckIn(booking, rules, current)) {
      throw new HttpError(
        409,
        `目前不在報到時間內。可報到時間為 ${window.startAt}–${window.endAt}。`,
        {
          violations: [
            {
              rule: booking.status === "confirmed" ? "not_in_window" : "status",
              message: `目前不在報到時間內。可報到時間為 ${window.startAt}–${window.endAt}。`,
            },
          ],
        },
      );
    }
    await transition(conn, {
      bookingId,
      to: "checked_in",
      actor: { type: "user", userId: user.id },
      now: current,
    });
    return toBooking(await bookingRepository.findById(conn, bookingId));
  });
}

export { toBooking };

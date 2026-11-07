import { fromTaipei, toTaipeiParts } from "../../../shared/src/taipei.js";
import { now } from "../clock.js";
import { validateBooking } from "../domain/bookingRules.js";
import { expandSeries } from "../domain/series.js";
import { can } from "../domain/policy.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import * as bookingRepository from "../repositories/bookingRepository.js";
import * as eventRepository from "../repositories/eventRepository.js";
import * as ruleRepository from "../repositories/ruleRepository.js";
import * as seriesRepository from "../repositories/seriesRepository.js";
import * as slotRepository from "../repositories/slotRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import * as venueRepository from "../repositories/venueRepository.js";
import { OccupiedError, occupy } from "./slotService.js";

export async function previewBookingSeries(user, input) {
  const current = now();
  return withTransaction(async (conn) => {
    const rules = await ruleRepository.loadAll(conn);
    const venue = await venueRepository.findForBooking(conn, input.venueId);
    if (!venue) {
      throw new HttpError(404, "找不到這個場地。請重新整理後再試一次。");
    }
    let sessions;
    try {
      sessions = expandSeries(input, rules);
    } catch (error) {
      if (error.violations) {
        throw new HttpError(400, error.violations[0].message, {
          violations: error.violations,
        });
      }
      throw error;
    }
    const results = [];
    for (const session of sessions) {
      const violations = validateBooking(
        {
          venue,
          date: session.date,
          startTime: session.startTime,
          endTime: session.endTime,
          attendees: input.attendees,
          subject: input.subject,
        },
        rules,
        session.date === sessions[0].date
          ? current
          : fromTaipei(session.date, "00:00"),
      ).filter(
        (item) => item.rule !== "advance" || session.date === sessions[0].date,
      );
      const occupied = await slotRepository.listOccupied(
        conn,
        venue.id,
        session.startAt,
        session.endAt,
      );
      const conflict = occupied.length
        ? "時段已被占用"
        : violations.find((item) => item.rule === "opening_hours")
          ? "不在開放時段內"
          : null;
      results.push({
        date: session.date,
        startTime: session.startTime,
        endTime: session.endTime,
        available:
          !conflict &&
          !violations.filter((item) => item.rule !== "opening_hours").length,
        reason: conflict,
      });
    }
    return {
      sessions: results,
      availableCount: results.filter((item) => item.available).length,
    };
  });
}

export async function createBookingSeries(user, input) {
  if (!can(user, "series:create")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const current = now();
  const skip = new Set(input.skipDates ?? []);
  try {
    return await withTransaction(async (conn) => {
      const rules = await ruleRepository.loadAll(conn);
      const venue = await venueRepository.findForBooking(conn, input.venueId);
      if (!venue?.is_active) {
        throw new HttpError(409, "這個場地已停用，無法預約。", {
          violations: [
            { rule: "venue_inactive", message: "這個場地已停用，無法預約。" },
          ],
        });
      }
      const sessions = expandSeries(input, rules);
      for (const date of skip) {
        if (!sessions.some((session) => session.date === date)) {
          throw new HttpError(400, "略過的日期不在展開場次中。");
        }
      }
      const locked = await userRepository.lockById(conn, user.id);
      if (
        locked.suspended_until_at &&
        new Date(locked.suspended_until_at) > current
      ) {
        throw new HttpError(409, "您的預約權限已暫停。", {
          violations: [{ rule: "suspended", message: "您的預約權限已暫停。" }],
        });
      }
      const held = await bookingRepository.countHeld(conn, user.id, current);
      if (held >= (rules.max_active_bookings?.int_value ?? 5)) {
        throw new HttpError(409, "已達持有上限。", {
          violations: [{ rule: "quota", message: "已達持有上限。" }],
        });
      }
      const seriesCount = await seriesRepository.countActiveSeries(
        conn,
        user.id,
        current,
      );
      if (seriesCount >= (rules.max_active_series?.int_value ?? 2)) {
        throw new HttpError(409, "已達週期性預約上限。", {
          violations: [
            { rule: "series_quota", message: "已達週期性預約上限。" },
          ],
        });
      }
      const chosen = sessions.filter((session) => !skip.has(session.date));
      if (!chosen.length) {
        throw new HttpError(
          400,
          "沒有可預約的場次。請調整日期或取消這批預約。",
          {
            violations: [
              {
                rule: "no_sessions",
                message: "沒有可預約的場次。請調整日期或取消這批預約。",
              },
            ],
          },
        );
      }
      const status = venue.requires_approval ? "pending" : "confirmed";
      const seriesId = await seriesRepository.insert(conn, {
        user_id: user.id,
        venue_id: venue.id,
        frequency: input.frequency,
        first_date: input.firstDate,
        last_date: input.lastDate,
        start_time: input.startTime,
        end_time: input.endTime,
        subject: input.subject,
        attendees: input.attendees,
        status,
        session_count: chosen.length,
      });
      const conflicts = [];
      for (const session of chosen) {
        try {
          await occupy(
            conn,
            venue.id,
            session.startAt,
            session.endAt,
            "booking",
            seriesId,
          );
        } catch (error) {
          if (error instanceof OccupiedError || error.occupied) {
            conflicts.push({
              date: session.date,
              startTime: session.startTime,
              endTime: session.endTime,
              reason: "時段已被占用",
            });
          } else {
            throw error;
          }
        }
      }
      if (conflicts.length) {
        throw new HttpError(
          409,
          "送出時發現新的衝突，尚未建立任何場次。請重新確認以下日期。",
          { conflicts },
        );
      }
      await slotRepository.deleteByHolder(conn, "booking", seriesId);
      let index = 1;
      for (const session of chosen) {
        const bookingId = await bookingRepository.insert(conn, {
          user_id: user.id,
          venue_id: venue.id,
          start_at: session.startAt,
          end_at: session.endAt,
          subject: input.subject,
          attendees: input.attendees,
          status,
          series_id: seriesId,
          series_index: index,
          confirmed_at: status === "confirmed" ? current : null,
        });
        await occupy(
          conn,
          venue.id,
          session.startAt,
          session.endAt,
          "booking",
          bookingId,
        );
        await eventRepository.insert(conn, {
          bookingId,
          actorUserId: user.id,
          actorType: "user",
          occurredAt: current,
          fromStatus: null,
          toStatus: status,
        });
        index += 1;
      }
      return { seriesId, sessionCount: chosen.length, status };
    });
  } catch (error) {
    if (error.violations && error.message === "series_max_months") {
      throw new HttpError(400, error.violations[0].message, {
        violations: error.violations,
      });
    }
    throw error;
  }
  void toTaipeiParts;
}

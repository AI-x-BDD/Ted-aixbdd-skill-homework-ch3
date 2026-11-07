import { toTaipeiParts } from "../../../shared/src/taipei.js";
import { now } from "../clock.js";
import { addTaipeiDays } from "../domain/bookingRules.js";
import { can } from "../domain/policy.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import * as bookingRepository from "../repositories/bookingRepository.js";
import * as eventRepository from "../repositories/eventRepository.js";
import * as ruleRepository from "../repositories/ruleRepository.js";
import { toIso } from "./authService.js";
import { toMyBooking } from "./bookingView.js";

function ruleValues(snapshot) {
  return {
    maxDurationMinutes: snapshot.max_duration_minutes?.int_value,
    maxAdvanceDays: snapshot.max_advance_days?.int_value,
    maxActiveBookings: snapshot.max_active_bookings?.int_value,
    maxActiveSeries: snapshot.max_active_series?.int_value,
    maxSeriesMonths: snapshot.max_series_months?.int_value,
    lateCancelMinutes: snapshot.late_cancel_minutes?.int_value,
    waitlistConfirmMinutes: snapshot.waitlist_confirm_minutes?.int_value,
    waitlistCutoffMinutes: snapshot.waitlist_cutoff_minutes?.int_value,
    checkinOpenMinutes: snapshot.checkin_open_minutes?.int_value,
    checkinCloseMinutes: snapshot.checkin_close_minutes?.int_value,
  };
}

export async function getContext(user, current = now()) {
  void user;
  return withTransaction(async (conn) => {
    const snapshot = await ruleRepository.loadAll(conn);
    const today = toTaipeiParts(current).date;
    const until = user.suspended_until_at
      ? new Date(user.suspended_until_at)
      : null;
    return {
      now: toIso(current),
      today,
      maxBookableDate: addTaipeiDays(
        today,
        snapshot.max_advance_days?.int_value ?? 30,
      ),
      rules: ruleValues(snapshot),
      suspendedUntil: until && until > current ? toIso(until) : null,
    };
  });
}

export async function listMyBookings(user, query = {}) {
  if (!can(user, "booking:list-own")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const tab = query.tab ?? "upcoming";
  if (tab !== "upcoming" && tab !== "past") {
    throw new HttpError(400, "請修正標示的欄位後再送出。", {
      fields: [{ field: "tab", message: "請選擇即將到來或已結束。" }],
    });
  }
  const current = now();
  return withTransaction(async (conn) => {
    const { items, total } = await bookingRepository.listMine(conn, {
      userId: user.id,
      tab,
      now: current,
      limit: Number(query.limit ?? 20),
      cursor: Number(query.offset ?? query.cursor ?? 0),
      offset: Number(query.offset ?? query.cursor ?? 0),
    });
    const snapshot = await ruleRepository.loadAll(conn);
    const mapped = [];
    for (const row of items) {
      const events = await eventRepository.listByBooking(conn, row.id);
      const last = [...events]
        .reverse()
        .find(
          (event) =>
            event.to_status === "rejected" || event.to_status === "cancelled",
        );
      mapped.push(
        toMyBooking(
          {
            ...row,
            status_reason: last?.reason ?? null,
            status_actor: last?.actor_type ?? null,
          },
          snapshot,
          current,
        ),
      );
    }
    return { items: mapped, total };
  });
}

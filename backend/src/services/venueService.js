import { fromTaipei, toTaipeiParts } from "../../../shared/src/taipei.js";
import { now } from "../clock.js";
import { addTaipeiDays } from "../domain/bookingRules.js";
import { can } from "../domain/policy.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import * as favoriteRepository from "../repositories/favoriteRepository.js";
import * as ruleRepository from "../repositories/ruleRepository.js";
import * as slotRepository from "../repositories/slotRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import * as venueRepository from "../repositories/venueRepository.js";

function requireManage(user) {
  if (!can(user, "venue:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
}

async function loadFavorites(conn, user) {
  try {
    return await favoriteRepository.listVenueIds(conn, user.id);
  } catch (error) {
    console.error("讀取收藏失敗，回應省略 isFavorite", error);
    return null;
  }
}

function withFavorite(venue, favorites) {
  if (!favorites) {
    return venue;
  }
  return { ...venue, isFavorite: favorites.has(Number(venue.id)) };
}

function timeToMinute(time) {
  if (time === "24:00") {
    return 1440;
  }
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
}

export function toAdmin(venue) {
  return {
    id: Number(venue.id),
    name: venue.name,
    location: venue.location,
    capacity: Number(venue.capacity),
    equipment: venue.equipment,
    requiresApproval: Boolean(venue.requires_approval),
    openingHours: venue.openingHours.map((hour) => ({
      weekday: hour.weekday,
      startTime: hour.startTime,
      endTime: hour.endTime,
    })),
    active: Boolean(venue.is_active),
    reviewers: venue.reviewers.map((item) => ({
      id: Number(item.id),
      name: item.name,
      email: item.email,
    })),
  };
}

async function validateInput(conn, input) {
  const name = String(input.name ?? "").trim();
  const location = String(input.location ?? "").trim();
  const capacity = Number(input.capacity);
  const fields = [];
  if (!name) {
    fields.push({ field: "name", message: "請輸入場地名稱。" });
  }
  if (!location) {
    fields.push({ field: "location", message: "請輸入地點。" });
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    fields.push({
      field: "capacity",
      message: "容納人數須為 1 以上的整數。請重新輸入。",
    });
  }
  if (
    !Array.isArray(input.equipment) ||
    input.equipment.some((item) => typeof item !== "string")
  ) {
    fields.push({ field: "equipment", message: "請修正標示的欄位後再送出。" });
  }
  const hours = Array.isArray(input.openingHours) ? input.openingHours : [];
  const byWeekday = new Map();
  for (const hour of hours) {
    const weekday = Number(hour.weekday);
    const start = timeToMinute(hour.startTime);
    const end = timeToMinute(hour.endTime);
    if (
      !Number.isInteger(weekday) ||
      weekday < 0 ||
      weekday > 6 ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end <= start ||
      start % 30 !== 0 ||
      end % 30 !== 0
    ) {
      fields.push({
        field: "openingHours",
        message: "開放時段的結束時間須晚於開始時間。請重新選擇。",
      });
      break;
    }
    const list = byWeekday.get(weekday) ?? [];
    if (list.some((item) => start < item.end && end > item.start)) {
      fields.push({
        field: "openingHours",
        message: "開放時段的結束時間須晚於開始時間。請重新選擇。",
      });
      break;
    }
    list.push({ start, end });
    byWeekday.set(weekday, list);
  }
  if (fields.length) {
    throw new HttpError(400, "請修正標示的欄位後再送出。", { fields });
  }
  const reviewerIds = Array.isArray(input.reviewerIds)
    ? [...new Set(input.reviewerIds.map(Number))]
    : [];
  if (input.requiresApproval) {
    if (!reviewerIds.length) {
      throw new HttpError(400, "請至少指派一位審核者。", {
        fields: [{ field: "reviewerIds", message: "請至少指派一位審核者。" }],
      });
    }
    for (const id of reviewerIds) {
      const user = await userRepository.findById(conn, id);
      if (!user || !user.is_active || !user.roles.includes("reviewer")) {
        throw new HttpError(400, "請至少指派一位審核者。", {
          fields: [{ field: "reviewerIds", message: "請至少指派一位審核者。" }],
        });
      }
    }
  }
  return {
    name,
    location,
    capacity,
    equipment: input.equipment ?? [],
    requires_approval: Boolean(input.requiresApproval),
    openingHours: hours,
    reviewerIds: input.requiresApproval ? reviewerIds : [],
  };
}

function duplicateNameError(error) {
  if (error.code === "ER_DUP_ENTRY" || error.errno === 1062) {
    return new HttpError(409, "名稱已被使用。請改用其他名稱。", {
      fields: [{ field: "name", message: "名稱已被使用。請改用其他名稱。" }],
    });
  }
  return error;
}

export async function listAdminVenues(user) {
  requireManage(user);
  return withTransaction(async (conn) => {
    const items = await venueRepository.listAll(conn);
    return { items: items.map(toAdmin) };
  });
}

export async function createVenue(user, input) {
  requireManage(user);
  try {
    return await withTransaction(async (conn) => {
      const data = await validateInput(conn, input);
      const id = await venueRepository.insert(conn, data);
      await venueRepository.replaceOpeningHours(conn, id, data.openingHours);
      await venueRepository.replaceReviewers(conn, id, data.reviewerIds);
      return toAdmin(await venueRepository.findById(conn, id));
    });
  } catch (error) {
    throw duplicateNameError(error);
  }
}

export function toPublic(venue) {
  return {
    id: Number(venue.id),
    name: venue.name,
    location: venue.location,
    capacity: Number(venue.capacity),
    equipment: venue.equipment,
    requiresApproval: Boolean(venue.requires_approval),
    openingHours: venue.openingHours.map((hour) => ({
      weekday: hour.weekday,
      startTime: hour.startTime,
      endTime: hour.endTime,
    })),
  };
}

export async function searchVenues(user, query = {}) {
  const { date, startTime, endTime, capacity, equipment } = query;
  if ((startTime || endTime) && !date) {
    throw new HttpError(400, "請先選擇日期再篩選時段。", {
      fields: [{ field: "date", message: "請先選擇日期再篩選時段。" }],
    });
  }
  if ((startTime && !endTime) || (!startTime && endTime)) {
    throw new HttpError(
      400,
      "時段不正確：結束時間須晚於開始時間。請重新選擇。",
      {
        fields: [
          {
            field: "endTime",
            message: "時段不正確：結束時間須晚於開始時間。請重新選擇。",
          },
        ],
      },
    );
  }
  if (
    startTime &&
    endTime &&
    timeToMinute(startTime) >= timeToMinute(endTime)
  ) {
    throw new HttpError(
      400,
      "時段不正確：結束時間須晚於開始時間。請重新選擇。",
      {
        fields: [
          {
            field: "endTime",
            message: "時段不正確：結束時間須晚於開始時間。請重新選擇。",
          },
        ],
      },
    );
  }
  if (
    capacity &&
    (!Number.isInteger(Number(capacity)) || Number(capacity) < 1)
  ) {
    throw new HttpError(400, "人數須為 1 以上的整數。請重新輸入。", {
      fields: [
        { field: "capacity", message: "人數須為 1 以上的整數。請重新輸入。" },
      ],
    });
  }
  const equipmentList = Array.isArray(equipment)
    ? equipment
    : equipment
      ? String(equipment)
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  return withTransaction(async (conn) => {
    let items = await venueRepository.search(conn, {
      date,
      startTime,
      endTime,
      capacity,
      equipment: equipmentList,
    });
    if (date && !startTime) {
      const current = now();
      const rules = await ruleRepository.loadAll(conn);
      const today = toTaipeiParts(current).date;
      const maxBookable = addTaipeiDays(
        today,
        rules.max_advance_days?.int_value ?? 30,
      );
      items = items.filter((venue) => {
        const weekday = toTaipeiParts(fromTaipei(date, "12:00")).weekday;
        const hours = venue.openingHours.filter(
          (hour) => hour.weekday === weekday,
        );
        if (!hours.length) {
          return false;
        }
        for (let minute = 0; minute < 1440; minute += 30) {
          const startTimeLabel = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
          const startAt = fromTaipei(date, startTimeLabel);
          const inOpen = hours.some(
            (hour) =>
              hour.open_minute <= minute && hour.close_minute >= minute + 30,
          );
          if (
            inOpen &&
            date >= today &&
            date <= maxBookable &&
            startAt > current
          ) {
            return true;
          }
        }
        return false;
      });
    }
    const favorites = await loadFavorites(conn, user);
    const options = new Set();
    const all = await venueRepository.listActive(conn);
    for (const venue of all) {
      for (const item of venue.equipment) {
        options.add(item);
      }
    }
    return {
      items: items.map((venue) => withFavorite(toPublic(venue), favorites)),
      equipmentOptions: [...options].sort(),
    };
  });
}

export async function getVenueCalendar(
  user,
  venueId,
  { date, view = "day" } = {},
) {
  const current = now();
  const today = toTaipeiParts(current).date;
  const target = date || today;
  return withTransaction(async (conn) => {
    const venue = await venueRepository.findById(conn, venueId);
    if (!venue || !venue.is_active) {
      throw new HttpError(404, "找不到這個場地。請重新整理後再試一次。");
    }
    const rules = await ruleRepository.loadAll(conn);
    const maxBookable = addTaipeiDays(
      today,
      rules.max_advance_days?.int_value ?? 30,
    );
    let from = target;
    let to = target;
    if (view === "week") {
      const parts = toTaipeiParts(fromTaipei(target, "12:00"));
      const mondayOffset = (parts.weekday + 6) % 7;
      const monday = new Date(
        fromTaipei(target, "12:00").getTime() - mondayOffset * 86400000,
      );
      from = toTaipeiParts(monday).date;
      to = toTaipeiParts(new Date(monday.getTime() + 6 * 86400000)).date;
    }
    const favorites = await loadFavorites(conn, user);
    const days = [];
    let cursor = from;
    while (cursor <= to) {
      const weekday = toTaipeiParts(fromTaipei(cursor, "12:00")).weekday;
      const openRanges = venue.openingHours.filter(
        (hour) => hour.weekday === weekday,
      );
      const occupied = await slotRepository.listForCalendar(
        conn,
        venue.id,
        fromTaipei(cursor, "00:00"),
        fromTaipei(cursor, "24:00"),
      );
      const occupiedMap = new Map(
        occupied.map((row) => [
          new Date(row.slot_start_at).toISOString(),
          row.holder_type,
        ]),
      );
      const slots = [];
      for (let minute = 0; minute < 1440; minute += 30) {
        const startTime = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
        const endMinute = minute + 30;
        const endTime =
          endMinute === 1440
            ? "24:00"
            : `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;
        const startAt = fromTaipei(cursor, startTime);
        const inOpen = openRanges.some(
          (hour) =>
            hour.open_minute <= minute && hour.close_minute >= endMinute,
        );
        let status = "closed";
        if (
          inOpen &&
          cursor >= today &&
          cursor <= maxBookable &&
          startAt > current
        ) {
          const holder = occupiedMap.get(startAt.toISOString());
          if (holder === "maintenance") {
            status = "maintenance";
          } else if (holder) {
            status = "booked";
          } else {
            status = "available";
          }
        }
        slots.push({ startTime, endTime, status });
      }
      days.push({
        date: cursor,
        weekday,
        openRanges: openRanges.map((hour) => ({
          startTime: hour.startTime,
          endTime: hour.endTime,
        })),
        slots,
      });
      cursor = toTaipeiParts(
        new Date(fromTaipei(cursor, "12:00").getTime() + 86400000),
      ).date;
    }
    return {
      venue: withFavorite(
        {
          id: Number(venue.id),
          name: venue.name,
          location: venue.location,
        },
        favorites,
      ),
      today,
      view,
      from,
      to,
      days,
    };
  });
}

export async function updateVenue(user, venueId, input) {
  requireManage(user);
  try {
    return await withTransaction(async (conn) => {
      const existing = await venueRepository.findById(conn, venueId);
      if (!existing) {
        throw new HttpError(404, "找不到這個場地。請重新整理後再試一次。");
      }
      const data = await validateInput(conn, input);
      await venueRepository.update(conn, venueId, data);
      await venueRepository.replaceOpeningHours(
        conn,
        venueId,
        data.openingHours,
      );
      await venueRepository.replaceReviewers(conn, venueId, data.reviewerIds);
      return toAdmin(await venueRepository.findById(conn, venueId));
    });
  } catch (error) {
    throw duplicateNameError(error);
  }
}

export async function previewVenueDeactivation(user, venueId) {
  requireManage(user);
  const { computeImpact } = await import("./impactService.js");
  return withTransaction(async (conn) => {
    const venue = await venueRepository.findById(conn, venueId);
    if (!venue) {
      throw new HttpError(404, "找不到這個場地。請重新整理後再試一次。");
    }
    const impact = await computeImpact(conn, {
      kind: "venue",
      venueId,
      now: now(),
    });
    return { bookings: impact.bookings, waitlistCount: impact.waitlistCount };
  });
}

export async function deactivateVenue(user, venueId, bookingIds = []) {
  requireManage(user);
  const current = now();
  const { assertConfirmed, cancelAffected, computeImpact } =
    await import("./impactService.js");
  const waitlistRepository =
    await import("../repositories/waitlistRepository.js");
  const slotRepository = await import("../repositories/slotRepository.js");
  const { notify } = await import("./notificationService.js");
  return withTransaction(async (conn) => {
    const venue = await venueRepository.findById(conn, venueId);
    if (!venue) {
      throw new HttpError(404, "找不到這個場地。請重新整理後再試一次。");
    }
    const impact = await computeImpact(conn, {
      kind: "venue",
      venueId,
      now: current,
    });
    assertConfirmed(impact, bookingIds);
    await cancelAffected(
      conn,
      impact,
      { type: "admin", userId: user.id },
      "場地停用",
      current,
    );
    const open = await waitlistRepository.listOpenByVenue(conn, venueId);
    for (const entry of open) {
      await waitlistRepository.close(conn, entry.id, {
        status: "expired",
        closeReason: "venue_disabled",
        now: current,
      });
      await slotRepository.deleteByHolder(conn, "hold", entry.id);
      await notify(conn, {
        userId: entry.user_id,
        type: "waitlist_expired",
        waitlistEntryId: entry.id,
        params: {
          venueName: venue.name,
          date: "",
          startTime: "",
          endTime: "",
          reason: "場地停用",
        },
        now: current,
      });
    }
    await conn.query("UPDATE venues SET is_active = 0 WHERE id = :id", {
      id: venueId,
    });
    return {
      cancelledBookingCount: impact.bookings.length,
      expiredWaitlistCount: open.length,
    };
  });
}

export async function enableVenue(user, venueId) {
  requireManage(user);
  return withTransaction(async (conn) => {
    await conn.query("UPDATE venues SET is_active = 1 WHERE id = :id", {
      id: venueId,
    });
    return toAdmin(await venueRepository.findById(conn, venueId));
  });
}

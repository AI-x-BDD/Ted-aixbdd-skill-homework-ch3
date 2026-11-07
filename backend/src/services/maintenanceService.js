import { fromTaipei } from "../../../shared/src/taipei.js";
import { now } from "../clock.js";
import { can } from "../domain/policy.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import * as maintenanceRepository from "../repositories/maintenanceRepository.js";
import * as slotRepository from "../repositories/slotRepository.js";
import { OccupiedError, occupy, notifyReleased } from "./slotService.js";
import {
  assertConfirmed,
  cancelAffected,
  computeImpact,
} from "./impactService.js";
import { toIso } from "./authService.js";

function requireAdmin(user) {
  if (!can(user, "venue:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
}

export async function listMaintenanceWindows(user, venueId) {
  requireAdmin(user);
  return withTransaction(async (conn) => {
    const items = await maintenanceRepository.listByVenue(conn, venueId);
    return {
      items: items.map((item) => ({
        id: Number(item.id),
        venueId: Number(item.venue_id),
        startAt: toIso(item.start_at),
        endAt: toIso(item.end_at),
      })),
    };
  });
}

export async function previewMaintenanceImpact(user, venueId, input) {
  requireAdmin(user);
  const startAt = fromTaipei(input.startDate, input.startTime);
  const endAt = fromTaipei(input.endDate, input.endTime);
  return withTransaction(async (conn) => {
    const impact = await computeImpact(conn, {
      kind: "maintenance",
      venueId,
      startAt,
      endAt,
      now: now(),
    });
    return { bookings: impact.bookings, waitlistCount: impact.waitlistCount };
  });
}

export async function createMaintenanceWindow(user, venueId, input) {
  requireAdmin(user);
  const current = now();
  const startAt = fromTaipei(input.startDate, input.startTime);
  const endAt = fromTaipei(input.endDate, input.endTime);
  if (!(endAt > startAt) || startAt.getMinutes() % 30 !== 0) {
    throw new HttpError(
      400,
      "時間不正確：結束須晚於開始，且以 30 分鐘為單位。請重新選擇。",
    );
  }
  try {
    return await withTransaction(async (conn) => {
      const impact = await computeImpact(conn, {
        kind: "maintenance",
        venueId,
        startAt,
        endAt,
        now: current,
      });
      assertConfirmed(impact, input.bookingIds ?? []);
      await cancelAffected(
        conn,
        impact,
        { type: "admin", userId: user.id },
        "場地維護",
        current,
      );
      const id = await maintenanceRepository.insert(conn, {
        venue_id: venueId,
        start_at: startAt,
        end_at: endAt,
      });
      await occupy(conn, venueId, startAt, endAt, "maintenance", id);
      const window = await maintenanceRepository.findById(conn, id);
      return {
        window: {
          id: Number(window.id),
          venueId: Number(window.venue_id),
          startAt: toIso(window.start_at),
          endAt: toIso(window.end_at),
        },
        cancelledBookingCount: impact.bookings.length,
      };
    });
  } catch (error) {
    if (error instanceof OccupiedError) {
      throw new HttpError(
        409,
        "受影響的預約已有變動，尚未停用。請確認最新清單後再試一次。",
      );
    }
    throw error;
  }
}

export async function updateMaintenanceWindow(user, venueId, windowId, input) {
  requireAdmin(user);
  const current = now();
  const startAt = fromTaipei(input.startDate, input.startTime);
  const endAt = fromTaipei(input.endDate, input.endTime);
  return withTransaction(async (conn) => {
    const existing = await maintenanceRepository.findById(conn, windowId);
    if (!existing) {
      throw new HttpError(404, "找不到這個維護時段。請重新整理後再試一次。");
    }
    const impact = await computeImpact(conn, {
      kind: "maintenance",
      venueId,
      startAt,
      endAt,
      now: current,
    });
    assertConfirmed(impact, input.bookingIds ?? []);
    await cancelAffected(
      conn,
      impact,
      { type: "admin", userId: user.id },
      "場地維護",
      current,
    );
    await slotRepository.deleteByHolder(conn, "maintenance", windowId);
    await maintenanceRepository.update(conn, windowId, {
      start_at: startAt,
      end_at: endAt,
    });
    await occupy(conn, venueId, startAt, endAt, "maintenance", windowId);
    const window = await maintenanceRepository.findById(conn, windowId);
    return {
      window: {
        id: Number(window.id),
        venueId: Number(window.venue_id),
        startAt: toIso(window.start_at),
        endAt: toIso(window.end_at),
      },
      cancelledBookingCount: impact.bookings.length,
    };
  });
}

export async function deleteMaintenanceWindow(user, venueId, windowId) {
  requireAdmin(user);
  const current = now();
  return withTransaction(async (conn) => {
    const existing = await maintenanceRepository.findById(conn, windowId);
    if (!existing) {
      throw new HttpError(404, "找不到這個維護時段。請重新整理後再試一次。");
    }
    await slotRepository.deleteByHolder(conn, "maintenance", windowId);
    await maintenanceRepository.remove(conn, windowId);
    await notifyReleased(
      conn,
      venueId,
      { from: existing.start_at, to: existing.end_at },
      current,
    );
  });
}

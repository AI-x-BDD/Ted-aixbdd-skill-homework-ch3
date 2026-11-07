import { now } from "../clock.js";
import { can, isAdmin } from "../domain/policy.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import * as bookingRepository from "../repositories/bookingRepository.js";
import * as seriesRepository from "../repositories/seriesRepository.js";
import * as venueRepository from "../repositories/venueRepository.js";
import { bookingTimeParams, notify } from "./notificationService.js";
import { toBooking } from "./bookingService.js";
import { transition } from "./bookingTransition.js";

function toReviewItem(row, extra = {}) {
  const booking = toBooking(row);
  return {
    bookingId: booking.id,
    seriesId: row.series_id ? Number(row.series_id) : null,
    bookerName: row.booker_name,
    venueName: booking.venueName,
    date: booking.date,
    startTime: booking.startTime,
    endTime: booking.endTime,
    subject: booking.subject,
    attendees: booking.attendees,
    sessions: extra.sessions ?? null,
    assignedToAdmin: Boolean(extra.assignedToAdmin),
  };
}

export async function listReviews(user) {
  if (!can(user, "review:list")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  return withTransaction(async (conn) => {
    const items = [];
    const seenSeries = new Set();

    async function pushRow(row, extra = {}) {
      if (row.series_id) {
        const seriesId = Number(row.series_id);
        if (seenSeries.has(seriesId)) {
          return;
        }
        seenSeries.add(seriesId);
        const sessions = await bookingRepository.listBySeries(conn, seriesId);
        items.push(
          toReviewItem(row, {
            ...extra,
            sessions: sessions.map((session) => {
              const item = toBooking(session);
              return {
                date: item.date,
                startTime: item.startTime,
                endTime: item.endTime,
                status: item.status,
              };
            }),
          }),
        );
        return;
      }
      items.push(toReviewItem(row, extra));
    }

    if (user.roles.includes("reviewer")) {
      const venueIds = await venueRepository.venueIdsOfReviewer(conn, user.id);
      const rows = await bookingRepository.listPendingForVenues(conn, venueIds);
      for (const row of rows) {
        if (Number(row.user_id) === Number(user.id)) {
          continue;
        }
        await pushRow(row);
      }
    }
    if (isAdmin(user)) {
      const rows = await bookingRepository.listPendingAll(conn);
      for (const row of rows) {
        const reviewers = await venueRepository.reviewerIdsOf(
          conn,
          row.venue_id,
        );
        const others = reviewers.filter(
          (id) => Number(id) !== Number(row.user_id),
        );
        if (!others.length && Number(row.user_id) !== Number(user.id)) {
          await pushRow(row, { assignedToAdmin: true });
        }
      }
    }
    return { items };
  });
}

export async function approveBooking(user, bookingId) {
  const current = now();
  return withTransaction(async (conn) => {
    const booking = await bookingRepository.lockById(conn, bookingId);
    if (!booking) {
      throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
    }
    const reviewerIds = await venueRepository.reviewerIdsOf(
      conn,
      booking.venue_id,
    );
    if (!can(user, "review:decide", { ...booking, reviewerIds })) {
      throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
    }
    await transition(conn, {
      bookingId,
      to: "confirmed",
      actor: { type: isAdmin(user) ? "admin" : "reviewer", userId: user.id },
      now: current,
    });
    await notify(conn, {
      userId: booking.user_id,
      type: "review_result",
      bookingId,
      params: {
        ...bookingTimeParams({ ...booking, venue_name: booking.venue_name }),
        approved: true,
      },
      now: current,
    });
    return toBooking(await bookingRepository.findById(conn, bookingId));
  });
}

export async function rejectBooking(user, bookingId, reason) {
  if (!String(reason ?? "").trim()) {
    throw new HttpError(400, "請填寫駁回原因。", {
      fields: [{ field: "reason", message: "請填寫駁回原因。" }],
    });
  }
  const current = now();
  return withTransaction(async (conn) => {
    const booking = await bookingRepository.lockById(conn, bookingId);
    if (!booking) {
      throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
    }
    const reviewerIds = await venueRepository.reviewerIdsOf(
      conn,
      booking.venue_id,
    );
    if (!can(user, "review:decide", { ...booking, reviewerIds })) {
      throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
    }
    await transition(conn, {
      bookingId,
      to: "rejected",
      actor: { type: isAdmin(user) ? "admin" : "reviewer", userId: user.id },
      reason,
      now: current,
    });
    await notify(conn, {
      userId: booking.user_id,
      type: "review_result",
      bookingId,
      params: {
        ...bookingTimeParams({ ...booking, venue_name: booking.venue_name }),
        approved: false,
        reason,
      },
      now: current,
    });
    return toBooking(await bookingRepository.findById(conn, bookingId));
  });
}

export async function approveSeries(user, seriesId) {
  const current = now();
  return withTransaction(async (conn) => {
    const series = await seriesRepository.lockById(conn, seriesId);
    if (!series || series.status !== "pending") {
      throw new HttpError(409, "此申請已被處理。清單已更新。");
    }
    const sessions = await bookingRepository.listUncancelledBySeries(
      conn,
      seriesId,
    );
    const first = sessions[0];
    const reviewerIds = first
      ? await venueRepository.reviewerIdsOf(conn, first.venue_id)
      : [];
    if (first && !can(user, "series:review", { ...first, reviewerIds })) {
      throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
    }
    for (const session of sessions) {
      if (session.status === "pending") {
        await transition(conn, {
          bookingId: session.id,
          to: "confirmed",
          actor: {
            type: isAdmin(user) ? "admin" : "reviewer",
            userId: user.id,
          },
          now: current,
        });
      }
    }
    await seriesRepository.setStatus(conn, seriesId, "confirmed");
    return { seriesId: Number(seriesId), status: "confirmed" };
  });
}

export async function rejectSeries(user, seriesId, reason) {
  if (!String(reason ?? "").trim()) {
    throw new HttpError(400, "請填寫駁回原因。", {
      fields: [{ field: "reason", message: "請填寫駁回原因。" }],
    });
  }
  const current = now();
  return withTransaction(async (conn) => {
    const series = await seriesRepository.lockById(conn, seriesId);
    if (!series || series.status !== "pending") {
      throw new HttpError(409, "此申請已被處理。清單已更新。");
    }
    const sessions = await bookingRepository.listUncancelledBySeries(
      conn,
      seriesId,
    );
    for (const session of sessions) {
      if (session.status === "pending") {
        await transition(conn, {
          bookingId: session.id,
          to: "rejected",
          actor: {
            type: isAdmin(user) ? "admin" : "reviewer",
            userId: user.id,
          },
          reason,
          now: current,
        });
      }
    }
    await seriesRepository.setStatus(conn, seriesId, "rejected");
    return { seriesId: Number(seriesId), status: "rejected" };
  });
}

import { withTransaction } from "../db/pool.js";
import { now } from "../clock.js";
import { can } from "../domain/policy.js";
import { HttpError } from "../lib/http.js";
import * as favoriteRepository from "../repositories/favoriteRepository.js";
import * as venueRepository from "../repositories/venueRepository.js";

function requireFavorite(user) {
  if (!can(user, "favorite:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
}

export async function addFavorite(user, venueId) {
  requireFavorite(user);
  return withTransaction(async (conn) => {
    const venue = await venueRepository.findForBooking(conn, venueId);
    if (!venue) {
      throw new HttpError(404, "找不到這個場地。請重新整理後再試一次。");
    }
    if (!venue.is_active) {
      throw new HttpError(409, "此場地已停用，無法收藏。", {
        violations: [
          { rule: "venue_inactive", message: "此場地已停用，無法收藏。" },
        ],
      });
    }
    await favoriteRepository.add(conn, {
      userId: user.id,
      venueId: venue.id,
      createdAt: now(),
    });
    return { venueId: Number(venue.id), isFavorite: true };
  });
}

export async function removeFavorite(user, venueId) {
  requireFavorite(user);
  return withTransaction(async (conn) => {
    await favoriteRepository.remove(conn, {
      userId: user.id,
      venueId: Number(venueId),
    });
    return { venueId: Number(venueId), isFavorite: false };
  });
}

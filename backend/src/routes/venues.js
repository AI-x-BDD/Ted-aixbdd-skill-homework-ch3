import { HttpError, sendJson } from "../lib/http.js";
import { requireAuth } from "../lib/auth.js";
import * as favoriteService from "../services/favoriteService.js";
import * as venueService from "../services/venueService.js";

export function register(router) {
  router.get(
    "/api/venues",
    requireAuth(async (req, res, { user }) => {
      const result = await venueService.searchVenues(user, {
        date: req.query.date,
        startTime: req.query.startTime,
        endTime: req.query.endTime,
        capacity: req.query.capacity,
        equipment: req.query.equipment,
      });
      sendJson(res, 200, result);
    }),
  );

  router.put(
    "/api/venues/:venueId/favorite",
    requireAuth(async (req, res, { user }) => {
      const result = await favoriteService.addFavorite(
        user,
        Number(req.params.venueId),
      );
      sendJson(res, 200, result);
    }),
  );

  router.delete(
    "/api/venues/:venueId/favorite",
    requireAuth(async (req, res, { user }) => {
      const result = await favoriteService.removeFavorite(
        user,
        Number(req.params.venueId),
      );
      sendJson(res, 200, result);
    }),
  );

  router.get(
    "/api/venues/:venueId/calendar",
    requireAuth(async (req, res, { user }) => {
      const view = req.query.view ?? "day";
      if (view !== "day" && view !== "week") {
        throw new HttpError(400, "請修正標示的欄位後再送出。", {
          fields: [{ field: "view", message: "請選擇日或週檢視。" }],
        });
      }
      const result = await venueService.getVenueCalendar(
        user,
        Number(req.params.venueId),
        {
          date: req.query.date,
          view,
        },
      );
      sendJson(res, 200, result);
    }),
  );
}

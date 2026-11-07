import { can } from "../domain/policy.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError, readJsonBody, sendJson } from "../lib/http.js";
import * as reviewService from "../services/reviewService.js";

export function register(router) {
  router.get(
    "/api/reviews",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "review:list")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(res, 200, await reviewService.listReviews(user));
    }),
  );
  router.post(
    "/api/reviews/bookings/:bookingId/approve",
    requireAuth(async (req, res, { user }) => {
      sendJson(
        res,
        200,
        await reviewService.approveBooking(user, Number(req.params.bookingId)),
      );
    }),
  );
  router.post(
    "/api/reviews/bookings/:bookingId/reject",
    requireAuth(async (req, res, { user }) => {
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await reviewService.rejectBooking(
          user,
          Number(req.params.bookingId),
          body.reason,
        ),
      );
    }),
  );
  router.post(
    "/api/reviews/series/:seriesId/approve",
    requireAuth(async (req, res, { user }) => {
      sendJson(
        res,
        200,
        await reviewService.approveSeries(user, Number(req.params.seriesId)),
      );
    }),
  );
  router.post(
    "/api/reviews/series/:seriesId/reject",
    requireAuth(async (req, res, { user }) => {
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await reviewService.rejectSeries(
          user,
          Number(req.params.seriesId),
          body.reason,
        ),
      );
    }),
  );
}

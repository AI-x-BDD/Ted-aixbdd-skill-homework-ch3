import { can } from "../domain/policy.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError, readJsonBody, sendJson } from "../lib/http.js";
import * as adminBookingService from "../services/adminBookingService.js";

export function register(router) {
  router.get(
    "/api/admin/bookings",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "admin:booking-view")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        200,
        await adminBookingService.listAdminBookings(user, req.query),
      );
    }),
  );
  router.get(
    "/api/admin/bookings/:bookingId/events",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "admin:booking-view")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        200,
        await adminBookingService.listBookingEvents(
          user,
          Number(req.params.bookingId),
        ),
      );
    }),
  );
  router.post(
    "/api/admin/bookings/:bookingId/cancel",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "admin:booking-cancel")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await adminBookingService.adminCancelBooking(
          user,
          Number(req.params.bookingId),
          body.reason,
        ),
      );
    }),
  );
}

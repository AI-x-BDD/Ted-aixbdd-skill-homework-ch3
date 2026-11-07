import { can } from "../domain/policy.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError, readJsonBody, sendJson } from "../lib/http.js";
import * as bookingService from "../services/bookingService.js";
import * as contextService from "../services/contextService.js";

export function register(router) {
  router.post(
    "/api/bookings",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "booking:create")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      const created = await bookingService.createBooking(user, body);
      sendJson(res, 201, created);
    }),
  );

  router.get(
    "/api/bookings/mine",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "booking:list-own")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const result = await contextService.listMyBookings(user, req.query);
      sendJson(res, 200, result);
    }),
  );

  router.get(
    "/api/bookings/:bookingId",
    requireAuth(async (req, res, { user }) => {
      const booking = await bookingService.getBooking(
        user,
        Number(req.params.bookingId),
      );
      if (!can(user, "booking:view", booking)) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(res, 200, booking);
    }),
  );

  router.put(
    "/api/bookings/:bookingId",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "booking:update")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      const updated = await bookingService.updateBooking(
        user,
        Number(req.params.bookingId),
        body,
      );
      sendJson(res, 200, updated);
    }),
  );

  router.post(
    "/api/bookings/:bookingId/cancel",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "booking:cancel")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      const result = await bookingService.cancelBooking(
        user,
        Number(req.params.bookingId),
        body,
      );
      sendJson(res, 200, result);
    }),
  );

  router.post(
    "/api/bookings/:bookingId/check-in",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "booking:check-in")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const result = await bookingService.checkInBooking(
        user,
        Number(req.params.bookingId),
      );
      sendJson(res, 200, result);
    }),
  );
}

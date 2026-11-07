import { can } from "../domain/policy.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError, readJsonBody, sendJson } from "../lib/http.js";
import * as maintenanceService from "../services/maintenanceService.js";
import * as venueService from "../services/venueService.js";

export function register(router) {
  router.get(
    "/api/admin/venues",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const result = await venueService.listAdminVenues(user);
      sendJson(res, 200, result);
    }),
  );

  router.post(
    "/api/admin/venues",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      const created = await venueService.createVenue(user, body);
      sendJson(res, 201, created);
    }),
  );

  router.put(
    "/api/admin/venues/:venueId",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      const updated = await venueService.updateVenue(
        user,
        Number(req.params.venueId),
        body,
      );
      sendJson(res, 200, updated);
    }),
  );

  router.get(
    "/api/admin/venues/:venueId/maintenance-windows",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        200,
        await maintenanceService.listMaintenanceWindows(
          user,
          Number(req.params.venueId),
        ),
      );
    }),
  );
  router.post(
    "/api/admin/venues/:venueId/maintenance-windows",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        201,
        await maintenanceService.createMaintenanceWindow(
          user,
          Number(req.params.venueId),
          await readJsonBody(req),
        ),
      );
    }),
  );
  router.post(
    "/api/admin/venues/:venueId/maintenance-windows/impact",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        200,
        await maintenanceService.previewMaintenanceImpact(
          user,
          Number(req.params.venueId),
          await readJsonBody(req),
        ),
      );
    }),
  );
  router.put(
    "/api/admin/venues/:venueId/maintenance-windows/:windowId",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        200,
        await maintenanceService.updateMaintenanceWindow(
          user,
          Number(req.params.venueId),
          Number(req.params.windowId),
          await readJsonBody(req),
        ),
      );
    }),
  );
  router.delete(
    "/api/admin/venues/:venueId/maintenance-windows/:windowId",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      await maintenanceService.deleteMaintenanceWindow(
        user,
        Number(req.params.venueId),
        Number(req.params.windowId),
      );
      res.writeHead(204);
      res.end();
    }),
  );
  router.get(
    "/api/admin/venues/:venueId/deactivation-impact",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        200,
        await venueService.previewVenueDeactivation(
          user,
          Number(req.params.venueId),
        ),
      );
    }),
  );
  router.post(
    "/api/admin/venues/:venueId/deactivate",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await venueService.deactivateVenue(
          user,
          Number(req.params.venueId),
          body.bookingIds ?? [],
        ),
      );
    }),
  );
  router.post(
    "/api/admin/venues/:venueId/enable",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "venue:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        200,
        await venueService.enableVenue(user, Number(req.params.venueId)),
      );
    }),
  );
}

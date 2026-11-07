import { can } from "../domain/policy.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError, readJsonBody, sendJson } from "../lib/http.js";
import * as seriesService from "../services/seriesService.js";

export function register(router) {
  router.post(
    "/api/booking-series/preview",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "series:create")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        200,
        await seriesService.previewBookingSeries(user, await readJsonBody(req)),
      );
    }),
  );
  router.post(
    "/api/booking-series",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "series:create")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        201,
        await seriesService.createBookingSeries(user, await readJsonBody(req)),
      );
    }),
  );
}

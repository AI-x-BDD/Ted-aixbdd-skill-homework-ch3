import { can } from "../domain/policy.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError, readJsonBody, sendJson } from "../lib/http.js";
import * as waitlistService from "../services/waitlistService.js";

export function register(router) {
  router.get(
    "/api/waitlist",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "waitlist:own")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(res, 200, await waitlistService.listMyWaitlist(user));
    }),
  );
  router.post(
    "/api/waitlist",
    requireAuth(async (req, res, { user }) => {
      sendJson(
        res,
        201,
        await waitlistService.createWaitlistEntry(
          user,
          await readJsonBody(req),
        ),
      );
    }),
  );
  router.post(
    "/api/waitlist/:entryId/confirm",
    requireAuth(async (req, res, { user }) => {
      sendJson(
        res,
        201,
        await waitlistService.confirmWaitlistEntry(
          user,
          Number(req.params.entryId),
        ),
      );
    }),
  );
  router.post(
    "/api/waitlist/:entryId/decline",
    requireAuth(async (req, res, { user }) => {
      await waitlistService.declineWaitlistEntry(
        user,
        Number(req.params.entryId),
      );
      res.writeHead(204);
      res.end();
    }),
  );
  router.post(
    "/api/waitlist/:entryId/cancel",
    requireAuth(async (req, res, { user }) => {
      await waitlistService.cancelWaitlistEntry(
        user,
        Number(req.params.entryId),
      );
      res.writeHead(204);
      res.end();
    }),
  );
}

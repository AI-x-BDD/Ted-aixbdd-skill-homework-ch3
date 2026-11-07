import { can } from "../domain/policy.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError, readJsonBody, sendJson } from "../lib/http.js";
import * as userService from "../services/userService.js";

export function register(router) {
  router.get(
    "/api/users",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "user:list")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const result = await userService.listUsers(user, req.query);
      sendJson(res, 200, result);
    }),
  );

  router.post(
    "/api/users",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "user:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      const created = await userService.createUser(user, body);
      sendJson(res, 201, created);
    }),
  );

  router.patch(
    "/api/users/:userId",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "user:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      const updated = await userService.updateUser(
        user,
        Number(req.params.userId),
        body,
      );
      sendJson(res, 200, updated);
    }),
  );

  router.put(
    "/api/users/:userId/password",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "user:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      await userService.resetUserPassword(
        user,
        Number(req.params.userId),
        body.newPassword,
      );
      res.writeHead(204);
      res.end();
    }),
  );

  router.get(
    "/api/users/:userId/deactivation-impact",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "user:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        200,
        await userService.previewUserDeactivation(
          user,
          Number(req.params.userId),
        ),
      );
    }),
  );
  router.post(
    "/api/users/:userId/deactivate",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "user:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await userService.deactivateUser(
          user,
          Number(req.params.userId),
          body.bookingIds ?? [],
        ),
      );
    }),
  );
  router.post(
    "/api/users/:userId/enable",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "user:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(
        res,
        200,
        await userService.enableUser(user, Number(req.params.userId)),
      );
    }),
  );
}

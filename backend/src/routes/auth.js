import { can } from "../domain/policy.js";
import { hashToken, requireAuth } from "../lib/auth.js";
import {
  clearSessionCookie,
  HttpError,
  readCookie,
  readJsonBody,
  sendJson,
  setSessionCookie,
} from "../lib/http.js";
import * as authService from "../services/authService.js";

export function register(router) {
  router.post("/api/auth/login", async (req, res) => {
    const body = await readJsonBody(req);
    const { token, user } = await authService.login(body.email, body.password);
    setSessionCookie(req, res, token);
    sendJson(res, 200, user);
  });

  router.post(
    "/api/auth/logout",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "auth:self")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const token = readCookie(req, "sid");
      if (token) {
        await authService.logout(hashToken(token));
      }
      clearSessionCookie(req, res);
      res.writeHead(204);
      res.end();
    }),
  );

  router.get(
    "/api/auth/me",
    requireAuth(async (_req, res, { user }) => {
      if (!can(user, "auth:self")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(res, 200, authService.currentUser(user));
    }),
  );

  router.put(
    "/api/auth/password",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "auth:self")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      await authService.changePassword(
        user.id,
        body.oldPassword,
        body.newPassword,
      );
      clearSessionCookie(req, res);
      res.writeHead(204);
      res.end();
    }),
  );
}

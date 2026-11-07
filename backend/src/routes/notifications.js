import { requireAuth } from "../lib/auth.js";
import { sendJson } from "../lib/http.js";
import * as notificationService from "../services/notificationService.js";

export function register(router) {
  router.get(
    "/api/notifications",
    requireAuth(async (req, res, { user }) => {
      const result = await notificationService.listNotifications(
        user,
        req.query,
      );
      sendJson(res, 200, result);
    }),
  );

  router.get(
    "/api/notifications/unread-count",
    requireAuth(async (req, res, { user }) => {
      const result = await notificationService.getUnreadCount(user);
      sendJson(res, 200, result);
    }),
  );

  router.post(
    "/api/notifications/:notificationId/read",
    requireAuth(async (req, res, { user }) => {
      await notificationService.markNotificationRead(
        user,
        Number(req.params.notificationId),
      );
      res.writeHead(204);
      res.end();
    }),
  );
}

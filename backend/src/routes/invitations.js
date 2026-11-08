import { can } from "../domain/policy.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError, readJsonBody, sendJson } from "../lib/http.js";
import * as invitationService from "../services/invitationService.js";

const NOT_FOUND_MESSAGE = "找不到這份邀請。請回到「我的邀請」確認。";

// 路徑參數不是正整數時與「不存在」同樣回 404，不洩漏任何資訊
function invitationIdOf(req) {
  const raw = req.params.invitationId;
  if (!/^\d+$/.test(String(raw))) {
    throw new HttpError(404, NOT_FOUND_MESSAGE);
  }
  return Number(raw);
}

function bookingIdOf(req) {
  const raw = req.params.bookingId;
  if (!/^\d+$/.test(String(raw))) {
    throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
  }
  return Number(raw);
}

function assertCanRespond(user) {
  if (!can(user, "invitation:respond")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
}

export function register(router) {
  router.get(
    "/api/invitations",
    requireAuth(async (req, res, { user }) => {
      assertCanRespond(user);
      const result = await invitationService.listMyInvitations(user);
      sendJson(res, 200, result);
    }),
  );

  router.get(
    "/api/invitations/:invitationId",
    requireAuth(async (req, res, { user }) => {
      assertCanRespond(user);
      const result = await invitationService.getInvitation(
        user,
        invitationIdOf(req),
      );
      sendJson(res, 200, result);
    }),
  );

  router.put(
    "/api/invitations/:invitationId/response",
    requireAuth(async (req, res, { user }) => {
      assertCanRespond(user);
      const invitationId = invitationIdOf(req);
      const body = await readJsonBody(req);
      const result = await invitationService.respondInvitation(
        user,
        invitationId,
        body,
      );
      sendJson(res, 200, result);
    }),
  );

  // 預約者視角的受邀名單與出席統計（API-02）；非本人由服務層回 403
  router.get(
    "/api/bookings/:bookingId/invitations",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "invitation:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const result = await invitationService.listBookingInvitees(
        user,
        bookingIdOf(req),
      );
      sendJson(res, 200, result);
    }),
  );

  // 新增受邀者（API-02）：全有或全無，任何 Email 有問題時回 400 並列出 inviteeProblems
  router.post(
    "/api/bookings/:bookingId/invitations",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "invitation:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const bookingId = bookingIdOf(req);
      const body = await readJsonBody(req);
      const result = await invitationService.addBookingInvitees(
        user,
        bookingId,
        body,
      );
      sendJson(res, 201, result);
    }),
  );

  // 移除受邀者（API-02）：已失效者視為成功，連點兩次結果與單次一致
  router.delete(
    "/api/bookings/:bookingId/invitations/:invitationId",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "invitation:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const result = await invitationService.removeBookingInvitee(
        user,
        bookingIdOf(req),
        invitationIdOf(req),
      );
      sendJson(res, 200, result);
    }),
  );
}

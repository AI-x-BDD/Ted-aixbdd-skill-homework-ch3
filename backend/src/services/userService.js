import { now } from "../clock.js";
import { can, isAdmin } from "../domain/policy.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import { hashPassword } from "../lib/password.js";
import * as sessionRepository from "../repositories/sessionRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import * as venueRepository from "../repositories/venueRepository.js";
import { toCurrentUser, toIso } from "./authService.js";

function requireAdmin(user) {
  if (!can(user, "user:manage") && !can(user, "user:list") && !isAdmin(user)) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
}

function extraRoles(roles = []) {
  return [
    ...new Set(roles.filter((role) => role === "reviewer" || role === "admin")),
  ];
}

function toUser(row, current = now()) {
  const body = toCurrentUser(row, current);
  return {
    id: body.id,
    email: body.email,
    name: body.name,
    roles: body.roles,
    active: Boolean(row.is_active),
    mustChangePassword: body.mustChangePassword,
    suspendedUntil: body.suspendedUntil,
  };
}

function validatePassword(password, field = "password") {
  if (!password || password.length < 8 || password.length > 128) {
    throw new HttpError(400, "密碼長度須為 8 到 128 個字元。請重新輸入。", {
      fields: [
        { field, message: "密碼長度須為 8 到 128 個字元。請重新輸入。" },
      ],
    });
  }
}

export async function listUsers(actor, query = {}) {
  if (!can(actor, "user:list") && !can(actor, "user:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const current = now();
  return withTransaction(async (conn) => {
    const items = await userRepository.list(conn, {
      keyword: query.keyword,
      role: query.role,
      limit: 200,
    });
    return { items: items.map((item) => toUser(item, current)) };
  });
}

export async function createUser(actor, input) {
  requireAdmin(actor);
  if (!can(actor, "user:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const email = userRepository.normalizeEmail(input.email);
  const name = String(input.name ?? "").trim();
  const fields = [];
  if (!email || !email.includes("@")) {
    fields.push({ field: "email", message: "請輸入有效的 Email。" });
  }
  if (!name) {
    fields.push({ field: "name", message: "請輸入姓名。" });
  }
  if (fields.length) {
    throw new HttpError(400, "請修正標示的欄位後再送出。", { fields });
  }
  validatePassword(input.password);
  const roles = extraRoles(input.roles);
  try {
    return await withTransaction(async (conn) => {
      const id = await userRepository.insert(conn, {
        email,
        name,
        password_hash: await hashPassword(input.password),
        is_active: 1,
        must_change_password: 0,
      });
      await userRepository.replaceRoles(conn, id, roles);
      const created = await userRepository.findById(conn, id);
      return toUser(created);
    });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY" || error.errno === 1062) {
      throw new HttpError(409, "此 Email 已被使用。請改用其他 Email。", {
        fields: [
          { field: "email", message: "此 Email 已被使用。請改用其他 Email。" },
        ],
      });
    }
    throw error;
  }
}

export async function updateUser(actor, userId, input) {
  if (!can(actor, "user:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const name = String(input.name ?? "").trim();
  if (!name) {
    throw new HttpError(400, "請輸入姓名。", {
      fields: [{ field: "name", message: "請輸入姓名。" }],
    });
  }
  const roles = extraRoles(input.roles);
  return withTransaction(async (conn) => {
    const locked = await userRepository.lockById(conn, userId);
    if (!locked) {
      throw new HttpError(404, "找不到這個帳號。請重新整理後再試一次。");
    }
    const current = await userRepository.findById(conn, userId);
    const wasAdmin = current.roles.includes("admin");
    const willBeAdmin = roles.includes("admin");
    if (wasAdmin && !willBeAdmin && current.is_active) {
      const admins = await userRepository.countActiveAdmins(conn);
      if (admins <= 1) {
        throw new HttpError(
          409,
          "不能移除最後一位管理員。請先指定其他管理員。",
        );
      }
    }
    const hadReviewer = current.roles.includes("reviewer");
    const willBeReviewer = roles.includes("reviewer");
    await userRepository.updateName(conn, userId, name);
    await userRepository.replaceRoles(conn, userId, roles);
    if (hadReviewer && !willBeReviewer) {
      await venueRepository.deleteReviewersOfUser(conn, userId);
    }
    const updated = await userRepository.findById(conn, userId);
    return toUser(updated);
  });
}

export async function resetUserPassword(actor, userId, newPassword) {
  if (!can(actor, "user:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  validatePassword(newPassword, "newPassword");
  await withTransaction(async (conn) => {
    const user = await userRepository.findById(conn, userId);
    if (!user) {
      throw new HttpError(404, "找不到這個帳號。請重新整理後再試一次。");
    }
    await userRepository.updatePassword(
      conn,
      userId,
      await hashPassword(newPassword),
      true,
    );
    await sessionRepository.deleteByUser(conn, userId);
  });
}

export async function previewUserDeactivation(actor, userId) {
  if (!can(actor, "user:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  const { computeImpact } = await import("./impactService.js");
  return withTransaction(async (conn) => {
    const impact = await computeImpact(conn, {
      kind: "user",
      userId,
      now: now(),
    });
    return { bookings: impact.bookings, waitlistCount: impact.waitlistCount };
  });
}

export async function deactivateUser(actor, userId, bookingIds = []) {
  if (!can(actor, "user:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  if (Number(actor.id) === Number(userId)) {
    throw new HttpError(409, "不能停用自己的帳號。");
  }
  const current = now();
  const { assertConfirmed, cancelAffected, computeImpact } =
    await import("./impactService.js");
  const waitlistRepository =
    await import("../repositories/waitlistRepository.js");
  const slotRepository = await import("../repositories/slotRepository.js");
  return withTransaction(async (conn) => {
    const locked = await userRepository.lockById(conn, userId);
    if (!locked) {
      throw new HttpError(404, "找不到這個帳號。請重新整理後再試一次。");
    }
    const currentUser = await userRepository.findById(conn, userId);
    if (currentUser.roles.includes("admin") && currentUser.is_active) {
      const admins = await userRepository.countActiveAdmins(conn);
      if (admins <= 1) {
        throw new HttpError(
          409,
          "不能停用最後一位管理員。請先指定其他管理員。",
        );
      }
    }
    const impact = await computeImpact(conn, {
      kind: "user",
      userId,
      now: current,
    });
    assertConfirmed(impact, bookingIds);
    await cancelAffected(
      conn,
      impact,
      { type: "admin", userId: actor.id },
      "帳號停用",
      current,
    );
    const open = await waitlistRepository.listOpenByUser(conn, userId);
    for (const entry of open) {
      await waitlistRepository.close(conn, entry.id, {
        status: "expired",
        closeReason: "account_disabled",
        now: current,
      });
      await slotRepository.deleteByHolder(conn, "hold", entry.id);
    }
    await conn.query("UPDATE users SET is_active = 0 WHERE id = :id", {
      id: userId,
    });
    await sessionRepository.deleteByUser(conn, userId);
    return {
      cancelledBookingCount: impact.bookings.length,
      expiredWaitlistCount: open.length,
    };
  });
}

export async function enableUser(actor, userId) {
  if (!can(actor, "user:manage")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
  return withTransaction(async (conn) => {
    await conn.query("UPDATE users SET is_active = 1 WHERE id = :id", {
      id: userId,
    });
    return toUser(await userRepository.findById(conn, userId));
  });
}

export { toIso };

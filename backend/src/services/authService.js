import { randomBytes } from "node:crypto";
import { now } from "../clock.js";
import { withTransaction } from "../db/pool.js";
import { hashToken } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";
import { hashPassword, verifyDummy, verifyPassword } from "../lib/password.js";
import * as sessionRepository from "../repositories/sessionRepository.js";
import * as userRepository from "../repositories/userRepository.js";

const IDLE_MS = 12 * 60 * 60 * 1000;

export function toIso(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

export function toCurrentUser(user, current = now()) {
  const until = user.suspended_until_at
    ? new Date(user.suspended_until_at)
    : null;
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    roles: user.roles ?? [],
    mustChangePassword: Boolean(user.must_change_password),
    suspendedUntil: until && until > current ? toIso(until) : null,
  };
}

export async function login(email, password) {
  if (!email || !password) {
    throw new HttpError(400, "請輸入 Email 與密碼。", {
      fields: [
        ...(!email ? [{ field: "email", message: "請輸入Email。" }] : []),
        ...(!password ? [{ field: "password", message: "請輸入密碼。" }] : []),
      ],
    });
  }
  const current = now();
  return withTransaction(async (conn) => {
    const user = await userRepository.findByEmail(conn, email);
    if (!user) {
      await verifyDummy(password);
      throw new HttpError(401, "Email 或密碼錯誤。請確認後再試一次。");
    }
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      throw new HttpError(401, "Email 或密碼錯誤。請確認後再試一次。");
    }
    if (!user.is_active) {
      throw new HttpError(403, "此帳號已停用。請洽管理員。");
    }
    const token = randomBytes(32).toString("hex");
    await sessionRepository.insert(conn, {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(current.getTime() + IDLE_MS),
    });
    return { token, user: toCurrentUser(user, current) };
  });
}

export async function logout(tokenHash) {
  await withTransaction(async (conn) => {
    await sessionRepository.deleteByTokenHash(conn, tokenHash);
  });
}

export async function changePassword(userId, oldPassword, newPassword) {
  if (!oldPassword || !newPassword) {
    throw new HttpError(400, "請輸入舊密碼與新密碼。", {
      fields: [
        ...(!oldPassword
          ? [{ field: "oldPassword", message: "請輸入舊密碼。" }]
          : []),
        ...(!newPassword
          ? [{ field: "newPassword", message: "請輸入新密碼。" }]
          : []),
      ],
    });
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    throw new HttpError(400, "新密碼長度須為 8 到 128 個字元。請重新輸入。", {
      fields: [
        {
          field: "newPassword",
          message: "新密碼長度須為 8 到 128 個字元。請重新輸入。",
        },
      ],
    });
  }
  await withTransaction(async (conn) => {
    const user = await userRepository.findById(conn, userId);
    if (!user) {
      throw new HttpError(401, "請先登入。");
    }
    const ok = await verifyPassword(oldPassword, user.password_hash);
    if (!ok) {
      throw new HttpError(400, "舊密碼不正確。請重新輸入。", {
        fields: [
          { field: "oldPassword", message: "舊密碼不正確。請重新輸入。" },
        ],
      });
    }
    const hash = await hashPassword(newPassword);
    await userRepository.updatePassword(conn, userId, hash, false);
    await sessionRepository.deleteByUser(conn, userId);
  });
}

export function currentUser(user) {
  return toCurrentUser(user, now());
}

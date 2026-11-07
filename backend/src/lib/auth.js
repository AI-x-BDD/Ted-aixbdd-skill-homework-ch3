import { createHash } from "node:crypto";
import { now } from "../clock.js";
import { pool } from "../db/pool.js";
import * as sessionRepository from "../repositories/sessionRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import { HttpError, readCookie, sendError } from "./http.js";

const IDLE_MS = 12 * 60 * 60 * 1000;
const ALLOWED_WHEN_MUST_CHANGE = new Set([
  "GET /api/auth/me",
  "PUT /api/auth/password",
  "POST /api/auth/logout",
]);

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function authenticate(req, conn, current) {
  const token = readCookie(req, "sid");
  if (!token) {
    return null;
  }
  const session = await sessionRepository.findValid(
    conn,
    hashToken(token),
    current,
  );
  if (!session) {
    return null;
  }
  const user = await userRepository.findById(conn, session.user_id);
  if (!user || !user.is_active) {
    return null;
  }
  await sessionRepository.extend(
    conn,
    session.id,
    new Date(current.getTime() + IDLE_MS),
  );
  return user;
}

function requestKey(req) {
  const pathname =
    req.pathname ?? new URL(req.url, "http://localhost").pathname;
  return `${req.method.toUpperCase()} ${pathname}`;
}

export function requireAuth(handler) {
  return async (req, res) => {
    const current = now();
    const conn = await pool.getConnection();
    try {
      const user = await authenticate(req, conn, current);
      if (!user) {
        sendError(res, 401, "請先登入。");
        return;
      }
      if (
        user.must_change_password &&
        !ALLOWED_WHEN_MUST_CHANGE.has(requestKey(req))
      ) {
        sendError(res, 403, "請先設定新密碼");
        return;
      }
      return handler(req, res, { user, now: current });
    } catch (error) {
      if (error instanceof HttpError) {
        sendError(res, error.status, error.message, error.extra);
        return;
      }
      throw error;
    } finally {
      conn.release();
    }
  };
}

import mysql from "mysql2/promise";
import { config } from "../config.js";
import { HttpError } from "../lib/http.js";

export const pool = mysql.createPool({
  uri: config.DATABASE_URL,
  timezone: "Z",
  namedPlaceholders: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

pool.pool.on("connection", (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

function isRetryable(error) {
  const code = error.errno ?? error.code;
  return (
    code === 1213 ||
    code === "ER_LOCK_DEADLOCK" ||
    code === 1205 ||
    code === "ER_LOCK_WAIT_TIMEOUT"
  );
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withTransaction(fn) {
  let lastError;
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (error) {
      try {
        await conn.rollback();
      } catch {
        // ignore rollback errors
      }
      lastError = error;
      if (!isRetryable(error) || attempt === 3) {
        if (isRetryable(error) && attempt === 3) {
          throw new HttpError(409, "系統忙碌，請稍後再試。");
        }
        throw error;
      }
      await delay(20 + Math.random() * 80);
    } finally {
      conn.release();
    }
  }
  throw lastError;
}

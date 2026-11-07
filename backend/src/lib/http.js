import { config } from "../config.js";

const BODY_LIMIT = 100 * 1024;

export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function sendError(res, status, message, extra = {}) {
  const body = { message };
  if (extra.fields) body.fields = extra.fields;
  if (extra.violations) body.violations = extra.violations;
  if (extra.conflicts) body.conflicts = extra.conflicts;
  if (extra.impact) body.impact = extra.impact;
  sendJson(res, status, body);
}

export function assertJsonMutation(req) {
  if (req.method === "GET" || req.method === "HEAD") {
    return;
  }
  const type = req.headers["content-type"] ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    throw new HttpError(400, "請以 JSON 格式送出資料。");
  }
  const origin = req.headers.origin;
  if (origin && !config.ALLOWED_ORIGINS.includes(origin)) {
    throw new HttpError(403, "這個來源不被允許。請從系統網站操作。");
  }
}

export function readJsonBody(req) {
  assertJsonMutation(req);
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new HttpError(400, "送出的資料太大。請縮小內容後再試一次。"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (size === 0) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "送出的資料格式不正確。請檢查後再試一次。"));
      }
    });
    req.on("error", reject);
  });
}

function cookieSecure(req) {
  return (
    req.socket?.encrypted === true ||
    req.headers["x-forwarded-proto"] === "https"
  );
}

export function setSessionCookie(req, res, token) {
  const parts = [`sid=${token}`, "HttpOnly", "SameSite=Lax", "Path=/"];
  if (cookieSecure(req)) {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(req, res) {
  const parts = ["sid=", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (cookieSecure(req)) {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function readCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }
  return null;
}

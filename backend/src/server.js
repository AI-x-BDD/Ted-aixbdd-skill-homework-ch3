import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { pool } from "./db/pool.js";
import { startScanner } from "./jobs/scanner.js";
import "./jobs/reminders.js";
import "./jobs/reviewExpiry.js";
import "./jobs/noShows.js";
import "./jobs/completions.js";
import "./services/waitlistOffers.js";
import "./jobs/waitlistJobs.js";

const distDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../frontend/dist",
);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function serveStatic(res, pathname) {
  let filePath = join(distDir, pathname === "/" ? "index.html" : pathname);
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distDir, "index.html");
  }
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
  });
  createReadStream(filePath).pipe(res);
}

const app = await createApp();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname.startsWith("/api")) {
    await app(req, res);
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(res, url.pathname);
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(config.PORT);
startScanner({ pool, intervalMs: config.SCAN_INTERVAL_MS });

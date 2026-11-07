import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { assertJsonMutation, HttpError, sendError } from "./lib/http.js";
import { createRouter } from "./lib/router.js";

export async function createApp() {
  const router = createRouter();
  const routesDir = join(dirname(fileURLToPath(import.meta.url)), "routes");
  try {
    const files = (await readdir(routesDir))
      .filter((name) => name.endsWith(".js"))
      .sort();
    for (const file of files) {
      const mod = await import(pathToFileURL(join(routesDir, file)).href);
      if (typeof mod.register === "function") {
        mod.register(router);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return async function app(req, res) {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        assertJsonMutation(req);
      }
      await router.handle(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        sendError(res, error.status, error.message, error.extra);
        return;
      }
      console.error(error);
      sendError(res, 500, "系統發生問題，請稍後再試。");
    }
  };
}

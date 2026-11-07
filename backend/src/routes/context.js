import { requireAuth } from "../lib/auth.js";
import { sendJson } from "../lib/http.js";
import { getContext } from "../services/contextService.js";

export function register(router) {
  router.get(
    "/api/context",
    requireAuth(async (req, res, { user, now: current }) => {
      const result = await getContext(user, current);
      sendJson(res, 200, result);
    }),
  );
}

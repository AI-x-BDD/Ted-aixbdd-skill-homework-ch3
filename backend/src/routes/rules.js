import { can } from "../domain/policy.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError, readJsonBody, sendJson } from "../lib/http.js";
import * as ruleService from "../services/ruleService.js";

export function register(router) {
  router.get(
    "/api/rules",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "rule:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(res, 200, await ruleService.listRules(user));
    }),
  );
  router.get(
    "/api/rules/changes",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "rule:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(res, 200, await ruleService.listRuleChanges(user, req.query));
    }),
  );
  router.put(
    "/api/rules/:ruleKey",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "rule:manage")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const body = await readJsonBody(req);
      sendJson(
        res,
        200,
        await ruleService.updateRule(user, req.params.ruleKey, body.value),
      );
    }),
  );
}

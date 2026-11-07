import { can } from "../domain/policy.js";
import { requireAuth } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";
import { sendJson } from "../lib/http.js";
import * as reportService from "../services/reportService.js";

export function register(router) {
  router.get(
    "/api/reports",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "report:view")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      sendJson(res, 200, await reportService.getReport(user, req.query));
    }),
  );
  router.get(
    "/api/reports/csv",
    requireAuth(async (req, res, { user }) => {
      if (!can(user, "report:view")) {
        throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
      }
      const csv = await reportService.exportReportCsv(user, req.query);
      const filename = `場地報表_${req.query.from}_${req.query.to}.csv`;
      const body = Buffer.from(csv, "utf8");
      res.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Content-Length": body.length,
      });
      res.end(body);
    }),
  );
}

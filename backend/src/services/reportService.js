import { fromTaipei } from "../../../shared/src/taipei.js";
import { can } from "../domain/policy.js";
import { computeReport } from "../domain/report.js";
import { toCsv } from "../domain/csv.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import * as reportRepository from "../repositories/reportRepository.js";

function requireAdmin(user) {
  if (!can(user, "report:view")) {
    throw new HttpError(403, "你沒有權限使用這個功能。請洽管理員。");
  }
}

async function loadReport(user, { from, to }) {
  requireAdmin(user);
  if (!from || !to || to < from) {
    throw new HttpError(
      400,
      "日期區間不正確：結束日期不可早於開始日期。請重新選擇。",
    );
  }
  return withTransaction(async (conn) => {
    const venues = await reportRepository.listVenuesForReport(conn);
    const fromAt = fromTaipei(from, "00:00");
    const toAt = fromTaipei(to, "24:00");
    const bookings = [];
    for (const venue of venues) {
      bookings.push(
        ...(await reportRepository.listBookingsForReport(
          conn,
          venue.id,
          fromAt,
          toAt,
        )),
      );
    }
    return computeReport({ venues, bookings, from, to });
  });
}

export async function getReport(admin, query) {
  return loadReport(admin, query);
}

export async function exportReportCsv(admin, query) {
  const report = await loadReport(admin, query);
  const rows = [
    ["場地", "使用率", "尖峰時段", "取消率", "逾時取消筆數", "未到場率"],
  ];
  for (const venue of report.venues) {
    const noData = venue.cancellation.display === "無資料";
    rows.push([
      venue.venueName,
      venue.utilization.display,
      venue.peakDisplay,
      venue.cancellation.display,
      noData ? "無資料" : String(venue.lateCancelCount),
      venue.noShow.display,
    ]);
  }
  return toCsv(rows);
}

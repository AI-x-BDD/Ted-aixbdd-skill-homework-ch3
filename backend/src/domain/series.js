import {
  addTaipeiMonths,
  fromTaipei,
  toTaipeiParts,
} from "../../../shared/src/taipei.js";
import { addTaipeiDays } from "./bookingRules.js";

export function expandSeries(
  { firstDate, frequency, lastDate, startTime, endTime },
  rules,
) {
  const step = frequency === "biweekly" ? 14 : 7;
  const maxMonths = rules.max_series_months?.int_value ?? 3;
  const maxLast = addTaipeiMonths(firstDate, maxMonths);
  if (lastDate > maxLast) {
    const error = new Error("series_max_months");
    error.violations = [
      {
        rule: "series_max_months",
        message: `週期性預約最長 ${maxMonths} 個月。請提前最後一場的日期。`,
      },
    ];
    throw error;
  }
  const sessions = [];
  let cursor = firstDate;
  while (cursor <= lastDate) {
    sessions.push({
      date: cursor,
      startTime,
      endTime,
      startAt: fromTaipei(cursor, startTime),
      endAt: fromTaipei(cursor, endTime),
      weekday: toTaipeiParts(fromTaipei(cursor, startTime)).weekday,
    });
    cursor = addTaipeiDays(cursor, step);
  }
  return sessions;
}

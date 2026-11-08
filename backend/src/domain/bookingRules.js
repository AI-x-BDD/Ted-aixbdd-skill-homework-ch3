import { fromTaipei, toTaipeiParts } from "../../../shared/src/taipei.js";

export function timeToMinute(time) {
  if (time === "24:00") {
    return 1440;
  }
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
}

function isHalfHour(time) {
  const minute = timeToMinute(time);
  return Number.isFinite(minute) && minute % 30 === 0;
}

function addDays(dateString, days) {
  const start = fromTaipei(dateString, "12:00");
  return toTaipeiParts(new Date(start.getTime() + days * 86400000)).date;
}

function formatDuration(minutes) {
  if (minutes % 60 === 0) {
    return `${minutes / 60} 小時`;
  }
  return `${minutes} 分鐘`;
}

export function validateBooking(
  { venue, date, startTime, endTime, attendees, subject },
  rules,
  current,
) {
  const violations = [];
  const start = timeToMinute(startTime);
  const end = timeToMinute(endTime);
  if (!isHalfHour(startTime) || !isHalfHour(endTime) || start > 23 * 60 + 30) {
    violations.push({
      rule: "time_unit",
      message: "時間須以 30 分鐘為單位。請重新選擇。",
    });
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    violations.push({
      rule: "end_not_after_start",
      message: "結束時間須晚於開始時間。請重新選擇。",
    });
  }
  const length = end - start;
  const maxDuration = rules.max_duration_minutes?.int_value ?? 240;
  if (
    Number.isFinite(length) &&
    length >= 0 &&
    (length < 30 || length > maxDuration)
  ) {
    violations.push({
      rule: "duration",
      message: `單次最長 ${formatDuration(maxDuration)}。請縮短預約時間。`,
    });
  }
  const startAt = date && startTime ? fromTaipei(date, startTime) : null;
  if (startAt && startAt <= current) {
    violations.push({
      rule: "past",
      message: "不能預約已過去的時間。請選擇之後的時段。",
    });
  }
  const today = toTaipeiParts(current).date;
  const maxDays = rules.max_advance_days?.int_value ?? 30;
  const maxBookable = addDays(today, maxDays);
  if (date && date > maxBookable) {
    violations.push({
      rule: "advance",
      message: `最遠可預約到 ${maxBookable}。請選擇更早的日期。`,
    });
  }
  if (
    venue &&
    startAt &&
    Number.isFinite(start) &&
    Number.isFinite(end) &&
    end > start
  ) {
    const weekday = toTaipeiParts(startAt).weekday;
    const hours = (venue.openingHours ?? []).filter(
      (hour) => Number(hour.weekday) === weekday,
    );
    const fits = hours.some((hour) => {
      const open = hour.open_minute ?? timeToMinute(hour.startTime);
      const close = hour.close_minute ?? timeToMinute(hour.endTime);
      return open <= start && close >= end;
    });
    if (!fits) {
      violations.push({
        rule: "opening_hours",
        message: "預約須落在開放時段內。請參考行事曆選擇開放的時間。",
      });
    }
  }
  const headcount = Number(attendees);
  if (
    !Number.isInteger(headcount) ||
    headcount < 1 ||
    (venue && headcount > Number(venue.capacity))
  ) {
    const cap = venue?.capacity ?? 1;
    violations.push({
      rule: "capacity",
      message: `人數超過容納人數（可容納 ${cap} 人）。請減少人數或改選其他場地。`,
    });
  }
  const topic = String(subject ?? "").trim();
  if (!topic || topic.length > 100) {
    violations.push({ rule: "status", message: "請輸入主題。" });
  }
  return violations;
}

export function addTaipeiDays(dateString, days) {
  return addDays(dateString, days);
}

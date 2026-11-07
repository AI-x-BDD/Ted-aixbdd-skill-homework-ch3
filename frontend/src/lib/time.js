import { toTaipeiParts } from "../../../shared/src/taipei.js";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function pad(value) {
  return String(value).padStart(2, "0");
}

export function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${year}年${month}月${day}日（週${WEEKDAYS[weekday]}）`;
}

export function formatRange(startIso, endIso) {
  const start = toTaipeiParts(new Date(startIso));
  const end = toTaipeiParts(new Date(endIso));
  const endTime =
    end.time === "00:00" && end.date !== start.date ? "24:00" : end.time;
  return `${start.time}–${endTime}`;
}

export function startTimeOptions() {
  const options = [];
  for (let minutes = 0; minutes <= 23 * 60 + 30; minutes += 30) {
    options.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  return options;
}

export function endTimeOptions() {
  const options = [];
  for (let minutes = 30; minutes < 24 * 60; minutes += 30) {
    options.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`);
  }
  options.push("24:00");
  return options;
}

const OFFSET_MS = 8 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, "0");
}

export function toTaipeiParts(date) {
  const shifted = new Date(date.getTime() + OFFSET_MS);
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
    weekday: shifted.getUTCDay(),
  };
}

export function fromTaipei(date, time) {
  const [year, month, day] = date.split("-").map(Number);
  if (time === "24:00") {
    return new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0) - OFFSET_MS);
  }
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - OFFSET_MS);
}

export function taipeiDayStart(date) {
  const dateString = date instanceof Date ? toTaipeiParts(date).date : date;
  return fromTaipei(dateString, "00:00");
}

export function addTaipeiMonths(dateString, months) {
  const [year, month, day] = dateString.split("-").map(Number);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = total % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return `${targetYear}-${pad(targetMonth + 1)}-${pad(Math.min(day, lastDay))}`;
}

export function formatTaipei(date, options = {}) {
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    hourCycle: "h23",
    ...options,
  }).format(date);
}

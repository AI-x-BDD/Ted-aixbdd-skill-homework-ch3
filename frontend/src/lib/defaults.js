// 預約預設值的推導（research.md R-06）：依記住的時長與所選開始時間推導結束時間。
// 推導不到合法值就回傳 null，不截短；合法性最終仍由後端 validateBooking 在送出時判定。

function toMinutes(time) {
  if (time === "24:00") {
    return 1440;
  }
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function toTime(minutes) {
  if (minutes === 1440) {
    return "24:00";
  }
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
}

// 以 UTC 計算日期的星期，不受瀏覽器時區影響；0 為週日（與 openapi OpeningHour.weekday 相同）
export function weekdayOf(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// openingHours 為所選場地在所選日期星期的開放區間：[{ startTime, endTime }]
export function deriveEndTime({
  startTime,
  durationMinutes,
  maxDurationMinutes,
  openingHours,
}) {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 30) {
    return null;
  }
  if (maxDurationMinutes != null && durationMinutes > maxDurationMinutes) {
    return null;
  }
  const start = toMinutes(startTime);
  const end = start + durationMinutes;
  if (end > 1440) {
    return null;
  }
  const inside = openingHours.some(
    (range) =>
      toMinutes(range.startTime) <= start && end <= toMinutes(range.endTime),
  );
  return inside ? toTime(end) : null;
}

// 時長文字：「{N} 小時」「{N} 小時 {M} 分鐘」「{M} 分鐘」（ui-contract.md › UI-03 › 時長格式）
export function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours && rest) {
    return `${hours} 小時 ${rest} 分鐘`;
  }
  if (hours) {
    return `${hours} 小時`;
  }
  return `${rest} 分鐘`;
}

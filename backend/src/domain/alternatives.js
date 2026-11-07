import { fromTaipei } from "../../../shared/src/taipei.js";
import { validateBooking } from "./bookingRules.js";

const STEP_MINUTES = 30;
const DAY_MINUTES = 24 * 60;

function toMinute(time) {
  if (time === "24:00") {
    return DAY_MINUTES;
  }
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
}

function minuteToTime(minute) {
  if (minute >= DAY_MINUTES) {
    return "24:00";
  }
  const hour = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function toIsoRange(date, startTime, endTime) {
  return {
    startAt: fromTaipei(date, startTime).toISOString(),
    endAt: fromTaipei(date, endTime).toISOString(),
  };
}

/**
 * 同場地同一天的空檔建議（FR-002～FR-004、FR-005）。
 * 候選時段的長度與所選相同、以 30 分鐘為步進；每個候選都必須通過與一般
 * 單次預約相同的規則檢查，且涵蓋的每個 30 分鐘都沒有時段占用。
 * 較早取開始時間早於所選者中最晚的一個，較晚取開始時間晚於所選者中最早的一個，不跨日。
 *
 * @param {object} args
 * @param {object} args.venue 場地（含 openingHours、capacity）
 * @param {string} args.date 台北日期 YYYY-MM-DD
 * @param {string} args.startTime 所選開始 HH:mm
 * @param {string} args.endTime 所選結束 HH:mm（可為 24:00）
 * @param {number} args.attendees 人數
 * @param {object} args.rules 規則值快照（ruleRepository.loadAll 的結果）
 * @param {Date} args.current 現在時間
 * @param {Set<number>} args.occupiedStarts 當天占用的 30 分鐘起點（毫秒時間戳）
 * @param {{date: string, startTime: string, endTime: string} | null} [args.excludeWindow]
 *   修改預約時自己的原時段；若候選與它相同則不列為建議
 * @returns {{ slots: { before: object | null, after: object | null }, noSlotsToday: boolean }}
 */
export function findNearbySlots({
  venue,
  date,
  startTime,
  endTime,
  attendees,
  rules,
  current,
  occupiedStarts,
  excludeWindow = null,
}) {
  const startMinute = toMinute(startTime);
  const length = toMinute(endTime) - startMinute;
  const candidates = [];
  if (length >= STEP_MINUTES) {
    for (
      let candidateStart = 0;
      candidateStart + length <= DAY_MINUTES;
      candidateStart += STEP_MINUTES
    ) {
      const candidateEnd = candidateStart + length;
      const candidateStartTime = minuteToTime(candidateStart);
      const candidateEndTime = minuteToTime(candidateEnd);
      if (
        excludeWindow &&
        excludeWindow.date === date &&
        excludeWindow.startTime === candidateStartTime &&
        excludeWindow.endTime === candidateEndTime
      ) {
        continue;
      }
      const violations = validateBooking(
        {
          venue,
          date,
          startTime: candidateStartTime,
          endTime: candidateEndTime,
          attendees,
          subject: "建議",
        },
        rules,
        current,
      ).filter((item) => item.rule !== "status");
      if (violations.length) {
        continue;
      }
      let occupied = false;
      for (
        let minute = candidateStart;
        minute < candidateEnd && !occupied;
        minute += STEP_MINUTES
      ) {
        occupied = occupiedStarts.has(
          fromTaipei(date, minuteToTime(minute)).getTime(),
        );
      }
      if (!occupied) {
        candidates.push({
          start: candidateStart,
          startTime: candidateStartTime,
          endTime: candidateEndTime,
        });
      }
    }
  }
  const earlier = candidates.filter((item) => item.start < startMinute);
  const later = candidates.filter((item) => item.start > startMinute);
  const before = earlier.length ? earlier[earlier.length - 1] : null;
  const after = later.length ? later[0] : null;
  const toSuggestion = (item) =>
    item ? toIsoRange(date, item.startTime, item.endTime) : null;
  return {
    slots: {
      before: toSuggestion(before),
      after: toSuggestion(after),
    },
    noSlotsToday: !before && !after,
  };
}

/**
 * 同時段其他可用場地的排序與數量上限（FR-012、FR-018）。
 * 不需審核者在前、需審核者在後，各自依場地名稱（zh-Hant）排序，最多 limit 個。
 * 輸出只含場地公開欄位，不含位置與任何占用者資訊。
 *
 * @param {Array<{id: number, name: string, capacity: number, requires_approval: boolean | number}>} venues
 * @param {number} [limit]
 */
export function rankVenueSuggestions(venues, limit = 5) {
  return [...venues]
    .sort((a, b) => {
      const approvalOrder =
        Number(Boolean(a.requires_approval ?? a.requiresApproval)) -
        Number(Boolean(b.requires_approval ?? b.requiresApproval));
      if (approvalOrder !== 0) {
        return approvalOrder;
      }
      return String(a.name).localeCompare(String(b.name), "zh-Hant");
    })
    .slice(0, limit)
    .map((venue) => ({
      venueId: Number(venue.id),
      name: venue.name,
      capacity: Number(venue.capacity),
      requiresApproval: Boolean(
        venue.requires_approval ?? venue.requiresApproval,
      ),
    }));
}

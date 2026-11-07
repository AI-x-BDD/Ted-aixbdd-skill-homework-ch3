import { REBOOK_TEXT } from "../../../shared/src/copy.js";
import { toTaipeiParts } from "../../../shared/src/taipei.js";

/**
 * 判定「我的預約」某筆預約的「再預約一次」按鈕可否按。
 * 只使用頁面載入時已取得的資料，不以裝置時鐘判斷。
 * 判斷順序：預約權限暫停中 → 所屬場地已停用 → 皆不成立則可按。
 * 兩者同時成立時只回傳暫停原因。
 *
 * @param {{ venueActive?: boolean }} booking 我的預約清單中的一筆預約
 * @param {string | null | undefined} suspendedUntil 目前使用者的暫停解除時間（UTC ISO 字串）
 * @returns {{ enabled: boolean, reason: string | null }}
 */
export function rebookState(booking, suspendedUntil) {
  if (suspendedUntil) {
    const until = toTaipeiParts(new Date(suspendedUntil)).date;
    return { enabled: false, reason: REBOOK_TEXT.suspendedReason(until) };
  }
  if (booking.venueActive === false) {
    return { enabled: false, reason: REBOOK_TEXT.venueInactiveReason };
  }
  return { enabled: true, reason: null };
}

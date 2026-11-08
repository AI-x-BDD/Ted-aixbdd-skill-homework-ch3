// 出席統計（FR-012～FR-014）：伺服器端唯一的計算來源（research.md R-08）。
// 只計邀請狀態為 active 的邀請；pending 與 invalid 不計入。
const NO_SUMMARY_BOOKING_STATUSES = new Set([
  "pending",
  "cancelled",
  "rejected",
]);

export function summarizeInvitations(rows, bookingStatus) {
  if (NO_SUMMARY_BOOKING_STATUSES.has(bookingStatus) || !rows.length) {
    return null;
  }
  let invited = 0;
  let accepted = 0;
  let declined = 0;
  let noReply = 0;
  for (const row of rows) {
    if (row.status !== "active") {
      continue;
    }
    invited += 1;
    if (row.response === "accepted") {
      accepted += 1;
    } else if (row.response === "declined") {
      declined += 1;
    } else {
      noReply += 1;
    }
  }
  return { invited, accepted, declined, noReply, expected: 1 + accepted };
}

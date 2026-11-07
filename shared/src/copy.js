export const BOOKING_STATUS_LABELS = {
  pending: "待審核",
  confirmed: "已確認",
  checked_in: "已報到",
  completed: "已完成",
  rejected: "已駁回",
  cancelled: "已取消",
  no_show: "未到場",
};

export const ROLE_LABELS = {
  employee: "一般員工",
  reviewer: "場地審核者",
  admin: "系統管理員",
};

export const notificationTemplates = {
  booking_created: ({ venueName, date, startTime, endTime }) =>
    `你的預約已成立：${venueName}，${date} ${startTime}–${endTime}。`,
  review_result: ({ venueName, date, startTime, endTime, approved, reason }) =>
    approved
      ? `你的預約已核准：${venueName}，${date} ${startTime}–${endTime}。`
      : `你的預約申請被駁回：${venueName}，${date} ${startTime}–${endTime}。原因：${reason}`,
  waitlist_offer: ({ venueName, date, startTime, endTime, expiresAt }) =>
    `候補時段已為你保留：${venueName}，${date} ${startTime}–${endTime}。請在 ${expiresAt} 前確認。`,
  booking_cancelled: ({ venueName, date, startTime, endTime, reason }) =>
    `你的預約已被取消：${venueName}，${date} ${startTime}–${endTime}。原因：${reason}`,
  review_pending: ({ venueName, date, startTime, endTime, bookerName }) =>
    `有一筆待審核預約：${bookerName}，${venueName}，${date} ${startTime}–${endTime}。`,
  booking_changed: ({ venueName, date, startTime, endTime }) =>
    `預約已修改：${venueName}，${date} ${startTime}–${endTime}。`,
  suspension: ({ until }) =>
    `你的預約權限已暫停，將於 ${until} 解除。解除前仍可報到、取消與修改既有預約。`,
  waitlist_expired: ({ venueName, date, startTime, endTime, reason }) =>
    `候補已失效：${venueName}，${date} ${startTime}–${endTime}。原因：${reason}`,
  reminder: ({ venueName, startTime }) =>
    `提醒：${venueName}的預約將於 ${startTime} 開始。`,
};

export function notificationMessage(type, params = {}) {
  const template = notificationTemplates[type];
  if (!template) {
    return "";
  }
  return template(params);
}

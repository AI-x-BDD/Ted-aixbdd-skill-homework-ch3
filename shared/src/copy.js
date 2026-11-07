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

export const REBOOK_TEXT = {
  // UI-01 我的預約
  buttonLabel: "再預約一次",
  venueInactiveReason: "此場地已停用，無法再預約",
  suspendedReason: (until) => `預約權限暫停中，${until} 解除`,
  suspendedBanner: (until) =>
    `您的預約權限已暫停至 ${until}。暫停期間無法新增預約、登記候補與確認遞補。`,
  successConfirmed: "已為你預約，狀態：已確認",
  successPending: "已送出預約申請，狀態：待審核",
  listLoadError: "無法載入你的預約。請稍後按「重新載入」再試一次。",
  reload: "重新載入",
  // UI-02 再預約表單
  pageTitle: "再預約一次",
  prefillNotice: (venueName) =>
    `已帶入「${venueName}」、主題與人數。請選擇新的日期與起訖時間，主題與人數可以修改。`,
  venueFixedNote: "再預約的場地固定。要換場地請改為一般預約。",
  generalBookingLink: "改為一般預約",
  venueInfo: (capacity, auditNote) => `可容納 ${capacity} 人；${auditNote}`,
  auditNote: "送出後立即成立；需要審核，送出後為待審核並先占用時段",
  submitting: "送出中…",
  timePlaceholder: "請選擇",
  submitLabel: "送出預約",
  backLabel: "返回",
  timeZoneHint: "時間以台北時間（UTC+8）顯示",
  requiredDate: "請選擇日期。",
  requiredStart: "請選擇開始時間。",
  requiredEnd: "請選擇結束時間。",
  requiredSubject: "請輸入主題。",
  requiredAttendees: "請輸入人數，須為 1 以上的整數。",
  attendeesOverCapacity: (capacity) =>
    `人數超過容納人數（可容納 ${capacity} 人）。請減少人數後再送出。`,
  endBeforeStart: "結束時間須晚於開始時間。請重新選擇。",
  durationTooLong: (maxText) => `單次最長 ${maxText}。請縮短預約時間。`,
  errorListTitle: "無法送出，以下規則未通過：",
  waitlistLink: "登記候補",
  sourceNotFound:
    "找不到這筆預約，無法帶入內容。你可以改為一般預約，自行選擇場地與時間。",
  sourceLoadError: "無法載入這筆預約的內容。請稍後按「重新載入」再試一次。",
  // 規則拒絕訊息（依 Violation.rule 代碼）
  rules: {
    time_unit: "時間須以 30 分鐘為單位。請重新選擇。",
    end_not_after_start: "結束時間須晚於開始時間。請重新選擇。",
    duration: (maxText) => `單次最長 ${maxText}。請縮短預約時間。`,
    past: "不能預約已過去的時間。請選擇之後的時段。",
    advance: (latestDate) => `最遠可預約到 ${latestDate}。請選擇更早的日期。`,
    opening_hours: "預約須落在開放時段內。請參考行事曆選擇開放的時間。",
    capacity: (capacity) =>
      `人數超過容納人數（可容納 ${capacity} 人）。請減少人數後再送出。`,
    occupied: "該時段已被占用。請改選其他時段，或登記候補。",
    quota: (maxHeld) =>
      `已達持有上限（最多 ${maxHeld} 筆）。請先取消或等待既有預約結束後再預約。`,
    suspended: (until) =>
      `您的預約權限已暫停，將於 ${until} 解除。解除前仍可報到、取消與修改既有預約。`,
    venue_inactive: "此場地已停用，無法再預約。請改為一般預約，選擇其他場地。",
  },
};

export function notificationMessage(type, params = {}) {
  const template = notificationTemplates[type];
  if (!template) {
    return "";
  }
  return template(params);
}

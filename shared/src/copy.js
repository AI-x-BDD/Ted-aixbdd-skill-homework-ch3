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

// UI-01 同場地空檔建議（ui-contract.md › UI-01 › 文案與無障礙）
export const ALT_TEXT = {
  slotsTitle: "同場地最近的空檔",
  slotsDescription:
    "同一天、時間長度相同的空檔。點選後只會填入日期與時間，不會自動送出。",
  directionBefore: "較早",
  directionAfter: "較晚",
  slotButtonLabel: (direction, date, range) =>
    `改選${direction}的時段：${date} ${range}`,
  noSlotsToday: "當天已無空檔",
  appliedSlot: (date, range, submitLabel) =>
    `已改為 ${date} ${range}，尚未送出。請確認後按「${submitLabel}」。`,
  // UI-02 同時段其他可用場地（ui-contract.md › UI-02 › 文案與無障礙）
  venuesTitle: "同時段其他可用場地",
  venuesDescription:
    "同日期與時間仍可預約、容納人數也足夠的場地。點選後只會更換場地，不會自動送出。",
  venueButtonLabel: (name, capacity, approvalNote) =>
    `改選場地：${name}，可容納 ${capacity} 人${approvalNote}`,
  venueButtonText: (name, capacity) => `${name}　可容納 ${capacity} 人`,
  approvalTag: "需審核",
  approvalDescription: "標示「需審核」的場地，送出後為待審核並先占用時段。",
  noVenues: "此時段沒有其他可用場地",
  appliedVenue: (name, submitLabel) =>
    `已改為「${name}」，尚未送出。請確認後按「${submitLabel}」。`,
};

// 004 收藏場地（ui-contract.md › UI-01、UI-02 › 文案與無障礙）
export const FAVORITE_TEXT = {
  addButton: "加入收藏",
  removeButton: "取消收藏",
  pending: "處理中…",
  favoriteMark: "已收藏",
  disabledTag: "已停用",
  addedToast: "已加入收藏",
  removedToast: "已取消收藏",
  disabledRejected: "此場地已停用，無法收藏",
  addFailed: "無法加入收藏，收藏狀態沒有改變。請稍後再試一次。",
  removeFailed: "無法取消收藏，收藏狀態沒有改變。請稍後再試一次。",
  addLabel: (name) => `加入收藏：${name}`,
  removeLabel: (name) => `取消收藏：${name}`,
  venueLabel: "場地",
  venuePlaceholder: "請選擇場地",
  venueRequired: "請選擇場地。",
  groupFavorites: "我的收藏",
  groupOthers: "其他場地",
  optionText: (name, location) => `${name}（${location}）`,
  favoritesLoadFailed: "無法載入我的收藏，場地清單暫以一般順序顯示。",
};

// 004 預約表單預填（ui-contract.md › UI-03 › 文案與無障礙）
export const DEFAULTS_TEXT = {
  attendeesHint: "已帶入上次預約的人數，可自行修改。",
  endHint: (duration) => `已依上次的時長 ${duration} 帶出，可自行修改。`,
  notFitHint: (duration) =>
    `上次的時長（${duration}）套用後超出可預約範圍，請自行選擇結束時間。`,
  loadFailed: "無法載入上次的人數與時長，請自行填寫。",
  timePlaceholder: "請選擇",
};

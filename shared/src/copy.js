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
  // 005 參與者邀請（ui-contract.md › UI-04 › 文案與無障礙 › 通知內容）
  invitation_received: ({
    organizerName,
    venueName,
    date,
    startTime,
    endTime,
    subject,
  }) =>
    `${organizerName} 邀請你參加：${venueName}，${date} ${startTime}–${endTime}，主題：${subject}。請回覆是否出席。`,
  invitation_changed: ({
    changeKind,
    organizerName,
    venueName,
    date,
    startTime,
    endTime,
  }) =>
    changeKind === "time"
      ? `${organizerName} 的預約時間已變更：${venueName}，改為 ${date} ${startTime}–${endTime}。你先前的回覆已重置，請重新回覆是否出席。`
      : `${organizerName} 的預約場地已變更：改為 ${venueName}，${date} ${startTime}–${endTime}。你的回覆維持不變。`,
  invitation_cancelled: ({
    organizerName,
    venueName,
    date,
    startTime,
    endTime,
    reason,
  }) =>
    reason
      ? `${organizerName} 的預約已取消：${venueName}，${date} ${startTime}–${endTime}。原因：${reason}`
      : `${organizerName} 的預約已取消：${venueName}，${date} ${startTime}–${endTime}。`,
  invitation_removed: ({ venueName, date, startTime, endTime }) =>
    `你已被移出邀請：${venueName}，${date} ${startTime}–${endTime}。`,
  invitation_reminder: ({ organizerName, subject, startLabel, venueName }) =>
    `提醒：${organizerName} 的預約「${subject}」將於 ${startLabel} 在 ${venueName} 開始。`,
};

// 005 參與者邀請：預約表單邀請欄位（ui-contract.md › UI-01 › 文案與無障礙）
export const INVITEE_TEXT = {
  fieldLabel: "邀請同事（選填）",
  emailLabel: (index) => `同事 Email ${index}`,
  emailPlaceholder: "name@example.com",
  fieldHint:
    "選填。受邀同事需有啟用中的帳號；受邀人數不受預約人數與場地容納人數限制。",
  emptyHint: "沒有邀請任何人也可以送出。",
  addButton: "新增一位",
  removeButton: "移除",
  removeButtonLabel: (index) => `移除同事 Email ${index}`,
  countLabel: (count) => `將邀請 ${count} 位同事`,
  duplicateHint: "重複的 Email 只會邀請一次。",
  rebookNote: "再預約不會帶入上次的受邀者，需要的話請重新填寫。",
  recurringCleared: "週期性預約不支援邀請同事，已填的 Email 已清除。",
  formatError: "請輸入有效的 Email。",
  problemsTitle: "預約沒有成立。以下 Email 有問題，請修正或移除後再送出：",
  problemItem: (email, reason) => `${email}：${reason}`,
  reasonText: {
    not_found: "查無帳號",
    inactive: "帳號已停用",
    self: "不能邀請自己",
    already_invited: "已在受邀名單中",
  },
  submitting: "送出中…",
  submitFailed: "無法送出預約，預約與邀請都沒有建立。請稍後再試一次。",
  resultConfirmedInvitees: (count) => `已發送邀請給 ${count} 位同事。`,
  resultPendingInvitees: (count) => `核准後才會發送邀請給 ${count} 位同事。`,
  timeHint: "時間以台北時間（UTC+8）顯示",
  notificationTypeLabels: {
    invitation_received: "收到邀請",
    invitation_changed: "邀請變更",
    invitation_cancelled: "邀請取消",
    invitation_removed: "移出邀請",
    invitation_reminder: "受邀提醒",
  },
};

// 005 參與者邀請：我的邀請列表與詳情（ui-contract.md › UI-02 › 文案與無障礙）
export const INVITATION_TEXT = {
  navLabel: "我的邀請",
  pageTitle: "我的邀請",
  listIntro: "同事邀請你參加的會議，依開始時間由早到晚排列。",
  cardOrganizer: (name) => `${name} 邀請你`,
  cardTime: (date, start, end) => `${date} ${start}–${end}`,
  replyPrefix: "我的回覆：",
  replyLabels: { none: "未回覆", accepted: "已接受", declined: "已婉拒" },
  invalidTag: "邀請已失效",
  pendingTag: "預約審核中",
  startedTag: "預約已開始",
  openLink: "查看邀請",
  emptyTitle: "目前沒有邀請",
  emptyBody: "同事邀請你參加預約時，邀請會出現在這裡，也會收到站內通知。",
  detailTitle: "邀請詳情",
  detailOrganizer: (name) => `預約者：${name}`,
  detailVenue: (name, location) => `場地：${name}（${location}）`,
  detailTime: (date, start, end) => `時間：${date} ${start}–${end}`,
  detailSubject: (subject) => `主題：${subject}`,
  detailReply: (label) => `我的回覆：${label}`,
  invalidDetailNote: "邀請已失效，以下為你最後的回覆。",
  acceptButton: "出席",
  declineButton: "不出席",
  busy: "處理中…",
  backButton: "返回我的邀請",
  repliedAccepted: "已回覆出席",
  repliedDeclined: "已回覆不出席",
  cannotRespond: {
    booking_pending_review: "預約審核中，審核完成前無法回覆。",
    booking_cancelled: "預約已取消，無法回覆。",
    booking_rejected: "預約已取消，無法回覆。",
    booking_started: "預約已開始，無法再回覆。",
    invitation_invalid: "邀請已失效，無法回覆。",
  },
  respondFailed: "無法送出你的回覆，回覆狀態沒有改變。請稍後再試一次。",
  notFound: "找不到這份邀請。請回到「我的邀請」確認。",
  backToList: "回到我的邀請",
  loadFailed: "無法載入你的邀請。請稍後按「重新載入」再試一次。",
  retry: "重新載入",
  cardAria: (venue, date, start, end, organizer, reply) =>
    `${venue}，${date} ${start}–${end}，${organizer} 邀請你，我的回覆：${reply}`,
  timeHint: "時間以台北時間（UTC+8）顯示",
};

// 005 參與者邀請：預約詳情的受邀者面板（ui-contract.md › UI-03 › 文案與無障礙）
export const INVITEE_PANEL_TEXT = {
  toggle: "受邀者",
  panelTitle: "受邀者與出席狀況",
  statTotal: (count) => `受邀 ${count} 人`,
  statAccepted: (count) => `已接受 ${count} 人`,
  statDeclined: (count) => `已婉拒 ${count} 人`,
  statNoReply: (count) => `未回覆 ${count} 人`,
  statExpected: (count) => `預計到場 ${count} 人`,
  expectedNote: "預計到場人數 = 你本人 1 人 + 已接受人數",
  compareAttendees: (count) => `預約人數 ${count} 人`,
  compareCapacity: (count) => `場地容納 ${count} 人`,
  itemLabel: (name, email) => `${name}（${email}）`,
  replyLabels: { none: "未回覆", accepted: "已接受", declined: "已婉拒" },
  unsentTag: "待發送",
  invalidTag: "邀請已失效",
  emptyTitle: "未邀請任何人",
  emptyBody: "這筆預約沒有受邀者。",
  reviewNote: "預約審核中，核准後才會發送邀請。",
  refresh: "重新整理",
  refreshing: "更新中…",
  refreshed: "已更新出席狀況",
  loadFailed: "無法載入受邀者資料。請稍後按「重新載入」再試一次。",
  reload: "重新載入",
  refreshFailed: "無法更新出席狀況，目前顯示的是舊資料。請稍後再試一次。",
  forbidden: "沒有權限查看這筆預約的受邀者。",
  adjustBlocked: {
    booking_started: "預約已開始，無法調整受邀者。",
    booking_cancelled: "預約已取消，無法調整受邀者。",
    booking_rejected: "預約已駁回，無法調整受邀者。",
  },
  timeHint: "時間以台北時間（UTC+8）顯示",
  // 新增與移除受邀者（UI-03 › 操作、文案與無障礙）
  addSectionTitle: "新增受邀者",
  addInputLabel: "同事 Email（可一次貼上多個，以逗號、空白或換行分隔）",
  addButton: "新增",
  addPending: "新增中…",
  addedConfirmed: (count) => `已新增 ${count} 位受邀者，邀請已發送。`,
  addedPending: (count) => `已新增 ${count} 位受邀者，核准後才會發送邀請。`,
  addProblemsTitle: "沒有新增任何人。以下 Email 有問題，請修正或移除後再新增：",
  addProblemItem: (email, reason) => `${email}：${reason}`,
  addReasonText: {
    not_found: "查無帳號",
    inactive: "帳號已停用",
    self: "不能邀請自己",
    already_invited: "已在受邀名單中",
  },
  formatError: "請輸入有效的 Email。",
  removeButton: "移除",
  removeButtonLabel: (name) => `移除受邀者 ${name}`,
  removeDialogTitle: "要移除這位受邀者嗎？",
  removeDialogSent: (name) =>
    `移除後，${name} 會收到「已移出邀請」通知，之後無法再回覆。`,
  removeDialogPending: (name) =>
    `${name} 尚未收到邀請，移除後不會收到任何通知。`,
  removeConfirm: "確定移除",
  removeCancel: "先不要移除",
  removed: (name) => `已移除 ${name}`,
  adjustFailed: "無法完成這項操作，受邀者沒有變動。請稍後再試一次。",
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

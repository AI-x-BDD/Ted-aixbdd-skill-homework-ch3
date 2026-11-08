import { notify, bookingTimeParams } from "./notificationService.js";
import * as bookingRepository from "../repositories/bookingRepository.js";
import * as invitationRepository from "../repositories/invitationRepository.js";
import * as userRepository from "../repositories/userRepository.js";
import { now } from "../clock.js";
import { withTransaction } from "../db/pool.js";
import { HttpError } from "../lib/http.js";
import { toTaipeiParts } from "../../../shared/src/taipei.js";
import { summarizeInvitations } from "../domain/invitations.js";

const PROBLEM_MESSAGES = {
  not_found: "查無帳號",
  inactive: "帳號已停用",
  self: "不能邀請自己",
  already_invited: "已在受邀名單中",
};

function problem(email, reason) {
  return { email, reason, message: PROBLEM_MESSAGES[reason] };
}

// 受邀 Email 的驗證規則（FR-002）：去除前後空白並轉小寫、同一 Email 只算一位，
// 逐一判定查無帳號、帳號已停用、不能邀請自己、已在受邀名單中，一次收集全部問題。
export async function resolveInvitees(
  conn,
  { emails, bookerId, existingUserIds = [] },
) {
  const seen = new Set();
  const normalized = [];
  for (const raw of emails ?? []) {
    const email = userRepository.normalizeEmail(raw);
    if (!email || seen.has(email)) {
      continue;
    }
    seen.add(email);
    normalized.push(email);
  }

  const invitees = [];
  const problems = [];
  for (const email of normalized) {
    const user = await userRepository.findByEmail(conn, email);
    if (!user) {
      problems.push(problem(email, "not_found"));
    } else if (!user.is_active) {
      problems.push(problem(email, "inactive"));
    } else if (Number(user.id) === Number(bookerId)) {
      problems.push(problem(email, "self"));
    } else if (existingUserIds.map(Number).includes(Number(user.id))) {
      problems.push(problem(email, "already_invited"));
    } else {
      invitees.push({ userId: Number(user.id), email });
    }
  }
  return { invitees, problems };
}

// 為每位受邀者建立邀請（FR-003、FR-004）：預約已確認時建立 active 並通知，
// 待審核時建立 pending 且不通知，核准後才由 onBookingConfirmed 發送。
export async function createInvitations(
  conn,
  { booking, venue, organizer, invitees, now: current },
) {
  const confirmed = booking.status === "confirmed";
  const created = [];
  for (const invitee of invitees) {
    const invitationId = await invitationRepository.insert(conn, {
      booking_id: booking.id,
      invitee_user_id: invitee.userId,
      status: confirmed ? "active" : "pending",
      notified_at: confirmed ? current : null,
      created_at: current,
      updated_at: current,
    });
    if (confirmed) {
      await notify(conn, {
        userId: invitee.userId,
        type: "invitation_received",
        bookingId: booking.id,
        invitationId,
        params: {
          ...bookingTimeParams({ ...booking, venue_name: venue.name }),
          organizerName: organizer.name,
          subject: booking.subject,
        },
        now: current,
      });
    }
    created.push({ invitationId, userId: invitee.userId });
  }
  return created;
}

// 預約核准為 confirmed 時（approveBooking，經 transition 掛接）：
// 待發送的邀請改為有效並通知（FR-004）。延後套用的異動標記由 T034 補上。
export async function onBookingConfirmed(conn, { bookingId, now: current }) {
  const invitations = await invitationRepository.lockByBooking(conn, bookingId);
  const pending = invitations.filter((row) => row.status === "pending");
  // 因修改進入審核期間累積的延後套用標記（FR-019）：核准後才重置或保留並通知
  const deferred = invitations.filter(
    (row) => row.status === "active" && row.pending_change,
  );
  if (!pending.length && !deferred.length) {
    return 0;
  }
  const booking = await bookingRepository.lockById(conn, bookingId);
  const organizer = await userRepository.findById(conn, booking.user_id);
  for (const row of pending) {
    await invitationRepository.activate(conn, {
      id: row.id,
      notifiedAt: current,
      now: current,
    });
    await notify(conn, {
      userId: row.invitee_user_id,
      type: "invitation_received",
      bookingId,
      invitationId: row.id,
      params: {
        ...bookingTimeParams(booking),
        organizerName: organizer.name,
        subject: booking.subject,
      },
      now: current,
    });
  }
  for (const row of deferred) {
    await applyChangeNotice(conn, {
      row,
      changeKind: row.pending_change,
      booking,
      organizer,
      now: current,
    });
    await invitationRepository.clearPendingChange(conn, {
      id: row.id,
      now: current,
    });
  }
  return pending.length + deferred.length;
}

// 延後套用的異動標記取較強者：time 強於 venue（FR-019）
function strongerChange(existing, incoming) {
  return existing === "time" || incoming === "time" ? "time" : "venue";
}

// 異動通知（FR-017、FR-018）：時間變更重置回覆並清除提醒時間；只換場地保留回覆；
// 兩者都寫入「邀請變更」通知，並把通知時間設為現在（data-model 交易邊界）
async function applyChangeNotice(
  conn,
  { row, changeKind, booking, organizer, now: current },
) {
  if (changeKind === "time") {
    await invitationRepository.resetResponse(conn, {
      id: row.id,
      notifiedAt: current,
      now: current,
    });
  } else {
    await conn.query(
      `UPDATE booking_invitations
       SET notified_at = :now, updated_at = :now
       WHERE id = :id AND status = 'active'`,
      { id: row.id, now: current },
    );
  }
  await notify(conn, {
    userId: row.invitee_user_id,
    type: "invitation_changed",
    bookingId: booking.id,
    invitationId: row.id,
    params: {
      ...bookingTimeParams(booking),
      changeKind,
      organizerName: organizer.name,
    },
    now: current,
  });
}

// 修改預約（updateBooking，T036 掛接）：changeKind 由呼叫端依資料庫實際前後值判斷。
// 預約為 confirmed 時立即套用；為 pending（需重新審核）時只記下延後套用的標記（FR-019）。
export async function onBookingChanged(
  conn,
  { bookingId, changeKind, now: current },
) {
  if (changeKind !== "time" && changeKind !== "venue") {
    return 0;
  }
  const invitations = await invitationRepository.lockByBooking(conn, bookingId);
  const active = invitations.filter((row) => row.status === "active");
  if (!active.length) {
    return 0;
  }
  const booking = await bookingRepository.lockById(conn, bookingId);
  if (booking.status === "pending") {
    for (const row of active) {
      await invitationRepository.setPendingChange(conn, {
        id: row.id,
        change: strongerChange(row.pending_change, changeKind),
        now: current,
      });
    }
    return active.length;
  }
  if (booking.status !== "confirmed") {
    return 0;
  }
  const organizer = await userRepository.findById(conn, booking.user_id);
  for (const row of active) {
    await applyChangeNotice(conn, {
      row,
      changeKind,
      booking,
      organizer,
      now: current,
    });
  }
  return active.length;
}

// 預約取消或駁回（經 transition 掛接，FR-020）：待發送的邀請直接失效且不通知；
// 有效的邀請失效並通知受邀者（附原因，有則附）；回覆保留為最後的回覆。
export async function onBookingEnded(
  conn,
  { bookingId, reason, now: current },
) {
  const invitations = await invitationRepository.lockByBooking(conn, bookingId);
  const open = invitations.filter(
    (row) => row.status === "pending" || row.status === "active",
  );
  if (!open.length) {
    return 0;
  }
  const booking = await bookingRepository.lockById(conn, bookingId);
  const organizer = await userRepository.findById(conn, booking.user_id);
  for (const row of open) {
    const wasActive = row.status === "active";
    await invitationRepository.markInvalid(conn, {
      id: row.id,
      reason: "booking_cancelled",
      now: current,
    });
    if (wasActive) {
      await notify(conn, {
        userId: row.invitee_user_id,
        type: "invitation_cancelled",
        bookingId,
        invitationId: row.id,
        params: {
          ...bookingTimeParams(booking),
          organizerName: organizer.name,
          reason: reason ?? null,
        },
        now: current,
      });
    }
  }
  return open.length;
}

// 停用帳號時使其作為受邀者的邀請失效（FR-021、FR-022）：不通知，保留最後的回覆；
// 重新啟用帳號不恢復（userService.enableUser 不呼叫此函式）。
export async function onUserDeactivated(conn, { userId, now: current }) {
  return invitationRepository.markInvalidByInvitee(conn, {
    userId,
    reason: "account_disabled",
    now: current,
  });
}

const STARTED_STATUSES = new Set(["checked_in", "completed", "no_show"]);

const RESPOND_REASON_MESSAGES = {
  booking_cancelled: "預約已取消，回覆沒有成立。",
  booking_rejected: "預約已取消，回覆沒有成立。",
  invitation_invalid: "邀請已失效，回覆沒有成立。",
  booking_pending_review: "預約審核中，回覆沒有成立。審核完成後即可回覆。",
  booking_started: "預約已開始，回覆沒有成立。",
};

// 不可回覆原因的判定順序（openapi getInvitation）：與列表、詳情、回覆共用
function cannotRespondReason({
  bookingStatus,
  invitationStatus,
  bookingStarted,
}) {
  if (bookingStatus === "cancelled") return "booking_cancelled";
  if (bookingStatus === "rejected") return "booking_rejected";
  if (invitationStatus === "invalid") return "invitation_invalid";
  if (bookingStatus === "pending") return "booking_pending_review";
  if (bookingStarted || bookingStatus !== "confirmed") return "booking_started";
  return null;
}

function toInvitation(row, current) {
  const start = new Date(row.start_at);
  const end = new Date(row.end_at);
  const startParts = toTaipeiParts(start);
  const endParts = toTaipeiParts(end);
  const endTime =
    endParts.time === "00:00" && endParts.date !== startParts.date
      ? "24:00"
      : endParts.time;
  const bookingStarted =
    STARTED_STATUSES.has(row.booking_status) || current >= start;
  const reason = cannotRespondReason({
    bookingStatus: row.booking_status,
    invitationStatus: row.status,
    bookingStarted,
  });
  return {
    id: Number(row.id),
    organizerName: row.organizer_name,
    venueName: row.venue_name,
    venueLocation: row.venue_location,
    date: startParts.date,
    startTime: startParts.time,
    endTime,
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    subject: row.subject,
    bookingStatus: row.booking_status,
    bookingStarted,
    status: row.status,
    response: row.response,
    canRespond: reason === null,
    cannotRespondReason: reason,
  };
}

// 讀取發給本人的邀請（NFR-006）：非本人、不存在或仍是待發送，一律回同一種 404
async function loadOwnInvitation(conn, invitationId, userId) {
  const row = await invitationRepository.findDetail(conn, invitationId);
  if (
    !row ||
    Number(row.invitee_user_id) !== Number(userId) ||
    row.status === "pending"
  ) {
    throw new HttpError(404, "找不到這份邀請。請回到「我的邀請」確認。");
  }
  return row;
}

export async function listMyInvitations(user) {
  return withTransaction(async (conn) => {
    const current = now();
    const rows = await invitationRepository.listByInvitee(conn, user.id);
    const items = rows.map((row) => toInvitation(row, current));
    return { items, total: items.length };
  });
}

export async function getInvitation(user, invitationId) {
  return withTransaction(async (conn) => {
    const row = await loadOwnInvitation(conn, invitationId, user.id);
    return toInvitation(row, now());
  });
}

// 回覆（FR-009、FR-010）：先鎖預約列、再鎖邀請列（與取消路徑相同順序），
// 鎖定後重新判定，不可回覆時回 409 並附原因代碼，回覆狀態維持不變
export async function respondInvitation(user, invitationId, input) {
  const response = input?.response;
  if (response !== "accepted" && response !== "declined") {
    throw new HttpError(400, "請選擇出席或不出席。", {
      fields: [{ field: "response", message: "請選擇出席或不出席。" }],
    });
  }
  return withTransaction(async (conn) => {
    const current = now();
    const probe = await loadOwnInvitation(conn, invitationId, user.id);
    const booking = await bookingRepository.lockById(conn, probe.booking_id);
    const invitation = await invitationRepository.lockById(conn, invitationId);
    if (
      !booking ||
      !invitation ||
      Number(invitation.invitee_user_id) !== Number(user.id) ||
      invitation.status === "pending"
    ) {
      throw new HttpError(404, "找不到這份邀請。請回到「我的邀請」確認。");
    }
    const bookingStarted =
      STARTED_STATUSES.has(booking.status) ||
      current >= new Date(booking.start_at);
    const reason = cannotRespondReason({
      bookingStatus: booking.status,
      invitationStatus: invitation.status,
      bookingStarted,
    });
    if (reason) {
      throw new HttpError(409, RESPOND_REASON_MESSAGES[reason], { reason });
    }
    await invitationRepository.updateResponse(conn, {
      id: invitationId,
      response,
      respondedAt: current,
      now: current,
    });
    const updated = await invitationRepository.findDetail(conn, invitationId);
    return toInvitation(updated, current);
  });
}

// 預約者視角的受邀名單與出席統計（FR-012～FR-016）：只有預約者本人能取得；
// attendees 與 venueCapacity 只並列提供，伺服器不比較、不提示、不推薦場地。
export async function listBookingInvitees(user, bookingId) {
  return withTransaction(async (conn) => {
    const booking = await bookingRepository.findById(conn, bookingId);
    if (!booking) {
      throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
    }
    if (Number(booking.user_id) !== Number(user.id)) {
      throw new HttpError(
        403,
        "沒有權限查看這筆預約的受邀者。請回到「我的預約」確認。",
      );
    }
    if (booking.series_id) {
      throw new HttpError(409, "週期性預約不支援邀請同事。", {
        reason: "booking_recurring",
      });
    }
    return bookingInviteesView(conn, booking, now());
  });
}

// 名單與統計的組成：listBookingInvitees、新增與移除後回傳共用同一份（research.md R-08）
async function bookingInviteesView(conn, booking, current) {
  const bookingStarted =
    STARTED_STATUSES.has(booking.status) ||
    current >= new Date(booking.start_at);
  const canAdjust =
    ["pending", "confirmed"].includes(booking.status) && !bookingStarted;
  let adjustBlockedReason = null;
  if (!canAdjust) {
    adjustBlockedReason =
      booking.status === "cancelled"
        ? "booking_cancelled"
        : booking.status === "rejected"
          ? "booking_rejected"
          : "booking_started";
  }
  const rows = await invitationRepository.listByBooking(conn, booking.id);
  // 被預約者移除的邀請不列入名單與統計（FR-014）
  const items = rows
    .filter(
      (row) => !(row.status === "invalid" && row.invalid_reason === "removed"),
    )
    .map((row) => ({
      invitationId: Number(row.id),
      name: row.invitee_name,
      email: row.invitee_email,
      status: row.status,
      response: row.response,
      canRemove:
        canAdjust && (row.status === "pending" || row.status === "active"),
    }));
  return {
    bookingId: Number(booking.id),
    bookingStatus: booking.status,
    bookingStarted,
    attendees: Number(booking.attendees),
    venueCapacity: Number(booking.venue_capacity),
    items,
    summary: summarizeInvitations(items, booking.status),
    canAdjust,
    adjustBlockedReason,
  };
}

// 新增與移除受邀者的共同前置檢查（FR-023）：預約者本人、非週期性、
// 狀態 pending 或 confirmed 且尚未開始；鎖定預約列後判定。
async function lockAdjustableBooking(conn, bookingId, user, current) {
  const booking = await bookingRepository.lockById(conn, bookingId);
  if (!booking) {
    throw new HttpError(404, "找不到這筆預約。請重新整理後再試一次。");
  }
  if (Number(booking.user_id) !== Number(user.id)) {
    throw new HttpError(
      403,
      "沒有權限查看這筆預約的受邀者。請回到「我的預約」確認。",
    );
  }
  if (booking.series_id) {
    throw new HttpError(409, "週期性預約不支援邀請同事。", {
      reason: "booking_recurring",
    });
  }
  if (booking.status === "cancelled") {
    throw new HttpError(409, "預約已取消，受邀者沒有變動。", {
      reason: "booking_cancelled",
    });
  }
  if (booking.status === "rejected") {
    throw new HttpError(409, "預約已駁回，受邀者沒有變動。", {
      reason: "booking_rejected",
    });
  }
  if (
    STARTED_STATUSES.has(booking.status) ||
    current >= new Date(booking.start_at) ||
    !["pending", "confirmed"].includes(booking.status)
  ) {
    throw new HttpError(409, "預約已開始，受邀者沒有變動。", {
      reason: "booking_started",
    });
  }
  return booking;
}

// 新增受邀者（FR-024、NFR-004）：全有或全無；任何 Email 有問題則整個不新增
export async function addBookingInvitees(user, bookingId, input) {
  return withTransaction(async (conn) => {
    const current = now();
    const booking = await lockAdjustableBooking(conn, bookingId, user, current);
    const emails = Array.isArray(input?.emails) ? input.emails : [];
    if (!emails.some((email) => String(email ?? "").trim())) {
      throw new HttpError(400, "沒有新增任何人。請輸入至少一位同事的 Email。", {
        fields: [{ field: "emails", message: "請輸入同事 Email。" }],
      });
    }
    const existing = await invitationRepository.listByBooking(conn, booking.id);
    const liveUserIds = existing
      .filter((row) => row.status === "pending" || row.status === "active")
      .map((row) => Number(row.invitee_user_id));
    const { invitees, problems } = await resolveInvitees(conn, {
      emails,
      bookerId: user.id,
      existingUserIds: liveUserIds,
    });
    if (problems.length) {
      const list = problems
        .map((item) => `${item.email}：${item.message}`)
        .join("；");
      throw new HttpError(400, `沒有新增任何人。${list}。`, {
        fields: [{ field: "emails", message: "有 Email 未通過驗證。" }],
        inviteeProblems: problems,
      });
    }
    const organizer = await userRepository.findById(conn, user.id);
    try {
      await createInvitations(conn, {
        booking,
        venue: { name: booking.venue_name },
        organizer,
        invitees,
        now: current,
      });
    } catch (error) {
      // 並行重複新增：唯一鍵擋下（uk_invitations_live），最終只有一份邀請與一則通知
      if (error.code === "ER_DUP_ENTRY") {
        throw new HttpError(
          400,
          "沒有新增任何人。有同事已在受邀名單中，請重新整理後再試一次。",
          {
            fields: [{ field: "emails", message: "有 Email 未通過驗證。" }],
          },
        );
      }
      throw error;
    }
    const fresh = await bookingRepository.findById(conn, booking.id);
    return {
      addedCount: invitees.length,
      invitees: await bookingInviteesView(conn, fresh, current),
    };
  });
}

// 移除受邀者（FR-025、NFR-004）：有效者失效並通知；待發送者失效不通知；已失效者視為成功
export async function removeBookingInvitee(user, bookingId, invitationId) {
  return withTransaction(async (conn) => {
    const current = now();
    const booking = await lockAdjustableBooking(conn, bookingId, user, current);
    const invitation = await invitationRepository.lockById(conn, invitationId);
    if (!invitation || Number(invitation.booking_id) !== Number(booking.id)) {
      throw new HttpError(404, "找不到這位受邀者。請重新整理後再試一次。");
    }
    if (invitation.status === "active" || invitation.status === "pending") {
      await invitationRepository.markInvalid(conn, {
        id: invitation.id,
        reason: "removed",
        now: current,
      });
      if (invitation.status === "active") {
        await notify(conn, {
          userId: invitation.invitee_user_id,
          type: "invitation_removed",
          bookingId: booking.id,
          invitationId: invitation.id,
          params: bookingTimeParams(booking),
          now: current,
        });
      }
    }
    const fresh = await bookingRepository.findById(conn, booking.id);
    return bookingInviteesView(conn, fresh, current);
  });
}

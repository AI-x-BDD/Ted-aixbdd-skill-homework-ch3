import { toTaipeiParts } from "../../../shared/src/taipei.js";
import { now } from "../clock.js";
import { processDue, registerJob } from "./scanner.js";
import { notify } from "../services/notificationService.js";
import * as invitationRepository from "../repositories/invitationRepository.js";

// 受邀者開始前提醒（API-05、FR-011）：只提醒 active、回覆為 none 或 accepted 的邀請，
// 預約須為 confirmed 且尚未開始；邀請發送時距開始已不足提醒時間者不補發。
// 只鎖邀請列（SKIP LOCKED），不鎖預約列，避免與「先鎖預約、再鎖邀請」的路徑鎖定順序相反。
export async function sendInviteeReminders(current = now()) {
  await processDue(null, {
    select: async (conn) => {
      const [rows] = await conn.query(
        `SELECT i.id AS invitation_id, i.booking_id, i.invitee_user_id,
                b.start_at, b.subject, o.name AS organizer_name,
                v.name AS venue_name
         FROM booking_invitations i
         JOIN bookings b ON b.id = i.booking_id
         JOIN venues v ON v.id = b.venue_id
         JOIN users o ON o.id = b.user_id
         JOIN rules r ON r.rule_key = 'reminder_minutes'
         WHERE i.status = 'active'
           AND i.response IN ('none', 'accepted')
           AND i.reminder_sent_at IS NULL
           AND b.status = 'confirmed'
           AND b.start_at > :now
           AND DATE_SUB(b.start_at, INTERVAL r.int_value MINUTE) <= :now
           AND i.notified_at <= DATE_SUB(b.start_at, INTERVAL r.int_value MINUTE)
         ORDER BY b.start_at, i.id
         LIMIT 100
         FOR UPDATE OF i SKIP LOCKED`,
        { now: current },
      );
      return [rows];
    },
    handle: async (conn, row) => {
      const start = toTaipeiParts(new Date(row.start_at));
      await notify(conn, {
        userId: row.invitee_user_id,
        type: "invitation_reminder",
        bookingId: row.booking_id,
        invitationId: row.invitation_id,
        params: {
          organizerName: row.organizer_name,
          subject: row.subject,
          venueName: row.venue_name,
          startLabel: `${start.date} ${start.time}`,
        },
        now: current,
      });
      await invitationRepository.markReminderSent(conn, {
        id: row.invitation_id,
        now: current,
      });
    },
  });
}

registerJob("sendInviteeReminders", sendInviteeReminders);

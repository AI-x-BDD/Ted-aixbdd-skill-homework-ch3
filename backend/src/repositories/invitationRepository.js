export async function insert(conn, invitation) {
  const [result] = await conn.query(
    `INSERT INTO booking_invitations
       (booking_id, invitee_user_id, status, response, notified_at, created_at, updated_at)
     VALUES (:bookingId, :inviteeUserId, :status, 'none', :notifiedAt, :createdAt, :updatedAt)`,
    {
      bookingId: invitation.booking_id,
      inviteeUserId: invitation.invitee_user_id,
      status: invitation.status,
      notifiedAt: invitation.notified_at ?? null,
      createdAt: invitation.created_at,
      updatedAt: invitation.updated_at,
    },
  );
  return result.insertId;
}

export async function lockById(conn, id) {
  const [rows] = await conn.query(
    "SELECT * FROM booking_invitations WHERE id = :id FOR UPDATE",
    { id },
  );
  return rows[0] ?? null;
}

export async function lockByBooking(conn, bookingId) {
  const [rows] = await conn.query(
    `SELECT * FROM booking_invitations
     WHERE booking_id = :bookingId
     ORDER BY id
     FOR UPDATE`,
    { bookingId },
  );
  return rows;
}

export async function listByInvitee(conn, userId) {
  const [rows] = await conn.query(
    `SELECT bi.id, bi.booking_id, bi.status, bi.response, bi.invalid_reason, bi.responded_at,
            b.start_at, b.end_at, b.subject, b.status AS booking_status,
            v.name AS venue_name, v.location AS venue_location,
            o.name AS organizer_name
     FROM booking_invitations bi
     JOIN bookings b ON b.id = bi.booking_id
     JOIN venues v ON v.id = b.venue_id
     JOIN users o ON o.id = b.user_id
     WHERE bi.invitee_user_id = :userId
       AND bi.status IN ('active', 'invalid')
     ORDER BY b.start_at, bi.id`,
    { userId },
  );
  return rows;
}

export async function findDetail(conn, invitationId) {
  const [rows] = await conn.query(
    `SELECT bi.id, bi.booking_id, bi.invitee_user_id, bi.status, bi.response,
            bi.invalid_reason, bi.responded_at,
            b.start_at, b.end_at, b.subject, b.status AS booking_status,
            v.name AS venue_name, v.location AS venue_location,
            o.name AS organizer_name
     FROM booking_invitations bi
     JOIN bookings b ON b.id = bi.booking_id
     JOIN venues v ON v.id = b.venue_id
     JOIN users o ON o.id = b.user_id
     WHERE bi.id = :invitationId`,
    { invitationId },
  );
  return rows[0] ?? null;
}

export async function listByBooking(conn, bookingId) {
  const [rows] = await conn.query(
    `SELECT bi.id, bi.invitee_user_id, bi.status, bi.response, bi.invalid_reason,
            u.name AS invitee_name, u.email AS invitee_email
     FROM booking_invitations bi
     JOIN users u ON u.id = bi.invitee_user_id
     WHERE bi.booking_id = :bookingId
     ORDER BY bi.id`,
    { bookingId },
  );
  return rows;
}

export async function findLiveByBookingAndUsers(conn, bookingId, userIds) {
  if (!userIds.length) {
    return [];
  }
  const [rows] = await conn.query(
    `SELECT id, invitee_user_id, status
     FROM booking_invitations
     WHERE booking_id = :bookingId
       AND status IN ('pending', 'active')
       AND invitee_user_id IN (:userIds)`,
    { bookingId, userIds },
  );
  return rows;
}

export async function updateResponse(conn, { id, response, respondedAt, now }) {
  const [result] = await conn.query(
    `UPDATE booking_invitations
     SET response = :response, responded_at = :respondedAt, updated_at = :now
     WHERE id = :id AND status = 'active'`,
    { id, response, respondedAt, now },
  );
  return result.affectedRows;
}

export async function markInvalid(conn, { id, reason, now }) {
  const [result] = await conn.query(
    `UPDATE booking_invitations
     SET status = 'invalid', invalid_reason = :reason, updated_at = :now
     WHERE id = :id AND status IN ('pending', 'active')`,
    { id, reason, now },
  );
  return result.affectedRows;
}

export async function markInvalidByInvitee(conn, { userId, reason, now }) {
  const [rows] = await conn.query(
    `SELECT id FROM booking_invitations
     WHERE invitee_user_id = :userId
       AND status IN ('pending', 'active')
     ORDER BY id
     FOR UPDATE`,
    { userId },
  );
  for (const row of rows) {
    await markInvalid(conn, { id: row.id, reason, now });
  }
  return rows.length;
}

export async function activate(conn, { id, notifiedAt, now }) {
  const [result] = await conn.query(
    `UPDATE booking_invitations
     SET status = 'active', response = 'none', responded_at = NULL,
         notified_at = :notifiedAt, updated_at = :now
     WHERE id = :id AND status = 'pending'`,
    { id, notifiedAt, now },
  );
  return result.affectedRows;
}

export async function resetResponse(conn, { id, notifiedAt, now }) {
  const [result] = await conn.query(
    `UPDATE booking_invitations
     SET response = 'none', responded_at = NULL, reminder_sent_at = NULL,
         notified_at = :notifiedAt, updated_at = :now
     WHERE id = :id AND status = 'active'`,
    { id, notifiedAt, now },
  );
  return result.affectedRows;
}

export async function setPendingChange(conn, { id, change, now }) {
  const [result] = await conn.query(
    `UPDATE booking_invitations
     SET pending_change = :change, updated_at = :now
     WHERE id = :id AND status = 'active'`,
    { id, change, now },
  );
  return result.affectedRows;
}

export async function clearPendingChange(conn, { id, now }) {
  const [result] = await conn.query(
    `UPDATE booking_invitations
     SET pending_change = NULL, updated_at = :now
     WHERE id = :id`,
    { id, now },
  );
  return result.affectedRows;
}

export async function markReminderSent(conn, { id, now }) {
  const [result] = await conn.query(
    `UPDATE booking_invitations
     SET reminder_sent_at = :now, updated_at = :now
     WHERE id = :id`,
    { id, now },
  );
  return result.affectedRows;
}

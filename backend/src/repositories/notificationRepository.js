export async function insert(conn, notification) {
  const [result] = await conn.query(
    `INSERT INTO notifications (user_id, type, message, booking_id, waitlist_entry_id, invitation_id, created_at)
     VALUES (:userId, :type, :message, :bookingId, :waitlistEntryId, :invitationId, :createdAt)`,
    {
      userId: notification.user_id,
      type: notification.type,
      message: notification.message,
      bookingId: notification.booking_id ?? null,
      waitlistEntryId: notification.waitlist_entry_id ?? null,
      invitationId: notification.invitation_id ?? null,
      createdAt: notification.created_at,
    },
  );
  return result.insertId;
}

export async function listByUser(conn, { userId, limit = 20, beforeId }) {
  const take = Number(limit) || 20;
  if (beforeId) {
    const [anchor] = await conn.query(
      "SELECT created_at FROM notifications WHERE id = :id AND user_id = :userId",
      {
        id: beforeId,
        userId,
      },
    );
    const createdAt = anchor[0]?.created_at;
    const [rows] = await conn.query(
      `SELECT * FROM notifications
       WHERE user_id = :userId AND (created_at < :createdAt OR (created_at = :createdAt AND id < :beforeId))
       ORDER BY created_at DESC, id DESC
       LIMIT :take`,
      { userId, createdAt, beforeId, take },
    );
    return rows;
  }
  const [rows] = await conn.query(
    `SELECT * FROM notifications
     WHERE user_id = :userId
     ORDER BY created_at DESC, id DESC
     LIMIT :take`,
    { userId, take },
  );
  return rows;
}

export async function unreadCount(conn, userId) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = :userId AND read_at IS NULL",
    { userId },
  );
  return Number(rows[0]?.total ?? 0);
}

export async function markRead(conn, { userId, id, now: current }) {
  const [result] = await conn.query(
    `UPDATE notifications SET read_at = :now
     WHERE id = :id AND user_id = :userId AND read_at IS NULL`,
    { id, userId, now: current },
  );
  return result.affectedRows;
}

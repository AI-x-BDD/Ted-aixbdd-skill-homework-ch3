export async function insert(
  conn,
  {
    bookingId,
    actorUserId,
    actorType,
    occurredAt,
    fromStatus,
    toStatus,
    reason,
  },
) {
  const [result] = await conn.query(
    `INSERT INTO booking_events (
       booking_id, actor_user_id, actor_type, occurred_at, from_status, to_status, reason
     ) VALUES (
       :bookingId, :actorUserId, :actorType, :occurredAt, :fromStatus, :toStatus, :reason
     )`,
    {
      bookingId,
      actorUserId: actorUserId ?? null,
      actorType,
      occurredAt,
      fromStatus: fromStatus ?? null,
      toStatus,
      reason: reason ?? null,
    },
  );
  return result.insertId;
}

export async function listByBooking(conn, bookingId) {
  const [rows] = await conn.query(
    `SELECT e.*, u.name AS actor_name
     FROM booking_events e
     LEFT JOIN users u ON u.id = e.actor_user_id
     WHERE e.booking_id = :bookingId
     ORDER BY e.occurred_at ASC, e.id ASC`,
    { bookingId },
  );
  return rows;
}

export async function countNoShows(conn, userId, since) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total
     FROM booking_events e
     JOIN bookings b ON b.id = e.booking_id
     WHERE b.user_id = :userId AND e.to_status = 'no_show' AND e.occurred_at > :since`,
    { userId, since },
  );
  return Number(rows[0]?.total ?? 0);
}

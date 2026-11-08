export async function upsert(
  conn,
  { userId, attendees, durationMinutes, updatedAt },
) {
  await conn.query(
    `INSERT INTO booking_defaults (user_id, attendees, duration_minutes, updated_at)
     VALUES (:userId, :attendees, :durationMinutes, :updatedAt)
     ON DUPLICATE KEY UPDATE
       attendees = VALUES(attendees),
       duration_minutes = VALUES(duration_minutes),
       updated_at = VALUES(updated_at)`,
    { userId, attendees, durationMinutes, updatedAt },
  );
}

export async function findByUser(conn, userId) {
  const [rows] = await conn.query(
    "SELECT attendees, duration_minutes FROM booking_defaults WHERE user_id = :userId",
    { userId },
  );
  const row = rows[0];
  if (!row) {
    return null;
  }
  return {
    attendees: Number(row.attendees),
    durationMinutes: Number(row.duration_minutes),
  };
}

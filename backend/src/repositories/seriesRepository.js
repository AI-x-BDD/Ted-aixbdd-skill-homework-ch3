export async function insert(conn, series) {
  const [result] = await conn.query(
    `INSERT INTO booking_series (
       user_id, venue_id, frequency, first_date, last_date, start_time, end_time,
       subject, attendees, status, session_count
     ) VALUES (
       :userId, :venueId, :frequency, :firstDate, :lastDate, :startTime, :endTime,
       :subject, :attendees, :status, :sessionCount
     )`,
    {
      userId: series.user_id,
      venueId: series.venue_id,
      frequency: series.frequency,
      firstDate: series.first_date,
      lastDate: series.last_date,
      startTime: series.start_time,
      endTime: series.end_time === "24:00" ? "24:00:00" : series.end_time,
      subject: series.subject,
      attendees: series.attendees,
      status: series.status,
      sessionCount: series.session_count,
    },
  );
  return result.insertId;
}

export async function findById(conn, id) {
  const [rows] = await conn.query(
    "SELECT * FROM booking_series WHERE id = :id",
    { id },
  );
  return rows[0] ?? null;
}

export async function lockById(conn, id) {
  const [rows] = await conn.query(
    "SELECT * FROM booking_series WHERE id = :id FOR UPDATE",
    { id },
  );
  return rows[0] ?? null;
}

export async function setStatus(conn, id, status) {
  await conn.query(
    "UPDATE booking_series SET status = :status WHERE id = :id",
    { id, status },
  );
}

export async function listSessions(conn, seriesId) {
  const [rows] = await conn.query(
    "SELECT * FROM bookings WHERE series_id = :seriesId ORDER BY series_index",
    { seriesId },
  );
  return rows;
}

export async function countActiveSeries(conn, userId, current) {
  const [rows] = await conn.query(
    `SELECT COUNT(DISTINCT series_id) AS total
     FROM bookings
     WHERE user_id = :userId AND series_id IS NOT NULL
       AND status IN ('pending', 'confirmed') AND start_at > :now`,
    { userId, now: current },
  );
  return Number(rows[0]?.total ?? 0);
}

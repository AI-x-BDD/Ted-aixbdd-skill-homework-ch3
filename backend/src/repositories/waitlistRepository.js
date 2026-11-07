export async function insert(conn, entry) {
  const [result] = await conn.query(
    `INSERT INTO waitlist_entries (
       user_id, venue_id, start_at, end_at, subject, attendees, status, created_at
     ) VALUES (
       :userId, :venueId, :startAt, :endAt, :subject, :attendees, 'waiting', :createdAt
     )`,
    {
      userId: entry.user_id,
      venueId: entry.venue_id,
      startAt: entry.start_at,
      endAt: entry.end_at,
      subject: entry.subject,
      attendees: entry.attendees,
      createdAt: entry.created_at,
    },
  );
  return result.insertId;
}

export async function findById(conn, id) {
  const [rows] = await conn.query(
    `SELECT w.*, v.name AS venue_name
     FROM waitlist_entries w JOIN venues v ON v.id = w.venue_id WHERE w.id = :id`,
    { id },
  );
  return rows[0] ?? null;
}

export async function lockByIds(conn, ids) {
  if (!ids.length) {
    return [];
  }
  const [rows] = await conn.query({
    sql: `SELECT * FROM waitlist_entries WHERE id IN (${ids.map(() => "?").join(",")}) ORDER BY id FOR UPDATE`,
    namedPlaceholders: false,
    values: ids,
  });
  return rows;
}

export async function listByUser(conn, userId, { recentDays = 30 } = {}) {
  const [rows] = await conn.query(
    `SELECT w.*, v.name AS venue_name
     FROM waitlist_entries w
     JOIN venues v ON v.id = w.venue_id
     WHERE w.user_id = :userId
       AND (w.status IN ('waiting', 'offered') OR (w.closed_at IS NOT NULL AND w.closed_at >= DATE_SUB(:now, INTERVAL :days DAY)))
     ORDER BY FIELD(w.status, 'offered', 'waiting') DESC, w.created_at ASC
     LIMIT 50`,
    { userId, now: new Date(), days: recentDays },
  );
  return rows;
}

export async function listOverlapping(conn, venueId, range) {
  const [rows] = await conn.query(
    `SELECT * FROM waitlist_entries
     WHERE venue_id = :venueId AND status = 'waiting'
       AND start_at < :toAt AND end_at > :fromAt
     ORDER BY created_at, id`,
    { venueId, fromAt: range.from, toAt: range.to },
  );
  return rows;
}

export async function setOffered(conn, id, expiresAt) {
  await conn.query(
    "UPDATE waitlist_entries SET status = 'offered', offer_expires_at = :expiresAt WHERE id = :id",
    { id, expiresAt },
  );
}

export async function close(
  conn,
  id,
  { status, closeReason, bookingId, now: current },
) {
  await conn.query(
    `UPDATE waitlist_entries
     SET status = :status, close_reason = :closeReason, booking_id = :bookingId, closed_at = :now, offer_expires_at = NULL
     WHERE id = :id`,
    {
      id,
      status,
      closeReason: closeReason ?? null,
      bookingId: bookingId ?? null,
      now: current,
    },
  );
}

export async function listDueOffers(conn, current) {
  const [rows] = await conn.query(
    `SELECT * FROM waitlist_entries WHERE status = 'offered' AND offer_expires_at <= :now ORDER BY offer_expires_at LIMIT 100 FOR UPDATE SKIP LOCKED`,
    { now: current },
  );
  return rows;
}

export async function listStarted(conn, current) {
  const [rows] = await conn.query(
    `SELECT * FROM waitlist_entries WHERE status IN ('waiting', 'offered') AND start_at <= :now ORDER BY start_at LIMIT 100 FOR UPDATE SKIP LOCKED`,
    { now: current },
  );
  return rows;
}

export async function listOpenByVenue(conn, venueId) {
  const [rows] = await conn.query(
    "SELECT * FROM waitlist_entries WHERE venue_id = :venueId AND status IN ('waiting', 'offered')",
    { venueId },
  );
  return rows;
}

export async function listOpenByUser(conn, userId) {
  const [rows] = await conn.query(
    "SELECT * FROM waitlist_entries WHERE user_id = :userId AND status IN ('waiting', 'offered')",
    { userId },
  );
  return rows;
}

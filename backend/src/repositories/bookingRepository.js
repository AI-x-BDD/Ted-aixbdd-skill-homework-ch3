export async function insert(conn, booking) {
  const [result] = await conn.query(
    `INSERT INTO bookings (
       user_id, venue_id, start_at, end_at, subject, attendees, status,
       series_id, series_index, late_cancel, confirmed_at, reminder_sent_at
     ) VALUES (
       :userId, :venueId, :startAt, :endAt, :subject, :attendees, :status,
       :seriesId, :seriesIndex, :lateCancel, :confirmedAt, :reminderSentAt
     )`,
    {
      userId: booking.user_id,
      venueId: booking.venue_id,
      startAt: booking.start_at,
      endAt: booking.end_at,
      subject: booking.subject,
      attendees: booking.attendees,
      status: booking.status,
      seriesId: booking.series_id ?? null,
      seriesIndex: booking.series_index ?? null,
      lateCancel: booking.late_cancel ? 1 : 0,
      confirmedAt: booking.confirmed_at ?? null,
      reminderSentAt: booking.reminder_sent_at ?? null,
    },
  );
  return result.insertId;
}

function mapRow(row) {
  if (!row) {
    return null;
  }
  return {
    ...row,
    late_cancel: Boolean(row.late_cancel),
  };
}

export async function findById(conn, id) {
  const [rows] = await conn.query(
    `SELECT b.*, v.name AS venue_name, v.capacity AS venue_capacity, v.requires_approval AS venue_requires_approval, v.is_active AS venue_is_active
     FROM bookings b
     JOIN venues v ON v.id = b.venue_id
     WHERE b.id = :id`,
    { id },
  );
  return mapRow(rows[0]);
}

export async function lockById(conn, id) {
  const [rows] = await conn.query(
    `SELECT b.*, v.name AS venue_name
     FROM bookings b
     JOIN venues v ON v.id = b.venue_id
     WHERE b.id = :id
     FOR UPDATE`,
    { id },
  );
  return mapRow(rows[0]);
}

export async function countHeld(conn, userId, current) {
  const [rows] = await conn.query(
    `SELECT COUNT(DISTINCT IF(series_id IS NULL, CONCAT('b', id), CONCAT('s', series_id))) AS total
     FROM bookings
     WHERE user_id = :userId AND status IN ('pending', 'confirmed') AND start_at > :now`,
    { userId, now: current },
  );
  return Number(rows[0]?.total ?? 0);
}

export async function listMine(
  conn,
  { userId, tab, now: current, limit = 20, cursor = 0, offset } = {},
) {
  const skip = Number(offset ?? cursor ?? 0);
  const take = Number(limit) || 20;
  const upcoming = tab !== "past";
  const where = upcoming
    ? "b.user_id = :userId AND b.status IN ('pending', 'confirmed', 'checked_in') AND b.end_at > :now"
    : "b.user_id = :userId AND NOT (b.status IN ('pending', 'confirmed', 'checked_in') AND b.end_at > :now)";
  const order = upcoming
    ? "b.start_at ASC, b.id ASC"
    : "b.start_at DESC, b.id DESC";
  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS total FROM bookings b WHERE ${where}`,
    { userId, now: current },
  );
  const [rows] = await conn.query(
    `SELECT b.*, v.name AS venue_name, v.is_active AS venue_is_active
     FROM bookings b
     JOIN venues v ON v.id = b.venue_id
     WHERE ${where}
     ORDER BY ${order}
     LIMIT :take OFFSET :skip`,
    { userId, now: current, take, skip },
  );
  return { items: rows.map(mapRow), total: Number(countRows[0]?.total ?? 0) };
}

export async function updateContent(conn, id, { subject, attendees }) {
  await conn.query(
    "UPDATE bookings SET subject = :subject, attendees = :attendees WHERE id = :id",
    {
      id,
      subject,
      attendees,
    },
  );
}

export async function updateSchedule(conn, id, { venueId, startAt, endAt }) {
  await conn.query(
    `UPDATE bookings
     SET venue_id = :venueId, start_at = :startAt, end_at = :endAt, confirmed_at = :confirmedAt, reminder_sent_at = NULL
     WHERE id = :id`,
    { id, venueId, startAt, endAt, confirmedAt: startAt },
  );
}

export async function setLateCancel(conn, id, value) {
  await conn.query("UPDATE bookings SET late_cancel = :value WHERE id = :id", {
    id,
    value: value ? 1 : 0,
  });
}

export async function listPendingForVenues(conn, venueIds) {
  if (!venueIds.length) {
    return [];
  }
  const [rows] = await conn.query({
    sql: `SELECT b.*, v.name AS venue_name, u.name AS booker_name
     FROM bookings b
     JOIN venues v ON v.id = b.venue_id
     JOIN users u ON u.id = b.user_id
     WHERE b.status = 'pending' AND b.venue_id IN (${venueIds.map(() => "?").join(",")}) AND b.series_id IS NULL
     ORDER BY b.start_at ASC`,
    namedPlaceholders: false,
    values: venueIds,
  });
  return rows.map(mapRow);
}

export async function listPendingAll(conn) {
  const [rows] = await conn.query(
    `SELECT b.*, v.name AS venue_name, u.name AS booker_name
     FROM bookings b
     JOIN venues v ON v.id = b.venue_id
     JOIN users u ON u.id = b.user_id
     WHERE b.status = 'pending' AND b.series_id IS NULL
     ORDER BY b.start_at ASC`,
  );
  return rows.map(mapRow);
}

export async function listBySeries(conn, seriesId) {
  const [rows] = await conn.query(
    `SELECT b.*, v.name AS venue_name
     FROM bookings b
     JOIN venues v ON v.id = b.venue_id
     WHERE b.series_id = :seriesId
     ORDER BY b.series_index`,
    { seriesId },
  );
  return rows.map(mapRow);
}

export async function listUncancelledBySeries(conn, seriesId) {
  const [rows] = await conn.query(
    `SELECT b.*, v.name AS venue_name
     FROM bookings b
     JOIN venues v ON v.id = b.venue_id
     WHERE b.series_id = :seriesId AND b.status <> 'cancelled'
     ORDER BY b.series_index`,
    { seriesId },
  );
  return rows.map(mapRow);
}

export async function listActiveInRange(conn, venueId, startAt, endAt) {
  const [rows] = await conn.query(
    `SELECT b.*, u.name AS booker_name, v.name AS venue_name
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN venues v ON v.id = b.venue_id
     WHERE b.venue_id = :venueId AND b.status IN ('pending', 'confirmed', 'checked_in')
       AND b.start_at < :endAt AND b.end_at > :startAt AND b.start_at > :startAt
     ORDER BY b.start_at`,
    { venueId, startAt, endAt },
  );
  return rows.map(mapRow);
}

export async function listActiveByVenue(conn, venueId, current) {
  const [rows] = await conn.query(
    `SELECT b.*, u.name AS booker_name, v.name AS venue_name
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN venues v ON v.id = b.venue_id
     WHERE b.venue_id = :venueId AND b.status IN ('pending', 'confirmed') AND b.start_at > :now
     ORDER BY b.start_at`,
    { venueId, now: current },
  );
  return rows.map(mapRow);
}

export async function listActiveByUser(conn, userId, current) {
  const [rows] = await conn.query(
    `SELECT b.*, u.name AS booker_name, v.name AS venue_name
     FROM bookings b
     JOIN users u ON u.id = b.user_id
     JOIN venues v ON v.id = b.venue_id
     WHERE b.user_id = :userId AND b.status IN ('pending', 'confirmed') AND b.start_at > :now
     ORDER BY b.start_at`,
    { userId, now: current },
  );
  return rows.map(mapRow);
}

export async function listAdmin(
  conn,
  { fromAt, toAt, venueId, status, keyword, limit = 20, offset = 0 } = {},
) {
  const conditions = ["1=1"];
  const params = { take: Number(limit) || 20, skip: Number(offset) || 0 };
  if (fromAt) {
    conditions.push("b.start_at >= :fromAt");
    params.fromAt = fromAt;
  }
  if (toAt) {
    conditions.push("b.start_at < :toAt");
    params.toAt = toAt;
  }
  if (venueId) {
    conditions.push("b.venue_id = :venueId");
    params.venueId = venueId;
  }
  if (status) {
    conditions.push("b.status = :status");
    params.status = status;
  }
  if (keyword) {
    conditions.push("u.name LIKE :kw");
    params.kw = `%${keyword}%`;
  }
  const where = conditions.join(" AND ");
  const [countRows] = await conn.query(
    `SELECT COUNT(*) AS total FROM bookings b JOIN users u ON u.id = b.user_id WHERE ${where}`,
    params,
  );
  const [rows] = await conn.query(
    `SELECT b.*, v.name AS venue_name, u.id AS booker_id, u.name AS booker_name
     FROM bookings b
     JOIN venues v ON v.id = b.venue_id
     JOIN users u ON u.id = b.user_id
     WHERE ${where}
     ORDER BY b.start_at DESC, b.id DESC
     LIMIT :take OFFSET :skip`,
    params,
  );
  return { items: rows.map(mapRow), total: Number(countRows[0]?.total ?? 0) };
}

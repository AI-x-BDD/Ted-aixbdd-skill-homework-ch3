export async function insert(conn, window) {
  const [result] = await conn.query(
    "INSERT INTO venue_maintenance_windows (venue_id, start_at, end_at) VALUES (:venueId, :startAt, :endAt)",
    {
      venueId: window.venue_id,
      startAt: window.start_at,
      endAt: window.end_at,
    },
  );
  return result.insertId;
}

export async function update(conn, id, window) {
  await conn.query(
    "UPDATE venue_maintenance_windows SET start_at = :startAt, end_at = :endAt WHERE id = :id",
    { id, startAt: window.start_at, endAt: window.end_at },
  );
}

export async function remove(conn, id) {
  await conn.query("DELETE FROM venue_maintenance_windows WHERE id = :id", {
    id,
  });
}

export async function findById(conn, id) {
  const [rows] = await conn.query(
    "SELECT * FROM venue_maintenance_windows WHERE id = :id",
    { id },
  );
  return rows[0] ?? null;
}

export async function listByVenue(conn, venueId) {
  const [rows] = await conn.query(
    "SELECT * FROM venue_maintenance_windows WHERE venue_id = :venueId ORDER BY start_at",
    { venueId },
  );
  return rows;
}

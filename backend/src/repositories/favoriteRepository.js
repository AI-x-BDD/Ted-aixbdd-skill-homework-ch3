export async function add(conn, { userId, venueId, createdAt }) {
  await conn.query(
    `INSERT IGNORE INTO favorite_venues (user_id, venue_id, created_at)
     VALUES (:userId, :venueId, :createdAt)`,
    { userId, venueId, createdAt },
  );
}

export async function remove(conn, { userId, venueId }) {
  await conn.query(
    "DELETE FROM favorite_venues WHERE user_id = :userId AND venue_id = :venueId",
    { userId, venueId },
  );
}

export async function listVenueIds(conn, userId) {
  const [rows] = await conn.query(
    "SELECT venue_id FROM favorite_venues WHERE user_id = :userId",
    { userId },
  );
  return new Set(rows.map((row) => Number(row.venue_id)));
}

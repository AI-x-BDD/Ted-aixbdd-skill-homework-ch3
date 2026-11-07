export async function listBookingsForReport(conn, venueId, fromAt, toAt) {
  const [rows] = await conn.query(
    `SELECT b.*, (
       SELECT e.actor_type FROM booking_events e
       WHERE e.booking_id = b.id AND e.to_status = 'cancelled'
       ORDER BY e.occurred_at DESC, e.id DESC LIMIT 1
     ) AS cancel_actor
     FROM bookings b
     WHERE b.venue_id = :venueId AND b.start_at >= :fromAt AND b.start_at < :toAt`,
    { venueId, fromAt, toAt },
  );
  return rows;
}

export async function listVenuesForReport(conn) {
  const [rows] = await conn.query("SELECT * FROM venues ORDER BY name");
  const items = [];
  for (const row of rows) {
    const [hours] = await conn.query(
      "SELECT weekday, open_minute, close_minute FROM venue_opening_hours WHERE venue_id = :id",
      { id: row.id },
    );
    const [maintenance] = await conn.query(
      "SELECT start_at, end_at FROM venue_maintenance_windows WHERE venue_id = :id",
      { id: row.id },
    );
    items.push({
      ...row,
      openingHours: hours,
      maintenance,
    });
  }
  return items;
}

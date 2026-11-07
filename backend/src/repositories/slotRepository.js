export class OccupiedError extends Error {
  constructor() {
    super("時段被占用");
    this.code = "ER_DUP_ENTRY";
    this.occupied = true;
  }
}

export async function insertRange(
  conn,
  venueId,
  slotStarts,
  holderType,
  holderId,
) {
  const starts = [...slotStarts].sort((a, b) => a.getTime() - b.getTime());
  if (!starts.length) {
    return;
  }
  const sql = `INSERT INTO booking_slots (venue_id, slot_start_at, holder_type, holder_id) VALUES ${starts
    .map(() => "(?, ?, ?, ?)")
    .join(", ")}`;
  const values = [];
  for (const start of starts) {
    values.push(venueId, start, holderType, holderId);
  }
  try {
    await conn.query({ sql, namedPlaceholders: false }, values);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY" || error.errno === 1062) {
      throw new OccupiedError();
    }
    throw error;
  }
}

export async function deleteByHolder(conn, holderType, holderId) {
  await conn.query(
    "DELETE FROM booking_slots WHERE holder_type = :holderType AND holder_id = :holderId",
    {
      holderType,
      holderId,
    },
  );
}

export async function deleteByHolderFrom(conn, holderType, holderId, fromSlot) {
  await conn.query(
    `DELETE FROM booking_slots
     WHERE holder_type = :holderType AND holder_id = :holderId AND slot_start_at >= :fromSlot`,
    { holderType, holderId, fromSlot },
  );
}

export async function listForCalendar(conn, venueId, fromAt, toAt) {
  const [rows] = await conn.query(
    `SELECT slot_start_at, holder_type
     FROM booking_slots
     WHERE venue_id = :venueId AND slot_start_at >= :fromAt AND slot_start_at < :toAt
     ORDER BY slot_start_at`,
    { venueId, fromAt, toAt },
  );
  return rows;
}

export async function listOccupied(conn, venueId, fromAt, toAt) {
  const [rows] = await conn.query(
    `SELECT venue_id, slot_start_at, holder_type, holder_id
     FROM booking_slots
     WHERE venue_id = :venueId AND slot_start_at >= :fromAt AND slot_start_at < :toAt
     ORDER BY slot_start_at`,
    { venueId, fromAt, toAt },
  );
  return rows;
}

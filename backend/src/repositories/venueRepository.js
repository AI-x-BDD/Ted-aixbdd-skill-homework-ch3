import { fromTaipei, toTaipeiParts } from "../../../shared/src/taipei.js";

function parseEquipment(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
}

function timeToMinute(time) {
  if (time === "24:00") {
    return 1440;
  }
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
}

function minuteToTime(minutes) {
  if (Number(minutes) === 1440) {
    return "24:00";
  }
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

async function attach(conn, venue) {
  const [hours] = await conn.query(
    "SELECT weekday, open_minute, close_minute FROM venue_opening_hours WHERE venue_id = :id ORDER BY weekday, open_minute",
    { id: venue.id },
  );
  const [reviewers] = await conn.query(
    `SELECT u.id, u.name, u.email
     FROM venue_reviewers vr
     JOIN users u ON u.id = vr.user_id
     WHERE vr.venue_id = :id
     ORDER BY u.name`,
    { id: venue.id },
  );
  return {
    ...venue,
    equipment: parseEquipment(venue.equipment),
    requires_approval: Boolean(venue.requires_approval),
    is_active: Boolean(venue.is_active),
    openingHours: hours.map((row) => ({
      weekday: row.weekday,
      startTime: minuteToTime(row.open_minute),
      endTime: minuteToTime(row.close_minute),
      open_minute: row.open_minute,
      close_minute: row.close_minute,
    })),
    reviewers,
  };
}

export async function insert(conn, venue) {
  const [result] = await conn.query(
    `INSERT INTO venues (name, location, capacity, equipment, requires_approval, is_active)
     VALUES (:name, :location, :capacity, CAST(:equipment AS JSON), :requiresApproval, :isActive)`,
    {
      name: venue.name,
      location: venue.location,
      capacity: venue.capacity,
      equipment: JSON.stringify(venue.equipment ?? []),
      requiresApproval: venue.requires_approval ? 1 : 0,
      isActive: venue.is_active === 0 ? 0 : 1,
    },
  );
  return result.insertId;
}

export async function update(conn, id, venue) {
  await conn.query(
    `UPDATE venues
     SET name = :name, location = :location, capacity = :capacity,
         equipment = CAST(:equipment AS JSON), requires_approval = :requiresApproval
     WHERE id = :id`,
    {
      id,
      name: venue.name,
      location: venue.location,
      capacity: venue.capacity,
      equipment: JSON.stringify(venue.equipment ?? []),
      requiresApproval: venue.requires_approval ? 1 : 0,
    },
  );
}

export async function replaceOpeningHours(conn, venueId, hours) {
  await conn.query(
    "DELETE FROM venue_opening_hours WHERE venue_id = :venueId",
    { venueId },
  );
  for (const hour of hours) {
    await conn.query(
      `INSERT INTO venue_opening_hours (venue_id, weekday, open_minute, close_minute)
       VALUES (:venueId, :weekday, :openMinute, :closeMinute)`,
      {
        venueId,
        weekday: hour.weekday,
        openMinute: hour.open_minute ?? timeToMinute(hour.startTime),
        closeMinute: hour.close_minute ?? timeToMinute(hour.endTime),
      },
    );
  }
}

export async function replaceReviewers(conn, venueId, userIds) {
  await conn.query("DELETE FROM venue_reviewers WHERE venue_id = :venueId", {
    venueId,
  });
  for (const userId of userIds) {
    await conn.query(
      "INSERT INTO venue_reviewers (venue_id, user_id) VALUES (:venueId, :userId)",
      {
        venueId,
        userId,
      },
    );
  }
}

export async function findById(conn, id) {
  const [rows] = await conn.query("SELECT * FROM venues WHERE id = :id", {
    id,
  });
  return rows[0] ? attach(conn, rows[0]) : null;
}

export async function findByName(conn, name) {
  const [rows] = await conn.query("SELECT * FROM venues WHERE name = :name", {
    name,
  });
  return rows[0] ? attach(conn, rows[0]) : null;
}

export async function listAll(conn) {
  const [rows] = await conn.query("SELECT * FROM venues ORDER BY name");
  const items = [];
  for (const row of rows) {
    items.push(await attach(conn, row));
  }
  return items;
}

export async function deleteReviewersOfUser(conn, userId) {
  await conn.query("DELETE FROM venue_reviewers WHERE user_id = :userId", {
    userId,
  });
}

export async function listActive(conn) {
  const [rows] = await conn.query(
    "SELECT * FROM venues WHERE is_active = 1 ORDER BY name",
  );
  const items = [];
  for (const row of rows) {
    items.push(await attach(conn, row));
  }
  return items;
}

export async function findForBooking(conn, id) {
  return findById(conn, id);
}

export async function venueIdsOfReviewer(conn, userId) {
  const [rows] = await conn.query(
    "SELECT venue_id FROM venue_reviewers WHERE user_id = :userId",
    { userId },
  );
  return rows.map((row) => row.venue_id);
}

export async function reviewerIdsOf(conn, venueId) {
  const [rows] = await conn.query(
    `SELECT vr.user_id
     FROM venue_reviewers vr
     JOIN users u ON u.id = vr.user_id AND u.is_active = 1
     JOIN user_roles r ON r.user_id = u.id AND r.role = 'reviewer'
     WHERE vr.venue_id = :venueId`,
    { venueId },
  );
  return rows.map((row) => row.user_id);
}

export async function search(
  conn,
  { date, startTime, endTime, capacity, equipment } = {},
) {
  let sql = "SELECT DISTINCT v.* FROM venues v WHERE v.is_active = 1";
  const params = {};
  if (capacity) {
    sql += " AND v.capacity >= :capacity";
    params.capacity = Number(capacity);
  }
  if (equipment?.length) {
    equipment.forEach((item, index) => {
      const key = `eq${index}`;
      sql += ` AND JSON_CONTAINS(v.equipment, CAST(:${key} AS JSON))`;
      params[key] = JSON.stringify(item);
    });
  }
  sql += " ORDER BY v.name";
  const [rows] = await conn.query(sql, params);
  const items = [];
  for (const row of rows) {
    const venue = await attach(conn, row);
    if (date && startTime && endTime) {
      const parts = toTaipeiParts(fromTaipei(date, startTime));
      const start = timeToMinute(startTime);
      const end = timeToMinute(endTime);
      const fits = venue.openingHours.some(
        (hour) =>
          hour.weekday === parts.weekday &&
          hour.open_minute <= start &&
          hour.close_minute >= end,
      );
      if (!fits) {
        continue;
      }
      const fromAt = fromTaipei(date, startTime);
      const toAt = fromTaipei(date, endTime);
      const [slots] = await conn.query(
        `SELECT 1 FROM booking_slots
         WHERE venue_id = :venueId AND slot_start_at >= :fromAt AND slot_start_at < :toAt
         LIMIT 1`,
        { venueId: venue.id, fromAt, toAt },
      );
      if (slots.length) {
        continue;
      }
    }
    items.push(venue);
  }
  return items;
}

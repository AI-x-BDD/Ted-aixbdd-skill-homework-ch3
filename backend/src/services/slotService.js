import {
  OccupiedError,
  deleteByHolder,
  deleteByHolderFrom,
  findOccupiedVenueIds,
  insertRange,
  listOccupied,
} from "../repositories/slotRepository.js";
import { fromTaipei } from "../../../shared/src/taipei.js";

const listeners = [];

export function slotStartsFor(startAt, endAt) {
  const starts = [];
  const start = startAt.getTime();
  const end = endAt.getTime();
  for (let time = start; time < end; time += 30 * 60 * 1000) {
    starts.push(new Date(time));
  }
  return starts;
}

export async function occupy(
  conn,
  venueId,
  startAt,
  endAt,
  holderType,
  holderId,
) {
  await insertRange(
    conn,
    venueId,
    slotStartsFor(startAt, endAt),
    holderType,
    holderId,
  );
}

export async function release(
  conn,
  { venueId, holderType, holderId, from, now: current },
) {
  if (from) {
    await deleteByHolderFrom(conn, holderType, holderId, from);
  } else {
    await deleteByHolder(conn, holderType, holderId);
  }
  const range = { from: from ?? null, to: null };
  for (const listener of listeners) {
    await listener(conn, venueId, range, current);
  }
}

export function registerReleaseListener(fn) {
  listeners.push(fn);
}

export async function notifyReleased(conn, venueId, range, current) {
  for (const listener of listeners) {
    await listener(conn, venueId, range, current);
  }
}

export async function isRangeOccupied(conn, venueId, startAt, endAt) {
  const occupied = await findOccupiedVenueIds(
    conn,
    [venueId],
    slotStartsFor(startAt, endAt),
  );
  return occupied.has(Number(venueId));
}

export async function loadDayOccupied(
  conn,
  venueId,
  date,
  { excludeHolder } = {},
) {
  const rows = await listOccupied(
    conn,
    venueId,
    fromTaipei(date, "00:00"),
    fromTaipei(date, "24:00"),
  );
  const starts = new Set();
  for (const row of rows) {
    if (
      excludeHolder &&
      row.holder_type === excludeHolder.type &&
      Number(row.holder_id) === Number(excludeHolder.id)
    ) {
      continue;
    }
    starts.add(new Date(row.slot_start_at).getTime());
  }
  return starts;
}

export { OccupiedError };

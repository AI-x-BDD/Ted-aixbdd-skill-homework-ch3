import {
  OccupiedError,
  deleteByHolder,
  deleteByHolderFrom,
  insertRange,
} from "../repositories/slotRepository.js";

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

export { OccupiedError };

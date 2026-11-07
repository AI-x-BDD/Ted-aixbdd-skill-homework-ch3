import { fromTaipei, toTaipeiParts } from "../../../shared/src/taipei.js";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function addDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`;
}

function minuteToTime(minute) {
  if (minute >= 1440) {
    return "24:00";
  }
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

function formatPct(numerator, denominator, { zeroIsZero = false } = {}) {
  if (!denominator) {
    return { value: null, display: "無資料" };
  }
  if (!numerator && zeroIsZero) {
    return { value: 0, display: "0%" };
  }
  const rounded = Math.round((numerator / denominator) * 1000) / 10;
  const isInt = Number.isInteger(rounded);
  return {
    value: isInt ? rounded : rounded,
    display: isInt ? `${rounded}%` : `${rounded}%`,
  };
}

function overlapMinutes(startA, endA, startB, endB) {
  const start = Math.max(startA.getTime(), startB.getTime());
  const end = Math.min(endA.getTime(), endB.getTime());
  return Math.max(0, (end - start) / 60000);
}

function openMinutesForVenue(venue, from, to) {
  let open = 0;
  let cursor = from;
  while (cursor <= to) {
    const weekday = toTaipeiParts(fromTaipei(cursor, "12:00")).weekday;
    const hours = (venue.openingHours ?? []).filter(
      (hour) => Number(hour.weekday) === weekday,
    );
    for (const hour of hours) {
      const openStart = fromTaipei(cursor, minuteToTime(hour.open_minute ?? 0));
      const openEnd = fromTaipei(cursor, minuteToTime(hour.close_minute ?? 0));
      let minutes = (openEnd.getTime() - openStart.getTime()) / 60000;
      for (const window of venue.maintenance ?? []) {
        minutes -= overlapMinutes(
          openStart,
          openEnd,
          new Date(window.start_at),
          new Date(window.end_at),
        );
      }
      open += Math.max(0, minutes);
    }
    cursor = addDays(cursor, 1);
  }
  return open;
}

function peakSlotsFor(bookings) {
  const peaks = new Map();
  for (const row of bookings) {
    let cursor = new Date(row.start_at);
    const end = new Date(row.end_at);
    while (cursor < end) {
      const parts = toTaipeiParts(cursor);
      const hour = Number(parts.time.slice(0, 2));
      const key = `${parts.weekday}-${hour}`;
      const nextHour = new Date(cursor.getTime() + 60 * 60000);
      const slotEnd = nextHour < end ? nextHour : end;
      peaks.set(
        key,
        (peaks.get(key) ?? 0) + (slotEnd.getTime() - cursor.getTime()) / 60000,
      );
      cursor = slotEnd;
    }
  }
  return [...peaks.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([key]) => {
      const [weekday, hourText] = key.split("-");
      const hour = Number(hourText);
      const next = hour + 1;
      return {
        weekday: Number(weekday),
        hour,
        display: `週${WEEKDAYS[Number(weekday)]} ${pad(hour)}:00–${next === 24 ? "24:00" : `${pad(next)}:00`}`,
      };
    });
}

export function computeReport({ venues, bookings, from, to }) {
  const items = venues.map((venue) => {
    const venueBookings = bookings.filter(
      (row) => Number(row.venue_id) === Number(venue.id),
    );
    const openMinutes = openMinutesForVenue(venue, from, to);
    const used = venueBookings
      .filter(
        (row) => row.status === "checked_in" || row.status === "completed",
      )
      .reduce(
        (sum, row) =>
          sum + (new Date(row.end_at) - new Date(row.start_at)) / 60000,
        0,
      );
    const usage = formatPct(used, openMinutes, { zeroIsZero: true });
    const attended = venueBookings.filter((row) =>
      ["checked_in", "completed", "no_show"].includes(row.status),
    );
    const noShows = venueBookings.filter((row) => row.status === "no_show");
    const userCancels = venueBookings.filter(
      (row) => row.status === "cancelled" && row.cancel_actor === "user",
    );
    const adminCancels = venueBookings.filter(
      (row) => row.status === "cancelled" && row.cancel_actor === "admin",
    );
    const denom = venueBookings.filter(
      (row) => row.status !== "rejected" && !adminCancels.includes(row),
    ).length;
    const cancel = formatPct(userCancels.length, denom);
    const lateCancels = userCancels.filter((row) => row.late_cancel);
    const peaks = peakSlotsFor(
      venueBookings.filter(
        (row) => row.status === "checked_in" || row.status === "completed",
      ),
    );
    return {
      venueId: Number(venue.id),
      venueName: venue.name,
      active: Boolean(venue.is_active),
      utilization: usage,
      peakSlots: peaks,
      peakDisplay: peaks.length
        ? peaks.map((item) => item.display).join("；")
        : "無資料",
      cancellation: cancel,
      lateCancelCount: lateCancels.length,
      noShow: formatPct(noShows.length, attended.length),
    };
  });
  return { from, to, venues: items };
}

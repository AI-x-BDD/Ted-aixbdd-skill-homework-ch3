export function checkInWindow(booking, rules) {
  const start = new Date(booking.start_at ?? booking.startAt);
  const end = new Date(booking.end_at ?? booking.endAt);
  const openMinutes =
    rules.checkin_open_minutes?.int_value ?? rules.checkinOpenMinutes ?? 10;
  const closeMinutes =
    rules.checkin_close_minutes?.int_value ?? rules.checkinCloseMinutes ?? 15;
  const windowStart = new Date(start.getTime() - openMinutes * 60000);
  let windowEnd = new Date(start.getTime() + closeMinutes * 60000);
  if (windowEnd > end) {
    windowEnd = end;
  }
  return { startAt: windowStart.toISOString(), endAt: windowEnd.toISOString() };
}

export function canCheckIn(booking, rules, current) {
  if ((booking.status ?? "") !== "confirmed") {
    return false;
  }
  const window = checkInWindow(booking, rules);
  const nowMs = current.getTime();
  return (
    nowMs >= new Date(window.startAt).getTime() &&
    nowMs <= new Date(window.endAt).getTime()
  );
}

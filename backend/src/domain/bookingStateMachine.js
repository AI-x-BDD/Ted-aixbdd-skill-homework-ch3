const TRANSITIONS = {
  pending: ["confirmed", "rejected", "cancelled"],
  confirmed: ["checked_in", "cancelled", "no_show", "pending"],
  checked_in: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
  no_show: [],
};

export function canTransition(from, to) {
  return Boolean(TRANSITIONS[from]?.includes(to));
}

export function isActive(status) {
  return (
    status === "pending" || status === "confirmed" || status === "checked_in"
  );
}

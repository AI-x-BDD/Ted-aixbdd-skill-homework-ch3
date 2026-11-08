export function hasRole(user, role) {
  return Boolean(user?.roles?.includes(role));
}

export function isAdmin(user) {
  return hasRole(user, "admin");
}

export function isOwner(user, booking) {
  if (!user || !booking) {
    return false;
  }
  const bookingUserId = booking.userId ?? booking.user_id;
  return Number(user.id) === Number(bookingUserId);
}

export function can(user, action, resource) {
  if (!user || !action) {
    return false;
  }
  if (
    action === "user:manage" ||
    action === "user:list" ||
    action === "venue:manage" ||
    action === "admin:booking-cancel" ||
    action === "admin:booking-view" ||
    action === "rule:manage" ||
    action === "report:view"
  ) {
    return isAdmin(user);
  }
  if (
    action === "auth:self" ||
    action === "booking:create" ||
    action === "booking:list-own" ||
    action === "favorite:manage" ||
    action === "series:create" ||
    action === "waitlist:own"
  ) {
    return true;
  }
  if (
    action === "booking:cancel" ||
    action === "booking:update" ||
    action === "booking:view" ||
    action === "booking:check-in"
  ) {
    if (!resource) {
      return true;
    }
    return isOwner(user, resource);
  }
  if (action === "review:list") {
    return hasRole(user, "reviewer") || isAdmin(user);
  }
  if (action === "review:decide" || action === "series:review") {
    if (!resource) {
      return hasRole(user, "reviewer") || isAdmin(user);
    }
    const applicantId = Number(resource.user_id ?? resource.userId);
    const assigned = resource.reviewerIds ?? [];
    const isAssigned = assigned.map(Number).includes(Number(user.id));
    if (Number(user.id) === applicantId) {
      return false;
    }
    if (isAssigned && hasRole(user, "reviewer")) {
      return true;
    }
    const otherReviewers = assigned.filter((id) => Number(id) !== applicantId);
    if (!otherReviewers.length && isAdmin(user)) {
      return true;
    }
    return false;
  }
  return false;
}

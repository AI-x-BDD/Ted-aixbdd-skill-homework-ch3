import { get } from "./api/client.js";
import { h } from "./lib/h.js";

export let currentUser = null;
let intendedHash = "#/venues";

const PAGE_LOADERS = {
  "/login": () => import("./pages/loginPage.js"),
  "/change-password": () => import("./pages/changePasswordPage.js"),
  "/venues": () => import("./pages/venuesPage.js"),
  "/bookings/new": () => import("./pages/bookingFormPage.js"),
  "/bookings": () => import("./pages/myBookingsPage.js"),
  "/waitlist": () => import("./pages/waitlistPage.js"),
  "/notifications": () => import("./pages/notificationsPage.js"),
  "/reviews": () => import("./pages/reviewsPage.js"),
  "/admin/venues": () => import("./pages/adminVenuesPage.js"),
  "/admin/users": () => import("./pages/adminUsersPage.js"),
  "/admin/bookings": () => import("./pages/adminBookingsPage.js"),
  "/admin/rules": () => import("./pages/adminRulesPage.js"),
  "/admin/reports": () => import("./pages/adminReportsPage.js"),
};

const ADMIN_PREFIXES = ["/admin/"];
const REVIEW_PATHS = ["/reviews"];

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/venues";
  const [path, queryString] = raw.split("?");
  const query = Object.fromEntries(new URLSearchParams(queryString ?? ""));
  const venueMatch = path.match(/^\/venues\/([^/]+)$/);
  if (venueMatch) {
    return { route: "/venues", params: { venueId: venueMatch[1], ...query } };
  }
  const editMatch = path.match(/^\/bookings\/([^/]+)\/edit$/);
  if (editMatch) {
    return {
      route: "/bookings/new",
      params: { bookingId: editMatch[1], ...query },
    };
  }
  return { route: path, params: query };
}

function renderForbidden(container) {
  container.replaceChildren(
    h(
      "main",
      { class: "page", testid: "app-forbidden" },
      h("h1", { text: "沒有權限" }),
    ),
  );
}

function canAccess(route) {
  const roles = currentUser?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isReviewer = roles.includes("reviewer") || isAdmin;
  if (ADMIN_PREFIXES.some((prefix) => route.startsWith(prefix))) {
    return isAdmin;
  }
  if (REVIEW_PATHS.includes(route)) {
    return isReviewer;
  }
  return true;
}

async function loadPage(route) {
  const loader = PAGE_LOADERS[route];
  if (!loader) {
    return {
      render(container) {
        container.replaceChildren(
          h("main", { class: "page" }, h("h1", { text: "找不到頁面" })),
        );
      },
    };
  }
  try {
    return await loader();
  } catch {
    return {
      render(container) {
        container.replaceChildren();
      },
    };
  }
}

export async function refreshCurrentUser() {
  try {
    currentUser = await get("/api/auth/me");
    return currentUser;
  } catch (error) {
    if (error.status === 401) {
      currentUser = null;
      return null;
    }
    throw error;
  }
}

export async function startRouter(container) {
  async function render() {
    const { route, params } = parseHash();
    const publicRoutes = new Set(["/login"]);
    if (!currentUser && !publicRoutes.has(route)) {
      if (route !== "/login") {
        intendedHash = location.hash || "#/venues";
      }
      location.hash = "#/login";
      if (route === "/login") {
        const page = await loadPage("/login");
        await page.render(container, { ...params, intendedHash });
      }
      return;
    }
    if (
      currentUser?.mustChangePassword &&
      route !== "/change-password" &&
      route !== "/login"
    ) {
      location.hash = "#/change-password";
      return;
    }
    if (currentUser && route === "/login") {
      location.hash =
        intendedHash && intendedHash !== "#/login" ? intendedHash : "#/venues";
      return;
    }
    if (currentUser && !canAccess(route)) {
      renderForbidden(container);
      return;
    }
    const page = await loadPage(route);
    await page.render(container, params);
  }

  window.addEventListener("hashchange", () => {
    void render();
  });
  await refreshCurrentUser();
  if (!currentUser && location.hash && location.hash !== "#/login") {
    intendedHash = location.hash;
  }
  if (!location.hash) {
    location.hash = currentUser ? "#/venues" : "#/login";
  }
  await render();
}

export function rememberIntended(hash) {
  intendedHash = hash;
}

export function consumeIntended() {
  const value = intendedHash;
  intendedHash = "#/venues";
  return value;
}

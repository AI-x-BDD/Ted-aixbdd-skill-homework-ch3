import { post } from "../api/client.js";
import { h } from "../lib/h.js";
import { startUnreadPolling } from "../lib/poller.js";
import { REBOOK_TEXT } from "../../../shared/src/copy.js";
import { formatTaipei } from "../../../shared/src/taipei.js";
import { currentUser } from "../router.js";

let pollingStarted = false;

function isAdmin(user) {
  return user?.roles?.includes("admin");
}

function isReviewer(user) {
  return user?.roles?.includes("reviewer") || isAdmin(user);
}

export function renderForbidden(container) {
  container.replaceChildren(
    h(
      "main",
      { class: "page", testid: "app-forbidden" },
      h("h1", { text: "沒有權限" }),
      h("p", { class: "lead", text: "你沒有權限使用這個頁面。請洽管理員。" }),
    ),
  );
}

export function renderNav(activeHref = "") {
  const user = currentUser;
  if (!user) {
    return h("div");
  }
  const links = [
    { href: "#/venues", label: "場地" },
    { href: "#/bookings", label: "我的預約" },
    { href: "#/waitlist", label: "候補" },
    { href: "#/notifications", label: "通知", badge: true },
  ];
  if (isReviewer(user)) {
    links.push({ href: "#/reviews", label: "待審核" });
  }
  if (isAdmin(user)) {
    links.push(
      { href: "#/admin/venues", label: "場地管理" },
      { href: "#/admin/users", label: "帳號管理" },
      { href: "#/admin/bookings", label: "全部預約" },
      { href: "#/admin/rules", label: "規則管理" },
      { href: "#/admin/reports", label: "報表" },
    );
  }
  const navLinks = h("nav", { class: "nav", id: "app-nav-links" });
  for (const link of links) {
    const a = h("a", {
      href: link.href,
      "aria-current": activeHref === link.href ? "page" : null,
      text: link.label,
    });
    if (link.badge) {
      const badge = h("span", {
        class: "badge",
        testid: "app-notification-badge",
        hidden: true,
        text: "0",
      });
      a.append(" ", badge);
      if (!pollingStarted) {
        pollingStarted = true;
        startUnreadPolling((count) => {
          const el = document.querySelector(
            '[data-testid="app-notification-badge"]',
          );
          if (!el) {
            return;
          }
          el.hidden = !(count > 0);
          el.textContent = String(count);
        });
      }
    }
    navLinks.append(a);
  }
  const toggle = h("button", {
    class: "menu-btn",
    type: "button",
    testid: "app-nav-toggle",
    text: "選單",
    onClick: () => {
      navLinks.classList.toggle("open");
      userbox.classList.toggle("open");
    },
  });
  const userbox = h(
    "div",
    { class: "userbox open" },
    h("span", { text: user.name }),
    h("a", {
      href: "#/change-password",
      testid: "app-change-password",
      text: "變更密碼",
    }),
    h("button", {
      type: "button",
      testid: "app-logout",
      text: "登出",
      onClick: async () => {
        try {
          await post("/api/auth/logout", {});
        } catch {
          // still leave
        }
        location.hash = "#/login";
        location.reload();
      },
    }),
  );
  const bar = h(
    "header",
    { class: "topbar", testid: "app-nav" },
    h(
      "div",
      { class: "topbar-in" },
      h("span", { class: "brand", text: "場地預約" }),
      toggle,
      navLinks,
      userbox,
    ),
  );
  const wrap = h("div");
  wrap.append(bar);
  if (user.suspendedUntil) {
    const until = formatTaipei(new Date(user.suspendedUntil), {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    wrap.append(
      h("div", {
        class: "alert warn",
        testid: "suspension-banner",
        text: REBOOK_TEXT.suspendedBanner(until),
      }),
    );
  }
  return wrap;
}

export function mountPage(container, activeHref, ...content) {
  const main = h("main", { class: "page" }, ...content);
  container.replaceChildren(renderNav(activeHref), main);
  return main;
}

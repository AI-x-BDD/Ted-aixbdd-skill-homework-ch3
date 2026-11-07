import { get } from "../api/client.js";
import { bookingCard } from "../components/bookingCard.js";
import { mountPage } from "../components/nav.js";
import { h } from "../lib/h.js";
import { currentUser } from "../router.js";

export async function render(container) {
  const root = h("div", { testid: "my-bookings" });
  mountPage(container, "#/bookings", root);
  root.append(h("h1", { text: "我的預約" }));
  const live = h("div", {
    class: "sr-only",
    role: "status",
    "aria-live": "polite",
  });
  root.append(live);
  let tab = "upcoming";
  const upcoming = h("button", {
    type: "button",
    role: "tab",
    testid: "my-bookings-tab-upcoming",
    text: "即將到來",
    onClick: () => {
      tab = "upcoming";
      void load(true);
    },
  });
  const past = h("button", {
    type: "button",
    role: "tab",
    testid: "my-bookings-tab-past",
    text: "已結束",
    onClick: () => {
      tab = "past";
      void load(true);
    },
  });
  root.append(h("div", { class: "tabs", role: "tablist" }, upcoming, past));
  const out = h("div");
  root.append(out);
  let items = [];
  let total = 0;
  const pageSize = 20;

  async function load(reset) {
    upcoming.setAttribute("aria-selected", String(tab === "upcoming"));
    past.setAttribute("aria-selected", String(tab === "past"));
    if (reset) {
      items = [];
      total = 0;
      out.replaceChildren(
        h("div", { class: "skel skel-item", testid: "my-bookings-loading" }),
      );
    }
    try {
      const data = await get(
        `/api/bookings/mine?tab=${tab}&limit=${pageSize}&offset=${reset ? 0 : items.length}`,
      );
      total = data.total ?? 0;
      items = reset ? (data.items ?? []) : items.concat(data.items ?? []);
      draw();
    } catch {
      out.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "my-bookings-error" },
          h("p", { text: "無法載入你的預約。請稍後按「重新載入」再試一次。" }),
          h("button", {
            class: "btn",
            type: "button",
            text: "重新載入",
            onClick: () => load(true),
          }),
        ),
      );
    }
  }

  function draw() {
    if (!items.length) {
      const title =
        tab === "upcoming" ? "目前沒有即將到來的預約" : "還沒有已結束的預約";
      out.replaceChildren(
        h(
          "div",
          { class: "state-box", testid: "my-bookings-empty" },
          h("p", { text: title }),
          tab === "upcoming"
            ? h("p", { text: "到「場地」查詢空間，就能建立第一筆預約。" })
            : null,
          h("a", {
            class: "btn primary",
            href: "#/venues",
            testid: "my-bookings-go-venues",
            text: "查詢場地",
          }),
        ),
      );
      return;
    }
    const list = h("ul", { class: "list", testid: "my-bookings-list" });
    for (const booking of items) {
      list.append(
        bookingCard(booking, {
          onChanged: () => load(true),
          suspendedUntil: currentUser?.suspendedUntil,
        }),
      );
    }
    out.replaceChildren(list);
    if (items.length < total) {
      out.append(
        h("button", {
          class: "btn",
          type: "button",
          testid: "my-bookings-load-more",
          text: "載入更多",
          onClick: () => load(false),
        }),
      );
    }
  }

  await load(true);
}

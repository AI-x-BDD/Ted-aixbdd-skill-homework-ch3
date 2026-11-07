import { h } from "../lib/h.js";
import { formatDate } from "../lib/time.js";

const STATUS_LABEL = {
  available: "可預約",
  booked: "已預約",
  maintenance: "維護中",
  closed: "不開放",
};

const STATUS_CLASS = {
  available: "free",
  booked: "booked",
  maintenance: "maint",
  closed: "closed",
};

function addDays(dateString, days) {
  const [year, month, day] = dateString.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

function shortDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return `${month}/${day}（週${WEEKDAY[weekday]}）`;
}

function openSlots(day) {
  return day.slots.filter((slot) =>
    day.openRanges.some(
      (range) =>
        slot.startTime >= range.startTime && slot.startTime < range.endTime,
    ),
  );
}

export function renderCalendar(
  container,
  calendar,
  { onBook, onWaitlist, onNavigate } = {},
) {
  const root = h("div", { testid: "venue-calendar" });
  const isWeek = calendar.view === "week";

  const viewButton = (view, text) =>
    h("button", {
      class: "btn sm",
      type: "button",
      testid: `calendar-view-${view}`,
      "aria-pressed": calendar.view === view,
      text,
      onClick: () => onNavigate?.({ view, date: calendar.from }),
    });

  const bar = h(
    "div",
    { class: "row cal-bar" },
    h(
      "div",
      { class: "row" },
      h("button", {
        class: "btn sm",
        type: "button",
        testid: "calendar-prev",
        text: isWeek ? "前一週" : "前一日",
        onClick: () =>
          onNavigate?.({
            view: calendar.view,
            date: addDays(calendar.from, isWeek ? -7 : -1),
          }),
      }),
      h("button", {
        class: "btn sm",
        type: "button",
        testid: "calendar-today",
        text: "今天",
        onClick: () =>
          onNavigate?.({ view: calendar.view, date: calendar.today }),
      }),
      h("button", {
        class: "btn sm",
        type: "button",
        testid: "calendar-next",
        text: isWeek ? "後一週" : "後一日",
        onClick: () =>
          onNavigate?.({
            view: calendar.view,
            date: addDays(calendar.from, isWeek ? 7 : 1),
          }),
      }),
      h("input", {
        class: "cal-date",
        testid: "calendar-date",
        type: "date",
        "aria-label": "日期",
        value: calendar.from,
        onChange: (event) =>
          onNavigate?.({ view: calendar.view, date: event.target.value }),
      }),
    ),
    h(
      "div",
      { class: "row seg" },
      viewButton("day", "日"),
      viewButton("week", "週"),
    ),
  );

  const legend = h(
    "div",
    { class: "cal-legend", "aria-hidden": "true" },
    h("span", { class: "tag", text: "可預約" }),
    h("span", { class: "tag accent", text: "已預約" }),
    h("span", { class: "tag maint", text: "維護中" }),
    h("span", { class: "tag", text: "不開放" }),
  );

  function slotEl(day, slot) {
    const label = STATUS_LABEL[slot.status] ?? slot.status;
    const el = h(
      "div",
      {
        class: `slot ${STATUS_CLASS[slot.status] ?? slot.status}`,
        role: "group",
        "aria-label": `${calendar.venue.name}，${day.date}，${slot.startTime}–${slot.endTime}，${label}`,
      },
      h("span", { text: isWeek ? `${slot.startTime} ${label}` : label }),
    );
    const target = {
      venueId: calendar.venue.id,
      date: day.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
    };
    if (slot.status === "available") {
      el.append(
        h("button", {
          type: "button",
          testid: "calendar-slot-book",
          text: "預約此時段",
          onClick: () => onBook?.(target),
        }),
      );
    }
    if (slot.status === "booked") {
      el.append(
        h("button", {
          type: "button",
          testid: "calendar-slot-waitlist",
          text: "登記候補",
          onClick: () => onWaitlist?.(target),
        }),
      );
    }
    return el;
  }

  const closedBox = () =>
    h("div", {
      class: "state-box",
      testid: "venue-calendar-empty",
      text: "這一天不開放預約。請改看其他日期。",
    });

  let body;
  if (!isWeek) {
    const day = calendar.days[0];
    if (!day || day.openRanges.length === 0) {
      body = closedBox();
    } else {
      body = h("div", { class: "day-grid" });
      for (const slot of openSlots(day)) {
        body.append(
          h(
            "div",
            { class: "day-row" },
            h("span", { text: slot.startTime }),
            slotEl(day, slot),
          ),
        );
      }
    }
  } else if (calendar.days.every((day) => day.openRanges.length === 0)) {
    body = closedBox();
  } else {
    body = h("div", { class: "week-grid" });
    for (const day of calendar.days) {
      const slots = h("div", { class: "slots" });
      if (day.openRanges.length === 0) {
        slots.append(h("div", { class: "slot closed", text: "不開放" }));
      }
      for (const slot of openSlots(day)) {
        slots.append(slotEl(day, slot));
      }
      body.append(
        h(
          "div",
          { class: "week-day" },
          h("h3", { text: shortDate(day.date) }),
          slots,
        ),
      );
    }
  }

  root.append(
    bar,
    h("h2", {
      class: "cal-title",
      text: isWeek
        ? `${formatDate(calendar.from)} 起的一週`
        : formatDate(calendar.from),
    }),
    legend,
    h("div", { testid: "calendar-region" }, body),
  );
  container.replaceChildren(root);
  return root;
}

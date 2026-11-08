import { del, get, put } from "../api/client.js";
import { FAVORITE_TEXT } from "../../../shared/src/copy.js";
import { renderCalendar } from "../components/calendar.js";
import { mountPage } from "../components/nav.js";
import { openWaitlistDialog } from "../components/waitlistDialog.js";
import { showToast } from "../components/toast.js";
import { h } from "../lib/h.js";
import { endTimeOptions, startTimeOptions } from "../lib/time.js";

// 收藏按鈕（UI-01）：本人已收藏時顯示「已收藏」標記與「取消收藏」；
// 處理中停用按鈕；場地已停用被拒絕時標示「已停用」並停用「加入收藏」。
function favoriteControl(venue, testid) {
  const state = {
    isFavorite: venue.isFavorite === true,
    busy: false,
    disabled: false,
  };
  const row = h("div", { class: "favorite-row" });
  const mark = h("span", {
    class: "tag accent",
    testid: "venue-favorite-mark",
    text: FAVORITE_TEXT.favoriteMark,
  });
  const disabledTag = h("span", {
    class: "tag danger",
    testid: "venue-favorite-disabled-tag",
    text: FAVORITE_TEXT.disabledTag,
  });
  const toggle = h("button", {
    class: "btn sm favorite-toggle",
    type: "button",
    testid,
  });

  function paint() {
    toggle.textContent = state.busy
      ? FAVORITE_TEXT.pending
      : state.isFavorite
        ? FAVORITE_TEXT.removeButton
        : FAVORITE_TEXT.addButton;
    toggle.setAttribute("aria-pressed", String(state.isFavorite));
    toggle.setAttribute(
      "aria-label",
      state.isFavorite
        ? FAVORITE_TEXT.removeLabel(venue.name)
        : FAVORITE_TEXT.addLabel(venue.name),
    );
    if (state.busy) {
      toggle.setAttribute("aria-busy", "true");
    } else {
      toggle.removeAttribute("aria-busy");
    }
    toggle.disabled = state.busy || (state.disabled && !state.isFavorite);
    mark.hidden = !state.isFavorite;
    disabledTag.hidden = !state.disabled;
  }

  async function act() {
    const wasFavorite = state.isFavorite;
    state.busy = true;
    paint();
    try {
      const path = `/api/venues/${venue.id}/favorite`;
      const result = wasFavorite ? await del(path) : await put(path);
      state.isFavorite = result.isFavorite === true;
      showToast(
        state.isFavorite
          ? FAVORITE_TEXT.addedToast
          : FAVORITE_TEXT.removedToast,
      );
    } catch (error) {
      if (
        error?.status === 409 &&
        error.violations?.some((item) => item.rule === "venue_inactive")
      ) {
        state.disabled = true;
        showToast(FAVORITE_TEXT.disabledRejected, "error");
      } else {
        showToast(
          wasFavorite ? FAVORITE_TEXT.removeFailed : FAVORITE_TEXT.addFailed,
          "error",
        );
      }
    } finally {
      state.busy = false;
      paint();
    }
  }

  toggle.addEventListener("click", () => {
    if (!state.busy) {
      void act();
    }
  });
  paint();
  row.append(mark, disabledTag, toggle);
  return row;
}

function timeToMinute(time) {
  if (!time) {
    return 0;
  }
  if (time === "24:00") {
    return 1440;
  }
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export async function render(container, params = {}) {
  if (params.venueId) {
    await renderCalendarPage(container, params);
    return;
  }
  const root = h("div", { testid: "venue-search" });
  mountPage(container, "#/venues", root);
  root.append(h("h1", { text: "場地" }));
  const date = h("input", {
    testid: "venue-filter-date",
    type: "date",
    value: params.date ?? "",
  });
  const start = h(
    "select",
    { testid: "venue-filter-start" },
    h("option", { value: "", text: "不限" }),
  );
  for (const option of startTimeOptions()) {
    start.append(
      h("option", {
        value: option,
        text: option,
        selected: option === (params.startTime ?? ""),
      }),
    );
  }
  const end = h(
    "select",
    { testid: "venue-filter-end" },
    h("option", { value: "", text: "不限" }),
  );
  for (const option of endTimeOptions()) {
    end.append(
      h("option", {
        value: option,
        text: option,
        selected: option === (params.endTime ?? ""),
      }),
    );
  }
  const capacity = h("input", {
    testid: "venue-filter-capacity",
    type: "number",
    min: "1",
    inputmode: "numeric",
    value: params.capacity ?? "",
  });
  const eqWrap = h("div", {
    class: "checks",
    testid: "venue-filter-equipment",
    role: "group",
    "aria-label": "設備",
  });
  const endErr = h("div", { class: "err", testid: "venue-filter-end-error" });
  const capErr = h("div", {
    class: "err",
    testid: "venue-filter-capacity-error",
  });
  const form = h(
    "form",
    { class: "card", novalidate: true },
    h("h2", { text: "找場地" }),
    h(
      "div",
      { class: "grid2" },
      h("div", { class: "field" }, h("label", { text: "日期" }, date)),
      h("div", { class: "field" }, h("label", { text: "開始時間" }, start)),
      h(
        "div",
        { class: "field" },
        h("label", { text: "結束時間" }, end),
        h("div", { class: "hint", text: "時間以台北時間（UTC+8）顯示" }),
        endErr,
      ),
      h(
        "div",
        { class: "field" },
        h("label", { text: "人數" }, capacity),
        capErr,
      ),
    ),
    h(
      "div",
      { class: "field" },
      h("span", { class: "lbl", text: "設備" }),
      eqWrap,
    ),
    h(
      "div",
      { class: "row" },
      h("button", {
        class: "btn primary",
        type: "submit",
        testid: "venue-filter-submit",
        text: "搜尋",
      }),
      h("button", {
        class: "btn",
        type: "button",
        testid: "venue-filter-reset",
        text: "清除條件",
        onClick: () => {
          location.hash = "#/venues";
        },
      }),
    ),
  );
  const out = h("div", { testid: "venue-list-region", "aria-live": "polite" });
  root.append(form, out);

  async function load(equipmentOptions = []) {
    eqWrap.replaceChildren();
    const chosen = new Set(
      Array.isArray(params.equipment)
        ? params.equipment
        : String(params.equipment ?? "")
            .split(",")
            .filter(Boolean),
    );
    for (const item of equipmentOptions) {
      eqWrap.append(
        h(
          "label",
          {},
          h("input", {
            type: "checkbox",
            value: item,
            checked: chosen.has(item),
          }),
          item,
        ),
      );
    }
    out.replaceChildren(
      h("div", { class: "skel skel-item", testid: "venue-search-loading" }),
    );
    out.setAttribute("aria-busy", "true");
    const query = new URLSearchParams();
    if (date.value) query.set("date", date.value);
    if (start.value) query.set("startTime", start.value);
    if (end.value) query.set("endTime", end.value);
    if (capacity.value) query.set("capacity", capacity.value);
    for (const input of eqWrap.querySelectorAll("input:checked")) {
      query.append("equipment", input.value);
    }
    try {
      const data = await get(
        `/api/venues${query.toString() ? `?${query}` : ""}`,
      );
      if (equipmentOptions.length === 0 && data.equipmentOptions?.length) {
        await load(data.equipmentOptions);
        return;
      }
      draw(
        data.items ?? [],
        Boolean(
          date.value ||
          start.value ||
          capacity.value ||
          eqWrap.querySelector("input:checked"),
        ),
      );
    } catch {
      out.removeAttribute("aria-busy");
      out.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "venue-search-error" },
          h("p", { text: "無法載入場地資料。請稍後按「重新載入」再試一次。" }),
          h("button", {
            class: "btn",
            type: "button",
            text: "重新載入",
            onClick: () => load(equipmentOptions),
          }),
        ),
      );
    }
  }

  function draw(items, filtered) {
    out.removeAttribute("aria-busy");
    if (!items.length) {
      out.replaceChildren(
        h(
          "div",
          { class: "state-box", testid: "venue-search-empty" },
          h("p", {
            text: filtered
              ? "沒有符合條件的場地"
              : "目前沒有可預約的場地。請洽管理員。",
          }),
          filtered
            ? h("p", { text: "請調整日期、時段、人數或設備後再搜尋。" })
            : null,
          filtered
            ? h("button", {
                class: "btn",
                type: "button",
                text: "清除條件",
                onClick: () => {
                  location.hash = "#/venues";
                },
              })
            : null,
        ),
      );
      return;
    }
    const list = h("ul", { class: "list", testid: "venue-list" });
    for (const venue of items) {
      const query = date.value ? `?date=${date.value}` : "";
      list.append(
        h(
          "li",
          {
            class: "item",
            testid: "venue-list-item",
            "data-id": String(venue.id),
          },
          h(
            "div",
            { class: "top" },
            h("span", { class: "title", text: venue.name }),
            venue.requiresApproval
              ? h("span", { class: "tag warn", text: "需要審核" })
              : null,
          ),
          h("div", {
            class: "meta",
            text: `${venue.location}｜可容納 ${venue.capacity} 人`,
          }),
          h("div", {
            class: "meta",
            text: `設備：${(venue.equipment ?? []).join("、") || "無"}`,
          }),
          "isFavorite" in venue
            ? favoriteControl(venue, "venue-favorite-toggle")
            : null,
          h("a", {
            class: "btn sm",
            href: `#/venues/${venue.id}${query}`,
            testid: "venue-open-calendar",
            text: "查看行事曆",
          }),
        ),
      );
    }
    out.replaceChildren(list);
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    endErr.textContent = "";
    capErr.textContent = "";
    if (
      (start.value || end.value) &&
      start.value &&
      end.value &&
      timeToMinute(end.value) <= timeToMinute(start.value)
    ) {
      endErr.textContent = "時段不正確：結束時間須晚於開始時間。請重新選擇。";
      return;
    }
    if (capacity.value && !(Number.parseInt(capacity.value, 10) >= 1)) {
      capErr.textContent = "人數須為 1 以上的整數。請重新輸入。";
      return;
    }
    void load(
      [...eqWrap.querySelectorAll("input")].map((input) => input.value),
    );
  });

  await load();
}

async function renderCalendarPage(container, params) {
  const root = h("div", { testid: "venue-calendar-page" });
  mountPage(container, "#/venues", root);
  const title = h("h1", { text: "場地" });
  root.append(
    title,
    h("a", {
      class: "btn",
      href: "#/venues",
      testid: "calendar-back",
      text: "返回場地列表",
    }),
  );
  const favSlot = h("div");
  const region = h("div");
  root.append(favSlot, region);

  async function load({ view = "day", date } = {}) {
    region.replaceChildren(
      h("div", { class: "skel skel-item", testid: "venue-calendar-loading" }),
    );
    try {
      const query = new URLSearchParams({ view });
      if (date) query.set("date", date);
      const calendar = await get(
        `/api/venues/${params.venueId}/calendar?${query}`,
      );
      title.textContent = `${calendar.venue.name}（${calendar.venue.location}）`;
      favSlot.replaceChildren(
        "isFavorite" in calendar.venue
          ? favoriteControl(calendar.venue, "calendar-favorite-toggle")
          : h("span"),
      );
      renderCalendar(region, calendar, {
        onBook: ({ venueId, date: slotDate, startTime, endTime }) => {
          location.hash = `#/bookings/new?venueId=${venueId}&date=${slotDate}&startTime=${startTime}&endTime=${endTime}`;
        },
        onWaitlist: (slot) => {
          void openWaitlistDialog(slot);
        },
        onNavigate: (next) => load(next),
      });
    } catch {
      region.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "venue-calendar-error" },
          h("p", { text: "無法載入場地資料。請稍後按「重新載入」再試一次。" }),
          h("button", {
            class: "btn",
            type: "button",
            text: "重新載入",
            onClick: () => load({ view, date }),
          }),
        ),
      );
    }
  }

  await load({ date: params.date, view: params.view ?? "day" });
}

import { ALT_TEXT } from "../../../shared/src/copy.js";
import { toTaipeiParts } from "../../../shared/src/taipei.js";
import { h } from "../lib/h.js";

/**
 * 把後端回傳的 UTC 起訖換算成台北日期與時分（C-SH-02）。
 * 結束落在台北隔日 00:00 時顯示為 24:00。
 */
export function toPickedSlot(startAt, endAt) {
  const start = toTaipeiParts(new Date(startAt));
  const end = toTaipeiParts(new Date(endAt));
  const endTime =
    end.time === "00:00" && end.date !== start.date ? "24:00" : end.time;
  return {
    date: start.date,
    startTime: start.time,
    endTime,
    range: `${start.time}–${endTime}`,
  };
}

/**
 * 同場地空檔建議區塊（UI-01）。before／after 為 null 時不渲染該按鈕；
 * 兩者皆無時顯示「當天已無空檔」。點選只呼叫 onPick，不送出。
 */
export function renderSlotSuggestions(suggestions, { onPick }) {
  const section = h(
    "section",
    {
      class: "alt-section",
      testid: "alt-slots",
      "aria-labelledby": "alt-slots-title",
    },
    h("h3", { id: "alt-slots-title", text: ALT_TEXT.slotsTitle }),
    h("p", { class: "hint", text: ALT_TEXT.slotsDescription }),
  );
  if (suggestions.noSlotsToday) {
    section.append(
      h("p", {
        class: "alt-empty",
        testid: "alt-slots-empty",
        text: ALT_TEXT.noSlotsToday,
      }),
    );
    return section;
  }
  const buttons = h("div", { class: "alt-buttons" });
  const directions = [
    ["before", ALT_TEXT.directionBefore, "alt-slot-before"],
    ["after", ALT_TEXT.directionAfter, "alt-slot-after"],
  ];
  for (const [key, label, testid] of directions) {
    const item = suggestions.slots?.[key];
    if (!item) {
      continue;
    }
    const picked = toPickedSlot(item.startAt, item.endAt);
    buttons.append(
      h(
        "button",
        {
          class: "alt-button",
          type: "button",
          testid,
          "aria-label": ALT_TEXT.slotButtonLabel(
            label,
            picked.date,
            picked.range,
          ),
          onClick: () =>
            onPick({
              date: picked.date,
              startTime: picked.startTime,
              endTime: picked.endTime,
            }),
        },
        h("span", { text: picked.range }),
        h("span", { class: "alt-dir", text: label }),
      ),
    );
  }
  section.append(buttons);
  return section;
}

/**
 * 同時段其他可用場地區塊（UI-02）。順序與數量完全依後端結果；
 * 需審核者帶「需審核」文字標籤。點選只呼叫 onPick，不送出。
 * 沒有場地時顯示「此時段沒有其他可用場地」。
 */
export function renderVenueSuggestions(venues, { onPick }) {
  const section = h(
    "section",
    {
      class: "alt-section",
      testid: "alt-venues",
      "aria-labelledby": "alt-venues-title",
    },
    h("h3", { id: "alt-venues-title", text: ALT_TEXT.venuesTitle }),
    h("p", { class: "hint", text: ALT_TEXT.venuesDescription }),
  );
  if (!venues.length) {
    section.append(
      h("p", {
        class: "alt-venues-empty",
        testid: "alt-venues-empty",
        text: ALT_TEXT.noVenues,
      }),
    );
    return section;
  }
  const buttons = h("div", { class: "alt-buttons" });
  for (const venue of venues) {
    const approvalNote = venue.requiresApproval
      ? `，${ALT_TEXT.approvalTag}`
      : "";
    const children = [
      h("span", {
        text: ALT_TEXT.venueButtonText(venue.name, venue.capacity),
      }),
    ];
    if (venue.requiresApproval) {
      children.push(
        h("span", {
          class: "alt-venue-approval",
          testid: "alt-venue-approval",
          text: ALT_TEXT.approvalTag,
        }),
      );
    }
    buttons.append(
      h(
        "button",
        {
          class: "alt-button",
          type: "button",
          testid: "alt-venue-option",
          "data-id": String(venue.venueId),
          "aria-label": ALT_TEXT.venueButtonLabel(
            venue.name,
            venue.capacity,
            approvalNote,
          ),
          onClick: () => onPick(venue),
        },
        ...children,
      ),
    );
  }
  section.append(buttons);
  if (venues.some((venue) => venue.requiresApproval)) {
    section.append(
      h("p", {
        class: "alt-venues-note",
        text: ALT_TEXT.approvalDescription,
      }),
    );
  }
  return section;
}

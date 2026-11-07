import { del, get, post, put } from "../api/client.js";
import { openDialog } from "../components/dialog.js";
import { confirmImpact } from "../components/impactDialog.js";
import { mountPage, renderForbidden } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { h } from "../lib/h.js";
import { endTimeOptions, formatRange, startTimeOptions } from "../lib/time.js";
import { toTaipeiParts } from "../../../shared/src/taipei.js";
import { currentUser } from "../router.js";

const WEEKDAYS = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function parseEquipment(value) {
  return String(value)
    .split(/[,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function fieldError(el, message) {
  const box = el.closest(".field")?.querySelector(".err");
  if (box) {
    box.textContent = message ?? "";
    box.hidden = !message;
  }
}

function timeToMinute(time) {
  if (time === "24:00") {
    return 1440;
  }
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
}

export async function render(container) {
  if (!currentUser?.roles?.includes("admin")) {
    renderForbidden(container);
    return;
  }
  const root = h("div", { testid: "admin-venues" });
  mountPage(container, "#/admin/venues", root);
  root.append(
    h(
      "div",
      { class: "row", style: "justify-content:space-between" },
      h("h1", { text: "場地管理" }),
      h("button", {
        class: "btn primary",
        type: "button",
        testid: "venue-add",
        text: "新增場地",
        onClick: () => openForm(null),
      }),
    ),
  );
  const out = h("div");
  const msec = h("section", {
    testid: "maintenance-section",
    style: "margin-top:24px",
  });
  root.append(out, msec);
  let venues = [];
  let reviewers = [];
  let selectedId = null;

  async function load() {
    out.replaceChildren(
      h("div", { class: "skel skel-item", testid: "admin-venues-loading" }),
    );
    out.setAttribute("aria-busy", "true");
    try {
      const [venueData, userData] = await Promise.all([
        get("/api/admin/venues"),
        get("/api/users"),
      ]);
      venues = venueData.items ?? [];
      reviewers = (userData.items ?? []).filter(
        (user) => user.active && user.roles?.includes("reviewer"),
      );
      draw();
    } catch {
      out.removeAttribute("aria-busy");
      out.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "admin-venues-error" },
          h("p", { text: "無法載入場地資料。請稍後按「重新載入」再試一次。" }),
          h("button", {
            class: "btn",
            type: "button",
            text: "重新載入",
            onClick: load,
          }),
        ),
      );
    }
  }

  function draw() {
    out.removeAttribute("aria-busy");
    if (!venues.length) {
      out.replaceChildren(
        h(
          "div",
          { class: "state-box", testid: "admin-venues-empty" },
          h("p", { text: "還沒有場地" }),
          h("button", {
            class: "btn primary",
            type: "button",
            text: "新增場地",
            onClick: () => openForm(null),
          }),
        ),
      );
      return;
    }
    const table = h("table", { class: "tbl", testid: "admin-venues-list" });
    table.append(
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          ...["名稱", "地點", "容納人數", "設備", "審核", "狀態", "操作"].map(
            (label) => h("th", { text: label }),
          ),
        ),
      ),
    );
    const tbody = h("tbody");
    for (const venue of venues) {
      let reviewCell;
      if (!venue.requiresApproval) {
        reviewCell = h("span", { text: "不需審核" });
      } else if (venue.reviewers?.length) {
        reviewCell = h(
          "span",
          {},
          h("span", { class: "tag warn", text: "需要審核" }),
          ` ${venue.reviewers.map((item) => item.name).join("、")}`,
        );
      } else {
        reviewCell = h(
          "span",
          {},
          h("span", { class: "tag warn", text: "需要審核" }),
          " ",
          h("span", { class: "err", text: "尚未指派審核者" }),
        );
      }
      tbody.append(
        h(
          "tr",
          {
            testid: "admin-venues-item",
            "data-id": String(venue.id),
            style: venue.active ? "" : "opacity:.65",
          },
          h("td", { "data-label": "名稱" }, h("strong", { text: venue.name })),
          h("td", { "data-label": "地點", text: venue.location }),
          h("td", { "data-label": "容納人數", text: String(venue.capacity) }),
          h("td", {
            "data-label": "設備",
            text: (venue.equipment ?? []).join("、"),
          }),
          h("td", { "data-label": "審核" }, reviewCell),
          h(
            "td",
            { "data-label": "狀態" },
            h("span", {
              class: `tag ${venue.active ? "ok" : "danger"}`,
              text: venue.active ? "啟用中" : "已停用",
            }),
          ),
          h(
            "td",
            { "data-label": "操作" },
            h(
              "div",
              { class: "row" },
              h("button", {
                class: "btn sm",
                type: "button",
                testid: "venue-edit",
                text: "編輯",
                onClick: () => openForm(venue),
              }),
              h("button", {
                class: "btn sm",
                type: "button",
                text: "維護時段",
                onClick: () => {
                  selectedId = venue.id;
                  void drawMaint();
                  msec.scrollIntoView();
                },
              }),
              venue.active
                ? h("button", {
                    class: "btn sm",
                    type: "button",
                    testid: "venue-disable-button",
                    text: "停用",
                    onClick: () => disableVenue(venue),
                  })
                : h("button", {
                    class: "btn sm",
                    type: "button",
                    testid: "venue-enable-button",
                    text: "重新啟用",
                    onClick: () => enableVenue(venue),
                  }),
            ),
          ),
        ),
      );
    }
    table.append(tbody);
    out.replaceChildren(table);
    void drawMaint();
  }

  async function disableVenue(venue) {
    const preview = await get(
      `/api/admin/venues/${venue.id}/deactivation-impact`,
    );
    const result = await confirmImpact({
      title: `停用 ${venue.name}`,
      testid: "venue-impact-dialog",
      intro: (n, w) =>
        `停用後，以下 ${n} 筆未來預約會被取消，${w} 筆候補會失效，預約者與候補者會收到通知。`,
      preview,
      confirmLabel: "確認停用並取消預約",
      cancelLabel: "先不要停用",
      submit: (bookingIds) =>
        post(`/api/admin/venues/${venue.id}/deactivate`, { bookingIds }),
    });
    if (result) {
      showToast(
        `場地已停用，已取消 ${result.cancelledBookingCount} 筆預約，${result.expiredWaitlistCount} 筆候補已失效。`,
      );
      await load();
    }
  }

  async function enableVenue(venue) {
    const ok = await openDialog({
      title: `重新啟用 ${venue.name}`,
      body: "重新啟用後場地會再出現在查詢結果，先前被取消的預約不會恢復。",
      actions: [
        {
          label: "先不要啟用",
          value: null,
          testid: "venue-enable-dialog-cancel",
        },
        {
          label: "重新啟用",
          value: "ok",
          kind: "primary",
          testid: "venue-enable-dialog-confirm",
        },
      ],
    });
    if (ok !== "ok") return;
    await post(`/api/admin/venues/${venue.id}/enable`);
    showToast("場地已重新啟用。");
    await load();
  }

  async function drawMaint() {
    msec.replaceChildren();
    const venue = venues.find((item) => Number(item.id) === Number(selectedId));
    if (!venue) {
      msec.append(
        h("p", {
          class: "lead",
          text: "在上方清單選擇「維護時段」，即可管理該場地的維護時段。",
        }),
      );
      return;
    }
    msec.append(
      h(
        "div",
        { class: "row", style: "justify-content:space-between" },
        h("h2", { style: "margin:0", text: `${venue.name}的維護時段` }),
        h("button", {
          class: "btn primary",
          type: "button",
          testid: "maintenance-add",
          text: "新增維護時段",
          onClick: () => openMaint(venue, null),
        }),
      ),
    );
    const data = await get(`/api/admin/venues/${venue.id}/maintenance-windows`);
    const list = data.items ?? [];
    if (!list.length) {
      msec.append(
        h(
          "div",
          { style: "margin-top:10px" },
          h("div", { class: "state-box", text: "目前沒有維護時段。" }),
        ),
      );
      return;
    }
    const ul = h("ul", {
      class: "list",
      testid: "maintenance-list",
      style: "margin-top:10px",
    });
    for (const window of list) {
      ul.append(
        h(
          "li",
          { class: "item", "data-id": String(window.id) },
          h("div", {
            class: "title",
            text: formatRange(window.startAt, window.endAt),
          }),
          h(
            "div",
            { class: "row" },
            h("button", {
              class: "btn sm",
              type: "button",
              testid: "maintenance-edit",
              text: "編輯",
              onClick: () => openMaint(venue, window),
            }),
            h("button", {
              class: "btn sm",
              type: "button",
              testid: "maintenance-delete",
              text: "刪除",
              onClick: async () => {
                const ok = await openDialog({
                  title: "刪除維護時段",
                  body: "要刪除這個維護時段嗎？刪除後該時段會恢復為可預約。",
                  actions: [
                    {
                      label: "先不要刪除",
                      value: null,
                      testid: "maintenance-delete-dialog-cancel",
                    },
                    {
                      label: "確定刪除",
                      value: "ok",
                      kind: "danger",
                      testid: "maintenance-delete-dialog-confirm",
                    },
                  ],
                });
                if (ok !== "ok") return;
                await del(
                  `/api/admin/venues/${venue.id}/maintenance-windows/${window.id}`,
                  {},
                );
                showToast("維護時段已刪除。");
                await drawMaint();
              },
            }),
          ),
        ),
      );
    }
    msec.append(ul);
  }

  async function openMaint(venue, window) {
    const startDate = h("input", {
      testid: "maintenance-start-date",
      type: "date",
    });
    const startTime = h("select", { testid: "maintenance-start-time" });
    for (const option of startTimeOptions())
      startTime.append(h("option", { value: option, text: option }));
    const endDate = h("input", {
      testid: "maintenance-end-date",
      type: "date",
    });
    const endTime = h("select", { testid: "maintenance-end-time" });
    for (const option of endTimeOptions())
      endTime.append(h("option", { value: option, text: option }));
    if (window) {
      const start = toTaipeiParts(new Date(window.startAt));
      const end = toTaipeiParts(new Date(window.endAt));
      startDate.value = start.date;
      endDate.value =
        end.date === start.date && end.time === "00:00" ? start.date : end.date;
      startTime.value = start.time;
      endTime.value =
        end.time === "00:00" && end.date !== start.date ? "24:00" : end.time;
    }
    const err = h("div", {
      class: "err",
      testid: "maintenance-error",
      role: "alert",
      hidden: true,
    });
    const body = h(
      "form",
      { novalidate: true, testid: "maintenance-form-dialog" },
      h("div", { class: "field" }, h("label", { text: "開始日期" }, startDate)),
      h("div", { class: "field" }, h("label", { text: "開始時間" }, startTime)),
      h("div", { class: "field" }, h("label", { text: "結束日期" }, endDate)),
      h("div", { class: "field" }, h("label", { text: "結束時間" }, endTime)),
      err,
    );
    const result = await openDialog({
      title: window ? "編輯維護時段" : "新增維護時段",
      body,
      actions: [
        {
          label: "取消",
          value: null,
          testid: "maintenance-form-dialog-cancel",
        },
        {
          label: "儲存",
          value: "save",
          kind: "primary",
          testid: "maintenance-save",
        },
      ],
    });
    if (result !== "save") return;
    const input = {
      startDate: startDate.value,
      startTime: startTime.value,
      endDate: endDate.value,
      endTime: endTime.value,
    };
    try {
      const preview = await post(
        `/api/admin/venues/${venue.id}/maintenance-windows/impact`,
        input,
      );
      const saved = await confirmImpact({
        title: `${venue.name} 維護時段`,
        testid: "maintenance-impact-dialog",
        intro: (n) =>
          `設定後，以下 ${n} 筆未來預約會被取消，預約者會收到通知。`,
        preview,
        confirmLabel: "確認並取消預約",
        cancelLabel: "先不要設定",
        submit: (bookingIds) =>
          window
            ? put(
                `/api/admin/venues/${venue.id}/maintenance-windows/${window.id}`,
                { ...input, bookingIds },
              )
            : post(`/api/admin/venues/${venue.id}/maintenance-windows`, {
                ...input,
                bookingIds,
              }),
      });
      if (saved) {
        showToast("維護時段已儲存。");
        await drawMaint();
      }
    } catch (error) {
      err.hidden = false;
      err.textContent =
        error.message ?? "時間不正確：結束須晚於開始，且以 30 分鐘為單位。";
      showToast(error.message ?? "無法儲存維護時段。", "error");
    }
  }

  function select(options, value, ariaLabel) {
    const el = h("select", { "aria-label": ariaLabel });
    for (const option of options) {
      el.append(
        h("option", {
          value: option,
          text: option,
          selected: option === value,
        }),
      );
    }
    el.value = value;
    return el;
  }

  async function openForm(venue) {
    const name = h("input", {
      testid: "venue-name",
      type: "text",
      value: venue?.name ?? "",
    });
    const location = h("input", {
      testid: "venue-location",
      type: "text",
      value: venue?.location ?? "",
    });
    const capacity = h("input", {
      testid: "venue-capacity",
      type: "number",
      min: "1",
      inputmode: "numeric",
      value: venue ? String(venue.capacity) : "",
    });
    const equipment = h("input", {
      testid: "venue-equipment",
      type: "text",
      value: (venue?.equipment ?? []).join("，"),
    });
    const requires = h("input", {
      testid: "venue-requires-approval",
      type: "checkbox",
      checked: Boolean(venue?.requiresApproval),
      id: "req-ap",
    });
    const reviewerWrap = h("div", {
      class: "checks",
      testid: "venue-reviewers",
      role: "group",
      "aria-label": "審核者",
    });
    for (const user of reviewers) {
      const checked = Boolean(
        venue?.reviewers?.some((item) => Number(item.id) === Number(user.id)),
      );
      reviewerWrap.append(
        h(
          "label",
          {},
          h("input", { type: "checkbox", value: String(user.id), checked }),
          `${user.name}（${user.email}）`,
        ),
      );
    }
    const reviewerErr = h("div", {
      class: "err",
      testid: "venue-reviewers-error",
      role: "alert",
      hidden: true,
    });
    const hours = venue?.openingHours?.length
      ? venue.openingHours.map((hour) => ({
          weekday: hour.weekday,
          startTime: hour.startTime,
          endTime: hour.endTime,
        }))
      : WEEKDAY_ORDER.filter((day) => day !== 0).map((weekday) => ({
          weekday,
          startTime: "09:00",
          endTime: "18:00",
        }));
    const hoursWrap = h("div", { testid: "venue-hours" });
    const hoursErr = h("div", {
      class: "err",
      testid: "venue-hours-error",
      role: "alert",
      hidden: true,
    });

    function drawHours() {
      hoursWrap.replaceChildren();
      for (const weekday of WEEKDAY_ORDER) {
        const row = h(
          "div",
          { style: "margin-bottom:8px" },
          h("strong", { text: WEEKDAYS[weekday] }),
          " ",
        );
        hours.forEach((hour, index) => {
          if (hour.weekday !== weekday) {
            return;
          }
          const start = select(
            startTimeOptions(),
            hour.startTime,
            `${WEEKDAYS[weekday]}開始`,
          );
          const end = select(
            endTimeOptions(),
            hour.endTime,
            `${WEEKDAYS[weekday]}結束`,
          );
          start.addEventListener("change", () => {
            hour.startTime = start.value;
          });
          end.addEventListener("change", () => {
            hour.endTime = end.value;
          });
          row.append(
            h(
              "span",
              {
                style:
                  "display:inline-flex;gap:4px;align-items:center;margin:2px 6px 2px 0",
              },
              start,
              "–",
              end,
              h("button", {
                class: "btn sm",
                type: "button",
                testid: "venue-hours-remove",
                text: "移除時段",
                onClick: () => {
                  hours.splice(index, 1);
                  drawHours();
                },
              }),
            ),
          );
        });
        row.append(
          h("button", {
            class: "btn sm",
            type: "button",
            testid: "venue-hours-add",
            text: "新增時段",
            onClick: () => {
              hours.push({ weekday, startTime: "09:00", endTime: "18:00" });
              drawHours();
            },
          }),
        );
        hoursWrap.append(row);
      }
    }
    drawHours();

    const form = h(
      "form",
      { novalidate: true, testid: "venue-form-dialog" },
      venue
        ? h("p", {
            class: "hint",
            text: "修改只適用於之後的新預約，不會改變既有預約。",
          })
        : null,
      h(
        "div",
        { class: "field" },
        h("label", { text: "名稱" }, name),
        h("div", { class: "err", testid: "venue-name-error", role: "alert" }),
      ),
      h("div", { class: "field" }, h("label", { text: "地點" }, location)),
      h(
        "div",
        { class: "field" },
        h("label", { text: "容納人數" }, capacity),
        h("div", {
          class: "err",
          testid: "venue-capacity-error",
          role: "alert",
        }),
      ),
      h(
        "div",
        { class: "field" },
        h("label", { text: "設備" }, equipment),
        h("div", { class: "hint", text: "多個設備請用逗號分隔。" }),
      ),
      h(
        "div",
        { class: "field" },
        h(
          "label",
          {
            class: "checks",
            style:
              "display:inline-flex;gap:8px;align-items:center;min-height:44px",
          },
          requires,
          "需要審核",
        ),
      ),
      h(
        "div",
        { class: "field" },
        h("span", { class: "lbl", text: "審核者" }),
        reviewerWrap,
        reviewerErr,
      ),
      h(
        "div",
        { class: "field" },
        h("span", { class: "lbl", text: "開放時段" }),
        h("span", {
          class: "hint",
          text: "依星期設定，時間以 30 分鐘為單位；每個星期可新增多段。",
        }),
        hoursWrap,
        hoursErr,
      ),
    );

    const result = await openDialog({
      title: venue ? "編輯場地" : "新增場地",
      body: form,
      actions: [
        { label: "取消", value: null, testid: "venue-form-dialog-cancel" },
        { label: "儲存", value: "save", kind: "primary", testid: "venue-save" },
      ],
    });
    if (result !== "save") {
      return;
    }
    fieldError(name, "");
    fieldError(capacity, "");
    hoursErr.hidden = true;
    hoursErr.textContent = "";
    reviewerErr.hidden = true;
    reviewerErr.textContent = "";
    let ok = true;
    const trimmed = name.value.trim();
    if (!trimmed) {
      fieldError(name, "請輸入場地名稱。");
      ok = false;
    }
    const cap = Number.parseInt(capacity.value, 10);
    if (!(cap >= 1)) {
      fieldError(capacity, "容納人數須為 1 以上的整數。請重新輸入。");
      ok = false;
    }
    const badHours = hours.some(
      (hour) => timeToMinute(hour.endTime) <= timeToMinute(hour.startTime),
    );
    if (badHours) {
      hoursErr.hidden = false;
      hoursErr.textContent = "開放時段的結束時間須晚於開始時間。請重新選擇。";
      ok = false;
    }
    const reviewerIds = [...reviewerWrap.querySelectorAll("input:checked")].map(
      (input) => Number(input.value),
    );
    if (requires.checked && !reviewerIds.length) {
      reviewerErr.hidden = false;
      reviewerErr.textContent = "請至少指派一位審核者。";
      ok = false;
    }
    if (!ok) {
      await openForm(venue);
      return;
    }
    const payload = {
      name: trimmed,
      location: location.value.trim(),
      capacity: cap,
      equipment: parseEquipment(equipment.value),
      requiresApproval: requires.checked,
      reviewerIds,
      openingHours: hours.map((hour) => ({
        weekday: hour.weekday,
        startTime: hour.startTime,
        endTime: hour.endTime,
      })),
    };
    try {
      if (venue) {
        await put(`/api/admin/venues/${venue.id}`, payload);
      } else {
        await post("/api/admin/venues", payload);
      }
      showToast("場地已儲存。");
      await load();
    } catch (error) {
      const fields = error.fields ?? [];
      for (const item of fields) {
        if (item.field === "name") fieldError(name, item.message);
        if (item.field === "capacity") fieldError(capacity, item.message);
        if (item.field === "openingHours") {
          hoursErr.hidden = false;
          hoursErr.textContent = item.message;
        }
        if (item.field === "reviewerIds") {
          reviewerErr.hidden = false;
          reviewerErr.textContent = item.message;
        }
      }
      showToast(error.message ?? "無法儲存場地。請稍後再試一次。", "error");
    }
  }

  await load();
}

import {
  ALT_TEXT,
  BOOKING_STATUS_LABELS,
  DEFAULTS_TEXT,
  FAVORITE_TEXT,
  INVITEE_TEXT,
  REBOOK_TEXT,
} from "../../../shared/src/copy.js";

const NETWORK_ERROR = "無法送出預約。請檢查網路連線後再試一次。";
import { formatTaipei } from "../../../shared/src/taipei.js";
import { get, post, put } from "../api/client.js";
import { mountPage } from "../components/nav.js";
import {
  renderSlotSuggestions,
  renderVenueSuggestions,
} from "../components/suggestions.js";
import { showToast } from "../components/toast.js";
import { openWaitlistDialog } from "../components/waitlistDialog.js";
import { h } from "../lib/h.js";
import { endTimeOptions, formatDate, startTimeOptions } from "../lib/time.js";
import { groupVenues } from "../lib/venueGroups.js";
import { deriveEndTime, formatDuration, weekdayOf } from "../lib/defaults.js";
import { parseInviteeEmails } from "../lib/emails.js";

function formatMinutes(minutes) {
  return minutes % 60 === 0 ? `${minutes / 60} 小時` : `${minutes} 分鐘`;
}

function toMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

// 只保留來源場地：啟用中則用列表資料（含容納人數），已停用則以來源預約的名稱顯示。
function rebookVenueChoices(source, venues) {
  const active = venues.find(
    (item) => String(item.id) === String(source.venueId),
  );
  if (active) {
    return [active];
  }
  return [
    {
      id: source.venueId,
      name: source.venueName,
      location: "",
      capacity: null,
      requiresApproval: false,
    },
  ];
}

function rebookRuleMessage(item, ctx, capacity) {
  const entry = REBOOK_TEXT.rules[item.rule];
  if (entry === undefined) {
    return item.message;
  }
  if (typeof entry !== "function") {
    return entry;
  }
  switch (item.rule) {
    case "advance":
      return entry(formatDate(ctx.maxBookableDate));
    case "capacity":
      return entry(capacity ?? "");
    case "duration":
      return entry(formatMinutes(ctx.rules.maxDurationMinutes));
    case "quota":
      return entry(ctx.rules.maxActiveBookings);
    case "suspended":
      return entry(
        formatTaipei(new Date(ctx.suspendedUntil), {
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    default:
      return item.message;
  }
}

function rebookSourceError(error, container, params) {
  if (error.status === 403 || error.status === 404) {
    return h(
      "div",
      {
        class: "state-box error rebook-source-error",
        role: "alert",
        testid: "booking-rebook-source-error",
      },
      h("p", { text: REBOOK_TEXT.sourceNotFound }),
      h("a", {
        class: "btn",
        href: "#/bookings/new",
        testid: "booking-rebook-general-link",
        text: REBOOK_TEXT.generalBookingLink,
      }),
    );
  }
  return h(
    "div",
    { class: "state-box error", role: "alert" },
    h("p", { text: REBOOK_TEXT.sourceLoadError }),
    h("button", {
      class: "btn",
      type: "button",
      testid: "booking-form-reload",
      text: REBOOK_TEXT.reload,
      onClick: () => render(container, params),
    }),
  );
}

function setError(el, message) {
  el.setAttribute("aria-invalid", message ? "true" : "false");
  const box = el.closest(".field")?.querySelector(".err");
  if (box) {
    box.id ||= `err-${el.getAttribute("data-testid")}`;
    box.textContent = message ?? "";
    if (message) {
      el.setAttribute("aria-describedby", box.id);
    } else {
      el.removeAttribute("aria-describedby");
    }
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 005 參與者邀請：預約表單「邀請同事」欄位（ui-contract.md › UI-01）。
// 只負責輸入、貼上拆列與格式提示；帳號是否存在、停用與自己等規則由後端在送出時判定。
function buildInviteeField({ rebook }) {
  const rows = [];
  let seq = 0;
  const rowsEl = h("div", { class: "invitee-rows" });
  const countEl = h("p", {
    class: "hint invitee-count",
    testid: "booking-invitees-count",
    "aria-live": "polite",
  });
  const duplicateEl = h("p", {
    class: "hint",
    testid: "booking-invitees-duplicate",
    role: "status",
    hidden: true,
    text: INVITEE_TEXT.duplicateHint,
  });
  const problemsEl = h("div", {
    class: "invitee-problems",
    testid: "booking-invitees-error",
    role: "alert",
    tabindex: "-1",
    hidden: true,
  });
  const addBtn = h("button", {
    class: "btn sm",
    type: "button",
    testid: "booking-invitee-add",
    text: INVITEE_TEXT.addButton,
    onClick: () => insertRowAt(rows.length, ""),
  });
  const bodyEl = h(
    "div",
    { testid: "booking-invitees" },
    h("p", {
      class: "hint",
      testid: "booking-invitees-hint",
      text: INVITEE_TEXT.fieldHint,
    }),
    rebook
      ? h("p", {
          class: "hint",
          testid: "booking-invitees-rebook-note",
          text: INVITEE_TEXT.rebookNote,
        })
      : null,
    problemsEl,
    rowsEl,
    addBtn,
    countEl,
    duplicateEl,
  );
  const clearedEl = h("p", {
    class: "hint",
    testid: "booking-invitees-cleared",
    role: "status",
    hidden: true,
    text: INVITEE_TEXT.recurringCleared,
  });
  const root = h(
    "div",
    { class: "field invitee-field" },
    h("span", { class: "field-label", text: INVITEE_TEXT.fieldLabel }),
    bodyEl,
    clearedEl,
  );

  function renumber() {
    rows.forEach((row, index) => {
      row.labelText.textContent = INVITEE_TEXT.emailLabel(index + 1);
      row.remove.setAttribute(
        "aria-label",
        INVITEE_TEXT.removeButtonLabel(index + 1),
      );
    });
  }

  function refresh() {
    const seen = new Set();
    let duplicate = false;
    for (const row of rows) {
      const email = row.input.value.trim().toLowerCase();
      if (!email) continue;
      if (seen.has(email)) duplicate = true;
      seen.add(email);
    }
    countEl.textContent = seen.size ? INVITEE_TEXT.countLabel(seen.size) : "";
    duplicateEl.hidden = !duplicate;
  }

  function checkFormat(row) {
    const value = row.input.value.trim();
    const bad = value !== "" && !EMAIL_PATTERN.test(value);
    row.err.hidden = !bad;
    row.err.textContent = bad ? INVITEE_TEXT.formatError : "";
    row.input.setAttribute("aria-invalid", bad ? "true" : "false");
    return !bad;
  }

  function handlePaste(event, row) {
    const text = event.clipboardData?.getData("text") ?? "";
    const emails = parseInviteeEmails(text);
    if (emails.length <= 1 && !/[\s,，;；]/.test(text.trim())) {
      return;
    }
    event.preventDefault();
    const index = rows.indexOf(row);
    row.input.value = emails[0] ?? "";
    emails.slice(1).forEach((email, offset) => {
      insertRowAt(index + 1 + offset, email);
    });
    renumber();
    refresh();
  }

  function createRow(value) {
    seq += 1;
    const errId = `invitee-err-${seq}`;
    const labelText = h("span", { class: "invitee-label-text" });
    const input = h("input", {
      type: "email",
      testid: "booking-invitee-input",
      placeholder: INVITEE_TEXT.emailPlaceholder,
      autocomplete: "off",
      value,
      "aria-describedby": errId,
    });
    const err = h("div", {
      class: "err invitee-error",
      id: errId,
      testid: "booking-invitee-input-error",
      hidden: true,
    });
    const row = { input, err, labelText, remove: null, wrap: null };
    row.remove = h("button", {
      class: "btn sm",
      type: "button",
      testid: "booking-invitee-remove",
      text: INVITEE_TEXT.removeButton,
      onClick: () => removeRow(row),
    });
    input.addEventListener("blur", () => checkFormat(row));
    input.addEventListener("input", () => refresh());
    input.addEventListener("paste", (event) => handlePaste(event, row));
    row.wrap = h(
      "div",
      { class: "invitee-item" },
      h(
        "div",
        { class: "invitee-row" },
        h("label", { class: "invitee-row-label" }, labelText, input),
        row.remove,
      ),
      err,
    );
    return row;
  }

  function insertRowAt(index, value) {
    const row = createRow(value);
    rows.splice(index, 0, row);
    rowsEl.insertBefore(row.wrap, rows[index + 1]?.wrap ?? null);
    renumber();
    refresh();
    return row;
  }

  function removeRow(row) {
    if (rows.length === 1) {
      row.input.value = "";
      row.err.hidden = true;
      refresh();
      return;
    }
    rows.splice(rows.indexOf(row), 1);
    row.wrap.remove();
    renumber();
    refresh();
  }

  function clearProblems() {
    problemsEl.hidden = true;
    problemsEl.replaceChildren();
    for (const row of rows) {
      row.input.setAttribute("aria-invalid", "false");
      row.err.hidden = true;
      row.err.textContent = "";
    }
  }

  function reset() {
    for (const row of rows.splice(0)) row.wrap.remove();
    insertRowAt(0, "");
    clearProblems();
  }

  reset();

  return {
    root,
    emails() {
      const seen = new Set();
      const out = [];
      for (const row of rows) {
        const email = row.input.value.trim().toLowerCase();
        if (email && !seen.has(email)) {
          seen.add(email);
          out.push(email);
        }
      }
      return out;
    },
    validate() {
      let first = null;
      for (const row of rows) {
        if (!checkFormat(row)) first ??= row.input;
      }
      first?.focus();
      return first === null;
    },
    showProblems(problems) {
      problemsEl.replaceChildren(
        h("p", { text: INVITEE_TEXT.problemsTitle }),
        h(
          "ul",
          null,
          problems.map((item) =>
            h("li", {
              testid: "booking-invitees-problem-item",
              text: INVITEE_TEXT.problemItem(
                item.email,
                INVITEE_TEXT.reasonText[item.reason] ?? item.message,
              ),
            }),
          ),
        ),
      );
      problemsEl.hidden = false;
      for (const row of rows) {
        const value = row.input.value.trim().toLowerCase();
        const hit = problems.find((item) => item.email === value);
        row.input.setAttribute("aria-invalid", hit ? "true" : "false");
        row.err.hidden = !hit;
        row.err.textContent = hit
          ? (INVITEE_TEXT.reasonText[hit.reason] ?? hit.message)
          : "";
      }
      problemsEl.focus();
    },
    setRecurring(on) {
      bodyEl.hidden = on;
      clearedEl.hidden = !on;
      if (on) reset();
    },
    setDisabled(on) {
      for (const row of rows) {
        row.input.disabled = on;
        row.remove.disabled = on;
      }
      addBtn.disabled = on;
    },
  };
}

export async function render(container, params = {}) {
  const editId = params.bookingId;
  const fromId = params.from;
  const rebookMode = Boolean(fromId) && !editId;
  const root = h("div", { testid: "booking-form" });
  mountPage(container, "#/bookings", root);
  root.append(
    h("h1", {
      text: editId
        ? "修改預約"
        : rebookMode
          ? REBOOK_TEXT.pageTitle
          : "預約場地",
    }),
  );
  const loadingEl = rebookMode
    ? h("div", {
        class: "skel skel-item",
        testid: "booking-form-loading",
        "aria-busy": "true",
      })
    : null;
  if (loadingEl) {
    root.append(loadingEl);
  }
  let venues = [];
  let ctx = null;
  let existing = null;
  let source = null;
  let sourceError = null;
  try {
    const requests = [
      get("/api/context"),
      get("/api/venues").then((data) => data.items ?? []),
    ];
    if (editId) {
      requests.push(get(`/api/bookings/${editId}`));
    }
    const loaded = await Promise.all(requests);
    ctx = loaded[0];
    venues = loaded[1];
    existing = loaded[2] ?? null;
  } catch {
    loadingEl?.remove();
    root.append(
      h(
        "div",
        { class: "state-box error", testid: "booking-form-error" },
        h("p", { text: "無法載入場地資料。請稍後按「重新載入」再試一次。" }),
        h("button", {
          class: "btn",
          type: "button",
          text: "重新載入",
          onClick: () => render(container, params),
        }),
      ),
    );
    return;
  }
  // 暫停提示由導覽列統一顯示（suspension-banner），表單頁不另外渲染。
  if (rebookMode) {
    try {
      source = await get(`/api/bookings/${fromId}`);
    } catch (error) {
      sourceError = error;
    }
    loadingEl?.remove();
    if (sourceError) {
      root.append(rebookSourceError(sourceError, container, params));
      return;
    }
  }
  if (!rebookMode && !venues.length) {
    root.append(
      h(
        "div",
        { class: "state-box", testid: "booking-form-empty" },
        h("p", { text: "目前沒有可預約的場地。請洽管理員。" }),
        h("a", {
          class: "btn",
          href: "#/venues",
          testid: "booking-back",
          text: "返回",
        }),
      ),
    );
    return;
  }

  const errBox = h("div", {
    class: "alert danger",
    testid: "booking-form-error",
    role: "alert",
    hidden: true,
    tabindex: "-1",
  });
  const seed = rebookMode ? source : existing;
  const choices = rebookMode ? rebookVenueChoices(source, venues) : venues;
  const venue = h("select", {
    testid: "booking-venue",
    "aria-readonly": rebookMode ? "true" : null,
  });
  const preVenue = seed?.venueId ?? params.venueId ?? params.venue;
  // 收藏分組（004 UI-02）：再預約場地固定、不分組；收藏載入失敗時退回不分組
  const grouped = rebookMode
    ? { favorites: [], others: choices, favoritesUnavailable: false }
    : groupVenues(choices);
  const venueOption = (item) =>
    h("option", {
      value: String(item.id),
      text: item.location
        ? FAVORITE_TEXT.optionText(item.name, item.location)
        : item.name,
      selected: String(item.id) === String(preVenue),
    });
  // 新增與週期性預約不自動選定場地：沒有預設場地時停在佔位選項
  if (
    !rebookMode &&
    !choices.some((item) => String(item.id) === String(preVenue))
  ) {
    venue.append(
      h("option", {
        value: "",
        text: FAVORITE_TEXT.venuePlaceholder,
        selected: true,
      }),
    );
  }
  if (grouped.favorites.length) {
    venue.append(
      h(
        "optgroup",
        {
          label: FAVORITE_TEXT.groupFavorites,
          testid: "booking-venue-group-favorites",
        },
        ...grouped.favorites.map(venueOption),
      ),
    );
    if (grouped.others.length) {
      venue.append(
        h(
          "optgroup",
          {
            label: FAVORITE_TEXT.groupOthers,
            testid: "booking-venue-group-others",
          },
          ...grouped.others.map(venueOption),
        ),
      );
    }
  } else {
    for (const item of grouped.others) {
      venue.append(venueOption(item));
    }
  }
  const venueErr = h("div", { class: "err", testid: "booking-venue-error" });
  const favNotice =
    !rebookMode && grouped.favoritesUnavailable
      ? h("div", {
          class: "alert",
          role: "status",
          testid: "booking-favorites-error",
          text: FAVORITE_TEXT.favoritesLoadFailed,
        })
      : null;
  const date = h("input", {
    testid: "booking-date",
    type: "date",
    value: rebookMode ? "" : (existing?.date ?? params.date ?? ctx.today),
  });
  // 預約預設值（004 UI-03）：從未預約（沒有記住的值）沿用 001 初始值；有記住的值才預填，起訖時間停在「請選擇」
  const defaults =
    !rebookMode && !editId && ctx.bookingDefaults ? ctx.bookingDefaults : null;
  const defaultsFailed =
    !rebookMode && !editId && ctx.bookingDefaults === undefined;
  const blankStart =
    rebookMode || (defaults !== null && !params.startTime && !params.start);
  const blankEnd =
    rebookMode || (defaults !== null && !params.endTime && !params.end);
  const attendeesHint = h("div", {
    class: "hint",
    testid: "booking-attendees-hint",
    text: DEFAULTS_TEXT.attendeesHint,
    hidden: !defaults,
  });
  const endHint = h("div", {
    class: "hint",
    testid: "booking-end-hint",
    hidden: true,
  });
  const defaultsNotice = defaultsFailed
    ? h("div", {
        class: "alert",
        role: "status",
        testid: "booking-defaults-error",
        text: DEFAULTS_TEXT.loadFailed,
      })
    : null;
  const placeholder = () =>
    h("option", { value: "", text: REBOOK_TEXT.timePlaceholder });
  const start = h("select", { testid: "booking-start" });
  if (blankStart) {
    start.append(placeholder());
  }
  for (const option of startTimeOptions()) {
    start.append(
      h("option", {
        value: option,
        text: option,
        selected: blankStart
          ? false
          : option ===
            (existing?.startTime ??
              params.startTime ??
              params.start ??
              "09:00"),
      }),
    );
  }
  const end = h("select", { testid: "booking-end" });
  if (blankEnd) {
    end.append(placeholder());
  }
  for (const option of endTimeOptions()) {
    end.append(
      h("option", {
        value: option,
        text: option,
        selected: blankEnd
          ? false
          : option ===
            (existing?.endTime ?? params.endTime ?? params.end ?? "09:30"),
      }),
    );
  }
  const subject = h("input", {
    testid: "booking-subject",
    type: "text",
    maxlength: "100",
    value: seed?.subject ?? "",
  });
  const attendees = h("input", {
    testid: "booking-attendees",
    type: "number",
    min: "1",
    inputmode: "numeric",
    value: seed
      ? String(seed.attendees)
      : defaults
        ? String(defaults.attendees)
        : "",
  });
  const info = h("p", { class: "hint", testid: "booking-venue-info" });
  const submit = h("button", {
    class: "btn primary",
    type: "submit",
    testid: "booking-submit",
    text: editId ? "儲存修改" : "送出預約",
  });
  const result = h("div", { testid: "booking-result", hidden: true });
  const recToggle = h("input", {
    type: "checkbox",
    testid: "booking-recurring-toggle",
    id: "rec-toggle",
  });
  const invitees = editId ? null : buildInviteeField({ rebook: rebookMode });
  recToggle.addEventListener("change", () =>
    invitees?.setRecurring(recToggle.checked),
  );
  const recFreq = h(
    "select",
    { testid: "booking-recurrence-frequency" },
    h("option", { value: "weekly", text: "每週" }),
    h("option", { value: "biweekly", text: "每兩週" }),
  );
  const recEnd = h("input", { testid: "booking-recurrence-end", type: "date" });
  const recBox = h("div", { class: "rec", hidden: true });
  const seriesOut = h("div", {
    testid: "booking-series-list",
    "aria-live": "polite",
  });

  // 預填的推導與手動修改優先（ui-contract.md › UI-03 › 操作）
  let endManual = false;
  let attendeesManual = false;
  function dayRanges() {
    const item = selectedVenue();
    if (!item || !date.value) {
      return [];
    }
    const weekday = weekdayOf(date.value);
    return (item.openingHours ?? []).filter(
      (range) => range.weekday === weekday,
    );
  }
  function showEndHint(text) {
    endHint.textContent = text ?? "";
    endHint.hidden = !text;
  }
  function applyDerivedEnd() {
    if (!defaults || endManual || recToggle.checked) {
      return;
    }
    const durationMinutes = defaults.durationMinutes;
    const maxDurationMinutes = ctx.rules?.maxDurationMinutes ?? null;
    const tooLong =
      maxDurationMinutes !== null && durationMinutes > maxDurationMinutes;
    if (!start.value) {
      end.value = "";
      showEndHint(
        tooLong
          ? DEFAULTS_TEXT.notFitHint(formatDuration(durationMinutes))
          : "",
      );
      return;
    }
    const endTime = deriveEndTime({
      startTime: start.value,
      durationMinutes,
      maxDurationMinutes,
      openingHours: dayRanges(),
    });
    if (endTime) {
      end.value = endTime;
      showEndHint(DEFAULTS_TEXT.endHint(formatDuration(durationMinutes)));
    } else {
      end.value = "";
      showEndHint(DEFAULTS_TEXT.notFitHint(formatDuration(durationMinutes)));
    }
  }
  // 勾選重複預約：清掉尚未手動輸入的預填；取消勾選：重新預填並依開始時間帶出結束時間
  function applyRecurringDefaults() {
    if (!defaults) {
      return;
    }
    if (recToggle.checked) {
      if (!attendeesManual) {
        attendees.value = "";
        attendeesHint.hidden = true;
      }
      if (!endManual) {
        end.value = "";
        showEndHint("");
      }
      return;
    }
    if (!attendeesManual) {
      attendees.value = String(defaults.attendees);
      attendeesHint.hidden = false;
    }
    applyDerivedEnd();
  }
  start.addEventListener("change", applyDerivedEnd);
  date.addEventListener("change", applyDerivedEnd);
  venue.addEventListener("change", applyDerivedEnd);
  end.addEventListener("change", () => {
    endManual = true;
    showEndHint("");
  });
  attendees.addEventListener("input", () => {
    attendeesManual = true;
    attendeesHint.hidden = true;
  });

  function selectedVenue() {
    return choices.find((item) => String(item.id) === venue.value);
  }
  function updateInfo() {
    const item = selectedVenue();
    info.textContent = item
      ? `可容納 ${item.capacity} 人；${item.requiresApproval ? "需要審核，送出後為待審核並先占用時段" : "送出後立即成立"}`
      : "";
  }
  venue.addEventListener("change", () => {
    updateInfo();
    clearAppliedNotice();
  });
  updateInfo();

  recBox.append(
    h("div", { class: "field" }, h("label", { text: "重複頻率" }, recFreq)),
    h(
      "div",
      { class: "field" },
      h("label", { text: "最後一場日期" }, recEnd),
      h("div", { class: "err", testid: "booking-recurrence-end-error" }),
    ),
    h("button", {
      class: "btn",
      type: "button",
      testid: "booking-series-check",
      text: "檢查場次",
      onClick: () => checkSeries(),
    }),
    seriesOut,
  );
  recToggle.addEventListener("change", () => {
    recBox.hidden = !recToggle.checked;
    seriesOut.replaceChildren();
    applyRecurringDefaults();
  });

  const step = (n, text) =>
    h("h2", { class: "step" }, h("span", { text: String(n) }), text);
  const form = h(
    "form",
    { class: "card booking-form", novalidate: true },
    errBox,
    h(
      "div",
      { class: "form-col" },
      step(1, "場地與時間"),
      h(
        "div",
        { class: "field" },
        h("label", { text: "場地" }, venue),
        info,
        venueErr,
        rebookMode
          ? h(
              "div",
              { class: "row rebook-venue-row" },
              h("p", { class: "hint", text: REBOOK_TEXT.venueFixedNote }),
              h("a", {
                class: "btn sm rebook-general-link",
                href: "#/bookings/new",
                testid: "booking-rebook-general-link",
                text: REBOOK_TEXT.generalBookingLink,
              }),
            )
          : null,
      ),
      h(
        "div",
        { class: "field" },
        h("label", { text: "日期" }, date),
        h("div", { class: "err", testid: "booking-date-error" }),
      ),
      h(
        "div",
        { class: "grid2" },
        h(
          "div",
          { class: "field" },
          h("label", { text: "開始時間" }, start),
          h("div", { class: "err", testid: "booking-start-error" }),
        ),
        h(
          "div",
          { class: "field" },
          h("label", { text: "結束時間" }, end),
          endHint,
          h("div", { class: "err", testid: "booking-end-error" }),
        ),
      ),
      h("p", { class: "hint", text: "時間以台北時間（UTC+8）顯示" }),
    ),
    h(
      "div",
      { class: "form-col" },
      step(2, "預約資料"),
      h(
        "div",
        { class: "field" },
        h("label", { text: "主題" }, subject),
        h("div", { class: "err", testid: "booking-subject-error" }),
      ),
      h(
        "div",
        { class: "field" },
        h("label", { text: "人數" }, attendees),
        attendeesHint,
        h("div", { class: "err", testid: "booking-attendees-error" }),
      ),
      invitees ? invitees.root : null,
      editId || rebookMode
        ? null
        : h(
            "div",
            { class: "field" },
            h("label", { class: "checks check-line" }, recToggle, "重複預約"),
          ),
      editId || rebookMode ? null : recBox,
    ),
    h(
      "div",
      { class: "row form-foot" },
      submit,
      h("a", {
        class: "btn",
        href: editId || rebookMode ? "#/bookings" : "#/venues",
        testid: "booking-back",
        text: "返回",
      }),
    ),
  );
  if (rebookMode && source.venueActive !== false) {
    root.append(
      h("div", {
        class: "alert ok rebook-notice",
        role: "status",
        testid: "booking-rebook-notice",
        text: REBOOK_TEXT.prefillNotice(source.venueName),
      }),
    );
  }
  if (favNotice) {
    root.append(favNotice);
  }
  if (defaultsNotice) {
    root.append(defaultsNotice);
  }
  root.append(form, result);
  applyDerivedEnd();
  if (rebookMode && source.venueActive === false) {
    root.append(
      h("div", {
        class: "alert danger rebook-source-error",
        role: "alert",
        testid: "booking-rebook-source-error",
        text: REBOOK_TEXT.rules.venue_inactive,
      }),
    );
    for (const el of form.querySelectorAll("input, select, button")) {
      el.disabled = true;
    }
  }

  function payload() {
    return {
      venueId: Number(venue.value),
      date: date.value,
      startTime: start.value,
      endTime: end.value,
      subject: subject.value.trim(),
      attendees: Number.parseInt(attendees.value, 10),
    };
  }

  function showErrors(error) {
    const violations = error.violations ?? [];
    if (error.inviteeProblems?.length) {
      invitees?.showProblems(error.inviteeProblems);
      if (!violations.length) {
        return;
      }
    }
    errBox.hidden = false;
    const title =
      error.status === 0
        ? NETWORK_ERROR
        : violations.length
          ? REBOOK_TEXT.errorListTitle
          : (error.message ?? "無法送出預約。");
    errBox.replaceChildren(h("p", { text: title }));
    if (violations.length) {
      const list = h("ul");
      const capacity = selectedVenue()?.capacity;
      for (const item of violations)
        list.append(
          h("li", {
            text: rebookMode
              ? rebookRuleMessage(item, ctx, capacity)
              : item.message,
          }),
        );
      errBox.append(list);
    }
    if (
      violations.some((item) => item.rule === "occupied") &&
      !recToggle.checked
    ) {
      errBox.append(
        h("button", {
          class: "btn",
          type: "button",
          testid: "booking-waitlist-link",
          text: "登記候補",
          onClick: () => openWaitlistDialog(payload()),
        }),
      );
    }
    // 建議區塊的外層容器：只在唯一未通過的規則是「時段被占用」時出現（UI-01、UI-02）
    if (
      error.suggestions &&
      violations.length === 1 &&
      violations[0].rule === "occupied" &&
      !recToggle.checked
    ) {
      const altBox = h("div", { testid: "alt-suggestions" });
      altBox.append(
        renderSlotSuggestions(error.suggestions, {
          onPick: (picked) =>
            applySuggestion(
              picked,
              ALT_TEXT.appliedSlot(
                picked.date,
                `${picked.startTime}–${picked.endTime}`,
                submitLabel(),
              ),
            ),
        }),
      );
      // 同時段其他可用場地：再預約模式場地固定，不渲染（FR-016）
      if (!rebookMode) {
        altBox.append(
          renderVenueSuggestions(error.suggestions.venues ?? [], {
            onPick: (venue) =>
              applySuggestion(
                { venueId: venue.venueId },
                ALT_TEXT.appliedVenue(venue.name, submitLabel()),
              ),
          }),
        );
      }
      errBox.append(altBox);
    }
    errBox.focus();
  }

  function clearAppliedNotice() {
    root.querySelector('[data-testid="alt-applied-notice"]')?.remove();
  }

  function submitLabel() {
    return editId ? "儲存修改" : REBOOK_TEXT.submitLabel;
  }

  // 點選建議後的共用處理：只改欄位、清除錯誤與舊建議、顯示已填入提示，不送出
  function applySuggestion(changes, noticeText) {
    if (changes.date !== undefined) date.value = changes.date;
    if (changes.startTime !== undefined) start.value = changes.startTime;
    if (changes.endTime !== undefined) end.value = changes.endTime;
    if (changes.venueId !== undefined) {
      venue.value = String(changes.venueId);
      updateInfo();
    }
    errBox.hidden = true;
    errBox.replaceChildren();
    for (const el of form.querySelectorAll("input, select")) {
      setError(el, "");
    }
    clearAppliedNotice();
    form.before(
      h("div", {
        class: "alert ok alt-notice",
        role: "status",
        testid: "alt-applied-notice",
        text: noticeText,
      }),
    );
    submit.focus();
  }

  function resultPanel(text, extra) {
    form.hidden = true;
    result.hidden = false;
    result.replaceChildren(
      h(
        "div",
        { class: "alert ok", role: "status" },
        h("p", { text }),
        extra ?? null,
      ),
      h("a", {
        class: "btn primary",
        href: "#/bookings",
        testid: "booking-go-my-bookings",
        text: "前往我的預約",
      }),
    );
  }

  async function checkSeries(fresh = false) {
    seriesOut.replaceChildren();
    errBox.hidden = true;
    if (!recEnd.value || recEnd.value < date.value) {
      setError(recEnd, "請選擇不早於第一場的最後一場日期。");
      return;
    }
    setError(recEnd, "");
    try {
      const preview = await post("/api/booking-series/preview", {
        ...payload(),
        firstDate: date.value,
        frequency: recFreq.value,
        lastDate: recEnd.value,
      });
      const conflicts = (preview.sessions ?? []).filter(
        (session) => !session.available,
      );
      const okCount =
        preview.availableCount ?? preview.sessions.length - conflicts.length;
      if (fresh) {
        seriesOut.append(
          h("div", {
            class: "alert danger",
            role: "alert",
            text: "送出時發現新的衝突，尚未建立任何場次。請重新確認以下日期。",
          }),
        );
      }
      if (!conflicts.length) {
        seriesOut.append(
          h("div", {
            class: "alert ok",
            text: `共 ${preview.sessions.length} 個場次，皆可預約。`,
          }),
        );
        seriesOut.append(
          h("button", {
            class: "btn primary",
            type: "button",
            testid: "booking-series-skip-submit",
            text: "送出預約",
            onClick: () => createSeries([]),
          }),
        );
        return;
      }
      const ul = h("ul");
      for (const session of conflicts) {
        ul.append(
          h("li", {
            text: `${formatDate(session.date)} ${session.startTime}–${session.endTime}：${session.reason}`,
          }),
        );
      }
      seriesOut.append(
        h(
          "div",
          { class: "alert warn", role: "alert" },
          h("strong", { text: "以下日期無法預約" }),
          ul,
        ),
      );
      if (okCount <= 0) {
        seriesOut.append(
          h("div", {
            class: "state-box",
            testid: "booking-form-empty",
            text: "沒有可預約的場次。請調整日期或取消這批預約。",
          }),
        );
      }
      seriesOut.append(
        h(
          "div",
          { class: "row" },
          h("button", {
            class: "btn primary",
            type: "button",
            testid: "booking-series-skip-submit",
            text: "略過衝突日期並建立",
            disabled: okCount <= 0,
            onClick: () => createSeries(conflicts.map((item) => item.date)),
          }),
          h("button", {
            class: "btn",
            type: "button",
            testid: "booking-series-cancel",
            text: "取消整批",
            onClick: () => {
              seriesOut.replaceChildren();
              recToggle.checked = false;
              recBox.hidden = true;
              showToast("已取消這批預約，尚未建立任何場次。");
            },
          }),
        ),
      );
    } catch (error) {
      showErrors(error);
    }
  }

  async function createSeries(skipDates) {
    try {
      const created = await post("/api/booking-series", {
        ...payload(),
        firstDate: date.value,
        frequency: recFreq.value,
        lastDate: recEnd.value,
        skipDates,
      });
      resultPanel(
        `已建立 ${created.sessionCount ?? created.sessions?.length ?? ""} 場週期性預約，整批算 1 筆持有額度。`,
        h("p", {
          text:
            created.status === "pending"
              ? "場地需要審核，所有場次目前為待審核，由審核者整批審核。"
              : "所有場次皆為已確認。",
        }),
      );
    } catch (error) {
      if (error.status === 409 && error.conflicts) {
        await checkSeries(true);
        return;
      }
      showErrors(error);
    }
  }

  // 再預約模式的欄位失焦檢查（UI-02：修改主題與人數、選擇新日期與起訖時間）
  function attendeesMessage() {
    const count = Number.parseInt(attendees.value, 10);
    if (!attendees.value || !(count >= 1)) {
      return REBOOK_TEXT.requiredAttendees;
    }
    const capacity = selectedVenue()?.capacity;
    if (capacity && count > capacity) {
      return rebookMode
        ? REBOOK_TEXT.attendeesOverCapacity(capacity)
        : `人數超過容納人數（可容納 ${capacity} 人）。請減少人數或改選其他場地。`;
    }
    return "";
  }

  function endMessage() {
    if (!start.value || !end.value) {
      return "";
    }
    if (end.value <= start.value) {
      return REBOOK_TEXT.endBeforeStart;
    }
    const minutes = toMinutes(end.value) - toMinutes(start.value);
    const max = ctx.rules.maxDurationMinutes;
    if (max && minutes > max) {
      return REBOOK_TEXT.rules.duration(formatMinutes(max));
    }
    return "";
  }

  function checkEnd() {
    const message = endMessage();
    setError(end, message);
    return message;
  }

  {
    subject.addEventListener("blur", () =>
      setError(
        subject,
        subject.value.trim() ? "" : REBOOK_TEXT.requiredSubject,
      ),
    );
    attendees.addEventListener("blur", () =>
      setError(attendees, attendeesMessage()),
    );
    start.addEventListener("change", checkEnd);
    end.addEventListener("change", checkEnd);
    end.addEventListener("blur", checkEnd);
  }

  function setBusy(on) {
    form.setAttribute("aria-busy", on ? "true" : "false");
    for (const el of [venue, date, start, end, subject, attendees]) {
      el.disabled = on;
    }
    submit.disabled = on;
    invitees?.setDisabled(on);
    submit.textContent = on
      ? REBOOK_TEXT.submitting
      : editId
        ? "儲存修改"
        : REBOOK_TEXT.submitLabel;
  }

  // 送出前的必填與格式檢查（三種模式共用）；人數超過容納人數與長度超過上限
  // 不在此攔截，交由後端與「時段被占用」一併並列回報（FR-008、FR-017）
  function preSubmitCheck() {
    const checks = [
      [venue, !venue.value, FAVORITE_TEXT.venueRequired],
      [date, !date.value, REBOOK_TEXT.requiredDate],
      [start, !start.value, REBOOK_TEXT.requiredStart],
      [end, !end.value, REBOOK_TEXT.requiredEnd],
      [subject, !subject.value.trim(), REBOOK_TEXT.requiredSubject],
      [
        attendees,
        !(Number.parseInt(attendees.value, 10) >= 1),
        REBOOK_TEXT.requiredAttendees,
      ],
    ];
    let firstInvalid = null;
    for (const [el, missing, message] of checks) {
      setError(el, missing ? message : "");
      if (missing && !firstInvalid) {
        firstInvalid = el;
      }
    }
    if (start.value && end.value && end.value <= start.value) {
      setError(end, REBOOK_TEXT.endBeforeStart);
      firstInvalid ??= end;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return false;
    }
    // Email 格式不符由欄位攔截（ui-contract.md › UI-01 › 錯誤）
    return invitees ? invitees.validate() : true;
  }

  async function submitBooking() {
    if (!preSubmitCheck()) {
      return;
    }
    setBusy(true);
    try {
      if (editId) {
        const updated = await put(`/api/bookings/${editId}`, payload());
        resultPanel(
          `預約已更新，目前狀態：${BOOKING_STATUS_LABELS[updated.status] ?? updated.status}。`,
        );
      } else {
        const created = await post("/api/bookings", {
          ...payload(),
          inviteeEmails: invitees ? invitees.emails() : [],
        });
        if (rebookMode) {
          showToast(
            created.status === "pending"
              ? REBOOK_TEXT.successPending
              : REBOOK_TEXT.successConfirmed,
          );
          window.location.hash = "#/bookings";
        } else {
          const inviteeCount = created.inviteeCount ?? 0;
          resultPanel(
            created.status === "pending"
              ? `預約申請已送出，等待審核（待審核）。審核期間已為您保留 ${created.date} ${created.startTime}–${created.endTime}。`
              : `預約已成立（已確認）：${created.venueName}，${created.date} ${created.startTime}–${created.endTime}。`,
            inviteeCount
              ? h("p", {
                  testid: "booking-result-invitees",
                  text:
                    created.status === "pending"
                      ? INVITEE_TEXT.resultPendingInvitees(inviteeCount)
                      : INVITEE_TEXT.resultConfirmedInvitees(inviteeCount),
                })
              : null,
          );
        }
      }
    } catch (error) {
      showErrors(error);
      if (!rebookMode) {
        showToast(error.message ?? "無法送出預約。", "error");
      }
      setBusy(false);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errBox.hidden = true;
    errBox.replaceChildren();
    clearAppliedNotice();
    if (!editId && !rebookMode && recToggle.checked) {
      await checkSeries();
      return;
    }
    await submitBooking();
  });
}

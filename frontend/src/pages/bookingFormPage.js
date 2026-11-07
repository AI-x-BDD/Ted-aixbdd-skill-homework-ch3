import { get, post, put } from "../api/client.js";
import { mountPage } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { openWaitlistDialog } from "../components/waitlistDialog.js";
import { h } from "../lib/h.js";
import { endTimeOptions, formatDate, startTimeOptions } from "../lib/time.js";

function setError(el, message) {
  el.setAttribute("aria-invalid", message ? "true" : "false");
  const box = el.closest(".field")?.querySelector(".err");
  if (box) {
    box.textContent = message ?? "";
  }
}

export async function render(container, params = {}) {
  const editId = params.bookingId;
  const root = h("div", { testid: "booking-form" });
  mountPage(container, "#/bookings", root);
  root.append(h("h1", { text: editId ? "修改預約" : "預約場地" }));
  let venues = [];
  let ctx = null;
  let existing = null;
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
  if (ctx.suspendedUntil && !editId) {
    root.append(
      h("div", {
        class: "alert warn",
        testid: "suspension-banner",
        text: `您的預約權限已暫停至 ${ctx.suspendedUntil}。暫停期間無法新增預約、登記候補與確認遞補。`,
      }),
    );
  }
  if (!venues.length) {
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
  const venue = h("select", { testid: "booking-venue" });
  const preVenue = existing?.venueId ?? params.venueId ?? params.venue;
  for (const item of venues) {
    venue.append(
      h("option", {
        value: String(item.id),
        text: `${item.name}（${item.location}）`,
        selected: String(item.id) === String(preVenue),
      }),
    );
  }
  const date = h("input", {
    testid: "booking-date",
    type: "date",
    value: existing?.date ?? params.date ?? ctx.today,
  });
  const start = h("select", { testid: "booking-start" });
  for (const option of startTimeOptions()) {
    start.append(
      h("option", {
        value: option,
        text: option,
        selected:
          option ===
          (existing?.startTime ?? params.startTime ?? params.start ?? "09:00"),
      }),
    );
  }
  const end = h("select", { testid: "booking-end" });
  for (const option of endTimeOptions()) {
    end.append(
      h("option", {
        value: option,
        text: option,
        selected:
          option ===
          (existing?.endTime ?? params.endTime ?? params.end ?? "09:30"),
      }),
    );
  }
  const subject = h("input", {
    testid: "booking-subject",
    type: "text",
    maxlength: "100",
    value: existing?.subject ?? "",
  });
  const attendees = h("input", {
    testid: "booking-attendees",
    type: "number",
    min: "1",
    inputmode: "numeric",
    value: existing ? String(existing.attendees) : "",
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

  function selectedVenue() {
    return venues.find((item) => String(item.id) === venue.value);
  }
  function updateInfo() {
    const item = selectedVenue();
    info.textContent = item
      ? `可容納 ${item.capacity} 人；${item.requiresApproval ? "需要審核，送出後為待審核並先占用時段" : "送出後立即成立"}`
      : "";
  }
  venue.addEventListener("change", updateInfo);
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
      h("div", { class: "field" }, h("label", { text: "場地" }, venue), info),
      h(
        "div",
        { class: "field" },
        h("label", { text: "日期" }, date),
        h("div", { class: "err", testid: "booking-date-error" }),
      ),
      h(
        "div",
        { class: "grid2" },
        h("div", { class: "field" }, h("label", { text: "開始時間" }, start)),
        h(
          "div",
          { class: "field" },
          h("label", { text: "結束時間" }, end),
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
        h("div", { class: "err", testid: "booking-attendees-error" }),
      ),
      editId
        ? null
        : h(
            "div",
            { class: "field" },
            h("label", { class: "checks check-line" }, recToggle, "重複預約"),
          ),
      editId ? null : recBox,
    ),
    h(
      "div",
      { class: "row form-foot" },
      submit,
      h("a", {
        class: "btn",
        href: editId ? "#/bookings" : "#/venues",
        testid: "booking-back",
        text: "返回",
      }),
    ),
  );
  root.append(form, result);

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
    errBox.hidden = false;
    errBox.replaceChildren(h("p", { text: error.message ?? "無法送出預約。" }));
    if (violations.length) {
      const list = h("ul");
      for (const item of violations)
        list.append(h("li", { text: item.message }));
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
    errBox.focus();
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errBox.hidden = true;
    if (!editId && recToggle.checked) {
      await checkSeries();
      return;
    }
    let ok = true;
    if (!subject.value.trim()) {
      setError(subject, "請輸入主題。");
      ok = false;
    } else setError(subject, "");
    if (!(Number.parseInt(attendees.value, 10) >= 1)) {
      setError(attendees, "請輸入人數，須為 1 以上的整數。");
      ok = false;
    } else setError(attendees, "");
    if (!ok) return;
    submit.disabled = true;
    submit.textContent = "送出中…";
    try {
      if (editId) {
        const updated = await put(`/api/bookings/${editId}`, payload());
        resultPanel(
          `預約已更新：${updated.venueName}，${updated.date} ${updated.startTime}–${updated.endTime}。`,
        );
      } else {
        const created = await post("/api/bookings", payload());
        resultPanel(
          created.status === "pending"
            ? `預約申請已送出，等待審核（待審核）。審核期間已為您保留 ${created.date} ${created.startTime}–${created.endTime}。`
            : `預約已成立（已確認）：${created.venueName}，${created.date} ${created.startTime}–${created.endTime}。`,
        );
      }
    } catch (error) {
      showErrors(error);
      showToast(error.message ?? "無法送出預約。", "error");
      submit.disabled = false;
      submit.textContent = editId ? "儲存修改" : "送出預約";
    }
  });
}

import { FAVORITE_TEXT } from "../../../shared/src/copy.js";
import { get, post } from "../api/client.js";
import { h } from "../lib/h.js";
import { endTimeOptions, startTimeOptions } from "../lib/time.js";
import { groupVenues } from "../lib/venueGroups.js";
import { showToast } from "./toast.js";

function setError(el, message) {
  el.setAttribute("aria-invalid", message ? "true" : "false");
  const box = el.closest(".field")?.querySelector(".err");
  if (box) {
    box.textContent = message ?? "";
  }
}

export async function openWaitlistDialog(pre = {}) {
  const trigger = document.activeElement;
  const venues = await get("/api/venues")
    .then((data) => data.items ?? [])
    .catch(() => []);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const dialog = h("dialog", {
      class: "sheet",
      testid: "waitlist-register-dialog",
      "aria-labelledby": "waitlist-dialog-title",
    });
    const venue = h("select", { testid: "waitlist-register-venue" });
    // 收藏分組（004 UI-02）：與預約表單共用同一分組規則；預選仍沿用 pre.venueId
    const grouped = groupVenues(venues);
    const venueOption = (item) =>
      h("option", {
        value: String(item.id),
        text: item.name,
        selected: String(item.id) === String(pre.venueId ?? pre.venue ?? ""),
      });
    if (grouped.favorites.length) {
      venue.append(
        h(
          "optgroup",
          { label: FAVORITE_TEXT.groupFavorites },
          ...grouped.favorites.map(venueOption),
        ),
      );
      if (grouped.others.length) {
        venue.append(
          h(
            "optgroup",
            { label: FAVORITE_TEXT.groupOthers },
            ...grouped.others.map(venueOption),
          ),
        );
      }
    } else {
      for (const item of grouped.others) {
        venue.append(venueOption(item));
      }
    }
    const date = h("input", {
      testid: "waitlist-register-date",
      type: "date",
      value: pre.date ?? "",
    });
    const start = h("select", { testid: "waitlist-register-start" });
    for (const option of startTimeOptions()) {
      start.append(
        h("option", {
          value: option,
          text: option,
          selected: option === (pre.startTime ?? pre.start ?? "09:00"),
        }),
      );
    }
    const end = h("select", { testid: "waitlist-register-end" });
    for (const option of endTimeOptions()) {
      end.append(
        h("option", {
          value: option,
          text: option,
          selected: option === (pre.endTime ?? pre.end ?? "09:30"),
        }),
      );
    }
    const subject = h("input", {
      testid: "waitlist-register-subject",
      type: "text",
      value: pre.subject ?? "",
    });
    const attendees = h("input", {
      testid: "waitlist-register-attendees",
      type: "number",
      min: "1",
      inputmode: "numeric",
      value: pre.attendees ?? pre.att ?? "",
    });
    const top = h("div", {
      testid: "waitlist-register-dialog-error",
      hidden: true,
    });
    const form = h(
      "form",
      { novalidate: true, id: "wl-form" },
      h("p", {
        class: "lead",
        text: "時段已被占用時才能登記候補。時段全部空出且距開始超過 1 小時時，會通知第一順位，並保留 30 分鐘。",
      }),
      top,
      h("div", { class: "field" }, h("label", { text: "場地" }, venue)),
      h("div", { class: "field" }, h("label", { text: "日期" }, date)),
      h(
        "div",
        { class: "grid2" },
        h("div", { class: "field" }, h("label", { text: "開始時間" }, start)),
        h(
          "div",
          { class: "field" },
          h("label", { text: "結束時間" }, end),
          h("div", { class: "hint", text: "時間以台北時間（UTC+8）顯示" }),
        ),
      ),
      h(
        "div",
        { class: "field" },
        h("label", { text: "主題" }, subject),
        h("div", { class: "err", testid: "waitlist-register-subject-error" }),
      ),
      h(
        "div",
        { class: "field" },
        h("label", { text: "人數" }, attendees),
        h("div", { class: "err", testid: "waitlist-register-attendees-error" }),
      ),
    );
    const submit = h("button", {
      class: "btn primary",
      type: "submit",
      form: "wl-form",
      testid: "waitlist-register-submit",
      text: "登記候補",
    });
    const cancel = h("button", {
      class: "btn",
      type: "button",
      testid: "waitlist-register-dialog-cancel",
      text: "取消",
      onClick: () => dialog.close(),
    });
    dialog.append(
      h(
        "div",
        { class: "sheet-in" },
        h("h2", { id: "waitlist-dialog-title", text: "登記候補" }),
        form,
        h("div", { class: "sheet-foot" }, cancel, submit),
      ),
    );
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      top.hidden = true;
      top.replaceChildren();
      let ok = true;
      if (!subject.value.trim()) {
        setError(subject, "請輸入主題。");
        ok = false;
      } else {
        setError(subject, "");
      }
      if (!(Number.parseInt(attendees.value, 10) >= 1)) {
        setError(attendees, "請輸入人數，須為 1 以上的整數。");
        ok = false;
      } else {
        setError(attendees, "");
      }
      if (!date.value) {
        top.hidden = false;
        top.append(
          h("div", {
            class: "alert danger",
            role: "alert",
            text: "請選擇日期。",
          }),
        );
        ok = false;
      }
      if (!ok) {
        return;
      }
      submit.disabled = true;
      submit.textContent = "送出中…";
      try {
        const created = await post("/api/waitlist", {
          venueId: Number(venue.value),
          date: date.value,
          startTime: start.value,
          endTime: end.value,
          subject: subject.value.trim(),
          attendees: Number.parseInt(attendees.value, 10),
        });
        showToast(
          `已登記候補${created.rank ? `，目前為第 ${created.rank} 順位。` : "。"}`,
        );
        finish(created);
        dialog.close();
      } catch (error) {
        top.hidden = false;
        const box = h("div", {
          class: "alert danger",
          role: "alert",
          text: error.message ?? "無法登記候補。",
        });
        if (error.violations?.some((item) => item.rule === "slot_free")) {
          box.append(
            h(
              "div",
              {},
              h("a", {
                class: "btn sm",
                href: `#/bookings/new?venueId=${venue.value}&date=${date.value}&startTime=${start.value}&endTime=${end.value}`,
                text: "前往預約",
              }),
            ),
          );
        }
        top.replaceChildren(box);
        submit.disabled = false;
        submit.textContent = "登記候補";
      }
    });
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove();
        trigger?.focus?.();
        finish(null);
      },
      { once: true },
    );
    document.body.append(dialog);
    dialog.showModal();
  });
}

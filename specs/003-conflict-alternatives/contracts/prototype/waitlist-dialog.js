/* 登記候補對話框（UI-05），可由行事曆、預約表單與候補頁開啟。需先載入 proto.js。 */
(function () {
  var h = P.h,
    dlg = null,
    f = {};
  function build() {
    dlg = P.dialog("waitlist-register-dialog", "登記候補");
    dlg.body.appendChild(
      h("p", {
        class: "lead",
        text: "時段已被占用時才能登記候補。時段全部空出且距開始超過 1 小時時，會通知第一順位，並保留 30 分鐘。",
      }),
    );
    var top = h("div", { tid: "waitlist-register-dialog-error", hidden: true });
    dlg.body.appendChild(top);
    var form = h("form", { novalidate: true, id: "wl-form" });
    f.venue = P.select(
      "waitlist-register-venue",
      "",
      P.activeVenues().map(function (v) {
        return [v.id, v.name];
      }),
    );
    f.date = h("input", { tid: "waitlist-register-date", type: "date" });
    f.start = P.select("waitlist-register-start", "", P.times(0, 1410));
    f.end = P.select("waitlist-register-end", "", P.times(30, 1440));
    f.subject = h("input", { tid: "waitlist-register-subject", type: "text" });
    f.att = h("input", {
      tid: "waitlist-register-attendees",
      type: "number",
      min: "1",
      inputmode: "numeric",
    });
    form.appendChild(P.field("場地", f.venue));
    form.appendChild(P.field("日期", f.date));
    var g = h("div", { class: "grid2" });
    g.appendChild(P.field("開始時間", f.start));
    g.appendChild(P.field("結束時間", f.end, "時間以台北時間（UTC+8）顯示"));
    form.appendChild(g);
    form.appendChild(
      P.field("主題", f.subject, null, "waitlist-register-subject-error"),
    );
    form.appendChild(
      P.field("人數", f.att, null, "waitlist-register-attendees-error"),
    );
    dlg.body.appendChild(form);
    f.submit = h("button", {
      class: "btn primary",
      type: "submit",
      form: "wl-form",
      tid: "waitlist-register-submit",
      text: "登記候補",
    });
    dlg.foot.appendChild(
      h("button", {
        class: "btn",
        type: "button",
        tid: "waitlist-register-dialog-cancel",
        text: "取消",
        onclick: function () {
          dlg.close();
        },
      }),
    );
    dlg.foot.appendChild(f.submit);
    function showTop(text, link) {
      top.hidden = false;
      top.innerHTML = "";
      var box = h("div", { class: "alert danger", role: "alert" }, text);
      if (link) box.appendChild(h("div", null, link));
      top.appendChild(box);
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      top.hidden = true;
      var ok = true;
      if (!f.subject.value.trim()) {
        P.fieldErr(f.subject, "請輸入主題。");
        ok = false;
      } else P.fieldErr(f.subject, "");
      var n = parseInt(f.att.value, 10);
      if (!(n >= 1)) {
        P.fieldErr(f.att, "請輸入人數，須為 1 以上的整數。");
        ok = false;
      } else P.fieldErr(f.att, "");
      if (P.min(f.end.value) <= P.min(f.start.value)) {
        showTop("結束時間須晚於開始時間。請重新選擇。");
        ok = false;
      }
      if (!ok || !f.date.value) {
        if (!f.date.value) showTop("請選擇日期。");
        return;
      }
      f.submit.disabled = true;
      f.submit.textContent = "送出中…";
      setTimeout(function () {
        f.submit.disabled = false;
        f.submit.textContent = "登記候補";
        var free =
          P.slotState(f.venue.value, f.date.value, P.min(f.start.value)) ===
          "free";
        if (P.me.id === "u-chen" && f.subject.value.trim() === "重複") {
          showTop("你已在這個時段的候補中。請到「我的候補」查看順位。");
          return;
        }
        if (f.subject.value.trim() === "暫停") {
          showTop(
            "您的預約權限已暫停，將於 2026年11月14日（週六）10:30 解除。解除前仍可報到、取消與修改既有預約。",
          );
          return;
        }
        if (free) {
          showTop(
            "這個時段目前可以直接預約。請改為直接預約。",
            h("a", {
              class: "btn sm",
              href: P.link(
                "booking-form.html",
                "venue=" +
                  f.venue.value +
                  "&date=" +
                  f.date.value +
                  "&start=" +
                  f.start.value +
                  "&end=" +
                  f.end.value,
              ),
              text: "前往預約",
            }),
          );
          return;
        }
        dlg.close();
        P.toast("已登記候補，目前為第 2 順位。");
        document.dispatchEvent(new CustomEvent("waitlist:registered"));
      }, 500);
    });
  }
  P.waitlistDialog = function (pre, trigger) {
    if (!dlg) build();
    pre = pre || {};
    f.venue.value = pre.venue || P.activeVenues()[0].id;
    f.date.value = pre.date || "";
    f.start.value = pre.start || "09:00";
    f.end.value = pre.end || "09:30";
    f.subject.value = pre.subject || "";
    f.att.value = pre.att || "";
    [f.subject, f.att].forEach(function (c) {
      P.fieldErr(c, "");
    });
    dlg.body.querySelector(
      '[data-testid="waitlist-register-dialog-error"]',
    ).hidden = true;
    dlg.open(trigger);
  };
})();

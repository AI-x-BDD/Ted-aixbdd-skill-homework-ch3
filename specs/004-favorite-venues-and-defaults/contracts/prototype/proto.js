/* 場地預約原型共用腳本：假資料、導覽列、狀態切換、對話框、提示。不呼叫後端或外部服務。 */
(function () {
  var P = (window.P = {});
  var q = (P.q = new URLSearchParams(location.search));
  P.state =
    ["loading", "empty", "error"].indexOf(q.get("state")) >= 0
      ? q.get("state")
      : "success";
  var role = q.get("role");
  try {
    if (role) sessionStorage.setItem("venue-proto:role", role);
    else role = sessionStorage.getItem("venue-proto:role");
  } catch (e) {}
  P.role =
    ["employee", "reviewer", "admin"].indexOf(role) >= 0 ? role : "employee";
  P.NOW = { date: "2026-11-07", time: "14:00" }; // 假的「現在」：2026-11-07（週六）14:00，台北時間
  P.WD = ["日", "一", "二", "三", "四", "五", "六"];

  /* ---------- 工具 ---------- */
  P.h = function (tag, props) {
    var el = document.createElement(tag);
    if (props)
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === false || v == null) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
        else if (k === "tid") el.setAttribute("data-testid", v);
        else
          el.setAttribute(
            k,
            v === true ? (k.slice(0, 5) === "aria-" ? "true" : "") : v,
          );
      });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  };
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c))
      c.forEach(function (x) {
        add(el, x);
      });
    else el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  var h = P.h;
  P.pad = function (n) {
    return (n < 10 ? "0" : "") + n;
  };
  function ymd(d) {
    var p = d.split("-");
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  }
  P.addDays = function (d, n) {
    var t = new Date(ymd(d) + n * 86400000);
    return (
      t.getUTCFullYear() +
      "-" +
      P.pad(t.getUTCMonth() + 1) +
      "-" +
      P.pad(t.getUTCDate())
    );
  };
  P.dow = function (d) {
    return new Date(ymd(d)).getUTCDay();
  };
  P.fmtDate = function (d) {
    var p = d.split("-");
    return (
      +p[0] + "年" + +p[1] + "月" + +p[2] + "日（週" + P.WD[P.dow(d)] + "）"
    );
  };
  P.fmtShort = function (d) {
    var p = d.split("-");
    return +p[1] + "/" + +p[2] + "（週" + P.WD[P.dow(d)] + "）";
  };
  P.range = function (s, e) {
    return s + "–" + e;
  };
  P.times = function (fromMin, toMin, includeEnd24) {
    var out = [];
    for (var m = fromMin; m <= toMin; m += 30)
      out.push(
        m === 1440 ? "24:00" : P.pad(Math.floor(m / 60)) + ":" + P.pad(m % 60),
      );
    return out;
  };
  P.min = function (t) {
    var p = t.split(":");
    return +p[0] * 60 + +p[1];
  };
  P.fmtMin = function (m) {
    return m === 1440
      ? "24:00"
      : P.pad(Math.floor(m / 60)) + ":" + P.pad(m % 60);
  };
  P.select = function (tid, label, opts, value) {
    var s = h("select", { tid: tid, id: tid });
    opts.forEach(function (o) {
      var v = Array.isArray(o) ? o[0] : o,
        t = Array.isArray(o) ? o[1] : o;
      var op = h("option", { value: v, text: t });
      if (String(v) === String(value)) op.selected = true;
      s.appendChild(op);
    });
    return s;
  };
  P.field = function (label, control, hint, errTid) {
    var id = control.id || "f" + Math.random().toString(36).slice(2, 7);
    control.id = id;
    var f = h(
      "div",
      { class: "field" },
      h("label", { for: id, text: label }),
      control,
    );
    if (hint) f.appendChild(h("div", { class: "hint", text: hint }));
    if (errTid) {
      var e = h("div", {
        class: "err",
        tid: errTid,
        id: id + "-err",
        role: "alert",
        hidden: true,
      });
      f.appendChild(e);
    }
    return f;
  };
  P.fieldErr = function (control, msg) {
    var e = document.getElementById(control.id + "-err");
    if (!e) return;
    e.textContent = msg || "";
    e.hidden = !msg;
    if (msg) {
      control.setAttribute("aria-invalid", "true");
      control.setAttribute("aria-describedby", e.id);
    } else {
      control.removeAttribute("aria-invalid");
      control.removeAttribute("aria-describedby");
    }
  };
  /* 預約狀態代碼（C-SH-01，與 openapi／data-model 逐字相同）；中文只作顯示文案 */
  P.STATUS = {
    pending: "待審核",
    confirmed: "已確認",
    checked_in: "已報到",
    completed: "已完成",
    rejected: "已駁回",
    cancelled: "已取消",
    no_show: "未到場",
  };
  P.statusText = function (code) {
    return P.STATUS[code] || code;
  };
  P.statusTag = function (code, lateCancel) {
    var cls =
      {
        pending: "warn",
        confirmed: "ok",
        checked_in: "ok",
        completed: "",
        rejected: "danger",
        cancelled: "danger",
        no_show: "danger",
      }[code] || "";
    var w = h(
      "span",
      null,
      h("span", {
        class: "tag " + cls,
        "data-status": code,
        text: P.statusText(code),
      }),
    );
    if (lateCancel) {
      w.appendChild(document.createTextNode(" "));
      w.appendChild(h("span", { class: "tag warn", text: "逾時取消" }));
    }
    return w;
  };

  /* ---------- 提示與對話框 ---------- */
  var toasts;
  P.toast = function (msg, kind) {
    if (!toasts) {
      toasts = h("div", { class: "toasts" });
      document.body.appendChild(toasts);
    }
    var t = h("div", {
      class: "toast" + (kind === "error" ? " error" : ""),
      tid: "app-toast",
      role: kind === "error" ? "alert" : "status",
      text: msg,
    });
    toasts.appendChild(t);
    setTimeout(function () {
      t.remove();
    }, 5200);
  };
  // 建立對話框：回傳 {el, body, foot, open(trigger), close()}
  P.dialog = function (tid, title, opts) {
    opts = opts || {};
    var d = h("dialog", {
      class: "sheet",
      tid: tid,
      "aria-labelledby": tid + "-title",
    });
    if (opts.alert) d.setAttribute("role", "alertdialog");
    var titleEl = h("h2", { id: tid + "-title", tabindex: "-1", text: title });
    var body = h("div", { class: "dlg-body" }),
      foot = h("div", { class: "sheet-foot" });
    d.appendChild(h("div", { class: "sheet-in" }, titleEl, body, foot));
    document.body.appendChild(d);
    var trigger = null;
    d.addEventListener("close", function () {
      if (trigger && trigger.focus) trigger.focus();
    });
    d.addEventListener("click", function (e) {
      if (e.target === d) d.close();
    });
    return {
      el: d,
      body: body,
      foot: foot,
      title: titleEl,
      open: function (t) {
        trigger = t || document.activeElement;
        if (!d.open) d.showModal();
        titleEl.focus();
      },
      close: function () {
        if (d.open) d.close();
      },
      setTitle: function (s) {
        titleEl.textContent = s;
      },
    };
  };
  P.confirm = function (
    tid,
    title,
    text,
    confirmLabel,
    cancelLabel,
    onOk,
    danger,
  ) {
    var dlg = P.dialog(tid, title);
    dlg.body.appendChild(h("p", { class: "lead", text: text }));
    var ok = h("button", {
      class: "btn " + (danger ? "danger" : "primary"),
      tid: tid + "-confirm",
      text: confirmLabel,
      onclick: function () {
        dlg.close();
        onOk();
      },
    });
    var no = h("button", {
      class: "btn",
      tid: tid + "-cancel",
      text: cancelLabel,
      onclick: function () {
        dlg.close();
      },
    });
    dlg.foot.appendChild(no);
    dlg.foot.appendChild(ok);
    return dlg;
  };

  /* ---------- 假資料（場地預約業務） ---------- */
  P.USERS = {
    employee: {
      id: "u-chen",
      name: "陳小明",
      email: "chen@example.com",
      roles: ["員工"],
    },
    reviewer: {
      id: "u-lin",
      name: "林審核",
      email: "lin@example.com",
      roles: ["員工", "審核者"],
    },
    admin: {
      id: "u-wang",
      name: "王管理",
      email: "wang@example.com",
      roles: ["員工", "管理員"],
    },
  };
  P.me = P.USERS[P.role];
  P.VENUES = [
    {
      id: "v1",
      name: "201 會議室",
      loc: "總公司 2F",
      cap: 8,
      eq: ["投影機", "白板"],
      approval: false,
      reviewers: [],
      active: true,
    },
    {
      id: "v2",
      name: "大會議室",
      loc: "總公司 3F",
      cap: 20,
      eq: ["投影機", "視訊設備", "白板"],
      approval: true,
      reviewers: ["林審核", "黃審核"],
      active: true,
    },
    {
      id: "v3",
      name: "培訓教室",
      loc: "總公司 B1",
      cap: 40,
      eq: ["投影機", "麥克風"],
      approval: true,
      reviewers: ["林審核"],
      active: true,
    },
    {
      id: "v4",
      name: "小型討論室 A",
      loc: "總公司 2F",
      cap: 4,
      eq: ["白板"],
      approval: false,
      reviewers: [],
      active: true,
    },
    {
      id: "v5",
      name: "多功能活動室",
      loc: "分公司 5F",
      cap: 30,
      eq: ["投影機", "麥克風", "視訊設備"],
      approval: true,
      reviewers: [],
      active: false,
    },
  ];
  P.venue = function (id) {
    return P.VENUES.filter(function (v) {
      return v.id === id;
    })[0];
  };
  P.activeVenues = function () {
    return P.VENUES.filter(function (v) {
      return v.active;
    });
  };
  P.EQUIP = ["投影機", "白板", "視訊設備", "麥克風"];
  // 開放時段：週一至週六 09:00–18:00，週日不開放
  P.openRange = function (d) {
    return P.dow(d) === 0 ? null : [540, 1080];
  };
  P.slotState = function (venueId, d, m, ignoreHorizon) {
    var o = P.openRange(d);
    if (!o || m < o[0] || m >= o[1]) return "closed";
    if (d < P.NOW.date || (d === P.NOW.date && m < P.min(P.NOW.time)))
      return "closed";
    if (!ignoreHorizon && d > P.addDays(P.NOW.date, 30)) return "closed";
    if (venueId === "v1" && d === "2026-11-10" && m >= 720 && m < 840)
      return "maint";
    var seed = (venueId.charCodeAt(1) * 7 + ymd(d) / 86400000 + m / 30) % 11;
    if (
      seed < 2.2 ||
      (venueId === "v1" && d === "2026-11-09" && m >= 600 && m < 660)
    )
      return "booked";
    return "free";
  };

  /* ---------- 版面 ---------- */
  var NAVS = [
    ["venues.html", "場地", "all", "app-nav-venues"],
    // 「我的預約」頁沿用 001、002，不在本功能原型範圍；此處連到狀態入口，預約表單頁高亮此項
    ["states.html", "我的預約", "all", "app-nav-bookings"],
  ];
  P.unread = 3;
  P.setBadge = function () {
    var b = document.querySelector('[data-testid="app-notification-badge"]');
    if (!b) return;
    b.textContent = P.unread;
    b.hidden = P.unread <= 0;
    b.setAttribute("aria-label", "通知，" + P.unread + " 則未讀");
  };
  // need: 'admin' | 'reviewer' | undefined
  P.shell = function (active, need) {
    document.documentElement.lang = "zh-Hant-TW";
    var nav = h("nav", {
      class: "nav",
      tid: "app-nav",
      id: "nav",
      "aria-label": "主選單",
    });
    var forceChange = q.get("forced") === "1";
    NAVS.forEach(function (n, i) {
      if (n[2] === "reviewer" && P.role === "employee") return;
      if (n[2] === "admin" && P.role !== "admin") return;
      if (n[2] === "admin" && NAVS[i - 1][2] !== "admin")
        nav.appendChild(h("span", { class: "sep", "aria-hidden": "true" }));
      var a = h("a", { href: n[0] + "?role=" + P.role, tid: n[3] }, n[1]);
      if (n[0] === active) a.setAttribute("aria-current", "page");
      if (n[0] === "notifications.html")
        a.appendChild(
          h("span", {
            class: "badge",
            tid: "app-notification-badge",
            "aria-live": "polite",
          }),
        );
      nav.appendChild(a);
    });
    var user = h(
      "div",
      { class: "userbox", id: "userbox" },
      P.me.name,
      h(
        "a",
        {
          href: "#",
          tid: "app-change-password",
        },
        "變更密碼",
      ),
      h("a", { href: "#", tid: "app-logout", role: "button" }, "登出"),
    );
    var toggle = h("button", {
      class: "menu-btn",
      tid: "app-nav-toggle",
      "aria-expanded": "false",
      "aria-controls": "nav",
      text: "選單",
      onclick: function () {
        var o = nav.classList.toggle("open");
        user.classList.toggle("open", o);
        toggle.setAttribute("aria-expanded", o);
      },
    });
    document.body.appendChild(
      h(
        "header",
        { class: "topbar" },
        h(
          "div",
          { class: "topbar-in" },
          h("span", { class: "brand", text: "場地預約" }),
          toggle,
          nav,
          user,
        ),
      ),
    );
    var main = h("main", { class: "page", id: "main" });
    document.body.appendChild(main);
    P.setBadge();
    var denied =
      (need === "admin" && P.role !== "admin") ||
      (need === "reviewer" && P.role === "employee");
    if (denied) {
      main.appendChild(
        h(
          "div",
          { class: "state-box error", tid: "app-forbidden", role: "alert" },
          h("h2", { text: "沒有權限" }),
          h("p", { text: "你沒有權限使用這個頁面。請洽管理員。" }),
          h("a", {
            class: "btn",
            href: "states.html?role=" + P.role,
            text: "回到場地",
          }),
        ),
      );
      return null;
    }
    return main;
  };
  P.header = function (title, lead) {
    var f = document.createDocumentFragment();
    f.appendChild(h("h1", { text: title }));
    if (lead) f.appendChild(h("p", { class: "lead", text: lead }));
    return f;
  };
  P.skeleton = function (n, tid) {
    var ul = h("div", {
      class: "list",
      tid: tid,
      "aria-busy": "true",
      "aria-label": "載入中",
    });
    for (var i = 0; i < (n || 4); i++)
      ul.appendChild(h("div", { class: "skel skel-item" }));
    return ul;
  };
  P.stateBox = function (kind, tid, title, text, actions) {
    var b = h(
      "div",
      {
        class: "state-box " + (kind === "error" ? "error" : ""),
        tid: tid,
        role: kind === "error" ? "alert" : null,
      },
      h("h2", { text: title }),
      text ? h("p", { text: text }) : null,
    );
    (actions || []).forEach(function (a) {
      b.appendChild(a);
    });
    return b;
  };
  P.reloadBtn = function () {
    return h("button", {
      class: "btn",
      text: "重新載入",
      onclick: function () {
        location.href =
          location.pathname +
          location.search.replace(/[?&]state=[a-z]+/, "").replace(/^&/, "?");
      },
    });
  };
  P.suspension = function () {
    return h("div", {
      class: "alert warn",
      tid: "suspension-banner",
      role: "status",
      text: "您的預約權限已暫停至 2026年11月14日（週六）10:30。暫停期間無法新增預約、登記候補與確認遞補。",
    });
  };
  P.link = function (page, qs) {
    return page + "?role=" + P.role + (qs ? "&" + qs : "");
  };

  /* 假的預約資料（我的預約、管理員列表共用） */
  P.BOOKINGS = [
    {
      id: "b1",
      user: "陳小明",
      venue: "201 會議室",
      date: "2026-11-09",
      s: "10:00",
      e: "11:00",
      subject: "週會",
      n: 6,
      status: "confirmed",
      cancel: true,
      edit: true,
      checkin: true,
    },
    {
      id: "b2",
      user: "陳小明",
      venue: "大會議室",
      date: "2026-11-12",
      s: "14:00",
      e: "16:00",
      subject: "客戶簡報",
      n: 12,
      status: "pending",
      cancel: true,
      edit: true,
    },
    {
      id: "b3",
      user: "陳小明",
      venue: "小型討論室 A",
      date: "2026-11-17",
      s: "09:30",
      e: "10:30",
      subject: "一對一",
      n: 2,
      status: "confirmed",
      cancel: true,
      edit: true,
      series: [1, 4],
    },
    {
      id: "b4",
      user: "陳小明",
      venue: "小型討論室 A",
      date: "2026-11-24",
      s: "09:30",
      e: "10:30",
      subject: "一對一",
      n: 2,
      status: "pending",
      cancel: true,
      edit: false,
      editWhy: "審核完成後才能修改",
      series: [2, 4],
    },
    {
      id: "b5",
      user: "陳小明",
      venue: "培訓教室",
      date: "2026-10-28",
      s: "13:00",
      e: "15:00",
      subject: "新人訓練",
      n: 25,
      status: "completed",
      past: true,
    },
    {
      id: "b6",
      user: "陳小明",
      venue: "201 會議室",
      date: "2026-10-30",
      s: "09:00",
      e: "10:00",
      subject: "專案同步",
      n: 5,
      status: "cancelled",
      late: true,
      past: true,
      why: "取消原因：本人取消（由陳小明取消）",
    },
    {
      id: "b7",
      user: "陳小明",
      venue: "大會議室",
      date: "2026-11-02",
      s: "15:00",
      e: "16:00",
      subject: "部門會議",
      n: 15,
      status: "rejected",
      past: true,
      why: "駁回原因：該時段已保留給公司活動，請改選其他時段。",
    },
    {
      id: "b8",
      user: "陳小明",
      venue: "201 會議室",
      date: "2026-11-04",
      s: "10:00",
      e: "11:00",
      subject: "設計討論",
      n: 4,
      status: "no_show",
      past: true,
    },
  ];
})();

/* 影響預覽對話框（停用場地、停用帳號、設定維護時段共用）。需先載入 proto.js。 */
(function () {
  var h = P.h,
    cur = null;
  /* opts: tid, title, intro(預約數, 候補數) -> 說明文字, items: [文字], waitlist: 候補數, confirmLabel, cancelLabel, onConfirm(done), changed: 影響已變動時的最新 items */
  P.impactDialog = function (opts, trigger) {
    if (cur) cur.el.remove();
    var dlg = (cur = P.dialog(opts.tid, opts.title, { alert: true }));
    var intro = h("p", { class: "lead", tid: opts.tid + "-intro" });
    var list = h("ul", {
      tid: opts.tid + "-list",
      style: "margin:0 0 6px;padding-left:20px;line-height:1.7",
    });
    var warn = h("div", {
      class: "alert danger",
      role: "alert",
      hidden: true,
      tid: opts.tid + "-changed",
      text: "受影響的預約已有變動，尚未執行。請確認最新清單後再試一次。",
    });
    dlg.body.appendChild(warn);
    dlg.body.appendChild(intro);
    dlg.body.appendChild(list);
    function fill(items, wl) {
      list.innerHTML = "";
      if (!items.length)
        intro.textContent =
          "沒有受影響的預約。" + (wl ? "另有 " + wl + " 筆候補會失效。" : "");
      else intro.textContent = opts.intro(items.length, wl);
      items.forEach(function (t) {
        list.appendChild(h("li", { tid: opts.tid + "-item", text: t }));
      });
    }
    fill(opts.items, opts.waitlist || 0);
    var ok = h("button", {
      class: "btn danger",
      tid: opts.tid + "-confirm",
      text: opts.confirmLabel,
    });
    ok.addEventListener("click", function () {
      ok.disabled = true;
      ok.textContent = "處理中…";
      setTimeout(function () {
        ok.disabled = false;
        ok.textContent = opts.confirmLabel;
        if (opts.changedItems && !opts._done) {
          opts._done = true;
          warn.hidden = false;
          opts.items = opts.changedItems;
          fill(opts.items, opts.waitlist || 0);
          opts.changedItems = null;
          return;
        }
        var n = opts.items.length;
        dlg.close();
        opts.onConfirm(n, opts.waitlist || 0);
      }, 500);
    });
    dlg.foot.appendChild(
      h("button", {
        class: "btn",
        tid: opts.tid + "-cancel",
        text: opts.cancelLabel,
        onclick: function () {
          dlg.close();
        },
      }),
    );
    dlg.foot.appendChild(ok);
    dlg.open(trigger);
    return dlg;
  };
})();

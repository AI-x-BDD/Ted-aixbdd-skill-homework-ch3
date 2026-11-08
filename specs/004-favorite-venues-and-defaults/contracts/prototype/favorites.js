/* 收藏與預設值原型共用腳本（UI-01、UI-02、UI-03）。需先載入 proto.js。
   只用內嵌假資料；示範用的操作結果存在 localStorage，讓場地頁與預約表單之間看得到同一份收藏。
   這只是原型的取捨：正式畫面不得以瀏覽器儲存空間保存收藏或預設值（見 ui-contract.md 共用約定）。 */
(function () {
  var q = P.q,
    h = P.h;
  var KEY = "venue-proto-004:";
  function get(k, fallback) {
    try {
      var v = localStorage.getItem(KEY + k);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) {
      return fallback;
    }
  }
  function set(k, v) {
    try {
      localStorage.setItem(KEY + k, JSON.stringify(v));
    } catch (e) {}
  }
  P.proto004 = {
    reset: function () {
      try {
        Object.keys(localStorage)
          .filter(function (k) {
            return k.indexOf(KEY) === 0;
          })
          .forEach(function (k) {
            localStorage.removeItem(k);
          });
      } catch (e) {}
    },
  };

  /* ---------- 收藏 ---------- */
  // 預設收藏：大會議室（v2）、小型討論室 A（v4）、已停用的多功能活動室（v5，收藏保留但不顯示在選單）
  var SEED = ["v2", "v4", "v5"];
  var favsParam = q.get("favs");
  if (favsParam === "none") set("favs", []);
  else if (favsParam === "many")
    set(
      "favs",
      P.VENUES.map(function (v) {
        return v.id;
      }),
    );
  else if (favsParam === "default") set("favs", SEED);
  P.favorites = function () {
    var s = get("favs", null);
    return s ? s.slice() : SEED.slice();
  };
  P.isFav = function (id) {
    return P.favorites().indexOf(id) >= 0;
  };
  function saveFavs(list) {
    set("favs", list);
  }
  /* 假的「內層」：加入收藏（冪等）、取消收藏（冪等）、停用場地拒絕加入、失敗情境。
     回呼 cb({ok:true,fav:布林}) 或 cb({ok:false,reason:"disabled"|"failed"}) */
  P.setFavorite = function (venueId, want, cb) {
    setTimeout(function () {
      var v = P.venue(venueId);
      var kind = q.get("kind") || "toggle";
      if (P.state === "error" && kind === "toggle") return cb({ ok: false, reason: "failed" });
      if (want && P.state === "error" && kind === "disabled") return cb({ ok: false, reason: "disabled" });
      if (want && v && !v.active) return cb({ ok: false, reason: "disabled" });
      var list = P.favorites().filter(function (x) {
        return x !== venueId;
      });
      if (want) list.push(venueId); // 重複加入不會產生第二筆
      saveFavs(list);
      cb({ ok: true, fav: want });
    }, 450);
  };

  /* ---------- 場地選單分組（UI-02） ---------- */
  P.groupVenues = function (venues, favIds) {
    var fav = venues
      .filter(function (v) {
        return favIds.indexOf(v.id) >= 0;
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name, "zh-Hant");
      });
    var others = venues.filter(function (v) {
      return favIds.indexOf(v.id) < 0;
    });
    return { fav: fav, others: others };
  };
  /* 建立場地下拉選單。opts：placeholder（佔位文字）、flat（降級為不分組）、tidPrefix（分組定位前綴） */
  P.venueSelect = function (tid, venues, value, opts) {
    opts = opts || {};
    var s = h("select", { tid: tid, id: tid });
    function opt(v) {
      var o = h("option", { value: v.id, text: v.name + "（" + v.loc + "）" });
      if (v.id === value) o.selected = true;
      return o;
    }
    if (opts.placeholder) {
      var ph = h("option", { value: "", text: opts.placeholder });
      if (!value) ph.selected = true;
      s.appendChild(ph);
    }
    var g = P.groupVenues(venues, opts.flat ? [] : P.favorites());
    if (!g.fav.length) {
      venues.forEach(function (v) {
        s.appendChild(opt(v));
      });
      return s;
    }
    var p = opts.tidPrefix || "booking-venue";
    var gf = h("optgroup", { label: "我的收藏", tid: p + "-group-favorites" });
    g.fav.forEach(function (v) {
      gf.appendChild(opt(v));
    });
    var go = h("optgroup", { label: "其他場地", tid: p + "-group-others" });
    g.others.forEach(function (v) {
      go.appendChild(opt(v));
    });
    s.appendChild(gf);
    s.appendChild(go);
    return s;
  };

  /* ---------- 記住的預設值（UI-03） ---------- */
  var defParam = q.get("defaults");
  if (defParam === "none") set("defaults", "none");
  else if (defParam === "default") set("defaults", null);
  if (q.get("dur")) set("defaults", { att: 6, dur: parseInt(q.get("dur"), 10) });
  /* 回傳 {att, dur(分鐘)} 或 null（從未成功預約） */
  P.rememberedDefaults = function () {
    var d = get("defaults", null);
    if (d === "none") return null;
    return d || { att: 6, dur: 90 };
  };
  P.saveDefaults = function (att, durMin) {
    set("defaults", { att: att, dur: durMin });
  };
  /* 時長顯示：1 小時 30 分鐘 */
  P.fmtDur = function (min) {
    var hh = Math.floor(min / 60),
      mm = min % 60;
    return (hh ? hh + " 小時" : "") + (hh && mm ? " " : "") + (mm ? mm + " 分鐘" : "");
  };
  P.DUR_LIMIT = 240; // 單次時長上限（分鐘）：4 小時
})();

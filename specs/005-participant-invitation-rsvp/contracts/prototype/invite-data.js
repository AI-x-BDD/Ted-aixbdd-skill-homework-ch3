/* 邀請原型共用：同事帳號、Email 解析與驗證（假的「內層」）、回覆標籤。只用內嵌假資料，不呼叫後端。 */
(function () {
  var h = P.h;

  /* 系統內的帳號（假資料）：用來模擬查無帳號、帳號已停用、不能邀請自己 */
  P.ACCOUNTS = [
    { name: "陳小明", email: "chen@example.com", active: true },
    { name: "林審核", email: "lin@example.com", active: true },
    { name: "王管理", email: "wang@example.com", active: true },
    { name: "張雅婷", email: "yating@example.com", active: true },
    { name: "李大華", email: "dahua@example.com", active: true },
    { name: "吳建宏", email: "jianhong@example.com", active: true },
    { name: "周怡君", email: "yijun@example.com", active: true },
    { name: "蔡家豪", email: "jiahao@example.com", active: true },
    { name: "黃志偉", email: "zhiwei@example.com", active: false },
  ];
  P.SELF_EMAIL = "chen@example.com";

  /* 受邀 Email 解析（對應 frontend/src/lib/emails.js 的行為）：以逗號、空白、換行分隔；前後空白不計；不分大小寫去重 */
  P.splitEmails = function (text) {
    return String(text || "")
      .split(/[\s,，;；]+/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  };
  P.normEmail = function (s) {
    return String(s || "").trim().toLowerCase();
  };
  P.isEmailFormat = function (s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
  };
  P.uniqueEmails = function (list) {
    var seen = {},
      out = [];
    list.forEach(function (e) {
      var k = P.normEmail(e);
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push(e.trim());
    });
    return out;
  };
  P.hasDuplicate = function (list) {
    var seen = {},
      dup = false;
    list.forEach(function (e) {
      var k = P.normEmail(e);
      if (!k) return;
      if (seen[k]) dup = true;
      seen[k] = true;
    });
    return dup;
  };
  // 假的內層驗證：回傳 null 表示通過，否則回傳原因
  P.checkEmail = function (email, existing) {
    var k = P.normEmail(email);
    if (k === P.SELF_EMAIL) return "不能邀請自己";
    if (existing && existing.indexOf(k) >= 0) return "已在受邀名單中";
    var acc = P.ACCOUNTS.filter(function (a) {
      return a.email === k;
    })[0];
    if (!acc) return "查無帳號";
    if (!acc.active) return "帳號已停用";
    return null;
  };
  P.accountName = function (email) {
    var k = P.normEmail(email);
    var acc = P.ACCOUNTS.filter(function (a) {
      return a.email === k;
    })[0];
    return acc ? acc.name : email;
  };

  /* 回覆標籤：文字加顏色，不只靠顏色 */
  P.REPLY = { noreply: "未回覆", accepted: "已接受", declined: "已婉拒" };
  P.replyTag = function (reply, tid) {
    var cls = { noreply: "", accepted: "ok", declined: "danger" }[reply] || "";
    return h("span", { class: "tag " + cls, tid: tid, text: P.REPLY[reply] });
  };
  P.fmtSpan = function (b) {
    return P.fmtDate(b.date) + " " + b.s + "–" + b.e;
  };
})();

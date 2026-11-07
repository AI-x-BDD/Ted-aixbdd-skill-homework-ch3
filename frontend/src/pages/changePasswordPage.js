import { put } from "../api/client.js";
import { h } from "../lib/h.js";
import { currentUser } from "../router.js";
import { showToast } from "../components/toast.js";

function field(label, input, errorId, hint) {
  const err = h("div", { class: "err", testid: errorId, role: "alert" });
  const children = [h("label", { text: label }, input)];
  if (hint) {
    children.push(h("div", { class: "hint", text: hint }));
  }
  children.push(err);
  const wrap = h("div", { class: "field" }, ...children);
  wrap.err = err;
  return wrap;
}

export async function render(container) {
  const forced = Boolean(currentUser?.mustChangePassword);
  const wrap = h("main", { class: "auth-wrap page", testid: "auth-page" });
  const top = h(
    "div",
    { class: "auth-top row" },
    h("span", { class: "brand", text: "場地預約" }),
  );
  if (!forced) {
    top.append(
      h("a", { class: "btn ghost", href: "#/venues", text: "返回場地" }),
    );
  }
  wrap.append(top);
  wrap.append(h("h1", { text: "變更密碼" }));
  if (forced) {
    wrap.append(
      h("div", {
        class: "alert warn",
        testid: "auth-forced-notice",
        text: "管理員已重設您的密碼。請先設定新密碼，才能使用其他功能。",
      }),
    );
  }
  const pageError = h("div", { testid: "auth-page-error", hidden: true });
  const oldPw = h("input", {
    testid: "auth-old-password",
    type: "password",
    autocomplete: "current-password",
  });
  const newPw = h("input", {
    testid: "auth-new-password",
    type: "password",
    autocomplete: "new-password",
  });
  const confirmPw = h("input", {
    testid: "auth-confirm-password",
    type: "password",
    autocomplete: "new-password",
  });
  const oldField = field("舊密碼", oldPw, "auth-old-password-error");
  const newField = field(
    "新密碼",
    newPw,
    "auth-new-password-error",
    "長度須為 8 到 128 個字元。",
  );
  const confirmField = field(
    "再次輸入新密碼",
    confirmPw,
    "auth-confirm-password-error",
  );
  const submit = h("button", {
    class: "btn primary",
    type: "submit",
    testid: "auth-change-submit",
    text: "儲存新密碼",
  });
  const form = h(
    "form",
    { testid: "auth-change-form", novalidate: true },
    pageError,
    oldField,
    newField,
    confirmField,
    submit,
  );
  wrap.append(form);
  container.replaceChildren(wrap);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    oldField.err.textContent = "";
    newField.err.textContent = "";
    confirmField.err.textContent = "";
    pageError.hidden = true;
    let bad = false;
    if (newPw.value.length < 8 || newPw.value.length > 128) {
      newField.err.textContent = "新密碼長度須為 8 到 128 個字元。請重新輸入。";
      newPw.setAttribute("aria-invalid", "true");
      bad = true;
    }
    if (newPw.value !== confirmPw.value) {
      confirmField.err.textContent = "兩次輸入的新密碼不一致。請重新輸入。";
      confirmPw.setAttribute("aria-invalid", "true");
      bad = true;
    }
    if (bad) {
      return;
    }
    submit.disabled = true;
    submit.textContent = "儲存中…";
    form.setAttribute("aria-busy", "true");
    try {
      await put("/api/auth/password", {
        oldPassword: oldPw.value,
        newPassword: newPw.value,
      });
      showToast("密碼已變更，請用新密碼重新登入。");
      location.hash = "#/login";
    } catch (error) {
      submit.disabled = false;
      submit.textContent = "儲存新密碼";
      form.removeAttribute("aria-busy");
      const message =
        error.fields?.[0]?.message ??
        error.message ??
        "舊密碼不正確。請重新輸入。";
      if (error.fields?.some((item) => item.field === "oldPassword")) {
        oldField.err.textContent = message;
      } else {
        pageError.hidden = false;
        pageError.replaceChildren(
          h("div", { class: "alert danger", role: "alert", text: message }),
        );
      }
    }
  });
}

import { post } from "../api/client.js";
import { h } from "../lib/h.js";
import { consumeIntended, refreshCurrentUser } from "../router.js";

function field(label, input, errorId) {
  const err = h("div", { class: "err", testid: errorId, role: "alert" });
  const wrap = h(
    "div",
    { class: "field" },
    h("label", { text: label }, input),
    err,
  );
  wrap.err = err;
  return wrap;
}

export async function render(container, params = {}) {
  const wrap = h("main", { class: "auth-wrap page", testid: "auth-page" });
  wrap.append(
    h("h1", { text: "登入" }),
    h("p", { class: "lead", text: "場地／會議室預約系統" }),
  );
  if (params.notice === "changed" || location.hash.includes("changed")) {
    wrap.append(
      h("div", {
        class: "alert ok",
        testid: "auth-notice",
        role: "status",
        text: "密碼已變更，請用新密碼重新登入。",
      }),
    );
  }
  if (params.notice === "expired") {
    wrap.append(
      h("div", {
        class: "alert warn",
        testid: "auth-notice",
        role: "status",
        text: "登入已逾時，請重新登入。",
      }),
    );
  }
  const pageError = h("div", { testid: "auth-page-error", hidden: true });
  const loading = h("div", {
    class: "hint",
    testid: "auth-page-loading",
    role: "status",
    hidden: true,
    text: "處理中…",
  });
  const email = h("input", {
    testid: "auth-email",
    type: "email",
    autocomplete: "username",
  });
  const password = h("input", {
    testid: "auth-password",
    type: "password",
    autocomplete: "current-password",
  });
  const emailField = field("Email", email, "auth-email-error");
  const passwordField = field("密碼", password, "auth-password-error");
  const submit = h("button", {
    class: "btn primary",
    type: "submit",
    testid: "auth-login-submit",
    text: "登入",
  });
  const form = h(
    "form",
    { testid: "auth-login-form", novalidate: true },
    pageError,
    loading,
    emailField,
    passwordField,
    submit,
    h("p", {
      class: "hint",
      testid: "auth-forgot-hint",
      text: "請洽管理員重設密碼",
    }),
  );
  wrap.append(form);
  container.replaceChildren(wrap);
  email.focus();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    pageError.hidden = true;
    emailField.err.textContent = "";
    passwordField.err.textContent = "";
    const value = email.value.trim();
    let bad = false;
    if (!value) {
      emailField.err.textContent = "請輸入Email。";
      bad = true;
    }
    if (!password.value) {
      passwordField.err.textContent = "請輸入密碼。";
      bad = true;
    }
    if (bad) {
      return;
    }
    submit.disabled = true;
    email.disabled = true;
    password.disabled = true;
    form.setAttribute("aria-busy", "true");
    loading.hidden = false;
    submit.textContent = "登入中…";
    try {
      await post("/api/auth/login", { email: value, password: password.value });
      await refreshCurrentUser();
      const target = consumeIntended();
      const user = (await import("../router.js")).currentUser;
      location.hash = user?.mustChangePassword
        ? "#/change-password"
        : target || "#/venues";
    } catch (error) {
      submit.disabled = false;
      email.disabled = false;
      password.disabled = false;
      form.removeAttribute("aria-busy");
      loading.hidden = true;
      submit.textContent = "登入";
      password.value = "";
      const message =
        error.status === 0
          ? "無法連線到系統。請檢查網路後再試一次。"
          : error.status === 403
            ? "此帳號已停用。請洽管理員。"
            : "Email 或密碼錯誤。請確認後再試一次。";
      pageError.hidden = false;
      pageError.replaceChildren(
        h("div", { class: "alert danger", role: "alert", text: message }),
      );
      email.focus();
    }
  });
}

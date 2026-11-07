import { get, patch, post, put } from "../api/client.js";
import { openDialog } from "../components/dialog.js";
import { confirmImpact } from "../components/impactDialog.js";
import { mountPage, renderForbidden } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { h } from "../lib/h.js";
import { ROLE_LABELS } from "../../../shared/src/copy.js";
import { currentUser } from "../router.js";

function roleText(roles) {
  const names = [
    "一般員工",
    ...roles.map((role) => ROLE_LABELS[role]).filter(Boolean),
  ];
  return names.join("、");
}

export async function render(container) {
  if (!currentUser?.roles?.includes("admin")) {
    renderForbidden(container);
    return;
  }
  const root = h("div", { testid: "admin-users" });
  mountPage(container, "#/admin/users", root);
  const search = h("input", { type: "search", testid: "admin-users-search" });
  root.append(
    h(
      "div",
      { class: "row", style: "justify-content:space-between" },
      h("h1", { text: "帳號管理" }),
      h("button", {
        class: "btn primary",
        type: "button",
        testid: "user-add",
        text: "建立帳號",
        onClick: () => openForm(null),
      }),
    ),
    h(
      "div",
      { class: "field" },
      h("label", { text: "搜尋姓名或 Email" }, search),
    ),
  );
  const out = h("div");
  root.append(out);
  let users = [];

  async function load() {
    out.replaceChildren(
      h("div", { class: "skel skel-item", testid: "admin-users-loading" }),
    );
    out.setAttribute("aria-busy", "true");
    try {
      const data = await get("/api/users");
      users = data.items ?? [];
      draw();
    } catch {
      out.removeAttribute("aria-busy");
      out.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "admin-users-error" },
          h("p", { text: "無法載入帳號資料。請稍後按「重新載入」再試一次。" }),
          h("button", {
            class: "btn",
            type: "button",
            text: "重新載入",
            onClick: load,
          }),
        ),
      );
    }
  }

  function draw() {
    out.removeAttribute("aria-busy");
    const kw = search.value.trim().toLowerCase();
    const list = users.filter(
      (user) =>
        !kw ||
        user.name.toLowerCase().includes(kw) ||
        user.email.toLowerCase().includes(kw),
    );
    if (!list.length) {
      out.replaceChildren(
        h("div", {
          class: "state-box",
          testid: "admin-users-empty",
          text: "沒有符合的帳號。",
        }),
      );
      return;
    }
    const table = h("table", { class: "tbl", testid: "admin-users-list" });
    table.append(
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          ...["姓名", "Email", "角色", "狀態", "操作"].map((label) =>
            h("th", { text: label }),
          ),
        ),
      ),
    );
    const tbody = h("tbody");
    for (const user of list) {
      const status = h(
        "span",
        {},
        h("span", {
          class: `tag ${user.active ? "ok" : "danger"}`,
          text: user.active ? "啟用中" : "已停用",
        }),
      );
      if (user.mustChangePassword) {
        status.append(" ", h("span", { class: "tag warn", text: "待改密碼" }));
      }
      tbody.append(
        h(
          "tr",
          { testid: "admin-users-item", "data-id": String(user.id) },
          h("td", { "data-label": "姓名" }, h("strong", { text: user.name })),
          h("td", { "data-label": "Email", text: user.email }),
          h("td", { "data-label": "角色", text: roleText(user.roles) }),
          h("td", { "data-label": "狀態" }, status),
          h(
            "td",
            { "data-label": "操作" },
            h(
              "div",
              { class: "row" },
              h("button", {
                class: "btn sm",
                type: "button",
                testid: "user-edit",
                text: "編輯",
                onClick: () => openForm(user),
              }),
              h("button", {
                class: "btn sm",
                type: "button",
                testid: "user-reset-password-button",
                text: "重設密碼",
                onClick: () => resetPassword(user),
              }),
              user.active
                ? h("button", {
                    class: "btn sm",
                    type: "button",
                    testid: "user-disable-button",
                    text: "停用",
                    onClick: () => disableUser(user),
                  })
                : h("button", {
                    class: "btn sm",
                    type: "button",
                    testid: "user-enable-button",
                    text: "重新啟用",
                    onClick: () => enableUser(user),
                  }),
            ),
          ),
        ),
      );
    }
    table.append(tbody);
    out.replaceChildren(table);
  }

  search.addEventListener("input", draw);

  async function disableUser(user) {
    try {
      const preview = await get(`/api/users/${user.id}/deactivation-impact`);
      const result = await confirmImpact({
        title: `停用 ${user.name}`,
        testid: "user-impact-dialog",
        intro: (n, w) =>
          `停用後，以下 ${n} 筆未來預約會被取消，${w} 筆候補會失效。`,
        preview,
        confirmLabel: "確認停用並取消預約",
        cancelLabel: "先不要停用",
        submit: (bookingIds) =>
          post(`/api/users/${user.id}/deactivate`, { bookingIds }),
      });
      if (result) {
        showToast(
          `帳號已停用，已取消 ${result.cancelledBookingCount} 筆預約，${result.expiredWaitlistCount} 筆候補已失效。`,
        );
        await load();
      }
    } catch (error) {
      showToast(error.message ?? "無法停用帳號。", "error");
    }
  }

  async function enableUser(user) {
    await post(`/api/users/${user.id}/enable`);
    showToast("帳號已重新啟用。");
    await load();
  }

  async function openForm(user) {
    const email = h("input", {
      testid: "user-email",
      type: "email",
      value: user?.email ?? "",
      disabled: Boolean(user),
      autocomplete: "off",
    });
    const name = h("input", {
      testid: "user-name",
      type: "text",
      value: user?.name ?? "",
    });
    const password = h("input", {
      testid: "user-password",
      type: "password",
      autocomplete: "new-password",
    });
    const reviewer = h("input", {
      type: "checkbox",
      checked: user?.roles?.includes("reviewer"),
    });
    const admin = h("input", {
      type: "checkbox",
      checked: user?.roles?.includes("admin"),
    });
    const form = h(
      "form",
      { novalidate: true, testid: "user-roles" },
      h(
        "div",
        { class: "field" },
        h("label", { text: "Email" }, email),
        h("div", { class: "err", testid: "user-email-error", role: "alert" }),
      ),
      h(
        "div",
        { class: "field" },
        h("label", { text: "姓名" }, name),
        h("div", { class: "err", testid: "user-name-error", role: "alert" }),
      ),
      user
        ? null
        : h(
            "div",
            { class: "field" },
            h("label", { text: "初始密碼" }, password),
            h("div", {
              class: "hint",
              text: "長度須為 8 到 128 個字元。送出後不會再顯示。",
            }),
            h("div", {
              class: "err",
              testid: "user-password-error",
              role: "alert",
            }),
          ),
      h(
        "div",
        { class: "field" },
        h("span", { class: "lbl", text: "角色" }),
        h(
          "div",
          { class: "checks" },
          h(
            "label",
            {},
            h("input", { type: "checkbox", checked: true, disabled: true }),
            "一般員工",
          ),
          h("label", {}, reviewer, "場地審核者"),
          h("label", {}, admin, "系統管理員"),
        ),
        h("span", { class: "hint", text: "所有帳號都具備一般員工的權限。" }),
      ),
    );
    const result = await openDialog({
      title: user ? "編輯帳號" : "建立帳號",
      body: form,
      actions: [
        { label: "取消", value: null, testid: "user-form-dialog-cancel" },
        {
          label: user ? "儲存" : "建立帳號",
          value: "save",
          kind: "primary",
          testid: "user-save",
        },
      ],
    });
    if (result !== "save") {
      return;
    }
    const roles = [];
    if (reviewer.checked) roles.push("reviewer");
    if (admin.checked) roles.push("admin");
    try {
      if (user) {
        await patch(`/api/users/${user.id}`, {
          name: name.value.trim(),
          roles,
        });
        showToast("帳號已更新。");
      } else {
        await post("/api/users", {
          email: email.value,
          name: name.value.trim(),
          password: password.value,
          roles,
        });
        showToast("帳號已建立。");
      }
      await load();
    } catch (error) {
      showToast(
        error.message ?? "此 Email 已被使用。請改用其他 Email。",
        "error",
      );
    }
  }

  async function resetPassword(user) {
    const input = h("input", {
      testid: "user-reset-password-input",
      type: "password",
      autocomplete: "new-password",
    });
    const err = h("div", {
      class: "err",
      testid: "user-reset-password-input-error",
      role: "alert",
    });
    const result = await openDialog({
      title: `重設 ${user.name} 的密碼`,
      body: h(
        "div",
        {},
        h("p", {
          class: "lead",
          text: "使用者用這組密碼登入後，必須先自行設定新密碼。",
        }),
        h(
          "div",
          { class: "field" },
          h("label", { text: "新的臨時密碼" }, input),
          h("div", {
            class: "hint",
            text: "長度須為 8 到 128 個字元。送出後不會再顯示。",
          }),
          err,
        ),
      ),
      actions: [
        { label: "取消", value: null, testid: "user-reset-dialog-cancel" },
        {
          label: "重設密碼",
          value: "ok",
          kind: "primary",
          testid: "user-reset-dialog-confirm",
        },
      ],
    });
    if (result !== "ok") {
      return;
    }
    if (input.value.length < 8 || input.value.length > 128) {
      showToast("密碼長度須為 8 到 128 個字元。請重新輸入。", "error");
      return;
    }
    try {
      await put(`/api/users/${user.id}/password`, { newPassword: input.value });
      showToast(`已重設 ${user.name} 的密碼，對方下次登入須先改密碼。`);
      await load();
    } catch (error) {
      showToast(error.message ?? "無法重設密碼。請稍後再試一次。", "error");
    }
  }

  await load();
}

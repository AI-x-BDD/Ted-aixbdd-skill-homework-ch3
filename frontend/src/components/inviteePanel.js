import { INVITEE_PANEL_TEXT } from "../../../shared/src/copy.js";
import { del, get, post } from "../api/client.js";
import { parseInviteeEmails } from "../lib/emails.js";
import { h } from "../lib/h.js";
import { openDialog } from "./dialog.js";
import { showToast } from "./toast.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 預約詳情的受邀者面板（ui-contract.md › UI-03）。統計與人數一律顯示伺服器回傳的值，
// 前端不自行計算；畫面不出現任何改小場地的提示或場地推薦（FR-016）。
export function createInviteePanel({ bookingId, panelId }) {
  const heading = h("h3", {
    id: `${panelId}-t`,
    text: INVITEE_PANEL_TEXT.panelTitle,
  });
  const body = h("div", { class: "invitee-body" });
  const root = h(
    "section",
    {
      id: panelId,
      class: "invitee-panel",
      testid: "invitee-panel",
      role: "region",
      "aria-labelledby": `${panelId}-t`,
    },
    heading,
    body,
  );
  let current = null;

  function loadingEl() {
    return h("div", {
      class: "invitee-list",
      testid: "invitee-panel-loading",
      "aria-busy": "true",
    });
  }

  function itemRow(item, data) {
    let tagEl;
    if (item.status === "invalid") {
      tagEl = h("span", {
        class: "reply-tag reply-tag--invalid",
        testid: "invitee-invalid-tag",
        text: INVITEE_PANEL_TEXT.invalidTag,
      });
    } else if (item.status === "pending") {
      tagEl = h("span", {
        class: "reply-tag reply-tag--warn",
        testid: "invitee-unsent-tag",
        text: INVITEE_PANEL_TEXT.unsentTag,
      });
    } else {
      tagEl = h("span", {
        class: "reply-tag",
        testid: "invitee-reply-tag",
        text: INVITEE_PANEL_TEXT.replyLabels[item.response] ?? "",
      });
    }
    const children = [
      h("span", {
        class: "invitee-name-text",
        text: INVITEE_PANEL_TEXT.itemLabel(item.name, item.email),
      }),
      tagEl,
    ];
    if (item.canRemove !== undefined && item.status !== "invalid") {
      children.push(
        h("button", {
          class: "btn sm",
          type: "button",
          testid: "invitee-remove",
          "aria-label": INVITEE_PANEL_TEXT.removeButtonLabel(item.name),
          text: INVITEE_PANEL_TEXT.removeButton,
          disabled: !data.canAdjust,
          onClick: (event) => removeItem(item, event.currentTarget),
        }),
      );
    }
    return h(
      "li",
      {
        testid: "invitee-item",
        "data-id": String(item.invitationId),
        "aria-label": `${item.name}，${item.email}，${tagEl.textContent}`,
      },
      ...children,
    );
  }

  function statsEl(summary) {
    return h(
      "ul",
      { class: "invitee-stats", testid: "invitee-stats" },
      h("li", {
        testid: "invitee-stat-total",
        text: INVITEE_PANEL_TEXT.statTotal(summary.invited),
      }),
      h("li", {
        testid: "invitee-stat-accepted",
        text: INVITEE_PANEL_TEXT.statAccepted(summary.accepted),
      }),
      h("li", {
        testid: "invitee-stat-declined",
        text: INVITEE_PANEL_TEXT.statDeclined(summary.declined),
      }),
      h("li", {
        testid: "invitee-stat-noreply",
        text: INVITEE_PANEL_TEXT.statNoReply(summary.noReply),
      }),
      h("li", {
        testid: "invitee-stat-expected",
        text: INVITEE_PANEL_TEXT.statExpected(summary.expected),
      }),
    );
  }

  function compareEl(data) {
    return h(
      "div",
      { class: "invitee-compare", testid: "invitee-compare" },
      h("span", {
        testid: "invitee-compare-attendees",
        text: INVITEE_PANEL_TEXT.compareAttendees(data.attendees),
      }),
      h("span", {
        testid: "invitee-compare-capacity",
        text: INVITEE_PANEL_TEXT.compareCapacity(data.venueCapacity),
      }),
    );
  }

  function refreshButton() {
    return h("button", {
      class: "btn sm",
      type: "button",
      testid: "invitee-refresh",
      text: INVITEE_PANEL_TEXT.refresh,
      onClick: () => load({ refresh: true }),
    });
  }

  // 新增受邀者（FR-024）：不可調整時欄位與按鈕停用；送出期間 200 毫秒內停用
  function addSection(data) {
    const disabled = !data.canAdjust;
    const input = h("textarea", {
      testid: "invitee-add-input",
      rows: "2",
      placeholder: "name@example.com",
      disabled,
    });
    const problems = h("div", {
      class: "invitee-add-problems",
      testid: "invitee-add-problems",
      role: "alert",
      tabindex: "-1",
      hidden: true,
    });
    const submit = h("button", {
      class: "btn",
      type: "button",
      testid: "invitee-add-submit",
      text: INVITEE_PANEL_TEXT.addButton,
      disabled,
      onClick: () => addInvitees(input, submit, problems, data),
    });
    return h(
      "div",
      { class: "invitee-add", testid: "invitee-add" },
      h("h4", { text: INVITEE_PANEL_TEXT.addSectionTitle }),
      h("label", { text: INVITEE_PANEL_TEXT.addInputLabel }, input),
      problems,
      submit,
    );
  }

  function showAddProblems(problems, title, items) {
    problems.hidden = false;
    problems.replaceChildren(
      h("p", { text: title }),
      h(
        "ul",
        null,
        items.map((text) =>
          h("li", { testid: "invitee-add-problem-item", text }),
        ),
      ),
    );
    problems.focus();
  }

  async function addInvitees(input, submit, problems, data) {
    problems.hidden = true;
    problems.replaceChildren();
    const emails = parseInviteeEmails(input.value);
    if (!emails.length) {
      showAddProblems(problems, INVITEE_PANEL_TEXT.addProblemsTitle, [
        INVITEE_PANEL_TEXT.formatError,
      ]);
      return;
    }
    const malformed = emails.filter((email) => !EMAIL_PATTERN.test(email));
    if (malformed.length) {
      showAddProblems(
        problems,
        INVITEE_PANEL_TEXT.addProblemsTitle,
        malformed.map((email) =>
          INVITEE_PANEL_TEXT.addProblemItem(
            email,
            INVITEE_PANEL_TEXT.formatError,
          ),
        ),
      );
      return;
    }
    submit.disabled = true;
    input.disabled = true;
    submit.textContent = INVITEE_PANEL_TEXT.addPending;
    try {
      const result = await post(`/api/bookings/${bookingId}/invitations`, {
        emails,
      });
      const notice =
        data.bookingStatus === "pending"
          ? INVITEE_PANEL_TEXT.addedPending(result.addedCount)
          : INVITEE_PANEL_TEXT.addedConfirmed(result.addedCount);
      draw(result.invitees, { notice });
      showToast(notice);
    } catch (error) {
      submit.disabled = false;
      input.disabled = false;
      submit.textContent = INVITEE_PANEL_TEXT.addButton;
      if (error.inviteeProblems?.length) {
        showAddProblems(
          problems,
          INVITEE_PANEL_TEXT.addProblemsTitle,
          error.inviteeProblems.map((item) =>
            INVITEE_PANEL_TEXT.addProblemItem(
              item.email,
              INVITEE_PANEL_TEXT.addReasonText[item.reason] ?? item.message,
            ),
          ),
        );
      } else {
        showToast(error.message ?? INVITEE_PANEL_TEXT.adjustFailed, "error");
        await load({ refresh: true });
      }
    }
  }

  // 移除受邀者（FR-025）：先確認，移除後依邀請狀態說明是否會通知對方
  async function removeItem(item, button) {
    const confirmed = await openDialog({
      title: INVITEE_PANEL_TEXT.removeDialogTitle,
      body: h(
        "div",
        { testid: "invitee-remove-dialog" },
        h("p", {
          class: "lead",
          text:
            item.status === "pending"
              ? INVITEE_PANEL_TEXT.removeDialogPending(item.name)
              : INVITEE_PANEL_TEXT.removeDialogSent(item.name),
        }),
      ),
      actions: [
        {
          label: INVITEE_PANEL_TEXT.removeCancel,
          value: null,
          testid: "invitee-remove-dialog-cancel",
        },
        {
          label: INVITEE_PANEL_TEXT.removeConfirm,
          value: "ok",
          kind: "danger",
          testid: "invitee-remove-dialog-confirm",
        },
      ],
    });
    if (confirmed !== "ok") {
      return;
    }
    button.disabled = true;
    button.textContent = INVITEE_PANEL_TEXT.busy;
    try {
      const updated = await del(
        `/api/bookings/${bookingId}/invitations/${item.invitationId}`,
      );
      draw(updated, { notice: INVITEE_PANEL_TEXT.removed(item.name) });
    } catch (error) {
      showToast(error.message ?? INVITEE_PANEL_TEXT.adjustFailed, "error");
      await load({ refresh: true });
    }
  }

  function draw(data, { notice, failure } = {}) {
    current = data;
    const nodes = [];
    if (!data.canAdjust && data.adjustBlockedReason) {
      nodes.push(
        h("p", {
          class: "hint",
          testid: "invitee-adjust-disabled-reason",
          text:
            INVITEE_PANEL_TEXT.adjustBlocked[data.adjustBlockedReason] ?? "",
        }),
      );
    }
    if (!data.items.length) {
      nodes.push(
        h(
          "div",
          { class: "state-box", testid: "invitee-panel-empty" },
          h("h4", { text: INVITEE_PANEL_TEXT.emptyTitle }),
          h("p", { text: INVITEE_PANEL_TEXT.emptyBody }),
        ),
      );
    } else {
      if (data.summary) {
        nodes.push(statsEl(data.summary), compareEl(data));
        nodes.push(
          h("p", { class: "hint", text: INVITEE_PANEL_TEXT.expectedNote }),
        );
      }
      if (data.bookingStatus === "pending") {
        nodes.push(
          h("p", {
            class: "hint",
            testid: "invitee-pending-note",
            text: INVITEE_PANEL_TEXT.reviewNote,
          }),
        );
      }
      nodes.push(
        h(
          "ul",
          { class: "invitee-list", testid: "invitee-list" },
          data.items.map((item) => itemRow(item, data)),
        ),
      );
    }
    nodes.push(addSection(data));
    nodes.push(refreshButton());
    if (notice) {
      nodes.push(
        h("p", {
          class: "hint",
          testid: "invitee-refresh-result",
          role: "status",
          text: notice,
        }),
      );
    }
    if (failure) {
      nodes.push(
        h("p", {
          class: "hint",
          testid: "invitee-refresh-failed",
          role: "alert",
          text: failure,
        }),
      );
    }
    body.replaceChildren(...nodes);
  }

  function errorEl(error) {
    const forbidden = error.status === 403;
    return h(
      "div",
      {
        class: "state-box error",
        testid: "invitee-panel-error",
        role: "alert",
      },
      h("p", {
        text: forbidden
          ? INVITEE_PANEL_TEXT.forbidden
          : INVITEE_PANEL_TEXT.loadFailed,
      }),
      forbidden
        ? null
        : h("button", {
            class: "btn",
            type: "button",
            testid: "invitee-panel-retry",
            text: INVITEE_PANEL_TEXT.reload,
            onClick: () => load(),
          }),
    );
  }

  async function load({ refresh = false, notice = null } = {}) {
    if (refresh && current) {
      const button = body.querySelector('[data-testid="invitee-refresh"]');
      if (button) {
        button.disabled = true;
        button.textContent = INVITEE_PANEL_TEXT.refreshing;
      }
      body.setAttribute("aria-busy", "true");
    } else {
      body.replaceChildren(loadingEl());
    }
    try {
      const data = await get(`/api/bookings/${bookingId}/invitations`);
      body.removeAttribute("aria-busy");
      const message = notice ?? (refresh ? INVITEE_PANEL_TEXT.refreshed : null);
      draw(data, { notice: message });
      if (refresh && !notice) {
        showToast(INVITEE_PANEL_TEXT.refreshed);
      }
    } catch (error) {
      body.removeAttribute("aria-busy");
      if (refresh && current) {
        draw(current, { failure: INVITEE_PANEL_TEXT.refreshFailed });
        showToast(INVITEE_PANEL_TEXT.refreshFailed, "error");
      } else {
        body.replaceChildren(errorEl(error));
      }
    }
  }

  return { root, load };
}

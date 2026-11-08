import { INVITATION_TEXT } from "../../../shared/src/copy.js";
import { get, put } from "../api/client.js";
import { mountPage } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { h } from "../lib/h.js";

const REPLY_REASON_ID = "invitation-reply-reason";

function replyLabel(response) {
  return (
    INVITATION_TEXT.replyLabels[response] ?? INVITATION_TEXT.replyLabels.none
  );
}

function invitationCard(item) {
  const reply = replyLabel(item.response);
  const tags = [
    h("span", {
      class: "reply-tag",
      testid: "invitation-reply-tag",
      text: INVITATION_TEXT.replyPrefix + reply,
    }),
  ];
  if (item.status === "invalid") {
    tags.push(
      h("span", {
        class: "reply-tag reply-tag--invalid",
        testid: "invitation-invalid-tag",
        text: INVITATION_TEXT.invalidTag,
      }),
    );
  }
  if (item.bookingStatus === "pending") {
    tags.push(
      h("span", {
        class: "reply-tag reply-tag--warn",
        testid: "invitation-pending-tag",
        text: INVITATION_TEXT.pendingTag,
      }),
    );
  }
  if (item.bookingStarted) {
    tags.push(
      h("span", {
        class: "reply-tag",
        testid: "invitation-started-tag",
        text: INVITATION_TEXT.startedTag,
      }),
    );
  }
  return h(
    "li",
    {
      class: "invitation-card",
      testid: "invitation-item",
      "data-id": String(item.id),
      "aria-label": INVITATION_TEXT.cardAria(
        item.venueName,
        item.date,
        item.startTime,
        item.endTime,
        item.organizerName,
        reply,
      ),
    },
    h("div", { class: "title", text: item.venueName }),
    h("div", {
      class: "meta",
      text: INVITATION_TEXT.cardOrganizer(item.organizerName),
    }),
    h("div", {
      class: "meta",
      text: INVITATION_TEXT.cardTime(item.date, item.startTime, item.endTime),
    }),
    h("div", { class: "meta wrap-any", text: item.subject }),
    h("div", { class: "invitation-tags" }, tags),
    h("a", {
      class: "btn sm",
      href: `#/invitations/${item.id}`,
      testid: "invitation-open",
      text: INVITATION_TEXT.openLink,
    }),
  );
}

async function renderList(container) {
  const body = h("div");
  const root = h("div", { testid: "my-invitations" }, body);
  mountPage(
    container,
    "#/invitations",
    h("h1", { text: INVITATION_TEXT.pageTitle }),
    root,
  );

  function draw(items) {
    if (!items.length) {
      body.replaceChildren(
        h(
          "div",
          { class: "state-box", testid: "my-invitations-empty" },
          h("h2", { text: INVITATION_TEXT.emptyTitle }),
          h("p", { text: INVITATION_TEXT.emptyBody }),
        ),
      );
      return;
    }
    body.replaceChildren(
      h("p", { class: "hint", text: INVITATION_TEXT.listIntro }),
      h(
        "ul",
        { class: "invitation-list", testid: "invitation-list" },
        items.map((item) => invitationCard(item)),
      ),
    );
  }

  async function load() {
    body.replaceChildren(
      h(
        "div",
        {
          class: "invitation-list",
          testid: "my-invitations-loading",
          "aria-busy": "true",
        },
        h("div", { class: "invitation-card" }),
        h("div", { class: "invitation-card" }),
      ),
    );
    try {
      const result = await get("/api/invitations");
      draw(result.items ?? []);
    } catch {
      body.replaceChildren(
        h(
          "div",
          {
            class: "state-box error",
            testid: "my-invitations-error",
            role: "alert",
          },
          h("p", { text: INVITATION_TEXT.loadFailed }),
          h("button", {
            class: "btn",
            type: "button",
            text: INVITATION_TEXT.retry,
            onClick: load,
          }),
        ),
      );
    }
  }

  await load();
}

async function renderDetail(container, invitationId) {
  const body = h("div");
  const root = h(
    "div",
    { testid: "invitation-detail-page" },
    h("a", {
      class: "btn sm",
      href: "#/invitations",
      testid: "invitation-back",
      text: INVITATION_TEXT.backButton,
    }),
    body,
  );
  mountPage(container, "#/invitations", root);

  function draw(invitation, notice, focusTestid) {
    const canRespond = invitation.canRespond;
    const acceptBtn = h("button", {
      class: "btn",
      type: "button",
      testid: "invitation-reply-accept",
      text: INVITATION_TEXT.acceptButton,
      "aria-pressed": String(invitation.response === "accepted"),
      disabled: !canRespond,
      onClick: () => reply("accepted", acceptBtn),
    });
    const declineBtn = h("button", {
      class: "btn",
      type: "button",
      testid: "invitation-reply-decline",
      text: INVITATION_TEXT.declineButton,
      "aria-pressed": String(invitation.response === "declined"),
      disabled: !canRespond,
      onClick: () => reply("declined", declineBtn),
    });
    const reasonEl = canRespond
      ? null
      : h("p", {
          class: "hint",
          id: REPLY_REASON_ID,
          testid: "invitation-reply-disabled-reason",
          text:
            INVITATION_TEXT.cannotRespond[invitation.cannotRespondReason] ?? "",
        });
    if (!canRespond) {
      acceptBtn.setAttribute("aria-describedby", REPLY_REASON_ID);
      declineBtn.setAttribute("aria-describedby", REPLY_REASON_ID);
    }
    body.replaceChildren(
      h(
        "section",
        { class: "card invitation-detail", testid: "invitation-detail" },
        h("h1", { text: INVITATION_TEXT.detailTitle }),
        h("p", {
          testid: "invitation-detail-organizer",
          text: INVITATION_TEXT.detailOrganizer(invitation.organizerName),
        }),
        h("p", {
          testid: "invitation-detail-venue",
          text: INVITATION_TEXT.detailVenue(
            invitation.venueName,
            invitation.venueLocation,
          ),
        }),
        h("p", {
          testid: "invitation-detail-time",
          text: INVITATION_TEXT.detailTime(
            invitation.date,
            invitation.startTime,
            invitation.endTime,
          ),
        }),
        h("p", {
          testid: "invitation-detail-subject",
          text: INVITATION_TEXT.detailSubject(invitation.subject),
        }),
        h("p", {
          testid: "invitation-detail-reply",
          text: INVITATION_TEXT.detailReply(replyLabel(invitation.response)),
        }),
        invitation.status === "invalid"
          ? h("p", {
              class: "invitation-note",
              text: INVITATION_TEXT.invalidDetailNote,
            })
          : null,
        h("div", { class: "reply-buttons" }, acceptBtn, declineBtn),
        reasonEl,
        h("p", {
          class: "hint",
          testid: "invitation-reply-result",
          role: "status",
          text: notice ?? "",
        }),
      ),
    );
    if (focusTestid) {
      body.querySelector(`[data-testid="${focusTestid}"]`)?.focus();
    }
  }

  async function reply(value, clicked) {
    const acceptBtn = body.querySelector(
      '[data-testid="invitation-reply-accept"]',
    );
    const declineBtn = body.querySelector(
      '[data-testid="invitation-reply-decline"]',
    );
    for (const btn of [acceptBtn, declineBtn]) {
      if (btn) btn.disabled = true;
    }
    if (clicked) {
      clicked.textContent = INVITATION_TEXT.busy;
      clicked.setAttribute("aria-busy", "true");
    }
    try {
      const updated = await put(`/api/invitations/${invitationId}/response`, {
        response: value,
      });
      const notice =
        value === "accepted"
          ? INVITATION_TEXT.repliedAccepted
          : INVITATION_TEXT.repliedDeclined;
      showToast(notice);
      draw(
        updated,
        notice,
        value === "accepted"
          ? "invitation-reply-accept"
          : "invitation-reply-decline",
      );
    } catch (error) {
      const message =
        error.status === 0 || !error.message
          ? INVITATION_TEXT.respondFailed
          : error.message;
      showToast(message, "error");
      await load();
    }
  }

  async function load() {
    body.replaceChildren(
      h("div", {
        class: "invitation-card",
        testid: "invitation-detail-loading",
        "aria-busy": "true",
      }),
    );
    try {
      const invitation = await get(`/api/invitations/${invitationId}`);
      draw(invitation);
    } catch (error) {
      if (error.status === 404) {
        body.replaceChildren(
          h(
            "div",
            {
              class: "state-box error",
              testid: "invitation-detail-error",
              role: "alert",
            },
            h("p", { text: INVITATION_TEXT.notFound }),
            h("a", {
              class: "btn",
              href: "#/invitations",
              text: INVITATION_TEXT.backToList,
            }),
          ),
        );
        return;
      }
      body.replaceChildren(
        h(
          "div",
          {
            class: "state-box error",
            testid: "invitation-detail-error",
            role: "alert",
          },
          h("p", { text: INVITATION_TEXT.loadFailed }),
          h("button", {
            class: "btn",
            type: "button",
            text: INVITATION_TEXT.retry,
            onClick: load,
          }),
        ),
      );
    }
  }

  await load();
}

export async function render(container, params = {}) {
  if (params.invitationId) {
    await renderDetail(container, params.invitationId);
    return;
  }
  await renderList(container);
}

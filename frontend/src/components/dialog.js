import { h } from "../lib/h.js";

export function openDialog({ title, body, actions = [] }) {
  const trigger = document.activeElement;
  return new Promise((resolve) => {
    let result = null;
    const dialog = h("dialog", {
      class: "sheet",
      "aria-labelledby": "dialog-title",
    });
    const titleEl = h("h2", {
      id: "dialog-title",
      tabindex: "-1",
      text: title,
    });
    const bodyEl = h("div", { class: "dlg-body" });
    if (typeof body === "string") {
      bodyEl.append(h("p", { class: "lead", text: body }));
    } else if (body) {
      bodyEl.append(body);
    }
    const foot = h("div", { class: "sheet-foot" });
    for (const action of actions) {
      foot.append(
        h("button", {
          class: `btn ${action.kind ?? ""}`.trim(),
          testid: action.testid,
          type: "button",
          text: action.label,
          onClick: () => {
            result = action.value;
            dialog.close();
          },
        }),
      );
    }
    dialog.append(h("div", { class: "sheet-in" }, titleEl, bodyEl, foot));
    document.body.append(dialog);
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove();
        if (trigger && typeof trigger.focus === "function") {
          trigger.focus();
        }
        resolve(result);
      },
      { once: true },
    );
    dialog.showModal();
    titleEl.focus();
  });
}

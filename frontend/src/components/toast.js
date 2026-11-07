import { h } from "../lib/h.js";

let container;

export function showToast(message, kind = "status") {
  if (!container) {
    container = h("div", { class: "toasts" });
    document.body.append(container);
  }
  const toast = h("div", {
    class: kind === "error" ? "toast error" : "toast",
    testid: "app-toast",
    role: kind === "error" ? "alert" : "status",
    text: message,
  });
  container.append(toast);
  setTimeout(() => toast.remove(), 5200);
}

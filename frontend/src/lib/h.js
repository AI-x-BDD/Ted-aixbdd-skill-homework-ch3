export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) {
      continue;
    }
    if (key === "class") {
      el.className = value;
    } else if (key === "text") {
      el.textContent = value;
    } else if (key === "testid") {
      el.setAttribute("data-testid", value);
    } else if (key.startsWith("on") && typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key.startsWith("aria-") || key.startsWith("data-")) {
      el.setAttribute(key, String(value));
    } else if (key === "value") {
      el.value = value;
    } else if (
      key === "checked" ||
      key === "disabled" ||
      key === "hidden" ||
      key === "open"
    ) {
      el[key] = Boolean(value);
    } else {
      el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  for (const child of children.flat()) {
    if (child == null || child === false) {
      continue;
    }
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

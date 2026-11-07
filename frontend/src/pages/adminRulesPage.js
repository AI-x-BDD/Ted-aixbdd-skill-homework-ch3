import { get, put } from "../api/client.js";
import { mountPage, renderForbidden } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { h } from "../lib/h.js";
import { formatTaipei } from "../../../shared/src/taipei.js";
import { currentUser } from "../router.js";

const UNIT = {
  hours: "小時",
  days: "天",
  count: "筆",
  batches: "批",
  months: "個月",
  minutes: "分鐘",
  times: "次",
};

export async function render(container) {
  if (!currentUser?.roles?.includes("admin")) {
    renderForbidden(container);
    return;
  }
  const root = h("div", { testid: "admin-rules" });
  mountPage(container, "#/admin/rules", root);
  root.append(
    h("h1", { text: "規則管理" }),
    h("p", {
      class: "lead",
      text: "規則為全公司共用。調整只影響之後的新操作，既有預約不會改變。",
    }),
  );
  const out = h("div");
  root.append(out);
  let rules = [];
  let log = [];
  let logTotal = 0;
  let editing = null;

  async function load() {
    out.replaceChildren(
      h("div", { class: "skel skel-item", testid: "admin-rules-loading" }),
    );
    try {
      const [ruleData, logData] = await Promise.all([
        get("/api/rules"),
        get("/api/rules/changes?limit=20"),
      ]);
      rules = ruleData.items ?? [];
      log = logData.items ?? [];
      logTotal = logData.total ?? log.length;
      draw();
    } catch {
      out.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "admin-rules-error" },
          h("p", { text: "無法載入規則。請稍後按「重新載入」再試一次。" }),
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

  async function loadMoreLog() {
    const last = log.at(-1);
    const data = await get(
      `/api/rules/changes?limit=20${last ? `&beforeId=${last.id}` : ""}`,
    );
    log = log.concat(data.items ?? []);
    logTotal = data.total ?? logTotal;
    draw();
  }

  function draw() {
    const table = h("table", { class: "tbl", testid: "admin-rules-list" });
    table.append(
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          ...["規則", "目前值", "單位", "操作"].map((label) =>
            h("th", { text: label }),
          ),
        ),
      ),
    );
    const tbody = h("tbody");
    for (const rule of rules) {
      const tr = h(
        "tr",
        { testid: "rule-row", "data-id": rule.key },
        h("td", { "data-label": "規則" }, h("strong", { text: rule.name })),
      );
      if (editing === rule.key) {
        const input = h("input", {
          testid: "rule-input",
          type: "text",
          inputmode: "numeric",
          value: String(rule.value),
          "aria-label": rule.name,
          id: `inp-${rule.key}`,
        });
        const err = h("div", {
          class: "err",
          testid: "rule-input-error",
          id: `err-${rule.key}`,
          role: "alert",
          hidden: true,
        });
        const save = h("button", {
          class: "btn primary sm",
          type: "button",
          testid: "rule-save",
          text: "儲存",
          onClick: async () => {
            const value = input.value.trim();
            if (!/^[1-9][0-9]*$/.test(value)) {
              err.hidden = false;
              err.textContent = "須為正整數。請輸入 1 以上的整數。";
              input.setAttribute("aria-invalid", "true");
              input.focus();
              return;
            }
            save.disabled = true;
            try {
              await put(`/api/rules/${rule.key}`, {
                value: Number.parseInt(value, 10),
              });
              showToast(
                `已將${rule.name}改為 ${value}${UNIT[rule.unit] ?? rule.unit}。`,
              );
              editing = null;
              await load();
            } catch (error) {
              showToast(
                error.message ?? `無法儲存${rule.name}。請稍後再試一次。`,
                "error",
              );
              save.disabled = false;
            }
          },
        });
        tr.append(
          h("td", { "data-label": "目前值" }, input, err),
          h("td", { "data-label": "單位", text: UNIT[rule.unit] ?? rule.unit }),
          h(
            "td",
            { "data-label": "操作" },
            h(
              "div",
              { class: "row" },
              save,
              h("button", {
                class: "btn sm",
                type: "button",
                testid: "rule-cancel",
                text: "取消",
                onClick: () => {
                  editing = null;
                  draw();
                },
              }),
            ),
          ),
        );
      } else {
        tr.append(
          h("td", { "data-label": "目前值", text: String(rule.value) }),
          h("td", { "data-label": "單位", text: UNIT[rule.unit] ?? rule.unit }),
          h(
            "td",
            { "data-label": "操作" },
            h("button", {
              class: "btn sm",
              type: "button",
              testid: "rule-edit",
              text: "修改",
              onClick: () => {
                editing = rule.key;
                draw();
              },
            }),
          ),
        );
      }
      tbody.append(tr);
    }
    table.append(tbody);
    const nodes = [
      table,
      h("h2", { text: "變更紀錄" }),
      h("p", { class: "hint", text: "變更紀錄不可修改或刪除。" }),
    ];
    if (!log.length) {
      nodes.push(
        h("div", {
          class: "state-box",
          testid: "admin-rules-empty",
          text: "尚無變更紀錄。",
        }),
      );
      out.replaceChildren(...nodes);
      return;
    }
    const ul = h("ul", { class: "list", testid: "rule-change-log" });
    for (const item of log) {
      ul.append(
        h("li", {
          class: "item",
          testid: "rule-change-log-item",
          text: `${formatTaipei(new Date(item.changedAt))}｜${item.actorName}｜${item.ruleName}：${item.oldValue} → ${item.newValue}`,
        }),
      );
    }
    nodes.push(ul);
    if (log.length < logTotal) {
      nodes.push(
        h("button", {
          class: "btn",
          type: "button",
          testid: "rule-change-log-load-more",
          text: "載入更多",
          onClick: loadMoreLog,
        }),
      );
    }
    out.replaceChildren(...nodes);
  }

  await load();
}

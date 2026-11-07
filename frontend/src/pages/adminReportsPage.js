import { get } from "../api/client.js";
import { mountPage, renderForbidden } from "../components/nav.js";
import { showToast } from "../components/toast.js";
import { h } from "../lib/h.js";
import { currentUser } from "../router.js";

export async function render(container) {
  if (!currentUser?.roles?.includes("admin")) {
    renderForbidden(container);
    return;
  }
  const root = h("div", { testid: "admin-reports" });
  mountPage(container, "#/admin/reports", root);
  root.append(
    h("h1", { text: "報表" }),
    h("p", {
      class: "lead",
      text: "以開始時間落在區間內的預約計算；時間以台北時間（UTC+8）為準。",
    }),
  );
  const from = h("input", { testid: "report-from", type: "date" });
  const to = h("input", { testid: "report-to", type: "date" });
  const toErr = h("div", { class: "err", testid: "report-to-error" });
  const submit = h("button", {
    class: "btn primary",
    type: "submit",
    testid: "report-submit",
    text: "產生報表",
  });
  const exp = h("button", {
    class: "btn",
    type: "button",
    testid: "report-export-csv",
    text: "匯出 CSV",
    disabled: true,
  });
  const form = h(
    "form",
    { class: "card", novalidate: true, style: "margin-bottom:14px" },
    h(
      "div",
      { class: "grid2" },
      h("div", { class: "field" }, h("label", { text: "開始日期" }, from)),
      h("div", { class: "field" }, h("label", { text: "結束日期" }, to), toErr),
    ),
    h("div", { class: "row" }, submit, exp),
  );
  const out = h("div", { "aria-live": "polite" });
  root.append(form, out);
  let current = null;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!from.value || !to.value) {
      out.replaceChildren(
        h("div", {
          class: "state-box",
          testid: "admin-reports-empty",
          text: "請選擇日期區間後產生報表",
        }),
      );
      return;
    }
    if (to.value < from.value) {
      toErr.textContent =
        "日期區間不正確：結束日期不可早於開始日期。請重新選擇。";
      return;
    }
    toErr.textContent = "";
    submit.disabled = true;
    submit.textContent = "產生中…";
    out.setAttribute("aria-busy", "true");
    try {
      const report = await get(
        `/api/reports?from=${from.value}&to=${to.value}`,
      );
      current = report;
      draw(report);
    } catch (error) {
      out.replaceChildren(
        h(
          "div",
          { class: "state-box error", testid: "admin-reports-error" },
          h("p", {
            text:
              error.message ?? "無法產生報表。請稍後按「重新載入」再試一次。",
          }),
          h("button", {
            class: "btn",
            type: "button",
            text: "重新載入",
            onClick: () => form.requestSubmit(),
          }),
        ),
      );
    } finally {
      submit.disabled = false;
      submit.textContent = "產生報表";
      out.removeAttribute("aria-busy");
    }
  });

  exp.addEventListener("click", () => {
    if (!current) return;
    const a = h("a", {
      href: `/api/reports/csv?from=${current.from}&to=${current.to}`,
      download: `場地報表_${current.from}_${current.to}.csv`,
    });
    document.body.append(a);
    a.click();
    a.remove();
    showToast("已匯出 CSV。");
  });

  function draw(report) {
    const table = h(
      "table",
      { class: "tbl", testid: "report-table" },
      h("caption", {
        style: "text-align:left;font-weight:700;padding:8px 0",
        text: `${report.from} 至 ${report.to} 各場地報表`,
      }),
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          ...[
            "場地",
            "使用率",
            "尖峰時段",
            "取消率",
            "逾時取消筆數",
            "未到場率",
          ].map((label) => h("th", { text: label })),
        ),
      ),
    );
    const tbody = h("tbody");
    for (const venue of report.venues ?? []) {
      const noData = venue.cancellation?.display === "無資料";
      tbody.append(
        h(
          "tr",
          { testid: "report-row" },
          h(
            "td",
            { "data-label": "場地" },
            h("strong", { text: venue.venueName }),
          ),
          h("td", {
            "data-label": "使用率",
            text: venue.utilization?.display ?? "無資料",
          }),
          h("td", {
            "data-label": "尖峰時段",
            text: venue.peakDisplay ?? "無資料",
          }),
          h("td", {
            "data-label": "取消率",
            text: venue.cancellation?.display ?? "無資料",
          }),
          h("td", {
            "data-label": "逾時取消筆數",
            text: noData ? "無資料" : String(venue.lateCancelCount ?? 0),
          }),
          h("td", {
            "data-label": "未到場率",
            text: venue.noShow?.display ?? "無資料",
          }),
        ),
      );
    }
    table.append(tbody);
    out.replaceChildren(table);
    exp.disabled = false;
  }

  out.replaceChildren(
    h("div", {
      class: "state-box",
      testid: "admin-reports-empty",
      text: "請選擇日期區間後產生報表",
    }),
  );
}

# aixbdd-skill-homework-ch3

> 用這份 README 當範例，改成你自己的版本。repo 名稱請當成自己的作品集來命名。各節都可以改寫或刪除，只有文末的官方區塊要保留。

## 關於這個 repo

我在這個 repo 整理了規格驅動開發（SDD）相關的 skills，並以「場地預約系統」為題，從功能規格、技術研究、系統分析到實作走完整條產線。相較 1A2B，這個系統要處理多角色權限、七種預約狀態、時段併發與候補遞補等規則，specs 與程式產物都留在 repo 裡，方便對照規格與實作。

## 結構說明

| 路徑 | 內容 |
|---|---|
| `.claude/skills/` | Claude Code 格式的 skills |
| `.agents/skills/` | Codex／.agents 格式的 skills |
| `VERSION` | template 版本 |
| `specs/` | 各功能的 Spec Package（`spec.md`、`plan.md`、`tasks.md` 等） |
| `backend/`、`frontend/` | 場地預約系統實作 |
| `scripts/db.sh` | 本機 MySQL（Docker）管理腳本 |

## 道館作業

本 repo 用於繳交場地預約系統 SDD 實作：

1. 我依《AI x BDD》課程平台道館頁列出的題目與完成條件，完成該館要求的 skills。
2. 我錄製了一支 3 分鐘內的 demo 影片，呈現 skill 的實際執行過程。
3. 我在《AI x BDD》課程平台的道館頁貼上本 repo 連結與影片連結，完成繳交。

## Skills 與設計想法

以下說明這個 repo 收錄的 skills，以及我設計時的考量。流程大致為：訂憲法 → 寫規格與澄清 → 技術研究 → 系統分析與各端 Planner → 任務拆解 → 實作前分析 → 依任務實作。

### `constitution`

- **用途**：為專案訂立或增修憲法（`.claude/constitution/`），約束 SDD 各階段產出物的內容與格式。
- **使用時機**：新專案開局，或某類產物反覆品質不穩、需要升格成硬性約束時。
- **設計想法**：憲法只寫與這次變更相關的最小條款，避免一次塞滿說明書；下游 skill 只讀不猜，analyze 再負責檢查有沒有違憲。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `specify`

- **用途**：把功能描述轉成功能規格書 `specs/NNN-英文名/spec.md`。
- **使用時機**：有新故事要開案，或要把口頭需求收成可驗收的規格時。
- **設計想法**：先委派 clarify 補缺口，再依樣板產出；規格裡不混入技術方案與任務，職責邊界清楚。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `clarify`

- **用途**：需求缺漏、矛盾或尚未拍板時，直接訪談使用者拍板，不由 AI 自行補完。
- **使用時機**：specify、technical-research 等 skill 需要使用者決策時；或由 `/clarify` 單獨呼叫。
- **設計想法**：每題附 Context 與 Options，把猜測變成明確選擇；寫回產物交給呼叫方，clarify 本身不亂改檔案。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `clarify-over-specs`

- **用途**：在技術研究前主動掃描 `spec.md` 盲點、與使用者澄清並寫回規格。
- **使用時機**：specify 完成後、進 technical-research 之前。
- **設計想法**：用需求覆蓋分類法找洞，再依影響力決定問什麼；多輪澄清由使用者決定要不要繼續，最後輸出覆蓋總表。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `technical-research`

- **用途**：依指定技術方向產出 `research.md` 與 `techstack.md`。
- **使用時機**：已有 `spec.md`，要定下技術堆疊與研究結論時。
- **設計想法**：技術不確定的部分先 clarify，再寫研究紀錄；資料模型、契約與任務拆解留給後面的 skill。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `system-analysis`

- **用途**：從 spec 盤點端點與介面，產出 `plan.md` 並依 Wave 委派各 Planner 寫介面文檔。
- **使用時機**：已有 `spec.md` 與技術研究產物。
- **設計想法**：由外而內排相依性，避免先挖資料層卻不知道 API 長什麼樣；Planner 分工讓每種端點用同一套分析節奏。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `planner-provisioning`

- **用途**：依 `plan.md` 的 Wave 確認需要的 Planner skill 是否齊全，缺就補建。
- **使用時機**：`system-analysis` 產出 `plan.md` 之後、執行分析 Wave 之前。
- **設計想法**：依介面 ID 前綴對照既有 skill，避免 Wave 中途才發現沒有對應的 Planner。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `api-plan`

- **用途**：執行 Wave 中後端（介面 ID 前綴 `API`）的分析與介面文檔。
- **使用時機**：`plan.md` 標註的 API 端點輪到分析時。
- **設計想法**：與 `data-plan`、`ui-ux-plan` 等採相同 Planner 骨架，產物格式一致，方便 task 掛錨點。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `data-plan`

- **用途**：執行 Wave 中資料庫端（介面 ID 前綴 `DB`）的分析與介面文檔。
- **使用時機**：`plan.md` 標註的 DB 端點輪到分析時。
- **設計想法**：遷移、觸發器與併發假設在這裡寫清楚，減少 implement 時才補 schema。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `storage-plan`

- **用途**：執行 Wave 中檔案系統端（介面 ID 前綴 `FS`）的分析與介面文檔。
- **使用時機**：功能涉及檔案儲存或路徑約束時。
- **設計想法**：本專題以資料庫與 API 為主，此 skill 預留與官方 pipeline 對齊；有 FS 端點時才啟用。
- **驗證狀態**：未驗證（本 repo 場地預約主線未使用 FS 端點）。

### `ui-ux-plan`

- **用途**：執行 Wave 中前端（介面 ID 前綴 `UI`）的分析與介面文檔。
- **使用時機**：`plan.md` 標註的 UI 端點輪到分析時。
- **設計想法**：畫面狀態、錯誤呈現與 testid 在這裡定好，implement 時前端才跟得動 OpenAPI／UI contract。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `task`

- **用途**：依 `plan.md` 與各端介面文檔產出 `tasks.md`，含可觀察完成判準與必讀錨點。
- **使用時機**：系統分析與介面文檔完成後、開寫程式之前。
- **設計想法**：任務只涵蓋實作；測試腳本本體不在這裡拆，避免 tasks 膨脹成規格複本。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `analyze`

- **用途**：實作前檢查 spec、研究、plan、介面文檔與 tasks 之間的一致性與覆蓋缺口，只輸出報告不改檔。
- **使用時機**：`tasks.md` 完成後、大規模 implement 之前。
- **設計想法**：雙向追溯找漏網與憲法違反；修正仍交給產出該產物的 skill，避免 analyze 越權改規格。
- **驗證狀態**：已在場地預約系統專案中實際使用。

### `implement`

- **用途**：依 `tasks.md` 逐任務實作成程式碼，完成後勾選任務並產出驗收報告。
- **使用時機**：分析通過或使用者決定仍要開工時。
- **設計想法**：任務必讀錨點讀不完就停；與 spec 衝突時回報而不是硬寫，維持規格驅動。
- **驗證狀態**：已在場地預約系統專案中實際使用。

## 交流

這些 skills 歡迎直接取用，或依你的專案調整。如果有使用上的問題或改進建議，歡迎開 issue 與我討論。

---

## 官方宣告（以下區塊請保留）

本 repo 為[水球軟體學院](https://world.waterballsa.tw)《AI x BDD：規格驅動全自動化開發術》課程的學員產出，用於公告課程中道館作業的展示，並依[官方 Template](https://github.com/AI-x-BDD/aixbdd-skill-homework-template) 建立。

《AI x BDD：規格驅動全自動化開發術》課程四大特色：

1. **【軟工方法論＋結果導向】**
   只談 AI coding 不談軟工方法論，是不學無術！課程中強調結果導向的開發方法：只要訂好驗收標準，就可以 One-Shot 開發到位！
2. **【最完整的 SDD 概念與實作】**
   市面上最完整的 SDD 課程，一次教你 Skills、SDD、TDD、BDD 的知識與實踐，輕鬆實踐高效可靠全自動開發。
3. **【企業級實戰導入】**
   用企業級實踐導入高規格，不只學會工具，更知道如何舉一反三完全客製化企業專案需求。
4. **【課程教學方式與物超所值】**
   這是一堂理論、實務跟實戰三者兼具的 SDD 線上課程，用工作坊級別的學習體驗，不是只是教概念，而是直接帶著做！

[了解更多課程內容說明](https://waterballs.tw/Ghl6O)

## 開源專案：AI x BDD

水球老師把這套 AI x BDD 的方法論做成開源 pipeline skill：把產品迭代寫成 Gherkin，再一路帶到 RED → GREEN → REFACTOR。

覺得有幫助，歡迎給它一顆 Star：

[![Star Waterball-Software-Academy/aixbdd](https://img.shields.io/github/stars/Waterball-Software-Academy/aixbdd?style=social)](https://github.com/Waterball-Software-Academy/aixbdd)

## 相關問題洽詢管道

1. [水球軟體學院 LINE 官方帳號](https://lin.ee/STIsOLZ)
2. 客服信箱：[support@waterballsa.tw](mailto:support@waterballsa.tw)
3. [水球軟體學院（社群）Discord](https://discord.gg/Ymjz7NmZXn)

---

© 2026 水球球特務有限公司版權所有，侵害必究。
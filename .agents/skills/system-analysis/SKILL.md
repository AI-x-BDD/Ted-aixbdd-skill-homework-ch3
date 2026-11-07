---
name: system-analysis
description: 使用者已有功能規格書（spec.md）與技術研究產物（research.md、techstack.md），要規劃系統分析並產出實作計畫（plan.md），或呼叫 /system-analysis 時使用此 skill。從 spec.md 盤點端點與介面、由外而內依相依性排定分析 Wave，依樣板產出 `specs/NNN-英文短名/plan.md`，再委派 planner-provisioning 補建缺少的 Planner，並依 Wave 順序呼叫各端點的 Planner 產出介面文檔；功能規格交由 specify，技術研究交由 technical-research，Planner 的配對與建立交由 planner-provisioning，各端點介面文檔的檔名、格式與撰寫交由各 Planner，任務拆解不在範圍內。
---

## SOP

### Phase 1 --- 讀取輸入

1. READ 讀取目標功能的 `specs/<功能代號>/spec.md`、`research.md` 與 `techstack.md`。
2. DELEGATE 依 [clarify](../clarify/SKILL.md) 在輸入存在會改變端點、介面或 Wave 劃分的疑慮時釐清缺口。

### Phase 2 --- 規劃實作計畫

1. THINK 依 [介面盤點規範](rules/介面盤點規範.md) 從 spec.md 盤點涉及的端點、每個端點的對外介面與各介面依據的需求。
2. THINK 依 [分析 Wave 規劃規範](rules/分析Wave規劃規範.md) 由外而內依相依性將端點分成 Wave，並決定每個 Wave 的分析重點、前置 Wave 端點的相依與每個端點的 sub-agent 委派。
3. READ 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 讀取 plan.md 適用的憲法條款。
4. WRITE 依憲法條款與 [專案結構規劃規範](rules/專案結構規劃規範.md) 與 [plan.md](templates/plan.md) 與 [plan.example.md](templates/plan.example.md) 撰寫 `specs/<功能代號>/plan.md`。
5. DELEGATE 依 [check_plan.py](scripts/check_plan.py) 與 [腳本執行規範](rules/script-執行規範.md) 檢查 plan.md 的介面 ID、需求引用、Wave 分配、委派、相依與統計數字是否一致，以及殘留佔位符。
6. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 plan.md 是否符合憲法條款，並判斷腳本回報的問題是否與條款衝突。
7. WRITE 修正檢查與核對發現的問題。

### Phase 3 --- 備妥 Planner

1. DELEGATE 依 [planner-provisioning](../planner-provisioning/SKILL.md) 補建 plan.md 各 Wave 委派但缺少的 Planner。

### Phase 4 --- 執行分析 Wave

1. THINK 依 [分析 Wave 執行規範](rules/分析Wave執行規範.md) 取得開 sub-agent 的工具，工具未直接列出時先查詢，確定無法開啟時停止回報，不得改由自己撰寫介面文檔。
2. DELEGATE 依 [分析 Wave 執行規範](rules/分析Wave執行規範.md) 與 [Planner 配對規範](../planner-provisioning/rules/Planner配對規範.md) 為目前 Wave 的每個端點各開一個 sub-agent 完整執行對應 Planner 的 SKILL.md，並要求回傳產出路徑、憲法核對結果與衝突；功能為增量、改動小或使用者要求一次做完時同樣委派，不得由自己照 Planner 的 skill 撰寫產出。
3. THINK 依 [分析 Wave 執行規範](rules/分析Wave執行規範.md) 只以本次 sub-agent 的回傳確認每個端點的產出，執行前已存在的檔案不算完成；有端點沒有回傳或回報失敗時停止回報，全部通過時回到 Step 2 執行下一個 Wave。

### Phase 5 --- 回報結果

1. WRITE 依 [分析 Wave 執行規範](rules/分析Wave執行規範.md) 與 [wave-report.md](templates/wave-report.md) 與 [wave-report.example.md](templates/wave-report.example.md) 只依各 sub-agent 的回傳回報每個 Wave 各端點的產出與憲法衝突，沒有回傳的端點寫「未執行」，不得加入樣板以外的欄位或回傳以外的合憲宣稱。

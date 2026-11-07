---
name: ui-ux-plan
description: 執行 plan.md 分析 Wave 中前端（介面 ID 前綴 UI）的分析，或呼叫 /ui-ux-plan 時使用此 skill。
---

## SOP

### Phase 1 --- 讀取輸入

1. READ 讀取呼叫參數指定的 plan.md 中的共用輸入、所屬端點的介面列與該 Wave 的分析重點。
2. READ 依 [Planner 配對規範](../planner-provisioning/rules/Planner配對規範.md) 找到「相依」列出的前置端點的 Planner，讀取其 SKILL.md 撰寫產出的 Step 寫明的文檔。
3. READ 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 讀取 `contracts/ui-contract.md` 與 `contracts/prototype/` 適用的憲法條款。

### Phase 2 --- 分析介面

1. THINK 依 [UI 分析規範](rules/UI分析規範.md) 與憲法條款從介面列、分析重點與前置產出推導每個介面的操作、狀態、文案與需要內層提供的資料與動作。

### Phase 3 --- 撰寫產出

1. WRITE 依憲法條款與 [ui-contract.md](templates/ui-contract.md) 與 [ui-contract.example.md](templates/ui-contract.example.md) 在 plan.md 所在目錄撰寫 `contracts/ui-contract.md`。
2. WRITE 依 [UI 分析規範](rules/UI分析規範.md) 與憲法條款並參考 [index.html](templates/prototype.example/index.html) 與 [album.html](templates/prototype.example/album.html) 與 [states.html](templates/prototype.example/states.html) 在 plan.md 所在目錄的 `contracts/prototype/` 為每個頁面撰寫 HTML 原型與 `states.html` 狀態入口。
3. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 `contracts/ui-contract.md` 是否符合憲法條款。
4. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 `contracts/prototype/` 的每個 HTML 是否符合憲法條款。
5. WRITE 修正核對發現的問題。

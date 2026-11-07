---
name: storage-plan
description: 執行 plan.md 分析 Wave 中檔案系統端（介面 ID 前綴 FS）的分析，或呼叫 /storage-plan 時使用此 skill。
---

## SOP

### Phase 1 --- 讀取輸入

1. READ 讀取呼叫參數指定的 plan.md 中的共用輸入、所屬端點的介面列與該 Wave 的分析重點。
2. READ 依 [Planner 配對規範](../planner-provisioning/rules/Planner配對規範.md) 找到「相依」列出的前置端點的 Planner，讀取其 SKILL.md 撰寫產出的 Step 寫明的文檔。
3. READ 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 讀取 `contracts/storage-contract.md` 適用的憲法條款。

### Phase 2 --- 分析介面

1. THINK 依 [儲存分析規範](rules/儲存分析規範.md) 與憲法條款從介面列、分析重點與前置產出推導每個儲存區的目錄結構、命名規則與新增刪除連動。

### Phase 3 --- 撰寫產出

1. WRITE 依憲法條款與 [storage-contract.md](templates/storage-contract.md) 與 [storage-contract.example.md](templates/storage-contract.example.md) 在 plan.md 所在目錄撰寫 `contracts/storage-contract.md`。
2. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 `contracts/storage-contract.md` 是否符合憲法條款。
3. WRITE 修正核對發現的問題。

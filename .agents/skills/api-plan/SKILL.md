---
name: api-plan
description: 執行 plan.md 分析 Wave 中後端（介面 ID 前綴 API）的分析，或呼叫 /api-plan 時使用此 skill。
---

## SOP

### Phase 1 --- 讀取輸入

1. READ 讀取呼叫參數指定的 plan.md 中的共用輸入、所屬端點的介面列與該 Wave 的分析重點。
2. READ 依 [Planner 配對規範](../planner-provisioning/rules/Planner配對規範.md) 找到「相依」列出的前置端點的 Planner，讀取其 SKILL.md 撰寫產出的 Step 寫明的文檔。
3. READ 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 讀取 `contracts/openapi.yaml` 適用的憲法條款。

### Phase 2 --- 分析介面

1. THINK 依 [API 分析規範](rules/API分析規範.md) 與憲法條款從介面列、分析重點與前置產出推導每個 API 的路徑、請求、回應、錯誤與需要內層讀寫的資料與檔案。

### Phase 3 --- 撰寫產出

1. WRITE 依憲法條款與 [openapi.yaml](templates/openapi.yaml) 與 [openapi.example.yaml](templates/openapi.example.yaml) 在 plan.md 所在目錄撰寫 `contracts/openapi.yaml`。
2. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 `contracts/openapi.yaml` 是否符合憲法條款。
3. WRITE 修正核對發現的問題。

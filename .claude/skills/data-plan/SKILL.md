---
name: data-plan
description: 執行 plan.md 分析 Wave 中資料庫端（介面 ID 前綴 DB）的分析，或呼叫 /data-plan 時使用此 skill。
---

## SOP

### Phase 1 --- 讀取輸入

1. READ 讀取呼叫參數指定的 plan.md 中的共用輸入、所屬端點的介面列與該 Wave 的分析重點。
2. READ 依 [Planner 配對規範](../planner-provisioning/rules/Planner配對規範.md) 找到「相依」列出的前置端點的 Planner，讀取其 SKILL.md 撰寫產出的 Step 寫明的文檔。
3. READ 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 讀取 `data-model.dbml` 適用的憲法條款。

### Phase 2 --- 分析介面

1. THINK 依 [資料模型分析規範](rules/資料模型分析規範.md) 與憲法條款從介面列、分析重點與前置產出推導資料表、欄位、索引、關聯與交易邊界。

### Phase 3 --- 撰寫產出

1. WRITE 依憲法條款與 [data-model.dbml](templates/data-model.dbml) 與 [data-model.example.dbml](templates/data-model.example.dbml) 在 plan.md 所在目錄撰寫 `data-model.dbml`。
2. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 `data-model.dbml` 是否符合憲法條款。
3. DELEGATE 依 [check_dbml.py](scripts/check_dbml.py) 與 [腳本執行規範](rules/script-執行規範.md) 解析 `data-model.dbml`，列出語法錯誤與指向本檔未定義資料表的關聯。
4. WRITE 修正核對與解析發現的問題。

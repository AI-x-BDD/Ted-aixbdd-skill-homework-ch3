---
name: planner-provisioning
description: system-analysis 產出 plan.md 後、執行分析 Wave 前，要確認每個端點委派的 Planner skill 是否存在並補建缺少的 Planner，或呼叫 /planner-provisioning 時使用此 skill。從 plan.md 的分析 Wave 依介面 ID 前綴盤點所需 Planner，並依名稱與職責與既有 skill 配對，缺少者先撰寫委派簡報再委派 artifact-to-skill-engineering 建立；plan.md 的規劃交由 system-analysis，優化已存在的 Planner 交由 skill-engineering，Wave 的實際執行交由 system-analysis。
---

## SOP

### Phase 1 --- 讀取輸入

1. READ 讀取目標功能的 `specs/<功能代號>/plan.md` 與 `.claude/skills/` 底下各 skill 的 name 與 description。

### Phase 2 --- 配對 Planner

1. THINK 依 [Planner 配對規範](rules/Planner配對規範.md) 與 [planner-matching.md](templates/planner-matching.md) 與 [planner-matching.example.md](templates/planner-matching.example.md) 從 plan.md 每個 Wave 的端點依介面 ID 前綴盤點所需 Planner，並依名稱與職責與既有 skill 配對出已有、疑似已有、不符或缺少。
2. ASK 請使用者確認配對表。

### Phase 3 --- 撰寫委派簡報

1. THINK 依 [委派簡報撰寫規範](rules/委派簡報撰寫規範.md) 與 [planner-brief.md](templates/planner-brief.md) 與 [planner-brief.example.md](templates/planner-brief.example.md) 為每個缺少及使用者決定另建的 Planner 撰寫委派簡報。
2. ASK 請使用者確認委派簡報。

### Phase 4 --- 建立 Planner

1. DELEGATE 依 [artifact-to-skill-engineering](../artifact-to-skill-engineering/SKILL.md) 以每份確認後的委派簡報中的所有 Artifact 敘述與流程需求建立 Planner skill。

---
name: analyze
description: 使用者已有任務清單（tasks.md），要在實作前檢查 spec.md、research.md、techstack.md、plan.md、各端點介面文檔與 tasks.md 之間的一致性與覆蓋缺口，或呼叫 /analyze 時使用此 skill。依需求、介面、介面文檔、任務做雙向追溯，偵測覆蓋缺口、不一致、模糊、重複、規格不足與憲法違反並分級，只在對話中輸出分析報告，不修改任何產物；含 `.specify/` 的原版 spec-kit 專案交由 speckit-analyze，只掃描 spec.md 盲點並寫回交由 clarify-over-specs，產物的修正交由產出它的 skill。
---

## SOP

### Phase 1 --- 讀取輸入

1. READ 讀取使用者指定的功能代號、分析重點，以及同一對話中的前次分析報告。
2. DELEGATE 依 [collect_artifacts.py](scripts/collect_artifacts.py) 與 [腳本執行規範](rules/script-執行規範.md) 盤點 `specs/<功能代號>/` 的必要產物，以及各端點 Planner 宣告的介面文檔。
3. DELEGATE 依 [check_plan.py](../system-analysis/scripts/check_plan.py) 與 [腳本執行規範](rules/script-執行規範.md) 檢查 plan.md 的結構。
4. DELEGATE 依 [check_tasks.py](../task/scripts/check_tasks.py) 與 [腳本執行規範](rules/script-執行規範.md) 檢查 tasks.md 的結構。
5. READ 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 讀取每份產物與介面文檔適用的憲法條款。
6. ASK 依 [前置檢查規範](rules/前置檢查規範.md) 在必要產物或介面文檔缺漏時列出缺漏，並請使用者先執行產出它的上游 skill。

### Phase 2 --- 建立追溯模型

1. DELEGATE 依 [build_trace.py](scripts/build_trace.py) 與 [腳本執行規範](rules/script-執行規範.md) 解析需求、介面盤點、介面文檔段落與任務錨點，輸出追溯 JSON。
2. THINK 依 [需求盤點規範](rules/需求盤點規範.md) 判定每個 SC 是否需要建置，以及每個需求是否屬於範圍外。

### Phase 3 --- 偵測問題

1. THINK 依 [覆蓋判定規範](rules/覆蓋判定規範.md) 判定需求覆蓋、介面文檔覆蓋與反向覆蓋的狀態。
2. THINK 依 [問題偵測判準](rules/問題偵測判準.md) 找出模糊、重複、規格不足、不一致與憲法違反的發現事項。
3. THINK 依 [嚴重度與編號規範](rules/嚴重度與編號規範.md) 為每個發現事項分級、編號，並與同一對話中的前次分析比對。

### Phase 4 --- 輸出報告

1. WRITE 依 [report.md](templates/report.md) 與 [report.example.md](templates/report.example.md) 在對話中輸出分析報告。
2. ASK 詢問使用者是否要針對前 N 個發現事項提出具體修正建議，不修改任何產物。

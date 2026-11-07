---
name: task
description: 使用者已有實作計畫（plan.md）與各端點介面文檔，要把功能拆解成實作任務清單（tasks.md），或呼叫 /task 時使用此 skill。依 plan.md 介面盤點將每個使用者故事依端點由內而外分段，為每個故事寫出可觀察的完成判準，並為每個任務掛上指向 Spec Package 精確位置的必讀錨點與需讀原因，依樣板產出 `specs/NNN-英文短名/tasks.md`；任務只涵蓋實作流程，單元、契約、整合、驗收測試與測試基礎建設不在範圍內；功能規格交由 specify，技術研究交由 technical-research，plan.md 與介面文檔交由 system-analysis，任務的實作執行不在範圍內。
---

## SOP

### Phase 1 --- 讀取輸入

1. READ 讀取目標功能 `specs/<功能代號>/` 的 spec.md、plan.md、research.md、techstack.md 與各端點的介面文檔。
2. THINK 依 [輸入完整性規範](rules/輸入完整性規範.md) 確認 spec.md、plan.md、research.md、techstack.md 皆存在，且 plan.md 介面盤點的每個端點都有對應的介面文檔。
3. ASK 有輸入缺漏時列出缺漏，並請使用者先執行產出它的上游 skill（specify、technical-research 或 system-analysis）後再繼續。
4. READ 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 讀取 tasks.md 適用的憲法條款。

### Phase 2 --- 拆解任務

1. THINK 依 [任務拆解規範](rules/任務拆解規範.md) 與憲法條款將實作工作分成 Setup、Foundational、各使用者故事與 Polish Phase，為每個任務寫出確切檔案路徑，並為每個使用者故事寫出完成判準。
2. THINK 依 [端點分段規範](rules/端點分段規範.md) 將每個使用者故事的任務依端點由內而外分段。
3. THINK 依 [必讀錨點規範](rules/必讀錨點規範.md) 為每個任務選定指向 Spec Package 精確位置的必讀錨點，並寫出每個錨點的需讀原因。
4. THINK 依 [任務標記規範](rules/任務標記規範.md) 依執行順序為任務編號，並標記 [P]、[Story] 與相依。

### Phase 3 --- 撰寫任務清單

1. WRITE 依憲法條款與 [tasks.md](templates/tasks.md) 與 [tasks.example.md](templates/tasks.example.md) 撰寫 `specs/<功能代號>/tasks.md`。
2. DELEGATE 依 [check_tasks.py](scripts/check_tasks.py) 與 [腳本執行規範](rules/script-執行規範.md) 檢查編號連續、相依與並行段落的編號引用、必讀覆蓋率、需讀原因、錨點是否存在與殘留佔位符。
3. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 tasks.md 是否符合憲法條款，並判斷腳本回報的問題是否與條款衝突。
4. WRITE 修正檢查與核對發現的問題。

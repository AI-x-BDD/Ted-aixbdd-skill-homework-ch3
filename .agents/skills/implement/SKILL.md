---
name: implement
description: 使用者已有任務清單（tasks.md），要依任務把功能實作成程式碼，或呼叫 /implement 時使用此 skill。依 Phase 與相依順序逐任務執行，實作前讀完任務的必讀錨點原文、與任務描述衝突時停下回報，每個任務完成後做靜態檢查並勾選 [X]，最後產出列出各故事完成判準供使用者驗證的完成報告；任務拆解交由 task，功能規格交由 specify，技術研究交由 technical-research，plan.md 與介面文檔交由 system-analysis，撰寫測試不在範圍內。
---

## SOP

### Phase 1 --- 讀取輸入

1. READ 讀取使用者輸入的範圍篩選與目標功能 `specs/<功能代號>/tasks.md`。
2. DELEGATE 依 [tasks_state.py](scripts/tasks_state.py) 與 [腳本執行規範](rules/script-執行規範.md) 解析 tasks.md 的任務狀態與必讀錨點檔案是否存在。
3. THINK 依 [輸入完整性規範](rules/輸入完整性規範.md) 確認輸入完整，並界定範圍內要執行的任務。
4. ASK 有輸入缺漏或範圍外的前置任務未完成時列出缺漏，並請使用者先處理。

### Phase 2 --- 準備專案

1. THINK 依 [Ignore 檔規範](rules/Ignore檔規範.md) 偵測專案使用的工具，並比對 tasks.md 中建立 ignore 檔的任務。
2. WRITE 建立或補齊不由任務建立的 ignore 檔。
3. THINK 依 [檢查指令選擇規範](rules/檢查指令選擇規範.md) 從 techstack.md 決定各類檔案的語法檢查指令與專案的 lint 指令。

### Phase 3 --- 執行任務

1. DELEGATE 依 [tasks_state.py](scripts/tasks_state.py) 與 [腳本執行規範](rules/script-執行規範.md) 列出相依與 Phase 閘門皆已滿足的任務。
2. THINK 依 [執行順序規範](rules/執行順序規範.md) 選出範圍內下一個要執行的任務。
3. READ 讀取該任務所有必讀錨點的原文。
4. THINK 依 [錨點對照規範](rules/錨點對照規範.md) 比對任務描述與錨點原文。
5. ASK 錨點衝突或找不到時依 [停止回報.md](templates/停止回報.md) 與 [停止回報.example.md](templates/停止回報.example.md) 停止執行並回報。
6. WRITE 依 [實作範圍規範](rules/實作範圍規範.md) 實作任務。
7. DELEGATE 依 [static_check.py](scripts/static_check.py) 與 [腳本執行規範](rules/script-執行規範.md) 以 Phase 2 決定的指令對任務建立或修改的檔案執行語法檢查與 lint。
8. WRITE 依 [靜態檢查規範](rules/靜態檢查規範.md) 修正靜態檢查發現的錯誤。
9. ASK 靜態檢查錯誤無法在任務範圍內修正時依 [停止回報.md](templates/停止回報.md) 與 [停止回報.example.md](templates/停止回報.example.md) 停止執行並回報。
10. WRITE 在 tasks.md 將該任務勾為 [X]。
11. WRITE 回報該任務的完成進度，範圍內仍有未完成任務時回到 Step 1。

### Phase 4 --- 收尾驗證

1. THINK 依 [收尾驗證規範](rules/收尾驗證規範.md) 對照 spec.md、plan.md、techstack.md 確認實作符合規格與技術計畫。
2. WRITE 依 [完成報告.md](templates/完成報告.md) 與 [完成報告.example.md](templates/完成報告.example.md) 撰寫完成報告。

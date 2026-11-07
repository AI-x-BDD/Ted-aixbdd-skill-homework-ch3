---
name: specify
description: 使用者要把一段功能描述轉成功能規格書（spec.md），或呼叫 /specify 時使用此 skill。先委派 clarify 訪談需求缺口，再依樣板產出 `specs/NNN-英文短名/spec.md`；需求訪談本身交由 clarify，技術規劃與任務拆解不在範圍內。
---

## SOP

### Phase 1 --- 釐清需求

1. READ 讀取使用者的功能描述。
2. DELEGATE 依 [clarify](../clarify/SKILL.md) 在功能描述存在會改變使用者故事範圍或驗收結果的缺口時，以詳記問答紀錄的方式釐清缺口。

### Phase 2 --- 撰寫規格

1. THINK 依 `specs/` 底下既有資料夾的最大編號加一，決定 `NNN-英文短名` 格式的功能代號。
2. THINK 依 [使用者故事切分規範](rules/使用者故事切分規範.md) 從功能描述與釐清結果切分使用者故事並排定優先順序。
3. THINK 依 [需求推導規範](rules/需求推導規範.md) 從每個使用者故事的驗收情境與釐清結果推導 FR、NFR，並判定各條需求屬於單一故事或全域。
4. READ 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 讀取 spec.md 適用的憲法條款。
5. WRITE 依 [規格內容撰寫規範](rules/規格內容撰寫規範.md) 與憲法條款與 [spec.md](templates/spec.md) 與 [spec.example.md](templates/spec.example.md) 撰寫 `specs/<功能代號>/spec.md`。

### Phase 3 --- 檢查一致性

1. DELEGATE 依 [check_spec.py](scripts/check_spec.py) 與 [腳本執行規範](rules/script-執行規範.md) 檢查 spec.md 的編號連續性、交叉引用與殘留佔位符。
2. THINK 檢查每個釐清答案是否都已落入需求。
3. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 spec.md 是否符合憲法條款，並判斷腳本回報的問題是否與條款衝突。
4. WRITE 修正檢查與核對發現的問題。

### Phase 4 --- 建議下一步

1. WRITE 建議使用者可選擇執行 [clarify-over-specs](../clarify-over-specs/SKILL.md) 澄清規格盲點。

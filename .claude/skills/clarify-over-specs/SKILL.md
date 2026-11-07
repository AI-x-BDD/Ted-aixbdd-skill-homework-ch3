---
name: clarify-over-specs
description: 使用者已有 specify 產出的功能規格書（spec.md），要在技術研究前主動找出規格盲點、與使用者澄清並寫回 spec.md，或呼叫 /clarify-over-specs 時使用此 skill。依需求覆蓋分類法掃描 spec.md 標出覆蓋缺口，依影響力挑選提問面向，問答委派 clarify 並在每題標示所屬分類與狀態，每輪答完寫回 spec.md，再由使用者決定是否再問一輪，最後輸出覆蓋總表；從功能描述產出 spec.md 交由 specify，問題撰寫與問答互動交由 clarify，技術選型交由 technical-research。
---

## SOP

### Phase 1 --- 掃描覆蓋缺口

1. READ 讀取使用者指定的 `specs/<功能代號>/spec.md`。
2. READ 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 讀取 spec.md 適用的憲法條款。
3. THINK 依 [需求覆蓋分類法](rules/需求覆蓋分類法.md) 為每個分類判定 Clear、Partial 或 Missing，建立覆蓋地圖。
4. THINK 依 [缺口影響力判準](rules/缺口影響力判準.md) 從 Partial 與 Missing 的分類挑出值得提問的面向，為每個面向標上所屬分類與狀態，並依影響力排序。

### Phase 2 --- 委派一輪訪談

1. DELEGATE 依 [clarify](../clarify/SKILL.md) 在有值得提問的面向時，以排序後的面向、以「分類（狀態）」作為各面向的題目標籤、每輪 3 至 5 題、只問一輪的設定訪談使用者。

### Phase 3 --- 寫回規格

1. WRITE 依 [釐清結果寫回規範](rules/釐清結果寫回規範.md) 與 [規格內容撰寫規範](../specify/rules/規格內容撰寫規範.md) 與 [需求推導規範](../specify/rules/需求推導規範.md) 與憲法條款把本輪問答寫進 spec.md 的釐清紀錄與對應章節。
2. THINK 依 [釐清結果寫回規範](rules/釐清結果寫回規範.md) 逐條核對本輪每個答案都已寫入對應章節，且沒有殘留被推翻的內容或舊用語。
3. DELEGATE 依 [check_spec.py](../specify/scripts/check_spec.py) 與 [腳本執行規範](../specify/rules/script-執行規範.md) 檢查 spec.md 的編號連續性、交叉引用與殘留佔位符。
4. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 spec.md 是否符合憲法條款，並判斷腳本回報的問題是否與條款衝突。
5. WRITE 修正核對與檢查發現的問題。

### Phase 4 --- 回報覆蓋

1. THINK 依 [需求覆蓋分類法](rules/需求覆蓋分類法.md) 與 [缺口影響力判準](rules/缺口影響力判準.md) 重新判定覆蓋地圖，並挑出剩餘的高影響缺口。
2. ASK 仍有高影響缺口時，列出這些缺口與是否推薦再問一輪；使用者選擇繼續時回到 Phase 2。
3. WRITE 依 [覆蓋總表.md](templates/覆蓋總表.md) 與 [覆蓋總表.example.md](templates/覆蓋總表.example.md) 輸出覆蓋總表與下一步建議。

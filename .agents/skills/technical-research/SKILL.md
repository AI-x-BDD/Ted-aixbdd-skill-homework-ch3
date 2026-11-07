---
name: technical-research
description: 使用者已有功能規格書（spec.md），要依指定的技術方向做技術研究並產出研究紀錄（research.md）與技術堆疊（techstack.md），或呼叫 /technical-research 時使用此 skill。先委派 clarify 釐清技術方向的缺口，再依樣板產出 `specs/NNN-英文短名/research.md` 與 `techstack.md`；功能規格交由 specify，data-model、contracts、quickstart 與任務拆解不在範圍內。
---

## SOP

### Phase 1 --- 釐清技術方向

1. READ 讀取使用者指定的技術方向與目標功能的 `specs/<功能代號>/spec.md`。
2. READ 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 讀取 research.md 與 techstack.md 適用的憲法條款。
3. DELEGATE 依 [clarify](../clarify/SKILL.md) 在技術方向存在會改變架構的缺口時釐清缺口。

### Phase 2 --- 研究技術決策

1. THINK 依 [議題盤點規範](rules/議題盤點規範.md) 從 spec.md 的 FR、NFR、SC、使用者故事、邊界情況與技術方向盤點需要技術決策的議題。
2. THINK 依 [技術決策規範](rules/技術決策規範.md) 與憲法條款為每個議題在技術方向的限制內選定決策、版本、理由與替代方案。
3. DELEGATE 依 [clarify](../clarify/SKILL.md) 在議題於限制內找不到可行做法時，詢問使用者是否調整限制。

### Phase 3 --- 撰寫研究紀錄

1. WRITE 依 [研究紀錄撰寫規範](rules/研究紀錄撰寫規範.md) 與憲法條款與 [research.md](templates/research.md) 與 [research.example.md](templates/research.example.md) 撰寫 `specs/<功能代號>/research.md`。
2. DELEGATE 依 [check_research.py](scripts/check_research.py) 與 [腳本執行規範](rules/script-執行規範.md) 檢查 research.md 的 R 編號、對應需求引用與殘留佔位符，並列出未被引用的需求。
3. THINK 判斷未被引用的需求中哪些需要技術決策卻未被涵蓋。
4. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 research.md 是否符合憲法條款，並判斷腳本回報的問題是否與條款衝突。
5. WRITE 修正檢查與核對發現的問題。

### Phase 4 --- 撰寫技術堆疊

1. WRITE 依 [技術堆疊撰寫規範](rules/技術堆疊撰寫規範.md) 與憲法條款與 [techstack.md](templates/techstack.md) 與 [techstack.example.md](templates/techstack.example.md) 從 research.md 彙整 `specs/<功能代號>/techstack.md`。
2. DELEGATE 依 [check_techstack.py](scripts/check_techstack.py) 與 [腳本執行規範](rules/script-執行規範.md) 檢查 techstack.md 的 R 編號、技術類型、套件版本與 research.md 一致及殘留佔位符。
3. THINK 依 [憲法套用規範](../constitution/rules/憲法套用規範.md) 逐條核對 techstack.md 是否符合憲法條款，並判斷腳本回報的問題是否與條款衝突。
4. WRITE 修正檢查與核對發現的問題。

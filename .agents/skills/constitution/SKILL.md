---
name: constitution
description: 使用者要為專案訂立或增修憲法（`.claude/constitution/`），約束 SDD 流程中各 skill 產出物的內容與格式，或呼叫 /constitution 時使用此 skill。每次只依使用者這次提出的需求，委派 clarify 以最小增量訪談，判斷涉及的產出物，只撰寫必要的產出物條款或共通條款，再更新 CONSTITUTION.md 的目錄、版本與修訂紀錄；下游 skill 讀取與套用憲法依本 skill 的憲法套用規範，修改 skill 本身的內建 Rule 交由 skill-engineering，產物間的一致性檢查交由 analyze。
---

## SOP

### Phase 1 --- 釐清需求

1. READ 讀取使用者這次的憲法需求與 `.claude/constitution/` 既有的憲法（存在時）。
2. THINK 依 [增量範圍判斷規範](rules/增量範圍判斷規範.md) 判斷需求涉及的產出物與作用位置，以及與既有條款的重複或衝突。
3. DELEGATE 依 [clarify](../clarify/SKILL.md) 在涉及的產出物、作用位置、強度或條款內容存在缺口時，只針對落實本次需求的缺口訪談使用者。

### Phase 2 --- 撰寫條款

1. READ 讀取涉及產出物的產出 skill 的樣板與 `rules/`。
2. THINK 依 [條款落點判斷規範](rules/條款落點判斷規範.md) 判斷每條條款寫入產出物條款檔或共通條款檔，並決定條款 ID。
3. WRITE 依 [條款撰寫規範](rules/條款撰寫規範.md) 與 [product-clauses.md](templates/product-clauses.md) 與 [product-clauses.example.md](templates/product-clauses.example.md) 撰寫或修改 `.claude/constitution/skills/<產出 skill>/<產出物>.md`。
4. WRITE 依 [條款撰寫規範](rules/條款撰寫規範.md) 與 [shared-clauses.md](templates/shared-clauses.md) 與 [shared-clauses.example.md](templates/shared-clauses.example.md) 在需要共通條款時撰寫或修改 `.claude/constitution/shared/<主題>.md`。
5. WRITE 依 [目錄與版本更新規範](rules/目錄與版本更新規範.md) 與 [constitution-index.md](templates/constitution-index.md) 與 [constitution-index.example.md](templates/constitution-index.example.md) 更新 `.claude/constitution/CONSTITUTION.md` 的目錄、版本與修訂紀錄。

### Phase 3 --- 檢查與回報

1. DELEGATE 依 [check_constitution.py](scripts/check_constitution.py) 與 [腳本執行規範](rules/script-執行規範.md) 檢查目錄連結、條款 ID、共通條款引用與版本紀錄的一致性。
2. THINK 依 [憲法套用規範](rules/憲法套用規範.md) 確認下游 skill 能依目錄載入本次異動的條款，並依作用位置核對。
3. WRITE 修正檢查與核對發現的問題。
4. WRITE 回報本次異動的檔案、條款、版本與未執行的建議。

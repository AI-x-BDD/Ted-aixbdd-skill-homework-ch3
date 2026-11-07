# 分析 Wave 執行規範

## Rule 1 -- Wave 依序執行，同一個 Wave 並行

**強度：MUST**

必須依 plan.md 的 Wave 編號由小到大執行，前一個 Wave 的所有 sub-agent 完成並通過產出確認後，才能開始下一個 Wave。同一個 Wave 必須為每個端點各開一個 sub-agent 並行執行，每個 sub-agent 只呼叫依介面 ID 前綴對照出的 Planner，呼叫參數固定為 `plan.md` 路徑、Wave 編號與端點名稱。

### Good Example

這個範例的 Wave 3 有兩個端點，同時開兩個 sub-agent，各自帶入固定的呼叫參數。

```text
Wave 3（並行）：
- sub-agent 1 → data-plan：specs/001-photo-album-organizer/plan.md、Wave 3、資料庫端
- sub-agent 2 → storage-plan：specs/001-photo-album-organizer/plan.md、Wave 3、檔案系統端
```

### Bad Example

這個範例在 Wave 2 尚未完成時就開始 Wave 3，data-plan 讀不到 `openapi.yaml`，只能自行猜測 API 需要的欄位。

```text
Wave 2 → api-plan（執行中）
Wave 3 → data-plan、storage-plan（同時開始）
```

## Rule 2 -- 以本次回傳確認產出，不齊全時停止

**強度：MUST**

每個 Wave 結束後，必須以本次每個 sub-agent 的回傳確認產出：回傳列出了產出文檔路徑與 Planner 的憲法核對結果，且依該 Planner 的 SKILL.md 撰寫產出的 Step 寫明的每份文檔都已存在於 plan.md 所在目錄。執行前就已存在的檔案與檢查腳本通過，都不能作為 Planner 已執行的證據。缺少回傳、有文檔缺漏或 sub-agent 回報失敗時，必須停止執行並回報缺漏的 Planner 與文檔，不得進入下一個 Wave，也不得自行補寫 Planner 的產出。

### Good Example

這個範例以 sub-agent 的回傳逐項確認，發現回傳缺少原型目錄後停止，沒有進入 Wave 2。

```text
Wave 1 確認：ui-ux-plan 寫明 contracts/ui-contract.md、contracts/prototype/
- 回傳產出：contracts/ui-contract.md；憲法核對：無適用條款
- 回傳沒有 contracts/prototype/ → 停止，回報 ui-ux-plan 未產出 contracts/prototype/
```

### Bad Example

這個範例沒有回傳可依據，只因目錄中已有上次產出的檔案就判定完成，本次 Planner 是否執行、產出是否經過核對都無從得知。

```text
Wave 3 確認：data-model.dbml 已存在、check_dbml.py 通過 → data-plan 完成，繼續下一個 Wave
```

## Rule 3 -- 執行期間不修改 plan.md 與 Planner

**強度：MUST**

執行 Wave 期間不得修改 plan.md 或任何 Planner skill。發現 plan.md 的端點、相依或分析重點有誤，或 Planner 的產出不符其樣板時，必須停止並回報問題，建議回到 system-analysis 的 Phase 2 重新規劃或交由 skill-engineering 優化該 Planner；Planner 回報的憲法衝突依 Rule 4 處理，不屬於本條的停止條件。

### Good Example

這個範例發現 Wave 2 的相依指向不存在的端點，停止並建議重新規劃。

```text
Wave 2 相依「Wave 1 行動端的產出」，但 Wave 1 沒有行動端 → 停止，建議回到 Phase 2 修正 plan.md 的相依
```

### Bad Example

這個範例在執行中直接改寫 plan.md 的相依，修改沒有經過 check_plan.py 檢查，也沒有讓使用者知道計畫被改動。

```text
Wave 2 相依有誤 → 直接把 plan.md 改成「Wave 1 前端的產出」後繼續
```

## Rule 4 -- wave-report 只依回傳填寫，憲法衝突記入後繼續

**強度：MUST**

wave-report 每個端點的產出與狀態只能取自該端點 sub-agent 的回傳，沒有回傳的端點狀態寫「未執行」；不得加入樣板以外的欄位，也不得寫出回傳中沒有的合憲結論。Planner 回報與輸入文件的憲法衝突時，不屬於停止條件：必須保留該 Planner 依條款撰寫的產出，把每項衝突逐列記入「憲法衝突」段，再繼續下一個 Wave；所有 Planner 都沒有回報衝突時，省略「憲法衝突」段。

### Good Example

這個範例在 data-plan 回報 techstack.md 與條款衝突後，照回傳記入「憲法衝突」段並繼續執行。

```text
Wave 3 data-plan 回傳：techstack.md「資料庫」列寫「主鍵使用自動遞增整數」，與 C-DB-01 衝突 → 主鍵已改為 UUID
→ 記入 wave-report「憲法衝突」：資料庫端 | techstack.md「資料庫」列 | 主鍵使用自動遞增整數 | C-DB-01 | 各表主鍵改為 UUID | technical-research 修正 techstack.md
→ 繼續 Wave 4
```

### Bad Example

這個範例沒有 data-plan 的回傳，卻自行在 wave-report 加上「憲法」欄宣稱符合條款，使用者會誤以為產出已經過 Planner 核對。

```text
| 3 | 資料庫端 | `data-plan` | `data-model.dbml` | 完成 | 符合 C-DB-01 |
```

## Rule 5 -- 委派必須由 sub-agent 完整執行 Planner

**強度：MUST**

委派是指由 sub-agent 讀取並完整執行 Planner 的 SKILL.md，並回傳產出文檔路徑、Planner 對產出的憲法核對結果與回報的衝突。執行 system-analysis 的 agent 自行讀取 Planner 的 SKILL.md、規範或樣板後撰寫產出，不算委派，一律不得為之；功能為前一功能的增量、改動小或使用者要求一次做完，都不構成例外。可用工具中沒有直接列出開 sub-agent 的工具時，必須先查詢可動態取得的工具；確定無法開 sub-agent 時，必須停止並回報，請使用者改在支援 sub-agent 的環境執行。

### Good Example

這個範例的功能是前一功能的增量，工具清單也沒有列出 sub-agent 工具，仍先查詢取得後開 sub-agent，並要求回傳核對結果。

```text
工具清單無 sub-agent 工具 → 查詢可動態取得的工具 → 取得 Task
Wave 3 → sub-agent：完整執行 data-plan 的 SKILL.md（plan.md、Wave 3、資料庫端），回傳產出路徑、憲法核對結果與衝突
```

### Bad Example

這個範例以「只是增量、一次寫完較快」為由，讀了 Planner 的 SKILL.md 開頭就自行撰寫產出，Planner 的規範、樣板與憲法核對都沒有執行，產出違反憲法條款，wave-report 卻把 Planner 列為已執行。

```text
增量功能 → 讀 data-plan SKILL.md 前 40 行 → 自行撰寫 data-model.dbml → check_dbml.py 通過 → wave-report 寫 data-plan 完成
```

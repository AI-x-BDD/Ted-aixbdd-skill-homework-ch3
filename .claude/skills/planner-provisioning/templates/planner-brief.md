# Planner 委派簡報：{{planner_name}}

## 負責端點

{{endpoint_type_description}}

## Artifact 敘述

<!-- 重複開始：每份產出文檔一節 -->

### `{{output_doc_path}}`

- 格式：{{output_doc_format}}
- 記載資訊：

<!-- 重複開始：每項資訊一行 -->

- {{recorded_information}}

<!-- 重複結束 -->

- 範例取材：{{example_source}}

<!-- 重複結束 -->

## 流程需求

### 呼叫介面

- 呼叫參數：`plan.md` 路徑、Wave 編號、端點名稱
- 讀取輸入：
  - `plan.md`「共用輸入」列出的文檔
  - `plan.md` 介面盤點中所屬端點為此端點的介面列
  - `plan.md` 該 Wave 的「分析重點」
  - `plan.md` 該 Wave「相依」列出的前置端點，依 planner-provisioning 的 Planner 配對規範找到負責的 Planner，讀取其 SKILL.md 撰寫產出的 Step 寫明的文檔
- 產出位置：「Artifact 敘述」列出的文檔，寫在 `plan.md` 所在目錄
- 憲法：撰寫前依 constitution 的憲法套用規範讀取每份產出文檔適用的憲法條款，撰寫時遵循條款，寫入後逐條核對作用位置，並以條款的禁止事項掃描整份文檔，修正違反之處
- description：只寫觸發時機，寫明負責的端點類型與介面 ID 前綴，不寫產出與其他 skill

### 不在範圍

<!-- 重複開始：每項一行 -->

- {{out_of_scope_item}}（交由 {{responsible_party}}）

<!-- 重複結束 -->

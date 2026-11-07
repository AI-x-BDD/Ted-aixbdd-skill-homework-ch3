# Planner 委派簡報：api-plan

## 負責端點

後端：提供 API 給其他端點使用的伺服器端系統。

## Artifact 敘述

### `contracts/openapi.yaml`

- 格式：OpenAPI 3.1（YAML）
- 記載資訊：
  - 每個外層介面操作對應的 API 路徑、方法與用途
  - 請求參數、請求本文與回應本文的結構與型別
  - 錯誤回應的狀態碼與錯誤訊息結構
  - 分頁、排序與篩選的參數
  - 檔案上傳與二進位內容的請求與回應形式
  - 每個 API 需要讀寫的資料與檔案，供內層端點分析
- 範例取材：照片相簿整理器 `plan.md` 介面盤點的 API-01 匯入 API、API-02 相簿 API、API-03 照片 API

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

- 資料表欄位、索引與交易邊界（交由 data-plan）
- 原始檔與縮圖的目錄結構與命名規則（交由 storage-plan）
- 畫面配置、互動與文案（交由 ui-ux-plan）
- 程式碼實作與任務拆解（交由後續任務拆解）

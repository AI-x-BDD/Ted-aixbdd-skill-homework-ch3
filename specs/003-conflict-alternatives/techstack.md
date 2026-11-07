# 技術堆疊：預約衝突時推薦替代時段／場地

**功能分支**：`003-conflict-alternatives` | **日期**：2026-11-07 | **研究紀錄**：[research.md](./research.md)

本文件列出本次開發採用的全部技術，作為後續規劃與任務拆解的依據；各技術的選用理由見研究紀錄中對應的 R 編號。

---

## 執行環境

| 項目     | 技術                                                    | 版本          | 研究紀錄   |
| -------- | ------------------------------------------------------- | ------------- | ---------- |
| 執行環境 | Node.js                                                 | 24 LTS        | R-01       |
| 程式語言 | JavaScript（ES Modules）                                | ES2024        | R-01       |
| 資料庫   | MySQL                                                   | 8.4 LTS 以上  | R-01       |
| 套件管理 | npm workspaces（`frontend`、`backend`、`shared`、`e2e`） | 隨 Node.js 24 | R-01、R-09 |

## 前端

| 項目                                 | 技術                                                | 類型     | 版本   | 研究紀錄 |
| ------------------------------------ | --------------------------------------------------- | -------- | ------ | -------- |
| 建置工具                             | `vite`                                              | 套件     | ^8.0.0 | R-01     |
| 介面                                 | 原生 HTML、CSS、JavaScript                          | 內建     | —      | R-01     |
| 建議區塊與點選填入表單               | `frontend/src/components/suggestions.js` 與 `bookingFormPage.js` 擴充 | 自行實作 | —      | R-05     |
| 錯誤物件帶出建議             | `frontend/src/api/client.js` 的 `ApiError` 擴充              | 自行實作 | —      | R-05     |
| 建議文案與樣式                       | `shared/src/copy.js`、`frontend/src/styles/components.css` | 自行實作 | —      | R-05     |

## 後端

| 項目                         | 技術                                                         | 類型     | 版本    | 研究紀錄   |
| ---------------------------- | ------------------------------------------------------------ | -------- | ------- | ---------- |
| HTTP 伺服器                  | `node:http`                                                  | 內建     | —       | R-01       |
| 資料庫驅動                   | `mysql2`                                                     | 套件     | ^3.24.0 | R-01       |
| 空檔與場地建議計算           | `backend/src/domain/alternatives.js`（純函式）               | 自行實作 | —       | R-02、R-03 |
| 建議組裝與占用唯讀檢查       | `backend/src/services/alternativeService.js`、`slotService.js` 擴充 | 自行實作 | —       | R-02、R-04 |
| 占用查詢                     | `slotRepository.findOccupiedVenueIds`                        | 自行實作 | —       | R-03、R-04 |
| 回應格式 `suggestions`       | `backend/src/lib/http.js` 的 `sendError` 擴充                | 自行實作 | —       | R-04       |
| 場地名稱排序                 | `String.prototype.localeCompare`（`zh-Hant`）                | 內建     | —       | R-03       |
| 時間點換算（UTC 與台北時間） | `shared/src/taipei.js`                                       | 自行實作 | —       | R-08       |

## 測試

| 項目         | 技術                                              | 類型     | 版本    | 研究紀錄   |
| ------------ | ------------------------------------------------- | -------- | ------- | ---------- |
| 單元與整合   | `node:test` ＋ `fetch`                            | 內建     | —       | R-07、R-09 |
| 驗收（BDD）  | `@cucumber/cucumber`                              | 套件     | ^13.0.0 | R-01、R-09 |
| 瀏覽器自動化 | `playwright`                                      | 套件     | ^1.65.0 | R-01、R-09 |
| 撞期建議驗收案例 | `e2e/features/conflict-alternatives.feature`  | 自行實作 | —       | R-09       |

## 開發工具

| 項目   | 技術       | 類型 | 版本    | 研究紀錄 |
| ------ | ---------- | ---- | ------- | -------- |
| Lint   | `eslint`   | 套件 | ^10.0.0 | R-01     |
| 格式化 | `prettier` | 套件 | ^3.9.0  | R-01     |

## 套件安裝清單

| Workspace  | 相依類型        | 套件與版本                                         |
| ---------- | --------------- | -------------------------------------------------- |
| `frontend` | dependencies    | （無）                                             |
| `frontend` | devDependencies | `vite@^8.0.0`                                      |
| `backend`  | dependencies    | `mysql2@^3.24.0`                                   |
| `backend`  | devDependencies | （無）                                             |
| `shared`   | dependencies    | （無）                                             |
| `shared`   | devDependencies | （無）                                             |
| `e2e`      | devDependencies | `@cucumber/cucumber@^13.0.0`、`playwright@^1.65.0` |
| `.`        | devDependencies | `eslint@^10.0.0`、`prettier@^3.9.0`                |

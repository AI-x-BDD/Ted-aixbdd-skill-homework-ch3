# 技術堆疊：我的收藏場地與常用預設值

**功能分支**：`004-favorite-venues-and-defaults` | **日期**：2026-11-08 | **研究紀錄**：[research.md](./research.md)

本文件列出本次開發採用的全部技術，作為後續規劃與任務拆解的依據；各技術的選用理由見研究紀錄中對應的 R 編號。

---

## 執行環境

| 項目     | 技術                                                     | 版本          | 研究紀錄 |
| -------- | -------------------------------------------------------- | ------------- | -------- |
| 執行環境 | Node.js                                                  | 24 LTS        | R-01     |
| 程式語言 | JavaScript（ES Modules）                                 | ES2024        | R-01     |
| 資料庫   | MySQL                                                    | 8.4 LTS 以上  | R-01     |
| 套件管理 | npm workspaces（`frontend`、`backend`、`shared`、`e2e`） | 隨 Node.js 24 | R-01、R-08 |

## 前端

| 項目                     | 技術                                                      | 類型     | 版本   | 研究紀錄 |
| ------------------------ | --------------------------------------------------------- | -------- | ------ | -------- |
| 建置工具                 | `vite`                                                    | 套件     | ^8.0.0 | R-01     |
| 介面                     | 原生 HTML、CSS、JavaScript                                | 內建     | —      | R-01     |
| 場地選單分組             | `frontend/src/lib/venueGroups.js`、`<optgroup>`、`waitlistDialog.js` 擴充 | 自行實作 | —      | R-04     |
| 預設值預填與結束時間推導 | `frontend/src/lib/defaults.js`、`bookingFormPage.js` 擴充 | 自行實作 | —      | R-06     |
| 收藏標記與操作           | `venuesPage.js`、`frontend/src/api/client.js` 擴充        | 自行實作 | —      | R-03     |

## 後端

| 項目                     | 技術                                                                         | 類型     | 版本    | 研究紀錄   |
| ------------------------ | ---------------------------------------------------------------------------- | -------- | ------- | ---------- |
| HTTP 伺服器              | `node:http`                                                                  | 內建     | —       | R-01       |
| 資料庫驅動               | `mysql2`                                                                     | 套件     | ^3.24.0 | R-01       |
| 資料庫遷移               | `backend/src/db/migrations/008_favorites_defaults.sql`                       | 自行實作 | —       | R-02       |
| 收藏資料存取             | `backend/src/repositories/favoriteRepository.js`                             | 自行實作 | —       | R-02、R-03 |
| 預設值資料存取           | `backend/src/repositories/bookingDefaultsRepository.js`                      | 自行實作 | —       | R-02、R-05 |
| 收藏服務與端點           | `backend/src/services/favoriteService.js`、`routes/venues.js` 擴充           | 自行實作 | —       | R-03       |
| 預設值寫入               | `backend/src/services/bookingService.js` 的 `createBooking` 擴充             | 自行實作 | —       | R-05       |
| 預設值讀取               | `backend/src/services/contextService.js` 的 `getContext` 擴充                | 自行實作 | —       | R-06       |
| 授權動作                 | `backend/src/domain/policy.js` 的 `can()` 新增 `favorite:manage`             | 自行實作 | —       | R-07       |
| 場地名稱排序             | `String.prototype.localeCompare`（`zh-Hant`）                                | 內建     | —       | R-04       |

## 測試

| 項目             | 技術                                         | 類型     | 版本    | 研究紀錄 |
| ---------------- | -------------------------------------------- | -------- | ------- | -------- |
| 單元與整合       | `node:test` ＋ `fetch`                       | 內建     | —       | R-08     |
| 驗收（BDD）      | `@cucumber/cucumber`                         | 套件     | ^13.0.0 | R-08     |
| 瀏覽器自動化     | `playwright`                                 | 套件     | ^1.65.0 | R-08     |
| 收藏與預設值驗收案例 | `e2e/features/favorites-defaults.feature` | 自行實作 | —       | R-08     |

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

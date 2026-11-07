# 技術堆疊：場地／會議室預約系統

**功能分支**：`001-venue-booking` | **日期**：2026-11-07 | **研究紀錄**：[research.md](./research.md)

本文件列出本次開發採用的全部技術，作為後續規劃與任務拆解的依據；各技術的選用理由見研究紀錄中對應的 R 編號。

---

## 執行環境

| 項目     | 技術                                                     | 版本          | 研究紀錄 |
| -------- | -------------------------------------------------------- | ------------- | -------- |
| 執行環境 | Node.js                                                  | 24 LTS        | R-01     |
| 程式語言 | JavaScript（ES Modules）                                 | ES2024        | R-01     |
| 資料庫   | MySQL                                                    | 8.4 LTS 以上  | R-01     |
| 套件管理 | npm workspaces（`frontend`、`backend`、`shared`、`e2e`） | 隨 Node.js 24 | R-18     |

## 前端

| 項目                                   | 技術                                   | 類型     | 版本   | 研究紀錄         |
| -------------------------------------- | -------------------------------------- | -------- | ------ | ---------------- |
| 建置工具（開發時把 `/api` 轉發到後端） | `vite`                                 | 套件     | ^8.0.0 | R-16             |
| 介面                                   | 原生 HTML、CSS、JavaScript             | 內建     | —      | R-16             |
| 路由                                   | hash 路由                              | 自行實作 | —      | R-16             |
| DOM 建立工具                           | `h(tag, props, ...children)`           | 自行實作 | —      | R-16             |
| 日／週行事曆                           | CSS Grid 繪製，窄螢幕改為堆疊區塊      | 自行實作 | —      | R-16             |
| 時間顯示                               | `Intl.DateTimeFormat`（`Asia/Taipei`） | 內建     | —      | R-06             |
| 文案與狀態名稱                         | `shared/src/copy.js`                   | 自行實作 | —      | R-16、R-18       |
| 台北時間運算                           | `shared/src/taipei.js`                 | 自行實作 | —      | R-06、R-16、R-18 |
| 通知輪詢                               | `setInterval` 每 30 秒查詢未讀數       | 自行實作 | —      | R-13             |

## 後端

| 項目                 | 技術                                                     | 類型     | 版本    | 研究紀錄   |
| -------------------- | -------------------------------------------------------- | -------- | ------- | ---------- |
| HTTP 伺服器          | `node:http` ＋ 含路徑參數的路由器                        | 自行實作 | —       | R-02       |
| 資料庫驅動           | `mysql2`                                                 | 套件     | ^3.24.0 | R-03       |
| 密碼雜湊             | `node:crypto`（`scrypt`、`timingSafeEqual`）             | 內建     | —       | R-04       |
| 階段憑證             | `node:crypto`（`randomBytes`、SHA-256）加 `sessions` 表  | 內建     | —       | R-04       |
| 授權策略             | `backend/src/domain/policy.js`                           | 自行實作 | —       | R-05       |
| 時鐘                 | `backend/src/clock.js`                                   | 自行實作 | —       | R-06、R-17 |
| 時段占用與併發       | `booking_slots` 主鍵加交易                               | 自行實作 | —       | R-07       |
| 持有額度與暫停       | 使用者列鎖 `SELECT ... FOR UPDATE`                       | 自行實作 | —       | R-08       |
| 預約狀態機與操作紀錄 | `bookingStateMachine.js`、`transition()`、不可更動觸發器 | 自行實作 | —       | R-09       |
| 背景排程             | `setInterval` 掃描加 `FOR UPDATE SKIP LOCKED`            | 自行實作 | —       | R-10       |
| 候補保留與遞補       | `waitlist_entries`、`offerFreedSlots()`                  | 自行實作 | —       | R-11       |
| 週期性預約           | `expandSeries()`、`booking_series`                       | 自行實作 | —       | R-12       |
| 站內通知             | `notifications` 表加 `notify()`                          | 自行實作 | —       | R-13       |
| 報表計算             | `backend/src/domain/report.js`                           | 自行實作 | —       | R-14       |
| CSV 序列化           | `backend/src/domain/csv.js`（UTF-8 BOM、CRLF）           | 自行實作 | —       | R-14       |
| 規則管理             | `rules` 表加 `rule_changes` 表                           | 自行實作 | —       | R-15       |
| 環境變數             | `--env-file=.env`                                        | 內建     | —       | R-18       |
| 資料庫遷移           | 依序執行 `migrations/*.sql` 的腳本                       | 自行實作 | —       | R-18       |
| 首位管理員建立       | `npm run bootstrap-admin -w backend`                     | 自行實作 | —       | R-18       |
| 靜態檔               | 提供 `frontend/dist`                                     | 自行實作 | —       | R-02、R-16 |

## 測試

| 項目         | 技術                                        | 類型     | 版本    | 研究紀錄 |
| ------------ | ------------------------------------------- | -------- | ------- | -------- |
| 單元與整合   | `node:test` ＋ `fetch`                      | 內建     | —       | R-17     |
| 驗收（BDD）  | `@cucumber/cucumber`                        | 套件     | ^13.0.0 | R-17     |
| 瀏覽器自動化 | `playwright`                                | 套件     | ^1.65.0 | R-17     |
| 效能種子資料 | 種子腳本（200 位員工、20 個場地、一年預約） | 自行實作 | —       | R-17     |
| 測試時鐘     | `PUT /__test/clock`、`POST /__test/tick`    | 自行實作 | —       | R-17     |

## 開發工具

| 項目   | 技術       | 類型 | 版本    | 研究紀錄 |
| ------ | ---------- | ---- | ------- | -------- |
| Lint   | `eslint`   | 套件 | ^10.0.0 | R-18     |
| 格式化 | `prettier` | 套件 | ^3.9.0  | R-18     |

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

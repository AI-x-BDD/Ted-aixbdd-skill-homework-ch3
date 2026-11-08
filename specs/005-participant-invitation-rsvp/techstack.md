# 技術堆疊：參與者邀請與出席回覆

**功能分支**：`005-participant-invitation-rsvp` | **日期**：2026-11-08 | **研究紀錄**：[research.md](./research.md)

本文件列出本次開發採用的全部技術，作為後續規劃與任務拆解的依據；各技術的選用理由見研究紀錄中對應的 R 編號。

---

## 執行環境

| 項目     | 技術                                                     | 版本          | 研究紀錄   |
| -------- | -------------------------------------------------------- | ------------- | ---------- |
| 執行環境 | Node.js                                                  | 24 LTS        | R-01       |
| 程式語言 | JavaScript（ES Modules）                                 | ES2024        | R-01       |
| 資料庫   | MySQL                                                    | 8.4 LTS 以上  | R-01       |
| 套件管理 | npm workspaces（`frontend`、`backend`、`shared`、`e2e`） | 隨 Node.js 24 | R-01、R-14 |

## 前端

| 項目                   | 技術                                                                  | 類型     | 版本   | 研究紀錄 |
| ---------------------- | --------------------------------------------------------------------- | -------- | ------ | -------- |
| 建置工具               | `vite`                                                                | 套件     | ^8.0.0 | R-01     |
| 介面                   | 原生 HTML、CSS、JavaScript                                            | 內建     | —      | R-01     |
| 受邀 Email 解析        | `frontend/src/lib/emails.js`                                          | 自行實作 | —      | R-12     |
| 預約表單邀請欄位       | `frontend/src/pages/bookingFormPage.js` 擴充                          | 自行實作 | —      | R-12     |
| 我的邀請列表與詳情     | `frontend/src/pages/invitationsPage.js`、`router.js`、`nav.js` 擴充   | 自行實作 | —      | R-12     |
| 預約詳情的受邀者面板   | `frontend/src/components/inviteePanel.js`、`bookingCard.js` 擴充      | 自行實作 | —      | R-12     |
| 通知連結與 API 呼叫    | `notificationsPage.js`、`frontend/src/api/client.js` 擴充             | 自行實作 | —      | R-03、R-12 |

## 後端

| 項目                     | 技術                                                                                 | 類型     | 版本    | 研究紀錄         |
| ------------------------ | ------------------------------------------------------------------------------------ | -------- | ------- | ---------------- |
| HTTP 伺服器              | `node:http`                                                                          | 內建     | —       | R-01             |
| 資料庫驅動               | `mysql2`                                                                             | 套件     | ^3.24.0 | R-01             |
| 資料庫遷移               | `backend/src/db/migrations/009_invitations.sql`                                      | 自行實作 | —       | R-02、R-03       |
| 邀請資料存取             | `backend/src/repositories/invitationRepository.js`                                   | 自行實作 | —       | R-02             |
| 邀請服務與端點           | `backend/src/services/invitationService.js`、`backend/src/routes/invitations.js`     | 自行實作 | —       | R-04、R-07、R-08 |
| 出席統計                 | `backend/src/domain/invitations.js`                                                  | 自行實作 | —       | R-08             |
| 預約建立時建立邀請       | `backend/src/services/bookingService.js` 的 `createBooking` 擴充                     | 自行實作 | —       | R-04             |
| 預約狀態轉換同步邀請     | `backend/src/services/bookingTransition.js` 的 `transition` 擴充                     | 自行實作 | —       | R-05             |
| 預約修改時處理邀請       | `backend/src/services/bookingService.js` 的 `updateBooking` 擴充                     | 自行實作 | —       | R-06             |
| 開始前提醒工作           | `backend/src/jobs/inviteeReminders.js`、`server.js` 匯入                             | 自行實作 | —       | R-09             |
| 帳號停用處理邀請         | `backend/src/services/userService.js` 的 `deactivateUser` 擴充                       | 自行實作 | —       | R-10             |
| 通知類型與文案           | `shared/src/copy.js`、`notificationService.js`、`notificationRepository.js` 擴充     | 自行實作 | —       | R-03             |
| 授權動作                 | `backend/src/domain/policy.js` 的 `can()` 新增 `invitation:respond`、`invitation:manage` | 自行實作 | —   | R-11             |

## 測試

| 項目             | 技術                                | 類型     | 版本    | 研究紀錄 |
| ---------------- | ----------------------------------- | -------- | ------- | -------- |
| 單元與整合       | `node:test` ＋ `fetch`              | 內建     | —       | R-14     |
| 驗收（BDD）      | `@cucumber/cucumber`                | 套件     | ^13.0.0 | R-14     |
| 瀏覽器自動化     | `playwright`                        | 套件     | ^1.65.0 | R-14     |
| 邀請驗收案例     | `e2e/features/invitations.feature`  | 自行實作 | —       | R-14     |

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

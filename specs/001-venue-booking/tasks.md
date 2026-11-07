---

## description: "場地／會議室預約系統的實作任務清單"

# 任務：場地／會議室預約系統

**[P]**：可與同段其他 [P] 任務並行（不同檔案、不依賴未完成的任務）

## 路徑慣例

- Web 應用程式（npm workspaces）：`frontend/`、`backend/`、`shared/`，皆位於 repo 根目錄（見 plan.md「原始碼」）；驗收測試專案 `e2e` 屬測試基礎建設，不在本清單
- 介面 ID（UI-01～UI-12、API-01～API-11、DB-01～DB-08）對應 plan.md「介面盤點」；本功能沒有檔案系統端
- 資料庫端任務落在 `backend/src/db/migrations/`、`backend/src/repositories/`；後端任務落在 `backend/src/lib/`、`domain/`、`services/`、`jobs/`、`routes/`、`scripts/`；前端任務落在 `frontend/`；前後端共用的台北時間運算與文案落在 `shared/src/`
- UI 文案、`data-testid` 與狀態一律以 `contracts/ui-contract.md` 為準，版面參考 `contracts/prototype/` 內各頁面；API 以 `contracts/openapi.yaml` 為準；資料表以 `data-model.dbml` 為準
- 目前時間只能經 `backend/src/clock.js` 取得，SQL 不使用 `NOW()`；所有時間存 UTC、顯示用台北時間（UTC+8）

---

## Phase 1：Setup（共用基礎設施）

**目的**：建立專案骨架與工具鏈

- [x] T001 建立根目錄 `package.json`：`"private": true`、`"type": "module"`、`"engines": { "node": ">=24" }`、`"workspaces": ["frontend", "backend", "shared"]`，scripts 包含 `lint`（`eslint .`）、`format`（`prettier --write .`）、`dev:backend`（`npm run start -w backend`）、`dev:frontend`（`npm run dev -w frontend`）；devDependencies `eslint@^10.0.0`、`prettier@^3.9.0`
  - 📎 必讀：`techstack.md › 執行環境 › 套件管理` — workspaces 的成員與套件管理方式以此為準
  - 📎 必讀：`techstack.md › 套件安裝清單 › eslint、prettier` — 根目錄 devDependencies 的套件與版本以此為準
- [x] T002 [P] 建立 `backend/package.json`：`"type": "module"`；dependencies `mysql2@^3.24.0`；scripts `start`（`node --env-file=.env src/server.js`）、`migrate`（`node --env-file=.env src/db/migrate.js`）、`bootstrap-admin`（`node --env-file=.env scripts/bootstrap-admin.js`）
  - 📎 必讀：`techstack.md › 套件安裝清單 › backend` — backend 的 dependencies 與版本以此為準，不得增列
  - 📎 必讀：`techstack.md › 後端 › 環境變數` — scripts 載入環境變數的方式以此為準
  - 📎 必讀：`research.md › R-03` — 後端執行期只引入一個套件的決定以此為準
- [x] T003 [P] 建立 `frontend/package.json`（`"type": "module"`；devDependencies `vite@^8.0.0`；scripts `dev`、`build`）與 `frontend/vite.config.js`：`server.proxy` 將 `/api` 轉發至 `http://localhost:3000`，開發埠 `5173`
  - 📎 必讀：`techstack.md › 套件安裝清單 › frontend` — frontend 的 devDependencies 與版本以此為準
  - 📎 必讀：`techstack.md › 前端 › 建置工具` — Vite 的用途與 `/api` 轉發設定以此為準
- [x] T004 [P] 建立 `shared/package.json`：`"name": "shared"`、`"private": true`、`"type": "module"`，沒有 dependencies 與 devDependencies，供前後端以 `shared/src/…` 路徑匯入
  - 📎 必讀：`techstack.md › 套件安裝清單 › shared` — shared 沒有任何相依套件的決定以此為準
  - 📎 必讀：`research.md › R-18` — shared 放台北時間運算與文案的範圍以此為準
- [x] T005 [P] 建立根目錄 `eslint.config.js`（flat config，涵蓋 backend 的 Node 環境、frontend 的 browser 環境與 shared）與 `.prettierrc`
  - 📎 必讀：`techstack.md › 開發工具` — lint 與格式化工具的選擇與 flat config 形式以此為準
  - 📎 必讀：`research.md › R-18` — ESLint 只用 flat config 的決定以此為準
- [x] T006 [P] 建立 `backend/.env.example`（`PORT=3000`、`DATABASE_URL`、`ALLOWED_ORIGINS=http://localhost:5173`、`SCAN_INTERVAL_MS=30000`、`ADMIN_BOOTSTRAP_EMAIL`、`ADMIN_BOOTSTRAP_PASSWORD`），並在根目錄 `.gitignore` 加入 `node_modules/`、`backend/.env`、`frontend/dist/`
  - 📎 必讀：`techstack.md › 後端 › 環境變數` — 環境變數載入方式以此為準
  - 📎 必讀：`research.md › R-18` — 必備環境變數的清單以此為準

---

## Phase 2：Foundational（阻擋性前置）

**目的**：所有使用者故事都依賴的核心基礎（資料庫連線與遷移、帳號與規則資料表、登入驗證、路由、背景排程骨架、前端骨架）

**⚠️ 重要**：本階段完成前不得開始任何使用者故事

- [x] T007 [P] 實作 `shared/src/taipei.js`（固定偏移 UTC+8）：`toTaipeiParts(date)` 回傳 `{ date: 'YYYY-MM-DD', time: 'HH:mm', weekday }`（週日為 0）、`fromTaipei(date, time)` 回傳 UTC `Date`（`24:00` 視為隔日 `00:00`）、`taipeiDayStart(date)`、`addTaipeiMonths(dateString, months)`（月底往前取，例如 1 月 31 日加 1 個月為 2 月底）、`formatTaipei(date, options)`（以 `Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hourCycle: 'h23' })` 格式化）
  - 📎 必讀：`research.md › R-06` — 台北時間運算的函式與固定偏移決定以此為準
  - 📎 必讀：`spec.md › NFR-014` — 所有時間以台北時間顯示、不隨裝置時區改變的要求以此為準
- [x] T008 [P] 實作 `shared/src/copy.js`：匯出預約狀態中文名稱（`pending` 待審核、`confirmed` 已確認、`checked_in` 已報到、`completed` 已完成、`rejected` 已駁回、`cancelled` 已取消、`no_show` 未到場）、角色名稱（一般員工、場地審核者、系統管理員）與通知訊息樣板函式（依通知類型與參數組出繁中訊息，後續各故事補上對應樣板）
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.BookingStatus` — 狀態代碼與中文名稱的對應以此為準
  - 📎 必讀：`research.md › R-16` — 文案與狀態名稱集中在 shared/src/copy.js 的決定以此為準
  - 📎 必讀：`spec.md › NFR-015` — 錯誤訊息須說明發生什麼事與可以怎麼做的要求以此為準
- [x] T009 [P] 實作 `backend/src/config.js`：讀取 `PORT`（預設 `3000`）、`DATABASE_URL`、`ALLOWED_ORIGINS`（預設 `http://localhost:5173`，以逗號分隔）、`SCAN_INTERVAL_MS`（預設 `30000`）、`ADMIN_BOOTSTRAP_EMAIL`、`ADMIN_BOOTSTRAP_PASSWORD`，匯出凍結物件
  - 📎 必讀：`research.md › R-18` — 環境變數清單與預設值以此為準
  - 📎 必讀：`research.md › R-10` — 掃描間隔預設 30 秒的決定以此為準
- [x] T010 [P] 實作 `backend/src/clock.js`：匯出 `now()` 回傳目前時間的 `Date`；全專案取得目前時間只能經過它，SQL 一律以 `:now` 參數帶入，不使用 `NOW()` 或 `CURDATE()`
  - 📎 必讀：`research.md › R-06` — 目前時間由 clock 提供、SQL 不用 NOW() 的決定以此為準
- [x] T011 [P] 實作 `backend/src/lib/router.js`：路由器以「方法 + 路徑樣式（`:param`）」比對，啟動時把樣式編譯成正規表示式，解析 path 與 query 參數，未匹配回傳 404
  - 📎 必讀：`research.md › R-02` — 自行實作含路徑參數的路由器、不引入框架的決定以此為準
  - 📎 必讀：`techstack.md › 後端 › HTTP 伺服器` — HTTP 伺服器的實作方式以此為準
- [x] T012 [P] 實作 `backend/src/lib/http.js`：`sendJson(res, status, body)`、`sendError(res, status, message, extra)`（回應 `{ message }`，`extra` 可帶 `fields`、`violations`、`conflicts`、`impact`，訊息為繁中、說明發生什麼事與可以怎麼做，不含代碼與技術細節）、`readJsonBody(req)`（上限 100 KB）、非 GET 請求須為 `Content-Type: application/json` 且 `Origin` 存在時須屬 `ALLOWED_ORIGINS`（否則 403）、`setSessionCookie`／`clearSessionCookie`（`sid`，`HttpOnly`、`SameSite=Lax`、`Path=/`，TLS 或 `X-Forwarded-Proto: https` 時加 `Secure`）
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Error` — 錯誤回應的欄位結構以此為準
  - 📎 必讀：`research.md › R-02` — 狀態碼慣例與請求本文上限以此為準
  - 📎 必讀：`research.md › R-04` — cookie 屬性與來源檢查的規則以此為準
  - 📎 必讀：`spec.md › NFR-015` — 錯誤訊息的內容要求以此為準
- [x] T013 [P] 實作 `backend/src/db/pool.js`：以 `mysql2/promise` 建立連線池（`timezone: 'Z'`、`namedPlaceholders: true`、`connectionLimit: 10`、`charset: 'utf8mb4'`，每條連線建立後執行 `SET time_zone = '+00:00'`），匯出 `withTransaction(fn)`：取得連線 → `BEGIN` → 執行 `fn(conn)` → `COMMIT`，例外時 `ROLLBACK` 並重拋；遇 `ER_LOCK_DEADLOCK` 或鎖逾時整個交易以隨機 20～100 毫秒間隔重試最多 3 次，仍失敗拋出狀態 409、訊息為「系統忙碌，請稍後再試。」的錯誤
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界` — 交易預設隔離等級、重試次數與失敗回應以此為準
  - 📎 必讀：`research.md › R-07` — 死結重試的間隔與次數以此為準
  - 📎 必讀：`research.md › R-18` — 連線池參數以此為準
- [x] T014 [P] 實作 `backend/src/db/migrate.js`：約 30 行，建立 `schema_migrations` 表，依檔名順序執行 `backend/src/db/migrations/*.sql` 中尚未執行的檔案並記錄檔名；僅遷移用連線開啟 `multipleStatements`
  - 📎 必讀：`research.md › R-18` — 遷移腳本的執行方式以此為準
  - 📎 必讀：`techstack.md › 後端 › 資料庫遷移` — 遷移採自行實作腳本的決定以此為準
- [x] T015 撰寫 `backend/src/db/migrations/001_foundation.sql`（DB-01、DB-08 的 `rules`），欄位、索引與約束依 data-model.dbml 原樣建立：`users`（含 `must_change_password`、`is_active`、`suspended_until_at`、`no_show_counted_from_at`）、`user_roles`（`role` 只能是 `reviewer`、`admin`）、`sessions`（`token_hash` 唯一）、`rules`（`rule_key` 只能是 14 個規則鍵、`int_value >= 1`），並寫入 14 筆規則預設值（`updated_by` 為 `NULL`）；外鍵一律 restrict（依賴 T014）
  - 📎 必讀：`data-model.dbml › Table users` — users 的欄位、型別、預設值與索引以此為準
  - 📎 必讀：`data-model.dbml › Table user_roles` — user_roles 的欄位與角色約束以此為準
  - 📎 必讀：`data-model.dbml › Table sessions` — sessions 的欄位與唯一索引以此為準
  - 📎 必讀：`data-model.dbml › Table rules` — rules 的欄位與約束以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 規則預設值` — 14 個規則鍵、單位與預設值以此為準
  - 📎 必讀：`data-model.dbml › Ref fk_user_roles_user_id、fk_sessions_user_id、fk_rules_updated_by` — 外鍵方向與刪除行為以此為準
- [x] T016 實作 `backend/src/repositories/sessionRepository.js`：`findValid(conn, tokenHash, now)`（未過期才回傳）、`extend(conn, id, expiresAt)`（依賴 T015）
  - 📎 必讀：`data-model.dbml › Table sessions` — 查詢使用的欄位與索引以此為準
- [x] T017 實作 `backend/src/repositories/userRepository.js` 的 `findById(conn, id)`：回傳帳號欄位與角色清單（`roles`，不含隱含的一般員工）（依賴 T015）
  - 📎 必讀：`data-model.dbml › Table users` — 查詢欄位以此為準
  - 📎 必讀：`data-model.dbml › Table user_roles` — 角色清單的來源以此為準
- [x] T018 實作 `backend/src/repositories/ruleRepository.js` 的 `loadAll(conn)`：讀取全部規則列並回傳以 `rule_key` 為鍵的物件；每個交易開始時讀取一次，整個交易使用同一份快照，不做跨請求快取（依賴 T015）
  - 📎 必讀：`research.md › R-15` — 規則快照的讀取時機與不快取的決定以此為準
  - 📎 必讀：`data-model.dbml › Table rules` — 規則表的欄位以此為準
- [x] T019 [P] 實作 `backend/src/domain/policy.js`：純函式 `can(user, action, resource)`，未知動作一律拒絕；提供 `hasRole(user, role)`、`isAdmin(user)`、`isOwner(user, booking)` 共用判斷，後續各故事在各自任務補上其動作的判斷規則
  - 📎 必讀：`research.md › R-05` — 授權集中成無 I/O 純函式、預設拒絕的決定以此為準
  - 📎 必讀：`spec.md › NFR-012` — 略過畫面直接送出也要被拒絕的要求以此為準
- [x] T020 實作 `backend/src/lib/auth.js`：`authenticate(req, conn, now)` 讀取 cookie `sid` → SHA-256 → `sessionRepository.findValid` → `userRepository.findById`；帳號停用視同未登入；成功時把閒置期限延長 12 小時；`requireAuth(handler)` 包裝路由處理函式並提供 `{ user, now }`，未登入回 401；帳號 `must_change_password` 為真時，除「查詢自己、變更密碼、登出」外一律 403 並回「請先設定新密碼」（依賴 T010、T012、T016、T017）
  - 📎 必讀：`research.md › R-04` — 階段憑證的雜湊、期限與強制改密碼的規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.securitySchemes` — 以 cookie sid 驗證登入的方式以此為準
  - 📎 必讀：`contracts/openapi.yaml › getCurrentUser › responses 200／401` — 未登入與已登入的回應以此為準
- [x] T021 實作 `backend/src/jobs/scanner.js`：`registerJob(name, fn)` 與 `startScanner({ pool, intervalMs })`，以 `setInterval` 每 `SCAN_INTERVAL_MS` 執行 `runDueJobs(now)`，上一輪未完成時略過；匯出 `processDue(pool, { select, handle })` 輔助函式：交易內以 `ORDER BY 到期時間 LIMIT 100 FOR UPDATE SKIP LOCKED` 取到期列、逐筆呼叫 `handle`，單筆失敗只記錄日誌並繼續，處理到沒有到期列為止（依賴 T010、T013）
  - 📎 必讀：`research.md › R-10` — 掃描間隔、不重疊與逐筆處理的決定以此為準
  - 📎 必讀：`contracts/openapi.yaml › x-background-jobs` — 背景排程的運作原則與各工作的觸發條件以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 鎖定順序` — 到期列以 SKIP LOCKED 取得的規則以此為準
- [x] T022 實作 `backend/src/app.js`（以 `router` 組合各 `routes/*.js` 匯出的 `register(router)`，未捕捉例外回應 500 與「系統發生問題，請稍後再試。」）與 `backend/src/server.js`（`http.createServer` 聽 `config.PORT`、非 `/api` 的 GET 提供 `frontend/dist` 靜態檔並對未知路徑回傳 `index.html`、啟動時呼叫 `startScanner`）（依賴 T009、T011、T012、T020、T021）
  - 📎 必讀：`research.md › R-02` — 單一行程提供 API 與靜態檔的決定以此為準
  - 📎 必讀：`techstack.md › 後端 › 靜態檔` — 靜態檔提供方式以此為準
- [x] T023 [P] 實作 `frontend/src/lib/h.js`：約 30 行的 `h(tag, props, ...children)` DOM 建立工具，`props` 支援 `class`、`text`、事件（`on…`）、`aria-*`，以及 `testid` 轉為 `data-testid`
  - 📎 必讀：`research.md › R-16` — 元件是回傳 DOM 節點的函式、自寫 h 工具的決定以此為準
  - 📎 必讀：`techstack.md › 前端 › DOM 建立工具` — DOM 建立工具的形式以此為準
- [x] T024 [P] 實作 `frontend/src/api/client.js`：`fetch` 包裝（`get`、`post`、`put`、`patch`、`del`，JSON 請求與回應），非 2xx 時拋出帶 `status`、`message`、`fields`、`violations`、`conflicts`、`impact` 的錯誤；網路失敗拋出「無法連線，請檢查網路後再試一次。」；收到 401 時導向 `#/login`
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Error` — 前端解析的錯誤欄位以此為準
  - 📎 必讀：`spec.md › NFR-015` — 失敗訊息須說明原因與下一步的要求以此為準
- [x] T025 實作 `frontend/src/lib/time.js`：`formatDate(dateString)` 輸出「{YYYY}年{M}月{D}日（週{X}）」、`formatRange(startIso, endIso)` 輸出 `HH:mm–HH:mm`（台北時間）、`startTimeOptions()`（`00:00`～`23:30`，30 分鐘間隔）、`endTimeOptions()`（`00:30`～`24:00`），皆引用 `shared/src/taipei.js`（依賴 T007）
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 時間顯示` — 日期與時間格式、30 分鐘下拉與 24:00 的規則以此為準
  - 📎 必讀：`research.md › R-06` — 時間輸入只送台北當地日期與時分的決定以此為準
- [x] T026 [P] 建立 `frontend/src/styles/tokens.css`（顏色、間距、字級等 CSS 自訂屬性，含淺色與深色）、`base.css`（行動優先；寬度 768 像素為版面分界；寬度 360 像素時不得出現水平捲動；可見的焦點指示）與 `components.css`（導覽列、表單、列表卡片、表格在窄螢幕改為卡片、對話框、徽章），以 `contracts/prototype/proto.css` 為參考
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 導覽列收合分界、版面與輸入方式的共同要求以此為準
  - 📎 必讀：`contracts/prototype/proto.css` — 樣式數值與版面以原型為參考來源
  - 📎 必讀：`spec.md › NFR-016` — 桌機與手機瀏覽器皆可使用、360 像素寬免水平捲動的要求以此為準
- [x] T027 [P] 實作 `frontend/src/components/dialog.js` 與 `frontend/src/components/toast.js`：`openDialog({ title, body, actions })` 以 `<dialog>` 的 `showModal()` 呈現，Esc 取消並將焦點還給觸發元素，回傳 Promise；`showToast(message)` 顯示 `app-toast`（`role="status"`）
  - 📎 必讀：`contracts/prototype/proto.js › app-toast` — 提示訊息的 testid 與角色以此為準
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 對話框與提示的共同行為以此為準
- [x] T028 建立 `frontend/index.html`（`<html lang="zh-Hant-TW">`）、`frontend/src/main.js` 與 `frontend/src/router.js`：hash 路由 `#/login`、`#/change-password`、`#/venues`、`#/venues/:venueId`、`#/bookings/new`、`#/bookings/:bookingId/edit`、`#/bookings`、`#/waitlist`、`#/notifications`、`#/reviews`、`#/admin/venues`、`#/admin/users`、`#/admin/bookings`、`#/admin/rules`、`#/admin/reports`，頁面模組匯出 `render(container, params)`；啟動時呼叫 `GET /api/auth/me`，未登入導向 `#/login` 並記住原目標、須先改密碼時除 `#/change-password` 外一律導向 `#/change-password`、角色不足顯示 `app-forbidden`「沒有權限」頁（依賴 T023～T025、T027）
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 路由、路由守衛` — 路由表、登入後回原頁與角色不足的呈現以此為準
  - 📎 必讀：`research.md › R-16` — hash 路由與頁面模組形式以此為準
  - 📎 必讀：`contracts/openapi.yaml › getCurrentUser` — 啟動時取得目前使用者的回應以此為準

**Checkpoint**：基礎完成，可開始實作使用者故事

---

## Phase 3：使用者故事 1 - 登入系統與管理帳號（Priority: P1） 🎯 MVP

**目標**：管理員建立帳號並指派角色，使用者以 Email 與密碼登入、變更密碼，管理員重設密碼後使用者首次登入須先改密碼（UI-01、UI-09 建立與編輯、API-01 登入與帳號管理、DB-01）

**完成判準**：管理員建立一個一般員工帳號後，該員工以 Email 與密碼登入成功並只看到員工功能，輸入錯誤密碼時顯示「Email 或密碼錯誤」，開啟帳號管理頁時顯示「沒有權限」

### 資料庫端（DB-01）

- [x] T029 [P] [US1] 在 `backend/src/repositories/sessionRepository.js` 新增 `insert(conn, { userId, tokenHash, expiresAt })`、`deleteByTokenHash(conn, tokenHash)`、`deleteByUser(conn, userId)`
  - 📎 必讀：`data-model.dbml › Table sessions` — 階段表的欄位與索引以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 登入` — 登入時只插入 sessions 的交易範圍以此為準
- [x] T030 [P] [US1] 在 `backend/src/repositories/userRepository.js` 新增 `findByEmail(conn, email)`（Email 已正規化）、`insert(conn, user)`、`replaceRoles(conn, userId, roles)`、`updateName(conn, id, name)`、`updatePassword(conn, id, hash, mustChange)`、`list(conn, { keyword, role, limit })`（上限 200，回傳含角色）、`lockById(conn, id)`（`SELECT … FOR UPDATE`）、`countActiveAdmins(conn)`
  - 📎 必讀：`data-model.dbml › Table users` — 帳號欄位、唯一索引與預設值以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 建立帳號` — 建立帳號與角色的交易範圍以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 編輯帳號` — 編輯時先鎖 users 列、不得移除最後一位管理員的規則以此為準

### 後端（API-01 登入與帳號管理）

- [x] T031 [P] [US1] 實作 `backend/src/lib/password.js`：`hashPassword(password)` 以 `node:crypto` 的 `scrypt`（N=131072、r=8、p=1、金鑰長度 64、`maxmem` 256 MiB、16 位元組隨機鹽）產生 `scrypt$N$r$p$鹽$雜湊` 字串；`verifyPassword(password, stored)` 解析參數並以 `timingSafeEqual` 比對；`verifyDummy(password)` 對固定假雜湊執行一次相同成本的運算
  - 📎 必讀：`research.md › R-04` — scrypt 參數、密碼長度與時間對齊的決定以此為準
  - 📎 必讀：`techstack.md › 後端 › 密碼雜湊` — 密碼雜湊採 node:crypto 內建的決定以此為準
- [x] T032 [US1] 實作 `backend/src/services/authService.js`：`login(email, password)`（Email 去空白轉小寫；找不到帳號也呼叫 `verifyDummy`；密碼驗證通過後才檢查停用，停用回 403「帳號已停用」；錯誤一律回 401「Email 或密碼錯誤」；成功以 `randomBytes(32)` 產生憑證，只存 SHA-256，閒置期限 12 小時）、`logout(tokenHash)`、`changePassword(userId, oldPassword, newPassword)`（舊密碼錯誤回 400；新密碼 8～128 個字元；成功清除 `must_change_password` 並刪除該帳號全部階段）、`currentUser(user)`（依賴 T029～T031）
  - 📎 必讀：`contracts/openapi.yaml › login` — 登入的請求、回應與 400／401／403 的觸發條件以此為準
  - 📎 必讀：`contracts/openapi.yaml › changePassword` — 變更密碼的驗證與清除階段的規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.CurrentUser` — 目前使用者回應的欄位以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 變更密碼／重設密碼` — 變更密碼時一併刪除全部階段的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-003` — 登入失敗不透露原因、停用帳號不得登入的要求以此為準
- [x] T033 [US1] 實作 `backend/src/services/userService.js`：`listUsers`（`keyword`、`role` 篩選）、`createUser`（Email 唯一，重複回 409「此 Email 已被使用」；初始密碼 8～128 個字元；角色只能是 `reviewer`、`admin`）、`updateUser`（Email 不可修改；先鎖該帳號，不得移除最後一位啟用中管理員，違反回 409；只改姓名與角色）、`resetUserPassword`（設定暫時密碼、`must_change_password` 設為真並刪除該帳號全部階段）；皆須管理員（依賴 T030、T031）
  - 📎 必讀：`contracts/openapi.yaml › createUser` — 建立帳號的欄位驗證與 201／400／409 的條件以此為準
  - 📎 必讀：`contracts/openapi.yaml › updateUser` — 編輯帳號的限制與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › resetUserPassword` — 重設密碼的請求與 204 回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › listUsers` — 列表篩選與上限以此為準
  - 📎 必讀：`spec.md › FR-001` — 帳號欄位與 Email 唯一、不提供自行註冊的要求以此為準
  - 📎 必讀：`spec.md › FR-002` — 一個帳號可有多個角色的要求以此為準
- [x] T034 [US1] 在 `backend/src/domain/policy.js` 的 `can` 補上動作 `user:manage`、`user:list`（僅管理員），以及 `auth:self`（任何已登入帳號）
  - 📎 必讀：`research.md › R-05` — 管理員專屬動作的範圍以此為準
  - 📎 必讀：`spec.md › SC-007` — 跨權限操作 100% 被拒絕的要求以此為準
- [x] T035 [US1] 實作 `backend/src/routes/auth.js`（`POST /api/auth/login`、`POST /api/auth/logout` 回 204、`GET /api/auth/me`、`PUT /api/auth/password` 回 204）與 `backend/src/routes/users.js`（`GET /api/users`、`POST /api/users` 回 201、`PATCH /api/users/{userId}`、`PUT /api/users/{userId}/password` 回 204），皆呼叫 `can` 檢查並註冊至 `backend/src/app.js`（登入除外皆須登入）（依賴 T032～T034）
  - 📎 必讀：`contracts/openapi.yaml › logout、getCurrentUser` — 登出與目前使用者的回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › listUsers、createUser、updateUser、resetUserPassword` — 帳號端點的路徑、方法與狀態碼以此為準
- [x] T036 [US1] 實作 `backend/scripts/bootstrap-admin.js`：讀取 `ADMIN_BOOTSTRAP_EMAIL` 與 `ADMIN_BOOTSTRAP_PASSWORD`，系統尚無任何管理員時建立一位管理員帳號（`must_change_password` 為假），已有管理員時不做任何事並印出提示（依賴 T030、T031）
  - 📎 必讀：`research.md › R-18` — 第一位管理員以啟動指令建立的決定以此為準
  - 📎 必讀：`spec.md › FR-001` — 不提供自行註冊，因此需要帶外建立第一位管理員

### 前端（UI-01、UI-09 建立與編輯）

- [x] T037 [P] [US1] 實作 `frontend/src/components/nav.js`：導覽列 `app-nav`（一般員工顯示「場地」「我的預約」「候補」「通知」；審核者與管理員另顯示「待審核」；管理員另顯示「場地管理」「帳號管理」「全部預約」「規則管理」「報表」）、使用者姓名、`app-change-password`、`app-logout`（呼叫 `POST /api/auth/logout` 後導向 `#/login`）、寬度低於 768 像素時以 `app-nav-toggle` 收合、`app-notification-badge` 插槽（未讀數為 0 不顯示）、`suspension-banner`（目前使用者的預約權限暫停時顯示解除時間）；`app-forbidden` 頁
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 導覽列、目前使用者` — 導覽項目、收合與暫停提示的呈現以此為準
  - 📎 必讀：`contracts/prototype/proto.js › app-nav` — 導覽列的 testid 與版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.CurrentUser` — 導覽列依角色與暫停狀態顯示所用的欄位以此為準
- [x] T038 [P] [US1] 實作 `frontend/src/pages/loginPage.js`（`#/login`）：`auth-login-form`、`auth-email`、`auth-password`、`auth-login-submit`，送出時立即 `disabled`；失敗顯示「Email 或密碼錯誤」，停用帳號顯示「帳號已停用」，載入 `auth-page-loading`、錯誤 `auth-page-error`；`auth-forgot-hint` 顯示「請洽管理員重設密碼」，不提供 Email 自助重設；成功後回到原目標頁，須先改密碼者導向 `#/change-password`
  - 📎 必讀：`contracts/ui-contract.md › UI-01 登入與密碼介面 › 操作` — 登入的操作流程以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 登入與密碼介面 › 狀態` — 載入、錯誤與停用帳號的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 登入與密碼介面 › 文案與無障礙` — 登入文案、testid 與無障礙屬性以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/login.html › auth-login-form` — 登入頁版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › login` — 登入的請求欄位與錯誤回應以此為準
- [x] T039 [P] [US1] 實作 `frontend/src/pages/changePasswordPage.js`（`#/change-password`）：`auth-change-form`、`auth-old-password`、`auth-new-password`、`auth-confirm-password`、`auth-change-submit`；新密碼與確認不一致或長度不在 8～128 時不送出並標示欄位；成功後回登入頁，須以新密碼重新登入；首次登入強制改密碼時不顯示「返回場地」
  - 📎 必讀：`contracts/ui-contract.md › UI-01 登入與密碼介面 › 操作` — 變更密碼與強制改密碼的流程以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 登入與密碼介面 › 文案與無障礙` — 變更密碼的文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/login.html › auth-change-form` — 變更密碼版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › changePassword` — 變更密碼的請求與錯誤回應以此為準
- [x] T040 [US1] 實作 `frontend/src/pages/adminUsersPage.js`（`#/admin/users`，UI-09 建立、編輯與重設密碼）：`admin-users-search`、`admin-users-list`／`admin-users-item`、`user-add`、`user-edit`、表單欄位 `user-email`、`user-name`、`user-password`、角色勾選；重設密碼對話框 `user-reset-dialog-cancel`；Email 重複顯示「此 Email 已被使用」；停用與啟用按鈕由使用者故事 11 加入（依賴 T037）
  - 📎 必讀：`contracts/ui-contract.md › UI-09 帳號管理介面 › 操作` — 建立、編輯與重設密碼的流程以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-09 帳號管理介面 › 狀態` — 列表載入、空狀態與錯誤的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-09 帳號管理介面 › 文案與無障礙` — 帳號管理文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/admin-users.html › admin-users-list` — 帳號管理頁版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.User` — 列表顯示的帳號欄位以此為準

**Checkpoint**：US1 符合完成判準，即為 MVP

---

## Phase 4：使用者故事 2 - 建立與編輯場地（Priority: P2）

**目標**：管理員新增與編輯場地、設定開放時段、是否需要審核與審核者（UI-08 場地表單、API-02 場地、DB-02）

**完成判準**：管理員新增一個容納 8 人、週一至週五 09:00～18:00 開放的場地後，場地出現在場地管理清單；把容納人數改為 12 後清單同步更新；勾選需要審核卻未指派審核者時顯示「請至少指派一位審核者」且不會儲存

### 資料庫端（DB-02）

- [x] T041 [US2] 撰寫 `backend/src/db/migrations/002_venues.sql`（DB-02），欄位、索引與約束依 data-model.dbml 原樣建立：`venues`（名稱唯一、`capacity >= 1`、`equipment` 為 JSON 字串陣列、`needs_review`、`is_active`）、`venue_opening_hours`（`weekday` 0～6、`open_minute`／`close_minute` 為 30 的倍數且 `0 <= open_minute < close_minute <= 1440`）、`venue_reviewers`；外鍵一律 restrict
  - 📎 必讀：`data-model.dbml › Table venues` — venues 的欄位、唯一索引與約束以此為準
  - 📎 必讀：`data-model.dbml › Table venue_opening_hours` — 開放時段的欄位與檢查約束以此為準
  - 📎 必讀：`data-model.dbml › Table venue_reviewers` — 審核者指派的欄位與唯一性以此為準
  - 📎 必讀：`data-model.dbml › Ref fk_opening_hours_venue_id、fk_venue_reviewers_venue_id、fk_venue_reviewers_user_id` — 外鍵方向與刪除行為以此為準
- [x] T042 [US2] 實作 `backend/src/repositories/venueRepository.js`：`insert(conn, venue)`、`update(conn, id, venue)`、`replaceOpeningHours(conn, venueId, hours)`、`replaceReviewers(conn, venueId, userIds)`、`findById(conn, id)`（含開放時段與審核者）、`findByName(conn, name)`、`listAll(conn)`（含停用場地、開放時段與審核者）、`deleteReviewersOfUser(conn, userId)`（依賴 T041）
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 建立／編輯場地` — 建立與編輯場地時取代開放時段與審核者的交易範圍以此為準
  - 📎 必讀：`data-model.dbml › Table venues` — 查詢欄位以此為準

### 後端（API-02 場地）

- [x] T043 [US2] 實作 `backend/src/services/venueService.js`：`listAdminVenues`、`createVenue`、`updateVenue`（皆須管理員）：名稱唯一（重複回 409）、容納人數為正整數、設備為字串陣列、開放時段依星期設定且以 30 分鐘為單位（結束時間允許 `24:00`）、需要審核時至少指派一位具審核者角色且啟用中的帳號（否則回 400）；編輯只影響之後的新預約與新修改，不改既有預約的狀態與時段（依賴 T042）
  - 📎 必讀：`contracts/openapi.yaml › createVenue` — 場地欄位驗證與 201／400／409 的條件以此為準
  - 📎 必讀：`contracts/openapi.yaml › updateVenue` — 編輯場地的限制與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › listAdminVenues` — 管理端場地列表的回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.VenueInput` — 場地輸入欄位以此為準
  - 📎 必讀：`spec.md › FR-007` — 需要審核的場地須指派審核者的要求以此為準
  - 📎 必讀：`spec.md › FR-008` — 編輯結果不改既有預約的要求以此為準
- [x] T044 [US2] 在 `backend/src/services/userService.js` 的 `updateUser` 補上：移除 `reviewer` 角色時，同一交易內呼叫 `venueRepository.deleteReviewersOfUser` 刪除該帳號的審核者指派（依賴 T042）
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 編輯帳號` — 移除審核者角色時同交易刪除指派的規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › updateUser` — 移除審核者角色的行為說明以此為準
- [x] T045 [US2] 在 `backend/src/domain/policy.js` 的 `can` 補上動作 `venue:manage`（僅管理員）
  - 📎 必讀：`research.md › R-05` — 管理員專屬動作的範圍以此為準
- [x] T046 [US2] 實作 `backend/src/routes/adminVenues.js`：`GET /api/admin/venues`、`POST /api/admin/venues`（201）、`PUT /api/admin/venues/{venueId}`，呼叫 `can` 檢查並註冊至 `backend/src/app.js`（依賴 T043、T045）
  - 📎 必讀：`contracts/openapi.yaml › listAdminVenues、createVenue、updateVenue` — 場地管理端點的路徑、方法與狀態碼以此為準

### 前端（UI-08 場地表單）

- [x] T047 [US2] 實作 `frontend/src/pages/adminVenuesPage.js`（`#/admin/venues`，UI-08 場地表單）：`admin-venues-list`／`admin-venues-item`、`venue-add`、場地表單（名稱、地點、容納人數、設備、需要審核、依星期設定的開放時段、審核者多選，審核者候選限於具審核者角色的啟用帳號）、欄位驗證訊息與「請至少指派一位審核者」；維護時段與停用由使用者故事 11 加入
  - 📎 必讀：`contracts/ui-contract.md › UI-08 場地與維護管理介面 › 操作` — 場地新增與編輯的流程以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-08 場地與維護管理介面 › 狀態` — 列表載入、空狀態與錯誤的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-08 場地與維護管理介面 › 文案與無障礙` — 場地管理文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/admin-venues.html › admin-venues-list` — 場地管理頁版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.AdminVenue` — 列表與表單使用的場地欄位以此為準

**Checkpoint**：US1 與 US2 皆可獨立運作

---

## Phase 5：使用者故事 3 - 建立單次預約（Priority: P3）

**目標**：員工選擇場地並填寫日期、起訖時間、主題與人數，系統檢查全部預約規則，通過後占用時段並避免重複預約（UI-03 單次預約、UI-04 列表、API-04 建立與列表、DB-03、DB-04、DB-05）

**完成判準**：員工對不需審核的場地送出一筆符合規則的預約後，我的預約顯示狀態「已確認」；另一位員工預約重疊時段時被拒絕並顯示該時段已被占用；長度 4 小時 30 分鐘或人數超過容納人數的預約不會成立並顯示未通過的規則

### 資料庫端（DB-03、DB-04、DB-05）

- [x] T048 [US3] 撰寫 `backend/src/db/migrations/003_bookings.sql`（DB-03、DB-04、DB-05），欄位、索引與約束依 data-model.dbml 原樣建立：`booking_series`（此表於使用者故事 9 才寫入資料，因 `bookings` 外鍵需要而在此建立）、`bookings`（狀態只能是七個值、`end_at > start_at`、`attendees >= 1`）、`booking_slots`（`PRIMARY KEY (venue_id, slot_start_at)`、`holder_type` 只能是 `booking`、`hold`、`maintenance`）、`booking_events`，並建立 `booking_events` 的 `BEFORE UPDATE` 與 `BEFORE DELETE` 觸發器（`SIGNAL SQLSTATE '45000'`，訊息「紀錄不可修改」）；外鍵一律 restrict
  - 📎 必讀：`data-model.dbml › Table booking_series` — 批次表的欄位與狀態約束以此為準
  - 📎 必讀：`data-model.dbml › Table bookings` — 預約表的欄位、索引與狀態約束以此為準
  - 📎 必讀：`data-model.dbml › Table booking_slots` — 時段占用表的主鍵與 holder_type 約束以此為準
  - 📎 必讀：`data-model.dbml › Table booking_events` — 操作紀錄表的欄位與 actor_type 約束以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 時段占用如何由資料庫保證不重疊` — 以主鍵保證不重疊的設計以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 不可更動資料表（資料庫層強制）` — 觸發器的 DDL 與訊息以此為準
  - 📎 必讀：`data-model.dbml › Ref fk_bookings_user_id、fk_bookings_venue_id、fk_bookings_series_id、fk_booking_slots_venue_id、fk_booking_events_booking_id、fk_booking_events_actor_user_id` — 外鍵方向與刪除行為以此為準
- [x] T049 [US3] 實作 `backend/src/repositories/bookingRepository.js`：`insert(conn, booking)`、`findById(conn, id)`、`lockById(conn, id)`、`countHeld(conn, userId, now)`（`COUNT(DISTINCT IF(series_id IS NULL, CONCAT('b', id), CONCAT('s', series_id)))`，條件為 `status IN ('pending','confirmed')` 且 `start_at > :now`）、`listMine(conn, { userId, tab, now, limit, cursor })`（`upcoming`：待審核、已確認、已報到且結束時間未到；`past`：其餘）（依賴 T048）
  - 📎 必讀：`data-model.dbml › Table bookings` — 查詢欄位與索引 (user_id, status, start_at) 以此為準
  - 📎 必讀：`research.md › R-08` — 持有筆數的計算方式以此為準
  - 📎 必讀：`contracts/openapi.yaml › listMyBookings` — 我的預約分頁參數 tab 的判定以此為準
- [x] T050 [US3] 實作 `backend/src/repositories/slotRepository.js`：`insertRange(conn, venueId, slotStarts, holderType, holderId)`（單一多列 `INSERT`，依 `slot_start_at` 由小到大；遇 `ER_DUP_ENTRY` 拋出「時段被占用」錯誤）、`deleteByHolder(conn, holderType, holderId)`、`deleteByHolderFrom(conn, holderType, holderId, fromSlot)`、`listOccupied(conn, venueId, fromAt, toAt)`（依賴 T048）
  - 📎 必讀：`data-model.dbml › Table booking_slots` — 時段列的欄位與主鍵以此為準
  - 📎 必讀：`research.md › R-07` — 時段列的寫入順序與重複鍵處理以此為準
- [x] T051 [US3] 實作 `backend/src/repositories/eventRepository.js`：`insert(conn, { bookingId, actorUserId, actorType, occurredAt, fromStatus, toStatus, reason })`（`fromStatus` 可為 `NULL`）、`listByBooking(conn, bookingId)`（由舊到新）（依賴 T048）
  - 📎 必讀：`data-model.dbml › Table booking_events` — 紀錄欄位與 from_status 可為空的規則以此為準
- [x] T052 [US3] 在 `backend/src/repositories/venueRepository.js` 新增 `listActive(conn)`（啟用場地含開放時段與審核者）與 `findForBooking(conn, id)`（含開放時段、容納人數、是否需要審核與啟用狀態）（依賴 T048）
  - 📎 必讀：`data-model.dbml › Table venues` — 啟用狀態與容納人數欄位以此為準

### 後端（API-04 建立與列表）

- [x] T053 [P] [US3] 實作 `backend/src/domain/bookingRules.js` 的純函式 `validateBooking({ venue, date, startTime, endTime, attendees, subject }, rules, now)`：起訖為 30 分鐘單位且同一天（結束允許 `24:00`、開始最晚 `23:30`）、長度 30 分鐘到 `max_duration_minutes`、開始時間不早於現在、日期不晚於今天起算 `max_advance_days` 天（台北日期）、完全落在同一段開放時段內、人數介於 1 與容納人數、主題非空白且至多 100 字；回傳違反的規則清單（`violations`）
  - 📎 必讀：`research.md › R-06` — 台北日期與開放時段的判定方式以此為準
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — 請求驗證失敗回 400 與 violations 的規則以此為準
  - 📎 必讀：`spec.md › FR-011` — 時間單位與長度上限的要求以此為準
  - 📎 必讀：`spec.md › FR-012` — 不得預約過去與最遠天數的要求以此為準
  - 📎 必讀：`spec.md › FR-013` — 開放時段與人數上限的要求以此為準
- [x] T054 [P] [US3] 實作 `backend/src/domain/bookingStateMachine.js`：以一張表列出允許的轉換——`pending` 可到 `confirmed`、`rejected`、`cancelled`；`confirmed` 可到 `checked_in`、`cancelled`、`no_show`、`pending`；`checked_in` 可到 `completed`；其餘狀態不可再變更；匯出 `canTransition(from, to)` 與有效預約判定 `isActive(status)`（`pending`、`confirmed`、`checked_in`）
  - 📎 必讀：`spec.md › FR-081` — 允許的狀態轉換以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.BookingStatus` — 預約狀態代碼的集合以此為準，須與資料庫及畫面逐字相同
  - 📎 必讀：`spec.md › FR-082` — 有效預約的定義以此為準
  - 📎 必讀：`research.md › R-09` — 狀態機以單一表呈現的決定以此為準
- [x] T055 [US3] 實作 `backend/src/services/slotService.js`：`slotStartsFor(startAt, endAt)`（把區間攤成 30 分鐘的 UTC 起點）、`occupy(conn, venueId, startAt, endAt, holderType, holderId)`、`release(conn, { venueId, holderType, holderId, from })`（刪除時段列後依序呼叫已註冊的釋出監聽器 `onReleased(conn, venueId, range, now)`）、`registerReleaseListener(fn)`，供使用者故事 10 註冊候補遞補（依賴 T050）
  - 📎 必讀：`research.md › R-07` — 占用、釋出與以主鍵保證不重疊的流程以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 取消預約（single）` — 釋出時段與掛勾在同一交易內的範圍以此為準
- [x] T056 [US3] 實作 `backend/src/services/bookingTransition.js` 的 `transition(conn, { bookingId, to, actor, reason, now, lateCancel, releaseFrom })`：先以 `canTransition` 檢查，再以 `UPDATE bookings SET status = :to … WHERE id = :id AND status = :from` 條件更新，影響 0 列回 409「此申請已被處理」；成功後寫入一筆 `booking_events`（`actor_type` 為 `user`、`reviewer`、`admin` 或 `system`，系統處理時 `actor_user_id` 為 `NULL`），轉為 `rejected`／`cancelled`／`no_show` 時呼叫 `slotService.release`，轉為 `rejected` 時 `reason` 不得為空白（依賴 T049、T051、T054、T055）
  - 📎 必讀：`research.md › R-09` — 單一狀態轉換入口、條件更新與寫紀錄的決定以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.BookingEvent` — 操作紀錄的欄位以此為準
  - 📎 必讀：`spec.md › FR-083` — 每次狀態變更都要留下操作者、時間與原因的要求以此為準
- [x] T057 [US3] 實作 `backend/src/services/bookingService.js` 的 `createBooking(user, input)`：`withTransaction` 內依序載入規則快照 → `validateBooking`（違反回 400 與 `violations`）→ 鎖 `users` 列 → 暫停檢查（`suspended_until_at` 晚於現在回 409 並含解除時間）→ `countHeld` 不得達 `max_active_bookings`（否則 409）→ 插入 `bookings`（場地不需審核為 `confirmed` 並設 `confirmed_at`，需要審核為 `pending`）→ `occupy`（時段重複回 409「該時段已被占用」並整筆回滾）→ 寫入 `booking_events`（`from_status` 為 `NULL`）；場地停用回 409；只能替自己預約（依賴 T052、T053、T055、T056）
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — 請求、回應與 400／403／404／409 的觸發條件以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 建立單次預約` — 鎖定順序與時段重複時整筆回滾的範圍以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.BookingInput` — 預約輸入欄位以此為準
  - 📎 必讀：`spec.md › FR-015` — 持有筆數上限的要求以此為準
  - 📎 必讀：`spec.md › FR-043` — 暫停期間不得預約並顯示解除時間的要求以此為準
- [x] T058 [US3] 實作 `backend/src/services/contextService.js` 的 `getContext(user, now)`：回傳 `now`、台北 `today`、`maxBookableDate`、規則值（儲存單位）與目前使用者的暫停解除時間；並在同檔實作 `listMyBookings(user, query)`（`tab`、`limit`、`cursor`，回傳 `MyBookingList`，每筆含場地名稱、時段、狀態、是否逾時取消、駁回或取消原因與操作者）（依賴 T049）
  - 📎 必讀：`contracts/openapi.yaml › getContext` — 目前日期與規則值回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › listMyBookings` — 我的預約列表的參數與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.MyBooking` — 我的預約每筆的欄位以此為準
- [x] T059 [US3] 在 `backend/src/services/venueService.js` 新增 `searchVenues(user)`：回傳啟用場地清單（`VenueList`，含容納人數、設備、開放時段、是否需要審核）；使用者故事 3 不套用任何篩選，篩選於使用者故事 4 補上（依賴 T052）
  - 📎 必讀：`contracts/openapi.yaml › searchVenues` — 場地列表回應的欄位以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.VenueList` — 場地列表的欄位以此為準
- [x] T060 [US3] 在 `backend/src/domain/policy.js` 的 `can` 補上動作 `booking:create`（任何已登入帳號，且只能替自己預約）與 `booking:list-own`
  - 📎 必讀：`research.md › R-05` — 員工只能操作自己預約的規則以此為準
- [x] T061 [US3] 實作 `backend/src/routes/bookings.js`：`POST /api/bookings`（201）、`GET /api/bookings/mine`；`backend/src/routes/context.js`：`GET /api/context`；`backend/src/routes/venues.js`：`GET /api/venues`；皆呼叫 `can` 並註冊至 `backend/src/app.js`（依賴 T057～T060）
  - 📎 必讀：`contracts/openapi.yaml › createBooking、listMyBookings` — 預約端點的路徑、方法與狀態碼以此為準
  - 📎 必讀：`contracts/openapi.yaml › getContext、searchVenues` — 目前情境與場地列表端點以此為準

### 前端（UI-03 單次預約、UI-04 列表）

- [x] T062 [P] [US3] 實作 `frontend/src/components/bookingCard.js`：`my-bookings-item` 卡片（場地、日期、`HH:mm–HH:mm`、主題、人數、狀態中文名稱、逾時取消標示、駁回或取消原因），操作按鈕插槽供使用者故事 6、8、9 使用
  - 📎 必讀：`contracts/ui-contract.md › UI-04 我的預約介面 › 文案與無障礙` — 預約卡片文案、狀態名稱與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/bookings.html › my-bookings-item` — 預約卡片版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.MyBooking` — 卡片顯示的欄位以此為準
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 預約狀態代碼` — 畫面依狀態代碼判斷行為、狀態標籤帶代碼的規則以此為準
- [x] T063 [US3] 實作 `frontend/src/pages/bookingFormPage.js`（`#/bookings/new`，單次預約）：`booking-form`、場地選擇、`booking-date`、起訖時間下拉（30 分鐘間隔、結束可選 `24:00`）、`booking-subject`、`booking-attendees`；送出時立即 `disabled`；顯示未通過的規則清單（`violations`）、欄位錯誤、「該時段已被占用」與暫停提示；成功後顯示 `booking-result` 與 `booking-go-my-bookings`；表單旁提示「時間以台北時間（UTC+8）顯示」；週期性預約區塊由使用者故事 9 加入（依賴 T062）
  - 📎 必讀：`contracts/ui-contract.md › UI-03 預約表單介面 › 操作` — 單次預約的操作流程以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-03 預約表單介面 › 狀態` — 送出中、成功與各種錯誤的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-03 預約表單介面 › 文案與無障礙` — 預約表單文案、testid 與無障礙屬性以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/booking-form.html › booking-form` — 預約表單版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — 請求欄位與錯誤回應以此為準
- [x] T064 [US3] 實作 `frontend/src/pages/myBookingsPage.js`（`#/bookings`，UI-04 列表）：`my-bookings-tab-upcoming`／`my-bookings-tab-past`、`my-bookings-list` 以 `my-bookings-load-more` 分頁載入 `GET /api/bookings/mine`、載入骨架、空狀態與 `my-bookings-go-venues`、錯誤與重試；取消、修改、報到與週期性場次操作由使用者故事 6、8、9 加入（依賴 T062）
  - 📎 必讀：`contracts/ui-contract.md › UI-04 我的預約介面 › 操作` — 瀏覽我的預約與切換分頁的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-04 我的預約介面 › 狀態` — 載入、空狀態與錯誤的呈現以此為準
  - 📎 必讀：`contracts/prototype/bookings.html › my-bookings-list` — 我的預約頁版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.MyBookingList` — 列表分頁欄位以此為準

**Checkpoint**：US1～US3 皆可獨立運作

---

## Phase 6：使用者故事 4 - 查詢場地與檢視行事曆（Priority: P4）

**目標**：員工依日期、時段、人數與設備篩選場地，並以日、週行事曆檢視各時段狀態（UI-02、API-03、DB-02 與 DB-04 讀取）

**完成判準**：篩選「6 人、投影機」時只列出符合的場地；已有預約的時段在行事曆顯示為「已預約」、維護時段顯示為「維護中」、其餘開放時段顯示為「可預約」，且一般員工看不到他人預約的預約者與主題

### 資料庫端（DB-02、DB-04 讀取）

- [x] T [US4] 在 `backend/src/repositories/venueRepository.js` 新增 `search(conn, { date, startTime, endTime, capacity, equipment })`：只回傳啟用場地，容納人數不小於篩選人數，設備以 `JSON_CONTAINS` 要求具備所有指定設備，指定日期與時段時要求完整落在開放時段內且該區間的 `booking_slots` 沒有任何占用列
  - 📎 必讀：`data-model.dbml › Table venues` — equipment 為 JSON 字串陣列與啟用狀態欄位以此為準
  - 📎 必讀：`data-model.dbml › Table booking_slots` — 判斷時段是否被占用所用的欄位以此為準
  - 📎 必讀：`research.md › R-07` — 占用判斷以時段列為準的決定以此為準
- [x] T [P] [US4] 在 `backend/src/repositories/slotRepository.js` 新增 `listForCalendar(conn, venueId, fromAt, toAt)`：回傳區間內每一列的 `slot_start_at` 與 `holder_type`，供行事曆區分已預約（`booking`、`hold`）與維護中（`maintenance`）
  - 📎 必讀：`data-model.dbml › Table booking_slots` — holder_type 三值與查詢欄位以此為準

### 後端（API-03）

- [x] T [US4] 在 `backend/src/services/venueService.js` 擴充 `searchVenues` 套用篩選（只給日期時列出當日至少有一個可預約時段的場地；只給時間未給日期回 400；開始晚於或等於結束回 400），並實作 `getVenueCalendar(user, venueId, { date, view })`：`view` 為 `day` 或 `week`（週一至週日），每個 30 分鐘時段狀態為 `available`、`booked`、`maintenance` 或 `closed`；開放時段以外、已過去與超過最遠可預約日的時段一律 `closed`；回應帶 `today`；非管理員的回應不得含預約者與主題（依賴 T065、T066）
  - 📎 必讀：`contracts/openapi.yaml › searchVenues` — 篩選參數、驗證與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › getVenueCalendar` — 日與週檢視的參數與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Calendar` — 行事曆回應的欄位與時段狀態以此為準
  - 📎 必讀：`spec.md › NFR-002` — 一般員工看不到他人預約者與主題的要求以此為準
  - 📎 必讀：`spec.md › FR-020` — 行事曆時段狀態的要求以此為準
- [x] T [US4] 在 `backend/src/routes/venues.js` 擴充 `GET /api/venues` 的查詢參數驗證（超出範圍回 400），並新增 `GET /api/venues/{venueId}/calendar`（場地不存在回 404）（依賴 T067）
  - 📎 必讀：`contracts/openapi.yaml › searchVenues、getVenueCalendar` — 查詢參數、狀態碼與錯誤回應以此為準

### 前端（UI-02）

- [x] T [P] [US4] 實作 `frontend/src/components/calendar.js`：以 CSS Grid 繪製日／週行事曆 `venue-calendar`（30 分鐘一列；以文字加顏色呈現已預約、維護中、可預約、不開放），切換 `calendar-view-day`／`calendar-view-week`、`calendar-prev`／`calendar-next`／`calendar-today`、`calendar-date`；寬度低於 768 像素時週檢視改為依日期由上而下堆疊的七個區塊，不得水平捲動；可預約時段提供 `calendar-slot-book`，已預約時段提供 `calendar-slot-waitlist`（由使用者故事 10 啟用）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 場地搜尋與行事曆介面 › 操作` — 行事曆切換與時段操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 場地搜尋與行事曆介面 › 狀態` — 行事曆載入、空狀態與錯誤的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 場地搜尋與行事曆介面 › 文案與無障礙` — 時段狀態文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/venues.html › venue-calendar` — 行事曆版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.CalendarSlot` — 每個時段的欄位以此為準
- [x] T [US4] 實作 `frontend/src/pages/venuesPage.js`（`#/venues`、`#/venues/:venueId`）：篩選列（`venue-filter-date`、起訖時間、`venue-filter-capacity`、`venue-filter-equipment`）、場地列表、無結果時顯示「沒有符合條件的場地」並保留篩選條件、條件不合法時不查詢並提示；點選場地進入行事曆，點選 `calendar-slot-book` 帶入場地、日期與時間前往 `#/bookings/new`（依賴 T069）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 場地搜尋與行事曆介面 › 操作` — 篩選與進入行事曆的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 場地搜尋與行事曆介面 › 狀態` — 載入、無結果與錯誤的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 場地搜尋與行事曆介面 › 文案與無障礙` — 篩選欄位文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/venues.html › venue-filter-capacity` — 篩選列版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.VenueList` — 列表顯示的場地欄位以此為準

**Checkpoint**：US1～US4 皆可獨立運作

---

## Phase 7：使用者故事 5 - 接收站內通知與開始前提醒（Priority: P5）

**目標**：使用者在站內通知查看與自己有關的預約變化，預約者在開始前收到提醒（UI-06、API-08、API-11 提醒、DB-07）

**完成判準**：員工建立一筆預約後，站內通知出現「預約成立」且導覽列顯示未讀數；開啟該則後它變為已讀、未讀數減少；已確認的預約在開始前 30 分鐘收到提醒，在開始前 20 分鐘才建立的預約不會收到提醒

### 資料庫端（DB-07）

- [x] T [US5] 撰寫 `backend/src/db/migrations/004_notifications.sql`（DB-07），欄位、索引與約束依 data-model.dbml 原樣建立 `notifications`（`type` 只能是九個通知類型、索引 `(user_id, created_at, id)` 與 `(user_id, read_at)`）；`waitlist_entry_id` 欄位先建立、其外鍵於使用者故事 10 的遷移補上；其餘外鍵 restrict
  - 📎 必讀：`data-model.dbml › Table notifications` — 通知表的欄位、索引與類型約束以此為準
  - 📎 必讀：`data-model.dbml › Ref fk_notifications_user_id、fk_notifications_booking_id` — 此時可建立的外鍵方向與刪除行為以此為準
- [x] T [US5] 實作 `backend/src/repositories/notificationRepository.js`：`insert(conn, notification)`、`listByUser(conn, { userId, limit, beforeId })`（`(created_at, id)` 由新到舊）、`unreadCount(conn, userId)`、`markRead(conn, { userId, id, now })`（`WHERE user_id = :userId AND read_at IS NULL` 的單一條件更新）（依賴 T071）
  - 📎 必讀：`data-model.dbml › Table notifications` — 查詢與條件更新使用的欄位及索引以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 標記通知已讀` — 標記已讀的條件更新範圍以此為準

### 後端（API-08、API-11 提醒）

- [x] T [US5] 實作 `backend/src/services/notificationService.js` 的 `notify(conn, { userId, type, bookingId, waitlistEntryId, params, now })`，在呼叫者的交易內寫入通知，訊息以 `shared/src/copy.js` 的樣板組成（時間以台北時間格式化）；同時在 `shared/src/copy.js` 補上九個通知類型的樣板（預約成立、審核結果含駁回原因、候補遞補、預約被取消含原因、待審核、時間或場地修改、預約權限暫停含解除時間、候補失效、開始前提醒）；並實作 `listNotifications`、`getUnreadCount`、`markNotificationRead`（只能操作自己的通知，他人的通知視同不存在回 404）（依賴 T072）
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Notification` — 通知的欄位與類型以此為準
  - 📎 必讀：`contracts/openapi.yaml › listNotifications` — 列表排序、分頁與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › markNotificationRead` — 標記已讀的規則與 404 的條件以此為準
  - 📎 必讀：`spec.md › FR-022` — 必須發送通知的事件以此為準
  - 📎 必讀：`spec.md › FR-023` — 另外必須發送的通知事件以此為準
  - 📎 必讀：`spec.md › NFR-013` — 使用者只能看到發給自己的通知的要求以此為準
- [x] T [US5] 在 `backend/src/services/bookingService.js` 的 `createBooking` 於同一交易內呼叫 `notify`：預約成立（場地不需審核，狀態 `confirmed`）時發送 `booking_created`，內容含場地、日期與起訖時間（依賴 T073）
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 建立單次預約` — 建立預約的交易內同時寫入 notifications 的範圍以此為準
  - 📎 必讀：`spec.md › FR-022` — 預約成立必須發送通知的要求以此為準
- [x] T [US5] 實作 `backend/src/jobs/reminders.js` 的 `sendReminders` 並以 `registerJob` 註冊：以 `processDue` 取 `status = 'confirmed'`、`reminder_sent_at IS NULL`、現在已進入「開始時間減 `reminder_minutes`」且未到開始時間、`confirmed_at` 不晚於「開始時間減 `reminder_minutes`」的預約，發送 `reminder` 通知並寫入 `reminder_sent_at`；待審核的預約不提醒（依賴 T073）
  - 📎 必讀：`contracts/openapi.yaml › x-background-jobs` — sendReminders 的觸發條件以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 排程：完成` — 提醒工作每筆一個交易、狀態導向重做不重複的範圍以此為準
  - 📎 必讀：`spec.md › FR-024` — 提醒時間與不補發的條件以此為準
- [x] T [US5] 實作 `backend/src/routes/notifications.js`：`GET /api/notifications`、`GET /api/notifications/unread-count`、`POST /api/notifications/{notificationId}/read`，皆須登入並註冊至 `backend/src/app.js`；並在 `backend/src/server.js` 啟動時載入 `reminders.js`（依賴 T073、T075）
  - 📎 必讀：`contracts/openapi.yaml › listNotifications、getUnreadCount、markNotificationRead` — 通知端點的路徑、方法與狀態碼以此為準

### 前端（UI-06）

- [x] T [P] [US5] 實作 `frontend/src/lib/poller.js` 的 `startUnreadPolling(onCount)`：每 30 秒呼叫 `GET /api/notifications/unread-count`，`document.hidden` 時暫停、回到前景時立即查詢一次，並在 `frontend/src/components/nav.js` 把結果顯示在 `app-notification-badge`
  - 📎 必讀：`research.md › R-13` — 每 30 秒輪詢並於頁面隱藏時暫停的決定以此為準
  - 📎 必讀：`contracts/openapi.yaml › getUnreadCount` — 未讀數回應以此為準
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 導覽列` — 徽章在未讀數為 0 時不顯示的規則以此為準
- [x] T [US5] 實作 `frontend/src/pages/notificationsPage.js`（`#/notifications`）：`notification-summary`（未讀數）、`notification-list`／`notification-item` 由新到舊並以 `notification-load-more` 分頁、點開 `notification-open` 後標為已讀並更新徽章、關聯預約或候補的連結、空狀態「目前沒有通知」、載入與錯誤
  - 📎 必讀：`contracts/ui-contract.md › UI-06 站內通知介面 › 操作` — 瀏覽與開啟通知的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-06 站內通知介面 › 狀態` — 載入、空狀態與錯誤的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-06 站內通知介面 › 文案與無障礙` — 通知文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/notifications.html › notification-list` — 通知頁版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.NotificationList` — 列表分頁欄位以此為準

**Checkpoint**：US1～US5 皆可獨立運作

---

## Phase 8：使用者故事 6 - 取消與修改預約（Priority: P6）

**目標**：預約者在開始前取消自己的預約，或修改場地、日期、時間、主題與人數（UI-04 取消與修改、UI-03 編輯模式、API-04 取消與修改、DB-03）

**完成判準**：員工取消 2 小時後開始的預約，狀態變為「已取消」且時段恢復可預約；取消 30 分鐘後開始的預約，標示「逾時取消」；把預約改到空閒的新時段後，原時段恢復可預約；改到已被占用的時段時修改失敗，預約維持原場地與原時段

### 資料庫端（DB-03）

- [x] T [US6] 在 `backend/src/repositories/bookingRepository.js` 新增 `updateContent(conn, id, { subject, attendees })`、`updateSchedule(conn, id, { venueId, startAt, endAt })`、`setLateCancel(conn, id, value)`
  - 📎 必讀：`data-model.dbml › Table bookings` — 可更新欄位與 late_cancel 欄位以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 修改預約（只改主題或人數）` — 只更新 subject、attendees 的單一語句範圍以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 修改預約（改時間或場地）` — 改時間或場地時更新 bookings 的範圍以此為準

### 後端（API-04 取消與修改）

- [x] T [P] [US6] 實作 `backend/src/services/bookingView.js` 的 `toMyBooking(row, rules, now)`：組出 `MyBooking`，含 `canCancel`（狀態為待審核或已確認且尚未開始）、`canEdit`（同上且批次不在待審核；不可修改時帶 `editBlockedReason`：`series_pending`、`started` 或 `status`）、`lateCancel`、`statusReason`、`statusActor`；並改由 `contextService.listMyBookings` 使用
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.MyBooking` — canCancel、canEdit 與 editBlockedReason 的欄位以此為準
  - 📎 必讀：`spec.md › FR-026` — 開始前可取消的條件以此為準
  - 📎 必讀：`spec.md › FR-028` — 可修改的預約狀態與時間條件以此為準
- [x] T [US6] 在 `backend/src/services/bookingService.js` 新增 `cancelBooking(user, bookingId)`：只有預約者本人（他人回 403）、狀態為待審核或已確認、尚未開始（否則 409）；距開始不超過 `late_cancel_minutes`（含剛好等於）時 `lateCancel` 為真；呼叫 `transition` 轉為 `cancelled`（`actor_type` 為 `user`）並釋出全部時段；回傳 `CancelResult`；批次場次的「該場次之後」範圍由使用者故事 9 加入（依賴 T080）
  - 📎 必讀：`contracts/openapi.yaml › cancelBooking` — 取消的條件、回應與 403／404／409 以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.CancelResult` — 取消結果的欄位以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 取消預約（single）` — 取消時條件更新、刪除時段列與寫紀錄的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-027` — 逾時取消的判定條件以此為準
- [x] T [US6] 在 `backend/src/services/bookingService.js` 新增 `getBooking(user, bookingId)` 與 `updateBooking(user, bookingId, input)`：只有預約者本人（管理員也不得修改）、狀態為待審核或已確認、尚未開始；只改主題或人數時只更新 `bookings`（人數仍須不超過容納人數），不動時段與狀態；改場地、日期或時間時重新檢查 `validateBooking`（不把自己的時段算成衝突），在同一交易內刪除自己的時段列後插入新時段列，新時段重複回 409 並整筆回滾、預約維持原狀；修改成功後 `confirmed_at` 更新並清空 `reminder_sent_at`；不記為取消或逾時取消，不改變持有筆數（依賴 T081）
  - 📎 必讀：`contracts/openapi.yaml › updateBooking` — 修改的請求、回應與 400／403／404／409 以此為準
  - 📎 必讀：`contracts/openapi.yaml › getBooking` — 編輯模式預填資料的回應以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 修改預約（只改主題或人數）` — 只改主題或人數的範圍以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 修改預約（改時間或場地）` — 改時間或場地時刪除舊列、插入新列與失敗回滾的範圍以此為準
  - 📎 必讀：`spec.md › FR-029` — 重新檢查規則且不把自己的時段算成衝突的要求以此為準
  - 📎 必讀：`spec.md › FR-030` — 新舊時段同時生效且不改變持有筆數的要求以此為準
- [x] T [US6] 在 `backend/src/domain/policy.js` 的 `can` 補上動作 `booking:cancel`、`booking:update`、`booking:view`（僅預約者本人；管理員不得代為修改）
  - 📎 必讀：`research.md › R-05` — 員工只能修改或取消自己預約的規則以此為準
  - 📎 必讀：`spec.md › FR-072` — 管理員不得代為預約或修改預約的限制以此為準
- [x] T [US6] 在 `backend/src/routes/bookings.js` 新增 `GET /api/bookings/{bookingId}`、`PUT /api/bookings/{bookingId}`、`POST /api/bookings/{bookingId}/cancel`，呼叫 `can` 檢查（依賴 T082、T083）
  - 📎 必讀：`contracts/openapi.yaml › getBooking、updateBooking、cancelBooking` — 三個端點的路徑、方法與狀態碼以此為準

### 前端（UI-04 取消與修改、UI-03 編輯模式）

- [x] T [P] [US6] 在 `frontend/src/components/bookingCard.js` 啟用 `booking-cancel-button`（依 `canCancel` 顯示）與 `booking-edit-button`（依 `canEdit` 顯示，不可修改時顯示 `editBlockedReason` 對應的說明）；取消前以對話框確認，確認 `booking-cancel-dialog-confirm`、返回 `booking-cancel-dialog-cancel`；取消後標示逾時取消並更新列表
  - 📎 必讀：`contracts/ui-contract.md › UI-04 我的預約介面 › 操作` — 取消與修改入口的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-04 我的預約介面 › 文案與無障礙` — 取消對話框與按鈕文案、testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/bookings.html › booking-cancel-button` — 取消按鈕與對話框版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.CancelResult` — 取消後更新畫面所用的欄位以此為準
- [x] T [US6] 在 `frontend/src/pages/bookingFormPage.js` 加入編輯模式（`#/bookings/:bookingId/edit`）：以 `GET /api/bookings/{bookingId}` 預填欄位、送出 `PUT /api/bookings/{bookingId}`；修改失敗時顯示原因並保留原內容
  - 📎 必讀：`contracts/ui-contract.md › UI-03 預約表單介面 › 操作` — 編輯模式的操作流程以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-03 預約表單介面 › 狀態` — 編輯失敗與不可修改的呈現以此為準
  - 📎 必讀：`contracts/openapi.yaml › updateBooking` — 修改請求與錯誤回應以此為準

**Checkpoint**：US1～US6 皆可獨立運作

---

## Phase 9：使用者故事 7 - 審核需審核場地的預約（Priority: P7）

**目標**：需審核場地的申請先占用時段，審核者核准或駁回自己負責的場地，逾期未審核由系統自動取消（UI-07 單筆審核、API-05 單筆審核、API-11 逾期取消、DB-03）

**完成判準**：員工對需審核的場地送出預約後狀態為「待審核」且時段被占用；審核者核准後員工端變為「已確認」；駁回時未填原因無法送出，填原因後狀態為「已駁回」且員工收到含原因的通知；審核者看不到自己送出的申請

### 資料庫端（DB-03 審核查詢）

- [x] T [US7] 在 `backend/src/repositories/bookingRepository.js` 新增 `listPendingForVenues(conn, venueIds)`（狀態 `pending`，依開始時間由近到遠，含預約者姓名）與 `listPendingAll(conn)`
  - 📎 必讀：`data-model.dbml › Table bookings` — 待審核查詢使用的欄位及索引以此為準
- [x] T [P] [US7] 在 `backend/src/repositories/venueRepository.js` 新增 `venueIdsOfReviewer(conn, userId)` 與 `reviewerIdsOf(conn, venueId)`（只含啟用且具審核者角色的帳號）
  - 📎 必讀：`data-model.dbml › Table venue_reviewers` — 審核者指派的欄位以此為準

### 後端（API-05 單筆審核、API-11 逾期取消）

- [x] T [P] [US7] 在 `backend/src/domain/policy.js` 的 `can` 補上動作 `review:list`、`review:decide`：審核者只能處理被指派的場地；申請者就是審核者本人時拒絕；審核者自己的申請由同場地其他審核者審核，該場地沒有其他審核者時才由不是申請者本人的管理員審核；管理員在其他情況不審核
  - 📎 必讀：`spec.md › FR-035` — 只有指派的審核者可審核、不得自審與管理員後備的規則以此為準
  - 📎 必讀：`research.md › R-05` — 審核授權的判斷方式以此為準
- [x] T [US7] 實作 `backend/src/services/reviewService.js`：`listReviews(user)`（審核者看到自己負責場地、排除自己送出的申請；管理員看到依規則交由管理員審核的申請）、`approveBooking`（條件更新 `pending` → `confirmed`、設定 `confirmed_at`、清空 `reminder_sent_at`、通知預約者 `review_result`）、`rejectBooking(reason)`（原因不得為空白，否則回 400；轉為 `rejected`、釋出時段、通知預約者並附原因）；已被處理的申請回 409「此申請已被處理」（依賴 T087～T089）
  - 📎 必讀：`contracts/openapi.yaml › listReviews` — 待審核清單的範圍與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › approveBooking` — 核准的條件與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › rejectBooking` — 駁回的原因驗證與回應以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 單筆審核（核准／駁回）` — 條件更新、釋出時段與紀錄的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-034` — 核准與駁回的結果及駁回必須填寫原因的要求以此為準
- [x] T [US7] 在 `backend/src/services/bookingService.js` 的 `createBooking` 於同一交易內補上：場地需要審核（狀態 `pending`）時，對該場地的審核者（排除申請者本人；沒有其他審核者時對管理員）各發送一則 `review_pending` 通知（依賴 T090）
  - 📎 必讀：`spec.md › FR-023` — 有新申請待審核時通知審核者的要求以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 建立單次預約` — 建立預約交易內寫入通知的範圍以此為準
- [x] T [US7] 在 `backend/src/services/bookingService.js` 的 `updateBooking` 補上：改場地、日期或時間成功後，修改後的場地需要審核時以 `transition` 轉為 `pending` 並發送 `review_pending`，不需審核時維持 `confirmed`；重新審核被駁回時原時段不恢復（依賴 T091）
  - 📎 必讀：`spec.md › FR-037` — 修改後依場地是否需審核決定狀態的要求以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 修改預約（改時間或場地）` — 改時間或場地時狀態轉換與紀錄的範圍以此為準
- [x] T [US7] 實作 `backend/src/jobs/reviewExpiry.js` 的 `expirePendingReviews` 並以 `registerJob` 註冊：以 `processDue` 取 `status = 'pending'` 且 `start_at` 已到的單次預約，轉為 `cancelled`（`actor_type` 為 `system`，原因「未於開始前完成審核」）、釋出時段並通知預約者 `booking_cancelled`；週期性批次的整批取消由使用者故事 9 加入（依賴 T090）
  - 📎 必讀：`contracts/openapi.yaml › x-background-jobs` — expirePendingReviews 的觸發條件與結果以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 排程：逾期未審核` — 逾期取消每筆一個交易的範圍以此為準
  - 📎 必讀：`spec.md › FR-036` — 未審核逾期自動取消與紀錄的要求以此為準
- [x] T [US7] 實作 `backend/src/routes/reviews.js`：`GET /api/reviews`、`POST /api/reviews/bookings/{bookingId}/approve`、`POST /api/reviews/bookings/{bookingId}/reject`，呼叫 `can` 檢查並註冊至 `backend/src/app.js`、在 `backend/src/server.js` 載入 `reviewExpiry.js`（依賴 T090、T093）
  - 📎 必讀：`contracts/openapi.yaml › listReviews、approveBooking、rejectBooking` — 審核端點的路徑、方法與狀態碼以此為準

### 前端（UI-07 單筆審核）

- [x] T [US7] 實作 `frontend/src/pages/reviewsPage.js`（`#/reviews`）：`review-list`／`review-item`（預約者、場地、時段、主題、人數）、`review-approve-button`、`review-reject-button` 開啟駁回對話框（`review-reject-reason` 必填，空白時不可送出；`review-reject-dialog-confirm`、`review-reject-dialog-cancel`）；清單為空顯示「目前沒有待審核的申請」；已被處理時顯示「此申請已被處理」並更新清單；整批週期性申請的呈現由使用者故事 9 加入
  - 📎 必讀：`contracts/ui-contract.md › UI-07 待審核介面 › 操作` — 核准與駁回的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-07 待審核介面 › 狀態` — 載入、空狀態與已被處理的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-07 待審核介面 › 文案與無障礙` — 審核文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/reviews.html › review-list` — 待審核頁版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.ReviewList` — 待審核清單的欄位以此為準

**Checkpoint**：US1～US7 皆可獨立運作

---

## Phase 10：使用者故事 8 - 報到與未到場（Priority: P8）

**目標**：預約者在報到時間窗內報到；逾時未報到的預約被判定未到場並釋出剩餘時段，累計達門檻暫停預約權限（UI-04 報到、API-04 報到、API-11 未到場與完成、DB-01 暫停欄位）

**完成判準**：已確認的預約在開始前 10 分鐘內報到後狀態變為「已報到」；開始前 11 分鐘報到被拒絕並顯示可報到的時間；開始後 15 分鐘仍未報到時變為「未到場」且剩餘時段可被預約；30 天內第 3 次未到場後無法建立新預約並顯示解除時間，但既有預約仍可報到

### 資料庫端（DB-01 暫停欄位、DB-05 統計）

- [x] T [P] [US8] 在 `backend/src/repositories/userRepository.js` 新增 `setSuspension(conn, id, { suspendedUntil, noShowCountedFrom })`
  - 📎 必讀：`data-model.dbml › Table users` — suspended_until_at 與 no_show_counted_from_at 欄位以此為準
  - 📎 必讀：`research.md › R-08` — 暫停與重新累計起點的設定方式以此為準
- [x] T [P] [US8] 在 `backend/src/repositories/eventRepository.js` 新增 `countNoShows(conn, userId, since)`：統計該使用者 `to_status = 'no_show'` 且 `occurred_at` 晚於 `since` 的筆數（`since` 為統計窗起點與 `no_show_counted_from_at` 取較晚者）
  - 📎 必讀：`data-model.dbml › Table booking_events` — 統計使用的欄位與 to_status 值以此為準

### 後端（API-04 報到、API-11 未到場與完成）

- [x] T [P] [US8] 實作 `backend/src/domain/checkIn.js` 的純函式 `checkInWindow(booking, rules)`（開始前 `checkin_open_minutes` 到開始後 `checkin_close_minutes`，含兩端，且截止不晚於結束時間）與 `canCheckIn(booking, rules, now)`（狀態須為 `confirmed` 且 `now` 在時間窗內）
  - 📎 必讀：`spec.md › FR-038` — 報到時間窗的要求以此為準
  - 📎 必讀：`spec.md › FR-039` — 時間窗外或狀態不符不得報到的要求以此為準
  - 📎 必讀：`research.md › R-09` — 報到時間窗以純函式檢查的決定以此為準
- [x] T [US8] 在 `backend/src/services/bookingService.js` 新增 `checkInBooking(user, bookingId)`：只有預約者本人（管理員不得代為報到）；不在時間窗內或狀態不符回 409 並說明可報到的時間；通過後以 `transition` 轉為 `checked_in`；暫停預約權限不影響報到；並在 `bookingView.js` 的 `toMyBooking` 補上 `canCheckIn` 與 `checkInWindow`（依賴 T098）
  - 📎 必讀：`contracts/openapi.yaml › checkInBooking` — 報到的條件、回應與 403／404／409 以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.MyBooking` — canCheckIn 與 checkInWindow 的欄位以此為準
  - 📎 必讀：`spec.md › FR-043` — 暫停期間報到不受影響的要求以此為準
- [x] T [US8] 實作 `backend/src/jobs/noShows.js` 的 `markNoShows` 與 `backend/src/jobs/completions.js` 的 `completeCheckedIn` 並以 `registerJob` 註冊：`markNoShows` 以 `processDue` 取 `confirmed` 且已過報到截止的預約，同一交易內鎖使用者列、轉為 `no_show`（`actor_type` 為 `system`）、只刪除判定時間之後下一個整點或半點起的時段列（例如 10:00 起的預約於 10:15 判定，自 10:30 起釋出）、統計窗內未到場次數，達 `no_show_threshold` 時把 `suspended_until_at` 設為現在加 `suspend_days` 天、`no_show_counted_from_at` 設為 `suspended_until_at` 並通知使用者 `suspension`；`completeCheckedIn` 把 `checked_in` 且已到結束時間的預約轉為 `completed`（依賴 T096、T097）
  - 📎 必讀：`contracts/openapi.yaml › x-background-jobs` — markNoShows 與 completeCheckedIn 的觸發條件與結果以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 排程：未到場判定` — 未到場判定的鎖定、釋出與暫停的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-040` — 未到場判定與釋出剩餘時段的要求以此為準
  - 📎 必讀：`spec.md › FR-042` — 累計門檻與暫停的要求以此為準
  - 📎 必讀：`spec.md › FR-044` — 暫停期間未到場不延長暫停、恢復後重新累計的要求以此為準
- [x] T [US8] 在 `backend/src/routes/bookings.js` 新增 `POST /api/bookings/{bookingId}/check-in`，並在 `backend/src/domain/policy.js` 補上動作 `booking:check-in`（僅預約者本人）、在 `backend/src/server.js` 載入 `noShows.js` 與 `completions.js`（依賴 T099、T100）
  - 📎 必讀：`contracts/openapi.yaml › checkInBooking` — 報到端點的路徑與狀態碼以此為準

### 前端（UI-04 報到）

- [x] T [US8] 在 `frontend/src/components/bookingCard.js` 啟用 `booking-checkin-button`（依 `canCheckIn` 顯示，並以 `checkInWindow` 顯示可報到的時間）；報到後更新卡片狀態為「已報到」；不在時間窗內失敗時顯示可報到的時間
  - 📎 必讀：`contracts/ui-contract.md › UI-04 我的預約介面 › 操作` — 報到的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-04 我的預約介面 › 文案與無障礙` — 報到按鈕文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/bookings.html › booking-checkin-button` — 報到按鈕版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › checkInBooking` — 報到失敗的回應以此為準

**Checkpoint**：US1～US8 皆可獨立運作

---

## Phase 11：使用者故事 9 - 週期性預約（Priority: P9）

**目標**：員工建立每週或每兩週重複的預約，送出前逐場檢查並列出衝突日期，之後可取消單一場次或該場次之後的所有場次（UI-03 週期性、UI-04 場次操作、UI-07 整批審核、API-06、API-05 整批、DB-03）

**完成判準**：員工建立每週一次共 8 場的週期性預約，其中 2 個日期衝突時畫面列出這 2 個日期，選擇略過後成立 6 場且整批只占 1 筆持有額度；取消第 3 場後只有該場變為「已取消」；選擇取消第 3 場及之後時第 3 場以後都變為「已取消」

### 資料庫端（DB-03 批次）

- [x] T [P] [US9] 實作 `backend/src/repositories/seriesRepository.js`：`insert(conn, series)`、`findById(conn, id)`、`lockById(conn, id)`、`setStatus(conn, id, status)`（`pending`、`confirmed`、`rejected`、`cancelled`，與 openapi 的 `SeriesStatus` 逐字相同）、`listSessions(conn, seriesId)`、`countActiveSeries(conn, userId, now)`（`COUNT(DISTINCT series_id)`，條件為仍有未來有效場次）
  - 📎 必讀：`data-model.dbml › Table booking_series` — 批次表的欄位與狀態約束以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.SeriesStatus` — 批次狀態代碼集合以此為準，須與資料庫逐字相同
  - 📎 必讀：`research.md › R-12` — 批次與場次的關係及額度計算以此為準
- [x] T [US9] 在 `backend/src/repositories/bookingRepository.js` 新增 `listBySeries(conn, seriesId)`（含 `series_index`）與 `listUncancelledBySeries(conn, seriesId)`，並讓 `insert` 接受 `series_id`、`series_index`
  - 📎 必讀：`data-model.dbml › Table bookings` — series_id 與 series_index 欄位以此為準

### 後端（API-06、API-05 整批、API-11 整批逾期）

- [x] T [P] [US9] 實作 `backend/src/domain/series.js` 的純函式 `expandSeries({ firstDate, frequency, lastDate, startTime, endTime }, rules)`：每個場次同一星期、同一起訖，間隔 7 天（`weekly`）或 14 天（`biweekly`）；最後一場不得晚於第一場加 `max_series_months` 個月（`addTaipeiMonths`），超過回 400；第一場須符合單次預約的日期限制，後續場次不受最遠天數限制
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.SeriesInput` — 週期性預約輸入欄位以此為準
  - 📎 必讀：`spec.md › FR-046` — 最長 3 個月的要求以此為準
  - 📎 必讀：`spec.md › FR-047` — 第一場適用 30 天限制、後續場次不受限的要求以此為準
  - 📎 必讀：`research.md › R-12` — 場次展開以純函式處理的決定以此為準
- [x] T [US9] 實作 `backend/src/services/seriesService.js` 的 `previewBookingSeries(user, input)`（不寫入）：展開場次後逐場檢查 `validateBooking`、維護時段與時段列是否已被占用，回傳每個場次的結果與衝突原因及 `availableCount`；即使全部衝突也回 200（`availableCount` 為 0）（依賴 T103、T105）
  - 📎 必讀：`contracts/openapi.yaml › previewBookingSeries` — 衝突預覽的請求與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.SeriesPreview` — 預覽回應的欄位以此為準
  - 📎 必讀：`spec.md › FR-050` — 送出前逐場檢查並列出衝突日期與原因的要求以此為準
- [x] T [US9] 在 `backend/src/services/seriesService.js` 新增 `createBookingSeries(user, input)`：`withTransaction` 內鎖使用者列 → 暫停檢查 → 持有筆數（整批算 1 筆）不得達 `max_active_bookings`、批數不得達 `max_active_series`（皆回 409）→ `skipDates` 必須是展開場次的日期 → 插入 `booking_series` → 對不在 `skipDates` 的場次逐一嘗試寫入時段列（重複鍵只回滾該語句、交易繼續以蒐集全部新衝突）→ 只要有任何新衝突就整個交易回滾並回 409 與最新衝突清單 → 全部成功才插入各場次 `bookings`、`booking_events` 與通知；沒有任何場次可建立時回 400；需要審核的場地所有場次為 `pending`、批次為 `pending`，否則為 `confirmed`（依賴 T104、T106）
  - 📎 必讀：`contracts/openapi.yaml › createBookingSeries` — 建立的請求、回應與 400／409 的條件以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.SeriesCreated` — 建立結果的欄位以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 建立週期性預約` — 鎖定、蒐集衝突與全有或全無回滾的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-048` — 整批算 1 筆持有額度的要求以此為準
  - 📎 必讀：`spec.md › FR-049` — 週期性預約批數上限的要求以此為準
  - 📎 必讀：`spec.md › FR-052` — 正式送出時出現新衝突就不建立任何場次的要求以此為準
- [x] T [US9] 在 `backend/src/services/bookingService.js` 的 `cancelBooking` 補上 `scope`：`single` 只取消該場次；`following` 在同一交易內對同批「該場次及其之後、尚未開始」的場次逐場 `transition` 為 `cancelled`（每場各自判定逾時取消），整批全部取消時把 `booking_series.status` 設為 `cancelled`；任一場次失敗整筆回滾（依賴 T104）
  - 📎 必讀：`contracts/openapi.yaml › cancelBooking` — scope 參數與回應中被取消場次的欄位以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 取消預約（following）` — 同一交易逐場取消與批次狀態更新的範圍以此為準
  - 📎 必讀：`spec.md › FR-053` — 取消單一場次或其後所有場次的要求以此為準
- [x] T [US9] 在 `backend/src/services/bookingService.js` 的 `updateBooking` 補上批次場次的限制：批次仍為 `pending` 時回 409（`series_pending`）；修改後的日期不得晚於同批最後一場且不受最遠天數限制；只有該場次依場地是否需要審核決定狀態（依賴 T108）
  - 📎 必讀：`spec.md › FR-054` — 批次場次修改限制的要求以此為準
  - 📎 必讀：`contracts/openapi.yaml › updateBooking` — series_pending 的錯誤回應以此為準
- [x] T [US9] 在 `backend/src/services/reviewService.js` 新增 `approveSeries`（批次 `pending` → `confirmed`，所有未取消場次逐一 `transition` 為 `confirmed`）與 `rejectSeries(reason)`（原因不得為空白；所有未取消場次 `rejected`、批次 `rejected`、釋出全部時段），並讓 `listReviews` 將整批申請合成一筆（`ReviewItem` 含場次清單）；已被處理的批次回 409（依賴 T104）
  - 📎 必讀：`contracts/openapi.yaml › approveSeries` — 整批核准的條件與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › rejectSeries` — 整批駁回的原因驗證與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.ReviewItem` — 整批申請在清單中的欄位以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.SeriesStatus` — 整批核准後的批次狀態代碼以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 整批審核（核准／駁回）` — 整批逐場條件更新與失敗回滾的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-055` — 需審核場地的週期性預約以整批審核的要求以此為準
- [x] T [US9] 在 `backend/src/jobs/reviewExpiry.js` 的 `expirePendingReviews` 補上批次：`pending` 批次的最早未取消場次開始時間已到時，該批所有未取消場次轉為 `cancelled`（原因「未於開始前完成審核」，`actor_type` 為 `system`）、批次轉為 `cancelled` 並通知預約者（依賴 T110）
  - 📎 必讀：`contracts/openapi.yaml › x-background-jobs` — 批次逾期的判斷條件以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 排程：逾期未審核` — 批次逾期取消的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-056` — 整批自動取消的要求以此為準
- [x] T [US9] 實作 `backend/src/routes/bookingSeries.js`：`POST /api/booking-series/preview`、`POST /api/booking-series`（201）；在 `backend/src/routes/reviews.js` 新增 `POST /api/reviews/series/{seriesId}/approve` 與 `POST /api/reviews/series/{seriesId}/reject`；在 `backend/src/routes/bookings.js` 的取消端點接受 `scope`；並在 `backend/src/domain/policy.js` 補上動作 `series:create`、`series:review`（依賴 T107、T109～T111）
  - 📎 必讀：`contracts/openapi.yaml › previewBookingSeries、createBookingSeries` — 週期性預約端點的路徑與狀態碼以此為準
  - 📎 必讀：`contracts/openapi.yaml › approveSeries、rejectSeries` — 整批審核端點的路徑與狀態碼以此為準

### 前端（UI-03 週期性、UI-04 場次操作、UI-07 整批）

- [x] T [US9] 在 `frontend/src/pages/bookingFormPage.js` 加入週期性區塊：`booking-recurring-toggle`、重複頻率（每週、每兩週）、`booking-recurrence-end`；「檢查衝突」呼叫 `POST /api/booking-series/preview`，以 `booking-series-list` 列出各場次與衝突原因；有衝突時提供「略過衝突日期並送出」`booking-series-skip-submit` 與「取消整批」`booking-series-cancel`；全部衝突時不可送出；送出時帶 `skipDates`，若回 409 新衝突則重新列出
  - 📎 必讀：`contracts/ui-contract.md › UI-03 預約表單介面 › 操作` — 週期性預約的檢查、略過與取消整批流程以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-03 預約表單介面 › 狀態` — 衝突清單與無可預約場次的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-03 預約表單介面 › 文案與無障礙` — 週期性區塊文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/booking-form.html › booking-series-list` — 衝突清單版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › createBookingSeries` — 送出請求與 409 衝突回應以此為準
- [x] T [US9] 在 `frontend/src/components/bookingCard.js` 加入批次場次的顯示（序號、整批是否仍待審核）與取消範圍對話框：`booking-cancel-scope-single`（只取消這一場）、`booking-cancel-scope-following`（取消這一場及之後所有場次）；整批待審核時隱藏修改入口並顯示原因（依賴 T113）
  - 📎 必讀：`contracts/ui-contract.md › UI-04 我的預約介面 › 操作` — 取消範圍選擇的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-04 我的預約介面 › 文案與無障礙` — 取消範圍文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/bookings.html › booking-cancel-scope-following` — 取消範圍對話框版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.SeriesInfo` — 批次場次顯示所用的欄位以此為準
- [x] T [US9] 在 `frontend/src/pages/reviewsPage.js` 加入整批週期性申請：以 `review-series-toggle` 展開場次清單，核准與駁回呼叫 `POST /api/reviews/series/{seriesId}/approve`、`…/reject`，駁回原因規則同單筆（依賴 T113）
  - 📎 必讀：`contracts/ui-contract.md › UI-07 待審核介面 › 操作` — 整批申請的審核操作以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.ReviewItem` — 整批申請在清單中的欄位以此為準
  - 📎 必讀：`contracts/prototype/reviews.html › review-series-toggle` — 整批申請展開版面以原型為參考來源

**Checkpoint**：US1～US9 皆可獨立運作

---

## Phase 12：使用者故事 10 - 排候補與遞補（Priority: P10）

**目標**：員工在時段已滿時登記候補，時段釋出後系統依登記先後通知第一順位並保留時段，對方在時限內確認才成立預約（UI-05、UI-02／UI-03 登記入口、API-07、API-11 候補工作、DB-06）

**完成判準**：A 預約的時段被 B 登記候補，A 在開始前 2 小時取消後 B 收到遞補通知且該時段無法被他人預約，B 在 30 分鐘內確認即成立預約；B 逾時未確認則通知下一位候補；開始前 45 分鐘才釋出的時段不通知候補，改為開放所有人預約

### 資料庫端（DB-06）

- [x] T [US10] 撰寫 `backend/src/db/migrations/005_waitlist.sql`（DB-06），欄位、索引與約束依 data-model.dbml 原樣建立 `waitlist_entries`（`status` 取 `waiting`、`offered`、`confirmed`、`expired`、`cancelled`，`close_reason` 七種，產生欄位 `active_dup_key` 與唯一鍵 `uk_waitlist_active_dup` 擋下同一人同場地同起訖的重複登記），並補上 `fk_waitlist_booking_id` 與 `notifications.waitlist_entry_id` 的外鍵 `fk_notifications_waitlist_entry_id`
  - 📎 必讀：`data-model.dbml › Table waitlist_entries` — 候補表的欄位、索引與產生欄位以此為準
  - 📎 必讀：`data-model.dbml › Ref fk_waitlist_user_id、fk_waitlist_venue_id、fk_waitlist_booking_id、fk_notifications_waitlist_entry_id` — 外鍵方向與刪除行為以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 遷移順序` — 候補遷移補上 bookings 與 notifications 外鍵的順序以此為準
- [x] T [US10] 實作 `backend/src/repositories/waitlistRepository.js`：`insert`、`findById`、`lockByIds`、`listByUser(conn, userId, { recentDays })`（含保留中，順位把保留中計入，已結束者取最近 30 天最多 20 筆）、`listOverlapping(conn, venueId, range)`（`status = 'waiting'`，`ORDER BY created_at, id`）、`setOffered(conn, id, expiresAt)`、`close(conn, id, { status, closeReason, bookingId, now })`、`listDueOffers(conn, now)`、`listStarted(conn, now)`（依賴 T116）
  - 📎 必讀：`data-model.dbml › Table waitlist_entries` — 查詢與更新使用的欄位及索引以此為準
  - 📎 必讀：`research.md › R-11` — 順位依 (created_at, id) 排序的決定以此為準

### 後端（API-07、API-11 候補工作）

- [x] T [US10] 實作 `backend/src/services/waitlistService.js` 的 `createWaitlistEntry`（時段必須已有占用，未被占用回 409 並提示可直接預約；內容須符合 `validateBooking`；暫停期間回 409；同一人同場地同起訖已有候補回 409；時段只被維護占用時不可登記）、`listMyWaitlist`（含目前順位）、`cancelWaitlistEntry`（改為 `cancelled`，後面順位自然前移）；候補不計入持有筆數（依賴 T117）
  - 📎 必讀：`contracts/openapi.yaml › createWaitlistEntry` — 登記的請求、回應與 400／403／404／409 以此為準
  - 📎 必讀：`contracts/openapi.yaml › listMyWaitlist` — 候補列表與順位的回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › cancelWaitlistEntry` — 取消候補的條件與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.WaitlistEntry` — 候補的欄位以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 登記候補／取消候補` — 登記與取消候補的單一語句範圍以此為準
  - 📎 必讀：`spec.md › FR-058` — 候補登記條件的要求以此為準
  - 📎 必讀：`spec.md › FR-060` — 同一人不得重複登記且候補不計入持有筆數的要求以此為準
- [x] T [US10] 實作 `backend/src/services/waitlistOffers.js` 的 `offerFreedSlots(conn, venueId, range, now)` 並以 `registerReleaseListener` 註冊：找出與釋出範圍重疊、`waiting` 的候補，依順位逐一處理——該候補的全部時段列都已空出且現在早於「開始時間減 `waitlist_cutoff_minutes`」時，設為 `offered`、`offer_expires_at` 為現在加 `waitlist_confirm_minutes`、以 `hold` 寫入時段列並通知 `waitlist_offer`；距開始已在門檻內時不通知、不保留，時段直接對所有人開放；只部分空出時不遞補；被暫停預約的使用者視同確認失敗，標為 `expired` 並處理下一位（依賴 T118）
  - 📎 必讀：`research.md › R-11` — 遞補掛勾的判斷、保留與開放規則以此為準
  - 📎 必讀：`data-model.dbml › Table waitlist_entries` — 狀態、offer_expires_at 與 close_reason 欄位以此為準
  - 📎 必讀：`spec.md › FR-061` — 通知第一順位並保留 30 分鐘的要求以此為準
  - 📎 必讀：`spec.md › FR-064` — 開始前 1 小時內釋出不再通知候補的要求以此為準
  - 📎 必讀：`spec.md › FR-062` — 保留期間不得被他人預約的要求以此為準
- [x] T [US10] 在 `backend/src/services/waitlistService.js` 新增 `confirmWaitlistEntry` 與 `declineWaitlistEntry`：確認時鎖使用者列，候補須為 `offered` 且未逾時，檢查暫停與持有筆數，通過後插入 `bookings`（狀態依場地是否需要審核）、把 `hold` 時段列原地改為 `booking`、候補轉為 `confirmed` 並寫入 `booking_id`，回 201；持有上限、暫停或逾時造成的失效是獨立先提交的小交易（候補轉 `expired`、刪除 `hold` 列、呼叫 `offerFreedSlots`）後再回 409；放棄時轉 `expired`（原因 `declined`）、刪除 `hold` 列並呼叫 `offerFreedSlots`（依賴 T119）
  - 📎 必讀：`contracts/openapi.yaml › confirmWaitlistEntry` — 確認遞補的條件、回應與 409 以此為準
  - 📎 必讀：`contracts/openapi.yaml › declineWaitlistEntry` — 放棄候補的條件與回應以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 確認候補遞補` — 確認成功路徑與失效先提交的交易範圍以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 放棄候補` — 放棄候補的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-063` — 確認、放棄與逾時改通知下一位的要求以此為準
- [x] T [US10] 實作 `backend/src/jobs/waitlistJobs.js` 並以 `registerJob` 註冊三個工作：`expireWaitlistOffers`（`offered` 且 `offer_expires_at` 已到者轉 `expired`（原因 `offer_timeout`）、刪除 `hold` 列、呼叫 `offerFreedSlots`）、`expireStartedWaitlist`（候補時段開始時間已到而未成立者轉 `expired`（原因 `started`））、`retryWaitlistOffers`（對仍在 `waiting` 的候補重新呼叫 `offerFreedSlots` 作為保險）；失效時通知候補者 `waitlist_expired`（依賴 T120）
  - 📎 必讀：`contracts/openapi.yaml › x-background-jobs` — 三個候補工作的觸發條件與結果以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 排程：完成` — 候補逾時與失效每筆一個交易的範圍以此為準
  - 📎 必讀：`spec.md › FR-066` — 候補時段開始仍未遞補即失效的要求以此為準
- [x] T [US10] 實作 `backend/src/routes/waitlist.js`：`GET /api/waitlist`、`POST /api/waitlist`（201）、`POST /api/waitlist/{entryId}/confirm`（201）、`POST /api/waitlist/{entryId}/decline`、`POST /api/waitlist/{entryId}/cancel`，在 `backend/src/domain/policy.js` 補上動作 `waitlist:own`（僅登記者本人），註冊至 `backend/src/app.js` 並在 `backend/src/server.js` 載入 `waitlistOffers.js` 與 `waitlistJobs.js`（依賴 T120、T121）
  - 📎 必讀：`contracts/openapi.yaml › listMyWaitlist、createWaitlistEntry、confirmWaitlistEntry、declineWaitlistEntry、cancelWaitlistEntry` — 候補端點的路徑、方法與狀態碼以此為準

### 前端（UI-05、UI-02／UI-03 登記入口）

- [x] T [P] [US10] 實作 `frontend/src/components/waitlistDialog.js`（疊層對話框，不改 hash）：`waitlist-register-date`、起訖時間、`waitlist-register-subject`、`waitlist-register-attendees`、`waitlist-register-submit`、`waitlist-register-dialog-cancel`、`waitlist-register-dialog-error`；可由行事曆的 `calendar-slot-waitlist`、預約表單與候補頁開啟；週期性預約的衝突日期不提供候補
  - 📎 必讀：`contracts/ui-contract.md › UI-05 候補介面 › 操作` — 登記候補的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-05 候補介面 › 文案與無障礙` — 登記對話框文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/waitlist-dialog.js › waitlist-register-submit` — 登記對話框版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › createWaitlistEntry` — 登記請求欄位與錯誤回應以此為準
- [x] T [US10] 實作 `frontend/src/pages/waitlistPage.js`（`#/waitlist`）：`waitlist-list`／`waitlist-item`（場地、時段、順位、狀態）、保留中的候補顯示 `waitlist-notice` 與 `waitlist-confirm-button`、`waitlist-decline-button`，等待中顯示 `waitlist-cancel-button`，`waitlist-register-open` 開啟登記對話框；確認失敗（逾時、持有上限、暫停）時顯示原因並更新列表；暫停期間顯示 `suspension-banner`（依賴 T123）
  - 📎 必讀：`contracts/ui-contract.md › UI-05 候補介面 › 操作` — 確認、放棄與取消候補的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-05 候補介面 › 狀態` — 載入、空狀態與失效的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-05 候補介面 › 文案與無障礙` — 候補頁文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/waitlist.html › waitlist-list` — 候補頁版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.WaitlistList` — 列表顯示的欄位以此為準
- [x] T [US10] 在 `frontend/src/components/calendar.js` 啟用 `calendar-slot-waitlist`：已預約時段點選後開啟 `waitlistDialog`，維護中的時段不提供候補（依賴 T123）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 場地搜尋與行事曆介面 › 操作` — 已預約時段登記候補的入口以此為準
  - 📎 必讀：`contracts/prototype/venues.html › calendar-slot-waitlist` — 候補入口版面以原型為參考來源

**Checkpoint**：US1～US10 皆可獨立運作

---

## Phase 13：使用者故事 11 - 設定維護時段、停用場地與帳號，以及取消單筆預約（Priority: P11）

**目標**：管理員設定維護時段、停用或重新啟用場地與帳號時先看到受影響的預約並確認，也可直接取消任一筆預約（UI-08 維護與停用、UI-09 停用、UI-10、API-01／API-02 停用與維護、API-04 管理員取消、DB-02 維護時段）

**完成判準**：對有 2 筆未來預約的時段設定維護時，系統先列出這 2 筆，確認後它們變為「已取消」、預約者收到含原因的通知、行事曆顯示「維護中」；放棄則什麼都不變；管理員填寫原因後取消單筆預約，預約者收到通知且不標示逾時取消

### 資料庫端（DB-02 維護時段）

- [x] T [US11] 撰寫 `backend/src/db/migrations/006_maintenance.sql`（DB-02），依 data-model.dbml 原樣建立 `venue_maintenance_windows`（`venue_id`、`start_at`、`end_at`，外鍵 restrict）
  - 📎 必讀：`data-model.dbml › Table venue_maintenance_windows` — 維護時段表的欄位與約束以此為準
  - 📎 必讀：`data-model.dbml › Ref fk_maintenance_venue_id` — 外鍵方向與刪除行為以此為準
- [x] T [US11] 實作 `backend/src/repositories/maintenanceRepository.js`：`insert`、`update`、`delete`、`findById`、`listByVenue(conn, venueId)`（依開始時間由近到遠）；並在 `backend/src/repositories/bookingRepository.js` 新增 `listActiveInRange(conn, venueId, startAt, endAt)`、`listActiveByVenue(conn, venueId, now)`、`listActiveByUser(conn, userId, now)`（狀態 `pending`、`confirmed`、`checked_in` 且未開始），在 `backend/src/repositories/waitlistRepository.js` 新增 `listOpenByVenue`、`listOpenByUser`（`waiting`、`offered`）（依賴 T126）
  - 📎 必讀：`data-model.dbml › Table venue_maintenance_windows` — 維護時段查詢欄位以此為準
  - 📎 必讀：`data-model.dbml › Table bookings` — 受影響預約查詢使用的欄位及索引以此為準

### 後端（API-01／API-02 停用與維護、API-04 管理員取消）

- [x] T [US11] 實作 `backend/src/services/impactService.js`：`computeImpact(conn, target)`（`target` 為維護時段區間、場地或帳號）回傳受影響的未來有效預約清單（`ImpactPreview`，含預約者、時段、狀態與週期性場次標示）；`assertConfirmed(impact, bookingIds)`：確認請求帶的 `bookingIds` 必須與交易內重新計算的清單一致，不一致回 409 並回傳最新清單，不取消使用者沒看過的預約；`cancelAffected(conn, impact, actor, reason)`：逐筆 `transition` 為 `cancelled`（`actor_type` 為 `admin`、不標逾時取消）、釋出時段並通知預約者 `booking_cancelled`（依賴 T127）
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.ImpactPreview` — 影響預覽的欄位以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.ImpactConfirmInput` — 確認請求帶 bookingIds 的欄位以此為準
  - 📎 必讀：`research.md › R-02` — 兩段式確認與重新計算比對的決定以此為準
  - 📎 必讀：`spec.md › FR-068` — 先列出受影響預約、確認後才取消的要求以此為準
  - 📎 必讀：`spec.md › FR-069` — 未確認時不得改變任何預約的要求以此為準
- [x] T [US11] 實作 `backend/src/services/maintenanceService.js`：`listMaintenanceWindows`、`previewMaintenanceImpact`、`createMaintenanceWindow`、`updateMaintenanceWindow`、`deleteMaintenanceWindow`（皆須管理員）：時間以 30 分鐘為單位且結束晚於開始；確認時在同一交易內取消受影響預約、編輯時刪除舊維護時段列、寫入維護時段與 `holder_type = 'maintenance'` 的時段列（主鍵重複代表仍有未列入確認清單的占用，回滾並回 409 與最新影響）；刪除維護時段時刪除其時段列並呼叫釋出監聽器（依賴 T128）
  - 📎 必讀：`contracts/openapi.yaml › createMaintenanceWindow` — 建立維護時段的確認與 409 以此為準
  - 📎 必讀：`contracts/openapi.yaml › updateMaintenanceWindow` — 編輯維護時段的確認流程以此為準
  - 📎 必讀：`contracts/openapi.yaml › previewMaintenanceImpact` — 預覽影響的請求與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › deleteMaintenanceWindow` — 刪除維護時段的回應以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 設定維護時段（建立／編輯）` — 取消受影響預約並寫入維護時段列的交易範圍以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 刪除維護時段` — 刪除維護時段並釋出的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-067` — 維護時段的設定要求以此為準
- [x] T [US11] 在 `backend/src/services/venueService.js` 新增 `previewVenueDeactivation`、`deactivateVenue`、`enableVenue`（皆須管理員）：確認停用時在同一交易內取消受影響預約、把該場地 `waiting` 與 `offered` 候補改為 `expired`（原因 `venue_disabled`）並刪除 `hold` 列、通知候補者、更新 `is_active`；停用的場地不再出現在搜尋與新預約；重新啟用不恢復先前被取消的預約（依賴 T128）
  - 📎 必讀：`contracts/openapi.yaml › previewVenueDeactivation` — 停用影響預覽的回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › deactivateVenue` — 確認停用的請求、回應與 409 以此為準
  - 📎 必讀：`contracts/openapi.yaml › enableVenue` — 重新啟用的回應以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 停用場地` — 停用場地時取消預約與失效候補的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-070` — 停用場地不接受新預約、重新啟用不恢復預約的要求以此為準
  - 📎 必讀：`spec.md › FR-071` — 停用時相關候補失效的要求以此為準
- [x] T [US11] 在 `backend/src/services/userService.js` 新增 `previewUserDeactivation`、`deactivateUser`、`enableUser`（皆須管理員）：不得停用自己，也不得停用或降級最後一位啟用中的管理員（先鎖該帳號，違反回 409）；確認停用時在同一交易內取消該帳號未來預約、使其候補失效（原因 `account_disabled`）並刪除 `hold` 列、更新 `is_active`、刪除該帳號全部階段（依賴 T128）
  - 📎 必讀：`contracts/openapi.yaml › previewUserDeactivation` — 帳號停用影響預覽的回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › deactivateUser` — 確認停用帳號的請求、回應與 409 以此為準
  - 📎 必讀：`contracts/openapi.yaml › enableUser` — 重新啟用帳號的回應以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 停用帳號` — 停用帳號時取消預約、失效候補與刪除階段的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-005` — 管理員可停用或重新啟用帳號的要求以此為準
- [x] T [US11] 實作 `backend/src/services/adminBookingService.js`：`listAdminBookings`（依開始時間由新到舊，`from`、`to` 為台北日期含頭含尾，可依關鍵字與狀態篩選）、`listBookingEvents`（唯讀，由舊到新，系統處理時操作者為空）、`adminCancelBooking(admin, bookingId, reason)`（原因不得為空白；只能取消尚未開始的待審核或已確認預約；`transition` 為 `cancelled`，`actor_type` 為 `admin`，不標逾時取消；通知預約者並附原因）；週期性場次被取消後該批已無未取消場次時，同一交易內先鎖 `booking_series` 列再把 `booking_series.status` 改為 `cancelled`；管理員不得代為預約、修改或報到（依賴 T128）
  - 📎 必讀：`contracts/openapi.yaml › listAdminBookings` — 全部預約列表的篩選參數與回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › listBookingEvents` — 操作紀錄的回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › adminCancelBooking` — 管理員取消的條件、回應與 400／409 以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 管理員取消單筆預約` — 管理員取消的交易範圍（含批次狀態更新與鎖定順序）以此為準
  - 📎 必讀：`spec.md › FR-072` — 管理員取消不標逾時取消且須填原因的要求以此為準
  - 📎 必讀：`spec.md › FR-084` — 管理員可查看所有預約與操作紀錄的要求以此為準
- [x] T [US11] 在 `backend/src/routes/adminVenues.js` 新增 `GET／POST /api/admin/venues/{venueId}/maintenance-windows`、`POST …/maintenance-windows/impact`、`PUT／DELETE …/maintenance-windows/{windowId}`、`GET …/deactivation-impact`、`POST …/deactivate`、`POST …/enable`；在 `backend/src/routes/users.js` 新增 `GET /api/users/{userId}/deactivation-impact`、`POST …/deactivate`、`POST …/enable`；實作 `backend/src/routes/adminBookings.js`：`GET /api/admin/bookings`、`GET /api/admin/bookings/{bookingId}/events`、`POST /api/admin/bookings/{bookingId}/cancel`；並在 `backend/src/domain/policy.js` 補上動作 `admin:booking-cancel`、`admin:booking-view`（依賴 T129～T132）
  - 📎 必讀：`contracts/openapi.yaml › listMaintenanceWindows、createMaintenanceWindow、previewMaintenanceImpact、updateMaintenanceWindow、deleteMaintenanceWindow` — 維護時段端點的路徑、方法與狀態碼以此為準
  - 📎 必讀：`contracts/openapi.yaml › previewVenueDeactivation、deactivateVenue、enableVenue` — 場地停用端點的路徑與狀態碼以此為準
  - 📎 必讀：`contracts/openapi.yaml › previewUserDeactivation、deactivateUser、enableUser` — 帳號停用端點的路徑與狀態碼以此為準
  - 📎 必讀：`contracts/openapi.yaml › listAdminBookings、listBookingEvents、adminCancelBooking` — 管理員預約端點的路徑與狀態碼以此為準

### 前端（UI-08 維護與停用、UI-09 停用、UI-10）

- [x] T [P] [US11] 實作 `frontend/src/components/impactDialog.js`：以 `openDialog` 列出受影響的預約（預約者、時段、狀態），提供確認與放棄；確認時帶 `bookingIds` 送出，回 409 時以最新清單重新顯示；沒有受影響預約時不彈出而直接送出
  - 📎 必讀：`contracts/ui-contract.md › UI-08 場地與維護管理介面 › 操作` — 影響預覽與確認的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-08 場地與維護管理介面 › 文案與無障礙` — 影響對話框文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/impact.js` — 影響對話框版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.ImpactPreview` — 對話框顯示的欄位以此為準
- [x] T [US11] 在 `frontend/src/pages/adminVenuesPage.js` 加入維護時段區塊 `maintenance-section`（`maintenance-list`、`maintenance-add`、`maintenance-start-date`、`maintenance-end-date`、`maintenance-save`、`maintenance-edit`、`maintenance-delete`、`maintenance-error`，儲存時顯示 `maintenance-impact-dialog`）與場地的停用及重新啟用（依賴 T134）
  - 📎 必讀：`contracts/ui-contract.md › UI-08 場地與維護管理介面 › 操作` — 維護時段與停用場地的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-08 場地與維護管理介面 › 狀態` — 影響預覽與錯誤的呈現以此為準
  - 📎 必讀：`contracts/prototype/admin-venues.html › maintenance-section` — 維護時段區塊版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.MaintenanceWindowList` — 維護時段列表的欄位以此為準
- [x] T [US11] 在 `frontend/src/pages/adminUsersPage.js` 加入 `user-disable-button`（開啟 `user-impact-dialog`）與 `user-enable-button`；不得停用自己或最後一位管理員時顯示後端回傳的原因（依賴 T134）
  - 📎 必讀：`contracts/ui-contract.md › UI-09 帳號管理介面 › 操作` — 停用與重新啟用帳號的操作以此為準
  - 📎 必讀：`contracts/prototype/admin-users.html › user-impact-dialog` — 帳號停用影響對話框版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › deactivateUser` — 停用失敗的回應以此為準
- [x] T [P] [US11] 實作 `frontend/src/pages/adminBookingsPage.js`（`#/admin/bookings`）：篩選列（`admin-bookings-filter-from`、`admin-bookings-filter-to`、`admin-bookings-filter-keyword`、`admin-bookings-filter-submit`）、`admin-bookings-list`／`admin-bookings-item` 以 `admin-bookings-load-more` 分頁、`admin-booking-log-toggle` 展開 `admin-booking-log`（操作者、時間、前後狀態、原因）、`admin-booking-cancel-button` 開啟必填 `admin-cancel-reason` 的對話框（`admin-cancel-dialog-confirm`、`admin-cancel-dialog-cancel`）
  - 📎 必讀：`contracts/ui-contract.md › UI-10 全部預約與操作紀錄介面 › 操作` — 篩選、查看紀錄與管理員取消的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-10 全部預約與操作紀錄介面 › 狀態` — 載入、空狀態與錯誤的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-10 全部預約與操作紀錄介面 › 文案與無障礙` — 全部預約文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/admin-bookings.html › admin-bookings-list` — 全部預約頁版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.AdminBookingList` — 列表顯示的欄位以此為準

**Checkpoint**：US1～US11 皆可獨立運作

---

## Phase 14：使用者故事 12 - 管理規則數字（Priority: P12）

**目標**：管理員在系統內調整全公司共用的規則數字，調整只影響之後的新操作並留下變更紀錄（UI-11、API-09、DB-08）

**完成判準**：管理員把最遠可預約天數從 30 改為 14 後，員工預約第 15 天被拒絕、先前已成立的第 20 天預約維持不變；輸入 0 或小數時不會儲存並顯示須為正整數；變更紀錄列出操作者、時間、舊值與新值

### 資料庫端（DB-08）

- [x] T [US12] 撰寫 `backend/src/db/migrations/007_rule_changes.sql`（DB-08），建立 `rule_changes` 與 `BEFORE UPDATE`、`BEFORE DELETE` 兩個不可更動觸發器（`SIGNAL SQLSTATE '45000'`，訊息「紀錄不可修改」）；外鍵一律 restrict
  - 📎 必讀：`data-model.dbml › Table rule_changes` — 規則變更紀錄表的欄位以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 不可更動資料表（資料庫層強制）` — 觸發器與權限的規定以此為準
  - 📎 必讀：`data-model.dbml › Ref fk_rule_changes_rule_key、fk_rule_changes_actor_user_id` — 外鍵方向與刪除行為以此為準
- [x] T [US12] 在 `backend/src/repositories/ruleRepository.js` 新增 `update(conn, ruleKey, value, { actorUserId, now })`、`insertChange(conn, change)`、`listChanges(conn, { limit, beforeId })`（由新到舊）（依賴 T138）
  - 📎 必讀：`data-model.dbml › Table rules` — 規則更新的欄位以此為準
  - 📎 必讀：`data-model.dbml › Table rule_changes` — 變更紀錄的欄位以此為準

### 後端（API-09）

- [x] T [US12] 實作 `backend/src/services/ruleService.js`：`listRules`（回傳 14 個規則的識別、名稱、目前值與畫面單位；單次時長上限、逾時取消門檻、候補截止門檻以小時顯示，其餘為分鐘、天、筆、批、月、次）、`updateRule(admin, ruleKey, value)`（須管理員；必須為正整數，`max_duration_minutes` 還須為 30 的倍數；畫面單位換算為儲存單位；同一交易內更新 `rules` 並插入 `rule_changes`）、`listRuleChanges`；規則變更不取消也不改動既有預約（依賴 T139）
  - 📎 必讀：`contracts/openapi.yaml › listRules` — 規則列表與單位的回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › updateRule` — 修改的驗證、單位換算與 400／404 以此為準
  - 📎 必讀：`contracts/openapi.yaml › listRuleChanges` — 變更紀錄的回應以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 修改規則` — 規則與變更紀錄一起更新的交易範圍以此為準
  - 📎 必讀：`spec.md › FR-074` — 規則必須為正整數的要求以此為準
  - 📎 必讀：`spec.md › FR-075` — 規則變更只影響之後的新操作的要求以此為準
- [x] T [US12] 實作 `backend/src/routes/rules.js`：`GET /api/rules`、`GET /api/rules/changes`、`PUT /api/rules/{ruleKey}`，在 `backend/src/domain/policy.js` 補上動作 `rule:manage`（僅管理員），註冊至 `backend/src/app.js`（依賴 T140）
  - 📎 必讀：`contracts/openapi.yaml › listRules、listRuleChanges、updateRule` — 規則端點的路徑、方法與狀態碼以此為準

### 前端（UI-11）

- [x] T [US12] 實作 `frontend/src/pages/adminRulesPage.js`（`#/admin/rules`）：`admin-rules-list`／`rule-row`（名稱、目前值、單位）、`rule-edit` 開啟 `rule-input`，`rule-save`／`rule-cancel`，輸入不是正整數時顯示 `rule-input-error` 並不送出；`rule-change-log`／`rule-change-log-item` 以 `rule-change-log-load-more` 分頁
  - 📎 必讀：`contracts/ui-contract.md › UI-11 規則管理介面 › 操作` — 修改規則與查看變更紀錄的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-11 規則管理介面 › 狀態` — 載入、錯誤與驗證失敗的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-11 規則管理介面 › 文案與無障礙` — 規則管理文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/admin-rules.html › admin-rules-list` — 規則管理頁版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.RuleList` — 列表顯示的欄位與單位以此為準

**Checkpoint**：US1～US12 皆可獨立運作

---

## Phase 15：使用者故事 13 - 查看報表與匯出（Priority: P13）

**目標**：管理員依日期區間查看各場地的使用率、尖峰時段、取消率與未到場率，並匯出 CSV（UI-12、API-10）

**完成判準**：區間內 A 場地可預約 40 小時、已報到與已完成共 10 小時時，使用率顯示 25%；區間內 10 筆預約中 2 筆由預約者取消時，取消率顯示 20%；匯出的 CSV 用試算表開啟時繁體中文不亂碼，且數字與畫面一致；沒有預約的場地顯示「無資料」

### 資料庫端（DB-03、DB-02 讀取）

- [x] T [P] [US13] 實作 `backend/src/repositories/reportRepository.js` 的 `listBookingsForReport(conn, venueId, fromAt, toAt)`（開始時間落在區間內的預約，欄位為狀態、起訖時間、是否逾時取消，並以操作紀錄判定取消者是預約者或管理員）與 `listVenuesForReport(conn)`（含已停用場地，附開放時段與維護時段）
  - 📎 必讀：`data-model.dbml › Table bookings` — 報表查詢使用的欄位及索引 (venue_id, start_at) 以此為準
  - 📎 必讀：`data-model.dbml › Table booking_events` — 判定取消者身分所用的 actor_type 以此為準

### 後端（API-10）

- [x] T [P] [US13] 實作 `backend/src/domain/report.js` 的純函式 `computeReport({ venues, bookings, from, to })`：使用率＝「已報到」與「已完成」預約總分鐘數 ÷（區間內開放時段扣除維護時段的總分鐘數）；尖峰時段＝同一組預約依台北星期與整點累計占用分鐘的前 3 名；取消率＝預約者本人取消的筆數 ÷ 狀態不是「已駁回」的預約筆數（逾時取消計入並另列筆數，管理員取消不計入分子與分母）；未到場率＝「未到場」筆數 ÷「已報到」「已完成」「未到場」總筆數；分母為 0 顯示「無資料」，使用率分子為 0 且分母大於 0 顯示 0%；百分比四捨五入到小數點後 1 位，整數時不顯示小數點
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Report` — 報表回應的欄位以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Metric` — 指標值與「無資料」的表示方式以此為準
  - 📎 必讀：`spec.md › FR-077` — 四項指標的計算定義以此為準
  - 📎 必讀：`spec.md › FR-080` — 分母為 0 與 0% 的顯示規則以此為準
  - 📎 必讀：`research.md › R-14` — 報表在應用程式內以純函式計算的決定以此為準
- [x] T [P] [US13] 實作 `backend/src/domain/csv.js` 的 `toCsv(rows)`：UTF-8 並在開頭加位元組順序標記（BOM）、換行用 CRLF、欄位含逗號、雙引號或換行時以雙引號包起來並把雙引號重複一次、開頭是 `=`、`+`、`-`、`@` 的儲存格前面加單引號
  - 📎 必讀：`research.md › R-14` — CSV 的 BOM、換行與逸出規則以此為準
  - 📎 必讀：`spec.md › NFR-005` — 試算表開啟繁體中文不亂碼的要求以此為準
- [x] T [US13] 實作 `backend/src/services/reportService.js`：`getReport(admin, { from, to })`（`from`、`to` 為台北日期含頭含尾，結束早於開始回 400）與 `exportReportCsv`（`Content-Type: text/csv; charset=utf-8`、`Content-Disposition: attachment`，欄位值與畫面顯示的格式化字串相同）；審核者與一般員工不得使用（依賴 T143～T145）
  - 📎 必讀：`contracts/openapi.yaml › getReport` — 報表請求參數、回應與 400 以此為準
  - 📎 必讀：`contracts/openapi.yaml › exportReportCsv` — CSV 回應標頭與內容以此為準
  - 📎 必讀：`spec.md › FR-078` — 日期區間篩選與不合法區間的要求以此為準
  - 📎 必讀：`spec.md › FR-079` — CSV 內容與畫面一致的要求以此為準
- [x] T [US13] 實作 `backend/src/routes/reports.js`：`GET /api/reports`、`GET /api/reports/csv`，在 `backend/src/domain/policy.js` 補上動作 `report:view`（僅管理員），註冊至 `backend/src/app.js`（依賴 T146）
  - 📎 必讀：`contracts/openapi.yaml › getReport、exportReportCsv` — 報表端點的路徑、方法與狀態碼以此為準

### 前端（UI-12）

- [x] T [US13] 實作 `frontend/src/pages/adminReportsPage.js`（`#/admin/reports`）：`report-from`、`report-to`、`report-submit`；結束日期早於開始日期時不送出並提示；`report-table`／`report-row` 顯示各場地的使用率、尖峰時段、取消率（逾時取消另列）與未到場率，「無資料」照後端值顯示；`report-export-csv` 下載目前篩選的 CSV
  - 📎 必讀：`contracts/ui-contract.md › UI-12 報表介面 › 操作` — 設定區間、查看與匯出的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-12 報表介面 › 狀態` — 載入、錯誤與無資料的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-12 報表介面 › 文案與無障礙` — 報表文案與 testid 以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/admin-reports.html › report-table` — 報表頁版面以原型為參考來源
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.ReportVenue` — 每個場地一列的欄位以此為準

**Checkpoint**：所有使用者故事皆可獨立運作

---

## Phase 16：Polish 與跨領域事項

**目的**：橫跨多個故事的程式品質收尾

- [X] T149 [P] 在根目錄執行 `npm run lint` 與 `npm run format`，修正全專案問題

---

## 相依與執行順序

### 階段相依

- **Setup（Phase 1）**：無相依，可立即開始
- **Foundational（Phase 2）**：依賴 Setup 完成，阻擋所有使用者故事
- **使用者故事（Phase 3～15）**：皆依賴 Foundational 完成，之後依優先順序 P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8 → P9 → P10 → P11 → P12 → P13 執行，或有人力時並行
- **Polish（Phase 16）**：依賴所有使用者故事完成

### 使用者故事相依

- **US1（P1）**：Foundational 完成後即可開始，不依賴其他故事
- **US2（P2）**：依賴 US1 的管理員登入與角色（T035）；其餘由 Foundational 提供
- **US3（P3）**：依賴 US1 的登入與 US2 的場地資料（T042）；建立預約時需要場地、開放時段與審核者
- **US4（P4）**：依賴 US2 的場地；行事曆的已預約時段來自 US3 的預約與時段占用（T050）
- **US5（P5）**：依賴 US3 的預約建立（T057）才有事件可通知；提醒工作依賴 Foundational 的排程骨架（T021）
- **US6（P6）**：依賴 US3 的預約、狀態轉換與時段釋出（T056、T055）
- **US7（P7）**：依賴 US3 的預約、US2 的審核者與 US5 的通知（T073）
- **US8（P8）**：依賴 US3 的預約與狀態轉換、US5 的通知（暫停通知）
- **US9（P9）**：依賴 US3 的預約規則與時段占用、US6 的取消（T081）、US7 的審核（T090）
- **US10（P10）**：依賴 US6 的取消釋出時段（T055 的釋出監聽器）、US5 的通知與 US3 的預約規則
- **US11（P11）**：依賴 US2 的場地、US3 的預約與時段、US5 的通知、US10 的候補（停用時使候補失效）
- **US12（P12）**：依賴 US1 的管理員身分；規則資料表與讀取已由 Foundational 提供（T018）
- **US13（P13）**：依賴 US3 的預約、US8 的報到與未到場狀態，以及 US6 的取消紀錄

### 各故事內部順序

- 端點依序：資料庫端 → 後端 → 前端；故事未涉及的端點不列出
- 同一檔案的任務依序執行（例如 `backend/src/services/bookingService.js` 在 US3、US5、US6、US7、US8、US9 各有新增或修改，`backend/src/domain/policy.js` 在各故事各補上動作，`frontend/src/pages/bookingFormPage.js` 在 US3、US6、US9 各有修改）

### 並行機會

- Setup：T002～T006 可並行
- Foundational：T007～T014、T019、T023、T024、T026、T027 可並行
- US1 資料庫端：T029、T030 可並行
- US1 前端：T037～T039 可並行
- US3 後端：T053、T054 可並行
- US8 資料庫端：T096、T097 可並行
- US11 前端：T134、T137 可並行
- US13 後端：T144、T145 可並行
- 不同故事的不同端點可由不同人員同時進行（注意共用檔案）

---

## 並行範例：使用者故事 1

```bash
# 同時進行資料庫端：
Task: "backend/src/repositories/sessionRepository.js"
Task: "backend/src/repositories/userRepository.js"

# 同時進行前端：
Task: "frontend/src/components/nav.js"
Task: "frontend/src/pages/loginPage.js"
Task: "frontend/src/pages/changePasswordPage.js"
```

## 並行範例：使用者故事 2

```bash
# 不同端點可同時進行（共用檔案除外）：
Task: "backend/src/db/migrations/002_venues.sql"
Task: "backend/src/services/venueService.js"
Task: "frontend/src/pages/adminVenuesPage.js"
```

## 並行範例：使用者故事 3

```bash
# 同時進行後端：
Task: "backend/src/domain/bookingRules.js"
Task: "backend/src/domain/bookingStateMachine.js"
```

## 並行範例：使用者故事 4

```bash
# 不同端點可同時進行（共用檔案除外）：
Task: "backend/src/repositories/venueRepository.js"
Task: "backend/src/services/venueService.js"
Task: "frontend/src/components/calendar.js"
```

## 並行範例：使用者故事 5

```bash
# 不同端點可同時進行（共用檔案除外）：
Task: "backend/src/db/migrations/004_notifications.sql"
Task: "backend/src/services/notificationService.js"
Task: "frontend/src/lib/poller.js"
```

## 並行範例：使用者故事 6

```bash
# 不同端點可同時進行（共用檔案除外）：
Task: "backend/src/repositories/bookingRepository.js"
Task: "backend/src/services/bookingView.js"
Task: "frontend/src/components/bookingCard.js"
```

## 並行範例：使用者故事 7

```bash
# 不同端點可同時進行（共用檔案除外）：
Task: "backend/src/repositories/bookingRepository.js"
Task: "backend/src/domain/policy.js"
Task: "frontend/src/pages/reviewsPage.js"
```

## 並行範例：使用者故事 8

```bash
# 同時進行資料庫端：
Task: "backend/src/repositories/userRepository.js"
Task: "backend/src/repositories/eventRepository.js"
```

## 並行範例：使用者故事 9

```bash
# 不同端點可同時進行（共用檔案除外）：
Task: "backend/src/repositories/seriesRepository.js"
Task: "backend/src/domain/series.js"
Task: "frontend/src/pages/bookingFormPage.js"
```

## 並行範例：使用者故事 10

```bash
# 不同端點可同時進行（共用檔案除外）：
Task: "backend/src/db/migrations/005_waitlist.sql"
Task: "backend/src/services/waitlistService.js"
Task: "frontend/src/components/waitlistDialog.js"
```

## 並行範例：使用者故事 11

```bash
# 同時進行前端：
Task: "frontend/src/components/impactDialog.js"
Task: "frontend/src/pages/adminBookingsPage.js"
```

## 並行範例：使用者故事 12

```bash
# 不同端點可同時進行（共用檔案除外）：
Task: "backend/src/db/migrations/007_rule_changes.sql"
Task: "backend/src/services/ruleService.js"
Task: "frontend/src/pages/adminRulesPage.js"
```

## 並行範例：使用者故事 13

```bash
# 同時進行後端：
Task: "backend/src/domain/report.js"
Task: "backend/src/domain/csv.js"
```

---

## 實作策略

### MVP 優先（只做使用者故事 1）

1. 完成 Phase 1：Setup
2. 完成 Phase 2：Foundational（阻擋所有故事）
3. 完成 Phase 3：US1
4. **停下並驗證**：對照 US1 完成判準，以管理員身分建立員工帳號並以該員工登入，確認員工看不到管理功能
5. 可展示：管理員建立帳號、使用者登入與變更密碼

### 漸進交付

1. Setup ＋ Foundational → 基礎就緒
2. 加入 US1 → 對照完成判準 → 展示（可登入與管理帳號）
3. 加入 US2 → 對照完成判準 → 展示（可建立場地）
4. 加入 US3 → 對照完成判準 → 展示（可預約且不重疊）
5. 加入 US4 → 對照完成判準 → 展示（可篩選場地與看行事曆）
6. 加入 US5 → 對照完成判準 → 展示（有站內通知與提醒）
7. 加入 US6 → 對照完成判準 → 展示（可取消與修改）
8. 加入 US7 → 對照完成判準 → 展示（需審核場地可核准與駁回）
9. 加入 US8 → 對照完成判準 → 展示（可報到並處理未到場）
10. 加入 US9 → 對照完成判準 → 展示（可建立週期性預約）
11. 加入 US10 → 對照完成判準 → 展示（可排候補並遞補）
12. 加入 US11 → 對照完成判準 → 展示（可維護場地與管理員取消）
13. 加入 US12 → 對照完成判準 → 展示（可調整規則）
14. 加入 US13 → 對照完成判準 → 展示（可看報表與匯出）
15. Phase 16 → lint 與格式收尾

### 團隊並行策略

1. 全員完成 Setup ＋ Foundational
2. 之後依端點分工：
   - 開發者 A：各故事的資料庫端
   - 開發者 B：各故事的後端
   - 開發者 C：各故事的前端
3. 共用檔案（`bookingService.js`、`bookingRepository.js`、`policy.js`、`bookingCard.js`、`bookingFormPage.js`、`adminVenuesPage.js`、`adminUsersPage.js`）依故事順序合併

---

## 備註

- [P] 任務 = 不同檔案、無相依
- [Story] 標籤讓任務可追溯到使用者故事
- 每個使用者故事都應可獨立完成，並以完成判準確認
- 每完成一個任務或一組邏輯任務即提交
- 可在任一 Checkpoint 停下，對照完成判準確認該故事
- 避免：模糊任務、同檔案衝突、破壞獨立性的跨故事相依

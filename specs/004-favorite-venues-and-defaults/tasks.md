---
description: "我的收藏場地與常用預設值的實作任務清單"
---

# 任務：我的收藏場地與常用預設值

**[P]**：可與同段其他 [P] 任務並行（不同檔案、不依賴未完成的任務）

## 路徑慣例

- 本功能在既有專案內增修：techstack.md 套件安裝清單中 `frontend`、`backend`、`shared`、`.` 的套件與 001～003 已安裝的內容完全相同，本功能不新增執行期或建置套件；`e2e` workspace 只供驗收測試使用，不列入本清單，因此沒有 Setup 任務。
- 介面 ID（UI-01～UI-03、API-01～API-03、DB-01～DB-02）對應 plan.md「介面盤點」。
- 資料庫端任務落在 `backend/src/db/migrations/`（遷移）與 `backend/src/repositories/`（`favoriteRepository.js`、`bookingDefaultsRepository.js`）。
- 後端任務落在 `backend/src/domain/`（授權動作、時間換算）、`backend/src/services/`（收藏、場地、情境、建立預約）、`backend/src/routes/`（收藏端點）。
- 前端任務落在 `shared/src/copy.js`（文案）、`frontend/src/lib/`（分組與結束時間推導的純函式）、`frontend/src/pages/`（場地查詢與行事曆、預約表單）、`frontend/src/components/`（登記候補對話框）、`frontend/src/styles/`（樣式）。
- UI 文案、`data-testid` 與狀態一律以 `contracts/ui-contract.md` 為準，版面參考 `contracts/prototype/venues.html`、`booking-form.html`、`waitlist-dialog.js` 與 `states.html`。
- 身分只取自登入 session 的 `user.id`；所有新增與增修的端點都不接受員工編號參數（research.md R-07）。

---

## Phase 1：Foundational（阻擋性前置）

**目的**：兩個使用者故事共用的資料庫遷移——收藏場地與預約預設值兩張新表

**⚠️ 重要**：本階段完成前不得開始任何使用者故事

- [X] T001 新增 `backend/src/db/migrations/008_favorites_defaults.sql`：建立 `favorite_venues` 與 `booking_defaults` 兩張表（欄位、主鍵、索引 `ix_favorite_venues_venue`、CHECK 與三條外鍵），`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`；不修改、不回填 001～007 的任何資料表與資料列；以 `npm run migrate -w backend` 在既有資料庫執行後 `schema_migrations` 多一列 `008_favorites_defaults.sql`
  - 📎 必讀：`data-model.dbml › Table favorite_venues` — 收藏表的欄位、型別、預設值、主鍵與索引以此為準
  - 📎 必讀：`data-model.dbml › Table booking_defaults` — 預設值表的欄位、型別與主鍵以此為準
  - 📎 必讀：`data-model.dbml › Ref fk_favorite_venues_user_id、fk_favorite_venues_venue_id、fk_booking_defaults_user_id` — 外鍵名稱、參照對象與刪除政策以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 資料庫層檢查約束` — CHECK 的條件以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 遷移對既有資料的影響` — 遷移不得改動既有資料表與資料列的範圍以此為準
  - 📎 必讀：`research.md › R-02` — 遷移檔名與沿用 `migrate.js` 依檔名排序執行的決策以此為準

**Checkpoint**：基礎完成，資料庫已有 `favorite_venues` 與 `booking_defaults`，可開始實作使用者故事

---

## Phase 2：使用者故事 1 - 收藏常用場地並在預約表單置頂（Priority: P1）🎯 MVP

**目標**：員工在場地查詢結果與行事曆上加入或取消收藏（UI-01、API-01、DB-01），單次預約、週期性預約、修改預約與登記候補的場地選單先列「我的收藏」（UI-02）。

**完成判準**：員工在場地查詢結果對場地 B 按「加入收藏」後顯示「已收藏」與「已加入收藏」，在行事曆頁對場地 C 收藏效果相同；開啟新增預約表單時，場地選單先顯示「我的收藏」組（場地 B、C 依名稱排序）再顯示「其他場地」，場地欄位停在「請選擇場地」不自動選定；週期性預約與登記候補對話框的場地選單同樣分組，修改預約時場地欄位仍顯示原預約的場地；取消收藏後場地 B 回到「其他場地」；沒有任何收藏時選單與原本相同、不出現空的「我的收藏」組；場地被停用後不出現在選單，重新啟用後再度出現在「我的收藏」；對已停用場地按「加入收藏」顯示「此場地已停用，無法收藏」且狀態不變；連點兩次「加入收藏」最終仍是已收藏；另一位員工的選單不受影響。

### 資料庫端（DB-01）

- [X] T002 [P] [US1] 實作 `backend/src/repositories/favoriteRepository.js`：`add(conn, { userId, venueId, createdAt })` 以 `INSERT IGNORE INTO favorite_venues` 寫入（重複加入不報錯、不產生第二筆）、`remove(conn, { userId, venueId })` 以單一 `DELETE ... WHERE user_id = :userId AND venue_id = :venueId` 刪除（影響 0 列也視為成功）、`listVenueIds(conn, userId)` 回傳該員工收藏的場地編號 `Set`；接收 `conn`、使用具名參數，寫法與既有 `*Repository.js` 相同；`createdAt` 由呼叫端帶入，不使用 `NOW()`
  - 📎 必讀：`data-model.dbml › Table favorite_venues` — 欄位名稱與主鍵以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 加入收藏（addFavoriteVenue）、取消收藏（removeFavoriteVenue）` — 兩個寫入語句、交易範圍與失敗處理以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 讀取收藏與預設值（searchVenues、getVenueCalendar、getContext）` — 讀取不開交易、單一 SELECT 的做法以此為準
  - 📎 必讀：`research.md › R-02` — repository 的函式清單與寫法以此為準

### 後端（API-01）

- [X] T003 [P] [US1] 在 `backend/src/domain/policy.js` 的 `can()` 新增動作 `favorite:manage`：對所有已登入且啟用中的使用者回傳 `true`，寫法與既有其他動作相同
  - 📎 必讀：`research.md › R-07` — 授權動作名稱與適用對象以此為準
  - 📎 必讀：`spec.md › NFR-002` — 只能讀寫自己的收藏的要求以此為準
- [X] T004 [US1] 新增 `backend/src/services/favoriteService.js`：`addFavorite(user, venueId)` 先檢查 `can(user, "favorite:manage")`，讀取場地，不存在丟 `HttpError(404)`，已停用丟 `HttpError(409, "此場地已停用，無法收藏。", { violations: [{ rule: "venue_inactive", ... }] })`，其餘呼叫 `favoriteRepository.add` 並回傳 `{ venueId, isFavorite: true }`；`removeFavorite(user, venueId)` 不檢查場地狀態，呼叫 `favoriteRepository.remove` 並回傳 `{ venueId, isFavorite: false }`；身分只取自 `user.id`（依賴 T002、T003）
  - 📎 必讀：`contracts/openapi.yaml › addFavoriteVenue › responses 200／404／409／500` — 加入收藏各狀態碼的觸發條件、訊息與回應本文以此為準
  - 📎 必讀：`contracts/openapi.yaml › removeFavoriteVenue › responses` — 取消收藏一律成功、不檢查場地狀態的規則與回應本文以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.FavoriteState` — 成功回應的欄位與型別以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Violation` — `venue_inactive` 違規項目的結構以此為準
  - 📎 必讀：`research.md › R-03` — 冪等語意與停用場地處理的決策以此為準
- [X] T005 [US1] 在 `backend/src/routes/venues.js` 註冊 `PUT /api/venues/:venueId/favorite`（呼叫 `favoriteService.addFavorite`）與 `DELETE /api/venues/:venueId/favorite`（呼叫 `favoriteService.removeFavorite`），兩者以 `requireAuth` 包住、成功回 200；路徑參數 `venueId` 轉為數字，不接受員工編號參數（依賴 T004）
  - 📎 必讀：`contracts/openapi.yaml › addFavoriteVenue、removeFavoriteVenue › parameters` — 路徑參數名稱與型別以此為準
  - 📎 必讀：`research.md › R-03` — 端點放在既有 `routes/venues.js` 的決策以此為準
  - 📎 必讀：`research.md › R-07` — 身分只取自 session、不接受員工編號的要求以此為準
- [X] T006 [US1] 在 `backend/src/services/venueService.js` 的 `searchVenues` 與 `getVenueCalendar` 回應中，每個場地（行事曆為 `venue`）多帶 `isFavorite`：以 `favoriteRepository.listVenueIds(conn, user.id)` 取得集合比對；查詢收藏失敗時以 `try/catch` 記錄錯誤並整個省略 `isFavorite` 欄位（不是 `false`），其餘回應照常；不改變既有篩選與排序（依賴 T002）
  - 📎 必讀：`contracts/openapi.yaml › searchVenues、getVenueCalendar` — `isFavorite` 的位置、只回傳啟用中場地、讀取失敗時省略欄位的規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Venue、Calendar` — 場地與行事曆回應中 `isFavorite` 的型別與選用性以此為準
  - 📎 必讀：`research.md › R-06` — 讀取降級時省略欄位、後端以 `try/catch` 包住查詢的決策以此為準
  - 📎 必讀：`spec.md › FR-006` — 停用場地不出現、重新啟用後恢復的需求以此為準

### 前端（UI-01、UI-02）

- [X] T007 [P] [US1] 在 `shared/src/copy.js` 新增 `FAVORITE_TEXT`：收藏按鈕、處理中、收藏標記、停用標籤、加入與取消成功提示、停用場地拒絕提示、加入與取消失敗提示、收藏按鈕無障礙名稱，以及場地選單的「請選擇場地」佔位、「請選擇場地。」必填、「我的收藏」「其他場地」組名與「收藏載入失敗」提示
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 文案與無障礙` — 收藏操作的全部文案原文以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 文案與無障礙` — 場地選單佔位、必填、組名與收藏載入失敗的文案原文以此為準
- [X] T008 [P] [US1] 新增 `frontend/src/lib/venueGroups.js`：純函式 `groupVenues(venues)` 回傳 `{ favorites, others }`，`favorites` 為 `isFavorite === true` 的場地並以 `localeCompare(其他, "zh-Hant")` 依名稱排序，`others` 為其餘場地且維持輸入順序；輸入中沒有任何場地帶 `isFavorite` 欄位時（收藏載入失敗）回傳 `{ favorites: [], others: venues, favoritesUnavailable: true }`
  - 📎 必讀：`research.md › R-04` — 分組規則、排序方式與分組放在前端的決策以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 狀態` — 成功、錯誤（收藏載入失敗退回不分組）時選單的呈現以此為準
  - 📎 必讀：`spec.md › FR-003、FR-004` — 收藏區排序與沒有收藏時不顯示收藏區的需求以此為準
- [X] T009 [P] [US1] 在 `frontend/src/styles/components.css` 新增收藏標記（`venue-favorite-mark`）、收藏按鈕與處理中、停用標籤（`venue-favorite-disabled-tag`）的樣式；畫面寬度 360 像素時場地卡與行事曆頁頭不得需要水平捲動
  - 📎 必讀：`contracts/prototype/venues.html › venue-favorite-mark、venue-favorite-toggle、venue-favorite-disabled-tag` — 收藏標記、按鈕與停用標籤的版面以此為準
  - 📎 必讀：`spec.md › NFR-003` — 360 像素不得水平捲動的要求以此為準
- [X] T010 [US1] 在 `frontend/src/pages/venuesPage.js` 的場地查詢結果（每張 `venue-list-item`）與行事曆頁頭加入收藏標記與按鈕（`venue-favorite-toggle`、`calendar-favorite-toggle`）：依回應的 `isFavorite` 顯示「加入收藏」或「取消收藏」與 `aria-pressed`；按下時以 `put` 或 `del` 呼叫 `/api/venues/:venueId/favorite`，處理中停用按鈕、顯示「處理中…」並設 `aria-busy="true"`；成功依回應更新標記並以 `app-toast` 顯示成功提示；409 `venue_inactive` 時顯示停用場地拒絕提示、標示「已停用」並停用「加入收藏」；其他失敗顯示失敗提示且標記不變；回應省略 `isFavorite` 時不顯示收藏按鈕（依賴 T007、T009）
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 操作` — 每個收藏操作的互動與需要內層提供的資料以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 狀態` — 成功、載入、空狀態與錯誤時收藏按鈕的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 文案與無障礙 › 收藏按鈕無障礙名稱、結果播報、處理中無障礙` — `aria-pressed`、`role` 與 `aria-busy` 的用法以此為準
  - 📎 必讀：`contracts/openapi.yaml › addFavoriteVenue、removeFavoriteVenue` — 呼叫的方法、路徑與各狀態碼回應以此為準
  - 📎 必讀：`contracts/prototype/venues.html › venue-favorite-toggle、calendar-favorite-toggle` — 查詢結果與行事曆上按鈕的位置以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 1～2、5、9～10` — 加入、取消、連點與停用場地拒絕的情境以此為準
- [X] T011 [US1] 在 `frontend/src/pages/bookingFormPage.js` 建立場地 `<select>`（`booking-venue`）時呼叫 `groupVenues`：`favorites` 非空才加入 `<optgroup label="我的收藏">`，其後加入 `<optgroup label="其他場地">`，`favorites` 為空時不建立任何 `<optgroup>`；新增預約與週期性預約時第一個選項為「請選擇場地」佔位、未選場地送出時顯示「請選擇場地。」；不因收藏設定 `selected`，預選沿用既有 `preVenue`（路由參數）；修改預約時仍選定原預約的場地；再預約模式維持 `rebookVenueChoices` 單一選項、不分組；`favoritesUnavailable` 時在表單頂部顯示 `booking-favorites-error` 提示並以一般順序列出場地（依賴 T007、T008）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 操作` — 四種表單情境下場地選單的分組與預選規則以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 狀態` — 成功、載入、空狀態與收藏載入失敗時表單的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 文案與無障礙 › 分組無障礙、欄位無障礙` — `<optgroup label>` 與欄位錯誤的無障礙寫法以此為準
  - 📎 必讀：`contracts/prototype/booking-form.html › booking-favorites-error` — 收藏載入失敗提示的位置以此為準
  - 📎 必讀：`research.md › R-04` — 分組與預選沿用 `preVenue`、再預約不分組的決策以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 3～4、6～7、11～12` — 選單置頂、不自動選定、空收藏、停用場地、週期性與修改預約的情境以此為準
- [X] T012 [US1] 在 `frontend/src/components/waitlistDialog.js` 建立場地 `<select>`（`waitlist-register-venue`）時呼叫 `groupVenues`，套用與 T011 相同的分組規則：`favorites` 非空才加「我的收藏」組、不因收藏設定 `selected`，預選仍沿用既有 `pre.venueId`；其餘候補流程不變（依賴 T007、T008）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 操作 › 週期性預約與登記候補使用同樣的分組` — 登記候補對話框的分組規則以此為準
  - 📎 必讀：`contracts/prototype/waitlist-dialog.js › waitlist-register-venue` — 對話框中場地選單的呈現以此為準
  - 📎 必讀：`research.md › R-04` — 候補對話框共用 `groupVenues` 與保留既有預選的決策以此為準
  - 📎 必讀：`spec.md › FR-003` — 登記候補場地選單須置頂收藏的需求以此為準

**Checkpoint**：使用者故事 1 完成，對照完成判準在執行中的應用程式內操作確認

---

## Phase 3：使用者故事 2 - 預約表單預填上次的人數與時長（Priority: P2）

**目標**：員工成功建立單次預約後記住人數與時長（API-03、DB-02），一般開啟單次預約表單時由預約情境取得（API-02）並預填人數、選定開始時間後依時長帶出結束時間（UI-03）。

**完成判準**：員工成功預約 6 人、10:00–11:30 後，再開啟新增預約表單，人數已是 6 並顯示「已帶入上次預約的人數，可自行修改。」，日期、場地、主題與起訖時間仍為空；選開始時間 14:00 後結束時間自動帶出 15:30 並顯示帶出說明；手動把結束時間改為 16:00 送出成立後，下次帶出的時長為 2 小時；選擇開放到 18:00 的場地並選 17:30 開始時，結束時間不自動帶出並顯示套不上說明；時長上限被調降到低於記住的時長時，人數照常預填、結束時間不帶出；預約因時段被占用被拒絕、修改既有預約、取消預約、建立週期性預約或確認候補遞補之後，記住的值都不改變；從未預約的員工開啟表單時人數與結束時間都不預填；「再預約一次」表單的人數取自來源預約、結束時間不帶出；勾選「重複預約」時預填的人數與結束時間被清回初始狀態，取消勾選後恢復；兩位員工各自看到自己的人數。

### 資料庫端（DB-02）

- [X] T013 [P] [US2] 實作 `backend/src/repositories/bookingDefaultsRepository.js`：`upsert(conn, { userId, attendees, durationMinutes, updatedAt })` 以單一 `INSERT INTO booking_defaults ... ON DUPLICATE KEY UPDATE attendees = VALUES(attendees), duration_minutes = VALUES(duration_minutes), updated_at = VALUES(updated_at)` 寫入、`findByUser(conn, userId)` 回傳 `{ attendees, durationMinutes }` 或 `null`；接收 `conn`、使用具名參數；`updatedAt` 由呼叫端帶入，不使用 `NOW()`
  - 📎 必讀：`data-model.dbml › Table booking_defaults` — 欄位名稱、主鍵與 `duration_minutes` 的單位以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 建立單次預約後更新預設值（createBooking 的預設值寫入）` — 取代式寫入語句、獨立連線與併發時最後寫入者勝出的行為以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 讀取收藏與預設值（searchVenues、getVenueCalendar、getContext）` — 讀取不開交易、單一 SELECT 的做法以此為準
  - 📎 必讀：`research.md › R-02` — repository 的函式清單與寫法以此為準

### 後端（API-02、API-03）

- [X] T014 [P] [US2] 在 `backend/src/services/contextService.js` 的 `getContext` 回應新增 `bookingDefaults`：以 `bookingDefaultsRepository.findByUser(conn, user.id)` 取得，從未建立預約為 `null`；查詢失敗時以 `try/catch` 記錄錯誤並整個省略 `bookingDefaults` 欄位（不是 `null`），其餘欄位照常回傳；只回傳目前登入者本人的值（依賴 T013）
  - 📎 必讀：`contracts/openapi.yaml › getContext › responses` — `bookingDefaults` 為 `null`、為物件與被省略三種情形的規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Context、BookingDefaults` — 回應欄位名稱、型別與選用性以此為準
  - 📎 必讀：`research.md › R-06` — 預設值放在 `GET /api/context`、讀取降級時省略欄位的決策以此為準
  - 📎 必讀：`spec.md › FR-012、NFR-002` — 從未預約不預填與只能讀取本人預設值的需求以此為準
- [X] T015 [P] [US2] 在 `backend/src/domain/bookingRules.js` 匯出既有的 `timeToMinute`（`export function timeToMinute`），讓預設值的時長換算沿用同一個函式；既有呼叫與行為不變
  - 📎 必讀：`research.md › R-05` — 時長換算沿用 `bookingRules.js` 既有時間換算、不另寫的決策以此為準
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — 時長為 `endTime` 減 `startTime` 的分鐘數、`24:00` 以 1440 計的定義以此為準
- [X] T016 [US2] 在 `backend/src/services/bookingService.js` 的 `createBooking`：預約寫入交易成功提交並取得新預約之後、回傳之前，以 `durationMinutes = timeToMinute(endTime) - timeToMinute(startTime)` 與本次的 `attendees`，在獨立的 `withTransaction` 中呼叫 `bookingDefaultsRepository.upsert`；以 `try/catch` 包住，寫入失敗只記錄錯誤、仍回傳已成立的預約；預約被拒絕（提交前就拋出）時不執行此步驟；不修改 `updateBooking`、取消預約、`seriesService.createBookingSeries` 與 `waitlistService` 的確認遞補流程（依賴 T013、T015）
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — 預設值更新的時機、內容、失敗不影響預約與重複送出的規則以此為準
  - 📎 必讀：`research.md › R-05` — 只在 `createBooking` 提交後寫入、其他流程自然不更新的決策與已知限制以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 建立單次預約後更新預設值（createBooking 的預設值寫入）` — 預設值寫入與預約交易分開的交易邊界以此為準
  - 📎 必讀：`spec.md › FR-008、FR-009、NFR-001` — 哪些情形更新、哪些情形不得更新，以及寫入失敗不得影響預約的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 2 › 驗收情境 4、8、10～11、13、15` — 手動修改後更新、被拒絕不更新、再預約更新、修改與週期性不更新、重複送出的情境以此為準

### 前端（UI-03）

- [X] T017 [P] [US2] 在 `shared/src/copy.js` 新增 `DEFAULTS_TEXT`：人數預填說明、結束時間帶出說明（含時長參數）、時長格式函式（「{N} 小時」「{N} 小時 {M} 分鐘」「{M} 分鐘」）、套不上說明、預設值載入失敗提示，以及「開始與結束時間佔位選項」
  - 📎 必讀：`contracts/ui-contract.md › UI-03 › 文案與無障礙` — 預填相關的全部文案原文與時長格式以此為準
- [X] T018 [P] [US2] 新增 `frontend/src/lib/defaults.js`：純函式 `deriveEndTime({ startTime, durationMinutes, maxDurationMinutes, openingHours })` 以整數分鐘計算 `end = start + durationMinutes`，回傳 `HH:mm`（1440 回傳 `24:00`）；`durationMinutes` 為空、大於 `maxDurationMinutes`、`end` 超過 1440，或開始到結束不完全落在 `openingHours`（所選場地在所選日期星期的開放區間）任一區間內時回傳 `null`，不截短
  - 📎 必讀：`research.md › R-06` — 推導規則、不截短與開放時段來源的決策以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.OpeningHour、RuleValues` — `openingHours` 的欄位與 `maxDurationMinutes` 的來源與單位以此為準
  - 📎 必讀：`spec.md › FR-011、FR-014` — 依時長帶出與套不上時不帶出的需求以此為準
- [X] T019 [US2] 在 `frontend/src/pages/bookingFormPage.js` 加入預填：只在新增單次預約模式（非 `editId`、非 `rebookMode`）時，以 `GET /api/context` 的 `bookingDefaults.attendees` 預填 `booking-attendees` 並顯示 `booking-attendees-hint`；從未預約時不預填、起訖時間維持 001 的初始值（開始 09:00、結束 09:30）；有預約紀錄時開始與結束時間為「請選擇」；選定或更換開始時間、場地或日期時呼叫 `deriveEndTime`，非 `null` 才寫入 `booking-end` 並顯示 `booking-end-hint` 帶出說明，`null` 時顯示套不上說明；員工手動改過人數或結束時間後標記為已手動修改，之後不再覆蓋；勾選 `booking-recurring-toggle` 時把尚未手動修改的預填人數與帶出的結束時間清回初始狀態，取消勾選時重新預填與帶出；網址已帶入起訖（行事曆「預約此時段」）時以帶入值為準、不套用時長但人數仍預填；`bookingDefaults` 為 `null` 時不預填；回應省略 `bookingDefaults` 時在表單頂部顯示 `booking-defaults-error` 並視同從未預約；修改與再預約模式不使用預設值（依賴 T017、T018）
  - 📎 必讀：`contracts/ui-contract.md › UI-03 › 操作` — 預填、帶出、手動修改、勾選重複、修改與再預約不使用預填、載入失敗降級的互動以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-03 › 狀態` — 成功、載入、空狀態與錯誤時人數與結束時間的呈現以此為準
  - 📎 必讀：`contracts/openapi.yaml › getContext` — `bookingDefaults` 三種情形的判讀方式以此為準
  - 📎 必讀：`contracts/prototype/booking-form.html › booking-attendees-hint、booking-end-hint、booking-defaults-error、booking-recurring-toggle` — 說明文字與錯誤提示的位置以此為準
  - 📎 必讀：`research.md › R-06` — 只在新增單次預約模式預填、勾選重複時清除、手動修改優先的決策以此為準
  - 📎 必讀：`spec.md › FR-010、FR-013、FR-015、FR-016` — 預填人數、預填值違規仍由送出時拒絕、再預約與其他表單不使用預設值的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 2 › 驗收情境 1～3、5～7、9、12、14` — 預填、帶出、套不上、再預約、各員工獨立與其他表單不預填的情境以此為準

**Checkpoint**：使用者故事 2 完成，對照完成判準在執行中的應用程式內操作確認

---

## Phase 4：Polish 與跨領域事項

**目的**：全專案程式品質收尾

- [X] T020 執行 `npm run lint` 與 `npm run format`，修正全專案問題

---

## 相依與執行順序

### 階段相依

- **Foundational（Phase 1）**：無相依，可立即開始；阻擋所有使用者故事
- **使用者故事（Phase 2～3）**：皆依賴 Foundational 完成，之後依優先順序 P1 → P2 執行，或有人力時並行
- **Polish（Phase 4）**：依賴所有使用者故事完成

### 使用者故事相依

- **US1（P1）**：只依賴 Foundational 的 T001；不依賴 US2
- **US2（P2）**：只依賴 Foundational 的 T001；不依賴 US1，可與 US1 並行，但與 US1 共用 `shared/src/copy.js`、`frontend/src/pages/bookingFormPage.js`

### 各故事內部順序

- 端點依序：資料庫端 → 後端 → 前端；故事未涉及的端點不列出
- 同一檔案的任務依序執行（`shared/src/copy.js`：T007 → T017；`frontend/src/pages/bookingFormPage.js`：T011 → T019）

### 並行機會

- Foundational：T001 單獨執行
- US1 資料庫端與後端：T002、T003
- US1 前端：T007、T008、T009
- US2 資料庫端與後端：T013、T014、T015（T014 待 T013 完成後即可與 T015 並行）
- US2 前端：T017、T018
- 不同故事的不同端點可由不同人員同時進行（注意共用檔案）

---

## 並行範例：使用者故事 1

```bash
# 資料庫端與授權：
Task: "實作 backend/src/repositories/favoriteRepository.js 的 add、remove、listVenueIds"
Task: "在 backend/src/domain/policy.js 新增 favorite:manage"

# 前端基礎：
Task: "在 shared/src/copy.js 新增 FAVORITE_TEXT"
Task: "新增 frontend/src/lib/venueGroups.js 的 groupVenues"
Task: "在 frontend/src/styles/components.css 新增收藏標記與按鈕樣式"
```

## 並行範例：使用者故事 2

```bash
# 後端（T013 完成後）：
Task: "在 backend/src/services/contextService.js 的 getContext 帶出 bookingDefaults"
Task: "在 backend/src/domain/bookingRules.js 匯出 timeToMinute"

# 前端基礎：
Task: "在 shared/src/copy.js 新增 DEFAULTS_TEXT"
Task: "新增 frontend/src/lib/defaults.js 的 deriveEndTime"
```

---

## 實作策略

### MVP 優先（只做使用者故事 1）

1. 完成 Phase 1：Foundational（阻擋所有故事）
2. 完成 Phase 2：US1
3. **停下並驗證**：對照 US1 完成判準，在場地查詢與行事曆上加入、取消收藏，再開新增預約、週期性預約、修改預約與登記候補，確認場地選單的「我的收藏」組
4. 可展示：員工收藏常用場地後，所有能選場地的地方都先列出自己的收藏

### 漸進交付

1. Foundational → 基礎就緒
2. 加入 US1 → 對照完成判準 → 展示（收藏與選單置頂）
3. 加入 US2 → 對照完成判準 → 展示（開表單人數已填好、選開始時間就帶出結束時間）
4. Phase 4 → 全專案 lint 與 format 收尾

### 團隊並行策略

1. 全員完成 Foundational
2. 之後依端點分工：

- 開發者 A：資料庫端與後端（T002～T006、T013～T016）
- 開發者 B：前端（T007～T012、T017～T019）

3. 共用檔案（`shared/src/copy.js`、`frontend/src/pages/bookingFormPage.js`）依故事順序合併

---

## 備註

- [P] 任務 = 不同檔案、無相依
- [Story] 標籤讓任務可追溯到使用者故事
- 每個使用者故事都應可獨立完成，並以完成判準確認
- 每完成一個任務或一組邏輯任務即提交
- 可在任一 Checkpoint 停下，對照完成判準確認該故事
- 避免：模糊任務、同檔案衝突、破壞獨立性的跨故事相依

---
description: "參與者邀請與出席回覆的實作任務清單"
---

# 任務：參與者邀請與出席回覆

**[P]**：可與同段其他 [P] 任務並行（不同檔案、不依賴未完成的任務）

## 路徑慣例

- 本功能在既有專案內增修：techstack.md 套件安裝清單中 `frontend`、`backend`、`shared`、`.` 的套件與 001～004 已安裝的內容完全相同，本功能不新增執行期或建置套件；`e2e` workspace 只供驗收測試使用，不列入本清單，因此沒有 Setup 任務。
- 介面 ID（UI-01～UI-04、API-01～API-05、DB-01～DB-02）對應 plan.md「介面盤點」。
- 資料庫端任務落在 `backend/src/db/migrations/`（遷移）與 `backend/src/repositories/`（`invitationRepository.js`、`notificationRepository.js`）。
- 後端任務落在 `backend/src/domain/`（授權動作、出席統計）、`backend/src/lib/`（錯誤回應）、`backend/src/services/`（邀請、通知、建立與修改預約、狀態轉換、停用帳號）、`backend/src/routes/`（`invitations.js`，路由檔由 `app.js` 依檔名自動載入，不需另行註冊）、`backend/src/jobs/`（受邀者提醒，由 `server.js` 匯入）。
- 前端任務落在 `shared/src/copy.js`（通知文案與畫面文案）、`frontend/src/lib/`（受邀 Email 解析）、`frontend/src/pages/`（預約表單、我的邀請、通知）、`frontend/src/components/`（受邀者面板、預約卡片、導覽列）、`frontend/src/router.js`（我的邀請路由）、`frontend/src/styles/`（樣式）。
- UI 文案、`data-testid` 與狀態一律以 `contracts/ui-contract.md` 為準，版面參考 `contracts/prototype/booking-form.html`、`invitations.html`、`bookings.html`、`notifications.html` 與 `states.html`。
- 身分只取自登入 session 的 `user.id`；所有新增與增修的端點都不接受員工編號參數（research.md R-11）。
- 邀請狀態（`pending`、`active`、`invalid`）、回覆狀態（`none`、`accepted`、`declined`）與預約狀態代碼是三組互相獨立的代碼，不得混用（data-model.dbml、openapi.yaml 的 `InvitationStatus`、`InvitationResponse`、`BookingStatus`）。
- `backend/src/services/invitationService.js` 由多個故事依序增修同一個檔案，依 T008 → T009 → T017 → T028 → T034 → T035 → T039 的順序執行。

---

## Phase 1：Foundational（阻擋性前置）

**目的**：多個使用者故事共用的資料庫遷移、通知基礎、邀請資料存取與授權動作

**⚠️ 重要**：本階段完成前不得開始任何使用者故事

- [X] T001 新增 `backend/src/db/migrations/009_invitations.sql`：建立 `booking_invitations`（含 STORED 產生欄位 `live_user_id`、`UNIQUE (booking_id, live_user_id)`、索引 `ix_invitations_invitee`、`ix_invitations_booking`、`ix_invitations_reminder`、各欄位 CHECK 與組合 CHECK、兩條外鍵、`BEFORE UPDATE` 觸發器 `trg_booking_invitations_status_guard`）；再對 `notifications` 新增 `invitation_id` 欄位、外鍵 `fk_notifications_invitation_id` 與索引 `ix_notifications_invitation`，並以 `DROP CHECK chk_notifications_type, ADD CONSTRAINT chk_notifications_type CHECK (...)` 擴充為十四種類型；先建 `booking_invitations` 再改 `notifications`；`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`；不回填、不修改 001～008 既有資料列；以 `npm run migrate -w backend` 在既有資料庫執行後 `schema_migrations` 多一列 `009_invitations.sql`
  - 📎 必讀：`data-model.dbml › Table booking_invitations` — 邀請表的欄位、型別、預設值、產生欄位與索引以此為準
  - 📎 必讀：`data-model.dbml › Table notifications` — 通知表新增的 `invitation_id` 欄位與索引、type 清單以此為準
  - 📎 必讀：`data-model.dbml › Ref fk_booking_invitations_booking_id、fk_booking_invitations_invitee_user_id、fk_notifications_invitation_id` — 外鍵名稱、參照對象與刪除政策以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 資料庫層檢查約束` — 各 CHECK 與組合 CHECK 的條件以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 邀請狀態轉換的資料庫層保證` — 觸發器的條件與訊息以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 同一預約同一受邀者的唯一性與失效後重新邀請` — 產生欄位與唯一鍵的寫法以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 遷移對既有資料的影響` — 遷移順序、不得改動既有資料與回復方式以此為準
  - 📎 必讀：`research.md › R-02、R-03` — 遷移檔名、沿用 `migrate.js` 的機制與已知限制以此為準
- [X] T002 [P] 在 `backend/src/repositories/notificationRepository.js` 的 `insert` 新增選用欄位 `invitation_id`（寫入 `notifications.invitation_id`，沒有則為 `NULL`），讓 `listByUser` 回傳的列帶出 `invitation_id`；其餘寫法與具名參數不變
  - 📎 必讀：`data-model.dbml › Table notifications` — `invitation_id` 欄位的意義與可為空以此為準
  - 📎 必讀：`research.md › R-03` — 通知連結邀請的決策以此為準
- [X] T003 [P] 新增 `backend/src/repositories/invitationRepository.js`：`insert`、`lockById`（`SELECT ... FOR UPDATE`）、`lockByBooking`（依 `id` 由小到大 `FOR UPDATE`）、`listByInvitee`（連接預約、場地與預約者，只含 `active` 與 `invalid`，依 `bookings.start_at`、`id` 升冪）、`findDetail`、`listByBooking`（連接受邀者姓名與 Email，依 `id` 升冪）、`findLiveByBookingAndUsers`、`updateResponse`、`markInvalid`、`markInvalidByInvitee`（依 `id` 由小到大鎖定 `pending` 與 `active` 後改為 `invalid`）、`activate`、`resetResponse`、`setPendingChange`、`clearPendingChange`、`markReminderSent`；接收 `conn`、使用具名參數、時間由呼叫端帶入不使用 `NOW()`，寫法與既有 `*Repository.js` 相同
  - 📎 必讀：`data-model.dbml › Table booking_invitations` — 欄位名稱、狀態與回覆代碼、失效原因與索引以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界` — 各寫入與鎖定語句、讀取不開交易的做法以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 鎖定順序` — 先鎖預約列、再依 id 由小到大鎖邀請列的順序以此為準
  - 📎 必讀：`research.md › R-02` — repository 的函式清單與寫法以此為準
- [X] T004 在 `backend/src/services/notificationService.js` 的 `notify` 新增選用參數 `invitationId`（傳給 `notificationRepository.insert`），並讓 `listNotifications` 的每筆回應多帶 `invitationId`（邀請相關通知為邀請編號，其餘為 `null`）（依賴 T002）
  - 📎 必讀：`contracts/openapi.yaml › listNotifications、markNotificationRead` — 通知列表與標為已讀的回應以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Notification、NotificationList` — `invitationId` 與五種新類型的欄位以此為準
  - 📎 必讀：`research.md › R-03` — `notify` 新增 `invitationId` 與通知文案固化的決策以此為準
- [X] T005 [P] 在 `shared/src/copy.js` 的 `notificationTemplates` 新增五個文案函式 `invitation_received`、`invitation_changed`、`invitation_cancelled`、`invitation_removed`、`invitation_reminder`，內容與參數依 UI-04 的通知內容文案（邀請含預約者姓名、場地、日期、起訖時間、主題；變更分時間變更與只換場地兩種；取消含原因可省略；移出邀請；提醒含預約者姓名、主題、場地、開始時間）
  - 📎 必讀：`contracts/ui-contract.md › UI-04 › 文案與無障礙` — 五種通知內容的文案原文以此為準
  - 📎 必讀：`contracts/openapi.yaml › x-invitation-side-effects、x-background-jobs` — 每種通知的發送條件與帶入的資料以此為準
  - 📎 必讀：`research.md › R-03` — 五種通知類型名稱與文案落在 `notificationTemplates` 的決策以此為準
- [X] T006 [P] 在 `backend/src/domain/policy.js` 的 `can()` 新增動作 `invitation:respond`（所有已登入且啟用中的使用者回傳 `true`）與 `invitation:manage`（有資源時等同 `isOwner`，管理員不例外，與 `booking:update` 同一寫法）
  - 📎 必讀：`research.md › R-11` — 兩個授權動作的名稱與適用對象以此為準
  - 📎 必讀：`spec.md › NFR-006` — 只能讀寫自己的邀請與自己預約的名單的要求以此為準
- [X] T007 [P] 在 `backend/src/lib/http.js` 的 `sendError` 新增輸出 `extra.reason` 與 `extra.inviteeProblems`（有值才輸出，其他欄位不變）
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Error` — 錯誤回應新增的 `reason`、`inviteeProblems` 欄位以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.InviteReason、InviteeProblem` — 兩個欄位的代碼與項目結構以此為準

**Checkpoint**：基礎完成，資料庫已有 `booking_invitations` 與新的通知類型，可開始實作使用者故事

---

## Phase 2：使用者故事 1 - 預約時邀請同事（Priority: P1）🎯 MVP

**目標**：員工建立單次預約時填入同事 Email（UI-01、API-03），預約成立後每位同事在站內收到邀請通知（UI-04）；需審核的場地核准後才發送。

**完成判準**：員工預約不需審核的場地並填入兩位啟用中同事的 Email 後，預約為「已確認」、結果面板顯示已發送邀請給 2 位同事，兩位同事的通知列表各多一則「收到邀請」通知（含預約者姓名、場地、日期、起訖時間與主題）；填入查無帳號、已停用、自己的 Email 時預約不成立，畫面列出有問題的 Email 與原因且表單內容保留，有效 Email 的同事也沒有收到邀請；大小寫不同的同一 Email 只收到一則邀請；需審核場地送出後預約為「待審核」、同事此時沒有通知，審核者核准後同事才收到邀請，駁回後從未收到；再預約表單與勾選「重複預約」後的表單沒有邀請欄位的內容。

### 後端（API-03）

- [X] T008 [US1] 新增 `backend/src/services/invitationService.js`：`resolveInvitees(conn, { emails, bookerId, existingUserIds })` 以 `userRepository.normalizeEmail` 正規化並去重、以 `userRepository.findByEmail` 查詢，回傳 `{ invitees, problems }`，`problems` 每項為 `{ email, reason, message }`（`not_found` 查無帳號、`inactive` 帳號已停用、`self` 不能邀請自己、`already_invited` 已在受邀名單中，後者只在 `existingUserIds` 含該帳號時出現）；`createInvitations(conn, { booking, venue, organizer, invitees, now })` 為每位受邀者呼叫 `invitationRepository.insert`：預約 `confirmed` 時建立 `active`、`response = none`、`notified_at = now` 並呼叫 `notify` 寫入 `invitation_received`（帶 `invitationId`），預約 `pending` 時建立 `pending` 且不通知（依賴 T003、T004、T005）
  - 📎 必讀：`contracts/openapi.yaml › createBooking › requestBody、responses 201／400` — 受邀 Email 的驗證順序、錯誤項目與 201 回應的 `inviteeCount` 以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.InviteeProblem、InviteReason` — 有問題項目的欄位與原因代碼以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 建立單次預約並建立邀請（createBooking）` — 邀請與預約同一交易、待發送與有效的寫入條件以此為準
  - 📎 必讀：`research.md › R-04` — 驗證在占用時段之前、Email 正規化與不比對人數的決策以此為準
  - 📎 必讀：`spec.md › FR-002、FR-003、FR-005` — 驗證規則、發送內容與不受人數限制的需求以此為準
- [X] T009 [US1] 在 `backend/src/services/invitationService.js` 新增 `onBookingConfirmed(conn, { bookingId, now })`：取得預約與場地名稱、預約者姓名，將該預約 `status = pending` 的邀請（`lockByBooking` 鎖定後）改為 `active`、`response = none`、`notified_at = now` 並寫入 `invitation_received`；沒有待發送的邀請時不做事（依賴 T008）
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 核准預約並發送邀請（approveBooking）` — 核准後發送邀請的寫入與鎖定順序以此為準
  - 📎 必讀：`contracts/openapi.yaml › x-invitation-side-effects › approveBooking` — 核准時邀請與通知的副作用以此為準
  - 📎 必讀：`research.md › R-05` — 掛在 `transition` 的 `confirmed` 目標狀態、鎖定順序的決策以此為準
  - 📎 必讀：`spec.md › FR-004` — 待審核期間不通知、核准後才發送的需求以此為準
- [X] T010 [US1] 在 `backend/src/services/bookingService.js` 的 `createBooking`：讀取 `input.inviteeEmails`（選填字串陣列），在既有交易內、占用時段之前呼叫 `invitationService.resolveInvitees`；`problems` 非空時丟 `HttpError(400, "預約沒有成立。…請修正或移除後再送出。", { inviteeProblems, fields: [{ field: "inviteeEmails", … }] })`，整個交易回滾；預約寫入後呼叫 `createInvitations`；回應多帶 `inviteeCount`（去重後的受邀人數，沒有受邀者為 0）；不修改 `updateBooking`、`seriesService.createBookingSeries` 與候補遞補確認，它們不讀取 `inviteeEmails`（依賴 T007、T008）
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — 驗證步驟、同時有規則違反時的合併回應與預約被拒絕不留邀請的規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.BookingInput、Booking` — `inviteeEmails` 與 `inviteeCount` 的型別與選用性以此為準
  - 📎 必讀：`research.md › R-04` — 邀請在建立預約的同一交易內建立、其他入口不讀取的決策以此為準
  - 📎 必讀：`spec.md › NFR-001` — 預約與受邀名單同進同退、重複送出不產生重複邀請的要求以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 1～12、15` — 建立、驗證失敗、去重、待審核、不受人數與衝突限制、重複送出的情境以此為準
- [X] T011 [US1] 在 `backend/src/services/bookingTransition.js` 的 `transition`：目標狀態為 `confirmed`、預約狀態與操作紀錄更新之後，呼叫 `invitationService.onBookingConfirmed(conn, { bookingId, now: current })`；其他目標狀態與既有行為不變（依賴 T009）
  - 📎 必讀：`research.md › R-05` — 以 `transition` 作為唯一掛接點的理由與鎖定順序以此為準
  - 📎 必讀：`contracts/openapi.yaml › x-invitation-side-effects › approveBooking` — 核准預約時的邀請副作用以此為準

### 前端（UI-01、UI-04）

- [X] T012 [P] [US1] 新增 `frontend/src/lib/emails.js`：純函式 `parseInviteeEmails(text)` 以空白、逗號、分號（含全形）與換行切開，去除前後空白、轉小寫並略過空白項、重複者只留第一個；不驗證 Email 格式
  - 📎 必讀：`research.md › R-12` — Email 解析的分隔符號與去重規則、不在前端判斷帳號是否存在的決策以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 操作` — 貼上多個 Email 自動拆列與重複只邀請一次的互動以此為準
- [X] T013 [P] [US1] 在 `shared/src/copy.js` 新增邀請欄位的畫面文案（欄位標籤與說明、再預約說明、勾選重複預約後的清除提示、人數提示、重複提示、格式錯誤、有問題 Email 清單標題、邀請說明句、送出失敗）與五種邀請通知的類型標籤（收到邀請、邀請變更、邀請取消、移出邀請、受邀提醒）
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 文案與無障礙` — 邀請欄位的全部文案原文以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-04 › 文案與無障礙` — 邀請類型標籤與通知文案以此為準
- [X] T014 [P] [US1] 在 `frontend/src/styles/components.css` 新增邀請欄位列（Email 輸入列、新增與移除按鈕、人數與重複提示、有問題 Email 清單、欄位錯誤）與邀請類型標籤的樣式；畫面寬度 360 像素時不得需要水平捲動，長 Email 在容器內自動換行
  - 📎 必讀：`contracts/prototype/booking-form.html › booking-invitees、booking-invitee-input、booking-invitees-error` — 邀請欄位區與錯誤清單的版面以此為準
  - 📎 必讀：`spec.md › NFR-007` — 360 像素不得水平捲動的要求以此為準
- [X] T015 [US1] 在 `frontend/src/pages/bookingFormPage.js` 加入「邀請同事」欄位（`booking-invitees`）：只在新增單次預約與再預約模式顯示，修改預約模式不顯示；預設一列空白，支援新增一位、每列移除、貼上多個 Email 自動拆列、失焦檢查格式、顯示「將邀請 {人數} 位同事」與重複提示；再預約模式顯示 `booking-invitees-rebook-note` 且欄位空白；勾選 `booking-recurring-toggle` 時隱藏並清空並顯示 `booking-invitees-cleared` 提示，取消勾選後恢復一列空白；送出時以 `parseInviteeEmails` 結果放入 `POST /api/bookings` 的 `inviteeEmails`；400 帶 `inviteeProblems` 時在欄位區上方顯示清單（`booking-invitees-error`、`booking-invitees-problem-item`）、標示有問題的列並保留所有已填內容；成功時在結果面板附上 `booking-result-invitees`（`confirmed` 說明已發送、`pending` 說明核准後才發送，沒填 Email 不顯示）；送出期間欄位與按鈕停用（依賴 T012、T013、T014）
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 操作` — 七種操作的互動與需要內層提供的資料以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 狀態` — 成功、載入、空狀態與錯誤時欄位的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 文案與無障礙` — 文案原文與錯誤清單的無障礙寫法以此為準
  - 📎 必讀：`contracts/openapi.yaml › createBooking › responses 201／400` — 成功回應的 `inviteeCount` 與失敗的 `inviteeProblems` 結構以此為準
  - 📎 必讀：`contracts/prototype/booking-form.html › booking-invitees、booking-invitee-add、booking-invitees-cleared` — 欄位區與提示的位置以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 3～7、13～14` — 驗證失敗、再預約空白與其他表單不提供欄位的情境以此為準
- [X] T016 [US1] 在 `frontend/src/pages/notificationsPage.js` 為五種邀請通知顯示類型標籤（`notification-type-tag`）與內容，既有類型與已讀、未讀數行為不變（依賴 T013）
  - 📎 必讀：`contracts/ui-contract.md › UI-04 › 操作` — 五種類型標籤與通知列表的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-04 › 狀態` — 成功、載入、空狀態與錯誤時通知頁的呈現以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Notification` — 通知的 `type` 清單與 `invitationId` 以此為準
  - 📎 必讀：`spec.md › FR-003` — 受邀者收到邀請通知的內容要求以此為準

**Checkpoint**：使用者故事 1 完成，對照完成判準在執行中的應用程式內操作確認

---

## Phase 3：使用者故事 2 - 受邀者查看邀請、回覆出席與否並收到開始前提醒（Priority: P2）

**目標**：受邀同事在「我的邀請」查看並回覆邀請（UI-02、API-01），開會前收到提醒（API-05），並能從通知進入邀請詳情（UI-04）。

**完成判準**：受邀同事開啟導覽列「我的邀請」，依預約開始時間由早到晚看到邀請；開啟詳情看到預約者姓名、場地名稱與地點、日期、起訖時間與主題，看不到預約人數與其他受邀者；按「出席」後回覆標籤變為「已接受」並提示「已回覆出席」，改按「不出席」變為「已婉拒」；預約開始後、已取消或審核中時兩個按鈕停用並顯示原因；沒有邀請時顯示「目前沒有邀請」；從通知的「查看邀請」進入同一個詳情；預約開始前 30 分鐘，「已接受」與「未回覆」的受邀者各收到一則受邀提醒，「已婉拒」者沒有；預約者不會因受邀者回覆而收到任何通知；員工乙無法開啟或回覆員工甲的邀請。

### 後端（API-01、API-05）

- [X] T017 [US2] 在 `backend/src/services/invitationService.js` 新增 `listMyInvitations(user)`（只回傳登入者本人 `active` 與 `invalid` 的邀請，依預約開始時間由早到晚）、`getInvitation(user, invitationId)` 與 `respondInvitation(user, invitationId, { response })`：邀請不屬於登入者、不存在或仍是 `pending` 時一律丟 `HttpError(404, "找不到這份邀請。…")`；回覆時先 `bookingRepository.lockById` 再 `invitationRepository.lockById`，依序判斷邀請 `active`、預約 `confirmed`、現在早於 `start_at`，不通過丟 `HttpError(409, …, { reason })`（`invitation_invalid`、`booking_pending_review`、`booking_cancelled`／`booking_rejected`、`booking_started`），通過後更新 `response` 與 `responded_at`，回覆值非 `accepted`／`declined` 丟 400；回應為完整邀請資料，不含預約人數與其他受邀者；回覆不呼叫 `notify`（依賴 T003、T006、T009）
  - 📎 必讀：`contracts/openapi.yaml › listMyInvitations、getInvitation › responses` — 列表與詳情的欄位、排序與 404 規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › respondInvitation › requestBody、responses 200／400／404／409` — 回覆的請求、各狀態碼與 `reason` 原因以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Invitation、InvitationList、InvitationReplyInput、InvitationStatus、InvitationResponse` — 邀請資料與代碼的欄位、型別與列舉以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 回覆邀請（respondInvitation）` — 回覆的鎖定順序、重新判定與單一語句更新以此為準
  - 📎 必讀：`research.md › R-07` — 三個端點的行為、404 一致與回覆不通知的決策以此為準
  - 📎 必讀：`spec.md › FR-008、FR-009、FR-010` — 詳情不顯示人數與他人、回覆規則與可回覆條件以此為準
- [X] T018 [US2] 新增 `backend/src/routes/invitations.js` 並實作 `register(router)`：`GET /api/invitations`、`GET /api/invitations/:invitationId`、`PUT /api/invitations/:invitationId/response`，皆以 `requireAuth` 包住、先檢查 `can(user, "invitation:respond")`，路徑參數轉為數字，回覆本文以 `readJsonBody` 讀取，成功回 200；路由檔由 `app.js` 自動載入（依賴 T017）
  - 📎 必讀：`contracts/openapi.yaml › listMyInvitations、getInvitation、respondInvitation › parameters` — 路徑參數與方法路徑以此為準
  - 📎 必讀：`research.md › R-07、R-11` — 端點位置、身分只取自 session 的決策以此為準
- [X] T019 [P] [US2] 新增 `backend/src/jobs/inviteeReminders.js`：匯出 `sendInviteeReminders(current = now())` 並以 `registerJob("sendInviteeReminders", …)` 註冊，沿用 `processDue`；選取條件為邀請 `status = active`、`response IN ('none', 'accepted')`、`reminder_sent_at IS NULL`，預約 `status = confirmed`、`start_at > :now`、`DATE_SUB(b.start_at, INTERVAL r.int_value MINUTE) <= :now`（`r` 為 `rules.reminder_minutes`）以及 `i.notified_at <= DATE_SUB(b.start_at, INTERVAL r.int_value MINUTE)`，結尾 `FOR UPDATE OF i SKIP LOCKED`；處理時在鎖定下重新確認 `reminder_sent_at` 仍為 `NULL`，寫入 `invitation_reminder`（帶 `invitationId`）並設定 `reminder_sent_at`（依賴 T003、T004、T005）
  - 📎 必讀：`contracts/openapi.yaml › x-background-jobs › sendInviteeReminders` — 提醒的觸發條件、不補發條件與通知內容以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 排程：受邀者開始前提醒（sendInviteeReminders）` — 只鎖邀請列、每份邀請一個交易以此為準
  - 📎 必讀：`research.md › R-09` — 查詢條件、`notified_at` 的用途與 `FOR UPDATE OF i` 的決策以此為準
  - 📎 必讀：`spec.md › FR-011` — 提醒對象與不補發的需求以此為準
- [X] T020 [US2] 在 `backend/src/server.js` 匯入 `./jobs/inviteeReminders.js`，位置緊接既有的 `./jobs/reminders.js`（依賴 T019）
  - 📎 必讀：`research.md › R-09` — 工作在 `server.js` 與既有提醒同一處匯入的決策以此為準

### 前端（UI-02、UI-04）

- [X] T021 [P] [US2] 在 `shared/src/copy.js` 新增我的邀請的畫面文案（導覽項目、列表與詳情標題、標籤、空狀態、不可回覆的四種原因、回覆成功與失敗提示、錯誤與重新載入）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 文案與無障礙` — 我的邀請的全部文案原文以此為準
- [X] T022 [P] [US2] 在 `frontend/src/styles/components.css` 新增邀請卡片、回覆標籤、失效與審核中與已開始標籤、回覆按鈕列的樣式；畫面寬度 360 像素時不得需要水平捲動，可點目標至少 44 像素高
  - 📎 必讀：`contracts/prototype/invitations.html › invitation-item、invitation-reply-tag、invitation-reply-accept` — 列表與詳情的版面以此為準
  - 📎 必讀：`spec.md › NFR-007` — 360 像素不得水平捲動的要求以此為準
- [X] T023 [US2] 新增 `frontend/src/pages/invitationsPage.js`：列表（`my-invitations`）依回應順序顯示邀請卡片與回覆、失效、審核中、已開始標籤，空狀態（`my-invitations-empty`）、載入骨架與錯誤重新載入；詳情（`invitation-detail`）顯示預約者姓名、場地名稱與地點、日期時間、主題與目前回覆；「出席」「不出席」按鈕（`invitation-reply-accept`、`invitation-reply-decline`，`aria-pressed` 表示目前回覆）送出時 200 毫秒內停用並顯示「處理中…」，成功依回應更新標籤並以 `app-toast` 提示，失敗或 409 時保留原回覆、顯示原因並重新載入詳情；不可回覆時按鈕停用並以 `invitation-reply-disabled-reason` 顯示對應文字；詳情 404 顯示「找不到這份邀請」與回到列表（依賴 T021、T022）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 操作` — 列表、詳情、回覆與無法回覆原因的互動以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 狀態` — 成功、載入、空狀態與錯誤的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 文案與無障礙` — 文案原文、`aria-pressed` 與播報的寫法以此為準
  - 📎 必讀：`contracts/openapi.yaml › listMyInvitations、getInvitation、respondInvitation` — 呼叫的方法路徑、回應與各狀態碼以此為準
  - 📎 必讀：`contracts/prototype/invitations.html › invitation-list、invitation-detail、invitation-reply-disabled-reason` — 列表與詳情的位置以此為準
  - 📎 必讀：`spec.md › 使用者故事 2 › 驗收情境 1～11` — 回覆、改回覆、不可回覆、詳情隱私、列表與空狀態、重複點擊的情境以此為準
- [X] T024 [US2] 在 `frontend/src/router.js` 的 `PAGE_LOADERS` 新增 `"/invitations": () => import("./pages/invitationsPage.js")`，並在 `parseHash` 將 `#/invitations/:invitationId` 解析為 `{ route: "/invitations", params: { invitationId, ...query } }`（依賴 T023）
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 兩個新路由的路徑與未登入導向登入頁後返回的規則以此為準
- [X] T025 [P] [US2] 在 `frontend/src/components/nav.js` 於「我的預約」之後新增導覽項目 `{ href: "#/invitations", label: "我的邀請" }`（`data-testid="app-nav-invitations"`），所有登入員工都顯示，我的邀請列表與詳情的導覽高亮為此項
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 導覽項目的位置、對象與高亮規則以此為準
- [X] T026 [US2] 在 `frontend/src/pages/notificationsPage.js` 的展開內容，對帶有 `invitationId` 的通知顯示「查看邀請」連結（`notification-open-invitation`）前往 `#/invitations/{invitationId}`；邀請失效後連結仍可進入（依賴 T016、T024）
  - 📎 必讀：`contracts/ui-contract.md › UI-04 › 操作` — 從通知進入邀請詳情的互動以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-04 › 狀態` — 標為已讀失敗時仍展開內容與連結的呈現以此為準
  - 📎 必讀：`spec.md › 使用者故事 2 › 驗收情境 6` — 開啟通知後看到邀請詳情的情境以此為準

**Checkpoint**：使用者故事 2 完成，對照完成判準在執行中的應用程式內操作確認

---

## Phase 4：使用者故事 3 - 主辦人查看出席狀況以預估場地大小（Priority: P3）

**目標**：預約者在自己的預約卡片展開受邀者面板，看到名單、出席統計並與預約人數、場地容納人數並列（UI-03、API-02）。

**完成判準**：預約者邀請 5 位同事，3 位回覆出席、1 位不出席、1 位未回覆後，在「我的預約」該預約卡片按「受邀者」展開，看到受邀 5 人、已接受 3 人、已婉拒 1 人、未回覆 1 人、預計到場 4 人，並與預約人數、場地容納人數並列，名單列出每位的姓名、Email 與回覆；全部未回覆時預計到場 1 人；受邀者改回覆後按「重新整理」統計同步更新；沒有受邀者時顯示「未邀請任何人」；預計到場超過或遠少於容納人數都只顯示人數、不出現任何改小場地的建議；待審核預約的名單顯示「待發送」且沒有統計；已取消的預約名單標示「邀請已失效」且不顯示預計到場；受邀者帳號被停用後不計入統計；週期性預約場次沒有「受邀者」按鈕；其他員工無法取得該名單。

### 後端（API-02 名單與統計）

- [X] T027 [P] [US3] 新增 `backend/src/domain/invitations.js`：純函式 `summarizeInvitations(rows, bookingStatus)`，只計 `status = active` 的邀請，回傳 `{ invited, accepted, declined, noReply, expected }`（`expected = 1 + accepted`）；預約狀態為 `pending`、`cancelled`、`rejected` 或沒有任何可列出的邀請時回傳 `null`
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.InviteeSummary` — 統計欄位與回傳 `null` 的情形以此為準
  - 📎 必讀：`research.md › R-08` — 統計由伺服器端純函式計算、`expected` 的算法以此為準
  - 📎 必讀：`spec.md › FR-012、FR-013、FR-014` — 統計項目、預計到場人數與不顯示統計的情形以此為準
- [X] T028 [US3] 在 `backend/src/services/invitationService.js` 新增 `listBookingInvitees(user, bookingId)`：預約不存在丟 404；非預約者本人丟 `HttpError(403, "沒有權限查看這筆預約的受邀者。…")`；週期性預約場次丟 409（`reason: booking_recurring`）；回傳 `{ bookingStatus, attendees, venueCapacity, items, summary, canAdjust, … }`，`items` 含 `pending`、`active` 與 `invalid` 且失效原因不是 `removed` 的邀請（姓名、Email、邀請狀態、回覆狀態、邀請識別），`summary` 由 `summarizeInvitations` 計算；不開交易、單一讀取（依賴 T006、T027、T017）
  - 📎 必讀：`contracts/openapi.yaml › listBookingInvitees › responses 200／403／404／409` — 名單與統計的回應、授權與週期性預約拒絕以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.BookingInvitees、InviteeItem、InviteeSummary` — 名單項目與統計的欄位、型別以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 讀取邀請與名單（listMyInvitations、getInvitation、listBookingInvitees、listNotifications、markNotificationRead）` — 讀取不開交易、單一 SELECT 的做法以此為準
  - 📎 必讀：`research.md › R-08` — 名單的列出規則（被移除者不列出）與只供預約者本人的決策以此為準
  - 📎 必讀：`spec.md › FR-012、FR-014、FR-016` — 名單內容、失效標示與不提供場地建議的需求以此為準
- [X] T029 [US3] 在 `backend/src/routes/invitations.js` 新增 `GET /api/bookings/:bookingId/invitations`（`requireAuth`，呼叫 `invitationService.listBookingInvitees`，成功回 200）（依賴 T028）
  - 📎 必讀：`contracts/openapi.yaml › listBookingInvitees › parameters` — 路徑與路徑參數以此為準
  - 📎 必讀：`research.md › R-08、R-11` — 端點位置與僅限預約者本人的決策以此為準

### 前端（UI-03 名單與統計）

- [X] T030 [P] [US3] 在 `shared/src/copy.js` 新增受邀者面板的畫面文案（展開按鈕、統計標籤、並列標籤、回覆與待發送與失效標籤、未邀請任何人、審核說明、重新整理與更新提示、無法調整的原因、載入失敗與重新載入）
  - 📎 必讀：`contracts/ui-contract.md › UI-03 › 文案與無障礙` — 面板的全部文案原文以此為準
- [X] T031 [P] [US3] 在 `frontend/src/styles/components.css` 新增受邀者面板的樣式（展開按鈕、統計列、並列區、名單列與回覆標籤、骨架）；畫面寬度 360 像素時不得需要水平捲動，姓名與 Email 在容器內自動換行
  - 📎 必讀：`contracts/prototype/bookings.html › invitee-panel、invitee-stats、invitee-compare、invitee-item` — 面板版面以此為準
  - 📎 必讀：`spec.md › NFR-007` — 360 像素不得水平捲動的要求以此為準
- [X] T032 [US3] 新增 `frontend/src/components/inviteePanel.js`：展開時呼叫 `GET /api/bookings/:bookingId/invitations` 並顯示骨架（`invitee-panel-loading`）；成功依回應顯示統計列（`invitee-stat-total`、`invitee-stat-accepted`、`invitee-stat-declined`、`invitee-stat-noreply`、`invitee-stat-expected`）、並列區（`invitee-compare-attendees`、`invitee-compare-capacity`）與名單（`invitee-item`、`invitee-reply-tag`），一律顯示後端回傳的值、前端不自行計算；`summary` 為 `null` 時不顯示統計，待發送顯示 `invitee-unsent-tag` 與審核說明，失效顯示 `invitee-invalid-tag`；名單為空顯示「未邀請任何人」（`invitee-panel-empty`）；「重新整理」（`invitee-refresh`）期間停用並顯示「更新中…」、保留舊畫面；載入失敗顯示 `invitee-panel-error` 與 `invitee-panel-retry`；不可調整時以 `invitee-adjust-disabled-reason` 顯示原因；畫面不出現任何改小場地的提示（依賴 T030、T031）
  - 📎 必讀：`contracts/ui-contract.md › UI-03 › 操作` — 展開、名單與統計、重新整理與空狀態的互動以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-03 › 狀態` — 成功、載入、空狀態與錯誤的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 前端不自行計算統計、不顯示場地建議的界線以此為準
  - 📎 必讀：`contracts/openapi.yaml › listBookingInvitees` — 呼叫的方法路徑與回應以此為準
  - 📎 必讀：`contracts/prototype/bookings.html › invitee-panel-toggle、invitee-list、invitee-stats、invitee-panel-empty` — 面板各區塊的位置以此為準
  - 📎 必讀：`spec.md › 使用者故事 3 › 驗收情境 1～6、8～9、11` — 統計、重新整理、空狀態、不提供建議、待審核與已取消的情境以此為準
- [X] T033 [US3] 在 `frontend/src/components/bookingCard.js` 為單次預約卡片加入「受邀者」按鈕（`invitee-panel-toggle`，`aria-expanded`、`aria-controls`）並掛載 `inviteePanel`，面板在各預約狀態都可展開；週期性預約場次不顯示此按鈕與面板（依賴 T032）
  - 📎 必讀：`contracts/ui-contract.md › UI-03 › 操作` — 按鈕與面板的掛載位置、各預約狀態可展開以此為準
  - 📎 必讀：`contracts/prototype/bookings.html › invitee-panel-toggle` — 按鈕在預約卡片上的位置以此為準
  - 📎 必讀：`spec.md › FR-023` — 週期性預約不提供受邀者調整入口的需求以此為準

**Checkpoint**：使用者故事 3 完成，對照完成判準在執行中的應用程式內操作確認

---

## Phase 5：使用者故事 4 - 預約異動或取消時同步處理邀請（Priority: P4）

**目標**：預約改時間、換場地、取消、駁回，或受邀者帳號被停用時，邀請依規則重置、保留、延後套用或失效並通知受邀者（API-04）。

**完成判準**：已確認的預約有一位「已接受」、一位「已婉拒」的受邀者，預約者把日期或時間改到另一個空閒時段後，兩位受邀者的回覆都回到「未回覆」並各收到含新日期時間、請重新回覆的通知；只換場地時回覆維持「已接受」並收到含新場地的通知；只改主題或人數時回覆不變、沒有通知；改到需審核的場地後受邀者看到「預約審核中」且不能回覆，核准後才收到變更通知並可再次回覆，駁回則邀請失效並收到取消通知；預約者、管理員取消，或場地停用與維護造成取消時，邀請變為「邀請已失效」，已收過邀請的受邀者收到取消通知（管理員取消的通知附原因），仍待發送的邀請不通知；已報到、已完成或未到場的預約邀請仍保留最後的回覆但不能回覆；受邀者帳號被停用後其邀請失效，重新啟用不恢復。

### 後端（API-04）

- [X] T034 [US4] 在 `backend/src/services/invitationService.js` 新增 `onBookingChanged(conn, { bookingId, changeKind, finalStatus, venue, date, startTime, endTime, now })`：`finalStatus` 為 `confirmed` 時，`changeKind = time` 把該預約所有 `active` 邀請的 `response` 重置為 `none`、清空 `responded_at` 與 `reminder_sent_at`、`notified_at` 設為現在並寫入 `invitation_changed`（含新日期時間與新場地、請重新回覆），`changeKind = venue` 保留回覆並寫入 `invitation_changed`（含新場地）；`finalStatus` 為 `pending` 時不重置不通知，只把 `active` 邀請的 `pending_change` 更新為較強者（`time` 強於 `venue`）；`changeKind = none` 不處理；同時擴充 T009 的 `onBookingConfirmed`，對 `active` 且 `pending_change` 不為空的邀請依相同規則重置或保留、寫入變更通知並清除標記（依賴 T009、T017）
  - 📎 必讀：`contracts/openapi.yaml › x-invitation-side-effects › updateBooking、approveBooking` — 修改與核准時邀請的重置、保留、延後套用與通知以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 修改預約並同步邀請（updateBooking）` — 修改與核准時的鎖定順序與寫入以此為準
  - 📎 必讀：`research.md › R-06` — `changeKind` 的判斷、`pending_change` 合併與延後套用的決策以此為準
  - 📎 必讀：`spec.md › FR-017、FR-018、FR-019` — 時間重置、只換場地保留、只改主題人數不動與審核期間延後的需求以此為準
- [X] T035 [US4] 在 `backend/src/services/invitationService.js` 新增 `onBookingEnded(conn, { bookingId, reason, now })`（鎖定該預約邀請後，把 `pending` 與 `active` 邀請改為 `invalid`、`invalid_reason = booking_cancelled`；原本是 `active` 者寫入 `invitation_cancelled`，有 `reason` 時附原因；原本是 `pending` 者不通知）與 `onUserDeactivated(conn, { userId, now })`（呼叫 `markInvalidByInvitee`，`invalid_reason = account_disabled`，保留 `response`，不通知）（依賴 T034）
  - 📎 必讀：`contracts/openapi.yaml › x-invitation-side-effects › rejectBooking、cancelBooking、adminCancelBooking、deactivateVenue、createMaintenanceWindow、updateMaintenanceWindow、deactivateUser、expirePendingReviews` — 各取消與駁回原因下邀請與通知的副作用以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 預約取消或駁回使邀請失效` — 失效的鎖定與寫入範圍以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 停用帳號使其作為受邀者的邀請失效（deactivateUser 的受邀者側）` — 受邀者側失效的鎖定與保留回覆以此為準
  - 📎 必讀：`research.md › R-05、R-10` — 失效的處理範圍與重新啟用不恢復的決策以此為準
  - 📎 必讀：`spec.md › FR-020、FR-021、FR-022` — 取消與駁回失效、已報到後保留不可回覆、帳號停用失效的需求以此為準
- [X] T036 [US4] 在 `backend/src/services/bookingService.js` 的 `updateBooking`：只改主題與人數的早退分支不呼叫邀請服務；排程更新並（必要時）轉為 `pending` 之後，以資料庫實際前後值判斷 `changeKind`（開始或結束時間不同為 `time`，時間相同但場地不同為 `venue`，否則 `none`），呼叫 `invitationService.onBookingChanged`，與預約修改同一交易，修改失敗時整個交易回滾（依賴 T034）
  - 📎 必讀：`research.md › R-06` — 以實際前後值判斷異動種類與同一交易的決策以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 修改預約並同步邀請（updateBooking）` — 與 001 修改預約交易合併的範圍以此為準
  - 📎 必讀：`spec.md › 使用者故事 4 › 驗收情境 1～7` — 時間重置、只換場地、只改主題人數、失敗不變、審核期間延後的情境以此為準
- [X] T037 [US4] 在 `backend/src/services/bookingTransition.js` 的 `transition`：目標狀態為 `cancelled` 或 `rejected` 時，於預約狀態與時段釋出更新之後呼叫 `invitationService.onBookingEnded(conn, { bookingId, reason, now: current })`；`checked_in`、`no_show`、`completed` 不處理（依賴 T011、T035）
  - 📎 必讀：`research.md › R-05` — 取消與駁回路徑都經過 `transition`、已報到後不失效的決策以此為準
  - 📎 必讀：`spec.md › 使用者故事 4 › 驗收情境 8～13` — 駁回、各種取消、待發送取消與已報到後的情境以此為準
- [X] T038 [US4] 在 `backend/src/services/userService.js` 的 `deactivateUser` 既有交易內，於 `cancelAffected` 與候補失效之後、`UPDATE users SET is_active = 0` 之前呼叫 `invitationService.onUserDeactivated(conn, { userId, now: current })`；`enableUser` 不處理邀請（依賴 T035）
  - 📎 必讀：`research.md › R-10` — 停用帳號時呼叫位置與重新啟用不恢復的決策以此為準
  - 📎 必讀：`spec.md › 使用者故事 4 › 驗收情境 14～15` — 受邀者帳號停用與預約者帳號停用的情境以此為準

**Checkpoint**：使用者故事 4 完成，對照完成判準在執行中的應用程式內操作確認

---

## Phase 6：使用者故事 5 - 預約成立後新增或移除受邀者（Priority: P5）

**目標**：預約者在預約開始前，於受邀者面板補邀漏掉的同事或移除不需要的受邀者（UI-03、API-02）。

**完成判準**：預約者在已確認且尚未開始的單次預約面板底部貼上兩個 Email 按「新增」，兩位同事收到邀請、受邀人數與未回覆人數同步增加並提示「已新增 2 位受邀者」；其中一個查無帳號時一個都不新增，欄位內容保留並列出有問題的 Email 與原因；新增已在名單中或自己的 Email 時被拒絕並說明；按某位「已接受」受邀者的「移除」並確認後，該受邀者收到「已移出邀請」通知、從名單消失，受邀人數、已接受人數與預計到場人數同步減少，他在「我的邀請」仍看到標示「邀請已失效」的邀請與最後的回覆且不能回覆；被移除者可再次被新增並收到新的邀請；待審核預約新增的受邀者為「待發送」、移除待發送者不通知；預約已開始、已取消或為週期性場次時新增與移除停用並顯示原因；其他受邀者的回覆在新增與移除後不變。

### 後端（API-02 新增與移除）

- [X] T039 [US5] 在 `backend/src/services/invitationService.js` 新增 `addBookingInvitees(user, bookingId, { emails })` 與 `removeBookingInvitee(user, bookingId, invitationId)`：兩者先 `bookingRepository.lockById`，檢查預約屬於登入者（否則 403）、非週期性（`reason: booking_recurring`）、狀態為 `pending` 或 `confirmed`、現在早於 `start_at`（否則 409 與對應 `reason`）；新增時套用 `resolveInvitees`（含 `existingUserIds` 與 `already_invited`），任一有問題丟 400 帶 `inviteeProblems` 且不新增任何一位，通過後依預約狀態以 `createInvitations` 建立 `active`（並通知）或 `pending`（不通知）的邀請，回傳 `InviteesAdded`；移除時邀請須屬於該預約（否則 404），`active` 改為 `invalid`（`removed`）並寫入 `invitation_removed`，`pending` 改為 `invalid` 且不通知，已是 `invalid` 時回成功且不再通知；兩者皆不改變其他邀請的回覆（依賴 T008、T028）
  - 📎 必讀：`contracts/openapi.yaml › addBookingInvitees › requestBody、responses 201／400／403／404／409` — 新增的前置檢查、驗證與各狀態碼以此為準
  - 📎 必讀：`contracts/openapi.yaml › removeBookingInvitee › responses 200／403／404／409` — 移除的前置檢查、冪等與各狀態碼以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.AddInviteesInput、InviteesAdded` — 請求與回應的欄位以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 新增受邀者（addBookingInvitees）、移除受邀者（removeBookingInvitee）` — 兩個交易的鎖定、寫入與全有或全無以此為準
  - 📎 必讀：`research.md › R-08` — 新增與移除的行為、重複移除冪等與已知限制以此為準
  - 📎 必讀：`spec.md › FR-023、FR-024、FR-025、NFR-004` — 可調整條件、新增驗證、移除規則與全有或全無的需求以此為準
- [X] T040 [US5] 在 `backend/src/routes/invitations.js` 新增 `POST /api/bookings/:bookingId/invitations`（本文 `{ emails }`，呼叫 `addBookingInvitees`，成功回 201）與 `DELETE /api/bookings/:bookingId/invitations/:invitationId`（呼叫 `removeBookingInvitee`，成功回 200），皆以 `requireAuth` 包住並先檢查 `can(user, "invitation:manage")`（依賴 T039）
  - 📎 必讀：`contracts/openapi.yaml › addBookingInvitees、removeBookingInvitee › parameters` — 路徑與路徑參數以此為準
  - 📎 必讀：`research.md › R-08、R-11` — 端點位置與僅限預約者本人的決策以此為準

### 前端（UI-03 新增與移除）

- [X] T041 [P] [US5] 在 `shared/src/copy.js` 新增新增與移除受邀者的畫面文案（新增欄位標籤與按鈕、處理中、有問題 Email 的原因文字、新增成功兩種提示、移除對話框說明（含待發送不通知的說明）、移除成功與失敗提示、調整被拒絕的原因）
  - 📎 必讀：`contracts/ui-contract.md › UI-03 › 文案與無障礙` — 新增與移除的全部文案原文以此為準
- [X] T042 [P] [US5] 在 `frontend/src/styles/components.css` 新增新增受邀者欄位區、問題清單與移除對話框的樣式；畫面寬度 360 像素時不得需要水平捲動
  - 📎 必讀：`contracts/prototype/bookings.html › invitee-add-input、invitee-add-problems、invitee-remove-dialog` — 新增與移除的版面以此為準
  - 📎 必讀：`spec.md › NFR-007` — 360 像素不得水平捲動的要求以此為準
- [X] T043 [US5] 在 `frontend/src/components/inviteePanel.js` 加入新增與移除：預約為 `pending` 或 `confirmed` 且尚未開始時，面板底部顯示多行輸入欄位（`invitee-add-input`）與「新增」按鈕（`invitee-add-submit`），貼上多個 Email 以逗號、空白或換行分隔並以 `parseInviteeEmails` 解析，格式不符時前端攔截；送出時 200 毫秒內停用並顯示「新增中…」，成功更新名單與統計並提示、`pending` 預約提示核准後才發送，400 帶 `inviteeProblems` 時列出（`invitee-add-problems`、`invitee-add-problem-item`）並保留輸入；名單每列「移除」（`invitee-remove`）開啟確認對話框（`invitee-remove-dialog`，經 `frontend/src/components/dialog.js`），確認後該列停用並顯示「處理中…」，成功後從名單消失並更新統計；不可調整時新增欄位與移除按鈕停用；被拒絕時以 `app-toast` 顯示原因並重新取得名單（依賴 T012、T032、T041、T042）
  - 📎 必讀：`contracts/ui-contract.md › UI-03 › 操作` — 新增、移除、無法調整與調整被拒絕的互動以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-03 › 狀態` — 載入與錯誤時新增與移除控制項的呈現以此為準
  - 📎 必讀：`contracts/openapi.yaml › addBookingInvitees、removeBookingInvitee` — 呼叫的方法路徑、回應與各狀態碼以此為準
  - 📎 必讀：`contracts/prototype/bookings.html › invitee-add-input、invitee-add-submit、invitee-remove、invitee-remove-dialog` — 新增欄位與移除對話框的位置以此為準
  - 📎 必讀：`spec.md › 使用者故事 5 › 驗收情境 1～5、7～11、14` — 新增、拒絕、移除、重新新增、待審核與不可調整的情境以此為準

**Checkpoint**：使用者故事 5 完成，對照完成判準在執行中的應用程式內操作確認

---

## Phase 7：Polish 與跨領域事項

**目的**：全專案程式品質收尾

- [X] T044 執行 `npm run lint` 與 `npm run format`，修正全專案問題

---

## 相依與執行順序

### 階段相依

- **Foundational（Phase 1）**：無相依，可立即開始；阻擋所有使用者故事
- **使用者故事（Phase 2～6）**：皆依賴 Foundational 完成，之後依優先順序 P1 → P2 → P3 → P4 → P5 執行，或有人力時並行
- **Polish（Phase 7）**：依賴所有使用者故事完成

### 使用者故事相依

- **US1（P1）**：只依賴 Foundational（T001～T007）；不依賴其他故事
- **US2（P2）**：依賴 Foundational 與 US1 建立的邀請（T009 的 `onBookingConfirmed`、T016 的通知頁）；回覆與提醒需要有邀請可操作
- **US3（P3）**：依賴 US2 的 `invitationService.js` 與回覆資料；統計來自受邀者的回覆
- **US4（P4）**：依賴 US1 的 `onBookingConfirmed`、`bookingTransition.js` 的 `confirmed` 掛接與 US2 的回覆機制；處理 US1～US3 建立的邀請在預約異動時的變化
- **US5（P5）**：依賴 US1 的 `resolveInvitees`、`createInvitations` 與 US3 的受邀者面板

### 各故事內部順序

- 端點依序：資料庫端 → 後端 → 前端（資料庫端任務已全部集中在 Foundational）；故事未涉及的端點不列出
- 同一檔案的任務依序執行（`backend/src/services/invitationService.js`：T008 → T009 → T017 → T028 → T034 → T035 → T039；`backend/src/routes/invitations.js`：T018 → T029 → T040；`backend/src/services/bookingTransition.js`：T011 → T037；`shared/src/copy.js`：T005 → T013 → T021 → T030 → T041；`frontend/src/styles/components.css`：T014 → T022 → T031 → T042；`frontend/src/pages/notificationsPage.js`：T016 → T026；`frontend/src/components/inviteePanel.js`：T032 → T043）

### 並行機會

- Foundational：T002、T003、T005、T006、T007 可並行（T001 先行；T004 待 T002 完成）
- US1 前端：T012、T013、T014
- US2 後端：T019（可與 T017、T018 並行）
- US2 前端：T021、T022、T025
- US3 後端與前端基礎：T027、T030、T031
- US5 前端基礎：T041、T042
- 不同故事的不同端點可由不同人員同時進行（注意共用檔案）

---

## 並行範例：使用者故事 1

```bash
# 前端基礎：
Task: "新增 frontend/src/lib/emails.js 的 parseInviteeEmails"
Task: "在 shared/src/copy.js 新增邀請欄位文案與邀請類型標籤"
Task: "在 frontend/src/styles/components.css 新增邀請欄位樣式"
```

## 並行範例：使用者故事 2

```bash
# 後端：
Task: "新增 backend/src/jobs/inviteeReminders.js 的 sendInviteeReminders"

# 前端基礎：
Task: "在 shared/src/copy.js 新增我的邀請的畫面文案"
Task: "在 frontend/src/styles/components.css 新增邀請卡片與回覆標籤樣式"
Task: "在 frontend/src/components/nav.js 新增我的邀請導覽項目"
```

## 並行範例：使用者故事 3

```bash
# 後端與前端基礎：
Task: "新增 backend/src/domain/invitations.js 的 summarizeInvitations"
Task: "在 shared/src/copy.js 新增受邀者面板文案"
Task: "在 frontend/src/styles/components.css 新增受邀者面板樣式"
```

## 並行範例：使用者故事 5

```bash
# 前端基礎：
Task: "在 shared/src/copy.js 新增新增與移除受邀者文案"
Task: "在 frontend/src/styles/components.css 新增新增與移除樣式"
```

---

## 實作策略

### MVP 優先（只做使用者故事 1）

1. 完成 Phase 1：Foundational（阻擋所有故事）
2. 完成 Phase 2：US1
3. **停下並驗證**：對照 US1 完成判準，預約時填入同事 Email，確認同事收到邀請通知、錯誤 Email 被擋下、需審核場地核准後才發送
4. 可展示：員工預約會議室時順手邀請同事，同事在站內收到邀請

### 漸進交付

1. Foundational → 基礎就緒
2. 加入 US1 → 對照完成判準 → 展示（預約時邀請同事）
3. 加入 US2 → 對照完成判準 → 展示（同事回覆出席並收到提醒）
4. 加入 US3 → 對照完成判準 → 展示（主辦人看到到場人數）
5. 加入 US4 → 對照完成判準 → 展示（改時間、取消時邀請同步）
6. 加入 US5 → 對照完成判準 → 展示（預約後補邀與移除）
7. Phase 7 → 全專案 lint 與 format 收尾

### 團隊並行策略

1. 全員完成 Foundational
2. 之後依端點分工：

- 開發者 A：資料庫端與後端（T001～T004、T006～T011、T017～T020、T027～T029、T034～T040）
- 開發者 B：前端（T005、T012～T016、T021～T026、T030～T033、T041～T043）

3. 共用檔案（`shared/src/copy.js`、`frontend/src/styles/components.css`、`backend/src/services/invitationService.js`）依故事順序合併

---

## 備註

- [P] 任務 = 不同檔案、無相依
- [Story] 標籤讓任務可追溯到使用者故事
- 每個使用者故事都應可獨立完成，並以完成判準確認
- 每完成一個任務或一組邏輯任務即提交
- 可在任一 Checkpoint 停下，對照完成判準確認該故事
- 避免：模糊任務、同檔案衝突、破壞獨立性的跨故事相依

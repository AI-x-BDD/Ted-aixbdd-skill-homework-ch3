---
description: "一鍵「再預約一次」的實作任務清單"
---

# 任務：一鍵「再預約一次」

**[P]**：可與同段其他 [P] 任務並行（不同檔案、不依賴未完成的任務）

## 路徑慣例

- 本功能在既有專案內增修：techstack.md 的套件安裝清單與 001-venue-booking 已安裝的內容完全相同，本功能不新增套件、資料表或遷移，因此沒有 Setup 與 Foundational 任務，直接從使用者故事開始。
- 後端任務：`backend/src/repositories/`（查詢）、`backend/src/services/`（回應組裝）。本功能沒有資料庫端與檔案系統端的介面，查詢欄位的調整併入後端。
- 前端任務：`shared/src/copy.js`（文案）、`frontend/src/lib/`（純函式）、`frontend/src/components/`（元件）、`frontend/src/pages/`（畫面）。`#/bookings/new?from=` 的 `from` 已由 `frontend/src/router.js` 的查詢參數解析帶入頁面的 `params`，不需改動路由。
- 不新增後端路由：再預約沿用既有 `POST /api/bookings` 與 `GET /api/bookings/:bookingId`。

---

## Phase 1：使用者故事 1 - 從舊預約一鍵再預約（Priority: P1）🎯 MVP

**目標**：在「我的預約」每筆預約旁提供「再預約一次」按鈕（UI-01），帶入場地、主題與人數到預約表單，讓使用者只需選新時間就能送出（UI-02），並由後端提供場地啟用狀態（API-01）與沿用既有建立規則（API-02）。

**完成判準**：在「我的預約」每筆預約旁看到「再預約一次」；場地已停用的預約按鈕不可按並顯示「此場地已停用，無法再預約」，預約權限暫停中所有按鈕不可按並顯示解除日期；按下可按的按鈕後，表單帶入原場地（不可更換）、主題與人數，日期與起訖時間為空；選好空閒時段送出後回到「我的預約」並顯示含新預約狀態的成功提示，新預約出現在清單中且原預約毫無改變；時段被占用、人數超過、未選時間等情況不會建立預約並顯示對應提示。

### 後端（API-01、API-02 讀取）

- [X] T001 [US1] 修改 `backend/src/repositories/bookingRepository.js` 的 `findById` 與 `listMine`：兩個查詢的 SELECT 都加入 `v.is_active AS venue_is_active`，不改變其他欄位與排序
  - 📎 必讀：`contracts/openapi.yaml › listMyBookings` — 我的預約清單每筆需帶出場地啟用狀態的依據，以此為準
  - 📎 必讀：`research.md › R-03` — 場地啟用狀態隨既有查詢一併帶出、不另外查詢的決策以此為準
- [X] T002 [US1] 修改 `backend/src/services/bookingView.js` 的 `toMyBooking`：回傳物件加入布林欄位 `venueActive`（取自 `row.venue_is_active`），使 `GET /api/bookings/mine` 的每筆預約都帶出（依賴 T001）
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.MyBooking` — `venueActive` 的型別、必填與說明以此為準
  - 📎 必讀：`contracts/openapi.yaml › listMyBookings` — 兩個分頁（upcoming、past）、各狀態代碼的預約都要帶出此欄位的規定以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01` — 前端依此欄位判定按鈕可否按的規則以此為準
- [X] T003 [US1] 修改 `backend/src/services/bookingService.js` 的 `getBooking`：目前只回傳 `toBooking(booking)`，缺少 `MyBooking` 的必填欄位；改為在同一交易內以 `ruleRepository.loadAll(conn)` 取得規則值，並以 `bookingView.js` 的 `toMyBooking(booking, snapshot, now())` 組出回應，使回應含 `venueActive`、`series`、`statusReason`、`statusActor`、`canCancel`、`canEdit`、`editBlockedReason`、`canCheckIn`、`checkInWindow`（`statusReason`／`statusActor` 依 `contextService.listMyBookings` 的做法從 `eventRepository.listByBooking` 取最後一筆駁回或取消事件）；他人的預約回 403、不存在回 404 的行為與訊息維持不變，403／404 回應本文不得含場地、主題或人數（依賴 T002）
  - 📎 必讀：`contracts/openapi.yaml › getBooking` — 200／403／404 的回應內容與授權規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.MyBooking` — 回應必填欄位以此為準
  - 📎 必讀：`spec.md › NFR-002` — 他人預約不得被讀取、不得洩漏場地／主題／人數的要求以此為準
  - 📎 必讀：`research.md › R-02` — 來源預約只透過既有讀取端點取得、授權沿用既有檢查的決策以此為準

### 前端（UI-01、UI-02）

- [X] T004 [P] [US1] 修改 `shared/src/copy.js`：新增並匯出再預約文案常數，內容逐字取自 UI 契約——按鈕「再預約一次」、場地停用原因、權限暫停原因樣板、兩種成功提示、預填說明、場地唯讀說明、各項必填與規則錯誤文案、來源預約找不到與載入失敗文案
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 文案與無障礙` — 按鈕、停用原因與成功提示的文案以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 文案與無障礙` — 表單、錯誤清單與來源預約異常的文案以此為準
- [X] T005 [US1] 新增 `frontend/src/lib/rebook.js`：匯出純函式 `rebookState(booking, suspendedUntil)`，回傳 `{ enabled, reason }`；`suspendedUntil` 有值時一律不可按，原因為暫停樣板並代入台北日期 `YYYY-MM-DD`；否則 `booking.venueActive === false` 時不可按，原因為場地停用文案；兩者同時成立只回暫停原因；皆不成立時 `enabled` 為 true 且 `reason` 為空（依賴 T004）
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 操作` — 判定按鈕可否按的判斷順序與兩種原因以此為準
  - 📎 必讀：`spec.md › FR-001、FR-002、FR-003` — 所有狀態都顯示、停用場地與暫停權限時不可按的規則以此為準
  - 📎 必讀：`research.md › R-03` — 判斷只用載入時已有的資料、不新增請求的決策以此為準
- [X] T006 [US1] 修改 `frontend/src/components/bookingCard.js`：`bookingCard(booking, { onChanged, suspendedUntil })` 多接收 `suspendedUntil`；在動作列 `booking-card-actions` 對每一筆預約（不論狀態代碼，含週期性場次）加入「再預約一次」按鈕 `booking-rebook-button`，依 `rebookState` 決定是否 `disabled`；不可按時在同一列顯示可見原因文字 `booking-rebook-reason`，並以 `aria-describedby` 連到該文字；可按時為連到 `#/bookings/new?from={booking.id}` 的連結或按鈕；無障礙名稱為「再預約一次：{場地名稱}，{主題}」（依賴 T004、T005）
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 操作` — 按鈕位置、狀態範圍與停用呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 文案與無障礙` — 無障礙名稱與 `aria-describedby` 的要求以此為準
  - 📎 必讀：`contracts/prototype/bookings.html › booking-rebook-button、booking-rebook-reason` — 按鈕與原因文字的結構與 `data-testid` 以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 5～7` — 各狀態都顯示、場地停用、暫停權限三種情境以此為準
- [X] T007 [P] [US1] 修改 `frontend/src/styles/components.css`：為 T006 的再預約按鈕與原因文字加上版面樣式——寬度 768 像素以上原因文字在按鈕右側、以下改為按鈕下方上下排列且不橫向溢出；原因文字為一般字級的可見文字（不靠懸停）；按鈕可點目標至少 44 像素高；停用樣式沿用既有 `.btn:disabled`；同時為 UI-02 新增的元素（預填說明 `booking-rebook-notice`、唯讀場地欄位與其說明、「改為一般預約」連結 `booking-rebook-general-link`、來源預約異常區塊 `booking-rebook-source-error`）加上樣式，寬度 360 像素時全部在單欄內換行、不需水平捲動，可點目標至少 44 像素高
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 版面斷點、窄螢幕上下排列與 44 像素可點目標的要求以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 狀態` — 不可按時原因文字的位置與呈現以此為準
  - 📎 必讀：`contracts/prototype/booking-form.html › booking-rebook-notice、booking-rebook-general-link、booking-rebook-source-error` — UI-02 新增元素的結構與位置以此為準
  - 📎 必讀：`spec.md › NFR-004` — 360 像素寬不得水平捲動的要求以此為準
- [X] T008 [US1] 修改 `frontend/src/pages/myBookingsPage.js`：從 `../router.js` 匯入 `currentUser`，呼叫 `bookingCard` 時傳入 `suspendedUntil: currentUser?.suspendedUntil`；不新增任何 API 請求（依賴 T006）
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 狀態` — 成功、載入、空狀態、錯誤時按鈕的呈現規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › getCurrentUser` — 目前使用者的暫停解除時間欄位以此為準
  - 📎 必讀：`research.md › R-03` — 暫停資訊取自既有目前使用者資料、不另外請求的決策以此為準
- [X] T009 [US1] 修改 `frontend/src/pages/bookingFormPage.js` 的載入段：`params.from` 存在時進入再預約模式——以 `get("/api/bookings/" + from)` 取得來源預約，存放在獨立的變數，**不得**沿用修改模式的 `editId`／`existing`（避免送出時改呼叫 `PUT`）；來源預約的檢查放在「沒有可預約的場地」分支之前。頁面標題改為「再預約一次」，顯示預填說明 `booking-rebook-notice`（`role="status"`）；場地欄位 `booking-venue` 選到來源場地並設為唯讀（`aria-readonly="true"`、不可更換），旁附場地唯讀說明與「改為一般預約」連結 `booking-rebook-general-link`；主題、人數帶入原值（人數超過現行容納人數也照原值帶入）；日期欄位為空，`booking-start`、`booking-end` 在再預約模式下加入值為空的「請選擇」選項並預設選中，不套用既有的今天、`09:00`、`09:30` 預設值；開始時間欄位補上 `booking-start-error` 錯誤容器；既有暫停提示 `suspension-banner`（目前直接印出 `ctx.suspendedUntil` 的 UTC 字串）改為以 `shared/src/taipei.js` 換算成台北時間後再代入契約的暫停提示文案；隱藏「重複預約」勾選 `booking-recurring-toggle` 與其重複設定區塊；來源預約回 403／404 時一律顯示 `booking-rebook-source-error` 與「改為一般預約」，不顯示任何預填內容，表單不可送出；`venueActive` 為 false 時停用表單並顯示場地停用說明；網路等原因載入失敗時顯示錯誤訊息與 `booking-form-reload` 按鈕；載入中欄位位置顯示骨架 `booking-form-loading`；未帶 `from` 時行為完全不變（依賴 T004）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 操作` — 載入預填內容的預填欄位、場地唯讀與日期時間不預填的規則，以及來源預約無法讀取時 403／404、場地停用、載入失敗三種異常的呈現，以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 狀態` — 載入、錯誤狀態的呈現以此為準
  - 📎 必讀：`contracts/openapi.yaml › getBooking` — 來源預約的回應欄位與錯誤狀態碼以此為準
  - 📎 必讀：`contracts/openapi.yaml › searchVenues` — 來源場地現行容納人數、是否需審核與只回傳啟用場地的行為以此為準
  - 📎 必讀：`contracts/openapi.yaml › getContext` — 單次時長上限規則值與暫停解除時間以此為準
  - 📎 必讀：`spec.md › FR-008` — 週期性場次只建立單次預約、不帶入重複設定的需求以此為準
  - 📎 必讀：`contracts/prototype/booking-form.html › booking-rebook-notice、booking-rebook-general-link、booking-rebook-source-error` — 預填說明與異常區塊的結構以此為準
  - 📎 必讀：`spec.md › FR-004、FR-005` — 帶入內容與場地不可更換的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 1` — 開啟表單時的預期畫面以此為準
- [X] T010 [US1] 修改 `frontend/src/pages/bookingFormPage.js`，加入再預約模式的欄位失焦檢查：主題失焦時檢查必填；人數失焦時檢查為 1 以上的整數且不超過來源場地現行容納人數（文案為「請減少人數後再送出」的再預約版本）；結束時間失焦或變更時檢查晚於開始時間，且長度不超過 `GET /api/context` 的單次時長上限；未通過時在欄位下方的錯誤容器顯示文案，並設 `aria-invalid="true"`、以 `aria-describedby` 連到錯誤文字；與「現在」有關的規則不在前端判斷（依賴 T009）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 操作` — 修改主題與人數、選擇新日期與起訖時間兩項的失焦檢查範圍，以及不在前端判斷的規則以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 文案與無障礙` — 各欄位錯誤文案與欄位無障礙屬性以此為準
  - 📎 必讀：`contracts/openapi.yaml › getContext` — 單次時長上限規則值的欄位以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 8` — 人數超過容納人數時可直接改人數再送出的情境以此為準
- [X] T011 [US1] 修改 `frontend/src/pages/bookingFormPage.js` 的送出段：再預約模式下呼叫既有 `post("/api/bookings", payload())`，請求不含來源預約編號與重複設定；送出前檢查日期、開始、結束、主題、人數，未填時不送出、在各欄位錯誤容器（`booking-date-error`、`booking-start-error`、`booking-end-error`、`booking-subject-error`、`booking-attendees-error`）顯示必填提示，並把焦點移到第一個有錯誤的欄位；送出時按鈕立即停用並顯示「送出中…」、欄位停用、表單 `aria-busy="true"`；成功時依 `status` 以 `showToast` 顯示「已為你預約，狀態：已確認」或「已送出預約申請，狀態：待審核」，並導向 `#/bookings`，不顯示既有的結果面板；失敗時錯誤清單 `booking-form-error` 以「無法送出，以下規則未通過：」為標題，依 `Violation.rule` 代碼取再預約文案（無對應代碼時才用回應的 `message`；文案中的時間參數如暫停解除時間、最遠可預約日期，一律以 `shared/src/taipei.js` 換算成台北時間後代入，不顯示 UTC 字串或裝置時區），保留所有欄位內容（含日期與時間）、恢復按鈕與欄位可用、焦點移到清單，時段被占用時附「登記候補」連結 `booking-waitlist-link`；「返回」`booking-back` 回到 `#/bookings` 且不建立預約、不顯示確認對話框（依賴 T010）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 操作` — 送出再預約的送出前檢查、處理中狀態、成功導向，以及規則拒絕訊息的錯誤清單、內容保留與焦點移動，以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 文案與無障礙` — 各規則錯誤文案與成功提示以此為準
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 時間一律以台北時間顯示的規則以此為準
  - 📎 必讀：`spec.md › NFR-003` — 錯誤訊息中的時間以台北時間顯示、不顯示內部錯誤代碼的要求以此為準
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — 請求內容、201 與各失敗狀態碼、`Violation.rule` 清單以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Violation` — 規則代碼與說明欄位以此為準
  - 📎 必讀：`spec.md › FR-006、FR-007、FR-008、FR-009、FR-010、FR-011` — 規則一致、新預約不影響舊預約、單場複製、放棄、必填提示與內容保留的需求以此為準
  - 📎 必讀：`spec.md › NFR-001` — 連續重複送出只建立一筆的要求以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 2～4、8～14` — 成功、修改內容、人數超過、必填、占用、持有上限、週期性場次、放棄、重複送出的情境以此為準
- [X] T012 [P] [US1] 修改 `frontend/src/components/nav.js` 的暫停提示 `suspension-banner`：文案改為契約的暫停提示「您的預約權限已暫停至 {解除時間}。暫停期間無法新增預約、登記候補與確認遞補。」，解除時間維持以台北時間顯示；預約表單頁與我的預約頁因此只出現這一個暫停提示，不再與表單自己的提示重複（`bookingFormPage.js` 在導覽列已顯示提示時不再另外渲染 `suspension-banner`，併入 T009 一起修改）
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 暫停期間頁面頂部顯示暫停提示、時間以台北時間顯示的規則以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 文案與無障礙` — 暫停提示文案以此為準
  - 📎 必讀：`spec.md › FR-003` — 暫停期間的使用者可見行為以此為準

**Checkpoint**：使用者故事 1 完成，對照完成判準在執行中的應用程式內操作確認

---

## Phase 2：Polish 與跨領域事項

**目的**：全專案程式品質收尾

- [X] T013 [P] 執行 `npm run lint` 與 `npm run format`，修正本功能新增與修改的檔案所產生的問題
  - 📎 必讀：`techstack.md › 開發工具` — lint 與格式化工具以此為準

---

## 相依與執行順序

### 階段相依

- **使用者故事（Phase 1）**：無前置階段（既有專案已具備 Setup 與 Foundational 的內容），可立即開始
- **Polish（Phase 2）**：依賴使用者故事 1 完成

### 使用者故事相依

- **US1（P1）**：唯一的故事，依賴 001-venue-booking 已實作的建立預約、我的預約與目前使用者資料

### 各故事內部順序

- 端點依序：後端（T001～T003）、前端（T004～T012）；故事未涉及的端點不列出
- 同一檔案的任務依序執行（T009 → T010 → T011 都修改 `bookingFormPage.js`；T012 的 `nav.js` 與其他任務檔案不同）

### 並行機會

- 使用者故事 1：後端 T001～T003 與前端 T004～T005 檔案不同，可由不同人員同時進行
- 前端 T004、T007、T012 標 [P]，不依賴同段其他任務，可與後端任務同時開始

---

## 並行範例：使用者故事 1

```bash
# 後端與前端的起手任務可同時進行：
Task: "T001 在 bookingRepository.js 的查詢加入 venue_is_active"
Task: "T004 在 shared/src/copy.js 新增再預約文案"
Task: "T007 在 components.css 加入再預約按鈕與原因文字的版面樣式"
```

---

## 實作策略

### MVP 優先（只做使用者故事 1）

1. 完成 Phase 1：使用者故事 1（本功能只有這一個故事，既有專案不需 Setup 與 Foundational）
2. **停下並驗證**：對照 US1 完成判準，在「我的預約」逐一確認按鈕顯示、停用原因、預填內容與送出結果
3. 可展示：從一筆舊的週會預約按「再預約一次」，只選新日期與時間就建立下一場

### 漸進交付

1. 加入 US1 → 對照完成判準 → 展示（一鍵再預約）
2. Phase 2 → 全專案 lint 與格式化

### 團隊並行策略

1. 兩位開發者即可：
2. 之後依端點分工：

- 開發者 A：後端 T001～T003
- 開發者 B：前端 T004～T012

3. 共用檔案（`frontend/src/pages/bookingFormPage.js`）依 T009、T010、T011 的順序合併

---

## 備註

- [P] 任務 = 不同檔案、無相依
- [Story] 標籤讓任務可追溯到使用者故事
- 每個使用者故事都應可獨立完成，並以完成判準確認
- 每完成一個任務或一組邏輯任務即提交
- 可在任一 Checkpoint 停下，對照完成判準確認該故事
- 避免：模糊任務、同檔案衝突、破壞獨立性的跨故事相依

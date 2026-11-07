---
description: "預約衝突時推薦替代時段／場地的實作任務清單"
---

# 任務：預約衝突時推薦替代時段／場地

**[P]**：可與同段其他 [P] 任務並行（不同檔案、不依賴未完成的任務）

## 路徑慣例

- 本功能在既有專案內增修：techstack.md 的套件安裝清單與 001-venue-booking、002-rebook-reservation 已安裝的內容完全相同，本功能不新增套件、資料表、欄位或遷移，因此沒有 Setup 任務。
- 介面 ID（UI-01～UI-02、API-01～API-02）對應 plan.md「介面盤點」；本功能沒有資料庫端與檔案系統端的介面，`booking_slots` 的唯讀查詢併入後端。
- 後端任務落在 `backend/src/domain/`（純函式）、`backend/src/services/`（建議組裝、占用檢查、建立與修改預約）、`backend/src/repositories/`（占用查詢）、`backend/src/lib/`（錯誤回應）。
- 前端任務落在 `shared/src/copy.js`（文案）、`frontend/src/api/`（請求與錯誤物件）、`frontend/src/components/`（建議區塊元件）、`frontend/src/pages/`（預約表單）、`frontend/src/styles/`（版面）。
- UI 文案、`data-testid` 與狀態一律以 `contracts/ui-contract.md` 為準，版面參考 `contracts/prototype/booking-form.html`、`states.html`。
- 不新增後端路由：建立沿用既有 `POST /api/bookings`，修改沿用既有 `PUT /api/bookings/:bookingId`。
- 時間點：建議的起訖是帶 `Z` 的 UTC，前端以 `shared/src/taipei.js` 換算為台北時間（research.md R-02、R-08 與 openapi.yaml 一致）。場地建議不含 `location`。

---

## Phase 1：Foundational（阻擋性前置）

**目的**：兩個使用者故事共用的基礎——後端「時段被占用」與其他規則並列回報、錯誤回應可帶建議、占用的唯讀查詢；前端收得到建議、送出流程符合契約，並提供建議區塊的外框與點選後的共用處理

**⚠️ 重要**：本階段完成前不得開始任何使用者故事

- [X] T001 [P] 修改 `backend/src/lib/http.js` 的 `sendError`：在既有的 `conflicts`、`impact` 之後加入 `if (extra.suggestions) body.suggestions = extra.suggestions;`，使錯誤回應本文可帶選用欄位 `suggestions`，其餘欄位與行為不變
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Error` — 錯誤回應本文可含的欄位以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Suggestions` — `suggestions` 的結構與出現條件以此為準
  - 📎 必讀：`research.md › R-04` — `sendError` 增加一行的做法以此為準
- [X] T002 [P] 修改 `backend/src/repositories/slotRepository.js`：新增 `findOccupiedVenueIds(conn, venueIds, slotStarts)`，以位置參數（與既有 `insertRange` 相同寫法）執行 `SELECT DISTINCT venue_id FROM booking_slots WHERE venue_id IN (…) AND slot_start_at IN (…)`，回傳有任一時段占用的場地識別 `Set`；`venueIds` 或 `slotStarts` 為空時直接回傳空 `Set`；不讀取也不回傳 `holder_id`
  - 📎 必讀：`research.md › R-03` — 一次查詢找出有占用場地的做法以此為準
  - 📎 必讀：`research.md › R-06` — 只讀 `venue_id` 與 `slot_start_at`、不讀取占用者資訊的要求以此為準
  - 📎 必讀：`spec.md › NFR-003` — 不得透露占用者與其預約內容的要求以此為準
- [X] T003 [P] 修改 `frontend/src/api/client.js`：`ApiError` 的建構參數與屬性新增 `suggestions`，`request` 在非 2xx 回應時把 `data.suggestions` 帶入；其他欄位與網路失敗（`status: 0`）的行為不變
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — 失敗回應帶 `suggestions` 的時機以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Suggestions` — 前端要保留的建議欄位以此為準
- [X] T004 修改 `backend/src/services/slotService.js`：新增 `isRangeOccupied(conn, venueId, startAt, endAt)`（以既有 `slotStartsFor` 展開區間後呼叫 `findOccupiedVenueIds`，唯讀、不寫入，回傳布林）與 `loadDayOccupied(conn, venueId, date, { excludeHolder } = {})`（以既有 `slotRepository.listOccupied` 讀取該台北日期 `fromTaipei(date, "00:00")` 到 `fromTaipei(date, "24:00")` 的占用，回傳 `slot_start_at` 毫秒時間戳的 `Set`；`excludeHolder` 為 `{ type, id }` 時略過該 holder 的列）（依賴 T002）
  - 📎 必讀：`research.md › R-02` — 當天占用的載入方式，以及 `booking_slots` 同時涵蓋預約、候補保留、維護時段的說明以此為準
  - 📎 必讀：`contracts/openapi.yaml › updateBooking` — 併發重算時須以 holder 排除本預約自己時段的要求以此為準
  - 📎 必讀：`spec.md › FR-001` — 哪些情形算「時段被占用」的定義以此為準
- [X] T005 修改 `backend/src/services/bookingService.js` 的 `createBooking`：規則失敗改為一次收集後再拋出——`validateBooking` 的違規全部保留（不再先拋出）；在交易內鎖使用者列後，暫停（`suspended`）與持有上限（`quota`）兩者都檢查並都列入（原本遇到暫停就先停）；時間格式本身合法（沒有 `time_unit`、`end_not_after_start`）時，以 `isRangeOccupied` 唯讀檢查所選區間，已占用則追加 `{ rule: "occupied", message: "該時段已被占用。請改選其他時段，或登記候補。" }`；`violations` 非空時拋出 `HttpError`：只要有 400 類規則（`time_unit`、`end_not_after_start`、`duration`、`past`、`advance`、`opening_hours`、`capacity`）就回 400，否則回 409，`violations` 全部列出且 400 類在前，`message` 取第一項的訊息；場地不存在回 404、場地停用回 409 `venue_inactive`、主題與人數欄位錯誤回 400 `fields` 維持提早回應；`violations` 為空才寫入，寫入時主鍵衝突（`OccupiedError`）的 409 `occupied` 處理維持不變（依賴 T004）
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — 流程步驟、狀態碼判定與 `violations` 並列規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Violation` — 規則代碼清單與 400／409 類別以此為準
  - 📎 必讀：`spec.md › FR-008、FR-017` — 其他規則同時未通過時須列出全部未通過規則的需求以此為準
  - 📎 必讀：`research.md › R-04` — 先做唯讀占用檢查再並列、暫停與持有上限一併檢查的決策以此為準
- [X] T006 修改 `backend/src/services/bookingService.js` 的 `updateBooking`：只調整「改場地、日期或起訖」的分支——把 `slotRepository.deleteByHolder(conn, "booking", bookingId)` 移到 `validateBooking` 之前（同一交易，失敗回滾後原預約不變），時間格式合法時以 `isRangeOccupied` 唯讀檢查新區間，占用則追加 `occupied` 並與 `validateBooking` 的違規列入同一份 `violations`；狀態碼與 `message` 規則同 T005；不重算持有筆數、不受暫停影響；前置檢查（404、403、`started`、`status`、`series_pending`）與只改主題或人數的分支不變；寫入時主鍵衝突的 409 `occupied` 處理維持不變（依賴 T004、T005）
  - 📎 必讀：`contracts/openapi.yaml › updateBooking` — 修改時先釋出原時段再判定占用、失敗回滾與狀態碼規則以此為準
  - 📎 必讀：`spec.md › FR-005` — 修改時原時段不算被占用的需求以此為準
  - 📎 必讀：`research.md › R-04` — 把刪除自己時段移到驗證之前的決策以此為準
- [X] T007 修改 `frontend/src/pages/bookingFormPage.js` 的送出流程，使一般預約、修改預約、再預約三種模式一致符合契約（依賴 T003）：
  - 送出前只攔截必填與格式錯誤：日期、開始、結束未選，結束不晚於開始，主題空白，人數不是正整數；`submitRebook` 不再因人數超過容納人數或長度超過上限而攔截；未通過時在欄位錯誤容器顯示文案並把焦點移到第一個錯誤欄位
  - 三種模式都在欄位失焦或變更時提示：結束須晚於開始、長度不超過 `ctx.rules.maxDurationMinutes`、人數為 1 以上整數且不超過所選場地容納人數；人數超過的文案在一般與修改模式用「請減少人數或改選其他場地」版本，再預約模式維持「請減少人數後再送出」版本
  - 三種模式送出時都使用 `setBusy`（表單 `aria-busy="true"`、欄位停用、按鈕顯示「送出中…」），失敗後恢復；恢復後的按鈕文字修改模式為「儲存修改」，其他為「送出預約」
  - `showErrors` 有 `violations` 時三種模式的標題都是「無法送出，以下規則未通過：」；`error.status === 0` 時顯示「無法送出預約。請檢查網路連線後再試一次。」，表單內容全部保留
  - 修改成功的結果面板文案改為「預約已更新，目前狀態：{狀態顯示文案}。」，顯示文案以 `BOOKING_STATUS_LABELS[updated.status]` 取得，不顯示狀態代碼
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 操作` — 欄位失焦與送出前檢查只攔必填與格式、其餘交內層並列回報的規則以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 狀態` — 送出中與網路失敗的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 文案與無障礙` — 錯誤清單標題、各必填文案、網路失敗與修改成功文案以此為準
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 預約狀態代碼只作判斷、畫面只顯示中文文案的規則以此為準
  - 📎 必讀：`spec.md › FR-008` — 占用與其他規則須在同一次回應並列的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 11、13` — 人數超過或持有上限與占用並列的情境以此為準
- [X] T008 修改 `frontend/src/pages/bookingFormPage.js`，加入建議區塊的外框與已填入提示的清除處理（依賴 T007）：
  - `showErrors` 在違規清單與既有「登記候補」（`booking-waitlist-link`）之後，當 `error.suggestions` 存在、`violations` 恰好只有 `occupied` 且未勾選「重複預約」時，加入外層容器 `<div data-testid="alt-suggestions">`，供各故事放入自己的區塊；其他情形不加入容器
  - 新增頁內函式 `clearAppliedNotice()`：移除表單上方既有的已填入提示 `[data-testid="alt-applied-notice"]`；使用者之後手動改動日期、開始、結束或場地任一欄位時呼叫它；三種模式在送出當下都先清空錯誤區（含舊建議）並呼叫它。本任務不定義 `applySuggestion`，由 T016 定義並使用
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — `alt-suggestions` 外層容器與 `alt-applied-notice` 的定位以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 操作` — 建議的顯示條件、點選後收起錯誤區、已填入提示與送出當下清除舊建議的規則以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 狀態` — 結果沒有附建議時只顯示規則清單與「登記候補」的規則以此為準
  - 📎 必讀：`contracts/prototype/booking-form.html › alt-suggestions、alt-applied-notice` — 外層容器與已填入提示的位置以此為準
  - 📎 必讀：`spec.md › FR-006、FR-009、FR-014` — 點選只填表單不自動送出、候補入口並存的需求以此為準

**Checkpoint**：基礎完成，撞期時「時段被占用」已與其他規則並列回報，前端收得到 `suggestions` 並具備放置建議的容器，可開始實作使用者故事

---

## Phase 2：使用者故事 1 - 撞時段時看到同場地最近的空檔（Priority: P1）🎯 MVP

**目標**：預約、修改或再預約因時段被占用被拒絕時，由後端計算同場地同一天、長度相同、較早與較晚各最近一個的空檔（API-01、API-02），前端在錯誤區顯示並讓使用者點選填回日期與時間（UI-01）。

**完成判準**：場地 A 週一 10:00–11:00 已被他人預約時，預約場地 A 週一 10:00–11:00 會被拒絕，錯誤區顯示「該時段已被占用」、「登記候補」與「同場地最近的空檔」，列出較早的 09:00–10:00 與較晚的 11:00–12:00；點選其中一個後表單的日期與起訖時間改為該建議、場地／主題／人數不變、顯示已填入提示且沒有自動送出，再按送出後預約成立；當天整天已滿或處於維護中時顯示「當天已無空檔」；同時違反人數上限或持有上限時只列出全部未通過的規則、不顯示空檔；修改預約時建議不包含這筆預約自己的原時段，原預約維持不變；「再預約一次」表單同樣顯示空檔建議。

### 後端（API-01、API-02 同場地空檔）

- [X] T009 [P] [US1] 新增 `backend/src/domain/alternatives.js`：匯出純函式 `findNearbySlots({ venue, date, startTime, endTime, attendees, rules, current, occupiedStarts, excludeWindow })`，回傳 `{ slots: { before, after }, noSlotsToday }`。做法：長度 = 結束 − 開始（分鐘）；以 30 分鐘為步進列出當天（台北日期）所有候選起點，結束最晚 `24:00`；候選成立需同時符合：以既有 `validateBooking`（`backend/src/domain/bookingRules.js`，以非空的占位主題呼叫並忽略 `status` 違規）沒有任何違規、候選涵蓋的每個 30 分鐘起點的毫秒時間戳都不在 `occupiedStarts` 內、候選不等於 `excludeWindow`（`{ date, startTime, endTime }` 或 `null`）；`before` 取起點早於所選起點的成立候選中最晚者，`after` 取起點晚於所選起點的成立候選中最早者，不跨日；每個建議為 `{ startAt, endAt }`（以 `fromTaipei` 換算後 `toISOString()` 的帶 `Z` UTC 字串，`24:00` 對應台北隔日 00:00），找不到的方向為 `null`，兩者皆 `null` 時 `noSlotsToday` 為 `true`
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — `suggestions.slots` 的選取規則（同一天、長度相同、較早與較晚各最近一個、不跨日、與送出共用同一份規則實作）以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.SlotSuggestion` — 建議的欄位與帶 `Z` 的 UTC 格式以此為準
  - 📎 必讀：`research.md › R-02` — 候選時段的演算法與重用 `validateBooking` 的決策以此為準（回傳時間格式以 openapi.yaml 為準，不採 R-02 的台北字串）
  - 📎 必讀：`spec.md › FR-002、FR-003、FR-004` — 最近空檔、符合一般預約規則、不跨日的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 1～5` — 前後都有、僅一側、整天已滿、跳過維護時段、開放時段邊界的情境以此為準
  - 📎 必讀：`spec.md › 邊界情況` — 部分重疊與 4 小時長度時的空檔選取方式以此為準
- [X] T010 [US1] 新增 `backend/src/services/alternativeService.js`：匯出 `buildSuggestions(conn, { venue, input, rules, current, excludeWindow = null, excludeHolder = null })`，其中 `input` 為 `{ date, startTime, endTime, attendees }`；以 `loadDayOccupied` 取得當天占用、呼叫 `findNearbySlots`，回傳 `{ slots, noSlotsToday, venues: [] }`（`venues` 在本故事固定為空陣列，由使用者故事 2 計算）（依賴 T004、T009）
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Suggestions` — `slots`、`noSlotsToday`、`venues` 三個必填欄位以此為準
  - 📎 必讀：`research.md › R-06` — 建議為唯讀計算、不保留時段、不寫入資料的決策以此為準
- [X] T011 [US1] 修改 `backend/src/services/bookingService.js` 的 `createBooking`：`violations` 恰好只有 `occupied` 一項時，在同一交易內呼叫 `buildSuggestions` 並拋出 `new HttpError(409, message, { violations, suggestions })`；其他情形（含占用併其他規則）一律不附 `suggestions`。寫入時主鍵衝突（`OccupiedError`）回滾後，改在新的 `withTransaction` 唯讀交易內重新載入規則與場地並呼叫 `buildSuggestions`，以最新占用狀況附上建議後回 409（依賴 T001、T005、T010）
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — `suggestions` 的出現條件與併發衝突時重算建議的規定以此為準
  - 📎 必讀：`spec.md › FR-001、FR-007、FR-008` — 只有占用時才附建議、送出後重新檢查並重附建議、其他規則並列時不附的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 8` — 建議被他人搶走後重新顯示依最新狀況計算的建議的情境以此為準
  - 📎 必讀：`spec.md › NFR-001、NFR-002` — 2 秒內回應、不得繞過預約規則或出現重疊預約的要求以此為準
- [X] T012 [US1] 修改 `backend/src/services/bookingService.js` 的 `updateBooking`：與 T011 相同地在 `violations` 恰好只有 `occupied` 時附 `buildSuggestions` 的結果；`excludeWindow` 在場地未改時傳入原預約的 `{ date, startTime, endTime }`（台北當地，結束為隔日 00:00 時寫 `24:00`），場地已改為另一個場地時傳 `null`；寫入時主鍵衝突回滾後的唯讀重算，`excludeHolder` 傳入 `{ type: "booking", id: bookingId }`，避免把尚未釋出的原時段誤算為被占用（依賴 T006、T010、T011）
  - 📎 必讀：`contracts/openapi.yaml › updateBooking` — 修改模式的建議計算差異、排除原時段與併發重算規定以此為準
  - 📎 必讀：`spec.md › FR-005` — 建議不得包含這筆預約自己的原時段的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 9` — 修改預約撞期時建議與原預約維持不變的情境以此為準

### 前端（UI-01）

- [X] T013 [P] [US1] 修改 `shared/src/copy.js`：新增並匯出 `ALT_TEXT` 常數，內容逐字取自 UI 契約——空檔區塊標題「同場地最近的空檔」與說明、方向小字「較早」「較晚」、空檔按鈕無障礙名稱樣板、「當天已無空檔」、已填入提示（時段）樣板
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 文案與無障礙` — 空檔區塊的標題、說明、方向小字、無障礙名稱、空狀態與已填入提示文案以此為準
- [X] T014 [P] [US1] 修改 `frontend/src/styles/components.css`：為建議外層 `alt-suggestions`、空檔區塊 `alt-slots`、空檔按鈕與方向小字、空狀態 `alt-slots-empty`、已填入提示 `alt-applied-notice` 加上樣式——按鈕可點目標至少 44 像素高；按鈕以 `display: flex; flex-wrap: wrap` 排列，寬度 360 像素時上下換行、不橫向溢出、不需水平捲動；方向以文字呈現，不只靠顏色
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 版面斷點、窄螢幕換行與 44 像素可點目標的要求以此為準
  - 📎 必讀：`contracts/prototype/booking-form.html › alt-slots、alt-slot-before、alt-slot-after、alt-slots-empty` — 空檔區塊的結構與位置以此為準
  - 📎 必讀：`spec.md › NFR-005` — 360 像素寬不得水平捲動的要求以此為準
- [X] T015 [US1] 新增 `frontend/src/components/suggestions.js`：匯出 `renderSlotSuggestions(suggestions, { onPick })`，回傳以標題 `aria-labelledby` 命名的 `<section data-testid="alt-slots">`，含標題、說明與最多兩顆 `<button type="button">`（`alt-slot-before`、`alt-slot-after`），按鈕文字為 `HH:mm–HH:mm` 加方向小字，無障礙名稱依契約樣板；以 `shared/src/taipei.js` 的 `toTaipeiParts` 把 `startAt`、`endAt` 換算為台北日期與時分（結束落在台北隔日 00:00 時寫成 `24:00`），按下時呼叫 `onPick({ date, startTime, endTime })`；某方向為 `null` 時不渲染該按鈕，`noSlotsToday` 為 `true` 時改渲染「當天已無空檔」（`alt-slots-empty`）；不顯示任何占用者資訊（依賴 T013）
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 操作` — 空檔按鈕、空狀態與點選填回的互動以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 文案與無障礙` — 按鈕文字、無障礙名稱與區塊無障礙的要求以此為準
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 內層時間點為 UTC、前端換算為台北時間後顯示與填回表單的規則以此為準
  - 📎 必讀：`contracts/prototype/booking-form.html › alt-slot-before、alt-slot-after、alt-slots-empty` — 空檔按鈕與空狀態的結構以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.SlotSuggestions` — `before`、`after` 可為 `null` 的規則以此為準
- [X] T016 [US1] 修改 `frontend/src/pages/bookingFormPage.js`：新增頁內函式 `applySuggestion(changes, noticeText)`（定義移自 T008）並修改 `showErrors`：T008 的 `alt-suggestions` 容器存在時，放入 `renderSlotSuggestions(error.suggestions, { onPick })`，`onPick` 以 `applySuggestion({ date, startTime, endTime }, …)` 填回日期與時間，提示文字用 `ALT_TEXT` 的已填入提示（時段）樣板，代入台北日期、起訖與目前送出按鈕文字；一般、修改、再預約三種模式都顯示，再預約的唯讀場地維持不變（依賴 T008、T015）
  - 新增頁內函式 `applySuggestion(changes, noticeText)`：把 `changes` 中的日期、開始、結束或場地寫入對應欄位（改場地時呼叫既有 `updateInfo()`），清除錯誤區與所有欄位錯誤，在表單上方顯示已填入提示 `<div role="status" data-testid="alt-applied-notice">`（文字為 `noticeText`），焦點移到 `booking-submit`，不送出
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 操作` — 三種表單都顯示空檔建議、點選後只改日期與時間的規則以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 › 文案與無障礙` — 已填入提示（時段）的文案以此為準
  - 📎 必讀：`spec.md › FR-006、FR-007` — 點選只填表單、送出時重新套用全部規則的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 1 › 驗收情境 6、7、10、12` — 點選後尚未送出、送出成功、再預約、候補入口並存的情境以此為準

**Checkpoint**：使用者故事 1 完成，對照完成判準在執行中的應用程式內操作確認

---

## Phase 3：使用者故事 2 - 撞時段時看到同時段其他可用場地（Priority: P2）

**目標**：預約或修改因時段被占用被拒絕時，由後端找出同時段其他可直接預約的場地（API-01、API-02），前端在空檔建議下方列出並讓使用者點選換場地（UI-02）；「再預約一次」表單不顯示。

**完成判準**：場地 A 週一 10:00–11:00 被占用、場地 B（不需審核）與場地 C（需審核）同時段空閒且容納人數足夠時，預約場地 A 該時段被拒絕後，錯誤區在空檔建議下方顯示「同時段其他可用場地」，列出場地 B 與帶「需審核」標籤的場地 C，且不需審核者在前；容納人數不足、已停用、該時段被占用或不在開放時段的場地不會出現；點選場地 B 後表單的場地改為 B、場地資訊同步更新、日期／時間／主題／人數不變、顯示已填入提示且沒有自動送出；選需審核的場地送出後為待審核；沒有任何可用場地時顯示「此時段沒有其他可用場地」；超過 5 個時只列前 5 個；「再預約一次」表單不顯示本區塊；同時違反人數上限時只列規則、不顯示場地。

### 後端（API-01、API-02 其他場地）

- [X] T017 [P] [US2] 修改 `backend/src/domain/alternatives.js`：新增並匯出純函式 `rankVenueSuggestions(venues, limit = 5)`，輸入為已通過篩選的場地，依 `requires_approval` 為 false 者在前、true 者在後，同組內以 `a.name.localeCompare(b.name, "zh-Hant")` 排序，取前 `limit` 個，回傳每個場地 `{ venueId, name, capacity, requiresApproval }`（不含 `location` 與任何占用者資訊）
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.VenueSuggestion` — 場地建議的欄位以此為準
  - 📎 必讀：`research.md › R-03` — 排序方式與數量上限的決策以此為準（欄位以 openapi.yaml 為準，不含 `location`）
  - 📎 必讀：`spec.md › FR-012、FR-018` — 需審核者標示、排序與數量上限的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 2 › 驗收情境 10` — 7 個可用場地只列 5 個且依序排列的情境以此為準
- [X] T018 [US2] 修改 `backend/src/services/alternativeService.js` 的 `buildSuggestions`：以 `venues` 的計算取代 T010 的空陣列——以既有 `venueRepository.listActive(conn)` 取得啟用中場地，排除 `venue.id`，對每個場地以 `validateBooking`（占位主題、忽略 `status` 違規）檢查 `input` 的日期與起訖，只保留沒有違規者（同時篩掉開放時段不符與容納人數不足），再以 `findOccupiedVenueIds` 一次批次查詢排除該時段有占用的場地（不得對每個場地各查一次占用，以維持 NFR-001 的 2 秒內回應），最後交給 `rankVenueSuggestions`；不比對設備與地點（依賴 T002、T010、T017）
  - 📎 必讀：`contracts/openapi.yaml › createBooking` — `suggestions.venues` 的篩選條件以此為準
  - 📎 必讀：`contracts/openapi.yaml › updateBooking` — 修改模式下原場地也可能被列入的規定以此為準
  - 📎 必讀：`research.md › R-03` — 場地建議的計算步驟與已知限制以此為準
  - 📎 必讀：`spec.md › FR-010、FR-011、FR-013` — 同時段其他可用場地、篩選條件與無可用場地的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 2 › 驗收情境 1～4、8` — 需審核標示、人數不足、停用或占用的場地被排除、無可用場地、修改預約撞期的情境以此為準

### 前端（UI-02）

- [X] T019 [P] [US2] 修改 `shared/src/copy.js`：在 `ALT_TEXT` 新增場地建議文案，逐字取自 UI 契約——區塊標題「同時段其他可用場地」與說明、場地按鈕文字與無障礙名稱樣板、「需審核」標籤與底部說明、「此時段沒有其他可用場地」、已填入提示（場地）樣板
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 文案與無障礙` — 場地區塊的標題、按鈕、標籤、空狀態與已填入提示文案以此為準
- [X] T020 [P] [US2] 修改 `frontend/src/styles/components.css`：為場地區塊 `alt-venues`、場地按鈕 `alt-venue-option`、需審核標籤 `alt-venue-approval`、空狀態 `alt-venues-empty` 加上樣式——按鈕可點目標至少 44 像素高；寬度 360 像素時換行、不橫向溢出；「需審核」以文字標籤呈現，不只靠顏色
  - 📎 必讀：`contracts/ui-contract.md › 共用約定` — 版面斷點、窄螢幕換行與狀態不只靠顏色的要求以此為準
  - 📎 必讀：`contracts/prototype/booking-form.html › alt-venues、alt-venue-option、alt-venue-approval、alt-venues-empty` — 場地區塊的結構與位置以此為準
  - 📎 必讀：`spec.md › NFR-005` — 360 像素寬不得水平捲動的要求以此為準
- [X] T021 [US2] 修改 `frontend/src/components/suggestions.js`：新增並匯出 `renderVenueSuggestions(venues, { onPick })`，回傳以標題 `aria-labelledby` 命名的 `<section data-testid="alt-venues">`，含標題、說明與場地按鈕 `<button type="button" data-testid="alt-venue-option" data-id="{venueId}">`（文字為場地名稱與「可容納 N 人」，`requiresApproval` 為 `true` 時加「需審核」標籤 `alt-venue-approval`，無障礙名稱依契約樣板）；順序與數量完全依後端結果；清單中有需審核的場地時區塊底部加一行需審核說明；`venues` 為空陣列時改渲染「此時段沒有其他可用場地」（`alt-venues-empty`）；按下時呼叫 `onPick(venue)`（依賴 T015、T019）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 操作` — 場地按鈕、需審核標籤、空狀態與點選換場地的互動以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 文案與無障礙` — 按鈕文字、無障礙名稱與區塊無障礙的要求以此為準
  - 📎 必讀：`contracts/prototype/booking-form.html › alt-venue-option、alt-venue-approval、alt-venues-empty` — 場地按鈕與空狀態的結構以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.VenueSuggestion` — 場地建議的欄位以此為準
- [X] T022 [US2] 修改 `frontend/src/pages/bookingFormPage.js` 的 `showErrors`：在 T016 的空檔區塊之後，非再預約模式（一般與修改）才放入 `renderVenueSuggestions(error.suggestions.venues, { onPick })`；再預約模式一律不渲染，包含「此時段沒有其他可用場地」的空狀態文字，即使後端有回傳也不渲染；`onPick` 以 `applySuggestion({ venueId }, …)` 改場地並更新 `booking-venue-info`，日期、起訖、主題、人數不動，提示文字用 `ALT_TEXT` 的已填入提示（場地）樣板（依賴 T016、T021）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 操作` — 顯示條件、再預約不顯示、點選換場地與已填入提示的規則以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 › 狀態` — 成功、空狀態與錯誤各狀態的呈現以此為準
  - 📎 必讀：`spec.md › FR-014、FR-015、FR-016、FR-017` — 點選只換場地、送出後依場地判定狀態、再預約不顯示、其他規則並列時不顯示的需求以此為準
  - 📎 必讀：`spec.md › 使用者故事 2 › 驗收情境 5～7、9、11` — 點選換場地、需審核場地送出、建議被搶走、再預約不顯示、占用併人數超過的情境以此為準

**Checkpoint**：使用者故事 2 完成，對照完成判準在執行中的應用程式內操作確認

---

## Phase 4：Polish 與跨領域事項

**目的**：全專案程式品質收尾

- [X] T023 [P] 執行 `npm run lint` 與 `npm run format`，修正本功能新增與修改的檔案所產生的問題
  - 📎 必讀：`techstack.md › 開發工具` — lint 與格式化工具以此為準

---

## 相依與執行順序

### 階段相依

- **Setup**：本功能沒有（既有專案已具備，techstack.md 未新增套件）
- **Foundational（Phase 1）**：無相依，可立即開始，阻擋所有使用者故事
- **使用者故事（Phase 2～3）**：皆依賴 Foundational 完成，之後依優先順序 P1 → P2 執行
- **Polish（Phase 4）**：依賴所有使用者故事完成

### 使用者故事相依

- **US1（P1）**：只依賴 Foundational；建立 `alternatives.js`、`alternativeService.js`、`suggestions.js` 與 `ALT_TEXT`
- **US2（P2）**：依賴 Foundational 與 US1——openapi.yaml 規定每次附建議都必須同時含 `slots` 與 `venues`，US2 在 US1 建立的 `buildSuggestions`、`suggestions.js` 與 `ALT_TEXT` 上擴充（T018 依賴 T010、T021 依賴 T015、T022 依賴 T016）；完成判準仍可單獨對照

### 各故事內部順序

- 端點依序：後端、前端；故事未涉及的端點不列出
- 同一檔案的任務依序執行（`bookingService.js`：T005 → T006 → T011 → T012；`bookingFormPage.js`：T007 → T008 → T016 → T022；`alternatives.js`：T009 → T017；`alternativeService.js`：T010 → T018；`suggestions.js`：T015 → T021；`copy.js`：T013 → T019；`components.css`：T014 → T020）

### 並行機會

- Foundational：T001、T002、T003 檔案不同且互不依賴，可同時進行
- 使用者故事 1：後端 T009 與前端 T013、T014 檔案不同，可同時進行
- 使用者故事 2：後端 T017 與前端 T019、T020 檔案不同，可同時進行
- 不同故事的不同端點可由不同人員同時進行（注意共用檔案）

---

## 並行範例：使用者故事 1

```bash
# 後端與前端的起手任務可同時進行：
Task: "T009 新增 alternatives.js 的 findNearbySlots 純函式"
Task: "T013 在 shared/src/copy.js 新增空檔建議文案 ALT_TEXT"
Task: "T014 在 components.css 加入空檔建議區塊的版面樣式"
```

---

## 並行範例：使用者故事 2

```bash
# 後端與前端的起手任務可同時進行：
Task: "T017 在 alternatives.js 新增 rankVenueSuggestions 純函式"
Task: "T019 在 shared/src/copy.js 的 ALT_TEXT 新增場地建議文案"
Task: "T020 在 components.css 加入場地建議區塊的版面樣式"
```

---

## 實作策略

### MVP 優先（只做使用者故事 1）

1. 完成 Phase 1：Foundational（阻擋所有故事）
2. 完成 Phase 2：US1
3. **停下並驗證**：對照 US1 完成判準，在一般、修改、再預約三種表單製造撞期，確認前後空檔、當天已無空檔、點選填回與規則並列
4. 可展示：預約被占用的時段，一鍵改選最近的空檔

### 漸進交付

1. Foundational → 基礎就緒（撞期時規則並列回報）
2. 加入 US1 → 對照完成判準 → 展示（撞期時一鍵改選最近的空檔）
3. 加入 US2 → 對照完成判準 → 展示（撞期時一鍵改選其他可用場地）
4. Phase 4 → 全專案 lint 與格式化

### 團隊並行策略

1. 全員完成 Foundational
2. 之後依端點分工：

- 開發者 A：後端（T009～T012、T017～T018）
- 開發者 B：前端（T013～T016、T019～T022）

3. 共用檔案（`backend/src/services/bookingService.js`、`frontend/src/pages/bookingFormPage.js`）依故事順序合併

---

## 備註

- [P] 任務 = 不同檔案、無相依
- [Story] 標籤讓任務可追溯到使用者故事
- 每個使用者故事都應可獨立完成，並以完成判準確認
- 每完成一個任務或一組邏輯任務即提交
- 可在任一 Checkpoint 停下，對照完成判準確認該故事
- 避免：模糊任務、同檔案衝突、破壞獨立性的跨故事相依

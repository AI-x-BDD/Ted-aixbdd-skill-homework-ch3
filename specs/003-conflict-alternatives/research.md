# 研究紀錄（Phase 0）：預約衝突時推薦替代時段／場地

**功能分支**：`003-conflict-alternatives` | **日期**：2026-11-07 | **規格**：[spec.md](./spec.md)

使用者於規劃階段指定的技術方向：

- （使用者未另外指定技術方向。）

---

## R-01 沿用現有技術堆疊且不新增套件

- **對應需求**：跨領域
- **決策**：本功能直接在現有專案內開發，沿用 001-venue-booking、002-rebook-reservation 已採用的環境與技術：Node.js 24 LTS、JavaScript（ES Modules）、MySQL 8.4 LTS 以上、npm workspaces（根 `package.json` 目前的 workspaces 為 `frontend`、`backend`、`shared`；`e2e` 見 R-09），前端為 `vite@^8.0.0` 搭配原生 HTML、CSS、JavaScript，後端為 `node:http` 加 `mysql2@^3.24.0`，測試為 `node:test`、`@cucumber/cucumber@^13.0.0`、`playwright@^1.65.0`，品質工具為 `eslint@^10.0.0`、`prettier@^3.9.0`。本功能**新增 0 個套件**，也不新增資料表、欄位與遷移。
- **理由**：替代建議的全部輸入資料（場地、開放時段、時段占用）都已在現有資料表內（見 R-02），沒有任何一項需求需要新的執行期能力；另起一套技術會讓同一專案出現兩種做法。
- **考慮過的替代方案**：為「空檔區間」計算引入日期或區間運算套件，需求只有同一天內以 30 分鐘為單位的比對，內建的 `Date` 與整數分鐘運算已足夠，因此不採用。

## R-02 同場地空檔建議的計算

- **對應需求**：FR-001、FR-002、FR-003、FR-004、FR-005、US1、US1-1、US1-2、US1-3、US1-4、US1-5
- **決策**：新增純函式模組 `backend/src/domain/alternatives.js`，匯出 `findNearbySlots({ venue, date, startTime, endTime, attendees, occupiedStarts, excludeWindow, rules, current })`，回傳 `{ slots: { before, after }, noSlotsToday }`，`before`、`after` 各為 `{ startAt, endAt }`（帶 `Z` 的 UTC ISO 8601 字串，依 C-SH-02 與 openapi.yaml 的 `SlotSuggestion`）或 `null`。演算法如下：
  1. 把所選時段轉成整數分鐘，長度 `length = end - start`（30 分鐘的倍數）。
  2. 以 30 分鐘為步進，列出當天（台北日期）所有候選起點 `s`，候選時段為 `[s, s + length)`，結束時間最晚 `24:00`。
  3. 一個候選成立的條件全部成立：(a) 以既有的 `validateBooking`（`backend/src/domain/bookingRules.js`）檢查，除 `status` 外沒有任何違規，這一步一次涵蓋 30 分鐘單位、時長上限、不早於現在、可預約日期範圍、開放時段、人數上限，不另外複製規則；(b) 候選涵蓋的每個 30 分鐘起點都不在 `occupiedStarts` 內；(c) 候選不等於 `excludeWindow`。
  4. `before` 取起點小於所選起點的成立候選中起點最大者，`after` 取起點大於所選起點的成立候選中起點最小者；不跨日。兩者都為 `null` 時，回應的 `noSlotsToday` 為 `true`。
  5. `occupiedStarts` 由新增的 `slotService.loadDayOccupied(conn, venueId, date)` 取得：以既有的 `slotRepository.listOccupied(conn, venueId, 當日 00:00, 隔日 00:00)` 一次查詢，回傳當天該場地所有 `booking_slots` 的起點集合。`booking_slots` 的 `holder_type` 本來就涵蓋 `booking`、`hold`（候補保留）、`maintenance`（維護時段）三種（見 001 的 R-07），與規格「與有效預約、候補保留或維護時段重疊」的定義完全一致，因此不需要分別查詢三種來源。
  6. 修改預約時：自己的時段已在同一交易內以 `slotRepository.deleteByHolder` 移除（既有流程），所以 `occupiedStarts` 不含自己的原時段（FR-005 前半）；`excludeWindow` 傳入原預約的日期與起訖時間（場地未變時），避免把原時段列為建議（FR-005 後半）；建立與再預約時 `excludeWindow` 為 `null`。
- **理由**：`booking_slots` 以 `(venue_id, slot_start_at)` 為主鍵，每個 30 分鐘一列，空檔判斷就是整數集合的成員檢查，單日一次查詢即可；把規則檢查交給既有的 `validateBooking`，日後規則數字被管理員調整（見 001 的 R-15）時，建議會自動跟著新值，不會出現建議合法但送出被拒的分歧（SC-002）。純函式可以不連資料庫，用表格窮舉測試。
- **考慮過的替代方案**：用 SQL 的自連接或視窗函式直接找出空檔，規則（開放時段、時長上限、可預約日期範圍）散落在 SQL 與 `validateBooking` 兩處，日後調整規則時容易只改到一處；在記憶體中以純函式計算則只有一處規則來源。

## R-03 其他可用場地建議的計算

- **對應需求**：FR-010、FR-011、FR-012、FR-013、FR-018、US2、US2-1、US2-2、US2-3、US2-4、US2-10
- **決策**：新增 `backend/src/domain/alternatives.js` 的純函式 `rankVenueSuggestions(venues, limit = 5)`，並在 `backend/src/services/alternativeService.js` 組合資料：
  1. 以既有的 `venueRepository.listActive(conn)` 取得所有啟用中場地（已附開放時段，且依名稱排序）。
  2. 排除目前場地，並以 `validateBooking`（R-02 步驟 3(a)）逐一檢查「所選日期與起訖時間」，只保留沒有違規的場地；這一步同時篩掉開放時段不符與容納人數不足的場地，不比對設備與地點（FR-011）。
  3. 對剩下的場地，以新增的 `slotRepository.findOccupiedVenueIds(conn, venueIds, slotStarts)` 一次查詢：`SELECT DISTINCT venue_id FROM booking_slots WHERE venue_id IN (…) AND slot_start_at IN (…)`，以位置參數展開，與既有 `insertRange` 相同寫法；回傳的場地即為該時段有預約、候補保留或維護時段者，予以排除。
  4. 排序：`requires_approval` 為 0 者在前，其餘為 1；同組內以 `localeCompare(其他, "zh-Hant")` 依場地名稱排序；取前 5 個（FR-018）。
  5. 回傳每個場地的 `{ venueId, name, capacity, requiresApproval }`（不含 `location`：規格不比對地點，介面也不顯示），其中 `requiresApproval` 為 `true` 時前端標示「需審核」（FR-012）。
- **理由**：場地數量為數十個等級，逐一以 `validateBooking` 檢查可重用規則（見 R-02）；占用判斷合併成一次查詢，避免對每個場地各查一次。Node 24 內建完整的 ICU，`localeCompare` 的 `zh-Hant` 排序不需額外套件。
- **已知限制**：`venueRepository.listActive` 對每個場地各查一次開放時段（既有寫法），場地數量成長到數百個時會變慢；本功能場地規模為公司內部數十個，且完整回應時間以 NFR-001 的 2 秒量測驗證（見 R-09），超過時再優化為批次查詢。
- **考慮過的替代方案**：沿用既有的 `venueRepository.search`（001 的「依日期、時段、人數、設備篩選場地」），該查詢帶有設備條件且不含「排除目前場地、需審核標示、排序與數量上限」，要改的地方比新增一個專用函式更多，也會影響既有搜尋行為，因此不採用。

## R-04 觸發條件、規則並列與回應格式

- **對應需求**：FR-001、FR-008、FR-009、FR-017、FR-016、NFR-003、US1-11、US1-12、US1-13、US2-9、US2-11
- **決策**：不新增端點，沿用 `POST /api/bookings`（建立與再預約，見 002 的 R-02）與 `PUT /api/bookings/:bookingId`（修改，現有路由與 001 的 openapi.yaml 都是 `PUT` 加完整的請求本文）；失敗回應的 `409` 或 `400` 本文仍是 `{ message, violations }`，新增選用欄位 `suggestions`。做法如下：
  1. `backend/src/lib/http.js` 的 `sendError` 增加一行：`if (extra.suggestions) body.suggestions = extra.suggestions;`，與既有的 `conflicts`、`impact` 同一寫法。
  2. `suggestions` 結構為 `{ slots: { before, after }, noSlotsToday, venues: [...] }`（內容見 R-02、R-03），只在失敗原因**只有** `occupied` 時才出現。
  3. 建立預約（`bookingService.createBooking`）：既有流程是 `validateBooking`（全部收集）→ 暫停 → 持有上限 → 寫入時由主鍵衝突得知占用。為了讓「占用」與其他規則並列（FR-008、FR-017），改為：在拋出任何規則失敗之前，先用 `slotService.isRangeOccupied(conn, venueId, startAt, endAt)`（一次 `findOccupiedVenueIds` 查詢）做唯讀檢查；時間格式本身不合法（`time_unit`、`end_not_after_start`）時略過此檢查。暫停與持有上限改為兩者都檢查後一併列入 `violations`（原本遇到暫停就先停）。若已檢查出占用，則 `violations` 追加 `{ rule: "occupied", message }`；`violations` 只剩 `occupied` 時才附 `suggestions`，否則不附。HTTP 狀態碼沿用最先發現的那條規則的狀態碼（驗證類為 `400`，其餘為 `409`）。
  4. 寫入時的主鍵衝突（`OccupiedError`，兩人幾乎同時送出時才會發生）維持原本的 `409 occupied` 處理，並同樣附 `suggestions`：在交易回滾後以新的交易讀取最新占用狀況計算。
  5. 修改預約（`bookingService.updateBooking`）：把 `slotRepository.deleteByHolder` 移到 `validateBooking` 之前（同一交易，失敗時回滾，原預約不受影響），之後與建立相同；`excludeWindow` 傳入原預約時段（R-02 步驟 6）。
  6. 是否顯示其他場地的建議由前端決定：後端兩種建議都回傳，再預約模式（`rebookMode`，見 002 的 R-02）的前端不渲染 `venues`（FR-016）。
- **理由**：「占用」目前只在寫入時才被發現，導致同時違反持有上限時只看得到持有上限（US1-13）；先做唯讀檢查再並列，能一次回報全部（FR-008）。再預約與一般預約走同一個端點，後端無法也不需要區分（002 的 R-02 第 6 點已決定場地固定只是前端限制）。`suggestions` 為選用欄位，舊版前端忽略它仍可運作。
- **規格解讀**：spec.md 的「顯示全部未通過的規則」在現有程式中，驗證類規則本來就一次回報；暫停與持有上限原本是依序檢查、遇到即停，本研究採用「兩者一併檢查」，讓規格的「所有」成立。
- **考慮過的替代方案**：新增獨立端點 `GET /api/bookings/alternatives`，前端在收到拒絕後再打一次，多一次往返且兩次呼叫之間狀況可能改變；回應內夾帶可避免這個差異，也只算一次占用資料。

## R-05 前端呈現與點選行為

- **對應需求**：FR-006、FR-009、FR-014、FR-016、NFR-004、NFR-005、US1-6、US1-12、US2-5、US2-9
- **決策**：在 `frontend/src/pages/bookingFormPage.js` 既有的 `showErrors` 之後，新增 `renderSuggestions(errBox, error.suggestions)`，並在新檔 `frontend/src/components/suggestions.js` 實作（沿用 001 的 R-16 元件寫法，函式回傳 DOM 節點）：
  1. 「同場地空檔」區塊標題「同場地最近的空檔」，每個建議為 `<button type="button">`，文字為 `HH:mm–HH:mm`（日期相同故不重複顯示；後端回傳帶 `Z` 的 UTC 起訖，前端以 `shared/src/taipei.js` 的 `toTaipeiParts` 換算為台北日期與時分，結束落在台北隔日 00:00 時寫成 `24:00`，見 R-08）；`noSlotsToday` 為 `true` 時顯示「當天已無空檔」。
  2. 「其他可用場地」區塊（非再預約模式才渲染）：每個場地一顆 `<button type="button">`，文字為場地名稱與容納人數，需審核者加上「需審核」標籤；`venues` 為空時顯示「此時段沒有其他可用場地」。
  3. 點選空檔只改日期、開始、結束三個欄位，並清除該次錯誤區塊；點選場地只改場地欄位，並清除錯誤區塊；兩者都**不呼叫**送出（FR-006、FR-014），主題與人數不動。
  4. 既有的「登記候補」按鈕維持原位（FR-009）。
  5. 所有新文案放 `shared/src/copy.js`，與既有文案同一處；樣式加在 `frontend/src/styles/components.css`，建議按鈕以 `display: flex; flex-wrap: wrap; gap` 排列，每顆最小高度 44px，360 像素寬時換行而不水平捲動（NFR-005）。
  6. 錯誤文字不顯示內部規則代碼，只顯示 `message`（NFR-004）。
  7. `frontend/src/api/client.js` 的 `ApiError` 原本只帶出 `violations`、`conflicts`、`impact`，需新增 `suggestions` 屬性並在非 2xx 回應時帶入，否則前端收不到後端的建議。
- **理由**：點選建議只是改表單欄位，送出仍走完整的建立或修改流程（R-04），就不需要在前端複製任何規則；用實際的 `<button>` 可用鍵盤與觸控操作。
- **考慮過的替代方案**：點選後自動送出，少一步但與規格 FR-006、FR-014「不得自動送出」衝突，且使用者來不及確認被帶入的值，因此不採用。

## R-06 建議的即時性、併發與隱私

- **對應需求**：FR-007、FR-015、NFR-002、NFR-003、SC-006
- **決策**：建議只是唯讀計算結果，不保留任何時段、不寫入任何資料：
  1. 建議顯示之後狀況改變時，送出仍走既有的建立或修改流程，由 `booking_slots` 主鍵與交易保證不會出現重疊（見 001 的 R-07）；失敗時依 R-04 第 4 點重新附上最新建議（FR-007、FR-015）。
  2. `suggestions` 的內容只含時間點與場地公開欄位（`venueId`、`name`、`capacity`、`requiresApproval`），**不回傳**預約者、主題或人數（NFR-003、SC-006）。建立預約與其他場地建議的占用查詢只讀 `booking_slots` 的 `venue_id` 與 `slot_start_at`；只有修改預約為了排除本預約自己的時段，才在後端內部讀 `holder_type`、`holder_id` 做過濾，這些欄位不進入回應，也不用於判斷占用者是誰。
- **理由**：保留時段會與候補保留（見 001 的 R-11）互相衝突，也會讓未被採用的建議長時間占住時段；唯讀計算加送出時完整檢查，是不新增任何競態的做法。
- **考慮過的替代方案**：為點選的建議短暫保留 30 秒，防止點選到送出之間被搶走，但會多一種占用類型與清理排程，效益不高。

## R-07 回應時間

- **對應需求**：NFR-001
- **決策**：不加快取，也不新增索引。撞期失敗路徑的額外查詢為：同場地當天占用 1 次（`slotRepository.listOccupied`，使用既有主鍵）、啟用中場地清單 1 次加每個場地的開放時段各 1 次（`venueRepository.listActive` 既有寫法）、其他場地的占用 1 次（`findOccupiedVenueIds`）。以 `node:test` 在含 50 個場地、一年預約資料的測試資料上量測整個失敗請求，目標 2 秒內（見 R-09）。
- **理由**：主鍵 `(venue_id, slot_start_at)` 已覆蓋全部時間範圍查詢；公司內部場地規模不需要快取，快取還會讓建議與實際占用不同步，違反 R-06。
- **已知限制**：場地數量遠大於 50 時，`listActive` 的逐場地查詢會成為瓶頸（見 R-03），到時再改批次查詢。
- **考慮過的替代方案**：以場地清單做行程內快取，但場地停用或開放時段被編輯時要同步失效，與 001 的 R-15 規則變更立即生效的要求衝突。

## R-08 時間與日期的處理

- **對應需求**：NFR-004、FR-002、FR-003
- **決策**：日期與時間一律沿用 `shared/src/taipei.js` 的 `fromTaipei`、`toTaipeiParts`（見 001 的 R-06）。候選時段以台北日期的整數分鐘計算，轉換成資料庫起點時以 `fromTaipei(date, "HH:mm")` 產生；結束 `24:00` 與既有 `bookingRules.js` 的處理相同。後端回傳的建議起訖是帶 `Z` 的 UTC ISO 8601 時間點（`startAt`、`endAt`，結束為當天結束時是台北隔日 00:00），前端以 `toTaipeiParts` 換算為台北日期與時分後顯示，也以換算後的值填回表單；換算一律使用台北時區，不使用裝置時區。
- **理由**：專案內已有統一的台北時間函式，另寫一套會造成跨日邊界（00:00、24:00）處理不一致；API 回應的時間點用 UTC 是 C-SH-02 的要求，與 001、002 的 `Booking.startAt`、`endAt` 一致，NFR-004 的「以台北時間顯示」由前端固定以台北時區換算來滿足，不依賴使用者裝置時區。
- **考慮過的替代方案**：由後端直接回傳台北時間的 `date`、`startTime`、`endTime` 字串，前端不需換算，但與 C-SH-02 第 1 點（API 回應的時間點必須是帶 `Z` 的 UTC）衝突，因此不採用。

## R-09 測試策略

- **對應需求**：SC-001、SC-002、SC-003、SC-004、SC-005、SC-006、NFR-001、NFR-003、US1、US2
- **決策**：沿用 001 的分層（見 001 的 R-17），新增內容如下：
  1. 單元：`backend/src/domain/alternatives.js` 為純函式，用 `node:test` 以表格窮舉 US1-1～US1-5 的情境（前後空檔、僅一側、整天已滿、跳過維護、開放時段邊界、4 小時長度、排除原時段）與 `rankVenueSuggestions` 的排序與 5 個上限。
  2. 後端整合：`node:test` 加內建 `fetch`，驗證 `POST /api/bookings` 與 `PUT /api/bookings/:bookingId` 撞期時的 `suggestions`、占用併上限時的 `violations` 並列且無 `suggestions`、回應不含 `holder_id` 與預約主題（NFR-003），並量測 NFR-001 的 2 秒。
  3. 驗收（BDD）：新增 `e2e/features/conflict-alternatives.feature`，第一行 `# language: zh-TW`，涵蓋 spec.md 兩個故事的全部驗收情境；360×740 行動視窗重跑一輪（SC-005）。
  4. SC-004（10 位員工中至少 9 位 15 秒內完成）需真人可用性測試，不納入自動化。
- **理由**：計算核心是純函式，用表格測試比透過瀏覽器更快更穩定（SC-001、SC-002、SC-003 都要求 100% 正確）；驗收情境本來就是假設、當、那麼，直接對應 Cucumber。
- **已知限制**：目前根 `package.json` 的 workspaces 只有 `frontend`、`backend`、`shared`，001 與 002 規劃的 `e2e` 尚未建立，驗收檔案要等 `e2e` 建立後才能落地；本功能不負責建立 `e2e`，套件安裝清單沿用 002 的宣告。

# 研究紀錄（Phase 0）：我的收藏場地與常用預設值

**功能分支**：`004-favorite-venues-and-defaults` | **日期**：2026-11-08 | **規格**：[spec.md](./spec.md)

使用者於規劃階段指定的技術方向：

- （使用者未另外指定技術方向。）

---

## R-01 沿用現有技術堆疊且不新增套件

- **對應需求**：跨領域
- **決策**：本功能直接在現有專案內開發，沿用 001-venue-booking、002-rebook-reservation、003-conflict-alternatives 已採用的環境與技術：Node.js 24 LTS、JavaScript（ES Modules）、MySQL 8.4 LTS 以上、npm workspaces（根 `package.json` 目前的 workspaces 為 `frontend`、`backend`、`shared`），前端為 `vite@^8.0.0` 搭配原生 HTML、CSS、JavaScript，後端為 `node:http` 搭配 `mysql2@^3.24.0`，測試為 `node:test`，Lint 與格式化為 `eslint@^10.0.0`、`prettier@^3.9.0`。不新增任何套件。
- **理由**：收藏與預設值只需要兩張小表、兩個端點與表單內的欄位預填，既有的資料庫連線、路由器、驗證登入與前端 `h()` 元件寫法都能直接承接；另起一套技術會讓同一專案出現兩種做法。
- **考慮過的替代方案**：以瀏覽器 `localStorage` 儲存收藏與預設值，可省下資料表與端點，但換裝置或清除瀏覽器資料後就消失，違反邊界情況「員工在不同裝置或不同時間登入同一帳號時」的要求，因此不採用。

## R-02 收藏與預設值的資料儲存

- **對應需求**：FR-001、FR-002、FR-006、FR-008、NFR-001、邊界情況「員工在不同裝置或不同時間登入同一帳號時」、邊界情況「員工的帳號被停用後重新啟用時」
- **決策**：新增資料庫遷移 `backend/src/db/migrations/008_favorites_defaults.sql`（沿用 `migrate.js` 依檔名排序執行的既有機制），建立兩張表：

| 資料表 | 欄位 | 鍵與限制 |
| ------ | ---- | -------- |
| `favorite_venues` | `user_id BIGINT NOT NULL`、`venue_id BIGINT NOT NULL`、`created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)` | `PRIMARY KEY (user_id, venue_id)`；`FOREIGN KEY` 指向 `users (id)`、`venues (id)` |
| `booking_defaults` | `user_id BIGINT NOT NULL`、`attendees INT NOT NULL`、`duration_minutes INT NOT NULL`、`updated_at DATETIME(3) NOT NULL` | `PRIMARY KEY (user_id)`；`FOREIGN KEY` 指向 `users (id)`；`CHECK (attendees >= 1)`、`CHECK (duration_minutes >= 30 AND duration_minutes % 30 = 0)` |

  新增 `backend/src/repositories/favoriteRepository.js`（`add`、`remove`、`listVenueIds`）與 `backend/src/repositories/bookingDefaultsRepository.js`（`upsert`、`findByUser`），寫法與既有的 `*Repository.js` 相同（接收 `conn`、使用具名參數）。場地停用、場地重新啟用、帳號停用與重新啟用都**不**刪除或異動這兩張表的資料。
- **理由**：`favorite_venues` 以 `(user_id, venue_id)` 為主鍵，天然符合 FR-002「同一員工對同一場地最多一筆」，不需要另寫去重程式；`booking_defaults` 以 `user_id` 為主鍵，天然符合 FR-008「每位員工只保留一份」。保留資料不刪除，才能在場地重新啟用後自動恢復（FR-006）與帳號重新啟用後維持原樣（邊界情況）。時長以分鐘整數儲存，與 001 的 30 分鐘為單位的時間規則同一單位。
- **考慮過的替代方案**：把預設值放在 `users` 表的兩個欄位，少一張表，但 `users` 已承載登入與暫停權限等資料，混入與預約表單相關的欄位會讓使用者資料的變更範圍變大，因此不採用。

## R-03 收藏的端點、冪等與停用場地處理

- **對應需求**：FR-001、FR-002、FR-006、FR-007、NFR-001、US1-1、US1-2、US1-5、US1-9、US1-10、US1-13
- **決策**：新增兩個端點，寫在既有的 `backend/src/routes/venues.js`，交由新增的 `backend/src/services/favoriteService.js` 處理：
  1. `PUT /api/venues/:venueId/favorite`：加入收藏。場地不存在回 `404`；場地已停用回 `409`，訊息為「此場地已停用，無法收藏。」（US1-10）；其餘以 `INSERT IGNORE INTO favorite_venues` 寫入，重複加入不報錯也不產生第二筆。成功回 `200` 與 `{ venueId, isFavorite: true }`。
  2. `DELETE /api/venues/:venueId/favorite`：取消收藏。以 `DELETE ... WHERE user_id = :userId AND venue_id = :venueId` 執行，沒有該筆收藏時同樣回 `200` 與 `{ venueId, isFavorite: false }`；場地已停用時仍可取消（見規格假設「已被停用的場地預設不顯示於場地選單，其收藏紀錄保留」）。
  3. 既有的 `GET /api/venues`（`venueService.searchVenues`）與 `GET /api/venues/:venueId/calendar` 的每個場地多回傳 `isFavorite`（布林）。`searchVenues` 在同一個交易內以 `favoriteRepository.listVenueIds(conn, userId)` 取得該員工的收藏場地集合，逐一比對，不改變既有的篩選與排序。
  4. 失敗回應沿用 `HttpError` 與 `sendError` 的既有 `{ message }` 格式；前端在 `ApiError` 上顯示 `message`，收藏標記維持原狀（FR-007）。
- **理由**：`INSERT IGNORE` 與無條件 `DELETE` 讓兩個動作各自冪等，連點兩次的最終結果與單次一致（NFR-001、US1-9）；使用 `PUT` 與 `DELETE` 表達「設為已收藏／設為未收藏」，比單一個「切換」端點更適合重複送出。取消收藏不檢查場地狀態，才能讓員工在場地停用期間整理自己的收藏。
- **考慮過的替代方案**：單一 `POST /api/venues/:venueId/favorite/toggle`，連點兩次會變回未收藏，違反 US1-9，因此不採用。

## R-04 場地選單的收藏分組與適用表單

- **對應需求**：FR-003、FR-004、FR-005、FR-006、US1-3、US1-4、US1-6、US1-7、US1-11、US1-12
- **決策**：場地選單的分組在前端完成，不新增端點：
  1. 新增 `frontend/src/lib/venueGroups.js`，匯出純函式 `groupVenues(venues)`，回傳 `{ favorites, others }`：`favorites` 為 `isFavorite` 為真的場地，以 `localeCompare(其他, "zh-Hant")` 依名稱排序；`others` 為其餘場地，維持後端回傳的順序（`listActive` 已 `ORDER BY name`）。
  2. `frontend/src/pages/bookingFormPage.js` 在建立 `<select>` 場地欄位時，`favorites` 非空才加入 `<optgroup label="我的收藏">`，其後再加入 `<optgroup label="其他場地">`；`favorites` 為空時不建立任何 `<optgroup>`，與現狀相同（FR-004）。兩個群組都不設定 `selected`，沿用既有的 `preVenue` 判斷（路由參數、再預約來源），因此不會因為有收藏而自動選定場地（FR-005）。
  3. 該頁面同時負責單次預約、週期性預約（同頁的重複選項，見 R-06）與修改預約，因此三者共用同一份分組邏輯；登記候補對話框（`frontend/src/components/waitlistDialog.js`）也共用 `groupVenues`。修改預約時既有的場地仍透過 `selected` 顯示。再預約模式的場地固定（002 的 FR-005），維持 `rebookVenueChoices` 只有一個選項，不分組。
  4. 停用場地由 `venueRepository.listActive` 本來就排除，因此自然不會出現在選單，收藏資料保留，重新啟用後再度出現（FR-006）。
- **更正（2026-11-08）**：本節先前誤認登記候補的對話框沒有場地欄位。查證 `frontend/src/components/waitlistDialog.js` 後，登記候補對話框有自己的場地選單（`waitlist-register-venue`，資料同樣取自 `GET /api/venues`），因此 FR-003 與 US1-11 對候補是直接適用，不是以預約表單代替。
- **候補對話框的做法**：`waitlistDialog.js` 建立場地 `<select>` 時，同樣呼叫 `groupVenues` 與同一份分組規則（`favorites` 非空才加「我的收藏」`<optgroup>`，其後為「其他場地」，不自動選定場地，預選仍沿用既有的 `pre.venueId`）。其餘候補流程不變。
- **理由**：場地清單只有數十個、`isFavorite` 已隨清單回傳，前端分組只需一次陣列分割；新增端點只會多一次往返。純函式可以直接用 `node:test` 驗證排序與空群組。
- **考慮過的替代方案**：由後端回傳已分組的清單，前端不用處理，但 `GET /api/venues` 也被場地查詢頁使用，改變回傳結構會影響既有畫面，因此不採用。

## R-05 預設值的寫入時機

- **對應需求**：FR-008、FR-009、NFR-001、SC-005、US2-4、US2-8、US2-10、US2-11、US2-13、US2-15、邊界情況「員工取消了最近一次成功建立的預約時」
- **決策**：只在 `backend/src/services/bookingService.js` 的 `createBooking` 寫入預設值，做法如下：
  1. `withTransaction` 成功提交並取得新預約之後（函式回傳之前），呼叫 `bookingDefaultsRepository.upsert`，帶入員工編號、人數與時長，使用 `INSERT ... ON DUPLICATE KEY UPDATE`，在獨立的連線與交易中執行，並以 `try/catch` 包住：寫入失敗時只記錄錯誤，不影響已成立的預約回應（NFR-001）。
  2. `durationMinutes` 由送出的開始時間與結束時間換算成分鐘後相減；時間字串的換算沿用 `backend/src/domain/bookingRules.js` 既有的時間換算，不另寫。
  3. 因為只有 `createBooking` 寫入，下列流程自動不更新預設值，不需任何額外判斷：預約被拒絕（`createBooking` 在提交前就拋出）、`updateBooking`（修改）、取消預約、`seriesService.createBookingSeries`（週期性預約）、`waitlistService` 確認遞補（後兩者都直接呼叫 `bookingRepository.insert`，不經過 `createBooking`）。「再預約一次」走同一個 `POST /api/bookings`（002 的 R-02），所以會更新。
- **理由**：把寫入放在提交之後，預設值寫入失敗就不會讓一筆合法的預約被回滾；預設值只是便利功能，遺失一次寫入的代價遠小於預約失敗。FR-009 所列的排除情境由「入口只有 `createBooking`」這個結構決定，比在每個流程中判斷「是否不要寫入」更不容易遺漏。
- **已知限制**：兩個裝置幾乎同時成功建立預約時，最後寫入者勝出，不保證與預約建立順序完全一致；預設值只是預填用的便利值，且員工送出前都能修改，因此不加版本比對。
- **考慮過的替代方案**：在 `createBooking` 的同一個交易內寫入，兩者原子，但預設值寫入失敗會讓預約失敗，違反 NFR-001，因此不採用；或從 `bookings` 表即時查最近一筆推算預設值，不需要新表，但取消、修改與時間排序都要額外判斷（邊界情況要求取消後仍維持），週期性預約與候補遞補也寫入 `bookings`，需要再排除來源，比單獨一張表複雜，因此不採用。

## R-06 預設值的讀取與預填、結束時間推導

- **對應需求**：FR-010、FR-011、FR-012、FR-013、FR-014、FR-015、FR-016、SC-002、SC-003、US2-1、US2-2、US2-3、US2-5、US2-6、US2-7、US2-9、US2-14
- **決策**：
  1. 讀取：既有的 `GET /api/context`（`contextService.getContext`）多回傳 `bookingDefaults`，值為 `{ attendees, durationMinutes }` 或 `null`（員工從未成功建立預約），由 `bookingDefaultsRepository.findByUser` 查詢。表單載入時本來就會呼叫此端點，不增加往返。
  2. 新增 `frontend/src/lib/defaults.js`，匯出純函式 `deriveEndTime({ startTime, durationMinutes, maxDurationMinutes, openingHours })`，回傳結束時間字串或 `null`：先以整數分鐘計算 `end = start + durationMinutes`；`durationMinutes` 大於 `maxDurationMinutes`（取自 context 的 `rules.maxDurationMinutes`）、`end` 超過 24:00、或開始到結束不完全落在所選場地當天的 `openingHours` 區間內，一律回傳 `null`（不截短，FR-014）。
  3. 預填條件：只在「新增單次預約」模式預填，即不是修改（有 `editId`）、不是再預約（`rebookMode`）。人數欄位預填記住的人數；使用者選定開始時間（或更換場地、開始時間）後呼叫 `deriveEndTime`，回傳非 `null` 才寫入結束時間欄位，並標記為「自動帶出」。日期、場地、主題、開始時間都不預填（FR-016）。
  4. 手動修改優先：員工動過人數或結束時間欄位後，該欄位標記為「已手動修改」，之後更換開始時間不再覆蓋已手動修改的結束時間。
  5. 週期性預約：重複選項與單次預約在同一頁（`booking-series-check`）。員工勾選重複時，把「自動帶出且尚未手動修改」的人數與結束時間清回 001 現有的初始狀態；取消勾選時恢復預填（FR-016、US2-14）。
  6. 開放時段的來源：`deriveEndTime` 需要的場地開放時段，由既有 `GET /api/venues` 每個場地本來就回傳的 `openingHours` 提供（`venueRepository.attach` 已附上），不新增任何欄位或端點。前端只用它決定「是否自動帶出結束時間」這個便利行為，不用來判定預約是否合法，合法性仍由後端 `validateBooking` 在送出時判定，因此不構成在前端複製預約規則。
  7. 讀取降級：預設值或收藏標記載入失敗時，表單仍須可用。`GET /api/context` 讀不到預設值時整個省略 `bookingDefaults` 欄位，`GET /api/venues` 讀不到收藏時整個省略各場地的 `isFavorite` 欄位；`bookingDefaults` 為 `null` 才代表員工從未成功建立預約。前端遇到欄位省略時，視為沒有預設值或沒有收藏、照常顯示表單並顯示一則載入失敗提示（FR-012、FR-004）；後端的 `contextService.getContext` 與 `venueService.searchVenues` 以 `try/catch` 包住收藏與預設值的查詢，失敗時只記錄錯誤，不讓整個回應失敗。
  8. 不論預填值為何，送出一律走既有的 `POST /api/bookings`，由 `validateBooking` 檢查人數上限、時長上限與開放時段（FR-013）；前端推導只是便利，不是規則來源。
- **理由**：結束時間的推導需要場地的開放時段與時長上限，這兩項資料前端在表單載入時都已取得（`/api/venues` 的 `openingHours`、`/api/context` 的 `rules`），在前端推導不需要新端點，也不需要每次更換開始時間就往返一次。推導不到合法值就回傳 `null` 而不是截短，才符合釐清結果「不自動帶出」。
- **規格解讀**：spec.md 的 FR-016 說週期性預約表單不得使用記住的人數與時長，但現有程式的週期性預約與單次預約共用同一頁表單。本研究以「勾選重複時清掉自動帶出的值」詮釋此需求；是否改為週期性預約另開入口，留待 system-analysis 階段判斷。
- **考慮過的替代方案**：由後端提供端點計算結束時間，規則只有一處來源，但每次更換開始時間都要往返，表單回應變慢，且最終送出本來就由 `validateBooking` 檢查，不會出現規則分歧，因此不採用。

## R-07 授權、隱私與重複送出

- **對應需求**：NFR-001、NFR-002、US1-8、US2-12、US2-13
- **決策**：
  1. 兩個收藏端點與 `bookingDefaults` 的讀取都以 `requireAuth` 取得的 `user.id` 為唯一的身分來源；請求路徑與本文**不接受**員工編號參數，因此不存在略過畫面改用他人名義送出的入口（NFR-002）。`bookingDefaults` 只存在於 `GET /api/context` 的回應，該端點只回傳目前登入者的資料。
  2. 在 `backend/src/domain/policy.js` 的 `can()` 新增動作 `favorite:manage`，對所有已登入且啟用中的使用者回傳 `true`，與 001 的 R-05 其他動作同一寫法，納入既有的 `can()` 窮舉測試。
  3. 重複送出：加入收藏、取消收藏以 R-03 的冪等語意處理；建立預約的重複送出沿用 001 的 R-07、R-08 的保證（只建立一筆），預設值的 upsert 因為主鍵為 `user_id` 而天然冪等（US2-13）。
- **理由**：身分只來自驗證登入的 session，是防止讀寫他人資料最直接的方式；不需要額外的擁有者檢查，因為資料列的鍵本身就含 `user_id`。
- **考慮過的替代方案**：在端點加入員工編號路徑參數並比對是否等於登入者，多一條容易被遺漏的檢查，且沒有任何需求要求管理員代為管理他人的收藏，因此不採用。

## R-08 測試策略

- **對應需求**：SC-001、SC-002、SC-004、SC-005、SC-006、NFR-003
- **決策**：沿用 001 的分層，新增內容如下：
  1. 單元（`node:test`）：`groupVenues`（空收藏、排序、停用場地不在清單）、`deriveEndTime`（正常、超過時長上限、超出開放時段、跨日、時長為空）。
  2. 整合（`node:test` 加 `fetch`，連到測試資料庫）：收藏的加入與取消冪等及停用場地行為（R-03）；`createBooking` 成功後預設值被更新，被拒絕、修改、取消、週期性、候補遞補都不更新（R-05）；`GET /api/context` 只回傳目前登入者自己的預設值（R-07）；`can()` 對 `favorite:manage` 的窮舉。
  3. 驗收（BDD）：新增 `e2e/features/favorites-defaults.feature`，涵蓋 spec.md 故事 1 與故事 2 的驗收情境，使用 `@cucumber/cucumber@^13.0.0` 與 `playwright@^1.65.0`（沿用 003 的 R-09；根 `package.json` 的 workspaces 目前尚無 `e2e`，需在實作時新增該 workspace 與其 `package.json`）；SC-006 以桌機與 360 像素寬兩種視窗各跑一次。
  4. 遷移：`008_favorites_defaults.sql` 在乾淨資料庫與已有 001 至 007 資料的資料庫上各執行一次，確認不影響既有資料。
- **理由**：純函式與端點行為各有最小的測試層級；FR-009 的排除情境由整合測試逐一驗證，避免之後新增建立預約的入口時悄悄改變預設值。
- **考慮過的替代方案**：全部以瀏覽器驗收涵蓋，執行慢且難以定位是前端推導還是後端寫入出錯，因此不採用。

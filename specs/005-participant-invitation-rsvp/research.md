# 研究紀錄（Phase 0）：參與者邀請與出席回覆

**功能分支**：`005-participant-invitation-rsvp` | **日期**：2026-11-08 | **規格**：[spec.md](./spec.md)

使用者於規劃階段指定的技術方向：

- （使用者未另外指定技術方向。）

---

## R-01 沿用現有技術堆疊且不新增套件

- **對應需求**：跨領域
- **決策**：本功能直接在現有專案內開發，沿用 001 至 004 已採用的環境與技術：Node.js 24 LTS、JavaScript（ES Modules）、MySQL 8.4 LTS 以上、npm workspaces（根 `package.json` 目前的 workspaces 為 `frontend`、`backend`、`shared`），前端為 `vite@^8.0.0` 搭配原生 HTML、CSS、JavaScript，後端為 `node:http` 搭配 `mysql2@^3.24.0`，測試為 `node:test`，Lint 與格式化為 `eslint@^10.0.0`、`prettier@^3.9.0`。不新增任何套件。
- **理由**：邀請只需要一張資料表、一組端點、一個排程工作與幾個畫面元件；既有的資料庫連線與交易（`withTransaction`）、列鎖（`bookingRepository.lockById`）、通知（`notify`）、預約狀態轉換（`transition`）與定時掃描（`processDue`、`registerJob`）都能直接承接，另起一套技術會讓同一專案出現兩種做法。
- **考慮過的替代方案**：以外部訊息佇列或寄信服務發送邀請，會違反釐清結果「不寄 Email、邀請只在站內送達」，且 1 分鐘內送達（NFR-005）用同一個交易寫入站內通知即可達成，因此不採用。

## R-02 邀請的資料模型與唯一性

- **對應需求**：FR-003、FR-004、FR-005、FR-026、NFR-001、NFR-004、US1-6、US1-15、US5-3、US5-7、US5-14、規格假設「受邀者帳號被停用後重新啟用時，失效的邀請預設不恢復，與 001 停用帳號時預約不恢復的原則一致。」
- **決策**：新增資料庫遷移 `backend/src/db/migrations/009_invitations.sql`（沿用 `migrate.js` 依檔名排序、`multipleStatements` 執行的既有機制），建立資料表 `booking_invitations`：

| 欄位 | 型別與限制 | 用途 |
| ---- | ---------- | ---- |
| `id` | `BIGINT NOT NULL AUTO_INCREMENT`，主鍵 | 邀請編號 |
| `booking_id` | `BIGINT NOT NULL`，外鍵指向 `bookings (id)` | 所屬預約 |
| `invitee_user_id` | `BIGINT NOT NULL`，外鍵指向 `users (id)` | 受邀者 |
| `status` | `VARCHAR(12) NOT NULL`，`CHECK (status IN ('pending', 'active', 'invalid'))` | 待發送、有效、已失效（FR-026） |
| `response` | `VARCHAR(12) NOT NULL DEFAULT 'none'`，`CHECK (response IN ('none', 'accepted', 'declined'))` | 未回覆、已接受、已婉拒 |
| `invalid_reason` | `VARCHAR(24) NULL`，`CHECK (invalid_reason IS NULL OR invalid_reason IN ('booking_cancelled', 'removed', 'account_disabled'))` | 失效原因，用來區分名單是否列出 |
| `pending_change` | `VARCHAR(8) NULL`，`CHECK (pending_change IS NULL OR pending_change IN ('time', 'venue'))` | 預約因修改進入審核期間，尚待在核准時套用的異動種類（R-06） |
| `notified_at` | `DATETIME(3) NULL` | 最近一次把預約資訊通知受邀者的時間，供提醒判斷（R-09） |
| `reminder_sent_at` | `DATETIME(3) NULL` | 已發送開始前提醒的時間 |
| `responded_at` | `DATETIME(3) NULL` | 最後回覆時間 |
| `created_at`、`updated_at` | `DATETIME(3) NOT NULL` | 沿用既有資料表的時間欄位寫法 |
| `live_user_id` | `BIGINT GENERATED ALWAYS AS (IF(status IN ('pending', 'active'), invitee_user_id, NULL)) STORED` | 只在邀請未失效時等於受邀者編號 |

  索引：`UNIQUE KEY uk_invitations_live (booking_id, live_user_id)`、`KEY ix_invitations_invitee (invitee_user_id, status)`、`KEY ix_invitations_booking (booking_id, status)`、`KEY ix_invitations_reminder (status, reminder_sent_at)`（供提醒工作掃描，R-09）。另加三組約束，依 `data-model.dbml` 實作：組合 `CHECK`（`invalid` 必有 `invalid_reason`、`pending` 的 `response` 必為 `none`、`response` 與 `responded_at` 同時為空或同時有值），以及 `BEFORE UPDATE` 觸發器 `trg_booking_invitations_status_guard`（擋下 `invalid` 之後再改狀態、回覆、失效原因，以及 `active` 退回 `pending`，因為 `CHECK` 看不到更新前的值，無法單獨保證 FR-026 的「已失效不得再變更」）。兩個外鍵皆為 `ON DELETE RESTRICT`，與 008 相同。新增 `backend/src/repositories/invitationRepository.js`（`insert`、`lockByBooking`、`lockById`、`listByInvitee`、`listByBooking`、`markInvalid`、`updateResponse`），寫法與既有的 `*Repository.js` 相同（接收 `conn`、使用具名參數）。邀請的狀態變更**不**寫入 `booking_events`（FR-027）。
- **理由**：`UNIQUE (booking_id, live_user_id)` 讓「同一預約對同一受邀者同時最多一份未失效的邀請」由資料庫保證，失效後 `live_user_id` 為 `NULL`，唯一索引不把多個 `NULL` 視為重複，所以被移除的人可以再次被邀請並建立新的一份（FR-025），同時並行重複送出新增也不會出現兩份（NFR-004、US5-14）。把「有效／失效」與「回覆」拆成兩欄，正好對應 FR-026 的兩層狀態，且「已失效」後保留最後的 `response`（FR-026）。
- **已知限制**：外鍵的基底欄位 `invitee_user_id` 同時被儲存型產生欄位引用，MySQL 對這種欄位的外鍵參照動作有限制，本決策只使用 `RESTRICT`；產生欄位上的唯一索引在 MySQL 8.4 的行為待遷移在乾淨資料庫與已有 001 至 008 資料的資料庫各執行一次時驗證（見 R-14）。
- **考慮過的替代方案**：以失效時刪除該列保持 `UNIQUE (booking_id, invitee_user_id)`，不需產生欄位，但失效後無法保留最後的回覆給受邀者的「我的邀請」（FR-007、US5-8），因此不採用；在服務層先查再寫來避免重複，並行請求下仍會產生兩份，因此不採用。

## R-03 新增通知類型、文案與連結

- **對應需求**：FR-003、FR-011、FR-017、FR-018、FR-020、FR-025、NFR-005、SC-002、US1-1、US4-1、US4-2、US4-9、US4-10、US5-5
- **決策**：同一個遷移 `009_invitations.sql` 對 `notifications` 做兩項調整：
  1. 以 `ALTER TABLE notifications DROP CHECK chk_notifications_type, ADD CONSTRAINT chk_notifications_type CHECK (type IN (…既有九種…, 'invitation_received', 'invitation_changed', 'invitation_cancelled', 'invitation_removed', 'invitation_reminder'))` 擴充類型清單，新類型長度皆不超過 `type VARCHAR(24)`。
  2. 新增 `invitation_id BIGINT NULL DEFAULT NULL`，外鍵指向 `booking_invitations (id)`，讓通知可以直接連到邀請詳情。
  
  `shared/src/copy.js` 的 `notificationTemplates` 新增五個文案函式，內容分別為：邀請（預約者姓名、場地、日期、起訖時間、主題）、變更（新場地，時間變更時另含新日期時間與「請重新回覆」）、取消（場地、日期、起訖時間，有原因時附原因）、移出邀請（場地、日期、起訖時間）、開始前提醒（預約者姓名、主題、場地、開始時間）。`notificationService.notify` 新增選用參數 `invitationId`，並由 `notificationRepository.insert` 寫入；`GET /api/notifications` 的回應多回傳 `invitationId`。通知文案沿用既有做法在寫入時固化於 `message` 欄位。
- **理由**：通知類型有資料庫檢查限制，不調整就無法寫入新類型；所有邀請相關通知與預約狀態變更在同一個交易內寫入，沒有額外的投遞環節，事件發生後即可在站內看到，滿足 NFR-005 的 1 分鐘上限（提醒由定時工作產生，見 R-09）。`invitation_id` 讓受邀者從通知一步開啟邀請詳情（US2-6），不需要用預約編號反查。
- **考慮過的替代方案**：不新增類型、改用既有的 `booking_created`、`booking_cancelled` 等類型，會讓「邀請」與「預約成立」的通知混在一起，前端無法決定連到邀請詳情或預約，因此不採用。

## R-04 建立預約時驗證並建立邀請

- **對應需求**：FR-001、FR-002、FR-003、FR-004、FR-005、FR-006、NFR-001、SC-001、US1-1、US1-2、US1-3、US1-4、US1-5、US1-6、US1-7、US1-8、US1-9、US1-10、US1-11、US1-12、US1-15
- **決策**：
  1. `POST /api/bookings` 的請求新增選填欄位 `inviteeEmails`（字串陣列），只由 `bookingService.createBooking` 處理；週期性預約（`seriesService.createBookingSeries`）、候補遞補確認與修改預約的端點**不讀取**此欄位，因此不會產生邀請（FR-001）。
  2. 在 `createBooking` 既有的 `withTransaction` 內、占用時段之前，呼叫 `invitationService.resolveInvitees(conn, { emails, bookerId })`：逐一以 `userRepository.normalizeEmail`（去除前後空白並轉小寫）正規化，同一 Email 去重（FR-002）；以 `userRepository.findByEmail` 查詢，查無帳號、`is_active` 為 0、或等於預約者本人者，依序收集 `{ email, message }`；任何一個有問題就拋出 `HttpError(400, …, { fields: [{ field: 'inviteeEmails', message }] })`，訊息列出每個有問題的 Email 與原因，整個交易回滾，因此不會留下預約或任何邀請（FR-002、NFR-001）。受邀人數不與 `attendees`、場地容納人數比較，也不查詢受邀者的其他預約（FR-005）。
  3. 預約建立並取得狀態後，在同一個交易內以 `invitationRepository.insert` 為每位受邀者建立邀請：預約狀態為 `confirmed` 時，邀請 `status` 為 `active`、`response` 為 `none`、`notified_at` 為現在，並呼叫 `notify` 寫入 `invitation_received`；預約狀態為 `pending` 時，邀請 `status` 為 `pending`，不通知（FR-003、FR-004）。
  4. 預約被拒絕（`validateBooking` 失敗、時段被占用）時，`withTransaction` 回滾，邀請同樣不會留下（US1-10）；連續送出兩次時，第二次因時段已被占用而失敗，所以不會有重複的邀請或通知（NFR-001、US1-15）。
  5. 再預約表單的受邀欄位維持空白為前端行為（見 R-12），後端不從來源預約帶入任何受邀者（FR-006）。
- **理由**：把驗證放在占用時段之前，可以在不白費時段占用與回滾成本的情況下提早失敗；把邀請寫入放在同一個交易，預約與名單就只可能同進同退（NFR-001），不需要補償機制。Email 比對使用既有的 `normalizeEmail`，與帳號建立時的正規化規則一致，所以大小寫不同的同一個 Email 會被視為同一位（US1-6）。
- **考慮過的替代方案**：預約提交後再以另一個請求建立邀請，第二個請求失敗時會留下沒有邀請的預約，違反 NFR-001，因此不採用；在預約成立的交易提交後才寫入邀請（仿 004 的預設值寫入），邀請寫入失敗不影響預約，但違反規格要求預約與名單必須同時成立或同時不成立，因此不採用。

## R-05 邀請隨預約狀態轉換同步

- **對應需求**：FR-004、FR-020、FR-021、FR-026、FR-027、NFR-003、SC-002、SC-005、US1-8、US1-9、US4-8、US4-9、US4-10、US4-11、US4-12、US4-13、US4-15、邊界情況「受邀者回覆的瞬間預約被取消時」
- **決策**：既有的 `backend/src/services/bookingTransition.js` 的 `transition` 是所有預約狀態變更的唯一入口（預約者取消、管理員取消、`impactService.cancelAffected` 的場地停用／維護時段／帳號停用、審核駁回、審核逾期自動取消都經過它），因此在 `transition` 內、更新預約狀態並寫入操作紀錄之後，增加對 `invitationService` 的兩個呼叫：
  1. 目標狀態為 `confirmed`：呼叫 `invitationService.onBookingConfirmed(conn, { bookingId, now })`，對該預約 `status = 'pending'` 的邀請改為 `active`、`notified_at` 設為現在，並寫入 `invitation_received`；對 `status = 'active'` 且 `pending_change` 不為空的邀請套用 R-06 的重置或保留並寫入變更通知，再把 `pending_change` 清為 `NULL`。
  2. 目標狀態為 `cancelled` 或 `rejected`：呼叫 `invitationService.onBookingEnded(conn, { bookingId, reason, now })`，對 `status IN ('pending', 'active')` 的邀請改為 `invalid`，`invalid_reason` 為 `booking_cancelled`；原本是 `active` 的邀請另寫入 `invitation_cancelled`（附 `reason`，沒有原因則省略），原本是 `pending` 的邀請不通知（FR-020）。
  
  目標狀態為 `checked_in`、`no_show`、`completed` 時不做任何處理，邀請維持原狀（FR-021）；回覆是否被接受由 R-07 依預約狀態判斷。邀請服務內鎖定順序一律為先 `bookingRepository.lockById` 鎖預約、再 `invitationRepository.lockByBooking` 鎖該預約的邀請，與 `transition` 既有的順序相同，避免死結。`invitationService` 只匯入通知與邀請資料存取，不匯入 `bookingTransition`，沒有循環相依。
- **理由**：現有程式已把所有取消與駁回路徑集中在 `transition`，在這裡掛接可以保證 FR-020 列出的每一種原因都處理到，不需要在每個呼叫點各自補寫，之後新增取消入口也不會漏掉邀請；放在同一個交易內，預約與邀請就同時生效或同時不生效（NFR-003）。回覆與取消同時發生時，兩者都先鎖預約列，由鎖的先後決定結果（邊界情況「受邀者回覆的瞬間預約被取消時」）。
- **考慮過的替代方案**：由定時工作定期掃描「已取消預約的有效邀請」來失效，會讓失效與通知延遲到下一次掃描（至多 30 秒），且在失效前的空窗期仍可能接受回覆，違反 SC-005 的「失效後仍被接受的回覆為 0 筆」，因此不採用；在各取消入口各自呼叫，入口多（預約者、管理員、影響清單、審核）且日後新增時容易遺漏，因此不採用。

## R-06 預約修改時的邀請重置、保留與延後套用

- **對應需求**：FR-017、FR-018、FR-019、NFR-003、US4-1、US4-2、US4-3、US4-4、US4-5、US4-6、US4-7、邊界情況「預約被修改多次時」
- **決策**：在 `bookingService.updateBooking` 中，排程更新完成並（必要時）呼叫 `transition` 變為 `pending` 之後，以資料庫實際的前後值判斷異動種類 `changeKind`：開始或結束時間與修改前不同為 `time`；時間相同但場地編號不同為 `venue`；兩者皆相同為 `none`（只改主題或人數的早退分支完全不呼叫邀請服務，FR-018）。接著呼叫 `invitationService.onBookingChanged(conn, { bookingId, changeKind, finalStatus, venueName, date, startTime, endTime, now })`：
  1. `finalStatus` 為 `confirmed`：對 `status = 'active'` 的邀請，`time` 時把 `response` 重置為 `none`、`responded_at` 與 `reminder_sent_at` 設為 `NULL`、`notified_at` 設為現在，並寫入 `invitation_changed`（含新日期時間與新場地、請重新回覆）；`venue` 時保留 `response`，只寫入 `invitation_changed`（含新場地）。
  2. `finalStatus` 為 `pending`（修改後需重新審核）：不重置、不通知，只把 `active` 邀請的 `pending_change` 更新為較強的一種（`time` 強於 `venue`，已有 `time` 時不降級）；預約審核通過時由 R-05 的 `onBookingConfirmed` 依 `pending_change` 套用第 1 點並清除標記；審核駁回或逾期則走 R-05 的失效流程（US4-8）。
  3. `changeKind` 為 `none` 時不處理。
  
  `status = 'pending'`（待發送）的邀請不受影響，因為尚未通知過受邀者。整個處理與預約修改在同一個交易內，修改失敗（時段被占用等）時交易回滾，邀請與通知都不會改變（FR-018、US4-5、NFR-003）。
- **理由**：以實際前後值而不是請求欄位判斷，才不會把「送出相同日期」誤判為時間變更；審核期間延後套用，才符合「變更通知與回覆重置尚未發生」的要求（US4-6），並避免預約被駁回時受邀者先收到變更再收到取消兩則互相矛盾的通知。`pending_change` 記在邀請上，避免新增預約層級的欄位，也讓多次修改的合併規則集中在一處。
- **考慮過的替代方案**：修改當下就重置回覆，核准前以「審核中」封鎖回覆，則審核被駁回時受邀者的回覆已被清掉，且在審核前就通知新時間，與 FR-019 不符，因此不採用。

## R-07 受邀者的邀請列表、詳情與回覆

- **對應需求**：FR-007、FR-008、FR-009、FR-010、NFR-002、US2-1、US2-2、US2-3、US2-4、US2-5、US2-6、US2-7、US2-8、US2-9、US2-10、US2-11、US2-12
- **決策**：新增 `backend/src/routes/invitations.js`（沿用 `register(router)` 寫法，並在 `app.js` 註冊）與 `backend/src/services/invitationService.js`，提供三個端點：
  1. `GET /api/invitations`：列出目前登入者 `status IN ('active', 'invalid')` 的邀請（`pending` 不列出，FR-007），依 `bookings.start_at` 升冪、再依邀請編號升冪排序，回傳 `{ id, organizerName, venueName, venueLocation, date, startTime, endTime, subject, response, status, invalidReason }`；沒有資料時回傳空陣列，由前端顯示「目前沒有邀請」。
  2. `GET /api/invitations/:id`：回傳同一組欄位；**不**回傳 `attendees`、其他受邀者與他們的回覆（FR-008）。邀請不屬於登入者、不存在，或仍是 `pending`（待發送）時，一律回同一種 `404`（訊息「找不到這份邀請」），不洩漏邀請是否存在。
  3. `PUT /api/invitations/:id/response`：本文 `{ response: 'accepted' | 'declined' }`，回應 `200` 與回覆後完整的邀請資料（與 `GET /api/invitations/:id` 相同的欄位，供畫面直接更新）。交易內先 `bookingRepository.lockById` 鎖預約、再 `invitationRepository.lockById` 鎖邀請，依序檢查：邀請屬於登入者（否則同樣回 `404`）；`status` 為 `active`（`invalid` 回 `409`，訊息為預約已取消或已被移出邀請）；預約狀態為 `confirmed`（`pending` 回 `409`「預約審核中」，其他非 `confirmed` 回 `409`「預約已開始」或「預約已取消」）；現在時間早於 `start_at`（否則 `409`「預約已開始」）。通過後執行 `UPDATE … SET response = :response, responded_at = :now`；**不**呼叫 `notify`（FR-009）。
  
  `response` 為 `accepted` 或 `declined` 以外的值回 `400`。
- **理由**：回覆是「設為某值」而不是「切換」，連點兩次或兩個請求同時抵達時，鎖的先後決定最後值，結果仍是一份回覆（NFR-002、US2-11）；先鎖預約再鎖邀請與 R-05 的取消路徑採同一順序，回覆與取消同時發生時只會有一方先完成，沒有死結。詳情只從資料庫即時讀取，所以預約改場地後詳情立即顯示新場地，不依賴通知文案（見 R-13）。
- **考慮過的替代方案**：以 `POST …/accept` 與 `POST …/decline` 兩個端點表達動作，重複送出的語意較不清楚，且切換回覆要另判斷目前狀態，因此不採用；回覆不鎖預約列，則取消與回覆同時發生時可能出現已取消預約上的「已接受」，違反 SC-005，因此不採用。

## R-08 預約者的名單、出席統計與新增移除受邀者

- **對應需求**：FR-012、FR-013、FR-014、FR-015、FR-016、FR-023、FR-024、FR-025、NFR-004、US3-1、US3-2、US3-3、US3-4、US3-5、US3-6、US3-8、US3-9、US3-11、US5-1、US5-2、US5-3、US5-4、US5-5、US5-6、US5-7、US5-8、US5-9、US5-10、US5-11、US5-12、US5-15
- **決策**：在 `backend/src/routes/invitations.js` 另外註冊三個只供預約者使用的端點，邏輯放在 `invitationService`：
  1. `GET /api/bookings/:bookingId/invitations`：回傳 `{ bookingStatus, attendees, venueCapacity, items, summary }`。`items` 列出該預約 `status IN ('pending', 'active')` 的邀請，以及 `status = 'invalid'` 且 `invalid_reason <> 'removed'` 的邀請（被預約者移除者不列出，FR-014），每項含姓名、Email、回覆狀態與邀請狀態。`summary` 為 `{ invited, accepted, declined, noReply, expected }` 或 `null`，由 `backend/src/domain/invitations.js` 的純函式 `summarizeInvitations(rows, bookingStatus)` 計算：只計 `status = 'active'` 的邀請（`invited` 為其筆數，`expected` 為 `1 + accepted`）；預約狀態為 `pending`、`cancelled`、`rejected` 或沒有任何可列出的邀請時回傳 `null`（FR-012、FR-013、FR-014）。`expected` 與 `attendees`、容納人數只並列回傳，伺服器端不做任何比較、提示或建議（FR-016）。
  2. `POST /api/bookings/:bookingId/invitations`：本文 `{ emails: [...] }`。檢查預約屬於登入者且 `series_id IS NULL`（週期性預約回 `409`）、狀態為 `pending` 或 `confirmed`、現在早於 `start_at`（FR-023），逐一套用 R-04 的 `resolveInvitees`，並額外檢查 Email 不得已在該預約的未失效邀請中（回報「已在受邀名單中」）；任何一個不通過就不新增任何一位（FR-024）。通過後依預約狀態建立 `active`（並寫入 `invitation_received`）或 `pending` 邀請；不改變其他邀請（FR-023）。
  3. `DELETE /api/bookings/:bookingId/invitations/:invitationId`：檢查同第 2 點的預約條件，邀請須屬於該預約；邀請為 `active` 時改為 `invalid`（`invalid_reason = 'removed'`）並寫入 `invitation_removed`，為 `pending` 時改為 `invalid` 且不通知，已經是 `invalid` 時回 `200` 且不再產生第二則通知（FR-025、NFR-004）。
  
  三個端點皆先 `bookingRepository.lockById` 再操作邀請。
- **理由**：統計全部在伺服器端用同一個純函式計算，畫面、測試與 SC-005 的「預計到場人數 100% 等於 1 加已接受人數」就只有一個來源，也能用 `node:test` 逐一驗證狀態組合。移除用 `DELETE` 並讓重複移除冪等，與 004 的收藏端點同一思路，連點兩次的最終結果與單次一致（NFR-004）。
- **已知限制**：並行重複送出同一個新增時，第二個請求會因 R-02 的唯一索引或「已在受邀名單中」檢查而回報錯誤，最終狀態仍只有一份邀請、一則通知，與單次送出的結果一致，但第二個請求本身是失敗回應而不是成功回應。
- **考慮過的替代方案**：由前端依回傳的明細自行計算統計，邏輯會在前端與測試各複製一份，且需要在前端判斷預約狀態與失效原因，因此不採用；把新增與移除合併成單一「覆寫整份名單」的 `PUT`，需要比對差異才能知道誰是新增、誰被移除、誰要通知，且並行修改容易互相覆蓋，因此不採用。

## R-09 受邀者的開始前提醒

- **對應需求**：FR-011、NFR-005、SC-003、US2-13、US2-14、US2-15、US2-16
- **決策**：新增 `backend/src/jobs/inviteeReminders.js`，匯出 `sendInviteeReminders(current = now())` 並以 `registerJob("sendInviteeReminders", …)` 註冊，在 `backend/src/server.js` 與既有的 `./jobs/reminders.js` 同一處匯入。內部沿用 `processDue`，查詢條件為：邀請 `status = 'active'`、`response IN ('none', 'accepted')`、`reminder_sent_at IS NULL`；預約 `status = 'confirmed'`、`start_at > :now`；`DATE_SUB(b.start_at, INTERVAL r.int_value MINUTE) <= :now`（`r` 為 `rules` 的 `reminder_minutes`，與預約者提醒共用同一個規則值）；以及 `i.notified_at <= DATE_SUB(b.start_at, INTERVAL r.int_value MINUTE)`（邀請發送時距開始已不足提醒時間者不補發）。查詢結尾使用 `FOR UPDATE OF i SKIP LOCKED` 只鎖邀請列。處理時寫入 `invitation_reminder` 並把 `reminder_sent_at` 設為現在。R-06 的時間變更重置會把 `reminder_sent_at` 設回 `NULL` 並更新 `notified_at`，所以改期後會依新時間重新評估。
- **理由**：這個條件與既有 `sendReminders` 對預約者的條件同構（用 `notified_at` 取代 `confirmed_at`），行為一致且可複用 `SCAN_INTERVAL_MS`（預設 30000 毫秒）的掃描節奏，在觸發時間點後 30 秒內產生提醒，符合 NFR-005 的 1 分鐘；`FOR UPDATE OF i` 讓掃描工作不鎖預約列，避免與「先鎖預約、再鎖邀請」的其他路徑形成相反順序的鎖。回覆為「已婉拒」、邀請為 `pending` 或 `invalid`、預約為 `pending` 的條件都直接寫在查詢內，所以不需要事後過濾。
- **已知限制**：`FOR UPDATE OF 表名` 為 MySQL 8.0.1 起支援的語法，與既有的 `SKIP LOCKED` 並用於 MySQL 8.4，實際行為待 R-14 的整合測試驗證。
- **考慮過的替代方案**：擴充既有的 `sendReminders` 同時處理預約者與受邀者，兩者的標記欄位與資料表不同，合併後一個失敗會拖累另一個，因此不採用；每筆邀請建立時預先排定一個提醒時間，改期時要取消並重排，比起掃描時即時判斷更複雜，因此不採用。

## R-10 受邀者帳號停用時使邀請失效

- **對應需求**：FR-021、FR-022、US3-11、US4-14、US4-15、規格假設「受邀者帳號被停用後重新啟用時，失效的邀請預設不恢復，與 001 停用帳號時預約不恢復的原則一致。」
- **決策**：在 `backend/src/services/userService.js` 的 `deactivateUser` 既有的交易內，於 `cancelAffected` 與候補失效之後、`UPDATE users SET is_active = 0` 之前，呼叫 `invitationService.onUserDeactivated(conn, { userId, now })`，將該帳號作為受邀者的所有 `status IN ('pending', 'active')` 邀請改為 `invalid`、`invalid_reason = 'account_disabled'`，不寫入任何通知。預約者本人被停用的情況，由既有的 `cancelAffected → transition → onBookingEnded`（R-05）自動失效並通知受邀者。`enableUser` 不處理邀請，所以重新啟用後邀請維持失效。
- **理由**：停用帳號已經在一個交易內處理預約與候補，把邀請放在同一個交易內，能避免出現「帳號已停用、邀請仍有效」的中間狀態；重新啟用不需要任何程式，只要不去動邀請即可滿足「不恢復」。
- **考慮過的替代方案**：不失效邀請，只在回覆與統計時過濾掉停用帳號，則帳號重新啟用後舊邀請會自動復活，與「不恢復」不符，因此不採用。

## R-11 授權、隱私與資料可見範圍

- **對應需求**：FR-008、FR-012、FR-023、NFR-006、SC-006、US2-7、US2-10、US3-10、US5-13
- **決策**：
  1. 所有新端點都以 `requireAuth` 取得的 `user.id` 為唯一身分來源，請求路徑與本文**不接受**員工編號參數；受邀者端點以 `invitee_user_id = :userId` 過濾或比對，預約者端點以 `isOwner(user, booking)` 比對（NFR-006）。
  2. 在 `backend/src/domain/policy.js` 的 `can()` 新增兩個動作：`invitation:respond`（所有已登入且啟用中的使用者為 `true`，實際擁有權由服務比對 `invitee_user_id`）與 `invitation:manage`（有資源時等同 `isOwner`，與 `booking:update` 同一寫法，管理員不例外），納入既有的 `can()` 窮舉測試。
  3. 回應 DTO 分為兩份：受邀者視角（R-07）不含 `attendees`、其他受邀者與其回覆；預約者視角（R-08）含全部受邀者資料。兩份各自由函式組成，不共用物件展開，避免日後加欄位時意外外洩。
  4. 管理員沒有查看邀請的端點，也不能代為回覆或調整（規格假設「管理員檢視預約時預設看不到受邀名單與出席統計」）。
- **理由**：身分只來自驗證登入的 session，是防止回覆他人邀請或讀取他人名單最直接的方式；兩份 DTO 分開組成，讓「受邀者看不到預約人數與他人回覆」（FR-008）在程式結構上就不可能因欄位誤傳而違反。
- **考慮過的替代方案**：以單一 DTO 依角色刪欄位，少寫一份轉換，但新增欄位時預設會暴露給受邀者，因此不採用。

## R-12 前端：表單欄位、我的邀請與預約詳情面板

- **對應需求**：FR-001、FR-006、FR-007、FR-008、FR-009、FR-012、FR-015、FR-023、NFR-007、US1-13、US1-14、US2-6、US2-8、US2-9、US3-3、SC-004、SC-008
- **決策**：前端沿用原生 HTML、CSS、JavaScript 與既有的 `h()` 元件寫法：
  1. 新增 `frontend/src/lib/emails.js`，匯出純函式 `parseInviteeEmails(text)`：以空白、逗號、分號（含全形）與換行切開，去除前後空白並轉小寫、略過空白項、重複者只留一個；不驗證 Email 格式，帳號是否存在由後端判定（R-04）。
  2. `frontend/src/pages/bookingFormPage.js` 新增「邀請同事」多行文字欄位，只在新增單次預約與再預約模式顯示；修改預約模式（有 `editId`）不顯示；該頁同頁的週期性預約勾選（`booking-series-check`）勾選時隱藏並清空此欄位，取消勾選時恢復。再預約模式欄位維持空白，不從來源預約帶入（FR-006）。送出單次預約時把 `parseInviteeEmails` 的結果放進請求的 `inviteeEmails`；後端回傳 `fields` 的 `inviteeEmails` 錯誤時顯示在欄位下方，已填內容保留（US1-3）。
  3. 新增 `frontend/src/pages/invitationsPage.js`（「我的邀請」列表與詳情，含「出席」「不出席」按鈕；送出期間停用按鈕並顯示處理中，避免連點；錯誤訊息直接顯示後端 `message`），在 `frontend/src/router.js` 註冊 `/invitations` 與 `/invitations/:id`，在 `frontend/src/components/nav.js` 加入入口。`frontend/src/pages/notificationsPage.js` 對帶有 `invitationId` 的通知提供連結到邀請詳情。
  4. 新增 `frontend/src/components/inviteePanel.js`，由 `frontend/src/components/bookingCard.js` 在單次預約（非週期性）的預約詳情掛載：顯示名單、五項統計並列預約人數與容納人數、「重新整理」按鈕（FR-015）、新增受邀者的欄位與按鈕、每位受邀者的「移除」按鈕（經由 `frontend/src/components/dialog.js` 確認）；預約已開始、已取消或已駁回時隱藏新增與移除；週期性預約不掛載此元件（FR-023）。畫面不顯示任何改小場地的提示（FR-016）。
  5. `frontend/src/api/client.js` 新增對應 R-07、R-08 各端點的呼叫函式。版面沿用既有單欄響應式寫法，畫面寬度 360 像素時不出現水平捲動（NFR-007）。
- **理由**：邀請欄位與統計都只是既有頁面上的新區塊，沿用同一個 `h()` 與 `dialog` 元件可以讓風格一致且不新增相依；把 Email 拆解獨立成純函式，可以用 `node:test` 直接驗證分隔符號與去重，而帳號是否有效這類規則只有後端一份，避免在前端複製規則。「重新整理」由使用者主動觸發，符合 FR-015「下次開啟或重新整理時反映最新」，不需要輪詢。
- **考慮過的替代方案**：以標籤輸入元件（輸入一個 Email 就轉成標籤）取代多行文字欄位，操作較精緻，但需要自行實作游標、貼上與刪除行為，約數百行程式，對一次貼上多位同事的使用情境沒有明顯好處，因此不採用。

## R-13 規格解讀：通知文案固化與詳情即時讀取

- **對應需求**：FR-008、FR-017、FR-018、US2-6、US4-1、US4-2
- **決策**：站內通知的 `message` 是寫入當下的文案快照（既有設計，見 R-03），不會隨預約日後的異動更新；規格中「受邀者開啟邀請詳情看到目前的場地與時間」解讀為詳情畫面即時讀取預約資料（R-07），不是回放通知文案。因此預約改期或換場地後，舊的邀請通知仍顯示當時的內容，而詳情顯示最新內容，並且另有一則 `invitation_changed` 通知說明異動。
- **理由**：這樣既不需要在預約修改時回頭改寫既有通知，也不會讓受邀者從舊通知點進詳情時看到過時資訊。
- **考慮過的替代方案**：預約異動時把舊通知標記為作廢，需要新增通知狀態欄位與清單過濾，增加複雜度，且 FR-018 已要求另發變更通知，因此不採用。

## R-14 測試策略

- **對應需求**：SC-001、SC-002、SC-003、SC-004、SC-005、SC-006、SC-007、SC-008、NFR-001、NFR-002、NFR-003、NFR-004、NFR-005、NFR-006
- **決策**：沿用 004 的 R-08 分層，新增內容如下：
  1. 單元（`node:test`）：`parseInviteeEmails`（分隔符號、大小寫、去重、空字串）；`summarizeInvitations`（各預約狀態下統計是否為 `null`、被移除與停用者的計算、`expected` 等於 1 加已接受）；`can()` 對 `invitation:respond`、`invitation:manage` 的窮舉。
  2. 整合（`node:test` 加 `fetch`，連到測試資料庫）：建立預約時邀請的驗證與原子性（含有一個不合法 Email 時預約與邀請都不存在，R-04）；需審核場地的 `pending` 邀請在核准後才發送、駁回後不發送（R-05）；取消、駁回、管理員取消、停用場地與停用帳號後邀請失效與通知（R-05、R-10）；修改預約的時間重置、場地保留、只改主題人數不動、審核期間延後與失敗回滾（R-06）；回覆規則與各種拒絕原因、重複送出與同時回覆（R-07）；名單與統計、新增與移除及重複操作（R-08）；以固定時間直接呼叫 `sendInviteeReminders(current)` 驗證提醒對象與不補發條件（R-09）；他人無法讀取或回覆（R-11）；遷移 `009_invitations.sql` 在乾淨資料庫與已有 001 至 008 資料的資料庫各執行一次，確認 R-02（含狀態守衛觸發器）、R-09 標示待驗證的語法與限制可行。
  3. 驗收（BDD）：新增 `e2e/features/invitations.feature`，涵蓋 spec.md 故事 1 至故事 5 的驗收情境，使用 `@cucumber/cucumber@^13.0.0` 與 `playwright@^1.65.0`（沿用 004 的 R-08；根 `package.json` 的 workspaces 目前尚無 `e2e`，需在實作時新增該 workspace 與其 `package.json`）；SC-008 以桌機與 360 像素寬兩種視窗各跑一次。
- **理由**：統計與 Email 解析是純函式，單元測試最快；狀態轉換、鎖與交易行為只能在真實資料庫上驗證，因此用整合測試逐項涵蓋 R-04 至 R-10 的規則；時間性行為（提醒、開始時間邊界）以注入時間的函式驗證，不需要真的等待。
- **考慮過的替代方案**：全部以瀏覽器驗收涵蓋，執行慢且難以定位是前端或後端出錯，也難以重現「回覆與取消同時發生」這類競態，因此不採用。

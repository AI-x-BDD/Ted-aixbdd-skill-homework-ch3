---
description: "照片相簿整理器的實作任務清單"
---

# 任務：照片相簿整理器

**[P]**：可與同段其他 [P] 任務並行（不同檔案、不依賴未完成的任務）

## 路徑慣例

- Web 應用程式（npm workspaces）：`backend/`、`frontend/`，皆位於 repo 根目錄（見 plan.md「原始碼」）
- 介面 ID（UI-01～UI-04、API-01～API-03、DB-01～DB-02、FS-01～FS-02）對應 plan.md「介面盤點」
- 資料庫端任務落在 `backend/src/repositories/`、`backend/src/db/`；檔案系統端任務落在 `backend/src/services/fileStore.js`；後端任務落在 `backend/src/lib/`、`services/`、`routes/`；前端任務落在 `frontend/`
- UI 文案、`data-testid` 與狀態一律以 `contracts/ui-contract.md` 為準，版面參考 `contracts/prototype/index.html`、`album.html`、`states.html`

---

## Phase 1：Setup（共用基礎設施）

**目的**：建立專案骨架與工具鏈

- [ ] T001 建立根目錄 `package.json`：`"private": true`、`"type": "module"`、`"engines": { "node": ">=22" }`、`"workspaces": ["frontend", "backend"]`，scripts 包含 `lint`（`eslint .`）、`format`（`prettier --write .`）、`dev`（同時啟動 backend 與 frontend）；devDependencies `eslint@^9.0.0`、`prettier@^3.4.0`
  - 📎 必讀：`techstack.md › 執行環境 › 套件管理` — workspaces 的成員與套件管理方式以此為準
  - 📎 必讀：`techstack.md › 套件安裝清單 › 根目錄` — 根目錄 devDependencies 的套件與版本以此為準
- [ ] T002 [P] 建立 `backend/package.json`：`"type": "module"`；dependencies `mysql2@^3.11.0`、`busboy@^1.6.0`、`exifr@^7.1.3`；scripts `start`（`node --env-file=.env src/server.js`）、`migrate`（`node --env-file=.env src/db/migrate.js`）
  - 📎 必讀：`techstack.md › 套件安裝清單 › backend` — backend 的 dependencies 與版本以此為準，不得增列
  - 📎 必讀：`techstack.md › 後端 › 環境變數` — scripts 載入環境變數的方式以此為準
- [ ] T003 [P] 建立 `frontend/package.json`（devDependencies `vite@^6.0.0`；scripts `dev`、`build`）與 `frontend/vite.config.js`：`server.proxy` 將 `/api` 轉發至 `http://localhost:3000`
  - 📎 必讀：`techstack.md › 套件安裝清單 › frontend` — frontend 的 devDependencies 與版本以此為準
  - 📎 必讀：`techstack.md › 前端 › 建置工具` — proxy 轉發設定的用途以此為準
- [ ] T004 [P] 建立根目錄 `eslint.config.js`（flat config，涵蓋 backend Node 環境與 frontend browser 環境）與 `.prettierrc`
  - 📎 必讀：`techstack.md › 開發工具` — lint 與格式化工具的選擇與 flat config 形式以此為準
- [ ] T005 [P] 建立 `backend/.env.example`（`HOST=127.0.0.1`、`PORT=3000`、`DB_HOST`、`DB_PORT=3306`、`DB_USER`、`DB_PASSWORD`、`DB_NAME=photo_album`、`STORAGE_DIR=backend/storage`），並在根目錄 `.gitignore` 加入 `node_modules/`、`backend/.env`、`backend/storage/`、`frontend/dist/`
  - 📎 必讀：`techstack.md › 後端 › 監聽位址` — HOST 預設值的監聽限制以此為準
  - 📎 必讀：`research.md › R-18` — 只允許本機存取的範圍以此為準，決定 HOST 預設值

---

## Phase 2：Foundational（阻擋性前置）

**目的**：所有使用者故事都依賴的核心基礎

**⚠️ 重要**：本階段完成前不得開始任何使用者故事

- [ ] T006 實作 `backend/src/config.js`：讀取環境變數 `HOST`（預設 `127.0.0.1`，R-18）、`PORT`（預設 `3000`）、`DB_HOST`、`DB_PORT`、`DB_USER`、`DB_PASSWORD`、`DB_NAME`、`STORAGE_DIR`（預設 `backend/storage`），匯出凍結物件
  - 📎 必讀：`research.md › R-18` — HOST 預設只監聽本機的理由與範圍以此為準
- [ ] T007 [P] 實作 `backend/src/lib/router.js`：約 50 行極簡路由器，以「方法 + 路徑樣式（`:param`）」比對並解析 path 與 query 參數，未匹配回傳 404
  - 📎 必讀：`research.md › R-02` — 自行實作極簡路由器、不引入框架的決定以此為準
  - 📎 必讀：`techstack.md › 後端 › HTTP 伺服器` — HTTP 伺服器的實作方式以此為準
- [ ] T008 [P] 實作 `backend/src/lib/http.js`：`sendJson(res, status, body)`、`sendError(res, status, message)`（回應 `{ message }`，訊息為繁中、說明「發生什麼事」與「可以怎麼做」，不得含錯誤代碼或技術細節，NFR-019）、`readJsonBody(req)`
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Error` — 錯誤回應的 body 結構以此為準
  - 📎 必讀：`spec.md › NFR-019` — 錯誤訊息須說明發生什麼事與可以怎麼做的要求以此為準
- [ ] T009 撰寫 `backend/src/db/migrations/001_init.sql`（DB-01、DB-02），欄位與約束依 data-model.dbml 原樣建立：
  - `albums`：`id char(36) PK`、`album_date date NOT NULL`、`position int NULL DEFAULT NULL`、`created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP`；唯一索引 `uk_albums_album_date (album_date)`；索引 `ix_albums_position (position)`（不設唯一，「不設唯一以免 ±1 位移時逐列檢查衝突」）；不得有上層相簿欄位（FR-019）
  - `photos`：`id char(36) PK`、`album_id char(36) NOT NULL`、`content_hash char(64) NOT NULL`（「檔案內容 SHA-256（十六進位小寫）」）、`original_name varchar(255) NOT NULL`、`format enum('jpeg','png','heic') NOT NULL`、`taken_at datetime NOT NULL`（「拍攝當地時間，無時區，精確到秒」）、`date_estimated tinyint NOT NULL DEFAULT 0`、`has_thumbnail tinyint NOT NULL DEFAULT 0`、`created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP`；唯一索引 `uk_photos_content_hash (content_hash)`；索引 `ix_photos_album_taken (album_id, taken_at, id)`；外鍵 `fk_photos_album_id`：`photos.album_id → albums.id ON DELETE RESTRICT`
  - `app_settings`：`setting_key varchar(64) PK`、`setting_value varchar(255) NOT NULL`；插入預設列 `('album_order_mode', 'date')`（取值為 `date` 或 `custom`）
  - 📎 必讀：`data-model.dbml › Table albums` — albums 的欄位、型別、預設值與索引以此為準
  - 📎 必讀：`data-model.dbml › Table photos` — photos 的欄位、型別、預設值與索引以此為準
  - 📎 必讀：`data-model.dbml › Table app_settings` — app_settings 的欄位與預設列以此為準
  - 📎 必讀：`data-model.dbml › Ref fk_photos_album_id` — 外鍵方向與刪除行為以此為準
- [ ] T010 實作 `backend/src/db/migrate.js`：約 30 行，建立 `schema_migrations` 表，依檔名順序執行 `backend/src/db/migrations/*.sql` 中尚未執行的檔案並記錄版本（R-16）
  - 📎 必讀：`research.md › R-16` — 遷移腳本的執行方式以此為準
  - 📎 必讀：`techstack.md › 後端 › 資料庫遷移` — 遷移採自行實作腳本的決定以此為準
- [ ] T011 實作 `backend/src/db/pool.js`：以 `mysql2/promise` 建立連線池（`dateStrings: true`，避免 `DATETIME` 被時區換算，R-06），並匯出 `withTransaction(fn)`：取得連線 → `BEGIN` → 執行 `fn(conn)` → `COMMIT`，例外時 `ROLLBACK` 並重拋
  - 📎 必讀：`research.md › R-06` — DATETIME 不做時區換算的理由以此為準，決定 dateStrings 設定
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界` — withTransaction 必須支撐的三種交易範圍以此為準
  - 📎 必讀：`techstack.md › 後端 › 資料庫驅動` — 資料庫驅動與 Promise API 的選用以此為準
- [ ] T012 實作 `backend/src/app.js`（以 router 組合路由、未捕捉例外回應 500 與繁中訊息）與 `backend/src/server.js`（`http.createServer` 只監聽 `config.HOST`、提供 `frontend/dist` 靜態檔、在 `listen` 前依序執行啟動程序清單，供 US1 註冊啟動清理）
  - 📎 必讀：`research.md › R-18` — server 只監聽 config.HOST 的要求以此為準
- [ ] T013 [P] 建立 `frontend/index.html`、`frontend/src/main.js` 與 `frontend/src/router.js`：hash 路由 `#/` → `pages/homePage.js`、`#/albums/:albumId` → `pages/albumPage.js`，頁面模組匯出 `render(container, params)`，不存在的路由導回 `#/`；不載入任何外部 CDN 資源（R-18）
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 路由` — hash 路由的路徑與未知路由的處理以此為準
  - 📎 必讀：`techstack.md › 前端 › 路由` — 路由採 hash 路由自行實作的決定以此為準
- [ ] T014 [P] 實作 `frontend/src/api/client.js`：`fetch` 包裝，非 2xx 時拋出帶有回應 `message` 的錯誤，網路失敗時拋出繁中訊息；提供 `getJson`、`putJson`、`del`、`postForm`
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Error` — 前端解析錯誤 message 的欄位以此為準
- [ ] T015 [P] 建立 `frontend/src/styles/tokens.css`（顏色、間距、字級等 CSS 自訂屬性）、`frontend/src/styles/base.css`（可見的焦點指示、符合 WCAG 2.1 AA 對比、桌面與行動版面）、`frontend/src/styles/components.css`（元件樣式只引用 tokens，含固定長寬比的封面／縮圖容器與骨架樣式），以 `contracts/prototype/` 的樣式為參考
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 版面穩定、輸入方式` — 固定長寬比佔位、焦點與對比的要求以此為準
  - 📎 必讀：`contracts/prototype/index.html › <style>` — 樣式數值與版面以原型為參考來源
  - 📎 必讀：`techstack.md › 前端 › 設計代幣` — 設計代幣採 CSS 自訂屬性的決定以此為準
- [ ] T016 [P] 實作 `frontend/src/components/toast.js`：提示訊息 `data-testid="toast"`（`role="status"`）與螢幕閱讀器播報區 `data-testid="live-region"`（`aria-live="assertive"`），匯出 `showToast(message)` 與 `announce(message)`
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 共用元件` — toast 與 live-region 的 testid、role 與 aria 屬性以此為準
- [ ] T017 [P] 實作 `frontend/src/lib/formatAlbumDate.js`：將 `YYYY-MM-DD` 格式化為「{YYYY}年{M}月{D}日（星期{X}）」，月、日不補零，星期為日、一、二、三、四、五、六（FR-006），例如 `2026-10-01` → 「2026年10月1日（星期四）」
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 相簿名稱` — 相簿名稱格式與星期寫法以此為準
  - 📎 必讀：`spec.md › FR-006` — 相簿名稱預設為日期的需求以此為準
- [ ] T018 [P] 實作 `frontend/src/lib/infiniteScroll.js`：以 `IntersectionObserver` 觀察列表末端哨兵，觸發載入下一頁、載入中顯示「載入更多…」、失敗時顯示錯誤與重試，不移動既有項目
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 分頁` — 捲動到底自動載入與「載入更多…」的呈現以此為準
  - 📎 必讀：`techstack.md › 前端 › 無限捲動` — 無限捲動採 IntersectionObserver 的決定以此為準

**Checkpoint**：基礎完成，可開始實作使用者故事

---

## Phase 3：使用者故事 1 - 匯入照片並依日期自動分組成相簿（Priority: P1）🎯 MVP

**目標**：使用者一次匯入多張照片，系統依拍攝當地日期一天一本自動建立相簿，略過重複與不支援的檔案；主頁列出所有相簿（UI-01、UI-02、API-01、API-02 列表、DB-01、DB-02、FS-01、FS-02 寫入）

**完成判準**：匯入 10 張分屬 3 個日期的照片，主頁顯示 3 本以日期命名的相簿、照片總數 10，且每張照片只在其拍攝日期的相簿中

### 資料庫端（DB-01、DB-02）

- [ ] T019 [P] [US1] 實作 `backend/src/repositories/settingsRepository.js`：`getOrderMode(conn)`、`lockOrderMode(conn)`（`SELECT setting_value FROM app_settings WHERE setting_key = 'album_order_mode' FOR UPDATE`）、`setOrderMode(conn, mode)`（取值僅限 `date`、`custom`）
  - 📎 必讀：`data-model.dbml › Table app_settings › Note` — 排序模式的取值與鎖定方式以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 匯入一張照片（importPhoto）` — 匯入交易中鎖定 album_order_mode 列的時機以此為準
- [ ] T020 [P] [US1] 實作 `backend/src/repositories/albumRepository.js` 的匯入與列表查詢：`findByDate(conn, albumDate)`、`insert(conn, { id, albumDate, position })`、`minPosition(conn)`、`listPage(conn, { orderMode, limit, offset })`（單一 SQL，以 `ROW_NUMBER()` 取拍攝時間最早的照片為封面並以 `COUNT` 算照片數，date 模式 `ORDER BY album_date DESC`、custom 模式 `ORDER BY position ASC`，避免 N+1，R-14）、`totals(conn)`（相簿總數、照片總數）
  - 📎 必讀：`data-model.dbml › Table albums › ix_albums_position` — custom 模式排序與分頁使用的索引以此為準
  - 📎 必讀：`data-model.dbml › Table photos › ix_photos_album_taken` — 封面與照片數查詢使用的索引以此為準
  - 📎 必讀：`research.md › R-14` — 列表查詢避免 N+1 的效能要求以此為準
- [ ] T021 [P] [US1] 實作 `backend/src/repositories/photoRepository.js` 的 `insert(conn, photo)`（欄位 `id, album_id, content_hash, original_name, format, taken_at, date_estimated, has_thumbnail`）與 `findById(conn, id)`
  - 📎 必讀：`data-model.dbml › Table photos` — insert 必須寫入的欄位與型別以此為準

### 檔案系統端（FS-01、FS-02）

- [ ] T022 [US1] 實作 `backend/src/services/fileStore.js`（FS-01、FS-02）：依 storage-contract.md——`createUpload()` 以 `crypto.randomUUID()` 產生 `upload_id`；串流寫入 `tmp/<upload_id>.part` 並同步計算 SHA-256（64 個小寫十六進位字元）；縮圖寫入 `tmp/<upload_id>.thumb.part`；`fsync` 後以 `rename` 原子搬到 `originals/<hash 前兩碼>/<content_hash>.<jpg|png|heic>`、`thumbnails/<hash 前兩碼>/<content_hash>.jpg`，正式路徑已存在時不覆蓋並刪除暫存檔，並記錄「本次建立」；以 `content_hash` 為鍵的程序內互斥鎖 `withHashLock(hash, fn)`；`discardCreated()` 只刪本次建立的正式檔；`openOriginal(hash, format)`、`openThumbnail(hash)` 串流讀取（檔案不存在時回報 not found）
  - 📎 必讀：`contracts/storage-contract.md › 原始檔儲存區 › 新增與刪除連動 › 新增、新增失敗、重複內容` — 原始檔搬移、不覆蓋與失敗清除的規則以此為準
  - 📎 必讀：`contracts/storage-contract.md › 縮圖儲存區 › 新增與刪除連動 › 新增、新增失敗、重複內容` — 縮圖暫存與搬移的時機以此為準
  - 📎 必讀：`research.md › R-17` — 匯入中斷時的一致性要求以此為準
  - 📎 必讀：`contracts/storage-contract.md › 儲存契約：照片相簿整理器` — STORAGE_DIR、同一檔案系統與雜湊互斥鎖的共通約束以此為準
  - 📎 必讀：`techstack.md › 後端 › 內容雜湊` — SHA-256 計算方式以此為準
- [ ] T023 [US1] 在 `backend/src/services/fileStore.js` 實作 `startupCleanup(pool)`，並在 `backend/src/server.js` 開始監聽前執行：刪除 `tmp/` 內全部 `.part` 與 `.thumb.part`；刪除 `originals/` 中沒有 `photos.content_hash` 引用或檔名不符命名規則的檔案；刪除 `thumbnails/` 中沒有 `has_thumbnail = 1` 的資料列引用或檔名不符規則的檔案；刪除變空的 `<hash_prefix>/` 目錄；不修改任何資料列（依賴 T022）
  - 📎 必讀：`contracts/storage-contract.md › 原始檔儲存區 › 新增與刪除連動 › 啟動清理` — 啟動清理對原始檔的刪除條件以此為準
  - 📎 必讀：`contracts/storage-contract.md › 縮圖儲存區 › 新增與刪除連動 › 啟動清理` — 啟動清理對縮圖的刪除條件以此為準

### 後端（API-01、API-02 列表）

- [ ] T024 [P] [US1] 實作 `backend/src/lib/sniff.js`：讀取檔頭魔術位元組判定 `jpeg`／`png`／`heic`，約 20 行，不引入 `file-type`（R-09）
  - 📎 必讀：`research.md › R-09` — 判定規則與不引入 file-type 的決定以此為準
- [ ] T025 [P] [US1] 實作 `backend/src/lib/takenDate.js`：以 `exifr`（`reviveValues: false`）讀取拍攝日期，依序取 `DateTimeOriginal` → `CreateDate` → `DateTimeDigitized` 的原始字串並轉為 `YYYY-MM-DD HH:MM:SS`（不做時區換算），皆無時採用 `lastModifiedLocal` 並標記推估，兩者皆無時回報無法判定，回傳 `{ takenAt: 'YYYY-MM-DD HH:MM:SS', dateEstimated }`（R-06）
  - 📎 必讀：`research.md › R-06` — 讀取順序與不做時區換算的規則以此為準
  - 📎 必讀：`techstack.md › 後端 › EXIF 讀取` — EXIF 讀取套件與版本以此為準
- [ ] T026 [US1] 實作 `backend/src/services/importService.js`（API-01）：接收串流 → 判定格式（不符回 415）→ 計算雜湊 → 取得拍攝日期（無法判定回 422）→ 在 `withHashLock` 內搬入原始檔與縮圖 → `withTransaction`：`lockOrderMode` → 依 `DATE(taken_at)` `findByDate`，不存在時 `insert`（custom 模式 `position = MIN(position) - 1`，date 模式 `NULL`，FR-016）→ 插入照片；遇 `ER_DUP_ENTRY`（`uk_photos_content_hash`）回滾並回傳 duplicate、不刪既有正式檔；其他交易失敗回滾並 `discardCreated()`；回傳 `ImportCreated` 所需的 `photo`、`album`、`albumCreated`、`orderMode`（依賴 T019～T021、T022、T024、T025）
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 匯入一張照片（importPhoto）` — 交易內的步驟順序與 duplicate 判定以此為準
  - 📎 必讀：`contracts/storage-contract.md › 原始檔儲存區 › 新增與刪除連動 › 新增、重複內容` — 搬檔時機與重複內容不刪既有檔的規則以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.ImportCreated` — 回傳物件必須組出的欄位以此為準
  - 📎 必讀：`spec.md › FR-016` — custom 模式下新相簿放最前面的需求以此為準
- [ ] T027 [US1] 實作 `backend/src/services/albumService.js` 的 `listAlbums({ limit, offset })`：讀取排序模式並組成 `AlbumList`，封面縮圖位址為 `/api/photos/{coverPhotoId}/thumbnail`（封面沒有縮圖時為 `null`）（依賴 T019、T020）
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.AlbumList` — AlbumList 的欄位與封面縮圖位址的組法以此為準
- [ ] T028 [US1] 實作 `backend/src/routes/photos.js` 的 `POST /api/photos`：以 `busboy` 串流解析 multipart（`file` 必填、可選 `thumbnail`、`lastModifiedLocal`，單檔上限 50 MB 超過回 413，`thumbnail` 在 `file` 之前或之後皆可），接收失敗或用戶端中斷時刪除 `.part` 與 `.thumb.part`；成功回 201、重複回 200；以及 `GET /api/photos/{photoId}/thumbnail`（`has_thumbnail = 0` 或檔案不存在回 404，回應帶 `ETag`（內容雜湊）與 `Cache-Control: public, max-age=31536000, immutable`，`If-None-Match` 相同回 304），並註冊至 `backend/src/app.js`（依賴 T026）
  - 📎 必讀：`contracts/openapi.yaml › importPhoto › requestBody` — multipart 欄位名稱、必填與順序以此為準
  - 📎 必讀：`contracts/openapi.yaml › getPhotoThumbnail › responses 200／304／404` — 縮圖回應的狀態碼與快取標頭以此為準
  - 📎 必讀：`contracts/storage-contract.md › 縮圖儲存區 › 新增與刪除連動 › 新增失敗` — 接收失敗時暫存檔的清除範圍以此為準
  - 📎 必讀：`techstack.md › 後端 › 上傳解析` — multipart 串流解析套件以此為準
- [ ] T029 [US1] 實作 `backend/src/routes/albums.js` 的 `GET /api/albums`（驗證 `limit` 1～200、`offset` ≥ 0，超出回 400），並註冊至 `backend/src/app.js`（依賴 T027）
  - 📎 必讀：`contracts/openapi.yaml › listAlbums › parameters` — limit、offset 的驗證範圍以此為準

### 前端（UI-01 瀏覽、UI-02）

- [ ] T030 [P] [US1] 實作 `frontend/src/lib/thumbnail.js`：`createImageBitmap(file, { imageOrientation: 'from-image' })` ＋ `OffscreenCanvas` 產生長邊 400px、品質 0.8 的 JPEG `Blob`；解碼失敗（如不支援 HEIC 的瀏覽器）回傳 `null`（R-07）
  - 📎 必讀：`research.md › R-07` — 縮圖尺寸、品質與解碼失敗的處理以此為準
  - 📎 必讀：`techstack.md › 前端 › 縮圖產生` — 縮圖產生採 createImageBitmap 與 OffscreenCanvas 的決定以此為準
- [ ] T031 [P] [US1] 實作 `frontend/src/lib/uploadQueue.js`：模組層級單例佇列，一張一個請求、並行 3（R-10），送出 `file`、可選 `thumbnail`、`lastModifiedLocal`（`File.lastModified` 以本地時區格式化為 `YYYY-MM-DDTHH:mm:ss`）；依 HTTP 狀態分類結果（201 已新增、200 重複、415 不支援、413 過大、422 損毀、網路錯誤為連線中斷）；提供訂閱介面讓 importPanel 與 homePage 接收進度與每張結果；切換頁面不中斷
  - 📎 必讀：`contracts/openapi.yaml › importPhoto › requestBody、responses` — 送出欄位與 HTTP 狀態對應的結果分類以此為準
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 匯入佇列` — 匯入跨頁面不中斷的要求以此為準
- [ ] T032 [P] [US1] 實作 `frontend/src/components/albumCard.js`：卡片 `album-card` 與連結 `album-card-link`（`#/albums/:albumId`），名稱以 `formatAlbumDate` 產生、顯示「{照片數量} 張照片」、封面 `<img loading="lazy" decoding="async">` 置於 `aspect-ratio: 1` 容器，替代文字「{相簿名稱}，{照片數量} 張照片」（NFR-004），`coverPreviewable: false` 時顯示「無法預覽封面」；預留拖曳把手 `album-drag-handle` 插槽供 US3 使用
  - 📎 必讀：`contracts/ui-contract.md › UI-01 主頁相簿列表介面 › 文案與無障礙 › 卡片名稱～封面無法預覽` — 卡片文案與替代文字以此為準，不得自行改寫
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Album` — 卡片使用的相簿欄位以此為準
- [ ] T033 [US1] 實作 `frontend/src/components/importPanel.js`（UI-02）：對話框 `import-dialog`、`import-choose`／`import-file-input`（multiple）、進度條 `import-progress`（`role="progressbar"`、`aria-label="匯入進度"`、`aria-valuemin=0`、`aria-valuenow`、`aria-valuemax`）與「已完成 {完成數}／{總數}」「正在匯入 {檔名}」、`import-background`／`import-close`、摘要 `import-summary`（新增數、略過重複數、`import-unsupported-list`、`import-failed-list` 含原因文案）、`import-done`、`import-again`、完成播報；標題依結果切換「匯入完成」「照片未能匯入」「沒有可匯入的照片」（依賴 T030、T031）
  - 📎 必讀：`contracts/ui-contract.md › UI-02 匯入對話框介面 › 操作` — 對話框的操作流程以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 匯入對話框介面 › 狀態` — 對話框各狀態的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-02 匯入對話框介面 › 文案與無障礙` — 對話框文案、testid 與進度條 aria 屬性以此為準，不得自行改寫
  - 📎 必讀：`contracts/prototype/index.html › import-dialog` — 對話框版面以原型為參考來源
- [ ] T034 [US1] 實作 `frontend/src/pages/homePage.js`（UI-01 瀏覽部分）：`home-album-list`（無障礙名稱「相簿列表」）以 `infiniteScroll` 分頁載入 `GET /api/albums`；頁首「共 {相簿數} 本相簿、{照片數} 張照片」與 `open-import`；載入中 8 張卡片骨架與「正在載入相簿…」；空狀態 `home-empty`（「還沒有相簿」、說明、`empty-import`）；錯誤 `home-load-error` 與 `home-retry`；匯入狀態膠囊 `import-status-pill`（「匯入中 {完成數}／{總數}」「匯入完成，查看結果」）；訂閱 uploadQueue，每張 201 結果即時更新：既有相簿照片數加一，新相簿依 `orderMode` 插入（date 模式依日期位置、custom 模式放最前面）（依賴 T032、T033）
  - 📎 必讀：`contracts/ui-contract.md › UI-01 主頁相簿列表介面 › 操作 › 瀏覽相簿列表、開啟匯入、匯入後更新列表、重新載入列表` — 主頁各操作的互動與匯入後更新規則以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-01 主頁相簿列表介面 › 狀態` — 載入、空狀態與錯誤的呈現以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.AlbumList` — 列表分頁欄位以此為準
  - 📎 必讀：`contracts/prototype/index.html › home-album-list` — 主頁版面以原型為參考來源

**Checkpoint**：US1 符合完成判準，即為 MVP

---

## Phase 4：使用者故事 2 - 在相簿中以平鋪方式預覽照片（Priority: P2）

**目標**：開啟相簿後以大小一致的縮圖格線依拍攝時間由早到晚呈現照片，點選可在燈箱放大並切換上一張／下一張（UI-03、UI-04、API-02 單本、API-03 讀取、FS-01／FS-02 讀取）

**完成判準**：開啟含 50 張照片的相簿，格狀縮圖依拍攝時間排序、載入時版面不跳動，點選可放大、切換前後張並返回

### 資料庫端（DB-01、DB-02 讀取）

- [ ] T035 [P] [US2] 在 `backend/src/repositories/albumRepository.js` 新增 `findById(conn, id)`：回傳相簿與即時計算的照片數、封面（拍攝時間最早）與封面是否有縮圖
  - 📎 必讀：`data-model.dbml › Table albums › Note` — 照片數與封面即時計算、不另存的規則以此為準
- [ ] T036 [P] [US2] 在 `backend/src/repositories/photoRepository.js` 新增 `listByAlbum(conn, { albumId, limit, afterTakenAt, afterId })`（以 `ix_photos_album_taken` 做 `(taken_at, id) > (?, ?)` 游標分頁）與 `findDetail(conn, id)`（以視窗函式或相鄰查詢取得 `index`、`albumPhotoCount`、`previousId`、`nextId`）
  - 📎 必讀：`data-model.dbml › Table photos › ix_photos_album_taken` — 游標分頁必須使用的索引以此為準

### 後端（API-02 單本、API-03 讀取）

- [ ] T037 [US2] 實作 `backend/src/services/photoService.js` 的 `getAlbum`、`listAlbumPhotos`（組出 `thumbnailUrl`，無縮圖為 `null`；`nextCursor` 以本頁最後一筆的 `takenAt`、`id` 組成，不足一頁為 `null`）、`getPhoto`（組出 `originalUrl`、`downloadUrl`）（依賴 T035、T036）
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Photo` — thumbnailUrl 與照片欄位的組法以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.PhotoList` — nextCursor 的組成與最後一頁的表示以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.PhotoDetail` — originalUrl、downloadUrl 與前後張欄位以此為準
- [ ] T038 [US2] 在 `backend/src/routes/albums.js` 新增 `GET /api/albums/{albumId}` 與 `GET /api/albums/{albumId}/photos`（含參數驗證與 400／404）（依賴 T037）
  - 📎 必讀：`contracts/openapi.yaml › listAlbumPhotos › parameters` — 參數驗證的規則以此為準
- [ ] T039 [US2] 在 `backend/src/routes/photos.js` 新增 `GET /api/photos/{photoId}` 與 `GET /api/photos/{photoId}/original`（依 `format` 設定 `Content-Type`、`download=true` 時 `Content-Disposition: attachment; filename*=UTF-8''<原始檔名>`、`ETag`、長效快取、304、檔案遺失回 404 不修改資料列）（依賴 T037）
  - 📎 必讀：`contracts/openapi.yaml › getOriginalPhoto › responses 200` — 原圖回應標頭的格式以此為準
  - 📎 必讀：`contracts/storage-contract.md › 原始檔儲存區 › 新增與刪除連動 › 讀取` — 原始檔遺失時的處理以此為準

### 前端（UI-03、UI-04）

- [ ] T040 [P] [US2] 實作 `frontend/src/components/photoGrid.js`（UI-03 格線）：`album-photo-grid`（無障礙名稱「{相簿名稱}的照片」）、正方形 `photo-tile`（`aspect-ratio: 1`、`loading="lazy"`、淡入不改變尺寸）、替代文字「{相簿名稱}，第 {序號} 張」／推估時加「，日期為推估」（NFR-008）、`photo-estimated-badge`、縮圖 404 時該格顯示「無法顯示此照片」、`hasThumbnail: false` 的 HEIC 顯示「此瀏覽器無法預覽 HEIC 照片」；以 `infiniteScroll` 載入下一頁；點選或 Enter 開啟燈箱；預留刪除鈕 `photo-delete` 插槽供 US4 使用
  - 📎 必讀：`contracts/ui-contract.md › UI-03 相簿平鋪預覽介面 › 狀態` — 縮圖載入、失敗與 HEIC 無縮圖的呈現以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-03 相簿平鋪預覽介面 › 文案與無障礙` — 格線替代文字、推估標示與無障礙名稱以此為準，不得自行改寫
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.Photo` — 格線使用的照片欄位以此為準
- [ ] T041 [P] [US2] 實作 `frontend/src/components/lightbox.js`（UI-04）：`photo-lightbox`（`role="dialog"`、`aria-modal="true"`、`aria-label="照片放大檢視"`）、`lightbox-image`（先顯示縮圖並疊「正在載入照片…」，原圖載入後替換）、`lightbox-position`「第 {序號} 張，共 {總數} 張」與切換播報、推估標示、`lightbox-prev`／`lightbox-next`（方向鍵與觸控左右滑動，可切換到格線尚未載入的照片）、`lightbox-close`「返回相簿」（Esc、點背景）、錯誤時顯示提示與 `lightbox-download`；預留 `lightbox-delete` 插槽供 US4 使用
  - 📎 必讀：`contracts/ui-contract.md › UI-04 燈箱放大檢視介面 › 操作` — 燈箱切換、關閉與觸控滑動的操作以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-04 燈箱放大檢視介面 › 文案與無障礙` — 燈箱文案、role 與 aria 屬性以此為準，不得自行改寫
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.PhotoDetail` — 序號、總數與前後張欄位以此為準
- [ ] T042 [US2] 實作 `frontend/src/pages/albumPage.js`（UI-03 頁面）：`album-title` 與照片數量、`album-back`（無障礙名稱「返回相簿列表」，返回 `#/` 並保留主頁捲動位置）、標題與 12 格（或依照片數）骨架、`album-load-error`／`album-retry`、`album-not-found`（「找不到這本相簿」與「回到相簿列表」）；組合 photoGrid 與 lightbox，關閉燈箱時格線捲到目前照片並聚焦該縮圖（依賴 T040、T041）
  - 📎 必讀：`contracts/ui-contract.md › UI-03 相簿平鋪預覽介面 › 操作` — 返回列表與關閉燈箱後焦點的行為以此為準
  - 📎 必讀：`contracts/ui-contract.md › UI-03 相簿平鋪預覽介面 › 狀態` — 相簿頁載入、錯誤與找不到相簿的呈現以此為準
  - 📎 必讀：`contracts/prototype/album.html › album-photo-grid` — 相簿頁版面以原型為參考來源

**Checkpoint**：US1 與 US2 皆可獨立運作

---

## Phase 5：使用者故事 3 - 在主頁面以拖放重新排列相簿（Priority: P3）

**目標**：主頁以滑鼠、觸控或鍵盤重新排列相簿，順序全有或全無地保存，重新開啟後維持（UI-01 排序部分、API-02 移動、DB-01 position）

**完成判準**：拖放調整順序後重新開啟應用程式，順序維持；匯入新日期照片後新相簿出現在最前面且其他相對順序不變

### 資料庫端（DB-01 position）

- [ ] T043 [US3] 在 `backend/src/repositories/albumRepository.js` 新增 `materializePositions(conn)`（依 `album_date DESC` 將所有 `position` 寫為 0..n-1）、`findPositionsForUpdate(conn, ids)`、`shiftRange(conn, from, to, delta)`（單一 `UPDATE` 位移 ±1）、`setPosition(conn, id, position)`、`maxPosition(conn)`
  - 📎 必讀：`data-model.dbml › Table albums › position` — position 在 date 模式為 NULL 與數字小者在前的語意以此為準
  - 📎 必讀：`research.md › R-11` — 實體化與位移的排序模型以此為準

### 後端（API-02 移動）

- [ ] T044 [P] [US3] 在 `backend/src/services/albumService.js` 新增純函式 `computeShift(fromPosition, targetPosition)`：給定被移動相簿位置與目標位置，回傳位移區間、方向（±1）與新位置
  - 📎 必讀：`research.md › R-11` — 位移方向與區間的計算模型以此為準
- [ ] T045 [US3] 在 `backend/src/services/albumService.js` 實作 `moveAlbum(albumId, beforeAlbumId)`：`withTransaction` 內 `lockOrderMode`；若為 `date` 先 `materializePositions` 並 `setOrderMode('custom')`；以 `computeShift` 位移區間並設定被移動相簿位置；`beforeAlbumId` 為 `null` 時移到最後；任何失敗整筆回滾（依賴 T043、T044）
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 移動相簿（moveAlbum）` — 交易內鎖定、實體化與位移的順序以此為準
- [ ] T046 [US3] 在 `backend/src/routes/albums.js` 新增 `PUT /api/albums/{albumId}/position`：驗證 `beforeAlbumId` 必填（字串或 `null`）且不得等於 `albumId`（400），相簿不存在回 404，失敗回 500 與「無法儲存相簿順序，已還原剛才的排列。請再試一次。」（依賴 T045）
  - 📎 必讀：`contracts/openapi.yaml › moveAlbum › requestBody、responses` — 請求驗證與錯誤回應以此為準

### 前端（UI-01 排序）

- [ ] T047 [P] [US3] 實作 `frontend/src/lib/sortable.js`：以 Pointer Events 實作拖放（滑鼠與觸控，不用 HTML5 DnD 或 SortableJS），拖曳時顯示 `drop-indicator`；拆出純函式（插入點計算、鍵盤狀態機）；拖到列表外或 Esc 取消；放下時回呼 `onMove(albumId, beforeAlbumId)` 一次（R-12）
  - 📎 必讀：`research.md › R-12` — 採 Pointer Events 自行實作、不用 HTML5 DnD 的決定以此為準
  - 📎 必讀：`techstack.md › 前端 › 拖放排序` — 拖放排序的實作技術以此為準
  - 📎 必讀：`contracts/prototype/index.html › drop-indicator` — 放置指示線的呈現以原型為參考來源
- [ ] T048 [US3] 在 `frontend/src/components/albumCard.js` 加入拖曳把手 `album-drag-handle`（無障礙名稱「調整{相簿名稱}的順序」、說明「按空白鍵或 Enter 拿起，方向鍵移動，再按一次放下，按 Esc 取消。」）
  - 📎 必讀：`contracts/ui-contract.md › UI-01 主頁相簿列表介面 › 文案與無障礙 › 拖曳把手無障礙名稱、拖曳把手說明` — 把手的無障礙名稱與說明文字以此為準，不得自行改寫
- [ ] T049 [US3] 在 `frontend/src/pages/homePage.js` 整合 sortable：放下後立即重排（樂觀更新，200 毫秒內回饋）並呼叫 `PUT /api/albums/{albumId}/position`；失敗時還原為上一次成功的順序、`showToast` 與 `announce` 排序失敗文案；成功後將本地 `orderMode` 設為 `custom`；以 `announce` 播報拿起、移動、放下、取消（NFR-011）（依賴 T047、T048）
  - 📎 必讀：`contracts/ui-contract.md › UI-01 主頁相簿列表介面 › 狀態 › 錯誤` — 排序失敗時還原與提示的呈現以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.AlbumMoved` — 成功後更新本地 orderMode 的欄位以此為準

**Checkpoint**：US1～US3 皆可獨立運作

---

## Phase 6：使用者故事 4 - 從應用程式刪除照片（Priority: P4）

**目標**：在相簿格線或燈箱刪除照片，只移除應用程式內的資料、副本與縮圖，最後一張被刪時自動移除相簿（UI-03／UI-04 刪除、API-03 刪除、DB 刪除交易、FS 刪除連動）

**完成判準**：刪除一張照片後任何畫面皆不再出現，主頁照片數同步減少，裝置上原始檔的位置、檔名與內容不變

### 資料庫端（DB-01、DB-02 刪除）

- [ ] T050 [P] [US4] 在 `backend/src/repositories/photoRepository.js` 新增 `findForUpdate(conn, id)`、`deleteById(conn, id)`、`countByAlbum(conn, albumId)`
  - 📎 必讀：`data-model.dbml › Table photos › ix_photos_album_taken` — countByAlbum 使用的索引以此為準
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 刪除照片（deletePhoto）` — 刪除照片交易中鎖定與刪除的範圍以此為準
- [ ] T051 [P] [US4] 在 `backend/src/repositories/albumRepository.js` 新增 `deleteById(conn, id)`
  - 📎 必讀：`data-model.dbml › Ref fk_photos_album_id` — 刪除相簿前必須已無照片的約束以此為準

### 檔案系統端（FS-01、FS-02 刪除）

- [ ] T052 [P] [US4] 在 `backend/src/services/fileStore.js` 新增 `removeFiles(hash, format, hasThumbnail)`：在 `withHashLock` 內刪除原始檔與縮圖，`ENOENT` 視為成功，其他錯誤記錄後回報但不拋出
  - 📎 必讀：`contracts/storage-contract.md › 原始檔儲存區 › 新增與刪除連動 › 刪除照片` — 刪除原始檔的時機與失敗處理以此為準
  - 📎 必讀：`contracts/storage-contract.md › 縮圖儲存區 › 新增與刪除連動 › 刪除照片` — 刪除縮圖的條件與失敗處理以此為準

### 後端（API-03 刪除）

- [ ] T053 [US4] 在 `backend/src/services/photoService.js` 實作 `deletePhoto(photoId)`：`withTransaction` 內鎖定並刪除照片、計算剩餘張數，剩餘 0 張時刪除相簿；交易提交後才呼叫 `removeFiles`，檔案刪除失敗仍回傳成功；回傳 `PhotoDeleted`（依賴 T050、T051、T052）
  - 📎 必讀：`data-model.dbml › Project Note › 交易邊界 › 刪除照片（deletePhoto）` — 交易內刪除照片與空相簿的範圍以此為準
  - 📎 必讀：`contracts/storage-contract.md › 原始檔儲存區 › 新增與刪除連動 › 刪除照片` — 交易提交後才刪檔、刪檔失敗仍回成功的規則以此為準
- [ ] T054 [US4] 在 `backend/src/routes/photos.js` 新增 `DELETE /api/photos/{photoId}`：不存在回 404，交易失敗回 500 與「無法刪除這張照片，照片仍保留在相簿中。請再試一次。」（依賴 T053）
  - 📎 必讀：`contracts/openapi.yaml › deletePhoto › responses` — 404 與 500 的條件與訊息以此為準

### 前端（UI-03、UI-04 刪除）

- [ ] T055 [P] [US4] 實作 `frontend/src/components/confirmDialog.js`：`confirm-dialog`、`confirm-ok`、`confirm-cancel`，標題「要從相簿移除這張照片嗎？」、說明「只會從應用程式移除，裝置上的原始檔不會被刪除。」、確認「刪除照片」、取消「取消」；Esc 取消並將焦點還給觸發元素；回傳 Promise\<boolean\>
  - 📎 必讀：`contracts/ui-contract.md › 共用約定 › 共用元件` — confirm-dialog 的 testid 與共用用語以此為準
  - 📎 必讀：`contracts/prototype/album.html › confirm-dialog` — 確認對話框版面以原型為參考來源
- [ ] T056 [US4] 在 `frontend/src/components/photoGrid.js` 啟用 `photo-delete`（無障礙名稱「刪除第 {序號} 張照片」，滑鼠停留或聚焦時出現、觸控裝置常駐）：確認後移除該格並由後方補位、更新頁首照片數、播報「已刪除照片，相簿剩下 {剩餘數} 張」；`albumRemoved` 時 `showToast` 相簿移除提示並返回 `#/`；失敗時保留並提示（依賴 T055）
  - 📎 必讀：`contracts/ui-contract.md › UI-03 相簿平鋪預覽介面 › 操作 › 刪除照片` — 刪除後補位、數量更新與返回主頁的行為以此為準
  - 📎 必讀：`contracts/openapi.yaml › components.schemas.PhotoDeleted` — 判斷是否返回主頁的 albumRemoved 欄位以此為準
- [ ] T057 [US4] 在 `frontend/src/components/lightbox.js` 啟用 `lightbox-delete`：確認後有下一張切到下一張、否則切到上一張；`albumRemoved` 時關閉燈箱、提示並返回主頁；失敗時停留該張並提示；同步通知 photoGrid 移除該格（依賴 T055、T056）
  - 📎 必讀：`contracts/ui-contract.md › UI-04 燈箱放大檢視介面 › 操作 › 刪除照片` — 燈箱刪除後切換到哪一張的規則以此為準

**Checkpoint**：所有使用者故事皆可獨立運作

---

## Phase 7：Polish 與跨領域事項

**目的**：橫跨多個故事的程式品質收尾

- [ ] T058 [P] 在根目錄執行 `npm run lint` 與 `npm run format`，修正全專案問題

---

## 相依與執行順序

### 階段相依

- **Setup（Phase 1）**：無相依，可立即開始
- **Foundational（Phase 2）**：依賴 Setup 完成，阻擋所有使用者故事
- **使用者故事（Phase 3～6）**：皆依賴 Foundational 完成，之後依優先順序 P1 → P2 → P3 → P4 執行，或有人力時並行
- **Polish（Phase 7）**：依賴所有使用者故事完成

### 使用者故事相依

- **US1（P1）**：Foundational 完成後即可開始，不依賴其他故事
- **US2（P2）**：Foundational 完成後即可開始；照片資料需要 US1 的匯入 API（T026、T028）建立，檔案讀取沿用 US1 的 fileStore（T022），但畫面與 API 本身可獨立完成
- **US3（P3）**：依賴 US1 的主頁列表（T034）與相簿卡片（T032）；FR-016 的「新相簿放最前面」已由 US1 的 importService 實作
- **US4（P4）**：依賴 US2 的格線與燈箱（T040、T041）以及 US1 的 fileStore（T022）

### 各故事內部順序

- 端點依序：資料庫端 → 檔案系統端 → 後端 → 前端；故事未涉及的端點不列出
- 同一檔案的任務依序執行（例如 `albumRepository.js` 在 US1、US2、US3、US4 各有新增，`homePage.js` 在 US1、US3 各有修改）

### 並行機會

- Setup：T002～T005 可並行
- Foundational：T007、T008、T013～T018 可並行（T009 → T010 → T011 → T012 需依序）
- US1：資料庫端 T019～T021 可並行；後端 T024、T025 可並行；前端 T030～T032 可並行；資料庫端與檔案系統端可同時進行
- US2：T035、T036 可並行；前端 T040、T041 可並行
- US3：T043 與 T044 可並行
- US4：資料庫端 T050、T051 與檔案系統端 T052 可並行
- 不同故事的不同端點可由不同人員同時進行（注意共用檔案）

---

## 並行範例：使用者故事 1

```bash
# 同時進行資料庫端與檔案系統端：
Task: "backend/src/repositories/settingsRepository.js"
Task: "backend/src/repositories/albumRepository.js"
Task: "backend/src/repositories/photoRepository.js"
Task: "backend/src/services/fileStore.js"

# 同時進行後端獨立模組：
Task: "backend/src/lib/sniff.js"
Task: "backend/src/lib/takenDate.js"

# 同時進行前端獨立模組：
Task: "frontend/src/lib/thumbnail.js"
Task: "frontend/src/lib/uploadQueue.js"
Task: "frontend/src/components/albumCard.js"
```

## 並行範例：使用者故事 2

```bash
# 同時進行資料庫端查詢：
Task: "backend/src/repositories/albumRepository.js 的 findById"
Task: "backend/src/repositories/photoRepository.js 的 listByAlbum、findDetail"

# 同時進行前端元件：
Task: "frontend/src/components/photoGrid.js"
Task: "frontend/src/components/lightbox.js"
```

## 並行範例：使用者故事 3

```bash
# 同時進行排序模型與拖放模組：
Task: "backend/src/repositories/albumRepository.js 的 position 操作"
Task: "backend/src/services/albumService.js 的 computeShift"
Task: "frontend/src/lib/sortable.js"
```

## 並行範例：使用者故事 4

```bash
# 同時進行資料庫端、檔案系統端與確認對話框：
Task: "backend/src/repositories/photoRepository.js 的刪除查詢"
Task: "backend/src/repositories/albumRepository.js 的 deleteById"
Task: "backend/src/services/fileStore.js 的 removeFiles"
Task: "frontend/src/components/confirmDialog.js"
```

---

## 實作策略

### MVP 優先（只做使用者故事 1）

1. 完成 Phase 1：Setup
2. 完成 Phase 2：Foundational（阻擋所有故事）
3. 完成 Phase 3：US1
4. **停下並驗證**：對照 US1 完成判準，在主頁匯入分屬多個日期的照片並確認分組結果
5. 可展示：匯入照片後主頁依日期分組顯示相簿

### 漸進交付

1. Setup ＋ Foundational → 基礎就緒
2. 加入 US1 → 對照完成判準 → 展示（MVP）
3. 加入 US2 → 對照完成判準 → 展示（可瀏覽與放大）
4. 加入 US3 → 對照完成判準 → 展示（可自訂順序）
5. 加入 US4 → 對照完成判準 → 展示（可刪除）
6. Phase 7 → lint 與格式收尾

### 團隊並行策略

1. 全員完成 Setup ＋ Foundational
2. 之後依端點分工：
   - 開發者 A：各故事的資料庫端與檔案系統端
   - 開發者 B：各故事的後端
   - 開發者 C：各故事的前端
3. 共用檔案（`albumRepository.js`、`photoRepository.js`、`homePage.js`、`photoGrid.js`、`lightbox.js`）依故事順序合併

---

## 備註

- [P] 任務 = 不同檔案、無相依
- [Story] 標籤讓任務可追溯到使用者故事
- 每個使用者故事都應可獨立完成，並以完成判準確認
- 每完成一個任務或一組邏輯任務即提交
- 可在任一 Checkpoint 停下，對照完成判準確認該故事
- 避免：模糊任務、同檔案衝突、破壞獨立性的跨故事相依

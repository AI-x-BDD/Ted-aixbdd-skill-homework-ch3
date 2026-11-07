# 規格分析報告：照片相簿整理器

**功能代號**：`001-photo-album-organizer` | **日期**：2026-10-27 | **產生方式**：`/analyze`

**結論**：可以進入 `/implement`。共 0 個 CRITICAL、1 個 HIGH，建議先處理 U1。

## 分析範圍

| 產物                                                             | 產出 skill                  | 涵蓋介面       | 狀態 |
| ---------------------------------------------------------------- | --------------------------- | -------------- | ---- |
| [spec.md](./spec.md)                                             | specify、clarify-over-specs | —              | ✅   |
| [research.md](./research.md)                                     | technical-research          | —              | ✅   |
| [techstack.md](./techstack.md)                                   | technical-research          | —              | ✅   |
| [plan.md](./plan.md)                                             | system-analysis             | —              | ✅   |
| [contracts/ui-contract.md](./contracts/ui-contract.md)           | ui-ux-plan                  | UI-01～UI-04   | ✅   |
| [contracts/prototype/](./contracts/prototype/)                   | ui-ux-plan                  | UI-01～UI-04   | ✅   |
| [contracts/openapi.yaml](./contracts/openapi.yaml)               | api-plan                    | API-01～API-03 | ✅   |
| [data-model.dbml](./data-model.dbml)                             | data-plan                   | DB-01、DB-02   | ✅   |
| [contracts/storage-contract.md](./contracts/storage-contract.md) | storage-plan                | FS-01、FS-02   | ✅   |
| [tasks.md](./tasks.md)                                           | task                        | —              | ✅   |

## 前置檢查

| 檢查項目                            | 結果 | 說明                                                           |
| ----------------------------------- | ---- | -------------------------------------------------------------- |
| 必要產物                            | ✅   | spec.md、research.md、techstack.md、plan.md、tasks.md 都存在   |
| 介面文檔                            | ✅   | plan.md 介面盤點的 4 個端點，對應 Planner 宣告的介面文檔都存在 |
| plan.md 結構檢查（check_plan.py）   | ✅   | 0 個問題                                                       |
| tasks.md 結構檢查（check_tasks.py） | ✅   | 58 個任務，0 個問題                                            |

## 與前次分析比較

| 變化   | 數量 | ID                                                         |
| ------ | ---- | ---------------------------------------------------------- |
| 已解決 | 2    | I9、A2                                                     |
| 仍存在 | 15   | U1、C1、C2、I1、I2、A1、C3、I3、I4、I5、I6、I7、I8、D1、U2 |
| 新增   | 0    | —                                                          |

**已解決的問題**：

- **I9**（MEDIUM）：T002 的 `exifr` 版本原為 `^7.0.0`，已改為與 techstack.md 一致的 `^7.1.3`。
- **A2**（LOW）：NFR-009 的「明確提示」已改寫為顯示「無法預覽此格式」文字與檔名。

## 發現事項

| ID  | 類別     | 嚴重度 | 位置                                                                                                  | 摘要                                                                                                                                                                                     | 建議                                                                                                    |
| --- | -------- | ------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| U1  | 規格不足 | HIGH   | tasks.md:L34（T005）、L46（T006）、L69（T012）                                                        | `STORAGE_DIR` 預設值 `backend/storage` 與靜態檔路徑 `frontend/dist` 都是相對路徑。T002 的 `start` script 在 workspace 中以 `backend/` 為工作目錄執行，會解析成 `backend/backend/storage` | 在 T005、T006、T012 規定相對路徑以 repo 根目錄（或 `import.meta.url`）為基準解析                        |
| C1  | 覆蓋缺口 | MEDIUM | plan.md:L55-62（`e2e/`、`scripts/seed-large.js`、`perf.js`）、spec.md:L226-227（NFR-023）             | plan.md 的原始碼結構規劃了驗收測試專案與 10k 種子資料、p95 量測腳本，但 tasks 依設計不含測試，目前沒有任何流程負責建立它們，SC-001、SC-003、SC-007 無從驗證                              | 在 plan.md 註明測試與量測產物由測試流程負責，或從原始碼結構移除                                         |
| C2  | 覆蓋缺口 | MEDIUM | spec.md:L193-194（NFR-014）、tasks.md（T049）                                                         | 「所有點擊、按鍵、拖放 200ms 內要有可見回饋」只在 T049（拖放）提到；plan 介面盤點沒有任何介面依據 NFR-014，匯入、燈箱、刪除的介面文檔與任務也沒有對應要求                                | 在 plan 介面盤點的 UI-02～UI-04 補上 NFR-014，重新產出 ui-contract 後，於 T033、T041、T056 補上即時回饋 |
| I1  | 不一致   | MEDIUM | tasks.md:L23（T001）vs plan.md:L23、techstack.md:L16                                                  | T001 的 `workspaces` 只有 `["frontend","backend"]`，plan 與 techstack 是 `frontend、backend、e2e`                                                                                        | 讓 T001 與 techstack 一致，或在 plan 說明 e2e 延後加入                                                  |
| I2  | 不一致   | MEDIUM | plan.md:L11-18 vs tasks.md 必讀錨點                                                                   | plan 的「文件」結構沒有列出 `contracts/`（openapi.yaml、ui-contract.md、storage-contract.md、prototype/）與 `data-model.dbml`，但 tasks 大量以它們作為必讀錨點                           | 在 plan 文件結構補上各 Planner 的產出                                                                   |
| A1  | 模糊     | MEDIUM | spec.md:L243（SC-003「無明顯卡頓」）、L244（SC-004「感受不到延遲」）、L98（NFR-006「明顯跳動」）      | 使用主觀形容詞。量化值（p95 200ms、CLS ≤ 0.1）只寫在 research.md R-14，spec 本身沒有                                                                                                     | 把 R-14 的量化門檻寫回 spec 的 SC／NFR                                                                  |
| C3  | 覆蓋缺口 | LOW    | contracts/openapi.yaml:L160（getAlbum）、L316（getPhoto）vs tasks.md:L186（T037）、L192（T039）       | T037、T039 實作了這兩個端點，但必讀錨點只指向 `components.schemas.PhotoDetail`，沒有指向 operation 本身，實作時讀不到 404 等錯誤回應                                                     | 在 T037 補上 `openapi.yaml › getAlbum › responses`，在 T039 補上 `openapi.yaml › getPhoto › responses`  |
| I3  | 不一致   | LOW    | plan.md:L120（API-02「列表、排序」）vs contracts/openapi.yaml:L160（getAlbum）、tasks.md:L186（T037） | openapi 與 tasks 在 API-02 下多了單本查詢 `GET /api/albums/{albumId}`，plan 介面盤點的 API-02 描述沒有提到                                                                               | 更新 plan 介面盤點的 API-02 描述為「列表、單本、排序」                                                  |
| I4  | 不一致   | LOW    | plan.md:L115（UI-01 依據需求）vs contracts/ui-contract.md › UI-01 › 文案與無障礙                      | ui-contract 的 UI-01 卡片顯示相簿名稱（`formatAlbumDate`），但 plan 介面盤點的 UI-01 依據需求沒有列 FR-006                                                                               | 在 plan 介面盤點的 UI-01 補上 FR-006                                                                    |
| I5  | 不一致   | LOW    | spec.md:L231-232（關鍵實體「照片」）vs data-model.dbml:L31（Table photos）                            | 照片屬性列了「在相簿內的排序位置」，但 FR-010 與假設都規定固定依拍攝時間排序，photos 資料表也沒有這個欄位                                                                                | 從關鍵實體移除這個屬性，或改寫成「依拍攝時間排序」                                                      |
| I6  | 不一致   | LOW    | spec.md:L233（相簿定義）vs spec.md FR-003                                                             | 相簿定義寫「同一日期區間」，FR-003 是「以天為單位」                                                                                                                                      | 改為「同一拍攝日期」                                                                                    |
| I7  | 不一致   | LOW    | spec.md:L47（FR-002「建立／修改日期」）vs tasks.md:L127（T025 只用 `lastModifiedLocal`）              | 瀏覽器只能取得檔案的修改日期，拿不到建立日期                                                                                                                                             | 把 FR-002 修正為「修改日期」，或在假設中說明限制                                                        |
| I8  | 不一致   | LOW    | research.md:L95、L154、L166、L195                                                                     | research.md 引用「憲法原則 II／III／IV」，但 repo 裡沒有任何 constitution 檔案                                                                                                           | 移除 research.md 的憲法引用，或改寫成引用的實際依據                                                     |
| D1  | 重複     | LOW    | FR-018 / 邊界情況 L174 / US4 情境 3；FR-016 / 邊界情況 L177 / 假設 L263；NFR-012 與 FR-017            | 同一條規則在多處重述（內容一致，不影響執行）                                                                                                                                             | 可保留，或只留在 FR，其他地方改用引用                                                                   |
| U2  | 規格不足 | LOW    | spec.md:L7                                                                                            | 已經產出 tasks，spec 狀態仍是「草稿」                                                                                                                                                    | 更新狀態                                                                                                |

## 需求覆蓋

| 需求    | plan 介面                   | 任務                       | 狀態      | 備註                                                             |
| ------- | --------------------------- | -------------------------- | --------- | ---------------------------------------------------------------- |
| FR-001  | UI-02、API-01               | T031、T033                 | ✅        |                                                                  |
| FR-002  | UI-03、API-01、DB-02        | T025、T040、T041           | ✅        | 見 I7                                                            |
| FR-003  | API-01、DB-01               | T009、T020、T026           | ✅        |                                                                  |
| FR-004  | API-01、DB-02               | T009、T026                 | ✅        |                                                                  |
| FR-005  | DB-02                       | T009                       | ✅        | 設計上不提供移動照片的 API                                       |
| FR-006  | UI-03、API-02               | T017、T032                 | ✅        | 見 I4                                                            |
| FR-007  | UI-01、API-02、DB-01        | T020、T027、T032、T034     | ✅        |                                                                  |
| FR-008  | UI-02、API-01、DB-02        | T009、T022、T026、T033     | ✅        |                                                                  |
| FR-009  | UI-02、API-01               | T024、T031、T033           | ✅        |                                                                  |
| FR-010  | UI-03、API-03、FS-02        | T036、T040                 | ✅        |                                                                  |
| FR-011  | UI-04、API-03               | T036、T041                 | ✅        |                                                                  |
| FR-012  | UI-04                       | T041、T042                 | ✅        |                                                                  |
| FR-013  | UI-01、API-02               | T045～T049                 | ✅        |                                                                  |
| FR-014  | UI-01                       | T047、T049                 | ✅        |                                                                  |
| FR-015  | API-02、DB-01               | T043、T045                 | ✅        |                                                                  |
| FR-016  | UI-01、API-02、DB-01        | T026、T034                 | ✅        |                                                                  |
| FR-017  | UI-03、UI-04、API-03、FS-01 | T053～T057                 | ✅        |                                                                  |
| FR-018  | UI-03、API-03、DB-01        | T051、T053、T056           | ✅        |                                                                  |
| FR-019  | UI-01、DB-01                | T009                       | ✅        |                                                                  |
| FR-020  | UI-01～UI-04                | T008、T014，以及各 UI 任務 | ✅        |                                                                  |
| NFR-001 | UI-02                       | T031、T033、T034           | ✅        |                                                                  |
| NFR-002 | API-01、FS-01               | T022、T023、T026、T028     | ✅        |                                                                  |
| NFR-003 | API-01                      | T031                       | ✅        |                                                                  |
| NFR-004 | UI-01                       | T032                       | ✅        |                                                                  |
| NFR-005 | API-01、FS-01               | T024                       | ✅        |                                                                  |
| NFR-006 | UI-03                       | T015、T040                 | ✅        | 見 A1                                                            |
| NFR-007 | UI-04                       | T039、T040、T041           | ✅        |                                                                  |
| NFR-008 | UI-03                       | T040                       | ✅        |                                                                  |
| NFR-009 | UI-03                       | T030、T040                 | ✅        |                                                                  |
| NFR-010 | API-02                      | T045、T049                 | ✅        |                                                                  |
| NFR-011 | UI-01                       | T049                       | ✅        |                                                                  |
| NFR-012 | API-03、FS-01、FS-02        | T052、T053                 | ✅        |                                                                  |
| NFR-013 | —                           | T020、T029、T036           | ⚠️ 部分   | 有分頁設計，但 plan 介面盤點沒有介面依據它，也沒有量測任務（C1） |
| NFR-014 | —                           | T049                       | ⚠️ 部分   | 見 C2                                                            |
| NFR-015 | UI-02                       | T031                       | ⚠️ 部分   | 沒有容量驗證（C1）                                               |
| NFR-016 | DB-01、DB-02                | T009～T011                 | ✅        |                                                                  |
| NFR-017 | —                           | T013                       | ✅        | 跨領域需求，由 Foundational 任務負責                             |
| NFR-018 | —                           | T005、T006、T012           | ✅        | 跨領域需求；見 U1                                                |
| NFR-019 | —                           | T008                       | ✅        | 跨領域需求                                                       |
| NFR-020 | UI-01                       | T034、T042 等              | ✅        |                                                                  |
| NFR-021 | —                           | T015、T041、T047           | ✅        | 跨領域需求                                                       |
| NFR-022 | —                           | T015、T041、T047           | ✅        | 跨領域需求                                                       |
| NFR-023 | —                           | —                          | ➖ 範圍外 | 自動化驗證屬於測試流程，不屬於 tasks；負責流程未定（C1）         |
| SC-001  | —                           | 設計面有涵蓋               | ⚠️ 部分   | 沒有量測工具（C1）                                               |
| SC-002  | API-01                      | T025、T026                 | ✅        |                                                                  |
| SC-003  | —                           | 設計面有涵蓋               | ⚠️ 部分   | 沒有量測工具（C1）；見 A1                                        |
| SC-004  | —                           | 設計面有涵蓋               | ⚠️ 部分   | 見 A1                                                            |
| SC-006  | UI-01～UI-04                | T015、T047                 | ⚠️ 部分   | 沒有 axe 檢測任務（C1）                                          |
| SC-007  | —                           | 設計面有涵蓋               | ⚠️ 部分   | 1 萬張與首屏 2.5 秒沒有量測工具（C1）                            |
| SC-008  | API-01、FS-01               | T022、T023                 | ✅        |                                                                  |
| SC-009  | —                           | T013                       | ✅        |                                                                  |

**不列入覆蓋的成功標準**：SC-005 是易用性成果指標，上線後才能量測，不需要建置工作。

## 介面文檔覆蓋

| 介面   | 介面文檔                                                                | 錨定任務                           | 狀態    | 備註                        |
| ------ | ----------------------------------------------------------------------- | ---------------------------------- | ------- | --------------------------- |
| UI-01  | ui-contract.md › UI-01、prototype/index.html                            | T032、T034、T048、T049             | ✅      |                             |
| UI-02  | ui-contract.md › UI-02、prototype/index.html › import-dialog            | T033                               | ✅      |                             |
| UI-03  | ui-contract.md › UI-03、prototype/album.html                            | T040、T042、T056                   | ✅      |                             |
| UI-04  | ui-contract.md › UI-04                                                  | T041、T057                         | ✅      |                             |
| API-01 | openapi.yaml › importPhoto、getPhotoThumbnail                           | T026、T028、T031                   | ✅      |                             |
| API-02 | openapi.yaml › listAlbums、getAlbum、moveAlbum                          | T027、T029、T034、T046、T049       | ⚠️ 部分 | getAlbum 沒有任務錨定（C3） |
| API-03 | openapi.yaml › listAlbumPhotos、getPhoto、deletePhoto、getOriginalPhoto | T037、T038、T039、T054、T056       | ⚠️ 部分 | getPhoto 沒有任務錨定（C3） |
| DB-01  | data-model.dbml › Table albums、Table app_settings                      | T009、T019、T020、T035、T043       | ✅      |                             |
| DB-02  | data-model.dbml › Table photos、Ref fk_photos_album_id                  | T009、T020、T021、T036、T050、T051 | ✅      |                             |
| FS-01  | storage-contract.md › 原始檔儲存區                                      | T022、T023、T026、T039、T052、T053 | ✅      |                             |
| FS-02  | storage-contract.md › 縮圖儲存區                                        | T022、T023、T028、T052             | ✅      |                             |

## 反向覆蓋

**未對應需求的任務**：無。T001～T018 是 Setup 與 Foundational 基礎建設，T058 是 Polish 收尾，屬於合理的支撐任務。

**未被任務錨定的介面文檔段落**：2 個。

- `contracts/openapi.yaml › getAlbum`（C3）
- `contracts/openapi.yaml › getPhoto`（C3）

## 指標

| 指標           | 數值                                                       |
| -------------- | ---------------------------------------------------------- |
| 需求總數       | 51（20 FR、23 NFR、8 個需要建置的 SC）                     |
| 任務總數       | 58                                                         |
| 需求覆蓋率     | 100%（50/50，NFR-023 屬範圍外不列入；其中 8 項只部分涵蓋） |
| 介面文檔覆蓋率 | 82%（9/11 個介面完整錨定）                                 |
| 發現事項       | 15（CRITICAL 0、HIGH 1、MEDIUM 5、LOW 9）                  |
| 各類別         | 覆蓋缺口 3、不一致 8、模糊 1、重複 1、規格不足 2           |

## 下一步

- 沒有 CRITICAL 問題，可以進入 `/implement`，建議先處理 HIGH。
- **U1**：`STORAGE_DIR` 相對路徑會在實作時直接造成錯誤，請手動修正 tasks.md 的 T005、T006、T012。
- **C1**：決定測試與量測產物由哪個流程負責，再更新 plan.md 的原始碼結構。
- **C2**：用 `/system-analysis` 更新介面盤點後，重新執行 `/ui-ux-plan` 產出 ui-contract.md，再用 `/task` 更新對應任務。
- **I2、I3、I4**：只需要更新 plan.md 的文件結構與介面盤點。
- **C3**：手動在 tasks.md 的 T037、T039 補上必讀錨點。
- **A1、I5、I6、I7、U2**：spec 文字問題，可以用 `/clarify-over-specs` 處理，或手動修改 spec.md。
- **I8**：手動修改 research.md。

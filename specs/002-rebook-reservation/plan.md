# 實作計畫：一鍵「再預約一次」

**分支**：`002-rebook-reservation` | **日期**：2026-11-07 | **規格**：[spec.md](./spec.md) | **研究紀錄**：[research.md](./research.md) | **技術堆疊**：[techstack.md](./techstack.md)

**輸入**：來自 `/specs/002-rebook-reservation/spec.md` 的功能規格

## 專案結構

### 文件（本功能）

```text
specs/002-rebook-reservation/
├── spec.md              # 功能規格（由 /specify 產生）
├── clarify-log.md       # 需求訪談問答紀錄（由 /specify 產生）
├── research.md          # 技術決策與理由（由 /technical-research 產生）
├── techstack.md         # 採用技術與套件版本（由 /technical-research 產生）
├── plan.md              # 本文件
└── tasks.md             # 實作任務（由後續任務拆解產生，不由本指令建立）
```

### 原始碼（repo 根目錄）

本功能在既有專案內增修，下列只列出會被改動或新增的位置，其餘沿用 001-venue-booking 的結構。

```text
shared/
└── src/
    └── copy.js                       # 增修：再預約的按鈕文案、停用原因與成功提示

backend/
└── src/
    ├── services/contextService.js    # 增修：我的預約清單每筆帶出 venueActive
    └── repositories/bookingRepository.js  # 增修：清單查詢帶出場地啟用狀態
    # 不新增路由、資料表或遷移；建立與讀取預約沿用既有 API

frontend/
└── src/
    ├── router.js                     # 增修：#/bookings/new 接受 from 參數
    ├── pages/
    │   ├── myBookingsPage.js         # 增修：載入暫停資訊並傳給預約卡片
    │   └── bookingFormPage.js        # 增修：依 from 預填、場地唯讀、成功後回清單
    ├── components/bookingCard.js     # 增修：動作列加入「再預約一次」按鈕
    └── lib/rebook.js                 # 新增：按鈕是否可按與原因文案的純函式

e2e/
└── features/
    └── rebook.feature                # 新增：使用者故事 1 的驗收情境
```

**結構決策**：沿用既有前端 ＋ 後端的 npm workspaces 結構，不新增 workspace 與資料庫遷移。按鈕可用性判斷抽成 `frontend/src/lib/rebook.js` 的純函式，是為了讓 SC-001 要求的按鈕規則能以表格測試窮舉；再預約不新增後端端點，是為了讓 FR-006 要求的「與建立單次預約完全相同的規則」只有一份實作（見 research.md R-02）。

## 分析流程規劃

### 介面盤點

| 介面 ID | 介面 | 所屬端點 | 依據需求 |
| ------- | ---- | -------- | -------- |
| UI-01 | 我的預約清單的再預約按鈕介面（按鈕、停用狀態與原因文案） | 前端 | FR-001、FR-002、FR-003、NFR-004 |
| UI-02 | 再預約預填表單介面（預填場地／主題／人數、場地唯讀、必填提示、規則拒絕訊息、成功提示、放棄離開） | 前端 | FR-004、FR-005、FR-006、FR-007、FR-008、FR-009、FR-010、FR-011、NFR-001、NFR-003、NFR-004 |
| API-01 | 我的預約清單 API（每筆預約的場地啟用狀態） | 後端 | FR-002 |
| API-02 | 預約建立與讀取 API（再預約沿用的建立規則、來源預約讀取與授權） | 後端 | FR-006、FR-007、FR-008、NFR-001、NFR-002、NFR-003 |

### 分析 Wave

**共用輸入**（每個 Wave 的 sub-agent 皆須讀取）：`spec.md`、`techstack.md`

**Wave 1 — 前端（UI-01～UI-02）**

- 分析重點：「我的預約」每筆預約旁的按鈕在各種狀態、場地停用與預約權限暫停下的顯示與可按規則；從按下按鈕到預填表單、重新選時間、送出、被規則拒絕、成功回到清單、放棄離開的完整流程與各畫面狀態；窄螢幕下的版面；以及需要後端提供哪些資料與行為。
- 相依：無
- 委派：開 1 個 sub-agent，分別分析前端。

**Wave 2 — 後端（API-01～API-02）**

- 分析重點：滿足 Wave 1 畫面需要的清單資料、來源預約讀取與建立預約的請求與回應、授權與錯誤回應；再預約沿用既有建立規則時需要確認的行為與重複送出、併發的處理；以及這些介面需要讀寫哪些既有資料（本功能預期不新增資料結構，需確認）。
- 相依：Wave 1 前端的產出
- 委派：開 1 個 sub-agent，分別分析後端。

共盤點 2 個端點、4 個介面、2 個 Wave，介面之間沒有循環依賴。

# Planner 配對規範

## Rule 1 -- Planner 名稱依介面 ID 前綴對照

**強度：MUST**

每個 Wave 的每個端點，必須取該端點在 plan.md 介面盤點的介面 ID 前綴，依下表對照 Planner 名稱，不得依中文端點名稱對照。表中沒有的前綴，Planner 名稱為 `<前綴小寫>-plan`，並必須在配對表後請使用者確認此名稱。不得自訂表外的名稱。

| 介面 ID 前綴 | Planner 名稱   |
| ------------ | -------------- |
| `UI`         | `ui-ux-plan`   |
| `API`        | `api-plan`     |
| `DB`         | `data-plan`    |
| `FS`         | `storage-plan` |

### Good Example

這個範例的端點名稱寫成「MySQL 資料庫」，仍依前綴 `DB` 對照為 `data-plan`；表外前綴 `HW` 命名為 `hw-plan` 並請使用者確認。

```markdown
| Wave | 端點         | 介面前綴 | Planner     | 狀態 |
| ---- | ------------ | -------- | ----------- | ---- |
| 3    | MySQL 資料庫 | `DB`     | `data-plan` | 已有 |
| 3    | 感測裝置     | `HW`     | `hw-plan`   | 缺少 |

`HW` 不在對照表，Planner 暫定命名為 `hw-plan`，請確認是否採用此名稱。
```

### Bad Example

這個範例依中文端點名稱命名為 `mysql-plan`，與既有的 `data-plan` 對不上，配對為缺少後會重建一個職責相同的 Planner。

```markdown
| Wave | 端點         | 介面前綴 | Planner      | 狀態 |
| ---- | ------------ | -------- | ------------ | ---- |
| 3    | MySQL 資料庫 | `DB`     | `mysql-plan` | 缺少 |
```

## Rule 2 -- 一種端點類型只對應一個 Planner

**強度：MUST**

不同前綴的端點必須各自對應一個 Planner，不得合併給同一個 Planner；一個端點的全部產出由同一個 Planner 負責。

### Good Example

這個範例的資料庫端與檔案系統端雖在同一個 Wave，仍各自對應一個 Planner。

```markdown
| Wave | 端點       | 介面前綴 | Planner        | 狀態 |
| ---- | ---------- | -------- | -------------- | ---- |
| 3    | 資料庫端   | `DB`     | `data-plan`    | 缺少 |
| 3    | 檔案系統端 | `FS`     | `storage-plan` | 缺少 |
```

### Bad Example

這個範例把檔案系統端併給 `data-plan`，一個 Planner 要產出兩個端點結構不同的文檔，樣板得同時涵蓋資料表與目錄結構，Planner 的職責變得模糊。

```markdown
| Wave | 端點       | 介面前綴 | Planner     | 狀態 |
| ---- | ---------- | -------- | ----------- | ---- |
| 3    | 資料庫端   | `DB`     | `data-plan` | 缺少 |
| 3    | 檔案系統端 | `FS`     | `data-plan` | 缺少 |
```

## Rule 3 -- 狀態依名稱與職責判定

**強度：MUST**

每列狀態必須依下表判定，「負責端點」以 skill 的 description 寫明負責的端點類型為準，不比對產出檔名。`.claude/skills/` 底下只有資料夾、沒有 SKILL.md 的不算 skill。

| 狀態                       | 判定                                                         | 後續處理                                        |
| -------------------------- | ------------------------------------------------------------ | ----------------------------------------------- |
| 已有                       | 有同名 skill，且 description 的負責端點與該列相同            | 直接使用                                        |
| 疑似已有（`<skill 名稱>`） | 沒有同名 skill，但有其他 skill 的 description 負責同類型端點 | 請使用者決定沿用、改名或另建                    |
| 不符                       | 有同名 skill，但 description 負責其他類型的端點              | 建議交由 skill-engineering 優化，不撰寫委派簡報 |
| 缺少                       | 沒有同名 skill，也沒有負責同類型端點的 skill                 | 撰寫委派簡報                                    |

### Good Example

這個範例的資料庫端沒有 `data-plan`，但 `db-plan` 的 description 寫明負責資料庫端，標為疑似已有並請使用者決定，不直接重建。

```markdown
| Wave | 端點     | 介面前綴 | Planner     | 狀態                  |
| ---- | -------- | -------- | ----------- | --------------------- |
| 3    | 資料庫端 | `DB`     | `data-plan` | 疑似已有（`db-plan`） |

`db-plan` 的 description 寫明負責資料庫端，請決定沿用 `db-plan`、改名為 `data-plan`，或另建 `data-plan`。
```

### Bad Example

這個範例只比對名稱，沒有檢查其他 skill 的職責，`db-plan` 已負責資料庫端仍標為缺少，會重建出兩個職責重複、產出格式各異的 Planner。

```markdown
| Wave | 端點     | 介面前綴 | Planner     | 狀態 |
| ---- | -------- | -------- | ----------- | ---- |
| 3    | 資料庫端 | `DB`     | `data-plan` | 缺少 |
```

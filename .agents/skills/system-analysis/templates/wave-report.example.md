| Wave | 端點       | Planner        | 產出                                               | 狀態 |
| ---- | ---------- | -------------- | -------------------------------------------------- | ---- |
| 1    | 前端       | `ui-ux-plan`   | `contracts/ui-contract.md`、`contracts/prototype/` | 完成 |
| 2    | 後端       | `api-plan`     | `contracts/openapi.yaml`                           | 完成 |
| 3    | 資料庫端   | `data-plan`    | `data-model.dbml`                                  | 完成 |
| 3    | 檔案系統端 | `storage-plan` | `contracts/storage-contract.md`                    | 完成 |

## 憲法衝突

| 端點     | 輸入文件與位置                      | 衝突內容                     | 條款     | 產出物處理                         | 後續處理                                                |
| -------- | ----------------------------------- | ---------------------------- | -------- | ---------------------------------- | ------------------------------------------------------- |
| 後端     | plan.md「分析 Wave」Wave 2 分析重點 | 匯入失敗時只回傳 HTTP 狀態碼 | C-ERR-01 | 各錯誤回應加上 `code` 與 `message` | system-analysis 修正 Wave 2 分析重點                    |
| 資料庫端 | techstack.md「資料庫」列            | 主鍵使用自動遞增整數         | C-DB-01  | albums、photos 主鍵改為 UUID       | technical-research 修正 techstack.md 與其引用的研究紀錄 |

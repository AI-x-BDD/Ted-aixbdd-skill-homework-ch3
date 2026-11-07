# API 分析規範

## Rule 1 -- 每個外層需要都必須有對應的 API

**強度：MUST**

前置產出中每一項需要內層提供的資料與動作，都必須對應到至少一個 API 操作，並在該操作的 description 寫出它服務的外層操作。外層寫「無」的操作不得為其新增 API。

### Good Example

這個範例的 description 寫出對應的外層操作，可回溯到前端的「開始匯入」。

```yaml
summary: 匯入一張照片
description: 對應選取並匯入多張時的單檔請求。依拍攝日期歸入當日相簿；重複內容回報略過。
```

### Bad Example

這個範例為前端已註明「無（前端先過濾）」的格式過濾另開 API，多出沒有呼叫者的端點，也讓前後端對過濾責任各有一套說法。

```yaml
/api/photos/validate:
  post:
    summary: 檢查檔案格式
```

## Rule 2 -- x-inner-needs 必須完整列出讀寫對象

**強度：MUST**

每個 API 操作必須有 `x-inner-needs`，`data` 列出讀寫的資料名稱、存取方式（read、write、delete）與用到的欄位，`files` 列出讀寫的儲存區與存取方式；沒有對象時寫空陣列。不得省略此欄位，內層的 Planner 只依它推導資料表與儲存區。

### Good Example

這個範例的刪除操作同時列出資料與兩個儲存區，內層能推導出刪除連動。

```yaml
x-inner-needs:
  data:
    - name: photos
      access: write
      fields: [id, album_id]
  files:
    - name: originals
      access: delete
    - name: thumbnails
      access: delete
```

### Bad Example

這個範例漏列縮圖儲存區，檔案系統端的 Planner 不知道刪除照片要一併刪除縮圖，留下孤兒檔案。

```yaml
x-inner-needs:
  data:
    - name: photos
      access: write
      fields: [id]
  files:
    - name: originals
      access: delete
```

## Rule 3 -- 錯誤回應必須使用共用結構並遵循文案要求

**強度：MUST**

每個可能失敗的操作必須列出對應的錯誤狀態碼，回應本文一律引用 `components/schemas/Error`；Error 的訊息語言與寫法必須遵循 spec.md 的要求，並以 `examples` 列出代表性訊息。

### Good Example

這個範例的錯誤回應引用共用結構，訊息例子說明發生什麼與可以怎麼做。

```yaml
"415":
  description: 不支援的檔案格式
  content:
    application/json:
      schema:
        $ref: "#/components/schemas/Error"
```

### Bad Example

這個範例為單一操作自訂錯誤結構，前端必須為每個 API 寫不同的錯誤處理。

```yaml
"415":
  description: 不支援的檔案格式
  content:
    application/json:
      schema:
        type: object
        properties:
          err_code:
            type: integer
```

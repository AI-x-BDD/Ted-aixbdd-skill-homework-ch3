# UI 分析規範

## Rule 1 -- 每個介面必須涵蓋四種狀態

**強度：MUST**

每個介面必須寫出成功、載入、空狀態與錯誤四種狀態的呈現。某種狀態不會單獨出現時，必須寫出該情況下畫面會怎麼處理，不得留空或省略。

### Good Example

這個範例的燈箱不會單獨出現空狀態，仍寫出刪到沒有照片時的處理。

```markdown
| 空狀態 | 不單獨出現；刪到沒有照片時關閉燈箱並離開相簿頁 |
```

### Bad Example

這個範例省略空狀態，實作時刪光照片的燈箱沒有定義行為，可能停留在一個空白疊層。

```markdown
| 成功 | 顯示大圖與上一張／下一張控制 |
| 載入 | 大圖區域顯示載入中 |
| 錯誤 | 無法解碼時顯示提示 |
```

## Rule 2 -- 需要內層提供只寫資料與動作

**強度：MUST**

「需要內層提供」必須寫出操作需要的資料項目與動作，讓後端的 Planner 據此設計 API；不得寫出 API 路徑、HTTP 方法或欄位型別。操作完全在前端完成時寫「無」並說明原因。

### Good Example

這個範例只寫出需要的資料項目，API 設計留給後端。

```markdown
| 瀏覽相簿列表 | 開啟主頁，以卡片顯示名稱、照片數量與封面縮圖 | 相簿列表（識別、名稱、照片數、封面位址、目前順序） |
```

### Bad Example

這個範例寫出 API 路徑與回應欄位，前端分析越界替後端做了設計，後端的 Planner 被未經分析的路徑綁住。

```markdown
| 瀏覽相簿列表 | 開啟主頁顯示卡片 | `GET /api/albums` 回傳 `{ id, name, photoCount }` |
```

## Rule 3 -- 文案必須涵蓋所有可見文字與無障礙文字

**強度：MUST**

文案與無障礙表必須列出介面上每個可見文字、錯誤訊息、替代文字與螢幕閱讀器播報，語言與用語遵循 spec.md 的要求；含變數的文案以 `{變數名稱}` 標示。

### Good Example

這個範例列出替代文字與播報，變數以大括號標示。

```markdown
| 封面替代文字 | {相簿日期}，{照片數量} 張照片 |
| 放下播報 | {相簿名稱}已移到第 {新序} 本，共 {總數} 本 |
```

### Bad Example

這個範例只列出按鈕文字，缺少替代文字與播報，實作時各自決定文案，無障礙要求無法驗收。

```markdown
| 匯入按鈕 | 匯入照片 |
```

## Rule 4 -- 原型必須對應契約的操作與狀態

**強度：MUST**

原型必須為 ui-contract.md 的每個頁面各產出一個可直接以瀏覽器開啟的 HTML，實作契約中的每個操作，並能以 `?state=` 切換到每種非成功狀態；`states.html` 必須列出每個頁面每種狀態的連結。原型的文案必須與契約一致。

### Good Example

這個範例的狀態入口列出主頁的每種狀態，連結可直接切換。

```html
<li>
  <a href="index.html?state=loading">載入<code>?state=loading</code></a>
</li>
<li>
  <a href="index.html?state=empty">空狀態<code>?state=empty</code></a>
</li>
```

### Bad Example

這個範例的原型只呈現成功狀態，契約定義的空狀態與錯誤無法在原型中檢視，驗收時無法比對畫面。

```html
<li><a href="index.html">主頁</a></li>
```

## Rule 5 -- 原型的定位屬性必須與契約一致

**強度：MUST**

原型中每個介面與可操作元素的 `data-testid` 必須與 ui-contract.md 的定位屬性完全相同，讓驗收測試的定位器能先在原型上驗證。不得為原型另取一套定位名稱。

### Good Example

這個範例的相簿列表沿用契約定位 `[data-testid="home-album-list"]`。

```html
<ul
  class="album-grid"
  id="grid"
  data-testid="home-album-list"
  aria-label="相簿列表"
></ul>
```

### Bad Example

這個範例在原型改用 `album-grid`，依契約撰寫的驗收步驟在原型上找不到元素，契約與原型無法互相對照。

```html
<ul class="album-grid" data-testid="album-grid"></ul>
```

## Rule 6 -- 原型以互動與狀態完整為優先

**強度：MUST**

原型必須優先完整呈現契約的操作、狀態與文案，視覺維持中等保真度即可；只使用內嵌的假資料，不得呼叫後端或外部服務。範例的視覺精細度、假資料產生方式與頁面配置屬於該功能的設計，不得照搬到其他功能；假資料必須依本功能的業務內容設計。

### Good Example

這個範例的表單功能以簡單色塊與文字呈現欄位，把篇幅花在驗證錯誤與送出中狀態的切換。

```html
<form data-testid="signup-form">
  <label>電子郵件 <input type="email" required /></label>
  <p class="error" hidden>請輸入有效的電子郵件。</p>
</form>
```

### Bad Example

這個範例為表單功能照搬相簿範例的 SVG 風景圖產生器作為背景，花大量篇幅在與本功能無關的視覺，狀態切換卻未完成。

```html
<script>
  function photoSrc(p) {
    /* 產生山景、海景 SVG …… */
  }
</script>
```

---
description: "{{feature_name}}的實作任務清單"
---

# 任務：{{feature_name}}

**[P]**：可與同段其他 [P] 任務並行（不同檔案、不依賴未完成的任務）

## 路徑慣例

<!-- 重複開始：每條路徑慣例一行 -->

- {{path_convention}}

<!-- 重複結束 -->

---

## Phase 1：Setup（共用基礎設施）

**目的**：建立專案骨架與工具鏈

<!-- 重複開始：每個 Setup 任務一項 -->

- [ ] {{task_id}} {{task_markers}} {{task_description}}

<!-- 重複開始：每個任務細項一行，可無 -->

- {{task_detail}}

<!-- 重複結束 -->
<!-- 重複開始：每個必讀位置一行 -->

- 📎 必讀：`{{reference_anchor}}` — {{reference_reason}}

<!-- 重複結束 -->
<!-- 重複結束 -->

---

## Phase 2：Foundational（阻擋性前置）

**目的**：所有使用者故事都依賴的核心基礎

**⚠️ 重要**：本階段完成前不得開始任何使用者故事

<!-- 重複開始：每個 Foundational 任務一項 -->

- [ ] {{task_id}} {{task_markers}} {{task_description}}

<!-- 重複開始：每個任務細項一行，可無 -->

- {{task_detail}}

<!-- 重複結束 -->
<!-- 重複開始：每個必讀位置一行 -->

- 📎 必讀：`{{reference_anchor}}` — {{reference_reason}}

<!-- 重複結束 -->
<!-- 重複結束 -->

**Checkpoint**：基礎完成，可開始實作使用者故事

---

<!-- 重複開始：每個使用者故事一個 Phase -->

## Phase {{phase_number}}：使用者故事 {{story_number}} - {{story_title}}（Priority: P{{story_priority}}）{{mvp_marker}}

**目標**：{{story_goal_with_interface_ids}}

**完成判準**：{{story_done_criteria}}

<!-- 重複開始：每個本故事涉及的端點一節 -->

### {{endpoint_name}}（{{endpoint_interface_scope}}）

<!-- 重複開始：每個端點任務一項 -->

- [ ] {{task_id}} {{task_markers}} {{task_description}}

<!-- 重複開始：每個任務細項一行，可無 -->

- {{task_detail}}

<!-- 重複結束 -->
<!-- 重複開始：每個必讀位置一行 -->

- 📎 必讀：`{{reference_anchor}}` — {{reference_reason}}

<!-- 重複結束 -->
<!-- 重複結束 -->

<!-- 重複結束 -->

**Checkpoint**：{{story_checkpoint}}

---

<!-- 重複結束 -->

## Phase {{polish_phase_number}}：Polish 與跨領域事項

**目的**：{{polish_purpose}}

<!-- 重複開始：每個 Polish 任務一項 -->

- [ ] {{task_id}} {{task_markers}} {{task_description}}

<!-- 重複結束 -->

---

## 相依與執行順序

### 階段相依

- **Setup（Phase 1）**：無相依，可立即開始
- **Foundational（Phase 2）**：依賴 Setup 完成，阻擋所有使用者故事
- **使用者故事（Phase 3～{{last_story_phase_number}}）**：皆依賴 Foundational 完成，之後依優先順序 {{story_priority_order}} 執行，或有人力時並行
- **Polish（Phase {{polish_phase_number}}）**：依賴所有使用者故事完成

### 使用者故事相依

<!-- 重複開始：每個使用者故事一行 -->

- **US{{story_number}}（P{{story_priority}}）**：{{story_dependency}}

<!-- 重複結束 -->

### 各故事內部順序

- 端點依序：{{endpoint_order}}；故事未涉及的端點不列出
- 同一檔案的任務依序執行（{{shared_file_sequence_examples}}）

### 並行機會

<!-- 重複開始：每個階段或故事一行 -->

- {{parallel_scope}}：{{parallel_task_ranges}}

<!-- 重複結束 -->

- 不同故事的不同端點可由不同人員同時進行（注意共用檔案）

---

<!-- 重複開始：每個使用者故事一節 -->

## 並行範例：使用者故事 {{story_number}}

```bash
# 重複開始：每組可同時進行的任務一組，組間空一行
# {{parallel_group_label}}：
# 重複開始：每個任務一行
Task: "{{parallel_task_summary}}"
# 重複結束
# 重複結束
```

<!-- 重複結束 -->

---

## 實作策略

### MVP 優先（只做使用者故事 1）

1. 完成 Phase 1：Setup
2. 完成 Phase 2：Foundational（阻擋所有故事）
3. 完成 Phase 3：US1
4. **停下並驗證**：對照 US1 完成判準，{{mvp_verification}}
5. 可展示：{{mvp_demo}}

### 漸進交付

1. Setup ＋ Foundational → 基礎就緒

<!-- 重複開始：每個使用者故事一行 -->

{{delivery_step_number}}. 加入 US{{story_number}} → 對照完成判準 → 展示（{{story_demo}}）
<!-- 重複結束 -->

{{polish_delivery_step_number}}. Phase {{polish_phase_number}} → {{polish_summary}}

### 團隊並行策略

1. 全員完成 Setup ＋ Foundational
2. 之後依端點分工：

<!-- 重複開始：每位開發者一行 -->

- 開發者 {{developer_label}}：{{developer_scope}}

<!-- 重複結束 -->

3. 共用檔案（{{shared_files}}）依故事順序合併

---

## 備註

- [P] 任務 = 不同檔案、無相依
- [Story] 標籤讓任務可追溯到使用者故事
- 每個使用者故事都應可獨立完成，並以完成判準確認
- 每完成一個任務或一組邏輯任務即提交
- 可在任一 Checkpoint 停下，對照完成判準確認該故事
- 避免：模糊任務、同檔案衝突、破壞獨立性的跨故事相依

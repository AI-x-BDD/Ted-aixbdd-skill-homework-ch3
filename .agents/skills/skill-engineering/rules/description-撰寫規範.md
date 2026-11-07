# description 撰寫規範

## Rule 1 -- description 必須寫出觸發情境

**強度：MUST**

description 必須以使用者的需求或情境寫出何時使用此 skill（如「……時使用此 skill」），不得只描述 skill 的功能或內部流程。

### Good Example

這個範例以使用者會遇到的情境開頭，agent 能從使用者需求直接對應到此 skill。

```yaml
description: 撰寫、新增或修改任何 skill 的 `rules/` 底下時，必須使用此 skill；即使同時在使用其他 skill 也適用。
```

### Bad Example

這個範例只描述 skill 的內容，沒有寫出何時使用，agent 無法從使用者需求對應到此 skill，該觸發時不會觸發。

```yaml
description: 包含 RuleFile 格式規範與執行強度規範的 RuleFile 撰寫工具。
```

## Rule 2 -- description 必須寫出與相近 skill 的分界

**強度：MUST**

有觸發情境相近的既有 skill 時，description 必須寫出本 skill 不涵蓋的情境與負責該情境的 skill。

### Good Example

這個範例寫出 `## SOP` 區塊不在範圍內，並指出由 skill-form-sop 負責。

```yaml
description: 撰寫或修改 SKILL.md frontmatter 的 name 與 description 時使用此 skill；`## SOP` 區塊的撰寫交由 skill-form-sop。
```

### Bad Example

這個範例只寫「撰寫 SKILL.md 時」，與 skill-form-sop 的觸發情境重疊卻沒寫分界，兩個 skill 會同時被觸發並各自修改 SKILL.md。

```yaml
description: 撰寫或修改 SKILL.md 時使用此 skill。
```

## Rule 3 -- name 必須與資料夾名稱一致

**強度：MUST**

name 必須使用小寫英文與連字號，且與 skill 資料夾名稱完全相同。以下 Example 皆對照此資料夾：

```text
.claude/skills/skill-form-rule/SKILL.md
```

### Good Example

這個範例的 name 與資料夾名稱完全相同，且只使用小寫英文與連字號。

```yaml
name: skill-form-rule
```

### Bad Example

這個範例的 name 使用大寫駝峰，與資料夾名稱不一致，使用者以名稱呼叫或其他 skill 以名稱委派時對不上。

```yaml
name: SkillFormRule
```

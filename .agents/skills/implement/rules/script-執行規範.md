# 腳本執行規範

## Rule 1 -- 必須以 uv run 執行腳本

**強度：MUST**

執行 skill 的 `scripts/` 底下的 Python 腳本時，一律使用 `uv run <腳本路徑>`，不得使用 `python`、`python3` 或 `py` 直接執行。腳本路徑以該 skill 的目錄為基準解析。

### Good Example

這個範例以 `uv run` 執行，uv 會依腳本的 PEP 723 宣告自動安裝依賴。

```bash
uv run .claude/skills/skill-pdf-form/scripts/extract_fields.py form.pdf
```

### Bad Example

這個範例以 `python` 直接執行，腳本宣告的 `pypdf` 不會被安裝，執行時出現 `ModuleNotFoundError`。

```bash
python .claude/skills/skill-pdf-form/scripts/extract_fields.py form.pdf
```

## Rule 2 -- 未安裝 uv 時必須先詢問使用者

**強度：MUST**

找不到 `uv` 指令時，必須先詢問使用者是否以 `python -m pip install uv` 安裝。使用者同意後才安裝，並改以 `python -m uv run <腳本路徑>` 執行；使用者拒絕時停止執行該 Step，並說明腳本需要 uv 才能執行。

### Good Example

這個範例在找不到 uv 時先詢問，取得同意後才安裝並執行。

```text
找不到 uv 指令。這個步驟的腳本需要 uv 才能安裝依賴並執行。
是否同意以 `python -m pip install uv` 安裝 uv？

（使用者同意）

python -m pip install uv
python -m uv run .claude/skills/skill-pdf-form/scripts/extract_fields.py form.pdf
```

### Bad Example

這個範例未經詢問就直接安裝 uv，在使用者不知情的情況下改動了使用者的 Python 環境。

```text
找不到 uv 指令，自動安裝中。

python -m pip install uv
python -m uv run .claude/skills/skill-pdf-form/scripts/extract_fields.py form.pdf
```

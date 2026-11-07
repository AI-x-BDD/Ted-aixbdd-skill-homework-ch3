# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""檢查 spec.md 的 FR、NFR、SC 與使用者故事編號是否連續、交叉引用是否存在，以及是否殘留樣板佔位符。"""

import argparse
import sys
import json
import re
from pathlib import Path

ID_PREFIXES = ("FR", "NFR", "SC")
DEFINITION_PATTERN = re.compile(r"^- \*\*(FR|NFR|SC)-(\d{3})\*\*")
REFERENCE_PATTERN = re.compile(r"(?<![A-Z])(FR|NFR|SC)-(\d{3})")
STORY_PATTERN = re.compile(r"^### 使用者故事 (\d+) - ")
LEFTOVER_PATTERN = re.compile(r"\{\{[^}]*\}\}|<!-- 重複(開始|結束)")


def check_sequence(label: str, numbers: list[tuple[int, int]]) -> list[dict]:
    problems = []
    for expected, (line_no, number) in enumerate(numbers, start=1):
        if number != expected:
            problems.append({
                "type": "numbering",
                "line": line_no,
                "message": f"{label} 編號應為 {expected}，實際為 {number}；編號必須從 1 開始依出現順序連續遞增、不得重複。",
            })
            break
    return problems


def check_spec(lines: list[str]) -> list[dict]:
    problems = []
    definitions = {prefix: [] for prefix in ID_PREFIXES}
    stories = []
    for line_no, line in enumerate(lines, start=1):
        definition = DEFINITION_PATTERN.match(line)
        if definition:
            definitions[definition.group(1)].append((line_no, int(definition.group(2))))
        story = STORY_PATTERN.match(line)
        if story:
            stories.append((line_no, int(story.group(1))))
        leftover = LEFTOVER_PATTERN.search(line)
        if leftover:
            problems.append({
                "type": "leftover",
                "line": line_no,
                "message": f"殘留樣板內容 {leftover.group(0)}，請填入實際內容或刪除該行。",
            })
    for prefix in ID_PREFIXES:
        problems += check_sequence(prefix, definitions[prefix])
    problems += check_sequence("使用者故事", stories)
    defined = {f"{prefix}-{number:03d}" for prefix in ID_PREFIXES for _, number in definitions[prefix]}
    for line_no, line in enumerate(lines, start=1):
        definition = DEFINITION_PATTERN.match(line)
        body = line[definition.end():] if definition else line
        for prefix, number in REFERENCE_PATTERN.findall(body):
            ref = f"{prefix}-{number}"
            if ref not in defined:
                problems.append({
                    "type": "reference",
                    "line": line_no,
                    "message": f"引用的 {ref} 不存在，請改為已定義的編號或補上該條需求。",
                })
    return problems


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="檢查 spec.md 的編號連續性、交叉引用與殘留佔位符。")
    parser.add_argument("spec_path", help="要檢查的 spec.md 路徑，例如 specs/<功能代號>/spec.md")
    return parser.parse_args()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    spec_path = Path(args.spec_path)
    if not spec_path.is_file():
        print(
            f"錯誤：找不到檔案 {spec_path}。請傳入 spec.md 的路徑，"
            "例如 specs/<功能代號>/spec.md",
            file=sys.stderr,
        )
        return 1
    problems = check_spec(spec_path.read_text(encoding="utf-8").splitlines())
    print(f"發現 {len(problems)} 個問題", file=sys.stderr)
    print(json.dumps({"ok": not problems, "problems": problems}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

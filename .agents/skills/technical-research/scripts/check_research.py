# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""檢查 research.md 的 R 編號連續性、對應需求欄位與引用編號是否存在於 spec.md、殘留樣板內容，並列出 spec.md 中未被任何決策引用的需求。"""

import argparse
import sys
import json
import re
from pathlib import Path

ID_PREFIXES = ("FR", "NFR", "SC")
SPEC_DEFINITION_PATTERN = re.compile(r"^- \*\*(FR|NFR|SC)-(\d{3})\*\*")
SPEC_STORY_PATTERN = re.compile(r"^### 使用者故事 (\d+) - ")
DECISION_PATTERN = re.compile(r"^## R-(\d{2}) ")
REQUIREMENT_LINE_PATTERN = re.compile(r"^- \*\*對應需求\*\*：(.*)$")
REFERENCE_PATTERN = re.compile(r"(?<![A-Z])(FR|NFR|SC)-(\d{3})")
STORY_REFERENCE_PATTERN = re.compile(r"(?<![A-Z])US(\d+)")
LEFTOVER_PATTERN = re.compile(r"\{\{[^}]*\}\}|<!-- 重複(開始|結束)")


def read_spec(lines: list[str]) -> tuple[list[str], set[int]]:
    requirements = []
    stories = set()
    for line in lines:
        definition = SPEC_DEFINITION_PATTERN.match(line)
        if definition:
            requirements.append(f"{definition.group(1)}-{definition.group(2)}")
        story = SPEC_STORY_PATTERN.match(line)
        if story:
            stories.add(int(story.group(1)))
    return requirements, stories


def check_research(lines: list[str], requirements: list[str], stories: set[int]) -> tuple[list[dict], set[str]]:
    problems = []
    referenced = set()
    decisions = []
    for line_no, line in enumerate(lines, start=1):
        leftover = LEFTOVER_PATTERN.search(line)
        if leftover:
            problems.append({
                "type": "leftover",
                "line": line_no,
                "message": f"殘留樣板內容 {leftover.group(0)}，請填入實際內容或刪除該行。",
            })
        decision = DECISION_PATTERN.match(line)
        if decision:
            decisions.append({"line": line_no, "number": int(decision.group(1)), "has_requirement": False})
            continue
        requirement_line = REQUIREMENT_LINE_PATTERN.match(line)
        if not requirement_line:
            continue
        if not decisions:
            problems.append({
                "type": "requirement",
                "line": line_no,
                "message": "「對應需求」出現在任何 R-xx 決策之前，請移到所屬決策的標題下方。",
            })
            continue
        decisions[-1]["has_requirement"] = True
        refs = requirement_line.group(1)
        for prefix, number in REFERENCE_PATTERN.findall(refs):
            ref = f"{prefix}-{number}"
            referenced.add(ref)
            if ref not in requirements:
                problems.append({
                    "type": "reference",
                    "line": line_no,
                    "message": f"引用的 {ref} 不存在於 spec.md，請改為 spec.md 已定義的編號。",
                })
        for number in STORY_REFERENCE_PATTERN.findall(refs):
            if int(number) not in stories:
                problems.append({
                    "type": "reference",
                    "line": line_no,
                    "message": f"引用的 US{number} 不存在於 spec.md，請改為 spec.md 已定義的使用者故事編號。",
                })
    for expected, decision in enumerate(decisions, start=1):
        if decision["number"] != expected:
            problems.append({
                "type": "numbering",
                "line": decision["line"],
                "message": f"R 編號應為 R-{expected:02d}，實際為 R-{decision['number']:02d}；編號必須從 R-01 開始依出現順序連續遞增、不得重複。",
            })
            break
    for decision in decisions:
        if not decision["has_requirement"]:
            problems.append({
                "type": "requirement",
                "line": decision["line"],
                "message": f"R-{decision['number']:02d} 缺少「- **對應需求**：」欄位，請補上對應的 FR、NFR、SC、US 或邊界情況，無直接對應時寫「跨領域」。",
            })
    return problems, referenced


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="檢查 research.md 的 R 編號、對應需求引用與殘留佔位符，並列出未被引用的需求。")
    parser.add_argument("research_path", help="要檢查的 research.md 路徑，例如 specs/<功能代號>/research.md")
    parser.add_argument("--spec", help="對照的 spec.md 路徑；省略時使用 research.md 同資料夾的 spec.md")
    return parser.parse_args()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    research_path = Path(args.research_path)
    spec_path = Path(args.spec) if args.spec else research_path.parent / "spec.md"
    for label, path in (("research.md", research_path), ("spec.md", spec_path)):
        if not path.is_file():
            print(
                f"錯誤：找不到 {label} 檔案 {path}。請傳入 research.md 的路徑，"
                "例如 specs/<功能代號>/research.md；spec.md 不在同資料夾時以 --spec 指定。",
                file=sys.stderr,
            )
            return 1
    requirements, stories = read_spec(spec_path.read_text(encoding="utf-8").splitlines())
    problems, referenced = check_research(research_path.read_text(encoding="utf-8").splitlines(), requirements, stories)
    unreferenced = [ref for ref in requirements if ref not in referenced]
    print(f"發現 {len(problems)} 個問題、{len(unreferenced)} 條未被引用的需求", file=sys.stderr)
    print(json.dumps({"ok": not problems, "problems": problems, "unreferenced": unreferenced}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

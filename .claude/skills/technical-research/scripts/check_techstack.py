# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""檢查 techstack.md 的 R 編號是否存在於 research.md、技術類型是否合法、套件與版本是否與 research.md 一致，以及殘留樣板內容。"""

import argparse
import sys
import json
import re
from pathlib import Path

DECISION_PATTERN = re.compile(r"^## R-(\d{2}) ")
PACKAGE_PATTERN = re.compile(r"`(@?[^`@\s]+)@([^`\s]+)`")
PACKAGE_NAME_PATTERN = re.compile(r"`([^`]+)`")
DECISION_REF_PATTERN = re.compile(r"(?<![A-Z-])R-(\d{2})")
LEFTOVER_PATTERN = re.compile(r"\{\{[^}]*\}\}|<!-- 重複(開始|結束)")
DIVIDER_PATTERN = re.compile(r"^\|[\s|:-]+\|$")
TECH_TYPES = ("套件", "內建", "自行實作")


def read_research(lines: list[str]) -> tuple[set[int], dict[str, str]]:
    decisions = set()
    packages = {}
    for line in lines:
        decision = DECISION_PATTERN.match(line)
        if decision:
            decisions.add(int(decision.group(1)))
        for name, version in PACKAGE_PATTERN.findall(line):
            packages[name] = version
    return decisions, packages


def split_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def read_tables(lines: list[str]) -> list[dict]:
    tables = []
    index = 0
    while index < len(lines) - 1:
        line = lines[index].strip()
        if line.startswith("|") and DIVIDER_PATTERN.match(lines[index + 1].strip()):
            table = {"header": split_row(line), "rows": []}
            index += 2
            while index < len(lines) and lines[index].strip().startswith("|"):
                table["rows"].append((index + 1, split_row(lines[index])))
                index += 1
            tables.append(table)
            continue
        index += 1
    return tables


def check_row_refs(line_no: int, cells: dict, decisions: set[int]) -> list[dict]:
    problems = []
    refs = DECISION_REF_PATTERN.findall(cells["研究紀錄"])
    if not refs:
        problems.append({
            "type": "reference",
            "line": line_no,
            "message": f"「{cells.get('技術', '')}」缺少研究紀錄的 R 編號，請填入選用此技術的決策，例如 R-03。",
        })
    for number in refs:
        if int(number) not in decisions:
            problems.append({
                "type": "reference",
                "line": line_no,
                "message": f"引用的 R-{number} 不存在於 research.md，請改為 research.md 已有的決策編號。",
            })
    return problems


def check_package_row(line_no: int, cells: dict, packages: dict[str, str]) -> tuple[list[dict], str | None]:
    name_match = PACKAGE_NAME_PATTERN.search(cells["技術"])
    if not name_match:
        return [{
            "type": "package",
            "line": line_no,
            "message": "類型為「套件」的列，技術欄必須以反引號寫出套件名稱，例如 `mysql2`。",
        }], None
    name = name_match.group(1)
    if name not in packages:
        return [{
            "type": "package",
            "line": line_no,
            "message": f"套件 `{name}` 未在 research.md 中以 `{name}@版本範圍` 決策，請先在 research.md 補上決策或從 techstack.md 移除。",
        }], name
    if cells["版本"] != packages[name]:
        return [{
            "type": "version",
            "line": line_no,
            "message": f"套件 `{name}` 的版本為 {cells['版本']}，與 research.md 的 {packages[name]} 不一致，請照抄 research.md 的版本範圍。",
        }], name
    return [], name


def check_install_list(line_no: int, cells: dict, packages: dict[str, str]) -> tuple[list[dict], set[str]]:
    problems = []
    listed = set()
    for name, version in PACKAGE_PATTERN.findall(cells["套件與版本"]):
        listed.add(name)
        if name not in packages:
            problems.append({
                "type": "package",
                "line": line_no,
                "message": f"套件安裝清單的 `{name}` 未在 research.md 中決策，請先在 research.md 補上決策或從清單移除。",
            })
        elif version != packages[name]:
            problems.append({
                "type": "version",
                "line": line_no,
                "message": f"套件安裝清單的 `{name}@{version}` 與 research.md 的 {packages[name]} 不一致，請照抄 research.md 的版本範圍。",
            })
    return problems, listed


def check_techstack(lines: list[str], decisions: set[int], packages: dict[str, str]) -> list[dict]:
    problems = []
    for line_no, line in enumerate(lines, start=1):
        leftover = LEFTOVER_PATTERN.search(line)
        if leftover:
            problems.append({
                "type": "leftover",
                "line": line_no,
                "message": f"殘留樣板內容 {leftover.group(0)}，請填入實際內容或刪除該行。",
            })
    layer_packages = set()
    install_packages = set()
    for table in read_tables(lines):
        header = table["header"]
        for line_no, row in table["rows"]:
            cells = dict(zip(header, row))
            if "研究紀錄" in cells:
                problems.extend(check_row_refs(line_no, cells, decisions))
            if "類型" in cells:
                if cells["類型"] not in TECH_TYPES:
                    problems.append({
                        "type": "tech_type",
                        "line": line_no,
                        "message": f"類型「{cells['類型']}」不合法，只能填「套件」「內建」「自行實作」其中之一。",
                    })
                elif cells["類型"] == "套件":
                    row_problems, name = check_package_row(line_no, cells, packages)
                    problems.extend(row_problems)
                    if name:
                        layer_packages.add(name)
            if "套件與版本" in cells:
                row_problems, listed = check_install_list(line_no, cells, packages)
                problems.extend(row_problems)
                install_packages |= listed
    for name in packages:
        if name not in layer_packages:
            problems.append({
                "type": "missing",
                "line": None,
                "message": f"research.md 決策的套件 `{name}` 沒有出現在任何技術層級表格，請補上一列類型為「套件」的技術。",
            })
        if name not in install_packages:
            problems.append({
                "type": "missing",
                "line": None,
                "message": f"research.md 決策的套件 `{name}` 沒有出現在套件安裝清單，請補到所屬 workspace 與相依類型的列。",
            })
    return problems


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="檢查 techstack.md 的 R 編號、技術類型、套件版本與 research.md 是否一致，以及殘留佔位符。")
    parser.add_argument("techstack_path", help="要檢查的 techstack.md 路徑，例如 specs/<功能代號>/techstack.md")
    parser.add_argument("--research", help="對照的 research.md 路徑；省略時使用 techstack.md 同資料夾的 research.md")
    return parser.parse_args()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    techstack_path = Path(args.techstack_path)
    research_path = Path(args.research) if args.research else techstack_path.parent / "research.md"
    for label, path in (("techstack.md", techstack_path), ("research.md", research_path)):
        if not path.is_file():
            print(
                f"錯誤：找不到 {label} 檔案 {path}。請傳入 techstack.md 的路徑，"
                "例如 specs/<功能代號>/techstack.md；research.md 不在同資料夾時以 --research 指定。",
                file=sys.stderr,
            )
            return 1
    decisions, packages = read_research(research_path.read_text(encoding="utf-8").splitlines())
    problems = check_techstack(techstack_path.read_text(encoding="utf-8").splitlines(), decisions, packages)
    print(f"發現 {len(problems)} 個問題", file=sys.stderr)
    print(json.dumps({"ok": not problems, "problems": problems}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

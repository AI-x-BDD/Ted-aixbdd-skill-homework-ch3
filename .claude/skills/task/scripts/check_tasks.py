# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""檢查 tasks.md 的任務編號連續、編號引用存在且相依指向先前任務、Polish 以外的任務皆有必讀、每條必讀附需讀原因、錨點檔案與識別碼存在，以及殘留樣板內容。"""

import argparse
import sys
import json
import re
from pathlib import Path

PHASE_PATTERN = re.compile(r"^## Phase (\d+)：(.+)$")
TASK_PATTERN = re.compile(r"^- \[[ xX]\] (T\d{3})\b(.*)$")
REQUIRED_PREFIX = "  - 📎 必讀"
REQUIRED_PATTERN = re.compile(r"^  - 📎 必讀：`([^`]+)` — (\S.*)$")
TASK_REF_PATTERN = re.compile(r"(T\d{3})(?:～(T\d{3}))?")
DEPENDENCY_PATTERN = re.compile(r"依賴 ([^）]+)）")
LEFTOVER_PATTERN = re.compile(r"\{\{[^}]*\}\}|<!-- 重複(開始|結束)")
TOKEN_SPLIT_PATTERN = re.compile(r"[\s／～]+")
SECTION_END = "## 相依與執行順序"


def problem(kind: str, line: int | None, message: str) -> dict:
    return {"type": kind, "line": line, "message": message}


def expand_refs(text: str) -> list[str]:
    refs = []
    for start, end in TASK_REF_PATTERN.findall(text):
        if not end:
            refs.append(start)
            continue
        first, last = int(start[1:]), int(end[1:])
        refs.extend(f"T{number:03d}" for number in range(first, max(first, last) + 1))
    return refs


def read_tasks(lines: list[str]) -> tuple[list[dict], list[dict]]:
    tasks = []
    problems = []
    phase_name = ""
    current = None
    for line_no, line in enumerate(lines, start=1):
        if line.startswith(SECTION_END):
            break
        phase = PHASE_PATTERN.match(line)
        if phase:
            phase_name = phase.group(2)
            current = None
            continue
        task = TASK_PATTERN.match(line)
        if task:
            current = {"id": task.group(1), "line": line_no, "body": task.group(2), "phase": phase_name, "anchors": []}
            tasks.append(current)
            continue
        if line.startswith(REQUIRED_PREFIX):
            matched = REQUIRED_PATTERN.match(line)
            if not matched:
                problems.append(problem("format", line_no, "必讀格式不符，請寫成「  - 📎 必讀：`檔案 › 段落 › 識別碼` — 需讀原因」，原因不得為空。"))
            elif current is None:
                problems.append(problem("format", line_no, "必讀不在任何任務底下，請移到所屬任務的子項目。"))
            else:
                current["anchors"].append((line_no, matched.group(1)))
    return tasks, problems


def check_numbering(tasks: list[dict]) -> list[dict]:
    problems = []
    for expected, task in enumerate(tasks, start=1):
        expected_id = f"T{expected:03d}"
        if task["id"] != expected_id:
            problems.append(problem("numbering", task["line"], f"任務編號應為 {expected_id}，收到 {task['id']}；請依執行順序從 T001 連續編號，並同步更新所有引用。"))
            break
    return problems


def check_references(lines: list[str], tasks: list[dict]) -> list[dict]:
    problems = []
    order = {task["id"]: index for index, task in enumerate(tasks)}
    for line_no, line in enumerate(lines, start=1):
        if TASK_PATTERN.match(line):
            continue
        for ref in expand_refs(line):
            if ref not in order:
                problems.append(problem("reference", line_no, f"引用的 {ref} 不存在，請改為 tasks.md 中實際的任務編號。"))
    for task in tasks:
        for dependency in DEPENDENCY_PATTERN.findall(task["body"]):
            for ref in expand_refs(dependency):
                if ref not in order:
                    problems.append(problem("reference", task["line"], f"{task['id']} 依賴的 {ref} 不存在，請改為實際的任務編號。"))
                elif order[ref] >= order[task["id"]]:
                    problems.append(problem("dependency", task["line"], f"{task['id']} 依賴排在其後的 {ref}，請調整任務順序讓被依賴的任務在前。"))
        for ref in expand_refs(task["body"]):
            if ref not in order:
                problems.append(problem("reference", task["line"], f"{task['id']} 引用的 {ref} 不存在，請改為實際的任務編號。"))
    return problems


def anchor_pieces(segment: str) -> list[str]:
    return [piece.strip() for piece in segment.split("、") if piece.strip()]


def piece_found(piece: str, text: str, is_yaml: bool) -> bool:
    if piece in text:
        return True
    tokens = [token for token in TOKEN_SPLIT_PATTERN.split(piece) if token]
    if is_yaml:
        tokens = [part for token in tokens for part in token.split(".") if part]
    return bool(tokens) and all(token in text for token in tokens)


def check_anchors(tasks: list[dict], feature_dir: Path) -> list[dict]:
    problems = []
    cache: dict[Path, str] = {}
    for task in tasks:
        for line_no, anchor in task["anchors"]:
            segments = [segment.strip() for segment in anchor.split("›")]
            path = feature_dir / segments[0]
            if not path.is_file():
                problems.append(problem("anchor", line_no, f"錨點檔案 {segments[0]} 不存在於 {feature_dir}，請改為功能目錄下實際的檔案路徑。"))
                continue
            if path not in cache:
                cache[path] = path.read_text(encoding="utf-8")
            is_yaml = path.suffix in {".yaml", ".yml"}
            for segment in segments[1:]:
                for piece in anchor_pieces(segment):
                    if not piece_found(piece, cache[path], is_yaml):
                        problems.append(problem("anchor", line_no, f"錨點片段「{piece}」不存在於 {segments[0]}，請改為該檔案中實際的標題、識別碼或欄位名稱。"))
    return problems


def check_coverage(tasks: list[dict]) -> list[dict]:
    return [
        problem("coverage", task["line"], f"{task['id']} 沒有任何必讀，請至少掛上一條指向 Spec Package 精確位置的必讀錨點。")
        for task in tasks
        if "Polish" not in task["phase"] and not task["anchors"]
    ]


def check_leftovers(lines: list[str]) -> list[dict]:
    return [
        problem("leftover", line_no, "殘留樣板填位符號或重複區塊註解，請替換為實際內容或刪除。")
        for line_no, line in enumerate(lines, start=1)
        if LEFTOVER_PATTERN.search(line)
    ]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="檢查 tasks.md 的任務編號、引用、必讀覆蓋、需讀原因、錨點存在與殘留樣板內容。")
    parser.add_argument("tasks_path", help="要檢查的 tasks.md 路徑，錨點以其所在目錄為功能目錄解析")
    return parser.parse_args()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    tasks_path = Path(args.tasks_path)
    if not tasks_path.is_file():
        print(f"錯誤：找不到 {tasks_path}，請傳入 specs/<功能代號>/tasks.md 的路徑。", file=sys.stderr)
        return 1
    lines = tasks_path.read_text(encoding="utf-8").splitlines()
    tasks, problems = read_tasks(lines)
    if not tasks:
        print("錯誤：找不到任何「- [ ] T001 …」格式的任務，請確認檔案為依樣板撰寫的 tasks.md。", file=sys.stderr)
        return 1
    problems += check_numbering(tasks)
    problems += check_references(lines, tasks)
    problems += check_coverage(tasks)
    problems += check_anchors(tasks, tasks_path.parent)
    problems += check_leftovers(lines)
    print(json.dumps({"task_count": len(tasks), "problems": problems}, ensure_ascii=False, indent=2))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

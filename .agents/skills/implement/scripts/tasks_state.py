# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""解析 tasks.md，輸出每個任務的完成狀態、所屬 Phase、相依、描述中提及的檔案與必讀錨點檔案是否存在，並列出相依與 Phase 閘門皆已滿足的可執行任務。"""

import argparse
import sys
import json
import re
from pathlib import Path

PHASE_PATTERN = re.compile(r"^## Phase (\d+)：(.+)$")
TASK_PATTERN = re.compile(r"^- \[([ xX])\] (T\d{3})\b(.*)$")
ANCHOR_PATTERN = re.compile(r"^  - 📎 必讀：`([^`]+)`")
STORY_PATTERN = re.compile(r"\[(US\d+)\]")
DEPENDENCY_PATTERN = re.compile(r"（依賴 ([^）]+)）")
TASK_REF_PATTERN = re.compile(r"(T\d{3})(?:～(T\d{3}))?")
CODE_SPAN_PATTERN = re.compile(r"`([^`\s]+)`")
EXTENSIONLESS_FILES = (
    "Makefile", "GNUmakefile", "Dockerfile", "Containerfile", "Gemfile", "Rakefile", "Procfile",
    "Jenkinsfile", "Vagrantfile", "Brewfile", "Justfile", "Pipfile", "LICENSE",
)
FILE_PATTERN = re.compile(
    r"^(?:[\w.-]+/)*(?:\.[\w-][\w.-]*|[\w-][\w.-]*\.(?:[a-z][a-z0-9]*|[A-Z])|" + "|".join(EXTENSIONLESS_FILES) + r")$"
)
SECTION_END = "## 相依與執行順序"


def expand_refs(text: str) -> list[str]:
    refs = []
    for start, end in TASK_REF_PATTERN.findall(text):
        if not end:
            refs.append(start)
            continue
        first, last = int(start[1:]), int(end[1:])
        refs.extend(f"T{number:03d}" for number in range(first, max(first, last) + 1))
    return refs


def read_tasks(lines: list[str], feature_dir: Path) -> list[dict]:
    tasks = []
    phase = None
    current = None
    for line_no, line in enumerate(lines, start=1):
        if line.startswith(SECTION_END):
            break
        matched_phase = PHASE_PATTERN.match(line)
        if matched_phase:
            phase = {"number": int(matched_phase.group(1)), "name": matched_phase.group(2)}
            current = None
            continue
        matched_task = TASK_PATTERN.match(line)
        if matched_task:
            body = matched_task.group(3)
            dependency = DEPENDENCY_PATTERN.search(body)
            story = STORY_PATTERN.search(body)
            current = {
                "id": matched_task.group(2),
                "line": line_no,
                "done": matched_task.group(1) != " ",
                "phase": phase["number"] if phase else None,
                "phase_name": phase["name"] if phase else None,
                "story": story.group(1) if story else None,
                "parallel": "[P]" in body,
                "depends_on": expand_refs(dependency.group(1)) if dependency else [],
                "mentioned_files": [span for span in CODE_SPAN_PATTERN.findall(body) if FILE_PATTERN.match(span)],
                "anchors": [],
            }
            tasks.append(current)
            continue
        matched_anchor = ANCHOR_PATTERN.match(line)
        if matched_anchor and current is not None:
            anchor = matched_anchor.group(1)
            anchor_file = anchor.split(" › ")[0].strip()
            current["anchors"].append({
                "anchor": anchor,
                "file": anchor_file,
                "exists": (feature_dir / anchor_file).is_file(),
            })
    return tasks


def mark_ready(tasks: list[dict]) -> None:
    done = {task["id"] for task in tasks if task["done"]}
    for task in tasks:
        if task["done"]:
            continue
        task["unmet_dependencies"] = [ref for ref in task["depends_on"] if ref not in done]
        task["unfinished_earlier_phase_tasks"] = [
            other["id"] for other in tasks
            if not other["done"] and other["phase"] is not None and task["phase"] is not None and other["phase"] < task["phase"]
        ]
        task["ready"] = not task["unmet_dependencies"] and not task["unfinished_earlier_phase_tasks"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="解析 tasks.md，輸出任務狀態、相依、錨點檔案存在與否，以及可執行任務。")
    parser.add_argument("tasks_file", help="tasks.md 路徑，例如 specs/<功能代號>/tasks.md")
    return parser.parse_args()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    tasks_file = Path(args.tasks_file)
    if not tasks_file.is_file():
        print(f"錯誤：找不到 {tasks_file}。請確認功能目錄，或先執行 /task 產出 tasks.md。", file=sys.stderr)
        return 1
    tasks = read_tasks(tasks_file.read_text(encoding="utf-8").splitlines(), tasks_file.parent)
    if not tasks:
        print(f"錯誤：{tasks_file} 中沒有任何「- [ ] T001 …」格式的任務。請先執行 /task 重新產出 tasks.md。", file=sys.stderr)
        return 1
    mark_ready(tasks)
    known = {task["id"] for task in tasks}
    result = {
        "tasks": tasks,
        "missing_anchor_files": sorted({
            anchor["file"] for task in tasks for anchor in task["anchors"] if not anchor["exists"]
        }),
        "unknown_dependencies": sorted({
            ref for task in tasks for ref in task["depends_on"] if ref not in known
        }),
        "ready": [task["id"] for task in tasks if task.get("ready")],
        "remaining": [task["id"] for task in tasks if not task["done"]],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

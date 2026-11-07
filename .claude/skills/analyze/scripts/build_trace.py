# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""解析 spec.md 的需求與使用者故事、plan.md 介面盤點、各介面文檔的段落索引與 tasks.md 的任務錨點，輸出需求、介面、介面文檔、任務之間的追溯 JSON。"""

import argparse
import sys
import json
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from collect_artifacts import collect_endpoints, read_inventory  # noqa: E402

REQUIREMENT_PATTERN = re.compile(r"^\s*- \*\*((FR|NFR|SC)-\d+)\*\*(?:（([^）]*)）)?：(.*)$")
STORY_PATTERN = re.compile(r"^### 使用者故事 (\d+) - (.+?)（優先順序：(P\d+)）")
SUBHEADING_PATTERN = re.compile(r"^#{3,4} (.+)$")
ID_RANGE_PATTERN = re.compile(r"\b([A-Z]+)-(\d+)(?:～(?:[A-Z]+-)?(\d+))?")
REQUIREMENT_REF_PATTERN = re.compile(r"\b(?:FR|NFR|SC)-\d+")
PHASE_PATTERN = re.compile(r"^## Phase (\d+)：(.+)$")
SECTION_PATTERN = re.compile(r"^### (.+)$")
TASK_PATTERN = re.compile(r"^- \[([ xX])\] (T\d{3})\b(.*)$")
STORY_TAG_PATTERN = re.compile(r"\[(US\d+)\]")
ANCHOR_PATTERN = re.compile(r"^  - 📎 必讀：`([^`]+)` — (.*)$")
TASKS_END = "## 相依與執行順序"
MD_HEADING_PATTERN = re.compile(r"^(#{1,6}) (.+)$")
OPERATION_PATTERN = re.compile(r"^\s+operationId:\s*(\S+)")
SCHEMA_PATTERN = re.compile(r"^    ([A-Za-z0-9_]+):\s*$")
DBML_PATTERN = re.compile(r"^(Table|Ref|Enum|TableGroup|Project)\b\s*([^\s{:]*)")
TESTID_PATTERN = re.compile(r'data-testid="([^"]+)"')
DEFINITION_PATTERN = re.compile(r"^(?:extend\s+)?([a-z]+)\s+([A-Za-z_][\w.]*)\b[^{;]*\{\s*$")
REQUIREMENT_KINDS = ("FR", "NFR", "SC")
KNOWN_DOC_SUFFIXES = {".md", ".yaml", ".yml", ".dbml", ".html"}
ASSET_SUFFIXES = {
    ".css", ".js", ".mjs", ".map", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
    ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".mp4", ".webm", ".pdf",
}


def expand_ids(text: str, prefixes: tuple[str, ...] | None = None) -> list[str]:
    ids = []
    for prefix, start, end in ID_RANGE_PATTERN.findall(text):
        if prefixes and prefix not in prefixes:
            continue
        width = len(start)
        last = int(end) if end else int(start)
        for number in range(int(start), max(int(start), last) + 1):
            item = f"{prefix}-{number:0{width}d}"
            if item not in ids:
                ids.append(item)
    return ids


def read_spec(spec_path: Path) -> tuple[list[dict], list[dict]]:
    requirements = []
    stories = []
    category = ""
    for line_no, line in enumerate(spec_path.read_text(encoding="utf-8").splitlines(), start=1):
        story = STORY_PATTERN.match(line)
        if story:
            stories.append({"id": f"US{story.group(1)}", "title": story.group(2), "priority": story.group(3), "line": line_no})
            continue
        heading = SUBHEADING_PATTERN.match(line)
        if heading:
            category = heading.group(1).strip()
            continue
        matched = REQUIREMENT_PATTERN.match(line)
        if matched:
            requirements.append({
                "id": matched.group(1),
                "kind": matched.group(2),
                "category": matched.group(3) or category,
                "line": line_no,
                "text": matched.group(4).strip(),
            })
    return requirements, stories


def index_file(path: Path, display: str) -> list[dict]:
    sections = []
    lines = path.read_text(encoding="utf-8").splitlines()
    in_schemas = False
    for line_no, line in enumerate(lines, start=1):
        if path.suffix == ".md":
            matched = MD_HEADING_PATTERN.match(line)
            if matched:
                sections.append({"doc": display, "kind": f"h{len(matched.group(1))}", "name": matched.group(2).strip(), "line": line_no})
        elif path.suffix in {".yaml", ".yml"}:
            operation = OPERATION_PATTERN.match(line)
            if operation:
                sections.append({"doc": display, "kind": "operation", "name": operation.group(1), "line": line_no})
            if line.startswith("  schemas:"):
                in_schemas = True
                continue
            if in_schemas and line.strip() and not line.startswith("    "):
                in_schemas = False
            schema = SCHEMA_PATTERN.match(line) if in_schemas else None
            if schema:
                sections.append({"doc": display, "kind": "schema", "name": f"components.schemas.{schema.group(1)}", "line": line_no})
        elif path.suffix == ".dbml":
            matched = DBML_PATTERN.match(line)
            if matched:
                name = f"{matched.group(1)} {matched.group(2)}".strip()
                sections.append({"doc": display, "kind": matched.group(1).lower(), "name": name, "line": line_no})
        elif path.suffix == ".html":
            for testid in TESTID_PATTERN.findall(line):
                sections.append({"doc": display, "kind": "testid", "name": testid, "line": line_no})
        else:
            matched = DEFINITION_PATTERN.match(line)
            if matched:
                sections.append({"doc": display, "kind": "definition", "name": f"{matched.group(1)} {matched.group(2)}", "line": line_no})
    return sections


def index_docs(feature_dir: Path, endpoints: list[dict]) -> tuple[list[dict], list[str]]:
    sections = []
    unindexed = []
    for endpoint in endpoints:
        for doc in endpoint["docs"]:
            path = feature_dir / doc["path"]
            if path.is_dir():
                children = sorted(child for child in path.rglob("*") if child.is_file() and child.suffix.lower() not in ASSET_SUFFIXES)
            else:
                children = [path] if path.is_file() else []
            for child in children:
                display = child.relative_to(feature_dir).as_posix()
                try:
                    found = index_file(child, display)
                except UnicodeDecodeError:
                    continue
                if not found and child.suffix not in KNOWN_DOC_SUFFIXES:
                    unindexed.append(display)
                sections += found
    return sections, unindexed


def read_tasks(tasks_path: Path, interface_prefixes: tuple[str, ...]) -> list[dict]:
    tasks = []
    phase = ""
    section = ""
    section_interfaces: list[str] = []
    current = None
    for line_no, line in enumerate(tasks_path.read_text(encoding="utf-8").splitlines(), start=1):
        if line.startswith(TASKS_END):
            break
        matched_phase = PHASE_PATTERN.match(line)
        if matched_phase:
            phase, section, section_interfaces, current = matched_phase.group(2), "", [], None
            continue
        matched_section = SECTION_PATTERN.match(line)
        if matched_section:
            section = matched_section.group(1)
            section_interfaces = expand_ids(section, interface_prefixes)
            current = None
            continue
        task = TASK_PATTERN.match(line)
        if task:
            body = task.group(3)
            story = STORY_TAG_PATTERN.search(body)
            current = {
                "id": task.group(2),
                "line": line_no,
                "done": task.group(1) != " ",
                "phase": phase,
                "section": section,
                "story": story.group(1) if story else None,
                "interfaces": list(section_interfaces),
                "requirement_refs": sorted(set(REQUIREMENT_REF_PATTERN.findall(body))),
                "body": body.strip(),
                "anchors": [],
            }
            tasks.append(current)
            continue
        anchor = ANCHOR_PATTERN.match(line)
        if anchor and current is not None:
            segments = [segment.strip() for segment in anchor.group(1).split("›")]
            current["anchors"].append({"line": line_no, "file": segments[0], "segments": segments[1:], "reason": anchor.group(2).strip()})
            current["requirement_refs"] = sorted(set(current["requirement_refs"]) | set(REQUIREMENT_REF_PATTERN.findall(anchor.group(1))))
    return tasks


def anchor_matches(section: dict, anchor: dict) -> bool:
    if not anchor["segments"]:
        return False
    if anchor["file"] != section["doc"] and not section["doc"].endswith("/" + anchor["file"]):
        return False
    for piece in (part.strip() for part in anchor["segments"][0].split("、")):
        if piece == section["name"]:
            return True
        if section["kind"].startswith("h") and section["name"].startswith(piece):
            return True
    return False


def link_sections(sections: list[dict], tasks: list[dict]) -> None:
    for section in sections:
        section["anchored_by"] = sorted({
            task["id"] for task in tasks for anchor in task["anchors"] if anchor_matches(section, anchor)
        })


def trace_requirements(requirements: list[dict], inventory: list[dict], tasks: list[dict]) -> list[dict]:
    traces = []
    for requirement in requirements:
        interfaces = [row["id"] for row in inventory if requirement["id"] in row["requirement_ids"]]
        traces.append({
            "id": requirement["id"],
            "interfaces": interfaces,
            "tasks_direct": [task["id"] for task in tasks if requirement["id"] in task["requirement_refs"]],
            "tasks_via_interface": [task["id"] for task in tasks if set(task["interfaces"]) & set(interfaces)],
        })
    return traces


def trace_interfaces(inventory: list[dict], tasks: list[dict], sections: list[dict]) -> list[dict]:
    traces = []
    for row in inventory:
        traces.append({
            "id": row["id"],
            "tasks": [task["id"] for task in tasks if row["id"] in task["interfaces"]],
            "doc_sections": [
                {"doc": section["doc"], "name": section["name"], "anchored_by": section["anchored_by"]}
                for section in sections
                if section["kind"].startswith("h") and section["name"].startswith(row["id"] + " ")
            ],
        })
    return traces


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="解析需求、介面盤點、介面文檔段落與任務錨點，輸出追溯 JSON。")
    parser.add_argument("feature_dir", help="功能目錄路徑，例如 specs/<功能代號>")
    return parser.parse_args()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    feature_dir = Path(args.feature_dir)
    missing = [name for name in ("spec.md", "plan.md", "tasks.md") if not (feature_dir / name).is_file()]
    if missing:
        print(f"錯誤：{feature_dir} 缺少 {'、'.join(missing)}，請先執行 collect_artifacts.py 確認必要產物齊全後再建立追溯模型。", file=sys.stderr)
        return 1
    requirements, stories = read_spec(feature_dir / "spec.md")
    inventory = read_inventory(feature_dir / "plan.md")
    for row in inventory:
        row["requirement_ids"] = expand_ids(row["requirements"], REQUIREMENT_KINDS)
    prefixes = tuple(sorted({row["prefix"] for row in inventory}))
    endpoints = collect_endpoints(feature_dir, inventory)
    sections, unindexed_docs = index_docs(feature_dir, endpoints)
    tasks = read_tasks(feature_dir / "tasks.md", prefixes)
    link_sections(sections, tasks)
    print(f"需求 {len(requirements)}、介面 {len(inventory)}、文檔段落 {len(sections)}、任務 {len(tasks)}", file=sys.stderr)
    result = {
        "requirements": requirements,
        "stories": stories,
        "interfaces": inventory,
        "doc_sections": sections,
        "tasks": tasks,
        "requirement_trace": trace_requirements(requirements, inventory, tasks),
        "interface_trace": trace_interfaces(inventory, tasks, sections),
        "unanchored_sections": [
            {"doc": section["doc"], "kind": section["kind"], "name": section["name"], "line": section["line"]}
            for section in sections
            if not section["anchored_by"] and (section["kind"] in {"operation", "table", "h2", "definition"})
        ],
        "unindexed_docs": unindexed_docs,
        "tasks_without_requirement": [
            {"id": task["id"], "phase": task["phase"]}
            for task in tasks
            if not task["requirement_refs"] and not task["interfaces"]
        ],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

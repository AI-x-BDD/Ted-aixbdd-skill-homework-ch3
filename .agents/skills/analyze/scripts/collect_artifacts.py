# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///
"""盤點功能目錄的必要產物，並依 plan.md 介面盤點的介面 ID 前綴找出各端點 Planner 宣告的介面文檔與其存在狀態。"""

import argparse
import sys
import json
import re
from pathlib import Path

SKILLS_DIR = Path(__file__).resolve().parents[2]
REQUIRED_ARTIFACTS = [
    ("spec.md", "specify"),
    ("research.md", "technical-research"),
    ("techstack.md", "technical-research"),
    ("plan.md", "system-analysis"),
    ("tasks.md", "task"),
]
PLANNER_BY_PREFIX = {"UI": "ui-ux-plan", "API": "api-plan", "DB": "data-plan", "FS": "storage-plan"}
INVENTORY_HEADING = "### 介面盤點"
INVENTORY_ROW_PATTERN = re.compile(r"^\|\s*([A-Z]+)-(\d+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|")
PLANNER_OUTPUT_PATTERN = re.compile(r"plan\.md 所在目錄[^`]*`([^`]+)`")


def read_inventory(plan_path: Path) -> list[dict]:
    rows = []
    in_section = False
    for line_no, line in enumerate(plan_path.read_text(encoding="utf-8").splitlines(), start=1):
        if line.startswith("### "):
            in_section = line.startswith(INVENTORY_HEADING)
            continue
        if not in_section:
            continue
        matched = INVENTORY_ROW_PATTERN.match(line)
        if matched:
            prefix, number, name, endpoint, requirements = matched.groups()
            rows.append({
                "id": f"{prefix}-{number}",
                "prefix": prefix,
                "name": name.strip(),
                "endpoint": endpoint.strip(),
                "requirements": requirements.strip(),
                "line": line_no,
            })
    return rows


def planner_outputs(planner: str) -> list[str] | None:
    skill_path = SKILLS_DIR / planner / "SKILL.md"
    if not skill_path.is_file():
        return None
    outputs = []
    for line in skill_path.read_text(encoding="utf-8").splitlines():
        if " WRITE " not in line:
            continue
        for output in PLANNER_OUTPUT_PATTERN.findall(line):
            if output not in outputs:
                outputs.append(output)
    return outputs


def output_exists(feature_dir: Path, output: str) -> bool:
    path = feature_dir / output
    if output.endswith("/"):
        return path.is_dir() and any(path.iterdir())
    return path.is_file()


def collect_endpoints(feature_dir: Path, inventory: list[dict]) -> list[dict]:
    endpoints = []
    for row in inventory:
        endpoint = next((item for item in endpoints if item["prefix"] == row["prefix"]), None)
        if endpoint is None:
            planner = PLANNER_BY_PREFIX.get(row["prefix"], f"{row['prefix'].lower()}-plan")
            outputs = planner_outputs(planner)
            endpoint = {
                "prefix": row["prefix"],
                "endpoint": row["endpoint"],
                "planner": planner,
                "planner_found": outputs is not None,
                "interface_ids": [],
                "docs": [{"path": output, "exists": output_exists(feature_dir, output)} for output in outputs or []],
            }
            endpoints.append(endpoint)
        endpoint["interface_ids"].append(row["id"])
    return endpoints


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="盤點功能目錄的必要產物與各端點 Planner 宣告的介面文檔。")
    parser.add_argument("feature_dir", help="功能目錄路徑，例如 specs/<功能代號>")
    return parser.parse_args()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    feature_dir = Path(args.feature_dir)
    if not feature_dir.is_dir():
        print(f"錯誤：找不到功能目錄 {feature_dir}，請傳入 specs/<功能代號> 的路徑。", file=sys.stderr)
        return 1
    required = [
        {"path": name, "exists": (feature_dir / name).is_file(), "upstream_skill": skill}
        for name, skill in REQUIRED_ARTIFACTS
    ]
    plan_path = feature_dir / "plan.md"
    inventory = read_inventory(plan_path) if plan_path.is_file() else []
    if plan_path.is_file() and not inventory:
        print("警告：plan.md 找不到「### 介面盤點」表格，無法推得介面文檔。", file=sys.stderr)
    endpoints = collect_endpoints(feature_dir, inventory)
    missing = [item["path"] for item in required if not item["exists"]]
    for endpoint in endpoints:
        if not endpoint["planner_found"]:
            missing.append(f"Planner {endpoint['planner']}（{endpoint['prefix']} 端點）")
        missing += [doc["path"] for doc in endpoint["docs"] if not doc["exists"]]
    result = {
        "feature_dir": feature_dir.as_posix(),
        "required": required,
        "endpoints": endpoints,
        "missing": missing,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

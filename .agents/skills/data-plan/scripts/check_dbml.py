# /// script
# requires-python = ">=3.10"
# dependencies = [
#   "pydbml>=1.1,<2",
#   "pyparsing>=3,<4",
# ]
# ///
"""以 DBML parser 解析 data-model.dbml，列出語法錯誤與指向本檔未定義資料表或欄位的關聯。"""

import argparse
import sys
import json
from pathlib import Path

from pydbml import PyDBML
from pyparsing import ParseBaseException


def problem(kind: str, line: int | None, message: str) -> dict:
    return {"type": kind, "line": line, "message": message}


def check_dbml(text: str) -> list[dict]:
    try:
        PyDBML(text)
    except ParseBaseException as error:
        return [problem(
            "syntax",
            error.lineno,
            f"第 {error.lineno} 行第 {error.col} 欄無法解析：{error.line.strip()}。請對照樣板修正該行的 DBML 語法。",
        )]
    except Exception as error:
        name = type(error).__name__
        if "NotFound" in name:
            return [problem(
                "reference",
                None,
                f"{name}：{error}。DBML 不支援跨檔引用，Ref 的父表與欄位必須在本檔定義；"
                "父表屬於先前功能時，從該功能的 data-model.dbml 完整寫出該表。",
            )]
        return [problem("semantic", None, f"{name}：{error}。請依訊息修正對應的資料表、欄位或關聯定義。")]
    return []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="以 DBML parser 解析 data-model.dbml，列出語法錯誤與指向本檔未定義資料表或欄位的關聯。")
    parser.add_argument("dbml_path", help="要檢查的 data-model.dbml 路徑，例如 specs/<功能代號>/data-model.dbml")
    return parser.parse_args()


def main() -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    dbml_path = Path(args.dbml_path)
    if not dbml_path.is_file():
        print(
            f"錯誤：找不到 data-model.dbml 檔案 {dbml_path}。請傳入 data-model.dbml 的路徑，"
            "例如 specs/<功能代號>/data-model.dbml。",
            file=sys.stderr,
        )
        return 1
    problems = check_dbml(dbml_path.read_text(encoding="utf-8"))
    print(f"發現 {len(problems)} 個問題", file=sys.stderr)
    print(json.dumps({"ok": not problems, "problems": problems}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

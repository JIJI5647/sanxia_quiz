#!/usr/bin/env python3
"""把一个 JSON 数组形式的新题导入对应题库：自动分配 id、按题干去重。

用法:
    python3 scripts/import_questions.py new.json [more.json ...]

每道新题需带 "bank" 字段（= data/ 下的文件名，不含 .json，如 shizheng / qiye）。
导入后请运行 python3 scripts/build.py 校验并更新 manifest。
"""
import json
import re
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
PREFIX = {"shizheng": "sz", "qiye": "qy"}
KEEP = ("id", "type", "stem", "options", "answer", "analysis", "tags", "difficulty", "images", "source", "source_url")


def key(stem):
    return re.sub(r"[\s（）()　_，。、,.:：;；？?！!“”\"']+", "", stem)


def main(paths):
    banks = {}
    added = {}
    for p in paths:
        for q in json.loads(Path(p).read_text(encoding="utf-8")):
            name = q.pop("bank")
            if name not in banks:
                f = DATA / f"{name}.json"
                banks[name] = json.loads(f.read_text(encoding="utf-8"))
            bank = banks[name]
            qs = bank["questions"]
            if any(key(x["stem"]) == key(q["stem"]) for x in qs):
                print(f"跳过重复：{q['stem'][:30]}")
                continue
            pre = PREFIX.get(name, name[:2])
            nums = [int(m.group(1)) for x in qs if (m := re.match(rf"{pre}-(\d+)$", x["id"]))]
            q["id"] = f"{pre}-{(max(nums) + 1 if nums else 1):04d}"
            qs.append({k: q[k] for k in KEEP if k in q})
            added[name] = added.get(name, 0) + 1
    for name, bank in banks.items():
        (DATA / f"{name}.json").write_text(json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("导入完成：", added or "无新题")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])

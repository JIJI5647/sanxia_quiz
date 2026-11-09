#!/usr/bin/env python3
"""校验 data/ 下所有题库文件，并生成 data/manifest.json。

用法:
    python3 scripts/build.py          # 校验 + 生成 manifest
    python3 scripts/build.py --check  # 只校验，不写文件（CI 用）
"""
import json
import string
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
MANIFEST = DATA / "manifest.json"
TYPES = {"single", "multiple", "judge", "fill"}
LETTERS = string.ascii_uppercase


def check_question(q, where, errors):
    def err(msg):
        errors.append(f"{where}: {msg}")

    for key in ("id", "type", "stem"):
        if not q.get(key):
            err(f"缺少字段 {key}")
            return
    t = q["type"]
    if t not in TYPES:
        err(f"type 必须是 {sorted(TYPES)} 之一，实际为 {t!r}")
        return
    if "answer" not in q:
        err("缺少字段 answer")
        return
    ans = q["answer"]

    if t in ("single", "multiple"):
        opts = q.get("options")
        if not isinstance(opts, list) or len(opts) < 2:
            err("选择题需要至少 2 个 options")
            return
        valid = set(LETTERS[: len(opts)])
        if t == "single":
            if not (isinstance(ans, str) and ans in valid):
                err(f"单选题 answer 应为 {sorted(valid)} 中的一个字母，实际为 {ans!r}")
        else:
            if not (isinstance(ans, list) and len(ans) >= 2 and all(a in valid for a in ans)):
                err(f"多选题 answer 应为至少 2 个字母的数组，实际为 {ans!r}")
            elif len(set(ans)) != len(ans):
                err("多选题 answer 有重复")
    elif t == "judge":
        if not isinstance(ans, bool):
            err(f"判断题 answer 应为 true/false，实际为 {ans!r}")
    elif t == "fill":
        if isinstance(ans, str):
            ok = bool(ans.strip())
        else:
            ok = isinstance(ans, list) and ans and all(isinstance(a, str) and a.strip() for a in ans)
        if not ok:
            err("填空题 answer 应为字符串或字符串数组（多个可接受答案）")

    for key in ("tags", "images"):
        if key in q and not isinstance(q[key], list):
            err(f"{key} 应为数组")
    if "difficulty" in q and q["difficulty"] not in (1, 2, 3):
        err("difficulty 应为 1/2/3")


def main():
    check_only = "--check" in sys.argv
    errors, banks, seen = [], [], {}
    files = sorted(p for p in DATA.glob("*.json") if p.name != MANIFEST.name)
    if not files:
        errors.append("data/ 下没有题库文件")

    for path in files:
        try:
            bank = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{path.name}: JSON 格式错误 —— 第 {e.lineno} 行第 {e.colno} 列: {e.msg}")
            continue
        if not bank.get("name"):
            errors.append(f"{path.name}: 缺少 name")
        qs = bank.get("questions")
        if not isinstance(qs, list):
            errors.append(f"{path.name}: questions 应为数组")
            continue
        for i, q in enumerate(qs):
            where = f"{path.name} 第 {i + 1} 题 ({q.get('id', '无id')})"
            check_question(q, where, errors)
            qid = q.get("id")
            if qid:
                if qid in seen:
                    errors.append(f"{where}: id 与 {seen[qid]} 重复")
                seen[qid] = path.name
        types = {}
        for q in qs:
            types[q.get("type")] = types.get(q.get("type"), 0) + 1
        banks.append({
            "file": path.name,
            "name": bank.get("name", path.stem),
            "description": bank.get("description", ""),
            "count": len(qs),
            "types": types,
        })

    if errors:
        print(f"❌ 发现 {len(errors)} 个问题：")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    total = sum(b["count"] for b in banks)
    print(f"✅ 校验通过：{len(banks)} 个题库，共 {total} 题")
    for b in banks:
        print(f"   {b['name']:<16} {b['count']:>5} 题  ({b['file']})")

    if not check_only:
        MANIFEST.write_text(
            json.dumps({"total": total, "banks": banks}, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"已写入 {MANIFEST.relative_to(ROOT)}")


if __name__ == "__main__":
    main()

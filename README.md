# 🌊 三峡刷题

中国三峡集团招聘笔试备考题库 + 网页刷题工具，聚焦两大模块：

| 题库 | 文件 | 内容 |
| --- | --- | --- |
| 时政 | `data/shizheng.json` | 国内重大会议与政策、外交、能源与“双碳”、科技成就等，按事件年月打标签 |
| 三峡企业文化与概况 | `data/qiye.json` | 使命愿景、价值观、发展历程、三峡工程、清洁能源走廊、长江大保护、集团动态 |

题目来源：往年笔试真题/回忆题（刷题网站）、三峡集团官网、新华网 / 人民网 / 外交部 / 中国政府网等权威时政报道。每道题尽量附 `source_url`，网页上可直接点开核对。

## 在线刷题

部署在 GitHub Pages：`https://<用户名>.github.io/<仓库名>/`

功能：

- 顺序练习（自动记住进度）/ 随机 / 只做未做题 / 背题模式
- 按题型、按标签（如 `2026-10`、`外交`）练习
- 模拟考试：自定义题量与时长，交卷统一判分，错题一键重做
- 错题本（练习中答对自动移出）、收藏、全文搜索
- 深色模式、手机适配、键盘快捷键（A-D / 1-4 选择，Enter 提交/下一题，← → 切换）

做题记录只保存在你自己浏览器的 localStorage 中。

## 本地预览

```bash
python3 -m http.server 8000
```

然后打开 <http://localhost:8000>。（直接双击 `index.html` 会因浏览器安全限制无法加载题库。）

## 题目格式

每个题库是一个 JSON 文件：

```json
{
  "name": "时政",
  "description": "……",
  "questions": [
    {
      "id": "sz-0001",
      "type": "single",
      "stem": "题干（　　）。",
      "options": ["选项一", "选项二", "选项三", "选项四"],
      "answer": "B",
      "analysis": "解析",
      "tags": ["2026-10", "外交"],
      "difficulty": 1,
      "source": "时政·新华网",
      "source_url": "https://..."
    }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `type` | `single` 单选 · `multiple` 多选 · `judge` 判断 · `fill` 填空 |
| `answer` | 单选 `"B"`；多选 `["A","C"]`；判断 `true` / `false`；填空 `"答案"` 或 `["可接受答案1","答案2"]` |
| `options` | 选择题必填，不要带 `A.` 前缀 |
| `tags` / `difficulty` / `images` / `source` / `source_url` | 可选；`difficulty` 取 1–3；`images` 为图片地址数组 |

## 维护脚本

```bash
# 批量导入新题（JSON 数组，每题带 "bank": "shizheng" 或 "qiye"），自动编号并按题干去重
python3 scripts/import_questions.py new_questions.json

# 校验所有题库并重新生成 data/manifest.json
python3 scripts/build.py
```

推送到 `main` 后，GitHub Actions 会自动校验题库并部署网页；格式有误时 Action 会失败并指出具体哪一题。

## 免责声明

题目整理自公开资料，仅供学习交流；“往年真题”多为考生回忆版，可能与原题有出入。发现错误欢迎提 Issue。

# 交接说明（给下一个 Claude 会话）

> 用户要在本地电脑继续维护这个仓库。本文件记录目前进度与待办，完成后可删除。

## 项目目标
三峡集团招聘笔试刷题仓库：**只做时政 + 三峡企业文化两类**（行测用户自己做，不需要）。
来源：① 刷题网站往年真题/回忆题 ② 三峡集团官网 ③ 时政新闻。先找往年真题，再结合当前时间补充；时政侧重中国、外交。

## 当前状态（2026-11-09）
- `data/shizheng.json` 时政 58 题：事实均对照新华网 / 外交部 / 中国政府网原文核实，带 `source_url`。覆盖 2025-03 ~ 2026-11，外交约 45%。
- `data/qiye.json` 企业文化与概况 49 题：**未经官网原文核实**（云端访问 ctg.com.cn 被对方 TLS 重置），事实来自搜索引擎摘录，`source` 均标注“（待官网原文复核）”。
- 往年真题：**0 题**。云端能打开的牛客 / 高顿页面没有三峡时政或企业文化原题；知乎被反爬拦截。

## 待办（本地网络应能访问以下站点）
1. **复核企业文化题**：逐题打开 `source_url`（多为 www.ctg.com.cn），与官网原文核对；正确的把 source 改成“三峡集团官网”等，错误的修正，核实不了的删除。重点：
   - 核心理念原文：使命“在保护中发展、在发展中保护，更好造福人民”；愿景“奋进两翼齐飞 创建世界一流”；价值观“创新引领发展 零碳共赢未来”；品牌口号“为绿色生活赋能”
   - 现任领导（董事长刘伟平、总经理李富民）2026 年是否仍在任
   - 三峡水库首次蓄水 175 米（2010 年）题来源是维基百科，换成权威来源
2. **找往年真题**（重点知乎笔经、登录后的牛客帖子）：
   - https://www.zhihu.com/question/505126275
   - https://www.zhihu.com/question/296990836
   - https://zhuanlan.zhihu.com/p/666763228
   - https://zhuanlan.zhihu.com/p/1962198367695278770
   - 牛客三峡企业讨论区 https://www.nowcoder.com/enterprise/5604/discussion
   - 真题 `source` 写“往年真题·20XX校招（回忆版）”，tags 加年份。
3. 时政题持续按月更新（重点关注 2026-11 APEC 深圳会议、COP31 等会后成果）。

## 工作流
```bash
python3 scripts/import_questions.py new.json   # 新题为 JSON 数组，每题带 "bank": "shizheng" | "qiye"
python3 scripts/build.py                        # 校验 + 更新 data/manifest.json
python3 -m http.server 8000                     # 本地预览
```
推送到 main 后 GitHub Actions 自动校验并部署 Pages（需在仓库 Settings → Pages → Source 选 GitHub Actions）。

原则：每道题的事实必须来自实际打开过的页面，不编造；拿不准的不收。

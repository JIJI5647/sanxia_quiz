/* 三峡刷题 —— 纯静态单页应用，无依赖。进度保存在 localStorage。 */
(() => {
  "use strict";

  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const TYPE_NAME = { single: "单选", multiple: "多选", judge: "判断", fill: "填空" };
  const STORE_KEY = "sxq.v1";
  const $app = document.getElementById("app");

  /* ---------------- 存储 ---------------- */
  const store = (() => {
    let s;
    try { s = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { s = {}; }
    s.stats ||= {}; s.wrong ||= {}; s.star ||= {}; s.pos ||= {};
    const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {} };
    return {
      data: s,
      save,
      record(id, ok) {
        const st = (s.stats[id] ||= { r: 0, w: 0 });
        ok ? st.r++ : st.w++;
        st.last = ok ? 1 : 0;
        st.t = Date.now();
        if (!ok) s.wrong[id] = Date.now();
        save();
      },
      toggleStar(id) { s.star[id] ? delete s.star[id] : (s.star[id] = Date.now()); save(); },
      removeWrong(id) { delete s.wrong[id]; save(); },
      reset() { localStorage.removeItem(STORE_KEY); location.reload(); },
    };
  })();

  /* ---------------- 主题 ---------------- */
  const themeBtn = document.getElementById("theme-toggle");
  const applyTheme = (t) => t ? document.documentElement.setAttribute("data-theme", t) : document.documentElement.removeAttribute("data-theme");
  try { applyTheme(localStorage.getItem("sxq.theme")); } catch {}
  themeBtn.onclick = () => {
    const cur = document.documentElement.getAttribute("data-theme")
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("sxq.theme", next); } catch {}
  };

  /* ---------------- 工具 ---------------- */
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const norm = (v) => String(v ?? "").replace(/\s+/g, "").toLowerCase()
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  const fmtTime = (sec) => `${String((sec / 60) | 0).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  const parseHash = () => {
    const [path, qs] = location.hash.replace(/^#/, "").split("?");
    return { path: path || "/", params: new URLSearchParams(qs || "") };
  };

  function answerText(q, a = q.answer) {
    if (a === undefined || a === null || a === "") return "未作答";
    if (q.type === "judge") return a ? "正确" : "错误";
    if (q.type === "multiple") return [].concat(a).slice().sort().join("");
    if (q.type === "fill") return [].concat(a).join(" / ");
    return a;
  }
  function isCorrect(q, ua) {
    if (ua === undefined || ua === null) return false;
    switch (q.type) {
      case "single": return ua === q.answer;
      case "judge": return ua === q.answer;
      case "multiple": return [].concat(ua).sort().join() === [].concat(q.answer).sort().join();
      case "fill": return [].concat(q.answer).some((a) => norm(a) === norm(ua));
    }
    return false;
  }
  const answered = (q, ua) => q.type === "multiple" ? Array.isArray(ua) && ua.length > 0
    : q.type === "fill" ? typeof ua === "string" && ua.trim() !== "" : ua !== undefined;

  /* ---------------- 数据加载 ---------------- */
  let manifest = null, banks = [], all = [], byId = new Map();
  async function load() {
    const fetchJSON = (u) => fetch(u, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(`${u} ${r.status}`); return r.json(); });
    manifest = await fetchJSON("data/manifest.json");
    banks = await Promise.all(manifest.banks.map(async (b) => {
      const d = await fetchJSON("data/" + b.file);
      const qs = (d.questions || []).map((q) => ({ ...q, _bank: b.file, _bankName: d.name || b.name }));
      return { ...b, name: d.name || b.name, description: d.description || b.description, questions: qs };
    }));
    all = banks.flatMap((b) => b.questions);
    byId = new Map(all.map((q) => [q.id, q]));
  }

  /* ---------------- 会话 ---------------- */
  // mode: practice（练习，即时反馈）| review（背题）| exam（考试）| result（考后回顾）
  let session = null, timerId = null;

  function startSession({ title, list, mode = "practice", start = 0, minutes = 0, posKey = null, fromWrong = false }) {
    if (!list.length) { alert("没有符合条件的题目"); return; }
    clearInterval(timerId);
    session = { title, list, mode, idx: Math.min(start, list.length - 1), ans: {}, done: {}, posKey, fromWrong, minutes };
    if (mode === "exam" && minutes > 0) {
      session.deadline = Date.now() + minutes * 60000;
      timerId = setInterval(tick, 1000);
    }
    if (location.hash === "#/quiz") render(); else location.hash = "#/quiz";
  }
  function tick() {
    if (!session || session.mode !== "exam") return clearInterval(timerId);
    const left = Math.max(0, Math.round((session.deadline - Date.now()) / 1000));
    const el = document.querySelector(".timer");
    if (el) { el.textContent = "⏱ " + fmtTime(left); el.classList.toggle("low", left < 60); }
    if (left <= 0) { alert("时间到，自动交卷"); submitExam(); }
  }
  function submitExam() {
    clearInterval(timerId);
    const s = session;
    let right = 0;
    s.list.forEach((q) => {
      const ua = s.ans[q.id];
      const ok = isCorrect(q, ua);
      if (ok) right++;
      store.record(q.id, ok); // 未作答计为错
      s.done[q.id] = true;
    });
    s.mode = "result";
    s.score = { right, total: s.list.length, used: s.deadline ? s.minutes * 60 - Math.max(0, Math.round((s.deadline - Date.now()) / 1000)) : null };
    s.showSummary = true;
    render();
  }

  /* ---------------- 渲染：首页 ---------------- */
  function bankProgress(b) {
    const st = store.data.stats;
    let done = 0, right = 0;
    for (const q of b.questions) { const x = st[q.id]; if (x) { done++; if (x.last) right++; } }
    return { done, right };
  }

  function tagCounts() {
    const m = new Map();
    for (const q of all) for (const t of q.tags || []) m.set(t, (m.get(t) || 0) + 1);
    // 年月类标签（如 2026-10）按时间倒序排在前，其余按题量
    const isDate = (t) => /^\d{4}(-\d{2})?$/.test(t);
    return [...m].sort((a, b) => (isDate(b[0]) - isDate(a[0])) || (isDate(a[0]) ? b[0].localeCompare(a[0]) : b[1] - a[1]));
  }

  function viewHome() {
    const st = store.data.stats;
    const doneIds = Object.keys(st).filter((id) => byId.has(id));
    const totalR = doneIds.reduce((n, id) => n + st[id].r, 0);
    const totalW = doneIds.reduce((n, id) => n + st[id].w, 0);
    const wrongN = Object.keys(store.data.wrong).filter((id) => byId.has(id)).length;
    const acc = totalR + totalW ? Math.round((totalR / (totalR + totalW)) * 100) + "%" : "—";

    $app.innerHTML = `
      <h1>三峡集团招聘笔试 · 刷题</h1>
      <p class="muted">共 ${all.length} 题 · ${banks.length} 个题库</p>
      <div class="stats">
        <div class="stat"><b>${doneIds.length}</b><span>已做题目</span></div>
        <div class="stat"><b>${acc}</b><span>累计正确率</span></div>
        <div class="stat"><b>${totalR + totalW}</b><span>答题次数</span></div>
        <div class="stat"><a href="#/wrong"><b>${wrongN}</b></a><span>错题本</span></div>
      </div>

      <h2>题库</h2>
      <div class="banks">
        ${banks.map((b) => {
          const p = bankProgress(b);
          const pct = b.questions.length ? Math.round((p.done / b.questions.length) * 100) : 0;
          const pos = store.data.pos[b.file];
          return `
          <div class="bank">
            <h3>${esc(b.name)}</h3>
            <p>${esc(b.description)}</p>
            <p>${b.questions.length} 题 · 已做 ${p.done}（${pct}%） · 最近答对 ${p.right}</p>
            <div class="bar"><i style="width:${pct}%"></i></div>
            <div class="actions">
              <button class="btn primary sm" data-act="seq" data-bank="${esc(b.file)}">${pos ? `继续练习（第 ${pos + 1} 题）` : "顺序练习"}</button>
              <button class="btn sm" data-act="rand" data-bank="${esc(b.file)}">随机</button>
              <button class="btn sm" data-act="undone" data-bank="${esc(b.file)}">未做</button>
              <button class="btn sm" data-act="review" data-bank="${esc(b.file)}">背题</button>
            </div>
          </div>`;
        }).join("")}
      </div>

      <h2>模拟考试</h2>
      <div class="panel">
        <div class="form-row">
          <label>题库
            <select id="ex-bank"><option value="">全部题库</option>${banks.map((b) => `<option value="${esc(b.file)}">${esc(b.name)}</option>`).join("")}</select>
          </label>
          <label>题量 <input id="ex-n" type="number" min="1" max="500" value="${Math.min(50, all.length)}" style="width:80px"></label>
          <label>时长（分钟，0 不限时） <input id="ex-m" type="number" min="0" max="600" value="60" style="width:80px"></label>
          <button class="btn primary" id="ex-go">开始考试</button>
        </div>
        <p class="muted small" style="margin:0">考试中不显示答案，交卷后统一判分；未作答计为错误并加入错题本。</p>
      </div>

      <h2>按题型练习</h2>
      <div class="form-row">
        ${Object.entries(TYPE_NAME).map(([t, n]) => {
          const c = all.filter((q) => q.type === t).length;
          return `<button class="btn" data-act="type" data-type="${t}" ${c ? "" : "disabled"}>${n}（${c}）</button>`;
        }).join("")}
      </div>

      <h2>按标签练习</h2>
      <div class="form-row">
        ${tagCounts().map(([t, c]) => `<button class="btn sm" data-act="tag" data-tag="${esc(t)}">${esc(t)}（${c}）</button>`).join("") || '<span class="muted">暂无标签</span>'}
      </div>

      <p class="muted small" style="margin-top:32px">
        <button class="btn sm" id="reset">清空本机做题记录</button>
      </p>`;

    $app.querySelectorAll("[data-act]").forEach((el) => el.onclick = () => {
      const b = banks.find((x) => x.file === el.dataset.bank);
      switch (el.dataset.act) {
        case "seq": return startSession({ title: b.name + " · 顺序练习", list: b.questions, start: store.data.pos[b.file] || 0, posKey: b.file });
        case "rand": return startSession({ title: b.name + " · 随机练习", list: shuffle(b.questions) });
        case "undone": return startSession({ title: b.name + " · 未做题", list: b.questions.filter((q) => !store.data.stats[q.id]) });
        case "review": return startSession({ title: b.name + " · 背题", list: b.questions, mode: "review" });
        case "tag": return startSession({ title: "标签：" + el.dataset.tag, list: all.filter((q) => (q.tags || []).includes(el.dataset.tag)) });
        case "type": return startSession({ title: TYPE_NAME[el.dataset.type] + "题 · 随机练习", list: shuffle(all.filter((q) => q.type === el.dataset.type)) });
      }
    });
    document.getElementById("ex-go").onclick = () => {
      const file = document.getElementById("ex-bank").value;
      const pool = file ? banks.find((b) => b.file === file).questions : all;
      const n = Math.max(1, parseInt(document.getElementById("ex-n").value, 10) || 1);
      const m = Math.max(0, parseInt(document.getElementById("ex-m").value, 10) || 0);
      startSession({ title: "模拟考试", list: shuffle(pool).slice(0, n), mode: "exam", minutes: m });
    };
    document.getElementById("reset").onclick = () => { if (confirm("确定清空所有做题记录、错题本和收藏吗？此操作不可撤销。")) store.reset(); };
  }

  /* ---------------- 渲染：做题 ---------------- */
  function viewQuiz() {
    const s = session;
    if (!s) { location.hash = "#/"; return; }
    if (s.mode === "result" && s.showSummary) return viewResult();

    const q = s.list[s.idx];
    const ua = s.ans[q.id];
    const reveal = s.mode === "review" || s.mode === "result" || (s.mode === "practice" && s.done[q.id]);
    const locked = reveal;
    const starred = !!store.data.star[q.id];
    if (s.posKey) { store.data.pos[s.posKey] = s.idx; store.save(); }

    const optHTML = () => {
      if (q.type === "fill") {
        return `<input class="fill-input" id="fill" type="text" placeholder="输入答案后按 Enter" value="${esc(ua || "")}" ${locked ? "disabled" : ""} autocomplete="off">`;
      }
      const opts = q.type === "judge" ? [["T", "正确", true], ["F", "错误", false]]
        : q.options.map((o, i) => [LETTERS[i], o, LETTERS[i]]);
      return `<div class="options">${opts.map(([key, text, val], i) => {
        const sel = q.type === "multiple" ? (ua || []).includes(val) : ua === val;
        const isAns = q.type === "multiple" ? q.answer.includes(val) : q.answer === val;
        let cls = "";
        if (reveal) { if (isAns) cls = "right"; else if (sel) cls = "wrong"; }
        else if (sel) cls = "sel";
        return `<button class="opt ${cls}" data-i="${i}" ${locked ? "disabled" : ""}><span class="key">${q.type === "judge" ? (val ? "✓" : "✗") : key}</span><span class="txt">${esc(text)}</span></button>`;
      }).join("")}</div>`;
    };

    let resultHTML = "";
    if (reveal) {
      const showVerdict = s.mode !== "review";
      const ok = isCorrect(q, ua);
      resultHTML = `<div class="result ${showVerdict ? (ok ? "ok" : "bad") : "info"}">
        ${showVerdict ? `<div class="verdict">${ok ? "✔ 回答正确" : "✘ 回答错误"}${ok ? "" : `　你的答案：${esc(answerText(q, ua))}`}</div>` : ""}
        <div>正确答案：<b>${esc(answerText(q))}</b></div>
        ${q.analysis ? `<div class="analysis"><span class="muted">解析：</span>${esc(q.analysis)}</div>` : ""}
        ${store.data.wrong[q.id] ? `<div style="margin-top:8px"><button class="btn sm" id="rm-wrong">移出错题本</button></div>` : ""}
      </div>`;
    }

    const isLast = s.idx === s.list.length - 1;
    const needSubmit = s.mode === "practice" && !s.done[q.id] && (q.type === "multiple" || q.type === "fill");
    let nextBtn;
    if (s.mode === "exam" && isLast) nextBtn = `<button class="btn primary" id="submit-exam">交卷</button>`;
    else if (needSubmit) nextBtn = `<button class="btn primary" id="check" ${answered(q, ua) ? "" : "disabled"}>提交答案</button>`;
    else nextBtn = `<button class="btn primary" id="next" ${isLast ? "disabled" : ""}>下一题 →</button>`;

    const cellCls = (x, i) => {
      let c = "";
      if (s.mode === "exam") c = answered(x, s.ans[x.id]) ? "done" : "";
      else if (s.mode !== "review" && s.done[x.id]) c = isCorrect(x, s.ans[x.id]) ? "right" : "wrong";
      return c + (i === s.idx ? " cur" : "");
    };
    const answeredN = s.list.filter((x) => answered(x, s.ans[x.id])).length;

    $app.innerHTML = `
      <div class="quiz-head">
        <div><span class="title">${esc(s.title)}</span> <span class="muted">${s.idx + 1} / ${s.list.length}</span></div>
        <div class="grp" style="display:flex;gap:8px;align-items:center">
          ${s.mode === "exam" && s.deadline ? `<span class="timer">⏱ --:--</span>` : ""}
          ${s.mode === "exam" ? `<button class="btn sm" id="submit-exam2">交卷（已答 ${answeredN}/${s.list.length}）</button>` : ""}
          ${s.mode === "result" ? `<button class="btn sm" id="back-summary">成绩单</button>` : ""}
          <button class="btn sm" id="exit">退出</button>
        </div>
      </div>
      <div class="qcard">
        <div class="qmeta">
          <span class="tag">${TYPE_NAME[q.type]}</span>
          <span class="tag gray">${esc(q._bankName)}</span>
          ${(q.tags || []).map((t) => `<span class="tag gray">${esc(t)}</span>`).join("")}
          ${q.difficulty ? `<span class="muted" title="难度">${"★".repeat(q.difficulty)}${"☆".repeat(3 - q.difficulty)}</span>` : ""}
          ${q.source ? `<span class="muted">· ${q.source_url && /^https?:/.test(q.source_url) ? `<a href="${esc(q.source_url)}" target="_blank" rel="noopener">${esc(q.source)}</a>` : esc(q.source)}</span>` : ""}
          <span style="flex:1"></span>
          <button class="icon-btn" id="star" title="收藏">${starred ? "★" : "☆"}</button>
        </div>
        <div class="stem">${esc(q.stem)}</div>
        ${(q.images || []).map((src) => `<img src="${esc(src)}" alt="题图" loading="lazy">`).join("")}
        ${optHTML()}
        ${resultHTML}
      </div>
      <div class="quiz-nav">
        <button class="btn" id="prev" ${s.idx === 0 ? "disabled" : ""}>← 上一题</button>
        <div class="grp">
          ${needSubmit ? `<button class="btn" id="skip" ${isLast ? "disabled" : ""}>跳过</button>` : ""}
          ${nextBtn}
        </div>
      </div>
      <details class="sheet" ${s.list.length <= 60 ? "open" : ""}>
        <summary>答题卡</summary>
        <div class="grid">${s.list.map((x, i) => `<button class="cell ${cellCls(x, i)}" data-go="${i}">${i + 1}</button>`).join("")}</div>
      </details>`;

    if (s.mode === "exam") tick();

    // 事件
    const go = (i) => { if (i >= 0 && i < s.list.length) { s.idx = i; render(); window.scrollTo(0, 0); } };
    const commit = () => {
      if (!answered(q, s.ans[q.id])) return;
      s.done[q.id] = true;
      const ok = isCorrect(q, s.ans[q.id]);
      store.record(q.id, ok);
      if (ok && s.fromWrong) store.removeWrong(q.id);
      render();
    };
    $app.querySelectorAll(".opt").forEach((el) => el.onclick = () => {
      const i = +el.dataset.i;
      const val = q.type === "judge" ? i === 0 : LETTERS[i];
      if (q.type === "multiple") {
        const cur = new Set(s.ans[q.id] || []);
        cur.has(val) ? cur.delete(val) : cur.add(val);
        s.ans[q.id] = [...cur].sort();
        render();
      } else {
        s.ans[q.id] = val;
        if (s.mode === "practice") commit(); else render();
      }
    });
    const fill = document.getElementById("fill");
    if (fill) {
      fill.oninput = () => {
        s.ans[q.id] = fill.value;
        const btn = document.getElementById("check");
        if (btn) btn.disabled = !fill.value.trim();
      };
      fill.onkeydown = (e) => {
        if (e.key !== "Enter" || e.isComposing) return;
        e.preventDefault(); e.stopPropagation();
        if (s.mode === "practice" && !s.done[q.id]) commit(); else go(s.idx + 1);
      };
      if (!locked) fill.focus();
    }
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    on("prev", () => go(s.idx - 1));
    on("next", () => go(s.idx + 1));
    on("skip", () => go(s.idx + 1));
    on("check", commit);
    on("star", () => { store.toggleStar(q.id); render(); });
    on("rm-wrong", () => { store.removeWrong(q.id); render(); });
    on("back-summary", () => { s.showSummary = true; render(); });
    const confirmSubmit = () => {
      const left = s.list.length - s.list.filter((x) => answered(x, s.ans[x.id])).length;
      if (confirm(left ? `还有 ${left} 题未作答，确定交卷吗？` : "确定交卷吗？")) submitExam();
    };
    on("submit-exam", confirmSubmit);
    on("submit-exam2", confirmSubmit);
    on("exit", () => {
      if (s.mode === "exam" && !confirm("考试尚未交卷，退出将丢弃本次作答。确定退出？")) return;
      clearInterval(timerId); session = null; location.hash = "#/";
    });
    $app.querySelectorAll("[data-go]").forEach((el) => el.onclick = () => go(+el.dataset.go));

    s._keys = { go, commit, q, needSubmit, confirmSubmit };
  }

  function viewResult() {
    const s = session, { right, total, used } = s.score;
    const pct = Math.round((right / total) * 100);
    const wrongList = s.list.map((q, i) => [q, i]).filter(([q]) => !isCorrect(q, s.ans[q.id]));
    $app.innerHTML = `
      <div class="panel center">
        <div class="muted">${esc(s.title)} · 成绩</div>
        <div class="score">${pct}<span style="font-size:22px"> 分</span></div>
        <div class="muted">答对 ${right} / ${total} 题${used != null ? ` · 用时 ${fmtTime(used)}` : ""}</div>
        <div class="form-row" style="justify-content:center;margin-top:16px">
          <button class="btn primary" id="review-all">逐题回顾</button>
          ${wrongList.length ? `<button class="btn" id="redo-wrong">重做错题（${wrongList.length}）</button>` : ""}
          <a class="btn" href="#/" id="home">返回首页</a>
        </div>
      </div>
      ${wrongList.length ? `<h2>错题（${wrongList.length}）</h2>
      <div class="list">${wrongList.map(([q, i]) => `
        <div class="list-item" data-go="${i}">
          <div class="s">${i + 1}. ${esc(q.stem)}</div>
          <div class="small muted">你的答案：${esc(answerText(q, s.ans[q.id]))} · 正确答案：<b style="color:var(--ok)">${esc(answerText(q))}</b></div>
        </div>`).join("")}</div>` : `<p class="center muted" style="margin-top:24px">全部答对，太强了 🎉</p>`}`;
    const open = (i) => { s.showSummary = false; s.idx = i; render(); window.scrollTo(0, 0); };
    document.getElementById("review-all").onclick = () => open(0);
    $app.querySelectorAll("[data-go]").forEach((el) => el.onclick = () => open(+el.dataset.go));
    const rw = document.getElementById("redo-wrong");
    if (rw) rw.onclick = () => startSession({ title: "考试错题重做", list: wrongList.map(([q]) => q), fromWrong: true });
    document.getElementById("home").onclick = () => { session = null; };
  }

  /* ---------------- 渲染：错题本 / 收藏 ---------------- */
  function viewCollection(kind) {
    const isWrong = kind === "wrong";
    const map = isWrong ? store.data.wrong : store.data.star;
    const list = Object.entries(map).filter(([id]) => byId.has(id)).sort((a, b) => b[1] - a[1]).map(([id]) => byId.get(id));
    const label = isWrong ? "错题本" : "收藏";
    $app.innerHTML = `
      <div class="quiz-head">
        <h1>${label} <span class="muted" style="font-size:16px">${list.length} 题</span></h1>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${list.length ? `<button class="btn primary" id="go">练习全部</button><button class="btn" id="go-r">随机练习</button><button class="btn" id="go-v">背题</button>` : ""}
          ${isWrong && list.length ? `<button class="btn" id="clear">清空</button>` : ""}
        </div>
      </div>
      ${isWrong ? `<p class="muted small">在错题本中练习时，答对的题会自动移出。</p>` : ""}
      ${list.length ? `<div class="list">${list.map((q, i) => {
        const st = store.data.stats[q.id] || { r: 0, w: 0 };
        return `<div class="list-item" data-i="${i}">
          <div class="s">${esc(q.stem)}</div>
          <div class="small muted">${TYPE_NAME[q.type]} · ${esc(q._bankName)} · 对 ${st.r} 次 / 错 ${st.w} 次</div>
        </div>`;
      }).join("")}</div>` : `<div class="empty">${isWrong ? "还没有错题，继续保持！" : "还没有收藏的题目，做题时点 ☆ 即可收藏。"}</div>`}`;
    const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
    on("go", () => startSession({ title: label, list, fromWrong: isWrong }));
    on("go-r", () => startSession({ title: label + " · 随机", list: shuffle(list), fromWrong: isWrong }));
    on("go-v", () => startSession({ title: label + " · 背题", list, mode: "review" }));
    on("clear", () => { if (confirm("确定清空错题本？")) { store.data.wrong = {}; store.save(); render(); } });
    $app.querySelectorAll("[data-i]").forEach((el) => el.onclick = () =>
      startSession({ title: label, list, start: +el.dataset.i, fromWrong: isWrong }));
  }

  /* ---------------- 渲染：搜索 ---------------- */
  function viewSearch(params) {
    const kw = params.get("q") || "";
    $app.innerHTML = `
      <h1>搜索题目</h1>
      <p><input type="search" id="kw" placeholder="输入题干、选项、解析或标签关键词" value="${esc(kw)}" autofocus></p>
      <div id="res"></div>`;
    const input = document.getElementById("kw"), res = document.getElementById("res");
    const hl = (text, k) => {
      const t = esc(text);
      if (!k) return t;
      const ek = esc(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return t.replace(new RegExp(ek, "gi"), (m) => `<mark>${m}</mark>`);
    };
    const run = () => {
      const k = input.value.trim();
      history.replaceState(null, "", "#/search" + (k ? "?q=" + encodeURIComponent(k) : ""));
      if (!k) { res.innerHTML = `<p class="muted">共 ${all.length} 题可搜索。</p>`; return; }
      const lk = k.toLowerCase();
      const hits = all.filter((q) => [q.stem, q.analysis, q.id, ...(q.options || []), ...(q.tags || [])]
        .some((f) => f && String(f).toLowerCase().includes(lk)));
      res.innerHTML = `<p class="muted">找到 ${hits.length} 题</p><div class="list">${hits.slice(0, 200).map((q, i) => `
        <div class="list-item" data-i="${i}">
          <div>${hl(q.stem, k)}</div>
          <div class="small muted">${TYPE_NAME[q.type]} · ${esc(q._bankName)} · 答案：${esc(answerText(q))}</div>
        </div>`).join("")}</div>`;
      res.querySelectorAll("[data-i]").forEach((el) => el.onclick = () =>
        startSession({ title: `搜索「${k}」`, list: hits, start: +el.dataset.i }));
    };
    input.oninput = run;
    run();
    input.focus();
  }

  /* ---------------- 路由 ---------------- */
  function render() {
    const { path, params } = parseHash();
    document.querySelectorAll(".topbar nav a").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + path));
    if (path !== "/quiz" && session && session.mode === "exam") {
      // 考试中离开页面：回到考试
      location.hash = "#/quiz"; return;
    }
    switch (path) {
      case "/quiz": return viewQuiz();
      case "/wrong": return viewCollection("wrong");
      case "/starred": return viewCollection("star");
      case "/search": return viewSearch(params);
      default: return viewHome();
    }
  }

  /* ---------------- 键盘快捷键 ---------------- */
  document.addEventListener("keydown", (e) => {
    if (parseHash().path !== "/quiz" || !session || !session._keys) return;
    if (e.target.matches("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
    const { go, commit, q, needSubmit, confirmSubmit } = session._keys;
    const s = session;
    const k = e.key.toUpperCase();
    let i = -1;
    if (q.type === "judge") { if (k === "1" || k === "T" || k === "A") i = 0; if (k === "2" || k === "F" || k === "B") i = 1; }
    else if (q.options) { i = /^[1-9]$/.test(k) ? +k - 1 : LETTERS.indexOf(k); if (i >= q.options.length) i = -1; }
    if (i >= 0 && k.length === 1) {
      const btn = $app.querySelectorAll(".opt")[i];
      if (btn && !btn.disabled) { e.preventDefault(); btn.click(); }
      return;
    }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(s.idx - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(s.idx + 1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (needSubmit && answered(q, s.ans[q.id])) commit();
      else if (s.mode === "exam" && s.idx === s.list.length - 1) confirmSubmit();
      else go(s.idx + 1);
    }
  });

  window.addEventListener("hashchange", render);
  window.addEventListener("beforeunload", (e) => { if (session && session.mode === "exam") { e.preventDefault(); e.returnValue = ""; } });

  load().then(render).catch((err) => {
    console.error(err);
    $app.innerHTML = `<div class="empty">题库加载失败：${esc(err.message)}<br><span class="small">如果你是直接双击打开的 index.html，请改用本地服务器：<code>python3 -m http.server</code></span></div>`;
  });
})();

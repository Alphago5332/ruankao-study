#!/usr/bin/env node
/**
 * audit_bank.js — 题库体检（查重 / 查键冲突 / 查答案分布）
 *
 * 用法：node tools/audit_bank.js
 *
 * 覆盖两套题库（都以 HTML 为唯一真源，直接从源码里抠字面量）：
 *   A. 08_答题系统/index.html 的 QUESTION_BANK（填空题）
 *   B. 01_教材笔记/**\/*_考点自测题.html 的 QUESTIONS（选择题，含跨节查重）
 *
 * 检查项：
 *   1. 题目 id 重复
 *   2. 题干重复（归一化：去标点/空格/下划线/引号后比较）
 *   3. 题干+答案 完全重复（纯冗余，必删）
 *   4. 同一节的 check 键被多题挂（勾选会重叠 —— 一条清单条目对应多个命题点时属正常）
 *   5. 同一答案出现 >= 2 次（参考项）
 * 退出码：0 = 干净；2 = 有需处理的重复/冲突
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const CH = '08_答题系统/index.html';
const SELF_TEST_GLOB_DIR = path.join(root, '01_教材笔记');

const read = p => fs.readFileSync(p, 'utf8');

/** 从源码里抠出 `const NAME = ...` 的字面量（支持对象与数组，括号配对 + 跳过字符串） */
function literal(src, name) {
  const decl = src.indexOf('const ' + name + ' = ');
  if (decl < 0) return null;
  const braceAt = src.indexOf('{', decl);
  const bracketAt = src.indexOf('[', decl);
  let start, openCh, closeCh;
  if (braceAt < 0 || (bracketAt >= 0 && bracketAt < braceAt)) { start = bracketAt; openCh = '['; closeCh = ']'; }
  else { start = braceAt; openCh = '{'; closeCh = '}'; }
  let depth = 0, inStr = null, esc = false;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return eval('(' + src.slice(start, i + 1) + ')'); }
  }
  return null;
}

const norm = s => String(s || '')
  .replace(/[「」『』【】《》（）()"'`]/g, '')
  .replace(/[\s_＿,，。．.、:：;；!！?？\-—~～/]/g, '')
  .toLowerCase();

/** 字符二元组 Dice 相似度：0~1，用来抓「同考点换说法」的近似重复 */
function dice(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const grams = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const A = grams(a), B = grams(b);
  let inter = 0, total = 0;
  A.forEach((v, k) => { total += v; if (B.has(k)) inter += Math.min(v, B.get(k)); });
  B.forEach(v => { total += v; });
  return total ? (2 * inter) / total : 0;
}

// 近似重复阈值 & 关注小节（命令行可传，如：node tools/audit_bank.js 1.4 0.45）
const FOCUS = (process.argv[2] || '').trim();
const NEAR = Number(process.argv[3] || process.env.NEAR || 0.62);

const report = [];
const add = (title, items) => { if (items.length) report.push({ title, items }); };

const POOL = [];   // 全部题目（答题系统 + 自测题）统一池，用于跨库近似查重
let KEY_INFO = { total: 0, bad: 0 };   // check 键绑定统计（A 段填充）

/** 通用查重：all = [{ file, sec, id, q, ans }] */
function dupChecks(all, label) {
  const byId = {};
  all.filter(x => x.id).forEach(x => (byId[x.id] = byId[x.id] || []).push(x));
  add(`${label} · id 重复`, Object.entries(byId).filter(([, v]) => v.length > 1)
    .map(([id, v]) => `${id} × ${v.length}（${v.map(x => x.sec).join(' / ')}）`));

  const byQ = {};
  all.forEach(x => { const k = norm(x.q); (byQ[k] = byQ[k] || []).push(x); });
  const dupQ = Object.values(byQ).filter(v => v.length > 1);
  add(`${label} · 题干重复`, dupQ.map(v =>
    v.map(x => `${x.sec}/${x.id || '-'}`).join('  ==  ') + '\n     题：' + v[0].q));

  add(`${label} · 题干与答案同时重复（纯冗余，必删）`, dupQ
    .filter(v => new Set(v.map(x => norm(x.ans))).size === 1)
    .map(v => v.map(x => `${x.sec}/${x.id || '-'}`).join('  ==  ')
      + '\n     题：' + v[0].q + '\n     答：' + v[0].ans));
  return all;
}

const lines = [];
const head = t => { lines.push(''); lines.push('== ' + t + ' =='); };

/* ---------- A. 答题系统填空题 ---------- */
let bankCount = 0, bankSecs = [];
const bankFile = path.join(root, CH);
if (fs.existsSync(bankFile)) {
  const BANK = literal(read(bankFile), 'QUESTION_BANK');
  if (!BANK) { console.error('❌ 未能解析 QUESTION_BANK：' + bankFile); process.exit(1); }
  bankSecs = Object.keys(BANK).filter(k => !k.startsWith('_'));
  bankCount = bankSecs.reduce((a, s) => a + BANK[s].length, 0);
  const all = [];
  bankSecs.forEach(sec => BANK[sec].forEach(q => all.push({ file: CH, sec, ...q, ans: (q.blanks || []).join(' / ') })));
  dupChecks(all, '答题系统');
  all.forEach(q => POOL.push({ from: '答题系统', sec: q.sec, id: q.id, q: q.q, ans: q.ans }));

  // check 键重复
  const byCheck = {};
  all.forEach(q => (q.check || []).forEach(([, k]) => {
    const key = q.sec + ' → ' + k;
    (byCheck[key] = byCheck[key] || []).push(q.id);
  }));
  add('答题系统 · 同一节清单键被多题挂（参考项，一条清单含多命题点时正常）',
    Object.entries(byCheck).filter(([, v]) => v.length > 1).map(([k, v]) => `${k} ← ${v.join(', ')}`));

  // check 键必须真实存在于对应的「可勾选清单」HTML 里
  // （键制分裂：1.1/1.2 是行号键 L##，1.3 起是语义键 A1/B3…；清单增删行后 L## 会整体错位）
  const keyCache = {};
  const badKey = [];
  let checkTotal = 0;
  all.forEach(q => (q.check || []).forEach(([rel, k]) => {
    checkTotal++;
    const htmlRel = rel.replace(/\.md$/, '_可勾选.html');
    if (!(htmlRel in keyCache)) {
      const p = path.join(root, htmlRel);
      keyCache[htmlRel] = fs.existsSync(p)
        ? new Set([...read(p).matchAll(/data-key="([^"]+)"/g)].map(m => m[1]))
        : null;
    }
    const set = keyCache[htmlRel];
    if (!set) badKey.push(`${q.id}: 清单 HTML 不存在 → ${htmlRel}`);
    else if (!set.has(k)) badKey.push(`${q.id}: 键 ${k} 不在 ${path.basename(htmlRel)}（点「去清单勾选」会失效；清单增删行后请重跑 md2checklist.js 并同步 check 键）`);
  }));
  add('答题系统 · check 键在清单 HTML 里不存在（联动失效，必修）', badKey);
  KEY_INFO = { total: checkTotal, bad: badKey.length };

  // 答案分布
  const byAns = {};
  all.forEach(q => (q.blanks || []).forEach(b => (byAns[norm(b)] = byAns[norm(b)] || []).push(q.sec + '/' + q.id)));
  add('答题系统 · 同一答案 ≥2 次（参考项）',
    Object.entries(byAns).filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length)
      .map(([a, v]) => `${a} × ${v.length}：${v.join(', ')}`));

  head('A. 答题系统（填空题）');
  lines.push('文件：' + CH);
  lines.push('分节题量：' + bankSecs.map(s => `${s}: ${BANK[s].length}`).join(' | '));
  lines.push('合计：' + bankCount + ' 题');
  lines.push(`check 键→清单绑定：${KEY_INFO.total} 处，失效 ${KEY_INFO.bad} 处`);
} else {
  lines.push('（未找到 ' + CH + '，跳过）');
}

/* ---------- B. 各节自测题（选择题） ---------- */
const seen = [];
(function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.isFile() && /_考点自测题\.html$/.test(e.name)) seen.push(p);
  }
})(SELF_TEST_GLOB_DIR);

const selfAll = [];
const perFile = [];
seen.forEach(p => {
  const src = read(p);
  // 自测题的数组变量名在不同节里不统一：1.1 用 QS，1.2 起用 QUESTIONS
  let qs = null;
  for (const nm of ['QUESTIONS', 'QS', 'QUESTION_LIST', 'BANK']) { qs = literal(src, nm); if (Array.isArray(qs)) break; }
  const rel = path.relative(root, p).replace(/\\/g, '/');
  if (!Array.isArray(qs)) { lines.push('⚠ ' + rel + ' 未解析出题目数组'); return; }
  const sec = (rel.match(/(1|2|3|4|5|6|7|8|9)\.\d+/) || ['－'])[0];
  perFile.push(`${rel.replace(/_考点自测题\.html$/, '')}: ${qs.length} 题`);
  qs.forEach((q, i) => {
    const item = {
      file: rel, sec, id: `${sec}-Q${i + 1}`, q: q.q,
      ans: Array.isArray(q.o) ? (q.o[q.a] || '') : ''
    };
    selfAll.push(item);
    POOL.push({ from: '自测题', sec, id: item.id, q: item.q, ans: item.ans });
  });
});
dupChecks(selfAll, '自测题');
head('B. 各节自测题（选择题，已含跨节查重）');
perFile.forEach(l => lines.push(l));
lines.push('合计：' + selfAll.length + ' 题');

/* ---------- C. 近似重复（同考点换说法，跨库跨节） ---------- */
{
  const pool = FOCUS ? POOL.filter(x => x.sec === FOCUS) : POOL;
  const pairs = [];
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      if (norm(a.q) === norm(b.q)) continue;             // 完全同题已由上面报告
      const s = dice(norm(a.q), norm(b.q));
      if (s >= NEAR) pairs.push({ s, a, b });
    }
  }
  pairs.sort((x, y) => y.s - x.s);
  add(`近似重复 · 题干相似度 ≥ ${NEAR}${FOCUS ? '（只看 ' + FOCUS + ' 相关）' : ''}（参考项：同模板句「下列不属于…」会假阳性，按考点人工判定）`,
    pairs.slice(0, 25).map(p =>
      `${(p.s * 100).toFixed(0)}%  ${p.a.from}/${p.a.id}[${p.a.sec}]  ≈  ${p.b.from}/${p.b.id}[${p.b.sec}]`
      + '\n     A：' + p.a.q + '\n     B：' + p.b.q));
  head('C. 近似重复扫描（Dice 二元组相似度）');
  lines.push(`参与比对：${pool.length} 题${FOCUS ? '（关注节 ' + FOCUS + '）' : ''}｜阈值 ${NEAR}｜命中 ${pairs.length} 组`);
  if (FOCUS) lines.push('提示：加小节号参数可只看某节，如 `node tools/audit_bank.js 1.4`；阈值可作第 2 个参数，如 `node tools/audit_bank.js 1.4 0.45`');
}

/* ---------- D. 跨库重复（答题系统 ⇄ 自测题，只保留不同库的配对） ---------- */
{
  const pairs = [];
  for (let i = 0; i < POOL.length; i++) {
    for (let j = i + 1; j < POOL.length; j++) {
      const a = POOL[i], b = POOL[j];
      if (a.from === b.from) continue;                   // 库内配对留给 A/B/C 段
      if (FOCUS && a.sec !== FOCUS && b.sec !== FOCUS) continue;
      if (norm(a.q) === norm(b.q)) { pairs.push({ s: 1, a, b }); continue; }
      const s = dice(norm(a.q), norm(b.q));
      if (s >= NEAR) pairs.push({ s, a, b });
    }
  }
  pairs.sort((x, y) => y.s - x.s);
  const bySec = {};
  pairs.forEach(p => { if (p.a.sec === p.b.sec) bySec[p.a.sec] = (bySec[p.a.sec] || 0) + 1; });
  add('跨库重复 · 答题系统题 ≈ 该节自测题（同考点做了两遍）',
    pairs.map(p =>
      `${(p.s * 100).toFixed(0)}%  [${p.a.sec}] 答题系统 ${p.a.id}  ≈  自测题 ${p.b.id}`
      + '\n     A：' + p.a.q + '\n     B：' + p.b.q));
  head('D. 跨库重复（答题系统 ⇄ 自测题）');
  lines.push(`命中 ${pairs.length} 组｜按节分布：` + (Object.entries(bySec).map(([k, v]) => `${k}: ${v}`).join(' | ') || '—'));
}

/* ---------- 汇总 ---------- */
console.log('题库体检报告');
console.log(lines.join('\n'));
console.log('');
if (!report.length) {
  console.log('✅ 未发现重复题目 / 键冲突');
} else {
  report.forEach(r => {
    console.log('【' + r.title + '】共 ' + r.items.length + ' 组');
    r.items.forEach((t, i) => console.log('  ' + (i + 1) + ') ' + t));
    console.log('');
  });
  const hard = report.filter(r => !/参考项/.test(r.title));
  console.log(hard.length
    ? '❗ 需处理项：' + hard.map(r => r.title).join('；')
    : '✅ 无硬性重复（仅剩参考项，可结合考点判断）');
}
process.exit(report.filter(r => !/参考项/.test(r.title)).length ? 2 : 0);

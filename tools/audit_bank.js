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

const report = [];
const add = (title, items) => { if (items.length) report.push({ title, items }); };

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

  // check 键重复
  const byCheck = {};
  all.forEach(q => (q.check || []).forEach(([, k]) => {
    const key = q.sec + ' → ' + k;
    (byCheck[key] = byCheck[key] || []).push(q.id);
  }));
  add('答题系统 · 同一节清单键被多题挂（参考项，一条清单含多命题点时正常）',
    Object.entries(byCheck).filter(([, v]) => v.length > 1).map(([k, v]) => `${k} ← ${v.join(', ')}`));

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
  qs.forEach((q, i) => selfAll.push({
    file: rel, sec, id: `${sec}-Q${i + 1}`, q: q.q,
    ans: Array.isArray(q.o) ? (q.o[q.a] || '') : ''
  }));
});
dupChecks(selfAll, '自测题');
head('B. 各节自测题（选择题，已含跨节查重）');
perFile.forEach(l => lines.push(l));
lines.push('合计：' + selfAll.length + ' 题');

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

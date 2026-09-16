/**
 * fix_details_html.js
 *
 * 就地修复已生成的可勾选清单 HTML：只重写 <details>...</details> 区块内部
 * （把块里的 **加粗** / 有序列表等 markdown 语法渲染成真正的 HTML），
 * 其余字节一律不动 —— 包括 data-key、内联脚本里的 REL（localStorage 键）、
 * 以及文件原有行尾符（CRLF/LF），因此用户已勾选状态不受影响。
 *
 * 用法：node fix_details_html.js <文件或目录...>          # dry-run，只报告
 *       node fix_details_html.js <文件或目录...> --write  # 落盘
 */
const fs = require('fs');
const path = require('path');
const { renderDetailsInner } = require('./md2checklist.js');

function walk(p, acc) {
  const st = fs.statSync(p);
  if (st.isDirectory()) {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      if (e.name === '.git' || e.name.startsWith('.')) continue;
      walk(path.join(p, e.name), acc);
    }
  } else if (p.endsWith('_可勾选.html')) {
    acc.push(p);
  }
  return acc;
}

const targets = [];
for (const a of process.argv.slice(2).filter(x => !x.startsWith('--'))) walk(a, targets);
const WRITE = process.argv.includes('--write');

let changed = 0;
for (const f of targets) {
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/<details>[\s\S]*?<\/details>/);
  if (!m) { console.log('  · 无 details 区块，跳过：' + f); continue; }

  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  const blockLines = m[0].split(/\r?\n/);
  const rebuilt = renderDetailsInner(blockLines).split('\n').join(eol);

  if (rebuilt === m[0]) { console.log('  · 已是新格式，无需改动：' + f); continue; }

  const bars = (m[0].match(/\*\*/g) || []).length;
  changed++;
  console.log(`  ✔ ${WRITE ? '已修复' : '待修复'}（块内原有裸露 ** 共 ${bars} 处）  ${f}`);
  if (WRITE) fs.writeFileSync(f, src.replace(m[0], () => rebuilt), 'utf8');
}

console.log(`\n${WRITE ? '已修改' : '将修改'} ${changed} / ${targets.length} 个文件` +
  (WRITE ? '' : '（dry-run；加 --write 才落盘）'));

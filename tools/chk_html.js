/**
 * chk_html.js — 校验 HTML 内联 <script> 的 JS 语法 + 结构计数
 * 用法：node tools/chk_html.js <文件1.html> [文件2.html ...]
 */
const fs = require('fs');
let bad = 0;
for (const f of process.argv.slice(2)) {
  const s = fs.readFileSync(f, 'utf8');
  const blocks = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  let ok = true;
  blocks.forEach((x, i) => {
    try { new Function(x[1]); }
    catch (e) { ok = false; console.log('❌ ' + f + ' script#' + i + ' → ' + e.message); }
  });
  if (!ok) bad++;
  console.log((ok ? '✅' : '❌') + ' ' + f + ' | script块:' + blocks.length + ' | 字节:' + s.length);
}
process.exit(bad ? 1 : 0);

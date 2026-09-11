/**
 * md2checklist.js
 * 将知识点清单 .md 转换为带交互复选框的 HTML。
 * 勾选状态保存到 localStorage，刷新后保留。
 * 用法：node md2checklist.js <输入.md> <输出.html> [仓库相对路径]
 */
const fs = require('fs');
const path = require('path');

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  s = esc(s);
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 先处理粗体（**），再处理斜体（*）
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  s = s.replace(/\*([^*\n]+)\*/g, '<i>$1</i>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  return s;
}

function tableHtml(rowsSrc) {
  const getCells = r => r.split('|').slice(1, -1).map(c => c.trim());
  const headers = getCells(rowsSrc[0]);
  const body = rowsSrc.slice(2).map(getCells);
  return '<table><thead><tr>' +
    headers.map(h => `<th>${inline(h)}</th>`).join('') +
    '</tr></thead><tbody>' +
    body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('') +
    '</tbody></table>';
}

function renderContinuation(lines) {
  // lines 已经是去掉列表项前导 2 空格后的内容
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (l.trim() === '') { i++; continue; }
    if (/^\|/.test(l.trim())) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) {
        rows.push(lines[i].trim());
        i++;
      }
      out.push(tableHtml(rows));
      continue;
    }
    if (/^>\s?/.test(l.trim())) {
      const bqs = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        bqs.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + bqs.map(inline).join('<br>') + '</blockquote>');
      continue;
    }
    out.push('<p>' + inline(l) + '</p>');
    i++;
  }
  return out.length ? '<div class="item-body">' + out.join('\n') + '</div>' : '';
}

function parse(md, relPath) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;

  const isBlank = l => l.trim() === '';
  const isHr = l => /^---+\s*$/.test(l);
  const isHeader = l => /^(#{1,6})\s+/.test(l);
  const isDetails = l => /^\s*<details/.test(l);
  const isBlockquote = l => /^\s*>/.test(l);
  const isTable = l => /^\s*\|/.test(l);
  const isListItem = l => /^\s*-\s/.test(l);
  const isCheckbox = l => /^\s*-\s+\[[xX ]\]\s+/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }
    if (isHr(line)) { i++; continue; }

    if (isHeader(line)) {
      const m = line.match(/^(#{1,6})\s+(.*)$/);
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      i++;
      continue;
    }

    if (isDetails(line)) {
      const block = [];
      while (i < lines.length && !/^\s*<\/details>/.test(lines[i])) {
        block.push(lines[i]);
        i++;
      }
      if (i < lines.length) block.push(lines[i++]);
      out.push(block.join('\n'));
      continue;
    }

    if (isTable(line)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) {
        rows.push(lines[i].trim());
        i++;
      }
      out.push(tableHtml(rows));
      continue;
    }

    if (isBlockquote(line)) {
      const bqs = [];
      while (i < lines.length && isBlockquote(lines[i])) {
        bqs.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push('<blockquote>' + bqs.map(inline).join('<br>') + '</blockquote>');
      continue;
    }

    if (isCheckbox(line)) {
      const m = line.match(/^(\s*)-\s+\[([xX ])\]\s+(.*)$/);
      const checked = m[2].toLowerCase() === 'x' ? 'checked' : '';
      // 关键修复：data-key 只用行号，不要包含 relPath 前缀（避免和 STORE_KEY 拼出超长 key）
      const key = `L${i + 1}`;
      const text = inline(m[3]);
      i++;
      const cont = [];
      while (i < lines.length) {
        const n = lines[i];
        if (isBlank(n)) { cont.push(''); i++; continue; }
        if (isCheckbox(n) || isListItem(n) || isHeader(n) || isHr(n) || isDetails(n) || isBlockquote(n) || isTable(n)) break;
        if (n.startsWith('  ') || n.startsWith('\t')) {
          cont.push(n.replace(/^(  |\t)/, ''));
          i++;
        } else {
          break;
        }
      }
      const body = renderContinuation(cont);
      out.push(`<label class="task"><input type="checkbox" data-key="${key}" ${checked}><span class="task-text">${text}</span></label>${body}`);
      continue;
    }

    if (isListItem(line)) {
      const m = line.match(/^(\s*)-\s+(.*)$/);
      i++;
      const cont = [];
      while (i < lines.length) {
        const n = lines[i];
        if (isBlank(n)) { cont.push(''); i++; continue; }
        if (isListItem(n) || isHeader(n) || isHr(n) || isDetails(n) || isBlockquote(n) || isTable(n)) break;
        if (n.startsWith('  ') || n.startsWith('\t')) {
          cont.push(n.replace(/^(  |\t)/, ''));
          i++;
        } else break;
      }
      const body = renderContinuation(cont);
      out.push(`<div class="plain-li"><span class="bullet">•</span> <span>${inline(m[2])}</span></div>${body}`);
      continue;
    }

    // 有序列表 或 普通段落
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      out.push('<ol>' + items.map(l => `<li>${inline(l)}</li>`).join('') + '</ol>');
      continue;
    }

    const paras = [];
    while (i < lines.length && !isBlank(lines[i]) && !isHeader(lines[i]) && !isHr(lines[i]) && !isDetails(lines[i]) && !isBlockquote(lines[i]) && !isTable(lines[i]) && !isListItem(lines[i]) && !/^\d+\.\s+/.test(lines[i])) {
      paras.push(lines[i]);
      i++;
    }
    out.push('<p>' + paras.map(inline).join('<br>') + '</p>');
  }

  return out.join('\n');
}

function wrap(title, bodyHtml, relPath) {
  const safeRel = JSON.stringify(relPath);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} · 可勾选清单</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Microsoft YaHei", "微软雅黑", sans-serif; background: #f7f9fc; color: #333; padding: 24px; line-height: 1.7; }
  .wrap { max-width: 820px; margin: 0 auto; background: #fff; padding: 32px 36px; border-radius: 10px; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
  h1 { font-size: 22px; color: #185FA5; margin-bottom: 8px; }
  h2 { font-size: 18px; color: #185FA5; margin: 22px 0 10px; border-left: 4px solid #185FA5; padding-left: 10px; }
  h3 { font-size: 15px; color: #185FA5; margin: 16px 0 8px; }
  h4 { font-size: 14px; color: #185FA5; margin: 14px 0 6px; }
  blockquote { background: #f4f8fc; border-left: 4px solid #185FA5; padding: 10px 14px; margin: 10px 0; color: #444; font-size: 13.5px; }
  p, .plain-li { margin: 8px 0; font-size: 14px; }
  .plain-li { display: flex; gap: 6px; }
  .bullet { color: #185FA5; font-weight: bold; }
  .task { display: flex; align-items: flex-start; gap: 8px; margin: 8px 0; cursor: pointer; user-select: none; }
  .task input[type="checkbox"] { width: 16px; height: 16px; margin-top: 4px; flex-shrink: 0; accent-color: #185FA5; cursor: pointer; }
  .task-text { font-size: 14px; transition: opacity .2s; }
  .task input:checked + .task-text { text-decoration: line-through; opacity: .45; color: #666; }
  .item-body { margin: 4px 0 12px 24px; }
  .item-body p { margin: 4px 0; color: #555; font-size: 13.5px; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
  th, td { border: 1px solid #d9e2ec; padding: 7px 10px; }
  th { background: #eef4fb; color: #185FA5; font-weight: 600; }
  td { background: #fff; }
  ol { margin: 8px 0 8px 22px; font-size: 14px; }
  li { margin: 4px 0; }
  code { background: #f0f3f7; padding: 1px 4px; border-radius: 3px; font-family: Consolas, monospace; font-size: 12px; }
  a { color: #185FA5; text-decoration: none; }
  a:hover { text-decoration: underline; }
  summary { cursor: pointer; color: #185FA5; font-weight: 600; }
  details { background: #f9fbfd; border: 1px solid #e3eaf2; border-radius: 6px; padding: 10px 14px; margin: 12px 0; }
  .progress { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #e3eaf2; padding: 8px 0; margin: -32px -36px 20px; padding-left: 36px; padding-right: 36px; font-size: 12px; color: #666; z-index: 10; }
  .progress b { color: #185FA5; }
</style>
</head>
<body>
<div class="wrap">
  <div class="progress" id="progress">已完成：0 / 0</div>
  ${bodyHtml}
</div>
<script>
(function(){
  const REL = ${safeRel};
  const STORE_KEY = 'checklist:' + REL;

  // 一次性加载整个文件的勾选状态（JSON），避免 key 过长
  let store = {};
  try { store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) {}

  // 兼容迁移：旧的错误 key（包含重复 REL 前缀的）自动迁到新格式
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('checklist:')) continue;
    // 检测旧 bug key：包含 REL 两次
    if (k.indexOf(REL) !== k.lastIndexOf(REL)) {
      const v = localStorage.getItem(k);
      const m = k.match(/:L(\\d+)$/);
      if (m && v === '1') store['L' + m[1]] = true;
      localStorage.removeItem(k);
    }
  }

  const boxes = document.querySelectorAll('.task input[type="checkbox"]');
  boxes.forEach(box => {
    const k = box.dataset.key;
    if (store[k]) box.checked = true;
    box.addEventListener('change', () => {
      store[k] = box.checked;
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
      } catch (e) {
        console.error('localStorage 写入失败：', e);
      }
      updateProgress();
    });
  });

  function updateProgress() {
    const total = boxes.length;
    const done = Array.from(boxes).filter(b => b.checked).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    document.getElementById('progress').innerHTML = '已完成：<b>' + done + ' / ' + total + '</b>（' + pct + '%）';
  }
  updateProgress();
})();
</script>
</body>
</html>`;
}

if (process.argv.length < 4) {
  console.log('用法：node md2checklist.js <输入.md> <输出.html> [仓库相对路径]');
  process.exit(1);
}

const input = process.argv[2];
const output = process.argv[3];
const relPath = process.argv[4] || path.basename(input);
const md = fs.readFileSync(input, 'utf8');
const titleMatch = md.match(/^#\s+(.+)$/m);
const title = titleMatch ? titleMatch[1] : path.basename(input, '.md');
const body = parse(md, relPath);
const html = wrap(title, body, relPath);
fs.writeFileSync(output, html, 'utf8');
console.log('已生成：' + output);

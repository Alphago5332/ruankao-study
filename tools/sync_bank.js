/**
 * sync_bank.js — 从 08_答题系统/index.html 的内嵌 QUESTION_BANK 反向生成 题库.json
 * 目的：保证「HTML 内嵌题库」与「题库.json」逐字段一致（HTML 为唯一真源）。
 * 用法：node tools/sync_bank.js
 * 约定：HTML 中形如 `const QUESTION_BANK = { ... };`，第一层键为章节（"1.1"…）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, '08_答题系统', 'index.html');
const JSON_OUT = path.join(ROOT, '08_答题系统', '题库.json');

const html = fs.readFileSync(HTML, 'utf8');
const m = html.match(/const QUESTION_BANK = (\{[\s\S]*?\n    \});/);
if (!m) { console.error('❌ 未能在 index.html 中定位 QUESTION_BANK'); process.exit(1); }

// 用 Function 求值（本地可信文件），返回纯数据
const bank = new Function('return ' + m[1])();

const meta = {
  _说明: '填空题题库 v3（2026-09-14）。与 index.html 内嵌 QUESTION_BANK 逐字段同步（以 HTML 为真源，由 tools/sync_bank.js 反向生成）。check 字段 = [清单相对路径, 勾选键]，答对后自动同步勾选到对应可勾选清单。',
  _题型约定: {
    blanks: '数组：每个空一个答案（按顺序），多候选用 | 分隔',
    check: '答对后自动勾选的知识点清单条目 [相对路径, data-key]。data-key = 条目标题编号（如 B3 即「**B3 · …**」那一条）；1.1/1.2 早期清单仍为行号键 L##',
    source: '出处（指向对应 1.x_知识点清单 的条目）',
    difficulty: '必考 / 必背 / 高频 / 了解'
  }
};

const out = { ...meta, ...bank };
fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');

const lines = Object.entries(bank).map(([k, v]) => `  ${k}: ${v.length} 题`);
console.log('✅ 已生成 ' + path.relative(ROOT, JSON_OUT));
console.log(lines.join('\n'));
console.log('  合计 ' + Object.values(bank).reduce((s, a) => s + a.length, 0) + ' 题');

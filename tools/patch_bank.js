#!/usr/bin/env node
/**
 * patch_bank.js — 按 id 替换 08_答题系统/index.html 中 QUESTION_BANK 的题目行
 *
 * 用法：
 *   node tools/patch_bank.js tools/patches/<patchFile>.js
 *
 * patchFile 导出 `[ [旧id, 新整行文本], ... ]`（也接受 { id, line } 对象数组、或 { 旧id: 新行 } 对象）。
 * 新整行文本要**自带缩进**（题库里是 8 个空格）。
 *
 * 为什么用脚本改而不是直接 Edit：
 *   1. 桌面端会用旧缓冲区回写文件，同一文件多点 Edit 可能被回滚 → 一次读-改-写最稳
 *   2. 题目是「一行一题」，整行替换不会碰到别的字符
 *   3. 顺手做自检：id 必须命中且只命中 1 次、行尾逗号必须与所在数组位置一致
 *
 * 退出码：0 全部命中；1 参数/文件问题；2 有 id 未命中或有重复
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, '08_答题系统', 'index.html');

const patchPath = process.argv[2];
if (!patchPath) {
  console.error('用法: node tools/patch_bank.js tools/patches/<patchFile>.js');
  process.exit(1);
}

let patch = require(path.resolve(patchPath));
if (patch && patch.default) patch = patch.default;
let pairs;
if (Array.isArray(patch)) {
  pairs = patch.map((p) => (Array.isArray(p) ? [p[0], p[1]] : [p.id, p.line]));
} else {
  pairs = Object.entries(patch);
}

const html = fs.readFileSync(TARGET, 'utf8');
const eol = /\r\n/.test(html) ? '\r\n' : '\n';
const lines = html.split(/\r?\n/);

let failed = false;
let changed = 0;

for (const [oldId, newLine] of pairs) {
  const needle = new RegExp('\\{\\s*id:\\s*"' + oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"\\s*,');
  const hits = [];
  lines.forEach((l, i) => {
    if (needle.test(l)) hits.push(i);
  });

  if (hits.length === 0) {
    console.error(`  ✗ 未命中: ${oldId}`);
    failed = true;
    continue;
  }
  if (hits.length > 1) {
    console.error(`  ✗ 命中 ${hits.length} 次（id 不唯一）: ${oldId}`);
    failed = true;
    continue;
  }

  const i = hits[0];
  const oldLine = lines[i];

  // 校验行尾逗号：数组最后一个元素不带逗号，其余带
  // 注意：数组的收尾行是 `      ],`（末尾带逗号，因为后面还有下一个节的 key），
  // 所以判定要用 /^\s*\],?\s*$/，不能用 /\]\s*$/ —— 后者永远不匹配，会导致全部误报
  const isLastInArray = /^\s*\][,]?\s*$/.test(lines[i + 1] || '');
  const newHasComma = /,\s*$/.test(newLine);
  const newIsLast = !newHasComma;
  if (isLastInArray !== newIsLast) {
    console.error(
      `  ✗ 行尾逗号不匹配: ${oldId} → 该行${isLastInArray ? '是' : '不是'}数组末元素，` +
        `新行${newHasComma ? '带' : '不带'}逗号`
    );
    failed = true;
    continue;
  }

  lines[i] = newLine;
  changed++;
  console.log(`  ✓ ${oldId} → ${(newLine.match(/id:\s*"([^"]+)"/) || [])[1] || '?'}`);
  void oldLine;
}

if (failed) {
  console.error('\n❗ 有未命中/异常项，未写回文件（保持原样）');
  process.exit(2);
}

fs.writeFileSync(TARGET, lines.join(eol), 'utf8');
console.log(`\n✅ 已替换 ${changed} 行 → 08_答题系统/index.html`);

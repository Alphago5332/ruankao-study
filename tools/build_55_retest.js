// 基于 4.3 整章重测外壳生成 5.5 整章重测（第 5 章，50 题）
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");

const SKIN = path.join(ROOT, "01_教材笔记/第04章_信息系统管理/4.3_本章练习/4.3_整章串联重测.html");
const OUT = path.join(ROOT, "01_教材笔记/第05章_信息系统工程/5.5_本章练习/5.5_整章串联重测.html");
const QFILE = path.join(ROOT, "tools/55_questions.txt");

let t = fs.readFileSync(SKIN, "utf8");
const eol = t.includes("\r\n") ? "\r\n" : "\n";
const qblock = fs.readFileSync(QFILE, "utf8").replace(/\s+$/, "");

function must(oldStr, newStr, label) {
  if (!t.includes(oldStr)) throw new Error("找不到替换锚点：" + label);
  t = t.replace(oldStr, newStr);
}

must(
  "<title>4.3 本章练习 · 第 4 章整章串联重测 38 题</title>",
  "<title>5.5 本章练习 · 第 5 章整章串联重测 50 题</title>",
  "title"
);
must(
  "<h1>4.3 本章练习 · 第 4 章整章串联重测</h1>",
  "<h1>5.5 本章练习 · 第 5 章整章串联重测</h1>",
  "h1"
);
must(
  '<p class="sub">38 题 · 第 4 版教材 4.3 节 · 达标线 31/38（80%）· 逐题精讲 · 键盘 A~D 或 1~4 选择，Enter 下一题</p>',
  '<p class="sub">50 题 · 第 4 版教材 5.5 节 · 达标线 40/50（80%）· 逐题精讲 · 键盘 A~D 或 1~4 选择，Enter 下一题</p>',
  "sub"
);
must(
  '<span id="totalNow">38</span>',
  '<span id="totalNow">50</span>',
  "totalNow"
);
must(
  '<p class="kbd" style="margin:4px 2px 0;">对照资料：《4.1_知识点清单.md》+《4.2_知识点清单.md》· 教材出处：《信息系统项目管理师教程（第4版）》P93~P128 · ⚠ 第 4 章为第 4 版新增章，2023 上及以前旧真题无对应题 · 做完把得分登记到章级「打卡进度.md」的章末验收表</p>',
  '<p class="kbd" style="margin:4px 2px 0;">对照资料：《5.1_知识点清单.md》~《5.4_知识点清单.md》· 教材出处：《信息系统项目管理师教程（第4版）》P129~P181 · 第 5 章与第 3 版第 3 章同源，2023 下及以后真题有对应题可刷 · 做完把得分登记到章级「打卡进度.md」的章末验收表</p>',
  "对照资料行"
);

// 替换题目数组
const arrRe = /^const QUESTIONS = \[[\s\S]*?^\];$/m;
if (!arrRe.test(t)) throw new Error("找不到 QUESTIONS 数组块");
t = t.replace(arrRe, qblock.replace(/\n/g, eol));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, t, "utf8");
console.log("已写出：" + path.relative(ROOT, OUT));
console.log("题数（m 字段计数）：" + (qblock.match(/\{m:/g) || []).length);

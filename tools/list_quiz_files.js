// 列出仓库内所有含「选择题数组」的 HTML（自测题 / 整章重测 / 本章练习），并给出答案位置分布
// 用法: node tools/list_quiz_files.js [--dir 01_教材笔记]
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const dirArgIdx = process.argv.indexOf("--dir");
const SCAN = path.join(ROOT, dirArgIdx >= 0 ? process.argv[dirArgIdx + 1] : ".");

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === ".git" || e.name === "node_modules" || e.name === ".workbuddy") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.html$/.test(e.name)) out.push(p);
  }
  return out;
}

function locate(lines) {
  let name = null, s = -1, e = -1;
  for (let i = 0; i < lines.length; i++) {
    if (s < 0) {
      const m = lines[i].match(/^const\s+(\w+)\s*=\s*\[$/);
      if (m) { name = m[1]; s = i; }
    } else if (e < 0 && /^\];$/.test(lines[i])) {
      const seg = lines.slice(s, i + 1).join("\n");
      if (/\bm\s*:/.test(seg)) e = i; else { s = -1; name = null; }
    }
  }
  return { name, s, e };
}

const LET = ["A", "B", "C", "D"];
let k = 0;
for (const f of walk(SCAN, [])) {
  const raw = fs.readFileSync(f, "utf8");
  const lines = raw.split(/\r?\n/);
  const { name, s, e } = locate(lines);
  if (s < 0) continue;
  let arr, err = null;
  try {
    const body = lines.slice(s, e + 1).join("\n").replace(/^const\s+\w+\s*=\s*/, "").replace(/;\s*$/, "");
    arr = new Function("return (" + body + ");")();
  } catch (ex) { err = ex.message; }
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (err || !Array.isArray(arr)) { console.log("[解析失败] " + rel + "  " + err); continue; }
  const hasOA = arr.every((q) => Array.isArray(q.o) && q.o.length === 4 && typeof q.a === "number");
  if (!hasOA) { console.log("[非4选项] n=" + arr.length + "  变量=" + name + "  " + rel); continue; }
  const cnt = [0, 0, 0, 0];
  arr.forEach((q) => cnt[q.a]++);
  k++;
  console.log("[4选项] n=" + arr.length + "  A/B/C/D=" + cnt.join("/") + "  变量=" + name + "  " + rel);
}
console.log("\n共 " + k + " 个含 4 选项选择题数组的文件。");

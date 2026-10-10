// 统计各节自测题正确答案位置分布，检查是否存在「答案偏向某选项」的倾向
// 用法: node tools/audit_answer_pos.js [文件...]  (缺省则扫描 01_教材笔记 下全部 考点自测题.html)
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LET = ["A", "B", "C", "D"];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/考点自测题\.html$/.test(e.name)) out.push(p);
  }
  return out;
}

function extract(file) {
  const raw = fs.readFileSync(file, "utf8");
  const lines = raw.split(/\r?\n/);
  let name = null, s = -1, e = -1;
  for (let i = 0; i < lines.length; i++) {
    if (s < 0) {
      const m = lines[i].match(/^const\s+(\w+)\s*=\s*\[$/);
      if (m) { name = m[1]; s = i; }
    } else if (e < 0 && /^\];$/.test(lines[i])) {
      // 取「含 m: 字段的数组」为准
      const seg = lines.slice(s, i + 1).join("\n");
      if (/\bm\s*:/.test(seg)) e = i;
      else { s = -1; name = null; }
    }
  }
  if (s < 0 || e < 0) throw new Error("找不到题目数组: " + file);
  const arrText = lines.slice(s, e + 1).join("\n");
  const body = arrText.replace(/^const\s+\w+\s*=\s*/, "").replace(/;\s*$/, "");
  const arr = new Function("return (" + body + ");")();
  return arr;
}

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const targets = files.length
  ? files.map((f) => path.resolve(f))
  : walk(path.join(ROOT, "01_教材笔记"), []);

let gTot = 0;
const gCnt = [0, 0, 0, 0];

for (const f of targets) {
  const arr = extract(f);
  const cnt = [0, 0, 0, 0];
  const seq = [];
  arr.forEach((q) => {
    cnt[q.a]++;
    seq.push(LET[q.a]);
    if (typeof q.a !== "number" || q.a < 0 || q.a > 3) {
      console.log("[BAD] " + f + " 题 a 越界: " + JSON.stringify(q.a));
    }
  });
  const n = arr.length;
  gTot += n;
  cnt.forEach((c, i) => (gCnt[i] += c));
  const pct = cnt.map((c) => Math.round((c / n) * 100));
  const max = Math.max(...cnt);
  const flag = max / n > 0.4 ? "  ⚠️偏重" : "";
  // 最长连续同选项
  let run = 1, runMax = 1;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] === seq[i - 1]) { run++; runMax = Math.max(runMax, run); } else run = 1;
  }
  const name = f.replace(/\\/g, "/").split("/01_教材笔记/")[1] || f;
  console.log(
    name.padEnd(46) +
    " n=" + String(n).padStart(2) +
    "  A/B/C/D = " + cnt.join("/") +
    "  (" + pct.join("/") + "%)" +
    "  最长连续同选项=" + runMax + flag
  );
  console.log("     序列: " + seq.join(""));
}

const pctAll = gCnt.map((c) => Math.round((c / gTot) * 100));
console.log("\n合计 n=" + gTot + "  A/B/C/D = " + gCnt.join("/") + "  (" + pctAll.join("/") + "%)");
console.log("理想分布：各约 25%。偏差超过 ±10pp 视为需要重排。");

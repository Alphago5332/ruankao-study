// 重排自测题选项顺序，消除「答案集中在某选项」的倾向，同时保持答案内容不变。
// 用法:
//   node tools/shuffle_answer_pos.js <file...>            # dry-run 打印前后分布
//   node tools/shuffle_answer_pos.js --write <file...>    # 落盘
//   node tools/shuffle_answer_pos.js --seed 20261010 ...  # 固定随机种子（默认 1）
//
// 规则:
//   1. 每题正确答案被分配到目标位置，其余选项按原相对顺序填充剩余槽位 —— 选项内容一字不改，只换位置
//   2. 位置配额尽量均衡（n=22 → 6/6/5/5），且不允许同一位置连续出现 3 次以上
//   3. 优先让答案位置发生变化（不出现「原题在哪就还在哪」）
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const WRITE = process.argv.includes("--write");
const argv = process.argv.slice(2).filter((a) => a !== "--write");
let SEED = 1;
const si = argv.indexOf("--seed");
if (si >= 0) { SEED = parseInt(argv[si + 1], 10) || 1; argv.splice(si, 2); }

let seedState = SEED >>> 0;
function rnd() { // mulberry32
  seedState = (seedState + 0x6D2B79F5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

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
  // 无 4 选项题目数组（如答题系统填空题）时返回空结果，由调用方跳过
  if (s >= 0 && e >= 0) {
    const body = lines.slice(s, e + 1).join("\n").replace(/^const\s+\w+\s*=\s*/, "").replace(/;\s*$/, "");
    let arr = null;
    try { arr = new Function("return (" + body + ");")(); } catch (ex) { arr = null; }
    const isQuiz = Array.isArray(arr) && arr.length > 0 &&
      arr.every((q) => Array.isArray(q.o) && q.o.length === 4 && typeof q.a === "number");
    if (!isQuiz) return { name: null, s: -1, e: -1 };
  }
  return { name, s, e };
}

// 交换后是否引入新的三连
function createsRun(seq, i, j) {
  const s = seq.slice();
  [s[i], s[j]] = [s[j], s[i]];
  for (const k of [i, j]) {
    for (let t = Math.max(0, k - 2); t <= Math.min(s.length - 3, k); t++) {
      if (s[t] === s[t + 1] && s[t] === s[t + 2]) return true;
    }
  }
  return false;
}

// 生成均衡且无三连的目标位置序列：随机洗牌 → 交换修复
function planPositions(n) {
  const pool = [];
  const base = Math.floor(n / 4), extra = n % 4;
  for (let p = 0; p < 4; p++) {
    const c = base + (p < extra ? 1 : 0);
    for (let k = 0; k < c; k++) pool.push(p);
  }
  for (let attempt = 0; attempt < 200; attempt++) {
    const seq = pool.slice();
    for (let i = seq.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [seq[i], seq[j]] = [seq[j], seq[i]];
    }
    let ok = true;
    for (let iter = 0; iter < 5000; iter++) {
      let bad = -1;
      for (let i = 2; i < seq.length; i++) {
        if (seq[i] === seq[i - 1] && seq[i] === seq[i - 2]) { bad = i; break; }
      }
      if (bad < 0) break;
      let swapped = false;
      for (let t = 0; t < 300; t++) {
        const j = Math.floor(rnd() * seq.length);
        if (j === bad || seq[j] === seq[bad]) continue;
        if (createsRun(seq, bad, j)) continue;
        [seq[bad], seq[j]] = [seq[j], seq[bad]];
        swapped = true;
        break;
      }
      if (!swapped) { ok = false; break; }
    }
    if (!ok) continue;
    let bad = false;
    for (let i = 2; i < seq.length; i++) {
      if (seq[i] === seq[i - 1] && seq[i] === seq[i - 2]) { bad = true; break; }
    }
    if (!bad) return seq;
  }
  throw new Error("无法生成满足约束的位置序列");
}

function shuffleFile(file) {
  const raw = fs.readFileSync(file, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);
  const { name, s, e } = locate(lines);
  if (s < 0 || e < 0) return null; // 不是 4 选项选择题文件，跳过

  const arrText = lines.slice(s, e + 1).join("\n");
  const body = arrText.replace(/^const\s+\w+\s*=\s*/, "").replace(/;\s*$/, "");
  const arr = new Function("return (" + body + ");")();

  const before = [0, 0, 0, 0];
  const beforeSeq = [];
  arr.forEach((q) => {
    if (!Array.isArray(q.o) || q.o.length !== 4 || typeof q.a !== "number" || q.a < 0 || q.a > 3) {
      throw new Error(file + " 题目结构异常（o 必须 4 项、a 必须 0~3）");
    }
    before[q.a]++;
    beforeSeq.push(q.a);
  });

  const plan = planPositions(arr.length);
  let changed = 0;
  const arr2 = arr.map((q, i) => {
    const target = plan[i];
    const correct = q.o[q.a];
    const rest = q.o.filter((_, k) => k !== q.a);
    const o = new Array(4);
    o[target] = correct;
    let j = 0;
    for (let k = 0; k < 4; k++) if (k !== target) o[k] = rest[j++];
    if (target !== q.a) changed++;
    return { m: q.m, q: q.q, o, a: target, e: q.e };
  });

  // 重建数组文本（统一格式，语义不变）
  const body2 = arr2
    .map((q) => `{m:${JSON.stringify(q.m)},\n q:${JSON.stringify(q.q)},\n o:${JSON.stringify(q.o)},a:${q.a},\n e:${JSON.stringify(q.e)}}`)
    .join(",\n\n");
  const arrNew = `const ${name} = [\n${body2}\n];`;

  const outLines = lines.slice(0, s).concat(arrNew.split("\n")).concat(lines.slice(e + 1));
  const final = outLines.join(eol === "\r\n" ? "\r\n" : "\n");

  // 回读校验：新文件必须能解析出同样的题数、同样的选项集合、同样的正确答案文本
  const backLines = final.split(/\r?\n/);
  const b2 = locate(backLines);
  const backText = backLines.slice(b2.s, b2.e + 1).join("\n");
  const backArr = new Function("return (" + backText.replace(/^const\s+\w+\s*=\s*/, "").replace(/;\s*$/, "") + ");")();
  if (backArr.length !== arr.length) throw new Error(file + " 回读题数不一致");
  backArr.forEach((q, i) => {
    const orig = arr[i];
    const sameQ = q.q === orig.q;
    const sameAns = q.o[q.a] === orig.o[orig.a];
    const sameSet = [...q.o].sort().join("\u0001") === [...orig.o].sort().join("\u0001");
    if (!sameQ || !sameAns || !sameSet) {
      throw new Error(file + " 第 " + (i + 1) + " 题回读校验失败（题干/选项集合/答案文本）");
    }
  });

  const after = [0, 0, 0, 0];
  const afterSeq = [];
  backArr.forEach((q) => { after[q.a]++; afterSeq.push(q.a); });
  let runMax = 1, run = 1;
  for (let i = 1; i < afterSeq.length; i++) {
    if (afterSeq[i] === afterSeq[i - 1]) { run++; runMax = Math.max(runMax, run); } else run = 1;
  }

  return { file, n: arr.length, before, after, changed, runMax, final, write: WRITE };
}

const files = argv.length ? argv.map((f) => path.resolve(f)) : walk(path.join(ROOT, "01_教材笔记"), []);
let sumBefore = [0, 0, 0, 0], sumAfter = [0, 0, 0, 0], tot = 0, skipped = 0;
for (const f of files) {
  const r = shuffleFile(f);
  if (!r) { skipped++; continue; }
  tot += r.n;
  r.before.forEach((c, i) => (sumBefore[i] += c));
  r.after.forEach((c, i) => (sumAfter[i] += c));
  const nm = r.file.replace(/\\/g, "/").split("/01_教材笔记/")[1];
  console.log(
    (WRITE ? "[WRITE] " : "[DRY]  ") + nm + "  n=" + r.n +
    "\n     前: " + r.before.join("/") +
    "   后: " + r.after.join("/") +
    "   位置变化 " + r.changed + "/" + r.n + "   最长连续同位置=" + r.runMax
  );
  if (WRITE) fs.writeFileSync(f, r.final, "utf8");
}
console.log("\n合计 n=" + tot + "  前: " + sumBefore.join("/") + "   后: " + sumAfter.join("/") + "（跳过非选择题文件 " + skipped + " 个）");
console.log(WRITE ? "写入完成。" : "dry-run（加 --write 落盘）");

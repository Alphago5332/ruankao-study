// 检测重排选项的风险点：选项文本自引用字母位置、解析语句引用选项字母
// 用法: node tools/probe_opt_letters.js
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

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
      const seg = lines.slice(s, i + 1).join("\n");
      if (/\bm\s*:/.test(seg)) e = i; else { s = -1; name = null; }
    }
  }
  const arrText = lines.slice(s, e + 1).join("\n");
  const body = arrText.replace(/^const\s+\w+\s*=\s*/, "").replace(/;\s*$/, "");
  return new Function("return (" + body + ");")();
}

// 选项文本里引用字母位置：如 "A 和 B"、"A、B"、"选项A"、"(A)"
const OPT_REF = /(^|[^A-Za-z])([A-D])(\s*(和|与|、|\/|,|，)\s*([A-D]))+|选项\s*[A-D]|^[A-D][\s.、]/;
const EXP_REF = /选项\s*[A-D]|答案是\s*[A-D]|[选答][ABD]\s*项|正确选项\s*[A-D]/;

let totalOptRef = 0, totalExpRef = 0;
for (const f of walk(path.join(ROOT, "01_教材笔记"), [])) {
  const arr = extract(f);
  const name = f.replace(/\\/g, "/").split("/01_教材笔记/")[1];
  const hits = [];
  arr.forEach((q, i) => {
    const oref = q.o.filter((t) => OPT_REF.test(String(t).replace(/<[^>]+>/g, "")));
    const eref = EXP_REF.test(String(q.e || ""));
    if (oref.length || eref) {
      hits.push(
        "  Q" + (i + 1) +
        (oref.length ? " [选项自引用] " + JSON.stringify(oref) : "") +
        (eref ? " [解析引用字母] " + String(q.e).slice(0, 60) : "")
      );
      totalOptRef += oref.length;
      totalExpRef += eref ? 1 : 0;
    }
  });
  if (hits.length) {
    console.log(name);
    hits.forEach((h) => console.log(h));
    console.log("");
  }
}
console.log("汇总：选项自引用 " + totalOptRef + " 处，解析引用字母 " + totalExpRef + " 处");

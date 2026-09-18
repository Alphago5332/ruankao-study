const fs = require("fs");
const crypto = require("crypto");

const WRITE = process.argv.includes("--write");
const files = process.argv.slice(2).filter((a) => a !== "--write");

const CSS = `  *{box-sizing:border-box;}
  body{
    margin:0;padding:24px 14px 60px;background:#eef0f3;color:#1f2328;
    font-family:"Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif;
  }
  .wrap{max-width:820px;margin:0 auto;}
  header{
    display:flex;justify-content:space-between;align-items:flex-end;
    gap:14px;margin-bottom:18px;flex-wrap:wrap;
  }
  h1{font-size:20px;margin:0;font-weight:600;}
  .sub{font-size:12.5px;color:#6b7280;margin:5px 0 0;}
  .score-chip{
    background:#E6F1FB;border:1px solid #B5D4F4;color:#0C447C;
    border-radius:8px;padding:7px 13px;font-size:13px;white-space:nowrap;
  }
  .score-chip b{font-size:16px;font-weight:600;}

  #quiz{
    background:#fff;border-radius:12px;padding:22px 24px;
    box-shadow:0 2px 12px rgba(16,24,40,.08);
  }
  .progress-row{
    display:flex;justify-content:space-between;align-items:center;
    margin-bottom:8px;font-size:13px;color:#4b5563;
  }
  .chip{
    background:#FAEEDA;border:1px solid #EFC98A;color:#633806;
    border-radius:5px;padding:2px 9px;font-size:12px;
  }
  .progress{height:6px;background:#e5e8ee;border-radius:4px;overflow:hidden;margin-bottom:20px;}
  #bar{height:100%;width:0;background:#185FA5;border-radius:4px;transition:width .25s;}

  .qtext{font-size:16px;line-height:1.75;font-weight:500;margin:0 0 18px;}
  .opt{
    display:flex;gap:10px;align-items:flex-start;
    border:1px solid #d9dee5;border-radius:9px;padding:11px 14px;
    margin-bottom:10px;cursor:pointer;font-size:14.5px;line-height:1.6;
    background:#fff;transition:border-color .12s,background .12s;
  }
  .opt:hover{border-color:#185FA5;background:#f7fafd;}
  .opt .tag{
    flex:0 0 22px;height:22px;border-radius:50%;
    background:#eef1f5;color:#3b4552;font-size:12px;font-weight:600;
    display:flex;align-items:center;justify-content:center;margin-top:2px;
  }
  .opt.correct{border-color:#0F6E56;background:#E1F5EE;}
  .opt.correct .tag{background:#0F6E56;color:#fff;}
  .opt.wrong{border-color:#A32D2D;background:#FCEBEB;}
  .opt.wrong .tag{background:#A32D2D;color:#fff;}
  .opt.dim{opacity:.55;cursor:default;}
  .opt.correct.dim{opacity:1;}
  .opt.locked{cursor:default;}

  #feedback{margin-top:14px;border-radius:9px;overflow:hidden;border:1px solid #d9dee5;}
  #verdict{
    padding:10px 14px;font-size:14px;font-weight:600;
    background:#E1F5EE;color:#085041;border-bottom:1px solid #cbe9da;
  }
  #verdict.bad{background:#FCEBEB;color:#501313;border-bottom:1px solid #f3cdcd;}
  #explain{padding:12px 14px;font-size:13.5px;line-height:1.8;color:#374151;background:#fdfdfe;}
  #explain b{color:#1f2328;}
  #nextBtn{
    display:block;margin:14px 16px 16px;float:right;
    background:#185FA5;color:#fff;border:none;border-radius:8px;
    padding:9px 26px;font-size:14px;cursor:pointer;font-family:inherit;
  }
  #nextBtn:hover{background:#14507f;}
  #feedback::after{content:"";display:block;clear:both;}
  .kbd{font-size:11.5px;color:#9aa3af;margin:14px 2px 0;}

  #result{background:#fff;border-radius:12px;padding:26px 28px;box-shadow:0 2px 12px rgba(16,24,40,.08);}
  .r-head{display:flex;gap:22px;align-items:center;margin-bottom:6px;flex-wrap:wrap;}
  .r-score{font-size:44px;font-weight:600;color:#185FA5;line-height:1;}
  .r-score small{font-size:18px;color:#8b949e;font-weight:400;}
  .r-msg{font-size:14px;color:#4b5563;line-height:1.7;}
  h3{font-size:15px;font-weight:600;margin:26px 0 10px;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th,td{border:1px solid #e2e6eb;padding:7px 10px;text-align:left;line-height:1.6;}
  th{background:#f6f8fa;font-weight:600;color:#2b323b;}
  .mbar{height:8px;background:#e5e8ee;border-radius:4px;overflow:hidden;min-width:120px;}
  .mbar div{height:100%;background:#1D9E75;border-radius:4px;}

  .wq{
    border:1px solid #f3cdcd;border-radius:9px;padding:13px 15px;
    margin-bottom:12px;background:#fffafa;
  }
  .wq .wt{font-size:14px;font-weight:600;line-height:1.7;margin-bottom:7px;}
  .wq .wa{font-size:13px;color:#A32D2D;margin-bottom:2px;}
  .wq .wc{font-size:13px;color:#0F6E56;margin-bottom:8px;}
  .wq .we{font-size:12.5px;color:#57606a;line-height:1.75;border-top:1px dashed #e8d9d9;padding-top:7px;}

  .btns{display:flex;gap:10px;margin-top:22px;flex-wrap:wrap;}
  .btn{
    border:1px solid #c6ccd4;background:#fff;color:#2b323b;border-radius:8px;
    padding:9px 22px;font-size:14px;cursor:pointer;font-family:inherit;
  }
  .btn:hover{background:#f6f8fa;}
  .btn.primary{background:#185FA5;border-color:#185FA5;color:#fff;}
  .btn.primary:hover{background:#14507f;}
  .btn:disabled{opacity:.45;cursor:not-allowed;}
  .hidden{display:none;}`;

const LOGIC = `const LETTERS = ["A","B","C","D"];
let pool = [], cur = 0, answered = false, stats = {}, wrongList = [];

function init(list){
  pool = list.map(x=>Object.assign({},x));
  cur = 0; answered = false; stats = {}; wrongList = [];
  document.getElementById("result").classList.add("hidden");
  document.getElementById("quiz").classList.remove("hidden");
  document.getElementById("totalNow").textContent = pool.length;
  document.getElementById("scoreNow").textContent = "0";
  render();
}
function render(){
  const q = pool[cur];
  document.getElementById("pos").textContent = "第 " + (cur+1) + " / " + pool.length + " 题";
  document.getElementById("moduleChip").textContent = q.m;
  document.getElementById("bar").style.width = (cur/pool.length*100) + "%";
  document.getElementById("qtext").innerHTML = q.q;
  const box = document.getElementById("options");
  box.innerHTML = "";
  q.o.forEach((t,i)=>{
    const d = document.createElement("div");
    d.className = "opt";
    d.innerHTML = '<span class="tag">'+LETTERS[i]+'</span><span>'+t+"</span>";
    d.onclick = ()=>choose(i);
    box.appendChild(d);
  });
  document.getElementById("feedback").classList.add("hidden");
}
function choose(i){
  if(answered) return;
  answered = true;
  const q = pool[cur];
  const ok = (i === q.a);
  if(!stats[q.m]) stats[q.m] = {right:0,total:0};
  stats[q.m].total++;
  const opts = document.querySelectorAll(".opt");
  opts.forEach((d,idx)=>{
    d.classList.add("locked");
    if(idx === q.a) d.classList.add("correct");
    else if(idx === i) d.classList.add("wrong");
    else d.classList.add("dim");
    d.onclick = null;
  });
  if(ok){
    stats[q.m].right++;
    document.getElementById("scoreNow").textContent = sumRight();
  } else {
    wrongList.push({q:q, picked:i});
  }
  const v = document.getElementById("verdict");
  v.textContent = ok ? "✓ 答对了" : "✗ 答错了　正确答案：" + LETTERS[q.a];
  v.className = ok ? "" : "bad";
  document.getElementById("explain").innerHTML = q.e;
  document.getElementById("feedback").classList.remove("hidden");
  document.getElementById("nextBtn").textContent =
    (cur === pool.length-1) ? "查看成绩单 →" : "下一题 →";
}
function sumRight(){
  let s = 0; for(const k in stats) s += stats[k].right; return s;
}
function next(){
  cur++;
  if(cur >= pool.length){ showResult(); }
  else { answered = false; render(); window.scrollTo(0,0); }
}
function showResult(){
  document.getElementById("quiz").classList.add("hidden");
  const r = document.getElementById("result");
  const total = pool.length, right = sumRight();
  const pct = Math.round(right/total*100);
  let msg;
  if(pct >= 80) msg = "达标（≥80%）：本节知识点基本闭环，可以进入下一节，或用康奈尔模板的「遮」字诀再过一遍线索栏。";
  else if(pct >= 60) msg = "接近达标：把下面的错题解析看完，回看对应模块的知识点清单，明天用康奈尔模板遮住答案重测。";
  else msg = "未达标：正确率低是发现漏洞的正常信号——先把知识点清单的「必背」块过一遍，再点「只重做错题」。";

  let tbl = '<h3>分模块得分</h3><table><tr><th>模块</th><th>正确 / 题数</th><th>正确率</th></tr>';
  for(const k in stats){
    const s = stats[k];
    const p = Math.round(s.right/s.total*100);
    tbl += '<tr><td>'+k+'</td><td>'+s.right+' / '+s.total+'</td><td><div class="mbar"><div style="width:'+p+'%"></div></div></td></tr>';
  }
  tbl += "</table>";

  let wrong = "";
  if(wrongList.length){
    wrong = "<h3>错题回顾（"+wrongList.length+" 题）</h3>";
    wrongList.forEach((w,i)=>{
      wrong += '<div class="wq"><div class="wt">'+(i+1)+". "+w.q.q+"</div>"
        + '<div class="wa">你的选择：'+LETTERS[w.picked]+"　"+w.q.o[w.picked]+"</div>"
        + '<div class="wc">正确答案：'+LETTERS[w.q.a]+"　"+w.q.o[w.q.a]+"</div>"
        + '<div class="we">'+w.q.e+"</div></div>";
    });
  } else {
    wrong = '<h3>错题回顾</h3><p style="font-size:13px;color:#0F6E56;">全部答对，本节知识点已闭环。</p>';
  }

  r.innerHTML =
    '<div class="r-head"><div class="r-score">'+right+"<small> / "+total+"</small></div>"
    + '<div class="r-msg"><b>'+pct+"%</b><br>"+msg+"</div></div>"
    + tbl + wrong
    + '<div class="btns">'
    + '<button class="btn primary" id="retryWrong"'+(wrongList.length?"":" disabled")+">只重做错题（"+wrongList.length+" 题）</button>"
    + '<button class="btn" id="retryAll">全部重来</button></div>';
  r.classList.remove("hidden");
  document.getElementById("retryWrong").onclick = ()=>{
    const list = wrongList.map(w=>w.q);
    init(list);
    window.scrollTo(0,0);
  };
  document.getElementById("retryAll").onclick = ()=>{ init(QUESTIONS); window.scrollTo(0,0); };
  window.scrollTo(0,0);
}
document.getElementById("nextBtn").onclick = next;
document.addEventListener("keydown", e=>{
  if(document.getElementById("quiz").classList.contains("hidden")) return;
  if(e.key === "Enter" || e.key === " "){ if(answered){ e.preventDefault(); next(); } return; }
  const map = {"a":0,"b":1,"c":2,"d":3,"1":0,"2":1,"3":2,"4":3};
  const k = e.key.toLowerCase();
  if(k in map && !answered) choose(map[k]);
});
init(QUESTIONS);`;

function sha1(s) {
  return crypto.createHash("sha1").update(s, "utf8").digest("hex").slice(0, 10);
}

function build(file) {
  const raw = fs.readFileSync(file, "utf8");
  const eol = raw.includes("\r\n") ? "\r\n" : "\n";
  const lines = raw.split(/\r?\n/);

  let start = -1, end = -1;
  for (let i = 0; i < lines.length; i++) {
    if (start < 0 && /^const\s+QUESTIONS\s*=\s*\[$/.test(lines[i])) start = i;
    else if (start >= 0 && end < 0 && /^\];$/.test(lines[i])) end = i;
  }
  if (start < 0 || end < 0) throw new Error("无法定位 QUESTIONS 数组: " + file);

  const arrLines = lines.slice(start, end + 1);
  const arrText = arrLines.join("\n");
  const n = (arrText.match(/\bm\s*:/g) || []).length;
  if (!n) throw new Error("题目数为 0: " + file);

  const h1raw = ((raw.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1] || "")
    .replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const h1 = h1raw.replace(/[（(]\s*\d+\s*题\s*[）)]/g, "").trim();
  const sec = (h1.match(/^([\d.]+)/) || [, ""])[1];
  const pass = Math.ceil(n * 0.8);

  const srcMatch =
    raw.match(/<div class="kbd-tip"[^>]*>([\s\S]*?)<\/div>/) ||
    raw.match(/<p class="kbd-tip"[^>]*>([\s\S]*?)<\/p>/);
  const srcText = srcMatch ? srcMatch[1].replace(/\s+/g, " ").trim() : "";
  const srcHtml = srcText
    ? '\n    <p class="kbd" style="margin:4px 2px 0;">' + srcText + "</p>"
    : "";

  const sub =
    n + " 题 · 第 4 版教材 " + sec + " 节 · 达标线 " + pass + "/" + n +
    "（80%）· 逐题精讲 · 键盘 A~D 或 1~4 选择，Enter 下一题";
  const title = h1 + " " + n + " 题";

  const out = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${CSS}
</style>
</head>
<body>
<div class="wrap">

  <header>
    <div>
      <h1>${h1}</h1>
      <p class="sub">${sub}</p>
    </div>
    <div class="score-chip">已答对 <b id="scoreNow">0</b> / <span id="totalNow">${n}</span> 题</div>
  </header>

  <div id="quiz">
    <div class="progress-row">
      <span id="pos"></span>
      <span class="chip" id="moduleChip"></span>
    </div>
    <div class="progress"><div id="bar"></div></div>
    <div class="qcard">
      <p class="qtext" id="qtext"></p>
      <div id="options"></div>
      <div id="feedback" class="hidden">
        <div id="verdict"></div>
        <div id="explain"></div>
        <button id="nextBtn">下一题 →</button>
      </div>
    </div>
    <p class="kbd">键盘可用：A~D 或 1~4 选择，Enter 下一题</p>${srcHtml}
  </div>

  <div id="result" class="hidden"></div>

</div>

<script>
${arrText}

${LOGIC}
</script>
</body>
</html>
`;

  const final = eol === "\r\n" ? out.split("\n").join("\r\n") : out;

  // 回读校验：重写后的文件里必须能原样取出同一段数组
  const back = final.split(eol);
  let s2 = -1, e2 = -1;
  for (let i = 0; i < back.length; i++) {
    if (s2 < 0 && /^const\s+QUESTIONS\s*=\s*\[$/.test(back[i])) s2 = i;
    else if (s2 >= 0 && e2 < 0 && /^\];$/.test(back[i])) e2 = i;
  }
  const arrBack = back.slice(s2, e2 + 1).join("\n");

  return { file, eol: eol === "\r\n" ? "CRLF" : "LF", n, sec, pass, h1, arrHash: sha1(arrText), same: arrBack === arrText, final };
}

let bad = 0;
for (const f of files) {
  const r = build(f);
  if (!r.same) { bad++; console.log("[FAIL] 数组回读不一致 " + r.file); continue; }
  console.log(
    (WRITE ? "[WRITE] " : "[DRY]  ") + r.file.split(/[\\/]/).pop() +
    "  eol=" + r.eol + "  n=" + r.n + "  达标=" + r.pass + "/" + r.n +
    "  arrSha1=" + r.arrHash + "  arrRoundTrip=OK"
  );
  if (WRITE) fs.writeFileSync(f, r.final, "utf8");
}
console.log(WRITE ? "写入完成，异常文件数：" + bad : "dry-run 结束，异常文件数：" + bad);

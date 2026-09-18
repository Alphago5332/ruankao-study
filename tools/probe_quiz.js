const fs = require("fs");

const files = process.argv.slice(2);
for (const f of files) {
  const buf = fs.readFileSync(f, "utf8");
  const crlf = (buf.match(/\r\n/g) || []).length;
  const lf = (buf.match(/(?<!\r)\n/g) || []).length;
  const nodes = (buf.match(/data-page-node-id/g) || []).length;

  const m = buf.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*\[/);
  let name = m ? m[1] : "(none)";
  let cnt = 0;
  let fields = [];
  let arrLen = 0;
  if (m) {
    const start = buf.indexOf(m[0]);
    let i = buf.indexOf("[", start), depth = 0, end = -1;
    for (let k = i; k < buf.length; k++) {
      if (buf[k] === "[") depth++;
      else if (buf[k] === "]") { depth--; if (depth === 0) { end = k; break; } }
    }
    const arrTxt = buf.slice(i, end + 1);
    arrLen = end - i + 1;
    cnt = (arrTxt.match(/\bm\s*:/g) || []).length;
    const set = new Set();
    (arrTxt.match(/[{,]\s*([a-zA-Z_$][\w$]*)\s*:/g) || []).forEach((s) =>
      set.add(s.replace(/^[{,]\s*/, "").replace(/\s*:$/, ""))
    );
    fields = [...set];
  }

  const title = (buf.match(/<title>([^<]*)<\/title>/) || [, ""])[1];
  const h1 = (buf.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, ""])[1];
  const paras = [...buf.matchAll(/<p[^>]*class="[^"]*(?:sub|kbd-tip)[^"]*"[^>]*>([\s\S]*?)<\/p>/g)]
    .map((x) => x[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());

  console.log(
    JSON.stringify(
      {
        file: f.split(/[\\/]/).pop(),
        crlf, lf, nodes,
        arrName: name, qCount: cnt, arrChars: arrLen, fields: fields.join(","),
        title, h1: h1.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
        paras,
      },
      null,
      0
    )
  );
}

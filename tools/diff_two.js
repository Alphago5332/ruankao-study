const fs = require('fs');
function show(name, p, n) {
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  console.log('===== ' + name + ' 共 ' + lines.length + ' 行 (取前' + n + ') =====');
  lines.slice(0, n).forEach((l, i) => {
    const tag = /^- \[ \]/.test(l) ? '[CB]' : (/^- \[x\]/.test(l) ? '[OK]' : '');
    console.log(String(i + 1).padStart(3, '0') + tag + ' ' + l);
  });
  console.log();
}
show('1.1', 'C:/Users/gys2060/Desktop/日常/软考/ruankao-study/01_教材笔记/第01章_信息化发展/1.1_信息与信息化/知识点清单.md', 40);
show('1.2', 'C:/Users/gys2060/Desktop/日常/软考/ruankao-study/01_教材笔记/第01章_信息化发展/1.2_现代化基础设施/1.2_知识点清单.md', 40);
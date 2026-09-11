const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/gys2060/Desktop/日常/软考/ruankao-study';
const DIR = '01_教材笔记/第01章_信息化发展/1.1_信息与信息化';

// 要重命名的文件
const renames = [
  ['知识点清单.md', '1.1_知识点清单.md'],
  ['康奈尔笔记模板.html', '1.1_康奈尔笔记模板.html'],
  ['康奈尔笔记模板_带答案版.html', '1.1_康奈尔笔记模板_带答案版.html'],
  ['考点自测题.html', '1.1_考点自测题.html'],
];

for (const [old, neu] of renames) {
  const oldPath = path.join(DIR, old);
  const neuPath = path.join(DIR, neu);
  if (!fs.existsSync(oldPath)) {
    console.log('跳过（不存在）:', old);
    continue;
  }
  try {
    execSync(`git mv "${oldPath}" "${neuPath}"`, { cwd: ROOT, stdio: 'pipe' });
    console.log('git mv 成功:', old, '->', neu);
  } catch (e) {
    console.log('git mv 失败:', e.message);
  }
}

// 可勾选 HTML 单独处理：先删除旧的，再重新生成
const oldHtml = path.join(DIR, '知识点清单_可勾选.html');
if (fs.existsSync(oldHtml)) {
  try {
    execSync(`git rm "${oldHtml}"`, { cwd: ROOT, stdio: 'pipe' });
    console.log('git rm 成功: 知识点清单_可勾选.html');
  } catch (e) {
    console.log('git rm 失败:', e.message);
  }
}
console.log('STEP1 完成');
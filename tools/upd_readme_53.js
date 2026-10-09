// 更新 08_答题系统/README.md：新增 5.3 勾选项 + v19 更新日志
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", "08_答题系统", "README.md");
const raw = fs.readFileSync(F, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const L = raw.split(/\r?\n/);

if (raw.includes("5.3 系统集成题库")) { console.log("已更新，跳过（幂等）。"); process.exit(0); }

const idx1 = L.findIndex((l) => l.startsWith("- [x] **5.2 数据工程题库**"));
if (idx1 < 0) throw new Error("找不到 5.2 勾选行");
const idx2 = L.findIndex((l) => l.startsWith("| 2026-10-09 | **v18 新增 5.2"));
if (idx2 < 0) throw new Error("找不到 v18 日志行");

const line1 = "- [x] **5.3 系统集成题库**（12 题，2026-10-09 完成，共 166 题；补题即避自测题考点（系统集成五平台 / 结构化分解终点 / 主流化判据 / 网络应用核心=服务子系统 / 模式集成三等价 / 数据综合 / 声明式=推理机制 / ODBC / CORBA=OMG / .NET=ASP.NET / 可连接组件 / 控制集成实现技术），与自测题 22 题**零跨库重复**（D 段 0 组）——继 2.2 / 4.1 / 5.2 后**第四次「补题即零重复」**）";
const line2 = "| 2026-10-09 | **v19 新增 5.3「系统集成」12 题（共 166 题）**，第 5 章三节题库齐备。12 题取**自测题未覆盖的命题点**：系统集成实现手段形成「完整**工作台面**」 · 结构化「分解到可**具体说明**和可执行」 · 主流化「产品属于发展**主流**」 · **网络应用的核心**=服务子系统 · 模式集成三等价归结为**属性等价** · 多粒度之数据**综合** · 声明式方法=**推理**机制 · 异构数据提取之 **ODBC** · CORBA 制定者 **OMG** · .NET 涉及技术之 **ASP.NET** · 可连接组件之**数据映射** · 控制集成借助**分布式对象**技术。`check` 用 5.3 清单的语义键 **A0 / A3 / A4 / B3 / C4 / C5 / C6 / C7 / D1 / D4 / E2 / E4**。**补题后体检**：D 段跨库重复 **0 组**、check 绑定 166 处失效 0；C 段 3 组为「关于 X，下列说法正确的是」模板句假阳性，人工判定无真重复。⚠️ 实施中复现了 v11 的老坑：往 `QUESTION_BANK` 追加新节必须**先闭合上一节数组**（把 `      ]` 改成 `      ],`）再新建 `\"5.3\": [` 分组——本次用 `tools/insert_53_bank.js` 自动化处理。 |";

L.splice(idx2 + 1, 0, line2);
L.splice(idx1 + 1, 0, line1);
fs.writeFileSync(F, L.join(eol), "utf8");
console.log("已插入 5.3 勾选行（第 " + (idx1 + 2) + " 行）与 v19 日志行（第 " + (idx2 + 2) + " 行）。");

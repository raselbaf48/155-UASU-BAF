const fs = require('fs');

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const checks = `  const _todayD = new Date();
  const _currY = _todayD.getFullYear();
  const _currM = String(_todayD.getMonth() + 1).padStart(2, '0');
  const _currLastDay = new Date(_currY, _todayD.getMonth() + 1, 0).getDate();
  const isThisMonthActive = fromDate === \`\${_currY}-\${_currM}-01\` && toDate === \`\${_currY}-\${_currM}-\${_currLastDay}\`;
  const isFullYearActive = fromDate === \`\${_currY}-01-01\` && toDate === \`\${_currY}-12-31\`;
`;

content = content.replace('  return (\n    <div className="fixed inset-0', checks + '\n  return (\n    <div className="fixed inset-0');

const monthBtnOld = `className="px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      This Month`;

const monthBtnNew = `className={\`px-2 py-0.5 rounded \${isThisMonthActive ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-600' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}\`}
                    >
                      This Month`;

content = content.replace(monthBtnOld, monthBtnNew);

const yearBtnOld = `className="px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Full Year`;

const yearBtnNew = `className={\`px-2 py-0.5 rounded \${isFullYearActive ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-600' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}\`}
                    >
                      Full Year`;

content = content.replace(yearBtnOld, yearBtnNew);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);

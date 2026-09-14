const fs = require('fs');

let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const thNameOld = `<th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 whitespace-nowrap w-[1%]">Name</th>`;
const thNameNew = `<th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 whitespace-nowrap" style={{ width: '1%' }}>Name</th>`;

content = content.replace(thNameOld, thNameNew);

const tdNameOld = `<td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap w-[1%]">`;
const tdNameNew = `<td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap" style={{ width: '1%' }}>`;

content = content.replace(tdNameOld, tdNameNew);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

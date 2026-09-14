const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// The class w-auto means it takes as much as it wants. It should shrink. If we want it to be as small as possible, maybe we don't need w-auto, just no w-* class.
const thNameOld = `<th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 w-auto whitespace-nowrap">Name</th>`;
const thNameNew = `<th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 whitespace-nowrap w-[1%]">Name</th>`;
content = content.replace(thNameOld, thNameNew);

// Change Name td
const tdNameOld = `<td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap w-auto">`;
const tdNameNew = `<td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap w-[1%]">`;
content = content.replace(tdNameOld, tdNameNew);

// Remove min-w-max from table
const tableOld = `<table className="w-full table-auto text-left text-xs border-collapse min-w-max">`;
const tableNew = `<table className="w-full text-left text-xs border-collapse">`;
content = content.replace(tableOld, tableNew);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

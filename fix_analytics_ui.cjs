const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// 1. Change button text
content = content.replace(
  "<span>{isCalendarOpen ? 'Hide Holiday Calendar' : 'Show Holiday Calendar'}</span>",
  "<span>Calendar</span>"
);

// 2. Make calendar smaller (max-w-md mt-4 instead of full width)
content = content.replace(
  "{isCalendarOpen && (\n        <div className=\"border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50\">",
  "{isCalendarOpen && (\n        <div className=\"max-w-sm mt-4 border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50\">"
);

// 3. Make calendar text smaller and padding tighter
content = content.replace(
  "className=\"py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider\"",
  "className=\"py-1.5 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider\""
);

content = content.replace(
  "className=\"p-2 border-b border-r border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/20\"",
  "className=\"p-1.5 border-b border-r border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/20\""
);

content = content.replace(
  "className={`p-3 border-b border-r border-slate-100 dark:border-slate-800/50 flex flex-col items-center justify-center transition-colors ${isHoliday ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}",
  "className={`p-1.5 h-12 border-b border-r border-slate-100 dark:border-slate-800/50 flex flex-col items-center justify-center transition-colors ${isHoliday ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}"
);

content = content.replace(
  "<span className={`text-sm font-bold ${isHoliday ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>\n                    {day}\n                  </span>\n                  {isHoliday && <span className=\"text-[9px] font-bold text-red-500 dark:text-red-400 uppercase mt-0.5\">Holiday</span>}",
  "<span className={`text-xs font-bold ${isHoliday ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>\n                    {day}\n                  </span>\n                  {isHoliday && <span className=\"text-[8px] leading-tight font-bold text-red-500 dark:text-red-400 uppercase mt-0.5\">Holiday</span>}"
);


fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

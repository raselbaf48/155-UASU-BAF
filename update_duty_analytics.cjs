const fs = require('fs');

let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// 1. Filter daysArray to only include days with assignments
const daysArrayOld = `  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);`;
const daysArrayNew = `  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const activeDays = new Set(
    relevantAssignments.map(a => parseInt(a.date.split('-')[2], 10))
  );
  const daysArray = allDays.filter(day => activeDays.has(day));`;

content = content.replace(daysArrayOld, daysArrayNew);

// 2. Remove Flt column header
const thFltOld = `<th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 w-16 text-center">Flt</th>`;
content = content.replace(thFltOld, '');

// 3. Make Name column auto-fit
const thNameOld = `<th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 min-w-[120px]">Name</th>`;
const thNameNew = `<th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 w-max whitespace-nowrap">Name</th>`;
content = content.replace(thNameOld, thNameNew);

// 4. Add Day of week under date in header
const thDayOld = `{daysArray.map(day => (
                    <th key={day} className="px-1 py-2.5 font-bold text-slate-600 dark:text-slate-400 border-b border-r border-slate-200 dark:border-slate-700 w-6 text-center">
                      {day}
                    </th>
                  ))}`;
const thDayNew = `{daysArray.map(day => {
                    const dateObj = new Date(currentYear, currentMonth - 1, day);
                    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                    return (
                      <th key={day} className="px-1 py-2 font-bold text-slate-600 dark:text-slate-400 border-b border-r border-slate-200 dark:border-slate-700 w-10 text-center leading-tight">
                        <div className="text-[14px]">{day}</div>
                        <div className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">{dayOfWeek}</div>
                      </th>
                    );
                  })}`;
content = content.replace(thDayOld, thDayNew);

// 5. Remove Flt column cell
const tdFltOld = `<td className="px-3 py-2 text-center border-r border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {airman.flightName.substring(0, 3).toUpperCase()}
                      </span>
                    </td>`;
content = content.replace(tdFltOld, '');

// 6. Name column td needs whitespace-nowrap (it already has it in the button, but we'll leave it as is or add it to td if needed. Button has it: className="font-black text-slate-900 dark:text-slate-100 hover:text-emerald-600 whitespace-nowrap")

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

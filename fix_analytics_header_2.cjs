const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// I will just replace from `<div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">` 
// to `{/* Full Calendar */}` or similar.

const startIndex = content.indexOf('<div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">');
const endIndex = content.indexOf('</div>\n          )}\n        </div>', startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `<div className="flex flex-col items-center justify-center mb-4 gap-4 relative">
          <div className="text-center">
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center justify-center space-x-2">
              <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Duty Analysis & Fairness Equity Monitor</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Workload distribution, duty posts, and flight comparisons.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 w-full">
            <button onClick={() => setIsCalendarOpen(!isCalendarOpen)} className="flex items-center justify-center space-x-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors bg-slate-100 dark:bg-slate-800 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-auto">
              <Calendar className="w-4 h-4" />
              <span>{monthNames[currentMonth - 1]} {currentYear}</span>
            </button>
            
            {isCalendarOpen && (
              <div className="max-w-sm border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50 shadow-lg absolute top-[110px] z-20">
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50">
                  <button
                    onClick={() => {
                      if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1); }
                      else setCurrentMonth(m => m - 1);
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  </button>
                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-200">
                    {monthNames[currentMonth - 1]} {currentYear}
                  </h2>
                  <button
                    onClick={() => {
                      if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1); }
                      else setCurrentMonth(m => m + 1);
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                  </button>
                </div>
                <div className="grid grid-cols-7 text-center border-b border-slate-200 dark:border-slate-700/50 bg-slate-100 dark:bg-slate-800/80">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-1.5 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 bg-white dark:bg-slate-900">
                  {emptyCells.map(i => (
                    <div key={\`empty-\${i}\`} className="p-1.5 border-b border-r border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/20" />
                  ))}
                  {daysArray.map(day => {
                    const dateStr = \`\${currentYear}-\${currentMonth.toString().padStart(2, '0')}-\${day.toString().padStart(2, '0')}\`;
                    const dObj = new Date(currentYear, currentMonth - 1, day);
                    const isHoliday = isHolidayDate(dateStr, dObj);
                    return (
                      <button
                        key={day}
                        onClick={() => handleToggleHoliday(dateStr)}
                        title="Click to toggle custom holiday"
                        className={\`p-1.5 h-12 border-b border-r border-slate-100 dark:border-slate-800/50 flex flex-col items-center justify-center transition-colors \${isHoliday ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}\`}
                      >
                        <span className={\`text-xs font-bold \${isHoliday ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}\`}>
                          {day}
                        </span>
                        {isHoliday && <span className="text-[8px] leading-tight font-bold text-red-500 dark:text-red-400 uppercase mt-0.5">Holiday</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shadow-inner">
              <button
                onClick={() => setFilterMode('ALL')}
                className={\`px-4 py-2 rounded-lg text-xs font-bold transition-all \${filterMode === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}\`}
              >
                All Days
              </button>
              <button
                onClick={() => setFilterMode('HOLIDAY')}
                className={\`px-4 py-2 rounded-lg text-xs font-bold transition-all \${filterMode === 'HOLIDAY' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}\`}
              >
                Holidays Only
              </button>
            </div>
          </div>`;

  const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex + 29); // + length of the match
  fs.writeFileSync('src/components/DutyAnalytics.tsx', newContent);
}


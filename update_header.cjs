const fs = require('fs');

let content = fs.readFileSync('src/components/MonthlyDutyRegister.tsx', 'utf8');

const regex = /\{\/\* Top Banner & Month\/Year Selector \*\/\}.*?\{\/\* Undo Last Action Banner \*\/\}/s;

const replacement = `{/* Top Banner & Month/Year Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row justify-between items-center lg:items-start gap-6">
        
        {/* Left - Title */}
        <div className="flex-1 text-center lg:text-left flex flex-col items-center lg:items-start">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex flex-col sm:flex-row items-center gap-2">
            <span>Monthly Duty Register</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              {isFullYearView ? \`Full Year \${currentYear}\` : \`1st to \${daysCount}th\`}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dynamic Roster Matrix for 155 UASU BAF
          </p>
        </div>

        {/* Center - Calendar & Holiday Controls */}
        <div className="flex-[1.5] flex flex-col items-center justify-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              onClick={handlePrevMonth}
              disabled={isFullYearView}
              className={\`p-2 rounded-xl transition-colors \${
                isFullYearView
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs'
              }\`}
              title="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="relative px-6 flex items-center justify-center min-w-[200px]">
               <span className="font-black text-lg text-slate-800 dark:text-slate-200 pointer-events-none">
                  {isFullYearView ? 'Full Year (Jan-Dec)' : new Date(currentYear, currentMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
               </span>
               <input
                  type="month"
                  value={\`\${currentYear}-\${currentMonth.toString().padStart(2, '0')}\`}
                  onChange={(e) => {
                     const val = e.target.value;
                     if(val) {
                        const [y, m] = val.split('-');
                        setCurrentYear(parseInt(y, 10));
                        setCurrentMonth(parseInt(m, 10));
                        setIsFullYearView(false);
                     }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
               />
            </div>

            <button
              onClick={handleNextMonth}
              disabled={isFullYearView}
              className={\`p-2 rounded-xl transition-colors \${
                isFullYearView
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs'
              }\`}
              title="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={() => setOnlyHolidaysFilter(!onlyHolidaysFilter)}
            className={\`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-bold border transition-all \${
              onlyHolidaysFilter
                ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
            }\`}
            title="Filter to show only Friday/Saturday and designated official holidays"
          >
            <span>{onlyHolidaysFilter ? '🏖️ Holidays Only' : '📅 All Days'}</span>
          </button>
        </div>

        {/* Right - Action Buttons */}
        <div className="flex-1 flex flex-wrap justify-center lg:justify-end gap-2 mt-4 lg:mt-0">
          {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
            <div className="flex flex-wrap justify-center lg:justify-end gap-2">
              <button
                onClick={() => exportTableToCSV('duty-register-container', \`Duty_Register_\${currentYear}_\${currentMonth}.csv\`)}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95"
                title="Export current view to CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden xl:inline">Export</span>
              </button>

              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-xs transition-all active:scale-95"
                title="View Last 10 Entries, revert wrong entries, or edit"
              >
                <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden xl:inline">History</span>
              </button>

              <button
                onClick={() => handleOpenBulkModal()}
                className="flex items-center space-x-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
              >
                <CalendarRange className="w-4 h-4" />
                <span className="hidden xl:inline">Assign</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Undo Last Action Banner */}`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/MonthlyDutyRegister.tsx', content);

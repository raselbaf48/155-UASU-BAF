const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// Wrap the calendar in a click-outside handler using standard React logic. 
// Or just a full screen invisible overlay that closes the calendar on click. 

const regex = /<button onClick=\{\(\) => setIsCalendarOpen\(\!isCalendarOpen\)\} className="flex items-center justify-center space-x-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors bg-slate-100 dark:bg-slate-800 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-auto">/;

const newBtn = `<div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1); }
                  else setCurrentMonth(m => m - 1);
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>

              <button onClick={() => setIsCalendarOpen(!isCalendarOpen)} className="flex items-center justify-center space-x-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors bg-slate-100 dark:bg-slate-800 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-auto">
                <Calendar className="w-4 h-4" />
                <span>{monthNames[currentMonth - 1]} {currentYear}</span>
              </button>
              
              <button
                onClick={() => {
                  if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1); }
                  else setCurrentMonth(m => m + 1);
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>`;

content = content.replace(regex, newBtn);

const regexModal = /\{isCalendarOpen && \(\s*<div className="max-w-sm border border-slate-200 dark:border-slate-700\/50 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900\/50 shadow-lg absolute top-\[110px\] z-20">/;

const newModal = `{isCalendarOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setIsCalendarOpen(false)}></div>
                <div className="max-w-sm border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50 shadow-lg absolute top-[110px] z-20">`;

content = content.replace(regexModal, newModal);

// Also remove the arrows from inside the popup modal
const oldHeader = `<div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50">
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
                </div>`;

const newHeader = `<div className="flex items-center justify-center px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50">
                  <h2 className="text-sm font-black text-slate-800 dark:text-slate-200">
                    {monthNames[currentMonth - 1]} {currentYear}
                  </h2>
                </div>`;

content = content.replace(oldHeader, newHeader);

// Close the fragment
const closeDivRegex = /<\/div>\s*\)\}\s*<div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shadow-inner">/;
const newCloseDiv = `</div>
              </>
            )}
            
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shadow-inner relative z-20">`;
content = content.replace(closeDivRegex, newCloseDiv);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

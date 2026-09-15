import re

with open('src/components/FlightDutyCalendarModal.tsx', 'r') as f:
    content = f.read()

bad_total = """            <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase">Total:</span>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{totalFlightSelected}</span>
            </div>"""

good_total = """            <div className="flex items-center space-x-2">
              <div className="flex items-center bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <input 
                  type="number"
                  min="0"
                  id="modalGlobalReqInput"
                  placeholder="0"
                  className="w-10 px-1 py-0.5 text-xs font-bold font-mono text-center bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                />
                <button 
                  onClick={() => {
                    const val = parseInt((document.getElementById('modalGlobalReqInput') as HTMLInputElement).value, 10);
                    if (isNaN(val)) return;
                    const newData = new Array(31).fill(val);
                    onSave(newData);
                  }}
                  className="px-2 py-1 ml-1 bg-indigo-600 text-white text-[10px] font-bold rounded hover:bg-indigo-700 transition-colors"
                >
                  Apply All
                </button>
              </div>
              <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase">Total:</span>
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{totalFlightSelected}</span>
              </div>
            </div>"""

content = content.replace(bad_total, good_total)

with open('src/components/FlightDutyCalendarModal.tsx', 'w') as f:
    f.write(content)


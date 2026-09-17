const fs = require('fs');
let code = fs.readFileSync('src/components/ParadeStateFormattedView.tsx', 'utf8');

const oldMulti = `<span className="text-slate-500 font-semibold">From:</span>
              <DateNavigator
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setSelectedDate(e.target.value);
                }}
                className="bg-transparent text-slate-900 dark:text-white print:text-black font-black outline-none cursor-pointer"
              />`;
              
const newMulti = `<span className="text-slate-500 font-semibold">From:</span>
              <DateNavigator
                value={fromDate}
                onChange={(e) => {
                  const newFrom = e.target.value;
                  if (activePreset === '7days' || activePreset === '15days') {
                    const gap = activePreset === '7days' ? 6 : 14;
                    const d = new Date(newFrom);
                    d.setDate(d.getDate() + gap);
                    const newTo = d.toISOString().split('T')[0];
                    setFromDate(newFrom);
                    setToDate(newTo);
                  } else {
                    setFromDate(newFrom);
                    if (toDate < newFrom) setToDate(newFrom);
                  }
                  // We don't call setSelectedDate here to avoid useEffect triggering overwrites
                }}
                className="bg-transparent text-slate-900 dark:text-white print:text-black font-black outline-none cursor-pointer"
              />`;

code = code.replace(oldMulti, newMulti);

fs.writeFileSync('src/components/ParadeStateFormattedView.tsx', code);

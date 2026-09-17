const fs = require('fs');
let code = fs.readFileSync('src/components/ParadeStateFormattedView.tsx', 'utf8');

// 1. Hide empty columns default to true
code = code.replace(
  "const [hideEmptyColumns, setHideEmptyColumns] = useState<boolean>(false);",
  "const [hideEmptyColumns, setHideEmptyColumns] = useState<boolean>(true);"
);

// 2. Fix the useEffect so it doesn't overwrite toDate in multi mode
code = code.replace(
  `useEffect(() => {
    setFromDate(selectedDate);
    setToDate(selectedDate);
    setDisposalFromDate(selectedDate);
    setDisposalToDate(selectedDate);
  }, [selectedDate]);`,
  `useEffect(() => {
    if (dateMode === 'single') {
      setFromDate(selectedDate);
      setToDate(selectedDate);
    }
    setDisposalFromDate(selectedDate);
    setDisposalToDate(selectedDate);
  }, [selectedDate, dateMode]);`
);

// 3. Fix the fromDate DateNavigator onChange in multi mode
const oldMultiFromDate = `<DateNavigator
                      value={fromDate}
                      onChange={(e) => {
                        setFromDate(e.target.value);
                        setSelectedDate(e.target.value);
                      }}
                      className="bg-transparent text-slate-900 dark:text-white print:text-black font-black outline-none cursor-pointer"
                    />`;

const newMultiFromDate = `<DateNavigator
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
                      }}
                      className="bg-transparent text-slate-900 dark:text-white print:text-black font-black outline-none cursor-pointer"
                    />`;

code = code.replace(oldMultiFromDate, newMultiFromDate);

fs.writeFileSync('src/components/ParadeStateFormattedView.tsx', code);

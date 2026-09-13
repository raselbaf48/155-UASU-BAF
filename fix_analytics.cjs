const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

content = content.replace(
  "const [selectedDuty, setSelectedDuty] = useState<string | null>(null);",
  "const [selectedDuty, setSelectedDuty] = useState<string | null>(null);\n  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);"
);

content = content.replace(
  "{/* Full Calendar */}",
  "{/* Full Calendar */}\n        <div className=\"mt-4\">\n          <button onClick={() => setIsCalendarOpen(!isCalendarOpen)} className=\"flex items-center space-x-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700\">\n            <Calendar className=\"w-4 h-4\" />\n            <span>{isCalendarOpen ? 'Hide Holiday Calendar' : 'Show Holiday Calendar'}</span>\n          </button>\n          {isCalendarOpen && ("
);

content = content.replace(
  "        </div>\n      </div>\n\n      {loading ?",
  "        </div>\n          )}\n        </div>\n      </div>\n\n      {loading ?"
);

// Fix the Duty Details Modal completely
const oldModalStr = `// Modal Component for Duty Details
const DutyDetailsModal: React.FC<{`;

const newModalCode = `// Modal Component for Duty Details
const DutyDetailsModal: React.FC<{
  dutyId: string;
  assignments: DutyAssignment[];
  airmen: Airman[];
  currentYear: number;
  currentMonth: number;
  onClose: () => void;
  onViewProfile: (airman: Airman) => void;
}> = ({ dutyId, assignments, airmen, currentYear, currentMonth, onClose, onViewProfile }) => {
  
  const mapDutyIdToType = (id: string) => {
    if (id === 'GD') return 'GD';
    if (id === 'BTF') return 'BTF';
    if (id === 'NTF') return 'NTF';
    if (id === 'HTF') return 'HALISHAHAR';
    if (id === 'AIRPORT') return 'AIRPORT';
    if (id === 'IDAC') return 'IDAC';
    return '';
  };

  const targetType = mapDutyIdToType(dutyId);

  const relevantAssignments = assignments.filter(a => {
    if (dutyId === 'IDAC') {
      return a.dutyCode === 'IDAC' || a.dutyCode === 'IDA';
    }
    return a.dutyCode === targetType;
  });

  // Unique airmen who have done this duty this month
  const uniqueAirmanIds = Array.from(new Set(relevantAssignments.map(a => a.airmanId)));
  const dutyAirmen = airmen
    .filter(a => uniqueAirmanIds.includes(a.id))
    .sort((a, b) => a.serNo - b.serNo); // Sorted by SerNo

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>{dutyId} Duty Matrix - {currentMonth}/{currentYear}</span>
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">Showing capable personnel and duty dates</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        
        <div className="p-0 overflow-auto flex-1">
          {dutyAirmen.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-bold">
              No assignments found for this duty.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse min-w-max">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 z-10 shadow-xs backdrop-blur-md">
                <tr>
                  <th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 w-12 text-center">Ser</th>
                  <th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 min-w-[120px]">Name</th>
                  <th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 w-16 text-center">Flt</th>
                  {daysArray.map(day => (
                    <th key={day} className="px-1 py-2.5 font-bold text-slate-600 dark:text-slate-400 border-b border-r border-slate-200 dark:border-slate-700 w-6 text-center">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {dutyAirmen.map((airman, index) => (
                  <tr key={airman.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-3 py-2 font-bold text-slate-500 text-center border-r border-slate-200 dark:border-slate-700">
                      {airman.serNo || index + 1}
                    </td>
                    <td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700">
                      <button 
                        onClick={() => { onClose(); onViewProfile(airman); }}
                        className="font-black text-slate-900 dark:text-slate-100 hover:text-emerald-600 whitespace-nowrap"
                      >
                        {airman.rank} {airman.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-center border-r border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {airman.flightName.substring(0, 3).toUpperCase()}
                      </span>
                    </td>
                    {daysArray.map(day => {
                      const dateStr = \`\${currentYear}-\${currentMonth.toString().padStart(2, '0')}-\${day.toString().padStart(2, '0')}\`;
                      const assignedOnDate = relevantAssignments.find(a => a.airmanId === airman.id && a.date === dateStr);
                      return (
                        <td key={day} className="p-0 border-r border-slate-200 dark:border-slate-700 text-center relative group">
                          {assignedOnDate ? (
                            <div className="w-full h-full min-h-[30px] flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20" title={assignedOnDate.dutyCode}>
                              <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-400">
                                {assignedOnDate.dutyCode.substring(0, 3)}
                              </span>
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
`;

const index = content.indexOf(oldModalStr);
if (index !== -1) {
  content = content.substring(0, index) + newModalCode;
}

// Pass currentYear and currentMonth to the modal
content = content.replace(
  "onViewProfile={onViewProfile}\n        />",
  "onViewProfile={onViewProfile}\n          currentYear={currentYear}\n          currentMonth={currentMonth}\n        />"
);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

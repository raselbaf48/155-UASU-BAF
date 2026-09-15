const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const detailsModalStartIdx = content.indexOf('const DutyDetailsModal: React.FC<{');
let cleanEnd = content.substring(0, detailsModalStartIdx);

// The modal we want to insert is exactly this:
const modalStr = `const DutyDetailsModal: React.FC<{
  dutyId: string;
  assignments: DutyAssignment[];
  airmen: Airman[];
  currentYear: number;
  currentMonth: number;
  onClose: () => void;
  onViewProfile: (airman: Airman, config?: any) => void;
}> = ({ dutyId, assignments, airmen, currentYear, currentMonth, onClose, onViewProfile }) => {
  const [showPrintPreview, setShowPrintPreview] = useState(false);

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
    if (dutyId === 'ALL') {
      return ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA'].includes(a.dutyCode);
    }
    if (dutyId === 'IDAC') {
      return a.dutyCode === 'IDAC' || a.dutyCode === 'IDA';
    }
    return a.dutyCode === targetType;
  });

  const uniqueAirmanIds = Array.from(new Set(relevantAssignments.map(a => a.airmanId)));
  const isHeavyDuty = ['GD', 'BTF', 'NTF', 'AIRPORT', 'HALISHAHAR', 'IDAC'].includes(dutyId);
  const dutyAirmen = airmen
    .filter(a => {
      if (!a.active) return false;
      return uniqueAirmanIds.includes(a.id);
    })
    .sort((a, b) => {
      const getUniqueCount = (id: string) => {
        return relevantAssignments.filter(x => x.airmanId === id).length;
      };
      const aCount = getUniqueCount(a.id);
      const bCount = getUniqueCount(b.id);
      if (bCount !== aCount) return bCount - aCount;
      return a.serNo - b.serNo;
    });

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const allDaysMatrix = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const activeDaysMatrix = new Set(
    relevantAssignments.map(a => parseInt(a.date.split('-')[2], 10))
  );
  const daysArray = allDaysMatrix.filter(day => activeDaysMatrix.has(day));

  const tableContent = (
    <table className="w-full text-left text-xs border-collapse">
      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 z-10 shadow-xs backdrop-blur-md print:static print:bg-white print:shadow-none print:text-black print:border-b-2 print:border-black">
        <tr>
          <th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 w-12 text-center">Ser</th>
          <th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 whitespace-nowrap" style={{ width: '1%' }}>Name</th>
          <th className="px-3 py-2.5 font-black text-emerald-600 dark:text-emerald-400 border-b border-r border-slate-200 dark:border-slate-700 w-16 text-center">Total</th>
          {daysArray.map(day => {
            const dateObj = new Date(currentYear, currentMonth - 1, day);
            const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            return (
              <th key={day} className="px-1 py-2 font-bold text-slate-600 dark:text-slate-400 border-b border-r border-slate-200 dark:border-slate-700 w-10 text-center leading-tight">
                <div className="text-[14px]">{day}</div>
                <div className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">{dayOfWeek}</div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {dutyAirmen.map((airman, idx) => (
          <tr key={airman.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
            <td className="px-3 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center font-bold text-slate-500">
              {idx + 1}
            </td>
            <td className="px-3 py-2 border-b border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-emerald-600 whitespace-nowrap" onClick={() => onViewProfile(airman)}>
              {airman.rank} {airman.name}
            </td>
            <td className="px-3 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center">
              <span className="inline-flex items-center justify-center min-w-[28px] h-7 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-black rounded-lg text-[13px]">
                {relevantAssignments.filter(a => a.airmanId === airman.id).length}
              </span>
            </td>
            {daysArray.map(day => {
              const dateStr = \`\${currentYear}-\${currentMonth.toString().padStart(2, '0')}-\${day.toString().padStart(2, '0')}\`;
              const assignmentsOnDate = relevantAssignments
                .filter(a => a.airmanId === airman.id && a.date === dateStr)
                .sort((a, b) => {
                  const getWeight = (shift) => {
                    if (shift === 'Morning') return 1;
                    if (shift === 'Afternoon') return 2;
                    if (shift === 'Night') return 3;
                    return 0;
                  };
                  return getWeight(a.idaShift) - getWeight(b.idaShift);
                });
              return (
                <td key={day} className="p-0 border-b border-r border-slate-200 dark:border-slate-700 text-center relative group">
                  {assignmentsOnDate.length > 0 ? (
                    <div className="w-full h-full min-h-[30px] flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/20" title={assignmentsOnDate.map(a => a.dutyCode).join(', ')}>
                      {assignmentsOnDate.map((a, i) => {
                        let label = a.dutyCode;
                        if (dutyId === 'IDAC' || dutyId === 'ALL') {
                          if (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') {
                            if (a.idaShift === 'Morning') label = 'IDAC-A';
                            else if (a.idaShift === 'Afternoon') label = 'IDAC-B';
                            else if (a.idaShift === 'Night') label = 'IDAC-C';
                            else label = 'IDAC-A'; // Default fallback
                          } else {
                            label = label.substring(0, 3);
                          }
                        } else {
                          label = label.substring(0, 3);
                        }
                        return (
                          <span key={i} className="text-[9px] leading-tight font-black text-emerald-700 dark:text-emerald-400">
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs print:static print:inset-auto print:p-0 print:bg-transparent print:backdrop-blur-none print:z-auto print:block print:w-full">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:rounded-none print:max-w-full print:max-h-none print:h-auto print:bg-white print:text-black print:overflow-visible print:block">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 print:bg-white print:border-none print:px-0 print:py-2 print:text-black">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>{dutyId} Duty Matrix - {currentMonth}/{currentYear}</span>
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">Showing capable personnel and duty dates</p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowPrintPreview(true)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors print:hidden" title="Print Matrix">
              <Printer className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors print:hidden" title="Close">
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>
        
        <div className="p-0 overflow-auto flex-1 print:overflow-visible print:h-auto print:flex-none print:block">
          {dutyAirmen.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-bold">
              No assignments found for this duty.
            </div>
          ) : tableContent}
        </div>
      </div>

      {/* Print Preview Portal */}
      {showPrintPreview && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/90 backdrop-blur-sm overflow-hidden print:bg-white print:static print:h-auto print:w-auto print:overflow-visible print:block">
          <div className="flex-none bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between shadow-2xl print:hidden z-10 sticky top-0">
            <h2 className="text-white font-bold text-lg">Print Preview</h2>
            <div className="flex items-center space-x-3 text-white">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>Official Export / Print</span>
              </button>
              <button
                onClick={() => setShowPrintPreview(false)}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                <span>Close</span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-slate-800 p-4 sm:p-8 flex justify-center print:bg-white print:p-0 print:block print:overflow-visible h-[calc(100vh-80px)]">
            <div className="bg-white text-black p-8 sm:p-12 shadow-2xl max-w-[1200px] w-full mx-auto print:shadow-none print:p-0 print:w-full print:max-w-none print:m-0 h-max min-h-full">
              <div className="text-center mb-6 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black">{dutyId} Duty Matrix</h1>
                <p className="text-sm font-bold mt-1">Month: {currentMonth}/{currentYear}</p>
              </div>
              <div className="overflow-x-auto">
                {tableContent}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
`;

fs.writeFileSync('src/components/DutyAnalytics.tsx', cleanEnd + modalStr);

const fs = require('fs');

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// Define isDutyMatrixMode
const isDutyMatrixModeDef = `const isFullYearActive = fromDate === \`\${_currY}-01-01\` && toDate === \`\${_currY}-12-31\`;
  const isDutyMatrixMode = historyOnly && initialCategory && !['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT'].includes(initialCategory);`;

content = content.replace(
  'const isFullYearActive = fromDate === `${_currY}-01-01` && toDate === `${_currY}-12-31`;',
  isDutyMatrixModeDef
);

// 1. Hide settings & delete icon
content = content.replace(
  '{onEditAirman && (',
  '{!isDutyMatrixMode && onEditAirman && ('
);

content = content.replace(
  '{onRemoveAirman && (',
  '{!isDutyMatrixMode && onRemoveAirman && ('
);

// 2. Hide category toggle, show Duty Name
const categoryOld = `{/* Category toggle */}
                {!historyOnly && (
                  <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">`;

const categoryNew = `{/* Category toggle */}
                {isDutyMatrixMode ? (
                  <div className="text-[12px] font-black text-slate-800 dark:text-white px-3 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg">
                    {DUTY_TYPE_MAP[initialCategory as any]?.name || initialCategory}
                  </div>
                ) : !historyOnly && (
                  <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">`;

content = content.replace(categoryOld, categoryNew);

// 3. Hide KPI boxes
const countersOld = `{/* Counters Summary */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">`;
const countersNew = `{/* Counters Summary */}
              {!isDutyMatrixMode && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">`;
              
const countersEndOld = `</div>

              {/* Table / Details area */}`;
const countersEndNew = `</div>
              )}

              {/* Table / Details area */}`;

content = content.replace(countersOld, countersNew);
content = content.replace(countersEndOld, countersEndNew);

// 4. Change table header
const tableHeaderOld = `<tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3.5">Date</th>
                        <th className="py-2.5 px-3.5">Duty / Status</th>
                        <th className="py-2.5 px-3.5">Shift</th>
                        <th className="py-2.5 px-3.5">Remarks / Details</th>
                      </tr>`;
const tableHeaderNew = `<tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3.5">Date</th>
                        {isDutyMatrixMode ? (
                          <th className="py-2.5 px-3.5">Day</th>
                        ) : (
                          <>
                            <th className="py-2.5 px-3.5">Duty / Status</th>
                            <th className="py-2.5 px-3.5">Shift</th>
                            <th className="py-2.5 px-3.5">Remarks / Details</th>
                          </>
                        )}
                      </tr>`;
content = content.replace(tableHeaderOld, tableHeaderNew);

const tdOld = `<td className="py-2.5 px-3.5">
                                <span
                                  className={\`px-2 py-0.5 rounded font-black text-[10px] \${typeInfo?.badgeBg || 'bg-slate-100 dark:bg-slate-800'} \${typeInfo?.badgeText || 'text-slate-600'}\`}
                                >
                                  {typeInfo?.shortName || item.dutyCode}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 font-semibold text-slate-600 dark:text-slate-400">
                                {item.idaShift && item.idaShift !== 'None' ? item.idaShift : '-'}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={item.notes || ''}>
                                {item.notes || '-'}
                              </td>`;

const tdNew = `{isDutyMatrixMode ? (
                                <td className="py-2.5 px-3.5 font-semibold text-slate-600 dark:text-slate-400">
                                  {new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                </td>
                              ) : (
                                <>
                                  <td className="py-2.5 px-3.5">
                                    <span
                                      className={\`px-2 py-0.5 rounded font-black text-[10px] \${typeInfo?.badgeBg || 'bg-slate-100 dark:bg-slate-800'} \${typeInfo?.badgeText || 'text-slate-600'}\`}
                                    >
                                      {typeInfo?.shortName || item.dutyCode}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3.5 font-semibold text-slate-600 dark:text-slate-400">
                                    {item.idaShift && item.idaShift !== 'None' ? item.idaShift : '-'}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-slate-500 dark:text-slate-400 max-w-[200px] truncate" title={item.notes || ''}>
                                    {item.notes || '-'}
                                  </td>
                                </>
                              )}`;

content = content.replace(tdOld, tdNew);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);

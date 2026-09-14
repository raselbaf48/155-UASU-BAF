const fs = require('fs');

let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// The issue is `assignedOnDate` uses `.find(...)` which only returns the FIRST assignment.
// If an airman does both IDAC (morning) and IDA (night) on the same day, they only see one.
// We should use `.filter(...)` and map over them, or join them with a comma.
// Also, IDAC is currently mapping to substring(0, 3) which is IDA.

const regexFind = /const assignedOnDate = relevantAssignments\.find\(a => a\.airmanId === airman\.id && a\.date === dateStr\);/;
const replacementFind = `const assignmentsOnDate = relevantAssignments.filter(a => a.airmanId === airman.id && a.date === dateStr);`;
content = content.replace(regexFind, replacementFind);

const regexRender = /\{assignedOnDate \? \(\s*<div className="w-full h-full min-h-\[30px\] flex items-center justify-center bg-emerald-50 dark:bg-emerald-900\/20" title=\{assignedOnDate\.dutyCode\}>\s*<span className="text-\[10px\] font-black text-emerald-700 dark:text-emerald-400">\s*\{assignedOnDate\.dutyCode\.substring\(0, 3\)\}\s*<\/span>\s*<\/div>\s*\) : null\}/;

const replacementRender = `{assignmentsOnDate.length > 0 ? (
                            <div className="w-full h-full min-h-[30px] flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/20" title={assignmentsOnDate.map(a => a.dutyCode).join(', ')}>
                              {assignmentsOnDate.map((a, i) => {
                                let label = a.dutyCode;
                                if (dutyId === 'IDAC') {
                                  if (a.dutyCode === 'IDAC') label = 'IDAC-A';
                                  if (a.dutyCode === 'IDA') label = 'IDAC-B';
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
                          ) : null}`;

content = content.replace(regexRender, replacementRender);

// Wait, the Total column also has `new Set(....).size` which counts the unique dates.
// If a person does IDAC-A and IDAC-B on the same day, it counts as 1.
// The user said: "IDAC Duty te to akjon Mornnig & Nt o korte pare tahole aivabe asbe IDAC- A & C (2 ta duty count hbe)"
// If they want it to count as 2, we shouldn't use `new Set(...map(a => a.date)).size` for the total if we want to count multiple shifts on the same day.
// Let's modify the total count logic for IDAC.

const regexTotal = /const getUniqueCount = \(id: string\) => new Set\(relevantAssignments\.filter\(x => x\.airmanId === id\)\.map\(x => x\.date\)\)\.size;/;
const replacementTotal = `const getUniqueCount = (id: string) => {
        const assignmentsForId = relevantAssignments.filter(x => x.airmanId === id);
        if (dutyId === 'IDAC' || dutyId === 'ALL') {
          return assignmentsForId.length;
        }
        return new Set(assignmentsForId.map(x => x.date)).size;
      };`;
content = content.replace(regexTotal, replacementTotal);

const regexTotalRender = /\{new Set\(relevantAssignments\.filter\(a => a\.airmanId === airman\.id\)\.map\(a => a\.date\)\)\.size\}/;
const replacementTotalRender = `{(dutyId === 'IDAC' || dutyId === 'ALL') 
                          ? relevantAssignments.filter(a => a.airmanId === airman.id).length 
                          : new Set(relevantAssignments.filter(a => a.airmanId === airman.id).map(a => a.date)).size}`;
content = content.replace(regexTotalRender, replacementTotalRender);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

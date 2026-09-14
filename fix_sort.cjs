const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const regex = /const assignmentsOnDate = relevantAssignments\.filter\(a => a\.airmanId === airman\.id && a\.date === dateStr\);/;

const replacement = `const assignmentsOnDate = relevantAssignments
                        .filter(a => a.airmanId === airman.id && a.date === dateStr)
                        .sort((a, b) => {
                          const getWeight = (shift) => {
                            if (shift === 'Morning') return 1;
                            if (shift === 'Afternoon') return 2;
                            if (shift === 'Night') return 3;
                            return 0;
                          };
                          return getWeight(a.idaShift) - getWeight(b.idaShift);
                        });`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

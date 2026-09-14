const fs = require('fs');

let content = fs.readFileSync('src/components/MonthlyDutyRegister.tsx', 'utf8');

content = content.replace(
  /body: JSON\.stringify\(\{ airmanId: activeCell\.airman\.id, date: activeCell\.date \}\),/g,
  `body: JSON.stringify({ airmanId: activeCell.airman.id, date: activeCell.date, dutyCode: activeCell.assignment?.dutyCode }),`
);

// We should also check what setAssignments does:
// setAssignments((prev) => prev.filter((a) => !(a.airmanId === activeCell.airman.id && a.date === activeCell.date)));
// It also clears ALL on the frontend for that date!
// We should only filter out the specific duty code.

const oldFilter = /setAssignments\(\(prev\) => prev\.filter\(\(a\) => \!\(a\.airmanId === activeCell\.airman\.id && a\.date === activeCell\.date\)\)\);/;
const newFilter = `setAssignments((prev) => prev.filter((a) => !(a.airmanId === activeCell.airman.id && a.date === activeCell.date && a.dutyCode === activeCell.assignment?.dutyCode)));`;

content = content.replace(oldFilter, newFilter);

fs.writeFileSync('src/components/MonthlyDutyRegister.tsx', content);

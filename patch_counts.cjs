const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const newCounts = `
  const clCount = countWithF295Deduction(assignments, (a) => a.dutyCode === 'LEAVE' && ((a.notes && a.notes.toLowerCase().includes('casual')) || (a.notes && a.notes.toLowerCase().includes('cl'))));
  const alCount = countWithF295Deduction(assignments, (a) => a.dutyCode === 'LEAVE' && ((a.notes && a.notes.toLowerCase().includes('annual')) || (a.notes && a.notes.toLowerCase().includes('al'))));
  const totalLeave = countWithF295Deduction(assignments, (a) => a.dutyCode === 'LEAVE');
`;

content = content.replace(/const clCount = assignments\.filter\([\s\S]*?const totalLeave = assignments\.filter\(\(a\) => a\.dutyCode === 'LEAVE'\)\.length;/, newCounts.trim());

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);

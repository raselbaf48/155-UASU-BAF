const fs = require('fs');

let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const regexFilter = /const aCount = relevantAssignments\.filter\(x => x\.airmanId === a\.id\)\.length;\s*const bCount = relevantAssignments\.filter\(x => x\.airmanId === b\.id\)\.length;/;

const newFilter = `const getUniqueCount = (id: string) => new Set(relevantAssignments.filter(x => x.airmanId === id).map(x => x.date)).size;
      const aCount = getUniqueCount(a.id);
      const bCount = getUniqueCount(b.id);`;

content = content.replace(regexFilter, newFilter);

const regexTotal = /\{relevantAssignments\.filter\(a => a\.airmanId === airman\.id\)\.length\}/;
const newTotal = `{new Set(relevantAssignments.filter(a => a.airmanId === airman.id).map(a => a.date)).size}`;

content = content.replace(regexTotal, newTotal);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

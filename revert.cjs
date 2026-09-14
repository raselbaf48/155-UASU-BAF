const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const regex = /const allDays = Array\.from\(\{ length: daysInMonth \}, \(\_, i\) => i \+ 1\);\s*const activeDays = new Set\(\s*relevantAssignments\.map\(a => parseInt\(a\.date\.split\('-'\)\[2\], 10\)\)\s*\);\s*const daysArray = allDays\.filter\(day => activeDays\.has\(day\)\);/m;

content = content.replace(regex, 'const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);');
fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

const fs = require('fs');

let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const regex = /const daysInMonth = getDaysInMonth\(currentYear, currentMonth\);\s*const daysArray = Array\.from\(\{ length: daysInMonth \}, \(\_, i\) => i \+ 1\);/m;

const replacement = `const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const allDaysMatrix = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const activeDaysMatrix = new Set(
    relevantAssignments.map(a => parseInt(a.date.split('-')[2], 10))
  );
  const daysArray = allDaysMatrix.filter(day => activeDaysMatrix.has(day));`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

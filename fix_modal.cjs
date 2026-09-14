const fs = require('fs');

let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const regexFilter = /const relevantAssignments = assignments\.filter\(a => \{\s*if \(dutyId === 'IDAC'\) \{\s*return a\.dutyCode === 'IDAC' \|\| a\.dutyCode === 'IDA';\s*\}\s*return a\.dutyCode === targetType;\s*\}\);/;

const newFilter = `const relevantAssignments = assignments.filter(a => {
    if (dutyId === 'ALL') {
      return ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA'].includes(a.dutyCode);
    }
    if (dutyId === 'IDAC') {
      return a.dutyCode === 'IDAC' || a.dutyCode === 'IDA';
    }
    return a.dutyCode === targetType;
  });`;

content = content.replace(regexFilter, newFilter);

// Fix the spelling typo 
content = content.replace(/'Total Assignd Duties'/g, "'All Duties'");

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

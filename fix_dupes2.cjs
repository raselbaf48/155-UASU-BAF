const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    // For the total count, we can just deduplicate relevantAssignments first!
    const replaceFrom = `  const relevantAssignments = assignments.filter(a => {
    if (dutyId === 'ALL') {
      return ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA'].includes(a.dutyCode);
    }
    if (dutyId === 'IDAC') {
      return a.dutyCode === 'IDAC' || a.dutyCode === 'IDA';
    }
    return a.dutyCode === targetType;
  });`;

    const replaceTo = `  const rawRelevantAssignments = assignments.filter(a => {
    if (dutyId === 'ALL') {
      return ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA'].includes(a.dutyCode);
    }
    if (dutyId === 'IDAC') {
      return a.dutyCode === 'IDAC' || a.dutyCode === 'IDA';
    }
    return a.dutyCode === targetType;
  });
  
  const uniqueRelevantAssignmentsMap = new Map();
  rawRelevantAssignments.forEach(a => {
      const key = a.airmanId + '-' + a.date + '-' + a.dutyCode + '-' + (a.idaShift || '');
      if (!uniqueRelevantAssignmentsMap.has(key)) {
          uniqueRelevantAssignmentsMap.set(key, a);
      }
  });
  const relevantAssignments = Array.from(uniqueRelevantAssignmentsMap.values());
  `;

    content = content.replace(replaceFrom, replaceTo);
    fs.writeFileSync(file, content);
}

fix('src/components/DutyAnalytics.tsx');
console.log('Fixed dupes 2');

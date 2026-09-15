const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    const replaceFrom = `              const assignmentsOnDate = relevantAssignments
                .filter(a => a.airmanId === airman.id && a.date === dateStr)
                .sort((a, b) => {`;
                
    const replaceTo = `              const assignmentsOnDateRaw = relevantAssignments
                .filter(a => a.airmanId === airman.id && a.date === dateStr);
                
              const uniqueMap = new Map();
              assignmentsOnDateRaw.forEach(a => {
                  const key = a.dutyCode + '-' + (a.idaShift || '');
                  if (!uniqueMap.has(key)) {
                      uniqueMap.set(key, a);
                  }
              });
              const assignmentsOnDate = Array.from(uniqueMap.values())
                .sort((a, b) => {`;
                
    content = content.replace(replaceFrom, replaceTo);
    fs.writeFileSync(file, content);
}

fix('src/components/DutyAnalytics.tsx');
console.log('Fixed dupes');

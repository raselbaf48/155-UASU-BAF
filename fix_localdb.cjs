const fs = require('fs');

function fix(file) {
    let content = fs.readFileSync(file, 'utf8');

    const replaceFrom = `    const targetMonth = monthKey || defaultMonthKey;
    const assignments = this.db.assignments[targetMonth] || [];

    const [yStr, mStr] = targetMonth.split('-');`;

    const replaceTo = `    const targetMonth = monthKey || defaultMonthKey;
    let assignments = this.db.assignments[targetMonth] || [];

    // Deduplicate assignments
    const uniqueMap = new Map();
    assignments.forEach(a => {
        const key = a.airmanId + '-' + a.date + '-' + a.dutyCode + '-' + (a.idaShift || '');
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, a);
        }
    });
    assignments = Array.from(uniqueMap.values());

    const [yStr, mStr] = targetMonth.split('-');`;

    content = content.replace(replaceFrom, replaceTo);
    fs.writeFileSync(file, content);
}

fix('src/services/localDatabase.ts');
console.log('Fixed localDatabase');

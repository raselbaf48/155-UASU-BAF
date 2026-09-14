const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const countLogic = `
  const countWithF295Deduction = (assignments, filterFn) => {
    let count = 0;
    const groups = getGroupedList(assignments);
    for (const group of groups) {
      const first = group[0];
      if (filterFn(first)) {
        let groupDays = group.length;
        if (first.dutyCode === 'LEAVE' && first.notes) {
          const match = first.notes.match(/\\(F-295: (\\d+) Free Days\\)/);
          if (match && match[1]) {
            groupDays = Math.max(0, groupDays - parseInt(match[1], 10));
          }
        }
        count += groupDays;
      }
    }
    return count;
  };

  const gdCount = assignments.filter((a) => a.dutyCode === 'GD').length;
  const btfCount = assignments.filter((a) => a.dutyCode === 'BTF').length;
  const ntfCount = assignments.filter((a) => a.dutyCode === 'NTF').length;
  const halishaharCount = assignments.filter((a) => a.dutyCode === 'HALISHAHAR').length;
  const idacCount = assignments.filter((a) => a.dutyCode === 'IDAC' || a.dutyCode === 'IDA').length;
  const clCount = countWithF295Deduction(assignments, (a) => a.dutyCode === 'LEAVE' && ((a.notes && a.notes.toLowerCase().includes('casual')) || (a.notes && a.notes.toLowerCase().includes('cl'))));
  const alCount = countWithF295Deduction(assignments, (a) => a.dutyCode === 'LEAVE' && ((a.notes && a.notes.toLowerCase().includes('annual')) || (a.notes && a.notes.toLowerCase().includes('al'))));
  const totalLeave = countWithF295Deduction(assignments, (a) => a.dutyCode === 'LEAVE');
`;

content = content.replace(/\/\/ Duty counts[\s\S]*?const totalLeave = assignments.filter\(\(a\) => a.dutyCode === 'LEAVE'\).length;/, countLogic.trim());

// Wait, getGroupedList needs to be defined BEFORE countWithF295Deduction if we use it.
// Let's check if we can move getGroupedList up.

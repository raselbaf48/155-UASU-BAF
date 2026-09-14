const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const groupedListFn = `
  const getGroupedList = (list: any[]) => {
    if (list.length === 0) return [];
    
    // Sort by dutyCode then date to group correctly and detect duplicates
    const sorted = [...list].sort((a, b) => {
      if (a.dutyCode !== b.dutyCode) return (a.dutyCode || '').localeCompare(b.dutyCode || '');
      return a.date.localeCompare(b.date);
    });
    
    const groups = [];
    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const prev = currentGroup[currentGroup.length - 1];
      
      const currDate = new Date(current.date);
      const prevDate = new Date(prev.date);
      const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (current.dutyCode === prev.dutyCode && (diffDays === 1 || diffDays === 0) && current.notes === prev.notes) {
        if (diffDays === 1) { // avoid adding same date duplicates
          currentGroup.push(current);
        }
      } else {
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  };

  const countWithF295Deduction = (list: any[], filterFn: any) => {
    let count = 0;
    const groups = getGroupedList(list);
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
`;

content = content.replace('const formatDateRange =', groupedListFn + '\n  const formatDateRange =');

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);

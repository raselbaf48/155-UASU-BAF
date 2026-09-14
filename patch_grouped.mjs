import fs from 'fs';
const f = 'src/components/AirmanProfileModal.tsx';
let code = fs.readFileSync(f, 'utf8');

const target1 = `  const filteredList = assignments.filter((a) => {
    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'DUTY') return a.dutyCode !== 'LEAVE' && a.dutyCode !== 'TDY' && a.dutyCode !== 'ATT';
    if (categoryFilter === 'LEAVE') return a.dutyCode === 'LEAVE';
    if (categoryFilter === 'TDY') return a.dutyCode === 'TDY';
    return true;
  });`;
const rep1 = `  const filteredList = assignments.filter((a) => {
    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'DUTY') return a.dutyCode !== 'LEAVE' && a.dutyCode !== 'TDY' && a.dutyCode !== 'ATT' && a.dutyCode !== 'DETT' && a.dutyCode !== 'AIRPORT';
    if (categoryFilter === 'LEAVE') return a.dutyCode === 'LEAVE';
    if (categoryFilter === 'TDY') return a.dutyCode === 'TDY';
    if (categoryFilter === 'ATT') return a.dutyCode === 'ATT' || a.dutyCode === 'DETT' || a.dutyCode === 'AIRPORT';
    return true;
  });`;

const target2 = `  const getGroupedList = (list) => {
    if (list.length === 0) return [];
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    const groups = [];
    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const prev = currentGroup[currentGroup.length - 1];
      
      const currDate = new Date(current.date);
      const prevDate = new Date(prev.date);
      const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1 && current.dutyCode === prev.dutyCode && current.notes === prev.notes) {
        currentGroup.push(current);
      } else {
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  };`;

const rep2 = `  const getGroupedList = (list) => {
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
      
      if (diffDays === 0 && current.dutyCode === prev.dutyCode) {
        // Exact duplicate date for same duty type, ignore it
        continue;
      }
      
      if (diffDays === 1 && current.dutyCode === prev.dutyCode && current.notes === prev.notes) {
        currentGroup.push(current);
      } else {
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  };`;

if (code.includes(target1)) code = code.replace(target1, rep1);
else console.log("Target 1 not found");

if (code.includes(target2)) code = code.replace(target2, rep2);
else console.log("Target 2 not found");

fs.writeFileSync(f, code);
console.log("Patched grouping");

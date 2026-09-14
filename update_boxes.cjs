const fs = require('fs');

let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const regex = /\{\[\s*\{ id: 'GD', label: 'Base Security Duty', count: totals\.totalGD \|\| 0, color: 'red' \},\s*\{ id: 'BTF', label: 'Base Taskforce Duty', count: totals\.totalBTF \|\| 0, color: 'amber' \},\s*\{ id: 'NTF', label: 'Najirpara Taskforce', count: totals\.totalNTF \|\| 0, color: 'orange' \},\s*\{ id: 'HTF', label: 'Halishahar Taskforce', count: totals\.totalHalishahar \|\| 0, color: 'blue' \},\s*\{ id: 'AIRPORT', label: 'Airfield Duty', count: totals\.totalAirport \|\| 0, color: 'cyan' \},\s*\{ id: 'IDAC', label: 'IDAC Duty', count: totals\.totalIDAC \|\| 0, color: 'teal' \},\s*\]\.map/m;

const replacement = `{[
              { id: 'ALL', label: 'Total Assignd Duties', count: (totals.totalGD || 0) + (totals.totalBTF || 0) + (totals.totalNTF || 0) + (totals.totalHalishahar || 0) + (totals.totalIDAC || 0), color: 'emerald' },
              { id: 'GD', label: 'Base Security Duty', count: totals.totalGD || 0, color: 'red' },
              { id: 'BTF', label: 'Base Taskforce Duty', count: totals.totalBTF || 0, color: 'amber' },
              { id: 'NTF', label: 'Najirpara Taskforce', count: totals.totalNTF || 0, color: 'orange' },
              { id: 'HTF', label: 'Halishahar Taskforce', count: totals.totalHalishahar || 0, color: 'blue' },
              { id: 'IDAC', label: 'IDAC Duty', count: totals.totalIDAC || 0, color: 'teal' },
            ].map`;

content = content.replace(regex, replacement);

// There is a <button> onClick that calls setSelectedDuty(duty.id). What does setSelectedDuty do with 'ALL'?
// The modal DutyDetailsModal pops up if selectedDuty is truthy. 
// Let's modify the onClick so it doesn't try to open a modal for 'ALL' if it crashes, or maybe it works if targetType 'ALL' is supported.
// Actually, I should just make 'ALL' open nothing, or make the modal support 'ALL'.
// "All Duty Box add korba" -> I'll just change the onClick logic.

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

const fs = require('fs');
let content = fs.readFileSync('src/components/EntryHistoryModal.tsx', 'utf8');

const calcDaysLogic = `
              // Calculate number of days
              const fD = new Date(item.fromDate);
              const tD = new Date(item.toDate || item.fromDate);
              let diffDays = Math.max(1, Math.round((tD.getTime() - fD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
              
              if (item.notes && (item.dutyCode === 'LEAVE' || item.actionType === 'GRANT_LEAVE')) {
                  const match = item.notes.match(/\\(F-295: (\\d+) Free Days\\)/);
                  if (match && match[1]) {
                      diffDays = Math.max(0, diffDays - parseInt(match[1], 10));
                  }
              }
`;
content = content.replace(/\/\/ Calculate number of days[\s\S]*?const diffDays = Math.max\(1, Math.round\(\(tD.getTime\(\) - fD.getTime\(\)\) \/ \(1000 \* 60 \* 60 \* 24\)\) \+ 1\);/, calcDaysLogic.trim());

fs.writeFileSync('src/components/EntryHistoryModal.tsx', content);


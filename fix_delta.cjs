const fs = require('fs');
let content = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

const target1 = `        const changedAssignments: any[] = [];
        Object.keys(dbToSave.assignments || {}).forEach(monthKey => {`;
const replacement1 = `        const changedAssignments: any[] = [];
        const deletedAssignments: any[] = [];
        Object.keys(lastSyncedDb.assignments || {}).forEach(monthKey => {
           const prevMonth = lastSyncedDb.assignments[monthKey] || [];
           const currentMonth = dbToSave.assignments[monthKey] || [];
           prevMonth.forEach((prevA: any) => {
              const stillExists = currentMonth.find((c: any) => c.airmanId === prevA.airmanId && c.date === prevA.date && c.dutyCode === prevA.dutyCode && c.idaShift === prevA.idaShift && (c.disposalScope || 'ALL') === (prevA.disposalScope || 'ALL'));
              if (!stillExists) {
                 deletedAssignments.push(prevA);
              }
           });
        });
        
        Object.keys(dbToSave.assignments || {}).forEach(monthKey => {`;

content = content.replace(target1, replacement1);

const target2 = `        if (changedAirmen.length === 0 && changedAssignments.length === 0 && changedHistory.length === 0 && changedUsers.length === 0) {`;
const replacement2 = `        if (changedAirmen.length === 0 && changedAssignments.length === 0 && deletedAssignments.length === 0 && changedHistory.length === 0 && changedUsers.length === 0) {`;

content = content.replace(target2, replacement2);

const target3 = `        if (changedAssignments.length > 0) {
          changedAssignments.forEach((a: any) => {`;
const replacement3 = `        if (deletedAssignments.length > 0) {
           const deletedIds = deletedAssignments.map((a: any) => a.id || ('asn_' + a.airmanId + '_' + a.date + '_' + (a.dutyCode || 'u') + '_' + (a.idaShift || 'n') + '_' + (a.disposalScope || 'ALL')));
           
           // Break deletes into chunks
           const delChunkSize = 100;
           for (let i = 0; i < deletedIds.length; i += delChunkSize) {
              const chunk = deletedIds.slice(i, i + delChunkSize);
              supabase.from('duty_rosters').delete().in('assignment_id', chunk).then(({error}) => {
                 if (error) console.error("Error deleting old duties:", error);
              });
           }
        }
        
        if (changedAssignments.length > 0) {
          changedAssignments.forEach((a: any) => {`;

content = content.replace(target3, replacement3);

fs.writeFileSync('src/services/localDatabase.ts', content);

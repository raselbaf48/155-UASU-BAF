const fs = require('fs');
let content = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

const target1 = `        if (deletedAssignments.length > 0) {
           const deletedIds = deletedAssignments.map((a: any) => a.id || ('asn_' + a.airmanId + '_' + a.date + '_' + (a.dutyCode || 'u') + '_' + (a.idaShift || 'n') + '_' + (a.disposalScope || 'ALL')));
           
           // Break deletes into chunks
           const delChunkSize = 100;
           for (let i = 0; i < deletedIds.length; i += delChunkSize) {
              const chunk = deletedIds.slice(i, i + delChunkSize);
              supabase.from('duty_rosters').delete().in('assignment_id', chunk).then(({error}) => {
                 if (error) console.error("Error deleting old duties:", error);
              });
           }
        }`;
const replacement1 = `        if (deletedAssignments.length > 0) {
           const deletedIds = deletedAssignments.map((a: any) => a.id || ('asn_' + a.airmanId + '_' + a.date + '_' + (a.dutyCode || 'u') + '_' + (a.idaShift || 'n') + '_' + (a.disposalScope || 'ALL')));
           
           // Break deletes into chunks
           const delChunkSize = 100;
           for (let i = 0; i < deletedIds.length; i += delChunkSize) {
              const chunk = deletedIds.slice(i, i + delChunkSize);
              // Wait for delete to complete before continuing
              const { error } = await supabase.from('duty_rosters').delete().in('assignment_id', chunk);
              if (error) console.error("Error deleting old duties:", error);
           }
        }`;

content = content.replace(target1, replacement1);
fs.writeFileSync('src/services/localDatabase.ts', content);

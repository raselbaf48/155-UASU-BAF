const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// Replace getUniqueCount
const oldGetUnique = `const getUniqueCount = (id: string) => {
        const assignmentsForId = relevantAssignments.filter(x => x.airmanId === id);
        if (dutyId === 'IDAC' || dutyId === 'ALL') {
          return assignmentsForId.length;
        }
        return new Set(assignmentsForId.map(x => x.date)).size;
      };`;

const newGetUnique = `const getUniqueCount = (id: string) => {
        return relevantAssignments.filter(x => x.airmanId === id).length;
      };`;
content = content.replace(oldGetUnique, newGetUnique);

// Replace cell count render
const oldCellCount = `{(dutyId === 'IDAC' || dutyId === 'ALL') 
                          ? relevantAssignments.filter(a => a.airmanId === airman.id).length 
                          : new Set(relevantAssignments.filter(a => a.airmanId === airman.id).map(a => a.date)).size}`;

const newCellCount = `{relevantAssignments.filter(a => a.airmanId === airman.id).length}`;
content = content.replace(oldCellCount, newCellCount);

// Wait, the cell rendering for the date
// Currently it is:
/*
{assignmentsOnDate.length > 0 ? (
  <div className="w-full h-full min-h-[30px] flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/20" title={assignmentsOnDate.map(a => a.dutyCode).join(', ')}>
    {assignmentsOnDate.map((a, i) => {
      let label = a.dutyCode;
      if (dutyId === 'IDAC' || dutyId === 'ALL') {
        if (a.dutyCode === 'IDAC') label = 'IDAC-A';
        else if (a.dutyCode === 'IDA') label = 'IDAC-B';
        else label = label.substring(0, 3);
      } else {
        label = label.substring(0, 3);
      }
      return (
        <span key={i} className="text-[9px] leading-tight font-black text-emerald-700 dark:text-emerald-400">
          {label}
        </span>
      );
    })}
  </div>
) : null}
*/
// Let's modify the IDAC labeling to handle "IDAC-C".
// The user says "IDAC- A & C", so if it's IDAC it's A, if it's IDA maybe it's C. Or if they add a shift manually?
// Right now, if they enter "IDA" it shows "IDAC-B". I will change "IDAC-B" to "IDAC-C" if they want, but the user says "IDAC- A & C" or "IDAC- A, IDAC- B". I will just output the duty code directly if it's not IDAC or IDA. For IDA I'll show IDAC-B/C. Let's just show IDA as IDAC-C? The user said "IDAC- A, IDAC- B" for single shift, and "IDAC- A & C" for double. I'll just change 'IDA' to 'IDAC-B/C' or leave it as IDAC-C. Actually let's just use what they type.
// But the UI already stacks ANY assignmentsOnDate vertically because of the flex-col. So GD & IDAC will show as GD and IDAC-A vertically!

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

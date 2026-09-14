const fs = require('fs');

let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const oldFilter = `  const dutyAirmen = airmen
    .filter(a => {
      if (!a.active) return false;
      const hasDoneIt = uniqueAirmanIds.includes(a.id);
      if (hasDoneIt) return true;
      if (isHeavyDuty && ['MWO', 'SWO', 'WO'].includes(a.rank)) return false;
      return true;
    })`;

const newFilter = `  const dutyAirmen = airmen
    .filter(a => {
      if (!a.active) return false;
      // ONLY show airmen who have ACTUALLY done the duty this month
      return uniqueAirmanIds.includes(a.id);
    })`;

content = content.replace(oldFilter, newFilter);
fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

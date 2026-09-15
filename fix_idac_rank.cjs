const fs = require('fs');
let ui = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

ui = ui.replace(/\$\{air\.rank\}/g, "${formatRank(air.rank)}");
fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', ui);
console.log("Done")

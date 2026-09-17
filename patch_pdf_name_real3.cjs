const fs = require('fs');
let code = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

const regex = /const dateLabel = format\(monthDate, 'MMM yyyy'\);/g;
const replacement = `const dateLabel = format(monthDate, 'MMM yyyy');
    const customFileName = \`Duty Roster - \${userFlight === 'Overall' ? '155 UASU BAF' : userFlight + ' Flt'} (\${dateLabel}).docx\`;`;

// actually, let's just make the changes needed


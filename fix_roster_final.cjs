const fs = require('fs');
let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

content = content.replace("  return (\n    <>  return (\n    <div className=\"duty-register-print space-y-6\">", "  return (\n    <div className=\"duty-register-print space-y-6\">");

fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', content);

const fs = require('fs');
let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

content = content.replace("      )}\n    </>\n  );\n};", "      )}\n    </div>\n  );\n};");

fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', content);

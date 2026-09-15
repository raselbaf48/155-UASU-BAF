const fs = require('fs');
let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

content = content.replace("    </div>\n    </>\n  );\n\n  const renderDocument", "    </>\n  );\n\n  const renderDocument");

fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', content);

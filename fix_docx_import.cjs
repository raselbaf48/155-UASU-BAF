const fs = require('fs');
let content = fs.readFileSync('src/utils/docxExport.ts', 'utf8');
content = content.replace("import { saveAs }", "import { addAssignmentToMap, resolveAirmanDutyForDate } from '../data/rosterGenerator';\nimport { saveAs }");
fs.writeFileSync('src/utils/docxExport.ts', content);

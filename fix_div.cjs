const fs = require('fs');

let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

content = content.replace('</div>/div>', '</div>\n        </div>');

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

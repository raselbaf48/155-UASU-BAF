const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const regex = /<\/button>\s*<\/div>\s*<Calendar className="w-4 h-4" \/>\s*<span>\{monthNames\[currentMonth - 1\]\} \{currentYear\}<\/span>\s*<\/button>\s*/;
content = content.replace(regex, '</button>\n            </div>\n');

// There is another syntax error at line 266. Let's see what it is.
fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

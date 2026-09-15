const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// replace tableContent with a function renderTableContent()
content = content.replace(/const tableContent = \(/, 'const renderTableContent = () => (');
content = content.replace(/<\/table>\n  \);/, '</table>\n  );');

content = content.replace(/\) : tableContent\}/, ') : renderTableContent()}');
content = content.replace(/\{tableContent\}/, '{renderTableContent()}');

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

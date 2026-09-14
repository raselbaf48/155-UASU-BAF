const fs = require('fs');
let content = fs.readFileSync('src/data/rosterGenerator.ts', 'utf8');

const regex = /    \}\);\s*\}\s*\}\);\s*\} else \{/m;
content = content.replace(regex, '  } else {');
fs.writeFileSync('src/data/rosterGenerator.ts', content);

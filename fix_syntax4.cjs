const fs = require('fs');
let content = fs.readFileSync('src/data/rosterGenerator.ts', 'utf8');

const regex = /        \}\n    \}\);\n  \} else \{/m;
content = content.replace(regex, '        }\n      }\n    });\n  } else {');
fs.writeFileSync('src/data/rosterGenerator.ts', content);

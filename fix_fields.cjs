const fs = require('fs');
let content = fs.readFileSync('src/data/rosterGenerator.ts', 'utf8');

const regex = /          case 'SICK':\s*stat\.totalSick\+\+;\s*break;\s*case 'ATT':\s*stat\.totalAtt\+\+;\s*break;\s*case 'CANTEEN':\s*stat\.totalCanteen\+\+;\s*break;/;

content = content.replace(regex, '');

fs.writeFileSync('src/data/rosterGenerator.ts', content);

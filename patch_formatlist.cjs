const fs = require('fs');
let code = fs.readFileSync('src/components/ParadeStateFormattedView.tsx', 'utf8');

const oldFormat = `const formatListStr = (items: typeof pList) =>
        items.length > 0
          ? items
              .map(
                (it, idx) =>
                  \`\${idx + 1}. \${formatAirmanName(it.airman.rank)} \${formatAirmanName(it.airman.name)}\`
              )
              .join('\\n')
          : '-';`;

const newFormat = `const formatListStr = (items: typeof pList, showNotes: boolean = false) =>
        items.length > 0
          ? items
              .map(
                (it, idx) =>
                  \`\${idx + 1}. \${formatAirmanName(it.airman.rank)} \${formatAirmanName(it.airman.name)}\${showNotes && it.notes && it.notes !== 'None' ? ' - ' + it.notes : ''}\`
              )
              .join('\\n')
          : '-';`;

code = code.replace(oldFormat, newFormat);
code = code.replace("dutyOff: formatListStr(dutyOff),", "dutyOff: formatListStr(dutyOff, true),");
fs.writeFileSync('src/components/ParadeStateFormattedView.tsx', code);

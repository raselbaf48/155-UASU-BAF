const fs = require('fs');
let psCode = fs.readFileSync('src/features/canteen/pages/PosSales.tsx', 'utf8');

const regex = /\{\/\* Success Modal \*\/\}([\s\S]*?)<\/div>\s*\)\}\s*<\/>/;

psCode = psCode.replace(regex, "</div>\n    )}\n    </>");

fs.writeFileSync('src/features/canteen/pages/PosSales.tsx', psCode);

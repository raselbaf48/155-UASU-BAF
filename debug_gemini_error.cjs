const fs = require('fs');
const path = 'server.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/console.warn\(\`Gemini API 503 error, retrying\.\.\. \(\\\$\\{retries\\} retries left\)\`\);/g, "console.warn(`Gemini API 503 error, retrying... (\${retries} retries left)`, err);");
fs.writeFileSync(path, content);

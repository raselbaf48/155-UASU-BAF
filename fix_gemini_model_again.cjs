const fs = require('fs');

const path = 'server.ts';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  content = content.replace(/model: 'gemini-2\.5-flash',/g, "model: 'gemini-3.6-flash',");
  fs.writeFileSync(path, content);
}

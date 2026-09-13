const fs = require('fs');

const path = 'server.ts';
if (fs.existsSync(path)) {
  let content = fs.readFileSync(path, 'utf8');
  
  const target = `              } else {
                throw err;
              }`;
              
  const replace = `              } else {
                console.warn("AI Parsing failed, falling back to heuristic:", err);
                break; // Break the retry loop and fall back to heuristics
              }`;
              
  content = content.replace(target, replace);
  fs.writeFileSync(path, content);
}

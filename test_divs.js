const fs = require('fs');
let code = fs.readFileSync('form_debug.tsx', 'utf8');

let depth = 0;
let lines = code.split('\n');
for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    let opens = (line.match(/<div/g) || []).length;
    let closes = (line.match(/<\/div/g) || []).length;
    depth += opens - closes;
    if (opens > 0 || closes > 0) {
        console.log(`Line ${i+1}: +${opens} -${closes} | Depth: ${depth} | ${line.trim().substring(0, 50)}`);
    }
}
console.log("Final depth:", depth);

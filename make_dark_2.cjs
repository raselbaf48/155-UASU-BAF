const fs = require('fs');
const path = require('path');

function replaceLightWithDark(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceLightWithDark(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let code = fs.readFileSync(fullPath, 'utf8');
      
      code = code.replace(/isEmployee \? "text-slate-900" : "text-white dark:text-white"/g, '"text-white dark:text-white"');
      code = code.replace(/isEmployee \? "text-slate-900" : "text-white"/g, '"text-white"');
      code = code.replace(/text-slate-900/g, 'text-white');
      
      // Let's also find bg-[#f8fafc] and change to bg-slate-950
      code = code.replace(/bg-\[\#f8fafc\]/g, 'bg-slate-950');
      
      fs.writeFileSync(fullPath, code);
    }
  }
}

replaceLightWithDark('src/features/canteen');
console.log('Replaced more');

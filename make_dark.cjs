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
      
      // Some common patterns:
      // isEmployee ? "bg-white" : "bg-slate-900"
      code = code.replace(/isEmployee \? "bg-white" : "bg-\[\#f8fafc\] dark:bg-\[\#0b1120\]"/g, '"bg-slate-950"');
      code = code.replace(/isEmployee \? "bg-white border-slate-100" : "bg-slate-900 dark:bg-slate-900 border-slate-700 dark:border-slate-800"/g, '"bg-slate-950 border-slate-800"');
      code = code.replace(/isEmployee \? "bg-white" : "bg-slate-900"/g, '"bg-slate-900"');
      code = code.replace(/isEmployee \? "text-slate-600 bg-slate-100" : "text-slate-400 bg-slate-800"/g, '"text-slate-400 bg-slate-800"');
      code = code.replace(/bg-rose-50/g, 'bg-rose-900/30');
      code = code.replace(/bg-emerald-50/g, 'bg-emerald-900/30');
      code = code.replace(/border-emerald-100/g, 'border-emerald-800/50');
      code = code.replace(/bg-blue-50 /g, 'bg-blue-900/30 ');
      code = code.replace(/bg-white/g, 'bg-slate-900');
      code = code.replace(/text-slate-800/g, 'text-white');
      code = code.replace(/text-slate-700/g, 'text-slate-200');
      code = code.replace(/text-slate-600/g, 'text-slate-400');
      code = code.replace(/text-slate-500/g, 'text-slate-400');
      code = code.replace(/border-slate-200/g, 'border-slate-800');
      code = code.replace(/border-slate-100/g, 'border-slate-800');
      code = code.replace(/bg-slate-50/g, 'bg-slate-950');
      code = code.replace(/bg-slate-100/g, 'bg-slate-800');
      code = code.replace(/text-gray-800/g, 'text-white');
      code = code.replace(/text-gray-600/g, 'text-slate-400');
      code = code.replace(/bg-gray-50/g, 'bg-slate-950');
      code = code.replace(/bg-indigo-50/g, 'bg-indigo-900/30');
      code = code.replace(/text-indigo-900/g, 'text-indigo-200');
      code = code.replace(/text-indigo-700/g, 'text-indigo-400');
      code = code.replace(/text-emerald-700/g, 'text-emerald-400');
      code = code.replace(/text-rose-700/g, 'text-rose-400');
      code = code.replace(/text-emerald-800/g, 'text-emerald-300');
      code = code.replace(/text-rose-800/g, 'text-rose-300');
      
      fs.writeFileSync(fullPath, code);
    }
  }
}

replaceLightWithDark('src/features/canteen');
console.log('Replaced');

const fs = require('fs');
let modal = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

// Remove TDY Remarks input
modal = modal.replace(
  /\{\/\*\s*Remarks\s*\*\/\}\s*<div>\s*<label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">\s*Remarks \(Optional\)\s*<\/label>\s*<input[^>]+value=\{editTdyRemarks\}[^>]+>\s*<\/div>/g,
  ''
);

// Remove Deployment Remarks input
modal = modal.replace(
  /\{\/\*\s*Remarks\s*\*\/\}\s*<div>\s*<label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">\s*Remarks \(Optional\)\s*<\/label>\s*<input[^>]+value=\{editNotes\}[^>]+>\s*<\/div>/g,
  ''
);

// We should also look for anything else that might have it without the comment
modal = modal.replace(
  /<div[^>]*>\s*<label[^>]*>\s*Remarks \(Optional\)\s*<\/label>\s*<input[^>]*value=\{editTdyRemarks\}[^>]*>\s*<\/div>/g,
  ''
);

modal = modal.replace(
  /<div[^>]*>\s*<label[^>]*>\s*Remarks \(Optional\)\s*<\/label>\s*<input[^>]*value=\{editNotes\}[^>]*>\s*<\/div>/g,
  ''
);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', modal);

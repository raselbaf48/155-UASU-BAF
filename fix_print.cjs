const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

// Add Printer to imports
const importRegex = /import \{ (.*?) \} from 'lucide-react';/;
content = content.replace(importRegex, (match, p1) => {
  if (!p1.includes('Printer')) {
    return `import { ${p1}, Printer } from 'lucide-react';`;
  }
  return match;
});

// Add print button
const headerRegex = /<button onClick=\{onClose\} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">/;
const replacement = `<button onClick={() => window.print()} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors print:hidden" title="Print Matrix">
            <Printer className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors print:hidden">`;
content = content.replace(headerRegex, replacement);

// We should also add print-specific styles to hide the header/sidebar in print mode, and format the modal
// Actually, window.print() might print the whole page. If the user only wants the modal, it's better to add some global CSS or tailwind print modifiers.
// We can just add print:hidden to elements that shouldn't print.
// For now, let's just add the print button.

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const regex = /<button onClick=\{\(\) => window\.print\(\)\}[\s\S]*?<\/button>\s*<button onClick=\{onClose\}[\s\S]*?<\/button>/m;

const replacement = `<div className="flex items-center space-x-2">
            <button onClick={() => window.print()} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors print:hidden" title="Print Matrix">
              <Printer className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors print:hidden" title="Close">
              <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </button>
          </div>`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

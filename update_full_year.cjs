const fs = require('fs');

let content = fs.readFileSync('src/components/MonthlyDutyRegister.tsx', 'utf8');

const regex = /<button\s*onClick=\{\(\) => setOnlyHolidaysFilter\(\!onlyHolidaysFilter\)\}\s*className=\{`flex items-center space-x-2 px-4 py-1\.5 rounded-full text-xs font-bold border transition-all \$\{[\s\S]*?\}\`\}\s*title="Filter to show only Friday\/Saturday and designated official holidays"\s*>\s*<span>\{onlyHolidaysFilter \? '🏖️ Holidays Only' \: '📅 All Days'\}<\/span>\s*<\/button>/;

const replacement = `<div className="flex items-center space-x-2">
            <button
              onClick={() => setIsFullYearView(!isFullYearView)}
              className={\`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-bold border transition-all \${
                isFullYearView
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
              }\`}
              title="Toggle Full Year View"
            >
              <span>{isFullYearView ? '⭐ Full Year' : '⭐ Full Year'}</span>
            </button>
            <button
              onClick={() => setOnlyHolidaysFilter(!onlyHolidaysFilter)}
              className={\`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-bold border transition-all \${
                onlyHolidaysFilter
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
              }\`}
              title="Filter to show only Friday/Saturday and designated official holidays"
            >
              <span>{onlyHolidaysFilter ? '🏖️ Holidays Only' : '📅 All Days'}</span>
            </button>
          </div>`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/components/MonthlyDutyRegister.tsx', content);

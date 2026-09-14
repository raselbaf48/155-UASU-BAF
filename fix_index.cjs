const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const regex = /<td className="px-3 py-2 font-bold text-slate-500 text-center border-r border-slate-200 dark:border-slate-700">\s*\{airman\.serNo \|\| index \+ 1\}\s*<\/td>/;

content = content.replace(regex, `<td className="px-3 py-2 font-bold text-slate-500 text-center border-r border-slate-200 dark:border-slate-700">
                      {index + 1}
                    </td>`);

// And for Name autofit, verify that the table has w-full but maybe table-layout: auto is better. 
// Right now it's: <table className="w-full text-left text-xs border-collapse min-w-max">
// Let's add table-auto if not there. Let's see what's in the table class.
const tableClassOld = `<table className="w-full text-left text-xs border-collapse min-w-max">`;
const tableClassNew = `<table className="w-full table-auto text-left text-xs border-collapse min-w-max">`;
content = content.replace(tableClassOld, tableClassNew);

// And we can ensure the Name th has white-space: nowrap (which it does: w-max whitespace-nowrap). 
// Let's also make sure the Name td has whitespace-nowrap so it doesn't wrap. The button has it, but it might be safe to put on the td.
const tdNameOld = `<td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700">
                      <button`;
const tdNameNew = `<td className="px-3 py-2 border-r border-slate-200 dark:border-slate-700 whitespace-nowrap w-max">
                      <button`;
content = content.replace(tdNameOld, tdNameNew);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

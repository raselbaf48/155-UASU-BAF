const fs = require('fs');
let content = fs.readFileSync('src/components/TdyRegisterView.tsx', 'utf8');

content = content.replace(
  '<th className="py-3 px-4 text-center">Current Status</th>',
  '<th className="py-3 px-4 text-center">Destination</th>\n                <th className="py-3 px-4 text-center">Current Status</th>'
);

content = content.replace(
  '<td className="py-3 px-4 text-center">\n                        {rec.currentlyOnTdy ? (',
  '<td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300 font-bold">\n                        {rec.currentlyOnTdy ? (rec.currentTdyLocation || \'Outstation\') : \'-\'}\n                      </td>\n                      <td className="py-3 px-4 text-center">\n                        {rec.currentlyOnTdy ? ('
);

fs.writeFileSync('src/components/TdyRegisterView.tsx', content);

const fs = require('fs');

let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const regex1 = /const uniqueAirmanIds = Array\.from\(new Set\(relevantAssignments\.map\(a => a\.airmanId\)\)\);\s*const dutyAirmen = airmen\s*\.filter\(a => uniqueAirmanIds\.includes\(a\.id\)\)\s*\.sort\(\(a, b\) => a\.serNo - b\.serNo\);/g;

const replace1 = `const uniqueAirmanIds = Array.from(new Set(relevantAssignments.map(a => a.airmanId)));
  const isHeavyDuty = ['GD', 'BTF', 'NTF', 'AIRPORT', 'HALISHAHAR', 'IDAC'].includes(dutyId);
  const dutyAirmen = airmen
    .filter(a => {
      if (!a.active) return false;
      const hasDoneIt = uniqueAirmanIds.includes(a.id);
      if (hasDoneIt) return true;
      if (isHeavyDuty && ['MWO', 'SWO', 'WO'].includes(a.rank)) return false;
      return true;
    })
    .sort((a, b) => {
      const aCount = relevantAssignments.filter(x => x.airmanId === a.id).length;
      const bCount = relevantAssignments.filter(x => x.airmanId === b.id).length;
      if (bCount !== aCount) return bCount - aCount;
      return a.serNo - b.serNo;
    });`;

content = content.replace(regex1, replace1);

const regexTh = /<th className="px-3 py-2\.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 w-16 text-center">Flt<\/th>/;
const replaceTh = `<th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 w-16 text-center">Flt</th>
                  <th className="px-3 py-2.5 font-black text-emerald-600 dark:text-emerald-400 border-b border-r border-slate-200 dark:border-slate-700 w-16 text-center">Total</th>`;

content = content.replace(regexTh, replaceTh);

const regexTdName = /<button \s*onClick=\{\(\) => \{ onClose\(\); onViewProfile\(airman\); \}\}\s*className="font-black text-slate-900 dark:text-slate-100 hover:text-emerald-600 whitespace-nowrap"\s*>/;
const replaceTdName = `<button 
                        onClick={() => { onClose(); onViewProfile(airman, { initialTab: 'history', initialCategory: dutyId }); }}
                        className="font-black text-slate-900 dark:text-slate-100 hover:text-emerald-600 whitespace-nowrap"
                        title={\`Click to view \${dutyId} history\`}
                      >`;

content = content.replace(regexTdName, replaceTdName);

const regexTdFlt = /<td className="px-3 py-2 text-center border-r border-slate-200 dark:border-slate-700">\s*<span className="text-\[10px\] font-bold px-1\.5 py-0\.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">\s*\{airman\.flightName\.substring\(0, 3\)\.toUpperCase\(\)\}\s*<\/span>\s*<\/td>/;
const replaceTdFlt = `<td className="px-3 py-2 text-center border-r border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {airman.flightName.substring(0, 3).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center border-r border-slate-200 dark:border-slate-700">
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {relevantAssignments.filter(a => a.airmanId === airman.id).length}
                      </span>
                    </td>`;

content = content.replace(regexTdFlt, replaceTdFlt);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

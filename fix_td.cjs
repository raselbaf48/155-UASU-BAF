const fs = require('fs');
let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const regex = /<td className="py-2\.5 px-3\.5">\s*<span\s*className=\{`px-2 py-0\.5 rounded font-black text-\[10px\] \$\{\s*typeInfo\?\.badgeBg \|\| 'bg-slate-100'\s*\}\ \$\{typeInfo\?\.badgeText \|\| 'text-slate-800'\}`\}\s*>\s*\{typeInfo\?\.name \|\| item\.dutyCode\}\s*<\/span>\s*<\/td>\s*<td className="py-2\.5 px-3\.5 font-semibold text-slate-600 dark:text-slate-400">\s*\{item\.shift \|\| '-'\}\s*<\/td>\s*<td className="py-2\.5 px-3\.5 text-slate-600 dark:text-slate-400">\s*\{item\.notes \|\| '-'\}\s*<\/td>/m;

const replacement = `{isDutyMatrixMode ? (
                                <td className="py-2.5 px-3.5 font-semibold text-slate-600 dark:text-slate-400">
                                  {new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                </td>
                              ) : (
                                <>
                                  <td className="py-2.5 px-3.5">
                                    <span
                                      className={\`px-2 py-0.5 rounded font-black text-[10px] \${
                                        typeInfo?.badgeBg || 'bg-slate-100'
                                      } \${typeInfo?.badgeText || 'text-slate-800'}\`}
                                    >
                                      {typeInfo?.name || item.dutyCode}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3.5 font-semibold text-slate-600 dark:text-slate-400">
                                    {item.shift || '-'}
                                  </td>
                                  <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-400">
                                    {item.notes || '-'}
                                  </td>
                                </>
                              )}`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);

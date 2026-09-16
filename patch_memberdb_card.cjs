const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/MemberDB.tsx', 'utf8');

const oldCardRegex = /<div className="flex items-start justify-between mb-6">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\)\)}/m;

const newCard = `<div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                         <div className="w-14 h-14 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-black text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                            {(member['Surname'] || 'U').charAt(0)}
                         </div>
                         <div>
                            <h3 className="font-black text-white text-base leading-tight mt-0.5">{member['Rank']} {member['Surname']}</h3>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-0.5">TOTAL DUE</p>
                         <p className={\`text-2xl font-black tracking-tighter leading-none \${member.baki === 0 ? 'text-emerald-500' : 'text-rose-500'}\`}>
                            ৳{member.baki || 0}
                         </p>
                      </div>
                   </div>
                </div>
             ))}`;

code = code.replace(oldCardRegex, newCard);

const classToReplace = "className={`bg-slate-900 rounded-[2rem] p-6 border-2 shadow-sm transition-all cursor-pointer hover:shadow-md hover:border-indigo-500/50 ${i === 0 ? 'border-[#4f46e5]' : 'border-slate-800'}`}";
const newClass = "className={`bg-slate-900 rounded-[2rem] p-6 border transition-all duration-300 cursor-pointer hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(79,70,229,0.3)] hover:border-indigo-500/50 group ${i === 0 ? 'border-[#4f46e5]' : 'border-slate-800'}`}";

code = code.replace(classToReplace, newClass);

fs.writeFileSync('src/features/canteen/pages/MemberDB.tsx', code);

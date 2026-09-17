const fs = require('fs');
const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

const target = `{showMemberDropdown && (
                           <div className="absolute z-50 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
                               {members.filter(m => {
                                   const name = m['Surname'] || '';
                                   const bd = m['BD No'] || '';
                                   return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || String(bd).includes(memberSearchTerm);
                               }).slice(0, 10).map(m => (
                                   <div 
                                       key={m.airman_id} 
                                       onMouseDown={(e) => {
                                           e.preventDefault();
                                           if (!selectedMembers.find(sm => sm.airman_id === m.airman_id)) {
                                               setSelectedMembers([...selectedMembers, m]);
                                           }
                                           setMemberSearchTerm('');
                                           setShowMemberDropdown(false);
                                       }}
                                       className="px-4 py-2 hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-700/50 last:border-0 transition-colors"
                                   >
                                       <div>
                                           <p className="text-xs font-bold text-white">{m['Rank']} {m['Surname']}</p>
                                           <p className="text-[10px] text-slate-400">BD: {m['BD No']}</p>
                                       </div>
                                       <Plus className="w-3 h-3 text-slate-400" />
                                   </div>
                               ))}
                           </div>
                       )}`;

const replace = `{showMemberDropdown && (
                       <div className="absolute left-0 right-0 top-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-50">
                           {members.filter(m => {
                               const name = m['Surname'] || '';
                               const bd = m['BD No'] || '';
                               return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || String(bd).includes(memberSearchTerm);
                           }).slice(0, 10).map(m => (
                               <div 
                                   key={m.airman_id} 
                                   onMouseDown={(e) => {
                                       e.preventDefault();
                                       if (!selectedMembers.find(sm => sm.airman_id === m.airman_id)) {
                                           setSelectedMembers([...selectedMembers, m]);
                                       }
                                       setMemberSearchTerm('');
                                       setShowMemberDropdown(false);
                                   }}
                                   className="px-4 py-3 hover:bg-slate-700 cursor-pointer flex items-center justify-between border-b border-slate-700/50 last:border-0 transition-colors"
                               >
                                   <div>
                                       <p className="text-xs font-bold text-white">{m['Rank']} {m['Surname']}</p>
                                       <p className="text-[10px] text-slate-400">BD: {m['BD No']}</p>
                                   </div>
                                   <Plus className="w-4 h-4 text-slate-400" />
                               </div>
                           ))}
                           {memberSearchTerm !== '' && members.filter(m => {
                               const name = m['Surname'] || '';
                               const bd = m['BD No'] || '';
                               return name.toLowerCase().includes(memberSearchTerm.toLowerCase()) || String(bd).includes(memberSearchTerm);
                           }).length === 0 && (
                               <div className="px-4 py-3 text-xs text-slate-400 text-center">No members found</div>
                           )}
                       </div>
                   )}`;
                   
code = code.replace(target, replace);
fs.writeFileSync(mgrFile, code);

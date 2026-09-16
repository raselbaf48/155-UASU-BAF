const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/MemberDB.tsx', 'utf8');

// 1. Add new state for the Profile tab
if (!code.includes('profileTab')) {
    code = code.replace(
        /const \[statementTx, setStatementTx\] = useState<any\[\]>\(\[\]\);/,
        `const [statementTx, setStatementTx] = useState<any[]>([]);\n  const [profileTab, setProfileTab] = useState<'profile' | 'history'>('profile');`
    );
}

// 2. Remove the old Statement Modal entirely and replace with Profile Modal
const statementModalStart = '{statementMember && (';
const statementModalEndIndex = code.indexOf('const BanknoteIcon');
const beforeModal = code.substring(0, code.indexOf(statementModalStart));
const afterModal = code.substring(statementModalEndIndex);

const newModal = `{statementMember && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-[2rem] w-full max-w-2xl shadow-xl animate-in zoom-in-95 max-h-[90vh] flex flex-col overflow-hidden border border-slate-800 print:border-none print:shadow-none print:bg-white print:max-h-none print:max-w-none">
               
               {/* Modal Header (Hidden on print) */}
               <div className="p-6 border-b border-slate-800 flex flex-col print:hidden">
                  <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                          <div className="w-14 h-14 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-black text-2xl shadow-sm">
                              {(statementMember['Surname'] || 'U').charAt(0)}
                          </div>
                          <div>
                              <h2 className="text-xl font-black text-white">{statementMember['Rank']} {statementMember['Surname']}</h2>
                              <p className="text-xs font-bold text-indigo-400">BD No: {statementMember['BD No']}</p>
                          </div>
                      </div>
                      <div className="flex items-center space-x-2">
                          <button onClick={() => { handleEdit(statementMember); setStatementMember(null); }} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors" title="Edit Member">
                              <Edit2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => { setDeleteConfirmId(statementMember.airman_id); setStatementMember(null); }} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors" title="Delete Member">
                              <Trash2 className="w-5 h-5" />
                          </button>
                          <button onClick={() => setStatementMember(null)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors ml-2" title="Close">
                              <X className="w-5 h-5" />
                          </button>
                      </div>
                  </div>
                  
                  {/* Tabs */}
                  <div className="flex space-x-6 border-b border-slate-800">
                      <button onClick={() => setProfileTab('profile')} className={\`pb-3 text-xs font-black tracking-widest uppercase transition-colors \${profileTab === 'profile' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}\`}>Profile</button>
                      <button onClick={() => setProfileTab('history')} className={\`pb-3 text-xs font-black tracking-widest uppercase transition-colors \${profileTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}\`}>History</button>
                  </div>
               </div>

               {/* Content Area */}
               <div className="p-6 overflow-y-auto bg-slate-900/50 flex-1 print:p-0 print:bg-white print:overflow-visible">
                   
                   {/* Normal UI View (Hidden on print) */}
                   <div className="print:hidden">
                       {profileTab === 'profile' ? (
                           <div className="space-y-6">
                               <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact</p>
                                      <p className="text-sm font-bold text-white">{statementMember['Contact'] || 'N/A'}</p>
                                  </div>
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Baki</p>
                                      <p className={\`text-2xl font-black \${statementMember.baki === 0 ? 'text-emerald-500' : 'text-rose-500'}\`}>৳{statementMember.baki || 0}</p>
                                  </div>
                               </div>
                           </div>
                       ) : (
                           <div className="space-y-4">
                               <div className="flex items-center justify-between mb-4">
                                   <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Transaction History</h3>
                                   <button onClick={() => window.print()} className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 rounded-lg text-[10px] font-black tracking-widest uppercase transition-colors shadow-sm">
                                      <Printer className="w-3 h-3" />
                                      <span>Statement</span>
                                   </button>
                               </div>
                               
                               <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                   <table className="w-full text-left text-xs text-slate-300">
                                       <thead className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-700">
                                           <tr>
                                               <th className="px-4 py-3">Ser No</th>
                                               <th className="px-4 py-3">Date</th>
                                               <th className="px-4 py-3">Description</th>
                                               <th className="px-4 py-3 text-right">Amount</th>
                                           </tr>
                                       </thead>
                                       <tbody>
                                           {statementTx.length === 0 ? (
                                               <tr>
                                                   <td colSpan={4} className="px-4 py-8 text-center text-slate-500 font-bold">No history found</td>
                                               </tr>
                                           ) : (
                                               statementTx.map((tx, idx) => (
                                                   <tr key={tx.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20">
                                                       <td className="px-4 py-3 font-medium">{idx + 1}</td>
                                                       <td className="px-4 py-3">{tx.date}</td>
                                                       <td className="px-4 py-3">{tx.items}</td>
                                                       <td className="px-4 py-3 text-right font-black text-white">৳{tx.amount}</td>
                                                   </tr>
                                               ))
                                           )}
                                       </tbody>
                                   </table>
                               </div>
                           </div>
                       )}
                   </div>

                   {/* Statement Paper (Only visible on print) */}
                   <div className="hidden print:block" id="statement-paper">
                       <div className="text-center mb-4 text-black">
                           <h2 className="text-xl font-black text-black">🍽️ CAFE UAV 🍽️</h2>
                           <p className="text-sm font-bold text-black border-b border-black inline-block px-2 pb-0.5 mt-1">মাসিক বিল বিবরণী</p>
                       </div>
                       
                       <table className="w-full border-collapse border border-black text-xs font-bold text-black text-center mb-8">
                           <tbody>
                               <tr>
                                   <td className="border border-black p-2 text-left w-1/3">মাসের নাম</td>
                                   <td className="border border-black p-2" colSpan={3}>চলতি মাস</td>
                               </tr>
                               <tr>
                                   <td className="border border-black p-2 text-left">পদবী ও নাম</td>
                                   <td className="border border-black p-2" colSpan={3}>{statementMember['Rank']} {statementMember['Surname']} ({statementMember['BD No']})</td>
                               </tr>
                               <tr className="bg-gray-100">
                                   <td className="border border-black p-2">তারিখ</td>
                                   <td className="border border-black p-2" colSpan={2}>বিবরণ</td>
                                   <td className="border border-black p-2">টাকা</td>
                               </tr>
                               
                               {statementTx.length === 0 ? (
                                   <tr>
                                       <td className="border border-black p-2 font-normal py-4" colSpan={4}>এই মাসে কোনো ক্যান্টিন খরচ নেই</td>
                                   </tr>
                               ) : (
                                   statementTx.map(tx => (
                                       <tr key={tx.id}>
                                           <td className="border border-black p-2">{tx.date}</td>
                                           <td className="border border-black p-2" colSpan={2}>{tx.items}</td>
                                           <td className="border border-black p-2">৳{tx.amount}</td>
                                       </tr>
                                   ))
                               )}
                               <tr>
                                   <td className="border border-black p-2 text-right" colSpan={3}>মোট ক্যান্টিন বিল (খাবার)</td>
                                   <td className="border border-black p-2">৳{statementTx.reduce((sum, tx) => sum + (tx.amount || 0), 0)}</td>
                               </tr>
                               <tr>
                                   <td className="border border-black p-2 text-right" colSpan={3}>চলতি মাসের মোট (SUBTOTAL)</td>
                                   <td className="border border-black p-2">৳{statementTx.reduce((sum, tx) => sum + (tx.amount || 0), 0)}</td>
                               </tr>
                               <tr>
                                   <td className="border border-black p-2 text-right font-black" colSpan={3}>সর্বমোট প্রদেয়</td>
                                   <td className="border border-black p-2 font-black text-sm">৳{statementMember.baki || '0.00'}</td>
                               </tr>
                           </tbody>
                       </table>
                       <div className="flex justify-between items-end pt-12 px-8 text-xs font-bold text-black text-center">
                           <div>
                               <div className="w-32 border-t border-black mb-1 mx-auto"></div>
                               <p>গ্রাহকের স্বাক্ষর</p>
                           </div>
                           <div>
                               <div className="w-32 border-t border-black mb-1 mx-auto"></div>
                               <p>ম্যানেজার</p>
                           </div>
                       </div>
                   </div>

               </div>
            </div>
         </div>
      )}
    </div>
  );
};
`;

code = beforeModal + newModal + afterModal;

fs.writeFileSync('src/features/canteen/pages/MemberDB.tsx', code);

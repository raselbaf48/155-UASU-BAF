const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/MemberDB.tsx', 'utf8');

// Update state type for profileTab
code = code.replace(
    /useState<'profile' \| 'history'>\('profile'\);/,
    `useState<'profile' | 'history' | 'statement'>('profile');`
);

// Add the Statement tab button
const oldTabs = `<div className="flex space-x-6 border-b border-slate-800">
                      <button onClick={() => setProfileTab('profile')} className={\`pb-3 text-xs font-black tracking-widest uppercase transition-colors \${profileTab === 'profile' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}\`}>Profile</button>
                      <button onClick={() => setProfileTab('history')} className={\`pb-3 text-xs font-black tracking-widest uppercase transition-colors \${profileTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}\`}>History</button>
                  </div>`;

const newTabs = `<div className="flex space-x-6 border-b border-slate-800">
                      <button onClick={() => setProfileTab('profile')} className={\`pb-3 text-xs font-black tracking-widest uppercase transition-colors \${profileTab === 'profile' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}\`}>Profile</button>
                      <button onClick={() => setProfileTab('history')} className={\`pb-3 text-xs font-black tracking-widest uppercase transition-colors \${profileTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}\`}>History</button>
                      <button onClick={() => setProfileTab('statement')} className={\`pb-3 text-xs font-black tracking-widest uppercase transition-colors \${profileTab === 'statement' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}\`}>Statement</button>
                  </div>`;
code = code.replace(oldTabs, newTabs);

// Change the Statement button in History tab to switch to Statement tab
code = code.replace(
    /<button onClick=\{\(\) => window.print\(\)\} className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-900\/30 text-indigo-400 hover:bg-indigo-900\/50 rounded-lg text-\[10px\] font-black tracking-widest uppercase transition-colors shadow-sm">/,
    `<button onClick={() => setProfileTab('statement')} className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 rounded-lg text-[10px] font-black tracking-widest uppercase transition-colors shadow-sm">`
);

// Now, adjust the layout so Statement tab shows the statement on screen.
// Currently:
// {profileTab === 'profile' ? (...) : ( ... History ... )}
// We need to change to:
// {profileTab === 'profile' && (...)}
// {profileTab === 'history' && (...)}
// {profileTab === 'statement' && (...)}

const profileHistoryBlockRegex = /\{\/\* Normal UI View \(Hidden on print\) \*\/\}\s*<div className="print:hidden">\s*\{profileTab === 'profile' \? \([\s\S]*?\) : \([\s\S]*?\)\}\s*<\/div>/m;
const match = code.match(profileHistoryBlockRegex);

if (match) {
    let block = match[0];
    
    // Split the ternary
    const profileStart = block.indexOf('<div className="space-y-6">');
    const historyStart = block.indexOf('<div className="space-y-4">');
    const profileEnd = block.indexOf(') : (');
    
    const profileContent = block.substring(profileStart, profileEnd).trim();
    const historyContent = block.substring(historyStart, block.lastIndexOf(')}')).trim();
    
    const newBlock = `{/* Normal UI View (Hidden on print) */}
                   <div className="print:hidden">
                       {profileTab === 'profile' && (
                           ${profileContent}
                       )}
                       {profileTab === 'history' && (
                           ${historyContent}
                       )}
                       {profileTab === 'statement' && (
                           <div className="flex flex-col h-full space-y-4">
                               <div className="flex justify-end space-x-3">
                                   <button onClick={() => window.print()} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black tracking-widest uppercase hover:bg-indigo-500 transition-colors">
                                       <Printer className="w-4 h-4" />
                                       <span>Print PDF</span>
                                   </button>
                               </div>
                               <div className="bg-white p-6 rounded-xl text-black overflow-y-auto" style={{ maxHeight: '60vh' }}>
                                   {/* Re-use statement layout */}
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
                       )}
                   </div>`;
    
    code = code.replace(block, newBlock);
}

fs.writeFileSync('src/features/canteen/pages/MemberDB.tsx', code);

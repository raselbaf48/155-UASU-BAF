const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/MemberDB.tsx', 'utf8');

if (!code.includes('showPayBillModal')) {
    code = code.replace(
        /const \[statementMember, setStatementMember\] = useState<any \| null>\(null\);/,
        `const [statementMember, setStatementMember] = useState<any | null>(null);\n  const [showPayBillModal, setShowPayBillModal] = useState(false);\n  const [payAmount, setPayAmount] = useState('');\n  const [payMethod, setPayMethod] = useState<'CASH' | 'UCB'>('CASH');\n  const [txDeleteConfirmId, setTxDeleteConfirmId] = useState<any | null>(null);`
    );
}

// 1. Add Pay Bill button to Profile Tab
const oldProfileTab = `<div className="space-y-6">
                               <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact</p>
                                      <p className="text-sm font-bold text-white">{statementMember['Contact'] || 'N/A'}</p>
                                  </div>
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                                      <p className={\`text-2xl font-black \${statementMember.baki === 0 ? 'text-emerald-500' : 'text-rose-500'}\`}>৳{statementMember.baki || 0}</p>
                                  </div>
                               </div>
                           </div>`;

const newProfileTab = `<div className="space-y-6">
                               <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact</p>
                                      <p className="text-sm font-bold text-white">{statementMember['Contact'] || 'N/A'}</p>
                                  </div>
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                                      <div>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                                          <p className={\`text-2xl font-black \${statementMember.baki === 0 ? 'text-emerald-500' : 'text-rose-500'}\`}>৳{statementMember.baki || 0}</p>
                                      </div>
                                      <button onClick={() => setShowPayBillModal(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-black tracking-widest transition-colors shadow-md shadow-emerald-500/20">
                                          PAY BILL
                                      </button>
                                  </div>
                               </div>
                           </div>`;

code = code.replace(oldProfileTab, newProfileTab);

// 2. Add History QTY column and Trash icon
const oldThead = `<tr>
                                               <th className="px-4 py-3">Ser No</th>
                                               <th className="px-4 py-3">Date</th>
                                               <th className="px-4 py-3">Description</th>
                                               <th className="px-4 py-3 text-right">Amount</th>
                                           </tr>`;
const newThead = `<tr>
                                               <th className="px-4 py-3">Ser No</th>
                                               <th className="px-4 py-3">Date</th>
                                               <th className="px-4 py-3">Description</th>
                                               <th className="px-4 py-3 text-center">Qty</th>
                                               <th className="px-4 py-3 text-right">Amount</th>
                                               <th className="px-4 py-3 text-center">Action</th>
                                           </tr>`;
code = code.replace(oldThead, newThead);

const oldTbodyMap = /statementTx\.map\(\(tx, idx\) => \([\s\S]*?<\/tr>\s*\)\)/m;
const newTbodyMap = `statementTx.map((tx, idx) => {
                                                   // Try to parse Qty from description if available, or just render "1" or total count.
                                                   // Usually tx.items looks like "Item A (2), Item B (1)"
                                                   let qtyText = "-";
                                                   let descText = tx.items;
                                                   
                                                   if (tx.items && tx.items.includes('(')) {
                                                       const itemsList = tx.items.split(', ');
                                                       let totalQty = 0;
                                                       itemsList.forEach((it: string) => {
                                                           const match = it.match(/\\((\\d+)\\)/);
                                                           if (match) totalQty += parseInt(match[1]);
                                                       });
                                                       if (totalQty > 0) qtyText = totalQty.toString();
                                                   }
                                                   if (tx.type === 'BILL PAYMENT') {
                                                       qtyText = "-";
                                                       descText = 'Payment Received - ' + (tx.gateway || 'CASH');
                                                   }

                                                   return (
                                                   <tr key={tx.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20">
                                                       <td className="px-4 py-3 font-medium">{idx + 1}</td>
                                                       <td className="px-4 py-3">{tx.date}</td>
                                                       <td className="px-4 py-3">{descText}</td>
                                                       <td className="px-4 py-3 text-center font-bold text-emerald-400">{qtyText}</td>
                                                       <td className="px-4 py-3 text-right font-black text-white">৳{tx.amount}</td>
                                                       <td className="px-4 py-3 text-center">
                                                           <button onClick={() => setTxDeleteConfirmId(tx)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-800 rounded-lg transition-colors">
                                                               <Trash2 className="w-4 h-4" />
                                                           </button>
                                                       </td>
                                                   </tr>
                                               )})`;
code = code.replace(oldTbodyMap, newTbodyMap);

fs.writeFileSync('src/features/canteen/pages/MemberDB.tsx', code);

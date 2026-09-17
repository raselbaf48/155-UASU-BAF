const fs = require('fs');
const file = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetTabs = `                   <button onClick={() => setPreOrderTab('completed')} className={\`px-4 py-1.5 rounded-full text-[10px] uppercase font-bold transition-colors \${preOrderTab === 'completed' ? 'bg-[#4f46e5] text-white' : 'text-slate-400 hover:text-white'}\`}>Completed</button>`;
const replaceTabs = `                   <button onClick={() => setPreOrderTab('completed')} className={\`px-4 py-1.5 rounded-full text-[10px] uppercase font-bold transition-colors \${preOrderTab === 'completed' ? 'bg-[#4f46e5] text-white' : 'text-slate-400 hover:text-white'}\`}>Completed ({preOrders.filter(p => p.status === 'completed').length})</button>`;
code = code.replace(targetTabs, replaceTabs);

const targetHeaders = `                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</th>
                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>`;
const replaceHeaders = `                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</th>
                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Qty</th>
                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>`;
code = code.replace(targetHeaders, replaceHeaders);

const targetItems = `                                    <td className="py-4 px-4">
                                        <div className="flex flex-wrap gap-1">
                                            {order.items.map((it:any, i:number) => (
                                                <span key={i} className="bg-slate-800 text-slate-400 px-2 py-1 rounded-md text-[10px] font-bold">
                                                    {it.qty}x {it.name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-xs font-black text-[#4f46e5]">৳{order.total}</td>`;
const replaceItems = `                                    <td className="py-4 px-4">
                                        <div className="flex flex-col gap-1">
                                            {order.items.map((it:any, i:number) => (
                                                <span key={i} className="text-slate-300 text-xs font-bold whitespace-nowrap">
                                                    {it.name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex flex-col gap-1">
                                            {order.items.map((it:any, i:number) => (
                                                <span key={i} className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md text-[10px] font-bold w-fit text-center min-w-[24px]">
                                                    {it.qty}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-xs font-black text-[#4f46e5]">৳{order.total}</td>`;
code = code.replace(targetItems, replaceItems);

const targetMarkDone = `                                                <button 
                                                    onClick={() => handleCompletePreOrder(order)}
                                                    className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                                                >
                                                    Mark Done
                                                </button>`;
const replaceMarkDone = `                                                <button 
                                                    onClick={() => {
                                                        handleCompletePreOrder(order);
                                                        alert('Order completed successfully!');
                                                    }}
                                                    title="Mark Done"
                                                    className="p-1.5 bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-400 rounded-full transition-colors flex items-center justify-center border border-emerald-500/20"
                                                >
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </button>`;
code = code.replace(targetMarkDone, replaceMarkDone);

fs.writeFileSync(file, code);

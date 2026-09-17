const fs = require('fs');
const file = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetState = `  const [catalog, setCatalog] = useState<any[]>([`;
const replaceState = `  const [preOrderTab, setPreOrderTab] = useState<'pending'|'completed'>('pending');\n  const [catalog, setCatalog] = useState<any[]>([`;
code = code.replace(targetState, replaceState);

const handleCompleteTarget = `  const handleCompletePreOrder = async (order: any) => {`;
const handleCompleteReplace = `  const handleRevertPreOrder = async (order: any) => {
      const member = members.find(m => String(m['BD No']) === String(order.memberId));
      if (member) {
          const newBaki = (member.baki || 0) - order.total;
          await supabase.from('Canteen').update({ baki: newBaki }).eq('airman_id', member.airman_id);
      }
      
      for (const item of order.items) {
          const dbItem = catalog.find(c => c.id === item.id);
          if (dbItem) {
              const newStock = (dbItem.stock || 0) + item.qty;
              await supabase.from('Canteen_Inventory').update({ stock: newStock }).eq('id', dbItem.id);
          }
      }
      
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const updatedTxs = txs.filter((t: any) => t.amount !== order.total || t.date !== new Date(order.timestamp).toLocaleDateString('bn-BD') || !t.items.includes(order.items[0].name));
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
      
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.map((p: any) => p.orderId === order.orderId ? {...p, status: 'pending'} : p);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
  };

  const handleCompletePreOrder = async (order: any) => {`;
code = code.replace(handleCompleteTarget, handleCompleteReplace);

const tabsTarget = `               <span className="bg-indigo-100 text-indigo-400 px-3 py-1 rounded-full text-[10px]">{preOrders.filter(p => p.status === 'pending').length} Pending</span>
            </h3>`;
const tabsReplace = `               <div className="flex bg-slate-800 p-1 rounded-full">
                   <button onClick={() => setPreOrderTab('pending')} className={\`px-4 py-1.5 rounded-full text-[10px] uppercase font-bold transition-colors \${preOrderTab === 'pending' ? 'bg-[#4f46e5] text-white' : 'text-slate-400 hover:text-white'}\`}>Pending ({preOrders.filter(p => p.status === 'pending').length})</button>
                   <button onClick={() => setPreOrderTab('completed')} className={\`px-4 py-1.5 rounded-full text-[10px] uppercase font-bold transition-colors \${preOrderTab === 'completed' ? 'bg-[#4f46e5] text-white' : 'text-slate-400 hover:text-white'}\`}>Completed</button>
               </div>
            </h3>`;
code = code.replace(tabsTarget, tabsReplace);

const tableLoopTarget = `<tbody className="divide-y divide-slate-50">
                            {preOrders.map((order: any, idx: number) => (`;
const tableLoopReplace = `<tbody className="divide-y divide-slate-50">
                            {preOrders.filter((order: any) => order.status === preOrderTab).map((order: any, idx: number) => (`;
code = code.replace(tableLoopTarget, tableLoopReplace);

const actionTarget = `                                        {order.status === 'pending' && (
                                            <div className="flex items-center justify-end space-x-3">
                                                <button 
                                                    onClick={() => handleCompletePreOrder(order)}
                                                    className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                                                >
                                                    Mark Done
                                                </button>
                                                <button 
                                                    onClick={() => setCancelConfirmId(order.orderId)}
                                                    className="p-1 text-rose-400 hover:text-rose-300 transition-colors flex items-center justify-center"
                                                    title="Cancel Order"
                                                >
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </td>`;
const actionReplace = `                                        {order.status === 'pending' ? (
                                            <div className="flex items-center justify-end space-x-3">
                                                <button 
                                                    onClick={() => handleCompletePreOrder(order)}
                                                    className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                                                >
                                                    Mark Done
                                                </button>
                                                <button 
                                                    onClick={() => setCancelConfirmId(order.orderId)}
                                                    className="p-1 text-rose-400 hover:text-rose-300 transition-colors flex items-center justify-center"
                                                    title="Cancel Order"
                                                >
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end">
                                                <button 
                                                    onClick={() => handleRevertPreOrder(order)}
                                                    className="px-3 py-1.5 bg-amber-900/30 hover:bg-amber-900/60 text-amber-500 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                                                >
                                                    Revert to Pending
                                                </button>
                                            </div>
                                        )}
                                    </td>`;
code = code.replace(actionTarget, actionReplace);

fs.writeFileSync(file, code);

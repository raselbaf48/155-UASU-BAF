const fs = require('fs');
const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

// 1. Remove Top Pre-Orders List
const topPreOrdersPattern = /<h4 className="text-\[10px\] font-black text-slate-400 uppercase tracking-widest mb-3">Pre-Orders<\/h4>\s*<div className="flex-1 overflow-y-auto space-y-3 mb-6 pr-2">[\s\S]*?<\/div>/;
code = code.replace(topPreOrdersPattern, '');


// 2. Add manualQty state
const manualStateTarget = `const [manualItemId, setManualItemId] = useState('');`;
const manualStateReplace = `const [manualItemId, setManualItemId] = useState('');\n  const [manualQty, setManualQty] = useState(1);`;
code = code.replace(manualStateTarget, manualStateReplace);


// 3. Update handleManualPreOrder
const handleManualTarget = `      selectedMembers.forEach((m, idx) => {
          const newOrder = {
              orderId: 'PO-' + Date.now() + '-' + idx,
              timestamp: new Date().toISOString(),
              memberId: m['BD No'],
              memberName: m['Rank'] + ' ' + m['Surname'],
              items: [{ id: item.id, name: item.name, qty: 1, price: item.price }],
              total: item.price,
              status: 'pending'
          };
          existing.push(newOrder);
      });

      localStorage.setItem('canteen_pre_orders', JSON.stringify(existing));
      
      const parsed = existing.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);

      setSelectedMembers([]);
      setMemberSearchTerm('');
      setManualItemId('');
  };`;

const handleManualReplace = `      selectedMembers.forEach((m, idx) => {
          const newOrder = {
              orderId: 'PO-' + Date.now() + '-' + idx,
              timestamp: new Date().toISOString(),
              memberId: m['BD No'],
              memberName: m['Rank'] + ' ' + m['Surname'],
              items: [{ id: item.id, name: item.name, qty: manualQty, price: item.price }],
              total: item.price * manualQty,
              status: 'pending'
          };
          existing.push(newOrder);
      });

      localStorage.setItem('canteen_pre_orders', JSON.stringify(existing));
      
      const parsed = existing.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);

      setSelectedMembers([]);
      setMemberSearchTerm('');
      setManualItemId('');
      setManualQty(1);
  };
  
  const handleCancelPreOrder = (orderId: string) => {
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.filter((o: any) => o.orderId !== orderId);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
  };`;
code = code.replace(handleManualTarget, handleManualReplace);


// 4. Update Manual Pre-Order form layout in JSX
const formTarget = `                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select 
                            value={manualItemId} 
                            onChange={e => setManualItemId(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500"
                        >
                            <option value="">Select Curated Item</option>
                            {catalog.filter(i => selectedItems.includes(i.id)).map(i => (
                                <option key={i.id} value={i.id}>{i.name} - ৳{i.price}</option>
                            ))}
                        </select>
                        <button 
                            onClick={handleManualPreOrder} 
                            disabled={selectedMembers.length === 0 || !manualItemId}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-widest uppercase py-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Pre-Order
                        </button>
                    </div>`;

const formReplace = `                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <select 
                            value={manualItemId} 
                            onChange={e => setManualItemId(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm font-bold text-slate-200 outline-none focus:border-indigo-500"
                        >
                            <option value="">Select Item</option>
                            {catalog.filter(i => selectedItems.includes(i.id)).map(i => (
                                <option key={i.id} value={i.id}>{i.name} - ৳{i.price}</option>
                            ))}
                        </select>
                        <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-4 py-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-2">Qty:</span>
                            <input 
                                type="number" 
                                min="1" 
                                value={manualQty} 
                                onChange={e => setManualQty(Number(e.target.value) || 1)} 
                                className="w-full bg-transparent text-sm font-bold text-slate-200 outline-none focus:border-indigo-500"
                            />
                        </div>
                        <button 
                            onClick={handleManualPreOrder} 
                            disabled={selectedMembers.length === 0 || !manualItemId}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-widest uppercase py-2 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Pre-Order
                        </button>
                    </div>`;
code = code.replace(formTarget, formReplace);


// 5. Update Table Actions
const tableActionsTarget = `                                    <td className="py-4 px-4 text-right">
                                        {order.status === 'pending' && (
                                            <button 
                                                onClick={() => {
                                                    const updated = preOrders.map(p => p.orderId === order.orderId ? {...p, status: 'completed'} : p);
                                                    setPreOrders(updated);
                                                    localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
                                                }}
                                                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest"
                                            >
                                                Mark Done
                                            </button>
                                        )}
                                    </td>`;
const tableActionsReplace = `                                    <td className="py-4 px-4 text-right">
                                        {order.status === 'pending' && (
                                            <div className="flex items-center justify-end space-x-2">
                                                <button 
                                                    onClick={() => {
                                                        const updated = preOrders.map(p => p.orderId === order.orderId ? {...p, status: 'completed'} : p);
                                                        setPreOrders(updated);
                                                        localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
                                                    }}
                                                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest"
                                                >
                                                    Mark Done
                                                </button>
                                                <button 
                                                    onClick={() => handleCancelPreOrder(order.orderId)}
                                                    className="px-3 py-1.5 bg-rose-900/30 hover:bg-rose-900/60 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-widest"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </td>`;
code = code.replace(tableActionsTarget, tableActionsReplace);

fs.writeFileSync(mgrFile, code);

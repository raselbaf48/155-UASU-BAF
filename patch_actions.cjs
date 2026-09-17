const fs = require('fs');
const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

const tableActionsTarget = `                                    <td className="py-4 px-4 text-right">
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

const tableActionsReplace = `                                    <td className="py-4 px-4 text-right">
                                        {order.status === 'pending' && (
                                            <div className="flex items-center justify-end space-x-3">
                                                <button 
                                                    onClick={() => handleCompletePreOrder(order)}
                                                    className="px-3 py-1.5 bg-emerald-900/30 hover:bg-emerald-900/60 text-emerald-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                                                >
                                                    Mark Done
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm("Are you sure you want to cancel this pre-order?")) {
                                                            handleCancelPreOrder(order.orderId);
                                                        }
                                                    }}
                                                    className="p-1.5 bg-rose-900/30 hover:bg-rose-900/60 text-rose-400 rounded-full transition-colors flex items-center justify-center border border-rose-500/20"
                                                    title="Cancel Order"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </td>`;
code = code.replace(tableActionsTarget, tableActionsReplace);

fs.writeFileSync(mgrFile, code);

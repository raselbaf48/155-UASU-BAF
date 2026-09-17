const fs = require('fs');
const mgrFile = 'src/features/canteen/pages/ManagerDashboard.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

const importTarget = "import { Utensils, Search, X, Check, ChefHat, Clock, Plus } from 'lucide-react';";
const importReplace = "import { Utensils, Search, X, Check, ChefHat, Clock, Plus, XCircle, AlertTriangle } from 'lucide-react';";
code = code.replace(importTarget, importReplace);

const stateTarget = "const [manualQty, setManualQty] = useState(1);";
const stateReplace = "const [manualQty, setManualQty] = useState(1);\n  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);";
code = code.replace(stateTarget, stateReplace);

const buttonTarget = `                                                <button 
                                                    onClick={() => {
                                                        if (window.confirm("Are you sure you want to cancel this pre-order?")) {
                                                            handleCancelPreOrder(order.orderId);
                                                        }
                                                    }}
                                                    className="p-1.5 bg-rose-900/30 hover:bg-rose-900/60 text-rose-400 rounded-full transition-colors flex items-center justify-center border border-rose-500/20"
                                                    title="Cancel Order"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>`;
const buttonReplace = `                                                <button 
                                                    onClick={() => setCancelConfirmId(order.orderId)}
                                                    className="p-1 text-rose-400 hover:text-rose-300 transition-colors flex items-center justify-center"
                                                    title="Cancel Order"
                                                >
                                                    <XCircle className="w-5 h-5" />
                                                </button>`;
code = code.replace(buttonTarget, buttonReplace);

const cancelLogicTarget = `  const handleCancelPreOrder = (orderId: string) => {
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.filter((o: any) => o.orderId !== orderId);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
  };`;
const cancelLogicReplace = `  const handleCancelPreOrder = () => {
      if (!cancelConfirmId) return;
      const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let existing = [];
      try { existing = JSON.parse(existingStr); } catch(e) {}
      
      const updated = existing.filter((o: any) => o.orderId !== cancelConfirmId);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      const parsed = updated.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPreOrders(parsed);
      setCancelConfirmId(null);
  };`;
code = code.replace(cancelLogicTarget, cancelLogicReplace);

const modalTarget = `         {/* Right Col */}`;
const modalReplace = `         {/* Cancel Confirm Modal */}
         {cancelConfirmId && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-800 animate-in zoom-in-95">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Cancel Pre-Order?</h3>
                        <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to cancel this order? This action cannot be undone.</p>
                        <div className="flex space-x-3">
                            <button 
                                onClick={() => setCancelConfirmId(null)}
                                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors"
                            >
                                Keep
                            </button>
                            <button 
                                onClick={handleCancelPreOrder}
                                className="flex-1 px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors shadow-lg shadow-rose-900/20"
                            >
                                Cancel It
                            </button>
                        </div>
                    </div>
                </div>
            </div>
         )}
         
         {/* Right Col */}`;
code = code.replace(modalTarget, modalReplace);

fs.writeFileSync(mgrFile, code);

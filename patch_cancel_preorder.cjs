const fs = require('fs');

let code = fs.readFileSync('src/features/canteen/pages/PersonalPortal.tsx', 'utf8');

// 1. Import Trash2
code = code.replace(
    /import \{ (.*?) \} from 'lucide-react';/,
    "import { $1, Trash2 } from 'lucide-react';"
);

// 2. Add state and handler
const stateAndHandler = `
  const [activities, setActivities] = useState<any[]>([]);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  const handleCancelPreOrder = (orderId: string) => {
      const preOrdersStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let preOrders = [];
      try { preOrders = JSON.parse(preOrdersStr); } catch(e) {}
      
      const updated = preOrders.filter((po: any) => po.orderId !== orderId);
      localStorage.setItem('canteen_pre_orders', JSON.stringify(updated));
      
      setCancelConfirmId(null);
      fetchActivities();
  };
`;
code = code.replace(
    /const \[activities, setActivities\] = useState<any\[\]>\(\[\]\);/,
    stateAndHandler
);

// 3. Update Activity Log rendering
// Replace:
/*
<div className="text-right">
    <p className="text-sm font-black text-white">৳{act.amount}</p>
    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{act.id}</p>
</div>
*/
const oldActivityRight = `<div className="text-right">
                                  <p className="text-sm font-black text-white">৳{act.amount}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{act.id}</p>
                              </div>`;
                              
const newActivityRight = `<div className="text-right flex flex-col items-end">
                                  <p className="text-sm font-black text-white">৳{act.amount}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{act.id}</p>
                                  {act.type === 'PRE-ORDER' && (
                                      <button onClick={() => setCancelConfirmId(act.id)} className="mt-2 text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1 px-2 py-1 bg-rose-900/20 rounded-md transition-colors">
                                          <Trash2 className="w-3 h-3" />
                                          <span>CANCEL</span>
                                      </button>
                                  )}
                              </div>`;
                              
code = code.replace(oldActivityRight, newActivityRight);

// 4. Add the JSX Modal at the end, right before the last closing tags
const modalJsx = `
      {/* Cancel Confirmation Modal */}
      {cancelConfirmId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-800 animate-in zoom-in-95">
                  <div className="text-center">
                      <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Trash2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Cancel Pre-Order?</h3>
                      <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to cancel this pre-order? This action cannot be undone.</p>
                      
                      <div className="flex space-x-3">
                          <button onClick={() => setCancelConfirmId(null)} className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-200 transition-colors">
                              KEEP IT
                          </button>
                          <button onClick={() => handleCancelPreOrder(cancelConfirmId)} className="flex-1 py-3 bg-rose-900/30 text-rose-500 rounded-xl text-xs font-black tracking-widest hover:bg-rose-600 hover:text-white transition-colors shadow-md shadow-rose-500/30">
                              CANCEL ORDER
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};`;

code = code.replace(/    <\/div>\s*<\/div>\s*\);\s*\};\s*$/, modalJsx);

fs.writeFileSync('src/features/canteen/pages/PersonalPortal.tsx', code);

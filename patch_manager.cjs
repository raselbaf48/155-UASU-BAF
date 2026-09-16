const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/pages/ManagerDashboard.tsx', 'utf8');

if (!code.includes("import { supabase }")) {
    code = code.replace("import { Utensils, Search } from 'lucide-react';", "import { Utensils, Search, X, Check, ChefHat, Clock } from 'lucide-react';\nimport { supabase } from '../../../supabase';\nimport { useEffect } from 'react';");
}

code = code.replace("export const ManagerDashboard: React.FC = () => {", 
`export const ManagerDashboard: React.FC = () => {
  const [showCurateMenu, setShowCurateMenu] = useState(false);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [preOrders, setPreOrders] = useState<any[]>([]);
  const [searchCatalog, setSearchCatalog] = useState('');

  useEffect(() => {
    fetchCatalog();
    loadDailyMenu();
    loadPreOrders();
    
    // Set up an interval to refresh pre-orders
    const interval = setInterval(loadPreOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchCatalog = async () => {
    const { data, error } = await supabase.from('Canteen_Inventory').select('*');
    if (!error && data) {
      setCatalog(data);
    }
  };

  const loadDailyMenu = () => {
    const stored = localStorage.getItem('canteen_daily_menu');
    if (stored) {
        try { setSelectedItems(JSON.parse(stored)); } catch(e){}
    }
  };

  const loadPreOrders = () => {
      const stored = localStorage.getItem('canteen_pre_orders');
      if (stored) {
          try { 
              const parsed = JSON.parse(stored);
              // filter today's orders maybe? For now just load all
              setPreOrders(parsed.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())); 
          } catch(e){}
      }
  };

  const toggleSelection = (id: string) => {
      setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const saveDailyMenu = () => {
      localStorage.setItem('canteen_daily_menu', JSON.stringify(selectedItems));
      setShowCurateMenu(false);
  };
`);

const curateBtnOld = `<button className="px-6 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-md shadow-indigo-500/20 flex items-center space-x-2">
               <span className="text-indigo-200">🍳</span>
               <span>CURATE DAILY MENU</span>
            </button>`;
const curateBtnNew = `<button onClick={() => setShowCurateMenu(true)} className="px-6 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-md shadow-indigo-500/20 flex items-center space-x-2">
               <span className="text-indigo-200">🍳</span>
               <span>CURATE DAILY MENU</span>
            </button>`;
code = code.replace(curateBtnOld, curateBtnNew);

const returnIdx = code.indexOf("return (");

const curatemodal = `
      {/* Curate Daily Menu Modal */}
      {showCurateMenu && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-white rounded-[2rem] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                  <button onClick={() => setShowCurateMenu(false)} className="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors">
                      <X className="w-5 h-5 text-slate-600" />
                  </button>
                  
                  <div className="flex items-center space-x-3 mb-6">
                      <ChefHat className="w-6 h-6 text-[#4f46e5]" />
                      <h2 className="text-xl font-black text-slate-900 uppercase tracking-widest">Curate Daily Menu</h2>
                  </div>

                  <div className="relative mb-6">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                          type="text"
                          placeholder="Search catalog..."
                          value={searchCatalog}
                          onChange={(e) => setSearchCatalog(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                      />
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6">
                      {catalog.filter(i => (i.Item_Name || '').toLowerCase().includes(searchCatalog.toLowerCase())).map(item => {
                          const isSelected = selectedItems.includes(item.id);
                          return (
                              <div 
                                  key={item.id} 
                                  onClick={() => toggleSelection(item.id)}
                                  className={\`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all \${isSelected ? 'border-[#4f46e5] bg-[#4f46e5]/5' : 'border-slate-100 hover:border-slate-200'}\`}
                              >
                                  <div className="flex items-center space-x-4">
                                      <div className={\`w-10 h-10 rounded-xl flex items-center justify-center transition-colors \${isSelected ? 'bg-[#4f46e5] text-white' : 'bg-slate-100 text-slate-400'}\`}>
                                          <Utensils className="w-5 h-5" />
                                      </div>
                                      <div>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.Category || 'Snacks'}</p>
                                          <p className="text-sm font-bold text-slate-900">{item.Item_Name}</p>
                                      </div>
                                  </div>
                                  <div className={\`w-6 h-6 rounded-full flex items-center justify-center transition-colors \${isSelected ? 'bg-[#4f46e5] text-white' : 'bg-slate-100 text-slate-400'}\`}>
                                      {isSelected ? <Check className="w-4 h-4" /> : <span className="text-lg leading-none">+</span>}
                                  </div>
                              </div>
                          )
                      })}
                  </div>

                  <button onClick={saveDailyMenu} className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black tracking-widest uppercase transition-all shadow-xl">
                      Save Selection
                  </button>
              </div>
          </div>
      )}
`;

code = code.replace("  return (\n    <div", "  return (\n    <div" + curatemodal);

// Add Pre-Orders section under Cafe Performance
const performanceEnd = `                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>`;

const preOrdersSection = `
         <div className="lg:col-span-3 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 flex flex-col mt-6">
            <h3 className="text-xs font-black text-slate-900 tracking-widest uppercase mb-6 flex items-center justify-between">
               <div className="flex items-center space-x-2">
                  <span className="text-[#4f46e5]">🛎️</span>
                  <span>LIVE PRE-ORDERS</span>
               </div>
               <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-[10px]">{preOrders.filter(p => p.status === 'pending').length} Pending</span>
            </h3>
            
            {preOrders.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                    <Clock className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest">No Pre-Orders Yet</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-100">
                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Time</th>
                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Member</th>
                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</th>
                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {preOrders.map((order: any, idx: number) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                    <td className="py-4 px-4 text-xs font-bold text-slate-600">
                                        {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="text-xs font-bold text-slate-900">{order.memberName}</div>
                                        <div className="text-[10px] font-bold text-slate-400">{order.memberId}</div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex flex-wrap gap-1">
                                            {order.items.map((it:any, i:number) => (
                                                <span key={i} className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[10px] font-bold">
                                                    {it.qty}x {it.name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-xs font-black text-[#4f46e5]">৳{order.total}</td>
                                    <td className="py-4 px-4">
                                        <span className={\`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest \${order.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}\`}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-4 text-right">
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
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
         </div>
`;

code = code.replace(performanceEnd, performanceEnd + "\n" + preOrdersSection);

fs.writeFileSync('src/features/canteen/pages/ManagerDashboard.tsx', code);

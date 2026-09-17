import React, { useState, useEffect } from 'react';
import { Utensils, Search, User, Zap, History, CreditCard, ShoppingCart, Clock, Trash2 } from 'lucide-react';
import { supabase } from '../../../supabase';

interface EmployeeDashboardProps { onManagerPortalClick?: () => void; currentUser?: any; }

export const PersonalPortal: React.FC<EmployeeDashboardProps> = ({ onManagerPortalClick, currentUser }) => {
  
  const [dailyMenu, setDailyMenu] = useState<any[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);
  const [searchMenu, setSearchMenu] = useState('');
  
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


  const fetchActivities = () => {
      const preOrdersStr = localStorage.getItem('canteen_pre_orders') || '[]';
      let preOrders = [];
      try { preOrders = JSON.parse(preOrdersStr); } catch(e) {}
      
      const txsStr = localStorage.getItem('canteen_txs') || '[]';
      let txs = [];
      try { txs = JSON.parse(txsStr); } catch(e) {}

      const userBdNo = currentUser?.bdNo || 'Unknown ID';
      
      const userPreOrders = preOrders.filter((po: any) => po.memberId === userBdNo).map((po: any) => ({
          type: 'PRE-ORDER',
          date: new Date(po.timestamp).toLocaleDateString('bn-BD'),
          items: po.items.map((i: any) => i.name).join(', '),
          amount: po.total,
          id: po.orderId
      }));
      
      const userTxs = txs.filter((tx: any) => tx.airman_id === userBdNo).map((tx: any) => ({
          type: 'PURCHASE',
          date: tx.date,
          items: tx.items,
          amount: tx.amount,
          id: tx.id
      }));

      // Sort recent first
      const allAct = [...userPreOrders.reverse(), ...userTxs];
      setActivities(allAct.slice(0, 15));
  };

  
  useEffect(() => {
      fetchMenu();
      fetchActivities();
  }, [currentUser]);

  const fetchMenu = async () => {
      const stored = localStorage.getItem('canteen_daily_menu');
      if (stored) {
          try {
              const ids = JSON.parse(stored);
              if (ids.length > 0) {
                  const { data, error } = await supabase.from('Canteen_Inventory').select('*').in('id', ids);
                  if (!error && data) {
                      setDailyMenu(data);
                  }
              }
          } catch(e){}
      }
  };

  const handlePreOrder = (item: any) => {
      setIsOrdering(true);
      setTimeout(() => {
          try {
              const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
              const existing = JSON.parse(existingStr);
              
              const newOrder = {
                  orderId: 'PO-' + Date.now(),
                  timestamp: new Date().toISOString(),
                  memberId: currentUser?.bdNo || 'Unknown ID',
                  memberName: currentUser?.name || 'Guest',
                  items: [{ id: item.id, name: item.name, qty: 1, price: item.price }],
                  total: item.price,
                  status: 'pending'
              };
              
              existing.push(newOrder);
              localStorage.setItem('canteen_pre_orders', JSON.stringify(existing));
              fetchActivities();
              alert('Pre-order placed successfully!');
          } catch(e) {
              console.error(e);
          }
          setIsOrdering(false);
      }, 500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300 pb-10 mt-4 md:mt-10">
      
      {/* Profile Section */}
      <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 bg-[#0f172a] rounded-2xl flex items-center justify-center relative shadow-lg">
              <User className="w-8 h-8 text-white" />
              <div className="absolute -bottom-1 -right-1 bg-[#4f46e5] rounded-full p-1 border-2 border-white">
                  <CreditCard className="w-3 h-3 text-white" />
              </div>
          </div>
          
          <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-1">
                  <span className="bg-[#4f46e5] text-white text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Personal Portal</span>
                  <span className="text-[10px] font-black text-slate-400 tracking-widest uppercase">ID #{currentUser?.bdNo || '474455'}</span>
              </div>
              <h2 className="text-3xl font-black text-white tracking-tight uppercase">
                  {currentUser?.name || 'GUEST USER'}
              </h2>
          </div>

          <div className="bg-[#0f172a] rounded-[2rem] px-10 py-6 text-center shadow-xl relative overflow-hidden mt-2">
              <div className="absolute inset-0 bg-gradient-to-r from-[#4f46e5]/20 to-transparent pointer-events-none" />
              <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest mb-1 relative z-10">Liability Assessment</p>
              <h3 className="text-4xl font-black text-white tracking-tighter relative z-10">৳230</h3>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 relative z-10">Live Accounting Balance</p>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-[#4f46e5] rounded-t-full" />
          </div>
      </div>

      {/* Active Service Section */}
      <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                  <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center space-x-2 mb-1">
                      <span className="text-[#4f46e5]"><Utensils className="w-4 h-4" /></span>
                      <span>Active Service</span>
                  </h3>
                  <div className="flex items-center space-x-2">
                      <span className="bg-emerald-900/300/10 text-emerald-400 text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center space-x-1">
                          <div className="w-1.5 h-1.5 bg-emerald-900/300 rounded-full animate-pulse" />
                          <span>Ordering Active</span>
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">20:00 PM - 12:00 PM</span>
                  </div>
              </div>
              
              <div className="relative w-full md:w-64">
                  <Search className="w-3 h-3 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input 
                      type="text" 
                      placeholder="Filter daily menu..."
                      value={searchMenu}
                      onChange={(e) => setSearchMenu(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                  />
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dailyMenu.length === 0 ? (
                  <div className="col-span-1 md:col-span-2 py-10 flex flex-col items-center justify-center text-slate-400">
                      <Utensils className="w-8 h-8 mb-3 opacity-20" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No items curated for today</p>
                  </div>
              ) : (
                  dailyMenu.filter(item => (item.name || '').toLowerCase().includes(searchMenu.toLowerCase())).map((item, idx) => (
                      <div key={idx} className="bg-slate-800 border border-slate-700 rounded-2xl p-5 flex items-center justify-between hover:shadow-md hover:bg-slate-700 transition-all group">
                          <div>
                              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">{item.category || 'SNACKS'}</p>
                              <p className="text-sm font-black text-white uppercase tracking-tight">{item.name}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-1 mt-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  <span>Rate Not Fixed</span>
                              </p>
                          </div>
                          <button 
                              onClick={() => handlePreOrder(item)}
                              disabled={isOrdering}
                              className="w-10 h-10 rounded-xl bg-[#4f46e5] text-white flex items-center justify-center hover:bg-[#4338ca] transition-all shadow-md shadow-[#4f46e5]/20 shrink-0 group-hover:scale-110"
                          >
                              <Zap className="w-5 h-5 fill-current" />
                          </button>
                      </div>
                  ))
              )}
          </div>
      </div>

      {/* Activity Log */}
      <div className="bg-slate-900 rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-800">
          <div className="flex items-center justify-between mb-8">
              <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center space-x-2">
                  <span className="text-[#4f46e5]"><History className="w-4 h-4" /></span>
                  <span>Activity Log</span>
              </h3>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recent Entries</span>
          </div>

          <div className="space-y-4">
              {activities.length === 0 ? (
                  <div className="text-center py-10 text-slate-400">
                      <History className="w-10 h-10 mx-auto opacity-20 mb-3" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No activities found</p>
                  </div>
              ) : (
                  activities.map((act, idx) => (
                      <React.Fragment key={act.id || idx}>
                          <div className="flex items-center justify-between p-4 bg-slate-900 hover:bg-slate-800 rounded-2xl transition-colors border border-transparent hover:border-slate-700">
                              <div className="flex items-center space-x-4">
                                  <div className="w-10 h-10 rounded-full bg-indigo-900/20 flex items-center justify-center">
                                      {act.type === 'PRE-ORDER' ? <Zap className="w-4 h-4 text-emerald-400" /> : <ShoppingCart className="w-4 h-4 text-[#4f46e5]" />}
                                  </div>
                                  <div>
                                      <p className="text-xs font-black text-white uppercase tracking-tight">{act.items}</p>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center space-x-1 mt-0.5">
                                          <span>{act.date}</span>
                                          <span className="w-1 h-1 rounded-full bg-slate-500" />
                                          <span className={act.type === 'PRE-ORDER' ? "text-emerald-400" : "text-indigo-400"}>{act.type}</span>
                                      </p>
                                  </div>
                              </div>
                              <div className="text-right flex flex-col items-end">
                                  <p className="text-sm font-black text-white">৳{act.amount}</p>
                                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{act.id}</p>
                                  {act.type === 'PRE-ORDER' && (
                                      <button onClick={() => setCancelConfirmId(act.id)} className="mt-2 text-[10px] font-bold text-rose-400 hover:text-rose-300 flex items-center space-x-1 px-2 py-1 bg-rose-900/20 rounded-md transition-colors">
                                          <Trash2 className="w-3 h-3" />
                                          <span>CANCEL</span>
                                      </button>
                                  )}
                              </div>
                          </div>
                          {idx < activities.length - 1 && <div className="w-full h-px bg-slate-800" />}
                      </React.Fragment>
                  ))
              )}
          </div>
      </div>
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
};
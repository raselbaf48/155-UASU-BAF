import React, { useState, useEffect } from 'react';
import { Utensils, Search, User, Zap, History, CreditCard, ShoppingCart, Clock, Trash2, CheckCircle2, XCircle, X } from 'lucide-react';
import { supabase } from '../../../supabase';

interface EmployeeDashboardProps { onManagerPortalClick?: () => void; currentUser?: any; }

export const PersonalPortal: React.FC<EmployeeDashboardProps> = ({ onManagerPortalClick, currentUser }) => {
  
  const [dailyMenu, setDailyMenu] = useState<any[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);
  const [searchMenu, setSearchMenu] = useState('');
  
  const [activities, setActivities] = useState<any[]>([]);
  const [orderedItems, setOrderedItems] = useState<Record<string, boolean>>({});
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
      
      const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'canteen_daily_menu') {
              fetchMenu();
          }
      };
      
      const handleCustomEvent = () => {
          fetchMenu();
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('canteen_menu_updated', handleCustomEvent);
      
      return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('canteen_menu_updated', handleCustomEvent);
      };
      fetchActivities();
  }, [currentUser]);

  const fetchMenu = async () => {
      const stored = localStorage.getItem('canteen_daily_menu');
      if (stored) {
          try {
              const ids = JSON.parse(stored);
              if (ids.length > 0) {
                  const allItems = [
  {
    "id": "28d0782c-1bdf-42f6-a616-683a9d5038f1",
    "name": "EGG MUMLET",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "bcb8b137-36b8-4fd0-9e11-0e9502859618",
    "name": "EGG NOODLES",
    "category": "SNACKS",
    "price": 50,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "da73d5ab-f0e9-4df1-b3bd-89ed86a1da4f",
    "name": "GREEN TEA",
    "category": "SNACKS",
    "price": 8,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c6ca22ca-0a4a-4a2b-8b48-0d839d240e7b",
    "name": "HALIM",
    "category": "SNACKS",
    "price": 50,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "3d86a07a-2c53-416a-abb6-52b0b448ca63",
    "name": "LEMON JUICE",
    "category": "DRINK",
    "price": 10,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "0e5511c2-9014-4aeb-8e57-624d6994986a",
    "name": "LIQUOR TEA",
    "category": "DRINK",
    "price": 5,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "02d2b676-3b4b-4e7d-9b58-477c53ede8ae",
    "name": "MILK COFFEE",
    "category": "DRINK",
    "price": 25,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "136e714f-1272-4723-a0a5-2048cb81e94f",
    "name": "MILK TEA",
    "category": "DRINK",
    "price": 12,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "5db26171-f6dc-4268-8d64-a5b53140e368",
    "name": "NOODLES",
    "category": "SNACKS",
    "price": 30,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "0a1f36fc-aad0-4d45-a0d8-9222ca1ca07e",
    "name": "NORMAL BISCUIT",
    "category": "SNACKS",
    "price": 5,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "38bc5293-57ed-4e5a-b817-cbdcb37bfebd",
    "name": "ONE TIME BOX",
    "category": "SNACKS",
    "price": 5,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "3dde1a4e-9b62-49a9-8b24-d758c2afc24a",
    "name": "PASTA",
    "category": "SNACKS",
    "price": 35,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "98b60d30-301c-49ea-9e99-7661e30fca39",
    "name": "PORATA",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "cebd3bcc-1802-4f63-90f3-0bb2fa27e121",
    "name": "PORATA (HOTEL)",
    "category": "SNACKS",
    "price": 10,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "b83a0120-d891-481a-a27f-9c7834bc48ee",
    "name": "PORATA (UNIT)",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "eb34adaf-7ae0-4a52-8a90-291cc88b1a1f",
    "name": "SOSA",
    "category": "SNACKS",
    "price": 10,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "dc82a6b4-6cea-4188-b6f1-7e176ec26cff",
    "name": "SWARMA",
    "category": "SNACKS",
    "price": 50,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "4b63bf8e-cedb-4d4b-b25c-fd9451df7a49",
    "name": "BOILED EGG",
    "category": "SNACKS",
    "price": 15,
    "stock": 99999,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "089a215f-20f3-47b2-983b-5a0a94cba18e",
    "name": "CHICKEN BIRIYANI",
    "category": "SNACKS",
    "price": 65,
    "stock": 10,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "5cc854fa-cdf0-43e9-a4cf-339f8a1dcbd3",
    "name": "CHICKEN CURRY",
    "category": "SNACKS",
    "price": 50,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c149451c-7fe4-4531-9984-0addc2742fdb",
    "name": "CHICKEN KHICHURI",
    "category": "SNACKS",
    "price": 65,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c5d4c577-81ab-43cf-88ca-d0e431661a2f",
    "name": "CHICKEN ONION",
    "category": "SNACKS",
    "price": 45,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "2a22e09c-cc55-4528-8a73-225de8456c1c",
    "name": "CHICKEN PASTA",
    "category": "SNACKS",
    "price": 55,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "b3785b27-f250-4000-85bf-3fbaf804cc63",
    "name": "CHICKEN PULAW",
    "category": "SNACKS",
    "price": 65,
    "stock": 99997,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "e37bb8e1-db3f-464a-8968-74bec924ac87",
    "name": "CHOTPOTI",
    "category": "SNACKS",
    "price": 30,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "c06d9508-2367-404d-b7ca-b5c9670a4b6c",
    "name": "COLD COFFEE",
    "category": "DRINK",
    "price": 40,
    "stock": 99997,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "7bb1b308-130a-4ee5-b2c4-bff0a5e25c49",
    "name": "DRY CAKE",
    "category": "SNACKS",
    "price": 12,
    "stock": 99998,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "2cb63ae0-6f65-48c7-92f5-77add415f5ea",
    "name": "EGG FRY",
    "category": "SNACKS",
    "price": 18,
    "stock": 0,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  },
  {
    "id": "51d5db48-1160-468c-a55a-ef21b7e4b81d",
    "name": "EGG KHICURI",
    "category": "SNACKS",
    "price": 45,
    "stock": 99997,
    "created_at": "2026-09-16T11:21:03.555622+00:00"
  }
];
                  const filtered = allItems.filter(item => ids.includes(item.id));
                  
                  try {
                      const { data, error } = await supabase.from('Canteen_Inventory').select('*').in('id', ids);
                      if (!error && data && data.length > 0) {
                          setDailyMenu(data);
                          return;
                      }
                  } catch(err) {
                      console.warn("Supabase fetchMenu failed, using local mock data.");
                  }
                  
                  setDailyMenu(filtered);
              } else {
                  setDailyMenu([]);
              }
          } catch(e){}
      } else {
          setDailyMenu([]);
      }
  };

  const handlePreOrder = (item: any) => {
      setIsOrdering(true);
      setOrderedItems(prev => ({...prev, [item.id]: true}));
      
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
          } catch(e) {
              console.error(e);
          }
          setIsOrdering(false);
          setTimeout(() => {
              setOrderedItems(prev => ({...prev, [item.id]: false}));
          }, 2000);
      }, 500);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300 pb-10 mt-4 md:mt-10">
      
      {/* Profile Section */}
      <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 bg-[#0f172a] rounded-2xl flex items-center justify-center relative shadow-lg border border-slate-700 text-indigo-400">
              <User className="w-8 h-8" />
              <div className="absolute -bottom-1 -right-1 bg-[#4f46e5] rounded-full p-1 border-2 border-slate-900">
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
                      <div key={idx} className={`relative bg-slate-800 border ${orderedItems[item.id] ? 'border-emerald-500/50' : 'border-slate-700 hover:bg-slate-700'} rounded-2xl p-5 flex items-center justify-between hover:shadow-md transition-all group overflow-hidden`}>
                          {orderedItems[item.id] && (
                              <div className="absolute inset-0 bg-emerald-900/95 backdrop-blur-sm z-10 flex items-center justify-center animate-in fade-in duration-300">
                                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
                                  <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Ordered Successfully</span>
                              </div>
                          )}
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
                                  {act.type !== 'PRE-ORDER' && (
                                      <>
                                          <p className="text-sm font-black text-white">৳{act.amount}</p>
                                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{act.id}</p>
                                      </>
                                  )}
                                  {act.type === 'PRE-ORDER' && (
                                      <button onClick={() => setCancelConfirmId(act.id)} title="Cancel Order" className="mt-2 text-rose-400 hover:text-rose-300 flex items-center justify-center p-1.5 bg-rose-900/20 hover:bg-rose-900/40 rounded-full transition-colors border border-rose-500/20">
                                          <X className="w-5 h-5" />
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
                          <XCircle className="w-8 h-8" />
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
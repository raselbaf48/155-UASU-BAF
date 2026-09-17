import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, Search, X, Check, ChefHat, Clock } from 'lucide-react';
import { supabase } from '../../../supabase';
import { useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

const data = [
  { name: 'Thu', total: 5001 },
  { name: 'Fri', total: 0 },
  { name: 'Sat', total: 0 },
  { name: 'Sun', total: 1500 },
  { name: 'Mon', total: 0 },
  { name: 'Tue', total: 0 },
  { name: 'Wed', total: 0 },
];

export const ManagerDashboard: React.FC = () => {
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

  const { t, i18n } = useTranslation();
  const [memberSid, setMemberSid] = useState('');

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Curate Daily Menu Modal */}
      {showCurateMenu && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-slate-900 rounded-[2rem] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                  <button onClick={() => setShowCurateMenu(false)} className="absolute top-6 right-6 p-2 bg-slate-800 hover:bg-slate-200 rounded-full transition-colors">
                      <X className="w-5 h-5 text-slate-400" />
                  </button>
                  
                  <div className="flex items-center space-x-3 mb-6">
                      <ChefHat className="w-6 h-6 text-[#4f46e5]" />
                      <h2 className="text-xl font-black text-white uppercase tracking-widest">Curate Daily Menu</h2>
                  </div>

                  <div className="relative mb-6">
                      <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                          type="text"
                          placeholder="Search catalog..."
                          value={searchCatalog}
                          onChange={(e) => setSearchCatalog(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm font-bold text-slate-200 outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all"
                      />
                  </div>

                  <div className="flex-1 overflow-y-auto pr-2 space-y-3 mb-6">
                      {catalog.filter(i => (i.name || '').toLowerCase().includes(searchCatalog.toLowerCase())).map(item => {
                          const isSelected = selectedItems.includes(item.id);
                          return (
                              <div 
                                  key={item.id} 
                                  onClick={() => toggleSelection(item.id)}
                                  className={`flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${isSelected ? 'border-[#4f46e5] bg-[#4f46e5]/5' : 'border-slate-800 hover:border-slate-800'}`}
                              >
                                  <div className="flex items-center space-x-4">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? 'bg-[#4f46e5] text-white' : 'bg-slate-800 text-slate-400'}`}>
                                          <Utensils className="w-5 h-5" />
                                      </div>
                                      <div>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category || 'Snacks'}</p>
                                          <p className="text-sm font-bold text-white">{item.name}</p>
                                      </div>
                                  </div>
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${isSelected ? 'bg-[#4f46e5] text-white' : 'bg-slate-800 text-slate-400'}`}>
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
      
      {/* Top Banner (Manager Style) */}
      <div className="bg-[#0f172a] rounded-[2rem] p-12 flex flex-col items-center justify-center relative overflow-hidden shadow-sm">
         {/* Faint background decoration */}
         <div className="absolute left-10 top-1/2 -translate-y-1/2 opacity-5 hidden md:block">
            <Utensils className="w-64 h-64 text-white" />
         </div>
         <div className="absolute right-10 top-1/2 -translate-y-1/2 opacity-5 hidden md:block transform scale-x-[-1]">
            <Utensils className="w-64 h-64 text-white" />
         </div>

         <div className="z-10 flex flex-col items-center space-y-4">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center p-2 border border-slate-700 shadow-inner">
               <img src="https://i.postimg.cc/gcqqCXCL/Logo-(1).png" alt="Logo" className="w-full h-full object-contain opacity-80" onError={(e) => e.currentTarget.style.display = 'none'} />
            </div>
            
            <h2 className="text-4xl font-black text-white tracking-widest flex items-center space-x-3">
               <span className="text-slate-400">🍽️</span> 
               <span>CAFEUAV</span> 
               <span className="text-slate-400">🍽️</span>
            </h2>
            <p className="text-[10px] tracking-widest text-slate-400 font-bold uppercase pb-2">Eat Good Food, Serve Good!</p>
            
            <button onClick={() => setShowCurateMenu(true)} className="px-6 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-md shadow-indigo-500/20 flex items-center space-x-2">
               <span className="text-indigo-200">🍳</span>
               <span>CURATE DAILY MENU</span>
            </button>
         </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Col - Cafe Performance */}
         <div className="lg:col-span-2 bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 flex flex-col min-h-[400px]">
            <h3 className="text-xs font-black text-white tracking-widest uppercase mb-8 flex items-center space-x-2">
               <span className="text-[#4f46e5]">📈</span>
               <span>CAFE PERFORMANCE</span>
            </h3>
            <div className="flex-1 w-full h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                     <Tooltip 
                       cursor={{ fill: 'transparent' }}
                       contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                       itemStyle={{ fontWeight: 'bold', color: '#4f46e5' }}
                     />
                     <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={60}>
                       {data.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.total > 0 ? '#4f46e5' : '#cbd5e1'} />
                       ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>

         <div className="lg:col-span-3 bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 flex flex-col mt-6">
            <h3 className="text-xs font-black text-white tracking-widest uppercase mb-6 flex items-center justify-between">
               <div className="flex items-center space-x-2">
                  <span className="text-[#4f46e5]">🛎️</span>
                  <span>LIVE PRE-ORDERS</span>
               </div>
               <span className="bg-indigo-100 text-indigo-400 px-3 py-1 rounded-full text-[10px]">{preOrders.filter(p => p.status === 'pending').length} Pending</span>
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
                            <tr className="border-b border-slate-800">
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
                                <tr key={idx} className="hover:bg-slate-950 transition-colors">
                                    <td className="py-4 px-4 text-xs font-bold text-slate-400">
                                        {new Date(order.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="text-xs font-bold text-white">{order.memberName}</div>
                                        <div className="text-[10px] font-bold text-slate-400">{order.memberId}</div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <div className="flex flex-wrap gap-1">
                                            {order.items.map((it:any, i:number) => (
                                                <span key={i} className="bg-slate-800 text-slate-400 px-2 py-1 rounded-md text-[10px] font-bold">
                                                    {it.qty}x {it.name}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-xs font-black text-[#4f46e5]">৳{order.total}</td>
                                    <td className="py-4 px-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-400'}`}>
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


         {/* Right Col */}
         <div className="space-y-6 flex flex-col">
            {/* Account Check Card */}
            <div className="bg-[#0f172a] rounded-[2rem] p-8 shadow-xl shadow-slate-900/10">
               <h3 className="text-xs font-black text-white tracking-widest uppercase mb-6 flex items-center space-x-2">
                  <Search className="w-4 h-4 text-indigo-400" />
                  <span>ACCOUNT CHECK</span>
               </h3>
               <div className="space-y-4">
                  <div className="relative">
                     <input 
                        type="text"
                        placeholder="ENTER MEMBER SID..."
                        value={memberSid}
                        onChange={(e) => setMemberSid(e.target.value)}
                        className="w-full bg-[#1e293b] text-white px-5 py-4 rounded-2xl text-[10px] font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder:text-slate-400 border border-slate-800 text-center"
                     />
                  </div>
                  <button className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all shadow-md shadow-indigo-500/20">
                     VALIDATE IDENTITY
                  </button>
               </div>
            </div>

            {/* Cycle Sales Card */}
            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">CYCLE SALES</p>
               <h2 className="text-4xl font-black text-white tracking-tighter">৳14,069</h2>
            </div>

            {/* Global Debt Card */}
            <div className="bg-rose-900/30 rounded-[2rem] p-8 shadow-sm border border-rose-900/50 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-rose-400 tracking-widest uppercase mb-2">GLOBAL DEBT</p>
               <h2 className="text-4xl font-black text-rose-600 tracking-tighter">৳-1,816,144</h2>
            </div>
         </div>
      </div>
    </div>
  );
};

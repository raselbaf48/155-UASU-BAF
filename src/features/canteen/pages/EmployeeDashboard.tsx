import React, { useState, useEffect } from 'react';
import { Utensils, Search, Clock, Plus, Check, User, Phone, MessageSquare, X, Copy, CheckCheck } from 'lucide-react';
import { supabase } from '../../../supabase';
import { getCanteenConfig, resolveImageUrl, CanteenConfig, getCuratedDailyMenu } from '../utils/canteenSettings';
import { getCanteenMenuCache, fetchCanteenMenuOnce } from '../utils/canteenMenuData';
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

interface EmployeeDashboardProps { onManagerPortalClick?: () => void; currentUser?: any; }

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onManagerPortalClick, currentUser }) => {
  const [dailyMenu, setDailyMenu] = useState<any[]>(() => {
    try {
      const ids = getCuratedDailyMenu();
      if (Array.isArray(ids) && ids.length > 0) {
        const allItems = getCanteenMenuCache();
        return allItems.filter(item => ids.includes(item.id));
      }
    } catch {}
    return [];
  });
  const [isOrdering, setIsOrdering] = useState(false);
  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig>(() => getCanteenConfig());
  const [showContactModal, setShowContactModal] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const rawPhone = canteenConfig.phone || '+880 1601-676760';
  const cleanPhone = rawPhone.replace(/\s+/g, '');
  let waDigits = rawPhone.replace(/[^0-9]/g, '');
  if (waDigits.startsWith('0')) {
    waDigits = '88' + waDigits;
  } else if (!waDigits.startsWith('880') && waDigits.length === 10) {
    waDigits = '880' + waDigits;
  }
  const waUrl = `https://wa.me/${waDigits}`;
  const telUrl = `tel:${cleanPhone}`;

  const copyNumber = () => {
    navigator.clipboard.writeText(rawPhone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };
  
  useEffect(() => {
      fetchMenu();
      
      const handleStorageChange = (e: StorageEvent) => {
          if (e.key === 'canteen_daily_menu') {
              fetchMenu();
          }
          if (e.key === 'canteen_settings') {
              setCanteenConfig(getCanteenConfig());
          }
      };
      
      const handleCustomEvent = () => {
          fetchMenu();
      };

      const handleSettingsUpdated = (e: any) => {
          if (e.detail) {
              setCanteenConfig(e.detail);
          } else {
              setCanteenConfig(getCanteenConfig());
          }
      };

      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('canteen_menu_updated', handleCustomEvent);
      window.addEventListener('canteen_settings_updated', handleSettingsUpdated);
      
      return () => {
          window.removeEventListener('storage', handleStorageChange);
          window.removeEventListener('canteen_menu_updated', handleCustomEvent);
          window.removeEventListener('canteen_settings_updated', handleSettingsUpdated);
      };
  }, []);

  const fetchMenu = async () => {
    const ids = getCuratedDailyMenu();
    if (ids && ids.length > 0) {
      const cachedItems = getCanteenMenuCache();
      const filtered = cachedItems.filter(item => ids.includes(item.id));
      setDailyMenu(filtered);

      try {
        const liveItems = await fetchCanteenMenuOnce();
        if (liveItems && liveItems.length > 0) {
          setDailyMenu(liveItems.filter(item => ids.includes(item.id)));
        }
      } catch(err) {
        console.warn("EmployeeDashboard fetchMenu sync error:", err);
      }
    } else {
      setDailyMenu([]);
    }
  };

  const handlePreOrder = (item: any) => {
      try {
          const existingStr = localStorage.getItem('canteen_pre_orders') || '[]';
          let existing = [];
          try { existing = JSON.parse(existingStr); } catch(e) {}

          const memberId = currentUser?.bdNo || 'Unknown ID';
          const memberName = currentUser?.name || 'Guest';

          const pendingOrderIndex = existing.findIndex((po: any) => 
              po.status === 'pending' && 
              String(po.memberId).toLowerCase() === String(memberId).toLowerCase() &&
              Array.isArray(po.items) && po.items.some((i: any) => i.id === item.id || i.name?.toLowerCase() === item.name?.toLowerCase())
          );

          if (pendingOrderIndex !== -1) {
              const targetOrder = existing[pendingOrderIndex];
              const itmIdx = targetOrder.items.findIndex((i: any) => i.id === item.id || i.name?.toLowerCase() === item.name?.toLowerCase());
              if (itmIdx !== -1) {
                  targetOrder.items[itmIdx].qty = (Number(targetOrder.items[itmIdx].qty) || 1) + 1;
              } else {
                  targetOrder.items.push({ id: item.id, name: item.name, qty: 1, price: item.price });
              }
              targetOrder.total = targetOrder.items.reduce((sum: number, itm: any) => sum + ((Number(itm.qty) || 1) * (Number(itm.price) || 0)), 0);
              targetOrder.timestamp = new Date().toISOString();
          } else {
              const newOrder = {
                  orderId: 'PO-' + Date.now(),
                  timestamp: new Date().toISOString(),
                  memberId: memberId,
                  memberName: memberName,
                  items: [{ id: item.id, name: item.name, qty: 1, price: item.price }],
                  total: item.price,
                  status: 'pending'
              };
              existing.push(newOrder);
          }

          localStorage.setItem('canteen_pre_orders', JSON.stringify(existing));
          window.dispatchEvent(new Event('canteen_pre_orders_updated'));
          window.dispatchEvent(new Event('canteen_state_updated'));
          window.dispatchEvent(new Event('storage'));
      } catch(e) {
          console.error(e);
      }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden min-h-[160px]">
         {/* Left Side - Active Canteen Identity */}
         <div className="md:w-1/2 bg-[#0f172a] text-white p-6 md:p-8 flex flex-col justify-center items-center relative overflow-hidden">
            <Utensils className="absolute w-64 h-64 text-white opacity-10 -right-10 -bottom-10" />
            
            <div className="flex flex-col items-center space-y-2 z-10 text-center">
               <div className="w-14 h-14 bg-slate-800/90 rounded-2xl flex items-center justify-center p-1.5 border border-slate-700 shadow-inner overflow-hidden mb-1">
                 {canteenConfig.logoUrl ? (
                   <img 
                     src={resolveImageUrl(canteenConfig.logoUrl)} 
                     alt="Canteen Logo" 
                     referrerPolicy="no-referrer"
                     className="w-full h-full object-contain"
                     onError={(e) => {
                       e.currentTarget.style.display = 'none';
                     }}
                   />
                 ) : (
                   <Utensils className="w-6 h-6 text-[#4f46e5]" />
                 )}
               </div>
               <h2 className="text-3xl md:text-4xl font-black tracking-widest flex items-center justify-center space-x-2">
                 <span>{canteenConfig.name || '🍽️ CAFE UAV 🍽️'}</span>
               </h2>
               <p className="text-[10px] tracking-widest text-slate-400 font-bold uppercase">Eat Good Food, Serve Good!</p>
            </div>
         </div>

         {/* Right Side - Manager Info & Picture */}
         <div className="md:w-1/2 p-6 md:p-8 flex items-center justify-between bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800">
            <div className="flex items-center space-x-4">
               <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-indigo-500/50 shadow-md flex items-center justify-center overflow-hidden shrink-0">
                  {canteenConfig.adminImage ? (
                     <img 
                       src={resolveImageUrl(canteenConfig.adminImage)} 
                       alt={canteenConfig.managerName || 'Manager'} 
                       referrerPolicy="no-referrer"
                       className="w-full h-full object-cover"
                       onError={(e) => {
                         e.currentTarget.style.display = 'none';
                       }}
                     />
                  ) : (
                     <User className="w-8 h-8 text-indigo-400" />
                  )}
               </div>
               <div>
                  <div className="flex items-center space-x-2">
                     <span className="text-[9px] font-black text-indigo-300 uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/60">
                        CANTEEN MANAGER
                     </span>
                  </div>
                  <p className="text-xl md:text-2xl font-black text-white leading-tight mt-1">
                     {canteenConfig.managerName || 'LAC Nishad'}
                  </p>
                  <div className="flex items-center space-x-2 mt-1.5 flex-wrap gap-y-1.5">
                     <button 
                       onClick={() => setShowContactModal(true)}
                       className="group flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 transition-all text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                       title="Click for Call or WhatsApp options"
                     >
                        <Phone className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="underline decoration-slate-600 group-hover:decoration-emerald-400 underline-offset-2">{rawPhone}</span>
                     </button>

                     <div className="flex items-center space-x-1">
                        <a 
                          href={telUrl}
                          className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-800/60 transition-all shadow-sm"
                          title="Direct Phone Call"
                        >
                           <Phone className="w-3.5 h-3.5" />
                        </a>
                        <a 
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-[#25D366] text-[#25D366] hover:text-white border border-emerald-800/60 transition-all shadow-sm"
                          title="Chat on WhatsApp"
                        >
                           <MessageSquare className="w-3.5 h-3.5" />
                        </a>
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
      
      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Col - Cafe Performance */}
         <div className="lg:col-span-2 bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 flex flex-col min-h-[400px]">
            <h3 className="text-sm font-black text-white tracking-widest uppercase mb-8 flex items-center space-x-2">
               <span className="text-[#4f46e5]">📈</span>
               <span>CAFE PERFORMANCE</span>
            </h3>
            <div className="flex-1 w-full h-[300px]">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                     <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} dy={10} />
                     <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
                     <Tooltip
                        cursor={{ fill: '#1e293b' }}
                       contentStyle={{ borderRadius: '1rem', border: 'none', backgroundColor: '#0f172a', color: '#fff', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.5)' }}
                       itemStyle={{ fontWeight: 'bold', color: '#818cf8' }}
                     />
                     <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={60}>
                       {data.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.total > 0 ? '#4f46e5' : '#334155'} />
                       ))}
                     </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </div>
         </div>
         {/* Right Col */}
         <div className="space-y-6 flex flex-col">
            {/* Account Check Card */}
            <div className="bg-[#0f172a] rounded-[2rem] p-8 shadow-xl shadow-slate-900/10 border border-slate-800">
               <h3 className="text-sm font-black text-white tracking-widest uppercase mb-6 flex items-center space-x-2">
                  <Search className="w-4 h-4 text-indigo-400" />
                  <span>ACCOUNT CHECK</span>
               </h3>
               <div className="space-y-4">
                  <input 
                     type="text"
                     placeholder="ENTER MEMBER SID..."
                     className="w-full bg-[#1e293b] text-white px-5 py-4 rounded-2xl text-xs font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder:text-slate-400 border border-slate-800 text-center"
                  />
                  <button className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white py-4 rounded-2xl text-xs font-bold tracking-widest transition-all">
                     VALIDATE IDENTITY
                  </button>
               </div>
            </div>
            {/* Cycle Sales Card */}
            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1">CYCLE SALES</p>
               <h2 className="text-4xl font-black text-white tracking-tighter">৳14,069</h2>
            </div>
            {/* Global Debt Card */}
            <div className="bg-rose-900/10 rounded-[2rem] p-8 shadow-sm border border-rose-900/30 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-rose-400 tracking-widest uppercase mb-1">GLOBAL DEBT</p>
               <h2 className="text-4xl font-black text-rose-500 tracking-tighter">৳-1,816,144</h2>
            </div>
         </div>
      </div>

      {/* Manager Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setShowContactModal(false)}>
           <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setShowContactModal(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6 pt-2">
                 <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-indigo-500/50 shadow-lg flex items-center justify-center overflow-hidden mx-auto mb-3">
                   {canteenConfig.adminImage ? (
                      <img 
                        src={resolveImageUrl(canteenConfig.adminImage)} 
                        alt={canteenConfig.managerName || 'Manager'} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                   ) : (
                      <User className="w-8 h-8 text-indigo-400" />
                   )}
                 </div>
                 <h4 className="text-lg font-black text-white">{canteenConfig.managerName || 'Canteen Manager'}</h4>
                 <span className="inline-block text-[10px] font-black text-indigo-300 uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-800/60 mt-1">
                    Canteen Manager
                 </span>
                 <div className="mt-3">
                    <p className="text-sm font-mono text-slate-200 font-bold bg-slate-950 py-1.5 px-3 rounded-xl border border-slate-800 inline-block">
                       {rawPhone}
                    </p>
                 </div>
              </div>

              <div className="space-y-3">
                 <a 
                   href={telUrl}
                   className="w-full flex items-center justify-center space-x-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-900/30 active:scale-[0.98]"
                 >
                   <Phone className="w-4 h-4" />
                   <span>Direct Phone Call</span>
                 </a>

                 <a 
                   href={waUrl}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="w-full flex items-center justify-center space-x-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-lg shadow-emerald-900/30 active:scale-[0.98]"
                 >
                   <MessageSquare className="w-4 h-4" />
                   <span>WhatsApp Message</span>
                 </a>

                 <button 
                   onClick={copyNumber}
                   className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl border border-slate-700 transition-all text-xs cursor-pointer"
                 >
                   {copiedPhone ? (
                     <>
                       <CheckCheck className="w-4 h-4 text-emerald-400" />
                       <span className="text-emerald-400">Number Copied!</span>
                     </>
                   ) : (
                     <>
                       <Copy className="w-4 h-4" />
                       <span>Copy Phone Number</span>
                     </>
                   )}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

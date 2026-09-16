import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, Search, Clock, Plus, Check } from 'lucide-react';
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

interface EmployeeDashboardProps { onManagerPortalClick?: () => void; currentUser?: any; }

export const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ onManagerPortalClick, currentUser }) => {
  const [dailyMenu, setDailyMenu] = useState<any[]>([]);
  const [isOrdering, setIsOrdering] = useState(false);
  
  useEffect(() => {
      fetchMenu();
  }, []);

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
              alert('Pre-order placed successfully!');
          } catch(e) {
              console.error(e);
          }
          setIsOrdering(false);
      }, 500);
  };

  const { t, i18n } = useTranslation();
  const [memberSid, setMemberSid] = useState('');

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden h-auto md:h-40">
         {/* Left Side */}
         <div className="md:w-1/2 bg-[#0f172a] text-white p-8 flex flex-col justify-center items-center relative overflow-hidden">
            {/* Faint background UTENSILS logo */}
            <Utensils className="absolute w-64 h-64 text-white opacity-20 -right-10 -bottom-10" />
            
            <div className="flex flex-col items-center space-y-2 z-10">
               <div className="bg-[#4f46e5]/20 p-2 rounded-2xl mb-1">
                 <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center">
                    <span className="text-[8px] text-[#4f46e5] text-center leading-tight font-bold">postimg<br/>free hosting</span>
                 </div>
               </div>
               <h2 className="text-4xl font-black tracking-widest flex items-center space-x-2">
                 <span>🍽️</span> <span>CAFEUAV</span> <span>🍽️</span>
               </h2>
               <p className="text-[10px] tracking-widest text-slate-400 font-bold uppercase">Eat Good Food, Serve Good!</p>
            </div>
         </div>
         {/* Right Side */}
         <div className="md:w-1/2 p-8 flex items-center justify-between">
            <div className="flex items-center space-x-4">
               <div className="w-14 h-14 rounded-full bg-slate-800 border-2 border-white shadow-md overflow-hidden">
                  <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Nishad&backgroundColor=f1f5f9" alt="User" className="w-full h-full object-cover" />
               </div>
               <div>
                  <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">{currentUser?.role === 'manager' ? 'MANAGER' : 'MEMBER'}</p>
                  <p className="text-xl font-bold text-slate-900 leading-tight">{currentUser?.name || 'Guest'}</p>
                  <p className="text-xs font-bold text-slate-400">+880 1601-676760</p>
               </div>
            </div>
            <button onClick={onManagerPortalClick} className="px-6 py-3 rounded-full bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold tracking-widest transition-all shadow-md shadow-indigo-500/30">
               PERSONAL PORTAL
            </button>
         </div>
      </div>

      {/* Daily Menu Section */}
      <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
         <h3 className="text-xs font-black text-slate-900 tracking-widest uppercase mb-6 flex items-center space-x-2">
            <span className="text-[#4f46e5]">🍽️</span>
            <span>TODAY'S SPECIAL MENU</span>
         </h3>
         
         {dailyMenu.length === 0 ? (
             <div className="py-8 flex flex-col items-center justify-center text-slate-400">
                 <Utensils className="w-10 h-10 mb-3 opacity-20" />
                 <p className="text-[10px] font-bold uppercase tracking-widest">No items curated for today</p>
             </div>
         ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {dailyMenu.map((item, idx) => (
                     <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-all">
                         <div className="flex items-center space-x-4">
                             <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                                 <Utensils className="w-6 h-6" />
                             </div>
                             <div>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.category || 'Snacks'}</p>
                                 <p className="text-sm font-bold text-slate-900">{item.name}</p>
                                 <p className="text-xs font-black text-[#4f46e5]">৳{item.price}</p>
                             </div>
                         </div>
                         <button 
                             onClick={() => handlePreOrder(item)}
                             disabled={isOrdering}
                             className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-800 transition-colors shrink-0 shadow-sm"
                         >
                             <Plus className="w-5 h-5" />
                         </button>
                     </div>
                 ))}
             </div>
         )}
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

         {/* Right Col */}
         <div className="space-y-6 flex flex-col">
            {/* Account Check Card */}
            <div className="bg-[#0f172a] rounded-[2rem] p-8 shadow-xl shadow-slate-900/10">
               <h3 className="text-sm font-black text-white tracking-widest uppercase mb-6 flex items-center space-x-2">
                  <Search className="w-4 h-4 text-indigo-400" />
                  <span>ACCOUNT CHECK</span>
               </h3>
               <div className="space-y-4">
                  <input 
                     type="text"
                     placeholder="ENTER MEMBER SID..."
                     value={memberSid}
                     onChange={(e) => setMemberSid(e.target.value)}
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
            <div className="bg-rose-900/30 rounded-[2rem] p-8 shadow-sm border border-rose-900/50 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-rose-400 tracking-widest uppercase mb-1">GLOBAL DEBT</p>
               <h2 className="text-4xl font-black text-rose-600 tracking-tighter">৳-1,816,144</h2>
            </div>
         </div>
      </div>
    </div>
  );
};

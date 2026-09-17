import React, { useState, useEffect } from 'react';
import { Utensils, Search, Clock, Plus, Check } from 'lucide-react';
import { supabase } from '../../../supabase';
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

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden h-auto md:h-40">
         {/* Left Side */}
         <div className="md:w-1/2 bg-[#0f172a] text-white p-8 flex flex-col justify-center items-center relative overflow-hidden">
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
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.name || 'Guest'}&backgroundColor=f1f5f9`} alt="User" className="w-full h-full object-cover" />
               </div>
               <div>
                  <p className="text-[10px] font-black text-[#4f46e5] uppercase tracking-widest">{currentUser?.role === 'manager' ? 'MANAGER' : 'MEMBER'}</p>
                  <p className="text-xl font-bold text-white dark:text-white leading-tight">{currentUser?.name || 'Guest'}</p>
                  <p className="text-xs font-bold text-slate-400">+880 1601-676760</p>
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
    </div>
  );
};

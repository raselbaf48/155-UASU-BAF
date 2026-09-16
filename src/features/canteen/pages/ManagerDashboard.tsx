import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Utensils, Search } from 'lucide-react';
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
  const { t, i18n } = useTranslation();
  const [memberSid, setMemberSid] = useState('');

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
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
               <span className="text-slate-500">🍽️</span> 
               <span>CAFEUAV</span> 
               <span className="text-slate-500">🍽️</span>
            </h2>
            <p className="text-[10px] tracking-widest text-slate-400 font-bold uppercase pb-2">Eat Good Food, Serve Good!</p>
            
            <button className="px-6 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-md shadow-indigo-500/20 flex items-center space-x-2">
               <span className="text-indigo-200">🍳</span>
               <span>CURATE DAILY MENU</span>
            </button>
         </div>
      </div>

      {/* Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Left Col - Cafe Performance */}
         <div className="lg:col-span-2 bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col min-h-[400px]">
            <h3 className="text-xs font-black text-slate-800 tracking-widest uppercase mb-8 flex items-center space-x-2">
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
                        className="w-full bg-[#1e293b] text-white px-5 py-4 rounded-2xl text-[10px] font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder:text-slate-500 border border-slate-800 text-center"
                     />
                  </div>
                  <button className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white py-4 rounded-2xl text-[10px] font-black tracking-widest transition-all shadow-md shadow-indigo-500/20">
                     VALIDATE IDENTITY
                  </button>
               </div>
            </div>

            {/* Cycle Sales Card */}
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">CYCLE SALES</p>
               <h2 className="text-4xl font-black text-slate-800 tracking-tighter">৳14,069</h2>
            </div>

            {/* Global Debt Card */}
            <div className="bg-rose-50 rounded-[2rem] p-8 shadow-sm border border-rose-100 flex-1 flex flex-col justify-center">
               <p className="text-[10px] font-black text-rose-400 tracking-widest uppercase mb-2">GLOBAL DEBT</p>
               <h2 className="text-4xl font-black text-rose-600 tracking-tighter">৳-1,816,144</h2>
            </div>
         </div>
      </div>
    </div>
  );
};

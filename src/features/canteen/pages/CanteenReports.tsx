import React from 'react';
import { History } from 'lucide-react';

const mockAudit = [
  { date: '9/13/2026', type: 'CREDIT SALE', items: 'Swarma, Milk Tea', gateway: 'BAKI', amount: 112 },
  { date: '9/13/2026', type: 'CREDIT SALE', items: 'Milk Tea', gateway: 'BAKI', amount: 12 },
  { date: '9/13/2026', type: 'CREDIT SALE', items: 'Lemon Juice', gateway: 'BAKI', amount: 10 },
  { date: '9/13/2026', type: 'CREDIT SALE', items: 'Milk Tea, Normal Biscuit', gateway: 'BAKI', amount: 83 },
  { date: '9/13/2026', type: 'CREDIT SALE', items: 'Milk Tea, Normal Biscuit', gateway: 'BAKI', amount: 17 },
  { date: '9/13/2026', type: 'CREDIT SALE', items: 'Normal Biscuit, Milk Tea, Swarma', gateway: 'BAKI', amount: 72 },
  { date: '9/13/2026', type: 'CREDIT SALE', items: 'Milk Tea, Normal Biscuit', gateway: 'BAKI', amount: 17 },
  { date: '9/13/2026', type: 'CREDIT SALE', items: 'Egg Fry', gateway: 'BAKI', amount: 18 },
  { date: '9/13/2026', type: 'CREDIT SALE', items: 'Egg Fry, Black Coffee, Normal Biscuit', gateway: 'BAKI', amount: 48 },
  { date: '9/13/2026', type: 'CREDIT SALE', items: 'Boiled Egg, Lemon Juice, Swarma', gateway: 'BAKI', amount: 75 },
];

export const CanteenReports: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">FINANCIAL AUDIT</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CENTRAL LEDGER NODE</p>
         </div>
         <div className="flex items-center space-x-3">
            <button className="px-5 py-2.5 bg-[#4f46e5] text-white rounded-xl text-[10px] font-black tracking-widest hover:bg-[#4338ca] transition-colors shadow-sm">
               MASTER REPORT
            </button>
            <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none">
               <option>September</option>
            </select>
            <select className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none">
               <option>2026</option>
            </select>
         </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
            <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-1">SALES TOTAL</p>
            <h3 className="text-3xl font-black text-slate-800 tracking-tighter">৳13,904</h3>
         </div>
         <div className="bg-emerald-50 rounded-[2rem] p-6 shadow-sm border border-emerald-100">
            <p className="text-[8px] font-black text-emerald-500 tracking-widest uppercase mb-1">COLLECTIONS</p>
            <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">৳1,830,048</h3>
         </div>
         <div className="bg-rose-50 rounded-[2rem] p-6 shadow-sm border border-rose-100">
            <p className="text-[8px] font-black text-rose-500 tracking-widest uppercase mb-1">NEW BAKI</p>
            <h3 className="text-3xl font-black text-rose-600 tracking-tighter">৳13,904</h3>
         </div>
         <div className="bg-indigo-50 rounded-[2rem] p-6 shadow-sm border border-indigo-100">
            <p className="text-[8px] font-black text-indigo-500 tracking-widest uppercase mb-1">NET CASH</p>
            <h3 className="text-3xl font-black text-indigo-600 tracking-tighter">৳1,830,048</h3>
         </div>
      </div>

      {/* Audit Trail Table */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
         <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center space-x-2">
               <History className="w-4 h-4 text-indigo-500" />
               <span>AUDIT TRAIL</span>
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">253 RECORDS</span>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">TYPE</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ITEMS / NARRATION</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">GATEWAY</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">CREDIT/DEBIT</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {mockAudit.map((row, i) => (
                     <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 text-[10px] font-bold text-slate-500 whitespace-nowrap">{row.date}</td>
                        <td className="py-4 px-6 text-center">
                           <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-500 rounded text-[8px] font-black tracking-widest uppercase">
                              {row.type}
                           </span>
                        </td>
                        <td className="py-4 px-6 text-center text-[10px] font-bold text-slate-700">
                           {row.items}
                        </td>
                        <td className="py-4 px-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           {row.gateway}
                        </td>
                        <td className="py-4 px-6 text-right text-xs font-black text-slate-800">৳{row.amount}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

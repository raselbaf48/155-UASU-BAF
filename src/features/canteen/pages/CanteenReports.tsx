import React from 'react';
import { History } from 'lucide-react';



export const CanteenReports: React.FC = () => {
  const [reports, setReports] = React.useState<any[]>([]);
  
  React.useEffect(() => {
     try {
         const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
         setReports(txs);
     } catch(e) {}
  }, []);
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">FINANCIAL AUDIT</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CENTRAL LEDGER NODE</p>
         </div>
         <div className="flex items-center space-x-3">
            <button className="px-5 py-2.5 bg-[#4f46e5] text-white rounded-xl text-[10px] font-black tracking-widest hover:bg-[#4338ca] transition-colors shadow-sm">
               MASTER REPORT
            </button>
            <select className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 outline-none">
               <option>September</option>
            </select>
            <select className="px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-slate-200 outline-none">
               <option>2026</option>
            </select>
         </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
         <div className="bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-800">
            <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-1">SALES TOTAL</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">
                ৳{reports.filter(r => r.type !== 'BILL PAYMENT').reduce((a, b) => a + (b.amount || 0), 0)}
            </h3>
         </div>
         <div className="bg-emerald-900/30 rounded-[2rem] p-6 shadow-sm border border-emerald-900/50">
            <p className="text-[8px] font-black text-emerald-500 tracking-widest uppercase mb-1">COLLECTIONS</p>
            <h3 className="text-3xl font-black text-emerald-600 tracking-tighter">
                ৳{reports.filter(r => r.type === 'BILL PAYMENT').reduce((a, b) => a + (b.amount || 0), 0)}
            </h3>
         </div>
         <div className="bg-rose-900/30 rounded-[2rem] p-6 shadow-sm border border-rose-900/50">
            <p className="text-[8px] font-black text-rose-500 tracking-widest uppercase mb-1">NEW DUE</p>
            <h3 className="text-3xl font-black text-rose-600 tracking-tighter">
                ৳{reports.filter(r => r.type !== 'BILL PAYMENT' && r.gateway === 'DUE').reduce((a, b) => a + (b.amount || 0), 0)}
            </h3>
         </div>
         <div className="bg-indigo-900/30 rounded-[2rem] p-6 shadow-sm border border-indigo-900/50">
            <p className="text-[8px] font-black text-indigo-500 tracking-widest uppercase mb-1">NET CASH</p>
            <h3 className="text-3xl font-black text-indigo-600 tracking-tighter">
                ৳{reports.filter(r => r.type === 'BILL PAYMENT' || (r.type !== 'BILL PAYMENT' && r.gateway !== 'DUE')).reduce((a, b) => a + (b.amount || 0), 0)}
            </h3>
         </div>
      </div>

      {/* Audit Trail Table */}
      <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
         <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center space-x-2">
               <History className="w-4 h-4 text-indigo-500" />
               <span>AUDIT TRAIL</span>
            </h3>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{reports.length} RECORDS</span>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/50">
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">TYPE</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ITEMS / NARRATION</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">GATEWAY</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">CREDIT/DEBIT</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                  {reports.map((row, i) => (
                     <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-4 px-6 text-[10px] font-bold text-slate-400 whitespace-nowrap">{row.date}</td>
                        <td className="py-4 px-6 text-center">
                           <span className="inline-block px-2.5 py-1 bg-slate-800 text-slate-400 rounded text-[8px] font-black tracking-widest uppercase">
                              {row.type}
                           </span>
                        </td>
                        <td className="py-4 px-6 text-center text-[10px] font-bold text-slate-200">
                           {row.items}
                        </td>
                        <td className="py-4 px-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                           {row.gateway}
                        </td>
                        <td className="py-4 px-6 text-right text-xs font-black text-white">৳{row.amount}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

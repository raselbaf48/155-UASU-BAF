import React, { useState, useEffect } from 'react';
import { Wallet, Landmark, CreditCard, Receipt } from 'lucide-react';

export const CanteenFund: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'CASH' | 'UCB'>('CASH');

  useEffect(() => {
     try {
         const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
         setReports(txs);
     } catch(e) {}
  }, []);

  const totalCash = reports.filter(r => r.type === 'BILL PAYMENT' && r.gateway === 'CASH').reduce((a, b) => a + (b.amount || 0), 0);
  const totalUCB = reports.filter(r => r.type === 'BILL PAYMENT' && r.gateway === 'UCB').reduce((a, b) => a + (b.amount || 0), 0);
  const totalFund = totalCash + totalUCB;

  const cashList = reports.filter(r => r.type === 'BILL PAYMENT' && r.gateway === 'CASH');
  const ucbList = reports.filter(r => r.type === 'BILL PAYMENT' && r.gateway === 'UCB');

  const activeList = activeTab === 'CASH' ? cashList : ucbList;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <Wallet className="w-6 h-6 text-indigo-500" />
                CANTEEN FUND
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">PAYMENT GATEWAY COLLECTIONS</p>
         </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-indigo-900/30 text-indigo-500 flex items-center justify-center mb-4">
                <Wallet className="w-5 h-5" />
            </div>
            <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-1">TOTAL FUND</p>
            <h3 className="text-4xl font-black text-white tracking-tighter">
                ৳{totalFund}
            </h3>
         </div>
         <div className="bg-emerald-900/30 rounded-[2rem] p-6 shadow-sm border border-emerald-900/50">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/50 text-emerald-300 flex items-center justify-center mb-4">
                <Landmark className="w-5 h-5" />
            </div>
            <p className="text-[8px] font-black text-emerald-500 tracking-widest uppercase mb-1">TOTAL CASH</p>
            <h3 className="text-4xl font-black text-emerald-500 tracking-tighter">
                ৳{totalCash}
            </h3>
         </div>
         <div className="bg-blue-900/30 rounded-[2rem] p-6 shadow-sm border border-blue-900/50">
            <div className="w-10 h-10 rounded-xl bg-blue-900/50 text-blue-300 flex items-center justify-center mb-4">
                <CreditCard className="w-5 h-5" />
            </div>
            <p className="text-[8px] font-black text-blue-500 tracking-widest uppercase mb-1">TOTAL UCB</p>
            <h3 className="text-4xl font-black text-blue-500 tracking-tighter">
                ৳{totalUCB}
            </h3>
         </div>
      </div>

      {/* Statement Section */}
      <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
         <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center space-x-2">
               <Receipt className="w-4 h-4 text-indigo-500" />
               <span>COLLECTION STATEMENT</span>
            </h3>
            
            <div className="flex bg-slate-800 rounded-xl p-1">
                <button 
                    onClick={() => setActiveTab('CASH')}
                    className={`px-6 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors ${activeTab === 'CASH' ? 'bg-emerald-900/300 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    CASH LOGS
                </button>
                <button 
                    onClick={() => setActiveTab('UCB')}
                    className={`px-6 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors ${activeTab === 'UCB' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                    UCB LOGS
                </button>
            </div>
         </div>
         
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                     <th className="p-4">Date</th>
                     <th className="p-4">Member ID</th>
                     <th className="p-4">Gateway</th>
                     <th className="p-4 text-right">Amount</th>
                  </tr>
               </thead>
               <tbody className="text-xs text-slate-300 font-medium">
                  {activeList.length === 0 ? (
                      <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">No collections found for {activeTab}</td>
                      </tr>
                  ) : (
                      activeList.map((tx, idx) => (
                         <tr key={tx.id || idx} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                            <td className="p-4">{tx.date}</td>
                            <td className="p-4 text-indigo-400 font-bold">{tx.airman_id}</td>
                            <td className="p-4">
                                <span className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase ${tx.gateway === 'CASH' ? 'bg-emerald-900/30 text-emerald-500' : 'bg-blue-900/30 text-blue-500'}`}>
                                    {tx.gateway}
                                </span>
                            </td>
                            <td className="p-4 text-right font-black text-white">৳{tx.amount}</td>
                         </tr>
                      ))
                  )}
               </tbody>
            </table>
         </div>
      </div>

    </div>
  );
};

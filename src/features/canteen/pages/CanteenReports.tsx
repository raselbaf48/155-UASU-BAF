import React, { useState, useEffect } from 'react';
import { History, Search, FileText, ArrowUpRight, ArrowDownLeft, ShieldCheck, User, Filter, RefreshCw } from 'lucide-react';
import { supabase } from '../../../supabase';
import { formatCanteenDate } from '../utils/dateUtils';

export const CanteenReports: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [membersMap, setMembersMap] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'SALES' | 'PAYMENTS'>('ALL');

  const toEnglishDate = formatCanteenDate;

  const loadData = async () => {
    try {
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      setReports(txs);
    } catch(e) {
      setReports([]);
    }

    try {
      const { data } = await supabase.from('Canteen').select('airman_id, "BD No", Rank, Surname');
      if (data && data.length > 0) {
        const map: Record<string, any> = {};
        data.forEach(m => {
          const aid = String(m.airman_id || '').toLowerCase();
          const cleanAid = aid.replace(/^airman-/i, '').replace(/^BD\/?/i, '').trim();
          const bd = String(m['BD No'] || '').toLowerCase();
          const cleanBd = bd.replace(/^BD\/?/i, '').trim();
          const fullName = [m.Rank, m.Surname].filter(Boolean).join(' ') || m['BD No'] || m.airman_id;
          const info = { name: fullName, rank: m.Rank || '', bdNo: m['BD No'] || cleanBd };
          if (aid) map[aid] = info;
          if (cleanAid) map[cleanAid] = info;
          if (bd) map[bd] = info;
          if (cleanBd) map[cleanBd] = info;
        });
        setMembersMap(map);
      }
    } catch(e) {}
  };

  useEffect(() => {
    loadData();

    const handleSync = () => loadData();
    window.addEventListener('canteen_txs_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('canteen_txs_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const getMemberDetails = (row: any) => {
    if (row.memberName && row.bdNo) {
      return { name: row.memberName, bdNo: row.bdNo, rank: row.rank || '' };
    }

    const rawKey = String(row.airman_id || row.bdNo || '').toLowerCase();
    const cleanKey = rawKey.replace(/^airman-/i, '').replace(/^BD\/?/i, '').trim();
    if (membersMap[rawKey]) return membersMap[rawKey];
    if (membersMap[cleanKey]) return membersMap[cleanKey];

    const fallbackBd = row.bdNo || cleanKey || 'Member';
    const fallbackName = row.memberName || (row.bdNo ? `Member (BD-${row.bdNo})` : 'Canteen Customer');
    return { name: fallbackName, bdNo: fallbackBd, rank: row.rank || '' };
  };

  const isPaymentType = (type: any) => {
    const t = String(type || '').toUpperCase();
    return t === 'BILL PAYMENT' || t === 'PAYMENT';
  };

  const filteredReports = reports.filter(row => {
    const isPayment = isPaymentType(row.type);
    if (filterType === 'SALES' && isPayment) return false;
    if (filterType === 'PAYMENTS' && !isPayment) return false;

    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const member = getMemberDetails(row);
    const dateStr = toEnglishDate(row.date).toLowerCase();
    const descStr = String(row.items || '').toLowerCase();
    const memberName = String(member.name || '').toLowerCase();
    const bdNo = String(member.bdNo || '').toLowerCase();
    const gateway = String(row.gateway || '').toLowerCase();

    return dateStr.includes(term) || descStr.includes(term) || memberName.includes(term) || bdNo.includes(term) || gateway.includes(term);
  });

  const totalSales = reports.filter(r => !isPaymentType(r.type)).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const totalCollections = reports.filter(r => isPaymentType(r.type)).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const newDue = reports.filter(r => !isPaymentType(r.type) && String(r.gateway || 'DUE').toUpperCase() === 'DUE').reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const netCash = reports.filter(r => isPaymentType(r.type) || (!isPaymentType(r.type) && String(r.gateway).toUpperCase() !== 'DUE')).reduce((a, b) => a + (Number(b.amount) || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">FINANCIAL AUDIT & SALES REPORT</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CENTRAL TRANSACTION & BILLING LEDGER</p>
         </div>
         <div className="flex items-center space-x-3">
            <button 
              type="button"
              onClick={loadData}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black tracking-widest transition-colors flex items-center space-x-1.5 cursor-pointer border border-slate-700"
            >
               <RefreshCw className="w-3.5 h-3.5" />
               <span>SYNC</span>
            </button>
            <div className="px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300">
               Cycle: 2026
            </div>
         </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
         <div className="bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-800">
            <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase mb-1">TOTAL SALES</p>
            <h3 className="text-3xl font-black text-white tracking-tighter">
                ৳{totalSales.toLocaleString('en-US')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">All item purchases & canteen orders</p>
         </div>
         <div className="bg-emerald-950/20 rounded-[2rem] p-6 shadow-sm border border-emerald-900/40">
            <p className="text-[9px] font-black text-emerald-400 tracking-widest uppercase mb-1">COLLECTIONS</p>
            <h3 className="text-3xl font-black text-emerald-400 tracking-tighter">
                ৳{totalCollections.toLocaleString('en-US')}
            </h3>
            <p className="text-[10px] text-emerald-500/80 mt-1 font-medium">Bill payments received</p>
         </div>
         <div className="bg-rose-950/20 rounded-[2rem] p-6 shadow-sm border border-rose-900/40">
            <p className="text-[9px] font-black text-rose-400 tracking-widest uppercase mb-1">NEW DUE (CREDIT)</p>
            <h3 className="text-3xl font-black text-rose-400 tracking-tighter">
                ৳{newDue.toLocaleString('en-US')}
            </h3>
            <p className="text-[10px] text-rose-500/80 mt-1 font-medium">Sales charged to member dues</p>
         </div>
         <div className="bg-indigo-950/20 rounded-[2rem] p-6 shadow-sm border border-indigo-900/40">
            <p className="text-[9px] font-black text-indigo-400 tracking-widest uppercase mb-1">NET CASH REALIZED</p>
            <h3 className="text-3xl font-black text-indigo-400 tracking-tighter">
                ৳{netCash.toLocaleString('en-US')}
            </h3>
            <p className="text-[10px] text-indigo-400/80 mt-1 font-medium">Cash sales + collections</p>
         </div>
      </div>

      {/* Audit Trail Table */}
      <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
         {/* Filter Bar */}
         <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
               <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                  <History className="w-5 h-5" />
               </div>
               <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">
                     TRANSACTION AUDIT TRAIL
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                     {filteredReports.length} of {reports.length} records shown
                  </p>
               </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
               {/* Type Filter Buttons */}
               <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                     type="button"
                     onClick={() => setFilterType('ALL')}
                     className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        filterType === 'ALL' ? 'bg-[#4f46e5] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                     }`}
                  >
                     ALL
                  </button>
                  <button
                     type="button"
                     onClick={() => setFilterType('SALES')}
                     className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        filterType === 'SALES' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                     }`}
                  >
                     SALES
                  </button>
                  <button
                     type="button"
                     onClick={() => setFilterType('PAYMENTS')}
                     className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        filterType === 'PAYMENTS' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                     }`}
                  >
                     PAYMENTS
                  </button>
               </div>

               {/* Search Box */}
               <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                     type="text"
                     placeholder="Search Member, BD No, Item..."
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                     className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
               </div>
            </div>
         </div>

         {/* Table */}
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/60">
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">TYPE</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">MEMBER / BENEFICIARY</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">ITEMS / NARRATION</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">GATEWAY</th>
                     <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">AMOUNT</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800/80">
                  {filteredReports.length === 0 ? (
                     <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                           No transactions found matching criteria
                        </td>
                     </tr>
                  ) : (
                     filteredReports.map((row, i) => {
                        const isPayment = isPaymentType(row.type);
                        const member = getMemberDetails(row);

                        return (
                           <tr key={row.id || i} className="hover:bg-slate-800/40 transition-colors">
                              {/* Date in English */}
                              <td className="py-4 px-6 text-[11px] font-mono font-bold text-slate-300 whitespace-nowrap">
                                 {toEnglishDate(row.date)}
                              </td>

                              {/* Type: SALE or PAYMENT */}
                              <td className="py-4 px-6 text-center whitespace-nowrap">
                                 {isPayment ? (
                                    <span className="inline-block px-3 py-1 bg-indigo-950/80 text-indigo-400 border border-indigo-500/30 rounded-lg text-[9px] font-black tracking-widest uppercase">
                                       PAYMENT
                                    </span>
                                 ) : (
                                    <span className="inline-block px-3 py-1 bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 rounded-lg text-[9px] font-black tracking-widest uppercase">
                                       SALE
                                    </span>
                                 )}
                              </td>

                              {/* Who: Sold To or Paid By */}
                              <td className="py-4 px-6 min-w-[200px]">
                                 <div className="flex flex-col">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                                       {isPayment ? 'Paid By' : 'Sold To'}
                                    </span>
                                    <span className="text-xs font-black text-white uppercase tracking-tight">
                                       {member.name}
                                    </span>
                                    <span className="text-[10px] font-mono font-bold text-indigo-400">
                                       BD: {member.bdNo}
                                    </span>
                                 </div>
                              </td>

                              {/* Items / Narration */}
                              <td className="py-4 px-6 text-[11px] font-medium text-slate-200 max-w-[280px]">
                                 {row.items || (isPayment ? 'Bill Payment' : 'Canteen Sale')}
                              </td>

                              {/* Gateway */}
                              <td className="py-4 px-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
                                 <span className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-md">
                                    {row.gateway || (isPayment ? 'CASH' : 'DUE')}
                                 </span>
                              </td>

                              {/* Amount */}
                              <td className="py-4 px-6 text-right whitespace-nowrap">
                                 {isPayment ? (
                                    <span className="text-sm font-black text-indigo-400 font-mono">
                                       +৳{Number(row.amount || 0).toLocaleString('en-US')}
                                    </span>
                                 ) : (
                                    <span className="text-sm font-black text-emerald-400 font-mono">
                                       ৳{Number(row.amount || 0).toLocaleString('en-US')}
                                    </span>
                                 )}
                              </td>
                           </tr>
                        );
                     })
                  )}
               </tbody>
            </table>
         </div>
      </div>
    </div>
  );
};

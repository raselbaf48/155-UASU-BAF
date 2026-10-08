import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  History, Search, FileText, ArrowUpRight, ArrowDownLeft, ShieldCheck, User, Filter, 
  RefreshCw, Calendar, Printer, Download, Eye, CheckCircle2, ChevronRight, BookOpen,
  PieChart, Layers, Users, X, Utensils, CreditCard
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { formatCanteenDate } from '../utils/dateUtils';

// Helper to check and filter out any Cash Advance, Advance Return, Bazar Return or Refund
export const isAdvanceRelated = (tx: any): boolean => {
  if (!tx) return false;
  const t = String(tx?.type || '').toUpperCase().trim();
  const id = String(tx?.id || '').toLowerCase();
  const items = String(tx?.items || '').toLowerCase();

  return (
    t === 'ADVANCE' ||
    t === 'ADVANCE_PAYMENT' ||
    t === 'ADVANCE_RETURN' ||
    t === 'BAZAR_RETURN' ||
    t === 'CASH_ADVANCE' ||
    t === 'CASH_REFUND' ||
    t === 'REFUND' ||
    t === 'BAZAR_ADVANCE' ||
    id.startsWith('tx-adv-') ||
    id.startsWith('adv-') ||
    id.startsWith('tx-bazar-') ||
    items.includes('cash advance') ||
    items.includes('cash refund') ||
    items.includes('advance return') ||
    items.includes('উদ্বৃত্ত ফেরত') ||
    items.includes('অগ্রিম') ||
    items.includes('advance settle')
  );
};

// Check if transaction is a Bill Payment
export const isPaymentTransaction = (tx: any): boolean => {
  if (!tx || isAdvanceRelated(tx)) return false;
  const t = String(tx?.type || '').toUpperCase().trim();
  const id = String(tx?.id || '').toLowerCase();
  const items = String(tx?.items || '').toLowerCase();

  return (
    t === 'BILL PAYMENT' ||
    t === 'PAYMENT' ||
    t === 'BILL_PAYMENT' ||
    id.startsWith('tx-pay-') ||
    id.startsWith('pay-') ||
    items.includes('bill payment') ||
    items.includes('বিল পরিশোধ') ||
    items.includes('পরিশোধ')
  );
};

// Rank Categorization Helpers
export const isOfficerMember = (rank: string): boolean => {
  const r = String(rank || '').toUpperCase().trim();
  const officerRanks = ['ACM', 'AM', 'AVM', 'AIR CDRE', 'GP CAPT', 'WG CDR', 'SQN LDR', 'FLT LT', 'FG OFFR', 'FLG OFFR', 'PLT OFFR'];
  return officerRanks.some((or) => r.includes(or));
};

export const isCivilianMember = (rank: string): boolean => {
  const r = String(rank || '').toUpperCase().trim();
  return r.includes('CIV') || r.includes('NC(E)') || r.includes('NCE');
};

export const getMemberCategory = (rank: string): 'OFFICER' | 'CIVILIAN' | 'AIRMEN' => {
  if (isOfficerMember(rank)) return 'OFFICER';
  if (isCivilianMember(rank)) return 'CIVILIAN';
  return 'AIRMEN';
};

// Month formatting utility
export const getRowMonthKey = (val: any): string => {
  if (!val) return '';
  const d = new Date(val);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  const str = String(val).trim();
  const ymdMatch = str.match(/^(\d{4})[-\/](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${String(ymdMatch[2]).padStart(2, '0')}`;
  }
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmyMatch) {
    let yr = parseInt(dmyMatch[3], 10);
    if (yr < 100) yr += 2000;
    return `${yr}-${String(dmyMatch[2]).padStart(2, '0')}`;
  }
  return '';
};

export const formatMonthKeyLabel = (key: string): string => {
  if (!key || key === 'ALL') return 'সব মাস (All Records)';
  const [yr, mo] = key.split('-');
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthIdx = parseInt(mo, 10) - 1;
  const name = monthNames[monthIdx] || mo;
  return `${name} ${yr}`;
};

export const CanteenReports: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [membersMap, setMembersMap] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'SALES' | 'PAYMENTS'>('ALL');

  // Report view modes: 'AUDIT' (Standard Audit Trail) or 'MASTER' (Master Report & Combined Ledger)
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'MASTER'>('AUDIT');
  const [masterSubTab, setMasterSubTab] = useState<'COMBINED' | 'MEMBER_SUMMARY' | 'ITEM_SUMMARY'>('COMBINED');
  const [masterRankFilter, setMasterRankFilter] = useState<'ALL' | 'OFFICER' | 'AIRMEN' | 'CIVILIAN'>('ALL');
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Month Filter State (Default 'ALL' or running month)
  const runningMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  const toEnglishDate = formatCanteenDate;

  const loadData = async () => {
    try {
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      setReports(txs);
    } catch(e) {
      setReports([]);
    }

    try {
      const { data } = await supabase.from('Canteen_Member').select('airman_id, "BD No", Rank, Surname, Due');
      if (data && data.length > 0) {
        const map: Record<string, any> = {};
        data.forEach(m => {
          const aid = String(m.airman_id || '').toLowerCase();
          const cleanAid = aid.replace(/^airman-/i, '').replace(/^BD\/?/i, '').trim();
          const bd = String(m['BD No'] || '').toLowerCase();
          const cleanBd = bd.replace(/^BD\/?/i, '').trim();
          const fullName = [m.Rank, m.Surname].filter(Boolean).join(' ') || m['BD No'] || m.airman_id;
          const info = { 
            name: fullName, 
            rank: m.Rank || '', 
            surname: m.Surname || '',
            bdNo: m['BD No'] || cleanBd,
            due: Number(m.Due || 0)
          };
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
      return { 
        name: row.memberName, 
        bdNo: row.bdNo, 
        rank: row.rank || '',
        category: getMemberCategory(row.rank || '')
      };
    }

    const rawKey = String(row.airman_id || row.bdNo || '').toLowerCase();
    const cleanKey = rawKey.replace(/^airman-/i, '').replace(/^BD\/?/i, '').trim();
    if (membersMap[rawKey]) {
      const m = membersMap[rawKey];
      return { ...m, category: getMemberCategory(m.rank) };
    }
    if (membersMap[cleanKey]) {
      const m = membersMap[cleanKey];
      return { ...m, category: getMemberCategory(m.rank) };
    }

    const fallbackBd = row.bdNo || cleanKey || 'Member';
    const fallbackName = row.memberName || (row.bdNo ? `Member (BD-${row.bdNo})` : 'Canteen Customer');
    return { 
      name: fallbackName, 
      bdNo: fallbackBd, 
      rank: row.rank || '',
      category: getMemberCategory(row.rank || '')
    };
  };

  // 1. Strict Exclusion of Cash Advances ("Report e Cash advancer er history asbe na sudhu sales & Payment er history asbe")
  const validReports = useMemo(() => {
    return reports.filter(r => !isAdvanceRelated(r));
  }, [reports]);

  // Extract available months dynamically from transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    set.add(runningMonthKey);
    validReports.forEach(r => {
      const k = getRowMonthKey(r.date);
      if (k) set.add(k);
    });
    return Array.from(set).sort().reverse();
  }, [validReports, runningMonthKey]);

  // Filter reports by selected Month
  const monthFilteredReports = useMemo(() => {
    if (selectedMonth === 'ALL') return validReports;
    return validReports.filter(r => getRowMonthKey(r.date) === selectedMonth);
  }, [validReports, selectedMonth]);

  // Filter reports by Search Term and Type for Audit Trail
  const filteredReports = useMemo(() => {
    return monthFilteredReports.filter(row => {
      const isPayment = isPaymentTransaction(row);
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
  }, [monthFilteredReports, filterType, searchTerm, membersMap]);

  // KPI Metrics for the selected month/period (Strictly Sales and Payments only)
  const totalSales = useMemo(() => {
    return monthFilteredReports.filter(r => !isPaymentTransaction(r)).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  }, [monthFilteredReports]);

  const totalCollections = useMemo(() => {
    return monthFilteredReports.filter(r => isPaymentTransaction(r)).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  }, [monthFilteredReports]);

  const newDue = useMemo(() => {
    return monthFilteredReports.filter(r => !isPaymentTransaction(r) && String(r.gateway || 'DUE').toUpperCase() === 'DUE').reduce((a, b) => a + (Number(b.amount) || 0), 0);
  }, [monthFilteredReports]);

  const netCash = useMemo(() => {
    return monthFilteredReports.filter(r => isPaymentTransaction(r) || (!isPaymentTransaction(r) && String(r.gateway).toUpperCase() !== 'DUE')).reduce((a, b) => a + (Number(b.amount) || 0), 0);
  }, [monthFilteredReports]);

  // Master Report: Filtered rows for Master Report (by Rank & Search Term)
  const masterFilteredRows = useMemo(() => {
    return monthFilteredReports.filter(row => {
      const member = getMemberDetails(row);
      if (masterRankFilter === 'OFFICER' && member.category !== 'OFFICER') return false;
      if (masterRankFilter === 'AIRMEN' && member.category !== 'AIRMEN') return false;
      if (masterRankFilter === 'CIVILIAN' && member.category !== 'CIVILIAN') return false;

      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const dateStr = toEnglishDate(row.date).toLowerCase();
      const descStr = String(row.items || '').toLowerCase();
      const memberName = String(member.name || '').toLowerCase();
      const bdNo = String(member.bdNo || '').toLowerCase();
      const gateway = String(row.gateway || '').toLowerCase();

      return dateStr.includes(term) || descStr.includes(term) || memberName.includes(term) || bdNo.includes(term) || gateway.includes(term);
    });
  }, [monthFilteredReports, masterRankFilter, searchTerm, membersMap]);

  // Master Report: Member-wise Aggregated Summary ("ke kobe ki kheyese , kbe koto tk payment diyese a to z sob paowa jbe")
  const memberWiseSummaries = useMemo(() => {
    const summaryMap: Record<string, {
      bdNo: string;
      name: string;
      rank: string;
      category: 'OFFICER' | 'CIVILIAN' | 'AIRMEN';
      totalSales: number;
      totalPayments: number;
      txCount: number;
      itemsConsumed: string[];
      lastDate: string;
      currentDue: number;
    }> = {};

    masterFilteredRows.forEach(row => {
      const member = getMemberDetails(row);
      const key = String(member.bdNo || row.airman_id || 'UNKNOWN').trim().toLowerCase();

      if (!summaryMap[key]) {
        summaryMap[key] = {
          bdNo: member.bdNo,
          name: member.name,
          rank: member.rank,
          category: member.category,
          totalSales: 0,
          totalPayments: 0,
          txCount: 0,
          itemsConsumed: [],
          lastDate: row.date || '',
          currentDue: member.due || 0
        };
      }

      const rec = summaryMap[key];
      rec.txCount += 1;
      if (row.date && (!rec.lastDate || new Date(row.date) > new Date(rec.lastDate))) {
        rec.lastDate = row.date;
      }

      if (isPaymentTransaction(row)) {
        rec.totalPayments += Number(row.amount) || 0;
      } else {
        rec.totalSales += Number(row.amount) || 0;
        if (row.items) {
          rec.itemsConsumed.push(row.items);
        }
      }
    });

    return Object.values(summaryMap).sort((a, b) => b.totalSales - a.totalSales);
  }, [masterFilteredRows, membersMap]);

  // Master Report: Item-wise Consumption Breakdown
  const itemWiseSummaries = useMemo(() => {
    const itemMap: Record<string, { name: string; count: number; totalAmount: number }> = {};

    masterFilteredRows.forEach(row => {
      if (isPaymentTransaction(row)) return;
      const itemsStr = String(row.items || '').trim();
      if (!itemsStr) return;

      // Extract item fragments, e.g. "সিঙ্গারা (২), চা (১)" or single item
      const parts = itemsStr.split(',').map(s => s.trim()).filter(Boolean);
      parts.forEach(part => {
        const match = part.match(/^(.+?)\s*(?:\((\d+)\))?$/);
        const name = match ? match[1].trim() : part;
        const qty = match && match[2] ? parseInt(match[2], 10) : 1;

        if (!itemMap[name]) {
          itemMap[name] = { name, count: 0, totalAmount: 0 };
        }
        itemMap[name].count += qty;
      });
    });

    return Object.values(itemMap).sort((a, b) => b.count - a.count);
  }, [masterFilteredRows]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16 px-2 sm:px-4">
      
      {/* Top Header & Master Mode Navigation */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/90 p-5 rounded-[2rem] border border-slate-800 shadow-md">
         <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                CANTEEN FINANCIAL AUDIT & REPORTS
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-black border border-emerald-500/30">
                AUDITED
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Pure Sales & Payment Ledger • Cash Advances excluded • Central Canteen Database
            </p>
         </div>

         {/* Mode Switcher & Actions */}
         <div className="flex items-center space-x-2.5 flex-wrap gap-y-2">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
               <button
                  type="button"
                  onClick={() => setActiveTab('AUDIT')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
                     activeTab === 'AUDIT'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                  }`}
               >
                  <History className="w-3.5 h-3.5" />
                  <span>Audit Trail</span>
               </button>
               <button
                  type="button"
                  onClick={() => setActiveTab('MASTER')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 ${
                     activeTab === 'MASTER'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                  }`}
               >
                  <BookOpen className="w-3.5 h-3.5 text-white" />
                  <span>Master Report</span>
               </button>
            </div>

            {/* Print Preview Button */}
            <button
               type="button"
               onClick={() => setShowPrintModal(true)}
               className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 border border-slate-700 rounded-2xl text-xs font-black tracking-wider uppercase transition-all shadow-sm flex items-center space-x-2 cursor-pointer"
               title="Print Preview of Master Report"
            >
               <Printer className="w-4 h-4 text-emerald-400" />
               <span className="hidden sm:inline">Print Preview</span>
            </button>

            <button 
              type="button"
              onClick={loadData}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-black tracking-wider transition-colors flex items-center space-x-1.5 cursor-pointer border border-slate-700"
              title="Refresh / Sync Data"
            >
               <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
               <span>SYNC</span>
            </button>
         </div>
      </div>

      {/* TOP MONTH FILTER BAR ("opore Month filtr thakbe") */}
      <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
         <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
               <Calendar className="w-4 h-4" />
            </div>
            <div>
               <h4 className="text-xs font-black text-white uppercase tracking-wider">মাস ফিল্টার (MONTH FILTER)</h4>
               <p className="text-[10px] text-slate-400">নির্দিষ্ট মাসের রিপোর্ট ও হিসাব দেখতে নির্বাচন করুন</p>
            </div>
         </div>

         <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {/* Quick Button: All Records */}
            <button
               type="button"
               onClick={() => setSelectedMonth('ALL')}
               className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer border ${
                  selectedMonth === 'ALL'
                     ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                     : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
               }`}
            >
               সব রেকর্ড (All Months)
            </button>

            {/* Quick Button: Running Month */}
            <button
               type="button"
               onClick={() => setSelectedMonth(runningMonthKey)}
               className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer border ${
                  selectedMonth === runningMonthKey
                     ? 'bg-amber-600 text-white border-amber-500 shadow-sm'
                     : 'bg-slate-950 text-slate-400 hover:text-white border-slate-800'
               }`}
            >
               চলতি মাস (Current)
            </button>

            {/* Month Dropdown */}
            <div className="relative">
               <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-slate-950 border border-slate-700/80 rounded-xl px-3.5 py-1.5 text-xs font-black text-amber-300 focus:outline-none focus:border-amber-500 transition-all cursor-pointer"
               >
                  <option value="ALL">সব মাস (All Records)</option>
                  {availableMonths.map(mKey => (
                     <option key={mKey} value={mKey}>
                        {formatMonthKeyLabel(mKey)}{mKey === runningMonthKey ? ' ★ চলতি মাস' : ''}
                     </option>
                  ))}
               </select>
            </div>

            <span className="px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono font-bold text-slate-300">
               {monthFilteredReports.length} লেনদেন
            </span>
         </div>
      </div>

      {/* KPI Metrics Cards (Sales & Payment only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
         <div className="bg-slate-900 rounded-[2rem] p-5 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between">
               <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase">TOTAL SALES</p>
               <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[9px] font-mono font-bold">খাবার বিক্রয়</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                ৳{totalSales.toLocaleString('en-US')}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 font-medium">All item purchases & canteen orders</p>
         </div>

         <div className="bg-emerald-950/20 rounded-[2rem] p-5 shadow-sm border border-emerald-900/40">
            <div className="flex items-center justify-between">
               <p className="text-[10px] font-black text-emerald-400 tracking-widest uppercase">COLLECTIONS</p>
               <span className="px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 text-[9px] font-mono font-bold">পরিশোধ আদায়</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight mt-1">
                ৳{totalCollections.toLocaleString('en-US')}
            </h3>
            <p className="text-[11px] text-emerald-500/80 mt-1 font-medium">Bill payments received</p>
         </div>

         <div className="bg-rose-950/20 rounded-[2rem] p-5 shadow-sm border border-rose-900/40">
            <div className="flex items-center justify-between">
               <p className="text-[10px] font-black text-rose-400 tracking-widest uppercase">NEW DUE (CREDIT)</p>
               <span className="px-2 py-0.5 rounded-full bg-rose-900/40 text-rose-300 text-[9px] font-mono font-bold">বাকি বিক্রয়</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-rose-400 tracking-tight mt-1">
                ৳{newDue.toLocaleString('en-US')}
            </h3>
            <p className="text-[11px] text-rose-500/80 mt-1 font-medium">Sales charged to member dues</p>
         </div>

         <div className="bg-indigo-950/20 rounded-[2rem] p-5 shadow-sm border border-indigo-900/40">
            <div className="flex items-center justify-between">
               <p className="text-[10px] font-black text-indigo-400 tracking-widest uppercase">NET CASH REALIZED</p>
               <span className="px-2 py-0.5 rounded-full bg-indigo-900/40 text-indigo-300 text-[9px] font-mono font-bold">নগদ আদায়</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-indigo-400 tracking-tight mt-1">
                ৳{netCash.toLocaleString('en-US')}
            </h3>
            <p className="text-[11px] text-indigo-400/80 mt-1 font-medium">Cash sales + bill collections</p>
         </div>
      </div>

      {/* VIEW MODE 1: STANDARD AUDIT TRAIL */}
      {activeTab === 'AUDIT' && (
         <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
            {/* Filter Bar */}
            <div className="p-5 sm:p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
               <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                     <History className="w-5 h-5" />
                  </div>
                  <div>
                     <h3 className="text-xs font-black text-white uppercase tracking-widest">
                        TRANSACTION AUDIT TRAIL
                     </h3>
                     <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {filteredReports.length} of {monthFilteredReports.length} records shown ({formatMonthKeyLabel(selectedMonth)})
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
                           const isPayment = isPaymentTransaction(row);
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
      )}

      {/* VIEW MODE 2: MASTER REPORT & COMBINED LEDGER ("Master Report er option thakbe jekhane all types of report thakbe") */}
      {activeTab === 'MASTER' && (
         <div className="bg-slate-900 rounded-[2rem] shadow-xl border border-slate-800 overflow-hidden space-y-6 p-5 sm:p-6">
            
            {/* Master Report Sub-Tabs & Filters */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
               <div>
                  <div className="flex items-center space-x-2.5">
                     <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <BookOpen className="w-5 h-5" />
                     </div>
                     <div>
                        <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                           সেন্ট্রাল মাস্টার রিপোর্ট ও সমন্বিত খতিয়ান (MASTER AUDIT)
                        </h3>
                        <p className="text-xs text-slate-400">
                           {formatMonthKeyLabel(selectedMonth)} • A to Z কে কি খেয়েছে এবং কত টাকা পরিশোধ করেছে
                        </p>
                     </div>
                  </div>
               </div>

               {/* Master Sub-Navigation & Rank Filter */}
               <div className="flex flex-wrap items-center gap-2">
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                     <button
                        type="button"
                        onClick={() => setMasterSubTab('COMBINED')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                           masterSubTab === 'COMBINED' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                     >
                        সমগ্র লেজার (All Ledger)
                     </button>
                     <button
                        type="button"
                        onClick={() => setMasterSubTab('MEMBER_SUMMARY')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                           masterSubTab === 'MEMBER_SUMMARY' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                     >
                        সদস্যভিত্তিক হিসাব ({memberWiseSummaries.length})
                     </button>
                     <button
                        type="button"
                        onClick={() => setMasterSubTab('ITEM_SUMMARY')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                           masterSubTab === 'ITEM_SUMMARY' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                        }`}
                     >
                        খাবার বিবরণী ({itemWiseSummaries.length})
                     </button>
                  </div>

                  {/* Rank Filter */}
                  <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                     {(['ALL', 'OFFICER', 'AIRMEN', 'CIVILIAN'] as const).map(r => (
                        <button
                           key={r}
                           type="button"
                           onClick={() => setMasterRankFilter(r)}
                           className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              masterRankFilter === r ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                           }`}
                        >
                           {r}
                        </button>
                     ))}
                  </div>

                  {/* Print Button inside Master Report */}
                  <button
                     type="button"
                     onClick={() => setShowPrintModal(true)}
                     className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                  >
                     <Printer className="w-3.5 h-3.5" />
                     <span>প্রিন্ট প্রিভিউ</span>
                  </button>
               </div>
            </div>

            {/* SUB-VIEW 1: COMBINED DETAILED TABLE ("table akare combined report show korbe jekhane thakbe ke kobe ki kheyese , kbe koto tk payment diyese a to z sob paowa jbe") */}
            {masterSubTab === 'COMBINED' && (
               <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                     <p className="text-xs text-slate-300 font-bold">
                        মোট {masterFilteredRows.length} টি লেনদেন প্রদর্শিত হচ্ছে • বিক্রয়: ৳{totalSales.toLocaleString()} | পরিশোধ: ৳{totalCollections.toLocaleString()}
                     </p>

                     <div className="relative min-w-[240px]">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                           type="text"
                           placeholder="Search member, BD, food..."
                           value={searchTerm}
                           onChange={e => setSearchTerm(e.target.value)}
                           className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                     </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-800">
                     <table className="w-full text-left border-collapse text-xs">
                        <thead>
                           <tr className="border-b border-slate-800 bg-slate-950/80">
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">#SL</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">তারিখ</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">সদস্য ও বিডি নম্বর</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ক্যাটাগরি</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ধরন</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">কি খেয়েছে / বিবরণ</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">বিক্রয় (৳)</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">পরিশোধ (৳)</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">গেটওয়ে</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                           {masterFilteredRows.length === 0 ? (
                              <tr>
                                 <td colSpan={9} className="py-12 text-center text-slate-400 text-xs font-bold uppercase">
                                    কোন তথ্য পাওয়া যায়নি
                                 </td>
                              </tr>
                           ) : (
                              masterFilteredRows.map((row, idx) => {
                                 const isPayment = isPaymentTransaction(row);
                                 const member = getMemberDetails(row);

                                 return (
                                    <tr key={row.id || idx} className="hover:bg-slate-800/40 transition-colors">
                                       <td className="py-3 px-4 font-mono font-bold text-slate-500 text-center">
                                          {idx + 1}
                                       </td>
                                       <td className="py-3 px-4 font-mono font-bold text-slate-300 whitespace-nowrap">
                                          {toEnglishDate(row.date)}
                                       </td>
                                       <td className="py-3 px-4">
                                          <div className="font-bold text-white uppercase">{member.name}</div>
                                          <div className="text-[10px] font-mono font-bold text-indigo-400">BD: {member.bdNo}</div>
                                       </td>
                                       <td className="py-3 px-4 text-center">
                                          <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase bg-slate-950 text-slate-400 border border-slate-800">
                                             {member.category}
                                          </span>
                                       </td>
                                       <td className="py-3 px-4 text-center whitespace-nowrap">
                                          {isPayment ? (
                                             <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase bg-indigo-950/80 text-indigo-400 border border-indigo-500/30">
                                                পরিশোধ
                                             </span>
                                          ) : (
                                             <span className="px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                                                খাদ্য গ্রহণ
                                             </span>
                                          )}
                                       </td>
                                       <td className="py-3 px-4 text-slate-200 font-medium max-w-[280px]">
                                          {row.items || (isPayment ? 'বিল পরিশোধ' : 'ক্যান্টিন খাবার')}
                                       </td>
                                       <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                                          {!isPayment ? `৳${Number(row.amount || 0).toLocaleString()}` : '-'}
                                       </td>
                                       <td className="py-3 px-4 text-right font-mono font-bold text-indigo-400">
                                          {isPayment ? `+৳${Number(row.amount || 0).toLocaleString()}` : '-'}
                                       </td>
                                       <td className="py-3 px-4 text-center whitespace-nowrap">
                                          <span className="px-2 py-0.5 rounded bg-slate-950 text-slate-400 font-mono text-[10px] border border-slate-800">
                                             {row.gateway || (isPayment ? 'CASH' : 'DUE')}
                                          </span>
                                       </td>
                                    </tr>
                                 );
                              })
                           )}
                        </tbody>
                        {masterFilteredRows.length > 0 && (
                           <tfoot>
                              <tr className="border-t-2 border-slate-700 bg-slate-950/90 font-black">
                                 <td colSpan={6} className="py-3 px-4 text-right uppercase tracking-wider text-slate-300">
                                    সর্বমোট যোগফল (TOTAL):
                                 </td>
                                 <td className="py-3 px-4 text-right font-mono text-emerald-400 text-sm">
                                    ৳{totalSales.toLocaleString()}
                                 </td>
                                 <td className="py-3 px-4 text-right font-mono text-indigo-400 text-sm">
                                    ৳{totalCollections.toLocaleString()}
                                 </td>
                                 <td className="py-3 px-4 text-center text-slate-400 text-[10px]">
                                    বকেয়া: ৳{newDue.toLocaleString()}
                                 </td>
                              </tr>
                           </tfoot>
                        )}
                     </table>
                  </div>
               </div>
            )}

            {/* SUB-VIEW 2: MEMBER-WISE COMBINED STATEMENT */}
            {masterSubTab === 'MEMBER_SUMMARY' && (
               <div className="space-y-4">
                  <p className="text-xs text-slate-300 font-bold">
                     সদস্যভিত্তিক সামগ্রিক হিসাব • কে মোট কত টাকার খাবার খেয়েছে ও কত পরিশোধ করেছে ({memberWiseSummaries.length} সদস্য)
                  </p>

                  <div className="overflow-x-auto rounded-2xl border border-slate-800">
                     <table className="w-full text-left border-collapse text-xs">
                        <thead>
                           <tr className="border-b border-slate-800 bg-slate-950/80">
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-12">#SL</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">বিডি নম্বর</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">সদস্যের নাম ও পদবি</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ক্যাটাগরি</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">মোট খাবার বিক্রয় (৳)</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">মোট পরিশোধ (৳)</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">মোট বকেয়া (৳)</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">লেনদেন সংখ্যা</th>
                              <th className="py-3 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">খাবারের সংক্ষিপ্ত নমুনা</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                           {memberWiseSummaries.length === 0 ? (
                              <tr>
                                 <td colSpan={9} className="py-12 text-center text-slate-400 text-xs font-bold uppercase">
                                    কোন সদস্যের তথ্য পাওয়া যায়নি
                                 </td>
                              </tr>
                           ) : (
                              memberWiseSummaries.map((m, idx) => (
                                 <tr key={m.bdNo || idx} className="hover:bg-slate-800/40 transition-colors">
                                    <td className="py-3 px-4 font-mono font-bold text-slate-500 text-center">
                                       {idx + 1}
                                    </td>
                                    <td className="py-3 px-4 font-mono font-bold text-indigo-400 whitespace-nowrap">
                                       BD: {m.bdNo}
                                    </td>
                                    <td className="py-3 px-4 font-black text-white">
                                       {m.name}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                       <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-slate-950 text-slate-400 border border-slate-800">
                                          {m.category}
                                       </span>
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-black text-emerald-400">
                                       ৳{m.totalSales.toLocaleString()}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-black text-indigo-400">
                                       ৳{m.totalPayments.toLocaleString()}
                                    </td>
                                    <td className="py-3 px-4 text-right font-mono font-black text-amber-400">
                                       ৳{m.currentDue.toLocaleString()}
                                    </td>
                                    <td className="py-3 px-4 text-center font-mono font-bold text-slate-300">
                                       {m.txCount} বার
                                    </td>
                                    <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[240px] truncate" title={m.itemsConsumed.join(', ')}>
                                       {m.itemsConsumed.slice(0, 3).join(', ') || '-'}
                                    </td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}

            {/* SUB-VIEW 3: ITEM CONSUMPTION SUMMARY */}
            {masterSubTab === 'ITEM_SUMMARY' && (
               <div className="space-y-4">
                  <p className="text-xs text-slate-300 font-bold">
                     খাদ্য ও মেন্যু আইটেম অনুযায়ী বিক্রয় হিসাব ({itemWiseSummaries.length} টি আইটেম)
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                     {itemWiseSummaries.map((item, idx) => (
                        <div key={item.name || idx} className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                           <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20 font-black">
                                 {idx + 1}
                              </div>
                              <div>
                                 <h4 className="text-xs font-black text-white">{item.name}</h4>
                                 <p className="text-[10px] text-slate-400">মোট বিক্রয় পরিমাণ</p>
                              </div>
                           </div>
                           <div className="text-right">
                              <span className="text-base font-black text-emerald-400 font-mono">
                                 {item.count} পিস
                              </span>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}
         </div>
      )}

      {/* PRINT PREVIEW MODAL ("print preview te show hbe") */}
      {showPrintModal && (
         <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6 overflow-y-auto">
            <div className="bg-white text-slate-900 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden print:m-0 print:p-0 print:shadow-none print:w-full print:max-w-none print:rounded-none">
               
               {/* Modal Action Header (Hidden on actual physical print) */}
               <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden shrink-0">
                  <div className="flex items-center space-x-2">
                     <Printer className="w-5 h-5 text-emerald-400" />
                     <h3 className="text-sm font-black uppercase tracking-wider">
                        PRINT PREVIEW • সেন্ট্রাল মাস্টার রিপোর্ট ({formatMonthKeyLabel(selectedMonth)})
                     </h3>
                  </div>
                  <div className="flex items-center space-x-3">
                     <button
                        type="button"
                        onClick={handlePrint}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                     >
                        <Printer className="w-4 h-4" />
                        <span>Print Now (প্রিন্ট করুন)</span>
                     </button>
                     <button
                        type="button"
                        onClick={() => setShowPrintModal(false)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                     >
                        <X className="w-5 h-5" />
                     </button>
                  </div>
               </div>

               {/* Printable Document Body */}
               <div className="p-6 sm:p-10 overflow-y-auto space-y-6 text-black print:p-4">
                  {/* Official BAF Canteen Header */}
                  <div className="text-center space-y-1 border-b-2 border-slate-900 pb-4">
                     <h2 className="text-lg sm:text-xl font-black uppercase tracking-wide">
                        BANGLADESH AIR FORCE
                     </h2>
                     <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">
                        CENTRAL CANTEEN MASTER AUDIT & CONSUMPTION STATEMENT
                     </h1>
                     <p className="text-xs font-bold text-slate-600">
                        সেন্ট্রাল ক্যান্টিন মাস্টার রিপোর্ট • মাস: {formatMonthKeyLabel(selectedMonth)}
                     </p>
                     <p className="text-[10px] font-mono text-slate-500">
                        Date Generated: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                     </p>
                  </div>

                  {/* Summary Strip */}
                  <div className="grid grid-cols-4 gap-3 text-center border border-slate-300 rounded-xl p-3 bg-slate-50 text-xs">
                     <div>
                        <span className="text-[10px] text-slate-600 uppercase font-bold block">মোট বিক্রয় (Sales)</span>
                        <strong className="text-sm font-mono font-black text-slate-900">৳{totalSales.toLocaleString()}</strong>
                     </div>
                     <div>
                        <span className="text-[10px] text-slate-600 uppercase font-bold block">মোট আদায় (Collections)</span>
                        <strong className="text-sm font-mono font-black text-slate-900">৳{totalCollections.toLocaleString()}</strong>
                     </div>
                     <div>
                        <span className="text-[10px] text-slate-600 uppercase font-bold block">বাকি বিক্রয় (New Due)</span>
                        <strong className="text-sm font-mono font-black text-slate-900">৳{newDue.toLocaleString()}</strong>
                     </div>
                     <div>
                        <span className="text-[10px] text-slate-600 uppercase font-bold block">নগদ আদায় (Cash)</span>
                        <strong className="text-sm font-mono font-black text-slate-900">৳{netCash.toLocaleString()}</strong>
                     </div>
                  </div>

                  {/* Combined Detailed Table for Print */}
                  <div className="border border-slate-400 rounded-lg overflow-hidden">
                     <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                           <tr className="bg-slate-200 border-b border-slate-400 font-black text-slate-800">
                              <th className="py-2 px-3 text-center w-10 border-r border-slate-300">#SL</th>
                              <th className="py-2 px-3 border-r border-slate-300 whitespace-nowrap">Date</th>
                              <th className="py-2 px-3 border-r border-slate-300">BD No</th>
                              <th className="py-2 px-3 border-r border-slate-300">Rank & Name</th>
                              <th className="py-2 px-3 border-r border-slate-300 text-center">Type</th>
                              <th className="py-2 px-3 border-r border-slate-300">Items / Food Eaten ("কি খেয়েছে")</th>
                              <th className="py-2 px-3 text-right border-r border-slate-300">Sale (৳)</th>
                              <th className="py-2 px-3 text-right border-r border-slate-300">Paid (৳)</th>
                              <th className="py-2 px-3 text-center">Gateway</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300">
                           {masterFilteredRows.map((row, idx) => {
                              const isPayment = isPaymentTransaction(row);
                              const member = getMemberDetails(row);

                              return (
                                 <tr key={row.id || idx} className="hover:bg-slate-100">
                                    <td className="py-1.5 px-3 text-center font-mono border-r border-slate-300">{idx + 1}</td>
                                    <td className="py-1.5 px-3 font-mono border-r border-slate-300 whitespace-nowrap">{toEnglishDate(row.date)}</td>
                                    <td className="py-1.5 px-3 font-mono font-bold border-r border-slate-300 whitespace-nowrap">{member.bdNo}</td>
                                    <td className="py-1.5 px-3 font-bold border-r border-slate-300">{member.name}</td>
                                    <td className="py-1.5 px-3 text-center border-r border-slate-300 font-bold">
                                       {isPayment ? 'Payment' : 'Sale'}
                                    </td>
                                    <td className="py-1.5 px-3 border-r border-slate-300 max-w-[200px] truncate">
                                       {row.items || (isPayment ? 'Bill Payment' : 'Canteen Sale')}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-mono font-bold border-r border-slate-300">
                                       {!isPayment ? `৳${Number(row.amount || 0).toLocaleString()}` : '-'}
                                    </td>
                                    <td className="py-1.5 px-3 text-right font-mono font-bold border-r border-slate-300">
                                       {isPayment ? `৳${Number(row.amount || 0).toLocaleString()}` : '-'}
                                    </td>
                                    <td className="py-1.5 px-3 text-center font-mono">{row.gateway || (isPayment ? 'CASH' : 'DUE')}</td>
                                 </tr>
                              );
                           })}
                        </tbody>
                        <tfoot>
                           <tr className="bg-slate-200 border-t-2 border-slate-400 font-black">
                              <td colSpan={6} className="py-2 px-3 text-right uppercase border-r border-slate-300">Total:</td>
                              <td className="py-2 px-3 text-right font-mono border-r border-slate-300">৳{totalSales.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right font-mono border-r border-slate-300">৳{totalCollections.toLocaleString()}</td>
                              <td className="py-2 px-3 text-center">Due: ৳{newDue.toLocaleString()}</td>
                           </tr>
                        </tfoot>
                     </table>
                  </div>

                  {/* Signatures Footer */}
                  <div className="pt-16 grid grid-cols-3 gap-6 text-center text-xs font-bold text-slate-800">
                     <div>
                        <div className="border-t border-slate-800 pt-2 w-3/4 mx-auto">
                           ক্যান্টিন ম্যানেজার
                           <p className="text-[10px] text-slate-600 font-normal">Canteen Manager</p>
                        </div>
                     </div>
                     <div>
                        <div className="border-t border-slate-800 pt-2 w-3/4 mx-auto">
                           হিসাব রক্ষক / অডিট
                           <p className="text-[10px] text-slate-600 font-normal">Accountant / Auditor</p>
                        </div>
                     </div>
                     <div>
                        <div className="border-t border-slate-800 pt-2 w-3/4 mx-auto">
                           ভারপ্রাপ্ত কর্মকর্তা (OIC)
                           <p className="text-[10px] text-slate-600 font-normal">Officer In-Charge</p>
                        </div>
                     </div>
                  </div>

               </div>
            </div>
         </div>
      )}

    </div>
  );
};

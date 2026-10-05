import React, { useState, useMemo, useEffect } from 'react';
import { 
  Landmark, 
  Layers, 
  ArrowLeft, 
  Search, 
  Check, 
  X, 
  Plus, 
  Trash2, 
  Calendar, 
  Coins, 
  Users, 
  UserCheck, 
  Filter, 
  FileText, 
  Banknote, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Coffee, 
  Receipt, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Sparkles,
  PhoneCall,
  LayoutGrid,
  List,
  Tag
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { pushKeyToCloud, recordDeletedTxId } from '../utils/canteenCloudSync';
import { resolveImageUrl } from '../utils/canteenSettings';
import { formatCanteenDate } from '../utils/dateUtils';
import { formatBengaliMonthYear } from '../utils/exportCanteenBillExcel';
import { 
  BillCategory, 
  isOfficerMember, 
  isAirmanMember, 
  isCivilianMember, 
  getRunningMonthKey,
  getTxMonthKey,
  getTxCategory 
} from './MemberDB';
import { sortCanteenMembersByOfficeSeniority } from '../utils/canteenSeniority';

interface FundBatchBillPageProps {
  category: 'UNIT_FUND' | 'OTHERS';
  members: any[];
  allTxs: any[];
  selectedMonth: string;
  onBack: () => void;
  onCategoryChange: (category: BillCategory) => void;
  onSuccess: () => void;
  openStatement: (member: any) => void;
  openPayBill: (member: any) => void;
  openProfile: (member: any) => void;
  setInitialBillMember?: (member: any) => void;
  handleExportBills?: () => void;
  getMemberBanglaName: (m: any) => string;
  getMemberBanglaRank: (m: any) => string;
  formatRankBn: (r: string) => string;
  formatMemberNameBn: (n: string) => string;
  getMemberTotalDue: (member: any, category: BillCategory) => number;
  getMemberFilteredBill: (member: any, category: BillCategory, month: string) => number;
}

export const FundBatchBillPage: React.FC<FundBatchBillPageProps> = ({
  category,
  members,
  allTxs,
  selectedMonth: initialSelectedMonth,
  onBack,
  onCategoryChange,
  onSuccess,
  openStatement,
  openPayBill,
  openProfile,
  setInitialBillMember,
  handleExportBills,
  getMemberBanglaName,
  getMemberBanglaRank,
  formatRankBn,
  formatMemberNameBn,
  getMemberTotalDue,
  getMemberFilteredBill,
}) => {
  const isUnitFund = category === 'UNIT_FUND';
  const categoryTitle = isUnitFund ? 'UNIT FUND' : 'OTHERS';
  const categoryBnTitle = isUnitFund ? 'ইউনিট ফান্ড' : 'অন্যান্য বিল';

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState<string>(
    initialSelectedMonth && initialSelectedMonth !== 'ALL' ? initialSelectedMonth : getRunningMonthKey()
  );

  // Batch Add Form State
  const [amount, setAmount] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Member Selection State
  const [selectedAirmanIds, setSelectedAirmanIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [memberFilter, setMemberFilter] = useState<'ALL' | 'OFFICER' | 'AIRMEN' | 'CIVILIAN'>('ALL');
  const [dueListFilter, setDueListFilter] = useState<'ALL' | 'WITH_DUE'>('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('TABLE');
  const [activeTab, setActiveTab] = useState<'ADD_BATCH' | 'MEMBERS_LIST' | 'RECENT_LOG'>('ADD_BATCH');

  // Quick preset notes for Others fund
  const quickNotes = [
    'মেস ডিনার ফি',
    'পিকনিক ও রিফ্রেশমেন্ট',
    'বিদায় ও সংবর্ধনা উপহার',
    'খেলাধুলা ও বিনোদন চাঁদা',
    'জরুরি কল্যাণ অনুদান',
    'বিশেষ পার্টি ও আপ্যায়ন',
    'অফিসিয়াল স্টেশনারি/টোকেন'
  ];

  const quickAmounts = [100, 200, 300, 500, 1000, 1500];

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Filter members based on search and memberFilter, maintaining strict Rank Seniority (Officers > JCOs > Airmen > Civilians)
  const filteredMembers = useMemo(() => {
    const list = members.filter((m) => {
      // Role / Rank Filter
      if (memberFilter === 'OFFICER' && !isOfficerMember(m)) return false;
      if (memberFilter === 'AIRMEN' && !isAirmanMember(m)) return false;
      if (memberFilter === 'CIVILIAN' && !isCivilianMember(m)) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const bd = String(m['BD No'] || m.airman_id || '').toLowerCase();
        const name = String(m['Surname'] || '').toLowerCase();
        const rank = String(m['Rank'] || '').toLowerCase();
        const bnName = (getMemberBanglaName(m) || '').toLowerCase();
        const bnRank = (getMemberBanglaRank(m) || '').toLowerCase();
        if (!bd.includes(q) && !name.includes(q) && !rank.includes(q) && !bnName.includes(q) && !bnRank.includes(q)) {
          return false;
        }
      }

      return true;
    });

    return sortCanteenMembersByOfficeSeniority(list);
  }, [members, memberFilter, searchQuery, getMemberBanglaName, getMemberBanglaRank]);

  // Members for the dues table/cards
  const displayedMembersForDues = useMemo(() => {
    const list = filteredMembers.filter((m) => {
      if (dueListFilter === 'WITH_DUE') {
        const due = getMemberTotalDue(m, category);
        return due > 0;
      }
      return true;
    });

    return sortCanteenMembersByOfficeSeniority(list);
  }, [filteredMembers, dueListFilter, category, getMemberTotalDue]);

  // Overall Statistics for this category
  const stats = useMemo(() => {
    let totalDue = 0;
    let totalMonthBilled = 0;
    let membersWithDue = 0;

    members.forEach((m) => {
      const d = getMemberTotalDue(m, category);
      if (d > 0) {
        totalDue += d;
        membersWithDue += 1;
      }
      const mb = getMemberFilteredBill(m, category, currentMonth);
      totalMonthBilled += mb;
    });

    return { totalDue, totalMonthBilled, membersWithDue };
  }, [members, category, currentMonth, getMemberTotalDue, getMemberFilteredBill]);

  // Filter category transactions for recent log
  const categoryTransactions = useMemo(() => {
    return (allTxs || [])
      .filter((tx) => getTxCategory(tx) === category)
      .sort((a, b) => {
        const timeA = new Date(a.date || a.created_at || 0).getTime() || a.timestamp || 0;
        const timeB = new Date(b.date || b.created_at || 0).getTime() || b.timestamp || 0;
        return timeB - timeA;
      });
  }, [allTxs, category]);

  // Selection helpers
  const handleToggleMember = (airmanId: string) => {
    setSelectedAirmanIds((prev) => {
      const next = new Set(prev);
      if (next.has(airmanId)) {
        next.delete(airmanId);
      } else {
        next.add(airmanId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedAirmanIds((prev) => {
      const next = new Set(prev);
      filteredMembers.forEach((m) => {
        const id = String(m.airman_id || m['BD No']);
        next.add(id);
      });
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedAirmanIds(new Set());
  };

  const handleSelectGroup = (filter: 'OFFICER' | 'AIRMEN' | 'CIVILIAN') => {
    setSelectedAirmanIds((prev) => {
      const next = new Set(prev);
      members.forEach((m) => {
        const matches = 
          (filter === 'OFFICER' && isOfficerMember(m)) ||
          (filter === 'AIRMEN' && isAirmanMember(m)) ||
          (filter === 'CIVILIAN' && isCivilianMember(m));
        if (matches) {
          next.add(String(m.airman_id || m['BD No']));
        }
      });
      return next;
    });
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Submit Batch Bill Addition
  const handleBatchAddBill = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন (Enter a valid amount)', 'error');
      return;
    }

    if (selectedAirmanIds.size === 0) {
      showToast('অন্তত একজন সদস্য নির্বাচন করুন (Select at least one member)', 'error');
      return;
    }

    if (!isUnitFund && !note.trim()) {
      showToast('Others বিলের জন্য কিসের জন্য যোগ করা হলো (Note) লিখা আবশ্যক!', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      const existingTxs = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
        } catch {
          return [];
        }
      })();

      const selectedMemberList = members.filter((m) =>
        selectedAirmanIds.has(String(m.airman_id || m['BD No']))
      );

      const now = Date.now();
      const finalNote = note.trim();
      const defaultDesc = isUnitFund
        ? (finalNote ? `Unit Fund (${finalNote})` : 'Unit Fund Bill')
        : (finalNote ? `Others: ${finalNote}` : 'Others Bill');

      // Format date for display (e.g. 06 Oct 26)
      const dateObj = new Date(txDate);
      const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedTxDate = !isNaN(dateObj.getTime())
        ? `${String(dateObj.getDate()).padStart(2, '0')} ${enMonths[dateObj.getMonth()]} ${String(dateObj.getFullYear()).slice(-2)}`
        : formatCanteenDate(new Date());

      const targetMonthKey = !isNaN(dateObj.getTime())
        ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
        : currentMonth;

      const newBatchTxs = selectedMemberList.map((m, idx) => {
        const cleanBdNo = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
        return {
          id: `tx-${category.toLowerCase()}-${cleanBdNo}-${targetMonthKey}-${now + idx}`,
          created_at: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          timestamp: now + idx,
          date: formattedTxDate,
          monthKey: targetMonthKey,
          airman_id: m.airman_id,
          bdNo: m['BD No'] || m.bdNo,
          memberName: `${m['Rank'] || ''} ${m['Surname'] || ''}`.trim(),
          rank: m['Rank'] || m.rank || '',
          items: defaultDesc,
          note: finalNote || undefined,
          soldItems: [],
          amount: numAmount,
          type: 'INITIAL_BILL',
          gateway: 'DUE',
          billType: category
        };
      });

      const updatedTxs = [...newBatchTxs, ...existingTxs];
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));

      // Push to cloud in background
      await pushKeyToCloud('canteen_txs', updatedTxs);

      // Trigger sync events across the entire app
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast(
        `সফলভাবে ${selectedMemberList.length} জন সদস্যের জন্য জনপ্রতি ৳${numAmount.toLocaleString()} (${categoryBnTitle}) যোগ করা হয়েছে!`
      );

      // Reset form
      setAmount('');
      if (!isUnitFund) setNote('');
      setSelectedAirmanIds(new Set());
      onSuccess();
    } catch (err: any) {
      console.error('Batch add error:', err);
      showToast(`বিল যোগ করতে সমস্যা হয়েছে: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete an individual transaction
  const handleDeleteTx = async (txId: string) => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এই রেকর্ডটি মুছে ফেলতে চান? (Are you sure to delete this transaction?)')) {
      return;
    }

    try {
      const existingTxs = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
        } catch {
          return [];
        }
      })();

      const filtered = existingTxs.filter((t: any) => String(t.id) !== String(txId));
      localStorage.setItem('canteen_txs', JSON.stringify(filtered));
      recordDeletedTxId(txId);
      await pushKeyToCloud('canteen_txs', filtered);

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast('রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে');
      onSuccess();
    } catch (err: any) {
      showToast(`মুছতে সমস্যা হয়েছে: ${err.message}`, 'error');
    }
  };

  const selectedCount = selectedAirmanIds.size;
  const numAmount = parseFloat(amount) || 0;
  const totalBatchAmount = selectedCount * numAmount;

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-[999] px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-sm font-bold border transition-all ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 shadow-emerald-900/30' 
            : 'bg-rose-950/90 text-rose-200 border-rose-500/50 shadow-rose-900/30'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header & Navigation Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer shrink-0 active:scale-95"
            title="ক্যান্টিন বিলে ফিরে যান (Back to Canteen Bills)"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isUnitFund 
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 shadow-md shadow-indigo-500/10' 
                : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-500/10'
            }`}>
              {isUnitFund ? <Landmark className="w-6 h-6" /> : <Layers className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                  {categoryTitle} MANAGEMENT
                </h1>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase font-mono border ${
                  isUnitFund ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                }`}>
                  {categoryBnTitle}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                {isUnitFund 
                  ? 'ইউনিট ফান্ড নির্ধারিত সদস্যদের একসাথে সহজে চার্জ নির্ধারণ ও রেকর্ড করুন' 
                  : 'অন্যান্য নির্দিষ্ট খাতে (নোট সহ) একাধিক সদস্যকে এক ক্লিকে বিল প্রদান করুন'}
              </p>
            </div>
          </div>
        </div>

        {/* Category Tabs Switcher (Canteen, Unit Fund, Others, All) - Fits mobile perfectly */}
        <div className="w-full md:w-auto grid grid-cols-4 md:flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-950/90 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => onCategoryChange('ALL')}
            className="px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60"
          >
            <Receipt className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span>All</span>
          </button>

          <button
            type="button"
            onClick={() => onCategoryChange('CANTEEN')}
            className="px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Canteen</span>
          </button>

          <button
            type="button"
            onClick={() => onCategoryChange('UNIT_FUND')}
            className={`px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${
              isUnitFund
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            <Landmark className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Unit Fund</span>
          </button>

          <button
            type="button"
            onClick={() => onCategoryChange('OTHERS')}
            className={`px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${
              !isUnitFund
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 ring-1 ring-cyan-400'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Others</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards & Month Selector: Monthly Billed & Due Side-by-Side, Selected Members card removed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Month Selector Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>ACTIVE MONTH</span>
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-400">{currentMonth}</span>
          </div>

          <div className="flex items-center justify-between bg-slate-950/80 rounded-xl p-1 border border-slate-800">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="পূর্ববর্তী মাস"
            >
              <ChevronLeft className="w-4 h-4 text-indigo-400" />
            </button>
            <div className="text-center font-bold text-xs sm:text-sm text-slate-100">
              {formatBengaliMonthYear(currentMonth)}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="পরবর্তী মাস"
            >
              <ChevronRight className="w-4 h-4 text-indigo-400" />
            </button>
          </div>
        </div>

        {/* Monthly Billed & Total Due: Compact & Side-by-Side (grid-cols-2) */}
        <div className="md:col-span-2 grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Monthly Billed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                MONTHLY BILLED
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                isUnitFund ? 'bg-indigo-500/10 text-indigo-400' : 'bg-cyan-500/10 text-cyan-400'
              }`}>
                <Coins className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black font-mono text-white">
                ৳{stats.totalMonthBilled.toLocaleString()}
              </div>
              <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                {formatBengaliMonthYear(currentMonth)} এর মোট অর্জিত বিল
              </p>
            </div>
          </div>

          {/* Total Overall Due */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                TOTAL {categoryTitle} DUE
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                <Banknote className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black font-mono text-rose-300">
                ৳{stats.totalDue.toLocaleString()}
              </div>
              <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                {stats.membersWithDue} জন সদস্যের সর্বমোট বকেয়া
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Main Mode Navigation (Add Batch Bill vs Members List vs Recent Log) */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('ADD_BATCH')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'ADD_BATCH'
                ? isUnitFund
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>একাধিক সদস্যকে বিল যোগ করুন (Batch Add)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MEMBERS_LIST')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'MEMBERS_LIST'
                ? isUnitFund
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>সদস্য বকেয়া তালিকা ({displayedMembersForDues.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RECENT_LOG')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer ${
              activeTab === 'RECENT_LOG'
                ? isUnitFund
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>সাম্প্রতিক রেকর্ড লগ ({categoryTransactions.length})</span>
          </button>
        </div>

        {handleExportBills && (
          <button
            type="button"
            onClick={handleExportBills}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 border border-slate-700 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export (PDF/Print)</span>
          </button>
        )}
      </div>

      {/* ================= TAB 1: BATCH ADD BILL ================= */}
      {activeTab === 'ADD_BATCH' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Controls (Amount, Date, Note, Action Button) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center space-x-2">
                  <Coins className={`w-5 h-5 ${isUnitFund ? 'text-indigo-400' : 'text-cyan-400'}`} />
                  <span>বিল নির্ধারণ ফর্ম (Bill Form)</span>
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  টাকার পরিমাণ ও তারিখ নির্ধারণ করে ডানপাশ থেকে সদস্য সিলেক্ট করুন
                </p>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-1.5">
                  টাকার পরিমাণ (Amount per Member) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400 text-base">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="যেমন: ৫০০"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-9 pr-4 py-3 text-base font-mono font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-inner"
                    required
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {quickAmounts.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setAmount(String(q))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        amount === String(q)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      ৳{q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Input */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-1.5">
                  তারিখ ও মাস (Date & Target Month)
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-inner"
                  />
                </div>
              </div>

              {/* NOTE / REASON FIELD (PROMINENT AND CRITICAL FOR OTHERS) */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>
                    কিসের জন্য বিল যোগ করা হলো (Note / Description){' '}
                    {!isUnitFund && <span className="text-rose-400">*</span>}
                  </span>
                  {!isUnitFund && (
                    <span className="text-[10px] font-bold text-cyan-400 font-mono">বাধ্যতামূলক</span>
                  )}
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    isUnitFund
                      ? 'ঐচ্ছিক বিবরণ (যেমন: ইউনিট কল্যাণ বরাদ্দ, বিশেষ চাঁদা)'
                      : 'কিসের জন্য এই বিল কাটা হলো তা বিস্তারিত লিখুন (যেমন: মেস ডিনার ফি, পিকনিক চাঁদা...)'
                  }
                  className={`w-full bg-slate-950 border rounded-2xl p-3 text-xs font-bold text-white focus:outline-none shadow-inner resize-none ${
                    !isUnitFund && !note.trim()
                      ? 'border-cyan-500/50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20'
                      : 'border-slate-700 focus:border-indigo-500'
                  }`}
                  required={!isUnitFund}
                />

                {/* Preset quick notes for Others */}
                {!isUnitFund && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                      <Tag className="w-3 h-3 text-cyan-400" />
                      <span>দ্রুত নোট নির্বাচন করুন:</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {quickNotes.map((qn) => (
                        <button
                          key={qn}
                          type="button"
                          onClick={() => setNote(qn)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            note === qn
                              ? 'bg-cyan-600 text-white'
                              : 'bg-slate-800/80 text-cyan-300 hover:bg-slate-800 border border-slate-700/60'
                          }`}
                        >
                          {qn}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Live Calculation Summary Box */}
              <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>নির্বাচিত সদস্য:</span>
                  <span className="font-mono text-white font-black">{selectedCount} জন</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>জনপ্রতি পরিমাণ:</span>
                  <span className="font-mono text-emerald-400 font-black">৳{numAmount.toLocaleString()}</span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-sm font-black text-white">
                  <span>সর্বমোট বিল:</span>
                  <span className="font-mono text-base text-amber-400">
                    ৳{totalBatchAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Submit Button */}
              <button
                type="button"
                disabled={isSubmitting || selectedCount === 0 || numAmount <= 0 || (!isUnitFund && !note.trim())}
                onClick={handleBatchAddBill}
                className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg active:scale-98 ${
                  selectedCount > 0 && numAmount > 0 && (isUnitFund || note.trim())
                    ? isUnitFund
                      ? 'bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white shadow-indigo-600/30'
                      : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-cyan-600/30'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800 shadow-none'
                }`}
              >
                {isSubmitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>
                  {isSubmitting 
                    ? 'সংরক্ষণ হচ্ছে...' 
                    : `বিল যোগ করুন (${selectedCount} জন • ৳${totalBatchAmount.toLocaleString()})`}
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Member Selection Grid / List */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              {/* Header with Search and Group Selector */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="সদস্য খুঁজুন (BD No, Rank, Name, বাংলা নাম)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-inner"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Quick Selection Shortcuts */}
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-2.5 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer"
                  >
                    Select All ({filteredMembers.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    disabled={selectedCount === 0}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center justify-between border-y border-slate-800/80 py-2.5 flex-wrap gap-2">
                <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
                  {(['ALL', 'OFFICER', 'AIRMEN', 'CIVILIAN'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMemberFilter(cat)}
                      className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                        memberFilter === cat
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-2 text-xs font-bold text-slate-400">
                  <span>নির্বাচিত:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono font-black border border-indigo-500/30">
                    {selectedCount} জন
                  </span>
                </div>
              </div>

              {/* Members Selection List */}
              <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1 scrollbar-none">
                {filteredMembers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
                    কোনো সদস্য পাওয়া যায়নি (No members found)
                  </div>
                ) : (
                  filteredMembers.map((m) => {
                    const airmanId = String(m.airman_id || m['BD No']);
                    const isSelected = selectedAirmanIds.has(airmanId);
                    const memberDp = resolveImageUrl(m.DP);
                    const currentDue = getMemberTotalDue(m, category);

                    return (
                      <div
                        key={airmanId}
                        onClick={() => handleToggleMember(airmanId)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-950/40 border-indigo-500/70 shadow-sm shadow-indigo-950/50'
                            : 'bg-slate-950/60 hover:bg-slate-800/50 border-slate-800/80'
                        }`}
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          {/* Checkbox */}
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                            isSelected 
                              ? 'bg-indigo-600 border-indigo-400 text-white' 
                              : 'bg-slate-900 border-slate-700 text-transparent'
                          }`}>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>

                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                            {memberDp ? (
                              <img
                                src={memberDp}
                                alt={m['Surname']}
                                className="w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <span className="font-black text-xs text-indigo-400">
                                {(m['Surname'] || 'U').charAt(0)}
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                              {m['Rank'] && m['Rank'] !== '-' && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-indigo-500/15 text-indigo-300 font-mono">
                                  {m['Rank']}
                                </span>
                              )}
                              <span className="font-black text-white text-xs truncate">
                                {m['Surname']}
                              </span>
                              <span className="text-[11px] font-bold text-emerald-400">
                                ({getMemberBanglaName(m) || formatMemberNameBn(m['Surname'])})
                              </span>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              BD/{m['BD No']} • {m.Role || 'Member'}
                            </div>
                          </div>
                        </div>

                        {/* Current Fund Due */}
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">
                            CURRENT DUE
                          </div>
                          <div className={`text-xs font-black font-mono ${
                            currentDue > 0 ? 'text-amber-400' : 'text-slate-500'
                          }`}>
                            ৳{currentDue.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: MEMBERS DUES LIST ================= */}
      {activeTab === 'MEMBERS_LIST' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setDueListFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                  dueListFilter === 'ALL'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                All Members ({filteredMembers.length})
              </button>
              <button
                type="button"
                onClick={() => setDueListFilter('WITH_DUE')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                  dueListFilter === 'WITH_DUE'
                    ? 'bg-rose-900/80 text-rose-200 border border-rose-500/50'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Due Only ({stats.membersWithDue})
              </button>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white"
                />
              </div>

              <div className="flex items-center bg-slate-950 rounded-xl p-0.5 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setViewMode('TABLE')}
                  className={`p-1.5 rounded-lg ${viewMode === 'TABLE' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  title="Table View"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('CARDS')}
                  className={`p-1.5 rounded-lg ${viewMode === 'CARDS' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                  title="Cards View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Dues Table View */}
          {viewMode === 'TABLE' ? (
            <div className="overflow-x-auto border border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Member Details</th>
                    <th className="px-4 py-3">BD No</th>
                    <th className="px-4 py-3 text-right">{currentMonth} Bill</th>
                    <th className="px-4 py-3 text-right">Total {categoryTitle} Due</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {displayedMembersForDues.map((member, idx) => {
                    const memberDp = resolveImageUrl(member.DP);
                    const monthBill = getMemberFilteredBill(member, category, currentMonth);
                    const totalDue = getMemberTotalDue(member, category);

                    return (
                      <tr key={member.airman_id || idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                              {memberDp ? (
                                <img src={memberDp} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-bold text-indigo-400">
                                  {(member['Surname'] || 'U').charAt(0)}
                                </span>
                              )}
                            </div>
                            <div>
                              <div className="flex items-center space-x-1.5">
                                {member['Rank'] && (
                                  <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-indigo-500/15 text-indigo-300 font-mono">
                                    {member['Rank']}
                                  </span>
                                )}
                                <span className="font-black text-white">{member['Surname']}</span>
                                <span className="text-[11px] font-bold text-emerald-400">
                                  ({getMemberBanglaName(member) || formatMemberNameBn(member['Surname'])})
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-300">#{member['BD No']}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-300">
                          ৳{monthBill.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-black">
                          <span className={totalDue > 0 ? 'text-rose-400 text-sm' : 'text-slate-500'}>
                            ৳{totalDue.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              type="button"
                              onClick={() => openStatement(member)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-[10px] font-bold uppercase transition-colors cursor-pointer"
                            >
                              Statement
                            </button>
                            <button
                              type="button"
                              disabled={totalDue <= 0}
                              onClick={() => openPayBill(member)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                                totalDue > 0
                                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                                  : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                              }`}
                            >
                              Pay
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {displayedMembersForDues.map((member, idx) => {
                const memberDp = resolveImageUrl(member.DP);
                const monthBill = getMemberFilteredBill(member, category, currentMonth);
                const totalDue = getMemberTotalDue(member, category);

                return (
                  <div
                    key={member.airman_id || idx}
                    className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                          {memberDp ? (
                            <img src={memberDp} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-bold text-indigo-400">
                              {(member['Surname'] || 'U').charAt(0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-1">
                            <span className="text-[10px] font-black uppercase text-indigo-300 font-mono">
                              {member['Rank']}
                            </span>
                            <span className="font-black text-white text-xs">{member['Surname']}</span>
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">#{member['BD No']}</div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400">DUE</div>
                        <div className={`font-mono font-black ${totalDue > 0 ? 'text-rose-400 text-sm' : 'text-slate-500'}`}>
                          ৳{totalDue.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-800/80 pt-2 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-400">
                        {currentMonth} Bill: <strong className="text-white font-mono">৳{monthBill}</strong>
                      </span>
                      <div className="flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => openStatement(member)}
                          className="px-2 py-1 bg-slate-800 text-indigo-300 rounded-lg text-[10px] font-bold cursor-pointer"
                        >
                          Statement
                        </button>
                        <button
                          type="button"
                          disabled={totalDue <= 0}
                          onClick={() => openPayBill(member)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                            totalDue > 0 ? 'bg-emerald-600 text-white cursor-pointer' : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                          }`}
                        >
                          Pay
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: RECENT LOG ================= */}
      {activeTab === 'RECENT_LOG' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                {categoryTitle} লেনদেন ও বিল লগ (Recent Transaction History)
              </h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                সাম্প্রতিক যোগ করা বিলের তালিকা • ভুল রেকর্ড মুছে ফেলার সুবিধা
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">
              মোট রেকর্ড: {categoryTransactions.length} টি
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">তারিখ (Date)</th>
                  <th className="px-4 py-3">সদস্য (Member)</th>
                  <th className="px-4 py-3">বিবরণ / Note (কিসের জন্য)</th>
                  <th className="px-4 py-3 text-right">পরিমাণ (Amount)</th>
                  <th className="px-4 py-3 text-center">মুছে ফেলুন (Action)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {categoryTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-bold">
                      কোনো সাম্প্রতিক রেকর্ড পাওয়া যায়নি (No transaction records found)
                    </td>
                  </tr>
                ) : (
                  categoryTransactions.slice(0, 50).map((tx, idx) => (
                    <tr key={tx.id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {tx.date || tx.created_at?.split('T')[0] || '-'}
                        {tx.monthKey && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                            {tx.monthKey}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-white">
                          {tx.memberName || tx.name || `BD/${tx.bdNo}`}
                        </span>
                        {tx.bdNo && (
                          <span className="ml-1.5 text-[10px] font-mono text-slate-400">
                            #{tx.bdNo}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-indigo-300 font-bold text-xs inline-block">
                          {tx.items || tx.note || (isUnitFund ? 'Unit Fund' : 'Others Bill')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-emerald-400 text-sm">
                        ৳{Number(tx.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteTx(tx.id)}
                          className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="এই রেকর্ডটি মুছে ফেলুন (Delete transaction)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Check, 
  Coins, 
  Layers, 
  ShoppingCart,
  Utensils,
  Calendar, 
  RefreshCw,
  AlertCircle,
  HelpCircle,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DueShopName, ExpenseRecord, resolveExpenseDueShop } from '../pages/DueRegister';
import { getRunningMonthKey, formatMonthOnlyUpper, getTxMonthKey } from '../pages/MemberDB';
import { formatBengaliMonthYear } from '../utils/exportCanteenBillExcel';
import { getFormattedDateForMonth } from '../utils/importHistoryTxs';
import { pushKeyToCloud } from '../utils/canteenCloudSync';

const EXPENSES_STORAGE_KEY = 'canteen_expenses';

export const getExpenseMonthKey = (val?: any): string => {
  if (!val) return '';
  if (typeof val === 'object') {
    if (val.monthKey && /^\d{4}-\d{2}$/.test(String(val.monthKey).trim())) {
      return String(val.monthKey).trim();
    }
    val = val.date || val.timestamp || '';
  }
  const str = String(val).trim();
  if (!str) return '';

  // 1. Try robust getTxMonthKey (supports "DD Mon YY", "01 Oct 26", "YYYY-MM-DD", etc.)
  const parsed = getTxMonthKey(str);
  if (parsed) return parsed;

  // 2. Direct parts split fallback
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}`;
    }
    let yr = parseInt(parts[2], 10);
    if (yr < 100) yr += 2000;
    return `${yr}-${parts[1].padStart(2, '0')}`;
  }
  return '';
};

export const isShopInitialDueRecord = (
  record: ExpenseRecord, 
  shop: DueShopName, 
  targetMonthKey: string
): boolean => {
  if (resolveExpenseDueShop(record) !== shop) return false;
  
  const desc = String(record.desc || '').toLowerCase();
  const subdesc = String(record.subdesc || '').toLowerCase();
  const rawId = String(record.id || '').toLowerCase();
  const rawItemId = String(record.rawItemId || '').toLowerCase();

  const isInit = 
    rawId.includes('shop-init') ||
    rawItemId.startsWith('init-due') ||
    desc.includes('initial due') ||
    desc.includes('প্রারম্ভিক বকেয়া') ||
    subdesc.includes('প্রারম্ভিক বকেয়া') ||
    desc.includes('পূর্বের বকেয়া') ||
    subdesc.includes('পূর্বের বকেয়া');

  if (!isInit) return false;

  const mKey = record.monthKey || getExpenseMonthKey(record.date);
  return mKey === targetMonthKey;
};

interface SetShopInitialDueModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: DueShopName;
  currentTotalDue: number;
  onSuccess: (updatedDue: number) => void;
}

export const SetShopInitialDueModal: React.FC<SetShopInitialDueModalProps> = ({
  isOpen,
  onClose,
  shopName,
  currentTotalDue,
  onSuccess
}) => {
  const defaultRunningMonth = getRunningMonthKey();
  const [billMonth, setBillMonth] = useState<string>(defaultRunningMonth);
  const [billAmount, setBillAmount] = useState<string>('');
  const [previousAmount, setPreviousAmount] = useState<number>(0);
  const [billMode, setBillMode] = useState<'SET' | 'ADD'>('SET');
  const [billNote, setBillNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Month options list: Next month, Current month, and past 12 months
  const monthOptions = useMemo(() => {
    const list: Array<{ key: string; label: string }> = [];
    const now = new Date();
    // Next month
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`;
    list.push({ 
      key: nextKey, 
      label: `${formatBengaliMonthYear(nextKey)} (${next.toLocaleString('en', { month: 'short' })} ${next.getFullYear()})` 
    });

    // Current month and past 12 months
    for (let i = 0; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bnLabel = formatBengaliMonthYear(key);
      const enMonth = d.toLocaleString('en', { month: 'short' });
      list.push({
        key,
        label: `${bnLabel} (${enMonth} ${d.getFullYear()})${i === 0 ? ' • চলতি মাস (Current)' : ''}`
      });
    }
    return list;
  }, []);

  // Helper to find existing initial due for this shop in the specified month
  const findPreviousAmountForMonth = (targetM: string): number => {
    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const all: ExpenseRecord[] = raw ? JSON.parse(raw) : [];
      const initRecords = all.filter(e => 
        String(e.paymentMethod || '').trim().toLowerCase() === 'due' &&
        isShopInitialDueRecord(e, shopName, targetM)
      );
      return initRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    } catch {
      return 0;
    }
  };

  // Sync state on open or shop change
  useEffect(() => {
    if (isOpen && shopName) {
      const targetM = getRunningMonthKey();
      setBillMonth(targetM);
      const prev = findPreviousAmountForMonth(targetM);
      setPreviousAmount(prev);
      setBillAmount(prev > 0 ? String(prev) : '');
      setBillMode('SET');
      setBillNote('');
      setErrorMessage(null);
    }
  }, [isOpen, shopName]);

  const handleMonthChange = (newMonth: string) => {
    setBillMonth(newMonth);
    const prev = findPreviousAmountForMonth(newMonth);
    setPreviousAmount(prev);
    setBillAmount(prev > 0 ? String(prev) : '');
    setErrorMessage(null);
  };

  const numAmount = parseFloat(billAmount) || 0;

  // In SET mode: replaces previous initial amount with new amount
  // In ADD mode: adds new amount on top of current due
  const resultingDue = billMode === 'SET'
    ? Math.max(0, currentTotalDue - previousAmount + numAmount)
    : currentTotalDue + numAmount;

  const handleSaveInitialDue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numAmount) || numAmount < 0) {
      setErrorMessage('সঠিক টাকার পরিমাণ লিখুন (টাকা ০ বা তার বেশি হতে হবে)।');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const all: ExpenseRecord[] = raw ? JSON.parse(raw) : [];

      let updated: ExpenseRecord[] = [];
      const shopSlug = shopName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const now = Date.now();
      const monthBn = formatBengaliMonthYear(billMonth);

      if (billMode === 'SET') {
        // Remove previous initial due records for this shop in this month
        const preserved = all.filter(e => !isShopInitialDueRecord(e, shopName, billMonth));

        if (numAmount > 0) {
          const newRecord: ExpenseRecord = {
            id: `shop-init-${shopSlug}-${billMonth}-${now}`,
            date: getFormattedDateForMonth(billMonth, 1),
            monthKey: billMonth,
            desc: billNote.trim() || `প্রারম্ভিক বকেয়া (${monthBn})`,
            subdesc: `প্রারম্ভিক বকেয়া - ${shopName}`,
            category: 'Canteen',
            paymentMethod: 'Due',
            dueShop: shopName,
            amount: numAmount,
            isCustom: true,
            detailedPerson: undefined,
            rawItemId: `init-due-${shopSlug}-${billMonth}`
          };
          updated = [newRecord, ...preserved];
        } else {
          updated = preserved;
        }
      } else {
        // ADD mode: append new initial due record
        if (numAmount > 0) {
          const newRecord: ExpenseRecord = {
            id: `shop-init-add-${shopSlug}-${billMonth}-${now}`,
            date: getFormattedDateForMonth(billMonth, 1),
            monthKey: billMonth,
            desc: billNote.trim() || `অতিরিক্ত বকেয়া (${monthBn})`,
            subdesc: `অতিরিক্ত বকেয়া সংযোজন - ${shopName}`,
            category: 'Canteen',
            paymentMethod: 'Due',
            dueShop: shopName,
            amount: numAmount,
            isCustom: true,
            detailedPerson: undefined,
            rawItemId: `init-due-add-${shopSlug}-${billMonth}`
          };
          updated = [newRecord, ...all];
        } else {
          updated = all;
        }
      }

      // Save to localStorage & Cloud
      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updated));

      try {
        await pushKeyToCloud(EXPENSES_STORAGE_KEY, updated);
      } catch (cloudErr) {
        console.warn('Cloud sync error for shop initial due:', cloudErr);
      }

      // Dispatch events for all listeners
      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      onSuccess(resultingDue);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'বকেয়া সংরক্ষণে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
    } finally {
      setIsSaving(false);
    }
  };

  const getShopIcon = () => {
    if (shopName === 'Grocessary Shop') return <ShoppingCart className="w-5 h-5 text-emerald-400" />;
    if (shopName === 'Poultry Shop') return <Layers className="w-5 h-5 text-amber-400" />;
    return <Utensils className="w-5 h-5 text-purple-400" />;
  };

  const getShopTheme = () => {
    if (shopName === 'Grocessary Shop') {
      return {
        badgeBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
        accentText: 'text-emerald-400',
        ringColor: 'focus:ring-emerald-500/40'
      };
    }
    if (shopName === 'Poultry Shop') {
      return {
        badgeBg: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
        accentText: 'text-amber-400',
        ringColor: 'focus:ring-amber-500/40'
      };
    }
    return {
      badgeBg: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
      accentText: 'text-purple-400',
      ringColor: 'focus:ring-purple-500/40'
    };
  };

  const theme = getShopTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 sm:p-7 space-y-6 my-auto text-slate-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-inner">
                  <Coins className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">
                      দোকানের প্রারম্ভিক বকেয়া
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                      Initial Due
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-0.5 flex items-center space-x-1.5">
                    <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase ${theme.badgeBg}`}>
                      {shopName}
                    </span>
                    <span>• বকেয়া পরিবর্তন বা নতুন সংযোজন</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800/80 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Shop Summary Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                  {getShopIcon()}
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase">{shopName}</h4>
                  <p className="text-[11px] text-slate-400 font-medium">বর্তমান মোট বকেয়া রেজিস্টার</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CURRENT TOTAL DUE</p>
                <p className="text-xl font-black font-mono text-amber-400">
                  ৳{currentTotalDue.toLocaleString('en-US')}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveInitialDue} className="space-y-5">
              {/* Month Selector: Bill er month option er moto navigation */}
              <div>
                <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                  <span>বকেয়ার মাস (TARGET MONTH)</span>
                  <span className="text-[10px] text-slate-500 font-mono normal-case">
                    {formatBengaliMonthYear(billMonth)}
                  </span>
                </label>
                <div className="flex items-center justify-between bg-slate-950 rounded-2xl p-1.5 border border-slate-800 shadow-inner">
                  <button
                    type="button"
                    onClick={() => {
                      const idx = monthOptions.findIndex(o => o.key === billMonth);
                      if (idx !== -1 && idx < monthOptions.length - 1) {
                        handleMonthChange(monthOptions[idx + 1].key);
                      } else {
                        const [y, m] = billMonth.split('-').map(Number);
                        const d = new Date(y, m - 2, 1);
                        handleMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                      }
                    }}
                    className="w-9 h-9 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-amber-300 hover:text-white rounded-xl transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                    title="পূর্ববর্তী মাস"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                  </button>

                  <div className="flex-1 px-3 py-1 text-center select-none flex items-center justify-center space-x-2">
                    <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-sm font-black uppercase font-mono tracking-wider text-white">
                      {formatMonthOnlyUpper(billMonth)}
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-400">
                      {billMonth.split('-')[0]}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const idx = monthOptions.findIndex(o => o.key === billMonth);
                      if (idx > 0) {
                        handleMonthChange(monthOptions[idx - 1].key);
                      } else {
                        const [y, m] = billMonth.split('-').map(Number);
                        const d = new Date(y, m, 1);
                        handleMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                      }
                    }}
                    className="w-9 h-9 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-amber-300 hover:text-white rounded-xl transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                    title="পরবর্তী মাস"
                  >
                    <ChevronRight className="w-4 h-4 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                  </button>
                </div>
              </div>

              {/* Mode Toggle: SET (Replace) vs ADD */}
              <div>
                <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block mb-1.5">
                  কাজের ধরন (ACTION TYPE)
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/90 rounded-2xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setBillMode('SET')}
                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                      billMode === 'SET'
                        ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>বকেয়া পরিবর্তন (Replace)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBillMode('ADD')}
                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                      billMode === 'ADD'
                        ? 'bg-emerald-600 text-white shadow-md font-black'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>যোগ করুন (Add to Due)</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 pl-1 italic">
                  {billMode === 'SET'
                    ? '💡 Replace মোড: নির্বাচিত মাসের আগের প্রারম্ভিক বকেয়া মুছে নতুন এই পরিমাণ সেট হবে।'
                    : '💡 Add মোড: বর্তমান বকেয়ার সাথে এই পরিমাণটি নতুন করে অতিরিক্ত যোগ হবে।'}
                </p>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">
                    টাকার পরিমাণ (AMOUNT ৳)
                  </label>
                  {billMode === 'SET' && previousAmount > 0 && (
                    <span className="text-[10px] font-mono font-bold text-amber-400/80">
                      এই মাসে আগের বকেয়া: ৳{previousAmount.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-black text-sm">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    placeholder="টাকার পরিমাণ লিখুন (যেমন: 5000)"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-base font-black font-mono text-amber-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                    autoFocus
                  />
                </div>

                {/* Quick Amount Buttons */}
                <div className="flex items-center space-x-1.5 mt-2 flex-wrap gap-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Quick:</span>
                  {[1000, 2000, 5000, 10000, 20000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setBillAmount(String(amt))}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold border border-slate-700 transition-colors"
                    >
                      +৳{amt.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBillAmount('0')}
                    className="px-2 py-0.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 text-[10px] font-mono font-bold border border-rose-800/40 transition-colors"
                  >
                    ৳0 (Nil)
                  </button>
                </div>
              </div>

              {/* Note / Remarks */}
              <div>
                <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block mb-1.5">
                  বকেয়ার বিবরণ বা মেমো নম্বর (ঐচ্ছিক নোট)
                </label>
                <input
                  type="text"
                  value={billNote}
                  onChange={(e) => setBillNote(e.target.value)}
                  placeholder={`যেমন: পূর্বের বকেয়া হিসাব / ভাউচার #${formatBengaliMonthYear(billMonth)}`}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              {/* Live Resulting Calculation Card */}
              <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">বর্তমান মোট বকেয়া:</span>
                  <span className="font-mono text-slate-300">৳{currentTotalDue.toLocaleString()}</span>
                </div>
                {billMode === 'SET' && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">পূর্বের নির্ধারিত এন্ট্রি (বিয়োগ):</span>
                    <span className="font-mono text-rose-400">-৳{previousAmount.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">নতুন ইনপুট (যোগ):</span>
                  <span className="font-mono text-amber-400">+৳{numAmount.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-black text-white uppercase">
                    নতুন সর্বমোট বকেয়া (RESULTING DUE):
                  </span>
                  <span className={`text-base font-black font-mono ${resultingDue > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    ৳{resultingDue.toLocaleString()}
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isSaving ? (
                    <span>সংরক্ষণ হচ্ছে...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>সংরক্ষণ করুন (SAVE DUE)</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

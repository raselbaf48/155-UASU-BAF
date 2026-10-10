import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Check, 
  Banknote, 
  Wallet, 
  Calendar, 
  UserCheck, 
  AlertCircle,
  ShoppingCart,
  Layers,
  Utensils,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DueShopName, ExpenseRecord, resolveExpenseDueShop } from '../pages/DueRegister';
import { formatCanteenDate } from '../utils/dateUtils';
import { pushKeyToCloud } from '../utils/canteenCloudSync';
import { getCanteenConfig } from '../utils/canteenSettings';
import { supabase } from '../../../supabase';
import { DateNavigator, getTodayYMD } from './DateNavigator';
import { getRunningMonthKey, formatMonthOnlyUpper } from '../pages/MemberDB';
import { formatBengaliMonthYear, toBengaliNum } from '../utils/exportCanteenBillExcel';
import { getExpenseMonthKey } from './SetShopInitialDueModal';

const EXPENSES_STORAGE_KEY = 'canteen_expenses';

// Helper to determine the last calendar date of a given month key (e.g. '2026-09' -> 30 Sep 2026)
const getLastDateOfMonth = (monthKey: string) => {
  if (!monthKey || monthKey === 'ALL') {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    return {
      dateStr: now.toISOString().split('T')[0],
      formatted: `${d}/${m}/${y}`,
      labelBn: 'আজ পর্যন্ত'
    };
  }
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const lastDay = new Date(year, month, 0).getDate();
  const dStr = String(lastDay).padStart(2, '0');
  const mStr = String(month).padStart(2, '0');
  const monthNamesBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  const bnName = monthNamesBn[month - 1] || '';
  return {
    dateStr: `${year}-${mStr}-${dStr}`,
    formatted: `${dStr}/${mStr}/${year}`,
    labelBn: `${toBengaliNum(dStr)} ${bnName} ${toBengaliNum(year)}`
  };
};

const DEFAULT_CIVILIANS = [
  'Civ Tanvir',
  'Civ Nur Nabi',
  'Civ Akramul',
  'Civ Sharif',
  'Civ Irfan',
  'Civ Sanwar'
];

// Convert canteen date string ("DD Mon YY" or similar) to YYYY-MM-DD for native HTML5 date input
const toInputDateValue = (str: string): string => {
  if (!str) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const monMatch = str.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})/);
  if (monMatch) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mIdx = months.indexOf(monMatch[2].slice(0, 3).toLowerCase());
    if (mIdx >= 0) {
      let yr = parseInt(monMatch[3], 10);
      if (yr < 100) yr += 2000;
      const day = String(parseInt(monMatch[1], 10)).padStart(2, '0');
      return `${yr}-${String(mIdx + 1).padStart(2, '0')}-${day}`;
    }
  }
  const dmy = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
  if (dmy) {
    let yr = parseInt(dmy[3], 10);
    if (yr < 100) yr += 2000;
    const day = String(parseInt(dmy[1], 10)).padStart(2, '0');
    const month = String(parseInt(dmy[2], 10)).padStart(2, '0');
    return `${yr}-${month}-${day}`;
  }
  return '';
};

interface ShopPayBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: DueShopName;
  totalDue: number;
  initialMonth?: string;
  onSuccess: (amountPaid: number, method: string) => void;
}

export const ShopPayBillModal: React.FC<ShopPayBillModalProps> = ({
  isOpen,
  onClose,
  shopName,
  totalDue,
  initialMonth,
  onSuccess
}) => {
  const [payBillMonth, setPayBillMonth] = useState<string>(() => {
    return initialMonth && initialMonth !== 'ALL' ? initialMonth : getRunningMonthKey();
  });
  const [shopDueExpenses, setShopDueExpenses] = useState<ExpenseRecord[]>([]);
  const [payAmount, setPayAmount] = useState<string>('');
  // Payment Method is strictly Cash as requested: "Payment Method only cash hbe"
  const payMethod = 'Cash';
  const [payDate, setPayDate] = useState<string>(formatCanteenDate(new Date()));
  const [paidBy, setPaidBy] = useState<string>('Manager');
  const [managerName, setManagerName] = useState<string>('');
  const [civiliansList, setCiviliansList] = useState<string[]>(DEFAULT_CIVILIANS);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadShopExpenses = () => {
    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const all: ExpenseRecord[] = raw ? JSON.parse(raw) : [];
      const filtered = all.filter(
        (e) => resolveExpenseDueShop(e) === shopName && 
               String(e.paymentMethod || '').trim().toLowerCase() === 'due'
      );
      setShopDueExpenses(filtered);
    } catch {
      setShopDueExpenses([]);
    }
  };

  useEffect(() => {
    // Load manager name
    try {
      const cfg = getCanteenConfig();
      if (cfg?.managerName) {
        setManagerName(cfg.managerName);
      }
    } catch {}

    // Load any additional Civilians from Canteen_Member
    const fetchCivilians = async () => {
      try {
        const { data } = await supabase.from('Canteen_Member').select('*');
        if (data && Array.isArray(data)) {
          const fetchedCivs = data
            .filter((m: any) => {
              const rank = (m.Rank || m.rank || '').toUpperCase();
              const role = (m.Role || m.role || '').toUpperCase();
              const name = (m.Surname || m.Name || '').toUpperCase();
              return rank.includes('CIV') || role.includes('STAFF') || role.includes('COOK') || name.includes('TANVIR');
            })
            .map((m: any) => {
              const surname = m.Surname || m.surname || m.Name || m.name || '';
              const rank = m.Rank || 'Civ';
              return `${rank} ${surname}`.trim();
            });

          const combined = Array.from(new Set([...DEFAULT_CIVILIANS, ...fetchedCivs])).filter(Boolean);
          setCiviliansList(combined);
        }
      } catch (err) {
        console.warn('Failed to fetch civilians for ShopPayBillModal:', err);
      }
    };

    fetchCivilians();
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadShopExpenses();
      const m = initialMonth && initialMonth !== 'ALL' ? initialMonth : getRunningMonthKey();
      setPayBillMonth(m);
      setPayDate(formatCanteenDate(new Date()));
      setPaidBy('Manager');
      setErrorMessage(null);
    }
  }, [isOpen, shopName, initialMonth]);

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const cur = getRunningMonthKey();
    set.add(cur);
    shopDueExpenses.forEach((e) => {
      const mk = e.monthKey || getExpenseMonthKey(e.date);
      if (mk) set.add(mk);
    });
    return Array.from(set).sort().reverse();
  }, [shopDueExpenses]);

  const totalOverallDue = useMemo(() => {
    const calc = shopDueExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    return calc > 0 ? calc : totalDue;
  }, [shopDueExpenses, totalDue]);

  const dueUpTo = useMemo(() => {
    if (payBillMonth === 'ALL') {
      return totalOverallDue;
    }
    const upTo = shopDueExpenses
      .filter((e) => {
        const mk = e.monthKey || getExpenseMonthKey(e.date);
        return !mk || mk <= payBillMonth;
      })
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
    if (upTo > 0) return Math.min(totalOverallDue, upTo);
    // If viewing current running month and no items found yet in ledger, fallback to totalDue
    if (shopDueExpenses.length === 0 && payBillMonth === getRunningMonthKey()) return totalOverallDue;
    return 0;
  }, [shopDueExpenses, payBillMonth, totalOverallDue]);

  const singleMonthBill = useMemo(() => {
    if (payBillMonth === 'ALL') return 0;
    return shopDueExpenses
      .filter((e) => (e.monthKey || getExpenseMonthKey(e.date)) === payBillMonth)
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [shopDueExpenses, payBillMonth]);

  // Sync initial payAmount whenever dueUpTo or modal open changes
  // Default payAmount strictly reflects the due amount up to the selected month
  useEffect(() => {
    if (isOpen) {
      setPayAmount(String(Math.max(0, dueUpTo)));
    }
  }, [isOpen, dueUpTo]);

  const lastDateInfo = useMemo(() => getLastDateOfMonth(payBillMonth), [payBillMonth]);

  const handlePrevMonth = () => {
    let target = payBillMonth;
    if (!target || target === 'ALL') {
      target = getRunningMonthKey();
    }
    const idx = availableMonths.indexOf(target);
    let prevMonth = '';
    if (idx !== -1 && idx < availableMonths.length - 1) {
      prevMonth = availableMonths[idx + 1];
    } else {
      const [y, m] = target.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      prevMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    setPayBillMonth(prevMonth);
  };

  const handleNextMonth = () => {
    let target = payBillMonth;
    if (!target || target === 'ALL') {
      target = getRunningMonthKey();
    }
    const idx = availableMonths.indexOf(target);
    let nextMonth = '';
    if (idx > 0) {
      nextMonth = availableMonths[idx - 1];
    } else {
      const [y, m] = target.split('-').map(Number);
      const d = new Date(y, m, 1);
      nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    setPayBillMonth(nextMonth);
  };

  const toggleAllOrSpecific = () => {
    if (payBillMonth === 'ALL') {
      const running = getRunningMonthKey();
      setPayBillMonth(running);
    } else {
      setPayBillMonth('ALL');
    }
  };

  const numPayAmount = parseFloat(payAmount) || 0;
  const targetDueBase = payBillMonth === 'ALL' ? totalOverallDue : dueUpTo;
  const remainingDue = Math.max(0, targetDueBase - numPayAmount);

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numPayAmount) || numPayAmount <= 0) {
      setErrorMessage('সঠিক পরিশোধের পরিমাণ লিখুন (টাকা ০ এর বেশি হতে হবে)।');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const finalPayDate = formatCanteenDate(payDate) || formatCanteenDate(new Date());

    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const all: ExpenseRecord[] = raw ? JSON.parse(raw) : [];

      // Filter due records for this shop
      const shopDueRecords: ExpenseRecord[] = [];
      const otherRecords: ExpenseRecord[] = [];

      all.forEach((record) => {
        const isShopDue = 
          resolveExpenseDueShop(record) === shopName && 
          String(record.paymentMethod || '').trim().toLowerCase() === 'due';
        if (isShopDue) {
          shopDueRecords.push(record);
        } else {
          otherRecords.push(record);
        }
      });

      // Sort shop due records: if a specific month is selected, prioritize records on or before that month, then chronological
      shopDueRecords.sort((a, b) => {
        const parseD = (s: string) => {
          const parts = String(s).split(/[-/.]/);
          if (parts.length === 3) {
            return parts[0].length === 4 
              ? new Date(`${parts[0]}-${parts[1]}-${parts[2]}`).getTime() 
              : new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
          }
          return 0;
        };
        return parseD(a.date) - parseD(b.date);
      });

      let remainingToSettle = numPayAmount;
      const settledRecords: ExpenseRecord[] = [];

      const billMonthCycle = (payBillMonth && payBillMonth !== 'ALL') ? payBillMonth : getRunningMonthKey();
      const billMonthLabelBn = formatBengaliMonthYear(billMonthCycle);
      const lastDateCovered = lastDateInfo.formatted;
      const paidByTag = paidBy.trim() ? `Paid By: ${paidBy.trim()}` : '';
      const paymentMonthNote = `(${billMonthLabelBn} বিল | শেষ তারিখ: ${lastDateCovered} | পরিশোধ: ${finalPayDate})`;
      const extraInfo = paidByTag ? `${paidByTag} | ${paymentMonthNote}` : paymentMonthNote;

      for (const rec of shopDueRecords) {
        if (remainingToSettle <= 0) {
          // Keep as due
          settledRecords.push(rec);
          continue;
        }

        const recAmount = Number(rec.amount) || 0;

        if (recAmount <= remainingToSettle) {
          // Fully settle this record
          remainingToSettle -= recAmount;
          settledRecords.push({
            ...rec,
            paymentMethod: payMethod,
            settledDate: finalPayDate,
            settledMethod: payMethod,
            subdesc: rec.subdesc ? `${rec.subdesc} | ${extraInfo}` : extraInfo
          });
        } else {
          // Partially settle this record: split into settled part and remaining due part
          const settledPartAmount = remainingToSettle;
          const remainingPartAmount = recAmount - remainingToSettle;
          remainingToSettle = 0;

          // 1. Settled part
          settledRecords.push({
            ...rec,
            id: `${rec.id}-settled-${Date.now()}`,
            amount: settledPartAmount,
            paymentMethod: payMethod,
            settledDate: finalPayDate,
            settledMethod: payMethod,
            subdesc: rec.subdesc 
              ? `${rec.subdesc} (Partially Paid ৳${settledPartAmount}) | ${extraInfo}` 
              : `Partially Paid ৳${settledPartAmount} | ${extraInfo}`
          });

          // 2. Remaining due part
          settledRecords.push({
            ...rec,
            id: `${rec.id}-due-rem-${Date.now()}`,
            amount: remainingPartAmount,
            paymentMethod: 'Due',
            subdesc: rec.subdesc 
              ? `${rec.subdesc} (Remaining Due: ৳${remainingPartAmount})` 
              : `Remaining Due: ৳${remainingPartAmount}`
          });
        }
      }

      // If user paid more than all due items, add a settlement/advance payment entry
      if (remainingToSettle > 0) {
        const extraSettlementRecord: ExpenseRecord = {
          id: `shop-pay-extra-${shopName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
          date: finalPayDate,
          desc: `${shopName} বিল পরিশোধ (${billMonthLabelBn})`,
          subdesc: extraInfo,
          category: 'Canteen',
          paymentMethod: payMethod,
          settledDate: finalPayDate,
          settledMethod: payMethod,
          dueShop: shopName,
          amount: remainingToSettle,
          isCustom: true,
          detailedPerson: paidBy
        };
        settledRecords.push(extraSettlementRecord);
      }

      const updated = [...settledRecords, ...otherRecords];

      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updated));

      try {
        await pushKeyToCloud(EXPENSES_STORAGE_KEY, updated);
      } catch (cloudErr) {
        console.warn('Cloud sync error for shop payment:', cloudErr);
      }

      // Dispatch events for all listeners
      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      onSuccess(numPayAmount, payMethod);
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'বিল পরিশোধ সম্পন্ন করতে সমস্যা হয়েছে।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getShopIcon = () => {
    if (shopName === 'Grocessary Shop') return <ShoppingCart className="w-5 h-5 text-emerald-400" />;
    if (shopName === 'Poultry Shop') return <Layers className="w-5 h-5 text-amber-400" />;
    return <Utensils className="w-5 h-5 text-purple-400" />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[120] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-xl shadow-2xl p-6 sm:p-7 space-y-5 my-auto text-slate-200"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shadow-inner">
                  {getShopIcon()}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">
                      দোকানের বিল পরিশোধ (Pay Bill)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-500/30">
                      Settle Due
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    {shopName} • পাওনা বকেয়া পরিশোধ ও সমন্বয়
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

            {/* Month Selector with Left/Right Arrows (Modeled directly from Member Pay Bill) */}
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  BILL MONTH (বিলের মাস)
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">
                    {lastDateInfo.labelBn}
                  </span>
                  <button
                    type="button"
                    onClick={toggleAllOrSpecific}
                    className={`text-[9px] px-2 py-0.5 rounded-md font-mono font-bold transition-all cursor-pointer ${
                      payBillMonth === 'ALL'
                        ? 'bg-amber-500 text-slate-950 font-black'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {payBillMonth === 'ALL' ? 'SPECIFIC MONTH' : 'ALL DUE'}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-2xl p-1.5 shadow-inner">
                {/* Left Arrow Button */}
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-700/60 shadow-md active:scale-95"
                  title="Previous Month (পূর্ববর্তী মাস)"
                >
                  <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                </button>

                {/* Month Display (e.g. "OCTOBER") */}
                <div className="flex-1 text-center px-2 py-0.5 select-none">
                  <div className="flex items-center justify-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-sm sm:text-base font-black uppercase font-mono tracking-wider text-white">
                      {payBillMonth === 'ALL' ? 'ALL MONTHS' : formatMonthOnlyUpper(payBillMonth)}
                    </span>
                    {payBillMonth !== 'ALL' && (
                      <span className="text-xs font-mono font-bold text-slate-400">
                        {payBillMonth.split('-')[0]}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                    {payBillMonth === 'ALL' 
                      ? 'সর্বমোট বর্তমান বকেয়া (আজ পর্যন্ত)' 
                      : `(${lastDateInfo.formatted} পর্যন্ত বিল)`}
                  </div>
                </div>

                {/* Right Arrow Button */}
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-white rounded-xl transition-all cursor-pointer border border-slate-700/60 shadow-md active:scale-95"
                  title="Next Month (পরবর্তী মাস)"
                >
                  <ChevronRight className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Due Amount Highlight Card (Matching Member Pay Bill) */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-center mb-3 space-y-1">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {payBillMonth === 'ALL' 
                  ? 'সর্বমোট বর্তমান বকেয়া' 
                  : `${lastDateInfo.labelBn} পর্যন্ত বকেয়া বিল`}
              </p>
              <p className="text-3xl font-black text-rose-500 font-mono">
                ৳{dueUpTo.toLocaleString()}
              </p>
              {singleMonthBill > 0 && singleMonthBill !== dueUpTo && payBillMonth !== 'ALL' && (
                <p className="text-[11px] text-slate-400 font-medium">
                  (শুধু {formatBengaliMonthYear(payBillMonth)} মাসের বিল: <span className="text-amber-400 font-mono font-bold">৳{singleMonthBill.toLocaleString()}</span>)
                </p>
              )}
              {totalOverallDue !== dueUpTo && (
                <p className="text-[10px] text-slate-500 pt-0.5">
                  মোট সার্বিক বকেয়া (আজ পর্যন্ত): ৳{totalOverallDue.toLocaleString()}
                </p>
              )}
            </div>

            <form onSubmit={handleConfirmPay} className="space-y-4">
              {/* Payment Amount */}
              <div>
                <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block mb-1.5">
                  পরিশোধের পরিমাণ (PAY AMOUNT ৳)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-black text-base">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder="পরিশোধের টাকা লিখুন"
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-4 py-3 text-lg font-black font-mono text-emerald-400 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    autoFocus
                  />
                </div>

                {/* Quick Fill Pills */}
                <div className="flex items-center space-x-1.5 mt-2 flex-wrap gap-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase mr-1">Quick:</span>
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(dueUpTo))}
                    className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[10px] font-mono font-black border border-emerald-500/30 transition-colors cursor-pointer"
                  >
                    {payBillMonth === 'ALL' ? 'সম্পূর্ণ বকেয়া' : `${formatMonthOnlyUpper(payBillMonth)} পর্যন্ত বকেয়া`} (৳{dueUpTo.toLocaleString()})
                  </button>
                  {singleMonthBill > 0 && singleMonthBill !== dueUpTo && payBillMonth !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(singleMonthBill))}
                      className="px-2.5 py-1 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 text-[10px] font-mono font-black border border-amber-500/30 transition-colors cursor-pointer"
                    >
                      শুধু এই মাসের বিল (৳{singleMonthBill.toLocaleString()})
                    </button>
                  )}
                  {dueUpTo > 1000 && (
                    <button
                      type="button"
                      onClick={() => setPayAmount(String(Math.round(dueUpTo / 2)))}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold border border-slate-700 transition-colors cursor-pointer"
                    >
                      ৫০% (৳{Math.round(dueUpTo / 2).toLocaleString()})
                    </button>
                  )}
                  {[1000, 5000, 10000, 20000].filter(amt => amt <= dueUpTo).map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPayAmount(String(amt))}
                      className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono font-bold border border-slate-700 transition-colors cursor-pointer"
                    >
                      ৳{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Method - Fixed Cash Only as requested */}
              <div>
                <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block mb-1.5">
                  পরিশোধের মাধ্যম (PAYMENT METHOD)
                </label>
                <div className="flex items-center space-x-2.5 py-2.5 px-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black uppercase">
                  <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Cash (ক্যাশ)</span>
                  <span className="text-[10px] text-emerald-400/80 font-bold ml-auto uppercase bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                    Only Cash
                  </span>
                </div>
              </div>

              {/* Payment Date & Paid By */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                {/* Payment Date - POS Sales DateNavigator */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">
                    তারিখ (PAYMENT DATE)
                  </label>
                  <DateNavigator
                    value={toInputDateValue(payDate)}
                    onChange={(val) => setPayDate(val)}
                    label="Dt"
                    format="dd_mm_yy"
                  />
                </div>

                {/* Paid By - Default Manager, clicking shows all Civs */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-300 uppercase tracking-wider block">
                    পরিশোধকারী (PAID BY)
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={paidBy}
                      onChange={(e) => setPaidBy(e.target.value)}
                      className="w-full bg-slate-950/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-xl pl-10 pr-9 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer appearance-none transition-all h-8 min-h-[32px]"
                    >
                      <option value="Manager" className="bg-slate-900 text-emerald-400 font-black">
                        Manager {managerName ? `(${managerName})` : ''}
                      </option>
                      <optgroup label="Civilian Staff" className="bg-slate-900 text-slate-400 font-bold">
                        {civiliansList.map((c) => (
                          <option key={c} value={c} className="bg-slate-900 text-white font-medium">
                            {c}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Live Balance Summary Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    {payBillMonth === 'ALL' ? 'মোট বর্তমান বকেয়া:' : `${formatMonthOnlyUpper(payBillMonth)} পর্যন্ত বকেয়া:`}
                  </span>
                  <span className="font-mono text-slate-300">৳{targetDueBase.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">পরিশোধ হচ্ছে ({payMethod}):</span>
                  <span className="font-mono text-emerald-400 font-bold">-৳{numPayAmount.toLocaleString()}</span>
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-black text-white uppercase">
                    অবশিষ্ট বকেয়া থাকবে:
                  </span>
                  <span className={`text-base font-black font-mono ${remainingDue === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {remainingDue === 0 ? '৳০ (সম্পূর্ণ পরিশোধিত ✓)' : `৳${remainingDue.toLocaleString()}`}
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
                  disabled={isSubmitting || numPayAmount <= 0}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isSubmitting ? (
                    <span>প্রসেসিং হচ্ছে...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>পরিশোধ নিশ্চিত করুন (PAY ৳{numPayAmount.toLocaleString()})</span>
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


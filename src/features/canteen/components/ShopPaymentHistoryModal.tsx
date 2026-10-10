import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Search, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Banknote, 
  History, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingCart, 
  Layers, 
  Utensils, 
  Check, 
  Loader2, 
  RefreshCw, 
  Filter, 
  Wallet, 
  Store,
  FileText,
  UserCheck,
  CreditCard,
  Save,
  ChevronDown
} from 'lucide-react';
import { DateNavigator } from './DateNavigator';
import { ExpenseRecord, DueShopName, DUE_SHOPS } from '../pages/Expenditures';
import { pushKeyToCloud } from '../utils/canteenCloudSync';
import { formatBengaliMonthYear } from '../utils/exportCanteenBillExcel';
import { getRunningMonthKey } from '../pages/MemberDB';
import { formatCanteenDate } from '../utils/dateUtils';
import { getCanteenConfig } from '../utils/canteenSettings';
import { supabase } from '../../../supabase';

const EXPENSES_STORAGE_KEY = 'canteen_expenses';

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

interface ShopPaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentUpdated?: () => void;
}

// Convert YYYY-MM into readable format (e.g. October 26)
export const formatPaymentHistoryMonth = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') return 'All Months';
  const parts = String(monthKey).split('-');
  if (parts.length < 2) return monthKey;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const name = monthNames[month - 1] || parts[1];
  const yy = String(year).slice(-2);
  return `${name} ${yy}`;
};

// Convert date string or timestamp to English date
export const toEnglishDate = (val: any): string => {
  if (!val) return '';
  if (typeof val === 'string' && /^\d{1,2}\s+[A-Za-z]{3}\s+\d{2,4}$/.test(val.trim())) {
    return val.trim();
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  return `${day} ${month} ${yy}`;
};

// Resolve which shop an expense or payment belongs to
export const resolveShopName = (expense: ExpenseRecord): DueShopName => {
  if (expense.dueShop && DUE_SHOPS.includes(expense.dueShop as DueShopName)) {
    return expense.dueShop as DueShopName;
  }
  const desc = String(expense.desc || '').toLowerCase();
  if (
    desc.includes('bake') || desc.includes('bite') || desc.includes('bread') || 
    desc.includes('biscuit') || desc.includes('cake') || desc.includes('toast') || 
    desc.includes('patties') || desc.includes('bakery')
  ) {
    return 'Bake & Bite';
  }
  if (
    desc.includes('poultry') || desc.includes('chicken') || desc.includes('broiler') || 
    desc.includes('murgi') || desc.includes('egg') || desc.includes('dim') || 
    desc.includes('cock') || desc.includes('meat')
  ) {
    return 'Poultry Shop';
  }
  return 'Grocessary Shop';
};

// Soft harmonic celebration chime via Web Audio API
const playHarmonicSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.55);
    });
  } catch {}
};

export const ShopPaymentHistoryModal: React.FC<ShopPaymentHistoryModalProps> = ({
  isOpen,
  onClose,
  onPaymentUpdated
}) => {
  const [allExpenses, setAllExpenses] = useState<ExpenseRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<'ALL' | 'Cash' | 'UCB'>('ALL');
  const [shopFilter, setShopFilter] = useState<'ALL' | DueShopName>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>(() => getRunningMonthKey());
  const [dateFilter, setDateFilter] = useState<string>('');

  // Edit / Revert state
  const [paymentToEdit, setPaymentToEdit] = useState<ExpenseRecord | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editMethod, setEditMethod] = useState<'Cash' | 'UCB'>('Cash');
  const [editShop, setEditShop] = useState<DueShopName>('Grocessary Shop');
  const [editPaidBy, setEditPaidBy] = useState<string>('');
  const [editVoucher, setEditVoucher] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [paymentToDelete, setPaymentToDelete] = useState<ExpenseRecord | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [deleteSuccessData, setDeleteSuccessData] = useState<{
    amount: number;
    shopName: string;
    successMsg: string;
  } | null>(null);

  const [managerName, setManagerName] = useState<string>('');
  const [civiliansList, setCiviliansList] = useState<string[]>(DEFAULT_CIVILIANS);

  // Load manager & civilians
  useEffect(() => {
    try {
      const cfg = getCanteenConfig();
      if (cfg?.managerName) {
        setManagerName(cfg.managerName);
      }
    } catch {}

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
        console.warn('Failed to fetch civilians for ShopPaymentHistoryModal:', err);
      }
    };

    fetchCivilians();
  }, []);

  // Load expenses from local storage
  const loadData = () => {
    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const list: ExpenseRecord[] = raw ? JSON.parse(raw) : [];
      setAllExpenses(list);
    } catch {
      setAllExpenses([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleSync = () => loadData();
    window.addEventListener('canteen_expenses_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('canteen_expenses_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Filter out records that are active dues and extract payment / settled records
  const allPaymentRecords = useMemo(() => {
    return allExpenses
      .filter((e) => {
        const isDue = String(e.paymentMethod || '').trim().toLowerCase() === 'due';
        if (isDue) return false;
        if (e.settledDate) return true;
        if (e.dueShop) return true;
        if (String(e.id).startsWith('shop-pay-')) return true;
        const descLower = String(e.desc || '').toLowerCase();
        return (
          descLower.includes('grocessary') ||
          descLower.includes('poultry') ||
          descLower.includes('bake & bite') ||
          descLower.includes('bake and bite')
        );
      })
      .sort((a, b) => {
        const dateA = new Date(a.settledDate || a.date).getTime() || 0;
        const dateB = new Date(b.settledDate || b.date).getTime() || 0;
        if (dateB !== dateA) return dateB - dateA;
        return String(b.id).localeCompare(String(a.id));
      });
  }, [allExpenses]);

  // Extract available months from records
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    allPaymentRecords.forEach((e) => {
      const rawD = e.settledDate || e.date;
      if (rawD) {
        const d = new Date(rawD);
        if (!isNaN(d.getTime())) {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          set.add(`${y}-${m}`);
        }
      }
    });
    const current = getRunningMonthKey();
    set.add(current);
    return Array.from(set).sort().reverse();
  }, [allPaymentRecords]);

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (monthFilter === 'ALL') {
      setMonthFilter(availableMonths[0] || getRunningMonthKey());
      return;
    }
    const idx = availableMonths.indexOf(monthFilter);
    if (idx !== -1 && idx < availableMonths.length - 1) {
      setMonthFilter(availableMonths[idx + 1]);
    } else {
      const [y, m] = monthFilter.split('-').map(Number);
      const prevD = new Date(y, m - 2, 1);
      const prevKey = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
      setMonthFilter(prevKey);
    }
    setDateFilter('');
  };

  const handleNextMonth = () => {
    if (monthFilter === 'ALL') return;
    const idx = availableMonths.indexOf(monthFilter);
    if (idx > 0) {
      setMonthFilter(availableMonths[idx - 1]);
    } else {
      const [y, m] = monthFilter.split('-').map(Number);
      const nextD = new Date(y, m, 1);
      const nextKey = `${nextD.getFullYear()}-${String(nextD.getMonth() + 1).padStart(2, '0')}`;
      setMonthFilter(nextKey);
    }
    setDateFilter('');
  };

  // Payment counts by method
  const countsByMethod = useMemo(() => {
    let allCount = 0;
    let cashCount = 0;
    let ucbCount = 0;

    allPaymentRecords.forEach((r) => {
      // Month filter check
      if (monthFilter !== 'ALL') {
        const dStr = r.settledDate || r.date;
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (mKey !== monthFilter) return;
        }
      }
      allCount++;
      const meth = String(r.paymentMethod || r.settledMethod || '').toLowerCase();
      if (meth.includes('ucb') || meth.includes('bank')) {
        ucbCount++;
      } else {
        cashCount++;
      }
    });

    return { allCount, cashCount, ucbCount };
  }, [allPaymentRecords, monthFilter]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return allPaymentRecords.filter((record) => {
      const shop = resolveShopName(record);

      // Shop filter
      if (shopFilter !== 'ALL' && shop !== shopFilter) {
        return false;
      }

      // Method filter
      if (methodFilter !== 'ALL') {
        const meth = String(record.paymentMethod || record.settledMethod || '').toLowerCase();
        if (methodFilter === 'UCB' && !meth.includes('ucb') && !meth.includes('bank')) return false;
        if (methodFilter === 'Cash' && (meth.includes('ucb') || meth.includes('bank'))) return false;
      }

      // Month filter
      if (monthFilter !== 'ALL') {
        const dStr = record.settledDate || record.date;
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (mKey !== monthFilter) return false;
        }
      }

      // Date filter
      if (dateFilter) {
        const dStr = record.settledDate || record.date;
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (dayKey !== dateFilter && dStr !== dateFilter) return false;
        } else if (!dStr.includes(dateFilter)) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inShop = shop.toLowerCase().includes(q);
        const inDesc = String(record.desc || '').toLowerCase().includes(q);
        const inSub = String(record.subdesc || '').toLowerCase().includes(q);
        const inPerson = String(record.detailedPerson || '').toLowerCase().includes(q);
        const inDate = String(record.settledDate || record.date || '').toLowerCase().includes(q);
        const inAmount = String(record.amount || '').includes(q);
        return inShop || inDesc || inSub || inPerson || inDate || inAmount;
      }

      return true;
    });
  }, [allPaymentRecords, shopFilter, methodFilter, monthFilter, dateFilter, searchQuery]);

  const totalFilteredAmount = useMemo(() => {
    return filteredPayments.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [filteredPayments]);

  // Setup Edit modal
  const handleOpenEdit = (record: ExpenseRecord) => {
    setPaymentToEdit(record);
    setEditAmount(String(record.amount || 0));
    setEditDate(record.settledDate || record.date || new Date().toISOString().split('T')[0]);
    setEditMethod('Cash');
    setEditShop(resolveShopName(record));
    const pMatch = (record.subdesc || '').match(/Paid By:\s*([^•|]+)/i);
    const resolvedPerson = pMatch ? pMatch[1].trim() : (record.detailedPerson || 'Manager');
    setEditPaidBy(resolvedPerson);
    setEditVoucher('');
    setEditNotes('');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentToEdit) return;

    const numAmount = parseFloat(editAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setEditError('সঠিক টাকার পরিমাণ দিন (০ থেকে বেশি)');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const all: ExpenseRecord[] = raw ? JSON.parse(raw) : [];

      const extraTags = editPaidBy.trim() ? `Paid By: ${editPaidBy.trim()}` : '';

      const updated = all.map((item) => {
        if (String(item.id) === String(paymentToEdit.id)) {
          const formattedDate = formatCanteenDate(editDate);
          return {
            ...item,
            amount: numAmount,
            date: formattedDate || item.date,
            settledDate: formattedDate || item.settledDate || item.date,
            paymentMethod: editMethod,
            settledMethod: editMethod,
            dueShop: editShop,
            detailedPerson: editPaidBy.trim() || item.detailedPerson,
            subdesc: extraTags || item.subdesc
          };
        }
        return item;
      });

      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updated));
      await pushKeyToCloud(EXPENSES_STORAGE_KEY, updated);

      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      loadData();
      if (onPaymentUpdated) onPaymentUpdated();
      setPaymentToEdit(null);
      playHarmonicSound();
    } catch (err: any) {
      setEditError(`সংরক্ষণ করতে সমস্যা হয়েছে: ${err?.message || ''}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Revert / Delete payment record
  const handleConfirmRevert = async () => {
    if (!paymentToDelete || isDeletingPayment) return;
    setIsDeletingPayment(true);

    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const all: ExpenseRecord[] = raw ? JSON.parse(raw) : [];

      const pId = String(paymentToDelete.id);
      const targetShop = resolveShopName(paymentToDelete);
      const revertAmount = Number(paymentToDelete.amount || 0);

      let updated: ExpenseRecord[] = [];

      if (pId.startsWith('shop-pay-extra-')) {
        // Standalone extra payment record: remove completely
        updated = all.filter((e) => String(e.id) !== pId);
      } else {
        // It was an original expense record that was marked settled: Restore back to 'Due'
        updated = all.map((e) => {
          if (String(e.id) === pId) {
            const restored: ExpenseRecord = {
              ...e,
              paymentMethod: 'Due',
              dueShop: targetShop,
              subdesc: e.subdesc 
                ? e.subdesc.replace(/\|?\s*Voucher:[^|•]*/gi, '').replace(/\|?\s*Paid By:[^|•]*/gi, '').replace(/Partially Paid ৳\d+/gi, '').replace(/[•|]\s*$/, '').trim() 
                : undefined
            };
            delete (restored as any).settledDate;
            delete (restored as any).settledMethod;
            return restored;
          }
          return e;
        });
      }

      localStorage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(updated));
      await pushKeyToCloud(EXPENSES_STORAGE_KEY, updated);

      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updated }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      playHarmonicSound();
      setDeleteSuccessData({
        amount: revertAmount,
        shopName: targetShop,
        successMsg: `৳${revertAmount.toLocaleString()} টাকার পেমেন্ট সফলভাবে বাতিল করা হয়েছে এবং ${targetShop}-এর বকেয়া পূর্বাবস্থায় ফিরিয়ে দেওয়া হয়েছে।`
      });
      loadData();
      if (onPaymentUpdated) onPaymentUpdated();
    } catch (err: any) {
      alert(`পেমেন্ট বাতিল করতে সমস্যা হয়েছে: ${err?.message || ''}`);
    } finally {
      setIsDeletingPayment(false);
    }
  };

  const getShopIcon = (shop: string) => {
    if (shop === 'Grocessary Shop') {
      return (
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
          <ShoppingCart className="w-5 h-5" />
        </div>
      );
    }
    if (shop === 'Poultry Shop') {
      return (
        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
          <Layers className="w-5 h-5" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
        <Utensils className="w-5 h-5" />
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col h-[85vh] min-h-[550px] max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <span>Shop Payment History</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                  {allPaymentRecords.length}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                দোকানের পরিশোধিত বিল, ভাউচার হিস্ট্রি ও রিভার্সাল রেজিস্টার
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter and Stats Bar */}
        <div className="p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800 space-y-2.5 shrink-0">
          {/* Row 1: Search Box & Total Paid Summary */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* Search Box */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by shop name, voucher, paid by, date..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Total Paid Summary Box */}
            <div className="px-3.5 py-1.5 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center justify-between sm:justify-start space-x-2 text-xs shadow-sm shrink-0">
              <span className="text-emerald-300 text-[10px] uppercase font-black tracking-wider">
                Total Paid / Settle:
              </span>
              <span className="text-emerald-400 font-mono font-black text-sm">
                ৳{totalFilteredAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Row 2: Dt (Day) Navigator, Month Navigator, Shop Filter & Method Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
            <div className="flex flex-wrap items-center gap-2">
              {/* Day Navigator */}
              <DateNavigator
                value={dateFilter}
                onChange={(val) => {
                  setDateFilter(val);
                  if (val) {
                    const [y, m] = val.split('-');
                    if (y && m) {
                      setMonthFilter(`${y}-${m}`);
                    }
                  }
                }}
                allowAll={true}
                format="day_only"
              />

              {/* Month Navigator */}
              <div className="inline-flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 shadow-xs shrink-0 h-8 min-h-[32px]">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                  title="পূর্ববর্তী মাস"
                >
                  <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                </button>

                <div className="relative px-2 py-0.5 text-center flex items-center space-x-1 cursor-pointer group">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0 pointer-events-none" />
                  <span className="text-xs font-mono font-bold text-white tracking-tight pointer-events-none">
                    {formatPaymentHistoryMonth(monthFilter)}
                  </span>
                  <select
                    value={monthFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMonthFilter(val);
                      if (val === 'ALL') {
                        setDateFilter('');
                      } else if (dateFilter) {
                        const curDay = dateFilter.split('-')[2] || '01';
                        setDateFilter(`${val}-${curDay}`);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    title="মাস নির্বাচন করুন"
                  >
                    <option value="ALL" className="bg-slate-900 text-white">All Months</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m} className="bg-slate-900 text-white">
                        {formatPaymentHistoryMonth(m)} {m === getRunningMonthKey() ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                  title="পরবর্তী মাস"
                >
                  <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                </button>
              </div>

              {/* Shop Selector Pills */}
              <div className="flex items-center bg-slate-950 rounded-xl p-0.5 border border-slate-800 shrink-0 h-8 min-h-[32px]">
                <button
                  type="button"
                  onClick={() => setShopFilter('ALL')}
                  className={`h-7 px-2 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                    shopFilter === 'ALL'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ALL SHOPS
                </button>
                <button
                  type="button"
                  onClick={() => setShopFilter('Grocessary Shop')}
                  className={`h-7 px-2 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                    shopFilter === 'Grocessary Shop'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  GROCESSARY
                </button>
                <button
                  type="button"
                  onClick={() => setShopFilter('Poultry Shop')}
                  className={`h-7 px-2 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                    shopFilter === 'Poultry Shop'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  POULTRY
                </button>
                <button
                  type="button"
                  onClick={() => setShopFilter('Bake & Bite')}
                  className={`h-7 px-2 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                    shopFilter === 'Bake & Bite'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  BAKE & BITE
                </button>
              </div>
            </div>

            {/* Method Buttons with Counts */}
            <div className="flex items-center bg-slate-950 rounded-xl p-0.5 border border-slate-800 shrink-0 h-8 min-h-[32px]">
              <button
                type="button"
                onClick={() => setMethodFilter('ALL')}
                className={`h-7 px-2.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center space-x-1 ${
                  methodFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>ALL</span>
                <span className="opacity-90 font-mono">({countsByMethod.allCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setMethodFilter('Cash')}
                className={`h-7 px-2.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center space-x-1 ${
                  methodFilter === 'Cash'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>CASH</span>
                <span className="opacity-90 font-mono">({countsByMethod.cashCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setMethodFilter('UCB')}
                className={`h-7 px-2.5 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center space-x-1 ${
                  methodFilter === 'UCB'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>UCB</span>
                <span className="opacity-90 font-mono">({countsByMethod.ucbCount})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Payments List Area */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2.5 divide-y divide-slate-800/60 flex flex-col">
          {filteredPayments.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-slate-500 space-y-2 min-h-[280px]">
              <Store className="w-12 h-12 mx-auto text-slate-600 opacity-60" />
              <p className="text-sm font-bold text-slate-400">No shop payment history found</p>
              <p className="text-xs text-slate-500">
                {searchQuery ? 'No records match search.' : 'No shop settlements recorded for this filter.'}
              </p>
            </div>
          ) : (
            filteredPayments.map((record, idx) => {
              const shop = resolveShopName(record);
              const isUcb = String(record.paymentMethod || record.settledMethod || '').toLowerCase().includes('ucb');

              return (
                <div
                  key={record.id || idx}
                  className="pt-2.5 first:pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-950/40 hover:bg-slate-800/40 border border-slate-800/60 rounded-2xl transition-colors"
                >
                  {/* Left: Shop Info & Details */}
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <span className="text-[10px] font-mono text-slate-500 font-bold shrink-0 w-6 text-center">
                      #{idx + 1}
                    </span>

                    {getShopIcon(shop)}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                          {shop}
                        </h4>
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          SETTLED
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                        <span className="font-mono text-indigo-300 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {toEnglishDate(record.settledDate || record.date)}
                        </span>
                        <span>•</span>
                        <span className="text-slate-300 font-medium truncate max-w-[320px]">
                          {record.desc || 'Shop Payment'}
                          {record.subdesc ? ` (${record.subdesc})` : ''}
                        </span>
                        {record.detailedPerson && (
                          <>
                            <span>•</span>
                            <span className="text-slate-400 flex items-center gap-0.5">
                              <UserCheck className="w-3 h-3 text-cyan-400" />
                              {record.detailedPerson}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Paid Amount, Method & Actions */}
                  <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 pl-9 sm:pl-0">
                    <div className="text-right">
                      <p className="text-sm sm:text-base font-black font-mono leading-tight text-emerald-400">
                        +৳{Number(record.amount || 0).toLocaleString()}
                      </p>
                      <div className="flex items-center space-x-1.5 justify-end mt-0.5">
                        <span className={`px-2 py-0.2 rounded-full text-[9px] font-black uppercase border font-mono ${
                          isUcb ? 'bg-blue-950/80 text-blue-300 border-blue-500/40' : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        }`}>
                          {isUcb ? 'UCB' : 'CASH'}
                        </span>
                      </div>
                    </div>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(record)}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 hover:text-white border border-indigo-900/50 flex items-center space-x-1 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="পেমেন্টের তথ্য সম্পাদনা করুন"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="text-[11px]">Edit</span>
                    </button>

                    {/* Revert / Remove Button */}
                    <button
                      type="button"
                      onClick={() => setPaymentToDelete(record)}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-900/50 flex items-center space-x-1 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
                      title="Revert payment (Shop due will be restored and recorded in register)"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-[11px]">Revert</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="text-[11px]">
            পেমেন্ট রিভার্স করলে দোকানের বকেয়া আবার স্বয়ংক্রিয়ভাবে আগের অবস্থায় ফিরে যাবে।
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Payment Sub-Modal */}
      <AnimatePresence>
        {paymentToEdit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="bg-slate-900 border border-indigo-500/40 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 text-slate-200"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                      Edit Shop Payment
                    </h3>
                    <p className="text-xs text-slate-400">
                      দোকানের পেমেন্টের তথ্য আপডেট করুন
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentToEdit(null)}
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSaveEdit} className="space-y-4">
                {editError && (
                  <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">
                    পরিশোধের পরিমাণ (Amount ৳) *
                  </label>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Shop Selection & Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 uppercase">
                      দোকান (Shop)
                    </label>
                    <select
                      value={editShop}
                      onChange={(e) => setEditShop(e.target.value as DueShopName)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                    >
                      {DUE_SHOPS.map((s) => (
                        <option key={s} value={s} className="bg-slate-900">{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-300 uppercase">
                      তারিখ (Payment Date)
                    </label>
                    <DateNavigator
                      value={toInputDateValue(editDate)}
                      onChange={(val) => setEditDate(formatCanteenDate(val))}
                      label="Dt"
                      format="dd_mm_yy"
                    />
                  </div>
                </div>

                {/* Payment Method - Fixed Cash Only as requested */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">
                    পেমেন্ট মাধ্যম (Payment Method)
                  </label>
                  <div className="flex items-center space-x-2 py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-black uppercase">
                    <Wallet className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>CASH (ক্যাশ)</span>
                    <span className="text-[10px] text-emerald-400/80 font-bold ml-auto uppercase bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/30">
                      Only Cash
                    </span>
                  </div>
                </div>

                {/* Paid By - Default Manager, clicking shows all Civs */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300 uppercase">
                    পরিশোধকারী (Paid By)
                  </label>
                  <div className="relative">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      value={editPaidBy}
                      onChange={(e) => setEditPaidBy(e.target.value)}
                      className="w-full bg-slate-950 hover:bg-slate-900 border border-slate-700 hover:border-emerald-500/50 rounded-xl pl-9 pr-8 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer appearance-none transition-all h-8 min-h-[32px]"
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
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setPaymentToEdit(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-900/50"
                  >
                    {isSavingEdit ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment Delete / Revert Confirmation Dialog */}
      <AnimatePresence>
        {paymentToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.88, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="bg-slate-900 border border-rose-500/50 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 relative overflow-hidden"
            >
              {deleteSuccessData ? (
                /* Dynamic Success Animation View inside popup box */
                <motion.div
                  initial={{ scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="space-y-4 py-2 text-center"
                >
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 className="w-9 h-9 animate-bounce text-emerald-400" />
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">
                      পেমেন্ট বাতিল সম্পন্ন হয়েছে!
                    </h3>
                    <p className="text-xs text-emerald-300 font-semibold mt-1">
                      {deleteSuccessData.shopName}-এর বকেয়া পূর্বাবস্থায় সফলভাবে ফিরিয়ে দেওয়া হয়েছে
                    </p>
                  </div>

                  <div className="p-4 bg-slate-950/90 rounded-2xl border border-slate-800 text-xs space-y-2 text-left">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">দোকানের নাম:</span>
                      <span className="font-bold text-white">{deleteSuccessData.shopName}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm">
                      <span className="text-slate-400">বাতিলকৃত পেমেন্ট:</span>
                      <span className="font-mono font-black text-emerald-400 text-base">
                        ৳{deleteSuccessData.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDeleteSuccessData(null);
                      setPaymentToDelete(null);
                    }}
                    className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black tracking-wider transition-all cursor-pointer shadow-lg shadow-emerald-950/50 active:scale-95"
                  >
                    ঠিক আছে (DONE)
                  </button>
                </motion.div>
              ) : (
                <>
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
                  <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
                    <AlertCircle className="w-7 h-7 animate-pulse" />
                  </div>

                  <div className="text-center space-y-1.5">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">
                      Confirm Payment Reversal
                    </h3>
                    <p className="text-xs text-slate-400">
                      আপনি কি নিশ্চিতভাবে এই পেমেন্ট রেকর্ডটি বাতিল করতে চান?
                    </p>
                  </div>

                  {/* Transaction Summary Card */}
                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">দোকান (Shop):</span>
                      <span className="font-bold text-white">{resolveShopName(paymentToDelete)}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">তারিখ:</span>
                      <span className="font-mono text-indigo-300">
                        {toEnglishDate(paymentToDelete.settledDate || paymentToDelete.date)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">পেমেন্ট মাধ্যম:</span>
                      <span className="font-bold text-slate-200">
                        {String(paymentToDelete.paymentMethod || paymentToDelete.settledMethod || 'CASH').toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm">
                      <span className="text-slate-400">পরিশোধের পরিমাণ:</span>
                      <span className="font-mono font-black text-emerald-400 text-base">
                        ৳{Number(paymentToDelete.amount || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Due Restoration Notice */}
                  <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-[11px] text-rose-200 space-y-1 leading-relaxed">
                    <p className="font-bold flex items-center gap-1.5 text-rose-300">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Due Restoration Notice:</span>
                    </p>
                    <p>
                      এই পেমেন্ট বাতিল করলে অবিলম্বে <strong>{resolveShopName(paymentToDelete)}</strong>-এর বকেয়া ব্যালেন্স <strong>৳{Number(paymentToDelete.amount || 0).toLocaleString()}</strong> টাকা বৃদ্ধি পাবে এবং ক্লাউডে আপডেট হবে।
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center space-x-3 pt-2">
                    <button
                      type="button"
                      disabled={isDeletingPayment}
                      onClick={() => setPaymentToDelete(null)}
                      className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      disabled={isDeletingPayment}
                      onClick={handleConfirmRevert}
                      className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg shadow-rose-900/50 disabled:opacity-50 active:scale-95"
                    >
                      {isDeletingPayment ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Reverting...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          <span>Yes, Revert</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

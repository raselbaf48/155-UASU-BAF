import React, { useState, useMemo } from 'react';
import { 
  X, 
  Calendar, 
  Download, 
  Printer, 
  Banknote, 
  Receipt,
  ChevronLeft,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { DueShopName, ExpenseRecord, resolveExpenseDueShop } from '../pages/DueRegister';
import { getRunningMonthKey } from '../pages/MemberDB';
import { formatBengaliMonthYear, toBengaliNum } from '../utils/exportCanteenBillExcel';
import { getExpenseMonthKey } from './SetShopInitialDueModal';
import { getShopDisplayNameBn as getShopDisplayNameBnConfig, getShopEmoji as getShopEmojiConfig } from '../utils/dueShopsConfig';

const EXPENSES_STORAGE_KEY = 'canteen_expenses';

interface ShopStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: DueShopName | 'ALL';
  onSettleIndividualExpense: (expense: ExpenseRecord) => void;
  onOpenPayBill: (shop: DueShopName) => void;
}

export const ShopStatementModal: React.FC<ShopStatementModalProps> = ({
  isOpen,
  onClose,
  shopName,
  onSettleIndividualExpense,
  onOpenPayBill
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getRunningMonthKey());
  const [isCapturingPic, setIsCapturingPic] = useState<boolean>(false);

  // Read all expenses from localStorage
  const allExpenses: ExpenseRecord[] = useMemo(() => {
    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [isOpen]);

  // Helper to identify and EXCLUDE staff cash advance / refund records from shop statements
  const isExcludedExpense = (e: any): boolean => {
    if (!e) return true;
    if (e.isReturn || e.isCashReturn || e.isRefund || e.isCashAdvance) return true;
    if (e.type === 'CASH_RETURN' || e.type === 'CASH_ADVANCE') return true;

    const cat = String(e.category || '').toLowerCase();
    const pm = String(e.paymentMethod || '').toLowerCase();
    if (cat === 'refund' || pm === 'refund') return true;
    if (cat.includes('advance') || cat.includes('staff')) return true;

    const id = String(e.id || '').toLowerCase();
    if (id.includes('refund') || id.includes('settle-refund') || id.startsWith('ret-')) return true;

    const desc = String(e.desc || '').toLowerCase();
    const subdesc = String(e.subdesc || '').toLowerCase();
    const items = String((e as any).items || '').toLowerCase();

    if (
      desc.includes('refund') || 
      desc.includes('cash refund') || 
      desc.includes('ক্যাশ ফেরত') || 
      desc.includes('অব্যবহৃত') || 
      desc.includes('উদ্বৃত্ত') || 
      desc.includes('ফেরত') || 
      desc.includes('cash advance') || 
      desc.includes('ক্যাশ অগ্রিম') || 
      desc.includes('advance') || 
      subdesc.includes('refund') || 
      subdesc.includes('ফেরত') || 
      subdesc.includes('ক্যাশ ফেরত') || 
      subdesc.includes('advance') || 
      subdesc.includes('অগ্রিম') || 
      items.includes('refund') || 
      items.includes('ফেরত')
    ) {
      if (isInitialDueRecord(e)) return false;
      return true;
    }

    // Must be either an initial due, or have paymentMethod === 'due' or settled from due, or have explicit dueShop matching
    const isDueOrSettled = pm === 'due' || Boolean(e.settledDate) || Boolean(e.dueShop);
    if (!isDueOrSettled && !isInitialDueRecord(e)) {
      return true;
    }

    return false;
  };

  // Helper to detect if an expense entry is an Initial Due
  const isInitialDueRecord = (rec: ExpenseRecord): boolean => {
    if (!rec) return false;
    const rawId = String(rec.id || '').toLowerCase();
    const rawItemId = String((rec as any).rawItemId || '').toLowerCase();
    const desc = String(rec.desc || '').toLowerCase();
    const subdesc = String((rec as any).subdesc || '').toLowerCase();

    return (
      rawId.includes('shop-init') ||
      rawId.includes('init-due') ||
      rawItemId.startsWith('init-due') ||
      desc.includes('initial due') ||
      desc.includes('প্রারম্ভিক বকেয়া') ||
      desc.includes('প্রারম্ভিক বকেয়া') ||
      desc.includes('পূর্বের বকেয়া') ||
      desc.includes('পূর্বের বকেয়া') ||
      desc.includes('বকেয়া যোগ') ||
      desc.includes('বকেয়া যোগ') ||
      desc.includes('বকেয়া') ||
      desc.includes('বকেয়া') ||
      desc.includes('initial') ||
      subdesc.includes('প্রারম্ভিক বকেয়া') ||
      subdesc.includes('প্রারম্ভিক বকেয়া') ||
      subdesc.includes('পূর্বের বকেয়া') ||
      subdesc.includes('পূর্বের বকেয়া') ||
      Boolean((rec as any).isInitialDue)
    );
  };

  // Filter records by Shop (excluding cash returns/advances)
  const shopRecords = useMemo(() => {
    return allExpenses.filter((e) => {
      if (isExcludedExpense(e)) return false;
      const eShop = resolveExpenseDueShop(e);
      if (shopName !== 'ALL' && eShop !== shopName) return false;
      return true;
    });
  }, [allExpenses, shopName]);

  // Month options list for dropdown (Single year display, no duplicate 2026)
  const monthOptions = useMemo(() => {
    const list: Array<{ key: string; label: string }> = [
      { key: 'ALL', label: 'সকল মাস (ALL MONTHS)' }
    ];
    const now = new Date();
    for (let i = 0; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bnLabel = formatBengaliMonthYear(key);
      const enMonth = d.toLocaleString('en', { month: 'short' });
      list.push({
        key,
        label: `${bnLabel} (${enMonth})${i === 0 ? ' • চলতি মাস' : ''}`
      });
    }
    return list;
  }, []);

  const availableMonthKeys = useMemo(() => {
    return monthOptions.map(m => m.key).filter(k => k !== 'ALL');
  }, [monthOptions]);

  // Month arrow navigation handlers
  const handlePrevMonth = () => {
    let target = selectedMonth;
    if (!target || target === 'ALL') target = getRunningMonthKey();
    const idx = availableMonthKeys.indexOf(target);
    if (idx !== -1 && idx < availableMonthKeys.length - 1) {
      setSelectedMonth(availableMonthKeys[idx + 1]);
    } else {
      const [y, m] = target.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  };

  const handleNextMonth = () => {
    let target = selectedMonth;
    if (!target || target === 'ALL') target = getRunningMonthKey();
    const idx = availableMonthKeys.indexOf(target);
    if (idx > 0) {
      setSelectedMonth(availableMonthKeys[idx - 1]);
    } else {
      const [y, m] = target.split('-').map(Number);
      const d = new Date(y, m, 1);
      setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
  };

  const formatMonthOnlyUpper = (monthKey: string): string => {
    if (monthKey === 'ALL') return 'ALL MONTHS';
    const parts = monthKey.split('-');
    if (parts.length === 2) {
      const monIdx = parseInt(parts[1], 10) - 1;
      const months = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
      if (monIdx >= 0 && monIdx < 12) {
        return `${months[monIdx]} ${parts[0]}`;
      }
    }
    return monthKey;
  };

  // Helper to parse date into ISO, Bengali display and English display
  const parseDateComponents = (val: any) => {
    const bnDigits: Record<string, string> = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    const monthAbbrs = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const bnMonthShort = [
      'জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্ট', 'অক্টো', 'নভে', 'ডিসে'
    ];
    let str = String(val || '').trim().replace(/[০-৯]/g, (ch) => bnDigits[ch] || ch);

    // Check DD/MM/YYYY or DD-MM-YYYY
    const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (dmy) {
      const d = dmy[1].padStart(2, '0');
      const m = dmy[2].padStart(2, '0');
      let y = dmy[3];
      if (y.length === 2) y = `20${y}`;
      const monIdx = parseInt(m, 10) - 1;
      const monName = monIdx >= 0 && monIdx < 12 ? monthAbbrs[monIdx] : m;
      const monBn = monIdx >= 0 && monIdx < 12 ? bnMonthShort[monIdx] : toBengaliNum(m);
      const dayBnNoZero = toBengaliNum(parseInt(d, 10));
      return {
        iso: `${y}-${m}-${d}`,
        displayBn: `${dayBnNoZero} ${monBn}`,
        displayEn: `${d} ${monName}`
      };
    }

    // Check YYYY-MM-DD
    const ymd = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymd) {
      const y = ymd[1];
      const m = ymd[2].padStart(2, '0');
      const d = ymd[3].padStart(2, '0');
      const monIdx = parseInt(m, 10) - 1;
      const monName = monIdx >= 0 && monIdx < 12 ? monthAbbrs[monIdx] : m;
      const monBn = monIdx >= 0 && monIdx < 12 ? bnMonthShort[monIdx] : toBengaliNum(m);
      const dayBnNoZero = toBengaliNum(parseInt(d, 10));
      return {
        iso: `${y}-${m}-${d}`,
        displayBn: `${dayBnNoZero} ${monBn}`,
        displayEn: `${d} ${monName}`
      };
    }

    const dObj = new Date(/^[0-9]{10,13}$/.test(str) ? Number(str) : str);
    if (!isNaN(dObj.getTime())) {
      const y = String(dObj.getFullYear());
      const m = String(dObj.getMonth() + 1).padStart(2, '0');
      const d = String(dObj.getDate()).padStart(2, '0');
      const monIdx = dObj.getMonth();
      const monName = monthAbbrs[monIdx];
      const monBn = bnMonthShort[monIdx] || toBengaliNum(m);
      const dayBnNoZero = toBengaliNum(parseInt(d, 10));
      return {
        iso: `${y}-${m}-${d}`,
        displayBn: `${dayBnNoZero} ${monBn}`,
        displayEn: `${d} ${monName}`
      };
    }

    return {
      iso: '2026-10-01',
      displayBn: '১ অক্টো',
      displayEn: '01 Oct'
    };
  };

  // Filtered by Month
  const filteredRecords = useMemo(() => {
    return shopRecords.filter((rec) => {
      if (selectedMonth !== 'ALL') {
        const mKey = rec.monthKey || getExpenseMonthKey(rec.date);
        if (mKey !== selectedMonth) return false;
      }
      return true;
    });
  }, [shopRecords, selectedMonth]);

  // Helper to ensure Bengali description and eliminate English text and redundant month text
  const cleanItemDescBn = (rawDesc: string, isInit: boolean, _mKey?: string): string => {
    let text = String(rawDesc || '').trim();
    if (isInit) {
      if (text.includes('অতিরিক্ত') || /additional/i.test(text)) {
        return 'অতিরিক্ত বকেয়া';
      }
      return 'প্রারম্ভিক বকেয়া';
    }

    if (!text) {
      return 'পণ্য ক্রয়';
    }

    // Strip out month references if appended inside item description (e.g. "(অক্টোবর ২০২৬)")
    text = text
      .replace(/\s*\([^\)]*?(?:জানুয়ারি|ফেব্রুয়ারি|মার্চ|এপ্রিল|মে|জুন|জুলাই|আগস্ট|সেপ্টেম্বর|অক্টোবর|নভেম্বর|ডিসেম্বর|january|february|march|april|may|june|july|august|september|october|november|december|\d{4})[^\)]*?\)/gi, '')
      .replace(/initial\s*due/gi, 'প্রারম্ভিক বকেয়া')
      .replace(/additional\s*due/gi, 'অতিরিক্ত বকেয়া')
      .replace(/previous\s*due/gi, 'পূর্বের বকেয়া')
      .replace(/shop-init/gi, '')
      .replace(/init-due/gi, '')
      .trim();

    return text || 'পণ্য ক্রয়';
  };

  // Date-wise rows calculation for Dt wise view (with continuous date merge)
  const statementDateWiseRows = useMemo(() => {
    const dateMap = new Map<string, {
      displayDateBn: string;
      items: Array<{
        id: string;
        desc: string;
        qty: number;
        unit: string;
        rate: number;
        total: number;
        isDue: boolean;
        isInitialDue: boolean;
        detailedPerson?: string;
        originalRecord: ExpenseRecord;
      }>;
    }>();

    // Sort records chronological by date (1st to 31st of the month)
    const sorted = [...filteredRecords].sort((a, b) => {
      const timeA = new Date(parseDateComponents(a.date).iso).getTime() || 0;
      const timeB = new Date(parseDateComponents(b.date).iso).getTime() || 0;
      return timeA - timeB;
    });

    sorted.forEach((rec) => {
      const dateInfo = parseDateComponents(rec.date);
      if (!dateMap.has(dateInfo.iso)) {
        dateMap.set(dateInfo.iso, {
          displayDateBn: dateInfo.displayBn,
          items: []
        });
      }
      const entry = dateMap.get(dateInfo.iso)!;
      const amt = Number(rec.amount) || 0;
      const isInit = isInitialDueRecord(rec);
      const q = isInit ? 0 : (Number(rec.qty) || 1);
      const r = isInit ? 0 : (Number(rec.unitPrice || rec.rate) || (q > 0 ? Math.round(amt / q) : amt));
      const isDue = String(rec.paymentMethod || '').trim().toLowerCase() === 'due';
      const cleanedDesc = cleanItemDescBn(rec.desc, isInit, rec.monthKey || selectedMonth);

      entry.items.push({
        id: rec.id,
        desc: cleanedDesc,
        qty: q,
        unit: isInit ? '' : (rec.unit || ''),
        rate: r,
        total: amt,
        isDue,
        isInitialDue: isInit,
        detailedPerson: rec.detailedPerson,
        originalRecord: rec
      });
    });

    const rows: Array<{
      dateKey: string;
      displayDateBn: string;
      itemsText: string;
      qty: number;
      unit: string;
      rate: number;
      total: number;
      isDue: boolean;
      isInitialDue: boolean;
      detailedPerson?: string;
      isFirstOfDate: boolean;
      dateRowSpan: number;
      originalRecord: ExpenseRecord;
    }> = [];

    const sortedDates = Array.from(dateMap.keys()).sort();

    sortedDates.forEach((isoKey) => {
      const entry = dateMap.get(isoKey)!;
      const count = entry.items.length;

      entry.items.forEach((item, idx) => {
        rows.push({
          dateKey: isoKey,
          displayDateBn: idx === 0 ? entry.displayDateBn : '',
          itemsText: item.desc,
          qty: item.qty,
          unit: item.unit,
          rate: item.rate,
          total: item.total,
          isDue: item.isDue,
          isInitialDue: item.isInitialDue,
          detailedPerson: item.detailedPerson,
          isFirstOfDate: idx === 0,
          dateRowSpan: idx === 0 ? count : 0,
          originalRecord: item.originalRecord
        });
      });
    });

    return rows;
  }, [filteredRecords]);

  // Summary figures
  const totalBilled = useMemo(() => {
    return filteredRecords.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [filteredRecords]);

  const totalDue = useMemo(() => {
    return filteredRecords
      .filter((r) => String(r.paymentMethod || '').trim().toLowerCase() === 'due')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  }, [filteredRecords]);

  const totalPaid = totalBilled - totalDue;

  // Export to Excel
  const handleExportExcel = () => {
    try {
      const excelRows = statementDateWiseRows.map((r, i) => {
        return {
          'SL': i + 1,
          'Date': r.dateKey,
          'Item Description': r.itemsText,
          'Quantity': r.isInitialDue ? '-' : `${r.qty} ${r.unit}`,
          'Unit Price': r.isInitialDue ? '-' : r.rate,
          'Total Amount': r.total,
          'Status': r.isDue ? 'DUE (বকেয়া)' : 'PAID (পরিশোধিত)'
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Shop Statement');
      XLSX.writeFile(wb, `Shop_Statement_${shopName}_${selectedMonth}.xlsx`);
    } catch (err) {
      console.error('Error exporting Excel:', err);
    }
  };

  // Capture high-res picture of the paper slip
  const handleDownloadStatementPic = async () => {
    const slipEl = document.getElementById('shop-statement-paper-slip');
    if (!slipEl) return;
    setIsCapturingPic(true);
    try {
      const canvas = await html2canvas(slipEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false
      });
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Statement_${shopName}_${selectedMonth}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      console.error('Error generating picture:', err);
    } finally {
      setIsCapturingPic(false);
    }
  };

  const getShopDisplayNameBn = (shop: string): string => {
    if (!shop || shop === 'ALL') return 'সকল দোকান';
    return getShopDisplayNameBnConfig(shop);
  };

  const getShopEmoji = (shop: string): string => {
    if (!shop || shop === 'ALL') return '🏪';
    return getShopEmojiConfig(shop);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex flex-col gap-3">
              {/* Row 1: Shop Info (Left) + Prominent Close 'X' Button (Right) */}
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
                    {getShopEmoji(shopName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <h2 className="text-base sm:text-lg font-black text-white truncate leading-tight">
                        {getShopDisplayNameBn(shopName)}
                      </h2>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black border border-indigo-500/30 shrink-0">
                        STATEMENT
                      </span>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 font-mono truncate mt-0.5">
                      মাসিক হিসাব বিবরণী • {selectedMonth === 'ALL' ? 'সকল লেনদেন' : formatBengaliMonthYear(selectedMonth)}
                    </p>
                  </div>
                </div>

                {/* Top-Right Back / Close 'X' Button */}
                <button 
                  type="button"
                  onClick={onClose} 
                  className="w-10 h-10 rounded-2xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700/80 hover:border-rose-500/40 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-md active:scale-90"
                  title="বন্ধ করুন (Close)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Row 2: Action Buttons (Only Print option as requested) */}
              <div className="flex items-center gap-2 overflow-x-auto w-full pt-0.5 scrollbar-none">
                {/* Print */}
                <button 
                  type="button"
                  onClick={() => window.print()} 
                  className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-indigo-500/20 active:translate-y-0.5 whitespace-nowrap cursor-pointer"
                  title="প্রিন্ট করুন"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>প্রিন্ট</span>
                </button>
              </div>
            </div>

            {/* Modal Month Filter Bar (Dt wise only, no Item wise, no duplicate year) */}
            <div className="px-5 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
                <Receipt className="w-4 h-4 text-indigo-400" />
                <span>তারিখ ভিত্তিক হিসাব বিবরণী (Date-wise Statement)</span>
              </div>

              {/* Month Selector with Left/Right Arrows (Single year display) */}
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-xl p-1 shadow-inner">
                {/* Left Arrow Button */}
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer border border-slate-700/60 shadow-sm active:scale-95"
                  title="Previous Month (পূর্ববর্তী মাস)"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                </button>

                {/* Month Display (e.g. "OCTOBER 2026") */}
                <div className="px-3 py-0.5 text-center select-none flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-black uppercase font-mono tracking-wider text-white">
                    {selectedMonth === 'ALL' ? 'ALL MONTHS' : formatMonthOnlyUpper(selectedMonth)}
                  </span>
                </div>

                {/* Right Arrow Button */}
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-8 h-8 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer border border-slate-700/60 shadow-sm active:scale-95"
                  title="Next Month (পরবর্তী মাস)"
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Statement Content Area - Authentic paper slip presentation in SutonnyMJ font */}
            <div className="p-3 sm:p-6 pb-12 overflow-y-auto overflow-x-auto bg-slate-950/70 flex-1 print:p-0 print:bg-white print:overflow-visible">
              <div 
                id="shop-statement-paper-slip" 
                style={{ fontFamily: "'SutonnyMJ', 'SuttonyMJ', 'SutonnyOMJ', 'Sutonny MJ', 'Noto Serif Bengali', 'Tiro Bangla', 'SolaimanLipi', serif" }}
                className="bg-white rounded-2xl p-6 sm:p-8 pb-8 sm:pb-10 text-black w-full max-w-xl mx-auto shadow-2xl border border-slate-200/90 print:border-none print:shadow-none print:rounded-none my-2 sm:my-4 transition-all sutonny-font font-bangla"
              >
                
                {/* Header Banner: Shop Name and মাসঃ অক্টোবর ২০২৬ */}
                <div className="text-center mb-5">
                  <div className="flex items-center justify-center space-x-2 text-2xl sm:text-3xl font-black text-black tracking-tight">
                    <span>{getShopEmoji(shopName)}</span>
                    <span>{getShopDisplayNameBn(shopName)}</span>
                    <span>{getShopEmoji(shopName)}</span>
                  </div>
                  <p className="text-base sm:text-lg font-black text-black mt-1">
                    মাসঃ {selectedMonth === 'ALL' ? 'সকল মাস' : formatBengaliMonthYear(selectedMonth)}
                  </p>
                  <div className="w-full h-1 bg-black mt-3"></div>
                </div>

                {/* Statement Items Table - Directly starts with Heading Row: তারিখ, বিবরণ, পরিমাণ, দর, মোট */}
                <table className="w-full border-collapse border-2 border-black text-sm sm:text-base font-bold text-black bg-white m-0">
                  <thead>
                    <tr className="bg-white text-center font-black">
                      <th className="border border-black py-3 px-2 text-center font-black w-[18%] bg-white text-xs sm:text-base">তারিখ</th>
                      <th className="border border-black p-3 text-center font-black w-[42%] bg-white text-xs sm:text-base">বিবরণ</th>
                      <th className="border border-black py-3 px-1 text-center font-black w-[12%] bg-white text-xs sm:text-base">পরিমাণ</th>
                      <th className="border border-black py-3 px-1 text-center font-black w-[13%] bg-white text-xs sm:text-base">দর</th>
                      <th className="border border-black py-3 px-2 text-center font-black w-[15%] bg-white text-xs sm:text-base">মোট</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statementDateWiseRows.length > 0 ? (
                      statementDateWiseRows.map((row, idx) => (
                        <tr key={idx} className="bg-white">
                          {/* পর পর ২ বা ততোধিক সেলে একই তারিখ হলে cell merge করে একটি তারিখ দেখাবে */}
                          {row.isFirstOfDate && (
                            <td
                              rowSpan={row.dateRowSpan}
                              className="border border-black py-2.5 px-1.5 text-center font-black bg-white whitespace-nowrap text-xs sm:text-sm align-middle"
                            >
                              <div>{row.displayDateBn}</div>
                            </td>
                          )}

                          {/* বিবরণ, পরিমাণ ও দর: Initial Due হলে বিবরণ, পরিমাণ ও দর সেল একসাথে মার্জ হবে (colSpan={3}) */}
                          {(row.isInitialDue || (!row.qty && !row.rate)) ? (
                            <td 
                              colSpan={3} 
                              className="border border-black p-3 text-left font-bold bg-white whitespace-pre-line leading-relaxed text-xs sm:text-sm"
                            >
                              <div>{row.itemsText}</div>
                            </td>
                          ) : (
                            <>
                              {/* বিবরণ */}
                              <td className="border border-black p-3 text-left font-bold bg-white whitespace-pre-line leading-relaxed text-xs sm:text-sm">
                                <div>{row.itemsText}</div>
                                {row.detailedPerson && row.detailedPerson !== 'Civ Tanvir' && (
                                  <div className="text-[11px] text-slate-600 font-normal">
                                    ({row.detailedPerson})
                                  </div>
                                )}
                              </td>

                              {/* পরিমাণ */}
                              <td className="border border-black py-2.5 px-1 text-center font-bold bg-white text-xs sm:text-sm">
                                {row.qty > 0 ? `${toBengaliNum(row.qty)} ${row.unit || ''}`.trim() : '-'}
                              </td>

                              {/* দর */}
                              <td className="border border-black py-2.5 px-1 text-center font-bold bg-white text-xs sm:text-sm">
                                {row.rate > 0 ? `৳${toBengaliNum(row.rate)}` : '-'}
                              </td>
                            </>
                          )}

                          {/* মোট */}
                          <td className="border border-black py-2.5 px-1.5 text-center font-bold bg-white text-xs sm:text-sm">
                            ৳{toBengaliNum(row.total)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="bg-white">
                        <td colSpan={5} className="border border-black p-4 text-center font-bold text-slate-800 bg-white tracking-wide text-sm sm:text-base">
                          এই মাসে কোনো হিসাবের তথ্য নেই
                        </td>
                      </tr>
                    )}

                    {/* Summary Rows */}
                    {totalBilled > 0 && (
                      <tr className="bg-white">
                        <td className="border border-black p-3 text-right font-black bg-white" colSpan={4}>
                          মোট ক্রয় / বিল
                        </td>
                        <td className="border border-black p-3 text-center font-black bg-white">
                          ৳{toBengaliNum(totalBilled)}
                        </td>
                      </tr>
                    )}

                    {totalPaid > 0 && (
                      <tr className="bg-white">
                        <td className="border border-black p-3 text-right font-black bg-white text-emerald-700" colSpan={4}>
                          পরিশোধিত বিল
                        </td>
                        <td className="border border-black p-3 text-center font-black bg-white text-emerald-700">
                          ৳{toBengaliNum(totalPaid)}
                        </td>
                      </tr>
                    )}

                    <tr className="bg-white">
                      <td className="border border-black p-3 text-right font-black bg-white" colSpan={4}>
                        সর্বমোট প্রদেয় বকেয়া
                      </td>
                      <td className={`border border-black p-3 text-center font-black text-base sm:text-lg ${totalDue > 0 ? 'text-[#e11d48]' : 'text-emerald-600'} bg-white`}>
                        ৳{toBengaliNum(totalDue)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Actions Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-bold">
                <span>মোট এন্ট্রি: {statementDateWiseRows.length} টি</span>
                <span>•</span>
                <span className={totalDue > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  বকেয়া: ৳{totalDue.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                >
                  বন্ধ করুন (Close)
                </button>
              </div>
            </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

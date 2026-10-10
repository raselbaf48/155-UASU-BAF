import React, { useState, useMemo } from 'react';
import { 
  X, 
  FileText, 
  Calendar, 
  Search, 
  Download, 
  Printer, 
  ShoppingCart, 
  Layers, 
  Utensils, 
  Store, 
  Banknote, 
  Check, 
  AlertCircle,
  Filter,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { DueShopName, ExpenseRecord, resolveExpenseDueShop } from '../pages/DueRegister';
import { getRunningMonthKey } from '../pages/MemberDB';
import { formatBengaliMonthYear, toBengaliNum } from '../utils/exportCanteenBillExcel';
import { formatCanteenDate } from '../utils/dateUtils';
import { getExpenseMonthKey } from './SetShopInitialDueModal';

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
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'DATE' | 'ITEM'>('DATE');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE' | 'PAID'>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Read all expenses from localStorage
  const allExpenses: ExpenseRecord[] = useMemo(() => {
    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [isOpen]);

  // Filter records by Shop
  const shopRecords = useMemo(() => {
    return allExpenses.filter((e) => {
      const eShop = resolveExpenseDueShop(e);
      if (shopName !== 'ALL' && eShop !== shopName) return false;
      return true;
    });
  }, [allExpenses, shopName]);

  // Month options list for dropdown
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
        label: `${bnLabel} (${enMonth} ${d.getFullYear()})${i === 0 ? ' • চলতি মাস' : ''}`
      });
    }
    return list;
  }, []);

  // Filtered by Month, Status, and Search
  const filteredRecords = useMemo(() => {
    return shopRecords.filter((rec) => {
      // Month filter
      if (selectedMonth !== 'ALL') {
        const mKey = rec.monthKey || getExpenseMonthKey(rec.date);
        if (mKey !== selectedMonth) return false;
      }

      // Status filter
      const isDue = String(rec.paymentMethod || '').trim().toLowerCase() === 'due';
      if (statusFilter === 'DUE' && !isDue) return false;
      if (statusFilter === 'PAID' && isDue) return false;

      // Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const desc = String(rec.desc || '').toLowerCase();
        const person = String(rec.detailedPerson || '').toLowerCase();
        const date = String(rec.date || '').toLowerCase();
        const subdesc = String(rec.subdesc || '').toLowerCase();
        const sName = resolveExpenseDueShop(rec).toLowerCase();
        if (!desc.includes(term) && !person.includes(term) && !date.includes(term) && !subdesc.includes(term) && !sName.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [shopRecords, selectedMonth, statusFilter, searchTerm]);

  // Sort chronological (newest first for date view)
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      const parseD = (s: string) => {
        const parts = String(s).split(/[-/.]/);
        if (parts.length === 3) {
          return parts[0].length === 4 
            ? new Date(`${parts[0]}-${parts[1]}-${parts[2]}`).getTime() 
            : new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
        }
        return 0;
      };
      return parseD(b.date) - parseD(a.date);
    });
  }, [filteredRecords]);

  // Aggregate items for ITEM view
  const aggregatedItems = useMemo(() => {
    const map = new Map<string, {
      itemName: string;
      unit: string;
      totalQty: number;
      totalAmount: number;
      dueAmount: number;
      paidAmount: number;
      entriesCount: number;
    }>();

    filteredRecords.forEach((rec) => {
      const name = String(rec.desc || 'অন্যান্য').trim();
      const isDue = String(rec.paymentMethod || '').trim().toLowerCase() === 'due';
      const amt = Number(rec.amount) || 0;
      const qty = Number(rec.qty) || 0;
      const unit = rec.unit || 'kg';

      const existing = map.get(name);
      if (existing) {
        existing.totalQty += qty;
        existing.totalAmount += amt;
        if (isDue) {
          existing.dueAmount += amt;
        } else {
          existing.paidAmount += amt;
        }
        existing.entriesCount += 1;
      } else {
        map.set(name, {
          itemName: name,
          unit,
          totalQty: qty,
          totalAmount: amt,
          dueAmount: isDue ? amt : 0,
          paidAmount: isDue ? 0 : amt,
          entriesCount: 1
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalAmount - a.totalAmount);
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
      const excelRows = sortedRecords.map((r, i) => {
        const isDue = String(r.paymentMethod || '').trim().toLowerCase() === 'due';
        return {
          'SL': i + 1,
          'Date': r.date,
          'Shop': resolveExpenseDueShop(r),
          'Item Description': r.desc,
          'Qty': r.qty || '',
          'Unit': r.unit || '',
          'Unit Price': r.unitPrice || '',
          'Amount (৳)': r.amount,
          'Status': isDue ? 'DUE (বকেয়া)' : `PAID (${r.paymentMethod || 'Cash'})`,
          'Person': r.detailedPerson || 'Civ Tanvir',
          'Settled Date': r.settledDate || '',
          'Note': r.subdesc || ''
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      const sheetName = shopName === 'ALL' ? 'All_Shops_Statement' : shopName.replace(/\s+/g, '_');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      XLSX.writeFile(wb, `Statement_${sheetName}_${selectedMonth}.xlsx`);
    } catch (err: any) {
      alert(`Excel export failed: ${err?.message || 'Error'}`);
    }
  };

  // Browser Print
  const handlePrint = () => {
    window.print();
  };

  const getShopIcon = () => {
    if (shopName === 'Grocessary Shop') return <ShoppingCart className="w-5 h-5 text-emerald-400" />;
    if (shopName === 'Poultry Shop') return <Layers className="w-5 h-5 text-amber-400" />;
    if (shopName === 'Bake & Bite') return <Utensils className="w-5 h-5 text-purple-400" />;
    return <Store className="w-5 h-5 text-indigo-400" />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[120] flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl p-5 sm:p-7 space-y-5 my-auto text-slate-200 max-h-[94vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
                  {getShopIcon()}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">
                      {shopName === 'ALL' ? 'ALL SHOPS' : shopName} • হিসাব বিবরণী
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-black border border-indigo-500/30">
                      STATEMENT
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    বকেয়া ও পরিশোধের বিস্তারিত খতিয়ান • {selectedMonth === 'ALL' ? 'সকল লেনদেন' : formatBengaliMonthYear(selectedMonth)}
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

            {/* Filter & Controls Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800 shrink-0">
              {/* Month Selector */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  মাস (MONTH)
                </label>
                <div className="relative">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    {monthOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  স্ট্যাটাস (STATUS)
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="ALL">সব স্ট্যাটাস (ALL)</option>
                  <option value="DUE">শুধু বকেয়া (ONLY DUE)</option>
                  <option value="PAID">পরিশোধিত (SETTLED / PAID)</option>
                </select>
              </div>

              {/* Search Box */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  অনুসন্ধান (SEARCH)
                </label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="পণ্য বা মেমো খুঁজুন..."
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>
              </div>

              {/* View Mode Switcher */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  ভিউ মোড (VIEW MODE)
                </label>
                <div className="grid grid-cols-2 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-700/80">
                  <button
                    type="button"
                    onClick={() => setViewMode('DATE')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-black uppercase transition-all ${
                      viewMode === 'DATE'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    তারিখ ভিত্তিক
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('ITEM')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-black uppercase transition-all ${
                      viewMode === 'ITEM'
                        ? 'bg-indigo-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    পণ্য ভিত্তিক
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">
                  মোট ক্রয় / খরচ (TOTAL BILLED)
                </span>
                <p className="text-xl font-black font-mono text-white">
                  ৳{totalBilled.toLocaleString('en-US')}
                </p>
                <span className="text-[10px] text-slate-500 font-bold">
                  {filteredRecords.length} টি রেকর্ড
                </span>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-2xl">
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block mb-0.5">
                  পরিশোধিত বিল (TOTAL PAID)
                </span>
                <p className="text-xl font-black font-mono text-emerald-400">
                  ৳{totalPaid.toLocaleString('en-US')}
                </p>
                <span className="text-[10px] text-emerald-500/80 font-bold">
                  পরিশোধ সম্পন্ন
                </span>
              </div>

              <div className="bg-slate-950/80 border border-rose-900/40 p-3.5 rounded-2xl">
                <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-0.5">
                  অবশিষ্ট বকেয়া (CURRENT NET DUE)
                </span>
                <p className="text-xl font-black font-mono text-rose-400">
                  ৳{totalDue.toLocaleString('en-US')}
                </p>
                <span className="text-[10px] text-rose-400/80 font-bold">
                  পাওনা বকেয়া
                </span>
              </div>
            </div>

            {/* Table Area (Scrollable) */}
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/50 min-h-[220px]">
              {viewMode === 'DATE' ? (
                /* Date-wise Table */
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 z-10">
                    <tr>
                      <th className="py-3 px-3.5 text-center w-10">#</th>
                      <th className="py-3 px-3.5">তারিখ (Date)</th>
                      {shopName === 'ALL' && <th className="py-3 px-3.5">দোকান (Shop)</th>}
                      <th className="py-3 px-3.5">পণ্যের বিবরণ (Description)</th>
                      <th className="py-3 px-3.5 text-center">পরিমাণ</th>
                      <th className="py-3 px-3.5 text-center">দর</th>
                      <th className="py-3 px-3.5 text-right">মোট টাকা</th>
                      <th className="py-3 px-3.5 text-center">গ্রহীতা</th>
                      <th className="py-3 px-3.5 text-center">স্ট্যাটাস</th>
                      <th className="py-3 px-3.5 text-center">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                    {sortedRecords.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500 font-bold">
                          কোনো হিসাবের তথ্য পাওয়া যায়নি।
                        </td>
                      </tr>
                    ) : (
                      sortedRecords.map((rec, idx) => {
                        const isDue = String(rec.paymentMethod || '').trim().toLowerCase() === 'due';
                        const recShop = resolveExpenseDueShop(rec);
                        return (
                          <tr key={rec.id || idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3.5 text-center text-slate-500 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3.5 font-mono text-[11px] whitespace-nowrap text-slate-300">
                              {formatCanteenDate(rec.date)}
                            </td>
                            {shopName === 'ALL' && (
                              <td className="py-2.5 px-3.5 whitespace-nowrap text-[11px] font-bold text-amber-300">
                                {recShop}
                              </td>
                            )}
                            <td className="py-2.5 px-3.5 font-bold text-white">
                              <div>{rec.desc}</div>
                              {rec.subdesc && (
                                <div className="text-[10px] text-slate-400 font-normal truncate max-w-xs">
                                  {rec.subdesc}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-center font-mono">
                              {rec.qty ? `${rec.qty} ${rec.unit || 'kg'}` : '-'}
                            </td>
                            <td className="py-2.5 px-3.5 text-center font-mono text-slate-300">
                              {rec.unitPrice ? `৳${rec.unitPrice}` : '-'}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-black font-mono text-amber-400 whitespace-nowrap">
                              ৳{Number(rec.amount).toLocaleString('en-US')}
                            </td>
                            <td className="py-2.5 px-3.5 text-center text-[10px] font-bold text-emerald-400 whitespace-nowrap">
                              {rec.detailedPerson || 'Civ Tanvir'}
                            </td>
                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                              {isDue ? (
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-black">
                                  বকেয়া (Due)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-black">
                                  পরিশোধিত ✓
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                              {isDue ? (
                                <button
                                  type="button"
                                  onClick={() => onSettleIndividualExpense(rec)}
                                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-lg text-[10px] font-black uppercase transition-all border border-emerald-500/30 cursor-pointer"
                                  title="Pay / Settle this specific item"
                                >
                                  পরিশোধ
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-mono">Paid</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                /* Item-wise Table */
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-950 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 z-10">
                    <tr>
                      <th className="py-3 px-3.5 text-center w-10">#</th>
                      <th className="py-3 px-3.5">পণ্যের নাম (Item Name)</th>
                      <th className="py-3 px-3.5 text-center">এন্ট্রি সংখ্যা</th>
                      <th className="py-3 px-3.5 text-center">মোট পরিমাণ</th>
                      <th className="py-3 px-3.5 text-right">মোট ক্রয়মূল্য</th>
                      <th className="py-3 px-3.5 text-right">পরিশোধিত</th>
                      <th className="py-3 px-3.5 text-right">অবশিষ্ট বকেয়া</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium text-slate-300">
                    {aggregatedItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 font-bold">
                          কোনো পণ্যের বিবরণ পাওয়া যায়নি।
                        </td>
                      </tr>
                    ) : (
                      aggregatedItems.map((item, idx) => (
                        <tr key={item.itemName} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 px-3.5 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3.5 font-black text-white">
                            {item.itemName}
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono text-slate-400">
                            {item.entriesCount} বার
                          </td>
                          <td className="py-2.5 px-3.5 text-center font-mono font-bold text-slate-200">
                            {item.totalQty > 0 ? `${item.totalQty} ${item.unit}` : '-'}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-black font-mono text-white">
                            ৳{item.totalAmount.toLocaleString('en-US')}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono text-emerald-400 font-bold">
                            ৳{item.paidAmount.toLocaleString('en-US')}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-black font-mono text-rose-400">
                            ৳{item.dueAmount.toLocaleString('en-US')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Bottom Actions Footer */}
            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-emerald-500/30 flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Excel</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-700 flex items-center space-x-1.5 cursor-pointer shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Print Slip</span>
                </button>
              </div>

              <div className="flex items-center space-x-2">
                {shopName !== 'ALL' && totalDue > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenPayBill(shopName);
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-600/30 cursor-pointer flex items-center space-x-1.5"
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Pay Full Due (৳{totalDue.toLocaleString()})</span>
                  </button>
                )}

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

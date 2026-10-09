import React, { useState, useMemo, useEffect } from 'react';
import { 
  History, 
  Search, 
  X, 
  Pencil, 
  Trash2, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Clock, 
  Filter 
} from 'lucide-react';
import { DateNavigator, getTodayYMD } from './DateNavigator';
import { supabase } from '../../../supabase';
import { pushKeyToCloud, recordDeletedTxId, getDeletedTxIds } from '../utils/canteenCloudSync';
import { getTxCategory, getTxMonthKey } from '../pages/MemberDB';
import { EditFundTxModal } from '../pages/FundBatchBillPage';

interface FundHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: 'ALL' | 'UNIT_FUND' | 'OTHERS';
  allTxs: any[];
  members: any[];
  onRemoveTx?: (tx: any) => Promise<void> | void;
  onSuccess?: () => void;
  getMemberBanglaName?: (m: any) => string;
  getMemberBanglaRank?: (m: any) => string;
  formatRankBn?: (r: string) => string;
  formatMemberNameBn?: (n: string) => string;
}

const DEFAULT_PURPOSE_PRESETS = ['বাজার', 'ফরম-৭৯৩', 'অন্য ক্যান্টিন বিল'];

const formatMonthDisplay = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') return 'All Months';
  const parts = String(monthKey).split('-');
  if (parts.length < 2) return monthKey;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const name = monthNames[month - 1] || parts[1];
  const yy = String(year).slice(-2);
  return `${name}-${yy}`;
};

export const FundHistoryModal: React.FC<FundHistoryModalProps> = ({
  isOpen,
  onClose,
  initialCategory = 'ALL',
  allTxs = [],
  members = [],
  onRemoveTx,
  onSuccess,
  getMemberBanglaName,
  getMemberBanglaRank,
  formatRankBn,
  formatMemberNameBn,
}) => {
  // Category filter state
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'UNIT_FUND' | 'OTHERS'>(initialCategory);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Date filter state (default ALL so users immediately see all transactions)
  const [dateFilter, setDateFilter] = useState<string>('');
  
  // Month filter state
  const [monthFilter, setMonthFilter] = useState<string>('ALL');

  // Deletion and Editing State
  const [txToDelete, setTxToDelete] = useState<any | null>(null);
  const [txToEdit, setTxToEdit] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [deletedTxIds, setDeletedTxIds] = useState<Set<string>>(() => new Set(getDeletedTxIds()));

  // Sync category filter when initialCategory changes
  useEffect(() => {
    if (initialCategory) {
      setCategoryFilter(initialCategory);
    }
  }, [initialCategory]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !txToDelete && !txToEdit) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, txToDelete, txToEdit, onClose]);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Available months list computed from transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    (allTxs || []).forEach((tx) => {
      const cat = getTxCategory(tx);
      if (cat === 'UNIT_FUND' || cat === 'OTHERS') {
        const m = tx.monthKey || getTxMonthKey(tx);
        if (m && m.length === 7) set.add(m);
      }
    });
    return Array.from(set).sort().reverse();
  }, [allTxs]);

  // All Fund Transactions (Unit Fund & Others) excluding deleted
  const fundTransactions = useMemo(() => {
    return (allTxs || [])
      .filter((tx) => {
        if (deletedTxIds.has(String(tx.id))) return false;
        const cat = getTxCategory(tx);
        if (cat !== 'UNIT_FUND' && cat !== 'OTHERS') return false;
        if (categoryFilter !== 'ALL' && cat !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.date || a.created_at || 0).getTime() || a.timestamp || 0;
        const timeB = new Date(b.date || b.created_at || 0).getTime() || b.timestamp || 0;
        return timeB - timeA;
      });
  }, [allTxs, categoryFilter, deletedTxIds]);

  // Filtered transactions by Search, Date, and Month
  const filteredTransactions = useMemo(() => {
    let list = fundTransactions;

    // Filter by Date
    if (dateFilter) {
      list = list.filter((tx) => {
        const txDateStr = String(tx.date || tx.created_at || '').trim();
        if (txDateStr.startsWith(dateFilter)) return true;
        // Compare ISO parts
        try {
          const d = new Date(txDateStr);
          if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}` === dateFilter;
          }
        } catch {}
        return false;
      });
    }

    // Filter by Month
    if (monthFilter && monthFilter !== 'ALL') {
      list = list.filter((tx) => {
        const m = tx.monthKey || getTxMonthKey(tx);
        return m === monthFilter;
      });
    }

    // Filter by Search Query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter((tx) => {
        const name = String(tx.memberName || tx.name || '').toLowerCase();
        const bd = String(tx.bdNo || tx.airman_id || '').toLowerCase();
        const items = String(tx.items || tx.note || tx.purpose || '').toLowerCase();
        const date = String(tx.date || tx.monthKey || '').toLowerCase();
        const method = String(tx.paymentMethod || tx.method || tx.source || '').toLowerCase();
        return (
          name.includes(q) ||
          bd.includes(q) ||
          items.includes(q) ||
          date.includes(q) ||
          method.includes(q)
        );
      });
    }

    return list;
  }, [fundTransactions, dateFilter, monthFilter, searchTerm]);

  // Grand Total Calculation
  const grandTotal = useMemo(() => {
    return filteredTransactions.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [filteredTransactions]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (availableMonths.length === 0) return;
    if (monthFilter === 'ALL') {
      setMonthFilter(availableMonths[0]);
      return;
    }
    const idx = availableMonths.indexOf(monthFilter);
    if (idx < availableMonths.length - 1 && idx !== -1) {
      setMonthFilter(availableMonths[idx + 1]);
    }
  };

  const handleNextMonth = () => {
    if (availableMonths.length === 0) return;
    if (monthFilter === 'ALL') return;
    const idx = availableMonths.indexOf(monthFilter);
    if (idx > 0) {
      setMonthFilter(availableMonths[idx - 1]);
    } else if (idx === 0) {
      setMonthFilter('ALL');
    }
  };

  // Edit handler
  const handleSaveEditTx = async (updatedData: {
    amount: number;
    date: string;
    items: string;
    note?: string;
    monthKey: string;
  }) => {
    if (!txToEdit) return;
    setIsSavingEdit(true);

    try {
      const txIdStr = String(txToEdit.id);
      const oldAmount = Number(txToEdit.amount || 0);
      const newAmount = Number(updatedData.amount || 0);
      const amountDiff = newAmount - oldAmount;

      const existingTxs = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
        } catch {
          return [];
        }
      })();

      const updatedTxs = existingTxs.map((t: any) => {
        if (String(t.id) === txIdStr) {
          return {
            ...t,
            amount: newAmount,
            date: updatedData.date,
            items: updatedData.items,
            note: updatedData.note || '',
            monthKey: updatedData.monthKey,
            updatedAt: new Date().toISOString()
          };
        }
        return t;
      });

      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
      await pushKeyToCloud('canteen_txs', updatedTxs);

      if (amountDiff !== 0) {
        const targetMember = members.find((m: any) => {
          if (!m) return false;
          if (txToEdit.airman_id && m.airman_id === txToEdit.airman_id) return true;
          const txBd = String(txToEdit.bdNo || txToEdit['BD No'] || '').trim();
          const mBd = String(m['BD No'] || m.bdNo || '').trim();
          if (txBd && mBd && txBd.toLowerCase() === mBd.toLowerCase()) return true;
          const txBdClean = txBd.replace(/\D/g, '');
          const mBdClean = mBd.replace(/\D/g, '');
          if (txBdClean && mBdClean && txBdClean === mBdClean) return true;
          return false;
        });

        if (targetMember) {
          const currentDue = Number(targetMember.Due ?? targetMember.due ?? targetMember.baki ?? 0);
          const newDue = Math.max(0, currentDue + amountDiff);

          try {
            if (targetMember.airman_id) {
              await supabase
                .from('Canteen_Member')
                .update({ Due: newDue })
                .eq('airman_id', targetMember.airman_id);
            }
            if (targetMember['BD No']) {
              await supabase
                .from('Canteen_Member')
                .update({ Due: newDue })
                .eq('BD No', String(targetMember['BD No']).trim());
            }
          } catch (e) {
            console.warn('Supabase member due update on tx edit:', e);
          }

          targetMember.Due = newDue;
          targetMember.due = newDue;
          targetMember.baki = newDue;

          const cleanBd = String(targetMember['BD No'] || targetMember.airman_id || '').replace(/\D/g, '').toLowerCase();
          if (cleanBd) {
            try {
              const rawStored = localStorage.getItem(`canteen_member_${cleanBd}`);
              const stored = rawStored ? JSON.parse(rawStored) : {};
              localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({ ...stored, Due: newDue, due: newDue, baki: newDue }));
            } catch {}
          }
        }
      }

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast('Transaction updated successfully!');
      setTxToEdit(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Edit transaction error:', err);
      showToast(`Failed to update transaction: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete handler
  const confirmDeleteTx = async () => {
    if (!txToDelete) return;
    const tx = txToDelete;
    const txIdStr = String(tx.id);
    setIsDeleting(true);

    try {
      recordDeletedTxId(txIdStr);
      setDeletedTxIds((prev) => new Set(prev).add(txIdStr));

      const existingTxs = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
        } catch {
          return [];
        }
      })();
      const filtered = existingTxs.filter((t: any) => String(t.id) !== txIdStr);
      localStorage.setItem('canteen_txs', JSON.stringify(filtered));
      await pushKeyToCloud('canteen_txs', filtered);

      if (onRemoveTx) {
        try {
          await onRemoveTx(tx);
        } catch (e) {
          console.warn('onRemoveTx error in FundHistoryModal:', e);
        }
      }

      const targetMember = members.find((m: any) => {
        if (!m) return false;
        if (tx.airman_id && m.airman_id === tx.airman_id) return true;
        const txBd = String(tx.bdNo || tx['BD No'] || '').trim();
        const mBd = String(m['BD No'] || m.bdNo || '').trim();
        if (txBd && mBd && txBd.toLowerCase() === mBd.toLowerCase()) return true;
        const txBdClean = txBd.replace(/\D/g, '');
        const mBdClean = mBd.replace(/\D/g, '');
        if (txBdClean && mBdClean && txBdClean === mBdClean) return true;
        return false;
      });

      if (targetMember) {
        const amountToReverse = Number(tx.amount || 0);
        const currentDue = Number(targetMember.Due ?? targetMember.due ?? targetMember.baki ?? 0);
        const newDue = Math.max(0, currentDue - amountToReverse);

        try {
          if (targetMember.airman_id) {
            await supabase
              .from('Canteen_Member')
              .update({ Due: newDue })
              .eq('airman_id', targetMember.airman_id);
          }
          if (targetMember['BD No']) {
            await supabase
              .from('Canteen_Member')
              .update({ Due: newDue })
              .eq('BD No', String(targetMember['BD No']).trim());
          }
        } catch (e) {
          console.warn('Supabase member due update on delete:', e);
        }

        targetMember.Due = newDue;
        targetMember.due = newDue;
        targetMember.baki = newDue;

        const cleanBd = String(targetMember['BD No'] || targetMember.airman_id || '').replace(/\D/g, '').toLowerCase();
        if (cleanBd) {
          try {
            const rawStored = localStorage.getItem(`canteen_member_${cleanBd}`);
            const stored = rawStored ? JSON.parse(rawStored) : {};
            localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({ ...stored, Due: newDue, due: newDue, baki: newDue }));
          } catch {}
        }
      }

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast('Transaction record deleted successfully');
      setTxToDelete(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-sm font-bold border transition-all ${
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

      {/* Main Dedicated History Modal (Alada Page / Modal Overlay) */}
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-[2rem] w-full max-w-5xl shadow-2xl flex flex-col h-[88vh] min-h-[580px] max-h-[94vh] overflow-hidden animate-in zoom-in-95">
          
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/95 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 text-indigo-400 rounded-2xl shadow-inner">
                  <History className="w-5 h-5 text-indigo-300" />
                </div>
                <div>
                  <div className="flex items-center space-x-2.5">
                    <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider">
                      {categoryFilter === 'UNIT_FUND' 
                        ? 'UNIT FUND HISTORY' 
                        : categoryFilter === 'OTHERS' 
                          ? 'OTHERS BILL HISTORY' 
                          : 'UNIT FUND & OTHERS BILL HISTORY'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-xs font-black border border-indigo-500/30">
                      {filteredTransactions.length}
                    </span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                    Audited transaction history & billing ledger • Edit & delete incorrect entries anytime
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-slate-700/80 active:scale-95"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Navigation Strip */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
              
              {/* Category Pills (All, Unit Fund, Others) */}
              <div className="inline-flex p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    categoryFilter === 'ALL'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All Funds
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('UNIT_FUND')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    categoryFilter === 'UNIT_FUND'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Unit Fund
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryFilter('OTHERS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    categoryFilter === 'OTHERS'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Others
                </button>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by member name, BD No, purpose, note..."
                  className="w-full pl-9 pr-8 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs font-semibold text-white placeholder:text-slate-500 outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Date Navigator & Month Navigator with 3D Arrow Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
              <div className="flex flex-wrap items-center gap-2">
                {/* Date Navigator with 3D Left/Right arrows & format */}
                <DateNavigator
                  value={dateFilter}
                  onChange={setDateFilter}
                  allowAll={true}
                  format="dd_mm_yy"
                />

                {/* Month Navigator with 3D Left/Right arrows */}
                <div className="inline-flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5 shadow-xs shrink-0 h-8 min-h-[32px]">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                    title="Previous month"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                  </button>

                  <div className="relative px-2.5 py-0.5 text-center flex items-center space-x-1.5 cursor-pointer group">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0 pointer-events-none" />
                    <span className="text-xs font-mono font-bold text-white tracking-tight pointer-events-none">
                      {formatMonthDisplay(monthFilter)}
                    </span>
                    <select
                      value={monthFilter}
                      onChange={(e) => setMonthFilter(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      title="Select month"
                    >
                      <option value="ALL" className="bg-slate-900 text-white">All Months</option>
                      {availableMonths.map((m) => (
                        <option key={m} value={m} className="bg-slate-900 text-white">
                          {formatMonthDisplay(m)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                    title="Next month"
                  >
                    <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                  </button>
                </div>
              </div>

              {/* Reset filter button if any active */}
              {(dateFilter || monthFilter !== 'ALL' || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter('');
                    setMonthFilter('ALL');
                    setSearchTerm('');
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer border border-slate-700/80"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Table Body with Stable Height Box (Does not shrink on 0 records) */}
          <div className="p-3 sm:p-5 overflow-y-auto flex-1 flex flex-col min-h-[360px]">
            {filteredTransactions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-16 text-slate-400 bg-slate-950/40 rounded-2xl border border-slate-800/80 p-6 min-h-[300px]">
                <Clock className="w-12 h-12 mx-auto opacity-20 mb-3 text-indigo-400" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-300">
                  No Transaction Records Found
                </p>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                  {searchTerm || dateFilter || monthFilter !== 'ALL'
                    ? 'No fund records match your date or search filter. Try clearing filters.'
                    : 'Billed Unit Fund and Others Bill entries will appear here.'}
                </p>
                {(dateFilter || monthFilter !== 'ALL' || searchTerm) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDateFilter('');
                      setMonthFilter('ALL');
                      setSearchTerm('');
                    }}
                    className="mt-4 px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white text-xs font-bold transition-all cursor-pointer border border-indigo-500/40"
                  >
                    Reset Date & Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60 shadow-inner flex-1 min-h-[300px]">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-900/95 text-slate-400 font-mono text-[10px] uppercase tracking-wider border-b border-slate-800 sticky top-0 z-10">
                      <th className="py-3 px-3 font-black text-center w-12">Ser</th>
                      <th className="py-3 px-3 font-black text-center w-28">Date</th>
                      <th className="py-3 px-3 font-black min-w-[160px]">Member Name</th>
                      <th className="py-3 px-3 font-black text-center w-24">Category</th>
                      <th className="py-3 px-3 font-black min-w-[180px]">Purpose / Description</th>
                      <th className="py-3 px-3 font-black text-center w-28">Payment Method</th>
                      <th className="py-3 px-3 font-black text-right w-24">Amount</th>
                      <th className="py-3 px-3 font-black text-center w-20">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70 font-medium">
                    {filteredTransactions.map((tx, idx) => {
                      const txCat = getTxCategory(tx);
                      const isUnit = txCat === 'UNIT_FUND';
                      const txMethod = tx.paymentMethod || tx.method || (tx.staffName ? `Cash (${tx.staffName})` : 'Cash');
                      
                      const memberObj = members.find((m) => {
                        if (tx.airman_id && m.airman_id === tx.airman_id) return true;
                        const tBd = String(tx.bdNo || tx['BD No'] || '').trim();
                        const mBd = String(m['BD No'] || m.bdNo || '').trim();
                        return tBd && mBd && tBd.toLowerCase() === mBd.toLowerCase();
                      });

                      const displayName = memberObj
                        ? (getMemberBanglaName ? getMemberBanglaName(memberObj) : (memberObj.name_bangla || memberObj.Surname || tx.memberName))
                        : (tx.memberName || tx.name || `BD/${tx.bdNo}`);

                      const displayRank = memberObj
                        ? (formatRankBn ? formatRankBn(memberObj.Rank || '') : memberObj.Rank || '')
                        : (tx.rank || '');

                      return (
                        <tr key={tx.id || idx} className="hover:bg-slate-850/60 transition-colors">
                          <td className="py-3 px-3 text-center font-mono text-slate-500 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-slate-300">
                            {tx.date || tx.created_at?.split('T')[0] || '-'}
                            {tx.monthKey && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                                {formatMonthDisplay(tx.monthKey)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-1.5">
                              {displayRank && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold">
                                  {displayRank}
                                </span>
                              )}
                              <span className="font-bold text-white">
                                {displayName}
                              </span>
                              {(tx.bdNo || memberObj?.['BD No']) && (
                                <span className="text-[10px] font-mono text-indigo-300/80">
                                  #{tx.bdNo || memberObj?.['BD No']}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              isUnit 
                                ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40' 
                                : 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40'
                            }`}>
                              {isUnit ? 'Unit Fund' : 'Others'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-200">
                                {tx.items || tx.purpose || (isUnit ? 'Unit Fund Subscription' : 'Others Bill')}
                              </span>
                              {tx.note && (
                                <span className="text-[10px] text-slate-400 italic">
                                  {tx.note}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
                              {txMethod}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                            ৳{Number(tx.amount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <button
                                type="button"
                                onClick={() => setTxToEdit(tx)}
                                className="p-1.5 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-colors cursor-pointer"
                                title="Edit this transaction record"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setTxToDelete(tx)}
                                className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                                title="Delete this transaction record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer Summary Bar */}
          <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs font-mono font-bold text-slate-400 shrink-0">
            <div className="flex items-center space-x-4">
              <span>Total Records: <strong className="text-white">{filteredTransactions.length}</strong></span>
              <span>Grand Total: <strong className="text-emerald-400 text-sm">৳{grandTotal.toLocaleString()}</strong></span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-slate-700 active:scale-95"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {txToEdit && (
        <EditFundTxModal
          isOpen={Boolean(txToEdit)}
          onClose={() => setTxToEdit(null)}
          tx={txToEdit}
          onSave={handleSaveEditTx}
          isSaving={isSavingEdit}
          purposePresets={DEFAULT_PURPOSE_PRESETS}
        />
      )}

      {/* Delete Transaction Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-base font-black text-white">Delete Transaction?</h4>
              <p className="text-xs text-slate-400">
                Are you sure you want to delete this bill of <strong className="text-white font-mono">৳{Number(txToDelete.amount || 0).toLocaleString()}</strong> for <strong>{txToDelete.memberName || txToDelete.name || `BD/${txToDelete.bdNo}`}</strong>?
              </p>
              <p className="text-[11px] text-amber-400/90 font-medium">
                Member's due will be automatically reversed.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTxToDelete(null)}
                className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteTx}
                disabled={isDeleting}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

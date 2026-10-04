import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Save, 
  Calendar, 
  CalendarDays, 
  Receipt, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Coins, 
  Layers, 
  ArrowRight,
  Sparkles,
  RefreshCw,
  Sliders,
  FileSpreadsheet,
  Search,
  Check
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { pushKeyToCloud } from '../utils/canteenCloudSync';
import { getTxMonthKey } from '../pages/MemberDB';
import { sortCanteenMembersByOfficeSeniority } from '../utils/canteenSeniority';

interface BatchMonthBillSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: any[];
  allTxs: any[];
  onSuccess: (updatedMembers: any[]) => void;
}

interface MemberSplitRow {
  member: any;
  cleanBd: string;
  airmanId: string;
  name: string;
  rank: string;
  totalDue: number;
  augAmount: number;
  sepAmount: number;
}

export const BatchMonthBillSplitModal: React.FC<BatchMonthBillSplitModalProps> = ({
  isOpen,
  onClose,
  members,
  allTxs,
  onSuccess
}) => {
  if (!isOpen) return null;

  // Filter members with Due > 0 or existing initial bills
  const dueMembers = useMemo(() => {
    const sorted = sortCanteenMembersByOfficeSeniority(members);
    return sorted.filter((m: any) => {
      const d = Number(m.Due ?? m.due ?? m.baki ?? 0);
      return d > 0;
    });
  }, [members]);

  const [rows, setRows] = useState<MemberSplitRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Initialize rows from current transactions or split logic
  useEffect(() => {
    const initialRows: MemberSplitRow[] = dueMembers.map((m) => {
      const cleanBd = String(m['BD No'] || m.bdNo || m.airman_id || '').replace(/\D/g, '');
      const airmanId = m.airman_id || (cleanBd ? `airman-${cleanBd}` : '');
      const name = `${m['Rank'] || m.rank || ''} ${m['Surname'] || m.surname || ''}`.trim() || `BD-${cleanBd}`;
      const totalDue = Number(m.Due ?? m.due ?? m.baki ?? 0);

      // Check existing transactions
      let aug = 0;
      let sep = 0;

      allTxs.forEach((tx: any) => {
        if (!tx || tx.type === 'BILL PAYMENT') return;
        const txBd = String(tx.bdNo || tx.airman_id || '').replace(/\D/g, '');
        const txAirman = String(tx.airman_id || '').toLowerCase();
        const matches = (cleanBd && txBd && (cleanBd === txBd || cleanBd.replace(/^0+/, '') === txBd.replace(/^0+/, ''))) ||
          (airmanId && txAirman && airmanId.toLowerCase() === txAirman);

        if (matches) {
          const mKey = tx.monthKey || getTxMonthKey(tx.date);
          const amt = Number(tx.amount || 0);
          if (mKey === '2026-08') aug += amt;
          else if (mKey === '2026-09') sep += amt;
        }
      });

      // Default if everything was currently lumped into September or not split
      if (aug === 0 && sep === 0 && totalDue > 0) {
        // If not yet split, default to 50% Aug and 50% Sep or keep as is
        const half1 = Math.round((totalDue / 2) * 100) / 100;
        const half2 = Math.round((totalDue - half1) * 100) / 100;
        aug = half1;
        sep = half2;
      } else if (aug === 0 && sep > 0 && sep === totalDue) {
        // If currently all in Sep (due to auto-reconcile), offer 50/50 split as starter
        const half1 = Math.round((totalDue / 2) * 100) / 100;
        const half2 = Math.round((totalDue - half1) * 100) / 100;
        aug = half1;
        sep = half2;
      }

      return {
        member: m,
        cleanBd,
        airmanId,
        name,
        rank: m['Rank'] || m.rank || '',
        totalDue,
        augAmount: aug,
        sepAmount: sep
      };
    });

    setRows(initialRows);
  }, [dueMembers, allTxs]);

  const handleRowAugChange = (cleanBd: string, val: string) => {
    const num = parseFloat(val) || 0;
    setRows(prev => prev.map(r => {
      if (r.cleanBd === cleanBd) {
        return { ...r, augAmount: num };
      }
      return r;
    }));
  };

  const handleRowSepChange = (cleanBd: string, val: string) => {
    const num = parseFloat(val) || 0;
    setRows(prev => prev.map(r => {
      if (r.cleanBd === cleanBd) {
        return { ...r, sepAmount: num };
      }
      return r;
    }));
  };

  // Bulk Quick Helpers
  const handleBulkSplit5050 = () => {
    setRows(prev => prev.map(r => {
      const half1 = Math.round((r.totalDue / 2) * 100) / 100;
      const half2 = Math.round((r.totalDue - half1) * 100) / 100;
      return { ...r, augAmount: half1, sepAmount: half2 };
    }));
  };

  const handleBulkAllAug = () => {
    setRows(prev => prev.map(r => ({ ...r, augAmount: r.totalDue, sepAmount: 0 })));
  };

  const handleBulkAllSep = () => {
    setRows(prev => prev.map(r => ({ ...r, augAmount: 0, sepAmount: r.totalDue })));
  };

  // Filtered rows by search
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const q = searchTerm.toLowerCase().trim();
    return rows.filter(r => 
      r.cleanBd.includes(q) || 
      r.name.toLowerCase().includes(q) ||
      r.rank.toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  // Overall totals
  const totalDueSum = rows.reduce((s, r) => s + r.totalDue, 0);
  const totalAugSum = rows.reduce((s, r) => s + r.augAmount, 0);
  const totalSepSum = rows.reduce((s, r) => s + r.sepAmount, 0);

  const handleSaveAll = async () => {
    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Generate new transactions for all rows
      const newMonthTxs: any[] = [];
      const updatedMembersMap = new Map<string, any>();

      rows.forEach(r => {
        const m = r.member;
        const finalDue = r.augAmount + r.sepAmount;
        const updatedM = {
          ...m,
          Due: finalDue,
          due: finalDue,
          baki: finalDue
        };
        updatedMembersMap.set(m.airman_id || r.cleanBd, updatedM);

        if (r.augAmount > 0) {
          newMonthTxs.push({
            id: `tx-init-${r.cleanBd}-2026-08`,
            date: '28 Aug 26',
            monthKey: '2026-08',
            airman_id: m.airman_id || (r.cleanBd ? `airman-${r.cleanBd}` : undefined),
            bdNo: m['BD No'] || m.bdNo || (r.cleanBd ? `BD/${r.cleanBd}` : ''),
            memberName: r.name,
            rank: r.rank,
            items: 'বকেয়া বিল (আগস্ট ২০২৬)',
            soldItems: [],
            amount: r.augAmount,
            type: 'INITIAL_BILL',
            gateway: 'DUE',
            billType: 'CANTEEN'
          });
        }

        if (r.sepAmount > 0) {
          newMonthTxs.push({
            id: `tx-init-${r.cleanBd}-2026-09`,
            date: '28 Sep 26',
            monthKey: '2026-09',
            airman_id: m.airman_id || (r.cleanBd ? `airman-${r.cleanBd}` : undefined),
            bdNo: m['BD No'] || m.bdNo || (r.cleanBd ? `BD/${r.cleanBd}` : ''),
            memberName: r.name,
            rank: r.rank,
            items: 'ক্যান্টিন বিল (সেপ্টেম্বর ২০২৬)',
            soldItems: [],
            amount: r.sepAmount,
            type: 'INITIAL_BILL',
            gateway: 'DUE',
            billType: 'CANTEEN'
          });
        }
      });

      // 2. Remove old INITIAL_BILL transactions for affected members
      const affectedCleanBds = new Set(rows.map(r => r.cleanBd));
      const affectedAirmanIds = new Set(rows.map(r => r.airmanId.toLowerCase()));

      let currentTxs: any[] = [];
      try {
        currentTxs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      } catch {}
      if (allTxs && allTxs.length > currentTxs.length) {
        currentTxs = allTxs;
      }

      const keptTxs = currentTxs.filter((tx: any) => {
        if (!tx) return false;
        const txBd = String(tx.bdNo || tx.airman_id || '').replace(/\D/g, '');
        const txAirman = String(tx.airman_id || '').toLowerCase();
        const isAffected = (txBd && affectedCleanBds.has(txBd)) || (txAirman && affectedAirmanIds.has(txAirman));

        if (!isAffected) return true;
        // Keep payments and actual POS item sales if any
        if (tx.type === 'BILL PAYMENT') return true;
        if (tx.type === 'SALE' && Array.isArray(tx.soldItems) && tx.soldItems.length > 0) return true;
        // Remove old initial/imported bills
        return false;
      });

      const finalAllTxs = [...newMonthTxs, ...keptTxs];

      // 3. Save to Supabase Canteen_Member in chunks of 15
      const memberListToUpdate = Array.from(updatedMembersMap.values());
      for (let i = 0; i < memberListToUpdate.length; i += 15) {
        const chunk = memberListToUpdate.slice(i, i + 15);
        await Promise.all(
          chunk.map(m => {
            return supabase
              .from('Canteen_Member')
              .update({ Due: m.Due })
              .eq('airman_id', m.airman_id);
          })
        );
      }

      // 4. Save canteen_txs to Cloud and LocalStorage
      localStorage.setItem('canteen_txs', JSON.stringify(finalAllTxs));
      await pushKeyToCloud('canteen_txs', finalAllTxs);

      // 5. Update local members cache
      const updatedFullMembers = members.map(m => {
        const up = updatedMembersMap.get(m.airman_id) || updatedMembersMap.get(String(m['BD No'] || '').replace(/\D/g, ''));
        return up || m;
      });
      localStorage.setItem('canteen_members_cache', JSON.stringify(updatedFullMembers));

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      setSuccessMsg('সকল সদস্যের আগস্ট ও সেপ্টেম্বর বিল ক্লাউডে সফলভাবে সংরক্ষিত হয়েছে!');
      setTimeout(() => {
        onSuccess(updatedFullMembers);
        onClose();
      }, 1200);

    } catch (err: any) {
      setErrorMsg(`সংরক্ষণ করতে সমস্যা হয়েছে: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>একত্রে সকল সদস্যের আগস্ট ও সেপ্টেম্বর বিল বণ্টন</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                  {rows.length} জন সদস্য
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                আগস্ট ও সেপ্টেম্বর বিলের পরিমাণ আলাদা করে দিলে প্রোফাইল ও প্রতি মাসের হিসাবে সঠিক বকেয়া দৃশ্যমান হবে
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Fast Action Buttons */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="সদস্য বা বিডি নং খুঁজুন..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 mr-1">কুইক অ্যাকশন:</span>
            <button
              type="button"
              onClick={handleBulkSplit5050}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>সবার ৫০% আগস্ট + ৫০% সেপ্টেম্বর</span>
            </button>
            <button
              type="button"
              onClick={handleBulkAllAug}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-blue-300 text-xs font-bold border border-slate-700 transition-colors"
            >
              সব আগস্টে
            </button>
            <button
              type="button"
              onClick={handleBulkAllSep}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold border border-slate-700 transition-colors"
            >
              সব সেপ্টেম্বরে
            </button>
          </div>
        </div>

        {/* Alert / Toast Messages */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-2 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-2 text-emerald-300 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Spreadsheet Table View */}
        <div className="overflow-x-auto overflow-y-auto flex-1 p-4">
          <table className="w-full text-left text-xs text-slate-300 min-w-[650px]">
            <thead className="bg-slate-950/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-3 py-3 w-12 text-center">SL</th>
                <th className="px-3 py-3 w-28">BD No</th>
                <th className="px-3 py-3">Rank & Surname</th>
                <th className="px-3 py-3 text-right">Current Due</th>
                <th className="px-3 py-3 w-40 text-center bg-blue-950/20 text-blue-300">
                  August 2026 Due (৳)
                </th>
                <th className="px-3 py-3 w-40 text-center bg-emerald-950/20 text-emerald-300">
                  September 2026 Due (৳)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredRows.map((r, idx) => {
                const rowTotal = r.augAmount + r.sepAmount;
                const matchesOriginal = Math.abs(rowTotal - r.totalDue) < 0.01;

                return (
                  <tr key={r.cleanBd} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-3 py-2 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-2 font-mono font-bold text-white">BD/{r.cleanBd}</td>
                    <td className="px-3 py-2 font-bold text-slate-200">{r.name}</td>
                    <td className="px-3 py-2 text-right font-mono font-black text-rose-400">
                      ৳{r.totalDue}
                    </td>
                    <td className="px-3 py-2 bg-blue-950/10">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">৳</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={r.augAmount === 0 ? '' : r.augAmount}
                          onChange={(e) => handleRowAugChange(r.cleanBd, e.target.value)}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-blue-500/40 rounded-lg pl-6 pr-2 py-1.5 text-white font-mono font-bold text-xs focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 bg-emerald-950/10">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs">৳</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={r.sepAmount === 0 ? '' : r.sepAmount}
                          onChange={(e) => handleRowSepChange(r.cleanBd, e.target.value)}
                          placeholder="0"
                          className="w-full bg-slate-950 border border-emerald-500/40 rounded-lg pl-6 pr-2 py-1.5 text-white font-mono font-bold text-xs focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Summary & Action Bar */}
        <div className="p-4 bg-slate-950/90 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-bold uppercase">বর্তমান মোট বকেয়া:</span>
              <span className="font-mono font-black text-white text-sm">৳{totalDueSum}</span>
            </div>
            <div>
              <span className="text-blue-400 block text-[10px] font-bold uppercase">মোট আগস্ট বিল:</span>
              <span className="font-mono font-black text-blue-300 text-sm">৳{totalAugSum}</span>
            </div>
            <div>
              <span className="text-emerald-400 block text-[10px] font-bold uppercase">মোট সেপ্টেম্বর বিল:</span>
              <span className="font-mono font-black text-emerald-300 text-sm">৳{totalSepSum}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              বন্ধ করুন (Close)
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAll}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-2 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>এক ক্লিকে ক্লাউডে সেভ করুন</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

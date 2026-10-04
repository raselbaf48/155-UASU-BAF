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
  Sliders
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { pushKeyToCloud } from '../utils/canteenCloudSync';
import { getTxMonthKey } from '../pages/MemberDB';
import { resolveImageUrl } from '../utils/canteenSettings';
import { formatBengaliMonthYear } from '../utils/exportCanteenBillExcel';

interface MonthBillSplitModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: any;
  allTxs: any[];
  onSuccess: (updatedMember: any, newTxs: any[]) => void;
}

export const MonthBillSplitModal: React.FC<MonthBillSplitModalProps> = ({
  isOpen,
  onClose,
  member,
  allTxs,
  onSuccess
}) => {
  if (!isOpen || !member) return null;

  const cleanBd = String(member['BD No'] || member.bdNo || member.airman_id || '').replace(/\D/g, '');
  const airmanId = member.airman_id || (cleanBd ? `airman-${cleanBd}` : '');
  const memberName = `${member['Rank'] || member.rank || ''} ${member['Surname'] || member.surname || ''}`.trim() || `BD-${cleanBd}`;
  const currentTotalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);

  // Find existing transactions for this member
  const memberTxs = useMemo(() => {
    return allTxs.filter((tx: any) => {
      if (!tx) return false;
      const txBd = String(tx.bdNo || tx.airman_id || '').replace(/\D/g, '');
      const txAirman = String(tx.airman_id || '').toLowerCase();
      return (cleanBd && txBd && (cleanBd === txBd || cleanBd.replace(/^0+/, '') === txBd.replace(/^0+/, ''))) ||
        (airmanId && txAirman && airmanId.toLowerCase() === txAirman);
    });
  }, [allTxs, cleanBd, airmanId]);

  // Existing payments made by this member
  const totalPaymentsMade = useMemo(() => {
    return memberTxs
      .filter((t: any) => t.type === 'BILL PAYMENT')
      .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
  }, [memberTxs]);

  // Extract current amounts recorded for Aug, Sep, Oct
  const initialAmounts = useMemo(() => {
    let aug = 0;
    let sep = 0;
    let oct = 0;

    memberTxs.forEach((tx: any) => {
      if (tx.type === 'BILL PAYMENT') return;
      const mKey = tx.monthKey || getTxMonthKey(tx.date);
      const amt = Number(tx.amount || 0);
      if (mKey === '2026-08') {
        aug += amt;
      } else if (mKey === '2026-09') {
        sep += amt;
      } else if (mKey === '2026-10') {
        oct += amt;
      }
    });

    // If nothing specifically recorded for Aug or Sep, but there's a total due
    if (aug === 0 && sep === 0 && oct === 0 && currentTotalDue > 0) {
      // Check if there was an unsplit or lumped due
      sep = currentTotalDue;
    }

    return { aug, sep, oct };
  }, [memberTxs, currentTotalDue]);

  const [augBill, setAugBill] = useState<string>(initialAmounts.aug > 0 ? String(initialAmounts.aug) : '');
  const [sepBill, setSepBill] = useState<string>(initialAmounts.sep > 0 ? String(initialAmounts.sep) : '');
  const [octBill, setOctBill] = useState<string>(initialAmounts.oct > 0 ? String(initialAmounts.oct) : '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setAugBill(initialAmounts.aug > 0 ? String(initialAmounts.aug) : '');
    setSepBill(initialAmounts.sep > 0 ? String(initialAmounts.sep) : '');
    setOctBill(initialAmounts.oct > 0 ? String(initialAmounts.oct) : '');
    setErrorMsg(null);
  }, [initialAmounts]);

  const numAug = parseFloat(augBill) || 0;
  const numSep = parseFloat(sepBill) || 0;
  const numOct = parseFloat(octBill) || 0;

  const totalAllocated = numAug + numSep + numOct;
  const calculatedNetDue = Math.max(0, totalAllocated - totalPaymentsMade);

  // Quick Split Helpers
  const handleSplit5050 = () => {
    const half1 = Math.round((currentTotalDue / 2) * 100) / 100;
    const half2 = Math.round((currentTotalDue - half1) * 100) / 100;
    setAugBill(String(half1));
    setSepBill(String(half2));
    setOctBill('');
  };

  const handleAllAug = () => {
    setAugBill(String(currentTotalDue));
    setSepBill('');
    setOctBill('');
  };

  const handleAllSep = () => {
    setAugBill('');
    setSepBill(String(currentTotalDue));
    setOctBill('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAug < 0 || numSep < 0 || numOct < 0) {
      setErrorMsg('বিল পরিমাণ ঋণাত্মক (negative) হতে পারে না।');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);

    try {
      // 1. Prepare new transactions
      const newMonthTxs: any[] = [];

      if (numAug > 0) {
        newMonthTxs.push({
          id: `tx-init-${cleanBd}-2026-08`,
          date: '28 Aug 26',
          monthKey: '2026-08',
          airman_id: member.airman_id || (cleanBd ? `airman-${cleanBd}` : undefined),
          bdNo: member['BD No'] || member.bdNo || (cleanBd ? `BD/${cleanBd}` : ''),
          memberName,
          rank: member['Rank'] || member.rank || '',
          items: 'বকেয়া বিল (আগস্ট ২০২৬)',
          soldItems: [],
          amount: numAug,
          type: 'INITIAL_BILL',
          gateway: 'DUE',
          billType: 'CANTEEN'
        });
      }

      if (numSep > 0) {
        newMonthTxs.push({
          id: `tx-init-${cleanBd}-2026-09`,
          date: '28 Sep 26',
          monthKey: '2026-09',
          airman_id: member.airman_id || (cleanBd ? `airman-${cleanBd}` : undefined),
          bdNo: member['BD No'] || member.bdNo || (cleanBd ? `BD/${cleanBd}` : ''),
          memberName,
          rank: member['Rank'] || member.rank || '',
          items: 'ক্যান্টিন বিল (সেপ্টেম্বর ২০২৬)',
          soldItems: [],
          amount: numSep,
          type: 'INITIAL_BILL',
          gateway: 'DUE',
          billType: 'CANTEEN'
        });
      }

      if (numOct > 0) {
        newMonthTxs.push({
          id: `tx-init-${cleanBd}-2026-10`,
          date: '28 Oct 26',
          monthKey: '2026-10',
          airman_id: member.airman_id || (cleanBd ? `airman-${cleanBd}` : undefined),
          bdNo: member['BD No'] || member.bdNo || (cleanBd ? `BD/${cleanBd}` : ''),
          memberName,
          rank: member['Rank'] || member.rank || '',
          items: 'ক্যান্টিন বিল (অক্টোবর ২০২৬)',
          soldItems: [],
          amount: numOct,
          type: 'INITIAL_BILL',
          gateway: 'DUE',
          billType: 'CANTEEN'
        });
      }

      // 2. Load existing transactions and filter out old initial bills for this member
      let currentStoredTxs: any[] = [];
      try {
        currentStoredTxs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      } catch {}
      if (allTxs && allTxs.length > currentStoredTxs.length) {
        currentStoredTxs = allTxs;
      }

      const otherTxs = currentStoredTxs.filter((tx: any) => {
        if (!tx) return false;
        const txBd = String(tx.bdNo || tx.airman_id || '').replace(/\D/g, '');
        const txAirman = String(tx.airman_id || '').toLowerCase();
        const isThisMember = (cleanBd && txBd && (cleanBd === txBd || cleanBd.replace(/^0+/, '') === txBd.replace(/^0+/, ''))) ||
          (airmanId && txAirman && airmanId.toLowerCase() === txAirman);

        if (!isThisMember) return true;
        // Keep payments and actual POS item sales if any, only replace initial/imported bills
        if (tx.type === 'BILL PAYMENT') return true;
        if (tx.type === 'SALE' && Array.isArray(tx.soldItems) && tx.soldItems.length > 0) return true;
        // Remove old initial/imported bills for this member (like init-auto-due- or old import- txs)
        return false;
      });

      const updatedTxs = [...newMonthTxs, ...otherTxs];

      // 3. Update Supabase Canteen_Member Due
      const finalDue = calculatedNetDue;
      const { error: dbErr } = await supabase
        .from('Canteen_Member')
        .update({ Due: finalDue })
        .eq('airman_id', member.airman_id);

      if (dbErr) {
        await supabase
          .from('Canteen_Member')
          .update({ Due: finalDue })
          .eq('BD No', member['BD No']);
      }

      // 4. Save updated transactions to LocalStorage and Cloud
      try {
        localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
        await pushKeyToCloud('canteen_txs', updatedTxs);
      } catch (err) {
        console.warn('Failed to sync canteen_txs to cloud:', err);
      }

      // 5. Update local member object
      const updatedMember = {
        ...member,
        Due: finalDue,
        due: finalDue,
        baki: finalDue
      };

      try {
        const cached = localStorage.getItem('canteen_members_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          const newCache = parsed.map((m: any) =>
            m.airman_id === member.airman_id || m['BD No'] === member['BD No'] ? updatedMember : m
          );
          localStorage.setItem('canteen_members_cache', JSON.stringify(newCache));
        }
      } catch {}

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      onSuccess(updatedMember, updatedTxs);
      onClose();
    } catch (err: any) {
      setErrorMsg(`সংরক্ষণ করতে সমস্যা হয়েছে: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>মাসভিত্তিক বিল বণ্টন ও সমন্বয়</span>
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                আগস্ট ও সেপ্টেম্বর বিল আলাদাভাবে ট্রানজ্যাকশনে রেকর্ড করুন
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

        {/* Member Details Strip */}
        <div className="p-4 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center font-bold text-white text-sm">
              {member.DP ? (
                <img src={resolveImageUrl(member.DP)} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>{(member['Surname'] || member.surname || 'M').charAt(0)}</span>
              )}
            </div>
            <div>
              <h4 className="text-sm font-black text-white">{memberName}</h4>
              <p className="text-xs text-slate-400 font-mono">BD No: {cleanBd || member['BD No'] || 'N/A'}</p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">বর্তমান মোট বকেয়া</span>
            <span className="text-base font-black font-mono text-rose-400">৳{currentTotalDue}</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Helper Chips */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
              কুইক বণ্টন টুল (Quick Helpers)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSplit5050}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>৫০% আগস্ট + ৫০% সেপ্টেম্বর</span>
              </button>
              <button
                type="button"
                onClick={handleAllAug}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
              >
                সব আগস্টে (All Aug)
              </button>
              <button
                type="button"
                onClick={handleAllSep}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-colors"
              >
                সব সেপ্টেম্বরে (All Sep)
              </button>
            </div>
          </div>

          {/* Inputs Section */}
          <div className="space-y-3 pt-2">
            
            {/* August 2026 */}
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-blue-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>আগস্ট ২০২৬ বিল (August 2026 Due)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Date: 28 Aug 26</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={augBill}
                  onChange={(e) => setAugBill(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* September 2026 */}
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>সেপ্টেম্বর ২০২৬ বিল (September 2026 Bill)</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">Date: 28 Sep 26</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={sepBill}
                  onChange={(e) => setSepBill(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>

            {/* October 2026 (Optional) */}
            <div className="bg-slate-800/40 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400" />
                  <span>অক্টোবর ২০২৬ / চলতি মাসের বিল (October 2026 Bill)</span>
                </label>
                <span className="text-[10px] text-slate-500 font-mono">ঐচ্ছিক (Optional)</span>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">৳</span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={octBill}
                  onChange={(e) => setOctBill(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-4 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-purple-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Real-time Calculation Summary Card */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-400 font-medium">
              <span>মোট বরাদ্দকৃত বিল (Total Assigned):</span>
              <span className="font-mono font-bold text-white">৳{totalAllocated}</span>
            </div>
            {totalPaymentsMade > 0 && (
              <div className="flex items-center justify-between text-emerald-400 font-medium">
                <span>পূর্বে পরিশোধিত টাকা (Recorded Payments):</span>
                <span className="font-mono font-bold">-৳{totalPaymentsMade}</span>
              </div>
            )}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="font-black text-white uppercase tracking-wider">নতুন মোট বকেয়া (New Resulting Due):</span>
              <span className="font-mono text-base font-black text-rose-400">৳{calculatedNetDue}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed italic">
            * সংরক্ষণ করলে আগস্ট এবং সেপ্টেম্বর উভয় মাসের বিল আলাদা সিরিয়াল নম্বর, তারিখ ও বিবরণ সহ প্রোফাইল ট্রানজ্যাকশন হিস্টোরিতে সংরক্ষিত হবে।
          </p>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white font-bold text-xs hover:bg-slate-800 transition-colors"
            >
              বাতিল (Cancel)
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-2 active:scale-95 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>সংরক্ষণ হচ্ছে...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>ক্লাউডে সেভ করুন</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

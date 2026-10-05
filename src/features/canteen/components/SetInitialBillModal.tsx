import React, { useState, useEffect } from 'react';
import { 
  Receipt, 
  X, 
  Check, 
  AlertCircle, 
  Coins, 
  Layers, 
  RefreshCw,
  Calendar
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { pushKeyToCloud } from '../utils/canteenCloudSync';
import { formatCanteenDate } from '../utils/dateUtils';
import { resolveImageUrl } from '../utils/canteenSettings';
import { getFormattedDateForMonth } from '../utils/importHistoryTxs';
import { formatBengaliMonthYear } from '../utils/exportCanteenBillExcel';

interface SetInitialBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: any;
  onSuccess: (updatedMember: any) => void;
}

export const SetInitialBillModal: React.FC<SetInitialBillModalProps> = ({
  isOpen,
  onClose,
  member,
  onSuccess
}) => {
  const currentDue = Number(member?.Due ?? member?.due ?? member?.baki ?? 0);
  const [billAmount, setBillAmount] = useState<string>(currentDue > 0 ? String(currentDue) : '');
  const [billMode, setBillMode] = useState<'SET' | 'ADD'>('SET');
  const [billMonth, setBillMonth] = useState<string>('2026-09');
  const [billNote, setBillNote] = useState<string>('');
  const [createTransaction, setCreateTransaction] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      const due = Number(member?.Due ?? member?.due ?? member?.baki ?? 0);
      setBillAmount(due > 0 ? String(due) : '');
      setBillMode('SET');
      setBillMonth('2026-09');
      setBillNote('');
      setErrorMessage(null);
    }
  }, [member]);

  const memberDp = member?.DP ? resolveImageUrl(member.DP) : '';
  const numAmount = parseFloat(billAmount) || 0;
  const resultingDue = billMode === 'SET' ? numAmount : currentDue + numAmount;

  const handleSaveInitialBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numAmount) || numAmount < 0) {
      setErrorMessage('সঠিক টাকার পরিমাণ লিখুন।');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      // 1. Update Supabase Canteen_Member table
      const { error } = await supabase
        .from('Canteen_Member')
        .update({ Due: resultingDue })
        .eq('airman_id', member.airman_id);

      if (error) {
        console.warn('Failed by airman_id, attempting by BD No:', error);
        await supabase
          .from('Canteen_Member')
          .update({ Due: resultingDue })
          .eq('BD No', member['BD No']);
      }

      // 2. Synchronize transactions in canteen_txs
      const cleanBdNo = String(member['BD No'] || member.bdNo || member.airman_id || '').replace(/\D/g, '');
      const mAirman = String(member.airman_id || '').trim().toLowerCase();
      const txDate = getFormattedDateForMonth(billMonth, 28);
      const defaultLabel = billMonth === '2026-08' 
        ? 'বকেয়া বিল (আগস্ট ২০২৬)' 
        : billMonth === '2026-09' 
        ? 'ক্যান্টিন বিল (সেপ্টেম্বর ২০২৬)' 
        : `বিল (${formatBengaliMonthYear(billMonth)})`;

      const existingTxs = (() => {
        try { return JSON.parse(localStorage.getItem('canteen_txs') || '[]'); } catch { return []; }
      })();

      // Helper to match initial / imported bills belonging to this member
      const isMemberInitialTx = (t: any) => {
        if (!t) return false;
        const isInitType = t.type === 'INITIAL_BILL' || 
          String(t.id || '').startsWith('init-') || 
          String(t.id || '').startsWith('tx-init-') || 
          String(t.id || '').startsWith('tx-import-') ||
          String(t.items || '').includes('ক্যান্টিন বিল') || 
          String(t.items || '').includes('বকেয়া বিল');
        if (!isInitType) return false;
        const tBd = String(t.bdNo || t['BD No'] || t.airman_id || '').replace(/\D/g, '');
        const tAirman = String(t.airman_id || '').trim().toLowerCase();
        if (cleanBdNo && tBd && (cleanBdNo === tBd || cleanBdNo.replace(/^0+/, '') === tBd.replace(/^0+/, ''))) return true;
        if (mAirman && tAirman && mAirman === tAirman) return true;
        return false;
      };

      let updatedTxs: any[] = [];

      if (billMode === 'SET') {
        // In SET mode, remove all prior initial/imported bills for this member across all months
        // so that the new amount does NOT get added to the previous bill
        const remainingTxs = existingTxs.filter((t: any) => !isMemberInitialTx(t));

        if (createTransaction && numAmount > 0) {
          const now = Date.now();
          const newTx = {
            id: `tx-init-${cleanBdNo}-${billMonth}-${now}`,
            created_at: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            timestamp: now,
            date: txDate,
            monthKey: billMonth,
            airman_id: member.airman_id,
            bdNo: member['BD No'] || member.bdNo,
            memberName: `${member['Rank'] || ''} ${member['Surname'] || ''}`.trim(),
            rank: member['Rank'] || member.rank || '',
            items: billNote.trim() || defaultLabel,
            soldItems: [],
            amount: numAmount,
            type: 'INITIAL_BILL',
            gateway: 'DUE',
            billType: 'CANTEEN'
          };
          updatedTxs = [newTx, ...remainingTxs];
        } else {
          // If setting to 0 or unchecked transaction creation, keep remaining transactions without old initial bills
          updatedTxs = remainingTxs;
        }
      } else {
        // In ADD mode, append a new initial bill transaction for the added amount
        if (createTransaction && numAmount > 0) {
          const now = Date.now();
          const newTx = {
            id: `tx-init-${cleanBdNo}-${billMonth}-${now}`,
            created_at: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            timestamp: now,
            date: txDate,
            monthKey: billMonth,
            airman_id: member.airman_id,
            bdNo: member['BD No'] || member.bdNo,
            memberName: `${member['Rank'] || ''} ${member['Surname'] || ''}`.trim(),
            rank: member['Rank'] || member.rank || '',
            items: billNote.trim() || `${defaultLabel} (বকেয়া যোগ)`,
            soldItems: [],
            amount: numAmount,
            type: 'INITIAL_BILL',
            gateway: 'DUE',
            billType: 'CANTEEN'
          };
          updatedTxs = [newTx, ...existingTxs];
        } else {
          updatedTxs = existingTxs;
        }
      }

      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
      await pushKeyToCloud('canteen_txs', updatedTxs);

      // 3. Update local member caches
      const updatedMember = {
        ...member,
        Due: resultingDue,
        due: resultingDue,
        baki: resultingDue
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
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('storage'));

      onSuccess(updatedMember);
      onClose();
    } catch (err: any) {
      setErrorMessage(`সংরক্ষণ করতে সমস্যা হয়েছে: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-[85] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                SET INITIAL BILL
              </h3>
              <p className="text-[11px] text-slate-400 font-bold">
                সদস্যের প্রারম্ভিক বকেয়া বিল নির্ধারণ করুন
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveInitialBill} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl flex items-center space-x-2 text-rose-200 text-xs font-bold">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Member Card Summary */}
          <div className="flex items-center space-x-3 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
              {memberDp ? (
                <img src={memberDp} alt={member['Surname']} className="w-full h-full object-cover" />
              ) : (
                <span className="font-black text-indigo-400 text-base">
                  {(member['Surname'] || 'U').charAt(0)}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-black text-white truncate">
                {member['Rank']} {member['Surname']}
              </h4>
              <p className="text-xs font-mono font-bold text-indigo-400">
                BD No: #{member['BD No']}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                TOTAL DUE
              </span>
              <span className="text-base font-black font-mono text-rose-400">
                ৳{currentDue.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Mode Switcher */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
              হিসাবের ধরন (Action Mode)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setBillMode('SET')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  billMode === 'SET'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                বকেয়া প্রতিস্থাপন (Set Due)
              </button>
              <button
                type="button"
                onClick={() => setBillMode('ADD')}
                className={`py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  billMode === 'ADD'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                বকেয়া যোগ (Add Due)
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">
              {billMode === 'SET' 
                ? '💡 বকেয়া প্রতিস্থাপন: পূর্ববর্তী সব প্রারম্ভিক বকেয়া মুছে নতুন নির্ধারিত পরিমাণ সেট হবে।' 
                : `💡 বকেয়া যোগ: পূর্বের বকেয়া (৳${currentDue.toLocaleString()}) এর সাথে নতুন পরিমাণ যোগ হবে।`}
            </p>
          </div>

          {/* Month Selector */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
              টার্গেট মাস (Bill Month)
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setBillMonth('2026-08')}
                className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  billMonth === '2026-08'
                    ? 'bg-blue-600 text-white shadow-md border border-blue-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                }`}
              >
                আগস্ট ২০২৬
              </button>
              <button
                type="button"
                onClick={() => setBillMonth('2026-09')}
                className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  billMonth === '2026-09'
                    ? 'bg-emerald-600 text-white shadow-md border border-emerald-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                }`}
              >
                সেপ্টেম্বর ২০২৬
              </button>
              <button
                type="button"
                onClick={() => setBillMonth('2026-10')}
                className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  billMonth === '2026-10'
                    ? 'bg-purple-600 text-white shadow-md border border-purple-400'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-750'
                }`}
              >
                অক্টোবর ২০২৬
              </button>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
              প্রারম্ভিক বিলের পরিমাণ (৳)
            </label>
            <input
              type="number"
              step="any"
              required
              min="0"
              placeholder="0.00"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-lg font-black rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Note / Remarks */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
              বিবরণ / নোট
            </label>
            <input
              type="text"
              value={billNote}
              onChange={(e) => setBillNote(e.target.value)}
              placeholder="e.g. পূর্ববর্তী বকেয়া বিল"
              className="w-full bg-slate-950 border border-slate-700 text-white text-xs font-bold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Resulting Due preview */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
            <span className="text-xs font-black text-slate-300">আপডেটের পর মোট বকেয়া:</span>
            <span className="text-xl font-black font-mono text-emerald-400">
              ৳{resultingDue.toLocaleString()}
            </span>
          </div>

          {/* Create transaction checkbox */}
          <label className="flex items-center space-x-2 text-xs font-bold text-slate-300 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={createTransaction}
              onChange={(e) => setCreateTransaction(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-indigo-500 cursor-pointer"
            />
            <span>মাসিক স্টেটমেন্টের জন্য ট্রানজেকশনে সেভ করুন</span>
          </label>

          {/* Buttons */}
          <div className="pt-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Save Bill</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

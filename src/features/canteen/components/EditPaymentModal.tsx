import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Save, Loader2, Calendar, Banknote, CreditCard, Tag, FileText, User } from 'lucide-react';
import { formatBengaliMonthYear, formatRankBn, formatMemberNameBn } from '../utils/exportCanteenBillExcel';
import { resolveImageUrl } from '../utils/canteenSettings';

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any | null;
  availableMonths: string[];
  onSave: (updatedData: any) => Promise<void>;
  isSaving: boolean;
}

export const EditPaymentModal: React.FC<EditPaymentModalProps> = ({
  isOpen,
  onClose,
  payment,
  availableMonths,
  onSave,
  isSaving
}) => {
  if (!isOpen || !payment) return null;

  const targetMember = payment.targetMember;
  const rawRank = payment.rank || targetMember?.Rank || targetMember?.rank || '';
  const rawName = payment.memberName || targetMember?.Surname || targetMember?.surname || 'Member';
  const cleanBd = String(payment.bdNo || targetMember?.['BD No'] || payment.airman_id || '').replace(/\D/g, '');
  const memberDp = targetMember?.DP ? resolveImageUrl(targetMember.DP) : '';

  // Extract initial date in YYYY-MM-DD
  const getInitialYMD = (val: any): string => {
    if (!val) {
      const now = new Date();
      return now.toISOString().split('T')[0];
    }
    // If it's already YYYY-MM-DD
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
      return val.trim();
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return new Date().toISOString().split('T')[0];
  };

  const initialBillMonth = payment.billMonth || payment.monthKey || '2026-09';

  const [amount, setAmount] = useState<string>(String(payment.amount || 0));
  const [billMonth, setBillMonth] = useState<string>(initialBillMonth);
  const [date, setDate] = useState<string>(() => getInitialYMD(payment.date || payment.paymentDate || payment.timestamp));
  const [gateway, setGateway] = useState<'CASH' | 'UCB'>(payment.gateway === 'CASH' ? 'CASH' : 'UCB');
  const [billType, setBillType] = useState<string>(payment.billType || 'ALL');
  const [note, setNote] = useState<string>(payment.items || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (payment) {
      setAmount(String(payment.amount || 0));
      setBillMonth(payment.billMonth || payment.monthKey || '2026-09');
      setDate(getInitialYMD(payment.date || payment.paymentDate || payment.timestamp));
      setGateway(payment.gateway === 'CASH' ? 'CASH' : 'UCB');
      setBillType(payment.billType || 'ALL');
      setNote(payment.items || '');
      setErrorMsg(null);
    }
  }, [payment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('সঠিক টাকার পরিমাণ দিন (দয়া করে ০ থেকে বেশি লিখুন)');
      return;
    }
    if (!billMonth) {
      setErrorMsg('বিলের মাস নির্বাচন করুন');
      return;
    }

    try {
      await onSave({
        ...payment,
        amount: numAmount,
        billMonth,
        date,
        gateway,
        billType,
        items: note.trim()
      });
    } catch (err) {
      setErrorMsg('পেমেন্ট সংরক্ষণ করতে সমস্যা হয়েছে');
    }
  };

  return (
    <div className="fixed inset-0 z-[230] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                Edit Payment Record
              </h3>
              <p className="text-[11px] text-slate-400">
                পেমেন্টের পরিমাণ, বিলের মাস ও বিবরণ পরিবর্তন করুন
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

        {/* Member Profile Badge */}
        <div className="p-4 bg-slate-950/50 border-b border-slate-800 flex items-center space-x-3 shrink-0">
          <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
            {memberDp ? (
              <img
                src={memberDp}
                alt={rawName}
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            ) : (
              <User className="w-5 h-5 text-indigo-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-bold text-white truncate">
                {rawRank} {rawName}
              </span>
              {cleanBd && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/40">
                  BD/{cleanBd}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tx ID: <span className="font-mono text-slate-300">{payment.id || 'N/A'}</span>
            </p>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/50 rounded-xl text-xs font-bold text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* 1. Payment Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>পেমেন্টের পরিমাণ (Amount)</span>
              <span className="text-[10px] text-emerald-400 font-normal">টাকায় (BDT)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-emerald-400 text-base">
                ৳
              </span>
              <input
                type="number"
                step="any"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-base font-mono font-black text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
              />
            </div>
          </div>

          {/* 2. Bill Month Selector (Crucial for fixing October vs September issue) */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>কোন মাসের বিল পরিশোধ? (Billing Month)</span>
              <span className="text-[10px] text-indigo-300 font-normal">মাসের হিসাব সমন্বয়</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
              <select
                value={billMonth}
                onChange={(e) => setBillMonth(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold font-mono text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 cursor-pointer transition-all"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {formatBengaliMonthYear(m)} ({m})
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-amber-300/90 leading-tight">
              * নোট: যদি সেপ্টেম্বর মাসের বিল পরিশোধ করা হয়ে থাকে, তবে এখানে সেপ্টেম্বর মাস নির্বাচন করুন।
            </p>
          </div>

          {/* 3. Payment Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-300">
              টাকা পরিশোধের তারিখ (Payment Date)
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold font-mono text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all cursor-pointer"
            />
          </div>

          {/* 4. Payment Method / Gateway & Category */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300">
                পেমেন্ট মাধ্যম (Gateway)
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setGateway('UCB')}
                  className={`py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                    gateway === 'UCB'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  UCB
                </button>
                <button
                  type="button"
                  onClick={() => setGateway('CASH')}
                  className={`py-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                    gateway === 'CASH'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  CASH
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-slate-300">
                ক্যাটাগরি (Category)
              </label>
              <select
                value={billType}
                onChange={(e) => setBillType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="ALL">ALL (সকল)</option>
                <option value="CANTEEN">CANTEEN (ক্যান্টিন)</option>
                <option value="UNIT_FUND">UNIT FUND (ইউনিট ফান্ড)</option>
                <option value="OTHERS">OTHERS (অন্যান্য)</option>
              </select>
            </div>
          </div>

          {/* 5. Description / Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wider text-slate-300">
              বিবরণ / নোট (Description)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Bill Payment - UCB (সেপ্টেম্বর ২০২৬ বিল)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-900/50 disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
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
      </div>
    </div>
  );
};

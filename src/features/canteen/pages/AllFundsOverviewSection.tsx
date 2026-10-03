import React, { useState, useEffect } from 'react';
import { 
  PieChart, Landmark, CreditCard, Wallet, Building2, Briefcase,
  ArrowRight, TrendingUp, TrendingDown, RefreshCw, Shield, Layers
} from 'lucide-react';

interface AllFundsOverviewProps {
  onSelectFund: (fund: 'CANTEEN' | 'UNIT' | 'OTHERS') => void;
}

export const AllFundsOverviewSection: React.FC<AllFundsOverviewProps> = ({ onSelectFund }) => {
  // Canteen Data
  const [canteenTxs, setCanteenTxs] = useState<any[]>([]);
  const [canteenExpenses, setCanteenExpenses] = useState<any[]>([]);
  const [canteenTransfers, setCanteenTransfers] = useState<any[]>([]);

  // Unit Data
  const [unitInflows, setUnitInflows] = useState<any[]>([]);
  const [unitExpenses, setUnitExpenses] = useState<any[]>([]);
  const [unitTransfers, setUnitTransfers] = useState<any[]>([]);

  // Others Data
  const [othersCats, setOthersCats] = useState<any[]>([]);
  const [othersInflows, setOthersInflows] = useState<any[]>([]);
  const [othersExpenses, setOthersExpenses] = useState<any[]>([]);
  const [othersTransfers, setOthersTransfers] = useState<any[]>([]);

  const loadAllData = () => {
    try {
      setCanteenTxs(JSON.parse(localStorage.getItem('canteen_txs') || '[]'));
      setCanteenExpenses(JSON.parse(localStorage.getItem('canteen_expenses') || '[]'));
      setCanteenTransfers(JSON.parse(localStorage.getItem('canteen_fund_transfers') || '[]'));
    } catch { /* empty */ }

    try {
      setUnitInflows(JSON.parse(localStorage.getItem('baf_unit_fund_inflows') || '[]'));
      setUnitExpenses(JSON.parse(localStorage.getItem('baf_unit_fund_expenses') || '[]'));
      setUnitTransfers(JSON.parse(localStorage.getItem('baf_unit_fund_transfers') || '[]'));
    } catch { /* empty */ }

    try {
      setOthersCats(JSON.parse(localStorage.getItem('baf_others_fund_categories') || '[]'));
      setOthersInflows(JSON.parse(localStorage.getItem('baf_others_fund_inflows') || '[]'));
      setOthersExpenses(JSON.parse(localStorage.getItem('baf_others_fund_expenses') || '[]'));
      setOthersTransfers(JSON.parse(localStorage.getItem('baf_others_fund_transfers') || '[]'));
    } catch { /* empty */ }
  };

  useEffect(() => {
    loadAllData();
    const handleSync = () => loadAllData();
    window.addEventListener('storage', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('unit_fund_updated', handleSync);
    window.addEventListener('others_fund_updated', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('unit_fund_updated', handleSync);
      window.removeEventListener('others_fund_updated', handleSync);
    };
  }, []);

  // 1. Canteen Fund Calc
  const billPaymentCash = canteenTxs
    .filter(r => r.type === 'BILL PAYMENT' && String(r.gateway || '').toUpperCase() === 'CASH')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const billPaymentUCB = canteenTxs
    .filter(r => r.type === 'BILL PAYMENT' && String(r.gateway || '').toUpperCase() === 'UCB')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const expenseCash = canteenExpenses
    .filter(exp => String(exp.paymentMethod || 'Cash').toLowerCase() === 'cash')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const expenseUCB = canteenExpenses
    .filter(exp => String(exp.paymentMethod || '').toLowerCase() === 'ucb')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const cashToUcbTotal = canteenTransfers
    .filter(t => t.from === 'CASH' && t.to === 'UCB')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const ucbToCashTotal = canteenTransfers
    .filter(t => t.from === 'UCB' && t.to === 'CASH')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const canteenCash = billPaymentCash - expenseCash - cashToUcbTotal + ucbToCashTotal;
  const canteenBank = billPaymentUCB - expenseUCB + cashToUcbTotal - ucbToCashTotal;
  const canteenTotal = canteenCash + canteenBank;

  // 2. Unit Fund Calc
  const unitInCash = unitInflows.filter(i => i.paymentMethod === 'CASH').reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const unitInBank = unitInflows.filter(i => i.paymentMethod === 'BANK').reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const unitExCash = unitExpenses.filter(e => e.paymentMethod === 'CASH').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const unitExBank = unitExpenses.filter(e => e.paymentMethod === 'BANK').reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const unitTrCashToBank = unitTransfers.filter(t => t.from === 'CASH' && t.to === 'BANK').reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const unitTrBankToCash = unitTransfers.filter(t => t.from === 'BANK' && t.to === 'CASH').reduce((s, t) => s + (Number(t.amount) || 0), 0);

  const unitCash = unitInCash - unitExCash - unitTrCashToBank + unitTrBankToCash;
  const unitBank = unitInBank - unitExBank + unitTrCashToBank - unitTrBankToCash;
  const unitTotal = unitCash + unitBank;

  // 3. Others Fund Calc
  const othersInCash = othersInflows.filter(i => i.paymentMethod === 'CASH').reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const othersInBank = othersInflows.filter(i => i.paymentMethod === 'BANK').reduce((s, i) => s + (Number(i.amount) || 0), 0);

  const othersExCash = othersExpenses.filter(e => e.paymentMethod === 'CASH').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const othersExBank = othersExpenses.filter(e => e.paymentMethod === 'BANK').reduce((s, e) => s + (Number(e.amount) || 0), 0);

  let othersTrCashToBank = 0;
  let othersTrBankToCash = 0;
  othersTransfers.forEach(t => {
    if (t.fromMethod === 'CASH' && t.toMethod === 'BANK') othersTrCashToBank += Number(t.amount) || 0;
    if (t.fromMethod === 'BANK' && t.toMethod === 'CASH') othersTrBankToCash += Number(t.amount) || 0;
  });

  const othersCash = othersInCash - othersExCash - othersTrCashToBank + othersTrBankToCash;
  const othersBank = othersInBank - othersExBank + othersTrCashToBank - othersTrBankToCash;
  const othersTotal = othersCash + othersBank;

  // Grand Totals
  const grandTotalFund = canteenTotal + unitTotal + othersTotal;
  const grandTotalCash = canteenCash + unitCash + othersCash;
  const grandTotalBank = canteenBank + unitBank + othersBank;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <PieChart className="w-6 h-6 text-indigo-400" />
            <span>ALL FUNDS OVERVIEW (সার্বিক তহবিল সারসংক্ষেপ)</span>
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            CONSOLIDATED LIQUID BALANCE OF CANTEEN, UNIT & ALL WELFARE SUB-FUNDS
          </p>
        </div>

        <button
          type="button"
          onClick={loadAllData}
          className="self-start md:self-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black tracking-wider uppercase transition-colors flex items-center space-x-1.5 border border-slate-700 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>SYNC ALL FUNDS</span>
        </button>
      </div>

      {/* Grand Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Grand Total Net Liquid Fund */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 rounded-[2rem] p-7 shadow-xl border border-indigo-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-2.5 py-1 rounded-full uppercase tracking-widest">
              GRAND TOTAL
            </span>
          </div>
          <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase mb-1">সর্বমোট সংরক্ষিত তহবিল</p>
          <h3 className={`text-4xl sm:text-5xl font-black tracking-tighter ${grandTotalFund >= 0 ? 'text-white' : 'text-rose-400'}`}>
            ৳{grandTotalFund.toLocaleString('en-US')}
          </h3>
          <p className="text-[11px] text-indigo-300/80 font-medium mt-3">
            ক্যান্টিন + ইউনিট + অন্যান্য সকল তহবিলের সম্মিলিত মোট ব্যালেন্স
          </p>
        </div>

        {/* Combined Cash in Hand */}
        <div className="bg-emerald-950/20 rounded-[2rem] p-7 shadow-sm border border-emerald-900/40 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-900/50 text-emerald-300 flex items-center justify-center">
              <Landmark className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-widest">
              TOTAL CASH
            </span>
          </div>
          <p className="text-[9px] font-black text-emerald-400 tracking-widest uppercase mb-1">সর্বমোট নগদ ক্যাশ (হাতে)</p>
          <h3 className={`text-4xl sm:text-5xl font-black tracking-tighter ${grandTotalCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ৳{grandTotalCash.toLocaleString('en-US')}
          </h3>
          <div className="text-[10px] text-slate-400 font-medium mt-3 space-y-0.5">
            <div>ক্যান্টিন ক্যাশ: <span className="font-bold text-slate-200">৳{canteenCash.toLocaleString('en-US')}</span></div>
            <div>ইউনিট ক্যাশ: <span className="font-bold text-slate-200">৳{unitCash.toLocaleString('en-US')}</span></div>
            <div>অন্যান্য ক্যাশ: <span className="font-bold text-slate-200">৳{othersCash.toLocaleString('en-US')}</span></div>
          </div>
        </div>

        {/* Combined Bank Balance */}
        <div className="bg-blue-950/20 rounded-[2rem] p-7 shadow-sm border border-blue-900/40 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-900/50 text-blue-300 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full uppercase tracking-widest">
              TOTAL BANK
            </span>
          </div>
          <p className="text-[9px] font-black text-blue-400 tracking-widest uppercase mb-1">সর্বমোট ব্যাংক একাউন্ট স্থিতি</p>
          <h3 className={`text-4xl sm:text-5xl font-black tracking-tighter ${grandTotalBank >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            ৳{grandTotalBank.toLocaleString('en-US')}
          </h3>
          <div className="text-[10px] text-slate-400 font-medium mt-3 space-y-0.5">
            <div>ক্যান্টিন UCB: <span className="font-bold text-slate-200">৳{canteenBank.toLocaleString('en-US')}</span></div>
            <div>ইউনিট ব্যাংক: <span className="font-bold text-slate-200">৳{unitBank.toLocaleString('en-US')}</span></div>
            <div>অন্যান্য ব্যাংক: <span className="font-bold text-slate-200">৳{othersBank.toLocaleString('en-US')}</span></div>
          </div>
        </div>
      </div>

      {/* Fund Breakdown & Direct Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Canteen Fund Card */}
        <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 hover:border-indigo-500/50 transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-white text-base">CANTEEN FUND</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">ক্যান্টিন তহবিল</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {canteenTxs.length + canteenExpenses.length} Records
              </span>
            </div>

            <div className="space-y-2 py-3 border-y border-slate-800/80 my-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">বর্তমান মোট স্থিতি:</span>
                <span className="font-bold text-white font-mono text-sm">৳{canteenTotal.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">ক্যাশ ইন হ্যান্ড:</span>
                <span className="font-mono text-emerald-400 font-bold">৳{canteenCash.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">ব্যাংক (UCB):</span>
                <span className="font-mono text-blue-400 font-bold">৳{canteenBank.toLocaleString('en-US')}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectFund('CANTEEN')}
            className="w-full mt-2 py-2.5 rounded-xl bg-slate-800 group-hover:bg-indigo-600 text-slate-300 group-hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>ক্যান্টিন ফান্ড ম্যানেজমেন্ট</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* 2. Unit Fund Card */}
        <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-white text-base">UNIT FUND</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">ইউনিট তহবিল</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {unitInflows.length + unitExpenses.length} Records
              </span>
            </div>

            <div className="space-y-2 py-3 border-y border-slate-800/80 my-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">বর্তমান মোট স্থিতি:</span>
                <span className="font-bold text-white font-mono text-sm">৳{unitTotal.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">ক্যাশ ইন হ্যান্ড:</span>
                <span className="font-mono text-emerald-400 font-bold">৳{unitCash.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">ব্যাংক একাউন্ট:</span>
                <span className="font-mono text-blue-400 font-bold">৳{unitBank.toLocaleString('en-US')}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectFund('UNIT')}
            className="w-full mt-2 py-2.5 rounded-xl bg-slate-800 group-hover:bg-emerald-600 text-slate-300 group-hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>ইউনিট ফান্ড ম্যানেজমেন্ট</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* 3. Others Fund Card */}
        <div className="bg-slate-900 rounded-[2rem] p-6 border border-slate-800 hover:border-amber-500/50 transition-all flex flex-col justify-between group">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-black text-white text-base">OTHERS FUND</h4>
                  <p className="text-[10px] text-slate-400 uppercase font-bold">অন্যান্য কল্যাণ তহবিল</p>
                </div>
              </div>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {othersCats.length} Funds
              </span>
            </div>

            <div className="space-y-2 py-3 border-y border-slate-800/80 my-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">বর্তমান মোট স্থিতি:</span>
                <span className="font-bold text-white font-mono text-sm">৳{othersTotal.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">ক্যাশ ইন হ্যান্ড:</span>
                <span className="font-mono text-emerald-400 font-bold">৳{othersCash.toLocaleString('en-US')}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">ব্যাংক একাউন্ট:</span>
                <span className="font-mono text-blue-400 font-bold">৳{othersBank.toLocaleString('en-US')}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelectFund('OTHERS')}
            className="w-full mt-2 py-2.5 rounded-xl bg-slate-800 group-hover:bg-amber-600 text-slate-300 group-hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>অন্যান্য ফান্ড ম্যানেজমেন্ট</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

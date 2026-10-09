import React, { useState, useEffect } from 'react';
import { 
  Building2, Landmark, CreditCard, Receipt, ArrowRightLeft, 
  PlusCircle, MinusCircle, X, RefreshCw, CheckCircle2, AlertCircle,
  Search, Trash2, Calendar, FileText, ArrowDownRight, ArrowUpRight,
  TrendingUp, TrendingDown, DollarSign
} from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';
import { UnitFundInflow, UnitFundExpense, UnitFundTransfer } from '../types/fundTypes';
import { playSuccessChime } from '../utils/audioFeedback';

const UNIT_INFLOWS_KEY = 'baf_unit_fund_inflows';
const UNIT_EXPENSES_KEY = 'baf_unit_fund_expenses';
const UNIT_TRANSFERS_KEY = 'baf_unit_fund_transfers';

const INFLOW_CATEGORIES = [
  'সরকারি / BAF অনুদান (Govt/BAF Grant)',
  'মাসিক চাঁদা / সাবস্ক্রিপশন (Monthly Subscription)',
  'ইউনিট কল্যাণ বরাদ্দ (Unit Welfare Allocation)',
  'বিশেষ অনুদান / উপহার (Special Donation)',
  'ইভেন্ট / প্রতিযোগিতা আয় (Event / Competition Inflow)',
  'অন্যান্য আয় (Other Inflow)'
];

const EXPENSE_CATEGORIES = [
  'অফিস রক্ষণাবেক্ষণ ও সংস্কার (Office Maintenance)',
  'অফিসিয়াল আপ্যায়ন ও চা-নাস্তা (Official Reception / Entertainment)',
  'স্টেশনারি ও প্রিন্টিং (Stationery & Printing)',
  'খেলাধুলা ও বিনোদন (Sports & Recreation)',
  'যাতায়াত ও জ্বালানি (Transport / POL)',
  'অনুষ্ঠান ও প্যারেড ব্যয় (Ceremony / Event Expense)',
  'জরুরি সহায়তা (Emergency Assistance)',
  'অন্যান্য ইউনিট ব্যয় (Other Unit Expenses)'
];

export const UnitFundSection: React.FC = () => {
  const [inflows, setInflows] = useState<UnitFundInflow[]>([]);
  const [expenses, setExpenses] = useState<UnitFundExpense[]>([]);
  const [transfers, setTransfers] = useState<UnitFundTransfer[]>([]);

  const [activeTab, setActiveTab] = useState<'ALL' | 'INFLOW' | 'EXPENSE' | 'TRANSFER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [showInflowModal, setShowInflowModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

  // Inflow Form State
  const [inflowDate, setInflowDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [inflowAmount, setInflowAmount] = useState('');
  const [inflowCategory, setInflowCategory] = useState(INFLOW_CATEGORIES[0]);
  const [inflowMethod, setInflowMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [inflowVoucher, setInflowVoucher] = useState('');
  const [inflowReceivedFrom, setInflowReceivedFrom] = useState('');
  const [inflowDesc, setInflowDesc] = useState('');
  const [inflowError, setInflowError] = useState('');

  // Expense Form State
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expenseMethod, setExpenseMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [expenseVoucher, setExpenseVoucher] = useState('');
  const [expensePaidTo, setExpensePaidTo] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseError, setExpenseError] = useState('');

  // Transfer Form State
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transferFrom, setTransferFrom] = useState<'CASH' | 'BANK'>('CASH');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferError, setTransferError] = useState('');

  const loadData = () => {
    try {
      const rawInflows = localStorage.getItem(UNIT_INFLOWS_KEY);
      const parsedInflows = rawInflows ? JSON.parse(rawInflows) : [];
      setInflows(Array.isArray(parsedInflows) ? parsedInflows : []);
    } catch {
      setInflows([]);
    }

    try {
      const rawExps = localStorage.getItem(UNIT_EXPENSES_KEY);
      const parsedExps = rawExps ? JSON.parse(rawExps) : [];
      setExpenses(Array.isArray(parsedExps) ? parsedExps : []);
    } catch {
      setExpenses([]);
    }

    try {
      const rawTrs = localStorage.getItem(UNIT_TRANSFERS_KEY);
      const parsedTrs = rawTrs ? JSON.parse(rawTrs) : [];
      setTransfers(Array.isArray(parsedTrs) ? parsedTrs : []);
    } catch {
      setTransfers([]);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('unit_fund_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('unit_fund_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const triggerUpdate = () => {
    window.dispatchEvent(new Event('unit_fund_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Calculations
  const totalInflow = inflows.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const totalExpense = expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const cashInflow = inflows
    .filter(i => i.paymentMethod === 'CASH')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const bankInflow = inflows
    .filter(i => i.paymentMethod === 'BANK')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const cashExpense = expenses
    .filter(e => e.paymentMethod === 'CASH')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const bankExpense = expenses
    .filter(e => e.paymentMethod === 'BANK')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const cashToBankTotal = transfers
    .filter(t => t.from === 'CASH' && t.to === 'BANK')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const bankToCashTotal = transfers
    .filter(t => t.from === 'BANK' && t.to === 'CASH')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const cashBalance = cashInflow - cashExpense - cashToBankTotal + bankToCashTotal;
  const bankBalance = bankInflow - bankExpense + cashToBankTotal - bankToCashTotal;
  const netUnitFund = cashBalance + bankBalance;

  // Add Inflow
  const handleSaveInflow = (e: React.FormEvent) => {
    e.preventDefault();
    setInflowError('');
    const amt = parseFloat(inflowAmount);
    if (isNaN(amt) || amt <= 0) {
      setInflowError('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন (Amount > 0)');
      return;
    }

    const newInflow: UnitFundInflow = {
      id: 'uf-in-' + Date.now(),
      date: inflowDate || new Date().toISOString().split('T')[0],
      amount: amt,
      sourceCategory: inflowCategory,
      paymentMethod: inflowMethod,
      voucherNo: inflowVoucher.trim() || undefined,
      receivedFrom: inflowReceivedFrom.trim() || undefined,
      description: inflowDesc.trim() || 'Unit Fund Inflow',
      createdAt: new Date().toISOString()
    };

    const updated = [newInflow, ...inflows];
    setInflows(updated);
    localStorage.setItem(UNIT_INFLOWS_KEY, JSON.stringify(updated));
    triggerUpdate();
    setShowInflowModal(false);
    setInflowAmount('');
    setInflowVoucher('');
    setInflowReceivedFrom('');
    setInflowDesc('');
    showToast(`৳${amt.toLocaleString('en-US')} ইউনিট তহবিলে সফলভাবে জমা হয়েছে!`);
  };

  // Add Expense
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      setExpenseError('অনুগ্রহ করে সঠিক খরচের পরিমাণ লিখুন (Amount > 0)');
      return;
    }

    const availableBal = expenseMethod === 'CASH' ? cashBalance : bankBalance;
    if (amt > availableBal) {
      setExpenseError(`পর্যাপ্ত ব্যালেন্স নেই! ${expenseMethod} এ বর্তমান স্থিতি ৳${availableBal.toLocaleString('en-US')}`);
      return;
    }

    const newExpense: UnitFundExpense = {
      id: 'uf-ex-' + Date.now(),
      date: expenseDate || new Date().toISOString().split('T')[0],
      amount: amt,
      expenseCategory: expenseCategory,
      paymentMethod: expenseMethod,
      voucherNo: expenseVoucher.trim() || undefined,
      paidTo: expensePaidTo.trim() || undefined,
      description: expenseDesc.trim() || 'Unit Fund Expense',
      createdAt: new Date().toISOString()
    };

    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    localStorage.setItem(UNIT_EXPENSES_KEY, JSON.stringify(updated));
    triggerUpdate();
    setShowExpenseModal(false);
    setExpenseAmount('');
    setExpenseVoucher('');
    setExpensePaidTo('');
    setExpenseDesc('');
    showToast(`৳${amt.toLocaleString('en-US')} ইউনিট তহবিল থেকে খরচ লিপিবদ্ধ হয়েছে!`);
  };

  // Add Transfer
  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন');
      return;
    }

    const sourceBal = transferFrom === 'CASH' ? cashBalance : bankBalance;
    if (amt > sourceBal) {
      setTransferError(`পর্যাপ্ত ব্যালেন্স নেই! ${transferFrom} তহবিলে রয়েছে ৳${sourceBal.toLocaleString('en-US')}`);
      return;
    }

    const transferTo: 'CASH' | 'BANK' = transferFrom === 'CASH' ? 'BANK' : 'CASH';

    const newTransfer: UnitFundTransfer = {
      id: 'uf-tr-' + Date.now(),
      date: transferDate || new Date().toISOString().split('T')[0],
      amount: amt,
      from: transferFrom,
      to: transferTo,
      note: transferNote.trim() || `Transferred from ${transferFrom} to ${transferTo}`,
      createdAt: new Date().toISOString()
    };

    const updated = [newTransfer, ...transfers];
    setTransfers(updated);
    localStorage.setItem(UNIT_TRANSFERS_KEY, JSON.stringify(updated));
    triggerUpdate();
    setShowTransferModal(false);
    setTransferAmount('');
    setTransferNote('');
    showToast(`৳${amt.toLocaleString('en-US')} সফলভাবে ${transferFrom} থেকে ${transferTo}-এ স্থানান্তর করা হয়েছে!`);
  };

  // Delete Confirmation Modal State
  const [deleteConfirmTx, setDeleteConfirmTx] = useState<{ id: string; type: 'INFLOW' | 'EXPENSE' | 'TRANSFER'; desc: string; amount: number } | null>(null);
  const [deleteSuccessData, setDeleteSuccessData] = useState<{ desc: string; amount: number } | null>(null);

  // Direct Delete Handlers & Modal Confirm
  const executeDeleteRecord = () => {
    if (!deleteConfirmTx) return;
    const { id, type } = deleteConfirmTx;
    const current = deleteConfirmTx;
    if (type === 'INFLOW') {
      const updated = inflows.filter(i => i.id !== id);
      setInflows(updated);
      localStorage.setItem(UNIT_INFLOWS_KEY, JSON.stringify(updated));
      triggerUpdate();
    } else if (type === 'EXPENSE') {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      localStorage.setItem(UNIT_EXPENSES_KEY, JSON.stringify(updated));
      triggerUpdate();
    } else if (type === 'TRANSFER') {
      const updated = transfers.filter(t => t.id !== id);
      setTransfers(updated);
      localStorage.setItem(UNIT_TRANSFERS_KEY, JSON.stringify(updated));
      triggerUpdate();
    }

    playSuccessChime();
    setDeleteSuccessData({ desc: current.desc, amount: current.amount });
    setTimeout(() => {
      setDeleteSuccessData(null);
      setDeleteConfirmTx(null);
    }, 2000);
  };

  // Combined and sorted transactions
  type CombinedTx = {
    id: string;
    type: 'INFLOW' | 'EXPENSE' | 'TRANSFER';
    date: string;
    category: string;
    description: string;
    method: string;
    voucher?: string;
    party?: string;
    amount: number;
    raw: any;
  };

  const combinedList: CombinedTx[] = [
    ...inflows.map(i => ({
      id: i.id,
      type: 'INFLOW' as const,
      date: i.date,
      category: i.sourceCategory,
      description: i.description,
      method: i.paymentMethod,
      voucher: i.voucherNo,
      party: i.receivedFrom,
      amount: i.amount,
      raw: i
    })),
    ...expenses.map(e => ({
      id: e.id,
      type: 'EXPENSE' as const,
      date: e.date,
      category: e.expenseCategory,
      description: e.description,
      method: e.paymentMethod,
      voucher: e.voucherNo,
      party: e.paidTo,
      amount: e.amount,
      raw: e
    })),
    ...transfers.map(t => ({
      id: t.id,
      type: 'TRANSFER' as const,
      date: t.date,
      category: `${t.from} ➔ ${t.to}`,
      description: t.note || `Transfer from ${t.from} to ${t.to}`,
      method: `${t.from} ➔ ${t.to}`,
      amount: t.amount,
      raw: t
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredTransactions = combinedList.filter(item => {
    if (activeTab === 'INFLOW' && item.type !== 'INFLOW') return false;
    if (activeTab === 'EXPENSE' && item.type !== 'EXPENSE') return false;
    if (activeTab === 'TRANSFER' && item.type !== 'TRANSFER') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCat = item.category.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchVoucher = item.voucher?.toLowerCase().includes(q);
      const matchParty = item.party?.toLowerCase().includes(q);
      return matchCat || matchDesc || matchVoucher || matchParty;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-600 text-white font-bold px-5 py-3 rounded-2xl shadow-xl border border-emerald-400/40 flex items-center space-x-2 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header and Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Building2 className="w-6 h-6 text-emerald-400" />
            <span>UNIT FUND (ইউনিট তহবিল)</span>
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            BAF 155 UASU OFFICIAL UNIT ALLOCATIONS, EXPENDITURES & WELFARE ACCOUNTS
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setInflowError('');
              setShowInflowModal(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center space-x-1.5 shadow-lg shadow-emerald-500/25 active:translate-y-0.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>তহবিলে জমা (+ INFLOW)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setExpenseError('');
              setShowExpenseModal(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center space-x-1.5 shadow-lg shadow-rose-500/25 active:translate-y-0.5 cursor-pointer"
          >
            <MinusCircle className="w-4 h-4" />
            <span>ইউনিট ব্যয় (- EXPENSE)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTransferError('');
              setTransferAmount('');
              setTransferNote('');
              setShowTransferModal(true);
            }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-black tracking-wider uppercase transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
            <span>স্থানান্তর (TRANSFER)</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700 cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Net Unit Fund */}
        <div className="bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              NET UNIT FUND
            </span>
          </div>
          <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-1">TOTAL CURRENT BALANCE</p>
          <h3 className={`text-4xl font-black tracking-tighter ${netUnitFund >= 0 ? 'text-white' : 'text-rose-400'}`}>
            ৳{netUnitFund.toLocaleString('en-US')}
          </h3>
          <div className="text-[10px] text-slate-400 font-medium mt-2 flex flex-col space-y-0.5">
            <span className="text-emerald-400 font-bold">+ মোট প্রাপ্তি / অনুদান: ৳{totalInflow.toLocaleString('en-US')}</span>
            <span className="text-rose-400 font-bold">- মোট ব্যয় / খরচ: ৳{totalExpense.toLocaleString('en-US')}</span>
          </div>
        </div>

        {/* Cash Balance */}
        <div className="bg-emerald-900/15 rounded-[2rem] p-6 shadow-sm border border-emerald-900/30 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/40 text-emerald-300 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              CASH IN HAND
            </span>
          </div>
          <p className="text-[8px] font-black text-emerald-400 tracking-widest uppercase mb-1">TOTAL UNIT CASH</p>
          <h3 className={`text-4xl font-black tracking-tighter ${cashBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ৳{cashBalance.toLocaleString('en-US')}
          </h3>
          <div className="text-[10px] text-slate-400 font-medium mt-2 flex flex-col space-y-0.5">
            <span className="text-emerald-400/90 font-bold">+ নগদ জমা: ৳{cashInflow.toLocaleString('en-US')}</span>
            <span className="text-rose-400/90 font-bold">- নগদ খরচ: ৳{cashExpense.toLocaleString('en-US')}</span>
            {(cashToBankTotal > 0 || bankToCashTotal > 0) && (
              <span className="text-indigo-400/90 font-bold">
                +/- ব্যাংক ট্রান্সফার: {bankToCashTotal - cashToBankTotal >= 0 ? `+৳${(bankToCashTotal - cashToBankTotal).toLocaleString('en-US')}` : `-৳${Math.abs(bankToCashTotal - cashToBankTotal).toLocaleString('en-US')}`}
              </span>
            )}
          </div>
        </div>

        {/* Bank Balance */}
        <div className="bg-blue-900/15 rounded-[2rem] p-6 shadow-sm border border-blue-900/30 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-900/40 text-blue-300 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              BANK ACCOUNT
            </span>
          </div>
          <p className="text-[8px] font-black text-blue-400 tracking-widest uppercase mb-1">TOTAL UNIT BANK</p>
          <h3 className={`text-4xl font-black tracking-tighter ${bankBalance >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            ৳{bankBalance.toLocaleString('en-US')}
          </h3>
          <div className="text-[10px] text-slate-400 font-medium mt-2 flex flex-col space-y-0.5">
            <span className="text-blue-400/90 font-bold">+ ব্যাংক জমা: ৳{bankInflow.toLocaleString('en-US')}</span>
            <span className="text-rose-400/90 font-bold">- ব্যাংক পেমেন্ট: ৳{bankExpense.toLocaleString('en-US')}</span>
            {(cashToBankTotal > 0 || bankToCashTotal > 0) && (
              <span className="text-indigo-400/90 font-bold">
                +/- ক্যাশ ট্রান্সফার: {cashToBankTotal - bankToCashTotal >= 0 ? `+৳${(cashToBankTotal - bankToCashTotal).toLocaleString('en-US')}` : `-৳${Math.abs(cashToBankTotal - bankToCashTotal).toLocaleString('en-US')}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ledger & Transactions Section */}
      <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-emerald-400" />
              <span>UNIT FUND LEDGER & TRANSACTIONS</span>
            </h3>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="খুঁজুন (ভাউচার / খাত / বিবরণ)..."
                className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-44 sm:w-60"
              />
            </div>
          </div>

          {/* Tab Filter */}
          <div className="flex bg-slate-800 rounded-xl p-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'ALL' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              ALL ({combinedList.length})
            </button>
            <button
              onClick={() => setActiveTab('INFLOW')}
              className={`px-3 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'INFLOW' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              INFLOW ({inflows.length})
            </button>
            <button
              onClick={() => setActiveTab('EXPENSE')}
              className={`px-3 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'EXPENSE' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              EXPENSE ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('TRANSFER')}
              className={`px-3 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'TRANSFER' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              TRANSFER ({transfers.length})
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                <th className="p-4">Date</th>
                <th className="p-4">Type</th>
                <th className="p-4">Category / Purpose</th>
                <th className="p-4">Voucher / Party</th>
                <th className="p-4">Method</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="text-xs text-slate-300 font-medium">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                    কোনো লেনদেনের রেকর্ড পাওয়া যায়নি
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-mono">{formatCanteenDate(tx.date)}</td>
                    <td className="p-4">
                      {tx.type === 'INFLOW' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                          <ArrowDownRight className="w-3 h-3" /> জমা (INFLOW)
                        </span>
                      )}
                      {tx.type === 'EXPENSE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800/50">
                          <ArrowUpRight className="w-3 h-3" /> খরচ (EXPENSE)
                        </span>
                      )}
                      {tx.type === 'TRANSFER' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-950/80 text-indigo-400 border border-indigo-800/50">
                          <ArrowRightLeft className="w-3 h-3" /> স্থানান্তর
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-200">{tx.category}</p>
                      {tx.description && <p className="text-[10px] text-slate-400 mt-0.5">{tx.description}</p>}
                    </td>
                    <td className="p-4 text-slate-300">
                      {tx.voucher && <span className="font-mono text-emerald-400 mr-2">VR: {tx.voucher}</span>}
                      {tx.party && <span className="text-slate-400">({tx.party})</span>}
                      {!tx.voucher && !tx.party && <span className="text-slate-600">-</span>}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase ${
                        tx.method === 'CASH' 
                          ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40' 
                          : tx.method === 'BANK'
                          ? 'bg-blue-900/30 text-blue-400 border border-blue-800/40'
                          : 'bg-indigo-900/30 text-indigo-400 border border-indigo-800/40'
                      }`}>
                        {tx.method}
                      </span>
                    </td>
                    <td className="p-4 text-right font-black font-mono text-sm">
                      <span className={tx.type === 'INFLOW' ? 'text-emerald-400' : tx.type === 'EXPENSE' ? 'text-rose-400' : 'text-indigo-400'}>
                        {tx.type === 'INFLOW' ? '+' : tx.type === 'EXPENSE' ? '-' : ''}৳{tx.amount.toLocaleString('en-US')}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteConfirmTx({
                            id: tx.id,
                            type: tx.type,
                            desc: tx.description || tx.category || 'রেকর্ড',
                            amount: tx.amount
                          });
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Delete Record"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD INFLOW */}
      {showInflowModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <span>ইউনিট তহবিলে অর্থ জমা (Add Inflow)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowInflowModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inflowError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{inflowError}</span>
              </div>
            )}

            <form onSubmit={handleSaveInflow} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">তারিখ (Date)</label>
                  <input
                    type="date"
                    required
                    value={inflowDate}
                    onChange={e => setInflowDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">টাকার পরিমাণ (৳ Amount) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="৳ 0.00"
                    value={inflowAmount}
                    onChange={e => setInflowAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-emerald-400 font-bold font-mono text-sm outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">প্রাপ্তির খাত / উৎস (Source Category) *</label>
                <select
                  value={inflowCategory}
                  onChange={e => setInflowCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                >
                  {INFLOW_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">পেমেন্ট মেথড (Payment Method) *</label>
                  <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setInflowMethod('CASH')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${inflowMethod === 'CASH' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      ক্যাশ (CASH)
                    </button>
                    <button
                      type="button"
                      onClick={() => setInflowMethod('BANK')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${inflowMethod === 'BANK' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      ব্যাংক (BANK)
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">ভাউচার / রসিদ নং (Voucher No)</label>
                  <input
                    type="text"
                    placeholder="e.g. VR-2026/01"
                    value={inflowVoucher}
                    onChange={e => setInflowVoucher(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">যার নিকট থেকে প্রাপ্ত (Received From)</label>
                <input
                  type="text"
                  placeholder="e.g. HQ BAF / Officer Commanding / Member Name"
                  value={inflowReceivedFrom}
                  onChange={e => setInflowReceivedFrom(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">বিবরণ / নোট (Description / Remarks)</label>
                <textarea
                  rows={2}
                  placeholder="বিস্তারিত বিবরণ..."
                  value={inflowDesc}
                  onChange={e => setInflowDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInflowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  জমা নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD EXPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-rose-500/30 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-rose-400" />
                <span>ইউনিট তহবিলের ব্যয় লিপিবদ্ধ (Add Expense)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowExpenseModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {expenseError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{expenseError}</span>
              </div>
            )}

            <form onSubmit={handleSaveExpense} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">তারিখ (Date)</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">খরচের পরিমাণ (৳ Amount) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="৳ 0.00"
                    value={expenseAmount}
                    onChange={e => setExpenseAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-rose-400 font-bold font-mono text-sm outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">খরচের খাত (Expense Category) *</label>
                <select
                  value={expenseCategory}
                  onChange={e => setExpenseCategory(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-rose-500"
                >
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">পেমেন্ট মেথড (Payment Method) *</label>
                  <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setExpenseMethod('CASH')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${expenseMethod === 'CASH' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      ক্যাশ (৳{cashBalance.toLocaleString('en-US')})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseMethod('BANK')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${expenseMethod === 'BANK' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      ব্যাংক (৳{bankBalance.toLocaleString('en-US')})
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">বিল / ভাউচার নং (Bill / Voucher No)</label>
                  <input
                    type="text"
                    placeholder="e.g. BILL-4410"
                    value={expenseVoucher}
                    onChange={e => setExpenseVoucher(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">যাকে পরিশোধ করা হলো (Paid To)</label>
                <input
                  type="text"
                  placeholder="e.g. Vendor / Store / Person Name"
                  value={expensePaidTo}
                  onChange={e => setExpensePaidTo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">খরচের উদ্দেশ্য / বিবরণ (Remarks)</label>
                <textarea
                  rows={2}
                  placeholder="খরচের বিস্তারিত বিবরণ..."
                  value={expenseDesc}
                  onChange={e => setExpenseDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-rose-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowExpenseModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                >
                  খরচ নিশ্চিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TRANSFER */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                <span>ইউনিট তহবিল স্থানান্তর (Fund Transfer)</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTransfer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-800/60 rounded-2xl border border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">উৎস (From):</span>
                  <button
                    type="button"
                    onClick={() => setTransferFrom(transferFrom === 'CASH' ? 'BANK' : 'CASH')}
                    className="w-full py-2 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-between"
                  >
                    <span>{transferFrom}</span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      (৳{(transferFrom === 'CASH' ? cashBalance : bankBalance).toLocaleString('en-US')})
                    </span>
                  </button>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">গন্তব্য (To):</span>
                  <div className="w-full py-2 px-3 rounded-xl bg-slate-800 text-slate-300 font-bold border border-slate-700 flex items-center justify-between">
                    <span>{transferFrom === 'CASH' ? 'BANK' : 'CASH'}</span>
                    <span className="text-[10px] text-blue-400 font-mono">
                      (৳{(transferFrom === 'CASH' ? bankBalance : cashBalance).toLocaleString('en-US')})
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">স্থানান্তরের পরিমাণ (৳ Amount) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="৳ 0.00"
                  value={transferAmount}
                  onChange={e => setTransferAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-indigo-400 font-bold font-mono text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">তারিখ (Date)</label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">নোট / কারণ (Note / Reason)</label>
                <input
                  type="text"
                  placeholder="e.g. ব্যাংক থেকে ক্যাশ উত্তোলন / ক্যাশ ব্যাংকে জমা..."
                  value={transferNote}
                  onChange={e => setTransferNote(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  স্থানান্তর সম্পন্ন করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE TRANSACTION CONFIRMATION MODAL */}
      {deleteConfirmTx && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative text-white space-y-4 animate-in zoom-in-95 overflow-hidden">
            {deleteSuccessData ? (
              <div className="text-center space-y-3 py-2">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-8 h-8 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-base font-black text-white">রেকর্ড সফলভাবে মুছে ফেলা হয়েছে!</h4>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2">{deleteSuccessData.desc}</p>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex justify-between items-center text-slate-300">
                  <span>মুছে ফেলা পরিমাণ:</span>
                  <span className="font-mono font-bold text-emerald-400">৳{deleteSuccessData.amount.toLocaleString()}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteSuccessData(null);
                    setDeleteConfirmTx(null);
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  ঠিক আছে (DONE)
                </button>
              </div>
            ) : (
              <>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6 animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="text-base font-black text-white">রেকর্ড মুছে ফেলতে চান?</h4>
                  <p className="text-xs text-slate-400">
                    আপনি কি নিশ্চিত যে <strong className="text-white">"{deleteConfirmTx.desc}"</strong>-এর{' '}
                    <strong className="text-rose-400 font-mono">৳{deleteConfirmTx.amount.toLocaleString()}</strong> রেকর্ডটি মুছে ফেলতে চান?
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmTx(null)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={executeDeleteRecord}
                    className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-rose-950/50 cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>মুছে ফেলুন</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

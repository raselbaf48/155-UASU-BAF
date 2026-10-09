import React, { useState, useEffect } from 'react';
import { 
  Briefcase, Landmark, CreditCard, Receipt, ArrowRightLeft, 
  PlusCircle, MinusCircle, X, RefreshCw, CheckCircle2, AlertCircle,
  Search, Trash2, Calendar, Plus, FolderPlus, Tag, ArrowDownRight, ArrowUpRight,
  Sparkles, Layers
} from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';
import { playSuccessChime } from '../utils/audioFeedback';
import { 
  OthersFundCategory, 
  OthersFundInflow, 
  OthersFundExpense, 
  OthersFundTransfer 
} from '../types/fundTypes';

const OTHERS_CATEGORIES_KEY = 'baf_others_fund_categories';
const OTHERS_INFLOWS_KEY = 'baf_others_fund_inflows';
const OTHERS_EXPENSES_KEY = 'baf_others_fund_expenses';
const OTHERS_TRANSFERS_KEY = 'baf_others_fund_transfers';

const DEFAULT_CATEGORIES: OthersFundCategory[] = [
  { id: 'cat-welfare', name: 'Welfare Fund', color: 'from-amber-600 to-orange-600', createdAt: new Date().toISOString() },
  { id: 'cat-mess', name: 'Mess Fund', color: 'from-blue-600 to-indigo-600', createdAt: new Date().toISOString() },
  { id: 'cat-sports', name: 'Sports & Recreation', color: 'from-emerald-600 to-teal-600', createdAt: new Date().toISOString() },
  { id: 'cat-mosque', name: 'Mosque Fund', color: 'from-green-600 to-emerald-600', createdAt: new Date().toISOString() },
  { id: 'cat-event', name: 'Event & Project', color: 'from-purple-600 to-pink-600', createdAt: new Date().toISOString() },
  { id: 'cat-emergency', name: 'Emergency Fund', color: 'from-rose-600 to-red-600', createdAt: new Date().toISOString() }
];

export const OthersFundSection: React.FC = () => {
  const [categories, setCategories] = useState<OthersFundCategory[]>([]);
  const [inflows, setInflows] = useState<OthersFundInflow[]>([]);
  const [expenses, setExpenses] = useState<OthersFundExpense[]>([]);
  const [transfers, setTransfers] = useState<OthersFundTransfer[]>([]);

  // Selected Fund Filter ('ALL' or category.id)
  const [selectedFundId, setSelectedFundId] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ALL' | 'INFLOW' | 'EXPENSE' | 'TRANSFER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [showInflowModal, setShowInflowModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);

  // Inflow Form State
  const [inflowFundId, setInflowFundId] = useState('');
  const [inflowDate, setInflowDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [inflowAmount, setInflowAmount] = useState('');
  const [inflowSource, setInflowSource] = useState('Contribution / Grant');
  const [inflowMethod, setInflowMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [inflowVoucher, setInflowVoucher] = useState('');
  const [inflowReceivedFrom, setInflowReceivedFrom] = useState('');
  const [inflowDesc, setInflowDesc] = useState('');
  const [inflowError, setInflowError] = useState('');

  // Expense Form State
  const [expenseFundId, setExpenseFundId] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('General Expense');
  const [expenseMethod, setExpenseMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [expenseVoucher, setExpenseVoucher] = useState('');
  const [expensePaidTo, setExpensePaidTo] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseError, setExpenseError] = useState('');

  // Transfer Form State
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transferFromFundId, setTransferFromFundId] = useState('');
  const [transferToFundId, setTransferToFundId] = useState('');
  const [transferFromMethod, setTransferFromMethod] = useState<'CASH' | 'BANK'>('CASH');
  const [transferToMethod, setTransferToMethod] = useState<'CASH' | 'BANK'>('BANK');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferError, setTransferError] = useState('');

  // New Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatError, setNewCatError] = useState('');

  const sanitizeCategory = (c: OthersFundCategory): OthersFundCategory => {
    let name = c.name || '';
    if (name.includes('Welfare') || name.includes('কল্যাণ')) name = 'Welfare Fund';
    else if (name.includes('Mess') || name.includes('মেস')) name = 'Mess Fund';
    else if (name.includes('Sports') || name.includes('ক্রীড়া')) name = 'Sports & Recreation';
    else if (name.includes('Mosque') || name.includes('মসজিদ')) name = 'Mosque Fund';
    else if (name.includes('Event') || name.includes('অনুষ্ঠান')) name = 'Event & Project';
    else if (name.includes('Emergency') || name.includes('জরুরি')) name = 'Emergency Fund';
    else {
      const match = name.match(/\(([^)]+)\)/);
      if (match && match[1]) name = match[1].trim();
      else name = name.replace(/[\u0980-\u09FF]+/g, '').trim() || name;
    }
    return {
      ...c,
      name,
      description: undefined
    };
  };

  const loadData = () => {
    try {
      const rawCats = localStorage.getItem(OTHERS_CATEGORIES_KEY);
      if (rawCats) {
        const parsed = JSON.parse(rawCats);
        const cleaned = Array.isArray(parsed) ? parsed.map(sanitizeCategory) : DEFAULT_CATEGORIES;
        setCategories(cleaned);
        localStorage.setItem(OTHERS_CATEGORIES_KEY, JSON.stringify(cleaned));
      } else {
        setCategories(DEFAULT_CATEGORIES);
        localStorage.setItem(OTHERS_CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
      }
    } catch {
      setCategories(DEFAULT_CATEGORIES);
    }

    try {
      const rawInflows = localStorage.getItem(OTHERS_INFLOWS_KEY);
      setInflows(rawInflows ? JSON.parse(rawInflows) : []);
    } catch {
      setInflows([]);
    }

    try {
      const rawExps = localStorage.getItem(OTHERS_EXPENSES_KEY);
      setExpenses(rawExps ? JSON.parse(rawExps) : []);
    } catch {
      setExpenses([]);
    }

    try {
      const rawTrs = localStorage.getItem(OTHERS_TRANSFERS_KEY);
      setTransfers(rawTrs ? JSON.parse(rawTrs) : []);
    } catch {
      setTransfers([]);
    }
  };

  useEffect(() => {
    loadData();
    const handleSync = () => loadData();
    window.addEventListener('others_fund_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('others_fund_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const triggerUpdate = () => {
    window.dispatchEvent(new Event('others_fund_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Set default form fund IDs
  useEffect(() => {
    if (categories.length > 0) {
      if (!inflowFundId) setInflowFundId(categories[0].id);
      if (!expenseFundId) setExpenseFundId(categories[0].id);
      if (!transferFromFundId) setTransferFromFundId(categories[0].id);
      if (!transferToFundId) setTransferToFundId(categories[1]?.id || categories[0].id);
    }
  }, [categories]);

  // Calculations: Calculate balance for any specific fund or overall
  const getFundBalance = (fundId?: string) => {
    const relevantInflows = fundId 
      ? inflows.filter(i => i.fundId === fundId)
      : inflows;

    const relevantExpenses = fundId
      ? expenses.filter(e => e.fundId === fundId)
      : expenses;

    const cashIn = relevantInflows.filter(i => i.paymentMethod === 'CASH').reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const bankIn = relevantInflows.filter(i => i.paymentMethod === 'BANK').reduce((s, i) => s + (Number(i.amount) || 0), 0);

    const cashOut = relevantExpenses.filter(e => e.paymentMethod === 'CASH').reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const bankOut = relevantExpenses.filter(e => e.paymentMethod === 'BANK').reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // Transfers
    let transferCashIn = 0;
    let transferCashOut = 0;
    let transferBankIn = 0;
    let transferBankOut = 0;

    transfers.forEach(t => {
      // If we are calculating for a specific fund:
      if (fundId) {
        if (t.toFundId === fundId) {
          if (t.toMethod === 'CASH') transferCashIn += Number(t.amount) || 0;
          if (t.toMethod === 'BANK') transferBankIn += Number(t.amount) || 0;
        }
        if (t.fromFundId === fundId) {
          if (t.fromMethod === 'CASH') transferCashOut += Number(t.amount) || 0;
          if (t.fromMethod === 'BANK') transferBankOut += Number(t.amount) || 0;
        }
      } else {
        // Overall: only method-shifts (e.g. Cash -> Bank) matter
        if (t.fromMethod === 'CASH' && t.toMethod === 'BANK') {
          transferCashOut += Number(t.amount) || 0;
          transferBankIn += Number(t.amount) || 0;
        }
        if (t.fromMethod === 'BANK' && t.toMethod === 'CASH') {
          transferBankOut += Number(t.amount) || 0;
          transferCashIn += Number(t.amount) || 0;
        }
      }
    });

    const cashBal = cashIn - cashOut - transferCashOut + transferCashIn;
    const bankBal = bankIn - bankOut - transferBankOut + transferBankIn;
    const totalBal = cashBal + bankBal;

    return {
      total: totalBal,
      cash: cashBal,
      bank: bankBal,
      inflow: cashIn + bankIn,
      expense: cashOut + bankOut
    };
  };

  // Active view balances
  const currentViewBalances = selectedFundId === 'ALL'
    ? getFundBalance()
    : getFundBalance(selectedFundId);

  // Add Custom Category
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    setNewCatError('');
    if (!newCatName.trim()) {
      setNewCatError('Please enter a fund name');
      return;
    }

    const newCategory: OthersFundCategory = {
      id: 'cat-custom-' + Date.now(),
      name: newCatName.trim(),
      color: 'from-indigo-600 to-purple-600',
      createdAt: new Date().toISOString()
    };

    const updated = [...categories, newCategory];
    setCategories(updated);
    localStorage.setItem(OTHERS_CATEGORIES_KEY, JSON.stringify(updated));
    triggerUpdate();
    setShowNewCategoryModal(false);
    setNewCatName('');
    showToast(`"${newCategory.name}" fund created successfully!`);
  };

  // Add Inflow
  const handleSaveInflow = (e: React.FormEvent) => {
    e.preventDefault();
    setInflowError('');
    const amt = parseFloat(inflowAmount);
    if (isNaN(amt) || amt <= 0) {
      setInflowError('Please enter a valid amount');
      return;
    }

    const targetCategory = categories.find(c => c.id === inflowFundId);
    if (!targetCategory) {
      setInflowError('Please select a fund');
      return;
    }

    const newInflow: OthersFundInflow = {
      id: 'of-in-' + Date.now(),
      fundId: targetCategory.id,
      fundName: targetCategory.name,
      date: inflowDate || new Date().toISOString().split('T')[0],
      amount: amt,
      source: inflowSource.trim() || 'Contribution / Deposit',
      paymentMethod: inflowMethod,
      voucherNo: inflowVoucher.trim() || undefined,
      receivedFrom: inflowReceivedFrom.trim() || undefined,
      description: inflowDesc.trim() || 'Fund Deposit',
      createdAt: new Date().toISOString()
    };

    const updated = [newInflow, ...inflows];
    setInflows(updated);
    localStorage.setItem(OTHERS_INFLOWS_KEY, JSON.stringify(updated));
    triggerUpdate();
    setShowInflowModal(false);
    setInflowAmount('');
    setInflowVoucher('');
    setInflowReceivedFrom('');
    setInflowDesc('');
    showToast(`৳${amt.toLocaleString('en-US')} deposited into "${targetCategory.name}"!`);
  };

  // Add Expense
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) {
      setExpenseError('Please enter a valid expense amount');
      return;
    }

    const targetCategory = categories.find(c => c.id === expenseFundId);
    if (!targetCategory) {
      setExpenseError('Please select a fund');
      return;
    }

    const fundBal = getFundBalance(targetCategory.id);
    const available = expenseMethod === 'CASH' ? fundBal.cash : fundBal.bank;
    if (amt > available) {
      setExpenseError(`Insufficient balance! "${targetCategory.name}" has ৳${available.toLocaleString('en-US')} in ${expenseMethod}.`);
      return;
    }

    const newExpense: OthersFundExpense = {
      id: 'of-ex-' + Date.now(),
      fundId: targetCategory.id,
      fundName: targetCategory.name,
      date: expenseDate || new Date().toISOString().split('T')[0],
      amount: amt,
      category: expenseCategory.trim() || 'General Expense',
      paymentMethod: expenseMethod,
      voucherNo: expenseVoucher.trim() || undefined,
      paidTo: expensePaidTo.trim() || undefined,
      description: expenseDesc.trim() || 'Expense Outflow',
      createdAt: new Date().toISOString()
    };

    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    localStorage.setItem(OTHERS_EXPENSES_KEY, JSON.stringify(updated));
    triggerUpdate();
    setShowExpenseModal(false);
    setExpenseAmount('');
    setExpenseVoucher('');
    setExpensePaidTo('');
    setExpenseDesc('');
    showToast(`৳${amt.toLocaleString('en-US')} expense recorded from "${targetCategory.name}"!`);
  };

  // Add Transfer
  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setTransferError('');
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('Please enter a valid transfer amount');
      return;
    }

    const fromCat = categories.find(c => c.id === transferFromFundId);
    const toCat = categories.find(c => c.id === transferToFundId);

    if (!fromCat || !toCat) {
      setTransferError('Please select source and destination funds');
      return;
    }

    if (fromCat.id === toCat.id && transferFromMethod === transferToMethod) {
      setTransferError('Cannot transfer within the same fund and payment method');
      return;
    }

    const fromBal = getFundBalance(fromCat.id);
    const available = transferFromMethod === 'CASH' ? fromBal.cash : fromBal.bank;
    if (amt > available) {
      setTransferError(`Insufficient balance! "${fromCat.name}" has ৳${available.toLocaleString('en-US')} in ${transferFromMethod}.`);
      return;
    }

    const newTransfer: OthersFundTransfer = {
      id: 'of-tr-' + Date.now(),
      date: transferDate || new Date().toISOString().split('T')[0],
      amount: amt,
      fromFundId: fromCat.id,
      fromFundName: fromCat.name,
      toFundId: toCat.id,
      toFundName: toCat.name,
      fromMethod: transferFromMethod,
      toMethod: transferToMethod,
      note: transferNote.trim() || `Transfer from ${fromCat.name} (${transferFromMethod}) to ${toCat.name} (${transferToMethod})`,
      createdAt: new Date().toISOString()
    };

    const updated = [newTransfer, ...transfers];
    setTransfers(updated);
    localStorage.setItem(OTHERS_TRANSFERS_KEY, JSON.stringify(updated));
    triggerUpdate();
    setShowTransferModal(false);
    setTransferAmount('');
    setTransferNote('');
    showToast(`৳${amt.toLocaleString('en-US')} transferred successfully!`);
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
      localStorage.setItem(OTHERS_INFLOWS_KEY, JSON.stringify(updated));
      triggerUpdate();
    } else if (type === 'EXPENSE') {
      const updated = expenses.filter(e => e.id !== id);
      setExpenses(updated);
      localStorage.setItem(OTHERS_EXPENSES_KEY, JSON.stringify(updated));
      triggerUpdate();
    } else if (type === 'TRANSFER') {
      const updated = transfers.filter(t => t.id !== id);
      setTransfers(updated);
      localStorage.setItem(OTHERS_TRANSFERS_KEY, JSON.stringify(updated));
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
    fundId: string;
    fundName: string;
    date: string;
    category: string;
    description: string;
    method: string;
    voucher?: string;
    party?: string;
    amount: number;
  };

  const combinedList: CombinedTx[] = [
    ...inflows.map(i => ({
      id: i.id,
      type: 'INFLOW' as const,
      fundId: i.fundId,
      fundName: i.fundName,
      date: i.date,
      category: i.source,
      description: i.description,
      method: i.paymentMethod,
      voucher: i.voucherNo,
      party: i.receivedFrom,
      amount: i.amount
    })),
    ...expenses.map(e => ({
      id: e.id,
      type: 'EXPENSE' as const,
      fundId: e.fundId,
      fundName: e.fundName,
      date: e.date,
      category: e.category,
      description: e.description,
      method: e.paymentMethod,
      voucher: e.voucherNo,
      party: e.paidTo,
      amount: e.amount
    })),
    ...transfers.map(t => ({
      id: t.id,
      type: 'TRANSFER' as const,
      fundId: t.fromFundId,
      fundName: `${t.fromFundName} ➔ ${t.toFundName}`,
      date: t.date,
      category: `${t.fromMethod} ➔ ${t.toMethod}`,
      description: t.note || 'Fund Transfer',
      method: `${t.fromMethod} ➔ ${t.toMethod}`,
      amount: t.amount
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredTransactions = combinedList.filter(item => {
    if (selectedFundId !== 'ALL' && item.fundId !== selectedFundId) return false;
    if (activeTab === 'INFLOW' && item.type !== 'INFLOW') return false;
    if (activeTab === 'EXPENSE' && item.type !== 'EXPENSE') return false;
    if (activeTab === 'TRANSFER' && item.type !== 'TRANSFER') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchFund = item.fundName.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchVoucher = item.voucher?.toLowerCase().includes(q);
      const matchParty = item.party?.toLowerCase().includes(q);
      return matchFund || matchCat || matchDesc || matchVoucher || matchParty;
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
            <Briefcase className="w-6 h-6 text-amber-400" />
            <span>OTHERS FUND</span>
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            WELFARE, MESS, SPORTS, MOSQUE, PROJECT & CUSTOM WELFARE SUB-FUNDS
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setInflowError('');
              setShowInflowModal(true);
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center space-x-1.5 shadow-lg shadow-amber-500/25 active:translate-y-0.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Deposit</span>
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
            <span>- Expense</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTransferError('');
              setShowTransferModal(true);
            }}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-black tracking-wider uppercase transition-colors flex items-center space-x-1.5 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
            <span>Transfer</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewCatError('');
              setShowNewCategoryModal(true);
            }}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black tracking-wider uppercase transition-colors flex items-center space-x-1.5 cursor-pointer"
            title="Create Custom Fund"
          >
            <FolderPlus className="w-4 h-4" />
            <span className="hidden sm:inline">+ New Fund</span>
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

      {/* Sub-Funds Horizontal Badges / Category Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          type="button"
          onClick={() => setSelectedFundId('ALL')}
          className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
            selectedFundId === 'ALL'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-102'
              : 'bg-slate-800/90 text-slate-400 hover:text-white border border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>ALL FUNDS</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900/60 font-mono">
            ৳{getFundBalance().total.toLocaleString('en-US')}
          </span>
        </button>

        {categories.map(cat => {
          const bal = getFundBalance(cat.id);
          const isSelected = selectedFundId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedFundId(cat.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-102'
                  : 'bg-slate-800/90 text-slate-400 hover:text-white border border-slate-700'
              }`}
            >
              <span>{cat.name.split('(')[0].trim()}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${isSelected ? 'bg-slate-950/30 text-slate-950 font-bold' : 'bg-slate-900/60 text-amber-400'}`}>
                ৳{bal.total.toLocaleString('en-US')}
              </span>
            </button>
          );
        })}
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Net Fund */}
        <div className="bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <Briefcase className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              {selectedFundId === 'ALL' ? 'ALL OTHERS FUNDS' : 'SELECTED FUND'}
            </span>
          </div>
          <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-1">
            {selectedFundId === 'ALL' ? 'TOTAL OTHERS FUNDS' : categories.find(c => c.id === selectedFundId)?.name}
          </p>
          <h3 className={`text-4xl font-black tracking-tighter ${currentViewBalances.total >= 0 ? 'text-white' : 'text-rose-400'}`}>
            ৳{currentViewBalances.total.toLocaleString('en-US')}
          </h3>
          <div className="text-[10px] text-slate-400 font-medium mt-2 flex flex-col space-y-0.5">
            <span className="text-emerald-400 font-bold">+ Total Deposits: ৳{currentViewBalances.inflow.toLocaleString('en-US')}</span>
            <span className="text-rose-400 font-bold">- Total Expenses: ৳{currentViewBalances.expense.toLocaleString('en-US')}</span>
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
          <p className="text-[8px] font-black text-emerald-400 tracking-widest uppercase mb-1">TOTAL CASH BALANCE</p>
          <h3 className={`text-4xl font-black tracking-tighter ${currentViewBalances.cash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ৳{currentViewBalances.cash.toLocaleString('en-US')}
          </h3>
          <p className="text-[10px] text-slate-400 font-medium mt-2">
            Available in cash in hand
          </p>
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
          <p className="text-[8px] font-black text-blue-400 tracking-widest uppercase mb-1">TOTAL BANK BALANCE</p>
          <h3 className={`text-4xl font-black tracking-tighter ${currentViewBalances.bank >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            ৳{currentViewBalances.bank.toLocaleString('en-US')}
          </h3>
          <p className="text-[10px] text-slate-400 font-medium mt-2">
            Available in bank balance
          </p>
        </div>
      </div>

      {/* Ledger & Transactions Section */}
      <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-amber-400" />
              <span>OTHERS FUND LEDGER & LOGS</span>
            </h3>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search (Fund / category / remarks)..."
                className="pl-8 pr-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 w-44 sm:w-60"
              />
            </div>
          </div>

          {/* Tab Filter */}
          <div className="flex bg-slate-800 rounded-xl p-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-3 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'ALL' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              ALL ({filteredTransactions.length})
            </button>
            <button
              onClick={() => setActiveTab('INFLOW')}
              className={`px-3 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'INFLOW' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              DEPOSITS ({inflows.length})
            </button>
            <button
              onClick={() => setActiveTab('EXPENSE')}
              className={`px-3 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'EXPENSE' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              EXPENSES ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('TRANSFER')}
              className={`px-3 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'TRANSFER' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              TRANSFERS ({transfers.length})
            </button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                <th className="p-4">Date</th>
                <th className="p-4">Fund Name</th>
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
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-bold">
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                    <td className="p-4 font-mono">{formatCanteenDate(tx.date)}</td>
                    <td className="p-4">
                      <span className="font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/40 text-[11px]">
                        {tx.fundName}
                      </span>
                    </td>
                    <td className="p-4">
                      {tx.type === 'INFLOW' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-950/80 text-emerald-400 border border-emerald-800/50">
                          <ArrowDownRight className="w-3 h-3" /> Deposit
                        </span>
                      )}
                      {tx.type === 'EXPENSE' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-950/80 text-rose-400 border border-rose-800/50">
                          <ArrowUpRight className="w-3 h-3" /> Expense
                        </span>
                      )}
                      {tx.type === 'TRANSFER' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-indigo-950/80 text-indigo-400 border border-indigo-800/50">
                          <ArrowRightLeft className="w-3 h-3" /> Transfer
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
                        tx.method.includes('CASH') 
                          ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40' 
                          : 'bg-blue-900/30 text-blue-400 border border-blue-800/40'
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
                            desc: tx.description || tx.category || 'Record',
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

      {/* MODAL 1: ADD DEPOSIT / INFLOW */}
      {showInflowModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <span>Deposit to Fund</span>
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
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Target Fund *</label>
                <select
                  value={inflowFundId}
                  onChange={e => setInflowFundId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-bold outline-none focus:border-amber-500"
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={inflowDate}
                    onChange={e => setInflowDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Amount (৳) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="৳ 0.00"
                    value={inflowAmount}
                    onChange={e => setInflowAmount(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-amber-400 font-bold font-mono text-sm outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Method *</label>
                  <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setInflowMethod('CASH')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${inflowMethod === 'CASH' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      CASH
                    </button>
                    <button
                      type="button"
                      onClick={() => setInflowMethod('BANK')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${inflowMethod === 'BANK' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      BANK
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Source / Purpose</label>
                  <input
                    type="text"
                    placeholder="e.g. Contribution / Grant / Sponsor"
                    value={inflowSource}
                    onChange={e => setInflowSource(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Voucher No</label>
                  <input
                    type="text"
                    placeholder="e.g. VR-990"
                    value={inflowVoucher}
                    onChange={e => setInflowVoucher(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Received From</label>
                  <input
                    type="text"
                    placeholder="e.g. Member name / Officer"
                    value={inflowReceivedFrom}
                    onChange={e => setInflowReceivedFrom(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Detailed remarks..."
                  value={inflowDesc}
                  onChange={e => setInflowDesc(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowInflowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
                >
                  Confirm Deposit
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
                <span>Record Expense</span>
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
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Select Source Fund *</label>
                <select
                  value={expenseFundId}
                  onChange={e => setExpenseFundId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-rose-300 font-bold outline-none focus:border-rose-500"
                >
                  {categories.map(c => {
                    const b = getFundBalance(c.id);
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} (Balance: ৳{b.total.toLocaleString('en-US')})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expense Amount (৳) *</label>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Payment Method *</label>
                  <div className="flex bg-slate-800 rounded-xl p-1 border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setExpenseMethod('CASH')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${expenseMethod === 'CASH' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      CASH
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpenseMethod('BANK')}
                      className={`flex-1 py-1.5 rounded-lg font-bold text-[11px] transition-colors cursor-pointer ${expenseMethod === 'BANK' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      BANK
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expense Category</label>
                  <input
                    type="text"
                    placeholder="e.g. Equipment / Refreshment / Maintenance"
                    value={expenseCategory}
                    onChange={e => setExpenseCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Bill / Voucher No</label>
                  <input
                    type="text"
                    placeholder="e.g. BILL-102"
                    value={expenseVoucher}
                    onChange={e => setExpenseVoucher(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Paid To</label>
                  <input
                    type="text"
                    placeholder="e.g. Vendor / Recipient"
                    value={expensePaidTo}
                    onChange={e => setExpensePaidTo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description / Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Purpose of expense..."
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
                >
                  Confirm Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: TRANSFER */}
      {showTransferModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
                <span>Fund Transfer</span>
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

            <form onSubmit={handleSaveTransfer} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-800/60 rounded-2xl border border-slate-700">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">From Fund:</span>
                  <select
                    value={transferFromFundId}
                    onChange={e => setTransferFromFundId(e.target.value)}
                    className="w-full bg-slate-700 text-white font-bold p-2 rounded-xl border border-slate-600 outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-1 mt-2">
                    <button
                      type="button"
                      onClick={() => setTransferFromMethod('CASH')}
                      className={`flex-1 py-1 rounded text-[10px] font-bold ${transferFromMethod === 'CASH' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      CASH
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferFromMethod('BANK')}
                      className={`flex-1 py-1 rounded text-[10px] font-bold ${transferFromMethod === 'BANK' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      BANK
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">To Fund:</span>
                  <select
                    value={transferToFundId}
                    onChange={e => setTransferToFundId(e.target.value)}
                    className="w-full bg-slate-700 text-white font-bold p-2 rounded-xl border border-slate-600 outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="flex gap-1 mt-2">
                    <button
                      type="button"
                      onClick={() => setTransferToMethod('CASH')}
                      className={`flex-1 py-1 rounded text-[10px] font-bold ${transferToMethod === 'CASH' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      CASH
                    </button>
                    <button
                      type="button"
                      onClick={() => setTransferToMethod('BANK')}
                      className={`flex-1 py-1 rounded text-[10px] font-bold ${transferToMethod === 'BANK' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      BANK
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Transfer Amount (৳) *</label>
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
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={transferDate}
                    onChange={e => setTransferDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Note / Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Fund rebalance / Cash replenishment..."
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
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                >
                  Complete Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE CUSTOM FUND CATEGORY */}
      {showNewCategoryModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl w-full max-w-md p-6 shadow-2xl relative text-white space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-amber-400" />
                <span>Create Custom Fund</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowNewCategoryModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {newCatError && (
              <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{newCatError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCategory} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fund Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Special Welfare Project Fund"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewCategoryModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-black shadow-lg shadow-amber-600/30 transition-all cursor-pointer"
                >
                  Create Fund
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
                  <h4 className="text-base font-black text-white">Record deleted successfully!</h4>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-2">{deleteSuccessData.desc}</p>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex justify-between items-center text-slate-300">
                  <span>Amount Removed:</span>
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
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6 animate-pulse" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="text-base font-black text-white">Delete Record?</h4>
                  <p className="text-xs text-slate-400">
                    Are you sure you want to delete the record <strong className="text-white">"{deleteConfirmTx.desc}"</strong> of{' '}
                    <strong className="text-rose-400 font-mono">৳{deleteConfirmTx.amount.toLocaleString()}</strong>?
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmTx(null)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={executeDeleteRecord}
                    className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-rose-950/50 cursor-pointer active:scale-95"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
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

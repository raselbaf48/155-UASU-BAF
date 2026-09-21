import React, { useState, useEffect } from 'react';
import { 
  Wallet, Landmark, CreditCard, Receipt, ArrowRightLeft, 
  X, RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';
import { ExpenseRecord } from './Expenditures';

export interface FundTransfer {
  id: string;
  date: string;
  from: 'CASH' | 'UCB';
  to: 'CASH' | 'UCB';
  amount: number;
  note?: string;
}

const TRANSFERS_KEY = 'canteen_fund_transfers';
const TXS_KEY = 'canteen_txs';
const EXPENSES_KEY = 'canteen_expenses';

export const CanteenFund: React.FC = () => {
  const [reports, setReports] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [transfers, setTransfers] = useState<FundTransfer[]>([]);
  
  const [activeTab, setActiveTab] = useState<'CASH' | 'UCB' | 'TRANSFERS' | 'EXPENSES'>('CASH');

  // Transfer Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFrom, setTransferFrom] = useState<'CASH' | 'UCB'>('CASH');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [transferNote, setTransferNote] = useState<string>('');
  const [transferError, setTransferError] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string>('');

  const loadData = () => {
    try {
      const rawTxs = localStorage.getItem(TXS_KEY);
      const txs = rawTxs ? JSON.parse(rawTxs) : [];
      setReports(Array.isArray(txs) ? txs : []);
    } catch (_err) {
      setReports([]);
    }

    try {
      const rawExps = localStorage.getItem(EXPENSES_KEY);
      const exps = rawExps ? JSON.parse(rawExps) : [];
      setExpenses(Array.isArray(exps) ? exps : []);
    } catch (_err) {
      setExpenses([]);
    }

    try {
      const rawTrs = localStorage.getItem(TRANSFERS_KEY);
      const trs = rawTrs ? JSON.parse(rawTrs) : [];
      setTransfers(Array.isArray(trs) ? trs : []);
    } catch (_err) {
      setTransfers([]);
    }
  };

  useEffect(() => {
    loadData();

    const handleSync = () => loadData();
    window.addEventListener('canteen_txs_updated', handleSync);
    window.addEventListener('canteen_expenses_updated', handleSync);
    window.addEventListener('canteen_transfers_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('canteen_txs_updated', handleSync);
      window.removeEventListener('canteen_expenses_updated', handleSync);
      window.removeEventListener('canteen_transfers_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // 1. Inflow from Bill Payments
  const billPaymentCash = reports
    .filter(r => r.type === 'BILL PAYMENT' && String(r.gateway || '').toUpperCase() === 'CASH')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  const billPaymentUCB = reports
    .filter(r => r.type === 'BILL PAYMENT' && String(r.gateway || '').toUpperCase() === 'UCB')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  // 2. Outflow from Expenditures
  const expenseCash = expenses
    .filter(exp => String(exp.paymentMethod || 'Cash').toLowerCase() === 'cash')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const expenseUCB = expenses
    .filter(exp => String(exp.paymentMethod || '').toLowerCase() === 'ucb')
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // 3. Transfers In/Out
  // Cash To UCB: Cash decreases, UCB increases
  const cashToUcbTotal = transfers
    .filter(t => t.from === 'CASH' && t.to === 'UCB')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  // UCB To Cash: UCB decreases, Cash increases
  const ucbToCashTotal = transfers
    .filter(t => t.from === 'UCB' && t.to === 'CASH')
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  // Net Balances
  const totalCash = billPaymentCash - expenseCash - cashToUcbTotal + ucbToCashTotal;
  const totalUCB = billPaymentUCB - expenseUCB + cashToUcbTotal - ucbToCashTotal;
  const totalFund = totalCash + totalUCB;

  // Lists for logs
  const cashPayments = reports.filter(r => r.type === 'BILL PAYMENT' && String(r.gateway || '').toUpperCase() === 'CASH');
  const ucbPayments = reports.filter(r => r.type === 'BILL PAYMENT' && String(r.gateway || '').toUpperCase() === 'UCB');

  const cashExpenses = expenses.filter(e => String(e.paymentMethod || 'Cash').toLowerCase() === 'cash');
  const ucbExpenses = expenses.filter(e => String(e.paymentMethod || '').toLowerCase() === 'ucb');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Handle Transfer Submit
  const handleExecuteTransfer = () => {
    setTransferError('');
    const amt = parseFloat(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      setTransferError('অনুগ্রহ করে সঠিক টাকার পরিমাণ লিখুন (Amount > 0)');
      return;
    }

    const sourceFundBalance = transferFrom === 'CASH' ? totalCash : totalUCB;
    if (amt > sourceFundBalance) {
      setTransferError(`পর্যাপ্ত ব্যালেন্স নেই! ${transferFrom} ফান্ডে বর্তমান ব্যালেন্স ৳${sourceFundBalance}`);
      return;
    }

    const transferTo: 'CASH' | 'UCB' = transferFrom === 'CASH' ? 'UCB' : 'CASH';

    const newTransfer: FundTransfer = {
      id: 'tr-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: formatCanteenDate(new Date()),
      from: transferFrom,
      to: transferTo,
      amount: amt,
      note: transferNote.trim() || `Fund transfer from ${transferFrom} to ${transferTo}`
    };

    const updatedTransfers = [newTransfer, ...transfers];
    setTransfers(updatedTransfers);
    try {
      localStorage.setItem(TRANSFERS_KEY, JSON.stringify(updatedTransfers));
      window.dispatchEvent(new Event('canteen_transfers_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error('Failed to save fund transfer:', err);
    }

    setShowTransferModal(false);
    setTransferAmount('');
    setTransferNote('');
    showToast(`৳${amt.toLocaleString('en-US')} সফলভাবে ${transferFrom} থেকে ${transferTo}-এ ট্রান্সফার করা হয়েছে!`);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-600 text-white font-bold px-5 py-3 rounded-2xl shadow-xl border border-emerald-400/40 flex items-center space-x-2 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
            <Wallet className="w-6 h-6 text-indigo-500" />
            CANTEEN FUND
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            PAYMENT COLLECTIONS, EXPENDITURE DEDUCTIONS & FUND TRANSFERS
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Transfer Button */}
          <button
            type="button"
            onClick={() => {
              setTransferError('');
              setTransferAmount('');
              setTransferNote('');
              setShowTransferModal(true);
            }}
            className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center space-x-2 shadow-lg shadow-indigo-500/25 active:translate-y-0.5 cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>TRANSFER FUND</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black tracking-wider uppercase transition-colors flex items-center space-x-1.5 border border-slate-700"
            title="Refresh Fund Data"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">SYNC</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards (Reflecting real balance = Collections - Expenditures +/- Transfers) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Fund */}
        <div className="bg-slate-900 rounded-[2rem] p-6 shadow-sm border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-900/30 text-indigo-500 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              NET FUND
            </span>
          </div>
          <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-1">TOTAL CURRENT FUND</p>
          <h3 className={`text-4xl font-black tracking-tighter ${totalFund >= 0 ? 'text-white' : 'text-rose-400'}`}>
            ৳{totalFund.toLocaleString('en-US')}
          </h3>
          <p className="text-[10px] text-slate-500 font-medium mt-2">
            নগদ ও ব্যাংক (UCB) মোট সংরক্ষিত বর্তমান তহবিল
          </p>
        </div>

        {/* Total Cash */}
        <div className="bg-emerald-900/20 rounded-[2rem] p-6 shadow-sm border border-emerald-900/40">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-900/50 text-emerald-300 flex items-center justify-center">
              <Landmark className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              CASH IN HAND
            </span>
          </div>
          <p className="text-[8px] font-black text-emerald-400 tracking-widest uppercase mb-1">TOTAL CASH</p>
          <h3 className={`text-4xl font-black tracking-tighter ${totalCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            ৳{totalCash.toLocaleString('en-US')}
          </h3>
          <div className="text-[10px] text-slate-400 font-medium mt-2 flex flex-col space-y-0.5">
            <span className="text-emerald-400/90 font-bold">+ বিল কালেকশন: ৳{billPaymentCash.toLocaleString('en-US')}</span>
            <span className="text-rose-400/90 font-bold">- খরচ বিয়োগ: ৳{expenseCash.toLocaleString('en-US')}</span>
            {(cashToUcbTotal > 0 || ucbToCashTotal > 0) && (
              <span className="text-indigo-400/90 font-bold">
                +/- ট্রান্সফার: {ucbToCashTotal - cashToUcbTotal >= 0 ? `+৳${(ucbToCashTotal - cashToUcbTotal).toLocaleString('en-US')}` : `-৳${Math.abs(ucbToCashTotal - cashToUcbTotal).toLocaleString('en-US')}`}
              </span>
            )}
          </div>
        </div>

        {/* Total UCB */}
        <div className="bg-blue-900/20 rounded-[2rem] p-6 shadow-sm border border-blue-900/40">
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-900/50 text-blue-300 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md uppercase tracking-wider">
              BANK / UCB
            </span>
          </div>
          <p className="text-[8px] font-black text-blue-400 tracking-widest uppercase mb-1">TOTAL UCB</p>
          <h3 className={`text-4xl font-black tracking-tighter ${totalUCB >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            ৳{totalUCB.toLocaleString('en-US')}
          </h3>
          <div className="text-[10px] text-slate-400 font-medium mt-2 flex flex-col space-y-0.5">
            <span className="text-blue-400/90 font-bold">+ বিল কালেকশন: ৳{billPaymentUCB.toLocaleString('en-US')}</span>
            <span className="text-rose-400/90 font-bold">- খরচ বিয়োগ: ৳{expenseUCB.toLocaleString('en-US')}</span>
            {(cashToUcbTotal > 0 || ucbToCashTotal > 0) && (
              <span className="text-indigo-400/90 font-bold">
                +/- ট্রান্সফার: {cashToUcbTotal - ucbToCashTotal >= 0 ? `+৳${(cashToUcbTotal - ucbToCashTotal).toLocaleString('en-US')}` : `-৳${Math.abs(cashToUcbTotal - ucbToCashTotal).toLocaleString('en-US')}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Statement & Activity Section */}
      <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center space-x-2">
            <Receipt className="w-4 h-4 text-indigo-500" />
            <span>FUND LEDGER & LOGS</span>
          </h3>
          
          <div className="flex bg-slate-800 rounded-xl p-1 overflow-x-auto">
            <button 
              onClick={() => setActiveTab('CASH')}
              className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'CASH' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              CASH INFLOW ({cashPayments.length})
            </button>
            <button 
              onClick={() => setActiveTab('UCB')}
              className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'UCB' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              UCB INFLOW ({ucbPayments.length})
            </button>
            <button 
              onClick={() => setActiveTab('EXPENSES')}
              className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'EXPENSES' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              EXPENSE DEDUCTIONS ({cashExpenses.length + ucbExpenses.length})
            </button>
            <button 
              onClick={() => setActiveTab('TRANSFERS')}
              className={`px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-lg transition-colors whitespace-nowrap ${activeTab === 'TRANSFERS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              TRANSFERS ({transfers.length})
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {/* TAB 1 & 2: Cash / UCB Inflow */}
          {(activeTab === 'CASH' || activeTab === 'UCB') && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                  <th className="p-4">Date</th>
                  <th className="p-4">Member ID / Name</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Gateway</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-300 font-medium">
                {(activeTab === 'CASH' ? cashPayments : ucbPayments).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                      No collections found for {activeTab}
                    </td>
                  </tr>
                ) : (
                  (activeTab === 'CASH' ? cashPayments : ucbPayments).map((tx, idx) => (
                    <tr key={tx.id || idx} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono">{formatCanteenDate(tx.date)}</td>
                      <td className="p-4">
                        <span className="text-indigo-400 font-bold">{tx.memberName || tx.airman_id}</span>
                        {tx.bdNo && <span className="text-slate-500 text-[10px] ml-1.5 font-mono">(BD-{tx.bdNo})</span>}
                      </td>
                      <td className="p-4 text-slate-400">{tx.items || 'Bill Payment'}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase ${activeTab === 'CASH' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40' : 'bg-blue-900/30 text-blue-400 border border-blue-800/40'}`}>
                          {tx.gateway}
                        </span>
                      </td>
                      <td className="p-4 text-right font-black text-emerald-400 font-mono">
                        +৳{Number(tx.amount || 0).toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 3: Expense Deductions */}
          {activeTab === 'EXPENSES' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                  <th className="p-4">Date</th>
                  <th className="p-4">Item Name</th>
                  <th className="p-4">Detailed Person</th>
                  <th className="p-4">Paid From</th>
                  <th className="p-4 text-right">Deducted Amount</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-300 font-medium">
                {expenses.filter(e => {
                  const m = String(e.paymentMethod || 'Cash').toLowerCase();
                  return m === 'cash' || m === 'ucb';
                }).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                      No expenditure deductions found for Cash or UCB
                    </td>
                  </tr>
                ) : (
                  expenses
                    .filter(e => {
                      const m = String(e.paymentMethod || 'Cash').toLowerCase();
                      return m === 'cash' || m === 'ucb';
                    })
                    .map((exp) => (
                      <tr key={exp.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                        <td className="p-4 font-mono">{formatCanteenDate(exp.date)}</td>
                        <td className="p-4 font-bold text-white uppercase">{exp.desc}</td>
                        <td className="p-4 text-slate-400">{exp.detailedPerson || 'Civ Tanvir'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase ${String(exp.paymentMethod).toLowerCase() === 'ucb' ? 'bg-blue-900/30 text-blue-400 border border-blue-800/40' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-800/40'}`}>
                            {exp.paymentMethod || 'Cash'}
                          </span>
                        </td>
                        <td className="p-4 text-right font-black text-rose-400 font-mono">
                          -৳{Number(exp.amount || 0).toLocaleString('en-US')}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}

          {/* TAB 4: Fund Transfers */}
          {activeTab === 'TRANSFERS' && (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                  <th className="p-4">Date</th>
                  <th className="p-4">From Account</th>
                  <th className="p-4">To Account</th>
                  <th className="p-4">Transfer Note</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="text-xs text-slate-300 font-medium">
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                      No fund transfers recorded yet. Use &quot;TRANSFER FUND&quot; to transfer between Cash and UCB.
                    </td>
                  </tr>
                ) : (
                  transfers.map((tr) => (
                    <tr key={tr.id} className="border-b border-slate-800/50 hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 font-mono">{formatCanteenDate(tr.date)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase ${tr.from === 'CASH' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                          {tr.from}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[8px] font-black tracking-widest uppercase ${tr.to === 'CASH' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                          {tr.to}
                        </span>
                      </td>
                      <td className="p-4 text-slate-400">{tr.note || '-'}</td>
                      <td className="p-4 text-right font-black text-indigo-400 font-mono">
                        ৳{Number(tr.amount || 0).toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Fund Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[180] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-6">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    FUND TRANSFER
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cash এবং UCB ফান্ডের মধ্যে টাকা স্থানান্তর করুন
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Message */}
            {transferError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            <div className="space-y-4">
              {/* Transfer Direction Selector */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">
                  TRANSFER DIRECTION (কোথা থেকে কোথায়)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTransferFrom('CASH')}
                    className={`py-3 px-4 rounded-xl text-xs font-black transition-all border flex flex-col items-center space-y-1 ${
                      transferFrom === 'CASH'
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 font-bold">CASH → UCB</span>
                    <span className="font-mono text-xs">Cash Available: ৳{totalCash}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTransferFrom('UCB')}
                    className={`py-3 px-4 rounded-xl text-xs font-black transition-all border flex flex-col items-center space-y-1 ${
                      transferFrom === 'UCB'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-md'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="text-[10px] text-slate-400 font-bold">UCB → CASH</span>
                    <span className="font-mono text-xs">UCB Available: ৳{totalUCB}</span>
                  </button>
                </div>
              </div>

              {/* Transfer Amount */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  TRANSFER AMOUNT (টাকা ৳)
                </label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-lg font-black font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Optional Note */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  NOTE / বিবরণ (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Bank cash deposit / Canteen petty cash"
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleExecuteTransfer}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/25"
              >
                CONFIRM TRANSFER
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

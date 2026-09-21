import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Banknote, X, Save, Edit2, AlertTriangle, CheckCircle2, Calendar, Tag, FileText, ArrowLeft } from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';

export interface ExpenseRecord {
  id: string | number;
  date: string;
  desc: string;
  subdesc?: string;
  category: string;
  amount: number;
}

const STORAGE_KEY = 'canteen_expenses';

export const Expenditures: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPage, setIsAddPage] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // State for adding a new expense
  const [newExpense, setNewExpense] = useState({
    date: formatCanteenDate(new Date()),
    desc: '',
    subdesc: '',
    category: 'FOOD ITEMS',
    amount: 0
  });

  // State for editing/deleting an existing row
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Sync with localStorage & events
  useEffect(() => {
    const handleSync = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        setExpenses(raw ? JSON.parse(raw) : []);
      } catch {
        setExpenses([]);
      }
    };

    window.addEventListener('canteen_expenses_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('canteen_expenses_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const saveToStorage = (updated: ExpenseRecord[]) => {
    setExpenses(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new Event('canteen_expenses_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
    } catch (err) {
      console.warn('Failed to save expenses:', err);
    }
  };

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAdd = () => {
    if (!newExpense.desc.trim() || Number(newExpense.amount) <= 0) return;
    const record: ExpenseRecord = {
      id: 'exp-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: newExpense.date ? formatCanteenDate(newExpense.date) : formatCanteenDate(new Date()),
      desc: newExpense.desc.trim().toUpperCase(),
      subdesc: newExpense.subdesc.trim(),
      category: newExpense.category,
      amount: Number(newExpense.amount) || 0
    };

    const updated = [record, ...expenses];
    saveToStorage(updated);
    setIsAddPage(false);
    setNewExpense({
      date: formatCanteenDate(new Date()),
      desc: '',
      subdesc: '',
      category: 'FOOD ITEMS',
      amount: 0
    });
    showToast('নতুন খরচের এন্ট্রি সফলভাবে যুক্ত করা হয়েছে!');
  };

  const handleOpenEdit = (expense: ExpenseRecord) => {
    setEditingExpense({ ...expense });
    setConfirmDeleteId(null);
  };

  const handleUpdateExpense = () => {
    if (!editingExpense || !editingExpense.desc.trim() || Number(editingExpense.amount) <= 0) return;

    const updatedList = expenses.map(e => {
      if (e.id === editingExpense.id) {
        return {
          ...editingExpense,
          date: formatCanteenDate(editingExpense.date),
          desc: editingExpense.desc.trim().toUpperCase(),
          subdesc: editingExpense.subdesc?.trim() || '',
          amount: Number(editingExpense.amount) || 0
        };
      }
      return e;
    });

    saveToStorage(updatedList);
    setEditingExpense(null);
    showToast('খরচের রেকর্ড সফলভাবে হালনাগাদ করা হয়েছে!');
  };

  const handleDelete = (id: string | number) => {
    const updated = expenses.filter(e => e.id !== id);
    saveToStorage(updated);
    if (editingExpense && editingExpense.id === id) {
      setEditingExpense(null);
    }
    setConfirmDeleteId(null);
    showToast('রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে!');
  };

  const total = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const filtered = expenses.filter(e => {
    const term = searchTerm.toLowerCase();
    return (
      e.desc.toLowerCase().includes(term) ||
      (e.subdesc && e.subdesc.toLowerCase().includes(term)) ||
      e.category.toLowerCase().includes(term) ||
      e.date.toLowerCase().includes(term)
    );
  });

  // Dedicated Separate Page for Adding Record
  if (isAddPage) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
        {/* Toast Notification */}
        {notification && (
          <div className="fixed top-6 right-6 z-[200] bg-emerald-500 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-2 animate-in slide-in-from-top-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="text-xs">{notification}</span>
          </div>
        )}

        {/* Back Button & Header */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setIsAddPage(false)}
            className="flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-colors border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK TO EXPENDITURES</span>
          </button>
        </div>

        {/* Form Page Card */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-slate-800 space-y-8">
          <div className="border-b border-slate-800 pb-6 flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Plus className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight uppercase">
                ADD NEW EXPENDITURE
              </h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                ক্যান্টিনের নতুন খরচের হিসাব অন্তর্ভুক্ত করুন
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date */}
              <div>
                <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block">
                  DATE (তারিখ)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. 20 Sep 26"
                  value={newExpense.date}
                  onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block">
                  CATEGORY (খরচের ধরণ)
                </label>
                <select 
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                >
                  <option value="FOOD ITEMS">FOOD ITEMS</option>
                  <option value="RAW BAZAR">RAW BAZAR</option>
                  <option value="UTILITIES">UTILITIES</option>
                  <option value="UNSOLD">UNSOLD</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Item / Description */}
              <div>
                <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block">
                  LABEL / ITEM (বিবরণ)
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. CHICKEN, BAZAR, GAS, MILK"
                  value={newExpense.desc}
                  onChange={(e) => setNewExpense({ ...newExpense, desc: e.target.value })}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder-slate-500 uppercase"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block">
                  AMOUNT (টাকার পরিমাণ ৳)
                </label>
                <input 
                  type="number" 
                  placeholder="e.g. 1500"
                  value={newExpense.amount || ''}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder-slate-500"
                />
              </div>
            </div>

            {/* Note / Narration */}
            <div>
              <label className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-2 block">
                DETAILED NOTE / NARRATION (OPTIONAL)
              </label>
              <textarea 
                rows={3}
                placeholder="e.g. Purchased through Civ Tanvir / Cash Memo #402"
                value={newExpense.subdesc}
                onChange={(e) => setNewExpense({ ...newExpense, subdesc: e.target.value })}
                className="w-full bg-slate-800/90 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder-slate-500 resize-none"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-6 border-t border-slate-800 flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => setIsAddPage(false)}
              className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-colors"
            >
              CANCEL
            </button>
            <button 
              type="button"
              onClick={handleAdd}
              className="px-8 py-4 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-2xl text-xs font-black tracking-widest uppercase transition-all shadow-lg shadow-indigo-500/25 flex items-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>SAVE EXPENDITURE RECORD</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-12">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-500 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-2 animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-xs">{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">EXPENDITURES</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              MANAGER OPERATIONS NODE • CLICK ANY ROW TO EDIT OR REMOVE
            </p>
          </div>
        </div>

        <button 
          onClick={() => setIsAddPage(true)} 
          className="flex items-center space-x-2 px-5 py-3 bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-md shadow-indigo-500/20 rounded-xl text-[10px] font-black tracking-widest uppercase transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>ADD RECORD</span>
        </button>
      </div>

      {/* Stats and Search */}
      <div className="flex flex-col md:flex-row gap-6">
        {/* Total Spending */}
        <div className="md:w-1/3 bg-slate-900 rounded-3xl p-8 shadow-sm border-2 border-[#4f46e5] flex flex-col justify-center min-h-[140px]">
          <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">TOTAL SPENDING</p>
          <h3 className="text-4xl font-black text-white tracking-tighter">৳{total.toLocaleString('en-US')}</h3>
          <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase">
            {expenses.length} TOTAL EXPENDITURE RECORDS
          </p>
        </div>

        {/* Search */}
        <div className="md:w-2/3 flex items-center">
          <div className="relative w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search expenses by label, note, category or date..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-full pl-14 pr-6 py-5 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Table Container - Styled identical to Reports without Action Column */}
      <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
        
        {/* Table Header Bar */}
        <div className="p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest">
                EXPENDITURE RECORDS LIST
              </h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {filtered.length} of {expenses.length} records shown • Click any row to edit or remove
              </p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {/* Heading row styled exact same as Report table (Action Column Removed) */}
              <tr className="border-b border-slate-800 bg-slate-950/60">
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">DESCRIPTION</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">CATEGORY</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-14 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    {expenses.length === 0 ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Banknote className="w-8 h-8 text-slate-600 mb-1" />
                        <span className="text-slate-300 font-black">No expenditure records yet</span>
                        <span className="text-slate-500 text-[10px] normal-case">
                          নতুন খরচের হিসাব এন্ট্রি করতে উপরের &quot;+ ADD RECORD&quot; বাটনে ক্লিক করুন।
                        </span>
                      </div>
                    ) : (
                      'No expenditure records matching search criteria'
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((expense) => (
                  <tr 
                    key={expense.id} 
                    onClick={() => handleOpenEdit(expense)}
                    className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                    title="রেকর্ডটি দেখতে, পরিবর্তন বা ডিলিট করতে ক্লিক করুন"
                  >
                    {/* Date */}
                    <td className="py-4 px-6 text-[11px] font-mono font-bold text-slate-300 whitespace-nowrap">
                      {formatCanteenDate(expense.date)}
                    </td>

                    {/* Description & Subdesc */}
                    <td className="py-4 px-6 text-center">
                      <p className="text-xs font-black text-white uppercase group-hover:text-indigo-300 transition-colors">
                        {expense.desc}
                      </p>
                      {expense.subdesc && (
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {expense.subdesc}
                        </p>
                      )}
                    </td>

                    {/* Category */}
                    <td className="py-4 px-6 text-center">
                      <span className="inline-block px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg text-[9px] font-black tracking-widest uppercase">
                        {expense.category}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-4 px-6 text-right text-sm font-black text-white">
                      ৳{Number(expense.amount).toLocaleString('en-US')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row Edit & Delete Modal (Triggered by clicking any row) */}
      {editingExpense && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[160] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-xl shadow-2xl animate-in zoom-in-95 space-y-6">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wide">
                    EDIT / REMOVE EXPENDITURE
                  </h3>
                  <p className="text-xs text-slate-400">
                    খরচের বিবরণ পরিবর্তন করুন অথবা রেকর্ডটি মুছে ফেলুন
                  </p>
                </div>
              </div>

              <button 
                onClick={() => { setEditingExpense(null); setConfirmDeleteId(null); }}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    DATE
                  </label>
                  <input 
                    type="text"
                    value={editingExpense.date}
                    onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                    AMOUNT (৳)
                  </label>
                  <input 
                    type="number"
                    value={editingExpense.amount || ''}
                    onChange={(e) => setEditingExpense({ ...editingExpense, amount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  LABEL / DESCRIPTION
                </label>
                <input 
                  type="text"
                  value={editingExpense.desc}
                  onChange={(e) => setEditingExpense({ ...editingExpense, desc: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                />
              </div>

              {/* Category */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  CATEGORY
                </label>
                <select 
                  value={editingExpense.category}
                  onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="FOOD ITEMS">FOOD ITEMS</option>
                  <option value="RAW BAZAR">RAW BAZAR</option>
                  <option value="UTILITIES">UTILITIES</option>
                  <option value="UNSOLD">UNSOLD</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              {/* Detailed Note */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  DETAILED NOTE / NARRATION
                </label>
                <input 
                  type="text"
                  value={editingExpense.subdesc || ''}
                  onChange={(e) => setEditingExpense({ ...editingExpense, subdesc: e.target.value })}
                  placeholder="Additional narration or note..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDelete(editingExpense.id)}
                className="px-4 py-3 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>REMOVE RECORD</span>
              </button>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => { setEditingExpense(null); setConfirmDeleteId(null); }}
                  className="flex-1 sm:flex-initial px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleUpdateExpense}
                  className="flex-1 sm:flex-initial px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-md shadow-indigo-500/20"
                >
                  <Save className="w-4 h-4" />
                  <span>SAVE CHANGES</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Quick Delete Confirmation Modal */}
      {confirmDeleteId && !editingExpense && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[170] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-black text-white">রেকর্ডটি মুছে ফেলতে চান?</h4>
              <p className="text-xs text-slate-400 mt-1">
                এই খরচের রেকর্ডটি চিরতরে মুছে যাবে।
              </p>
            </div>
            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider"
              >
                মুছে ফেলুন
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

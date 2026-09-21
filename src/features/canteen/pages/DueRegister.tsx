import React, { useState, useEffect } from 'react';
import { 
  Search, Banknote, UserCheck, RefreshCw, Layers, Calendar, Filter, 
  ArrowUpDown, AlertCircle, FileText, CheckCircle2, ChevronRight
} from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';
import { ExpenseRecord } from './Expenditures';

const EXPENSES_STORAGE_KEY = 'canteen_expenses';

export const DueRegister: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<string>('ALL');

  const loadDueExpenses = () => {
    try {
      const raw = localStorage.getItem(EXPENSES_STORAGE_KEY);
      const all: ExpenseRecord[] = raw ? JSON.parse(raw) : [];
      // Only keep records with paymentMethod === 'Due'
      const dueRecords = all.filter(e => String(e.paymentMethod || '').trim().toLowerCase() === 'due');
      setExpenses(dueRecords);
    } catch {
      setExpenses([]);
    }
  };

  useEffect(() => {
    loadDueExpenses();

    const handleSync = () => loadDueExpenses();
    window.addEventListener('canteen_expenses_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('canteen_expenses_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Filter list
  const filtered = expenses.filter((expense) => {
    const matchesSearch = 
      expense.desc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (expense.detailedPerson && expense.detailedPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (expense.date && expense.date.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesPerson = 
      selectedPerson === 'ALL' || (expense.detailedPerson || 'Civ Tanvir') === selectedPerson;

    return matchesSearch && matchesPerson;
  });

  const totalDueAmount = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalDueCount = filtered.length;

  // Extract distinct detailed persons
  const distinctPersons = Array.from(new Set(expenses.map(e => e.detailedPerson || 'Civ Tanvir'))).filter(Boolean);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                DUE REGISTER
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                বাকি খরচের বিবরণী ও হিসাব রেজিস্টার • EXPENDITURE DUE HISTORY
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={loadDueExpenses}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black tracking-wider uppercase transition-colors flex items-center space-x-2 border border-slate-700 shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1">
                TOTAL DUE EXPENDITURES
              </p>
              <h3 className="text-3xl font-black text-amber-400 tracking-tight">
                ৳{totalDueAmount.toLocaleString('en-US')}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            Expenditures-এ পেমেন্ট মেথড Due হিসেবে সংরক্ষিত মোট খরচের পরিমাণ
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1">
                DUE RECORDS COUNT
              </p>
              <h3 className="text-3xl font-black text-white tracking-tight">
                {totalDueCount} <span className="text-sm font-bold text-slate-400">Records</span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileText className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            মোট বকেয়া খরচের এন্ট্রি সংখ্যা
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm sm:col-span-2 md:col-span-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1">
                RESPONSIBLE CIVILIANS
              </p>
              <h3 className="text-2xl font-black text-emerald-400 tracking-tight truncate">
                {distinctPersons.length > 0 ? distinctPersons.join(', ') : 'None'}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-medium">
            বকেয়া খরচের সাথে জড়িত দায়িত্বপ্রাপ্ত ব্যাক্তিবর্গ
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search due items, date, or detailed person..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-sm font-bold text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/60 transition-all"
            />
          </div>

          {/* Filter by detailed person */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap hidden sm:inline">
              PERSON:
            </span>
            <select
              value={selectedPerson}
              onChange={(e) => setSelectedPerson(e.target.value)}
              className="bg-slate-950/60 border border-slate-800 rounded-2xl px-4 py-3 text-xs font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="ALL">ALL CIVILIANS</option>
              {distinctPersons.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table: Exact same heading row structure as Expenditure record list */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">
              DUE EXPENDITURE RECORDS
            </h3>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              Showing {filtered.length} Due Entries
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60">
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">ITEM NAME</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">QTY & UNIT</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">UNIT PRICE</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">DETAILED PERSON</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">PAYMENT METHOD</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                    {expenses.length === 0 ? (
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <Banknote className="w-8 h-8 text-slate-600 mb-1" />
                        <span className="text-slate-300 font-black">No due expenditure records found</span>
                        <span className="text-slate-500 text-[10px] normal-case">
                          Expenditures-এ পেমেন্ট মাধ্যম &quot;Due&quot; সিলেক্ট করে খরচ যোগ করলে এখানে স্বয়ংক্রিয়ভাবে প্রদর্শিত হবে।
                        </span>
                      </div>
                    ) : (
                      'No due records matching search criteria'
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((expense) => (
                  <tr 
                    key={expense.id} 
                    className="hover:bg-slate-800/60 transition-colors group"
                  >
                    {/* Date */}
                    <td className="py-4 px-6 text-[11px] font-mono font-bold text-slate-300 whitespace-nowrap">
                      {formatCanteenDate(expense.date)}
                    </td>

                    {/* Item Name */}
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-2">
                        <p className="text-xs font-black text-white uppercase group-hover:text-amber-300 transition-colors">
                          {expense.desc}
                        </p>
                        {expense.isCustom && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Custom
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Qty & Unit */}
                    <td className="py-4 px-6 text-center text-xs font-bold text-slate-300">
                      {expense.qty !== undefined ? (
                        <span>
                          {expense.qty} <span className="text-slate-500 text-[10px]">{expense.unit || 'kg'}</span>
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Unit Price */}
                    <td className="py-4 px-6 text-center text-xs font-mono font-bold text-amber-300">
                      {expense.unitPrice ? (
                        <span>৳{expense.unitPrice}</span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>

                    {/* Detailed Person */}
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-bold">
                        <UserCheck className="w-3 h-3 mr-1" />
                        <span>{expense.detailedPerson || 'Civ Tanvir'}</span>
                      </span>
                    </td>

                    {/* Payment Method */}
                    <td className="py-4 px-6 text-center">
                      <span className="inline-flex items-center px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-black tracking-wider uppercase">
                        Due
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="py-4 px-6 text-right text-sm font-black text-amber-400">
                      ৳{Number(expense.amount).toLocaleString('en-US')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-800 bg-slate-950/80 font-black">
                  <td colSpan={6} className="py-4 px-6 text-right text-xs uppercase tracking-widest text-slate-400">
                    TOTAL DUE:
                  </td>
                  <td className="py-4 px-6 text-right text-base text-amber-400 font-mono font-black">
                    ৳{totalDueAmount.toLocaleString('en-US')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

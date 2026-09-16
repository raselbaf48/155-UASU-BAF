import React, { useState } from 'react';
import { Search, Plus, Trash2, Banknote, X, Save } from 'lucide-react';

export const Expenditures: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [expenses, setExpenses] = useState([
    { id: 1, date: '9/2/2026', desc: 'CHICKEN', subdesc: 'Civ Tanvir', category: 'OTHER', amount: 2957 },
    { id: 2, date: '9/2/2026', desc: 'BAZAR', subdesc: 'Civ Tanvir', category: 'FOOD ITEMS', amount: 2955 },
    { id: 3, date: '9/2/2026', desc: 'BAZAR', subdesc: 'Civ Tanvir', category: 'FOOD ITEMS', amount: 750 },
    { id: 4, date: '9/2/2026', desc: 'UNSOLD', subdesc: 'Cpl koraishi', category: 'FOOD ITEMS', amount: 2000 },
  ]);

  const [newExpense, setNewExpense] = useState({
      desc: '', subdesc: '', category: 'FOOD ITEMS', amount: 0
  });

  const handleAdd = () => {
      if (!newExpense.desc || newExpense.amount <= 0) return;
      const expense = {
          id: Date.now(),
          date: new Date().toLocaleDateString('en-US'),
          ...newExpense
      };
      setExpenses([expense, ...expenses]);
      setShowAddModal(false);
      setNewExpense({ desc: '', subdesc: '', category: 'FOOD ITEMS', amount: 0 });
  };

  const handleDelete = (id: number) => {
      setExpenses(expenses.filter(e => e.id !== id));
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const filtered = expenses.filter(e => e.desc.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div className="flex items-center space-x-3">
            <Banknote className="w-6 h-6 text-indigo-500" />
            <div>
               <h2 className="text-2xl font-black text-white uppercase tracking-tighter">EXPENDITURES</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MANAGER OPERATIONS NODE</p>
            </div>
         </div>
         <button onClick={() => setShowAddModal(!showAddModal)} className={`flex items-center space-x-2 px-5 py-3 ${showAddModal ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-[#4f46e5] text-white hover:bg-[#4338ca] shadow-md shadow-indigo-500/20'} rounded-xl text-[10px] font-black tracking-widest transition-colors`}>
            {showAddModal ? <span>CLOSE PANEL</span> : <><Plus className="w-4 h-4" /><span>ADD RECORD</span></>}
         </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
         {/* Total Spending */}
         <div className="md:w-1/3 bg-slate-900 rounded-3xl p-8 shadow-sm border-2 border-[#4f46e5] flex flex-col justify-center min-h-[140px]">
            <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">TOTAL SPENDING</p>
            <h3 className="text-4xl font-black text-white tracking-tighter">৳{total.toLocaleString()}</h3>
         </div>
         {/* Search */}
         <div className="md:w-2/3 flex items-center">
            <div className="relative w-full">
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
               <input 
                  type="text" 
                  placeholder="Search expenses..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-full pl-14 pr-6 py-5 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
               />
            </div>
         </div>
      </div>

      {/* Expandable Add Panel */}
      {showAddModal && (
         <div className="bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
               <div>
                  <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2 block">LABEL</label>
                  <input 
                     type="text" 
                     placeholder="e.g. Weekly Raw Vegetables"
                     value={newExpense.desc}
                     onChange={(e) => setNewExpense({...newExpense, desc: e.target.value})}
                     className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder-slate-500"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2 block">AMOUNT (৳)</label>
                  <input 
                     type="number" 
                     placeholder="Price Paid"
                     value={newExpense.amount || ''}
                     onChange={(e) => setNewExpense({...newExpense, amount: parseInt(e.target.value) || 0})}
                     className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder-slate-500"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2 block">CATEGORY</label>
                  <select 
                     value={newExpense.category}
                     onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                     className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                  >
                     <option value="FOOD ITEMS">Food Items</option>
                     <option value="UTILITIES">Utilities</option>
                     <option value="OTHER">Other</option>
                  </select>
               </div>
            </div>
            
            <div className="mb-6">
               <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2 block">DETAILED NOTE (OPTIONAL)</label>
               <input 
                  type="text" 
                  placeholder="Write specifics here..."
                  value={newExpense.subdesc}
                  onChange={(e) => setNewExpense({...newExpense, subdesc: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder-slate-500"
               />
            </div>

            <button 
               onClick={handleAdd}
               className="w-full flex items-center justify-center space-x-2 py-4 bg-[#4f46e5] text-white rounded-2xl text-xs font-black tracking-widest hover:bg-[#4338ca] transition-all shadow-md shadow-indigo-500/20"
            >
               <Save className="w-5 h-5" />
               <span>LOG EXPENSE</span>
            </button>
         </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 rounded-[2rem] shadow-sm border border-slate-800 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-slate-800 bg-slate-800/50">
                     <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE</th>
                     <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">DESCRIPTION</th>
                     <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">CATEGORY</th>
                     <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">AMOUNT</th>
                     <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ACTION</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                  {filtered.map((expense, i) => (
                     <tr key={expense.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-5 px-8 text-xs font-bold text-slate-400 whitespace-nowrap">{expense.date}</td>
                        <td className="py-5 px-8 text-center">
                           <p className="text-xs font-black text-white uppercase">{expense.desc}</p>
                           <p className="text-[10px] font-bold text-slate-400">{expense.subdesc}</p>
                        </td>
                        <td className="py-5 px-8 text-center">
                           <span className="inline-block px-3 py-1 bg-indigo-900/30 text-indigo-500 rounded-full text-[8px] font-black tracking-widest uppercase">
                              {expense.category}
                           </span>
                        </td>
                        <td className="py-5 px-8 text-right text-sm font-black text-white">৳{expense.amount.toLocaleString()}</td>
                        <td className="py-5 px-8 text-center">
                           <button onClick={() => handleDelete(expense.id)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors inline-flex justify-center items-center">
                              <Trash2 className="w-4 h-4" />
                           </button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

    </div>
  );
};

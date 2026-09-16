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
               <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">EXPENDITURES</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MANAGER OPERATIONS NODE</p>
            </div>
         </div>
         <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 px-5 py-3 bg-[#4f46e5] text-white rounded-xl text-[10px] font-black tracking-widest hover:bg-[#4338ca] transition-colors shadow-md shadow-indigo-500/20">
            <Plus className="w-4 h-4" />
            <span>ADD RECORD</span>
         </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
         {/* Total Spending */}
         <div className="md:w-1/3 bg-white rounded-3xl p-8 shadow-sm border-2 border-[#4f46e5] flex flex-col justify-center min-h-[140px]">
            <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-2">TOTAL SPENDING</p>
            <h3 className="text-4xl font-black text-slate-900 tracking-tighter">৳{total.toLocaleString()}</h3>
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
                  className="w-full bg-white border border-slate-200 rounded-full pl-14 pr-6 py-5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
               />
            </div>
         </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
         <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
               <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                     <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">DATE</th>
                     <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">DESCRIPTION</th>
                     <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">CATEGORY</th>
                     <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">AMOUNT</th>
                     <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">ACTION</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {filtered.map((expense, i) => (
                     <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-5 px-8 text-xs font-bold text-slate-500 whitespace-nowrap">{expense.date}</td>
                        <td className="py-5 px-8 text-center">
                           <p className="text-xs font-black text-slate-800 uppercase">{expense.desc}</p>
                           <p className="text-[10px] font-bold text-slate-400">{expense.subdesc}</p>
                        </td>
                        <td className="py-5 px-8 text-center">
                           <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-500 rounded-full text-[8px] font-black tracking-widest uppercase">
                              {expense.category}
                           </span>
                        </td>
                        <td className="py-5 px-8 text-right text-sm font-black text-slate-800">৳{expense.amount.toLocaleString()}</td>
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

      {/* Add Modal */}
      {showAddModal && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-slate-800">ADD EXPENDITURE</h3>
                  <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Description</label>
                     <input 
                        type="text" 
                        value={newExpense.desc}
                        onChange={(e) => setNewExpense({...newExpense, desc: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Sub-Description (Person/Note)</label>
                     <input 
                        type="text" 
                        value={newExpense.subdesc}
                        onChange={(e) => setNewExpense({...newExpense, subdesc: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                     />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Category</label>
                         <select 
                            value={newExpense.category}
                            onChange={(e) => setNewExpense({...newExpense, category: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                         >
                             <option value="FOOD ITEMS">FOOD ITEMS</option>
                             <option value="UTILITIES">UTILITIES</option>
                             <option value="OTHER">OTHER</option>
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Amount (৳)</label>
                         <input 
                            type="number" 
                            value={newExpense.amount || ''}
                            onChange={(e) => setNewExpense({...newExpense, amount: parseInt(e.target.value) || 0})}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                         />
                      </div>
                  </div>
               </div>

               <button 
                  onClick={handleAdd}
                  className="w-full mt-8 flex items-center justify-center space-x-2 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/30"
               >
                  <Save className="w-4 h-4" />
                  <span>RECORD EXPENSE</span>
               </button>
            </div>
         </div>
      )}
    </div>
  );
};

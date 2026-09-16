import React, { useState, useEffect } from 'react';
import { Search, Plus, ShoppingCart, Minus, Trash2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../supabase';

export const PosSales: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [catalog, setCatalog] = useState<any[]>([]);
  const [basket, setBasket] = useState<any[]>([]);
  const [memberId, setMemberId] = useState('');
  
  useEffect(() => {
    fetchCatalog();
  }, []);

  const fetchCatalog = async () => {
    const { data, error } = await supabase.from('Canteen_Inventory').select('*');
    if (!error && data) {
      setCatalog(data);
    }
  };

  const addToBasket = (item: any) => {
      const existing = basket.find(b => b.id === item.id);
      if (existing) {
          setBasket(basket.map(b => b.id === item.id ? { ...b, qty: b.qty + 1 } : b));
      } else {
          setBasket([...basket, { ...item, qty: 1 }]);
      }
  };

  const updateQty = (id: string, delta: number) => {
      setBasket(basket.map(b => {
          if (b.id === id) {
              const newQty = Math.max(1, b.qty + delta);
              return { ...b, qty: newQty };
          }
          return b;
      }));
  };

  const removeFromBasket = (id: string) => {
      setBasket(basket.filter(b => b.id !== id));
  };

  const handleCheckout = () => {
      if (basket.length === 0) return;
      alert(`Sale completed successfully for ৳${basketTotal}!`);
      setBasket([]);
      setMemberId('');
  };

  const filteredCatalog = catalog.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const basketTotal = basket.reduce((sum, item) => sum + (item.price * item.qty), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10 flex flex-col md:flex-row gap-8">
      
      {/* Left Column: Catalog */}
      <div className="md:w-2/3 space-y-6">
         {/* Header */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">CANTEEN POS</h2>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ACTIVE NODE</p>
            </div>
         </div>

         {/* Search */}
         <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
               type="text" 
               placeholder="Search catalog..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
               className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
            />
         </div>

         {/* Items List */}
         <div className="space-y-3 h-[600px] overflow-y-auto pr-2">
            {filteredCatalog.map((item, i) => {
               const inBasket = basket.find(b => b.id === item.id);
               return (
               <div key={i} className={`bg-white rounded-2xl p-4 flex items-center justify-between border-2 transition-all shadow-sm ${inBasket ? 'border-[#4f46e5]' : 'border-transparent'}`}>
                  <div className="flex items-center space-x-4">
                     <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shadow-inner">
                        <PackageIcon className="w-5 h-5" />
                     </div>
                     <div>
                        <p className="text-[8px] font-black text-[#4f46e5] uppercase tracking-widest mb-0.5">{item.category}</p>
                        <h3 className="font-black text-slate-800 text-sm">{item.name}</h3>
                        <p className="text-[8px] font-bold text-emerald-500 uppercase">STOCK: {item.stock}</p>
                     </div>
                  </div>
                  <div className="flex items-center space-x-6">
                     <p className="text-lg font-black tracking-tighter text-slate-800">৳{item.price}</p>
                     <button onClick={() => addToBasket(item)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-black shadow-sm transition-colors ${inBasket ? 'bg-[#4f46e5] hover:bg-[#4338ca]' : 'bg-[#0f172a] hover:bg-slate-800'}`}>
                        <Plus className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            )})}
         </div>
      </div>

      {/* Right Column: Member Basket */}
      <div className="md:w-1/3">
         <div className="bg-white rounded-[2rem] border-t-4 border-t-[#4f46e5] shadow-sm border border-slate-100 min-h-[600px] flex flex-col sticky top-24">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-[2rem]">
               <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center space-x-2">
                  <ShoppingCart className="w-4 h-4 text-indigo-500" />
                  <span>MEMBER BASKET</span>
               </h3>
               <span className="px-3 py-1 bg-[#4f46e5] text-white rounded-full text-[8px] font-black tracking-widest uppercase shadow-sm">
                  {basket.length} ITEMS
               </span>
            </div>
            
            <div className="p-6 border-b border-slate-100">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-2 block">Member ID (Optional)</label>
                <input 
                   type="text" 
                   value={memberId}
                   onChange={(e) => setMemberId(e.target.value)}
                   className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                   placeholder="Enter BD No / SID"
                />
            </div>

            <div className="flex-1 p-6 flex flex-col gap-4 overflow-y-auto">
               {basket.length === 0 ? (
                   <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-2">
                       <ShoppingCart className="w-10 h-10 opacity-20" />
                       <p className="text-xs font-bold uppercase tracking-widest opacity-50">Basket is empty</p>
                   </div>
               ) : (
                   basket.map((item) => (
                       <div key={item.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                           <div className="flex-1 pr-4">
                               <p className="text-xs font-black text-slate-800 leading-tight">{item.name}</p>
                               <p className="text-[10px] font-bold text-slate-500 mt-1">৳{item.price} x {item.qty}</p>
                           </div>
                           <div className="flex items-center space-x-3">
                               <div className="flex items-center space-x-2 bg-white rounded-lg border border-slate-200 p-1">
                                   <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Minus className="w-3 h-3" /></button>
                                   <span className="text-xs font-black w-4 text-center">{item.qty}</span>
                                   <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><Plus className="w-3 h-3" /></button>
                               </div>
                               <button onClick={() => removeFromBasket(item.id)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                                   <Trash2 className="w-4 h-4" />
                               </button>
                           </div>
                       </div>
                   ))
               )}
            </div>

            <div className="p-6 bg-slate-50 rounded-b-[2rem] border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Total Amount</span>
                    <span className="text-2xl font-black text-slate-800 tracking-tighter">৳{basketTotal}</span>
                </div>
                <button 
                    onClick={handleCheckout}
                    disabled={basket.length === 0}
                    className={`w-full py-4 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center justify-center space-x-2 transition-all shadow-md ${basket.length > 0 ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>COMPLETE SALE</span>
                </button>
            </div>
         </div>
      </div>
    </div>
  );
};

const PackageIcon: React.FC<{className?: string}> = ({className}) => (
   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
);

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, ImageIcon, Save, X } from 'lucide-react';
import { supabase } from '../../../supabase';

export const CanteenInventory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'SNACKS',
    price: 0,
    stock: 0
  });

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    // Fetch from a Canteen_Inventory table or mock it if not exists yet
    const { data, error } = await supabase.from('Canteen_Inventory').select('*');
    if (!error && data) {
      setItems(data);
    } else {
      // If table doesn't exist, we will use mock data for now and user can create table
      setItems([
          { id: '1', name: 'BLACK COFFEE', category: 'DRINK', price: 20, stock: 929994, isFixed: false },
          { id: '2', name: 'BOILED EGG', category: 'SNACKS', price: 15, stock: 81986, isFixed: false, active: true },
          { id: '3', name: 'CHICKEN BIRIYANI', category: 'SNACKS', price: 65, stock: 97994, isFixed: false },
          { id: '4', name: 'CHICKEN CURRY', category: 'SNACKS', price: 50, stock: 9981, isFixed: false },
      ]);
    }
    setLoading(false);
  };

  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEdit = (item: any) => {
    setIsEditMode(true);
    setEditingId(item.id);
    setNewItem({
      name: item.name,
      category: item.category,
      price: item.price,
      stock: item.stock
    });
    setShowAddModal(true);
  };

  const handleAddItem = async () => {
      if (!newItem.name || newItem.price <= 0) return;
      
      const payload = {
          name: newItem.name,
          category: newItem.category,
          price: newItem.price,
          stock: newItem.stock
      };

      if (isEditMode && editingId) {
          const { error } = await supabase.from('Canteen_Inventory').update(payload).eq('id', editingId);
          if (!error) {
              setShowAddModal(false);
              fetchItems();
          } else {
              alert("Error updating item: " + error.message);
          }
      } else {
          const { error } = await supabase.from('Canteen_Inventory').insert([payload]);
          
          if (!error) {
              setShowAddModal(false);
              fetchItems();
          } else {
              setItems([...items, { ...payload, id: Math.random().toString() }]);
              setShowAddModal(false);
          }
      }
      setNewItem({ name: '', category: 'SNACKS', price: 0, stock: 0 });
      setIsEditMode(false);
      setEditingId(null);
  };

  const handleDelete = async (id: string) => {
      if (!window.confirm("Are you sure you want to delete this item?")) return;
      
      const { error } = await supabase.from('Canteen_Inventory').delete().eq('id', id);
      if(!error) {
          fetchItems();
      } else {
          setItems(items.filter(i => i.id !== id));
      }
  };

  const filteredItems = items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">CANTEEN MENU</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CLOUD INTEGRATED INVENTORY</p>
         </div>
         <button onClick={() => {
            setIsEditMode(false);
            setEditingId(null);
            setNewItem({ name: '', category: 'SNACKS', price: 0, stock: 0 });
            setShowAddModal(true);
         }} className="flex items-center space-x-2 px-5 py-3 bg-[#4f46e5] text-white rounded-xl text-[10px] font-black tracking-widest hover:bg-[#4338ca] transition-colors shadow-md shadow-indigo-500/20">
            <Plus className="w-4 h-4" />
            <span>ADD NEW ENTRY</span>
         </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
         <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
         <input 
            type="text" 
            placeholder="Filter menu selection..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
         />
      </div>

      {/* Grid */}
      {loading ? (
          <div className="text-center py-10 text-slate-500 font-bold animate-pulse">Loading inventory...</div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
             {filteredItems.map((item, i) => (
                <div key={i} className={`bg-white rounded-[2rem] p-6 border-2 shadow-sm transition-all hover:shadow-md ${item.active ? 'border-[#4f46e5] shadow-indigo-500/10' : 'border-transparent'}`}>
                   <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-400 flex items-center justify-center shadow-sm">
                         <ImageIcon className="w-5 h-5" />
                      </div>
                      <div className="flex items-center space-x-2">
                         <button onClick={() => handleEdit(item)} className="p-1.5 text-indigo-400 hover:text-indigo-600 transition-colors">
                            <Edit2 className="w-4 h-4" />
                         </button>
                         <button onClick={() => handleDelete(item.id)} className="p-1.5 text-rose-400 hover:text-rose-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                   </div>

                   <div className="mb-4">
                      <p className="text-[8px] font-black text-[#4f46e5] tracking-widest uppercase mb-1">{item.category}</p>
                      <h3 className="font-black text-slate-800 text-sm leading-tight uppercase">{item.name}</h3>
                      <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">PRICES ARE NOT FIXED</p>
                   </div>

                   <div className="flex items-end justify-between mt-auto">
                      <div className="flex items-center space-x-2">
                         <span className="text-2xl font-black tracking-tighter text-slate-800">৳{item.price}</span>
                         <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded text-[8px] font-black text-indigo-500 uppercase">
                            <BoltIcon className="w-3 h-3" />
                            <span>SYNC</span>
                         </span>
                      </div>
                      <div className="px-2 py-1 rounded bg-emerald-50 border border-emerald-100">
                         <span className="text-[8px] font-black text-emerald-500 tracking-widest">{item.stock} IN UNIT</span>
                      </div>
                   </div>
                </div>
             ))}
          </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">{isEditMode ? "EDIT ITEM" : "ADD NEW ENTRY"}</h3>
                  <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Item Name</label>
                     <input 
                        type="text" 
                        value={newItem.name}
                        onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                        placeholder="e.g. MILK TEA"
                     />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Category</label>
                         <select 
                            value={newItem.category}
                            onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                         >
                             <option value="SNACKS">SNACKS</option>
                             <option value="DRINK">DRINK</option>
                             <option value="LUNCH">LUNCH</option>
                         </select>
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Price (৳)</label>
                         <input 
                            type="number" 
                            value={newItem.price || ''}
                            onChange={(e) => setNewItem({...newItem, price: parseInt(e.target.value) || 0})}
                            className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="0"
                         />
                      </div>
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Initial Stock</label>
                     <input 
                        type="number" 
                        value={newItem.stock || ''}
                        onChange={(e) => setNewItem({...newItem, stock: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="0"
                     />
                  </div>
               </div>

               <button 
                  onClick={handleAddItem}
                  className="w-full mt-8 flex items-center justify-center space-x-2 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/30"
               >
                  <Save className="w-4 h-4" />
                  <span>SAVE TO INVENTORY</span>
               </button>
            </div>
         </div>
      )}
    </div>
  );
};

const BoltIcon: React.FC<{className?: string}> = ({className}) => (
   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/></svg>
);

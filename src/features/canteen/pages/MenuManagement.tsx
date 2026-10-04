import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../i18n';
import { Coffee, Plus, Calendar, X, Utensils } from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl } from '../utils/canteenSettings';
import { queuePushKeyToCloud } from '../utils/canteenCloudSync';

export const MenuManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const [items, setItems] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('canteen_menu_items_list');
      return raw ? JSON.parse(raw) : [
        { id: '1', meal: 'Snacks', name_bn: 'সিঙ্গারা ও চা', name_en: 'Singara & Tea', price: 20, max: 50, DP: '' },
        { id: '2', meal: 'Snacks', name_bn: 'সমুচা ও কফি', name_en: 'Samoosa & Coffee', price: 30, max: 40, DP: '' },
      ];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const fetchCloudMenu = async () => {
      try {
        const { data, error } = await supabase.from('Canteen_Menu').select('*');
        if (!error && data && data.length > 0) {
          const mapped = data.map((d: any) => ({
            id: d.id,
            meal: d.category || 'Snacks',
            name_bn: d.name,
            name_en: d.name,
            price: d.price || 0,
            max: d.stock || 50,
            DP: d.DP || d.img || ''
          }));
          setItems(mapped);
          localStorage.setItem('canteen_menu_items_list', JSON.stringify(mapped));
        }
      } catch (e) {
        console.warn('Could not fetch cloud menu in MenuManagement:', e);
      }
    };
    fetchCloudMenu();
  }, []);

  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name_bn: '', name_en: '', price: '', max: '', DP: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem = {
        id: Date.now().toString(),
        meal: 'Snacks',
        name_bn: formData.name_bn,
        name_en: formData.name_en,
        price: Number(formData.price),
        max: Number(formData.max),
        DP: formData.DP.trim()
    };
    const updated = [...items, newItem];
    setItems(updated);
    localStorage.setItem('canteen_menu_items_list', JSON.stringify(updated));
    queuePushKeyToCloud('canteen_daily_menu');
    setShowAdd(false);
    setFormData({ name_bn: '', name_en: '', price: '', max: '', DP: '' });
  };

  const handleDelete = (id: string) => {
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    localStorage.setItem('canteen_menu_items_list', JSON.stringify(updated));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white dark:text-white flex items-center space-x-2">
           <Coffee className="w-6 h-6 text-emerald-600" />
           <span>{t('menu_management')}</span>
        </h2>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="date" className="pl-9 pr-4 py-2 bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none w-full md:w-48 font-medium text-slate-300" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
          <button className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-sm">
            <span>{t('publish_menu')}</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900 dark:bg-slate-900 rounded-2xl border border-slate-700 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 dark:border-slate-800 bg-slate-800 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-200 dark:text-slate-300">{t('todays_menu')} Items (Snacks)</h3>
            <button onClick={() => setShowAdd(true)} className="text-emerald-600 hover:bg-emerald-900/30 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center space-x-1 border border-emerald-200">
                <Plus className="w-4 h-4" />
                <span>{t('add_item')}</span>
            </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800 dark:bg-slate-800/50 text-slate-400 font-medium border-b border-slate-800 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">DP</th>
                <th className="px-6 py-4">Meal Type</th>
                <th className="px-6 py-4">{t('item')}</th>
                <th className="px-6 py-4 text-right">{t('price')}</th>
                <th className="px-6 py-4 text-center">Max Qty</th>
                <th className="px-6 py-4 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-200 dark:text-slate-300">
              {items.map((row) => {
                  const itemDp = resolveImageUrl(row.DP || row.img || row.image);
                  return (
                  <tr key={row.id} className="hover:bg-slate-800 dark:hover:bg-slate-800/20 transition-colors">
                     <td className="px-6 py-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
                          {itemDp ? (
                            <img src={itemDp} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <Utensils className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                     </td>
                     <td className="px-6 py-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{row.meal}</td>
                     <td className="px-6 py-4 font-bold">{i18n.language === 'bn' ? row.name_bn : row.name_en}</td>
                     <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatMoney(row.price, i18n.language)}</td>
                     <td className="px-6 py-4 text-center font-bold">{row.max}</td>
                     <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDelete(row.id)} className="text-rose-500 hover:text-rose-400 font-bold text-xs bg-rose-900/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
                            {t('cancel')}
                        </button>
                     </td>
                  </tr>
                  );
              })}
              {items.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-400">No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-slate-900 dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white dark:text-white">Add Menu Item</h3>
                    <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-300"><X className="w-5 h-5"/></button>
                </div>
                <form onSubmit={handleAdd} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-200 dark:text-slate-300 mb-1">Name (Bangla)</label>
                        <input required type="text" value={formData.name_bn ?? ""} onChange={e => setFormData({...formData, name_bn: e.target.value})} className="w-full px-4 py-2 border border-slate-700 dark:border-slate-700 bg-slate-800 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="যেমন: সিঙ্গারা" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-200 dark:text-slate-300 mb-1">Name (English)</label>
                        <input required type="text" value={formData.name_en ?? ""} onChange={e => setFormData({...formData, name_en: e.target.value})} className="w-full px-4 py-2 border border-slate-700 dark:border-slate-700 bg-slate-800 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Singara" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-200 dark:text-slate-300 mb-1">Price (৳)</label>
                            <input required type="number" value={formData.price ?? ""} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-2 border border-slate-700 dark:border-slate-700 bg-slate-800 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-200 dark:text-slate-300 mb-1">Max Qty</label>
                            <input required type="number" value={formData.max ?? ""} onChange={e => setFormData({...formData, max: e.target.value})} className="w-full px-4 py-2 border border-slate-700 dark:border-slate-700 bg-slate-800 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-200 dark:text-slate-300 mb-1">Photo / DP URL (Google Drive / Direct link)</label>
                        <input type="text" value={formData.DP ?? ""} onChange={e => setFormData({...formData, DP: e.target.value})} className="w-full px-4 py-2 border border-slate-700 dark:border-slate-700 bg-slate-800 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="https://..." />
                    </div>
                    <div className="pt-4">
                        <button type="submit" className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors">Save Item</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../i18n';
import { Plus, Minus, Clock, CheckCircle2, Coffee } from 'lucide-react';

export const PlaceDemand: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showSuccess, setShowSuccess] = useState(false);

  const dummyItems = [
    { id: '1', name_bn: 'সিঙ্গারা ও চা', name_en: 'Singara & Tea', price: 20, remain: 45, img: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=300&q=80' },
    { id: '2', name_bn: 'সমুচা ও কফি', name_en: 'Samoosa & Coffee', price: 30, remain: 30, img: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300&q=80' },
    { id: '3', name_bn: 'চিকেন রোল', name_en: 'Chicken Roll', price: 40, remain: 15, img: 'https://images.unsplash.com/photo-1589302168068-964664d93cb0?w=300&q=80' }
  ];

  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  const handleConfirm = () => {
    setQuantities({});
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const totalSelected = Object.values(quantities).reduce((a, b) => (a as number) + (b as number), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {showSuccess && (
        <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex justify-between items-center shadow-sm animate-in slide-in-from-top-2">
          <span className="font-bold flex items-center space-x-2"><CheckCircle2 className="w-5 h-5"/> <span>Demand Placed Successfully!</span></span>
          <button onClick={() => setShowSuccess(false)} className="text-emerald-700 hover:text-emerald-900 font-bold text-xl">&times;</button>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white dark:text-white flex items-center space-x-2">
             <Coffee className="w-6 h-6 text-emerald-600" />
             <span>{t('place_demand')} (Snacks)</span>
          </h2>
          <p className="text-slate-400 mt-1 flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>{i18n.language === 'bn' ? 'সময় বাকি: ২ ঘণ্টা' : '2 hours remaining'}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {dummyItems.map(item => (
          <div key={item.id} className="bg-slate-900 dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col">
            <div className="h-40 bg-slate-200 relative">
              <img src={item.img} alt={item.name_en} className="w-full h-full object-cover" />
              <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-white shadow-sm">
                {t('remaining')}: {item.remain}
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <h3 className="font-bold text-lg text-white dark:text-white mb-1">
                {i18n.language === 'bn' ? item.name_bn : item.name_en}
              </h3>
              <p className="text-emerald-600 font-bold text-xl mb-4">{formatMoney(item.price, i18n.language)}</p>
              
              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center space-x-3 bg-slate-800 dark:bg-slate-800 rounded-xl p-1 border border-slate-800 dark:border-slate-700">
                  <button onClick={() => updateQty(item.id, -1)} className="p-2 hover:bg-slate-900 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-300">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold w-4 text-center">{quantities[item.id] || 0}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="p-2 hover:bg-slate-900 dark:hover:bg-slate-700 rounded-lg transition-colors text-emerald-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {(quantities[item.id] || 0) > 0 && (
                  <button onClick={handleConfirm} className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl transition-colors shadow-sm animate-in zoom-in duration-200">
                    <CheckCircle2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../i18n';
import { Plus, Minus, Clock, CheckCircle2 } from 'lucide-react';

export const PlaceDemand: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [mealType, setMealType] = useState('lunch');
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const meals = [
    { id: 'breakfast', label: t('breakfast') },
    { id: 'lunch', label: t('lunch') },
    { id: 'snacks', label: t('snacks') },
    { id: 'dinner', label: t('dinner') }
  ];

  const dummyItems = [
    { id: '1', name_bn: 'ভুনা খিচুড়ি ও ডিম', name_en: 'Bhuna Khichuri & Egg', price: 60, remain: 24, img: 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=300&q=80' },
    { id: '2', name_bn: 'সাদা ভাত ও রুই মাছ', name_en: 'Plain Rice & Rui Fish', price: 80, remain: 12, img: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=300&q=80' },
    { id: '3', name_bn: 'চিকেন বিরিয়ানি', name_en: 'Chicken Biryani', price: 120, remain: 5, img: 'https://images.unsplash.com/photo-1589302168068-964664d93cb0?w=300&q=80' }
  ];

  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('place_demand')}</h2>
          <p className="text-slate-500 mt-1 flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>{i18n.language === 'bn' ? 'সময় বাকি: ২ ঘণ্টা' : '2 hours remaining'}</span>
          </p>
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto">
          {meals.map(m => (
            <button
              key={m.id}
              onClick={() => setMealType(m.id)}
              className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${mealType === m.id ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {dummyItems.map(item => (
          <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col">
            <div className="h-40 bg-slate-200 relative">
              <img src={item.img} alt={item.name_en} className="w-full h-full object-cover" />
              <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-800 shadow-sm">
                {t('remaining')}: {item.remain}
              </div>
            </div>
            <div className="p-5 flex-1 flex flex-col">
              <h3 className="font-bold text-lg text-slate-800 dark:text-white mb-1">
                {i18n.language === 'bn' ? item.name_bn : item.name_en}
              </h3>
              <p className="text-emerald-600 font-bold text-xl mb-4">{formatMoney(item.price, i18n.language)}</p>
              
              <div className="mt-auto flex items-center justify-between">
                <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-slate-100 dark:border-slate-700">
                  <button onClick={() => updateQty(item.id, -1)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="font-bold w-4 text-center">{quantities[item.id] || 0}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-emerald-600">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {(quantities[item.id] || 0) > 0 && (
                  <button className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl transition-colors shadow-sm animate-in zoom-in duration-200">
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

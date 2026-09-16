import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../i18n';
import { Search, Plus, Package } from 'lucide-react';

export const InventoryManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const dummyInventory = [
    { id: '1', cat_bn: 'চাল/ডাল', cat_en: 'Grains', name_bn: 'মিনিকেট চাল', name_en: 'Miniket Rice', unit_bn: 'কেজি', unit_en: 'KG', stock: 15, reorder: 20 },
    { id: '2', cat_bn: 'মসলা', cat_en: 'Spices', name_bn: 'হলুদ গুঁড়া', name_en: 'Turmeric Powder', unit_bn: 'কেজি', unit_en: 'KG', stock: 5, reorder: 2 },
    { id: '3', cat_bn: 'তেল', cat_en: 'Oil', name_bn: 'সয়াবিন তেল', name_en: 'Soyabean Oil', unit_bn: 'লিটার', unit_en: 'L', stock: 2, reorder: 5 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
           <Package className="w-6 h-6 text-emerald-600" />
           <span>{t('inventory_management')}</span>
        </h2>
        
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder={t('search')} 
              className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none w-full md:w-64"
            />
          </div>
          <button className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-sm">
            <Plus className="w-4 h-4" />
            <span>{t('add_stock')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium">
              <tr>
                <th className="px-6 py-4">{t('item')}</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">{t('current_stock')}</th>
                <th className="px-6 py-4 text-center">{t('status')}</th>
                <th className="px-6 py-4 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
              {dummyInventory.map((row) => {
                 const isLow = row.stock <= row.reorder;
                 const isLangBn = i18n.language === 'bn';
                 
                 return (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                     <td className="px-6 py-4 font-bold">{isLangBn ? row.name_bn : row.name_en}</td>
                     <td className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{isLangBn ? row.cat_bn : row.cat_en}</td>
                     <td className="px-6 py-4 text-right font-black text-lg">
                        {formatNumber(row.stock, i18n.language)} <span className="text-xs font-medium text-slate-500 ml-1">{isLangBn ? row.unit_bn : row.unit_en}</span>
                     </td>
                     <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                           isLow ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                           {isLow ? t('low') : t('sufficient')}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                        <button className="text-slate-400 hover:text-emerald-600 font-bold text-xs bg-slate-50 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors border border-slate-200">
                           Manage
                        </button>
                     </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

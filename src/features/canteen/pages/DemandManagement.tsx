import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatNumber, formatMoney } from '../i18n';
import { Search, CheckCircle2, List } from 'lucide-react';

export const DemandManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const dummyDemands = [
    { id: '1', user: 'Sgt Hasan', meal: 'Snacks', item_bn: 'সিঙ্গারা ও চা', item_en: 'Singara & Tea', qty: 1, total: 80, status: 'confirmed' },
    { id: '2', user: 'Cpl Jamil', meal: 'Snacks', item_bn: 'সিঙ্গারা ও চা', item_en: 'Singara & Tea', qty: 2, total: 160, status: 'confirmed' },
    { id: '3', user: 'Flt Lt Robin', meal: 'Snacks', item_bn: 'চিকেন রোল', item_en: 'Chicken Roll', qty: 1, total: 120, status: 'served' },
    { id: '4', user: 'LAC Nishad', meal: 'Snacks', item_bn: 'সমুচা ও কফি', item_en: 'Samoosa & Coffee', qty: 2, total: 60, status: 'cancelled' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
           <List className="w-6 h-6 text-emerald-600" />
           <span>{t('demand_management')}</span>
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
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-300">Today's Demands</h3>
            <button className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-emerald-200 transition-colors">
                Mark All as Served
            </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4 w-10">
                    <input type="checkbox" className="rounded text-emerald-500 focus:ring-emerald-500" />
                </th>
                <th className="px-6 py-4">{t('user_name')}</th>
                <th className="px-6 py-4">{t('item')}</th>
                <th className="px-6 py-4 text-center">{t('quantity')}</th>
                <th className="px-6 py-4 text-center">{t('status')}</th>
                <th className="px-6 py-4 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
              {dummyDemands.map((row) => {
                 const isLangBn = i18n.language === 'bn';
                 
                 return (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                     <td className="px-6 py-4">
                        <input type="checkbox" className="rounded text-emerald-500 focus:ring-emerald-500" disabled={row.status !== 'confirmed'} />
                     </td>
                     <td className="px-6 py-4 font-bold">{row.user}</td>
                     <td className="px-6 py-4">
                        <div className="font-bold">{isLangBn ? row.item_bn : row.item_en}</div>
                        <div className="text-xs text-slate-400">{row.meal}</div>
                     </td>
                     <td className="px-6 py-4 text-center font-bold text-lg">
                        {formatNumber(row.qty, i18n.language)}
                     </td>
                     <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                           row.status === 'served' ? 'bg-emerald-100 text-emerald-700' :
                           row.status === 'confirmed' ? 'bg-amber-100 text-amber-700' :
                           'bg-rose-100 text-rose-700'
                        }`}>
                           {t(`order_status_${row.status}`)}
                        </span>
                     </td>
                     <td className="px-6 py-4 text-right">
                        {row.status === 'confirmed' ? (
                            <button className="flex items-center justify-end space-x-1 text-emerald-600 hover:text-emerald-700 font-bold text-xs bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors ml-auto">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>{t('mark_as_served')}</span>
                            </button>
                        ) : (
                            <span className="text-slate-300">-</span>
                        )}
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

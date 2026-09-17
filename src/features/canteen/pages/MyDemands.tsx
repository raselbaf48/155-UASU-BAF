import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney, formatNumber } from '../i18n';
import { Search, Filter, Download } from 'lucide-react';

export const MyDemands: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const dummyHistory = [
    { id: '1', date: '2026-09-15', meal: 'Snacks', item_bn: 'সিঙ্গারা ও চা', item_en: 'Singara & Tea', qty: 1, total: 80, status: 'served' },
    { id: '2', date: '2026-09-15', meal: 'Snacks', item_bn: 'চিকেন রোল', item_en: 'Chicken Roll', qty: 2, total: 240, status: 'confirmed' },
    { id: '3', date: '2026-09-14', meal: 'Snacks', item_bn: 'সমুচা ও কফি', item_en: 'Samoosa & Coffee', qty: 1, total: 60, status: 'cancelled' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white dark:text-white">{t('my_demands')}</h2>
        
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder={t('search')} 
              className="pl-9 pr-4 py-2 bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none w-full md:w-64"
            />
          </div>
          <button className="p-2 bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 rounded-xl text-slate-300 hover:text-emerald-600 transition-colors">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-slate-900 dark:bg-slate-900 rounded-2xl border border-slate-700 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800 dark:bg-slate-800/50 text-slate-400 font-medium">
              <tr>
                <th className="px-6 py-4">{t('date')}</th>
                <th className="px-6 py-4">{t('item')}</th>
                <th className="px-6 py-4 text-center">{t('quantity')}</th>
                <th className="px-6 py-4 text-right">{t('total')}</th>
                <th className="px-6 py-4 text-center">{t('status')}</th>
                <th className="px-6 py-4 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-200 dark:text-slate-300">
              {dummyHistory.map((row) => (
                <tr key={row.id} className="hover:bg-slate-800 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4 font-medium">{row.date}</td>
                  <td className="px-6 py-4">
                    <div className="font-bold">{i18n.language === 'bn' ? row.item_bn : row.item_en}</div>
                    <div className="text-xs text-slate-400">{row.meal}</div>
                  </td>
                  <td className="px-6 py-4 text-center font-bold">{formatNumber(row.qty, i18n.language)}</td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatMoney(row.total, i18n.language)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${
                      row.status === 'served' ? 'bg-emerald-100 text-emerald-400' :
                      row.status === 'confirmed' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-400'
                    }`}>
                      {t(`order_status_${row.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {row.status === 'confirmed' && (
                      <button className="text-rose-500 hover:text-rose-400 font-bold text-xs bg-rose-900/30 px-3 py-1.5 rounded-lg transition-colors">
                        {t('cancel')}
                      </button>
                    )}
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

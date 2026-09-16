import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../i18n';
import { CreditCard, Search, Download, DollarSign } from 'lucide-react';

export const BillingManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const dummyBilling = [
    { id: '1', user: 'Sgt Hasan', previous_due: 1500, current_month: 2400, total: 3900 },
    { id: '2', user: 'Cpl Jamil', previous_due: 0, current_month: 1250, total: 1250 },
    { id: '3', user: 'Flt Lt Robin', previous_due: 450, current_month: 3100, total: 3550 },
    { id: '4', user: 'LAC Nishad', previous_due: 0, current_month: 850, total: 850 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white dark:text-white flex items-center space-x-2">
           <CreditCard className="w-6 h-6 text-emerald-600" />
           <span>{t('monthly_bill')} / {t('ledger')}</span>
        </h2>
        
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder={t('search')} 
              className="pl-9 pr-4 py-2 bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none w-full md:w-64"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-900 dark:bg-slate-900 rounded-2xl border border-slate-700 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800 dark:bg-slate-800/50 text-slate-400 font-medium border-b border-slate-800 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">{t('employee')}</th>
                <th className="px-6 py-4 text-right">{t('previous_due')}</th>
                <th className="px-6 py-4 text-right">{t('current_month_bill')}</th>
                <th className="px-6 py-4 text-right">{t('total')} {t('due')}</th>
                <th className="px-6 py-4 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-200 dark:text-slate-300">
              {dummyBilling.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800 dark:hover:bg-slate-800/20 transition-colors">
                     <td className="px-6 py-4 font-bold">{row.user}</td>
                     <td className="px-6 py-4 text-right font-medium text-slate-400">
                        {formatMoney(row.previous_due, i18n.language)}
                     </td>
                     <td className="px-6 py-4 text-right font-medium">
                        {formatMoney(row.current_month, i18n.language)}
                     </td>
                     <td className="px-6 py-4 text-right font-bold text-rose-600 text-lg">
                        {formatMoney(row.total, i18n.language)}
                     </td>
                     <td className="px-6 py-4 text-right flex items-center justify-end space-x-2">
                        <button className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 font-bold text-xs bg-slate-800 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">{t('download_invoice')}</span>
                        </button>
                        <button className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 font-bold text-xs bg-emerald-900/30 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                            <DollarSign className="w-4 h-4" />
                            <span>{t('record_payment')}</span>
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

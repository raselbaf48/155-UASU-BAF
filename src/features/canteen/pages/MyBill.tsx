import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../i18n';
import { CreditCard, Download, FileText } from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';

export const MyBill: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const ledgerData = [
    { id: '1', date: '2026-09-15', desc_bn: 'দুপুরের খাবার (সাদা ভাত ও মাছ)', desc_en: 'Lunch (Plain Rice & Fish)', debit: 80, credit: 0, balance: 80 },
    { id: '2', date: '2026-09-15', desc_bn: 'রাতের খাবার (চিকেন বিরিয়ানি)', desc_en: 'Dinner (Chicken Biryani)', debit: 120, credit: 0, balance: 200 },
    { id: '3', date: '2026-09-16', desc_bn: 'বিকাশ পেমেন্ট', desc_en: 'bKash Payment', debit: 0, credit: 200, balance: 0 },
    { id: '4', date: '2026-09-16', desc_bn: 'সকালের নাস্তা (ডিম পরাটা)', desc_en: 'Breakfast (Egg Paratha)', debit: 60, credit: 0, balance: 60 },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white dark:text-white flex items-center space-x-2">
           <CreditCard className="w-6 h-6 text-emerald-600" />
           <span>{t('my_bill')}</span>
        </h2>
        <button className="flex items-center space-x-2 bg-slate-900 dark:bg-slate-900 border border-slate-700 dark:border-slate-800 text-slate-200 dark:text-slate-300 px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-sm hover:shadow-md">
            <Download className="w-4 h-4" />
            <span>{t('download_invoice')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-600 text-white p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="relative z-10">
             <p className="text-emerald-100 font-medium mb-1">{t('total')} {t('due')}</p>
             <h3 className="text-4xl font-bold">{formatMoney(60, i18n.language)}</h3>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-slate-900/10 rounded-full blur-2xl"></div>
        </div>
        
        <div className="bg-slate-900 dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 dark:border-slate-800">
          <p className="text-slate-400 font-medium mb-1">{t('current_month_bill')}</p>
          <h3 className="text-3xl font-bold text-white dark:text-white">{formatMoney(260, i18n.language)}</h3>
        </div>

        <div className="bg-slate-900 dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800 dark:border-slate-800">
          <p className="text-slate-400 font-medium mb-1">{t('paid')} ({t('current_month_bill')})</p>
          <h3 className="text-3xl font-bold text-white dark:text-white">{formatMoney(200, i18n.language)}</h3>
        </div>
      </div>

      <div className="bg-slate-900 dark:bg-slate-900 rounded-2xl border border-slate-700 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 dark:border-slate-800 bg-slate-800 dark:bg-slate-900/50 flex items-center space-x-2">
            <FileText className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-slate-200 dark:text-slate-300">{t('ledger')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-800 dark:bg-slate-800/50 text-slate-400 font-medium border-b border-slate-800 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">{t('date')}</th>
                <th className="px-6 py-4">{t('description')}</th>
                <th className="px-6 py-4 text-right text-rose-500">{t('debit')} (-)</th>
                <th className="px-6 py-4 text-right text-emerald-500">{t('credit')} (+)</th>
                <th className="px-6 py-4 text-right">{t('balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-200 dark:text-slate-300">
              {ledgerData.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800 dark:hover:bg-slate-800/20 transition-colors">
                     <td className="px-6 py-4 font-medium">{formatCanteenDate(row.date)}</td>
                     <td className="px-6 py-4 font-bold">{i18n.language === 'bn' ? row.desc_bn : row.desc_en}</td>
                     <td className="px-6 py-4 text-right font-medium text-rose-600">
                        {row.debit > 0 ? formatMoney(row.debit, i18n.language) : '-'}
                     </td>
                     <td className="px-6 py-4 text-right font-medium text-emerald-600">
                        {row.credit > 0 ? formatMoney(row.credit, i18n.language) : '-'}
                     </td>
                     <td className="px-6 py-4 text-right font-bold text-white dark:text-white text-lg">
                        {formatMoney(row.balance, i18n.language)}
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

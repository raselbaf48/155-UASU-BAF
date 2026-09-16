import React from 'react';
import { useTranslation } from 'react-i18next';
import { Settings as SettingsIcon, Key, Clock, Save } from 'lucide-react';

export const Settings: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
           <SettingsIcon className="w-6 h-6 text-emerald-600" />
           <span>{t('settings')}</span>
        </h2>
        <button className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-colors font-bold shadow-sm">
            <Save className="w-4 h-4" />
            <span>{t('save')}</span>
        </button>
      </div>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-6 space-y-6">
         <div>
            <h3 className="text-lg font-bold flex items-center space-x-2 mb-4 text-slate-800 dark:text-white">
                <Key className="w-5 h-5 text-slate-400" />
                <span>Manager System Key</span>
            </h3>
            <input type="password" defaultValue="1234" className="w-full md:w-1/2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
            <p className="text-xs text-slate-500 mt-2">PIN for entering Manager Panel. Default is 1234.</p>
         </div>
         <hr className="border-slate-100 dark:border-slate-800" />
         <div>
            <h3 className="text-lg font-bold flex items-center space-x-2 mb-4 text-slate-800 dark:text-white">
                <Clock className="w-5 h-5 text-slate-400" />
                <span>Demand Cutoff Time (Snacks)</span>
            </h3>
            <input type="time" defaultValue="15:30" className="w-full md:w-1/2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium" />
         </div>
      </div>
    </div>
  );
};
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../i18n';
import { PieChart, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Pie, Cell } from 'recharts';

export const Reports: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const revenueData = [
    { day: 'Sun', amount: 4000 },
    { day: 'Mon', amount: 5500 },
    { day: 'Tue', amount: 6200 },
    { day: 'Wed', amount: 8450 },
    { day: 'Thu', amount: 0 },
    { day: 'Fri', amount: 0 },
    { day: 'Sat', amount: 0 },
  ];

  const popularItems = [
    { name: 'Lunch', value: 45 },
    { name: 'Dinner', value: 30 },
    { name: 'Breakfast', value: 15 },
    { name: 'Snacks', value: 10 },
  ];
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#6366f1'];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
           <BarChart2 className="w-6 h-6 text-emerald-600" />
           <span>{t('reports')}</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Revenue Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300 mb-6 flex items-center space-x-2">
                <BarChart2 className="w-5 h-5 text-emerald-500" />
                <span>{t('revenue_trend')} (This Week)</span>
            </h3>
            <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(val) => `৳${val}`} />
                        <Tooltip 
                            cursor={{ fill: '#f1f5f9' }} 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Popular Items Chart */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-lg text-slate-700 dark:text-slate-300 mb-6 flex items-center space-x-2">
                <PieChart className="w-5 h-5 text-blue-500" />
                <span>{t('popular_items')} (By Category)</span>
            </h3>
            <div className="h-72 w-full flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={popularItems}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            stroke="none"
                        >
                            {popularItems.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-center space-x-4 mt-2">
                {popularItems.map((entry, index) => (
                    <div key={entry.name} className="flex items-center space-x-1 text-sm">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-slate-500 font-medium">{entry.name}</span>
                    </div>
                ))}
            </div>
        </div>

      </div>
    </div>
  );
};

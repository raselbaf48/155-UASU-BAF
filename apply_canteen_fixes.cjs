const fs = require('fs');

// 1. CREATE SETTINGS PAGE
const settingsCode = `import React from 'react';
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
};`;
fs.writeFileSync('src/features/canteen/pages/Settings.tsx', settingsCode);


// 2. REWRITE PLACE DEMAND (Only Snacks, Interactive)
const placeDemandCode = `import React, { useState } from 'react';
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

  const totalSelected = Object.values(quantities).reduce((a,b) => a+b, 0);

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
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
             <Coffee className="w-6 h-6 text-emerald-600" />
             <span>{t('place_demand')} (Snacks)</span>
          </h2>
          <p className="text-slate-500 mt-1 flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>{i18n.language === 'bn' ? 'সময় বাকি: ২ ঘণ্টা' : '2 hours remaining'}</span>
          </p>
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
};`;
fs.writeFileSync('src/features/canteen/pages/PlaceDemand.tsx', placeDemandCode);


// 3. REWRITE MENU MANAGEMENT (Interactive)
const menuCode = `import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../i18n';
import { Coffee, Plus, Calendar, X } from 'lucide-react';

export const MenuManagement: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  const [items, setItems] = useState([
    { id: '1', meal: 'Snacks', name_bn: 'সিঙ্গারা ও চা', name_en: 'Singara & Tea', price: 20, max: 50 },
    { id: '2', meal: 'Snacks', name_bn: 'সমুচা ও কফি', name_en: 'Samoosa & Coffee', price: 30, max: 40 },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [formData, setFormData] = useState({ name_bn: '', name_en: '', price: '', max: '' });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newItem = {
        id: Date.now().toString(),
        meal: 'Snacks',
        name_bn: formData.name_bn,
        name_en: formData.name_en,
        price: Number(formData.price),
        max: Number(formData.max)
    };
    setItems([...items, newItem]);
    setShowAdd(false);
    setFormData({ name_bn: '', name_en: '', price: '', max: '' });
  };

  const handleDelete = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center space-x-2">
           <Coffee className="w-6 h-6 text-emerald-600" />
           <span>{t('menu_management')}</span>
        </h2>
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="date" className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none w-full md:w-48 font-medium text-slate-600" defaultValue={new Date().toISOString().split('T')[0]} />
          </div>
          <button className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-xl transition-colors text-sm font-bold shadow-sm">
            <span>{t('publish_menu')}</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center">
            <h3 className="font-bold text-slate-700 dark:text-slate-300">{t('todays_menu')} Items (Snacks)</h3>
            <button onClick={() => setShowAdd(true)} className="text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center space-x-1 border border-emerald-200">
                <Plus className="w-4 h-4" />
                <span>{t('add_item')}</span>
            </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-medium border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="px-6 py-4">Meal Type</th>
                <th className="px-6 py-4">{t('item')}</th>
                <th className="px-6 py-4 text-right">{t('price')}</th>
                <th className="px-6 py-4 text-center">Max Qty</th>
                <th className="px-6 py-4 text-right">{t('action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300">
              {items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                     <td className="px-6 py-4 font-bold text-slate-400 text-xs uppercase tracking-wider">{row.meal}</td>
                     <td className="px-6 py-4 font-bold">{i18n.language === 'bn' ? row.name_bn : row.name_en}</td>
                     <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatMoney(row.price, i18n.language)}</td>
                     <td className="px-6 py-4 text-center font-bold">{row.max}</td>
                     <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDelete(row.id)} className="text-rose-500 hover:text-rose-700 font-bold text-xs bg-rose-50 px-3 py-1.5 rounded-lg transition-colors">
                            {t('cancel')}
                        </button>
                     </td>
                  </tr>
              ))}
              {items.length === 0 && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No items found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">Add Menu Item</h3>
                    <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5"/></button>
                </div>
                <form onSubmit={handleAdd} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Name (Bangla)</label>
                        <input required type="text" value={formData.name_bn} onChange={e => setFormData({...formData, name_bn: e.target.value})} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="যেমন: সিঙ্গারা" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Name (English)</label>
                        <input required type="text" value={formData.name_en} onChange={e => setFormData({...formData, name_en: e.target.value})} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Singara" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Price (৳)</label>
                            <input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Max Qty</label>
                            <input required type="number" value={formData.max} onChange={e => setFormData({...formData, max: e.target.value})} className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500" />
                        </div>
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
};`;
fs.writeFileSync('src/features/canteen/pages/MenuManagement.tsx', menuCode);


// 4. UPDATE DASHBOARD & DEMAND PAGES TO SNACKS ONLY
function makeSnacksOnly(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/'Lunch'/g, "'Snacks'");
    content = content.replace(/'Dinner'/g, "'Snacks'");
    content = content.replace(/'Breakfast'/g, "'Snacks'");
    content = content.replace(/'সাদা ভাত ও রুই মাছ'/g, "'সিঙ্গারা ও চা'");
    content = content.replace(/'Plain Rice & Fish'/g, "'Singara & Tea'");
    content = content.replace(/'Plain Rice & Rui Fish'/g, "'Singara & Tea'");
    content = content.replace(/'Rice & Rui Fish'/g, "'Singara & Tea'");
    content = content.replace(/'চিকেন বিরিয়ানি'/g, "'চিকেন রোল'");
    content = content.replace(/'Chicken Biryani'/g, "'Chicken Roll'");
    content = content.replace(/'ডিম পরাটা'/g, "'সমুচা ও কফি'");
    content = content.replace(/'Egg Paratha'/g, "'Samoosa & Coffee'");
    content = content.replace(/'ভুনা খিচুড়ি ও ডিম'/g, "'সমুচা ও কফি'");
    content = content.replace(/'Bhuna Khichuri & Egg'/g, "'Samoosa & Coffee'");
    fs.writeFileSync(file, content);
}
makeSnacksOnly('src/features/canteen/pages/ManagerDashboard.tsx');
makeSnacksOnly('src/features/canteen/pages/MyDemands.tsx');
makeSnacksOnly('src/features/canteen/pages/DemandManagement.tsx');


// 5. UPDATE CANTEEN LAYOUT FOR SETTINGS AND PIN MODAL
let layout = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

// Add settings import if missing
if (!layout.includes("import { Settings } from '../pages/Settings';")) {
    layout = layout.replace("import { Reports } from '../pages/Reports';", "import { Reports } from '../pages/Reports';\nimport { Settings } from '../pages/Settings';");
}

// Add state for PIN
layout = layout.replace("const [role, setRole] = useState<'employee'|'manager'>('manager');", `const [role, setRole] = useState<'employee'|'manager'>('employee');
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);`);
layout = layout.replace("const [role, setRole] = useState<'employee'|'manager'>('employee');\n  const [showPinPrompt", `const [role, setRole] = useState<'employee'|'manager'>('employee');
  const [showPinPrompt`); // Safe duplicate fallback

// Replace Role Switch onClick
layout = layout.replace(/onClick=\{\(\) => \{\s*setRole\(role === 'employee' \? 'manager' : 'employee'\);\s*setActiveTab\(role === 'employee' \? 'manager_dashboard' : 'dashboard'\);\s*\}\}/, `onClick={() => {
                   if (role === 'employee') {
                       setShowPinPrompt(true);
                   } else {
                       setRole('employee');
                       setActiveTab('dashboard');
                   }
                }}`);

// Ensure settings case exists
if (!layout.includes("case 'settings': return <Settings />")) {
    layout = layout.replace("case 'reports': return <Reports />;", "case 'reports': return <Reports />;\n      case 'settings': return <Settings />;");
}

// Add PIN Modal before final </div>
const modalHTML = `
      {showPinPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 text-center border border-slate-200 dark:border-slate-800">
                <h3 className="text-xl font-bold mb-2 text-slate-800 dark:text-white">Manager Access</h3>
                <p className="text-sm text-slate-500 mb-6">Enter system key to access manager panel (Key: 1234)</p>
                
                <input 
                    type="password" 
                    value={pinInput} 
                    onChange={e => { setPinInput(e.target.value); setPinError(false); }}
                    className={\`w-full px-4 py-3 text-center tracking-[0.5em] text-2xl font-bold bg-slate-50 dark:bg-slate-800 border \${pinError ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 dark:border-slate-700'} rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4\`}
                    placeholder="****"
                    autoFocus
                />
                
                {pinError && <p className="text-xs text-rose-500 font-bold mb-4">Invalid Key!</p>}
                
                <div className="flex space-x-3">
                    <button onClick={() => { setShowPinPrompt(false); setPinInput(''); setPinError(false); }} className="flex-1 py-3 font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300 rounded-xl transition-colors">Cancel</button>
                    <button onClick={() => {
                        if (pinInput === '1234') {
                            setRole('manager');
                            setActiveTab('manager_dashboard');
                            setShowPinPrompt(false);
                            setPinInput('');
                        } else {
                            setPinError(true);
                        }
                    }} className="flex-1 py-3 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors">Verify</button>
                </div>
            </div>
        </div>
      )}
`;

layout = layout.replace(/<\/div>\s*<\/div>\s*\);\s*\};\s*$/, `${modalHTML}\n      </div>\n    </div>\n  );\n};\n`);
fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', layout);

import React, { useState } from 'react';
import { Settings, Save, Trash2, Code } from 'lucide-react';

export const CanteenSettings: React.FC = () => {
  const [settings, setSettings] = useState({
      name: '☕ Cafe UAV ☕',
      logoUrl: 'https://i.postimg.cc/gcqqCXCL/Logo-(1).png',
      managerName: 'LAC Nishad',
      adminImage: 'https://i.postimg.cc/Xvhj2Myt/FB-IMG-170...',
      phone: '+880 1601-676760',
      password: '0000',
      footer: 'Official Canteen of UAV | Integrity and Service'
  });

  const handleSave = () => {
      alert("Settings saved successfully!");
  };

  const handleErase = () => {
      if(confirm("Are you sure you want to erase local cache? This cannot be undone.")) {
          alert("Local cache erased.");
      }
  };

  return (
    <div className="max-w-4xl space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div>
         <h2 className="text-2xl font-black text-white uppercase tracking-tighter">SYSTEM CONFIGURATION</h2>
         <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IDENTITY & PARAMETERS</p>
      </div>

      {/* Main Settings Card */}
      <div className="bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 space-y-8">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CANTEEN NAME</label>
               <input 
                  type="text" 
                  value={settings.name}
                  onChange={(e) => setSettings({...settings, name: e.target.value})}
                  className="w-full bg-[#0f172a] text-white rounded-xl px-4 py-3.5 text-xs font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
               />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">LOGO URL</label>
               <input 
                  type="text" 
                  value={settings.logoUrl}
                  onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
                  className="w-full bg-[#0f172a] text-white rounded-xl px-4 py-3.5 text-xs font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5] truncate"
               />
            </div>
            
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MANAGER NAME</label>
               <input 
                  type="text" 
                  value={settings.managerName}
                  onChange={(e) => setSettings({...settings, managerName: e.target.value})}
                  className="w-full bg-[#0f172a] text-white rounded-xl px-4 py-3.5 text-xs font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
               />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ADMIN IMAGE URL</label>
               <input 
                  type="text" 
                  value={settings.adminImage}
                  onChange={(e) => setSettings({...settings, adminImage: e.target.value})}
                  className="w-full bg-[#0f172a] text-white rounded-xl px-4 py-3.5 text-xs font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5] truncate"
               />
            </div>

            <div className="space-y-2">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">WHATSAPP PHONE</label>
               <input 
                  type="text" 
                  value={settings.phone}
                  onChange={(e) => setSettings({...settings, phone: e.target.value})}
                  className="w-full bg-[#0f172a] text-white rounded-xl px-4 py-3.5 text-xs font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
               />
            </div>
         </div>

         <div className="space-y-2 pt-4 border-t border-slate-800">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ADMIN PASSWORD</label>
            <input 
               type="password" 
               value={settings.password}
               onChange={(e) => setSettings({...settings, password: e.target.value})}
               className="w-full bg-[#0f172a] text-white rounded-xl px-4 py-3.5 text-xs font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
            />
         </div>
      </div>

      {/* Footer Branding Card */}
      <div className="bg-slate-900 rounded-[2rem] p-8 shadow-sm border border-slate-800 space-y-4">
         <h3 className="text-xs font-black text-white uppercase tracking-widest flex items-center space-x-2">
            <Code className="w-4 h-4 text-indigo-500" />
            <span>FOOTER BRANDING</span>
         </h3>
         <textarea 
            rows={4}
            value={settings.footer}
            onChange={(e) => setSettings({...settings, footer: e.target.value})}
            className="w-full bg-[#0f172a] text-emerald-400 rounded-xl px-5 py-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
         />
      </div>

      <button onClick={handleSave} className="w-full py-4 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-2xl text-[10px] font-black tracking-widest uppercase flex items-center justify-center space-x-2 transition-all shadow-md shadow-indigo-500/20">
         <Save className="w-4 h-4" />
         <span>SYNC ALL CHANGES</span>
      </button>

      {/* Danger Zone */}
      <div className="bg-rose-900/30 rounded-[2rem] p-8 shadow-sm border border-rose-900/50 space-y-4 mt-8">
         <h3 className="text-xs font-black text-rose-600 uppercase tracking-widest flex items-center space-x-2">
            <Trash2 className="w-4 h-4 text-rose-500" />
            <span>Danger Zone</span>
         </h3>
         <button onClick={handleErase} className="w-full py-4 bg-slate-900 border-2 border-rose-900/50 hover:bg-rose-900/300 hover:border-rose-500 hover:text-white text-rose-500 rounded-2xl text-[10px] font-black tracking-widest uppercase flex items-center justify-center space-x-2 transition-all shadow-sm">
            <Trash2 className="w-4 h-4" />
            <span>ERASE LOCAL CACHE</span>
         </button>
      </div>
    </div>
  );
};

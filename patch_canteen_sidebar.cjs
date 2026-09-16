const fs = require('fs');

const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');

const oldSidebarStart = `{/* Sidebar */}`;
const oldSidebarEnd = `{/* Main Content Area */}`;

const startIndex = code.indexOf(oldSidebarStart);
const endIndex = code.indexOf(oldSidebarEnd);

if (startIndex !== -1 && endIndex !== -1) {
  const newSidebar = `{/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 h-full overflow-y-auto hidden md:flex rounded-br-[40px]">
        <div className="p-8 pb-4">
          <h1 className="font-black text-2xl text-slate-800 dark:text-white tracking-widest flex items-center space-x-2">
            <Utensils className="w-6 h-6 text-[#4f46e5]" />
            <span>CAFEUAV</span>
          </h1>
          <div className="mt-3 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100">
            <Wifi className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-600 tracking-wider">CONNECTED</span>
          </div>
        </div>
        
        <div className="flex-1 py-4 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={\`w-full flex items-center space-x-3 px-5 py-3.5 rounded-2xl transition-all font-bold \${
                  isActive 
                  ? 'bg-[#4f46e5] text-white shadow-lg shadow-indigo-500/30' 
                  : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600'
                }\`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </button>
            )
          })}
        </div>

        <div className="p-6 space-y-4">
          <button 
             onClick={() => { setShowLogin(true); setLoginError(''); setLoginInput(''); }}
             className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 rounded-2xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors font-bold text-xs uppercase tracking-widest"
          >
             <LogIn className="w-4 h-4" />
             <span>LOGIN</span>
          </button>
          
          <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-900 text-white cursor-pointer" onClick={onBack}>
             <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden">
               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Nishad&backgroundColor=0f172a" alt="Avatar" className="w-full h-full object-cover" />
             </div>
             <div className="text-left flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">GUEST MODE</p>
                <p className="text-sm font-bold leading-none">{currentUser.name}</p>
             </div>
          </div>
        </div>
      </div>

      `;
  code = code.substring(0, startIndex) + newSidebar + code.substring(endIndex);
}

fs.writeFileSync(file, code);

const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

// Ensure Menu is imported
if (!code.includes('Menu } from')) {
    code = code.replace(/X \} from 'lucide-react';/, 'X, Menu } from \'lucide-react\';');
}

// Add state
code = code.replace(
    /const \[loginError, setLoginError\] = useState\(''\);/,
    `const [loginError, setLoginError] = useState('');\n  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);`
);

// Mobile Sidebar overlay logic
const sidebarHTML = `
      {/* Sidebar - Desktop */}
      <div className="w-64 bg-slate-900 dark:bg-slate-900 border-r border-slate-700 dark:border-slate-800 flex-col shrink-0 h-full overflow-y-auto hidden md:flex rounded-br-[40px]">
`;
code = code.replace(/\{\/\* Sidebar \*\/\}\s*<div className="w-64 bg-slate-900 dark:bg-slate-900 border-r border-slate-700 dark:border-slate-800 flex flex-col shrink-0 h-full overflow-y-auto hidden md:flex rounded-br-\[40px\]">/, sidebarHTML.trim());

const mobileSidebarHTML = `
      {/* Sidebar - Mobile Overlay */}
      {mobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] md:hidden flex" onClick={() => setMobileMenuOpen(false)}>
              <div className="w-64 bg-slate-900 h-full flex flex-col shadow-2xl animate-in slide-in-from-left-4" onClick={e => e.stopPropagation()}>
                  <div className="p-6 pb-4 flex justify-between items-center">
                      <h1 className="font-black text-xl text-white tracking-widest flex items-center space-x-2">
                          <Utensils className="w-5 h-5 text-[#4f46e5]" />
                          <span>CAFEUAV</span>
                      </h1>
                      <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto py-2 px-4 space-y-2">
                      {navItems.map((item) => {
                          const isActive = activeTab === item.id;
                          return (
                              <button 
                                  key={item.id}
                                  onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                                  className={\`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all font-bold \${
                                    isActive 
                                    ? 'bg-[#4f46e5] text-white shadow-lg' 
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                  }\`}
                              >
                                  <item.icon className="w-4 h-4" />
                                  <span>{item.name}</span>
                              </button>
                          )
                      })}
                  </div>
                  <div className="p-4 border-t border-slate-800">
                      {currentUser.name === 'Guest' ? (
                          <button 
                             onClick={() => { setShowLogin(true); setMobileMenuOpen(false); }}
                             className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-indigo-600 bg-indigo-50 font-bold text-xs uppercase"
                          >
                             <LogIn className="w-4 h-4" />
                             <span>LOGIN</span>
                          </button>
                      ) : (
                          <button 
                             onClick={() => { 
                                setCurrentUser({ name: 'Guest', role: 'employee' }); 
                                setActiveTab('dashboard'); 
                                setMobileMenuOpen(false);
                             }}
                             className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-rose-600 bg-rose-50 font-bold text-xs uppercase"
                          >
                             <LogIn className="w-4 h-4 rotate-180" />
                             <span>LOGOUT</span>
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}
`;

code = code.replace(/\{\/\* Main Content Area \*\/\}/, mobileSidebarHTML.trim() + '\n\n      {/* Main Content Area */}');

// Mobile Header
const mobileHeaderStr = `
         {/* Top Header for Mobile only */}
         <div className="md:hidden h-16 bg-slate-900 dark:bg-slate-900 border-b border-slate-700 dark:border-slate-800 flex items-center justify-between px-4 z-10 sticky top-0">
            <div className="flex items-center space-x-3">
              <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-400 bg-slate-800 rounded-lg">
                <Menu className="w-5 h-5" />
              </button>
              <span className="font-bold text-lg text-white dark:text-white">CAFEUAV</span>
            </div>
            {currentUser.name === 'Guest' ? (
                <button onClick={() => { setShowLogin(true); setLoginError(''); setLoginInput(''); }}>
                   <LogIn className="w-5 h-5 text-indigo-600" />
                </button>
            ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-indigo-500">
                   <img src={\`https://api.dicebear.com/7.x/avataaars/svg?seed=\${currentUser.name}&backgroundColor=0f172a\`} alt="Avatar" className="w-full h-full object-cover" />
                </div>
            )}
         </div>`;

code = code.replace(/\{\/\* Top Header for Mobile only \*\/\}[\s\S]*?<\/div>\s*\{\/\* Content View \*\/\}/m, mobileHeaderStr.trim() + '\n\n         {/* Content View */}');

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);

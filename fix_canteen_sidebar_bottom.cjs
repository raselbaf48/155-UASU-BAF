const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

const newBottom = `
        <div className="p-6 space-y-4">
          {currentUser.name === 'Guest' ? (
              <button 
                 onClick={() => { setShowLogin(true); setLoginError(''); setLoginInput(''); }}
                 className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 rounded-2xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors font-bold text-xs uppercase tracking-widest"
              >
                 <LogIn className="w-4 h-4" />
                 <span>LOGIN</span>
              </button>
          ) : (
              <button 
                 onClick={() => { 
                    setCurrentUser({ name: 'Guest', role: 'employee' }); 
                    setActiveTab('dashboard'); 
                 }}
                 className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 rounded-2xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors font-bold text-xs uppercase tracking-widest"
              >
                 <LogIn className="w-4 h-4 rotate-180" />
                 <span>LOGOUT</span>
              </button>
          )}
          
          <div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-900 text-white cursor-pointer" onClick={onBack}>
             <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden">
               <img src={\`https://api.dicebear.com/7.x/avataaars/svg?seed=\${currentUser.name}&backgroundColor=0f172a\`} alt="Avatar" className="w-full h-full object-cover" />
             </div>
             <div className="text-left flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {currentUser.role === 'manager' ? 'MANAGER' : (currentUser.name === 'Guest' ? 'GUEST MODE' : 'MEMBER')}
                </p>
                <p className="text-sm font-bold leading-none">{currentUser.name}</p>
             </div>
          </div>
        </div>
`;

code = code.replace(/<div className="p-6 space-y-4">[\s\S]*?<\/div>\s*<\/div>\s*<!-- Main Content Area -->/m, newBottom.trim() + '\n      </div>\n\n      {/* Main Content Area */}');

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);

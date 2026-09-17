const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

const profileOld = `<div className="flex items-center space-x-3 p-3 rounded-2xl bg-slate-900 text-white cursor-pointer" onClick={onBack}>
             <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden">
               <img src={\`https://api.dicebear.com/7.x/avataaars/svg?seed=\${currentUser.name}&backgroundColor=0f172a\`} alt="Avatar" className="w-full h-full object-cover" />
             </div>
             <div className="text-left flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {currentUser.role === 'manager' ? 'MANAGER' : (currentUser.name === 'Guest' ? 'GUEST MODE' : 'MEMBER')}
                </p>
                <p className="text-sm font-bold leading-none">{currentUser.name}</p>
             </div>
          </div>`;

const profileNew = `<div className={\`flex items-center space-x-3 p-3 rounded-2xl cursor-pointer \${isEmployee ? 'bg-slate-900 text-white' : 'bg-slate-900 text-white'}\`} onClick={onBack}>
             <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden">
               <img src={\`https://api.dicebear.com/7.x/avataaars/svg?seed=\${currentUser.name}&backgroundColor=0f172a\`} alt="Avatar" className="w-full h-full object-cover" />
             </div>
             <div className="text-left flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {currentUser.role === 'manager' ? 'MANAGER' : (currentUser.name === 'Guest' ? 'GUEST MODE' : 'CUSTOMER MODE')}
                </p>
                <p className="text-sm font-bold leading-none">{currentUser.name}</p>
             </div>
          </div>`;

code = code.replace(profileOld, profileNew);
fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);

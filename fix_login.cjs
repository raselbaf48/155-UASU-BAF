const fs = require('fs');

const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add Coffee and X icons if they don't exist
if (!code.includes('Coffee')) {
    code = code.replace(/import \{([^}]+)\} from 'lucide-react';/g, (match, imports) => {
        if(imports.includes('Coffee') || match.includes('SettingsIcon')) return match; // avoid touching the first lucide import if it already has it, or just blindly add to the one with UserCircle
    });
}
// just replace the specific import for UserCircle
code = code.replace("import { BarChart2, Package, Settings as SettingsIcon, UserCircle } from 'lucide-react';", "import { BarChart2, Package, Settings as SettingsIcon, UserCircle, Coffee, X } from 'lucide-react';");

// 2. Replace State Variables
const oldState = `const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [role, setRole] = useState<'employee'|'manager'>('employee');
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);`;

const newState = `const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentUser, setCurrentUser] = useState({ name: 'Guest', role: 'employee' as 'employee'|'manager' });
  const [showLogin, setShowLogin] = useState(false);
  const [loginTab, setLoginTab] = useState<'member'|'manager'>('member');
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const mockUsers: Record<string, {name: string, role: 'employee'}> = {
    '469000': { name: 'LAC Nishad', role: 'employee' },
    '469001': { name: 'Sgt Hasan', role: 'employee' },
    '469002': { name: 'Cpl Jamil', role: 'employee' },
    '469003': { name: 'Flt Lt Robin', role: 'employee' }
  };`;
code = code.replace(oldState, newState);

// 3. Update Nav Items and Role checks
code = code.replace(/role === 'employee'/g, "currentUser.role === 'employee'");
code = code.replace(/role === 'manager'/g, "currentUser.role === 'manager'");
// navItems filter condition: `item.role === role` -> `item.role === currentUser.role`
code = code.replace(/item\.role === role/g, "item.role === currentUser.role");

// 4. Update Header User Profile Display
const oldProfile = `<div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{role}</p>
            <p className="text-sm font-bold text-slate-800 dark:text-white">LAC Nishad</p>
          </div>`;
const newProfile = `<div className="text-right hidden sm:block">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{currentUser.role}</p>
            <p className="text-sm font-bold text-slate-800 dark:text-white">{currentUser.name}</p>
          </div>`;
code = code.replace(oldProfile, newProfile);

// fallback for profile if above regex doesn't hit exactly due to spacing
code = code.replace(/\{role\}/g, "{currentUser.role}");
code = code.replace(/>LAC Nishad<\/p>/g, ">{currentUser.name}</p>");

// 5. Update Switch Role Button to Login Button
const oldBtn = `onClick={() => {
                   if (currentUser.role === 'employee') {
                       setShowPinPrompt(true);
                   } else {
                       setRole('employee');
                       setActiveTab('dashboard');
                   }
                }}`;
const newBtn = `onClick={() => { setShowLogin(true); setLoginError(''); setLoginInput(''); }}`;
code = code.replace(oldBtn, newBtn);
code = code.replace(/\{t\('switch_role'\)\}/g, `"Login"`);

// 6. Replace the Modal at the bottom
const modalStart = '{showPinPrompt && (';
const idx = code.indexOf(modalStart);

if (idx !== -1) {
    code = code.substring(0, idx); // remove everything from old modal start

    const newModal = `{showLogin && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
             
             <div className="text-center mb-8">
               <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm mb-4">
                  <Coffee className="w-8 h-8 text-[#4f46e5]" />
               </div>
               <h2 className="text-2xl font-black text-white tracking-widest flex items-center justify-center space-x-2">
                 <span>🍽️</span> <span>CAFEUAV</span> <span>🍽️</span>
               </h2>
             </div>

             <div className="bg-slate-200/20 backdrop-blur-md p-1 rounded-full flex mb-6 mx-8 shadow-inner">
                <button onClick={() => { setLoginTab('member'); setLoginInput(''); setLoginError(''); }} className={\`flex-1 py-3 rounded-full text-xs font-bold tracking-widest transition-all \${loginTab === 'member' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-300 hover:text-white'}\`}>MEMBER</button>
                <button onClick={() => { setLoginTab('manager'); setLoginInput(''); setLoginError(''); }} className={\`flex-1 py-3 rounded-full text-xs font-bold tracking-widest transition-all \${loginTab === 'manager' ? 'bg-white text-[#4f46e5] shadow-sm' : 'text-slate-300 hover:text-white'}\`}>MANAGER</button>
             </div>

             <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-2xl relative border border-slate-100 dark:border-slate-800">
                <button onClick={() => setShowLogin(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>

                <div className="mb-6 mt-2">
                   <label className="block text-[11px] font-black text-slate-400 tracking-widest mb-3">
                     {loginTab === 'member' ? '# MEMBER ID' : '# MANAGER PIN'}
                   </label>
                   <input 
                     type={loginTab === 'member' ? 'text' : 'password'}
                     value={loginInput}
                     onChange={e => { setLoginInput(e.target.value); setLoginError(''); }}
                     placeholder={loginTab === 'member' ? 'e.g. 469000' : '****'}
                     className="w-full bg-[#0f172a] text-white px-5 py-4 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder:text-slate-600"
                   />
                   {loginError && <p className="text-rose-500 text-xs font-bold mt-3">{loginError}</p>}
                </div>

                <button 
                   onClick={() => {
                      if (loginTab === 'member') {
                         const user = mockUsers[loginInput];
                         if (user) {
                            setCurrentUser({ name: user.name, role: 'employee' });
                            setActiveTab('dashboard');
                            setShowLogin(false);
                            setLoginInput('');
                         } else {
                            setLoginError('Member not found. Try 469000');
                         }
                      } else {
                         if (loginInput === '1234') {
                            setCurrentUser({ name: 'System Admin', role: 'manager' });
                            setActiveTab('manager_dashboard');
                            setShowLogin(false);
                            setLoginInput('');
                         } else {
                            setLoginError('Invalid Manager PIN. Try 1234');
                         }
                      }
                   }}
                   className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 active:scale-[0.98]"
                >
                   ESTABLISH SESSION
                </button>
             </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
`;
    code += newModal;
}

fs.writeFileSync(file, code);

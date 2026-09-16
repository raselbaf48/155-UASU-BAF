const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

// 1. Add initialMember prop
code = code.replace(
    "interface CanteenLayoutProps {",
    "interface CanteenLayoutProps {\n  initialMember?: { name: string, bdNo: string };"
);
code = code.replace(
    "export const CanteenLayout: React.FC<CanteenLayoutProps> = ({ onBack }) => {",
    "export const CanteenLayout: React.FC<CanteenLayoutProps> = ({ onBack, initialMember }) => {"
);

// 2. Initialize currentUser from initialMember and set showLogin to false by default
code = code.replace(
    "const [currentUser, setCurrentUser] = useState({ name: 'Guest', role: 'employee' as 'employee'|'manager' });\n  const [showLogin, setShowLogin] = useState(false);",
    "const [currentUser, setCurrentUser] = useState({ name: initialMember ? initialMember.name : 'Guest', role: 'employee' as 'employee'|'manager' });\n  const [showLogin, setShowLogin] = useState(false);"
);
code = code.replace(
    "const [loginTab, setLoginTab] = useState<'member'|'manager'>('member');",
    "const [loginTab, setLoginTab] = useState<'member'|'manager'>('manager');"
);

// 3. In the sidebar, replace the Guest/Login logic with Manager switch / Logout
const oldSidebarLogin = `{currentUser.name === 'Guest' ? (
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
          )}`;

const newSidebarLogin = `{currentUser.role !== 'manager' ? (
              <button
                  onClick={() => { setLoginTab('manager'); setShowLogin(true); setLoginError(''); setLoginInput(''); }}
                 className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 rounded-2xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors font-bold text-xs uppercase tracking-widest mb-2"
              >
                 <LogIn className="w-4 h-4" />
                 <span>MANAGER LOGIN</span>
              </button>
          ) : null}
          <button
              onClick={onBack}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 rounded-2xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors font-bold text-xs uppercase tracking-widest"
          >
              <LogIn className="w-4 h-4 rotate-180" />
              <span>LOGOUT</span>
          </button>`;

code = code.replace(oldSidebarLogin, newSidebarLogin);

// 4. Do the same for the mobile menu sidebar
const oldMobileSidebarLogin = `{currentUser.name === 'Guest' ? (
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
                      )}`;

const newMobileSidebarLogin = `{currentUser.role !== 'manager' ? (
                          <button
                              onClick={() => { setLoginTab('manager'); setShowLogin(true); setMobileMenuOpen(false); }}
                             className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-indigo-600 bg-indigo-50 font-bold text-xs uppercase mb-2"
                          >
                             <LogIn className="w-4 h-4" />
                             <span>MANAGER LOGIN</span>
                          </button>
                      ) : null}
                      <button
                          onClick={onBack}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-rose-600 bg-rose-50 font-bold text-xs uppercase"
                      >
                          <LogIn className="w-4 h-4 rotate-180" />
                          <span>LOGOUT</span>
                      </button>`;
code = code.replace(oldMobileSidebarLogin, newMobileSidebarLogin);


// 5. Hide the login tabs inside the login popup (so it just shows Manager PIN)
const loginTabsStr = `<div className="bg-slate-200/20 backdrop-blur-md p-1 rounded-full flex mb-6 mx-8 shadow-inner">
                <button onClick={() => { setLoginTab('member'); setLoginInput(''); setLoginError(''); }} className={\`flex-1 py-3 rounded-full text-xs font-bold tracking-widest transition-all \${loginTab === 'member' ? 'bg-slate-900 text-[#4f46e5] shadow-sm' : 'text-slate-300 hover:text-white'}\`}>MEMBER</button>
                <button onClick={() => { setLoginTab('manager'); setLoginInput(''); setLoginError(''); }} className={\`flex-1 py-3 rounded-full text-xs font-bold tracking-widest transition-all \${loginTab === 'manager' ? 'bg-slate-900 text-[#4f46e5] shadow-sm' : 'text-slate-300 hover:text-white'}\`}>MANAGER</button>
             </div>`;
             
code = code.replace(loginTabsStr, "");

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);

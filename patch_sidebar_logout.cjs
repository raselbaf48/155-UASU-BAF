const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

const sidebarDesktopOld = `<div className="p-6 space-y-4">
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
          )}`;

const sidebarDesktopNew = `<div className="p-6 space-y-4">
              <button
                  onClick={onBack}
                 className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 rounded-2xl text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors font-bold text-xs uppercase tracking-widest"
              >
                 <LogIn className="w-4 h-4 rotate-180" />
                 <span>LOGOUT</span>
              </button>`;
code = code.replace(sidebarDesktopOld, sidebarDesktopNew);

const sidebarMobileOld = `<div className="p-4 border-t border-slate-800">
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
                  </div>`;

const sidebarMobileNew = `<div className="p-4 border-t border-slate-800">
                      <button
                          onClick={onBack}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-rose-600 bg-rose-50 font-bold text-xs uppercase"
                      >
                          <LogIn className="w-4 h-4 rotate-180" />
                          <span>LOGOUT</span>
                      </button>
                  </div>`;
code = code.replace(sidebarMobileOld, sidebarMobileNew);

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

code = code.replace(
    "case 'dashboard': return <EmployeeDashboard />;",
    "case 'dashboard': return <EmployeeDashboard onManagerPortalClick={() => { setLoginTab('manager'); setShowLogin(true); setLoginInput(''); setLoginError(''); }} />;"
);

// We need to remove the "MANAGER LOGIN" button from the sidebar (Desktop and Mobile)
const sidebarDesktopManager = `{currentUser.role !== 'manager' && (
              <button
                 onClick={() => { setLoginTab('manager'); setShowLogin(true); setLoginError(''); setLoginInput(''); }}
                 className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors font-bold text-xs uppercase tracking-widest"
              >
                 <LogIn className="w-4 h-4" />
                 <span>MANAGER LOGIN</span>
              </button>
          )}`;
code = code.replace(sidebarDesktopManager, "");

const sidebarMobileManager = `{currentUser.role !== 'manager' && (
                          <button
                              onClick={() => { setLoginTab('manager'); setShowLogin(true); setMobileMenuOpen(false); }}
                             className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-indigo-600 bg-indigo-50 font-bold text-xs uppercase"
                          >
                             <LogIn className="w-4 h-4" />
                             <span>MANAGER LOGIN</span>
                          </button>
                      )}`;
code = code.replace(sidebarMobileManager, "");

// Wait, the manager button was added to the Sidebar in a previous patch with some specific formatting, let's verify if the regex will hit anything.
fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);

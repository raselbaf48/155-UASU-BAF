import React, { useState } from 'react';
import { supabase } from '../../../supabase';
import { localDb } from '../../../services/localDatabase';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../i18n';
import { EmployeeDashboard } from '../pages/EmployeeDashboard';
import { PersonalPortal } from '../pages/PersonalPortal';
import { PlaceDemand } from '../pages/PlaceDemand';
import { MyDemands } from '../pages/MyDemands';
import { ManagerDashboard } from '../pages/ManagerDashboard';
import { InventoryManagement } from '../pages/InventoryManagement';
import { DemandManagement } from '../pages/DemandManagement';
import { MenuManagement } from '../pages/MenuManagement';
import { BillingManagement } from '../pages/BillingManagement';
import { MyBill } from '../pages/MyBill';
import { Reports } from '../pages/Reports';
import { Settings } from '../pages/Settings';
import { PosSales } from '../pages/PosSales';
import { MemberDB } from '../pages/MemberDB';
import { CanteenInventory } from '../pages/CanteenInventory';
import { Expenditures } from '../pages/Expenditures';
import { CanteenReports } from '../pages/CanteenReports';
import { CanteenSettings } from '../pages/CanteenSettings';
import { CanteenFund } from '../pages/CanteenFund';

import { Wallet, LayoutDashboard, Coffee, Search, List, CreditCard, ArrowLeft, Utensils, Wifi, HelpCircle, LogIn, Grid, Package as Pkg, ShoppingCart, Users, Banknote, BarChart2, Settings as SettingsIcon, PieChart, Package, UserCircle, X, Menu } from 'lucide-react';







interface CanteenLayoutProps {
  initialMember?: { name: string, bdNo: string, role?: 'employee'|'manager' };
  onBack: () => void;
}

export const CanteenLayout: React.FC<CanteenLayoutProps> = ({ onBack, initialMember }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>(initialMember?.role === 'manager' ? 'manager_dashboard' : 'personal_portal');
  const [currentUser, setCurrentUser] = useState<any>({ name: initialMember ? initialMember.name : 'Guest', role: (initialMember && initialMember.role) ? initialMember.role : 'employee', bdNo: initialMember?.bdNo });
  const [showLogin, setShowLogin] = useState(false);
  const [loginTab, setLoginTab] = useState<'member'|'manager'>('manager');
  const [loginInput, setLoginInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  
  const handleLogout = () => {
    if (currentUser.role === 'manager') {
      setCurrentUser({ name: initialMember ? initialMember.name : 'Guest', role: 'employee', bdNo: initialMember?.bdNo });
      setActiveTab('personal_portal');
    } else {
      onBack();
    }
  };

  const handleLogin = async () => {
    if (loginTab === 'member') {
      try {
        setLoginError('Checking...');
        const { data, error } = await supabase
          .from('Canteen')
          .select('Surname, Rank')
          .eq('BD No', loginInput)
          .single();
          
        if (error || !data) {
          setLoginError('Member not found. Check BD No.');
        } else {
          setCurrentUser({ name: `${data.Rank} ${data.Surname}`, role: 'employee', bdNo: loginInput });
          setActiveTab('personal_portal');
          setShowLogin(false);
          setLoginInput('');
          setLoginError('');
        }
      } catch (err) {
        setLoginError('Network Error.');
      }
    } else {
      if (loginInput === '1234') {
        setCurrentUser({ name: 'System Admin', role: 'manager' });
        setActiveTab('manager_dashboard');
        setShowLogin(false);
        setLoginInput('');
        setLoginError('');
      } else {
        setLoginError('Invalid Manager PIN. Try 1234');
      }
    }
  };


  const mockUsers: Record<string, {name: string, role: 'employee'}> = {
    '469000': { name: 'LAC Nishad', role: 'employee' },
    '469001': { name: 'Sgt Hasan', role: 'employee' },
    '469002': { name: 'Cpl Jamil', role: 'employee' },
    '469003': { name: 'Flt Lt Robin', role: 'employee' }
  };

  const toggleLanguage = () => {
    const nextLang = i18n.language === 'bn' ? 'en' : 'bn';
    i18n.changeLanguage(nextLang);
  };

  const isEmployee = currentUser.role === 'employee' || currentUser.name === 'Guest';
  const navItems = currentUser.role === 'manager' ? [
    { id: 'manager_dashboard', name: 'Manager Home', icon: Grid },
    { id: 'pos_sales', name: 'POS Sales', icon: ShoppingCart },
    { id: 'member_db', name: 'Member DB', icon: Users },
    { id: 'inventory', name: 'Inventory', icon: Pkg },
    { id: 'expenditures', name: 'Expenditures', icon: Banknote },
    { id: 'reports', name: 'Reports', icon: PieChart },
    { id: 'fund', name: 'Fund', icon: Wallet },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
  ] : [
    { id: 'dashboard', name: 'Home', icon: Grid },
    { id: 'personal_portal', name: 'Personal Portal', icon: UserCircle },
    { id: 'inventory', name: 'Inventory', icon: Pkg },
    { id: 'help', name: 'Help', icon: HelpCircle },
    { id: 'manager_login', name: 'Manager Portal', icon: LogIn }
  ];

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <EmployeeDashboard currentUser={currentUser} onManagerPortalClick={() => { setLoginTab('manager'); setShowLogin(true); setLoginInput(''); setLoginError(''); }} />;
      case 'personal_portal': return <PersonalPortal currentUser={currentUser} />;

      case 'manager_dashboard': return <ManagerDashboard />;
      case 'pos_sales': return <PosSales />;
      case 'member_db': return <MemberDB />;
      case 'inventory': return <CanteenInventory />;
      case 'expenditures': return <Expenditures />;
      case 'reports': return <CanteenReports />;
      case 'fund': return <CanteenFund />;
      case 'settings': return <CanteenSettings />;
      default: return <div className="text-center p-10 font-bold text-slate-400 animate-pulse">Under Construction ({activeTab})</div>;
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] bg-slate-800 dark:bg-slate-950 overflow-hidden flex flex-col md:flex-row transition-all duration-300 ${i18n.language === 'bn' ? 'font-hind-siliguri text-[105%] leading-relaxed' : 'font-sans'}`}>
      
      {/* Dynamic Font Style Injection for the module */}
      <style>{`
        .font-hind-siliguri {
          font-family: 'Hind Siliguri', sans-serif;
        }
      `}</style>

      {/* Sidebar - Desktop */}
      <div className={`w-64 border-r flex-col shrink-0 h-full overflow-y-auto hidden md:flex rounded-br-[40px] ${"bg-slate-950 border-slate-800"}`}>
        <div className="p-8 pb-4">
          <h1 className={`font-black text-2xl tracking-widest flex items-center space-x-2 ${"text-white dark:text-white"}`}>
            <Utensils className="w-6 h-6 text-[#4f46e5]" />
            <span>CAFEUAV</span>
          </h1>
          <div className="mt-3 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-800/50">
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
                onClick={() => {
                  if (item.id === 'manager_login') {
                      setLoginTab('manager'); 
                      setShowLogin(true); 
                      setLoginInput(''); 
                      setLoginError('');
                  } else {
                      setActiveTab(item.id);
                  }
                }}
                className={`w-full flex items-center space-x-3 px-5 py-3.5 rounded-2xl transition-all font-bold ${
                  isActive 
                  ? 'bg-[#4f46e5] text-white shadow-lg shadow-indigo-500/30' 
                  : 'text-slate-400 hover:bg-slate-800 dark:hover:bg-slate-800 hover:text-slate-300'
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </button>
            )
          })}
        </div>

        <div className="p-6 space-y-4">
              <button
                  onClick={handleLogout}
                 className="w-full flex items-center justify-center space-x-2 px-4 py-3.5 rounded-2xl text-rose-600 bg-rose-900/30 hover:bg-rose-100 transition-colors font-bold text-xs uppercase tracking-widest"
              >
                 <LogIn className="w-4 h-4 rotate-180" />
                 <span>LOGOUT</span>
              </button>
          
          <div className={`flex items-center space-x-3 p-3 rounded-2xl cursor-pointer ${isEmployee ? 'bg-slate-900 text-white' : 'bg-slate-900 text-white'}`} onClick={handleLogout}>
             <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center overflow-hidden">
               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}&backgroundColor=0f172a`} alt="Avatar" className="w-full h-full object-cover" />
             </div>
             <div className="text-left flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {currentUser.role === 'manager' ? 'MANAGER' : (currentUser.name === 'Guest' ? 'GUEST MODE' : 'CUSTOMER MODE')}
                </p>
                <p className="text-sm font-bold leading-none">{currentUser.name}</p>
             </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Mobile Overlay */}
      {mobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] md:hidden flex" onClick={() => setMobileMenuOpen(false)}>
              <div className={`w-64 h-full flex flex-col shadow-2xl animate-in slide-in-from-left-4 ${"bg-slate-900"}`} onClick={e => e.stopPropagation()}>
                  <div className="p-6 pb-4 flex justify-between items-center">
                      <h1 className={`font-black text-xl tracking-widest flex items-center space-x-2 ${"text-white"}`}>
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
                                  onClick={() => {
                                      if (item.id === 'manager_login') {
                                          setLoginTab('manager'); 
                                          setShowLogin(true); 
                                          setLoginInput(''); 
                                          setLoginError('');
                                      } else {
                                          setActiveTab(item.id as any);
                                      }
                                      setMobileMenuOpen(false);
                                  }}
                                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all font-bold ${
                                    isActive 
                                    ? 'bg-[#4f46e5] text-white shadow-lg' 
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                  }`}
                              >
                                  <item.icon className="w-4 h-4" />
                                  <span>{item.name}</span>
                              </button>
                          )
                      })}
                  </div>
                  <div className={`p-4 border-t ${isEmployee ? "border-slate-800" : "border-slate-800"}`}>
                      <button
                          onClick={handleLogout}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl text-rose-600 bg-rose-900/30 font-bold text-xs uppercase"
                      >
                          <LogIn className="w-4 h-4 rotate-180" />
                          <span>LOGOUT</span>
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
         
         {/* Top Header for Mobile only */}
         <div className={`md:hidden h-16 border-b flex items-center justify-between px-4 z-10 sticky top-0 ${"bg-slate-950 border-slate-800"}`}>
            <div className="flex items-center space-x-3">
              <button onClick={() => setMobileMenuOpen(true)} className={`p-2 rounded-lg ${"text-slate-400 bg-slate-800"}`}>
                <Menu className="w-5 h-5" />
              </button>
              <span className={`font-bold text-lg ${"text-white dark:text-white"}`}>CAFEUAV</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-indigo-500">
                   <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.name}&backgroundColor=0f172a`} alt="Avatar" className="w-full h-full object-cover" />
            </div>
         </div>

         {/* Content View */}
         <div className={`flex-1 overflow-y-auto p-4 sm:p-8 ${"bg-slate-950"}`}>
            {renderContent()}
         </div>
      
      {showLogin && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-in zoom-in-95 duration-200">
             
             <div className="text-center mb-8">
               <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 rounded-2xl shadow-sm mb-4">
                  <Coffee className="w-8 h-8 text-[#4f46e5]" />
               </div>
               <h2 className="text-2xl font-black text-white tracking-widest flex items-center justify-center space-x-2">
                 <span>🍽️</span> <span>CAFEUAV</span> <span>🍽️</span>
               </h2>
             </div>

             

             <div className="bg-slate-900 dark:bg-slate-900 rounded-3xl p-8 shadow-2xl relative border border-slate-800 dark:border-slate-800">
                <button onClick={() => setShowLogin(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-300 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>

                <div className="mb-6 mt-2">
                   <label className="block text-[11px] font-black text-slate-400 tracking-widest mb-3">
                     {loginTab === 'member' ? '# MEMBER ID' : '# SYSTEM KEY'}
                   </label>
                   {loginTab === 'member' ? (
                       <input 
                         type="text"
                         value={loginInput}
                         onChange={e => { setLoginInput(e.target.value); setLoginError(''); }}
                         placeholder="e.g. 469000"
                         className="w-full bg-[#0f172a] text-white px-5 py-4 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder:text-slate-300"
                       />
                   ) : (
                       <div className="flex justify-center space-x-3">
                           {[0,1,2,3].map(i => (
                               <input 
                                   key={i}
                                   type="password" inputMode="numeric" pattern="[0-9]*" autoFocus={i === 0} maxLength={1}
                                   value={loginInput[i] || ''}
                                   onChange={e => {
                                       const val = e.target.value;
                                       let newVal = loginInput.split('');
                                       newVal[i] = val.slice(-1); // take last char
                                       const finalVal = newVal.join('');
                                       setLoginInput(finalVal);
                                       setLoginError('');
                                       
                                       if (val && i < 3) {
                                           const next = document.getElementById(`pin-${i+1}`);
                                           if (next) next.focus();
                                       }
                                       if (finalVal.length === 4) {
                                           if (finalVal === '1234') {
                                               setCurrentUser({ name: 'System Admin', role: 'manager' });
                                               setActiveTab('manager_dashboard');
                                               setShowLogin(false);
                                               setLoginInput('');
                                               setLoginError('');
                                           } else {
                                               setLoginError('Verifying...');
                                               supabase.from('Canteen').select('Surname, Rank').eq('BD No', finalVal).single().then(({data, error}) => {
                                                   if (error || !data) {
                                                       setLoginError('Invalid System Key or BD No.');
                                                       setTimeout(() => {
                                                           setLoginInput('');
                                                           setLoginError('');
                                                           document.getElementById('pin-0')?.focus();
                                                       }, 800);
                                                   } else {
                                                       setCurrentUser({ name: `${data.Rank} ${data.Surname}`, role: 'manager', bdNo: finalVal });
                                                       setActiveTab('manager_dashboard');
                                                       setShowLogin(false);
                                                       setLoginInput('');
                                                       setLoginError('');
                                                   }
                                               });
                                           }
                                       }
                                   }}
                                   onKeyDown={e => {
                                       if (e.key === 'Backspace' && !loginInput[i] && i > 0) {
                                           const prev = document.getElementById(`pin-${i-1}`);
                                           if (prev) {
                                               prev.focus();
                                               let newVal = loginInput.split('');
                                               newVal[i-1] = '';
                                               setLoginInput(newVal.join(''));
                                           }
                                       }
                                   }}
                                   id={`pin-${i}`}
                                   className="w-14 h-14 bg-[#0f172a] border border-slate-700 text-white text-center text-xl rounded-md font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-inner"
                               />
                           ))}
                       </div>
                   )}
                   {loginError && <p className="text-rose-500 text-xs font-bold mt-3">{loginError}</p>}
                </div>

                {loginTab === 'member' && (
                    <button 
                       onClick={handleLogin}
                       className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 active:scale-[0.98]"
                    >
                       ESTABLISH SESSION
                    </button>
                )}
             </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

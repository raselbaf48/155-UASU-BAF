import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabase';
import { localDb } from '../../../services/localDatabase';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../i18n';
import { getCanteenConfig, resolveImageUrl, fetchCanteenConfigFromCloud, CanteenConfig } from '../utils/canteenSettings';
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
import { AirmanProfileModal } from '../../../components/AirmanProfileModal';

import { Wallet, LayoutDashboard, Coffee, Search, List, CreditCard, ArrowLeft, Utensils, Wifi, HelpCircle, LogIn, Grid, Package as Pkg, ShoppingCart, Users, Banknote, BarChart2, Settings as SettingsIcon, PieChart, Package, UserCircle, X, Menu, User, Eye, EyeOff, Lock, Phone } from 'lucide-react';

interface CanteenLayoutProps {
  initialMember?: { name: string, bdNo: string, role?: 'employee'|'manager', photoUrl?: string };
  onBack: () => void;
}

export const CanteenLayout: React.FC<CanteenLayoutProps> = ({ onBack, initialMember }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>(initialMember?.role === 'manager' ? 'manager_dashboard' : 'personal_portal');
  const [currentUser, setCurrentUser] = useState<any>({ name: initialMember ? initialMember.name : 'Guest', role: (initialMember && initialMember.role) ? initialMember.role : 'employee', bdNo: initialMember?.bdNo, DP: initialMember?.photoUrl });
  const [customerDp, setCustomerDp] = useState<string>(initialMember?.photoUrl || '');
  const [showLogin, setShowLogin] = useState(false);
  const [loginTab, setLoginTab] = useState<'member'|'manager'>('manager');
  const [loginInput, setLoginInput] = useState('');
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [currentCustomerAirman, setCurrentCustomerAirman] = useState<any>(null);
  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig>(() => getCanteenConfig());

  // Cloud config synchronization on mount & event listeners
  useEffect(() => {
    fetchCanteenConfigFromCloud().then(cfg => {
      if (cfg) setCanteenConfig(cfg);
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'canteen_settings') {
        setCanteenConfig(getCanteenConfig());
      }
    };
    const handleSettingsUpdated = (e: any) => {
      if (e.detail) {
        setCanteenConfig(e.detail);
      } else {
        setCanteenConfig(getCanteenConfig());
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('canteen_settings_updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('canteen_settings_updated', handleSettingsUpdated);
    };
  }, []);

  // Fetch customer DP from Canteen table or local DB whenever currentUser changes
  useEffect(() => {
    let isMounted = true;
    if (currentUser.role !== 'manager') {
      const fetchCustomerPhoto = async () => {
        try {
          const cleanBd = currentUser.bdNo ? currentUser.bdNo.replace(/^BD\/?/i, '').trim() : '';
          
          // 1. Check Supabase Canteen table first (where DP update happens in MemberDB)
          if (cleanBd) {
            const { data, error } = await supabase
              .from('Canteen')
              .select('DP, Surname, Rank, "BD No", airman_id')
              .or(`"BD No".eq.${cleanBd},airman_id.eq.${cleanBd}`)
              .limit(1);

            if (!error && data && data.length > 0 && data[0].DP) {
              if (isMounted) setCustomerDp(data[0].DP);
              return;
            }
          }

          // 2. Check by Surname/Name if BD No didn't yield a DP
          if (currentUser.name && currentUser.name !== 'Guest') {
            const parts = currentUser.name.trim().split(/\s+/);
            const surname = parts[parts.length - 1];
            if (surname) {
              const { data } = await supabase
                .from('Canteen')
                .select('DP, Surname, Rank')
                .ilike('Surname', `%${surname}%`)
                .limit(1);

              if (data && data.length > 0 && data[0].DP) {
                if (isMounted) setCustomerDp(data[0].DP);
                return;
              }
            }
          }

          // 3. Fallback to local airmen database
          const airmen = await localDb.getAirmen();
          const airman = airmen.find(a => (cleanBd && a.bdNo?.toLowerCase() === cleanBd.toLowerCase()) || (currentUser.name && a.name?.toLowerCase().includes(currentUser.name.toLowerCase())));
          if (airman?.photoUrl && isMounted) {
            setCustomerDp(airman.photoUrl);
          }
        } catch (err) {
          console.warn('Error fetching customer DP:', err);
        }
      };

      fetchCustomerPhoto();
    }
    return () => { isMounted = false; };
  }, [currentUser.bdNo, currentUser.name, currentUser.role]);

  const handleCustomerProfileClick = async () => {
    if (currentUser.role === 'manager') return;
    try {
      const airmen = await localDb.getAirmen();
      const cleanBd = currentUser.bdNo ? currentUser.bdNo.replace(/^BD\/?/i, '').trim() : '';
      let found = airmen.find(a => a.bdNo === cleanBd);
      if (!found && currentUser.bdNo) {
        found = airmen.find(a => a.bdNo?.toLowerCase() === cleanBd.toLowerCase() || a.bdNo?.toLowerCase() === currentUser.bdNo?.toLowerCase());
      }
      if (!found && currentUser.name) {
        const matchName = currentUser.name.toLowerCase();
        found = airmen.find(a => {
          const fullName = `${a.rank} ${a.name}`.toLowerCase();
          return fullName.includes(matchName) || matchName.includes(a.name.toLowerCase());
        });
      }
      if (!found) {
        found = {
          id: 'cust-' + (cleanBd || '1'),
          serNo: 1,
          code: cleanBd || 'CUST',
          bdNo: currentUser.bdNo || cleanBd || 'N/A',
          rank: (currentUser.name?.split(' ')[0] as any) || 'LAC',
          name: currentUser.name ? currentUser.name.replace(/^[A-Za-z\-]+\s+/, '') : 'Customer',
          fullName: currentUser.name || 'Customer',
          trade: 'General',
          addressBlock: 'Barrack-3',
          mobileNo: 'N/A',
          flightName: 'Admin',
          remarks: 'Canteen Customer',
          active: true,
          photoUrl: customerDp || currentUser.DP || ''
        };
      } else if (customerDp) {
        found.photoUrl = customerDp;
      }
      setCurrentCustomerAirman(found);
      setShowCustomerProfile(true);
    } catch (e) {
      console.error('Error opening customer profile', e);
    }
  };

  
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
      const validPin = (canteenConfig.password || (canteenConfig as any).adminPassword || '0000').trim();
      const entered = loginInput.trim();
      const isBdMatch = canteenConfig.managerBdNo && entered === canteenConfig.managerBdNo.trim();
      if (entered === validPin || isBdMatch) {
        setCurrentUser({ name: canteenConfig.managerName || 'Canteen Manager', role: 'manager' });
        setActiveTab('manager_dashboard');
        setShowLogin(false);
        setLoginInput('');
        setLoginError('');
      } else {
        setLoginError('Invalid Manager Password. Please enter the password configured in Settings.');
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
        { id: 'manager_login', name: 'Manager Portal', icon: LogIn }
  ];

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <EmployeeDashboard currentUser={currentUser} onManagerPortalClick={() => { setLoginTab('manager'); setShowLogin(true); setLoginInput(''); setLoginError(''); }} />;
      case 'personal_portal': return <PersonalPortal currentUser={currentUser} />;

      case 'manager_dashboard': return <ManagerDashboard />;
      case 'pos_sales': return <PosSales />;
      case 'member_db': return <MemberDB />;
      case 'inventory': return <CanteenInventory readOnly={currentUser.role !== 'manager'} />;
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
        <div className="p-6 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700/80 flex items-center justify-center p-1 overflow-hidden shadow-sm shrink-0">
              {canteenConfig.logoUrl ? (
                <img 
                  src={resolveImageUrl(canteenConfig.logoUrl)} 
                  alt="Logo" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <Utensils className="w-5 h-5 text-[#4f46e5]" />
              )}
            </div>
            <h1 className="font-black text-lg tracking-wider truncate text-white dark:text-white">
              {canteenConfig.name.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'CAFEUAV'}
            </h1>
          </div>
          <div className="mt-3 inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-900/30 border border-emerald-800/50">
            <Wifi className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-black text-emerald-400 tracking-wider">CONNECTED</span>
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
          
          <div 
             className="flex items-center space-x-3 p-3 rounded-2xl cursor-pointer hover:bg-slate-800/80 transition-colors border border-transparent hover:border-slate-700/60 bg-slate-900 text-white" 
             onClick={handleCustomerProfileClick}
             title="View Profile"
          >
             <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 shadow-md text-indigo-400 overflow-hidden">
               {currentUser.role === 'manager' ? (
                 canteenConfig.adminImage ? (
                   <img 
                     src={resolveImageUrl(canteenConfig.adminImage)} 
                     alt="Admin" 
                     referrerPolicy="no-referrer"
                     className="w-full h-full object-cover"
                     onError={(e) => { e.currentTarget.style.display = 'none'; }}
                   />
                 ) : (
                   <User className="w-5 h-5" />
                 )
               ) : (
                 (customerDp || currentUser.DP) ? (
                   <img 
                     src={resolveImageUrl(customerDp || currentUser.DP)} 
                     alt={currentUser.name} 
                     referrerPolicy="no-referrer"
                     className="w-full h-full object-cover"
                     onError={(e) => { e.currentTarget.style.display = 'none'; }}
                   />
                 ) : (
                   <User className="w-5 h-5" />
                 )
               )}
             </div>
             <div className="text-left flex-1 min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                  {currentUser.role === 'manager' ? 'MANAGER MODE' : (currentUser.name === 'Guest' ? 'GUEST MODE' : 'CUSTOMER MODE')}
                </p>
                <p className="text-sm font-bold leading-none truncate text-white">
                  {currentUser.role === 'manager' ? (canteenConfig.managerName || 'LAC Nishad') : currentUser.name}
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* Sidebar - Mobile Overlay */}
      {mobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] md:hidden flex" onClick={() => setMobileMenuOpen(false)}>
              <div className={`w-64 h-full flex flex-col shadow-2xl animate-in slide-in-from-left-4 ${"bg-slate-900"}`} onClick={e => e.stopPropagation()}>
                  <div className="p-6 pb-4 flex justify-between items-center border-b border-slate-800">
                      <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center p-1 overflow-hidden shrink-0">
                            {canteenConfig.logoUrl ? (
                              <img 
                                src={resolveImageUrl(canteenConfig.logoUrl)} 
                                alt="Logo" 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (
                              <Utensils className="w-4 h-4 text-[#4f46e5]" />
                            )}
                          </div>
                          <h1 className="font-black text-base tracking-wider truncate text-white">
                              {canteenConfig.name.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'CAFEUAV'}
                          </h1>
                      </div>
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
                  <div className={`p-4 border-t space-y-3 ${isEmployee ? "border-slate-800" : "border-slate-800"}`}>
                      <div 
                         className="flex items-center space-x-3 p-2.5 rounded-2xl bg-slate-800/80 cursor-pointer hover:bg-slate-800 transition-colors"
                         onClick={() => {
                           setMobileMenuOpen(false);
                           handleCustomerProfileClick();
                         }}
                      >
                         <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 shadow-md text-indigo-400 overflow-hidden">
                           {currentUser.role === 'manager' ? (
                             canteenConfig.adminImage ? (
                               <img 
                                 src={resolveImageUrl(canteenConfig.adminImage)} 
                                 alt="Admin" 
                                 referrerPolicy="no-referrer"
                                 className="w-full h-full object-cover"
                                 onError={(e) => { e.currentTarget.style.display = 'none'; }}
                               />
                             ) : (
                               <User className="w-5 h-5" />
                             )
                           ) : (
                             (customerDp || currentUser.DP) ? (
                               <img 
                                 src={resolveImageUrl(customerDp || currentUser.DP)} 
                                 alt={currentUser.name} 
                                 referrerPolicy="no-referrer"
                                 className="w-full h-full object-cover"
                                 onError={(e) => { e.currentTarget.style.display = 'none'; }}
                               />
                             ) : (
                               <User className="w-5 h-5" />
                             )
                           )}
                         </div>
                         <div className="text-left flex-1 min-w-0">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
                              {currentUser.role === 'manager' ? 'MANAGER MODE' : (currentUser.name === 'Guest' ? 'GUEST MODE' : 'CUSTOMER MODE')}
                            </p>
                            <p className="text-sm font-bold leading-none truncate text-white">
                              {currentUser.role === 'manager' ? (canteenConfig.managerName || 'LAC Nishad') : currentUser.name}
                            </p>
                         </div>
                      </div>
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
              <div className="flex items-center space-x-2">
                {canteenConfig.logoUrl && (
                  <img 
                    src={resolveImageUrl(canteenConfig.logoUrl)} 
                    alt="Logo" 
                    referrerPolicy="no-referrer"
                    className="w-6 h-6 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
                <span className="font-bold text-base text-white truncate max-w-[180px]">
                  {canteenConfig.name.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'CAFEUAV'}
                </span>
              </div>
            </div>
            <div 
              onClick={handleCustomerProfileClick}
              className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border-2 border-indigo-500 cursor-pointer text-indigo-400 overflow-hidden"
              title="Profile"
            >
              {currentUser.role === 'manager' && canteenConfig.adminImage ? (
                <img 
                  src={resolveImageUrl(canteenConfig.adminImage)} 
                  alt="Admin" 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <User className="w-4 h-4" />
              )}
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
               <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl shadow-sm mb-4 p-2 overflow-hidden">
                  {canteenConfig.logoUrl ? (
                    <img 
                      src={resolveImageUrl(canteenConfig.logoUrl)} 
                      alt="Logo" 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <Coffee className="w-8 h-8 text-[#4f46e5]" />
                  )}
               </div>
               <h2 className="text-2xl font-black text-white tracking-widest flex items-center justify-center space-x-2">
                 <span>{canteenConfig.name || '🍽️ CAFEUAV 🍽️'}</span>
               </h2>
             </div>

             

             <div className="bg-slate-900 dark:bg-slate-900 rounded-3xl p-8 shadow-2xl relative border border-slate-800 dark:border-slate-800">
                <button onClick={() => setShowLogin(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-300 dark:hover:text-slate-300">
                  <X className="w-5 h-5" />
                </button>

                <div className="mb-6 mt-2">
                   <label className="block text-[11px] font-black text-slate-400 tracking-widest mb-3">
                     {loginTab === 'member' ? '# MEMBER ID' : '# MANAGER PASSWORD'}
                   </label>
                   {loginTab === 'member' ? (
                       <input 
                         type="text"
                         value={loginInput}
                         onChange={e => { setLoginInput(e.target.value); setLoginError(''); }}
                         placeholder="e.g. 469000"
                         className="w-full bg-[#0f172a] text-white px-5 py-4 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-[#4f46e5] placeholder:text-slate-300"
                         onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                       />
                   ) : (
                       <div className="space-y-3">
                           <div className="relative">
                               <input 
                                   type={showManagerPassword ? "text" : "password"}
                                   value={loginInput}
                                   onChange={e => {
                                       setLoginInput(e.target.value);
                                       setLoginError('');
                                   }}
                                   onKeyDown={e => {
                                       if (e.key === 'Enter') handleLogin();
                                   }}
                                   placeholder="Enter Manager Password"
                                   autoFocus
                                   className="w-full bg-[#0f172a] border border-slate-700 text-white px-5 py-4 pr-12 rounded-xl text-center text-lg tracking-wider font-bold focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-500 placeholder:text-sm placeholder:tracking-normal"
                               />
                               <button
                                   type="button"
                                   onClick={() => setShowManagerPassword(!showManagerPassword)}
                                   className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                               >
                                   {showManagerPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                               </button>
                           </div>
                           <p className="text-[11px] text-center text-slate-400">
                               Enter password configured in <span className="text-indigo-400 font-bold">Canteen Settings</span>
                           </p>
                       </div>
                   )}
                   {loginError && <p className="text-rose-500 text-xs font-bold mt-3 text-center">{loginError}</p>}
                </div>

                <button 
                   onClick={handleLogin}
                   className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                   <Lock className="w-4 h-4" />
                   <span>{loginTab === 'member' ? 'ESTABLISH SESSION' : 'ENTER MANAGER PORTAL'}</span>
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Customer Airman Profile Modal */}
      {showCustomerProfile && currentCustomerAirman && (
        <AirmanProfileModal
          airman={currentCustomerAirman}
          onClose={() => setShowCustomerProfile(false)}
          historyOnly={false}
          role="USER"
          allowEditDelete={false}
          canteenOnly={true}
        />
      )}
      </div>
    </div>
  );
};

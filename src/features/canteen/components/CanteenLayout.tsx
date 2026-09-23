import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../supabase';
import { localDb } from '../../../services/localDatabase';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../i18n';
import { getCanteenConfig, resolveImageUrl, fetchCanteenConfigFromCloud, CanteenConfig } from '../utils/canteenSettings';
import { autoCheckInitialCleanSlate } from '../utils/resetCanteenData';
import { initCanteenCloudSync, pullAllCanteenDataFromCloud, getCanteenCloudSyncStatus, CloudSyncStatus } from '../utils/canteenCloudSync';
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
import { RawInventoryManagement } from '../pages/RawInventoryManagement';
import { Expenditures } from '../pages/Expenditures';
import { CanteenReports } from '../pages/CanteenReports';
import { CanteenSettings } from '../pages/CanteenSettings';
import { CanteenFund } from '../pages/CanteenFund';
import { DueRegister } from '../pages/DueRegister';
import { AirmanProfileModal } from '../../../components/AirmanProfileModal';

import { Wallet, LayoutDashboard, Coffee, Search, List, CreditCard, ArrowLeft, Utensils, Wifi, HelpCircle, LogIn, Grid, Package as Pkg, ShoppingCart, Users, Banknote, BarChart2, Settings as SettingsIcon, PieChart, Package, UserCircle, X, Menu, User, Eye, EyeOff, Lock, Phone, UtensilsCrossed, Boxes, ClipboardList, Cloud, RefreshCw } from 'lucide-react';

interface CanteenLayoutProps {
  initialMember?: { name: string, bdNo: string, role?: 'employee'|'manager', photoUrl?: string, due?: number };
  onBack: () => void;
}

export const CanteenLayout: React.FC<CanteenLayoutProps> = ({ onBack, initialMember }) => {
  const { t, i18n } = useTranslation();
  const [canteenConfig, setCanteenConfig] = useState<CanteenConfig>(() => getCanteenConfig());
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>(() => getCanteenCloudSyncStatus());

  const cleanBdInitial = initialMember?.bdNo ? initialMember.bdNo.replace(/^BD\/?/i, '').trim() : '';
  const currentMgrBd = (canteenConfig.managerBdNo || '').replace(/^BD\/?/i, '').trim().toLowerCase();
  const isMasterManager = cleanBdInitial.toLowerCase() === '48456';
  const isCurrentManager = Boolean(currentMgrBd && cleanBdInitial.toLowerCase() === currentMgrBd);
  const isManager = initialMember?.role === 'manager' || isMasterManager || isCurrentManager;

  const [activeTab, setActiveTab] = useState<string>(isManager ? 'manager_dashboard' : 'personal_portal');

  const cachedMember = (() => {
    if (!cleanBdInitial || isMasterManager) return null;
    try {
      const raw = localStorage.getItem(`canteen_member_${cleanBdInitial.toLowerCase()}`);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const initialDp = isMasterManager 
    ? '' 
    : (isCurrentManager ? (canteenConfig.adminImage || initialMember?.photoUrl || '') : (initialMember?.photoUrl || cachedMember?.dp || ''));
  const [customerDp, setCustomerDp] = useState<string>(initialDp);

  const initialName = isMasterManager
    ? 'LAC Rizwan Islam'
    : (isCurrentManager
        ? (canteenConfig.managerName || initialMember?.name || 'Canteen Manager')
        : (initialMember ? initialMember.name : (cachedMember ? `${cachedMember.rank || ''} ${cachedMember.surname || ''}`.trim() : 'Guest')));

  const [currentUser, setCurrentUser] = useState<any>({ 
    name: initialName, 
    role: isManager ? 'manager' : 'employee', 
    bdNo: initialMember?.bdNo || cleanBdInitial, 
    DP: initialDp,
    due: isManager ? 0 : (initialMember?.due !== undefined ? initialMember.due : (cachedMember?.due !== undefined ? cachedMember.due : 0))
  });
  const [showLogin, setShowLogin] = useState(false);
  const [loginTab, setLoginTab] = useState<'member'|'manager'>('manager');
  const [loginInput, setLoginInput] = useState('');
  const [managerOtp, setManagerOtp] = useState<string[]>(['', '', '', '']);
  const [isOtpError, setIsOtpError] = useState(false);
  const [isOtpSuccess, setIsOtpSuccess] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showCustomerProfile, setShowCustomerProfile] = useState(false);
  const [currentCustomerAirman, setCurrentCustomerAirman] = useState<any>(null);

  // Cloud config synchronization on mount & event listeners
  useEffect(() => {
    autoCheckInitialCleanSlate();
    const cleanupCloudSync = initCanteenCloudSync();

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
    const handleCloudSyncStatus = (e: any) => {
      if (e.detail) {
        setCloudSyncStatus(e.detail);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('canteen_settings_updated', handleSettingsUpdated);
    window.addEventListener('canteen_cloud_sync_status', handleCloudSyncStatus);

    return () => {
      cleanupCloudSync();
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('canteen_settings_updated', handleSettingsUpdated);
      window.removeEventListener('canteen_cloud_sync_status', handleCloudSyncStatus);
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
              .from('Canteen_Member')
              .select('DP, Due, Surname, Rank, Contact, "BD No", airman_id')
              .or(`"BD No".eq.${cleanBd},airman_id.eq.${cleanBd},airman_id.eq.airman-${cleanBd}`)
              .limit(1);

            if (!error && data && data.length > 0 && data[0].DP) {
              if (isMounted) {
                setCustomerDp(data[0].DP);
                setCurrentUser((prev: any) => {
                  if (prev?.DP === data[0].DP) return prev;
                  return { ...prev, DP: data[0].DP };
                });
              }
              try {
                localStorage.setItem(`canteen_member_${cleanBd.toLowerCase()}`, JSON.stringify({
                  dp: data[0].DP,
                  due: Number(data[0].Due) || 0,
                  rank: data[0].Rank,
                  surname: data[0].Surname,
                  contact: data[0].Contact,
                  bdNo: cleanBd
                }));
              } catch {}
              return;
            }
          }

          // 2. Check by Surname/Name if BD No didn't yield a DP
          if (currentUser.name && currentUser.name !== 'Guest') {
            const parts = currentUser.name.trim().split(/\s+/);
            const surname = parts[parts.length - 1];
            if (surname) {
              const { data } = await supabase
                .from('Canteen_Member')
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
      const cleanBd = currentUser.bdNo ? currentUser.bdNo.replace(/^BD\/?/i, '').trim() : '';
      
      // 1. Fetch info directly from DB Canteen table
      let canteenMember: any = null;
      if (cleanBd) {
        const { data, error } = await supabase
          .from('Canteen_Member')
          .select('*')
          .or(`"BD No".eq.${cleanBd},airman_id.eq.${cleanBd},airman_id.eq.airman-${cleanBd}`)
          .limit(1);
        if (!error && data && data.length > 0) {
          canteenMember = data[0];
        }
      }

      if (!canteenMember && currentUser.name && currentUser.name !== 'Guest') {
        const parts = currentUser.name.trim().split(/\s+/);
        const surname = parts[parts.length - 1];
        if (surname) {
          const { data } = await supabase
            .from('Canteen_Member')
            .select('*')
            .ilike('Surname', `%${surname}%`)
            .limit(1);
          if (data && data.length > 0) {
            canteenMember = data[0];
          }
        }
      }

      // Also get supplementary info from localDb airmen if available (e.g. trade, flight)
      const airmen = await localDb.getAirmen();
      let found = airmen.find(a => (cleanBd && a.bdNo?.toLowerCase() === cleanBd.toLowerCase()));
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

      let finalCustomerAirman: any = null;
      if (canteenMember) {
        const bdNum = canteenMember['BD No'] || cleanBd || 'N/A';
        const rank = canteenMember['Rank'] || found?.rank || 'LAC';
        const surname = canteenMember['Surname'] || found?.name || currentUser.name || 'Customer';
        const dp = canteenMember['DP'] || customerDp || found?.photoUrl || currentUser.DP || '';
        const contact = canteenMember['Contact'] || canteenMember['Mobile No'] || found?.mobileNo || 'N/A';
        const due = Number(canteenMember.Due ?? canteenMember.due ?? canteenMember.baki ?? 0);

        finalCustomerAirman = {
          id: canteenMember.airman_id || found?.id || `airman-${bdNum}`,
          serNo: found?.serNo || 1,
          code: bdNum,
          bdNo: bdNum,
          rank: rank,
          name: surname,
          fullName: `${rank} ${surname}`.trim(),
          trade: found?.trade || 'Canteen Member',
          addressBlock: found?.addressBlock || 'N/A',
          mobileNo: contact,
          flightName: found?.flightName || 'Admin',
          remarks: found?.remarks || 'Canteen Customer',
          active: true,
          photoUrl: dp,
          canteenDue: due,
          canteenMember: canteenMember
        };
      } else if (found) {
        finalCustomerAirman = {
          ...found,
          photoUrl: customerDp || currentUser.DP || found.photoUrl || '',
          canteenDue: 0
        };
      } else {
        finalCustomerAirman = {
          id: 'cust-' + (cleanBd || '1'),
          serNo: 1,
          code: cleanBd || 'CUST',
          bdNo: currentUser.bdNo || cleanBd || 'N/A',
          rank: (currentUser.name?.split(' ')[0] as any) || 'LAC',
          name: currentUser.name ? currentUser.name.replace(/^[A-Za-z\-]+\s+/, '') : 'Customer',
          fullName: currentUser.name || 'Customer',
          trade: 'Canteen Member',
          addressBlock: 'N/A',
          mobileNo: 'N/A',
          flightName: 'Admin',
          remarks: 'Canteen Customer',
          active: true,
          photoUrl: customerDp || currentUser.DP || '',
          canteenDue: 0
        };
      }

      setCurrentCustomerAirman(finalCustomerAirman);
      setShowCustomerProfile(true);
    } catch (e) {
      console.error('Error opening customer profile', e);
    }
  };

  
  useEffect(() => {
    if (showLogin && loginTab === 'manager') {
      setManagerOtp(['', '', '', '']);
      setIsOtpError(false);
      setIsOtpSuccess(false);
      setLoginError('');
      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [showLogin, loginTab]);

  const verifyManagerOtp = (pin: string) => {
    const validPin = (canteenConfig.password || (canteenConfig as any).adminPassword || '0000').trim();
    const entered = pin.trim();
    const isBdMatch = canteenConfig.managerBdNo && entered === canteenConfig.managerBdNo.trim();

    if (entered === validPin || isBdMatch) {
      setIsOtpSuccess(true);
      setIsOtpError(false);
      setLoginError('✓ PIN Matched! Logging in...');
      setTimeout(() => {
        setCurrentUser({ name: canteenConfig.managerName || 'Canteen Manager', role: 'manager' });
        setActiveTab('manager_dashboard');
        setShowLogin(false);
        setManagerOtp(['', '', '', '']);
        setIsOtpSuccess(false);
        setLoginInput('');
        setLoginError('');
      }, 350);
    } else {
      setIsOtpError(true);
      setLoginError('✗ Incorrect PIN. Auto resetting...');
      setTimeout(() => {
        setManagerOtp(['', '', '', '']);
        setIsOtpError(false);
        setLoginError('Incorrect 4-digit PIN. Try again.');
        otpInputRefs.current[0]?.focus();
      }, 650);
    }
  };

  const handleOtpChange = (index: number, val: string) => {
    const rawDigits = val.replace(/\D/g, '');
    if (!rawDigits) {
      const newOtp = [...managerOtp];
      newOtp[index] = '';
      setManagerOtp(newOtp);
      return;
    }

    if (rawDigits.length > 1) {
      const chars = rawDigits.slice(0, 4).split('');
      const newOtp = [...managerOtp];
      chars.forEach((c, i) => {
        if (i < 4) newOtp[i] = c;
      });
      setManagerOtp(newOtp);
      setIsOtpError(false);
      setLoginError('');
      const targetIdx = Math.min(chars.length, 3);
      otpInputRefs.current[targetIdx]?.focus();
      if (newOtp.every(d => d !== '') && newOtp.length === 4) {
        verifyManagerOtp(newOtp.join(''));
      }
      return;
    }

    const char = rawDigits.charAt(rawDigits.length - 1);
    const newOtp = [...managerOtp];
    newOtp[index] = char;
    setManagerOtp(newOtp);
    setIsOtpError(false);
    setLoginError('');

    if (index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(d => d !== '')) {
      verifyManagerOtp(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!managerOtp[index] && index > 0) {
        const newOtp = [...managerOtp];
        newOtp[index - 1] = '';
        setManagerOtp(newOtp);
        otpInputRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...managerOtp];
        newOtp[index] = '';
        setManagerOtp(newOtp);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      otpInputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      const fullPin = managerOtp.join('');
      if (fullPin.length === 4) {
        verifyManagerOtp(fullPin);
      } else {
        setLoginError('Must enter all 4 digits.');
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;
    const chars = pasted.split('');
    const newOtp = ['', '', '', ''];
    chars.forEach((c, i) => {
      newOtp[i] = c;
    });
    setManagerOtp(newOtp);
    setIsOtpError(false);
    setLoginError('');
    const targetIdx = Math.min(chars.length, 3);
    otpInputRefs.current[targetIdx]?.focus();
    if (chars.length === 4) {
      verifyManagerOtp(pasted);
    }
  };

  const handleLogout = () => {
    onBack();
  };

  const handleLogin = async () => {
    if (loginTab === 'member') {
      try {
        setLoginError('Checking...');
        const { data, error } = await supabase
          .from('Canteen_Member')
          .select('Surname, Rank, DP, Due')
          .eq('BD No', loginInput)
          .single();
          
        if (error || !data) {
          setLoginError('Member not found. Check BD No.');
        } else {
          setCurrentUser({ name: `${data.Rank} ${data.Surname}`, role: 'employee', bdNo: loginInput, DP: data.DP, due: data.Due });
          if (data.DP) setCustomerDp(data.DP);
          setActiveTab('personal_portal');
          setShowLogin(false);
          setLoginInput('');
          setLoginError('');
        }
      } catch (err) {
        setLoginError('Network Error.');
      }
    } else {
      const fullPin = managerOtp.join('');
      if (fullPin.length < 4) {
        setLoginError('Must enter all 4 digits of the PIN.');
        return;
      }
      verifyManagerOtp(fullPin);
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
    { id: 'due_register', name: 'Due Register', icon: ClipboardList },
    { id: 'menu', name: 'Menu', icon: UtensilsCrossed },
    { id: 'inventory', name: 'Inventory', icon: Boxes },
    { id: 'expenditures', name: 'Expenditures', icon: Banknote },
    { id: 'reports', name: 'Reports', icon: PieChart },
    { id: 'fund', name: 'Fund', icon: Wallet },
    { id: 'settings', name: 'Settings', icon: SettingsIcon },
  ] : [
    { id: 'dashboard', name: 'Home', icon: Grid },
    { id: 'personal_portal', name: 'Personal Portal', icon: UserCircle },
    { id: 'menu', name: 'Menu', icon: UtensilsCrossed },
    { id: 'inventory', name: 'Inventory', icon: Boxes },
  ];

  const renderContent = () => {
    // If not a manager, prevent access to any manager tabs
    const managerTabs = ['manager_dashboard', 'pos_sales', 'member_db', 'due_register', 'expenditures', 'reports', 'fund', 'settings'];
    if (currentUser.role !== 'manager' && managerTabs.includes(activeTab)) {
      return (
        <PersonalPortal 
          currentUser={currentUser} 
          customerDp={customerDp} 
          onCustomerProfileClick={handleCustomerProfileClick} 
        />
      );
    }

    switch(activeTab) {
      case 'dashboard': return <EmployeeDashboard currentUser={currentUser} />;
      case 'personal_portal': return (
        <PersonalPortal 
          currentUser={currentUser} 
          customerDp={customerDp} 
          onCustomerProfileClick={handleCustomerProfileClick} 
        />
      );

      case 'manager_dashboard': return <ManagerDashboard />;
      case 'pos_sales': return <PosSales />;
      case 'member_db': return <MemberDB />;
      case 'due_register': return <DueRegister />;
      case 'menu': return <CanteenInventory readOnly={currentUser.role !== 'manager'} />;
      case 'inventory': return <RawInventoryManagement readOnly={currentUser.role !== 'manager'} />;
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

          <div className="mt-3 flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="flex items-center space-x-2 min-w-0">
              <Cloud className={`w-3.5 h-3.5 shrink-0 ${
                cloudSyncStatus.status === 'syncing' 
                  ? 'text-amber-400 animate-pulse' 
                  : cloudSyncStatus.status === 'error' 
                  ? 'text-rose-400' 
                  : 'text-emerald-400'
              }`} />
              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase tracking-wider block text-slate-300 truncate">
                  {cloudSyncStatus.status === 'syncing' 
                    ? 'Cloud Syncing...' 
                    : cloudSyncStatus.status === 'error' 
                    ? 'Cloud Offline' 
                    : 'Cloud Synced'}
                </span>
                {cloudSyncStatus.lastSyncTime && (
                  <span className="text-[9px] text-slate-500 block leading-tight">
                    {cloudSyncStatus.lastSyncTime}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => pullAllCanteenDataFromCloud()}
              title="Sync now from Cloud"
              className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors shrink-0"
            >
              <RefreshCw className={`w-3 h-3 ${cloudSyncStatus.status === 'syncing' ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 py-4 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)}
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
                                      setActiveTab(item.id as any);
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
                <span className="font-bold text-base text-white truncate max-w-[150px]">
                  {canteenConfig.name.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'CAFEUAV'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => pullAllCanteenDataFromCloud()}
                title="Sync from cloud"
                className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 active:scale-95 transition-transform"
              >
                <Cloud className={`w-4 h-4 ${cloudSyncStatus.status === 'syncing' ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
              </button>
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
              ) : (customerDp || currentUser.DP) ? (
                <img 
                  src={resolveImageUrl(customerDp || currentUser.DP)} 
                  alt={currentUser.name} 
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <User className="w-4 h-4" />
              )}
              </div>
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
                     {loginTab === 'member' ? '# MEMBER ID' : '# MANAGER 4-DIGIT PIN'}
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
                       <div className="space-y-4">
                           <div className="flex items-center justify-center gap-3 sm:gap-4 my-2">
                               {[0, 1, 2, 3].map((idx) => {
                                   const val = managerOtp[idx];
                                   return (
                                       <input
                                           key={idx}
                                           ref={(el) => { otpInputRefs.current[idx] = el; }}
                                           type={showManagerPassword ? "text" : "password"}
                                           inputMode="numeric"
                                           pattern="[0-9]*"
                                           maxLength={1}
                                           value={val}
                                           disabled={isOtpSuccess}
                                           onChange={(e) => handleOtpChange(idx, e.target.value)}
                                           onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                           onPaste={handleOtpPaste}
                                           className={`w-14 h-16 sm:w-16 sm:h-18 text-center text-2xl sm:text-3xl font-black font-mono rounded-2xl border-2 transition-all outline-none shadow-lg ${
                                               isOtpError
                                                   ? 'border-rose-500 bg-rose-950/40 text-rose-300 ring-4 ring-rose-500/30 animate-shake'
                                                   : isOtpSuccess
                                                   ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 ring-4 ring-emerald-500/30 scale-105'
                                                   : val
                                                   ? 'border-indigo-500 bg-indigo-950/30 text-white ring-2 ring-indigo-500/30'
                                                   : 'border-slate-700 bg-[#0f172a] text-white hover:border-slate-600 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20'
                                           }`}
                                       />
                                   );
                               })}
                           </div>

                           <div className="flex items-center justify-between px-1">
                               <p className="text-[11px] text-slate-400">
                                   Configured in <span className="text-indigo-400 font-bold">Canteen Settings</span>
                               </p>
                               <button
                                   type="button"
                                   onClick={() => setShowManagerPassword(!showManagerPassword)}
                                   className="text-slate-400 hover:text-white transition-colors text-xs flex items-center gap-1 font-bold cursor-pointer"
                               >
                                   {showManagerPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                   <span>{showManagerPassword ? 'Hide PIN' : 'Show PIN'}</span>
                               </button>
                           </div>
                       </div>
                   )}
                   {loginError && (
                     <p className={`text-xs font-bold mt-3 text-center ${isOtpSuccess ? 'text-emerald-400' : 'text-rose-500'}`}>
                       {loginError}
                     </p>
                   )}
                </div>

                <button 
                   onClick={handleLogin}
                   disabled={isOtpSuccess}
                   className={`w-full text-white font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 ${
                     isOtpSuccess 
                       ? 'bg-emerald-600 shadow-emerald-500/30' 
                       : 'bg-[#4f46e5] hover:bg-[#4338ca] shadow-indigo-500/30 hover:shadow-indigo-500/50 active:scale-[0.98]'
                   }`}
                >
                   <Lock className="w-4 h-4" />
                   <span>
                     {loginTab === 'member' 
                       ? 'ESTABLISH SESSION' 
                       : isOtpSuccess 
                       ? 'VERIFIED! LOGGING IN...' 
                       : 'ENTER MANAGER PORTAL'}
                   </span>
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

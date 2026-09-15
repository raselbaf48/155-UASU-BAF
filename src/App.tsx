/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar, SidebarTab } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { DashboardParadeState } from './components/DashboardParadeState';
import { ParadeStateFormattedView } from './components/ParadeStateFormattedView';
import { updatePresence } from './services/presenceService';
import { getAppConfig, saveAppConfig, isFeatureActive, AppConfig } from './utils/appConfig';
import { NightCountStateView } from './components/NightCountStateView';
import { NominalRoll } from './components/NominalRoll';
import { FlightsMiniView } from './components/FlightsMiniView';
import { LeaveRegisterView } from './components/LeaveRegisterView';
import { TdyRegisterView } from './components/TdyRegisterView';
import { DeploymentRegisterView } from './components/DeploymentRegisterView';
import { IdaCenterDutyView } from './components/IdaCenterDutyView';
import { MonthlyDutyRegister } from './components/MonthlyDutyRegister';
import { DutyRosterPeriodView } from './components/DutyRosterPeriodView';
import { DutyRatioMatrixView } from './components/DutyRatioMatrixView';
import { DutyAnalytics } from './components/DutyAnalytics';
import { DutyConflictMonitor } from './components/DutyConflictMonitor';
import { AirmanProfileModal } from './components/AirmanProfileModal';
import { AddEditAirmanModal } from './components/AddEditAirmanModal';
import { PrintableParadeStateModal } from './components/PrintableParadeStateModal';
import { PdfDutyImportModal } from './components/PdfDutyImportModal';
import { SettingsModal } from './components/SettingsModal';
import { AdminPasscodeModal } from './components/AdminPasscodeModal';
import { UserLoginGate } from './components/UserLoginGate';
import { Airman, FlightName, ParadeShift, UserRole, ThemePreference } from './types';
import { INITIAL_AIRMEN } from './data/initialAirmen';
import { Logo155UASU } from './components/Logo155UASU';
import { Shield, AlertCircle, X } from 'lucide-react';
import { getCurrentUserSession, clearUserSession, UserSession } from './utils/authSession';
import { localDb } from './services/localDatabase';

export default function App() {
  const [activeTab, setActiveTab] = useState<SidebarTab>('overview');
  const [role, setRole] = useState<UserRole>(() => {
    const saved = sessionStorage.getItem('baf_user_role');
    if (saved === 'OWNER') return 'OWNER';
    if (saved === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    return saved === 'ADMIN' ? 'ADMIN' : 'USER';
  });
  const [userSession, setUserSession] = useState<UserSession | null>(() => getCurrentUserSession());

  const [appConfig, setAppConfig] = useState<AppConfig | null>(null);
  const [hasSeenNotice, setHasSeenNotice] = useState<boolean>(false);
  
  useEffect(() => {
    // One-time cleanup for old test notice "Gg" or empty notices
    if (!localStorage.getItem('baf_cleared_notices_v4')) {
      const cfg = getAppConfig();
      if (cfg.notice.message === 'Gg' || !cfg.notice.message || cfg.notice.message.trim() === 'Gg') {
        cfg.notice.isActive = false;
        cfg.notice.message = '';
        saveAppConfig(cfg);
      }
      localStorage.setItem('baf_cleared_notices_v4', 'true');
    }

    setAppConfig(getAppConfig());
    const handleConfigChange = (e: any) => setAppConfig(e.detail);
    window.addEventListener('baf_app_config_changed', handleConfigChange);
    return () => window.removeEventListener('baf_app_config_changed', handleConfigChange);
  }, []);

  const dismissNotice = () => {
    if (appConfig?.notice) {
      const sig = (appConfig.notice.heading || '') + '::' + (appConfig.notice.message || '');
      localStorage.setItem('baf_dismissed_notice_sig', sig);
    }
    setHasSeenNotice(true);
  };

  const renderNoticeModal = () => {
    if (!userSession || !appConfig || hasSeenNotice) return null;
    if (!isFeatureActive(appConfig.notice)) return null;
    if (!appConfig.notice.message || appConfig.notice.message.trim() === '' || appConfig.notice.message.trim() === 'Gg') return null;

    // Check if user already dismissed this specific notice
    const sig = (appConfig.notice.heading || '') + '::' + (appConfig.notice.message || '');
    if (localStorage.getItem('baf_dismissed_notice_sig') === sig) return null;

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 relative">
          <button 
            onClick={dismissNotice} 
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex flex-col items-center text-center space-y-4 mb-2">
            <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-500">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">{appConfig.notice.heading || "Important Notice"}</h2>
            <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto px-1">
              {appConfig.notice.message}
            </div>
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={dismissNotice}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
            >
              ঠিক আছে (Close Notice)
            </button>
          </div>
        </div>
      </div>
    );
  };

    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState<boolean>(false);
  const [isUserManagementOpen, setIsUserManagementOpen] = useState<boolean>(false);
  
  // Theme Preference State (Light / Dark / System)
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => {
    const saved = localStorage.getItem('baf_theme_pref');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    return 'dark';
  });
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [showQuotaBanner, setShowQuotaBanner] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("firebase_quota_exceeded") === new Date().toDateString();
});

  // Apply Theme Preference to document and darkMode state
  useEffect(() => {
    localStorage.setItem('baf_theme_pref', themePreference);

    const applyTheme = () => {
      if (themePreference === 'dark') {
        document.documentElement.classList.add('dark');
        setDarkMode(true);
      } else if (themePreference === 'light') {
        document.documentElement.classList.remove('dark');
        setDarkMode(false);
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          document.documentElement.classList.add('dark');
          setDarkMode(true);
        } else {
          document.documentElement.classList.remove('dark');
          setDarkMode(false);
        }
      }
    };

    applyTheme();

    if (themePreference === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        if (e.matches) {
          document.documentElement.classList.add('dark');
          setDarkMode(true);
        } else {
          document.documentElement.classList.remove('dark');
          setDarkMode(false);
        }
      };
      mediaQuery.addEventListener('change', listener);
      
return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themePreference]);

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    sessionStorage.setItem('baf_user_role', newRole);
    
  };

  const handleUserLogout = () => {
    clearUserSession();
    setUserSession(null);
    handleRoleChange('USER');
  };

  

  const handleManualDarkModeToggle = (dark: boolean) => {
    setThemePreference(dark ? 'dark' : 'light');
  };

  // Sidebar Layout States
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Filters
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedShift, setSelectedShift] = useState<ParadeShift>('Morning');
  const [selectedFlight, setSelectedFlight] = useState<FlightName | 'Overall'>('Overall');

  // Data
  const [airmen, setAirmen] = useState<Airman[]>(INITIAL_AIRMEN);
  const [loadingAirmen, setLoadingAirmen] = useState<boolean>(false);
  const [conflictCount, setConflictCount] = useState<number>(0);

  // Modals
  const [selectedAirmanProfile, setSelectedAirmanProfile] = useState<{
    airman: Airman;
    initialTab?: 'profile' | 'history';
    initialCategory?: string;
    historyOnly?: boolean;
  } | null>(null);
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [airmanToEdit, setAirmanToEdit] = useState<Airman | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isPdfImportModalOpen, setIsPdfImportModalOpen] = useState<boolean>(false);

  // Fetch airmen from backend API with graceful fallback
  const fetchAirmen = async () => {
    try {
      const res = await fetch('/api/airmen');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setAirmen(data);
        }
      }
    } catch (err) {
      // Fallback already provided by INITIAL_AIRMEN
    } finally {
      setLoadingAirmen(false);
    }
  };

  useEffect(() => {
    fetchAirmen();
  }, []);

  useEffect(() => {
    const handleQuota = () => setShowQuotaBanner(true);
    window.addEventListener('baf_quota_exceeded', handleQuota);
    return () => window.removeEventListener('baf_quota_exceeded', handleQuota);
  }, []);


  useEffect(() => {
    const handleDetailedUsersChange = (e: any) => {
      const newUsers = e.detail;
      if (userSession && newUsers) {
        const myDetail = newUsers.find((u: any) => u.bdNo.toLowerCase() === userSession.bdNo.toLowerCase());
        if (myDetail) {
          if (myDetail.status !== 'ACTIVE') {
            handleUserLogout();
            alert('Your account has been suspended or disabled by admin.');
          } else {
            // Only demote if their current active role is higher than what's allowed in myDetail
            const roleHierarchy = { 'OWNER': 4, 'SUPER_ADMIN': 3, 'ADMIN': 2, 'USER': 1 };
            const currentActiveRole = sessionStorage.getItem('baf_user_role') || 'USER';
            if (roleHierarchy[currentActiveRole] > roleHierarchy[myDetail.role]) {
              handleRoleChange(myDetail.role);
              const updatedSession = { ...userSession, assignedRole: myDetail.role };
              setUserSession(updatedSession);
              sessionStorage.setItem('baf_user_session', JSON.stringify(updatedSession));
            }
          }
        }
      }
    };
    window.addEventListener('baf_detailed_users_changed', handleDetailedUsersChange);
    return () => window.removeEventListener('baf_detailed_users_changed', handleDetailedUsersChange);
  }, [userSession, handleRoleChange, handleUserLogout]);


  // Real-time EventSource Listener & Auto-sync across all clients
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let failureCount = 0;

    const connectSSE = () => {
      try {
        eventSource = new EventSource('/api/realtime/events');

        eventSource.onmessage = (event) => {
          failureCount = 0;
          try {
            const data = JSON.parse(event.data);
            if (
              data.type === 'DATA_UPDATED' ||
              data.type === 'ROSTER_UPDATED' ||
              data.type === 'AIRMEN_UPDATED' ||
              data.type === 'PARADE_UPDATED'
            ) {
              fetchAirmen();
              window.dispatchEvent(new CustomEvent('baf_state_updated', { detail: data }));
            }
          } catch {
            // Ignore parse errors on raw messages or pings
          }
        };

        eventSource.onerror = () => {
          failureCount++;
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          // On static hosting (like Cloudflare Pages), realtime events fall back to periodic polling
          if (failureCount < 3) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(connectSSE, 10000);
          }
        };
      } catch (err) {
        // SSE not supported or offline
      }
    };

    connectSSE();

    // Re-fetch when tab becomes visible or focused
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAirmen();
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    // 30-second background sync fallback
    const interval = setInterval(() => {
      window.dispatchEvent(new CustomEvent('baf_state_updated'));
    }, 30000);

    return () => {
      if (eventSource) eventSource.close();
      clearTimeout(reconnectTimeout);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // Fetch conflict count for sidebar indicator
  useEffect(() => {
    const fetchConflicts = async () => {
      try {
        const monthKey = selectedDate.slice(0, 7);
        const res = await fetch(`/api/analytics?month=${monthKey}`);
        if (res.ok) {
          const data = await res.json();
          setConflictCount((data.conflictAlerts || []).length);
        }
      } catch (err) {
        console.error('Failed to fetch conflict count:', err);
      }
    };
    fetchConflicts();
    const handleGlobalUpdate = () => {
      fetchConflicts();
      fetchAirmen();
    };
    window.addEventListener('baf_state_updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('baf_state_updated', handleGlobalUpdate);
    };
  }, [selectedDate]);

  // Handle dark mode class on root HTML
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Airman CRUD Handlers
  const handleSaveAirman = async (airmanData: Partial<Airman>) => {
    try {
      if (airmanToEdit) {
        const res = await fetch(`/api/airmen/${airmanToEdit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(airmanData),
        });
        if (res.ok) {
          fetchAirmen();
        }
      } else {
        const res = await fetch('/api/airmen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(airmanData),
        });
        if (res.ok) {
          fetchAirmen();
        }
      }
    } catch (err) {
      console.error('Error saving airman:', err);
    } finally {
      setAirmanToEdit(null);
    }
  };

  const handleSyncGoogleSheet = async () => {
    const res = await fetch('/api/sync-google-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheetUrl: 'https://docs.google.com/spreadsheets/d/1tsmdZI55KL6IbPhPsRqBpGWR9uTIeDE474xF36g96nY/export?format=csv',
      }),
    });
    if (!res.ok) {
      throw new Error('Failed to sync sheet');
    }
    await fetchAirmen();
  };

  const handleDeleteAirman = async (airmanId: string) => {
    try {
      const res = await fetch(`/api/airmen/${airmanId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAirmen();
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
      }
    } catch (err) {
      console.error('Error deleting airman:', err);
    }
  };

  // User Login Gate: Only render login interface when not authenticated
  if (!userSession) {
    return (
      <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        <UserLoginGate
          airmen={airmen}
          onAuthenticated={() => {
            const sess = getCurrentUserSession();
            setUserSession(sess);
            if (sess?.assignedRole) {
              handleRoleChange(sess.assignedRole as any);
            } else {
              handleRoleChange('USER');
            }
            
            // Trigger instant data download from cloud after login
            localDb.syncFromFirebase();
          }}
        />
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {renderNoticeModal()}
      {/* Left Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={role}
              userFlight={userSession?.flightName}
        conflictCount={conflictCount}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        airmenCount={airmen.filter(a => a.active).length}
        userSession={userSession}
        onOpenImportModal={() => setIsPdfImportModalOpen(true)}
                        onLogoutUser={handleUserLogout}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
                onLogoutAdmin={() => {
            handleRoleChange('USER');
            if (userSession) {
               const updatedSession = { ...userSession, assignedRole: 'USER' };
               setUserSession(updatedSession);
               sessionStorage.setItem('baf_user_session', JSON.stringify(updatedSession));
            }
          }}
      />

      {/* Right Content Wrapper */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 print:min-h-0 print:pl-0 print:p-0 print:bg-white ${sidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* Top Header Bar */}
        <TopHeader
          activeTab={activeTab}
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          role={role}
              userFlight={userSession?.flightName}
          userSession={userSession}
                              onLogoutUser={handleUserLogout}
          onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
          onLogoutAdmin={() => {
            handleRoleChange('USER');
            if (userSession) {
               const updatedSession = { ...userSession, assignedRole: 'USER' };
               setUserSession(updatedSession);
               sessionStorage.setItem('baf_user_session', JSON.stringify(updatedSession));
            }
          }}
        />

        {/* Main View Area (Opens on Right Side based on clicked tab) */}
        <main className={`flex-1 px-4 sm:px-6 lg:px-8 py-6 max-w-[1600px] w-full mx-auto print:p-0 print:m-0 print:max-w-none print:w-full`}>
          {activeTab === 'biodata-register' && (
            <NominalRoll
              variant="biodata"
              initialFlightFilter={selectedFlight === "Overall" || selectedFlight === "All" ? "All" : selectedFlight}
              airmen={airmen}
              role={role}
              userFlight={userSession?.flightName}
              onRefresh={fetchAirmen}
              onSyncGoogleSheet={handleSyncGoogleSheet}
              onAddAirman={() => {
                setAirmanToEdit(null);
                setIsAddEditOpen(true);
              }}
              onEditAirman={(a) => {
                setAirmanToEdit(a);
                setIsAddEditOpen(true);
              }}
              onDeleteAirman={handleDeleteAirman}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}
          {activeTab === 'overview' && (
            <DashboardParadeState
              role={role}
              userFlight={userSession?.flightName}
              airmen={airmen}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedShift={selectedShift}
              setSelectedShift={setSelectedShift}
              selectedFlight={selectedFlight}
              setSelectedFlight={setSelectedFlight}
              onOpenPrintModal={() => setIsPrintModalOpen(true)}
              isPrintMode={isPrintModalOpen}
              onClosePrintMode={() => setIsPrintModalOpen(false)}
              onViewAirmanProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
              onOpenImportModal={() => setIsPdfImportModalOpen(true)}
            />
          )}

          {activeTab === 'parade-state' && (
            <ParadeStateFormattedView
              role={role}
              userFlight={userSession?.flightName}
              airmen={airmen}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              initialDocumentType="PARADE"
              onOpenPrintModal={() => setIsPrintModalOpen(true)}
              isPrintMode={isPrintModalOpen}
              onClosePrintMode={() => setIsPrintModalOpen(false)}
              onViewAirmanProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
              onOpenImportModal={() => setIsPdfImportModalOpen(true)}
            />
          )}

          {activeTab === 'pt-state' && (
            <ParadeStateFormattedView
              role={role}
              userFlight={userSession?.flightName}
              airmen={airmen}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              initialDocumentType="PT"
              onOpenPrintModal={() => setIsPrintModalOpen(true)}
              onViewAirmanProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
              onOpenImportModal={() => setIsPdfImportModalOpen(true)}
            />
          )}

          
          {activeTab === 'night-count-state' && (
            <NightCountStateView
              role={role}
              userFlight={userSession?.flightName}
              airmen={airmen}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onViewAirmanProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}
          {activeTab === 'nominal' && (
            <NominalRoll
              initialFlightFilter={selectedFlight === "Overall" || selectedFlight === "All" ? "All" : selectedFlight}
              airmen={airmen}
              role={role}
              userFlight={userSession?.flightName}
              onRefresh={fetchAirmen}
              onSyncGoogleSheet={handleSyncGoogleSheet}
              onAddAirman={() => {
                setAirmanToEdit(null);
                setIsAddEditOpen(true);
              }}
              onEditAirman={(a) => {
                setAirmanToEdit(a);
                setIsAddEditOpen(true);
              }}
              onDeleteAirman={handleDeleteAirman}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}

          {activeTab === 'flights' && (
            <FlightsMiniView
              role={role}
              userFlight={userSession?.flightName}
              airmen={airmen}
              onSelectFlight={(fl) => {
                setSelectedFlight(fl);
                setActiveTab('nominal');
              }}
              onViewAirmanHistory={(a) => setSelectedAirmanProfile(a)}
            />
          )}

          {activeTab === 'leave-register' && (
            <LeaveRegisterView
              role={role}
              userFlight={userSession?.flightName}
              airmen={airmen}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}

          {activeTab === 'tdy-register' && (
            <TdyRegisterView
              role={role}
              userFlight={userSession?.flightName}
              airmen={airmen}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}
          {activeTab === 'attachment-register' && (
            <DeploymentRegisterView
              role={role}
              userFlight={userSession?.flightName}
              airmen={airmen}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}

          {activeTab === 'ida-center' && (
            <IdaCenterDutyView
              role={role}
              userFlight={userSession?.flightName}
              airmen={airmen}
              selectedDate={selectedDate}
              onViewAirmanProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}

          {activeTab === 'register' && (
            <MonthlyDutyRegister
              airmen={airmen}
              role={role}
              userFlight={userSession?.flightName}
              conflictCount={conflictCount}
              setConflictCount={setConflictCount}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}

          {activeTab === 'duty-roster' && (
            <DutyRosterPeriodView
              role={role}
              userFlight={userSession?.flightName}
              airmen={airmen}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}

          {activeTab === 'duty-ratio' && (
            <DutyRatioMatrixView
              role={role}
              userFlight={userSession?.flightName}
                          />
          )}

          {activeTab === 'analytics' && (
            <DutyAnalytics
              airmen={airmen}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
            />
          )}

          {activeTab === 'conflicts' && (
            <DutyConflictMonitor
              airmen={airmen}
              onViewProfile={(a, config) => setSelectedAirmanProfile({ airman: a, ...config })}
              onNavigateToRegister={() => setActiveTab('register')}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800/80 py-5 bg-white dark:bg-slate-900 text-center text-xs text-slate-500 dark:text-slate-400 mt-auto print:hidden">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5">
              <Logo155UASU className="h-6 w-6" />
              <span className="font-bold text-slate-700 dark:text-slate-300">
                155 UASU BAF • Office Management System
              </span>
            </div>
            <p>© 2026 Bangladesh Air Force • Confidential Personnel Duty Register</p>
          </div>
        </footer>

      </div>

      {/* Modals */}
      
      {selectedAirmanProfile && (
        <AirmanProfileModal
          airman={selectedAirmanProfile.airman}
          initialTab={selectedAirmanProfile.initialTab}
          initialCategory={selectedAirmanProfile.initialCategory}
          historyOnly={selectedAirmanProfile.historyOnly}
          onClose={() => setSelectedAirmanProfile(null)}
          onEditAirman={(a) => {
            setAirmanToEdit(a);
            setIsAddEditOpen(true);
          }}
          onRemoveAirman={handleDeleteAirman}
          role={role}
        />
      )}

      {isAddEditOpen && (
        <AddEditAirmanModal
          variant={activeTab === 'biodata-register' ? 'biodata' : 'nominal'}
          airmanToEdit={airmanToEdit}
          onSave={handleSaveAirman}
          onClose={() => {
            setIsAddEditOpen(false);
            setAirmanToEdit(null);
          }}
        />
      )}



      {/* AI PDF / Image Duty Data Import Modal */}
      <PdfDutyImportModal
        isOpen={isPdfImportModalOpen}
        onClose={() => setIsPdfImportModalOpen(false)}
        airmen={airmen}
        onImportSuccess={(dates) => {
          if (dates && dates.length > 0) {
            setSelectedDate(dates[0]);
            window.dispatchEvent(new CustomEvent('baf_state_updated', { detail: { date: dates[0] } }));
          } else {
            window.dispatchEvent(new CustomEvent('baf_state_updated'));
          }
        }}
        onNavigateToTab={(tab, date) => {
          if (date) setSelectedDate(date);
          setActiveTab(tab);
        }}
      />

      {/* System Settings Modal (Theme, Passcode, Import History, Backup) */}
      <AdminPasscodeModal
        isOpen={isAdminLoginModalOpen}
        airmen={airmen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onSuccess={(newRole) => {
          handleRoleChange(newRole);
          if (userSession) {
             const updatedSession = { ...userSession, assignedRole: newRole };
             setUserSession(updatedSession);
             sessionStorage.setItem('baf_user_session', JSON.stringify(updatedSession));
          }
          setIsAdminLoginModalOpen(false);
        }}
        assignedRole={userSession?.assignedRole || 'USER'}
        bdNo={userSession?.bdNo}
      />

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        role={role}
              userFlight={userSession?.flightName}
        nominalAirmen={airmen}
        currentTheme={themePreference}
        onThemeChange={(newTheme) => setThemePreference(newTheme)}
        onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
        onRosterUpdated={() => {
          fetchAirmen();
          window.dispatchEvent(new CustomEvent('baf_state_updated'));
        }}
      />
    </div>
  );
}

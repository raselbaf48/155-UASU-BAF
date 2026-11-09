import React, { useState, useEffect } from 'react';
import { Menu, KeyRound, ShieldCheck, LogOut, User, Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { SidebarTab } from './Sidebar';
import { UserRole } from '../types';
import { UserSession } from '../utils/authSession';
import { getFirebaseSyncState, FirebaseSyncStatusState, getSyncLogs, localDb } from '../services/localDatabase';
import { isFirestoreQuotaExceeded } from '../firebase';

const CloudSyncIndicator = () => {
  const [syncState, setSyncState] = useState<FirebaseSyncStatusState>(getFirebaseSyncState());
  const [hasError, setHasError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(() => isFirestoreQuotaExceeded());

  useEffect(() => {
    const handleSyncUpdate = (e: any) => {
      setSyncState(e.detail || getFirebaseSyncState());
    };
    
    const handleLogsUpdate = (e: any) => {
      const logs = e.detail;
      if (logs && logs.length > 0) {
        setHasError(logs[0].status === 'ERROR');
      }
    };

    const handleQuotaStatus = (e: any) => {
      setQuotaExceeded(Boolean(e.detail?.exceeded));
    };

    window.addEventListener('d1_sync_update', handleSyncUpdate);
    window.addEventListener('baf_sync_logs_updated', handleLogsUpdate);
    window.addEventListener('baf_firestore_quota_status', handleQuotaStatus);
    
    // Initial error check
    const logs = getSyncLogs();
    if (logs && logs.length > 0) {
       setHasError(logs[0].status === 'ERROR');
    }

    return () => {
      window.removeEventListener('d1_sync_update', handleSyncUpdate);
      window.removeEventListener('baf_sync_logs_updated', handleLogsUpdate);
      window.removeEventListener('baf_firestore_quota_status', handleQuotaStatus);
    };
  }, []);

  const handleManualSync = async () => {
    if (isRefreshing || syncState.status === 'syncing') return;
    setIsRefreshing(true);
    try {
      await localDb.syncFromFirebase();
    } catch (err) {
      console.warn("Manual sync error:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isSyncing = syncState.status === 'syncing' || isRefreshing;
  const isOnline = syncState.isConfigured || syncState.status === 'connected';

  return (
    <button
      type="button"
      onClick={handleManualSync}
      title={quotaExceeded ? "Firestore Free Quota Reached. Operating safely in local offline storage." : "Click to sync with Cloud Firestore"}
      className="hidden sm:flex items-center justify-center p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm relative group cursor-pointer transition-colors"
    >
      {isSyncing ? (
        <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      ) : quotaExceeded ? (
        <AlertTriangle className="w-4 h-4 text-amber-400" />
      ) : hasError ? (
        <CloudOff className="w-4 h-4 text-red-500" />
      ) : isOnline ? (
        <Cloud className="w-4 h-4 text-emerald-500" />
      ) : (
        <CloudOff className="w-4 h-4 text-slate-400" />
      )}
      
      {/* Tooltip */}
      <div className="absolute right-0 top-full mt-2 w-64 p-2.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        <div className="flex items-center justify-between font-bold mb-1 border-b border-slate-800 pb-1">
          <span>Cloud Sync Status</span>
          <span className={`text-[10px] font-normal ${quotaExceeded ? 'text-amber-400' : 'text-emerald-400'}`}>
            {quotaExceeded ? 'Daily Quota Exceeded' : 'Firestore Active'}
          </span>
        </div>
        <p className="text-slate-300 text-[11px] leading-tight">
          {quotaExceeded
            ? 'Free tier daily read/write quota reached. Data is 100% safely saved in local offline storage and resets tomorrow.'
            : isSyncing
            ? 'Syncing with cloud...'
            : hasError
            ? 'Error in last sync. Click to retry.'
            : isOnline
            ? 'Connected & up to date (Firestore).'
            : 'Cloud sync not configured.'}
        </p>
        <p className="text-[10px] text-emerald-300/80 mt-1.5 flex items-center justify-between">
          <span>{syncState.lastSyncTime ? `Last sync: ${new Date(syncState.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Ready to sync'}</span>
          <span className="text-slate-400 font-mono">(Click to sync)</span>
        </p>
      </div>
    </button>
  );
};

interface TopHeaderProps {
  activeTab: SidebarTab;
  onOpenMobileSidebar: () => void;
  role?: UserRole;
  userSession?: UserSession | null;
  onOpenAdminLogin?: () => void;
  onLogoutAdmin?: () => void;
  onLogoutUser?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  activeTab,
  onOpenMobileSidebar,
  role = 'USER',
  userSession,
  onOpenAdminLogin,
  onLogoutAdmin,
  onLogoutUser,
}) => {
  // Breadcrumb / Title mapping
  const getTabTitle = (tab: SidebarTab) => {
    switch (tab) {
      case 'overview':
        return { category: 'DASHBOARD', title: 'Dashboard & Strength Overview' };
      case 'parade-state':
        return { category: 'PARADE STATE', title: 'Daily Parade State' };
      case 'pt-state':
        return { category: 'PT STATE', title: 'Daily PT State' };
      case 'others-state':
        return { category: 'OTHERS STATE', title: 'Daily Others State' };
      case 'night-count-state':
        return { category: 'NIGHT COUNT STATE', title: 'Night Count State (Airmen)' };
      case 'nominal':
        return { category: 'ORG STRUCTURE', title: 'Nominal Roll' };
      case 'flights':
        return { category: 'ORG STRUCTURE', title: 'Flights & Section Overview' };
      case 'biodata-register':
        return { category: 'WORKFORCE', title: 'Biodata Register' };
      case 'leave-register':
        return { category: 'WORKFORCE', title: 'Leave Register' };
      case 'tdy-register':
        return { category: 'WORKFORCE', title: 'TDY Register' };
      case 'attachment-register':
        return { category: 'WORKFORCE', title: 'Deployment Register' };
      case 'ida-center':
        return { category: 'SCHEDULE MANAGEMENT', title: 'IDA Center Duty' };
      case 'register':
        return { category: 'SCHEDULE MANAGEMENT', title: 'Monthly Duty Register' };
      case 'duty-roster':
        return { category: 'SCHEDULE MANAGEMENT', title: 'Duty Roster Period' };
      case 'duty-ratio':
        return { category: 'DUTY RATIO', title: 'Duty Ratio Matrix' };
      case 'analytics':
        return { category: 'SCHEDULE MANAGEMENT', title: 'Duty Analytics & Load Balance' };
      case 'conflicts':
        return { category: 'SCHEDULE MANAGEMENT', title: 'Duty Conflict Monitor & Rules' };
      default:
        return { category: 'SYSTEM', title: 'BAF 155 UASU System' };
    }
  };

  const { category, title } = getTabTitle(activeTab);

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 transition-colors print:hidden">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile Menu Button + Breadcrumb */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center space-x-2 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              <span>{category}</span>
              <span>•</span>
              <span>155 UASU BAF</span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-none mt-0.5">
              {title}
            </h1>
          </div>
        </div>

        {/* Upper Right: User Profile & Admin Option */}
        <div className="flex items-center space-x-2.5">
          <CloudSyncIndicator />
          {/* User Session Info Badge */}
          {userSession && (
            <div className="hidden sm:flex items-center space-x-2 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 px-2.5 py-1.5 rounded-xl">
              <div className="w-6 h-6 rounded-lg bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="text-left text-xs leading-tight">
                <div className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                  {userSession.rank} {userSession.name}
                </div>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {userSession.bdNo}
                </div>
              </div>
              {onLogoutUser && (
                <button
                  type="button"
                  onClick={onLogoutUser}
                  className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                  title="Log out of User Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

                    {/* Admin Role Status & Login */}
          {role === 'USER' ? (
            (userSession?.systemRole === 'ADMIN' || userSession?.systemRole === 'SUPER_ADMIN' || userSession?.systemRole === 'OWNER' || !!userSession?.adminPass) && (
               <button
                  onClick={onOpenAdminLogin}
                  className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
               >
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold hidden sm:inline">Admin Login</span>
               </button>
            )
          ) : (
            <div className="flex items-center space-x-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-3 py-1.5 rounded-xl shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-black text-emerald-800 dark:text-emerald-200">
                {role === 'OWNER' ? 'Owner Active' : role === 'SUPER_ADMIN' ? 'Super Admin Active' : 'Admin Active'}
              </span>
              {onLogoutAdmin && (
                <button
                  type="button"
                  onClick={onLogoutAdmin}
                  className="ml-2 p-0.5 text-emerald-600/70 hover:text-rose-500 rounded transition-colors cursor-pointer"
                  title="Logout Admin Mode"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

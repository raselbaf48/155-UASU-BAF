import React, { useState, useEffect } from 'react';
import { Menu, ShieldCheck, LogOut, User, Cloud, CloudOff } from 'lucide-react';
import { SidebarTab } from './Sidebar';
import { UserRole } from '../types';
import { UserSession } from '../utils/authSession';
import { isFirebaseConfigured, isFirestoreQuotaExceeded } from '../firebase';
import { getFirebaseSyncState } from '../services/localDatabase';
import { getPendingDeltaCount } from '../services/firebaseFirestoreService';

const CloudSyncButton = () => {
  const [syncState, setSyncState] = useState(() => getFirebaseSyncState());
  const [quotaExceeded, setQuotaExceeded] = useState(() => isFirestoreQuotaExceeded());
  const [pendingCount, setPendingCount] = useState(() => getPendingDeltaCount());
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  useEffect(() => {
    const refresh = () => {
      setSyncState(getFirebaseSyncState());
      setQuotaExceeded(isFirestoreQuotaExceeded());
      setPendingCount(getPendingDeltaCount());
      setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    };

    window.addEventListener('d1_sync_update', refresh);
    window.addEventListener('baf_firebase_quota_status', refresh);
    window.addEventListener('baf_pending_delta_updated', refresh);
    window.addEventListener('baf_sync_logs_updated', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);

    return () => {
      window.removeEventListener('d1_sync_update', refresh);
      window.removeEventListener('baf_firebase_quota_status', refresh);
      window.removeEventListener('baf_pending_delta_updated', refresh);
      window.removeEventListener('baf_sync_logs_updated', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, []);

  const handleOpenBackup = () => {
    window.dispatchEvent(new CustomEvent('baf_open_standalone_view', { detail: 'backup' }));
  };

  const isSyncing = syncState.status === 'syncing';

  let iconColorClass = 'text-emerald-500 dark:text-emerald-400';
  let tooltip = 'Firebase Cloud Synced (সব ডাটা আপডেটেড) — ক্লিক করে Local ও Firebase Cloud ব্যাকআপ, রিস্টোর ও লগ দেখুন';
  let IconComponent: any = Cloud;

  if (quotaExceeded) {
    iconColorClass = 'text-amber-500 dark:text-amber-400';
    tooltip = `Firebase Quota শেষ • Local Cloud চালু আছে${pendingCount > 0 ? ` (${pendingCount}টি পরিবর্তন অপেক্ষমাণ)` : ''} — ক্লিক করে ব্যাকআপ/রিস্টোর ও লগ দেখুন`;
    IconComponent = Cloud;
  } else if (isSyncing) {
    iconColorClass = 'text-indigo-500 dark:text-indigo-400 animate-pulse';
    tooltip = 'Firebase Cloud Syncing চলছে... — ক্লিক করে ব্যাকআপ, রিস্টোর ও লগ দেখুন';
    IconComponent = Cloud;
  } else if (!isOnline || !isFirebaseConfigured) {
    iconColorClass = 'text-rose-500 dark:text-rose-400';
    tooltip = !isOnline
      ? 'ইন্টারনেট অফলাইন (Local Cloud সক্রিয়) — ক্লিক করে ব্যাকআপ/রিস্টোর ও লগ দেখুন'
      : 'Firebase কনফিগার করা নেই — ক্লিক করে Local Cloud দেখুন';
    IconComponent = CloudOff;
  } else if (pendingCount > 0) {
    iconColorClass = 'text-sky-500 dark:text-sky-400';
    tooltip = `${pendingCount}টি পরিবর্তন ক্লাউড ব্যাকআপের জন্য অপেক্ষমাণ — ক্লিক করে ম্যানুয়াল ব্যাকআপ/রিস্টোর ও লগ দেখুন`;
    IconComponent = Cloud;
  }

  return (
    <button
      type="button"
      onClick={handleOpenBackup}
      className={`p-1.5 rounded-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer bg-transparent border-0 shadow-none ${iconColorClass}`}
      title={tooltip}
      aria-label="Cloud Backup, Restore & Sync Logs"
    >
      <IconComponent strokeWidth={2.35} className="w-[22px] h-[22px]" />
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
        return { category: 'SCHEDULE MANAGEMENT', title: 'Monthly Attendance Register' };
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
          <CloudSyncButton />
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

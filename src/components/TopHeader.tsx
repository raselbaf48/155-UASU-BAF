import React, { useState, useEffect } from 'react';
import { Menu, KeyRound, ShieldCheck, LogOut, User, Cloud, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { SidebarTab } from './Sidebar';
import { UserRole } from '../types';
import { UserSession } from '../utils/authSession';
import { GoogleDriveBackupModal } from './GoogleDriveBackupModal';
import { getDriveStatus, DriveSyncStatus } from '../services/googleDriveService';

const GoogleDriveSyncButton = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [driveStatus, setDriveStatus] = useState<DriveSyncStatus>(getDriveStatus());

  useEffect(() => {
    const handleStatusChanged = (e: any) => {
      if (e.detail) setDriveStatus(e.detail);
    };
    window.addEventListener('google_drive_status_changed', handleStatusChanged);
    return () => {
      window.removeEventListener('google_drive_status_changed', handleStatusChanged);
    };
  }, []);

  const isConnected = driveStatus.isConnected;
  const isSyncing = driveStatus.isSyncing;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/70 shadow-sm transition-all text-xs cursor-pointer group"
        title="Google Drive অটো ব্যাকআপ ও রিস্টোর"
      >
        <div className="relative flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
            <path d="M7.71 3.5L1.15 15l3.43 6 6.56-11.5L7.71 3.5z" fill="#0066DA" />
            <path d="M14.57 3.5H7.71l6.56 11.5h6.86L14.57 3.5z" fill="#00AC47" />
            <path d="M22.85 15l-3.42-6H4.58L8 15h14.85z" fill="#EA4335" />
            <path d="M14.57 15l-3.43 6h11.71l3.43-6H14.57z" fill="#FFBA00" />
            <path d="M1.15 15l3.43 6h6.86l-3.43-6H1.15z" fill="#00832D" />
            <path d="M8 9.5l3.43-6h6.86l-3.43 6H8z" fill="#2684FC" />
          </svg>
          {isConnected && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
          )}
        </div>

        <span className="hidden md:inline font-semibold text-slate-700 dark:text-slate-200">
          Drive Backup
        </span>

        {isConnected ? (
          <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
            {isSyncing ? 'Syncing...' : 'Auto-Sync'}
          </span>
        ) : (
          <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
            Local Only
          </span>
        )}
      </button>

      <GoogleDriveBackupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
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
          <GoogleDriveSyncButton />
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

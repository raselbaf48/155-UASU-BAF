import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo155UASU } from './Logo155UASU';
import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  Shield,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Layers,
  Building2,
  Clock,
  UserCheck,
  FileText,
  AlertTriangle,
  Sparkles,
  Award,
  CalendarDays,
  PanelLeftClose,
  PanelLeft,
  Sliders,
  Settings, 
  Moon,
  KeyRound,
  Lock,
  Unlock,
  LogOut,
  ClipboardList,
  Activity,
  UserCircle,
  User,
  X
} from 'lucide-react';
import { UserRole } from '../types';
import { UserSession } from '../utils/authSession';

export type SidebarTab =
  | 'overview'
  | 'nominal'
  | 'flights'
  | 'parade-state'
  | 'pt-state'
  | 'night-count-state'
  | 'biodata-register'
  | 'leave-register'
  | 'tdy-register'
  | 'attachment-register'
  | 'ida-center'
  | 'register'
  | 'duty-roster'
  | 'duty-ratio'
  | 'analytics'
  | 'conflicts';

interface SidebarProps {
  activeTab: SidebarTab;
  setActiveTab: (tab: SidebarTab) => void;
  role: UserRole;
  conflictCount: number;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  airmenCount: number;
  userSession?: UserSession | null;
  onOpenImportModal?: () => void;
  onOpenAdminLogin?: () => void;
  onLogoutAdmin?: () => void;
  onLogoutUser?: () => void;
  onOpenSettings?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  role,
  conflictCount,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  airmenCount,
  userSession,
  onOpenImportModal,
  onOpenAdminLogin,
  onLogoutAdmin,
  onLogoutUser,
  onOpenSettings,
}) => {
  // Accordion section open states
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    overview: true,
    orgStructure: true,
    workforce: true,
    schedule: true,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSelectTab = (tab: SidebarTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  const renderNavButton = (
    tab: SidebarTab,
    icon: React.ReactNode,
    label: string,
    title?: string,
    badge?: React.ReactNode,
    forceExpanded: boolean = false
  ) => {
    const isCollapsed = forceExpanded ? false : collapsed;
    const isActive = activeTab === tab;
    return (
      <motion.button
        type="button"
        key={tab}
        whileHover={{ x: isCollapsed ? 0 : 2 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => handleSelectTab(tab)}
        className={`relative w-full flex items-center ${
          isCollapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2.5'
        } rounded-xl text-xs font-bold transition-colors duration-150 cursor-pointer overflow-hidden ${
          isActive
            ? 'text-white'
            : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
        }`}
        title={title || label}
      >
        {isActive && (
          <motion.span
            layoutId={isCollapsed ? "activeSidebarIndicatorCollapsed" : "activeSidebarIndicator"}
            className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-900/50 border border-emerald-400/30 z-0"
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          />
        )}
        <div className="relative z-10 flex items-center justify-between w-full">
          <div className="flex items-center truncate">
            <span className={`shrink-0 ${isActive ? 'text-white drop-shadow-sm' : 'text-emerald-300'}`}>
              {icon}
            </span>
            {!isCollapsed && <span className="ml-3 truncate">{label}</span>}
          </div>
          {!isCollapsed && badge && (
            <div className="shrink-0 ml-2">{badge}</div>
          )}
        </div>
      </motion.button>
    );
  };

  const renderSidebarContent = (isMobileDrawer: boolean) => {
    const isCollapsed = isMobileDrawer ? false : collapsed;
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-3.5 bg-[#052818] border-b border-[#0d4f31] shrink-0">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="shrink-0 drop-shadow-md">
              <Logo155UASU className="h-11 w-11" />
            </div>
            {!isCollapsed && (
              <div className="leading-tight truncate">
                <div className="font-black text-sm tracking-wide text-white truncate">
                  155 UASU BAF
                </div>
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider truncate">
                  Intel • Surveillance • Strike
                </div>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          {!isMobileDrawer && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-emerald-200/70 hover:text-white hover:bg-[#0c4e2f] transition-colors cursor-pointer"
              title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {collapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
            </button>
          )}

          {/* Mobile Close Button (X) */}
          {isMobileDrawer && (
            <button
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-emerald-200 hover:text-white hover:bg-[#0c4e2f] transition-colors cursor-pointer"
              title="Close Menu"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* SECTION 1: OVERVIEW */}
          <div>
            {!isCollapsed && (
              <button
                onClick={() => toggleSection('overview')}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 hover:text-emerald-100 transition-colors cursor-pointer"
              >
                <span>OVERVIEW</span>
                {openSections.overview ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {(isCollapsed || openSections.overview) && (
              <div className="mt-2 space-y-2 sm:space-y-1">
                {renderNavButton('overview', <LayoutDashboard className="w-4 h-4 shrink-0" />, 'Dashboard', 'Dashboard & Strength Overview', undefined, isMobileDrawer)}
                {renderNavButton('parade-state', <ClipboardList className="w-4 h-4 shrink-0" />, 'Parade State', 'Daily Parade State (Official BAF Format)', undefined, isMobileDrawer)}
                {renderNavButton('pt-state', <Activity className="w-4 h-4 shrink-0" />, 'PT State', 'Daily PT State', undefined, isMobileDrawer)}
              </div>
            )}
          </div>

          {/* SECTION 2: ORG STRUCTURE */}
          <div>
            {!isCollapsed && (
              <button
                onClick={() => toggleSection('orgStructure')}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 hover:text-emerald-100 transition-colors cursor-pointer"
              >
                <span>ORG STRUCTURE</span>
                {openSections.orgStructure ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {(isCollapsed || openSections.orgStructure) && (
              <div className="mt-2 space-y-2 sm:space-y-1">
                {renderNavButton(
                  'nominal',
                  <Layers className="w-4 h-4 shrink-0" />,
                  'Nominal Roll (Airmen)',
                  `Nominal Roll (${airmenCount} Airmen)`,
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                    activeTab === 'nominal' ? 'bg-emerald-100 text-emerald-900' : 'bg-emerald-900/80 text-emerald-200'
                  }`}>
                    {airmenCount}
                  </span>,
                  isMobileDrawer
                )}

                {renderNavButton(
                  'flights',
                  <Building2 className="w-4 h-4 shrink-0" />,
                  'Flights & Sections',
                  'Flight Structure (Avionics, Mechanics, GCS, Admin)',
                  undefined,
                  isMobileDrawer
                )}
              </div>
            )}
          </div>

          {/* SECTION 3: REGISTERS */}
          <div>
            {!isCollapsed && (
              <button
                onClick={() => toggleSection('workforce')}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 hover:text-emerald-100 transition-colors cursor-pointer"
              >
                <span>REGISTERS</span>
                {openSections.workforce ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {(isCollapsed || openSections.workforce) && (
              <div className="mt-2 space-y-2 sm:space-y-1">
                {renderNavButton('biodata-register', <UserCircle className="w-4 h-4 shrink-0" />, 'Biodata Register', 'Biodata Register', undefined, isMobileDrawer)}
                {renderNavButton('leave-register', <Users className="w-4 h-4 shrink-0" />, 'Leave Register', 'Leave Register (Casual & Annual Leave)', undefined, isMobileDrawer)}
                {renderNavButton('tdy-register', <FileText className="w-4 h-4 shrink-0" />, 'TDY Register', 'TDY Register (Temporary Duty Outstation)', undefined, isMobileDrawer)}
                {renderNavButton('attachment-register', <FileText className="w-4 h-4 shrink-0" />, 'Deployment Register', 'Deployment Register (Bake & Bite, Canteen, Custom)', undefined, isMobileDrawer)}
                {renderNavButton(
                  'register',
                  <Calendar className="w-4 h-4 shrink-0" />,
                  'Duty Register',
                  'Duty Register',
                  conflictCount > 0 ? (
                    <span className="w-5 h-5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                      {conflictCount}
                    </span>
                  ) : undefined,
                  isMobileDrawer
                )}
                {renderNavButton('duty-ratio', <Sliders className="w-4 h-4 shrink-0" />, 'Duty Ratio Matrix', 'Duty Ratio Matrix', undefined, isMobileDrawer)}
              </div>
            )}
          </div>

          {/* SECTION 4: ROSTER */}
          <div>
            {!isCollapsed && (
              <button
                onClick={() => toggleSection('schedule')}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 hover:text-emerald-100 transition-colors cursor-pointer"
              >
                <span>ROSTER</span>
                {openSections.schedule ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {(isCollapsed || openSections.schedule) && (
              <div className="mt-2 space-y-2 sm:space-y-1">
                {renderNavButton('ida-center', <Shield className="w-4 h-4 shrink-0" />, 'IDA Center Duty', 'IDA Center Duty (Standby & Shifts)', undefined, isMobileDrawer)}
                {renderNavButton('night-count-state', <Moon className="w-4 h-4 shrink-0" />, 'Night Count State', 'Night Count State & Quotas', undefined, isMobileDrawer)}
                {renderNavButton('duty-roster', <FileText className="w-4 h-4 shrink-0" />, 'Duty Roster', 'Duty Roster Period & Export', undefined, isMobileDrawer)}
              </div>
            )}
          </div>

          {/* SECTION 5: ANALYSIS & CONFLICTS */}
          <div>
            {!isCollapsed && (
              <div className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 mt-4">
                <span>ANALYSIS</span>
              </div>
            )}
            <div className="mt-2 space-y-2 sm:space-y-1">
              {renderNavButton('analytics', <BarChart3 className="w-4 h-4 shrink-0" />, 'Duty Analysis', 'Duty Analytics & Load Balance', undefined, isMobileDrawer)}
              {renderNavButton(
                'conflicts',
                <ShieldAlert className="w-4 h-4 shrink-0" />,
                'Conflict Monitor',
                'Conflict Monitor & Rules',
                conflictCount > 0 && !isCollapsed ? (
                  <span className="px-1.5 py-0.5 text-[9px] bg-red-600 text-white rounded-md font-bold">
                    {conflictCount} Alert
                  </span>
                ) : undefined,
                isMobileDrawer
              )}
            </div>
          </div>
        </div>

        {/* User Session Profile */}
        {userSession && !isCollapsed && (
          <div className="px-3 py-2.5 bg-[#052818] border-t border-[#0d4f31] shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 truncate">
                <div className="w-7 h-7 rounded-lg bg-emerald-700/60 text-emerald-200 flex items-center justify-center font-bold text-xs shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="truncate text-left leading-tight">
                  <div className="text-xs font-bold text-white truncate">
                    {userSession.rank} {userSession.name}
                  </div>
                  <div className="text-[10px] font-mono text-emerald-300/80">
                    {userSession.bdNo} • {userSession.flightName}
                  </div>
                </div>
              </div>

              {onLogoutUser && (
                <button
                  type="button"
                  onClick={onLogoutUser}
                  className="p-1 text-emerald-300/60 hover:text-rose-400 hover:bg-[#0c4e2f] rounded-lg transition-colors cursor-pointer"
                  title="Logout User Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Settings Button in Sidebar Bottom */}
        {onOpenSettings && (
          <div className="px-3 py-2 border-t border-[#0d4f31] shrink-0">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenSettings();
              }}
              className={`w-full flex items-center ${
                isCollapsed ? 'justify-center p-2' : 'justify-start px-3 py-2 space-x-2.5'
              } rounded-xl text-emerald-100/90 hover:text-white hover:bg-[#0c4e2f] text-xs font-bold transition-all cursor-pointer`}
              title="Settings"
            >
              <Settings className="w-4 h-4 text-emerald-300 shrink-0" />
              {!isCollapsed && <span>Settings</span>}
            </button>
          </div>
        )}

        {/* Footer Role & Unit Info */}
        <div className="px-3 py-2 bg-[#042013] border-t border-[#093c24] shrink-0">
          {!isCollapsed ? (
            <div className="flex items-center justify-between text-[11px] text-emerald-300/60">
              <span className="font-semibold truncate">155 UASU BAF • BAF BASE ZHR</span>
              <span className="text-[10px] text-emerald-400/50 font-mono">v2.5</span>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Sidebar (Permanent left sidebar for large screens) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 hidden lg:flex flex-col bg-[#083822] text-white border-r border-[#0d4f31] transition-all duration-300 select-none print:hidden ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer (Visible, slow and smooth slide-in from left when hamburger clicked) */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="mobile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        {mobileOpen && (
          <motion.aside
            key="mobile-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-0 bottom-0 left-0 z-[60] flex flex-col w-72 max-w-[85vw] bg-[#083822] text-white border-r border-[#0d4f31] shadow-[12px_0_40px_rgba(0,0,0,0.65)] select-none lg:hidden"
          >
            {renderSidebarContent(true)}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};

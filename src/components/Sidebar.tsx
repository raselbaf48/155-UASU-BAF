import React, { useState } from 'react';
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
  Settings, Moon,
  KeyRound,
  Lock,
  Unlock,
  LogOut,
  ClipboardList,
  Activity,
} from 'lucide-react';
import { UserRole } from '../types';
import { UserSession } from '../utils/authSession';
import { User } from 'lucide-react';

export type SidebarTab =
  | 'overview'
  | 'nominal'
  | 'flights'
  | 'parade-state'
  | 'pt-state'
  | 'night-count-state'
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

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#083822] text-white border-r border-[#0d4f31] transition-all duration-300 ease-in-out select-none shadow-2xl print:hidden ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-3.5 bg-[#052818] border-b border-[#0d4f31] shrink-0">
          <div className="flex items-center space-x-2.5 overflow-hidden">
            <div className="shrink-0 drop-shadow-md">
              <Logo155UASU className="h-11 w-11" />
            </div>
            {!collapsed && (
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
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-emerald-200/70 hover:text-white hover:bg-[#0c4e2f] transition-colors"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        </div>

        {/* Scrollable Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-emerald-800 scrollbar-track-transparent">
          {/* SECTION 1: OVERVIEW */}
          <div>
            {!collapsed && (
              <button
                onClick={() => toggleSection('overview')}
                className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 hover:text-emerald-100 transition-colors"
              >
                <span>OVERVIEW</span>
                {openSections.overview ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {(collapsed || openSections.overview) && (
              <div className="mt-2 space-y-2 sm:space-y-1">
                {/* Dashboard */}
                <button
                  onClick={() => handleSelectTab('overview')}
                  className={`w-full flex items-center ${
                    collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                  } rounded-xl text-xs font-bold transition-all duration-150 ${
                    activeTab === 'overview'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                      : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                  }`}
                  title="Dashboard & Strength Overview"
                >
                  <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'overview' ? 'text-white' : 'text-emerald-300'}`} />
                  {!collapsed && <span className="ml-3 truncate">Dashboard</span>}
                </button>

                {/* Parade State (Daily Official Format) */}
                <button
                  onClick={() => handleSelectTab('parade-state')}
                  className={`w-full flex items-center ${
                    collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                  } rounded-xl text-xs font-bold transition-all duration-150 ${
                    activeTab === 'parade-state'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                      : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                  }`}
                  title="Daily Parade State (Official BAF Format)"
                >
                  <ClipboardList className={`w-4 h-4 shrink-0 ${activeTab === 'parade-state' ? 'text-white' : 'text-emerald-300'}`} />
                  {!collapsed && <span className="ml-3 truncate">Parade State</span>}
                </button>

                {/* PT State (Physical Training Report) */}
                <button
                  onClick={() => handleSelectTab('pt-state')}
                  className={`w-full flex items-center ${
                    collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                  } rounded-xl text-xs font-bold transition-all duration-150 ${
                    activeTab === 'pt-state'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                      : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                  }`}
                  title="Daily PT State"
                >
                  <Activity className={`w-4 h-4 shrink-0 ${activeTab === 'pt-state' ? 'text-white' : 'text-emerald-300'}`} />
                  {!collapsed && <span className="ml-3 truncate">PT State</span>}
                </button>
                {/* Night Count State */}
                <button
                  onClick={() => handleSelectTab('night-count-state')}
                  className={`w-full flex items-center ${
                    collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                  } rounded-xl text-xs font-bold transition-all duration-150 ${
                    activeTab === 'night-count-state'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                      : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                  }`}
                  title="Night Count State (Airmen)"
                >
                  <Moon className={`w-4 h-4 shrink-0 ${activeTab === 'night-count-state' ? 'text-white' : 'text-emerald-300'}`} />
                  {!collapsed && <span className="ml-3 truncate">Night Count State</span>}
                </button>
              </div>
            )}
          </div>

          {/* ADMIN-ONLY SECTIONS: ORG STRUCTURE, WORKFORCE, SCHEDULE MANAGEMENT */}
          {true && (
            <>
              {/* SECTION 2: ORG STRUCTURE */}
              <div>
                {!collapsed && (
                  <button
                    onClick={() => toggleSection('orgStructure')}
                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 hover:text-emerald-100 transition-colors"
                  >
                    <span>ORG STRUCTURE</span>
                    {openSections.orgStructure ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {(collapsed || openSections.orgStructure) && (
                  <div className="mt-2 space-y-2 sm:space-y-1">
                    {/* Nominal Roll */}
                    <button
                      onClick={() => handleSelectTab('nominal')}
                      className={`w-full flex items-center ${
                        collapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2.5'
                      } rounded-xl text-xs font-bold transition-all duration-150 ${
                        activeTab === 'nominal'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                          : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                      }`}
                      title={`Nominal Roll (${airmenCount} Airmen)`}
                    >
                      <div className="flex items-center truncate">
                        <Layers className={`w-4 h-4 shrink-0 ${activeTab === 'nominal' ? 'text-white' : 'text-emerald-300'}`} />
                        {!collapsed && <span className="ml-3 truncate">Nominal Roll (Airmen)</span>}
                      </div>
                      {!collapsed && (
                        <span className={`px-2 py-0.5 text-[10px] rounded-full font-black ${
                          activeTab === 'nominal' ? 'bg-emerald-100 text-emerald-900' : 'bg-emerald-900/80 text-emerald-200'
                        }`}>
                          {airmenCount}
                        </span>
                      )}
                    </button>

                    {/* Flights & Sections */}
                    <button
                      onClick={() => handleSelectTab('flights')}
                      className={`w-full flex items-center ${
                        collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                      } rounded-xl text-xs font-bold transition-all duration-150 ${
                        activeTab === 'flights'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                          : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                      }`}
                      title="Flight Structure (Avionics, Mechanics, GCS, Admin)"
                    >
                      <Building2 className={`w-4 h-4 shrink-0 ${activeTab === 'flights' ? 'text-white' : 'text-emerald-300'}`} />
                      {!collapsed && <span className="ml-3 truncate">Flights & Sections</span>}
                    </button>
                  </div>
                )}
              </div>

              {/* SECTION 3: REGISTERS */}
              <div>
                {!collapsed && (
                  <button
                    onClick={() => toggleSection('workforce')}
                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 hover:text-emerald-100 transition-colors"
                  >
                    <span>REGISTERS</span>
                    {openSections.workforce ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {(collapsed || openSections.workforce) && (
                  <div className="mt-2 space-y-2 sm:space-y-1">
                    {/* Leave Register */}
                    <button
                      onClick={() => handleSelectTab('leave-register')}
                      className={`w-full flex items-center ${
                        collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                      } rounded-xl text-xs font-bold transition-all duration-150 ${
                        activeTab === 'leave-register'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                          : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                      }`}
                      title="Leave Register (Casual & Annual Leave)"
                    >
                      <Users className={`w-4 h-4 shrink-0 ${activeTab === 'leave-register' ? 'text-white' : 'text-emerald-300'}`} />
                      {!collapsed && <span className="ml-3 truncate">Leave Register</span>}
                    </button>

                    {/* TDY Register */}
                    <button
                      onClick={() => handleSelectTab('tdy-register')}
                      className={`w-full flex items-center ${
                        collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                      } rounded-xl text-xs font-bold transition-all duration-150 ${
                        activeTab === 'tdy-register'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                          : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                      }`}
                      title="TDY Register (Temporary Duty Outstation)"
                    >
                      <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'tdy-register' ? 'text-white' : 'text-emerald-300'}`} />
                      {!collapsed && <span className="ml-3 truncate">TDY Register</span>}
                    </button>
                    {/* Deployment Register */}
                    <button
                      onClick={() => handleSelectTab('attachment-register')}
                      className={`w-full flex items-center ${
                        collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                      } rounded-xl text-xs font-bold transition-all duration-150 ${
                        activeTab === 'attachment-register'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                          : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                      }`}
                      title="Deployment Register (Bake & Bite, Canteen, Custom)"
                    >
                      <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'attachment-register' ? 'text-white' : 'text-emerald-300'}`} />
                      {!collapsed && <span className="ml-3 truncate">Deployment Register</span>}
                    </button>
{/* Monthly Duty Register */}
                        <button
                          onClick={() => handleSelectTab('register')}
                          className={`w-full flex items-center ${
                            collapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2.5'
                          } rounded-xl text-xs font-bold transition-all duration-150 ${
                            activeTab === 'register'
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                              : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                          }`}
                          title="Duty Register"
                        >
                          <div className="flex items-center truncate">
                            <Calendar className={`w-4 h-4 shrink-0 ${activeTab === 'register' ? 'text-white' : 'text-emerald-300'}`} />
                            {!collapsed && <span className="ml-3 truncate">Duty Register</span>}
                          </div>
                          {conflictCount > 0 && (
                            <span className="w-5 h-5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center shadow-xs animate-pulse">
                              {conflictCount}
                            </span>
                          )}
                        </button>

                        {/* Duty Ratio (BAF 155 Scale) */}
                        <button
                          onClick={() => handleSelectTab('duty-ratio')}
                          className={`w-full flex items-center ${
                            collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                          } rounded-xl text-xs font-bold transition-all duration-150 ${
                            activeTab === 'duty-ratio'
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                              : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                          }`}
                          title="Duty Ratio Matrix"
                        >
                          <Sliders className={`w-4 h-4 shrink-0 ${activeTab === 'duty-ratio' ? 'text-white' : 'text-emerald-300'}`} />
                          {!collapsed && <span className="ml-3 truncate">Duty Ratio Matrix</span>}
                        </button>

                        
                  </div>
                )}
              </div>
            </>
          )}

          {/* SECTION 4: ROSTER (Visible to all, some items restricted) */}
          <div>
            {!collapsed && (
                  <button
                    onClick={() => toggleSection('schedule')}
                    className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 hover:text-emerald-100 transition-colors"
                  >
                    <span>ROSTER</span>
                    {openSections.schedule ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}

                {(collapsed || openSections.schedule) && (
                  <div className="mt-2 space-y-2 sm:space-y-1">
                    {/* IDA Center Duty (Visible to all) */}
                    <button
                      onClick={() => handleSelectTab('ida-center')}
                      className={`w-full flex items-center ${
                        collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                      } rounded-xl text-xs font-bold transition-all duration-150 ${
                        activeTab === 'ida-center'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                          : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                      }`}
                      title="IDA Center Duty (Standby & Shifts)"
                    >
                      <Shield className={`w-4 h-4 shrink-0 ${activeTab === 'ida-center' ? 'text-white' : 'text-emerald-300'}`} />
                      {!collapsed && <span className="ml-3 truncate">IDA Center Duty</span>}
                    </button>

                    {/* Duty Roster Period (Visible to all) */}
                    <button
                      onClick={() => handleSelectTab('duty-roster')}
                      className={`w-full flex items-center ${
                        collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                      } rounded-xl text-xs font-bold transition-all duration-150 ${
                        activeTab === 'duty-roster'
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                          : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                      }`}
                      title="Duty Roster Period & Export"
                    >
                      <FileText className={`w-4 h-4 shrink-0 ${activeTab === 'duty-roster' ? 'text-white' : 'text-emerald-300'}`} />
                      {!collapsed && <span className="ml-3 truncate">Duty Roster</span>}
                    </button>

                    {/* Admin only items */}
                    {true && (
                      <></>
                    )}
                  </div>
                )}
              </div>
          {/* SECTION 5: ANALYSIS & CONFLICTS */}
          <div>
            {!collapsed && (
              <div className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-200/50 mt-4">
                <span>ANALYSIS</span>
              </div>
            )}
            <div className="mt-2 space-y-2 sm:space-y-1">
              {/* Duty Analytics & Working Hours */}
                        <button
                          onClick={() => handleSelectTab('analytics')}
                          className={`w-full flex items-center ${
                            collapsed ? 'justify-center px-0 py-3' : 'justify-start px-3 py-3 sm:py-2.5'
                          } rounded-xl text-xs font-bold transition-all duration-150 ${
                            activeTab === 'analytics'
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                              : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                          }`}
                          title="Duty Analytics & Load Balance"
                        >
                          <BarChart3 className={`w-4 h-4 shrink-0 ${activeTab === 'analytics' ? 'text-white' : 'text-emerald-300'}`} />
                          {!collapsed && <span className="ml-3 truncate">Duty Analysis</span>}
                        </button>

                        
              {/* Duty Conflicts */}
                        <button
                          onClick={() => handleSelectTab('conflicts')}
                          className={`w-full flex items-center ${
                            collapsed ? 'justify-center px-0 py-3' : 'justify-between px-3 py-2.5'
                          } rounded-xl text-xs font-bold transition-all duration-150 ${
                            activeTab === 'conflicts'
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/50 scale-[1.02] border border-emerald-400/30'
                              : 'bg-[#084228]/50 text-emerald-100 hover:bg-[#0b4a2d] hover:text-white border border-[#0d5635]/50'
                          }`}
                          title="Conflict Monitor & Rules"
                        >
                          <div className="flex items-center truncate">
                            <ShieldAlert className={`w-4 h-4 shrink-0 ${activeTab === 'conflicts' ? 'text-white' : 'text-emerald-300'}`} />
                            {!collapsed && <span className="ml-3 truncate">Conflict Monitor</span>}
                          </div>
                          {conflictCount > 0 && !collapsed && (
                            <span className="px-1.5 py-0.5 text-[9px] bg-red-600 text-white rounded-md font-bold">
                              {conflictCount} Alert
                            </span>
                          )}
                        </button>
            </div>
          </div>
        </div>

        {/* User Session Profile & Admin Mode Toggle */}

        {userSession && !collapsed && (
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
              onClick={onOpenSettings}
              className={`w-full flex items-center ${
                collapsed ? 'justify-center p-2' : 'justify-start px-3 py-2 space-x-2.5'
              } rounded-xl text-emerald-100/90 hover:text-white hover:bg-[#0c4e2f] text-xs font-bold transition-all cursor-pointer`}
              title="Settings"
            >
              <Settings className="w-4 h-4 text-emerald-300 shrink-0" />
              {!collapsed && <span>Settings</span>}
            </button>
          </div>
        )}

        {/* Footer Role & Unit Info */}
        <div className="px-3 py-2 bg-[#042013] border-t border-[#093c24] shrink-0">
          {!collapsed ? (
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
      </aside>
    </>
  );
};
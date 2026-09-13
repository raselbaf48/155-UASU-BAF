import React from 'react';
import { Shield, Calendar, UserCheck, Layers, BarChart3, Sun, Moon, ShieldAlert, LogOut, User } from 'lucide-react';
import { UserRole, FlightName } from '../types';

interface NavbarProps {
  activeTab: 'dashboard' | 'nominal' | 'register' | 'analytics';
  setActiveTab: (tab: 'dashboard' | 'nominal' | 'register' | 'analytics') => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedFlight: FlightName | 'Overall';
  setSelectedFlight: (flight: FlightName | 'Overall') => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  conflictCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  role,
  setRole,
  selectedDate,
  setSelectedDate,
  selectedFlight,
  setSelectedFlight,
  darkMode,
  setDarkMode,
  conflictCount,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-slate-100 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Unit Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 border border-emerald-400 flex items-center justify-center text-white shadow-md">
              <Shield className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-wider text-white">155 UASU BAF</span>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-widest bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full">
                  Office System
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Bangladesh Air Force • Personnel Duty Register & Parade State
              </p>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Parade State</span>
            </button>

            <button
              onClick={() => setActiveTab('nominal')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'nominal'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Nominal Roll</span>
            </button>

            <button
              onClick={() => setActiveTab('register')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-semibold transition-all relative ${
                activeTab === 'register'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Duty Register</span>
              {conflictCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 text-[10px] font-black rounded-full flex items-center justify-center animate-pulse">
                  {conflictCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-semibold transition-all ${
                activeTab === 'analytics'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Duty Analytics</span>
            </button>
          </nav>

          {/* Right Controls: Role & Theme */}
          <div className="flex items-center space-x-3">
            {/* Role Switcher */}
            <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
              <button
                onClick={() => setRole('ADMIN')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER')
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Admin (Flight SNCO / In-Charge) with full editing permissions"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Admin SNCO</span>
              </button>

              <button
                onClick={() => setRole('USER')}
                className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  role === 'USER'
                    ? 'bg-blue-600 text-white font-bold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Airman View (Read Only)"
              >
                <User className="w-3.5 h-3.5" />
                <span>Airman View</span>
              </button>
            </div>

            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="md:hidden flex items-center justify-around py-2 border-t border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-2 py-1 rounded ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
          >
            Parade State
          </button>
          <button
            onClick={() => setActiveTab('nominal')}
            className={`px-2 py-1 rounded ${activeTab === 'nominal' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
          >
            Airmen
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`px-2 py-1 rounded ${activeTab === 'register' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
          >
            Register
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-2 py-1 rounded ${activeTab === 'analytics' ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}
          >
            Analytics
          </button>
        </div>
      </div>
    </header>
  );
};

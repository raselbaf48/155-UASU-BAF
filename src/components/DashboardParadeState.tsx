import { DateNavigator } from './DateNavigator';
const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
import React, { useState, useEffect } from 'react';
import { 
  Users, ShieldCheck, UserMinus, Plane, Calendar, Filter,
  Search, RefreshCw, Moon, ShieldAlert, Coffee, PenTool, Printer,
  Plus, CalendarRange, X, Check, Sliders, Eye, EyeOff, Activity, Clock, History, Sparkles, CheckSquare, Square
} from 'lucide-react';
import { FlightName, ParadeShift, Airman, DutyCategoryCode, IDAShift, UserRole } from '../types';
import { DUTY_TYPES, DUTY_TYPE_MAP } from '../data/dutyTypes';
import { getStoredDutyRatiosForDate } from '../data/dutyRatios';
import { getIdacShiftsForDateAndFlight, getFlightDutyQuotaForDate } from '../data/officialDutyRatioMatrix';
import { FlightDutyRatioModal } from './FlightDutyRatioModal';
import { EntryHistoryModal } from './EntryHistoryModal';
import { AssignDutyModal } from './AssignDutyModal';
import { SignatureConfigModal } from './SignatureConfigModal';

interface DashboardParadeStateProps {
  role?: UserRole;
  userFlight?: string;
  airmen?: Airman[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  selectedShift: ParadeShift;
  setSelectedShift: (shift: ParadeShift) => void;
  selectedFlight: FlightName | 'Overall';
  setSelectedFlight: (flight: FlightName | 'Overall') => void;
  onOpenPrintModal?: () => void;
  onViewAirmanProfile: (airman: Airman) => void;
  onOpenImportModal?: () => void;
}

interface ParadeData {
  date: string;
  shift: ParadeShift;
  flight: string;
  summary: {
    totalStrength: number;
    onParade: number;
    onDuty: number;
    onLeave: number;
    tdy: number;
    otherOff: number;
  };
  flightBreakdown: Record<FlightName, {
    total: number;
    onParade: number;
    onDuty: number;
    onLeave: number;
    tdy: number;
  }>;
  personnelStatusList: Array<{
    airman: Airman;
    dutyCode: string;
    idaShift?: string;
    statusCategory: 'PARADE' | 'DUTY' | 'LEAVE' | 'TDY' | 'OFF';
    notes: string;
    dutyName?: string;
    previousDutyName?: string;
  }>;
}

export const DashboardParadeState: React.FC<DashboardParadeStateProps> = ({
  role = 'ADMIN',
  userFlight,
  airmen,
  selectedDate,
  setSelectedDate,
  selectedFlight,
  setSelectedFlight,
  onOpenPrintModal,
  onViewAirmanProfile,
  onOpenImportModal,
}) => {
  const [data, setData] = useState<ParadeData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showSignatureModal, setShowSignatureModal] = useState<boolean>(false);

  // Strength Category Detail List Modal State (When clicking Strength Cards)
  const [strengthCategoryModal, setStrengthCategoryModal] = useState<{
    title: string;
    category: 'TOTAL' | 'PARADE' | 'DUTY' | 'DUTY_OFF' | 'LEAVE' | 'TDY' | 'BAKE_N_BITE';
    color: string;
  } | null>(null);
  const [modalSearchQuery, setModalSearchQuery] = useState<string>('');

  // Interactive Batch Assign Duty Modal State
  const [showAssignModal, setShowAssignModal] = useState<boolean>(false);

  // Flight Duty Ratio / Quota States
  const [showRatioModal, setShowRatioModal] = useState<boolean>(false);
  const [ratioRefreshTrigger, setRatioRefreshTrigger] = useState<number>(0);

  // Listen to global duty ratio updates across modals and views
  useEffect(() => {
    const handleRatioUpdated = () => {
      setRatioRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener('baf_duty_ratio_updated', handleRatioUpdated);
    return () => {
      window.removeEventListener('baf_duty_ratio_updated', handleRatioUpdated);
    };
  }, []);

  const fetchParadeData = async (targetDate?: string) => {
    setLoading(true);
    try {
      const activeDate = targetDate || selectedDate;
      const params = new URLSearchParams({
        date: activeDate,
        shift: 'Morning',
        flight: selectedFlight,
      });
      const res = await fetch(`/api/parade-state?${params.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error('Failed to fetch parade state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParadeData();
    const handleGlobalUpdate = (e: any) => {
      const newDate = e.detail?.date;
      fetchParadeData(newDate);
    };
    window.addEventListener('baf_state_updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('baf_state_updated', handleGlobalUpdate);
    };
  }, [selectedDate, selectedFlight]);

  // Compute day of week
  const dateObj = new Date(selectedDate);
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dateDisplay = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).replace(/Sept/gi, 'Sep');

  const flightsList: (FlightName | 'Overall')[] = [
    'Overall',
    'Avionics',
    'Mechanics',
    'GCS',
    'Admin',
  ];

  return (
    <div className="space-y-6">
      {/* Top Controls Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              155 UASU BAF • Operations Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              Active Unit
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {dayName}, {dateDisplay} • Unit Strength: {data?.summary?.totalStrength || 48} Airmen
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <DateNavigator
              
              value={selectedDate || ''}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none outline-none font-semibold cursor-pointer text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Flight Dropdown Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedFlight}
              onChange={(e) => setSelectedFlight(e.target.value as FlightName | 'Overall')}
              className="bg-transparent outline-none font-semibold cursor-pointer text-slate-900 dark:text-slate-100"
            >
              {flightsList.map((fl) => (
                <option key={fl} value={fl} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {fl}
                </option>
              ))}
            </select>
          </div>

          {/* Last Entry Button (Admin Only) */}
          {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 transition-all shadow-xs"
              title="View Last 10 Entries, undo wrong entries, or edit assignments"
            >
              <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>History</span>
            </button>
          )}

          {/* Assign Duty Button (Admin Only) */}
          {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3.5 py-2 rounded-lg shadow-xs transition-all"
              title="Assign or update duty (GD, Halishahar, Taskforce, etc.)"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Assign Duty / Activity</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            onClick={fetchParadeData}
            disabled={loading}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary KPI Cards (Click to open nominal list) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {/* 1. Total Strength */}
        <div
          onClick={() => {
            setModalSearchQuery('');
            setStrengthCategoryModal({
              title: 'Total Unit Strength',
              category: 'TOTAL',
              color: 'slate',
            });
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl p-3.5 shadow-xs cursor-pointer hover:shadow-md transition-all group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 font-bold tracking-wider">
              Total Str
            </span>
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-slate-200 transition-colors">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {data?.personnelStatusList?.length || data?.summary?.totalStrength || 0}
            </span>
            <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 flex items-center space-x-0.5">
              <span>View</span>
              <span>→</span>
            </span>
          </div>
        </div>

        {/* 2. On Parade */}
        <div
          onClick={() => {
            setModalSearchQuery('');
            setStrengthCategoryModal({
              title: 'On Parade Personnel',
              category: 'PARADE',
              color: 'emerald',
            });
          }}
          className="bg-white dark:bg-slate-900 border border-emerald-200/80 dark:border-emerald-900/50 hover:border-emerald-500 rounded-xl p-3.5 shadow-xs cursor-pointer hover:shadow-md transition-all group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 font-bold tracking-wider">
              On Parade
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-200 transition-colors">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {data?.summary?.onParade ?? data?.personnelStatusList?.filter((p) => p.statusCategory === 'PARADE').length ?? 0}
            </span>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center space-x-0.5">
              <span>Available</span>
              <span>→</span>
            </span>
          </div>
        </div>

        {/* 3. On Duty */}
        <div
          onClick={() => {
            setModalSearchQuery('');
            setStrengthCategoryModal({
              title: 'Active On Duty Personnel',
              category: 'DUTY',
              color: 'amber',
            });
          }}
          className="bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900/50 hover:border-amber-500 rounded-xl p-3.5 shadow-xs cursor-pointer hover:shadow-md transition-all group active:scale-[0.98]"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 font-bold tracking-wider">
              On Duty
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 group-hover:bg-amber-200 transition-colors">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {data?.personnelStatusList?.filter(p => ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'AIRPORT'].includes(p.dutyCode) || ((p.dutyCode === 'IDAC' || p.dutyCode === 'IDA') && p.idaShift !== 'Night')).length || data?.summary?.onDuty || 0}
            </span>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center space-x-0.5">
              <span>Duties</span>
              <span>→</span>
            </span>
          </div>
        </div>

                {/* Dynamic Disposals */}
        {(() => {
          const disposalsMap = new Map<string, { count: number, category: string, color: string, icon: any, title: string, subtitle: string }>();
          
          if (data?.personnelStatusList) {
            data.personnelStatusList.forEach((p) => {
              // Canteen is not treated as duty here for dynamic rendering
              if (p.statusCategory === 'PARADE' || (p.statusCategory === 'DUTY' && !['CANTEEN', 'RECEPTION', 'GAMES'].includes(p.dutyCode))) return;
              
              let cat = p.statusCategory === 'OTHERS' ? p.dutyCode : p.statusCategory;
              let title = p.dutyName || p.dutyCode || 'Other Disposal';
              let subtitle = 'Disposal';
              let color = 'slate';
              let IconComp = Activity;

              if (p.statusCategory === 'OFF' || p.dutyCode === 'DUTY_OFF') { title = 'Duty Off'; cat = 'DUTY_OFF'; color = 'indigo'; IconComp = Moon; subtitle = 'Rest'; }
              else if (p.statusCategory === 'LEAVE') { title = 'On Leave'; cat = 'LEAVE'; color = 'purple'; IconComp = UserMinus; subtitle = 'Leave'; }
              else if (p.statusCategory === 'TDY') { title = 'TDY'; cat = 'TDY'; color = 'cyan'; IconComp = Plane; subtitle = 'TDY'; }
              else if (p.dutyCode === 'BAKE_N_BITE' || p.statusCategory === 'BAKE_N_BITE') { title = 'Bake & Bite'; cat = 'BAKE_N_BITE'; color = 'rose'; IconComp = Coffee; subtitle = 'Mess'; }
              else if (p.statusCategory === 'SICK_REPORT' || p.dutyCode === 'SICK_REPORT') { title = 'Sick Report'; cat = 'SICK_REPORT'; color = 'red'; IconComp = Plus; subtitle = 'MI Room'; }
              else if (p.statusCategory === 'CMH' || p.dutyCode === 'CMH') { title = 'BNS/CMH'; cat = 'CMH'; color = 'red'; IconComp = Plus; subtitle = 'Hospital'; }
              else if (p.statusCategory === 'ESSN' || p.dutyCode === 'ESSN') { title = 'Essential Task'; cat = 'ESSN'; color = 'orange'; IconComp = ShieldAlert; subtitle = 'Task'; }
              else if (p.statusCategory === 'ADMIN_ORDER' || p.dutyCode === 'ADMIN_ORDER') { title = 'Admin Order'; cat = 'ADMIN_ORDER'; color = 'blue'; IconComp = PenTool; subtitle = 'Admin'; }
              else if (p.statusCategory === 'CLASS_TRG' || p.dutyCode === 'CLASS_TRG') { title = 'Class / Trg'; cat = 'CLASS_TRG'; color = 'teal'; IconComp = Calendar; subtitle = 'Training'; }
              else if (p.statusCategory === 'CANTEEN' || p.dutyCode === 'CANTEEN') { title = 'Canteen'; cat = 'CANTEEN'; color = 'rose'; IconComp = Coffee; subtitle = 'Mess'; }
              else if (p.statusCategory === 'RECEPTION' || p.dutyCode === 'RECEPTION') { title = p.dutyName || 'K/O & Reception'; cat = 'RECEPTION'; color = 'amber'; IconComp = Coffee; subtitle = 'Duty'; }
              else if (p.statusCategory === 'GAMES' || p.dutyCode === 'GAMES') { title = 'G/H & Games'; cat = 'GAMES'; color = 'emerald'; IconComp = Activity; subtitle = 'Sports'; }
              else {
                cat = p.dutyCode || 'OTHERS';
                title = p.dutyName || p.dutyCode || 'Other Disposal';
                color = 'slate';
                IconComp = Activity;
                subtitle = 'Other';
              }

              if (disposalsMap.has(cat)) {
                disposalsMap.get(cat)!.count++;
              } else {
                disposalsMap.set(cat, { count: 1, category: cat, color, icon: IconComp, title, subtitle });
              }
            });
          }

          return Array.from(disposalsMap.values()).map((disp, idx) => {
            const colors: Record<string, any> = {
              indigo: { border: 'border-indigo-200/80 dark:border-indigo-900/50 hover:border-indigo-500', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-950/60 group-hover:bg-indigo-200' },
              purple: { border: 'border-purple-200/80 dark:border-purple-900/50 hover:border-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-950/60 group-hover:bg-purple-200' },
              cyan: { border: 'border-cyan-200/80 dark:border-cyan-900/50 hover:border-cyan-500', text: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-950/60 group-hover:bg-cyan-200' },
              rose: { border: 'border-rose-200/80 dark:border-rose-900/50 hover:border-rose-500', text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-950/60 group-hover:bg-rose-200' },
              red: { border: 'border-red-200/80 dark:border-red-900/50 hover:border-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-950/60 group-hover:bg-red-200' },
              orange: { border: 'border-orange-200/80 dark:border-orange-900/50 hover:border-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-950/60 group-hover:bg-orange-200' },
              blue: { border: 'border-blue-200/80 dark:border-blue-900/50 hover:border-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-950/60 group-hover:bg-blue-200' },
              teal: { border: 'border-teal-200/80 dark:border-teal-900/50 hover:border-teal-500', text: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-950/60 group-hover:bg-teal-200' },
              slate: { border: 'border-slate-200/80 dark:border-slate-800/50 hover:border-slate-500', text: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800/60 group-hover:bg-slate-200' },
            };
            const theme = colors[disp.color] || colors.slate;
            
            return (
              <div
                key={disp.category + idx}
                onClick={() => {
                  setModalSearchQuery('');
                  setStrengthCategoryModal({
                    title: `${disp.title} Personnel`,
                    category: disp.category as any,
                    color: disp.color as any,
                  });
                }}
                className={`bg-white dark:bg-slate-900 border ${theme.border} rounded-xl p-3.5 shadow-xs cursor-pointer hover:shadow-md transition-all group active:scale-[0.98]`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${theme.text} font-bold tracking-wider`}>
                    {disp.title}
                  </span>
                  <div className={`w-7 h-7 rounded-lg ${theme.bg} flex items-center justify-center ${theme.text} transition-colors shrink-0`}>
                    <disp.icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className={`text-2xl font-black ${theme.text}`}>
                    {disp.count}
                  </span>
                  <span className={`text-[10px] font-bold ${theme.text} flex items-center space-x-0.5`}>
                    <span>{disp.subtitle}</span>
                    <span>→</span>
                  </span>
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Operational Overview Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-bold text-sm mb-3">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>Unit Availability Summary</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Total unit personnel on parade today: <strong className="text-emerald-600 dark:text-emerald-400">{data?.summary?.onParade || 0}</strong> out of <strong className="text-slate-900 dark:text-slate-100">{data?.summary?.totalStrength || 0}</strong> airmen.
            Currently <strong className="text-amber-600 dark:text-amber-400">{data?.personnelStatusList?.filter(p => ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'AIRPORT'].includes(p.dutyCode) || ((p.dutyCode === 'IDAC' || p.dutyCode === 'IDA') && p.idaShift !== 'Night')).length || data?.summary?.onDuty || 0}</strong> personnel are deployed on base guard duties, IDAC operations, and Halishahar shifts.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-bold text-sm mb-3">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>Quick Operations Action</span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
            Click any KPI card above to view the detailed nominal list for that category, or use the <strong>Assign Duty</strong> button to quickly assign GD, IDAC, Halishahar, or Leave.
          </p>
        </div>
      </div>

      {/* Interactive Batch Assign Duty Modal */}
      {showAssignModal && (
        <AssignDutyModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          onRefreshParadeData={fetchParadeData}
          airmen={airmen || data?.personnelStatusList?.map((p) => p.airman) || []}
        />
      )}


      {/* Strength Category Detailed Nominal Modal */}
      {strengthCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full p-6 space-y-4 relative overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      {strengthCategoryModal.title}
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-xs font-black bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                      {(() => {
                        const items = (data?.personnelStatusList || []).filter((p) => {
                          const cat = strengthCategoryModal.category;
                          if (cat === 'TOTAL') return true;
                          if (cat === 'PARADE') return p.dutyCode === 'ON_PARADE' || ((p.dutyCode === 'IDAC' || p.dutyCode === 'IDA') && p.idaShift === 'Night');
                          if (cat === 'DUTY') return ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'AIRPORT'].includes(p.dutyCode) || ((p.dutyCode === 'IDAC' || p.dutyCode === 'IDA') && p.idaShift !== 'Night');
                          if (cat === 'DUTY_OFF') return p.dutyCode === 'DUTY_OFF' || p.statusCategory === 'OFF';
                          if (cat === 'LEAVE') return p.statusCategory === 'LEAVE';
                          if (cat === 'TDY') return p.statusCategory === 'TDY';
                          if (cat === 'BAKE_N_BITE') return p.dutyCode === 'BAKE_N_BITE';
                          if (cat === 'CANTEEN') return p.statusCategory === 'CANTEEN' || p.dutyCode === 'CANTEEN';
                          if (cat === 'RECEPTION') return p.statusCategory === 'RECEPTION' || p.dutyCode === 'RECEPTION';
                          if (cat === 'GAMES') return p.statusCategory === 'GAMES' || p.dutyCode === 'GAMES';
                          return p.statusCategory === cat || p.dutyCode === cat;
                        });
                        return items.length;
                      })()} Personnel
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Date: <strong>{selectedDate}</strong> {selectedFlight !== 'Overall' ? `• Flight: ${selectedFlight}` : '• Entire Unit'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setStrengthCategoryModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Search */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Rank, Name, Trade, or BD Number..."
                value={modalSearchQuery}
                onChange={(e) => setModalSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
              />
            </div>

            {/* Personnel Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              {(() => {
                const hideBdNo = ['PARADE', 'DUTY', 'DUTY_OFF'].includes(strengthCategoryModal.category);
                const filtered = (data?.personnelStatusList || [])
                  .filter((p) => {
                    const cat = strengthCategoryModal.category;
                    if (cat === 'TOTAL') return true;
                    if (cat === 'PARADE') return p.dutyCode === 'ON_PARADE' || ((p.dutyCode === 'IDAC' || p.dutyCode === 'IDA') && p.idaShift === 'Night');
                    if (cat === 'DUTY') return ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'AIRPORT'].includes(p.dutyCode) || ((p.dutyCode === 'IDAC' || p.dutyCode === 'IDA') && p.idaShift !== 'Night');
                    if (cat === 'DUTY_OFF') return p.statusCategory === 'OFF' || p.dutyCode === 'DUTY_OFF';
                    if (cat === 'LEAVE') return p.statusCategory === 'LEAVE';
                    if (cat === 'TDY') return p.statusCategory === 'TDY';
                    if (cat === 'BAKE_N_BITE') return p.dutyCode === 'BAKE_N_BITE';
                    // For dynamically generated disposal categories
                    if (cat === 'CANTEEN') return p.statusCategory === 'CANTEEN' || p.dutyCode === 'CANTEEN';
                    if (cat === 'RECEPTION') return p.statusCategory === 'RECEPTION' || p.dutyCode === 'RECEPTION';
                    if (cat === 'GAMES') return p.statusCategory === 'GAMES' || p.dutyCode === 'GAMES';
                    return p.statusCategory === cat || p.dutyCode === cat;
                  })
                  .filter((p) => {
                    if (!modalSearchQuery.trim()) return true;
                    const q = modalSearchQuery.toLowerCase();
                    return (
                      p.airman.name.toLowerCase().includes(q) ||
                      p.airman.rank.toLowerCase().includes(q) ||
                      p.airman.trade.toLowerCase().includes(q) ||
                      p.airman.bdNo.toLowerCase().includes(q)
                    );
                  });

                return (
                  <div className="overflow-x-auto"><table className="w-full min-w-[700px] print:min-w-0 text-center text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold">
                      <tr>
                        <th className="py-2 px-3 w-10 text-center">#</th>
                        {!hideBdNo && <th className="py-2 px-3">BD No</th>}
                        <th className="py-2 px-3">Rank</th>
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Trade</th>
                        <th className="py-2 px-3">Flight</th>
                        <th className="py-2 px-3">Status / Duty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={hideBdNo ? 6 : 7} className="py-8 text-center text-slate-400 text-xs">
                            No personnel found matching the criteria.
                          </td>
                        </tr>
                      ) : (
                        filtered.map((item, idx) => (
                          <tr
                            key={`${item.airman.id}-${item.dutyCode || ''}-${item.idaShift || ''}-${idx}`}
                            onClick={() => onViewAirmanProfile(item.airman)}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                          >
                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            {!hideBdNo && (
                              <td className="py-2 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                {item.airman.bdNo}
                              </td>
                            )}
                            <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                              {formatAirmanName(item.airman.rank)}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                              {item.airman.name}
                            </td>
                            <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                              {item.airman.trade}
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {item.airman.flightName}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 ${
                                item.dutyCode === 'BAKE_N_BITE'
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
                                  : item.dutyCode === 'DUTY_OFF' || item.statusCategory === 'OFF'
                                  ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'
                                  : item.statusCategory === 'PARADE'
                                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                                  : item.statusCategory === 'DUTY'
                                  ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800'
                                  : item.statusCategory === 'LEAVE'
                                  ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800'
                                  : item.statusCategory === 'TDY'
                                  ? 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-800'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                              }`}>
                                <span>
                                  {(() => {
                                    if (item.dutyCode === 'BAKE_N_BITE') return '☕ Bake & Bite';
                                    if (item.dutyCode === 'DUTY_OFF' || item.statusCategory === 'OFF') {
                                      const prev = (item.previousDutyName || item.dutyName || item.notes || '').toUpperCase();
                                      if (prev.includes('GD') || prev.includes('BASE SEC')) return '🌙 GD Off';
                                      if (prev.includes('BTF')) return '🌙 BTF Off';
                                      if (prev.includes('NTF') || prev.includes('NAJIR')) return '🌙 NTF Off';
                                      if (prev.includes('IDAC') || prev.includes('IDA')) return '🌙 IDAC Nt Off';
                                      if (prev.includes('AIR') || prev.includes('PORT')) return '🌙 Airfield Off';
                                      if (prev.includes('HALI')) return '🌙 Halishahar Off';
                                      if (item.previousDutyName) return `🌙 ${item.previousDutyName}`;
                                      if (item.dutyName && !item.dutyName.toLowerCase().includes('duty off')) return `🌙 ${item.dutyName}`;
                                      return '🌙 Duty Off';
                                    }
                                    if (item.statusCategory === 'DUTY') {
                                      if (item.dutyCode === 'GD') return '📌 Guard Duty';
                                      if (item.dutyCode === 'BTF') return '📌 Base Taskforce Duty';
                                      if (item.dutyCode === 'NTF') return '📌 Najirpara Taskforce Duty';
                                      if (item.dutyCode === 'HALISHAHAR') return '📌 Halishahar Duty';
                                      if (item.dutyCode === 'AIRPORT') return '📌 Airfield Duty';
                                      if (item.dutyCode === 'IDAC' || item.dutyCode === 'IDA') return `📌 IDAC Duty (${item.idaShift || 'Morning'})`;
                                      return `📌 ${item.dutyName || item.dutyCode}`;
                                    }
                                    if (item.statusCategory === 'LEAVE') return `🏖️ ${item.dutyName || 'Leave'}`;
                                    if (item.statusCategory === 'TDY') {
                                      const label = item.dutyCode === 'ATT' ? 'Attachment' : item.dutyCode === 'DETT' ? 'Detachment' : 'TDY';
                                      return `✈️ ${item.notes ? `${label} (${item.notes})` : label}`;
                                    }
                                    if (item.statusCategory === 'PARADE') return '🟢 On Parade';
                                    return item.dutyCode;
                                  })()}
                                </span>
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table></div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 shrink-0">
              <span className="text-[11px] text-slate-400">
                Click any airman to view full personnel record
              </span>
              <button
                type="button"
                onClick={() => setStrengthCategoryModal(null)}
                className="px-4 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-xl transition-all"
              >
                Close List
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry History & Undo Modal */}
      {showHistoryModal && (
        <EntryHistoryModal
          airmen={data?.personnelStatusList?.map((p) => p.airman) || []}
          onClose={() => setShowHistoryModal(false)}
          onRefreshData={() => {
            fetchParadeData();
          }}
        />
      )}

      {/* Flight Duty Ratio Configurator Modal */}
      {showRatioModal && (
        <FlightDutyRatioModal
          airmen={airmen}
          date={selectedDate}
          onClose={() => setShowRatioModal(false)}
          onRatiosUpdated={() => setRatioRefreshTrigger((prev) => prev + 1)}
        />
      )}

      {/* Signature Configuration Modal */}
      {showSignatureModal && (
        <SignatureConfigModal
          initialTab="PREPARED_BY"
          onClose={() => setShowSignatureModal(false)}
        />
      )}
    </div>
  );
};

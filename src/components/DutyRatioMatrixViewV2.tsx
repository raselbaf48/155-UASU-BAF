import React, { useState, useEffect } from 'react';
import { DutyRatioConfigPanel } from './DutyRatioConfigPanelV4';

import {
  DutyRatioTable,
  getStoredDutyMatrix,
  saveDutyMatrix,
  resetDutyMatrixToDefault,
} from '../data/officialDutyRatioMatrix';
import { calculateBalancedAutoTargets, autoAllocateDutyMatrix, DEFAULT_MANPOWER, AllocationMode } from '../utils/dutyDistribution';
import { FlightName, UserRole } from '../types';
import { pushDutyListToCloud } from '../utils/dutyCloudSync';
import {
  Save,
  RotateCcw,
  Check,
  Info,
  Settings,
  Upload,
  Lock,
  X,
  Shield,
  Layers,
  Printer,
  Search,
  Sparkles,
  Sliders,
  ArrowLeft,
  Calendar,
  Eye,
  CheckCircle2, Clock } from 'lucide-react';
import { exportDutyRatioDocx } from '../utils/docxExport';
import { ImportDutyRatioModal } from './ImportDutyRatioModal';
import { FlightDutyCalendarModal } from './FlightDutyCalendarModal';
import { PrintableDutyRatioModal, formatDisplayDate } from "./PrintableDutyRatioModal";
import { AutoAllocateModal } from './AutoAllocateModal';
import { DateNavigator } from './DateNavigator';

interface DutyRatioMatrixViewProps {
  role?: UserRole;
  onRequestAdminAccess?: () => void;
}

export const DutyRatioMatrixView: React.FC<DutyRatioMatrixViewProps> = ({
  role = 'ADMIN',
  onRequestAdminAccess,
}) => {
  const [matrix, setMatrix] = useState<DutyRatioTable[]>(() => getStoredDutyMatrix());
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [selectedFlightFilter, setSelectedFlightFilter] = useState<FlightName | 'Overall'>('Overall');
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printModalMode, setPrintModalMode] = useState<'ALL' | 'DUTY_RATIO_ONLY' | 'MANPOWER_ONLY'>('ALL');
  const [showAllTableInfo, setShowAllTableInfo] = useState<boolean>(false);
  const [settingsTableIdx, setSettingsTableIdx] = useState<number | null>(null);
  const [resetConfirmTableIdx, setResetConfirmTableIdx] = useState<number | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [flightViewMode, setFlightViewMode] = useState<'SCHEDULE' | 'DUTY_CARDS'>('SCHEDULE');
  const [viewMode, setViewMode] = useState<'DUTY_DISTRIBUTION' | 'DUTY_RATIO' | 'MANPOWER' | 'DUTY_LIST'>('DUTY_RATIO');
  const [targetDate, setTargetDate] = useState(() => {
    const saved = localStorage.getItem('baf_duty_distribution_target_date');
    if (saved) return saved;
    const now = new Date();
    // Use local date properly
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
  });

  useEffect(() => {
    localStorage.setItem('baf_duty_distribution_target_date', targetDate);
  }, [targetDate]);

  useEffect(() => {
    const handleUpdate = () => setMatrix(getStoredDutyMatrix());
    window.addEventListener('baf_custom_duties_updated', handleUpdate);
    window.addEventListener('baf_duty_ratio_updated', handleUpdate);
    return () => {
      window.removeEventListener('baf_custom_duties_updated', handleUpdate);
      window.removeEventListener('baf_duty_ratio_updated', handleUpdate);
    };
  }, []);
  const [settingsTab, setSettingsTab] = useState<'Overall' | 'Mechanics' | 'Avionics' | 'GCS' | null>(null);
  const [editingCalendar, setEditingCalendar] = useState<{tableIdx: number, flight: FlightName} | null>(null);
  const [autoAllocateToast, setAutoAllocateToast] = useState<boolean>(false);
  const [isAutoAllocateModalOpen, setIsAutoAllocateModalOpen] = useState<boolean>(false);
  const [allocatedModeInfo, setAllocatedModeInfo] = useState<{ mode: string, desc: string }>({
    mode: 'Single',
    desc: 'Duties distributed with optimal gaps',
  });

  const handleTriggerAutoAllocate = (allocMode: AllocationMode = 'SINGLE') => {
    const savedManpower = localStorage.getItem('baf_duty_distribution_manpower');
    let activeManpower = DEFAULT_MANPOWER;
    if (savedManpower) {
      try {
        activeManpower = JSON.parse(savedManpower);
      } catch (e) {}
    }
    const allocatedMatrix = autoAllocateDutyMatrix(matrix, activeManpower, allocMode);
    handleRatioCalculated(allocatedMatrix);
    setAllocatedModeInfo({
      mode: allocMode === 'PACKAGE' ? 'Package (2-3 Days Consecutive)' : 'Single (Gap System)',
      desc: allocMode === 'PACKAGE'
        ? 'Duties grouped into 2 to 3 consecutive days per block.'
        : 'Duties spread out with optimal rest gaps between days.',
    });
    setIsAutoAllocateModalOpen(false);
    setAutoAllocateToast(true);
    setTimeout(() => setAutoAllocateToast(false), 4000);
  };

  const daysArray = Array.from({ length: 31 }, (_, i) => i + 1);
  const flights: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];

  // Flight name short codes
  const flightShortMap: Record<FlightName, string> = {
    Mechanics: 'Mech',
    Avionics: 'AVI',
    GCS: 'GCS',
    Admin: 'Admin',
  };

  const getCompactDutyTitle = (table: DutyRatioTable): string => {
    const t = (table.title || '').toUpperCase();
    if (t.includes('SECURITY')) return 'Base Sec';
    if (t.includes('BASE TASKFORCE') || t.includes('BASE TF')) return 'Base TF';
    if (t.includes('NAJIRPARA') || t.includes('NAZIRPARA')) return 'Najirpara';
    if (t.includes('IDAC') && t.includes('MORNING')) return 'IDAC (M)';
    if (t.includes('IDAC') && t.includes('AFTERNOON')) return 'IDAC (A)';
    if (t.includes('IDAC') && t.includes('NIGHT')) return 'IDAC (N)';
    if (t.includes('AIRFIELD') || t.includes('AIRPORT')) return 'Airfield';
    if (t.includes('RECEPTION') || t.includes('RECEIPTION')) return 'Reception';
    if (t.includes('HALISHAHAR')) return 'Halishahar';
    return table.dutyCode || table.title.slice(0, 10);
  };

  // Color schemes for each table matching official sheet colors
  const tableColorMap: Record<string, { header: string; badge: string; border: string }> = {
    security_duty: {
      header: 'bg-blue-700 text-white dark:bg-blue-900',
      badge: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
      border: 'border-blue-300 dark:border-blue-800',
    },
    nazirpara_tf: {
      header: 'bg-amber-500 text-slate-950 font-black dark:bg-amber-600',
      badge: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
      border: 'border-amber-300 dark:border-amber-800',
    },
    base_tf: {
      header: 'bg-sky-800 text-white dark:bg-sky-950',
      badge: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
      border: 'border-sky-300 dark:border-sky-800',
    },
    idac_mor: {
      header: 'bg-yellow-400 text-slate-950 font-black dark:bg-yellow-500',
      badge: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200',
      border: 'border-yellow-300 dark:border-yellow-700',
    },
    idac_an: {
      header: 'bg-slate-700 text-slate-100 dark:bg-emerald-800',
      badge: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
      border: 'border-emerald-300 dark:border-emerald-800',
    },
    idac_nt: {
      header: 'bg-red-600 text-white dark:bg-red-800',
      badge: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
      border: 'border-red-300 dark:border-red-800',
    },
    airport_duty: {
      header: 'bg-purple-700 text-white dark:bg-purple-900',
      badge: 'bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200',
      border: 'border-purple-300 dark:border-purple-800',
    },
    halishahar_duty: {
      header: 'bg-teal-700 text-white dark:bg-teal-900',
      badge: 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200',
      border: 'border-teal-300 dark:border-teal-800',
    },
  };

  const handleCellChange = (
    tableIndex: number,
    flight: FlightName,
    dayIndex: number,
    valStr: string
  ) => {
    const num = Math.max(0, parseInt(valStr, 10) || 0);
    const updated = [...matrix];
    const tableObj = { ...updated[tableIndex] };
    const flightData = { ...tableObj.data };
    const arr = [...flightData[flight]];
    arr[dayIndex] = num;
    flightData[flight] = arr;
    tableObj.data = flightData;
    updated[tableIndex] = tableObj;
    setMatrix(updated);
    saveDutyMatrix(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleToggleFlightDutyCell = (
    tableId: string,
    flight: FlightName,
    dayIndex: number,
    forceVal?: number
  ) => {
    const tableIndex = matrix.findIndex(t => t.id === tableId);
    if (tableIndex === -1) return;

    const currentVal = matrix[tableIndex].data[flight]?.[dayIndex] || 0;
    let nextVal = 0;
    if (forceVal !== undefined) {
      nextVal = forceVal;
    } else {
      // 1 click -> 1, another click -> 0 (remove)
      nextVal = currentVal > 0 ? 0 : 1;
    }

    const updated = [...matrix];
    const tableObj = { ...updated[tableIndex] };
    const flightData = { ...tableObj.data };
    const arr = [...(flightData[flight] || Array(31).fill(0))];
    arr[dayIndex] = nextVal;
    flightData[flight] = arr;
    tableObj.data = flightData;
    updated[tableIndex] = tableObj;
    setMatrix(updated);
    saveDutyMatrix(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleResetTable = (tableIndex: number) => {
    setResetConfirmTableIdx(tableIndex);
  };

  const confirmResetTable = () => {
    if (resetConfirmTableIdx === null) return;
    const updated = [...matrix];
    const tableObj = { ...updated[resetConfirmTableIdx] };
    const flightData = { ...tableObj.data };
    flights.forEach(f => {
      flightData[f] = new Array(31).fill(0);
    });
    tableObj.data = flightData;
    updated[resetConfirmTableIdx] = tableObj;
    setMatrix(updated);
    saveDutyMatrix(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
    setResetConfirmTableIdx(null);
  };



  const handleSave = () => {
    saveDutyMatrix(matrix);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleReset = () => {
    if (window.confirm('Reset all duty ratios to the official BAF 155 UASU default template?')) {
      const def = resetDutyMatrixToDefault();
      setMatrix(def);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  const handleImportRatioComplete = (newMatrix: DutyRatioTable[]) => {
    setMatrix(newMatrix);
    saveDutyMatrix(newMatrix);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  // Grand totals calculation
  const totalSlotsOverall = matrix.filter(t => !t.isDisabled).reduce((sum, table) => {
    if (selectedFlightFilter === 'Overall') return sum + (table.totalRequiredMonth || 0);
    return sum + (table.flightTargets?.[selectedFlightFilter as 'Mechanics' | 'Avionics' | 'GCS' | 'Admin'] || 0);
  }, 0);

  
  // Calculate Auto Targets with Cross-Duty Workload Balancing
  const savedManpower = localStorage.getItem('baf_duty_distribution_manpower');
  let currentManpower = DEFAULT_MANPOWER;
  if (savedManpower) {
    try {
      currentManpower = JSON.parse(savedManpower);
    } catch (e) {}
  }
  const autoTargets = calculateBalancedAutoTargets(matrix, currentManpower, true);

  const getFlightTarget = (table: DutyRatioTable, fl: FlightName): number => {
    if (table.isDisabled) return 0;
    if (table.flightTargets && typeof table.flightTargets[fl] === 'number') {
      return table.flightTargets[fl]!;
    }
    return autoTargets?.[fl]?.[table.id] ?? 0;
  };

  const flightTotalsOverall: Record<FlightName, number> = {
    Mechanics: 0,
    Avionics: 0,
    GCS: 0,
    Admin: 0,
  };

  matrix.filter(t => !t.isDisabled).forEach((table) => {
    flights.forEach((fl) => {
      flightTotalsOverall[fl] += table.data[fl].reduce((s, c) => s + c, 0);
    });
  });

  const targetFlightTotal = selectedFlightFilter !== 'Overall'
    ? matrix.filter(t => !t.isDisabled).reduce((sum, t) => {
        return sum + getFlightTarget(t, selectedFlightFilter as FlightName);
      }, 0)
    : 0;

  const handleRatioCalculated = (newMatrix: DutyRatioTable[]) => {
    setMatrix(newMatrix);
    saveDutyMatrix(newMatrix);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
    pushDutyListToCloud(newMatrix).catch(err => console.warn('[DutyRatioMatrixViewV2] Realtime sync error:', err));
  };

  return (
    <div className="w-full flex flex-col bg-slate-50 dark:bg-slate-900 print:bg-white print:overflow-visible">
      <div className="w-full pt-2 px-1 sm:px-2 md:px-3 max-w-none mx-auto animate-fadeIn space-y-4 print:hidden">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-slate-800 text-slate-100 rounded-2xl shadow-md">
            <Sliders className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                155 UASU BAF • Duty Ratio
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                Official Roster Scale
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Configured daily quota ratio for Security Duty, Nazirpara T/F, Base T/F, and IDAC Shifts (Days 1–31).
            </p>
        </div>

        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
          {isSaved && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center space-x-1.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Saved</span>
            </div>
          )}

          {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? (
            <>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
                title="Import Duty Ratio Matrix from CSV / Excel"
              >
                <Upload className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <span>Import Matrix</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPrintModalMode('ALL');
                  setIsPrintModalOpen(true);
                }}
                className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
                title="Print Preview / Export"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Official Export/Print</span>
              </button>
            </>
          ) : (
          <button
            onClick={onRequestAdminAccess}
            className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center space-x-2"
          >
            <Lock className="w-4 h-4 text-slate-500" />
            <span>Request Edit Access</span>
          </button>
        )}

        {/* Auto-saved instantly, button removed as requested */}
    </div>
    </div> {/* CLOSE Top Banner & Header */}

    {/* CONTROLS SECTION */}
    <div className="flex flex-col items-center justify-center space-y-4">
      {/* LAST UPDATING DATE */}
      <div className="flex flex-col items-center justify-center mx-auto">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-center gap-1.5">
          <span>Last Updating Date:</span>
        </div>
        <DateNavigator
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          format="dd_mm_yy"
          className="px-3.5 py-1.5 font-bold text-indigo-700 dark:text-indigo-400 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-center shadow-xs hover:border-indigo-500 transition-colors flex items-center justify-center gap-2 min-w-[125px]"
        />
      </div>

      {/* TAB NAVIGATION */}
      <div className="flex flex-wrap space-x-1 sm:space-x-2 bg-slate-200/50 dark:bg-slate-800/50 p-1.5 rounded-xl w-full max-w-3xl mx-auto justify-center">
        <button 
          onClick={() => setViewMode('DUTY_LIST')}
          className={`flex-1 py-2 px-2 sm:px-4 text-xs sm:text-sm font-bold rounded-lg transition-colors ${viewMode === 'DUTY_LIST' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}
        >Duty List</button>
        <button 
          onClick={() => setViewMode('MANPOWER')}
          className={`flex-1 py-2 px-2 sm:px-4 text-xs sm:text-sm font-bold rounded-lg transition-colors ${viewMode === 'MANPOWER' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}
        >Manpower</button>
        <button 
          onClick={() => setViewMode('DUTY_DISTRIBUTION')}
          className={`flex-1 py-2 px-2 sm:px-4 text-xs sm:text-sm font-bold rounded-lg transition-colors ${viewMode === 'DUTY_DISTRIBUTION' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}
        >Distribution</button>
        <button 
          onClick={() => setViewMode('DUTY_RATIO')}
          className={`flex-1 py-2 px-2 sm:px-4 text-xs sm:text-sm font-bold rounded-lg transition-colors ${viewMode === 'DUTY_RATIO' ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700/50'}`}
        >Duty Ratio</button>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto p-0 sm:p-1 md:p-2 scroll-smooth print:hidden">
      <div className="w-full max-w-none mx-auto space-y-6">
        
        {viewMode !== 'DUTY_RATIO' && (
          <DutyRatioConfigPanel
            activeTab={viewMode as any}
            matrix={matrix}
            onMatrixChange={handleRatioCalculated}
            targetDate={targetDate}
          />
        )}

                {viewMode === 'DUTY_RATIO' && (
          <>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                <Layers className="w-4 h-4 text-indigo-500" />
                <span>Flight Filter:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {['Overall', 'Mechanics', 'Avionics', 'GCS', 'Admin'].map((fl) => (
                  <button
                    key={fl}
                    onClick={() => setSelectedFlightFilter(fl as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedFlightFilter === fl
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {fl}
                  </button>
                ))}
              </div>
            </div>

            {autoAllocateToast && (
              <div className="fixed top-20 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-3 border border-emerald-400/40 animate-in fade-in slide-in-from-top-4">
                <Sparkles className="w-5 h-5 text-amber-300 shrink-0" />
                <div>
                  <div className="font-bold text-sm">{allocatedModeInfo.mode} Complete!</div>
                  <div className="text-xs text-emerald-100">{allocatedModeInfo.desc}</div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col items-center justify-center gap-2 mb-6">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setShowAllTableInfo(!showAllTableInfo)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm border ${showAllTableInfo ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <Info className="w-4 h-4" />
                  <span>{showAllTableInfo ? 'Hide Info' : 'Show Info'}</span>
                </button>

                {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? (
                  <button
                    type="button"
                    onClick={() => setIsAutoAllocateModalOpen(true)}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-sm hover:shadow-md transition-all cursor-pointer"
                    title="Auto Allocate Daily Duties based on balanced manpower ratio"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                    <span>Auto Allocate</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onRequestAdminAccess}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 cursor-pointer"
                    title="Admin access required to Auto Allocate"
                  >
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Auto Allocate</span>
                  </button>
                )}
              </div>
            </div>

            {showAllTableInfo && (
              <div className="bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-4 shadow-xs mb-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-2.5">
                    <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div>
                      <h4 className="font-black text-sm text-indigo-950 dark:text-indigo-200">
                        {selectedFlightFilter === 'Overall' ? 'Overall Unit Duty Ratio Matrix' : `${selectedFlightFilter} Flight Quota & Target Info`}
                      </h4>
                      <p className="text-xs text-indigo-700 dark:text-indigo-300">
                        {selectedFlightFilter === 'Overall'
                          ? `Month Target: ${totalSlotsOverall} slots distributed across all flights`
                          : `Allocated Total: ${flightTotalsOverall[selectedFlightFilter as FlightName]} / Target Total: ${targetFlightTotal}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                    {selectedFlightFilter === 'Overall' ? (
                      <>
                        <span className="inline-flex items-center space-x-1.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                          <span>Target Matched</span>
                        </span>
                        <span className="inline-flex items-center space-x-1.5 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-400 px-2.5 py-1 rounded-md">
                          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                          <span>Under Quota (Yellow Border)</span>
                        </span>
                        <span className="inline-flex items-center space-x-1.5 bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 px-2.5 py-1 rounded-md">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                          <span>Quota Exceeded (Red Fill)</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="inline-flex items-center space-x-1.5 bg-slate-200/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-2.5 py-1 rounded-md font-bold">
                          <span className="w-2 h-2 rounded-full bg-slate-500 inline-block"></span>
                          <span>Target Matched (±0)</span>
                        </span>
                        <span className="inline-flex items-center space-x-1.5 bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 px-2.5 py-1 rounded-md font-bold">
                          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                          <span>+1 Over (Red)</span>
                        </span>
                        <span className="inline-flex items-center space-x-1.5 bg-gradient-to-r from-pink-500/20 to-orange-500/20 text-pink-700 dark:text-orange-300 border border-pink-500/40 px-2.5 py-1 rounded-md font-bold">
                          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
                          <span>+2 Over (Pink/Orange)</span>
                        </span>
                        <span className="inline-flex items-center space-x-1.5 bg-sky-400/20 text-sky-700 dark:text-sky-300 border border-sky-400/50 px-2.5 py-1 rounded-md font-bold">
                          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block"></span>
                          <span>-1 Under (Light Blue)</span>
                        </span>
                        <span className="inline-flex items-center space-x-1.5 bg-blue-600/25 text-blue-800 dark:text-blue-200 border border-blue-600/50 px-2.5 py-1 rounded-md font-bold">
                          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"></span>
                          <span>-2 Under (Dark Blue)</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Existing Mapping for Overall Rendering */}
        {viewMode === 'DUTY_RATIO' && selectedFlightFilter === 'Overall' && matrix.filter(t => !t.isDisabled).map((table, tableIdx) => {
          const tableTotal = flights.reduce((sum, fl) => sum + table.data[fl].reduce((a,b) => a+b, 0), 0);
          // Keep specific styling for first tables
          let colors = {
            header: 'bg-slate-800 text-white',
          };
          if (table.id === 'security_duty') colors.header = 'bg-blue-900/90 text-white';
          if (table.id === 'nazirpara_tf') colors.header = 'bg-purple-900/90 text-white';
          if (table.id === 'base_tf') colors.header = 'bg-indigo-900/90 text-white';

          return (
            <div
              key={table.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden"
            >
              {/* Table Header Bar */}
              <div className={`px-4 py-3 flex items-center justify-between ${colors.header}`}>
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-black text-sm tracking-wider">
                    {table.serNo !== undefined ? `${table.serNo}. ` : `${tableIdx + 1}. `}{table.title}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                    Month Total: <strong className="font-mono">
                      {selectedFlightFilter === 'Overall' 
                        ? (table.totalRequiredMonth || 0) 
                        : getFlightTarget(table, selectedFlightFilter as FlightName)}
                    </strong>
                  </span>
                  <button
                    onClick={() => handleResetTable(tableIdx)}
                    className="p-1.5 hover:bg-white/20 rounded-lg transition-colors group cursor-pointer"
                    title="Reset this duty table"
                  >
                    <RotateCcw className="w-4 h-4 text-white/70 group-hover:text-white" />
                  </button>
                </div>
              </div>
                {/* Table Body (Days 1 to 31) */}
                <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                  <table className="w-full text-xs text-center border-collapse table-auto md:table-fixed min-w-[940px]">
                    <colgroup>
                      <col className="w-20 sm:w-24 min-w-[80px]" />
                      {daysArray.map((d) => (
                        <col key={d} className="w-[26px] sm:w-[28px] min-w-[24px]" />
                      ))}
                      <col className={showAllTableInfo ? "w-[84px] sm:w-[92px] min-w-[80px]" : "w-[54px] sm:w-[60px] min-w-[50px]"} />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-1.5 sm:p-2 text-center sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 w-20 sm:w-24 min-w-[80px] border-r border-slate-200 dark:border-slate-700 align-middle shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          Date
                        </th>
                        {daysArray.map((d) => (
                          <th key={d} className={`p-0.5 sm:p-1 font-mono text-[11px] text-center align-middle ${d % 2 === 0 ? 'bg-slate-200/70 dark:bg-slate-700/70' : 'bg-slate-100/70 dark:bg-slate-800/70'}`}>
                            {d}
                          </th>
                        ))}
                        <th className="p-1 font-bold border-l border-slate-200 dark:border-slate-700 text-center align-middle bg-slate-100 dark:bg-slate-800/80">
                          {showAllTableInfo ? (
                            <div className="flex flex-col items-center justify-center leading-tight">
                              <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                                Total
                              </span>
                              <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                                / Target
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                              Total
                            </span>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {flights
                        .filter((fl) => selectedFlightFilter === 'Overall' || selectedFlightFilter === fl)
                        .filter((fl) => !table.eligibleFlights || table.eligibleFlights.includes(fl as any))
                        .map((flight, flightIdx) => {
                          const rowSum = table.data[flight].reduce((a, b) => a + b, 0);
                          const isAltRow = flightIdx % 2 === 1;

                          return (
                            <tr
                              key={flight}
                              className={`transition-colors ${isAltRow ? 'bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/60' : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'}`}
                            >
                              <td className={`p-1.5 sm:p-2 text-center font-bold text-slate-900 dark:text-white sticky left-0 z-10 border-r border-slate-200 dark:border-slate-800 align-middle shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] ${isAltRow ? 'bg-slate-100/95 dark:bg-slate-800/95' : 'bg-white dark:bg-slate-900'}`}>
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-[11px] sm:text-xs font-bold truncate">{flight}</span>
                                  {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? (
                                    <button
                                      onClick={() => setEditingCalendar({ tableIdx: matrix.findIndex(x => x.id === table.id), flight })}
                                      className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-500 transition-colors cursor-pointer shrink-0"
                                      title="Edit in Calendar"
                                    >
                                      <Calendar className="w-3.5 h-3.5" />
                                    </button>
                                  ) : (
                                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  )}
                                </div>
                              </td>

                              {daysArray.map((dayNum, dayIdx) => {
                                const val = table.data[flight][dayIdx] || 0;
                                const isPositive = val > 0;
                                const isAltCol = dayNum % 2 === 0;

                                // Calculate daily quota for this specific duty across all flights on this day
                                const dutyDaySum = flights.reduce((sum, fl) => sum + (table.data[fl]?.[dayIdx] || 0), 0);
                                let dutyDayReq = table.dailyRequirements?.[dayIdx];
                                if (dutyDayReq === undefined) {
                                  if (table.totalRequiredDaily && (table.totalRequiredDaily * 31 === table.totalRequiredMonth)) {
                                    dutyDayReq = table.totalRequiredDaily;
                                  } else {
                                    dutyDayReq = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => acc + (table.data[fl as FlightName]?.[dayIdx] || 0), 0);
                                  }
                                }
                                const isDayExceeded = dutyDaySum > dutyDayReq;
                                const isDayShortage = dutyDaySum < dutyDayReq;

                                return (
                                  <td
                                    key={dayNum}
                                    onClick={() => handleToggleFlightDutyCell(table.id, flight, dayIdx)}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      const cur = table.data[flight][dayIdx] || 0;
                                      handleToggleFlightDutyCell(table.id, flight, dayIdx, cur === 2 ? 0 : 2);
                                    }}
                                    onDoubleClick={(e) => {
                                      e.preventDefault();
                                      const cur = table.data[flight][dayIdx] || 0;
                                      handleToggleFlightDutyCell(table.id, flight, dayIdx, cur === 2 ? 0 : 2);
                                    }}
                                    title={`Date ${dayNum} (${flight} - ${table.title}): Day Total ${dutyDaySum} / Required ${dutyDayReq}. Click for 1/0, Right-click or Double-click for 2`}
                                    className={`p-0.5 border border-slate-200/60 dark:border-slate-800/60 text-center align-middle cursor-pointer select-none transition-colors hover:bg-indigo-500/10 ${
                                      isAltRow
                                        ? (isAltCol ? 'bg-slate-100/30 dark:bg-slate-800/25' : 'bg-slate-50/20 dark:bg-slate-800/10')
                                        : (isAltCol ? 'bg-slate-50/30 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-900/20')
                                    }`}
                                  >
                                    {isPositive ? (
                                      <div
                                        className={`w-5.5 h-5.5 sm:w-6 sm:h-6 mx-auto rounded-md flex items-center justify-center font-mono text-[11px] font-bold transition-all shadow-2xs ${
                                          isDayExceeded
                                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 font-black'
                                            : isDayShortage
                                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-1.5 border-amber-400 dark:border-amber-400 font-bold'
                                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                        }`}
                                      >
                                        {val}
                                      </div>
                                    ) : isDayExceeded ? (
                                      <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 mx-auto rounded-md flex items-center justify-center font-mono text-[11px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40">
                                        -
                                      </div>
                                    ) : isDayShortage ? (
                                      <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 mx-auto rounded-md flex items-center justify-center font-mono text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border-1.5 border-amber-400 dark:border-amber-400">
                                        -
                                      </div>
                                    ) : (
                                      <span className="inline-block w-5.5 h-5.5 sm:w-6 sm:h-6 leading-5 text-slate-300 dark:text-slate-700/60 font-mono text-xs select-none">
                                        -
                                      </span>
                                    )}
                                  </td>
                                );
                              })}

                              {showAllTableInfo ? (
                                <td className={`p-1 font-mono border-l border-slate-200 dark:border-slate-700 text-center align-middle ${
                                  isAltRow ? 'bg-slate-100/80 dark:bg-slate-800/80' : 'bg-slate-50/50 dark:bg-slate-800/40'
                                }`}>
                                  <div className="flex items-center justify-center">
                                    {(() => {
                                      const tgt = getFlightTarget(table, flight);
                                      return (
                                        <div className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-lg font-mono text-xs shadow-xs border transition-all ${
                                          rowSum > tgt
                                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 font-black'
                                            : rowSum < tgt
                                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/60 font-bold'
                                              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-bold'
                                        }`}>
                                          <span className="font-black text-[11px] sm:text-[12px]">{rowSum}</span>
                                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">/</span>
                                          <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                                            {tgt}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </td>
                              ) : (
                                <td className={`p-1 font-mono font-black text-slate-900 dark:text-white border-l border-slate-200 dark:border-slate-700 text-center align-middle ${
                                  isAltRow ? 'bg-slate-100/80 dark:bg-slate-800/80' : 'bg-slate-50/50 dark:bg-slate-800/40'
                                }`}>
                                  {rowSum}
                                </td>
                              )}
                            </tr>
                          );
                        })}

                      {/* Daily Total Row (Sum across all flights for each day) */}
                      <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                        <td className="p-1.5 sm:p-2 text-center font-black sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 w-20 sm:w-24 min-w-[80px] border-r border-slate-300 dark:border-slate-700 align-middle shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                          <div className="flex flex-col items-center justify-center leading-tight">
                            <span className="uppercase text-[10px] sm:text-[11px] font-black tracking-wider text-slate-800 dark:text-slate-200">
                              {showAllTableInfo ? 'Total / Req' : 'Daily Total'}
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">
                              Unit Sum
                            </span>
                          </div>
                        </td>

                        {daysArray.map((dayNum, dayIdx) => {
                          const dailySum = flights.reduce(
                            (sum, fl) => sum + (table.data[fl]?.[dayIdx] || 0),
                            0
                          );
                          let dailyReq = table.dailyRequirements?.[dayIdx];
                          if (dailyReq === undefined) {
                              if (table.totalRequiredDaily && (table.totalRequiredDaily * 31 === table.totalRequiredMonth)) {
                                  dailyReq = table.totalRequiredDaily;
                              } else {
                                  dailyReq = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => acc + (table.data[fl as FlightName]?.[dayIdx] || 0), 0);
                              }
                          }
                          const isPositive = dailySum > 0;
                          const isDayExceeded = dailySum > dailyReq;
                          const isDayShortage = dailySum < dailyReq;

                          return (
                            <td
                              key={dayNum}
                              className="p-0.5 border border-slate-200/60 dark:border-slate-700/60 text-center align-middle"
                              title={`Date ${dayNum}: Total ${dailySum} / Required ${dailyReq}`}
                            >
                              {showAllTableInfo ? (
                                <div className={`mx-auto rounded-md flex flex-col items-center justify-center font-mono py-0.5 px-0.5 min-w-[22px] sm:min-w-[24px] ${
                                  isDayExceeded
                                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 font-black'
                                    : isDayShortage
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-400/60 font-bold'
                                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  <span className="text-[11px] leading-tight font-black">{dailySum}</span>
                                  <span className="text-[8px] leading-none opacity-80 font-bold">/{dailyReq}</span>
                                </div>
                              ) : isPositive || isDayShortage ? (
                                <span className={`inline-flex items-center justify-center w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-md font-mono font-bold text-xs shadow-2xs ${
                                  isDayExceeded
                                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 font-black'
                                    : isDayShortage
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-1.5 border-amber-400 font-bold'
                                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                }`}>
                                  {dailySum}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-600 font-mono text-xs">0</span>
                              )}
                            </td>
                          );
                        })}

                        {(() => {
                          const isTotalExceeded = tableTotal > (table.totalRequiredMonth || 0);
                          const isTotalShortage = tableTotal < (table.totalRequiredMonth || 0);

                          return (
                            <td className="p-1 font-mono font-bold bg-slate-200/60 dark:bg-slate-800/80 border-l border-slate-300 dark:border-slate-700 text-xs text-center align-middle">
                              {showAllTableInfo ? (
                                <div className="flex items-center justify-center">
                                  <div className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-lg font-mono text-xs shadow-xs border transition-all ${
                                    isTotalExceeded
                                      ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 font-black'
                                      : isTotalShortage
                                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/60 font-bold'
                                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-bold'
                                  }`}>
                                    <span className="font-black text-[11px] sm:text-[12px]">{tableTotal}</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">/</span>
                                    <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 font-semibold">{table.totalRequiredMonth || 0}</span>
                                  </div>
                                </div>
                              ) : (
                                <span className="font-mono font-black text-slate-900 dark:text-white text-xs">{tableTotal}</span>
                              )}
                            </td>
                          );
                        })()}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {/* Flight-wise Total Duty Summary Card */}
          {viewMode === 'DUTY_RATIO' && selectedFlightFilter === 'Overall' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 shadow-md overflow-hidden mt-6">
              <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-indigo-700 via-indigo-800 to-slate-900 text-white">
                <div className="flex items-center space-x-2.5">
                  <Layers className="w-5 h-5 text-indigo-300" />
                  <span className="font-mono font-black text-sm tracking-wider uppercase">
                    Flight-Wise Total Duty Summary
                  </span>
                </div>
                <div className="text-xs font-bold bg-white/20 px-3 py-1 rounded-lg font-mono">
                  Total Allocated: {flights.reduce((s, fl) => s + flightTotalsOverall[fl], 0)} / {totalSlotsOverall}
                </div>
              </div>
              <div className="w-full overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-2.5 text-left pl-4 font-bold">FLIGHT NAME</th>
                      {matrix.filter(t => !t.isDisabled).map(t => (
                        <th key={t.id} className="p-2 text-center font-bold">{t.title}</th>
                      ))}
                      <th className="p-2.5 text-center font-black bg-indigo-100 dark:bg-indigo-900/60 text-indigo-950 dark:text-indigo-200">TOTAL DUTY</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {flights.map(fl => {
                      const totalAllocated = flightTotalsOverall[fl];
                      const totalTarget = matrix.filter(t => !t.isDisabled).reduce((s, t) => s + getFlightTarget(t, fl), 0);
                      return (
                        <tr key={fl} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 text-left pl-4 font-bold text-slate-900 dark:text-white">
                            {fl} Flight
                          </td>
                          {matrix.filter(t => !t.isDisabled).map(t => {
                            const val = t.data[fl]?.reduce((a, b) => a + b, 0) ?? 0;
                            const tgt = getFlightTarget(t, fl);
                            return (
                              <td key={t.id} className="p-2 text-center font-mono font-bold">
                                {t.eligibleFlights && !t.eligibleFlights.includes(fl) ? (
                                  <span className="text-slate-400">N/A</span>
                                ) : (
                                  <span className={val === tgt ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}>
                                    {val}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="p-2.5 text-center font-mono font-black text-sm bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300">
                            {totalAllocated}
                            {showAllTableInfo && (
                              <span className="text-xs text-slate-400 ml-1">/ {totalTarget}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-t-2 border-slate-300 dark:border-slate-700">
                      <td className="p-2.5 text-left pl-4 font-black">TOTAL</td>
                      {matrix.filter(t => !t.isDisabled).map(t => {
                        const sum = flights.reduce((s, fl) => s + (t.data[fl]?.reduce((a, b) => a + b, 0) ?? 0), 0);
                        return (
                          <td key={t.id} className="p-2 text-center font-mono font-black">
                            {sum}
                          </td>
                        );
                      })}
                      <td className="p-2.5 text-center font-mono font-black text-sm bg-indigo-200 dark:bg-indigo-900 text-indigo-950 dark:text-indigo-100">
                        {flights.reduce((s, fl) => s + flightTotalsOverall[fl], 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {viewMode === 'DUTY_RATIO' && selectedFlightFilter !== 'Overall' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between bg-slate-800 text-white">
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-black text-sm tracking-wider">
                    {selectedFlightFilter} Duty Schedule
                  </span>
                </div>
                <div className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                  Month Total: <strong className="font-mono">{flightTotalsOverall[selectedFlightFilter as FlightName]}</strong>
                  {showAllTableInfo && (
                    <span className="ml-1 text-white/80">
                      / {targetFlightTotal}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                <table className="w-full text-xs text-center border-collapse table-fixed min-w-[760px] sm:min-w-[960px]">
                  <colgroup>
                    <col className="w-20 sm:w-36 max-w-[85px] sm:max-w-none" />
                    {daysArray.map((d) => (
                      <col key={d} className="w-[22px] sm:w-[26px]" />
                    ))}
                    <col className={showAllTableInfo ? "w-[72px] sm:w-[92px]" : "w-[46px] sm:w-[56px]"} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                      <th className="p-1 sm:p-2 text-center sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 w-20 sm:w-36 max-w-[85px] sm:max-w-none border-r border-slate-200 dark:border-slate-700 align-middle shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] overflow-hidden">
                        <span className="sm:hidden text-[10px] font-black uppercase tracking-tight">Duty</span>
                        <span className="hidden sm:inline">Duty Name / Date</span>
                      </th>
                      {daysArray.map((d) => (
                        <th key={d} className={`p-0.5 sm:p-1 font-mono text-[11px] align-middle ${d % 2 === 0 ? 'bg-slate-200/70 dark:bg-slate-700/70' : 'bg-slate-100/70 dark:bg-slate-800/70'}`}>
                          {d}
                        </th>
                      ))}
                      <th className="p-1 font-bold border-l border-slate-200 dark:border-slate-700 text-center align-middle bg-slate-100 dark:bg-slate-800/80">
                        {showAllTableInfo ? (
                          <div className="flex flex-col items-center justify-center leading-tight">
                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                              Total
                            </span>
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                              / Target
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            Total
                          </span>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {matrix.filter(t => !t.isDisabled).map((table, tableIdx) => {
                      const rowData = table.data[selectedFlightFilter as FlightName];
                      const rowSum = rowData.reduce((a, b) => a + b, 0);
                      const target = getFlightTarget(table, selectedFlightFilter as FlightName);
                      const isAltRow = tableIdx % 2 === 1;

                      const isExceeded = rowSum > target;
                      const isShortage = rowSum < target;

                      return (
                        <tr
                          key={table.id}
                          className={`transition-colors ${
                            isAltRow
                              ? 'bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
                              : 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className={`p-1 sm:p-2 text-center font-bold text-slate-900 dark:text-white sticky left-0 z-10 border-r border-slate-200 dark:border-slate-800 align-middle text-[11px] leading-tight shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] w-20 sm:w-36 max-w-[85px] sm:max-w-none overflow-hidden ${
                            isAltRow
                              ? 'bg-slate-100/95 dark:bg-slate-800/95'
                              : 'bg-white dark:bg-slate-900'
                          }`}>
                            <div className="flex items-center justify-between gap-0.5 overflow-hidden" title={table.title}>
                              <span className={`truncate text-left text-[10px] sm:text-[11px] leading-tight ${isExceeded ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>
                                <span className="sm:hidden font-black">
                                  {table.serNo !== undefined ? `${table.serNo}. ` : ''}{getCompactDutyTitle(table)}
                                </span>
                                <span className="hidden sm:inline font-bold">
                                  {table.serNo !== undefined ? `${table.serNo}. ` : ''}{table.title}
                                </span>
                              </span>
                              {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? (
                                <button
                                  onClick={() => setEditingCalendar({ tableIdx: matrix.findIndex(x => x.id === table.id), flight: selectedFlightFilter as FlightName })}
                                  className="p-0.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-500 transition-colors cursor-pointer shrink-0"
                                  title="Edit in Calendar"
                                >
                                  <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                </button>
                              ) : (
                                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                              )}
                            </div>
                          </td>
                          {daysArray.map((dayNum, dayIdx) => {
                            const val = rowData[dayIdx] || 0;
                            const isPositive = val > 0;
                            const isAltCol = dayNum % 2 === 0;

                            // Calculate daily quota for this specific duty across all flights on this day
                            const dutyDaySum = flights.reduce((sum, fl) => sum + (table.data[fl]?.[dayIdx] || 0), 0);
                            let dutyDayReq = table.dailyRequirements?.[dayIdx];
                            if (dutyDayReq === undefined) {
                              if (table.totalRequiredDaily && (table.totalRequiredDaily * 31 === table.totalRequiredMonth)) {
                                dutyDayReq = table.totalRequiredDaily;
                              } else {
                                dutyDayReq = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => acc + (table.data[fl as FlightName]?.[dayIdx] || 0), 0);
                              }
                            }
                            const isDayExceeded = dutyDaySum > dutyDayReq;
                            const isDayShortage = dutyDaySum < dutyDayReq;

                            return (
                              <td
                                key={dayNum}
                                onClick={() => handleToggleFlightDutyCell(table.id, selectedFlightFilter as FlightName, dayIdx)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  const cur = rowData[dayIdx] || 0;
                                  handleToggleFlightDutyCell(table.id, selectedFlightFilter as FlightName, dayIdx, cur === 2 ? 0 : 2);
                                }}
                                onDoubleClick={(e) => {
                                  e.preventDefault();
                                  const cur = rowData[dayIdx] || 0;
                                  handleToggleFlightDutyCell(table.id, selectedFlightFilter as FlightName, dayIdx, cur === 2 ? 0 : 2);
                                }}
                                title={`Date ${dayNum} (${selectedFlightFilter} - ${table.title}): Day Total ${dutyDaySum} / Required ${dutyDayReq}. Click for 1/0, Right-click or Double-click for 2`}
                                className={`p-0.5 border border-slate-200/60 dark:border-slate-800/60 text-center align-middle cursor-pointer select-none transition-colors hover:bg-indigo-500/10 ${
                                  isAltRow
                                    ? (isAltCol ? 'bg-slate-100/30 dark:bg-slate-800/25' : 'bg-slate-50/20 dark:bg-slate-800/10')
                                    : (isAltCol ? 'bg-slate-50/30 dark:bg-slate-900/40' : 'bg-white dark:bg-slate-900/20')
                                }`}
                              >
                                {isPositive ? (
                                  <div
                                    className={`w-5.5 h-5.5 sm:w-6 sm:h-6 mx-auto rounded-md flex items-center justify-center font-mono text-[11px] font-bold transition-all shadow-2xs ${
                                      isDayExceeded
                                        ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40 font-black'
                                        : isDayShortage
                                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-1.5 border-amber-400 dark:border-amber-400 font-bold'
                                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                    }`}
                                  >
                                    {val}
                                  </div>
                                ) : isDayExceeded ? (
                                  <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 mx-auto rounded-md flex items-center justify-center font-mono text-[11px] font-bold bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40">
                                    -
                                  </div>
                                ) : isDayShortage ? (
                                  <div className="w-5.5 h-5.5 sm:w-6 sm:h-6 mx-auto rounded-md flex items-center justify-center font-mono text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border-1.5 border-amber-400 dark:border-amber-400">
                                    -
                                  </div>
                                ) : (
                                  <span className="inline-block w-5.5 h-5.5 sm:w-6 sm:h-6 leading-5 text-slate-300 dark:text-slate-700/60 font-mono text-xs select-none">
                                    -
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          {showAllTableInfo ? (
                            <td className={`p-1 font-mono border-l border-slate-200 dark:border-slate-700 text-center align-middle ${
                              isAltRow ? 'bg-slate-100/80 dark:bg-slate-800/80' : 'bg-slate-50/50 dark:bg-slate-800/40'
                            }`}>
                              <div className="flex items-center justify-center">
                                <div className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-lg font-mono text-xs shadow-xs border transition-all ${
                                  isExceeded
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 font-black'
                                    : isShortage
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/60 font-bold'
                                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-bold'
                                }`}>
                                  <span className="font-black text-[11px] sm:text-[12px]">{rowSum}</span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">/</span>
                                  <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 font-semibold">{target}</span>
                                </div>
                              </div>
                            </td>
                          ) : (
                            <td className={`p-1 font-mono font-black border-l border-slate-200 dark:border-slate-700 align-middle text-center ${
                              isExceeded ? 'text-red-600 dark:text-red-400 font-black' : isShortage ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
                            } ${isAltRow ? 'bg-slate-100/80 dark:bg-slate-800/80' : 'bg-slate-50/50 dark:bg-slate-800/40'}`}>
                              {rowSum}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {/* Daily Total Row */}
                    <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                      <td className="p-1 sm:p-2 text-center font-black sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 w-20 sm:w-36 max-w-[85px] sm:max-w-none border-r border-slate-300 dark:border-slate-700 align-middle shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)] overflow-hidden">
                        <div className="flex flex-col items-center justify-center leading-tight">
                          <span className="uppercase text-[9px] sm:text-[11px] font-black tracking-tight text-slate-800 dark:text-slate-200">
                            {showAllTableInfo ? 'Total' : 'Daily'}
                          </span>
                          <span className="text-[8px] sm:text-[9px] uppercase tracking-tight text-indigo-600 dark:text-indigo-400 font-bold">
                            Sum
                          </span>
                        </div>
                      </td>
                      {(() => {
                        const activeDuties = matrix.filter(t => !t.isDisabled);
                        const flightTotal = targetFlightTotal > 0 ? targetFlightTotal : (flightTotalsOverall[selectedFlightFilter as FlightName] || 0);
                        const daysCount = daysArray.length || 31;
                        const baseDaily = Math.floor(flightTotal / daysCount);
                        const extraDays = flightTotal % daysCount;
                        const minAllowed = baseDaily;
                        const maxAllowed = extraDays > 0 ? baseDaily + 1 : baseDaily;

                        return daysArray.map((dayNum, dayIdx) => {
                          const dailySum = activeDuties.reduce((sum, table) => sum + (table.data[selectedFlightFilter as FlightName]?.[dayIdx] || 0), 0);
                          const isPositive = dailySum > 0;

                          // Balanced distribution evaluation as per user golden rule:
                          // - If between minAllowed and maxAllowed: fully balanced!
                          // - If > maxAllowed: excess (+1 red, +2 pink/orange)
                          // - If < minAllowed: shortage (-1 light blue, -2 dark blue)
                          let badgeClass = 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-bold';
                          let diffDesc = `Balanced target (${dailySum})`;

                          if (flightTotal > 0) {
                            if (dailySum > maxAllowed) {
                              const diff = dailySum - maxAllowed;
                              if (diff >= 2) {
                                badgeClass = 'bg-gradient-to-br from-pink-500/25 to-orange-500/25 text-pink-700 dark:text-orange-300 border border-pink-500 dark:border-orange-400 font-black ring-1 ring-pink-400/50 shadow-xs';
                                diffDesc = `+${diff} above max target (${maxAllowed})`;
                              } else {
                                badgeClass = 'bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500 font-black ring-1 ring-rose-500/50 shadow-xs';
                                diffDesc = `+${diff} above max target (${maxAllowed})`;
                              }
                            } else if (dailySum < minAllowed) {
                              const diff = minAllowed - dailySum;
                              if (diff >= 2) {
                                badgeClass = 'bg-blue-600/30 text-blue-800 dark:text-blue-200 border border-blue-600 dark:border-blue-400 font-black ring-1 ring-blue-600/50 shadow-xs';
                                diffDesc = `-${diff} below min target (${minAllowed})`;
                              } else {
                                badgeClass = 'bg-sky-400/25 text-sky-700 dark:text-sky-300 border border-sky-400 dark:border-sky-400 font-bold ring-1 ring-sky-400/50 shadow-xs';
                                diffDesc = `-${diff} below min target (${minAllowed})`;
                              }
                            } else {
                              if (dailySum === minAllowed) {
                                badgeClass = 'bg-slate-200/80 dark:bg-slate-700/80 text-slate-800 dark:text-slate-200 font-bold';
                                diffDesc = `Balanced base target (${minAllowed})`;
                              } else {
                                badgeClass = 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-400/40 font-bold';
                                diffDesc = `Balanced target (+1 remainder day: ${dailySum})`;
                              }
                            }
                          }

                          return (
                            <td
                              key={dayNum}
                              className="p-0.5 border border-slate-200/60 dark:border-slate-700/60 text-center align-middle"
                              title={`Date ${dayNum}: Flight Total ${dailySum} (Target range: ${minAllowed} - ${maxAllowed}) - ${diffDesc}`}
                            >
                              {isPositive ? (
                                <span className={`inline-flex items-center justify-center w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-md font-mono text-xs transition-all ${badgeClass}`}>
                                  {dailySum}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-600 font-mono text-xs">0</span>
                              )}
                            </td>
                          );
                        });
                      })()}
                      {(() => {
                        const flightTotal = flightTotalsOverall[selectedFlightFilter as FlightName];
                        const isTotalExceeded = flightTotal > targetFlightTotal;
                        const isTotalShortage = flightTotal < targetFlightTotal;

                        return (
                          <td className="p-1 font-mono font-bold bg-slate-200/60 dark:bg-slate-800/80 border-l border-slate-300 dark:border-slate-700 text-xs text-center align-middle">
                            {showAllTableInfo ? (
                              <div className="flex items-center justify-center">
                                <div className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-lg font-mono text-xs shadow-xs border transition-all ${
                                  isTotalExceeded
                                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40 font-black'
                                    : isTotalShortage
                                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-400/60 font-bold'
                                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-bold'
                                }`}>
                                  <span className="font-black text-[11px] sm:text-[12px]">{flightTotal}</span>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">/</span>
                                  <span className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 font-semibold">{targetFlightTotal}</span>
                                </div>
                              </div>
                            ) : (
                              <span className="font-mono font-black text-slate-900 dark:text-white text-xs">{flightTotal}</span>
                            )}
                          </td>
                        );
                      })()}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
              </div>

      </div>
      

      
      {/* Settings Modal */}
      {settingsTableIdx !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-indigo-500" />
                Settings: {matrix[settingsTableIdx]?.title}
              </h3>
              <button
                onClick={() => setSettingsTableIdx(null)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto space-y-6">
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/50">
                <h4 className="font-bold text-sm text-indigo-900 dark:text-indigo-300 mb-2">Daily Requirement Calendar</h4>
                <p className="text-xs text-indigo-700/80 dark:text-indigo-300/70 mb-4">
                  Set the required number of duties for each day of the month.
                </p>
                
                <div className="flex items-center space-x-3 mb-6 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Set default for all days:</label>
                  <input
                    type="number"
                    min="0"
                    id="globalReqInput"
                    className="w-20 px-2 py-1 text-sm bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-md focus:ring-2 focus:ring-indigo-500"
                    defaultValue={matrix[settingsTableIdx]?.totalRequiredDaily || 0}
                  />
                  <button
                    onClick={() => {
                      const val = parseInt((document.getElementById('globalReqInput') as HTMLInputElement).value, 10);
                      if (isNaN(val)) return;
                      const updated = [...matrix];
                      updated[settingsTableIdx].dailyRequirements = new Array(31).fill(val);
                      updated[settingsTableIdx].totalRequiredDaily = val;
                      setMatrix(updated);
                      saveDutyMatrix(updated);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Apply to All
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 sm:gap-3">
                  {daysArray.map((dayNum, idx) => {
                    const req = matrix[settingsTableIdx]?.dailyRequirements?.[idx] ?? (matrix[settingsTableIdx]?.totalRequiredDaily || 0);
                    return (
                      <div key={dayNum} className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-500 mb-1 text-center">Day {dayNum}</label>
                        <input
                          type="number"
                          min="0"
                          value={req}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            const updated = [...matrix];
                            const currentReqs = updated[settingsTableIdx].dailyRequirements || new Array(31).fill(updated[settingsTableIdx].totalRequiredDaily || 0);
                            currentReqs[idx] = val;
                            updated[settingsTableIdx].dailyRequirements = currentReqs;
                            setMatrix(updated);
                            saveDutyMatrix(updated);
                          }}
                          className="w-full text-center px-1 py-1.5 text-sm font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
                        />
                      </div>
                    );
                  })}
            </div>
            
            </div>
              </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
              <button
                onClick={() => setSettingsTableIdx(null)}
                className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setSettingsTableIdx(null); }}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md rounded-xl transition-colors flex items-center space-x-2"
              >
                <Check className="w-4 h-4" />
                <span>Done</span>
              </button>
        </div>
          </div>
        </div>
      )}

      {/* Calendar Edit Modal */}
      {editingCalendar && (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
        <FlightDutyCalendarModal
          table={matrix[editingCalendar.tableIdx]}
          matrix={matrix}
          flight={editingCalendar.flight}
          target={getFlightTarget(matrix[editingCalendar.tableIdx], editingCalendar.flight)}
          onClose={() => setEditingCalendar(null)}
          onSave={(newData) => {
            const updated = [...matrix];
            updated[editingCalendar.tableIdx].data[editingCalendar.flight] = newData;
            setMatrix(updated);
            saveDutyMatrix(updated);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
            setEditingCalendar(null);
          }}
        />
      )}

      {isPrintModalOpen && (
        <PrintableDutyRatioModal
          matrix={matrix}
          selectedFlightFilter={selectedFlightFilter}
          onClose={() => setIsPrintModalOpen(false)}
          exportMode={printModalMode}
          targetDate={targetDate}
        />
      )}

      {isImportModalOpen && (
        <ImportDutyRatioModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          currentMatrix={matrix}
          onImport={(newMatrix) => {
            setMatrix(newMatrix);
            saveDutyMatrix(newMatrix);
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2500);
          }}
        />
      )}
      </div>
    
      {/* Reset Confirmation Modal */}
      {resetConfirmTableIdx !== null && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center border border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto mb-4">
              <RotateCcw className="w-8 h-8 text-rose-600 dark:text-rose-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Reset Duty Table?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to reset all flights for <strong className="text-slate-700 dark:text-slate-300">{matrix[resetConfirmTableIdx]?.title}</strong>? This action will set all values to 0.
            </p>
            <div className="flex space-x-3 justify-center">
              <button
                onClick={() => setResetConfirmTableIdx(null)}
                className="px-4 py-2 font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmResetTable}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md rounded-xl transition-colors"
              >
                Reset Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto Allocate Mode Selection Modal (Single vs Package) */}
      <AutoAllocateModal
        isOpen={isAutoAllocateModalOpen}
        onClose={() => setIsAutoAllocateModalOpen(false)}
        onSelectMode={(mode) => handleTriggerAutoAllocate(mode)}
      />
</div>
  );
};

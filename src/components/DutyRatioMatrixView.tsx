import React, { useState, useEffect } from 'react';
import { DutyRatioConfigPanel } from './DutyRatioConfigPanel';

import {
  DutyRatioTable,
  getStoredDutyMatrix,
  saveDutyMatrix,
  resetDutyMatrixToDefault,
} from '../data/officialDutyRatioMatrix';
import { FlightName, UserRole } from '../types';
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
  FileDown,
  FileSpreadsheet,
  CheckCircle2, Clock } from 'lucide-react';
import { exportDutyRatioDocx } from '../utils/docxExport';
import { ImportDutyRatioModal } from './ImportDutyRatioModal';
import { FlightDutyCalendarModal } from './FlightDutyCalendarModal';
import { PrintableDutyRatioModal } from "./PrintableDutyRatioModal";

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
  const [showTableInfo, setShowTableInfo] = useState<Record<number, boolean>>({});
  const [settingsTableIdx, setSettingsTableIdx] = useState<number | null>(null);

  const toggleTableInfo = (idx: number) => setShowTableInfo(prev => ({ ...prev, [idx]: !prev[idx] }));
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
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

  const daysArray = Array.from({ length: 31 }, (_, i) => i + 1);
  const flights: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];

  // Flight name short codes
  const flightShortMap: Record<FlightName, string> = {
    Mechanics: 'Mech',
    Avionics: 'AVI',
    GCS: 'GCS',
    Admin: 'Admin',
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

  const handleResetTable = (tableIndex: number) => {
    if (!window.confirm('Reset this table to 0 for all flights?')) return;
    const updated = [...matrix];
    const tableObj = { ...updated[tableIndex] };
    const flightData = { ...tableObj.data };
    flights.forEach(f => {
      flightData[f] = new Array(31).fill(0);
    });
    tableObj.data = flightData;
    updated[tableIndex] = tableObj;
    setMatrix(updated);
    saveDutyMatrix(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
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

  
  // Calculate Auto Targets from localStorage
  
  const savedManpower = localStorage.getItem('baf_duty_distribution_manpower');
  let autoTargets: Record<string, Record<string, number>> = {
    Mechanics: {}, Avionics: {}, GCS: {}, Admin: {}
  };
  
  if (savedManpower) {
    try {
      const manpower = JSON.parse(savedManpower);
      const totalCpl = manpower.mechCpl + manpower.aviCpl + manpower.gcsCpl + manpower.adminCpl;
      const totalSgt = manpower.mechSgt + manpower.aviSgt + manpower.gcsSgt + manpower.adminSgt;
      const totalAll = totalCpl + totalSgt;
      
      const fltStrength = {
         Mechanics: { cpl: manpower.mechCpl, sgt: manpower.mechSgt, total: manpower.mechCpl + manpower.mechSgt },
         Avionics: { cpl: manpower.aviCpl, sgt: manpower.aviSgt, total: manpower.aviCpl + manpower.aviSgt },
         GCS: { cpl: manpower.gcsCpl, sgt: manpower.gcsSgt, total: manpower.gcsCpl + manpower.gcsSgt },
         Admin: { cpl: manpower.adminCpl, sgt: manpower.adminSgt, total: manpower.adminCpl + manpower.adminSgt },
      };

      matrix.filter(t => !t.isDisabled).forEach(table => {
         const isSecurity = table.id === 'security_duty';
         const poolSize = isSecurity ? totalCpl : totalAll;
         const dutyTotal = table.totalRequiredMonth || 0;
         const dpp = poolSize > 0 ? (dutyTotal / poolSize) : 0;
         
         flights.forEach(fl => {
             const flightPool = isSecurity ? fltStrength[fl].cpl : fltStrength[fl].total;
             autoTargets[fl][table.id] = dpp * flightPool;
         });
      });
    } catch(e){}
  }


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

  const handleRatioCalculated = (newMatrix: DutyRatioTable[]) => {
    setMatrix(newMatrix);
    saveDutyMatrix(newMatrix);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden print:overflow-visible">
      <div className="flex-none pt-4 px-4 md:pt-6 md:px-6 w-full max-w-7xl mx-auto animate-fadeIn space-y-6 print:hidden">
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
          {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? (
            <button
              type="button"
              onClick={() => setIsPrintModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center space-x-1.5 shadow-xs cursor-pointer"
              title="Print Preview / Export"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Official Export/Print</span>
            </button>
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
      <div className="flex flex-col items-center justify-center w-48 mx-auto">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Last Updating Date</div>
        <input 
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-bold text-indigo-700 dark:text-indigo-400 focus:outline-none focus:border-indigo-500 shadow-sm w-full text-center"
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
    <div className="flex-1 overflow-y-auto p-4 md:p-6 scroll-smooth print:hidden">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {viewMode !== 'DUTY_RATIO' && (
          <DutyRatioConfigPanel activeTab={viewMode as any} matrix={matrix} onMatrixChange={handleRatioCalculated} targetDate={targetDate} />
        )}

                {viewMode === 'DUTY_RATIO' && (
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
            <div className="flex items-center space-x-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              <Layers className="w-4 h-4 text-indigo-500" />
              <span>Flight Filter:</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-3 sm:mt-0">
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
        )}

        {/* Existing Mapping for Overall or Specific Single Flight Rendering */}

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
                    {tableIdx + 1}. {table.title}
                  </span>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                    Month Total: <strong className="font-mono">
                      {selectedFlightFilter === 'Overall' 
                        ? (table.totalRequiredMonth || 0) 
                        : (table.flightTargets?.[selectedFlightFilter as 'Mechanics' | 'Avionics' | 'GCS' | 'Admin'] || 0)}
                    </strong>
                  </span>
                  {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
                    <>
                      <button
                        onClick={() => toggleTableInfo(tableIdx)}
                        title="Toggle Target/Requirement Info"
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${showTableInfo[tableIdx] ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                      >
                        <Info className="w-4 h-4" />
                      </button>

                    </>
                  )}

                </div>
              </div>
                {/* Table Body (Days 1 to 31) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                        <th className="p-2 text-center sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 w-28 min-w-28 border-r border-slate-200 dark:border-slate-700 text-center align-middle">
                          Date
                        </th>
                        {daysArray.map((d) => (
                          <th key={d} className="p-1 min-w-[28px] max-w-[32px] font-mono text-[11px] text-center align-middle">
                            {d}
                          </th>
                        ))}
                        {showTableInfo[tableIdx] ? (
                          <th className="p-2 w-28 min-w-28 font-bold bg-slate-200/60 dark:bg-slate-700/60 border-l border-slate-200 dark:border-slate-700 text-center align-middle leading-tight">
                            Total / Ratio
                          </th>
                        ) : (
                          <th className="p-2 w-16 min-w-16 font-bold bg-slate-200/60 dark:bg-slate-700/60 border-l border-slate-200 dark:border-slate-700 text-center align-middle">
                            Total
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {flights
                        .filter((fl) => selectedFlightFilter === 'Overall' || selectedFlightFilter === fl)
                        .filter((fl) => !table.eligibleFlights || table.eligibleFlights.includes(fl as any))
                        .map((flight) => {
                          const rowSum = table.data[flight].reduce((a, b) => a + b, 0);

                          return (
                            <tr
                              key={flight}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                            >
                              <td className="p-2 text-center font-bold text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-800 text-center align-middle">
                                <div className="flex items-center justify-between">
                                  <span>{flight}</span>
                                  {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? (
                                    <button
                                      onClick={() => setEditingCalendar({ tableIdx: matrix.findIndex(x => x.id === table.id), flight })}
                                      className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-500 transition-colors cursor-pointer"
                                      title="Edit in Calendar"
                                    >
                                      <Calendar className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                </div>
                              </td>

                              {daysArray.map((dayNum, dayIdx) => {
                                const val = table.data[flight][dayIdx] || 0;
                                const isPositive = val > 0;

                                return (
                                  <td
                                    key={dayNum}
                                    className={`p-0.5 border border-slate-100 dark:border-slate-800/50 ${
                                      isPositive
                                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-black'
                                        : 'text-slate-400 dark:text-slate-600 font-normal'
                                    }`}
                                  >
                                    <span className="inline-block py-1 font-mono text-xs">{val || ''}</span>
                                  </td>
                                );
                              })}

                              {showTableInfo[tableIdx] ? (
                                <td className="p-2 font-mono font-bold bg-slate-50 dark:bg-slate-800/50 border-l border-slate-200 dark:border-slate-700 text-center align-middle">
                                  <div className="flex items-center justify-center space-x-1 text-[11px]">
                                    <span className={rowSum !== Math.round(autoTargets?.[flight]?.[table.id] || table.flightTargets?.[flight] || 0) ? 'text-red-600 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}>{rowSum}</span>
                                    <span className="text-slate-400">/</span>
                                    <span className="text-slate-600 dark:text-slate-400">{Math.round(autoTargets?.[flight]?.[table.id] || table.flightTargets?.[flight] || 0)}</span>
                                  </div>
                                </td>
                              ) : (
                                <td className="p-2 font-mono font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/50 border-l border-slate-200 dark:border-slate-700 text-center align-middle">
                                  {rowSum}
                                </td>
                              )}
                            </tr>
                          );
                        })}

                      {/* Daily Total Row (Sum across all flights for each day) */}
                      <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                        <td className="p-2 text-center font-black sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 border-r border-slate-300 dark:border-slate-700 text-center align-middle">
                          <div className="flex items-center justify-between">
                            <span className="uppercase text-[11px] font-black tracking-wider text-slate-800 dark:text-slate-200">
                              {showTableInfo[tableIdx] ? 'Total / Reqr.' : 'Daily Total'}
                            </span>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono font-bold">
                              TOTAL
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

                          return (
                            <td
                              key={dayNum}
                              className={`p-0.5 border border-slate-200 dark:border-slate-700/70 font-mono font-black ${
                                isPositive
                                  ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200'
                                  : 'text-slate-400 dark:text-slate-600 font-normal'
                              }`}
                            >
                              {showTableInfo[tableIdx] ? (
                                <div className="flex items-center justify-center space-x-0.5 text-[10px]">
                                  <span className={dailySum !== dailyReq ? 'text-red-600 dark:text-red-400' : ''}>{dailySum}</span>
                                  <span className="text-slate-400 font-normal">/</span>
                                  <span className="text-slate-600 dark:text-slate-400">{dailyReq}</span>
                                </div>
                              ) : (
                                <span className="inline-block py-1 text-xs">{dailySum}</span>
                              )}
                            </td>
                          );
                        })}

                        <td className="p-2 font-mono font-black text-emerald-800 dark:text-emerald-300 bg-slate-200/90 dark:bg-slate-700/90 border-l border-slate-300 dark:border-slate-700 text-xs text-center align-middle">
                          {showTableInfo[tableIdx] ? (
                            <div className="flex items-center justify-center space-x-1">
                              <span className={tableTotal !== (table.totalRequiredMonth || 0) ? 'text-red-600 dark:text-red-400' : ''}>{tableTotal}</span>
                              <span className="text-slate-400 font-normal">/</span>
                              <span className="text-slate-600 dark:text-slate-400">{table.totalRequiredMonth || 0}</span>
                            </div>
                          ) : (
                            tableTotal
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          

        {viewMode === 'DUTY_RATIO' && selectedFlightFilter !== 'Overall' && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between bg-slate-800 text-white">
              <div className="flex items-center space-x-3">
                <span className="font-mono font-black text-sm tracking-wider">
                  {selectedFlightFilter} Duty Schedule
                </span>
              </div>
              <div className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">
                Month Total: <strong className="font-mono">{flightTotalsOverall[selectedFlightFilter as FlightName]}</strong>
            </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-center border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="p-2 text-center sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 w-32 min-w-32 border-r border-slate-200 dark:border-slate-700 align-middle">
                      Duty Name / Date
                    </th>
                    {daysArray.map((d) => (
                      <th key={d} className="p-1 min-w-[28px] max-w-[32px] font-mono text-[11px] align-middle">
                        {d}
                      </th>
                    ))}
                    <th className="p-2 w-16 min-w-16 font-bold bg-slate-200/60 dark:bg-slate-700/60 border-l border-slate-200 dark:border-slate-700 align-middle">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {matrix.filter(t => !t.isDisabled).map((table, tableIdx) => {
                    const rowData = table.data[selectedFlightFilter as FlightName];
                    const rowSum = rowData.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={table.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="p-2 text-center font-bold text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-800 align-middle text-[11px] leading-tight">
                          <div className="flex items-center justify-between">
                            <span>{table.title}</span>
                            {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? (
                              <button
                                onClick={() => setEditingCalendar({ tableIdx: matrix.findIndex(x => x.id === table.id), flight: selectedFlightFilter as FlightName })}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-500 transition-colors cursor-pointer ml-2"
                                title="Edit in Calendar"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2" />
                            )}
                          </div>
                        </td>
                        {daysArray.map((dayNum, dayIdx) => {
                          const val = rowData[dayIdx] || 0;
                          const isPositive = val > 0;
                          return (
                            <td
                              key={dayNum}
                              className={`p-0.5 border border-slate-100 dark:border-slate-800/50 ${
                                isPositive
                                  ? 'bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-black'
                                  : 'text-slate-400 dark:text-slate-600 font-normal'
                              }`}
                            >
                              <span className="inline-block py-1 font-mono text-xs">{val || ''}</span>
                            </td>
                          );
                        })}
                        <td className="p-2 font-mono font-black text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/50 border-l border-slate-200 dark:border-slate-700 align-middle">
                          {rowSum}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Daily Total Row */}
                  <tr className="bg-slate-100/90 dark:bg-slate-800/90 font-bold border-t-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100">
                    <td className="p-2 text-center font-black sticky left-0 bg-slate-100 dark:bg-slate-800 z-10 border-r border-slate-300 dark:border-slate-700 align-middle">
                      <div className="flex items-center justify-between">
                        <span className="uppercase text-[11px] font-black tracking-wider text-slate-800 dark:text-slate-200">
                          Daily Total
                        </span>
                        <span className="text-[9px] px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono font-bold">
                          TOTAL
                        </span>
                      </div>
                    </td>
                    {daysArray.map((dayNum, dayIdx) => {
                      const dailySum = matrix.filter(t => !t.isDisabled).reduce((sum, table) => sum + (table.data[selectedFlightFilter as FlightName]?.[dayIdx] || 0), 0);
                      const isPositive = dailySum > 0;
                      return (
                        <td
                          key={dayNum}
                          className={`p-0.5 border border-slate-200 dark:border-slate-700/70 font-mono font-black ${
                            isPositive
                              ? 'bg-emerald-100/70 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200'
                              : 'text-slate-400 dark:text-slate-600 font-normal'
                          }`}
                        >
                          <span className="inline-block py-1 text-xs">{dailySum}</span>
                        </td>
                      );
                    })}
                    <td className="p-2 font-mono font-black text-emerald-800 dark:text-emerald-300 bg-slate-200/90 dark:bg-slate-700/90 border-l border-slate-300 dark:border-slate-700 text-xs align-middle">
                      {flightTotalsOverall[selectedFlightFilter as FlightName]}
                    </td>
                  </tr>
                </tbody>
              </table>
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
          flight={editingCalendar.flight}
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
        />
      )}
      </div>
    </div>
  );
};

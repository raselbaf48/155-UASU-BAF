import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DutyRatioTable } from '../data/officialDutyRatioMatrix';
import { FlightName } from '../types';
import { Printer, X, Download, FileSpreadsheet, CheckSquare, Square, Filter, Layers } from 'lucide-react';
import { exportTableToCSV, exportDutyRatioMatrixExcel, exportManpowerAndNominalRollExcel, exportFlightDutyScheduleExcel } from '../utils/csvExport';
import { exportHtmlToWord } from '../utils/htmlExport';
import { DUTY_TYPE_MAP } from '../data/dutyTypes';
import { localDb } from '../services/localDatabase';

export function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[now.getMonth()]} ${String(now.getFullYear()).slice(-2)}`;
  }
  try {
    const trimmed = dateStr.trim();
    const parts = trimmed.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const year = parts[0].slice(-2);
      const monthNum = parseInt(parts[1], 10);
      const day = parts[2].padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = months[monthNum - 1] || parts[1];
      return `${day} ${monthName} ${year}`;
    }
    if (trimmed.includes('/') || (trimmed.includes('-') && trimmed.split('-')[0].length <= 2)) {
      const sep = trimmed.includes('/') ? '/' : '-';
      const p = trimmed.split(sep);
      if (p.length === 3) {
        const day = p[0].padStart(2, '0');
        const monthNum = parseInt(p[1], 10);
        const year = p[2].slice(-2);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = months[monthNum - 1] || p[1];
        return `${day} ${monthName} ${year}`;
      }
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

const getMatrixCellBg = (rowIdx: number, dayNum: number, val?: number) => {
  const isRowAlt = rowIdx % 2 === 1;
  const isColAlt = dayNum % 2 === 0;
  if (val !== undefined && val > 0) {
    if (isRowAlt && isColAlt) return '#bbf7d0'; // emerald-200
    if (isRowAlt) return '#dcfce7'; // emerald-100
    if (isColAlt) return '#d1fae5'; // emerald-100 alt
    return '#ecfdf5'; // emerald-50
  }
  if (isRowAlt && isColAlt) return '#e2e8f0'; // row alt + col alt
  if (isRowAlt) return '#f1f5f9'; // row alt
  if (isColAlt) return '#f8fafc'; // col alt
  return '#ffffff'; // base
};

export function getEligibleRankDisplay(t: DutyRatioTable): string {
  const ranks = t.eligibleRanks || (t.dutyCode ? DUTY_TYPE_MAP.get(t.dutyCode as any)?.eligibleRanks : undefined);
  if (ranks && ranks.length > 0) {
    if (!ranks.includes('Sgt' as any) && (ranks.includes('Cpl' as any) || ranks.includes('LAC' as any))) {
      return 'Cpl & Below';
    }
    if (ranks.includes('Sgt' as any) && !ranks.includes('WO' as any) && !ranks.includes('MWO' as any)) {
      return 'Sgt & Below';
    }
    if (ranks.includes('MWO' as any) || ranks.includes('WO' as any)) {
      return 'All Ranks';
    }
    return ranks[0] + ' & Below';
  }
  return t.id === 'security_duty' ? 'Cpl & Below' : 'Sgt & Below';
}

export function getEligibleFlightDisplay(t: DutyRatioTable): string {
  const flts = t.eligibleFlights || (t.dutyCode ? DUTY_TYPE_MAP.get(t.dutyCode as any)?.eligibleFlights : undefined);
  if (!flts || flts.length === 0) return 'All Flt';
  const all: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
  if (all.every(f => flts.includes(f))) {
    return 'All Flt';
  }
  return flts.map(f => {
    if (f === 'Mechanics') return 'Mech';
    if (f === 'Avionics') return 'Avi';
    return f;
  }).join(', ');
}

interface PrintableDutyRatioModalProps {
  matrix: DutyRatioTable[];
  selectedFlightFilter: FlightName | 'Overall';
  onClose: () => void;
  exportMode?: 'ALL' | 'DUTY_RATIO_ONLY' | 'MANPOWER_ONLY';
  targetDate?: string;
}

export const PrintableDutyRatioModal: React.FC<PrintableDutyRatioModalProps> = ({
  matrix,
  selectedFlightFilter,
  onClose,
  exportMode = 'ALL',
  targetDate,
}) => {
  const daysArray = Array.from({ length: 31 }, (_, i) => i + 1);

  const [currentFlightFilter, setCurrentFlightFilter] = useState<FlightName | 'Overall'>(
    selectedFlightFilter || 'Overall'
  );

  useEffect(() => {
    setCurrentFlightFilter(selectedFlightFilter || 'Overall');
  }, [selectedFlightFilter]);

  const isFlightFiltered = Boolean(currentFlightFilter && currentFlightFilter !== 'Overall');

  // Section inclusion filter states
  const [showDutyRatio, setShowDutyRatio] = useState<boolean>(exportMode !== 'MANPOWER_ONLY');
  const [showManpower, setShowManpower] = useState<boolean>(exportMode === 'ALL' || exportMode === 'MANPOWER_ONLY');
  const [showDistribution, setShowDistribution] = useState<boolean>(exportMode === 'ALL');
  const [showTotalDuty, setShowTotalDuty] = useState<boolean>(exportMode === 'ALL');
  const [showNominalRoll, setShowNominalRoll] = useState<boolean>(exportMode === 'MANPOWER_ONLY');

  // Sync if exportMode prop changes externally
  useEffect(() => {
    if (exportMode === 'DUTY_RATIO_ONLY') {
      setShowDutyRatio(true);
      setShowManpower(false);
      setShowDistribution(false);
      setShowTotalDuty(false);
      setShowNominalRoll(false);
    } else if (exportMode === 'MANPOWER_ONLY') {
      setShowDutyRatio(false);
      setShowManpower(true);
      setShowDistribution(false);
      setShowTotalDuty(false);
      setShowNominalRoll(true);
    } else {
      setShowDutyRatio(true);
      setShowManpower(true);
      setShowDistribution(true);
      setShowTotalDuty(true);
      setShowNominalRoll(false);
    }
  }, [exportMode]);

  // Active preset computation
  const activePreset = useMemo(() => {
    if (showDutyRatio && !showManpower && !showDistribution && !showTotalDuty && !showNominalRoll) {
      return 'DUTY_RATIO';
    }
    if (!showDutyRatio && showManpower && !showDistribution && !showTotalDuty && showNominalRoll) {
      return 'MANPOWER';
    }
    if (showDutyRatio && showManpower && showDistribution && showTotalDuty && !showNominalRoll) {
      return 'ALL';
    }
    return 'CUSTOM';
  }, [showDutyRatio, showManpower, showDistribution, showTotalDuty, showNominalRoll]);

  const applyPreset = (preset: 'ALL' | 'DUTY_RATIO' | 'MANPOWER') => {
    if (preset === 'ALL') {
      setShowDutyRatio(true);
      setShowManpower(true);
      setShowDistribution(true);
      setShowTotalDuty(true);
      setShowNominalRoll(false);
    } else if (preset === 'DUTY_RATIO') {
      setShowDutyRatio(true);
      setShowManpower(false);
      setShowDistribution(false);
      setShowTotalDuty(false);
      setShowNominalRoll(false);
    } else if (preset === 'MANPOWER') {
      setShowDutyRatio(false);
      setShowManpower(true);
      setShowDistribution(false);
      setShowTotalDuty(false);
      setShowNominalRoll(true);
    }
  };

  const flightMonthTotal = useMemo(() => {
    if (!isFlightFiltered) return 0;
    return matrix
      .filter(t => !t.isDisabled)
      .reduce((total, table) => {
        const rowData = table.data[currentFlightFilter as FlightName] || [];
        return total + rowData.reduce((a, b) => a + b, 0);
      }, 0);
  }, [matrix, currentFlightFilter, isFlightFiltered]);

  const getPageMainTitle = () => {
    if (isFlightFiltered) {
      return `OFFICIAL ${currentFlightFilter.toUpperCase()} DUTY SCHEDULE`;
    }
    if (showDutyRatio && !showManpower && !showDistribution && !showTotalDuty) {
      return 'OFFICIAL DUTY RATIO MATRIX';
    }
    if (!showDutyRatio && (showManpower || showNominalRoll) && !showDistribution) {
      return 'OFFICIAL EFFECTIVE MANPOWER & NOMINAL ROLL';
    }
    if (showDutyRatio && showDistribution && !showManpower) {
      return 'OFFICIAL DUTY RATIO & DISTRIBUTION MATRIX';
    }
    return 'ALL DUTIES & DUTY RATIO';
  };

  const getPdfTitle = () => {
    const formattedDt = formatDisplayDate(targetDate).replace(/\s+/g, '_');
    if (isFlightFiltered) {
      return `${currentFlightFilter}_Duty_Schedule_${formattedDt || 'Schedule'}.pdf`;
    }
    if (activePreset === 'DUTY_RATIO') return `Duty_Ratio_Matrix_${formattedDt}.pdf`;
    if (activePreset === 'MANPOWER') return `Effective_Manpower_Nominal_Roll_${formattedDt}.pdf`;
    return `Duty_Ratio_Report_${formattedDt}.pdf`;
  };

  const handlePrint = () => {
    document.title = getPdfTitle();
    setTimeout(() => {
      window.print();
    }, 100);
  };
  
  // Get manpower from local storage as calculated by the main view
  const currentManpowerStr = localStorage.getItem('baf_duty_distribution_manpower');
  const currentManpower = currentManpowerStr ? JSON.parse(currentManpowerStr) : {
    mechSgt: 5, mechCpl: 6,
    aviSgt: 4, aviCpl: 3,
    gcsSgt: 5, gcsCpl: 6,
    adminSgt: 0, adminCpl: 1,
  };
  
  const totalSgt = currentManpower.mechSgt + currentManpower.aviSgt + currentManpower.gcsSgt + currentManpower.adminSgt;
  const totalCpl = currentManpower.mechCpl + currentManpower.aviCpl + currentManpower.gcsCpl + currentManpower.adminCpl;
  const totalSgtAndBelow = totalSgt + totalCpl;

  // Load nominal roll airmen for manpower & nominal roll view
  const nominalRollAirmen = useMemo(() => {
    const allAirmen = localDb.getAirmen().filter(a => a.active);
    const sgtAndBelow = allAirmen.filter(a => !['MWO', 'SWO', 'WO'].includes(a.rank));

    const effectiveDate = targetDate || localStorage.getItem('baf_duty_distribution_target_date') || '';
    const savedDisposalsStr = localStorage.getItem('baf_duty_distribution_disposals_' + (effectiveDate || 'default'));
    const savedDisposals = savedDisposalsStr ? JSON.parse(savedDisposalsStr) : {};

    const assignments = effectiveDate ? (localDb.getRoster(effectiveDate.substring(0, 7)).assignments || []).filter(a => a.date === effectiveDate) : [];

    return sgtAndBelow.map((a, idx) => {
      let defaultDisp = '-';
      const myAssignments = assignments.filter(assign => assign.airmanId === a.id);
      if (myAssignments.some(assign => assign.dutyCode === 'BAKE_N_BITE')) {
        defaultDisp = 'Bake & Bite';
      } else if (myAssignments.some(assign => assign.dutyCode === 'CANTEEN')) {
        defaultDisp = 'Canteen';
      } else if (myAssignments.some(assign => assign.dutyCode === 'TDY')) {
        defaultDisp = 'TDY (Air HQ)';
      } else if (a.rank === 'Sgt' && (a.trade === 'Sec Asst GD' || (a.trade && a.trade.toLowerCase().includes('sec asst')))) {
        defaultDisp = 'Orderly Room';
      } else if (a.rank === 'Sgt' && (a.trade === 'Admin asst' || a.trade === 'Admin Asst' || (a.trade && a.trade.toLowerCase().includes('admin asst')))) {
        defaultDisp = 'UWO';
      }

      let currentDisp = (savedDisposals[a.id] !== undefined && savedDisposals[a.id] !== '') ? savedDisposals[a.id] : defaultDisp;
      if (currentDisp === 'Deployment' || currentDisp === 'Deployment (Bake & Bite)' || currentDisp === 'Deployment (Canteen)') {
        currentDisp = defaultDisp;
      }
      if (currentDisp === 'TDY') {
        currentDisp = 'TDY (Air HQ)';
      }
      if (!currentDisp || currentDisp.trim() === '') {
        currentDisp = '-';
      }

      return {
        id: a.id,
        serNo: idx + 1,
        rank: a.rank,
        name: a.name,
        trade: a.trade,
        flightName: a.flightName,
        disposal: currentDisp,
      };
    });
  }, [targetDate]);

  const calculatedMatrixDistributions = useMemo(() => {
    if (!matrix) return {};
    const result: Record<string, Record<string, { autoVal: number, exactVal: number }>> = {};
    
    // Tracker to balance pure ties across different duty types
    const tieBreakerTracker: Record<string, number> = {
      'Mechanics': 0, 'Avionics': 0, 'GCS': 0, 'Admin': 0
    };
    
    matrix.forEach(t => {
      const includesSgt = t.eligibleRanks ? t.eligibleRanks.includes('Sgt') : t.id !== 'security_duty';
      const isCplOnly = !includesSgt;
      const dutyTotal = t.totalRequiredMonth || 0;
      
      const flights = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
      const flightPools: Record<string, number> = {};
      
      let actualPoolSize = 0;
      flights.forEach(fl => {
        let fltCpl = 0, fltSgt = 0;
        if (fl === 'Mechanics') { fltCpl = currentManpower.mechCpl; fltSgt = currentManpower.mechSgt; }
        if (fl === 'Avionics') { fltCpl = currentManpower.aviCpl; fltSgt = currentManpower.aviSgt; }
        if (fl === 'GCS') { fltCpl = currentManpower.gcsCpl; fltSgt = currentManpower.gcsSgt; }
        if (fl === 'Admin') { fltCpl = currentManpower.adminCpl; fltSgt = currentManpower.adminSgt; }
        
        let fltPool = isCplOnly ? fltCpl : (fltCpl + fltSgt);
        if (t.eligibleFlights && !t.eligibleFlights.includes(fl as any)) {
          fltPool = 0;
        }
        flightPools[fl] = fltPool;
        actualPoolSize += fltPool;
      });

      if (dutyTotal === 0 || actualPoolSize === 0) {
        result[t.id] = flights.reduce((acc, fl) => ({ ...acc, [fl]: { autoVal: 0, exactVal: 0 } }), {});
        return;
      }

      const exactVals = flights.map(fl => {
        const exact = (flightPools[fl] / actualPoolSize) * dutyTotal;
        return {
          flight: fl,
          exact: exact,
          floor: Math.floor(exact),
          remainder: exact - Math.floor(exact)
        };
      });

      const allocated = exactVals.reduce((sum, item) => sum + item.floor, 0);
      const remaining = dutyTotal - allocated;

      const sortedForDistribution = [...exactVals]
        .filter(item => flightPools[item.flight] > 0)
        .sort((a, b) => {
        const diff = b.remainder - a.remainder;
        if (Math.abs(diff) > 1e-9) {
          return diff; // larger remainder first
        }
        const floorDiff = a.floor - b.floor;
        if (floorDiff !== 0) {
          return floorDiff; // tie breaker 1: lower total duty (floor) first
        }
        // tie breaker 2: alternate based on who has received fewer extra tie-breaker duties
        return tieBreakerTracker[a.flight] - tieBreakerTracker[b.flight];
      });

      for (let i = 0; i < remaining && i < sortedForDistribution.length; i++) {
        sortedForDistribution[i].floor += 1;
        // Record allocation to balance future pure ties
        tieBreakerTracker[sortedForDistribution[i].flight] += 1;
      }

      result[t.id] = {};
      exactVals.forEach(item => {
        result[t.id][item.flight] = { autoVal: item.floor, exactVal: item.exact };
      });
    });
    
    return result;
  }, [matrix, currentManpower]);

  const handleExportExcel = () => {
    const formattedDt = formatDisplayDate(targetDate).replace(/\s+/g, '_');
    if (isFlightFiltered) {
      exportFlightDutyScheduleExcel(
        matrix,
        currentFlightFilter,
        formatDisplayDate(targetDate),
        `${currentFlightFilter}_Duty_Schedule_${formattedDt || 'Scale_1_31'}.xlsx`
      );
    } else if (!showDutyRatio && (showManpower || showNominalRoll)) {
      const targetRoll = isFlightFiltered ? nominalRollAirmen.filter(a => a.flightName === currentFlightFilter) : nominalRollAirmen;
      exportManpowerAndNominalRollExcel(
        currentManpower,
        targetRoll,
        `${isFlightFiltered ? currentFlightFilter + '_' : ''}Effective_Manpower_Nominal_Roll_${formattedDt || 'export'}.xlsx`
      );
    } else if (showDutyRatio && !showManpower && !showDistribution) {
      exportDutyRatioMatrixExcel(matrix, `Duty_Ratio_Matrix_Scale_1_31_${formattedDt || 'export'}.xlsx`, undefined, formatDisplayDate(targetDate));
    } else {
      exportDutyRatioMatrixExcel(matrix, `Duty_Ratio_Matrix_Complete_${formattedDt || 'export'}.xlsx`, undefined, formatDisplayDate(targetDate));
    }
  };

  const handleExportDoc = () => {
    const formattedDt = formatDisplayDate(targetDate).replace(/\s+/g, '_');
    const docName = isFlightFiltered
      ? `${currentFlightFilter}_Duty_Schedule_${formattedDt || 'Scale_1_31'}.doc`
      : activePreset === 'DUTY_RATIO'
      ? `Duty_Ratio_Matrix_Scale_1_31_${formattedDt || 'export'}.doc`
      : activePreset === 'MANPOWER'
      ? `Effective_Manpower_Nominal_Roll_${formattedDt || 'export'}.doc`
      : `Duty_Ratio_Matrix_Report_${formattedDt || 'export'}.doc`;
    exportHtmlToWord('print-duty-ratio-content', docName);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 print:bg-white animate-fadeIn overflow-hidden print:static print:h-auto print:w-auto print:overflow-visible print:block text-black" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      
      {/* Top Header Controls (Hidden on Print) */}
      <div className="flex-none bg-slate-900 border-b border-slate-700 px-4 py-3 shadow-2xl print:hidden z-10 sticky top-0 space-y-2.5">
        
        {/* Row 1: Left Title, Presets, Flight Filter, Right Action Buttons */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          
          {/* Title & Close */}
          <div className="flex items-center space-x-3 text-white">
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer text-slate-400 hover:text-white"
              title="Close Print Preview"
            >
              <X className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xs sm:text-sm font-black tracking-wider uppercase text-white">
                {getPageMainTitle()}
              </h1>
              <p className="text-[10px] text-slate-400 font-mono">
                Official Export & Print Preview
              </p>
            </div>
          </div>

          {/* Quick Presets & Flight Filter */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Quick Presets */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700 p-0.5 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider">Mode:</span>
              <button
                type="button"
                onClick={() => applyPreset('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activePreset === 'ALL' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title="Include All Sections (Summary, Manpower, Distribution, Duty Ratio)"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => applyPreset('DUTY_RATIO')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activePreset === 'DUTY_RATIO' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title="Only Duty Ratio Matrices"
              >
                Duty Ratio
              </button>
              <button
                type="button"
                onClick={() => applyPreset('MANPOWER')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activePreset === 'MANPOWER' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title="Only Manpower & Nominal Roll"
              >
                Manpower
              </button>
            </div>

            {/* Flight Filter */}
            <div className="flex items-center bg-slate-800/90 border border-slate-700 p-0.5 rounded-xl">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider">Flight:</span>
              {(['Overall', 'Mechanics', 'Avionics', 'GCS', 'Admin'] as const).map(fl => (
                <button
                  key={fl}
                  type="button"
                  onClick={() => setCurrentFlightFilter(fl)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    currentFlightFilter === fl ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  {fl}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons: Export Excel, Print */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs"
              title="Export to Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-xs shadow-lg shadow-indigo-900/30 transition-all cursor-pointer"
              title="Print or Save as PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Official Export / Print</span>
            </button>
          </div>
        </div>

        {/* Row 2: Section Inclusion Filters (Custom toggles) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center space-x-1.5 text-slate-400 font-bold text-[11px] uppercase tracking-wide mr-1">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span>Include in Print:</span>
          </div>

          <button
            type="button"
            onClick={() => setShowDutyRatio(!showDutyRatio)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              showDutyRatio
                ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-300 opacity-60'
            }`}
            title="Toggle Duty Ratio matrices"
          >
            {showDutyRatio ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5" />}
            <span>Duty Ratio</span>
          </button>

          <button
            type="button"
            onClick={() => setShowManpower(!showManpower)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              showManpower
                ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-300 opacity-60'
            }`}
            title="Toggle Effective Manpower table"
          >
            {showManpower ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5" />}
            <span>Eff Manpower</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDistribution(!showDistribution)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              showDistribution
                ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-300 opacity-60'
            }`}
            title="Toggle Distribution Per Person & Per Flight tables"
          >
            {showDistribution ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5" />}
            <span>Distribution</span>
          </button>

          <button
            type="button"
            onClick={() => setShowTotalDuty(!showTotalDuty)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              showTotalDuty
                ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-300 opacity-60'
            }`}
            title="Toggle Total Duty Summary table"
          >
            {showTotalDuty ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5" />}
            <span>Total Duty Summary</span>
          </button>

          <button
            type="button"
            onClick={() => setShowNominalRoll(!showNominalRoll)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              showNominalRoll
                ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:text-slate-300 opacity-60'
            }`}
            title="Toggle Nominal Roll table"
          >
            {showNominalRoll ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5" />}
            <span>Nominal Roll</span>
          </button>
        </div>
      </div>

      {/* Printable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-auto print:overflow-visible flex justify-start sm:justify-center print:block">
        
        <div id="print-duty-ratio-content" className="w-max sm:w-full max-w-none sm:max-w-[1200px] mx-auto py-4 sm:py-8 px-2 sm:px-8 print:p-0 print:m-0 print:w-full print:max-w-none text-black bg-white">
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 8mm; }
              body { 
                 background: white !important; 
                 color: black !important; 
                -webkit-print-color-adjust: exact !important; 
                 print-color-adjust: exact !important; 
               }
              
              /* Prevent page breaks inside tables and rows */
              table { page-break-inside: avoid !important; break-inside: avoid !important; }
              tr    { page-break-inside: avoid !important; break-inside: avoid !important; }
              thead { display: table-header-group !important; }
              tfoot { display: table-footer-group !important; }
              /* Force elements with these classes to avoid breaking */
              .print\\:break-inside-avoid {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              /* Hide scrollbars during print */
              ::-webkit-scrollbar { display: none; }
              
              /* Hide main app, only show portal */
              #root {
                display: none !important;
              }
            }
          `}</style>

          {/* MAIN DOCUMENT HEADER */}
          <div className="text-center mb-6">
            <h2 className="text-lg font-black underline uppercase">{getPageMainTitle()}</h2>
            <h3 className="text-base font-black uppercase">155 UASU BAF</h3>
            {targetDate && <p className="text-sm sm:text-base font-black text-black mt-1">Date: {formatDisplayDate(targetDate)}</p>}
          </div>

          {/* FLIGHT WISE VIEW (When a flight is filtered: Mechanics, Avionics, GCS, Admin) */}
          {isFlightFiltered && (
            <div className="flex flex-col gap-6">
              
              {/* Consolidated Flight Duty Schedule Table */}
              {showDutyRatio && (
                <div className="mb-4 overflow-x-auto print:overflow-visible" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                  <div className="flex justify-between items-end mb-1">
                    <div className="font-bold underline uppercase text-[13px]">{currentFlightFilter} Duty Schedule</div>
                    <div className="flex border border-black text-[12px]">
                      <div className="px-2 py-0.5 border-r border-black" style={{ backgroundColor: '#ffffff' }}>Month Total</div>
                      <div className="px-4 py-0.5 font-bold" style={{ backgroundColor: '#ffffff' }}>{flightMonthTotal}</div>
                    </div>
                  </div>

                  <table className="no-zebra w-full border-collapse border border-black text-center text-[11px] sm:text-[10px] print:text-[10px] print:min-w-0">
                    <thead>
                      <tr style={{ backgroundColor: '#ffffff' }}>
                        <th className="border border-black font-bold p-1 w-44 text-center" style={{ backgroundColor: '#f1f5f9' }}>Duty Name / Date</th>
                        {daysArray.map(d => (
                          <th key={d} className="border border-black font-bold p-1 w-6 text-center" style={{ backgroundColor: d % 2 === 0 ? '#e2e8f0' : '#f1f5f9' }}>{d}</th>
                        ))}
                        <th className="border border-black font-bold p-1 w-12 text-center" style={{ backgroundColor: '#e2e8f0' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.filter(t => !t.isDisabled).map((table, rowIdx) => {
                        const rowData = table.data[currentFlightFilter as FlightName] || Array(31).fill(0);
                        const rowSum = rowData.reduce((a, b) => a + b, 0);
                        const dutyTitle = (table.serNo !== undefined ? `${table.serNo}. ` : `${rowIdx + 1}. `) + (table.title || '').replace(/\s*\(\d+\)$/, '').trim();

                        return (
                          <tr key={table.id}>
                            <td className="border border-black font-bold p-1 text-left px-2" style={{ backgroundColor: rowIdx % 2 === 1 ? '#f1f5f9' : '#ffffff' }}>
                              {dutyTitle}
                            </td>
                            {daysArray.map(d => {
                              const dayIdx = d - 1;
                              const val = rowData[dayIdx];
                              return (
                                <td key={dayIdx} className="border border-black p-1 text-center font-semibold" style={{ backgroundColor: getMatrixCellBg(rowIdx, d, val) }}>
                                  {val > 0 ? val : ''}
                                </td>
                              );
                            })}
                            <td className="border border-black p-1 text-center font-bold" style={{ backgroundColor: rowIdx % 2 === 1 ? '#e2e8f0' : '#f1f5f9' }}>
                              {rowSum > 0 ? rowSum : ''}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Daily Total row */}
                      <tr style={{ backgroundColor: '#e2e8f0' }}>
                        <td className="border border-black font-bold p-1 text-center uppercase" style={{ backgroundColor: '#cbd5e1' }}>DAILY TOTAL</td>
                        {daysArray.map(d => {
                          const dayIdx = d - 1;
                          const daySum = matrix.filter(t => !t.isDisabled).reduce((sum, t) => sum + (t.data[currentFlightFilter as FlightName]?.[dayIdx] || 0), 0);
                          return (
                            <td key={dayIdx} className="border border-black p-1 text-center font-bold" style={{ backgroundColor: d % 2 === 0 ? '#cbd5e1' : '#e2e8f0' }}>
                              {daySum > 0 ? daySum : ''}
                            </td>
                          );
                        })}
                        <td className="border border-black p-1 text-center font-bold" style={{ backgroundColor: '#cbd5e1' }}>
                          {flightMonthTotal}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Effective Manpower for this flight */}
              {showManpower && (
                <div className="flex justify-center my-2">
                  <div className="w-full max-w-lg">
                    <h4 className="font-bold underline text-center mb-2">EFFECTIVE MANPOWER</h4>
                    <table className="no-zebra border-collapse border border-black text-center text-[12px] bg-white text-black w-full print:min-w-0">
                      <thead>
                        <tr className="bg-slate-100 print:bg-white">
                          <th className="border border-black p-1.5 w-28">Flight</th>
                          <th className="border border-black p-1.5 w-20">Sgt</th>
                          <th className="border border-black p-1.5 w-28">Cpl & Below</th>
                          <th className="border border-black p-1.5 w-20">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { name: 'Mech', sgt: currentManpower.mechSgt, cpl: currentManpower.mechCpl },
                          { name: 'Avi', sgt: currentManpower.aviSgt, cpl: currentManpower.aviCpl },
                          { name: 'GCS', sgt: currentManpower.gcsSgt, cpl: currentManpower.gcsCpl },
                          { name: 'Admin', sgt: currentManpower.adminSgt, cpl: currentManpower.adminCpl }
                        ].map(row => (
                          <tr key={row.name} className="even:bg-gray-100 print:even:bg-gray-100">
                            <td className="border border-black p-1.5 font-semibold">{row.name}</td>
                            <td className="border border-black p-1.5">{row.sgt}</td>
                            <td className="border border-black p-1.5">{row.cpl}</td>
                            <td className="border border-black p-1.5 font-bold">{row.sgt + row.cpl}</td>
                          </tr>
                        ))}
                        <tr className="font-bold bg-slate-100 print:bg-white">
                          <td className="border border-black p-1.5">Total</td>
                          <td className="border border-black p-1.5">{totalSgt}</td>
                          <td className="border border-black p-1.5">{totalCpl}</td>
                          <td className="border border-black p-1.5">{totalSgtAndBelow}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Nominal Roll filtered for this flight */}
              {showNominalRoll && (
                <div className="w-full my-2">
                  <h4 className="font-bold underline text-center mb-2">
                    NOMINAL ROLL ({currentFlightFilter.toUpperCase()})
                  </h4>
                  <table className="no-zebra border-collapse border border-black text-[12px] bg-white text-black w-full print:min-w-0">
                    <thead>
                      <tr className="bg-slate-100 print:bg-white text-center">
                        <th className="border border-black p-1.5 w-[7%] text-center font-bold">Ser No</th>
                        <th className="border border-black p-1.5 w-[11%] text-center font-bold">Rank</th>
                        <th className="border border-black p-1.5 w-[26%] text-center font-bold">Name</th>
                        <th className="border border-black p-1.5 w-[18%] text-center font-bold">Trade</th>
                        <th className="border border-black p-1.5 w-[18%] text-center font-bold">Flight</th>
                        <th className="border border-black p-1.5 w-[20%] text-center font-bold">Disposal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nominalRollAirmen.filter(a => a.flightName === currentFlightFilter).map((a, idx) => (
                        <tr key={a.id} className="even:bg-gray-100 print:even:bg-gray-100">
                          <td className="border border-black p-1.5 text-center font-normal">{idx + 1}</td>
                          <td className="border border-black p-1.5 text-center font-semibold">{a.rank}</td>
                          <td className="border border-black p-1.5 px-3 text-left font-medium">{a.name}</td>
                          <td className="border border-black p-1.5 px-3 text-left">{a.trade}</td>
                          <td className="border border-black p-1.5 px-3 text-left">{a.flightName}</td>
                          <td className="border border-black p-1.5 px-2 text-center font-normal">{a.disposal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* OVERALL VIEW (When NOT flight filtered) */}
          {!isFlightFiltered && (
            <div className="flex flex-col gap-8 print:gap-4">
              
              {/* TOP SECTION: Total Duty Table & Effective Manpower Table */}
              {(showTotalDuty || showManpower) && (
                <div className="flex flex-col xl:flex-row justify-center items-start gap-8 print:gap-6">
                  
                  {/* TOTAL DUTY Table */}
                  {showTotalDuty && (
                    <div className="w-full max-w-lg mx-auto sm:mx-0">
                      <h4 className="font-bold underline text-center mb-2">TOTAL DUTY</h4>
                      <table className="no-zebra border-collapse border border-black text-center text-[11px] sm:text-[12px] bg-white text-black w-full print:min-w-0">
                        <thead>
                          <tr className="bg-slate-100 print:bg-white text-center">
                            <th className="border border-black p-1.5 text-center font-bold">Duty Name</th>
                            <th className="border border-black p-1.5 text-center font-bold whitespace-nowrap">Eligible Flt</th>
                            <th className="border border-black p-1.5 text-center font-bold whitespace-nowrap">Eligible Rank</th>
                            <th className="border border-black p-1.5 text-center font-bold w-14">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matrix.filter(t => !t.isDisabled).map(t => (
                            <tr key={t.id} className="even:bg-gray-100 print:even:bg-gray-100">
                              <td className="border border-black p-1.5 text-left px-2.5 font-medium">{t.title.split('(')[0].trim()}</td>
                              <td className="border border-black p-1.5 text-center whitespace-nowrap">{getEligibleFlightDisplay(t)}</td>
                              <td className="border border-black p-1.5 text-center whitespace-nowrap">{getEligibleRankDisplay(t)}</td>
                              <td className="border border-black p-1.5 text-center font-bold">{t.totalRequiredMonth}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* EFFECTIVE MANPOWER Table */}
                  {showManpower && (
                    <div className="w-full max-w-md mx-auto sm:mx-0">
                      <h4 className="font-bold underline text-center mb-2">EFFECTIVE MANPOWER</h4>
                      <table className="no-zebra border-collapse border border-black text-center text-[12px] bg-white text-black w-full print:min-w-0">
                        <thead>
                          <tr className="bg-slate-100 print:bg-white">
                            <th className="border border-black p-1.5 w-24">Flight</th>
                            <th className="border border-black p-1.5 w-16">Sgt</th>
                            <th className="border border-black p-1.5 w-24">Cpl & Below</th>
                            <th className="border border-black p-1.5 w-16">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { name: 'Mech', sgt: currentManpower.mechSgt, cpl: currentManpower.mechCpl },
                            { name: 'Avi', sgt: currentManpower.aviSgt, cpl: currentManpower.aviCpl },
                            { name: 'GCS', sgt: currentManpower.gcsSgt, cpl: currentManpower.gcsCpl },
                            { name: 'Admin', sgt: currentManpower.adminSgt, cpl: currentManpower.adminCpl }
                          ].map(row => (
                            <tr key={row.name} className="even:bg-gray-100 print:even:bg-gray-100">
                              <td className="border border-black p-1.5">{row.name}</td>
                              <td className="border border-black p-1.5">{row.sgt}</td>
                              <td className="border border-black p-1.5">{row.cpl}</td>
                              <td className="border border-black p-1.5">{row.sgt + row.cpl}</td>
                            </tr>
                          ))}
                          <tr className="font-bold bg-slate-100 print:bg-white">
                            <td className="border border-black p-1.5">Total</td>
                            <td className="border border-black p-1.5">{totalSgt}</td>
                            <td className="border border-black p-1.5">{totalCpl}</td>
                            <td className="border border-black p-1.5">{totalSgtAndBelow}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* DISTRIBUTION SECTION (Manpower formula & Flight formula) */}
              {showDistribution && (
                <div className="flex flex-col gap-8 print:gap-4">
                  {/* DISTRIBUTION AS PER MANPOWER Table */}
                  <div className="print:mt-2 print:block print:overflow-visible" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                    <h4 className="font-bold underline text-center mb-2">DISTRIBUTION AS PER MANPOWER</h4>
                    <div className="text-center font-bold underline mb-1 text-[11px]">FORMULA</div>
                    <table className="no-zebra border-collapse border border-black text-center text-[12px] bg-white text-black w-full print:min-w-0">
                      <thead>
                        <tr className="bg-slate-100 print:bg-white">
                          <th className="border border-black p-1.5 w-40" rowSpan={2}>DUTY PER PERSON</th>
                          {matrix.filter(t => !t.isDisabled).map(t => (
                            <th key={t.id} className="border border-black p-1">{t.title.split('(')[0].trim()}</th>
                          ))}
                        </tr>
                        <tr className="bg-slate-100 print:bg-white">
                          {matrix.filter(t => !t.isDisabled).map(t => {
                            const includesSgt = t.eligibleRanks ? t.eligibleRanks.includes('Sgt') : t.id !== 'security_duty';
                            const isCplOnly = !includesSgt;
                            return (
                              <td key={t.id} className="border border-black p-1 text-[10px] leading-tight text-gray-800">
                                Total {t.title.split('(')[0].trim()} ÷<br/>
                                Total {isCplOnly ? 'Cpl & Below' : 'Sgt & Below'}
                              </td>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-black p-1.5 font-bold text-center px-2">DUTY PER PERSON</td>
                          {matrix.filter(t => !t.isDisabled).map(t => {
                            const includesSgt = t.eligibleRanks ? t.eligibleRanks.includes('Sgt') : t.id !== 'security_duty';
                            const isCplOnly = !includesSgt;
                            const pool = isCplOnly ? totalCpl : totalSgtAndBelow;
                            return (
                              <td key={t.id} className="border border-black p-1.5 font-bold">
                                {pool > 0 ? (t.totalRequiredMonth / pool).toFixed(2) : '0.00'}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* DISTRIBUTION AS PER FLIGHT Table */}
                  <div className="print:mt-2 print:block print:overflow-visible" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                    <h4 className="font-bold underline text-center mb-2">DISTRIBUTION AS PER FLIGHT</h4>
                    <div className="text-center font-bold underline mb-1 text-[11px]">FORMULA</div>
                    <table className="no-zebra border-collapse border border-black text-center text-[12px] bg-white text-black w-full print:min-w-0">
                      <thead>
                        <tr className="bg-slate-100 print:bg-white">
                          <th className="border border-black p-1.5 w-40" rowSpan={2}>DUTY PER FLIGHT</th>
                          {matrix.filter(t => !t.isDisabled).map(t => (
                            <th key={t.id} className="border border-black p-1">{t.title.split('(')[0].trim()}</th>
                          ))}
                        </tr>
                        <tr className="bg-slate-100 print:bg-white">
                          {matrix.filter(t => !t.isDisabled).map(t => {
                            const includesSgt = t.eligibleRanks ? t.eligibleRanks.includes('Sgt') : t.id !== 'security_duty';
                            const isCplOnly = !includesSgt;
                            return (
                              <td key={`f-${t.id}`} className="border border-black p-1 text-[10px] leading-tight text-gray-800">
                                Per Person {t.title.split('(')[0].trim()} x<br/>
                                Total {isCplOnly ? 'Cpl & Below' : 'Sgt & Below'} of Flight
                              </td>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {['Mechanics', 'Avionics', 'GCS', 'Admin'].map(fl => {
                          const displayFl = fl === 'Mechanics' ? 'MECHANICS FLT' : fl === 'Avionics' ? 'AVIONICS FLT' : fl === 'GCS' ? 'GCS FLT' : 'ADMIN FLT';
                          return (
                            <tr key={fl} className="even:bg-gray-100 print:even:bg-gray-100">
                              <td className="border border-black p-1 text-center px-2 font-bold">{displayFl}</td>
                              {matrix.filter(t => !t.isDisabled).map(t => {
                                const autoVal = calculatedMatrixDistributions[t.id]?.[fl]?.autoVal || 0;
                                return <td key={t.id} className="border border-black p-1">{autoVal}</td>;
                              })}
                            </tr>
                          );
                        })}
                        <tr className="font-bold bg-slate-100 print:bg-white">
                          <td className="border border-black p-1.5 text-center px-2 uppercase">Total Duty</td>
                          {matrix.filter(t => !t.isDisabled).map(t => (
                            <td key={t.id} className="border border-black p-1.5">{t.totalRequiredMonth}</td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {/* DUTY RATIO MATRICES (Scale 1-31 for each duty) */}
              {showDutyRatio && (
                <div className="pt-2">
                  {matrix.filter(t => !t.isDisabled).map((table) => {
                    const cleanTitle = table.title.split('(')[0].trim();
                    
                    const MAX_COLS_PER_PAGE = 31;
                    const daysChunks = [];
                    for (let i = 0; i < 31; i += MAX_COLS_PER_PAGE) {
                      const daysArrayLocal = Array.from({ length: 31 }, (_, idx) => idx + 1);
                      daysChunks.push(daysArrayLocal.slice(i, i + MAX_COLS_PER_PAGE));
                    }

                    return daysChunks.map((chunk, chunkIdx) => {
                      return (
                        <div key={`${table.id}-${chunkIdx}`} className="mb-8 print:mb-4 overflow-x-auto print:overflow-visible" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                          <div className="flex justify-between items-end mb-1">
                            <div className="font-bold underline uppercase text-[13px]">{cleanTitle} {daysChunks.length > 1 ? ` (Part ${chunkIdx + 1})` : ''}</div>
                            <div className="flex border border-black text-[12px]">
                              <div className="px-2 py-0.5 border-r border-black" style={{ backgroundColor: '#ffffff' }}>Total Duty</div>
                              <div className="px-4 py-0.5 font-bold" style={{ backgroundColor: '#ffffff' }}>{table.totalRequiredMonth}</div>
                            </div>
                          </div>
                          
                          <table className="no-zebra w-full border-collapse border border-black text-center text-[11px] sm:text-[10px] print:text-[10px] print:min-w-0">
                            <thead>
                              <tr style={{ backgroundColor: '#ffffff' }}>
                                <th colSpan={2} className="border border-black font-bold p-1 w-20" style={{ backgroundColor: '#f1f5f9' }}>Date</th>
                                {chunk.map(d => (
                                  <th key={d} className="border border-black font-bold p-1 w-6" style={{ backgroundColor: d % 2 === 0 ? '#e2e8f0' : '#f1f5f9' }}>{d}</th>
                                ))}
                                <th className="border border-black font-bold p-1 w-12" style={{ backgroundColor: '#e2e8f0' }}>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {['Mechanics', 'Avionics', 'GCS', 'Admin'].map((fl, i) => {
                                const flName = fl as FlightName;
                                const rowData = table.data[flName] || Array(31).fill(0);
                                const rowSum = rowData.reduce((a, b) => a + b, 0);
                                const displayFl = fl === 'Mechanics' ? 'Mech' : fl === 'Avionics' ? 'AVI' : fl;
                                
                                return (
                                  <tr key={fl}>
                                    <td colSpan={2} className="border border-black font-bold p-1" style={{ backgroundColor: i % 2 === 1 ? '#f1f5f9' : '#ffffff' }}>{displayFl}</td>
                                    {chunk.map(d => {
                                      const dayIdx = d - 1;
                                      const val = rowData[dayIdx];
                                      return (
                                        <td key={dayIdx} className="border border-black p-1 text-center font-semibold" style={{ backgroundColor: getMatrixCellBg(i, d, val) }}>
                                          {val > 0 ? val : ''}
                                        </td>
                                      );
                                    })}
                                    <td className="border border-black p-1 font-bold" style={{ backgroundColor: i % 2 === 1 ? '#e2e8f0' : '#f1f5f9' }}>{rowSum > 0 ? rowSum : ''}</td>
                                  </tr>
                                );
                              })}
                              
                              <tr style={{ backgroundColor: '#e2e8f0' }}>
                                <td rowSpan={2} className="border border-black font-bold p-1 text-center align-middle w-10" style={{ backgroundColor: '#cbd5e1' }}>Daily</td>
                                <td className="border border-black font-bold p-1 w-10" style={{ backgroundColor: '#cbd5e1' }}>Total</td>
                                {chunk.map((d) => {
                                  const i = d - 1;
                                  const sum = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => {
                                    const val = table.data[fl as FlightName]?.[i] || 0;
                                    return acc + val;
                                  }, 0);
                                  return (
                                    <td key={i} className="border border-black p-1 font-bold" style={{ backgroundColor: d % 2 === 0 ? '#cbd5e1' : '#e2e8f0' }}>
                                      {sum > 0 ? sum : ''}
                                    </td>
                                  );
                                })}
                                <td className="border border-black p-1 font-bold" style={{ backgroundColor: '#cbd5e1' }}>
                                  {chunk.reduce((monthAcc, d) => {
                                    const i = d - 1;
                                    const dailySum = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => {
                                      return acc + (table.data[fl as FlightName]?.[i] || 0);
                                    }, 0);
                                    return monthAcc + dailySum;
                                  }, 0)}
                                </td>
                              </tr>
                              <tr style={{ backgroundColor: '#f8fafc' }}>
                                <td className="border border-black font-bold p-1" style={{ backgroundColor: '#f1f5f9' }}>Req.</td>
                                {chunk.map((d) => {
                                  const i = d - 1;
                                  let req = table.dailyRequirements?.[i];
                                  if (req === undefined) {
                                      if (table.totalRequiredDaily && (table.totalRequiredDaily * 31 === table.totalRequiredMonth)) {
                                          req = table.totalRequiredDaily;
                                      } else {
                                          req = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => acc + (table.data[fl as FlightName]?.[i] || 0), 0);
                                      }
                                  }
                                  return (
                                    <td key={i} className="border border-black p-1" style={{ backgroundColor: d % 2 === 0 ? '#e2e8f0' : '#f1f5f9' }}>
                                      {req > 0 ? req : ''}
                                    </td>
                                  );
                                })}
                                <td className="border border-black p-1 font-bold" style={{ backgroundColor: '#e2e8f0' }}>{table.totalRequiredMonth}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      );
                    });
                  })}
                </div>
              )}

              {/* NOMINAL ROLL (if selected in overall view) */}
              {showNominalRoll && (
                <div className="w-full pt-4">
                  <h4 className="font-bold underline text-center mb-2">
                    NOMINAL ROLL
                  </h4>
                  <table className="no-zebra border-collapse border border-black text-[12px] bg-white text-black w-full print:min-w-0">
                    <thead>
                      <tr className="bg-slate-100 print:bg-white text-center">
                        <th className="border border-black p-1.5 w-[7%] text-center font-bold">Ser No</th>
                        <th className="border border-black p-1.5 w-[11%] text-center font-bold">Rank</th>
                        <th className="border border-black p-1.5 w-[26%] text-center font-bold">Name</th>
                        <th className="border border-black p-1.5 w-[18%] text-center font-bold">Trade</th>
                        <th className="border border-black p-1.5 w-[18%] text-center font-bold">Flight</th>
                        <th className="border border-black p-1.5 w-[20%] text-center font-bold">Disposal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nominalRollAirmen.map((a, idx) => (
                        <tr key={a.id} className="even:bg-gray-100 print:even:bg-gray-100">
                          <td className="border border-black p-1.5 text-center font-normal">{idx + 1}</td>
                          <td className="border border-black p-1.5 text-center font-semibold">{a.rank}</td>
                          <td className="border border-black p-1.5 px-3 text-left font-medium">{a.name}</td>
                          <td className="border border-black p-1.5 px-3 text-left">{a.trade}</td>
                          <td className="border border-black p-1.5 px-3 text-left">{a.flightName}</td>
                          <td className="border border-black p-1.5 px-2 text-center font-normal">{a.disposal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          )}

          {/* Empty state if all sections are unchecked */}
          {!showDutyRatio && !showManpower && !showDistribution && !showTotalDuty && !showNominalRoll && (
            <div className="py-20 text-center text-slate-500 font-semibold text-sm">
              No sections selected for print. Please check at least one section in the "Include in Print" bar above.
            </div>
          )}

        </div>
      </div>
    </div>
  , document.body);
};

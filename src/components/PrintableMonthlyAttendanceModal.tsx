import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Airman, DutyAssignment } from '../types';
import { DUTY_TYPE_MAP } from '../data/dutyTypes';
import { resolveAirmanDutyForDate, addAssignmentToMap, calculateDutyStats } from '../data/rosterGenerator';
import { formatRank } from '../utils/rankFormatter';
import { Printer, FileSpreadsheet, X, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  exportMonthlyAttendanceRegisterExcel,
  formatFlightFullName,
  getRankTier,
  getAirmanJoinDateISO,
  getAirmanLeftDateISO,
  isAirmanInUnitForMonth,
} from '../utils/csvExport';

interface PrintableMonthlyAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  airmen: Airman[];
  assignments: DutyAssignment[];
  year: number;
  month: number;
  flightFilter?: string;
}

export const PrintableMonthlyAttendanceModal: React.FC<PrintableMonthlyAttendanceModalProps> = ({
  isOpen,
  onClose,
  airmen,
  assignments,
  year,
  month,
  flightFilter = 'All',
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(year);
  const [selectedMonth, setSelectedMonth] = useState<number>(month);
  const [selectedFlight, setSelectedFlight] = useState<string>(
    flightFilter === 'All' ? 'All' : formatFlightFullName(flightFilter)
  );
  const [selectedRank, setSelectedRank] = useState<string>('All');

  useEffect(() => {
    setSelectedYear(year);
    setSelectedMonth(month);
  }, [year, month]);

  useEffect(() => {
    if (flightFilter && flightFilter !== 'All') {
      setSelectedFlight(formatFlightFullName(flightFilter));
    }
  }, [flightFilter]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const monthName = new Date(selectedYear, selectedMonth - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  const availableRanks = useMemo(() => {
    const rankOrder = ['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LCpl', 'LAC', 'AC-1', 'AC-2', 'AC'];
    const presentRanks = new Set<string>(
      airmen
        .filter((a) => isAirmanInUnitForMonth(a, selectedYear, selectedMonth))
        .map((a) => formatRank(a.rank))
    );
    const ordered = rankOrder.filter((r) => presentRanks.has(r));
    presentRanks.forEach((r) => {
      if (!ordered.includes(r) && r) ordered.push(r);
    });
    return ordered;
  }, [airmen, selectedYear, selectedMonth]);

  // Filter airmen based on:
  // 1. Belonging to unit during selected month/year (joinDate <= monthEnd && leftDate >= monthStart && active status)
  // 2. Selected flight
  // 3. Selected rank (Rank & Below logic)
  const filteredAirmen = useMemo(() => {
    return airmen.filter((a) => {
      if (!isAirmanInUnitForMonth(a, selectedYear, selectedMonth)) {
        return false;
      }
      if (selectedFlight !== 'All') {
        const fltFull = formatFlightFullName(a.flightName);
        if (fltFull !== selectedFlight && a.flightName !== selectedFlight) return false;
      }
      if (selectedRank !== 'All') {
        const selectedTier = getRankTier(selectedRank);
        const airmanTier = getRankTier(a.rank);
        if (airmanTier < selectedTier) return false;
      }
      return true;
    });
  }, [airmen, selectedFlight, selectedRank, selectedYear, selectedMonth]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, DutyAssignment>();
    assignments.forEach((ass) => addAssignmentToMap(map, ass));
    return map;
  }, [assignments]);

  const statsList = useMemo(() => {
    return calculateDutyStats(filteredAirmen, assignments, selectedYear, selectedMonth);
  }, [filteredAirmen, assignments, selectedYear, selectedMonth]);

  const statsMap = useMemo(() => {
    return new Map(statsList.map((s) => [s.airmanId, s]));
  }, [statsList]);

  // Helper to resolve specific duty off (e.g. NTF OFF) or joining date status
  const resolveDutyLabel = (airman: Airman, day: number) => {
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const dateStr = `${monthKey}-${dayStr}`;

    // If airman reported/joined unit after this date, they are NOT in unit yet -> show "-"
    const joinDate = getAirmanJoinDateISO(airman);
    if (joinDate && dateStr < joinDate) {
      return { label: '-', type: 'NOT_JOINED' };
    }
    // If airman left unit before this date -> show "-"
    const leftDate = getAirmanLeftDateISO(airman);
    if (leftDate && dateStr > leftDate) {
      return { label: '-', type: 'LEFT' };
    }

    const ass = resolveAirmanDutyForDate(airman.id, dateStr, assignmentMap);
    const dutyCode = ass?.dutyCode;
    const dutyType = DUTY_TYPE_MAP.get(dutyCode as any);

    if (dutyCode === 'ON_PARADE' || dutyType?.shortName === 'PRD' || dutyType?.shortName === 'P') {
      return { label: 'P', type: 'PRESENT' };
    }

    // Canteen is shortform CTN and counted as present
    if (dutyCode === 'CANTEEN' || (dutyCode as string) === 'CTN' || dutyType?.shortName === 'CTN') {
      return { label: 'CTN', type: 'PRESENT' };
    }

    if (dutyCode === 'DUTY_OFF' || (dutyCode as any) === 'OFF') {
      let offDuty = '';
      if (ass?.notes) {
        const match = ass.notes.match(/\b(NTF|GD|SY|BTF|IDAC|IDA|AIRPORT|APT|AFLD|HALISHAHAR|HAL|ESC|ESCORT)\b/i);
        if (match) offDuty = match[1].toUpperCase();
      }
      if (!offDuty) {
        const yestDate = new Date(selectedYear, selectedMonth - 1, day - 1);
        const yDateStr = `${yestDate.getFullYear()}-${String(yestDate.getMonth() + 1).padStart(2, '0')}-${String(yestDate.getDate()).padStart(2, '0')}`;
        const yestAss = resolveAirmanDutyForDate(airman.id, yDateStr, assignmentMap);
        if (yestAss && yestAss.dutyCode && !['ON_PARADE', 'DUTY_OFF', 'OFF'].includes(yestAss.dutyCode as any)) {
          offDuty = yestAss.dutyCode === 'IDA' ? 'IDAC' : yestAss.dutyCode;
        }
      }
      if (offDuty === 'GD' || offDuty === 'SECURITY') offDuty = 'SY';
      if (offDuty === 'AIRPORT' || offDuty === 'AIRFIELD' || offDuty === 'APT') offDuty = 'AFLD';
      if (offDuty === 'ESCORT') offDuty = 'ESC';
      return { label: offDuty ? `${offDuty}\nOFF` : 'OFF', type: 'OFF' };
    }

    if (dutyCode === 'IDAC' || dutyCode === 'IDA') {
      const s = (ass?.idaShift || '').toLowerCase();
      const shiftCode = s.startsWith('m') ? 'IDAC "A"' : s.startsWith('a') ? 'IDAC "B"' : 'IDAC "C"';
      return { label: shiftCode, type: 'DUTY' };
    }

    if (dutyCode === 'LEAVE') return { label: 'L', type: 'LEAVE' };
    if (dutyCode === 'TDY') return { label: 'TDY', type: 'TDY' };
    if ((dutyCode as any) === 'ESCORT' || (dutyCode as any) === 'ESC' || (dutyCode && String(dutyCode).includes('1794394'))) {
      return { label: 'ESC', type: 'DUTY' };
    }
    if (dutyCode === 'GD' || (dutyCode as any) === 'SECURITY') return { label: 'SY', type: 'DUTY' };
    if (dutyCode === 'AIRPORT' || (dutyCode as any) === 'APT' || (dutyCode as any) === 'AIRFIELD' || (dutyCode as any) === 'AFLD') return { label: 'AFLD', type: 'DUTY' };

    let label = dutyType?.shortName || dutyCode || '-';
    if (label === 'APT' || label === 'AIRPORT' || label === 'AIRFIELD') label = 'AFLD';
    if (label === 'GD') label = 'SY';
    if (label === 'IDAC Nt' || label === 'IDAC NT' || label.includes('IDAC Nt')) label = 'IDAC "C"';
    if (label.includes(' OFF')) {
      label = label.replace(/ OFF/g, '\nOFF');
    }
    if (label.startsWith('APT')) label = label.replace(/^APT/, 'AFLD');
    if (label.startsWith('GD')) label = label.replace(/^GD/, 'SY');
    if (label.includes('IDAC Nt')) label = label.replace(/IDAC Nt/g, 'IDAC "C"');
    return { label, type: 'DUTY' };
  };

  // Present days count for each airman (P and CTN both count as present / On Parade)
  const presentMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredAirmen.forEach((airman) => {
      let pCount = 0;
      daysArray.forEach((day) => {
        const info = resolveDutyLabel(airman, day);
        if (info.label === 'P' || info.label === 'CTN' || info.type === 'PRESENT') pCount++;
      });
      map.set(airman.id, pCount);
    });
    return map;
  }, [filteredAirmen, daysArray, monthKey, assignmentMap]);

  // Duty OFF count for each airman
  const dutyOffMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredAirmen.forEach((airman) => {
      let offCount = 0;
      daysArray.forEach((day) => {
        const info = resolveDutyLabel(airman, day);
        if (info.type === 'OFF' || info.label.includes('OFF')) {
          offCount++;
        }
      });
      map.set(airman.id, offCount);
    });
    return map;
  }, [filteredAirmen, daysArray, monthKey, assignmentMap]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportExcel = () => {
    exportMonthlyAttendanceRegisterExcel(
      airmen,
      assignments,
      selectedYear,
      selectedMonth,
      selectedFlight,
      selectedRank,
      `155_UASU_Attendance_Register_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.xlsx`
    );
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-start p-2 sm:p-5 print:p-0 print:bg-white print:overflow-visible">
      {/* Top action toolbar (hidden on print) */}
      <div className="w-full max-w-[1350px] bg-slate-900 border border-slate-700/80 rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center justify-between gap-3 text-white shadow-2xl shrink-0 print:hidden">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black text-white">
              155 UASU, BAF • Attendance Register Preview
            </h2>
            <p className="text-xs text-slate-300 font-medium">
              {monthName} • {filteredAirmen.length} Airmen displayed
            </p>
          </div>
        </div>

        {/* Filter Controls: Month Navigator with Left/Right Arrows (Pic 2 style) + Flight & Rank */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-800/80 p-1.5 px-3 rounded-xl border border-slate-700">
          <div className="flex items-center space-x-1.5 text-xs text-slate-300">
            <Filter className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-semibold hidden lg:inline">Filters:</span>
          </div>

          {/* Month Navigator with Left/Right Arrows like Pic 2 */}
          <div className="flex items-center bg-slate-900 border border-slate-600 rounded-lg p-0.5 shadow-inner">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2.5 text-xs font-black text-white whitespace-nowrap min-w-[115px] text-center select-none">
              {monthName}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-slate-800 text-slate-300 hover:text-white rounded-md transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Flight Dropdown */}
          <div className="flex items-center space-x-1">
            <label className="text-[11px] text-slate-400 font-medium">Flt:</label>
            <select
              value={selectedFlight}
              onChange={(e) => setSelectedFlight(e.target.value)}
              className="bg-slate-900 text-xs font-bold text-white border border-slate-600 rounded-lg px-2 py-1 outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Flights</option>
              <option value="Admin">Admin</option>
              <option value="Mechanics">Mechanics</option>
              <option value="Avionics">Avionics</option>
              <option value="GCS">GCS</option>
            </select>
          </div>

          {/* Rank Dropdown */}
          <div className="flex items-center space-x-1">
            <label className="text-[11px] text-slate-400 font-medium">Rank:</label>
            <select
              value={selectedRank}
              onChange={(e) => setSelectedRank(e.target.value)}
              className="bg-slate-900 text-xs font-bold text-white border border-slate-600 rounded-lg px-2 py-1 outline-hidden focus:border-emerald-500 cursor-pointer"
            >
              <option value="All">All Ranks</option>
              {availableRanks.map((rk) => (
                <option key={rk} value={rk}>
                  {rk} & Below
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportExcel}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500/50 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
            title="Export to Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-md"
            title="Print or Save as PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer ml-1"
            title="Close Preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable Sheet (Standard clean white document landscape format, A4 fit) */}
      <div className="attendance-register-print w-full max-w-[1400px] bg-white text-slate-900 rounded-xl shadow-2xl p-4 sm:p-6 print:p-0 print:shadow-none print:w-full print:max-w-none print:rounded-none">
        {/* Document Header as requested:
            Heading: 155 UASU, BAF (BOLD)
            Attendance Register
            Month underneath */}
        <div className="text-center pb-2 mb-3 border-b-2 border-slate-900">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-slate-900 print:text-base">
            155 UASU, BAF
          </h1>
          <h2 className="text-base sm:text-lg font-black uppercase underline underline-offset-4 tracking-wide text-slate-900 mt-0.5 print:text-xs">
            ATTENDANCE REGISTER
          </h2>
          <p className="text-sm font-bold text-slate-800 mt-0.5 print:text-[10px]">
            Month: {monthName}
          </p>
        </div>

        {/* Main Attendance Table (Clean styling: no alternating colors, black/gray borders, table-fixed for 1-page fit) */}
        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full border-collapse border border-slate-900 table-fixed text-[9px] print:text-[6px] print:leading-[7px]">
            <colgroup>
              <col style={{ width: '2.2%' }} />
              <col style={{ width: '4.8%' }} />
              <col style={{ width: '3.6%' }} />
              <col style={{ width: '7.4%' }} />
              <col style={{ width: '4.6%' }} />
              {daysArray.map((day) => (
                <col key={day} style={{ width: `${52.4 / daysInMonth}%` }} />
              ))}
              <col style={{ width: '2.8%' }} />
              <col style={{ width: '2.0%' }} />
              <col style={{ width: '2.0%' }} />
              <col style={{ width: '2.0%' }} />
              <col style={{ width: '2.0%' }} />
              <col style={{ width: '2.0%' }} />
              <col style={{ width: '2.2%' }} />
              <col style={{ width: '2.2%' }} />
              <col style={{ width: '2.2%' }} />
              <col style={{ width: '2.7%' }} />
              <col style={{ width: '2.9%' }} />
            </colgroup>
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold border-b-2 border-slate-900 text-center">
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 print:p-0">SER</th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 print:p-0">BD NO</th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 print:p-0">RANK</th>
                <th className="border border-slate-900 py-1 px-1 text-left bg-slate-100 text-slate-900 print:p-0 truncate">NAME</th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 print:p-0">FLT</th>

                {/* Day Columns (No weekend coloring as requested) */}
                {daysArray.map((day) => {
                  const dObj = new Date(selectedYear, selectedMonth - 1, day);
                  const dayOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dObj.getDay()];
                  return (
                    <th
                      key={day}
                      className="border border-slate-900 py-1 px-0 bg-slate-100 text-slate-900 font-bold print:p-0"
                    >
                      <div>{day}</div>
                      <div className="text-[7.5px] print:text-[5px] font-bold text-slate-600">{dayOfWeek}</div>
                    </th>
                  );
                })}

                {/* Summary Right Columns */}
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="On Parade">
                  On Parade
                </th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="Security Duty (SY)">
                  SY
                </th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="Base Taskforce (BTF)">
                  BTF
                </th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="Najirpara Taskforce (NTF)">
                  NTF
                </th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="Halishahar (HAL)">
                  HAL
                </th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="Airfield (AFLD)">
                  AFLD
                </th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="IDAC Shift A">
                  IDAC "A"
                </th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="IDAC Shift B">
                  IDAC "B"
                </th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="IDAC Shift C">
                  IDAC "C"
                </th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="Duty OFF Count">
                  Duty OFF
                </th>
                <th className="border border-slate-900 py-1 px-0.5 bg-slate-100 text-slate-900 font-bold print:p-0 leading-tight" title="Total Duties Performed">
                  Total Duty
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAirmen.map((airman, idx) => {
                const stat = statsMap.get(airman.id);
                const pCount = presentMap.get(airman.id) ?? 0;
                const dutyOffCount = dutyOffMap.get(airman.id) ?? 0;

                return (
                  <tr key={`${airman.id}-${idx}`} className="border-b border-slate-900">
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {idx + 1}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold whitespace-nowrap bg-white text-slate-900 print:p-0">
                      {airman.bdNo}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-bold bg-white text-slate-900 print:p-0">
                      {formatRank(airman.rank)}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-1 font-bold text-left whitespace-nowrap truncate bg-white text-slate-900 print:p-0">
                      {airman.name || airman.fullName}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-bold whitespace-nowrap bg-white text-slate-900 print:p-0">
                      {formatFlightFullName(airman.flightName)}
                    </td>

                    {/* Day Cells (Clean white background, whitespace-pre-line so BTF\nOFF wraps) */}
                    {daysArray.map((day) => {
                      const info = resolveDutyLabel(airman, day);

                      return (
                        <td
                          key={day}
                          className="border border-slate-900 py-0.5 px-0 text-center font-mono font-bold leading-none bg-white text-slate-900 text-[8.5px] print:text-[5.5px] print:leading-[6.5px] whitespace-pre-line print:p-0"
                        >
                          {info.label}
                        </td>
                      );
                    })}

                    {/* Summary Counters */}
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {pCount}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {stat?.totalGD || 0}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {stat?.totalBTF || 0}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {stat?.totalNTF || 0}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {stat?.totalHalishahar || 0}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {stat?.totalAirport || 0}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {stat?.totalIDACMorning || 0}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {stat?.totalIDACAfternoon || 0}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {stat?.totalIDACNight || 0}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {dutyOffCount}
                    </td>
                    <td className="border border-slate-900 py-0.5 px-0.5 text-center font-mono font-bold bg-white text-slate-900 print:p-0">
                      {stat?.totalDutyCount || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>,
    document.body
  );
};

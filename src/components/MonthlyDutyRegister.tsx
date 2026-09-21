import { DateNavigator } from './DateNavigator';
import React, { useState, useEffect, useMemo } from 'react';
import { Airman, DutyAssignment, DutyCategoryCode, FlightName, UserRole, ConflictAlert, IDAShift } from '../types';
import { DUTY_TYPES, DUTY_TYPE_MAP } from '../data/dutyTypes';
import { getDaysInMonth, calculateDutyStats, detectConflicts, resolveAirmanDutyForDate, addAssignmentToMap, getAirmanShortCode } from '../data/rosterGenerator';
import { DutyCellPopover } from './DutyCellPopover';
import { exportTableToCSV } from '../utils/csvExport';
import { getOptimalMinColumnWidth } from '../utils/tableUtils';
import { Download, Calendar, CalendarRange, AlertTriangle, ShieldAlert, ChevronLeft, ChevronRight, Search, Filter, RefreshCw, CheckCircle, X, Plus, Clock, Trash2, FileText, RotateCcw, Sliders, Eye, EyeOff, History } from 'lucide-react';
import { getStoredDutyRatiosForDate } from '../data/dutyRatios';
import { getIdacShiftsForDateAndFlight, getFlightDutyQuotaForDate } from '../data/officialDutyRatioMatrix';
import { FlightDutyRatioModal } from './FlightDutyRatioModal';
import { EntryHistoryModal } from './EntryHistoryModal';
import { getCurrentUserSession } from '../utils/authSession';
import { checkDutyPermission, isDateInPast } from '../utils/dutyPermissions';


const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
interface RestoreItem {
  airmanId: string;
  date: string;
  assignment: DutyAssignment | null;
}

interface LastActionUndo {
  label: string;
  items: RestoreItem[];
}

interface MonthlyDutyRegisterProps {
  airmen: Airman[];
  role: UserRole;
  conflictCount: number;
  setConflictCount: (count: number) => void;
  onViewProfile: (airman: Airman) => void;
}

export const MonthlyDutyRegister: React.FC<MonthlyDutyRegisterProps> = ({
  airmen,
  role,
  conflictCount,
  setConflictCount,
  onViewProfile,
}) => {
  const today = new Date();
  const session = getCurrentUserSession();
  const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'OWNER';
  const isAdmin = role === 'ADMIN';
  const isUser = !isAdmin && !isSuperAdmin;
  const adminFlight = session?.flightName;
  const todayDateStr = new Date().toISOString().split('T')[0];

  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12
  const [isFullYearView, setIsFullYearView] = useState<boolean>(false);
  const [onlyHolidaysFilter, setOnlyHolidaysFilter] = useState<boolean>(false);
  const [customHolidays, setCustomHolidays] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('baf_custom_holidays') || '[]');
    } catch {
      return [];
    }
  });

  const [removedHolidays, setRemovedHolidays] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('baf_removed_holidays') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const syncHolidays = () => {
      try {
        setCustomHolidays(JSON.parse(localStorage.getItem('baf_custom_holidays') || '[]'));
        setRemovedHolidays(JSON.parse(localStorage.getItem('baf_removed_holidays') || '[]'));
      } catch (e) {
        console.error('Failed to sync holidays in MonthlyDutyRegister:', e);
      }
    };
    window.addEventListener('baf_state_updated', syncHolidays);
    return () => window.removeEventListener('baf_state_updated', syncHolidays);
  }, []);

  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [allYearAssignments, setAllYearAssignments] = useState<DutyAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Map assignments by key "airmanId_YYYY-MM-DD"
  const assignmentMap = useMemo(() => {
    const map = new Map<string, DutyAssignment>();
    assignments.forEach((ass) => addAssignmentToMap(map, ass));
    return map;
  }, [assignments]);

  // Toggle Custom Holiday
  const handleToggleHoliday = (dateStr: string) => {
    if (isUser) {
      alert('Regular users have read-only access and cannot modify holidays.');
      return;
    }
    const parts = dateStr.split('-');
    const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const isWeekend = dObj.getDay() === 5 || dObj.getDay() === 6;

    if (isWeekend) {
      if (removedHolidays.includes(dateStr)) {
        const next = removedHolidays.filter(d => d !== dateStr);
        setRemovedHolidays(next);
        localStorage.setItem('baf_removed_holidays', JSON.stringify(next));
      } else {
        const next = [...removedHolidays, dateStr];
        setRemovedHolidays(next);
        localStorage.setItem('baf_removed_holidays', JSON.stringify(next));
      }
    } else {
      if (customHolidays.includes(dateStr)) {
        const next = customHolidays.filter(d => d !== dateStr);
        setCustomHolidays(next);
        localStorage.setItem('baf_custom_holidays', JSON.stringify(next));
      } else {
        const next = [...customHolidays, dateStr];
        setCustomHolidays(next);
        localStorage.setItem('baf_custom_holidays', JSON.stringify(next));
      }
    }
    window.dispatchEvent(new CustomEvent('baf_state_updated'));
  };

  const isHolidayDate = (dateStr: string, dObj: Date) => {
    if (removedHolidays.includes(dateStr)) return false;
    const isWeekend = dObj.getDay() === 5 || dObj.getDay() === 6; // Friday / Saturday in BD
    return isWeekend || customHolidays.includes(dateStr);
  };

  // View Mode: 'DUTY_MATRIX' (Master BAF Duty Register format) or 'AIRMEN_GRID' (Airman View)
  const [viewMode, setViewMode] = useState<'DUTY_MATRIX' | 'AIRMEN_GRID'>('DUTY_MATRIX');

  // Filters
  const [flightFilter, setFlightFilter] = useState<FlightName | 'All'>('All');
  const [search, setSearch] = useState('');
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // BAF Duty Categories list for Master Duty Register Sheet (matching BAF Form)
  const bafDutyCategories: Array<{
    key: string;
    dutyCode: DutyCategoryCode;
    label: string;
    idaShift?: IDAShift;
    badgeBg: string;
  }> = [
    { key: 'GD', dutyCode: 'GD', label: 'Base Security Duty (GD)', badgeBg: 'bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800' },
    { key: 'BTF', dutyCode: 'BTF', label: 'Base Taskforce Duty (BTF)', badgeBg: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800' },
    { key: 'NTF', dutyCode: 'NTF', label: 'Najirpara Taskforce Duty (NTF)', badgeBg: 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800' },
    { key: 'HALISHAHAR', dutyCode: 'HALISHAHAR', label: 'Halishahar Duty', badgeBg: 'bg-cyan-100 text-cyan-900 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-200 dark:border-cyan-800' },
    { key: 'AIRPORT', dutyCode: 'AIRPORT', label: 'Airfield Duty', badgeBg: 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800' },
    { key: 'TDY', dutyCode: 'TDY', label: 'TDY', badgeBg: 'bg-amber-200 text-amber-950 border-amber-400 dark:bg-amber-900 dark:text-amber-100 dark:border-amber-700' },
    { key: 'IDAC_MORNING', dutyCode: 'IDAC', label: 'IDA Center Duty (Morning)', idaShift: 'Morning', badgeBg: 'bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-950 dark:text-sky-200 dark:border-sky-800' },
    { key: 'IDAC_AFTERNOON', dutyCode: 'IDAC', label: 'IDA Center Duty (Afternoon)', idaShift: 'Afternoon', badgeBg: 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800' },
    { key: 'IDAC_NIGHT', dutyCode: 'IDAC', label: 'IDA Center Duty (Night)', idaShift: 'Night', badgeBg: 'bg-indigo-200 text-indigo-950 border-indigo-400 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-800' },
    { key: 'LEAVE', dutyCode: 'LEAVE', label: 'LEAVE', badgeBg: 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800' },
    { key: 'BAKE_N_BITE', dutyCode: 'BAKE_N_BITE', label: 'Bake & Bite', badgeBg: 'bg-orange-200 text-orange-950 border-orange-400 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-800' },
  ];

  const flightsList: FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];

  // Popover State
  const [activeCell, setActiveCell] = useState<{
    airman: Airman;
    date: string;
    assignment?: DutyAssignment;
  } | null>(null);

  const monthKey = `${currentYear}-${currentMonth < 10 ? '0' + currentMonth : currentMonth}`;
  const daysCount = getDaysInMonth(currentYear, currentMonth);
  const daysArray = Array.from({ length: daysCount }, (_, i) => i + 1);

  // Bulk Date Range Assignment state
  const [showBulkAssignModal, setShowBulkAssignModal] = useState<boolean>(false);
  const [bulkFlight, setBulkFlight] = useState<FlightName | 'All'>('All');
  const [bulkDutyCode, setBulkDutyCode] = useState<DutyCategoryCode>('GD');
  const [bulkAirmanId, setBulkAirmanId] = useState<string>('');
  const [bulkIdaShift, setBulkIdaShift] = useState<IDAShift>('Morning');
  const [bulkFromDate, setBulkFromDate] = useState<string>('');
  const [bulkToDate, setBulkToDate] = useState<string>('');
  const [bulkNotes, setBulkNotes] = useState<string>('');
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);
  const [bulkSuccessMsg, setBulkSuccessMsg] = useState<string>('');
  const [onlyOnParadeFilter, setOnlyOnParadeFilter] = useState<boolean>(true);

  // Flight Duty Ratio / Quota States
  const [showRatioModal, setShowRatioModal] = useState<boolean>(false);
  const [ratioRefreshTrigger, setRatioRefreshTrigger] = useState<number>(0);
  const [filterByRatio, setFilterByRatio] = useState<boolean>(true);

  // Listen to global duty ratio updates across views
  useEffect(() => {
    const handleRatioUpdated = () => {
      setRatioRefreshTrigger((prev) => prev + 1);
    };
    window.addEventListener('baf_duty_ratio_updated', handleRatioUpdated);
    return () => {
      window.removeEventListener('baf_duty_ratio_updated', handleRatioUpdated);
    };
  }, []);

  // Keep bulkIdaShift synchronized with available shifts for selected date and flight
  useEffect(() => {
    if (['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(bulkDutyCode as string)) {
      const available = getIdacShiftsForDateAndFlight(
        bulkFromDate,
        bulkFlight !== 'All' ? bulkFlight : undefined
      );
      if (available.length > 0 && !available.includes(bulkIdaShift)) {
        setBulkIdaShift(available[0]);
      }
    }
  }, [bulkFromDate, bulkFlight, bulkDutyCode, ratioRefreshTrigger]);

  // Cell Edit / Reassign Modal for Duty Matrix Sheet View
  const [cellEditModal, setCellEditModal] = useState<{
    flight: FlightName;
    dutyCode: DutyCategoryCode;
    idaShift?: IDAShift;
    dutyLabel: string;
    date: string;
    assignedAirman: Airman | null;
  } | null>(null);
  const [cellEditProxyFlight, setCellEditProxyFlight] = useState<FlightName | ''>('');
  const [selectedReplacementAirmanId, setSelectedReplacementAirmanId] = useState<string>('');
  const [cellEditNotes, setCellEditNotes] = useState<string>('');
  const [cellEditLoading, setCellEditLoading] = useState<boolean>(false);

  // Auto-select current airman or first available airman when cellEditModal opens or proxy flight changes
  useEffect(() => {
    if (!cellEditModal) {
      setCellEditProxyFlight('');
      return;
    }
    const targetFlight = cellEditProxyFlight || cellEditModal.flight;
    if (cellEditModal.assignedAirman && !cellEditProxyFlight && cellEditModal.assignedAirman.flightName === targetFlight) {
      setSelectedReplacementAirmanId(cellEditModal.assignedAirman.id);
    } else {
      const flAirmen = airmen.filter((a) => a.flightName === targetFlight);
      if (flAirmen.length > 0) {
        setSelectedReplacementAirmanId(flAirmen[0].id);
      } else {
        setSelectedReplacementAirmanId('');
      }
    }
    setCellEditNotes('');
  }, [cellEditModal, cellEditProxyFlight]);

  // Helper to get required count (ratio) for a duty code
  const getRequiredCountForDuty = (dutyCode: DutyCategoryCode) => {
    const targetDate = bulkFromDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    const currentRatios = getStoredDutyRatiosForDate(targetDate);
    if (bulkFlight === 'All') {
      return currentRatios
        .filter((r) => r.dutyCode === dutyCode)
        .reduce((sum, r) => sum + r.requiredCount, 0);
    }
    const found = currentRatios.find(
      (r) => r.flight === bulkFlight && r.dutyCode === dutyCode
    );
    return found ? found.requiredCount : 0;
  };

  // Helper to calculate how many airmen are assigned to a duty on bulkFromDate
  const getAssignedCountForDuty = (dutyCode: DutyCategoryCode) => {
    const targetDate = bulkFromDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    let count = 0;
    airmen.forEach((a) => {
      if (bulkFlight !== 'All' && a.flightName !== bulkFlight) return;
      const ass = assignmentMap.get(`${a.id}_${targetDate}`);
      if (ass && ass.dutyCode === dutyCode) {
        count++;
      }
    });
    return count;
  };

  // Auto select valid duty if filterByRatio is enabled and bulkFlight changes
  useEffect(() => {
    if (!showBulkAssignModal) return;
    const req = getRequiredCountForDuty(bulkDutyCode);
    if (filterByRatio && req === 0) {
      const firstReq = DUTY_TYPES.find(
        (dt) => dt.code !== 'ON_PARADE' && getRequiredCountForDuty(dt.code) > 0
      );
      if (firstReq) {
        setBulkDutyCode(firstReq.code);
      }
    }
  }, [bulkFlight, bulkFromDate, ratioRefreshTrigger, filterByRatio, showBulkAssignModal]);

  // Helper to check airman availability for date range
  const getAirmanAvailabilityForRange = (airmanId: string, fromDate?: string, toDate?: string) => {
    if (!fromDate || !toDate) {
      return { status: 'ON_PARADE', dutyName: 'On Parade' };
    }
    const start = new Date(fromDate);
    const end = new Date(toDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return { status: 'ON_PARADE', dutyName: 'On Parade' };
    }

    let foundLeave = false;
    let foundTdy = false;
    let foundDutyCode: string | null = null;

    const current = new Date(start);
    while (current <= end) {
      const dStr = current.toISOString().split('T')[0];
      const ass = assignmentMap.get(`${airmanId}_${dStr}`);
      if (ass && ass.dutyCode) {
        if ((ass.dutyCode as string) === 'LEAVE' || (ass.dutyCode as string) === 'CASUAL_LEAVE' || (ass.dutyCode as string) === 'PRIVILEGE_LEAVE') {
          foundLeave = true;
        } else if (ass.dutyCode === 'TDY') {
          foundTdy = true;
        } else if (ass.dutyCode !== 'ON_PARADE') {
          foundDutyCode = ass.dutyCode;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    if (foundLeave) return { status: 'LEAVE', dutyName: 'On Leave' };
    if (foundTdy) return { status: 'TDY', dutyName: 'On TDY' };
    if (foundDutyCode) {
      const dt = DUTY_TYPE_MAP.get(foundDutyCode as any);
      const isOther = foundDutyCode === 'OTHERS' || foundDutyCode === 'OTHER' || (foundDutyCode as string)?.toUpperCase() === 'OTHER' || (foundDutyCode as string)?.toUpperCase() === 'OTHERS';
      if (isOther) {
        return { status: 'DUTY', dutyName: 'Disposal' };
      }
      return { status: 'DUTY', dutyName: dt ? dt.name : foundDutyCode };
    }
    return { status: 'ON_PARADE', dutyName: 'On Parade' };
  };

  // Filter eligible airmen based on selected Flight and Duty eligibility
  const getEligibleAirmen = () => {
    return airmen.filter((a) => {
      // 1. Flight match
      if (bulkFlight !== 'All' && a.flightName !== bulkFlight) {
        return false;
      }

      // 2. Duty eligibility match
      // Rule: GD (Base Security Duty) is strictly for Cpl & Below (Cpl, LAC, AC1, AC2)
      if (bulkDutyCode === 'GD') {
        const rankLower = a.rank.toLowerCase();
        const isCplOrBelow = ['cpl', 'lac', 'ac1', 'ac2', 'corporal'].some((r) => rankLower.includes(r));
        if (!isCplOrBelow) return false;
      }

      return true;
    }).sort((a, b) => {
      const availA = getAirmanAvailabilityForRange(a.id, bulkFromDate, bulkToDate);
      const availB = getAirmanAvailabilityForRange(b.id, bulkFromDate, bulkToDate);
      const order = { ON_PARADE: 0, DUTY: 1, LEAVE: 2, TDY: 3 };
      return (order[availA.status as keyof typeof order] ?? 4) - (order[availB.status as keyof typeof order] ?? 4);
    });
  };

  const eligibleAirmen = getEligibleAirmen();

  // Auto-sync selected airman to first available when bulkFlight, bulkDutyCode, or date range changes
  useEffect(() => {
    if (!showBulkAssignModal) return;
    const eligible = getEligibleAirmen();
    const available = eligible.find((a) => {
      const st = getAirmanAvailabilityForRange(a.id, bulkFromDate, bulkToDate).status;
      return st !== 'LEAVE' && st !== 'TDY';
    });
    if (available) {
      setBulkAirmanId(available.id);
    } else if (eligible.length > 0) {
      setBulkAirmanId(eligible[0].id);
    } else {
      setBulkAirmanId('');
    }
  }, [bulkFlight, bulkDutyCode, bulkFromDate, bulkToDate, showBulkAssignModal]);

  // Undo action state
  const [lastUndoAction, setLastUndoAction] = useState<LastActionUndo | null>(null);

  const handleOpenBulkModal = (airmanId?: string) => {
    if (airmanId) {
      const selected = airmen.find((a) => a.id === airmanId);
      if (selected) {
        if (isAdmin && adminFlight && selected.flightName !== adminFlight) {
          alert(`As an Admin, you can only assign duties to your own flight (${adminFlight}).`);
          return;
        }
        setBulkFlight(selected.flightName);
        setBulkAirmanId(selected.id);
        const rankLower = selected.rank.toLowerCase();
        const isCplOrBelow = ['cpl', 'lac', 'ac1', 'ac2', 'corporal'].some((r) => rankLower.includes(r));
        if (!isCplOrBelow && bulkDutyCode === 'GD') {
          setBulkDutyCode('BTF');
        }
      }
    } else {
      if (isAdmin && adminFlight) {
        setBulkFlight(adminFlight as FlightName);
        const defaultEligible = airmen.filter((a) => {
          if (a.flightName !== adminFlight) return false;
          const rankLower = a.rank.toLowerCase();
          return ['cpl', 'lac', 'ac1', 'ac2', 'corporal'].some((r) => rankLower.includes(r));
        });
        if (defaultEligible.length > 0) {
          setBulkAirmanId(defaultEligible[0].id);
        } else {
          const fltAirmen = airmen.filter(a => a.flightName === adminFlight);
          if (fltAirmen.length > 0) setBulkAirmanId(fltAirmen[0].id);
        }
      } else {
        setBulkFlight('All');
        const defaultEligible = airmen.filter((a) => {
          const rankLower = a.rank.toLowerCase();
          return ['cpl', 'lac', 'ac1', 'ac2', 'corporal'].some((r) => rankLower.includes(r));
        });
        if (defaultEligible.length > 0) {
          setBulkAirmanId(defaultEligible[0].id);
        } else if (airmen.length > 0) {
          setBulkAirmanId(airmen[0].id);
        }
      }
    }
    const todayStr = new Date().toISOString().split('T')[0];
    let defaultFrom = todayStr.startsWith(monthKey) ? todayStr : `${monthKey}-01`;
    if (isAdmin && defaultFrom < todayStr) {
      defaultFrom = todayStr;
    }
    const defaultTo = defaultFrom;
    setBulkFromDate(defaultFrom);
    setBulkToDate(defaultTo);
    setBulkSuccessMsg('');
    setShowBulkAssignModal(true);
  };

  const handlePresetDays = (days: number) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (days === 0) {
      // Set to Today
      const startToday = todayStr.startsWith(monthKey) ? todayStr : `${monthKey}-01`;
      const finalStart = (isAdmin && startToday < todayStr) ? todayStr : startToday;
      setBulkFromDate(finalStart);
      setBulkToDate(finalStart);
      return;
    }

    const start = bulkFromDate ? new Date(bulkFromDate) : new Date(todayStr);
    if (isNaN(start.getTime())) return;

    if (days === 99) {
      // Full Month
      const year = start.getFullYear();
      const month = start.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const monthStr = String(month + 1).padStart(2, '0');
      const dayStr = String(lastDay).padStart(2, '0');
      setBulkToDate(`${year}-${monthStr}-${dayStr}`);
      return;
    }

    const end = new Date(start);
    end.setDate(end.getDate() + (days - 1));
    const year = end.getFullYear();
    const month = String(end.getMonth() + 1).padStart(2, '0');
    const day = String(end.getDate()).padStart(2, '0');
    setBulkToDate(`${year}-${month}-${day}`);
  };

  const handleBulkAssignRange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkAirmanId || !bulkDutyCode || !bulkFromDate || !bulkToDate) return;

    const selectedAirman = airmen.find((a) => a.id === bulkAirmanId);
    const perm = checkDutyPermission(role, selectedAirman?.flightName, bulkFromDate, adminFlight);
    if (!perm.canAssign) {
      alert(perm.reason || 'You do not have permission to assign duty for this flight or past dates.');
      return;
    }

    setBulkLoading(true);
    setBulkSuccessMsg('');

    // Save previous state for Undo
    const previousItems: RestoreItem[] = [];
    const [fY, fM, fD] = bulkFromDate.split('-').map(Number);
    const [tY, tM, tD] = bulkToDate.split('-').map(Number);

    if (fY && fM && fD && tY && tM && tD) {
      const current = new Date(Date.UTC(fY, fM - 1, fD));
      const end = new Date(Date.UTC(tY, tM - 1, tD));

      while (current <= end) {
        const y = current.getUTCFullYear();
        const m = String(current.getUTCMonth() + 1).padStart(2, '0');
        const d = String(current.getUTCDate()).padStart(2, '0');
        const dStr = `${y}-${m}-${d}`;
        const prevAss = assignmentMap.get(`${bulkAirmanId}_${dStr}`) || null;
        previousItems.push({ airmanId: bulkAirmanId, date: dStr, assignment: prevAss });
        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    try {
      const res = await fetch('/api/roster/assign-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: bulkAirmanId,
          dutyCode: bulkDutyCode,
          idaShift: ['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(bulkDutyCode as string) ? bulkIdaShift : undefined,
          fromDate: bulkFromDate,
          toDate: bulkToDate,
          notes: bulkNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const selectedAirman = airmen.find((a) => a.id === bulkAirmanId);
        const airmanLabel = selectedAirman ? `${formatAirmanName(selectedAirman.rank)} ${selectedAirman.name}` : 'Airman';
        const dutyLabel = DUTY_TYPE_MAP.get(bulkDutyCode)?.name || bulkDutyCode;
        setBulkSuccessMsg(`✓ Assigned ${dutyLabel} to ${airmanLabel} (${bulkFromDate} to ${bulkToDate}).`);
        setLastUndoAction({
          label: `${dutyLabel} assigned to ${airmanLabel} (${bulkFromDate} to ${bulkToDate})`,
          items: previousItems,
        });
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
        await fetchRoster();
      } else {
        alert(data.error || 'Failed to assign duty range');
      }
    } catch (err) {
      console.error('Failed to assign duty range:', err);
      alert('Network error while assigning duty range');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDeleteRange = async () => {
    if (!bulkAirmanId || !bulkFromDate || !bulkToDate) return;
    const selectedAirman = airmen.find((a) => a.id === bulkAirmanId);
    const airmanLabel = selectedAirman ? `${formatAirmanName(selectedAirman.rank)} ${selectedAirman.name}` : 'Airman';

    const perm = checkDutyPermission(role, selectedAirman?.flightName, bulkFromDate, adminFlight);
    if (!perm.canDelete) {
      alert(perm.reason || 'You do not have permission to delete duties for this flight or past dates.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete/clear all duty entries for ${airmanLabel} between ${bulkFromDate} and ${bulkToDate}?`)) {
      return;
    }

    setBulkLoading(true);
    try {
      const start = new Date(bulkFromDate);
      const end = new Date(bulkToDate);
      const previousItems: RestoreItem[] = [];
      const current = new Date(start);
      while (current <= end) {
        const dStr = current.toISOString().split('T')[0];
        const prevAss = assignmentMap.get(`${bulkAirmanId}_${dStr}`) || null;
        previousItems.push({ airmanId: bulkAirmanId, date: dStr, assignment: prevAss });
        current.setDate(current.getDate() + 1);
      }

      const res = await fetch('/api/roster/delete-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ airmanId: bulkAirmanId, fromDate: bulkFromDate, toDate: bulkToDate }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setBulkSuccessMsg(`🗑️ Cleared duty entries for ${airmanLabel} (${bulkFromDate} to ${bulkToDate}).`);
        setLastUndoAction({
          label: `Cleared duty range for ${airmanLabel} (${bulkFromDate} to ${bulkToDate})`,
          items: previousItems,
        });
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
        await fetchRoster();
      } else {
        alert(data.error || 'Failed to clear range');
      }
    } catch (err) {
      console.error('Failed to clear duty range:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleUndoLastAction = async () => {
    if (!lastUndoAction || lastUndoAction.items.length === 0) return;
    try {
      const res = await fetch('/api/roster/restore-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoreItems: lastUndoAction.items }),
      });
      if (res.ok) {
        const restoredLabel = lastUndoAction.label;
        setLastUndoAction(null);
        setBulkSuccessMsg(`↩️ Undone: Reverted "${restoredLabel}"`);
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
        await fetchRoster();
      }
    } catch (err) {
      console.error('Failed to restore assignments:', err);
    }
  };

  const fetchRoster = async () => {
    setLoading(true);
    try {
      if (isFullYearView) {
        const res = await fetch(`/api/roster/year?year=${currentYear}`);
        if (res.ok) {
          const data = await res.json();
          setAllYearAssignments(data.assignments || []);
          setAssignments(data.assignments || []);
        }
      } else {
        const res = await fetch(`/api/roster?month=${monthKey}`);
        if (res.ok) {
          const data = await res.json();
          setAssignments(data.assignments || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch roster:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (window.confirm('Are you sure you want to erase ALL duty database assignments? This action will reset all recorded duties to empty so you can input fresh data.')) {
      try {
        const res = await fetch('/api/roster/clear-all', { method: 'POST' });
        if (res.ok) {
          setAssignments([]);
          setAllYearAssignments([]);
          fetchRoster();
          alert('All duty database records have been erased successfully.');
        }
      } catch (err) {
        console.error('Failed to clear duty database:', err);
      }
    }
  };

  useEffect(() => {
    fetchRoster();
    const handleGlobalUpdate = () => {
      fetchRoster();
    };
    window.addEventListener('baf_state_updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('baf_state_updated', handleGlobalUpdate);
    };
  }, [monthKey, currentYear, isFullYearView]);

  // Calculate duty stats & conflicts
  const statsList = calculateDutyStats(
    airmen,
    assignments,
    currentYear,
    isFullYearView ? undefined : currentMonth
  );
  const statsMap = new Map(statsList.map((s) => [s.airmanId, s]));
  const alerts = detectConflicts(airmen, assignments);

  useEffect(() => {
    setConflictCount(alerts.length);
  }, [alerts.length]);

  // Handle month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  // Handle duty assignment save from popover
  const handleAssignDuty = async (code: DutyCategoryCode, idaShift?: IDAShift, notes?: string) => {
    if (!activeCell) return;

    const prevAss = assignmentMap.get(`${activeCell.airman.id}_${activeCell.date}`) || null;
    const assignment: DutyAssignment = {
      airmanId: activeCell.airman.id,
      date: activeCell.date,
      dutyCode: code,
      idaShift,
      notes,
    };

    try {
      const res = await fetch('/api/roster/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, assignment }),
      });

      if (res.ok) {
        // Update local state
        setAssignments((prev) => {
          const filtered = prev.filter((a) => !(a.airmanId === assignment.airmanId && a.date === assignment.date));
          return [...filtered, assignment];
        });
        const dutyLabel = DUTY_TYPE_MAP.get(code)?.name || code;
        setLastUndoAction({
          label: `${dutyLabel} assigned to ${activeCell.airman.name} (${activeCell.date})`,
          items: [{ airmanId: activeCell.airman.id, date: activeCell.date, assignment: prevAss }],
        });
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
      }
    } catch (err) {
      console.error('Failed to assign duty:', err);
    }
  };

  const handleDeleteSingleDuty = async () => {
    if (!activeCell) return;
    const prevAss = assignmentMap.get(`${activeCell.airman.id}_${activeCell.date}`) || null;
    try {
      const res = await fetch('/api/roster/delete-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ airmanId: activeCell.airman.id, date: activeCell.date, dutyCode: activeCell.assignment?.dutyCode }),
      });
      if (res.ok) {
        setAssignments((prev) => prev.filter((a) => !(a.airmanId === activeCell.airman.id && a.date === activeCell.date && a.dutyCode === activeCell.assignment?.dutyCode)));
        setLastUndoAction({
          label: `Deleted duty for ${activeCell.airman.name} (${activeCell.date})`,
          items: [{ airmanId: activeCell.airman.id, date: activeCell.date, assignment: prevAss }],
        });
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
      }
    } catch (err) {
      console.error('Failed to delete assignment:', err);
    }
  };

  // Cell Edit Modal Handlers for Duty Matrix View (Swap / Assign / Delete)
  const handleCellEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cellEditModal || !selectedReplacementAirmanId) return;

    const targetAirman = airmen.find((a) => a.id === selectedReplacementAirmanId);
    const perm = checkDutyPermission(role, targetAirman?.flightName || cellEditModal.flight, cellEditModal.date, adminFlight);
    if (!perm.canAssign) {
      alert(perm.reason || 'You do not have permission to assign duty for this flight or past dates.');
      return;
    }

    setCellEditLoading(true);
    try {
      // 1. If replacing an existing airman, remove his duty for that date first
      if (cellEditModal.assignedAirman && cellEditModal.assignedAirman.id !== selectedReplacementAirmanId) {
        await fetch('/api/roster/delete-assignment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            airmanId: cellEditModal.assignedAirman.id,
            date: cellEditModal.date,
          }),
        });
      }

      // 2. Assign the duty to the new airman
      const assignment: DutyAssignment = {
        airmanId: selectedReplacementAirmanId,
        date: cellEditModal.date,
        dutyCode: cellEditModal.dutyCode,
        idaShift: cellEditModal.idaShift,
        proxyForFlight: cellEditProxyFlight ? cellEditModal.flight : undefined,
        notes: cellEditNotes,
      };

      const res = await fetch('/api/roster/assign', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthKey, assignment }),
      });

      if (res.ok) {
        await fetchRoster();
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
        setCellEditModal(null);
      }
    } catch (err) {
      console.error('Failed to update cell assignment:', err);
    } finally {
      setCellEditLoading(false);
    }
  };

  const handleCellEditDelete = async () => {
    if (!cellEditModal || !cellEditModal.assignedAirman) return;

    const perm = checkDutyPermission(role, cellEditModal.flight, cellEditModal.date, adminFlight);
    if (!perm.canDelete) {
      alert(perm.reason || 'You do not have permission to delete duties for this flight or past dates.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete duty for ${cellEditModal.assignedAirman.rank} ${cellEditModal.assignedAirman.name} on ${cellEditModal.date}?`)) {
      return;
    }

    setCellEditLoading(true);
    try {
      const res = await fetch('/api/roster/delete-assignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: cellEditModal.assignedAirman.id,
          date: cellEditModal.date,
        }),
      });

      if (res.ok) {
        await fetchRoster();
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
        setCellEditModal(null);
      }
    } catch (err) {
      console.error('Failed to delete assignment:', err);
    } finally {
      setCellEditLoading(false);
    }
  };

  // Filter airmen list
  const filteredAirmen = airmen.filter((airman) => {
    const matchesFlight = flightFilter === 'All' || airman.flightName === flightFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      airman.name.toLowerCase().includes(q) ||
      airman.bdNo.toLowerCase().includes(q) ||
      airman.code.toLowerCase().includes(q);

    if (showConflictsOnly) {
      const hasAlert = alerts.some((al) => al.airmanId === airman.id);
      return matchesFlight && matchesSearch && hasAlert;
    }

    return matchesFlight && matchesSearch;
  });

  const monthName = new Date(currentYear, currentMonth - 1, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="duty-register-print space-y-6">
      {/* Top Banner & Month/Year Selector */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row justify-between items-center lg:items-start gap-6">
        
        {/* Left - Title */}
        <div className="flex-1 text-center lg:text-left flex flex-col items-center lg:items-start">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex flex-col sm:flex-row items-center gap-2">
            <span>Monthly Duty Register</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
              {isFullYearView ? `Full Year ${currentYear}` : `1st to ${daysCount}th`}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dynamic Roster Matrix for 155 UASU BAF
          </p>
        </div>

        {/* Center - Calendar & Holiday Controls */}
        <div className="flex-[1.5] flex flex-col items-center justify-center gap-3">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              onClick={handlePrevMonth}
              disabled={isFullYearView}
              className={`p-2 rounded-xl transition-colors ${
                isFullYearView
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs'
              }`}
              title="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="relative px-6 flex items-center justify-center min-w-[200px]">
               <span className="font-black text-lg text-slate-800 dark:text-slate-200 pointer-events-none">
                  {isFullYearView ? 'Full Year (Jan-Dec)' : new Date(currentYear, currentMonth - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })}
               </span>
               <input
                  type="month"
                  value={`${currentYear}-${currentMonth.toString().padStart(2, '0')}`}
                  onChange={(e) => {
                     const val = e.target.value;
                     if(val) {
                        const [y, m] = val.split('-');
                        setCurrentYear(parseInt(y, 10));
                        setCurrentMonth(parseInt(m, 10));
                        setIsFullYearView(false);
                     }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
               />
            </div>

            <button
              onClick={handleNextMonth}
              disabled={isFullYearView}
              className={`p-2 rounded-xl transition-colors ${
                isFullYearView
                  ? 'opacity-30 cursor-not-allowed'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-xs'
              }`}
              title="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsFullYearView(!isFullYearView)}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                isFullYearView
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100'
              }`}
              title="Toggle Full Year View"
            >
              <span>{isFullYearView ? '⭐ Full Year' : '⭐ Full Year'}</span>
            </button>
            <button
              onClick={() => setOnlyHolidaysFilter(!onlyHolidaysFilter)}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                onlyHolidaysFilter
                  ? 'bg-amber-600 text-white border-amber-700 shadow-sm'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-100'
              }`}
              title="Filter to show only Friday/Saturday and designated official holidays"
            >
              <span>{onlyHolidaysFilter ? '🏖️ Holidays Only' : '📅 All Days'}</span>
            </button>
          </div>
        </div>

        {/* Right - Action Buttons */}
        <div className="flex-1 flex flex-wrap justify-center lg:justify-end gap-2 mt-4 lg:mt-0">
          {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
            <div className="flex flex-wrap justify-center lg:justify-end gap-2">
              <button
                onClick={() => exportTableToCSV('duty-register-container', `Duty_Register_${currentYear}_${currentMonth}.csv`)}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all active:scale-95"
                title="Export current view to CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden xl:inline">Export</span>
              </button>

              <button
                onClick={() => setShowHistoryModal(true)}
                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 shadow-xs transition-all active:scale-95"
                title="View Last 10 Entries, revert wrong entries, or edit"
              >
                <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden xl:inline">History</span>
              </button>

              <button
                onClick={() => handleOpenBulkModal()}
                className="flex items-center space-x-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95"
              >
                <CalendarRange className="w-4 h-4" />
                <span className="hidden xl:inline">Assign</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Undo Last Action Banner */}
      {lastUndoAction && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs animate-fadeIn">
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-900 dark:text-amber-200">
            <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>Last Entry / Last Action: <span className="underline">{lastUndoAction.label}</span></span>
          </div>
          <button
            onClick={handleUndoLastAction}
            className="px-3.5 py-1.5 text-xs font-extrabold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 rounded-lg shadow-xs transition-all flex items-center justify-center space-x-1.5 shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>↩️ Undo / Revert</span>
          </button>
        </div>
      )}

      {/* Conflict / Rule Alert Banner */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
                Smart Duty Conflict Rule Alerts ({alerts.length} Warnings)
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-400 mt-0.5">
                System detected consecutive heavy security duties or shift overlaps in current schedule.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowConflictsOnly(!showConflictsOnly)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
              showConflictsOnly
                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                : 'bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-700'
            }`}
          >
            {showConflictsOnly ? 'Show All Airmen' : 'Filter Conflict Airmen Only'}
          </button>
        </div>
      )}

      {/* View Switcher Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-xs gap-3">
        <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setViewMode('DUTY_MATRIX')}
            className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all w-1/2 sm:w-auto ${
              viewMode === 'DUTY_MATRIX'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Master BAF Register (Duty Sheet View)</span>
          </button>
          <button
            onClick={() => setViewMode('AIRMEN_GRID')}
            className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition-all w-1/2 sm:w-auto ${
              viewMode === 'AIRMEN_GRID'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Personnel Roster (Airman View)</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium hidden md:block">
          {viewMode === 'DUTY_MATRIX' ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Official BAF 155 UASU Duty Register Matrix (Duty & Flight x 1..31 Days)</span>
            </span>
          ) : (
            <span>Individual Airman Duty Timeline Grid (Airmen x 1..31 Days)</span>
          )}
        </div>
      </div>

      {/* Search & Flight Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder={viewMode === 'DUTY_MATRIX' ? 'Search Short Code or Airman...' : 'Search Name or BD No...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs">
            <span className="text-slate-400 font-medium">Flight:</span>
            <select
              value={flightFilter}
              onChange={(e) => setFlightFilter(e.target.value as any)}
              className="bg-transparent font-bold outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
            >
              {['All', 'Avionics', 'Mechanics', 'GCS', 'Admin'].map((fl) => (
                <option key={fl} value={fl} className="bg-white dark:bg-slate-900">
                  {fl}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-slate-500 font-medium hidden md:flex items-center space-x-3">
            {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? (
              <>
                <button
                  onClick={() => handleOpenBulkModal()}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                >
                  <CalendarRange className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Bulk Assign (Leave/TDY)</span>
                </button>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  * Auto Duty Register (Auto Duty Off & On Parade)
                </span>
              </>
            ) : (
              <span>* Read-Only Airman View</span>
            )}
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            <p className="text-xs">Loading Roster Matrix...</p>
          </div>
        ) : viewMode === 'DUTY_MATRIX' ? (
          /* BAF MASTER DUTY REGISTER SHEET VIEW (Matching PDF Format) */
          <div className="overflow-x-auto max-h-[680px]">
            {/* Document Title Header */}
            <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-800 gap-2">
              <div>
                <h2 className="text-base font-black tracking-wider text-amber-400 uppercase">
                  Duty Register : 155 UASU BAF
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  MONTH: <span className="font-bold text-white uppercase">{isFullYearView ? 'FULL YEAR (JAN - DEC)' : monthName}</span> | YEAR: <span className="font-bold text-white">{currentYear}</span> | Period: {isFullYearView ? `01 Jan ${currentYear} To 31 Dec ${currentYear}` : `01 ${monthName.substring(0, 3)} ${String(currentYear).slice(2)} To ${daysCount < 10 ? '0' + daysCount : daysCount} ${monthName.substring(0, 3)} ${String(currentYear).slice(2)}`}
                </p>
              </div>
              <div className="text-right text-[10px] text-slate-400 font-mono hidden sm:block">
                <div className="text-emerald-400 font-bold">155 UASU OFFICIAL REGISTER</div>
                <div>CONFIDENTIAL / BAF UNITS</div>
              </div>
            </div>

            <table className="w-full text-center border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3 w-48 sticky left-0 z-30 bg-slate-900 border-r border-slate-800 text-center">
                    Duty Name
                  </th>
                  <th className="py-2.5 px-2 w-24 sticky left-48 z-30 bg-slate-900 border-r border-slate-800 text-center">
                    Flight
                  </th>

                  {daysArray
                    .filter((day) => {
                      if (!onlyHolidaysFilter) return true;
                      const dObj = new Date(currentYear, currentMonth - 1, day);
                      const dayStr = day < 10 ? `0${day}` : `${day}`;
                      const dateStr = `${monthKey}-${dayStr}`;
                      return isHolidayDate(dateStr, dObj);
                    })
                    .map((day) => {
                      const dObj = new Date(currentYear, currentMonth - 1, day);
                      const dayStr = day < 10 ? `0${day}` : `${day}`;
                      const dateStr = `${monthKey}-${dayStr}`;
                      const isHoliday = isHolidayDate(dateStr, dObj);

                      return (
                        <th
                          key={day}
                          className={`py-2 px-1 text-center min-w-9 border-r border-slate-800 font-mono text-[10px] ${
                            isHoliday ? 'bg-amber-950/80 text-amber-300 border-amber-900' : ''
                          }`}
                        >
                          <div className="flex items-center justify-center space-x-0.5">
                            <span>{day < 10 ? `0${day}` : day}</span>
                            {isHoliday && <span className="text-[8px] text-amber-400 font-black">★</span>}
                          </div>
                          <div className="text-[9px] text-slate-400 font-sans">
                            {dObj.toLocaleDateString('en-US', { weekday: 'narrow' })}
                          </div>
                        </th>
                      );
                    })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                {(() => {
                  const activeFlights = flightFilter === 'All' ? flightsList : [flightFilter];
                  const visibleDays = daysArray.filter((day) => {
                    if (!onlyHolidaysFilter) return true;
                    const dObj = new Date(currentYear, currentMonth - 1, day);
                    const dayStr = day < 10 ? `0${day}` : `${day}`;
                    const dateStr = `${monthKey}-${dayStr}`;
                    return isHolidayDate(dateStr, dObj);
                  });

                  return bafDutyCategories.map((cat) => {
                    return activeFlights.map((fl, flIdx) => {
                      const flightAirmen = airmen.filter((a) => a.flightName === fl);

                      return (
                        <tr
                          key={`${cat.key}-${fl}`}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors group"
                        >
                          {/* Duty Name Column */}
                          {flIdx === 0 && (
                            <td
                              rowSpan={activeFlights.length}
                              className="py-3 px-3 font-bold text-slate-900 dark:text-slate-100 align-top sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-b border-slate-300 dark:border-slate-800"
                            >
                              <div className="flex flex-col space-y-1 sticky top-12 max-w-44">
                                <span className="text-[11px] font-extrabold text-slate-900 dark:text-slate-100">
                                  {cat.label}
                                </span>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border w-max ${cat.badgeBg}`}>
                                  {cat.dutyCode} {cat.idaShift ? `(${cat.idaShift})` : ''}
                                </span>
                              </div>
                            </td>
                          )}

                          {/* Flight Name Column */}
                          <td className="py-2.5 px-2 font-bold text-slate-800 dark:text-slate-200 sticky left-48 z-10 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 text-center group-hover:bg-slate-100 dark:group-hover:bg-slate-800">
                            <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black shadow-2xs border ${
                              fl === 'Avionics' ? 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800' :
                              fl === 'Mechanics' ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' :
                              fl === 'GCS' ? 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800' :
                              'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                            }`}>
                              {fl}
                            </span>
                          </td>

                          {/* Date Columns for visible days */}
                          {visibleDays.map((day) => {
                            const dayStr = day < 10 ? `0${day}` : `${day}`;
                            const dateStr = `${monthKey}-${dayStr}`;
                            const quota = getFlightDutyQuotaForDate(dateStr, fl as FlightName, cat.dutyCode, cat.idaShift);

                            // Filter assigned airmen from this flight for this duty & date
                            const assigned = flightAirmen.filter((a) => {
                              if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !a.bdNo.includes(search)) {
                                return false;
                              }
                              const res = resolveAirmanDutyForDate(a.id, dateStr, assignmentMap);
                              if (cat.dutyCode === 'IDAC' || cat.dutyCode === 'IDA') {
                                return (res.dutyCode === 'IDAC' || res.dutyCode === 'IDA') && res.idaShift === cat.idaShift;
                              }
                              return res.dutyCode === cat.dutyCode;
                            });

                            const remainingSlots = Math.max(0, quota - assigned.length);

                            return (
                              <td
                                key={day}
                                className={`p-1 text-center border-r border-slate-200 dark:border-slate-800 min-w-10 align-middle ${
                                  quota > 0 ? 'bg-emerald-50/25 dark:bg-emerald-950/15' : ''
                                }`}
                              >
                                {assigned.length > 0 ? (
                                  <div className="flex flex-wrap items-center justify-center gap-0.5">
                                    {assigned.map((a) => {
                                      const code = getAirmanShortCode(a);
                                      return (
                                        <button
                                          key={a.id}
                                          onClick={() => {
                                            if ((role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER')) {
                                              setCellEditModal({
                                                flight: fl,
                                                dutyCode: cat.dutyCode,
                                                idaShift: cat.idaShift,
                                                dutyLabel: `${cat.label}${cat.idaShift ? ` (${cat.idaShift})` : ''}`,
                                                date: dateStr,
                                                assignedAirman: a,
                                              });
                                            } else {
                                              onViewProfile(a);
                                            }
                                          }}
                                          title={`${formatAirmanName(a.rank)} ${a.name} (${a.bdNo}) - ${fl} Flt. Click to edit/change.`}
                                          className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] tracking-tight shadow-2xs border transition-transform hover:scale-110 active:scale-95 cursor-pointer ${cat.badgeBg}`}
                                        >
                                          {code}
                                        </button>
                                      );
                                    })}
                                    {remainingSlots > 0 && Array.from({ length: remainingSlots }).map((_, sIdx) => (
                                      <button
                                        key={`slot-${sIdx}`}
                                        onClick={() => {
                                          if ((role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER')) {
                                            setCellEditModal({
                                              flight: fl,
                                              dutyCode: cat.dutyCode,
                                              idaShift: cat.idaShift,
                                              dutyLabel: `${cat.label}${cat.idaShift ? ` (${cat.idaShift})` : ''}`,
                                              date: dateStr,
                                              assignedAirman: null,
                                            });
                                          }
                                        }}
                                        title={`${fl} flight has ${quota} duty quota on ${dateStr}. Click to detail another airman.`}
                                        className="px-1 py-0.5 rounded text-[8px] font-bold border border-dashed border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100 transition-all cursor-pointer"
                                      >
                                        + Slot
                                      </button>
                                    ))}
                                  </div>
                                ) : quota > 0 ? (
                                  <div className="flex flex-col items-center justify-center gap-0.5">
                                    {Array.from({ length: quota }).map((_, sIdx) => (
                                      <button
                                        key={`empty-slot-${sIdx}`}
                                        onClick={() => {
                                          if ((role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER')) {
                                            setCellEditModal({
                                              flight: fl,
                                              dutyCode: cat.dutyCode,
                                              idaShift: cat.idaShift,
                                              dutyLabel: `${cat.label}${cat.idaShift ? ` (${cat.idaShift})` : ''}`,
                                              date: dateStr,
                                              assignedAirman: null,
                                            });
                                          }
                                        }}
                                        title={`${fl} flight has ${quota} duty quota on ${dateStr}. Click to detail airman.`}
                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold border border-dashed border-emerald-400 dark:border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer"
                                      >
                                        + Slot {quota > 1 ? `${sIdx + 1}` : ''}
                                      </button>
                                    ))}
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      if ((role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER')) {
                                        setCellEditModal({
                                          flight: fl,
                                          dutyCode: cat.dutyCode,
                                          idaShift: cat.idaShift,
                                          dutyLabel: `${cat.label}${cat.idaShift ? ` (${cat.idaShift})` : ''}`,
                                          date: dateStr,
                                          assignedAirman: null,
                                        });
                                      }
                                    }}
                                    className="w-full text-center text-slate-300 dark:text-slate-700 hover:text-slate-500 dark:hover:text-slate-400 text-[9px] font-mono cursor-pointer py-1"
                                    title="Click to assign duty to this date"
                                  >
                                    -
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    });
                  });
                })()}
              </tbody>
            </table>
          </div>
        ) : (
          /* AIRMEN GRID VIEW (Personal Roster - BD No removed, IDAC Morning/Afternoon/Night separate counters) */
          <div className="overflow-x-auto max-h-[620px]">
            <table className="w-full text-center border-collapse text-xs">
              <thead className="sticky top-0 z-20 bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  {/* Sticky left columns */}
                  <th className="py-3 px-3 w-10 sticky left-0 z-30 bg-slate-900 border-r border-slate-800 text-center">
                    Ser
                  </th>
                  <th className="py-3 px-3 min-w-40 sticky left-10 z-30 bg-slate-900 border-r border-slate-800 text-center">
                    Rank & Name
                  </th>

                  {/* Days columns */}
                  {daysArray
                    .filter((day) => {
                      if (!onlyHolidaysFilter) return true;
                      const dObj = new Date(currentYear, currentMonth - 1, day);
                      const dayStr = day < 10 ? `0${day}` : `${day}`;
                      const dateStr = `${monthKey}-${dayStr}`;
                      return isHolidayDate(dateStr, dObj);
                    })
                    .map((day) => {
                      const dayStr = day < 10 ? `0${day}` : `${day}`;
                      const dateStr = `${monthKey}-${dayStr}`;
                      const dObj = new Date(currentYear, currentMonth - 1, day);
                      const isHoliday = isHolidayDate(dateStr, dObj);

                      return (
                        <th
                          key={day}
                          className={`py-2 px-1 text-center w-9 border-r border-slate-800 font-mono text-[10px] ${
                            isHoliday ? 'bg-amber-950 text-amber-300 border-amber-900' : ''
                          }`}
                        >
                          <div
                            onClick={() => handleToggleHoliday(dateStr)}
                            className="cursor-pointer hover:text-amber-400 transition-colors"
                            title={`Date: ${dateStr}. Click to toggle Custom Holiday.`}
                          >
                            <div className="flex items-center justify-center space-x-0.5">
                              <span>{day}</span>
                              {isHoliday && <span className="text-[8px] text-amber-400">★</span>}
                            </div>
                            <div className="text-[9px] text-slate-400 font-sans">
                              {dObj.toLocaleDateString('en-US', { weekday: 'narrow' })}
                            </div>
                          </div>
                        </th>
                      );
                    })}

                  {/* Auto Counter summary sticky right columns */}
                  <th className="py-3 px-1.5 text-center bg-red-950 text-red-300 w-9 border-l border-slate-800 font-bold" title="Base Security Duty (GD)">
                    GD
                  </th>
                  <th className="py-3 px-1.5 text-center bg-amber-950 text-amber-300 w-9 border-l border-slate-800 font-bold" title="Base Taskforce Duty (BTF)">
                    BTF
                  </th>
                  <th className="py-3 px-1.5 text-center bg-orange-950 text-orange-300 w-9 border-l border-slate-800 font-bold" title="Najirpara Taskforce Duty (NTF)">
                    NTF
                  </th>
                  <th className="py-3 px-1.5 text-center bg-indigo-950 text-indigo-300 w-9 border-l border-slate-800 font-bold" title="Halishahar Taskforce Duty (HAL)">
                    HAL
                  </th>
                  <th className="py-3 px-1.5 text-center bg-blue-950 text-blue-300 w-9 border-l border-slate-800 font-bold" title="Airfield Duty (APT)">
                    APT
                  </th>
                  <th className="py-3 px-1.5 text-center bg-sky-950 text-sky-300 w-9 border-l border-slate-800 font-bold" title="IDAC Morning Duty">
                    I-M
                  </th>
                  <th className="py-3 px-1.5 text-center bg-blue-950 text-blue-300 w-9 border-l border-slate-800 font-bold" title="IDAC Afternoon Duty">
                    I-A
                  </th>
                  <th className="py-3 px-1.5 text-center bg-indigo-950 text-indigo-300 w-9 border-l border-slate-800 font-bold" title="IDAC Night Duty">
                    I-N
                  </th>
                  <th className="py-3 px-1.5 text-center bg-orange-950 text-orange-300 w-9 border-l border-slate-800 font-bold" title="Bake & Bite Duty">
                    BnB
                  </th>
                  <th className="py-3 px-2 text-center bg-emerald-950 text-emerald-300 w-11 border-l border-slate-800 font-bold" title="Total Active Duties">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredAirmen.map((airman) => {
                  const stat = statsMap.get(airman.id);
                  const visibleDays = daysArray.filter((day) => {
                    if (!onlyHolidaysFilter) return true;
                    const dObj = new Date(currentYear, currentMonth - 1, day);
                    const dayStr = day < 10 ? `0${day}` : `${day}`;
                    const dateStr = `${monthKey}-${dayStr}`;
                    return isHolidayDate(dateStr, dObj);
                  });

                  return (
                    <tr
                      key={airman.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                    >
                      {/* Sticky left info */}
                      <td className="py-2.5 px-3 font-mono text-slate-400 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 text-center">
                        {airman.serNo}
                      </td>

                      <td className="py-2.5 px-3 sticky left-10 z-10 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 text-center" style={{ minWidth: getOptimalMinColumnWidth(`${formatAirmanName(airman.rank)} ${airman.name}`, 140, 7.5, 24) }}>
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="font-bold text-[10px] text-slate-600 dark:text-slate-300 shrink-0">
                            {formatAirmanName(airman.rank)}
                          </span>
                          <span
                            onClick={() => onViewProfile(airman)}
                            className="font-bold text-slate-900 dark:text-slate-100 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer truncate"
                          >
                            {airman.name}
                          </span>
                        </div>
                      </td>

                      {/* Day cells */}
                      {visibleDays.map((day) => {
                        const dayStr = day < 10 ? `0${day}` : `${day}`;
                        const dateStr = `${monthKey}-${dayStr}`;
                        const ass = resolveAirmanDutyForDate(airman.id, dateStr, assignmentMap);
                        const dutyCode = ass.dutyCode;
                        const dutyType = DUTY_TYPE_MAP.get(dutyCode as any);

                        const dutyCodeStr = String(dutyCode || '');
                        const isOtherDisposal =
                          dutyCodeStr.toUpperCase() === 'OTHERS' ||
                          dutyCodeStr.toUpperCase() === 'OTHER' ||
                          dutyCodeStr.startsWith('OTHERS_');

                        let displayLabel = '';
                        const displayBadgeBg = dutyType
                          ? `${dutyType.badgeBg} ${dutyType.badgeText}`
                          : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700';

                        if ((dutyCode === 'IDAC' || dutyCode === 'IDA') && ass?.idaShift && ass.idaShift !== 'None') {
                          displayLabel = `I-${ass.idaShift.charAt(0)}`;
                        } else if (isOtherDisposal) {
                          // Resolve specific disposal name (e.g., Course, Exam, Driving, etc.)
                          const cleanNote = ass?.notes?.trim();
                          const fallbackName = (ass as any)?.dutyName || (ass as any)?.customTitle;
                          let name = '';
                          if (cleanNote && !['OTHER', 'OTHERS', 'OTHER DISPOSAL', 'CUSTOM DISPOSAL', 'CUSTOM'].includes(cleanNote.toUpperCase())) {
                            name = cleanNote;
                          } else if (fallbackName && !['OTHER', 'OTHERS', 'OTHER DISPOSAL', 'CUSTOM DISPOSAL', 'CUSTOM'].includes(String(fallbackName).toUpperCase())) {
                            name = String(fallbackName);
                          } else if (typeof dutyCode === 'string' && dutyCode.startsWith('OTHERS_')) {
                            name = dutyCode.replace('OTHERS_', '');
                          } else {
                            name = 'Disposal';
                          }

                          if (name.includes(' - ')) {
                            name = name.split(' - ')[0].trim();
                          }
                          displayLabel = name.toUpperCase();
                        } else if (dutyType) {
                          displayLabel = dutyType.shortName;
                        } else {
                          displayLabel = dutyCode;
                        }

                        const tooltipText = isOtherDisposal
                          ? `${displayLabel}${ass?.notes && ass.notes !== displayLabel ? ` ("${ass.notes}")` : ''}`
                          : `${dutyType?.name || dutyCode}${ass?.idaShift && ass.idaShift !== 'None' ? ` (${ass.idaShift})` : ''} ${ass?.notes ? `("${ass.notes}")` : ''}`;

                        return (
                          <td
                            key={day}
                            className="p-1 text-center border-r border-slate-200 dark:border-slate-800 transition-colors"
                          >
                            <span
                              className={`inline-block min-w-7 px-1 py-1 rounded text-[10px] font-extrabold font-mono text-center shadow-2xs whitespace-nowrap overflow-hidden text-ellipsis ${displayBadgeBg}`}
                              title={tooltipText}
                            >
                              {displayLabel}
                            </span>
                          </td>
                        );
                      })}

                      {/* Auto Duty Counters */}
                      <td className="py-2.5 px-1.5 text-center font-bold font-mono text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 border-l border-slate-200 dark:border-slate-800">
                        {stat?.totalGD || 0}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-bold font-mono text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 border-l border-slate-200 dark:border-slate-800">
                        {stat?.totalBTF || 0}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-bold font-mono text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20 border-l border-slate-200 dark:border-slate-800">
                        {stat?.totalNTF || 0}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-bold font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 border-l border-slate-200 dark:border-slate-800">
                        {stat?.totalHalishahar || 0}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-bold font-mono text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 border-l border-slate-200 dark:border-slate-800">
                        {stat?.totalAirport || 0}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-bold font-mono text-sky-600 dark:text-sky-400 bg-sky-50/50 dark:bg-sky-950/20 border-l border-slate-200 dark:border-slate-800" title="IDAC Morning">
                        {stat?.totalIDACMorning || 0}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-bold font-mono text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 border-l border-slate-200 dark:border-slate-800" title="IDAC Afternoon">
                        {stat?.totalIDACAfternoon || 0}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-bold font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 border-l border-slate-200 dark:border-slate-800" title="IDAC Night">
                        {stat?.totalIDACNight || 0}
                      </td>
                      <td className="py-2.5 px-1.5 text-center font-bold font-mono text-orange-600 dark:text-orange-400 bg-orange-50/50 dark:bg-orange-950/20 border-l border-slate-200 dark:border-slate-800">
                        {stat?.totalBakeNBite || 0}
                      </td>
                      <td className="py-2.5 px-2 text-center font-extrabold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 border-l border-slate-200 dark:border-slate-800">
                        {stat?.totalDutyCount || 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Popover dialog for assigning duty */}
      {activeCell && (
        <DutyCellPopover
          airmanName={`${activeCell.airman.rank} ${activeCell.airman.name}`}
          flightName={activeCell.airman.flight}
          date={activeCell.date}
          currentCode={activeCell.assignment?.dutyCode || 'ON_PARADE'}
          currentIdaShift={activeCell.assignment?.idaShift}
          currentNotes={activeCell.assignment?.notes}
          onSelectDuty={handleAssignDuty}
          onDeleteDuty={handleDeleteSingleDuty}
          onClose={() => setActiveCell(null)}
        />
      )}

      {/* Quick Date-Range Duty Assignment Modal */}
      {showBulkAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 space-y-5 relative overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <CalendarRange className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    Assign Duty Date Range
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select airman & duty (e.g., Leave, TDY) to update across multiple dates at once.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowBulkAssignModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleBulkAssignRange} className="space-y-4">
              {/* 1. Select Flight (Flt) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>1. Select Flight (Flt)</span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {bulkFlight === 'All' ? 'All Unit Flights' : `${bulkFlight} Flight`}
                  </span>
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  <button
                    type="button"
                    disabled={isAdmin && !!adminFlight}
                    onClick={() => setBulkFlight('All')}
                    title={isAdmin && adminFlight ? `Admins can only detail duties for ${adminFlight} flight` : undefined}
                    className={`py-1.5 px-2 text-xs font-bold rounded-xl border text-center transition-all ${
                      isAdmin && adminFlight
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                        : bulkFlight === 'All'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs cursor-pointer'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-400 cursor-pointer'
                    }`}
                  >
                    All Flt
                  </button>
                  {flightsList.map((fl) => {
                    const isFltDisabled = isAdmin && !!adminFlight && fl !== adminFlight;
                    return (
                      <button
                        key={fl}
                        type="button"
                        disabled={isFltDisabled}
                        title={isFltDisabled ? `Admins can only detail duties for ${adminFlight} flight` : undefined}
                        onClick={() => setBulkFlight(fl)}
                        className={`py-1.5 px-1.5 text-xs font-bold rounded-xl border text-center transition-all truncate ${
                          isFltDisabled
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                            : bulkFlight === fl
                            ? fl === 'Avionics'
                              ? 'bg-cyan-600 text-white border-cyan-700 cursor-pointer'
                              : fl === 'Mechanics'
                              ? 'bg-amber-600 text-white border-amber-700 cursor-pointer'
                              : fl === 'GCS'
                              ? 'bg-purple-600 text-white border-purple-700 cursor-pointer'
                              : 'bg-slate-700 text-white border-slate-800 cursor-pointer'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-slate-400 cursor-pointer'
                        }`}
                      >
                        {fl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Select Duty Category (Filtered by Flight Duty Ratio / Quota) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                    <span>2. Select Duty Category</span>
                    {bulkDutyCode === 'GD' && (
                      <span className="text-[10px] font-extrabold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-950/80 px-1.5 py-0.5 rounded border border-red-300 dark:border-red-800">
                        GD: Cpl & Below
                      </span>
                    )}
                  </label>

                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setFilterByRatio(!filterByRatio)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 flex items-center space-x-1"
                      title="Toggle showing only duties required by Flight Ratio vs All duties"
                    >
                      {filterByRatio ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      <span>{filterByRatio ? 'Ratio Only' : 'Show All'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowRatioModal(true)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 flex items-center space-x-1"
                      title="Set / Edit Flight Duty Ratios"
                    >
                      <Sliders className="w-3 h-3" />
                      <span>Ratio Config</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                  {(() => {
                    const allDuties = DUTY_TYPES.filter((dt) => dt.code !== 'ON_PARADE');
                    const ratioFiltered = allDuties.filter((dt) => getRequiredCountForDuty(dt.code) > 0);
                    const dutiesToRender = filterByRatio && ratioFiltered.length > 0 ? ratioFiltered : allDuties;

                    return dutiesToRender.map((dt) => {
                      const isSelected = bulkDutyCode === dt.code;
                      const reqCount = getRequiredCountForDuty(dt.code);
                      const assignedCount = getAssignedCountForDuty(dt.code);

                      return (
                        <button
                          key={dt.code}
                          type="button"
                          onClick={() => setBulkDutyCode(dt.code)}
                          className={`p-2 rounded-xl text-xs font-bold text-left border transition-all flex flex-col justify-between space-y-1 ${
                            isSelected
                              ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-xs bg-emerald-50/50 dark:bg-emerald-950/30'
                              : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${dt.badgeBg} ${dt.badgeText}`}>
                              {dt.shortName}
                            </span>

                            {/* Required Count / Ratio Badge */}
                            {reqCount > 0 ? (
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  assignedCount >= reqCount
                                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                                    : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                                }`}
                              >
                                {reqCount} No.
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-400 font-normal">
                                Optional
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between w-full mt-0.5">
                            <span className="truncate text-[11px] font-bold">{dt.name}</span>
                            {reqCount > 0 && (
                              <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400">
                                {assignedCount}/{reqCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* IDAC Shift Picker (if IDAC / IDA selected) */}
              {(['IDAC', 'IDA', 'IDA C', 'IDA_C', 'IDAC CENTER', 'IDA CENTER'].includes(bulkDutyCode as string)) && (() => {
                const availableShifts = getIdacShiftsForDateAndFlight(
                  bulkFromDate,
                  bulkFlight !== 'All' ? bulkFlight : undefined
                );
                return (
                  <div className="space-y-1.5 bg-teal-50/50 dark:bg-teal-950/30 p-3 rounded-xl border border-teal-200 dark:border-teal-800 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-teal-800 dark:text-teal-300">
                        Select IDAC Shift (Ratio Driven)
                      </label>
                      <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                        {bulkFlight !== 'All' ? `${bulkFlight} Flight` : 'All Flights'}
                      </span>
                    </div>
                    <div className="flex space-x-2">
                      {availableShifts.map((s) => {
                        const quota = getFlightDutyQuotaForDate(
                          bulkFromDate,
                          bulkFlight !== 'All' ? bulkFlight : 'Mechanics',
                          'IDAC',
                          s
                        );
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setBulkIdaShift(s)}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg border text-center transition-all flex items-center justify-center space-x-1.5 ${
                              bulkIdaShift === s
                                ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-teal-400'
                            }`}
                          >
                            <span>{s}</span>
                            {quota > 0 && (
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                                  bulkIdaShift === s
                                    ? 'bg-teal-800 text-teal-100'
                                    : 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-200'
                                }`}
                              >
                                {quota} No.
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 3. Select Airman Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    3. Select Airman Name
                  </label>
                  <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    {eligibleAirmen.length} Personnel Listed
                  </span>
                </div>

                {eligibleAirmen.length > 0 ? (
                  <select
                    value={bulkAirmanId}
                    onChange={(e) => setBulkAirmanId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 cursor-pointer"
                    required
                  >
                    <option value="" disabled className="text-slate-400">
                      -- Select Personnel --
                    </option>
                    {eligibleAirmen.map((a) => {
                      const avail = getAirmanAvailabilityForRange(a.id, bulkFromDate, bulkToDate);
                      const isBlocked = avail.status === 'LEAVE' || avail.status === 'TDY';

                      let disposalText = '';
                      if (avail.status === 'LEAVE') disposalText = 'Leave';
                      else if (avail.status === 'TDY') disposalText = 'TDY';
                      else if (avail.status === 'DUTY') disposalText = avail.dutyName;

                      const flightSuffix = bulkFlight === 'All' ? ` (${a.flightName})` : '';
                      const label = disposalText
                        ? `${formatAirmanName(a.rank)} ${a.name}${flightSuffix} - ${disposalText}`
                        : `${formatAirmanName(a.rank)} ${a.name}${flightSuffix}`;

                      return (
                        <option
                          key={a.id}
                          value={a.id}
                          disabled={isBlocked}
                          className={
                            isBlocked
                              ? 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 font-normal'
                              : 'bg-white dark:bg-slate-900 font-semibold text-slate-900 dark:text-slate-100'
                          }
                        >
                          {label}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-bold">
                    ⚠️ No personnel found in {bulkFlight === 'All' ? 'unit' : `${bulkFlight} flight`} for {DUTY_TYPE_MAP.get(bulkDutyCode)?.name || bulkDutyCode}.
                    {bulkDutyCode === 'GD' && ' (GD is restricted to Cpl & Below personnel).'}
                  </div>
                )}

                {/* Status Warning Banner for Selected Airman */}
                {bulkAirmanId && (() => {
                  const selectedAvail = getAirmanAvailabilityForRange(bulkAirmanId, bulkFromDate, bulkToDate);
                  const selectedA = airmen.find((a) => a.id === bulkAirmanId);
                  if (!selectedA || selectedAvail.status === 'ON_PARADE') return null;

                  return (
                    <div className={`p-3 rounded-xl border text-xs font-bold flex items-start space-x-2 mt-1.5 ${
                      selectedAvail.status === 'LEAVE'
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                        : selectedAvail.status === 'TDY'
                        ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-200 border-cyan-300 dark:border-cyan-800'
                        : 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                    }`}>
                      <span className="text-base shrink-0">
                        {selectedAvail.status === 'LEAVE' ? '🔴' : selectedAvail.status === 'TDY' ? '✈️' : '⚠️'}
                      </span>
                      <div>
                        <div>
                          Notice: {selectedA.rank} {selectedA.name} is currently <strong>{selectedAvail.dutyName}</strong> during this date range.
                        </div>
                        {selectedAvail.status === 'DUTY' && (
                          <p className="text-[11px] font-normal mt-0.5 text-amber-700 dark:text-amber-300">
                            Assigning {DUTY_TYPE_MAP.get(bulkDutyCode)?.name || bulkDutyCode} will overwrite his existing assignment for these dates.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* 4. Date Range & Quick Presets */}
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    4. Select Date Range (From - To Date)
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handlePresetDays(0)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-600 hover:text-white transition-colors"
                      title="Set Date Range to Today only"
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDays(2)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors border border-emerald-300 dark:border-emerald-800"
                    >
                      +2 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDays(3)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors border border-emerald-300 dark:border-emerald-800"
                    >
                      +3 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDays(5)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-600 hover:text-white transition-colors"
                    >
                      +5 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDays(7)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-600 hover:text-white transition-colors"
                    >
                      +7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePresetDays(99)}
                      className="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-emerald-600 hover:text-white transition-colors"
                    >
                      Full Month
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                      From Date:
                    </span>
                    <DateNavigator
                      min={isAdmin ? todayDateStr : undefined}
                      value={bulkFromDate}
                      onChange={(e) => {
                        setBulkFromDate(e.target.value);
                        if (!bulkToDate || bulkToDate < e.target.value) {
                          setBulkToDate(e.target.value);
                        }
                      }}
                      className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 shadow-2xs"
                      required
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                      To Date:
                    </span>
                    <DateNavigator
                      min={bulkFromDate || (isAdmin ? todayDateStr : undefined)}
                      value={bulkToDate}
                      onChange={(e) => setBulkToDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 shadow-2xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Success Notification */}
              {bulkSuccessMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center space-x-2 animate-fadeIn">
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{bulkSuccessMsg}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleBulkDeleteRange}
                    disabled={bulkLoading || (isAdmin && bulkFromDate < todayDateStr)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all flex items-center space-x-1 ${
                      isAdmin && bulkFromDate < todayDateStr
                        ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                        : 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border-rose-300 dark:border-rose-800'
                    }`}
                    title={isAdmin && bulkFromDate < todayDateStr ? 'Admins cannot delete duties for past dates' : 'Delete or clear duty entries for selected airman in this date range'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Range Duty</span>
                  </button>

                  {lastUndoAction && (
                    <button
                      type="button"
                      onClick={handleUndoLastAction}
                      className="px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 rounded-xl border border-amber-300 dark:border-amber-800 transition-all flex items-center space-x-1"
                      title="Undo/Revert last duty assignment"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Undo History</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkAssignModal(false)}
                    className="px-3.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                  >
                    Close
                  </button>

                  <button
                    type="submit"
                    disabled={bulkLoading}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
                  >
                    {bulkLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Updating Range...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Apply Duty Range</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entry History & Undo Modal */}
      {showHistoryModal && (
        <EntryHistoryModal
          airmen={airmen}
          filterType="DUTY"
          onClose={() => setShowHistoryModal(false)}
          onRefreshData={() => {
            fetchRoster();
          }}
        />
      )}

      {/* Flight Duty Ratio Configurator Modal */}
      {showRatioModal && (
        <FlightDutyRatioModal
          airmen={airmen}
          date={bulkFromDate || `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`}
          onClose={() => setShowRatioModal(false)}
          onRatiosUpdated={() => setRatioRefreshTrigger((prev) => prev + 1)}
        />
      )}

      {/* Cell-Level Duty Assignment & Replacement Modal */}
      {cellEditModal && (() => {
        const isCellPast = isDateInPast(cellEditModal.date);
        const isCellWrongFlight = isAdmin && !!adminFlight && cellEditModal.flight !== adminFlight;
        const isCellReadOnly = isUser || (isAdmin && (isCellPast || isCellWrongFlight));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3.5">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                    <span>Duty Assignment & Edit</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    {cellEditModal.flight} Flight • {cellEditModal.date}
                  </p>
                </div>
                <button
                  onClick={() => setCellEditModal(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isCellReadOnly && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-2">
                  <span>🔒</span>
                  <span>
                    {isUser
                      ? 'Read-Only Mode: Regular users cannot modify duties.'
                      : isCellPast
                      ? 'Past Date (Locked): Admins cannot assign or modify duties for past dates.'
                      : `Locked: Admins can only manage duties for their own flight (${adminFlight}).`}
                  </span>
                </div>
              )}

              <form onSubmit={handleCellEditSubmit} className="space-y-4">
                {/* Duty & Flight Badge Info */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Duty & Shift</div>
                    <div className="font-black text-slate-900 dark:text-slate-100 mt-0.5">
                      {cellEditModal.dutyLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Flight Quota</div>
                    <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {getFlightDutyQuotaForDate(cellEditModal.date, cellEditModal.flight, cellEditModal.dutyCode, cellEditModal.idaShift)} Required
                    </div>
                  </div>
                </div>

                {/* Currently Detailed Airman Banner (if any) */}
                {cellEditModal.assignedAirman && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl text-xs">
                    <div className="text-[10px] text-amber-800 dark:text-amber-400 font-bold uppercase tracking-wider">
                      Currently Detailed Personnel
                    </div>
                    <div className="font-black text-slate-900 dark:text-slate-100 mt-1 flex items-center justify-between">
                      <span>
                        {cellEditModal.assignedAirman.rank} {cellEditModal.assignedAirman.name}
                      </span>
                      <span className="font-mono text-[11px] bg-amber-200/70 dark:bg-amber-900/60 px-1.5 py-0.5 rounded text-amber-900 dark:text-amber-200">
                        BD: {cellEditModal.assignedAirman.bdNo}
                      </span>
                    </div>
                  </div>
                )}

                {/* Proxy Flight Selection (Optional) */}
                {!isAdmin && (
                  <div className="space-y-1 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/80">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-amber-900 dark:text-amber-300">
                        Proxy Personnel (Optional)
                      </label>
                      <span className="text-[10px] text-amber-700 dark:text-amber-400">
                        {cellEditProxyFlight ? `Covering by ${cellEditProxyFlight} Flight` : 'Assigned from own flight'}
                      </span>
                    </div>
                    <select
                      disabled={isCellReadOnly}
                      value={cellEditProxyFlight}
                      onChange={(e) => setCellEditProxyFlight(e.target.value as FlightName | '')}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-amber-500 cursor-pointer disabled:opacity-50"
                    >
                      <option value="">No Proxy (Assign from {cellEditModal.flight} Flight)</option>
                      {(['Avionics', 'Mechanics', 'GCS', 'Admin'] as FlightName[])
                        .filter((fl) => fl !== cellEditModal.flight)
                        .map((fl) => (
                          <option key={fl} value={fl}>
                            Proxy from {fl} Flight
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Personnel Selection Dropdown */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {cellEditProxyFlight
                      ? `Select Proxy Airman (from ${cellEditProxyFlight} Flight):`
                      : cellEditModal.assignedAirman
                      ? `Replace Airman (from ${cellEditModal.flight} Flight):`
                      : `Select Airman (from ${cellEditModal.flight} Flight):`}
                  </label>
                  <select
                    disabled={isCellReadOnly}
                    value={selectedReplacementAirmanId}
                    onChange={(e) => setSelectedReplacementAirmanId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 shadow-2xs cursor-pointer disabled:opacity-50"
                    required
                  >
                    <option value="">-- Choose Airman ({cellEditProxyFlight || cellEditModal.flight}) --</option>
                    {airmen
                      .filter((a) => {
                        if (a.flightName !== (cellEditProxyFlight || cellEditModal.flight)) return false;
                        // Base Security Duty (GD) is strictly for Cpl & Below (Cpl, LAC, AC1, AC2)
                        if (cellEditModal.dutyCode === 'GD') {
                          const rankLower = a.rank.toLowerCase();
                          return ['cpl', 'lac', 'ac1', 'ac2', 'corporal'].some((r) => rankLower.includes(r));
                        }
                        return true;
                      })
                      .map((a) => {
                        const res = resolveAirmanDutyForDate(a.id, cellEditModal.date, assignmentMap);
                        const isSameDuty = (cellEditModal.dutyCode === 'IDAC' || cellEditModal.dutyCode === 'IDA')
                          ? (res.dutyCode === 'IDAC' || res.dutyCode === 'IDA') && res.idaShift === cellEditModal.idaShift
                          : res.dutyCode === cellEditModal.dutyCode;
                        const hasOtherDuty = res.dutyCode && (res.dutyCode as string) !== 'OFF' && (res.dutyCode as string) !== 'ON_PARADE' && !isSameDuty;

                        let dutySuffix = '';
                        if (res.dutyCode === 'LEAVE') dutySuffix = 'Leave';
                        else if (res.dutyCode === 'TDY') dutySuffix = 'TDY';
                        else if (res.dutyCode === 'GD') dutySuffix = 'Guard Duty';
                        else if (res.dutyCode === 'BTF') dutySuffix = 'Base Taskforce';
                        else if (res.dutyCode === 'NTF') dutySuffix = 'Najirpara Taskforce';
                        else if (res.dutyCode === 'HALISHAHAR') dutySuffix = 'Halishahar Taskforce';
                        else if (res.dutyCode === 'AIRPORT') dutySuffix = 'Airfield Duty';
                        else if (res.dutyCode === 'IDAC' || res.dutyCode === 'IDA') dutySuffix = `IDAC Duty (${res.idaShift || 'Morning'})`;
                        else if (res.dutyCode === 'BAKE_N_BITE') dutySuffix = 'Bake & Bite';
                        else if (res.dutyCode === 'DUTY_OFF') dutySuffix = 'Duty Off';
                        else if (hasOtherDuty) {
                          const resCodeStr = String(res.dutyCode || '');
                          const isOther = resCodeStr.toUpperCase() === 'OTHERS' || resCodeStr.toUpperCase() === 'OTHER' || resCodeStr.startsWith('OTHERS_');
                          if (isOther) {
                            const noteName = res.notes?.trim();
                            dutySuffix = (noteName && !['OTHER', 'OTHERS', 'OTHER DISPOSAL', 'CUSTOM DISPOSAL', 'CUSTOM'].includes(noteName.toUpperCase())) ? noteName : 'Disposal';
                          } else {
                            dutySuffix = DUTY_TYPE_MAP.get(res.dutyCode)?.name || res.notes || res.dutyCode;
                          }
                        }

                        const label = dutySuffix
                          ? `${formatAirmanName(a.rank)} ${a.name} - ${dutySuffix}`
                          : `${formatAirmanName(a.rank)} ${a.name}`;

                        return (
                          <option key={a.id} value={a.id}>
                            {label}
                          </option>
                        );
                      })}
                  </select>
                </div>

                {/* Optional Notes */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Notes / Remarks (Optional):
                  </label>
                  <input
                    disabled={isCellReadOnly}
                    type="text"
                    placeholder="e.g., Detail replacement / swap"
                    value={cellEditNotes}
                    onChange={(e) => setCellEditNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 gap-2">
                  {cellEditModal.assignedAirman ? (
                    <button
                      type="button"
                      onClick={handleCellEditDelete}
                      disabled={cellEditLoading || isCellReadOnly}
                      className="px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 rounded-xl border border-rose-300 dark:border-rose-800 transition-all flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Duty</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setCellEditModal(null)}
                      className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                    >
                      {isCellReadOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!isCellReadOnly && (
                      <button
                        type="submit"
                        disabled={cellEditLoading || !selectedReplacementAirmanId}
                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md transition-all flex items-center space-x-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cellEditLoading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>{cellEditModal.assignedAirman ? 'Save / Replace' : 'Assign Airman'}</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

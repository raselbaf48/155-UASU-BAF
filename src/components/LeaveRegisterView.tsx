import { DateNavigator } from './DateNavigator';
import React, { useState, useEffect, useMemo } from 'react';
import { Airman, FlightName, UserRole } from '../types';
import { getCurrentUserSession } from '../utils/authSession';
import { Calendar, Search, Filter, Printer, Download, FileSpreadsheet, Eye, ShieldCheck, Sun, Moon, Plus, RefreshCw, X, Check, FileText, History } from 'lucide-react';
import { sortAirmenBySeniority } from '../utils/seniority';
import { exportTableToCSV } from '../utils/csvExport';
import { getOptimalMinColumnWidth } from '../utils/tableUtils';
import { EntryHistoryModal } from './EntryHistoryModal';


const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
interface LeaveRegisterViewProps {
  role?: UserRole;
  airmen: Airman[];
  onViewProfile?: (airman: Airman, config?: any) => void;
}

interface LeaveRecord {
  airmanId: string;
  casualLeaveDays: number;
  annualLeaveDays: number;
  recreationLeaveDays: number;
  sickLeaveDays: number;
  totalLeaveDays: number;
  f295Days: number;
  currentlyOnLeave: boolean;
  currentLeaveType?: 'Casual Leave' | 'Annual Leave' | 'Recreation Leave' | 'Sick Leave' | 'Leave';
  currentLeaveRange?: string;
  leaveEntries: Array<{
    date: string;
    type: 'Casual Leave' | 'Annual Leave' | 'Recreation Leave' | 'Sick Leave' | 'Leave';
    notes?: string;
    isF295?: boolean;
  }>;
}

// Helper to check if a date string is Friday or Saturday (BAF weekend / F-295 candidate)
const isWeekendDay = (dateStr: string): boolean => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return day === 5 || day === 6; // 5 = Friday, 6 = Saturday
  } catch {
    return false;
  }
};

/**
 * Military F-295 Weekend / Free Pass Calculation:
 * When an airman goes on leave (e.g. 30 days, 15 days, 7 days, or Eid leave with custom F-295):
 * - F-295 days (weekend pass or special free grant e.g. 2, 3, 7, 8 days) are 100% FREE LEAVE.
 * - F-295 days NEVER deduct from the airman's leave balance.
 */
export const calculateLeaveDaysWithF295 = (
  startStr: string,
  endStr: string,
  explicitF295Days?: number
): { totalCalendarDays: number; netLeaveDays: number; f295Days: number; dayEntries: Array<{ date: string; isF295: boolean }> } => {
  try {
    const [sY, sM, sD] = startStr.split('-').map(Number);
    const [eY, eM, eD] = endStr.split('-').map(Number);
    const curr = new Date(Date.UTC(sY, sM - 1, sD));
    const end = new Date(Date.UTC(eY, eM - 1, eD));

    const dates: string[] = [];
    let limit = 0;
    while (curr <= end && limit < 366) {
      const y = curr.getUTCFullYear();
      const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
      const d = String(curr.getUTCDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      curr.setUTCDate(curr.getUTCDate() + 1);
      limit++;
    }

    if (dates.length === 0) {
      return { totalCalendarDays: 1, netLeaveDays: 1, f295Days: 0, dayEntries: [{ date: startStr, isF295: false }] };
    }

    const n = dates.length;

    let f295Days = 0;
    if (typeof explicitF295Days === 'number' && explicitF295Days > 0) {
      f295Days = Math.min(n, explicitF295Days);
    } else {
      // Find contiguous weekends at the start (Prefix F-295)
      let startWeekendCount = 0;
      while (startWeekendCount < n && isWeekendDay(dates[startWeekendCount])) {
        startWeekendCount++;
      }

      // Find contiguous weekends at the end (Suffix F-295)
      let endWeekendCount = 0;
      if (startWeekendCount === 0) {
        while (endWeekendCount < n && isWeekendDay(dates[n - 1 - endWeekendCount])) {
          endWeekendCount++;
        }
      }
      f295Days = startWeekendCount > 0 ? startWeekendCount : endWeekendCount;
    }

    const dayEntries = dates.map((dStr, idx) => {
      // Flag the last or first f295Days as free F-295
      const isF295 = idx >= n - f295Days;
      return { date: dStr, isF295 };
    });

    const netLeaveDays = Math.max(0, n - f295Days);

    return {
      totalCalendarDays: n,
      netLeaveDays,
      f295Days,
      dayEntries,
    };
  } catch {
    return { totalCalendarDays: 1, netLeaveDays: 1, f295Days: 0, dayEntries: [{ date: startStr, isF295: false }] };
  }
};

export const LeaveRegisterView: React.FC<LeaveRegisterViewProps> = ({
  role = 'ADMIN',
  airmen: rawAirmen,
  onViewProfile,
}) => {
  const airmen = React.useMemo(() => rawAirmen.filter(a => a.active !== false), [rawAirmen]);
  const session = getCurrentUserSession();
  const isAdmin = session?.assignedRole === 'ADMIN';
  const adminFlight = session?.flightName;
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedFlight, setSelectedFlight] = useState<FlightName | 'All'>(isAdmin && adminFlight ? adminFlight : 'All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [summaryFilter, setSummaryFilter] = useState<'Casual' | 'Annual' | 'Recreation' | 'Total' | 'OnLeave' | null>(null);
  const [leaveData, setLeaveData] = useState<Record<string, LeaveRecord>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Grant / Record Leave Modal
  const [showGrantLeaveModal, setShowGrantLeaveModal] = useState<boolean>(false);
  const [grantLeaveFlight, setGrantLeaveFlight] = useState<FlightName>('Avionics');
  const [leaveAirmanId, setLeaveAirmanId] = useState<string>('');
  const [leaveType, setLeaveType] = useState<'Casual' | 'Annual' | 'Recreation' | 'Sick' | ''>('');
  const [leaveFromDate, setLeaveFromDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [leaveToDate, setLeaveToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [savingLeave, setSavingLeave] = useState<boolean>(false);
  const [leaveSuccessMsg, setLeaveSuccessMsg] = useState<string>('');

  // F-295 Inclusion in Modal
  const [includeF295, setIncludeF295] = useState<boolean>(false);
  const [f295Option, setF295Option] = useState<'2' | '3' | 'custom'>('2');
  const [f295CustomDays, setF295CustomDays] = useState<number>(2);
  const [selectedPresetDays, setSelectedPresetDays] = useState<number | null>(null);
  const [customLeaveDays, setCustomLeaveDays] = useState<number>(5);
  const [isCustomPresetActive, setIsCustomPresetActive] = useState<boolean>(false);

  // Calculate calendar days in current leave selection
  const leaveDurationDays = useMemo(() => {
    try {
      const [sY, sM, sD] = leaveFromDate.split('-').map(Number);
      const [eY, eM, eD] = leaveToDate.split('-').map(Number);
      const curr = new Date(Date.UTC(sY, sM - 1, sD));
      const end = new Date(Date.UTC(eY, eM - 1, eD));
      const diff = Math.round((end.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : 1;
    } catch {
      return 1;
    }
  }, [leaveFromDate, leaveToDate]);

  // Auto-select Leave Type based on duration
  useEffect(() => {
    setLeaveType((prev) => {
      // If duration > 10, Casual is invalid. Force it to Annual if it was Casual.
      if (leaveDurationDays > 10) {
        if (prev === 'Casual' || prev === '') return 'Annual';
        return prev;
      }
      // If duration <= 10, auto select Casual ONLY if nothing is currently selected
      if (leaveDurationDays <= 10) {
        if (prev === '') return 'Casual';
        return prev;
      }
      return prev;
    });
  }, [leaveDurationDays]);

  // Filter airmen for Grant Leave Modal (Strictly 4 flights: Avionics, Mechanics, GCS, Admin)
  const grantAirmenList = useMemo(() => {
    const list = airmen.filter((a) => a.flightName === grantLeaveFlight);
    return sortAirmenBySeniority(list);
  }, [airmen, grantLeaveFlight]);

  // Reset airman selection when flight changes if the selected airman is not in the new flight
  useEffect(() => {
    if (leaveAirmanId) {
      const exists = grantAirmenList.some((a) => a.id === leaveAirmanId);
      if (!exists) {
        setLeaveAirmanId('');
      }
    }
  }, [grantAirmenList, leaveAirmanId]);

  // Helper to add days from leaveFromDate with optional F-295 days
  const applyPresetDays = (
    baseDays: number,
    f295Enabled: boolean = includeF295,
    opt: '2' | '3' | 'custom' = f295Option,
    customVal: number = f295CustomDays
  ) => {
    try {
      let extraDays = 0;
      if (f295Enabled) {
        extraDays = opt === '2' ? 2 : opt === '3' ? 3 : Math.max(1, customVal || 1);
      }
      const totalDays = baseDays + extraDays;
      const [y, m, d] = leaveFromDate.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, d));
      // totalDays - 1 because start date is inclusive
      start.setUTCDate(start.getUTCDate() + (totalDays - 1));
      const endYear = start.getUTCFullYear();
      const endMonth = String(start.getUTCMonth() + 1).padStart(2, '0');
      const endDay = String(start.getUTCDate()).padStart(2, '0');
      setLeaveToDate(`${endYear}-${endMonth}-${endDay}`);
      if (baseDays > 10 && leaveType === 'Casual') {
        setLeaveType('Annual');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Toggle or select quick preset days (allows selecting and unselecting 3 days, etc.)
  const handlePresetToggle = (days: number) => {
    setIsCustomPresetActive(false);
    if (selectedPresetDays === days) {
      // Unselect: reset to single day (FromDate)
      setSelectedPresetDays(null);
      setLeaveToDate(leaveFromDate);
    } else {
      // Select
      setSelectedPresetDays(days);
      applyPresetDays(days);
    }
  };

  // Apply custom leave days
  const handleCustomLeaveDaysChange = (customDays: number) => {
    const days = Math.max(1, customDays || 1);
    setCustomLeaveDays(days);
    setIsCustomPresetActive(true);
    setSelectedPresetDays(null);
    applyPresetDays(days);
  };

  const handleF295Toggle = (enabled: boolean) => {
    setIncludeF295(enabled);
    if (selectedPresetDays !== null) {
      applyPresetDays(selectedPresetDays, enabled, f295Option, f295CustomDays);
    } else if (isCustomPresetActive) {
      applyPresetDays(customLeaveDays, enabled, f295Option, f295CustomDays);
    } else {
      const oldF295 = includeF295 ? (f295Option === '2' ? 2 : f295Option === '3' ? 3 : f295CustomDays) : 0;
      const base = Math.max(1, (modalDaysCalc?.totalCalendarDays || 1) - oldF295);
      applyPresetDays(base, enabled, f295Option, f295CustomDays);
    }
  };

  const handleF295OptionChange = (opt: '2' | '3' | 'custom', customVal: number = f295CustomDays) => {
    setF295Option(opt);
    if (includeF295) {
      if (selectedPresetDays !== null) {
        applyPresetDays(selectedPresetDays, true, opt, customVal);
      } else if (isCustomPresetActive) {
        applyPresetDays(customLeaveDays, true, opt, customVal);
      } else {
        const oldF295 = includeF295 ? (f295Option === '2' ? 2 : f295Option === '3' ? 3 : f295CustomDays) : 0;
        const base = Math.max(1, (modalDaysCalc?.totalCalendarDays || 1) - oldF295);
        applyPresetDays(base, true, opt, customVal);
      }
    }
  };

  // Fetch all assignments for the year to calculate Casual, Annual, and Recreation leave (with F-295 prefix/suffix rule)
  const fetchLeaves = async () => {
    setLoading(true);
    try {
      // Fetch all 12 months of the year
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = String(i + 1).padStart(2, '0');
        return `${selectedYear}-${m}`;
      });

      const allAssignmentsPromises = months.map((mKey) =>
        fetch(`/api/roster?month=${mKey}`)
          .then(async (res) => {
            if (!res.ok) return [];
            const data = await res.json();
            if (data && Array.isArray(data.assignments)) {
              return data.assignments;
            }
            if (Array.isArray(data)) {
              return data;
            }
            return [];
          })
          .catch(() => [])
      );

      const monthlyResults = await Promise.all(allAssignmentsPromises);
      const allAssignments = monthlyResults.flat();

      const todayStr = new Date().toISOString().split('T')[0];
      const recordMap: Record<string, LeaveRecord> = {};

      // Initialize for all airmen
      airmen.forEach((a) => {
        recordMap[a.id] = {
          airmanId: a.id,
          casualLeaveDays: 0,
          annualLeaveDays: 0,
          recreationLeaveDays: 0,
                    sickLeaveDays: 0,
          totalLeaveDays: 0,
          f295Days: 0,
          currentlyOnLeave: false,
          leaveEntries: [],
        };
      });

      // Process leave assignments per airman
      Object.keys(recordMap).forEach((airmanId) => {
        const rec = recordMap[airmanId];
        const airmanLeaveAssignments = allAssignments
          .filter((ass: any) => ass && ass.dutyCode === 'LEAVE' && ass.airmanId === airmanId && ass.date)
          .sort((a: any, b: any) => a.date.localeCompare(b.date));

        if (airmanLeaveAssignments.length === 0) return;

        // Group into contiguous date spans
        const spans: Array<Array<any>> = [];
        let currentSpan: any[] = [];

        airmanLeaveAssignments.forEach((ass: any) => {
          if (currentSpan.length === 0) {
            currentSpan.push(ass);
          } else {
            const prevAss = currentSpan[currentSpan.length - 1];
            const prevDate = new Date(prevAss.date);
            const currDate = new Date(ass.date);
            const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
              currentSpan.push(ass);
            } else {
              spans.push(currentSpan);
              currentSpan = [ass];
            }
          }
        });
        if (currentSpan.length > 0) {
          spans.push(currentSpan);
        }

        // Process each contiguous span with Military F-295 free pass rule
        spans.forEach((span) => {
          const spanLength = span.length;
          const isSpanAnnual = spanLength > 7;
          const firstDate = span[0].date;
          const lastDate = span[span.length - 1].date;

          // Check if any assignment in the span specifies explicit F-295 free days
          let explicitF295: number | undefined = undefined;
          span.forEach((ass) => {
            const match = (ass.notes || '').match(/f-295:\s*(\d+)/i);
            if (match) {
              explicitF295 = parseInt(match[1], 10);
            }
          });

          const spanF295Calc = calculateLeaveDaysWithF295(firstDate, lastDate, explicitF295);

          span.forEach((ass) => {
            const notesLower = (ass.notes || '').toLowerCase();
            const hasRecreationNote = notesLower.includes('recreation') || notesLower.includes('(rl)') || notesLower.includes(' rl') || notesLower.includes('rec leave');
            const hasCasualNote = notesLower.includes('casual') || notesLower.includes('(cl)') || notesLower.includes(' cl');
            const hasAnnualNote = notesLower.includes('annual') || notesLower.includes('(al)') || notesLower.includes(' al');

            let type: 'Casual Leave' | 'Annual Leave' | 'Recreation Leave' | 'Leave' = 'Casual Leave';
            if (hasRecreationNote) {
              type = 'Recreation Leave';
            } else if (hasAnnualNote || isSpanAnnual) {
              type = 'Annual Leave';
            } else if (hasCasualNote) {
              type = 'Casual Leave';
            } else {
              type = spanLength > 7 ? 'Annual Leave' : 'Casual Leave';
            }

            // Check if this date in the span falls into F-295 (Free Pass)
            const dayEntry = spanF295Calc.dayEntries.find((de) => de.date === ass.date);
            const isF295 = !!dayEntry?.isF295;

            if (isF295) {
              rec.f295Days++;
            } else {
              if (type === 'Recreation Leave') {
                rec.recreationLeaveDays++;
              } else if (type === 'Annual Leave') {
                rec.annualLeaveDays++;
              } else {
                rec.casualLeaveDays++;
              }
              rec.totalLeaveDays++;
            }

            rec.leaveEntries.push({
              date: ass.date,
              type,
              notes: ass.notes,
              isF295,
            });

            if (ass.date === todayStr) {
              rec.currentlyOnLeave = true;
              rec.currentLeaveType = type;
            }
          });
        });
      });

      setLeaveData(recordMap);
    } catch (err) {
      console.error('Failed to load leave records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
    const handleGlobalUpdate = () => {
      fetchLeaves();
    };
    window.addEventListener('baf_state_updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('baf_state_updated', handleGlobalUpdate);
    };
  }, [selectedYear, airmen]);

  // Handle Granting Leave
  const handleGrantLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveAirmanId) {
      alert('Please select an airman');
      return;
    }
    if (!leaveFromDate || !leaveToDate || leaveFromDate > leaveToDate) {
      alert('Invalid date range');
      return;
    }

    setSavingLeave(true);
    try {
      const fullTypeName = leaveType === 'Casual' ? 'Casual Leave' : leaveType === 'Annual' ? 'Annual Leave' : leaveType === 'Sick' ? 'Sick Leave' : leaveType === 'Recreation' ? 'Recreation Leave' : 'Leave';
      const f295Extra = includeF295 ? (f295Option === '2' ? 2 : f295Option === '3' ? 3 : f295CustomDays) : 0;
      const notesWithF295 = f295Extra > 0 ? `${fullTypeName} (F-295: ${f295Extra} Free Days)` : fullTypeName;

      const res = await fetch('/api/roster/assign-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: leaveAirmanId,
          dutyCode: 'LEAVE',
          fromDate: leaveFromDate,
          toDate: leaveToDate,
          notes: notesWithF295,
        }),
      });

      const result = await res.json().catch(() => ({}));
      if (res.ok && result.success) {
        const found = airmen.find((a) => a.id === leaveAirmanId);
        const { netLeaveDays, f295Days } = calculateLeaveDaysWithF295(leaveFromDate, leaveToDate, f295Extra);
        setLeaveSuccessMsg(
          `✅ ${fullTypeName} granted to ${found?.rank} ${found?.name}: ${netLeaveDays} Net Leave day(s)${
            f295Days > 0 ? ` + ${f295Days} day(s) credited as F-295 Free Leave` : ''
          }!`
        );
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
        await fetchLeaves();
        setTimeout(() => {
          setShowGrantLeaveModal(false);
          setLeaveSuccessMsg('');
        }, 1300);
      } else {
        alert(result.error || 'Failed to grant leave');
      }
    } catch (err: any) {
      console.error('Error granting leave:', err);
      alert(`Failed to grant leave: ${err.message}`);
    } finally {
      setSavingLeave(false);
    }
  };

  // Sort airmen by seniority
  const sortedAirmen = sortAirmenBySeniority(airmen);

  // Filter airmen
  const filteredAirmen = sortedAirmen.filter((a) => {
    if (selectedFlight !== 'All' && a.flightName !== selectedFlight) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        a.name.toLowerCase().includes(q) ||
        a.bdNo.toLowerCase().includes(q) ||
        a.rank.toLowerCase().includes(q) ||
        a.trade.toLowerCase().includes(q);
      if (!match) return false;
    }
    
    if (summaryFilter) {
      const rec = leaveData[a.id];
      if (!rec) return false;
      if (summaryFilter === 'Casual' && rec.casualLeaveDays <= 0) return false;
      if (summaryFilter === 'Annual' && rec.annualLeaveDays <= 0) return false;
      if (summaryFilter === 'Recreation' && rec.recreationLeaveDays <= 0) return false;
      if (summaryFilter === 'Total' && rec.totalLeaveDays <= 0) return false;
      if (summaryFilter === 'OnLeave' && !rec.currentlyOnLeave) return false;
    }
    return true;
  });

  // Calculate totals
  const leaveRecords: LeaveRecord[] = Object.values(leaveData);
  const totalCasual = leaveRecords.reduce((sum: number, r: LeaveRecord) => sum + r.casualLeaveDays, 0);
  const totalAnnual = leaveRecords.reduce((sum: number, r: LeaveRecord) => sum + r.annualLeaveDays, 0);
  const totalRecreation = leaveRecords.reduce((sum: number, r: LeaveRecord) => sum + r.recreationLeaveDays, 0);
  const totalNetLeave = leaveRecords.reduce((sum: number, r: LeaveRecord) => sum + r.totalLeaveDays, 0);
  const totalF295 = leaveRecords.reduce((sum: number, r: LeaveRecord) => sum + r.f295Days, 0);
  const totalOnLeaveToday = leaveRecords.filter((r: LeaveRecord) => r.currentlyOnLeave).length;

  const currentF295Days = includeF295 ? (f295Option === '2' ? 2 : f295Option === '3' ? 3 : f295CustomDays) : 0;
  const modalDaysCalc = calculateLeaveDaysWithF295(leaveFromDate, leaveToDate, currentF295Days);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="duty-register-print space-y-6">
      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-400 text-xs font-black uppercase tracking-wider">
            <Calendar className="w-4 h-4" />
            <span>Workforce Management • 155 UASU BAF</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            Leave Register
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Casual Leave, Annual Leave & Recreation Leave tracking with military prefix/suffix weekend exclusion rule (F-295).
          </p>
        </div>

        {/* Right Action Bar */}
        <div className="flex flex-wrap items-center gap-2.5 self-end md:self-auto">
          {/* Year selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <span className="text-slate-500 mr-2">Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-slate-900 dark:text-white font-black outline-none cursor-pointer"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2027">2027</option>
            </select>
          </div>

          {/* Refresh Button */}
          

          {/* Entry History Button */}
          {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
              title="View Entry History, revert wrong entries, or edit"
            >
              <History className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>History</span>
            </button>
          )}

          {/* Record / Grant Leave Button */}
          
          <button
            onClick={() => exportTableToCSV('leave-register-container', `Leave_Register_${selectedFlight}_${selectedYear}.csv`)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => {
              setLeaveAirmanId('');
              setSelectedPresetDays(null);
              setIsCustomPresetActive(false);
              setIncludeF295(false);
              setShowGrantLeaveModal(true);
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Grant Leave</span>
          </button>

          {/* Print Button */}
          <button
            onClick={handlePrint}
            className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Register</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div 
          onClick={() => setSummaryFilter(summaryFilter === 'Casual' ? null : 'Casual')}
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${summaryFilter === 'Casual' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}>
          <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            Casual Leave
          </div>
          <div className="text-2xl font-black text-sky-600 dark:text-sky-400 mt-1">
            {totalCasual} <span className="text-xs font-semibold text-slate-400">Days</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Casual leave in {selectedYear}</div>
        </div>

        <div 
          onClick={() => setSummaryFilter(summaryFilter === 'Annual' ? null : 'Annual')}
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${summaryFilter === 'Annual' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}>
          <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            Annual Leave
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {totalAnnual} <span className="text-xs font-semibold text-slate-400">Days</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Annual privilege leave</div>
        </div>

        <div 
          onClick={() => setSummaryFilter(summaryFilter === 'Recreation' ? null : 'Recreation')}
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${summaryFilter === 'Recreation' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}>
          <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            Recreation Leave
          </div>
          <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
            {totalRecreation} <span className="text-xs font-semibold text-slate-400">Days</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Recreation leave balance</div>
        </div>

        <div 
          onClick={() => setSummaryFilter(summaryFilter === 'Total' ? null : 'Total')}
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs cursor-pointer transition-all ${summaryFilter === 'Total' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}>
          <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
            Total Leave
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {totalNetLeave} <span className="text-xs font-semibold text-slate-400">Days</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
            {totalF295 > 0 ? `(${totalF295} days F-295 pass)` : 'Prefix/Suffix F-295 rule applied'}
          </div>
        </div>

        
        {(() => {
          const currentList = leaveRecords.filter((r: any) => r.currentlyOnLeave);
          return (
            
  <div 
          onClick={() => setSummaryFilter(summaryFilter === 'OnLeave' ? null : 'OnLeave')}
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs flex flex-col h-full max-h-[140px] cursor-pointer transition-all ${summaryFilter === 'OnLeave' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}>
    <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 shrink-0 flex justify-between">
      <span>Currently On Leave</span>
      
    </div>
    <div className="flex-1 flex flex-col justify-end">
      <div className="flex items-baseline space-x-2">
        <span className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tabular-nums tracking-tighter">
          {currentList.length}
        </span>
        <span className="text-xs font-bold text-slate-500 uppercase">Men</span>
      </div>
    </div>
  </div>
          );
        })()}
  
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Flight Tabs */}
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          {(['All', 'Avionics', 'Mechanics', 'GCS', 'Admin'] as const).map((fl) => (
            <button
              key={fl}
              onClick={() => setSelectedFlight(fl)}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all shrink-0 ${
                selectedFlight === fl
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {fl === 'All' ? 'All Flights' : `${fl} Flight`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, BD, trade..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Leave Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4 text-center w-12">Ser</th>
                <th className="py-3 px-4">BD No</th>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Flight</th>
                <th className="py-3 px-4">Trade</th>
                <th className="py-3 px-3 text-center bg-sky-50 dark:bg-sky-950/30 text-sky-900 dark:text-sky-300">
                  Casual Leave
                </th>
                <th className="py-3 px-3 text-center bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-300">
                  Annual Leave
                </th>
                <th className="py-3 px-3 text-center bg-indigo-50 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-300">
                  Recreation Leave
                </th>
                <th className="py-3 px-3 text-center bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-black">
                  Net Days
                </th>
                <th className="py-3 px-3 text-center text-slate-600 dark:text-slate-300 bg-purple-50 dark:bg-purple-950/20 font-black">
                  F-295
                </th>
                <th className="py-3 px-4 text-center">Current Status</th>
                
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Loading Leave Register...
                  </td>
                </tr>
              ) : filteredAirmen.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    No airmen match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredAirmen.map((airman, idx) => {
                  const rec = leaveData[airman.id] || {
                    casualLeaveDays: 0,
                    annualLeaveDays: 0,
                    recreationLeaveDays: 0,
                    sickLeaveDays: 0,
                    totalLeaveDays: 0,
                    f295Days: 0,
                    currentlyOnLeave: false,
                    leaveEntries: [],
                  };

                  return (
                    <tr
                      key={airman.id}
                      onClick={() => onViewProfile && onViewProfile(airman, { initialTab: 'history', initialCategory: 'LEAVE', historyOnly: true })}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-500">
                        {String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200" style={{ minWidth: getOptimalMinColumnWidth(airman.bdNo, 70, 7, 24) }}>
                        {airman.bdNo}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-black text-[11px]">
                          {formatAirmanName(airman.rank)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 dark:text-white" style={{ minWidth: getOptimalMinColumnWidth(airman.name, 120, 7.5, 32) }}>
                        <button
                          onClick={() => onViewProfile && onViewProfile(airman, { initialTab: 'history', initialCategory: 'LEAVE', historyOnly: true })}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline text-left cursor-pointer"
                          title="Click to view full duty & leave history"
                        >
                          {airman.name}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-semibold">
                        {airman.flightName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {airman.trade}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-extrabold text-sky-700 dark:text-sky-300 bg-sky-50/50 dark:bg-sky-950/20">
                        {rec.casualLeaveDays > 0 ? (
                          <span className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/60 rounded-full">
                            {rec.casualLeaveDays}d
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-extrabold text-amber-700 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
                        {rec.annualLeaveDays > 0 ? (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 rounded-full">
                            {rec.annualLeaveDays}d
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-extrabold text-indigo-700 dark:text-indigo-300 bg-indigo-50/50 dark:bg-indigo-950/20">
                        {rec.recreationLeaveDays > 0 ? (
                          <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/60 rounded-full">
                            {rec.recreationLeaveDays}d
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
                        {rec.totalLeaveDays > 0 ? (
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/70 rounded-full font-black text-xs">
                            {rec.totalLeaveDays} Days
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold bg-purple-50/40 dark:bg-purple-950/10">
                        {rec.f295Days > 0 ? (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/60 rounded-full text-[11px] text-purple-700 dark:text-purple-300 font-black">
                            {rec.f295Days}d
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {rec.currentlyOnLeave ? (
                          <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 font-black text-[10px] animate-pulse">
                            On {rec.currentLeaveType || 'Leave'}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Available
                          </span>
                        )}
                      </td>
                      
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grant / Record Leave Modal */}
      {showGrantLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Grant / Record Airman Leave
                  </h3>
                  <p className="text-xs text-slate-400">Record Casual Leave, Annual Leave, or Recreation Leave</p>
                </div>
              </div>
              <button
                onClick={() => setShowGrantLeaveModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {leaveSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl text-center">
                {leaveSuccessMsg}
              </div>
            )}

            <form onSubmit={handleGrantLeaveSubmit} className="space-y-4">
              {/* Flight Filter Selector (Strictly 4 Flights) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Flight
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['Avionics', 'Mechanics', 'GCS', 'Admin'] as FlightName[]).map((flt) => {
                    const isSuperAdmin = ((session?.assignedRole === 'SUPER_ADMIN' || session?.assignedRole === 'OWNER') || session?.assignedRole === 'OWNER');
                    const isPastDate = leaveFromDate < todayStr;
                    const isDisabledFlt = (isAdmin && adminFlight && flt !== adminFlight) || (isPastDate && !isSuperAdmin);
                    const setterStateValue = grantLeaveFlight === flt; // This is a bit hacky, let's just do an exact replace depending on the file
                    return (
                    <button
                      key={flt}
                      type="button"
                      onClick={() => !isDisabledFlt && setGrantLeaveFlight(flt)}
                      disabled={isDisabledFlt}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                        isDisabledFlt ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700' :
                        grantLeaveFlight === flt
                          ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-slate-900 dark:border-slate-100 shadow-xs cursor-pointer'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400 cursor-pointer'
                      }`}
                    >
                      {flt}
                    </button>
                    );
                  })}
                </div>
              </div>

              {/* Select Airman (Strictly Rank & Name only) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Select Airman <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {grantAirmenList.length} Airmen available
                  </span>
                </div>
                
                {leaveFromDate < todayStr && session?.assignedRole !== 'SUPER_ADMIN' && session?.assignedRole !== 'OWNER' ? (
                  <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-xs font-bold text-slate-500 text-center">
                    🚫 Cannot modify past dates.
                  </div>
                ) : (
                  <select
                  value={leaveAirmanId}
                  onChange={(e) => setLeaveAirmanId(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer ${
                    !leaveAirmanId
                      ? 'border-amber-400 dark:border-amber-600 bg-amber-50/40 dark:bg-amber-950/20'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                  required
                >
                  <option value="" disabled={false}>
                    — Select an Airman —
                  </option>
                  {grantAirmenList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatAirmanName(a.rank)} {a.name}
                    </option>
                  ))}
                </select>
                )}
                {!leaveAirmanId && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                    * Please select an airman from the list above
                  </p>
                )}
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    From Date
                  </label>
                  <DateNavigator
                    
                    value={leaveFromDate}
                    onChange={(e) => {
                      const newFrom = e.target.value;
                      setLeaveFromDate(newFrom);
                      if (!leaveToDate || leaveToDate < newFrom) {
                        setLeaveToDate(newFrom);
                      }
                      
                      const extra = includeF295 ? (f295Option === '2' ? 2 : f295Option === '3' ? 3 : f295CustomDays) : 0;
                      if (selectedPresetDays !== null) {
                        const d = new Date(newFrom);
                        d.setDate(d.getDate() + selectedPresetDays + extra - 1);
                        setLeaveToDate(d.toISOString().split('T')[0]);
                      } else if (isCustomPresetActive) {
                        const d = new Date(newFrom);
                        d.setDate(d.getDate() + customLeaveDays + extra - 1);
                        setLeaveToDate(d.toISOString().split('T')[0]);
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    To Date
                  </label>
                  <DateNavigator
                    
                    value={leaveToDate}
                    min={leaveFromDate}
                    onChange={(e) => {
                      setLeaveToDate(e.target.value);
                      setSelectedPresetDays(null);
                      setIsCustomPresetActive(false);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Quick Duration Presets & Custom Leave Days */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Quick Leave Presets:</span>
                  <span className="text-[11px] text-slate-400">Click to Select / Unselect</span>
                </div>
                
                {/* Standard presets (3, 4, 7, 15, 21, 30 days) */}
                <div className="grid grid-cols-6 gap-1.5">
                  {[3, 4, 7, 15, 21, 30].map((days) => {
                    const isSelected = selectedPresetDays === days;
                    return (
                      <button
                        key={days}
                        type="button"
                        onClick={() => handlePresetToggle(days)}
                        className={`py-1.5 px-1 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs text-center border ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/50 shadow-sm'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300'
                        }`}
                        title={isSelected ? `Click to unselect ${days} days` : `Select ${days} days leave`}
                      >
                        {days} Days
                      </button>
                    );
                  })}
                </div>

                {/* Custom Leave Days Option */}
                <div className="flex items-center justify-between bg-white dark:bg-slate-700/60 p-2 rounded-xl border border-slate-200 dark:border-slate-600">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Custom Leave:
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={customLeaveDays}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          handleCustomLeaveDaysChange(val);
                        }}
                        className="w-16 px-2 py-1 text-xs font-black text-center bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                        placeholder="Days"
                      />
                      <span className="text-xs text-slate-500 font-semibold">Days</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCustomLeaveDaysChange(customLeaveDays)}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      isCustomPresetActive
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {isCustomPresetActive ? '✓ Custom Set' : 'Apply Custom'}
                  </button>
                </div>

                {/* F-295 Option */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <div 
                      className="flex items-center space-x-2.5 cursor-pointer select-none group"
                      onClick={() => handleF295Toggle(!includeF295)}
                    >
                      <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out ${includeF295 ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500'}`}>
                        <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${includeF295 ? 'translate-x-4.5' : 'translate-x-0.5'}`} style={{ transform: includeF295 ? 'translateX(18px)' : 'translateX(3px)' }} />
                      </div>
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                        Include F-295 (Journey Time)
                      </span>
                    </div>
                    {includeF295 && (
                      <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                        +{f295Option === '2' ? '2' : f295Option === '3' ? '3' : f295CustomDays} Days Added
                      </span>
                    )}
                  </div>

                  {includeF295 && (
                    <div className="flex flex-wrap items-center gap-2 pl-6 animate-fadeIn">
                      <button
                        type="button"
                        onClick={() => handleF295OptionChange('2')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          f295Option === '2'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        2 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => handleF295OptionChange('3')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          f295Option === '3'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        3 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => handleF295OptionChange('custom')}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          f295Option === 'custom'
                            ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                            : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        Custom
                      </button>

                      {f295Option === 'custom' && (
                        <div className="flex items-center space-x-1">
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={f295CustomDays}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                              setF295CustomDays(val);
                              handleF295OptionChange('custom', val);
                            }}
                            className="w-14 px-2 py-0.5 text-xs font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none"
                          />
                          <span className="text-[11px] text-slate-500">Days</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Leave Type Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                    Leave Type
                  </label>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    Duration: {leaveDurationDays} Day{leaveDurationDays > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-1.5">
                  <button
                    type="button"
                    disabled={leaveDurationDays > 10}
                    onClick={() => setLeaveType('Casual')}
                    className={`py-2 text-xs font-black rounded-xl border transition-all ${
                      leaveDurationDays > 10 ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700' :
                      leaveType === 'Casual'
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs cursor-pointer'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer'
                    }`}
                  >
                    Casual Leave
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('Annual')}
                    className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      leaveType === 'Annual'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Annual Leave
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('Recreation')}
                    className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      leaveType === 'Recreation'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Recreation Leave
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaveType('Sick')}
                    className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                      leaveType === 'Sick'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Sick Leave
                  </button>
                </div>
                {leaveDurationDays > 10 ? (
                  <p className="text-[10.5px] text-slate-400">
                    Duration is &gt; 10 days: Casual Leave disabled. Selected {leaveType || 'None'}.
                  </p>
                ) : (
                  <p className="text-[10.5px] text-slate-400">
                    Duration is &le; 10 days: Casual Leave auto-selected. Selected {leaveType || 'None'}.
                  </p>
                )}
              </div>

              {/* Real-time duration & Military F-295 summary badge */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1.5">
                <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200">
                  <span>Net Leave Balance Count:</span>
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                    {modalDaysCalc.netLeaveDays} Day{modalDaysCalc.netLeaveDays > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between border-t border-emerald-200/60 dark:border-emerald-800/60 pt-1.5">
                  <span>Total Calendar Span: <strong>{modalDaysCalc.totalCalendarDays} Days</strong></span>
                  {modalDaysCalc.f295Days > 0 ? (
                    <span className="font-bold text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-900/60 px-2 py-0.5 rounded-md">
                      F-295 (Free Leave): {modalDaysCalc.f295Days} Day(s)
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">No F-295 free days (F-295: 0)</span>
                  )}
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowGrantLeaveModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLeave}
                  className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
                >
                  {savingLeave ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Record Leave</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Entry History & Revert Modal */}
      {showHistoryModal && (
        <EntryHistoryModal
          airmen={airmen}
          filterType="LEAVE"
          onClose={() => setShowHistoryModal(false)}
          onRefreshData={() => {
            fetchLeaves();
          }}
        />
      )}
    </div>
  );
};

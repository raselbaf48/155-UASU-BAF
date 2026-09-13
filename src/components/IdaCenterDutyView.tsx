import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  MessageCircle,
  Phone,
  Calendar,
  Settings,
} from 'lucide-react';
import { Airman, UserRole, FlightName } from '../types';
import { Logo155UASU } from './Logo155UASU';
import {
  getIdacResponsibilities,
  getIdacEmergencyContacts,
  getIdacShiftTimes,
  IdacResponsibility,
  IdacEmergencyContact,
  IdacShiftTimeConfig,
} from '../data/idacSettings';
import { IdacSettingsModal } from './IdacSettingsModal';
import { getFlightDutyQuotaForDate } from '../data/officialDutyRatioMatrix';

interface IdaCenterDutyViewProps {
  role: UserRole;
  airmen: Airman[];
  selectedDate: string;
  onViewAirmanProfile?: (airman: Airman) => void;
}

export interface IdaScheduleSlot {
  slotId: string;
  airman?: Airman;
  fallbackFlight?: FlightName;
}

export interface IdaScheduleItem {
  id: string;
  date: string;
  dateDisplay: string;
  dayDisplay: string;
  shift: 'Morning' | 'Afternoon' | 'Night';
  shiftTime: string;
  slots: IdaScheduleSlot[];
  status: 'Active' | 'Upcoming';
}

export const IdaCenterDutyView: React.FC<IdaCenterDutyViewProps> = ({
  role,
  airmen,
  selectedDate,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDateFormatted, setCurrentDateFormatted] = useState<string>('');
  const [scheduleList, setScheduleList] = useState<IdaScheduleItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // IDAC Settings Modal (Responsibilities & Emergency Contacts)
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Responsibilities, Emergency Contacts & Shift Times State
  const [responsibilities, setResponsibilities] = useState<IdacResponsibility[]>(getIdacResponsibilities);
  const [emergencyContacts, setEmergencyContacts] = useState<IdacEmergencyContact[]>(getIdacEmergencyContacts);
  const [shiftTimesConfig, setShiftTimesConfig] = useState<IdacShiftTimeConfig[]>(getIdacShiftTimes);

  const fetchSettings = () => {
    setResponsibilities(getIdacResponsibilities());
    setEmergencyContacts(getIdacEmergencyContacts());
    setShiftTimesConfig(getIdacShiftTimes());
  };

  const airmanMap = useMemo(() => new Map<string, Airman>(airmen.map((a) => [a.id, a])), [airmen]);

  // Live Clock & Date
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
      setCurrentDateFormatted(
        now.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short' }).replace(/Sept/gi, 'Sep')
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Listen to custom settings update events
  useEffect(() => {
    const handleSettingsUpdate = () => {
      fetchSettings();
    };

    window.addEventListener('baf_idac_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('baf_idac_settings_updated', handleSettingsUpdate);
  }, []);

  // Fetch / assemble IDA center live schedule
  const fetchIdaSchedule = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const baseDate = selectedDate ? new Date(selectedDate) : now;

      // Safe date formatting helper
      const formatYMD = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };

      // Fetch yesterday, today, tomorrow, and day after tomorrow to ensure 24/7 coverage
      const yestDate = new Date(baseDate);
      yestDate.setDate(baseDate.getDate() - 1);

      const datesToFetch: string[] = [];
      datesToFetch.push(formatYMD(yestDate)); // D-1
      for (let i = 0; i < 3; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i);
        datesToFetch.push(formatYMD(d)); // D, D+1, D+2
      }

      // Fetch parade states & roster for these dates
      const monthKeys = Array.from(new Set(datesToFetch.map((d) => d.slice(0, 7))));
      const [paradeResults, rosterResults] = await Promise.all([
        Promise.all(
          datesToFetch.map((dStr) =>
            fetch(`/api/parade-state?date=${dStr}&shift=Morning&flight=Overall`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null)
          )
        ),
        Promise.all(
          monthKeys.map((mKey) =>
            fetch(`/api/roster?month=${mKey}`)
              .then(async (r) => {
                if (!r.ok) return [];
                const data = await r.json();
                return Array.isArray(data.assignments) ? data.assignments : Array.isArray(data) ? data : [];
              })
              .catch(() => [])
          )
        ),
      ]);

      const allRosterAssignments = rosterResults.flat();
      const items: IdaScheduleItem[] = [];
      const shifts: Array<'Morning' | 'Afternoon' | 'Night'> = ['Morning', 'Afternoon', 'Night'];

      const shiftTimesMap = new Map<string, string>();
      shiftTimesConfig.forEach((st) => {
        shiftTimesMap.set(st.shift, st.label || `${st.startTime} - ${st.endTime} hrs`);
      });

      datesToFetch.forEach((dStr, idx) => {
        const pData = paradeResults[idx];
        const [y, m, d] = dStr.split('-').map(Number);
        const dObj = new Date(y, m - 1, d);
        const dateDisplay = dObj.toLocaleDateString('en-GB', { month: 'short', day: '2-digit', year: '2-digit' }).replace(/Sept/gi, 'Sep');
        const dayDisplay = dObj.toLocaleDateString('en-GB', { weekday: 'short' });

        const pList = pData?.personnelStatusList || [];
        const dateRoster = allRosterAssignments.filter(
          (a: any) => a.date === dStr && (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA')
        );

        shifts.forEach((sh) => {
          const timeRange =
            shiftTimesMap.get(sh) ||
            (sh === 'Night'
              ? '21:00 - 07:30 hrs'
              : sh === 'Afternoon'
              ? '14:30 - 21:00 hrs'
              : '07:30 - 14:30 hrs');

          // 1. Quota from Duty Ratio matrix
          const flights: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
          const requiredFlights: FlightName[] = [];
          flights.forEach((fl) => {
            const quota = getFlightDutyQuotaForDate(dStr, fl, 'IDAC', sh);
            for (let q = 0; q < quota; q++) {
              requiredFlights.push(fl);
            }
          });

          // Fallbacks for duty ratio if no custom matrix rule
          if (requiredFlights.length === 0) {
            if (sh === 'Night') {
              requiredFlights.push('Mechanics', 'Avionics');
            } else if (sh === 'Afternoon') {
              requiredFlights.push('Mechanics');
            } else {
              requiredFlights.push('Avionics');
            }
          }

          // 2. Check roster assignments for this shift
          const rosterMatches = dateRoster.filter(
            (a: any) => a.idaShift === sh || (!a.idaShift && sh === 'Morning')
          );

          // 3. Check parade state personnel for this shift ONLY if actively on duty (strictly exclude Duty Off / IDAC Nt Off)
          const paradeMatches = pList.filter((item: any) => {
            const code = (item.dutyCode || '').toUpperCase();
            const notes = (item.notes || '').toLowerCase();
            const statusCat = (item.statusCategory || '').toUpperCase();
            
            // Strictly exclude any off-duty status or notes
            if (statusCat === 'OFF' || statusCat === 'PARADE' || code === 'DUTY_OFF' || notes.includes('off')) {
              return false;
            }

            const isIda = (code === 'IDAC' || code === 'IDA') && statusCat === 'DUTY';
            if (!isIda) return false;

            const shiftType =
              item.idaShift === 'Night' || notes.includes('night')
                ? 'Night'
                : item.idaShift === 'Afternoon' || notes.includes('aft')
                ? 'Afternoon'
                : 'Morning';
            return shiftType === sh;
          });

          // Assemble detailed airmen without duplicates
          const detailedAirmen: Airman[] = [];
          const seenAirmanIds = new Set<string>();

          rosterMatches.forEach((rm: any) => {
            const a = airmanMap.get(rm.airmanId);
            if (a && !seenAirmanIds.has(a.id)) {
              seenAirmanIds.add(a.id);
              detailedAirmen.push(a);
            }
          });

          paradeMatches.forEach((pm: any) => {
            const a = pm.airman;
            if (a && !seenAirmanIds.has(a.id)) {
              seenAirmanIds.add(a.id);
              detailedAirmen.push(a);
            }
          });

          // Total slots calculation
          const totalSlots = Math.max(requiredFlights.length, detailedAirmen.length, sh === 'Night' ? 2 : 1);
          const slots: IdaScheduleSlot[] = [];

          for (let sIdx = 0; sIdx < totalSlots; sIdx++) {
            if (detailedAirmen[sIdx]) {
              slots.push({
                slotId: `${dStr}-${sh}-slot-${sIdx}`,
                airman: detailedAirmen[sIdx],
              });
            } else {
              const fallback =
                requiredFlights[sIdx] ||
                (sh === 'Night' ? (sIdx === 0 ? 'Mechanics' : 'Avionics') : 'Avionics');
              slots.push({
                slotId: `${dStr}-${sh}-slot-${sIdx}`,
                fallbackFlight: fallback,
              });
            }
          }

          items.push({
            id: `${dStr}-${sh}`,
            date: dStr,
            dateDisplay,
            dayDisplay,
            shift: sh,
            shiftTime: timeRange,
            slots,
            status: idx === 1 ? 'Active' : 'Upcoming',
          });
        });
      });

      setScheduleList(items);
    } catch (err) {
      console.error('Failed to load IDA schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdaSchedule();

    const handleUpdated = () => {
      fetchIdaSchedule();
    };

    window.addEventListener('baf_state_updated', handleUpdated);
    return () => window.removeEventListener('baf_state_updated', handleUpdated);
  }, [selectedDate, airmen]);

  // Determine current active shift and next shift with precise 24-hour cycle awareness
  const liveShiftState = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Safe local YYYY-MM-DD date formatter
    const getYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const localTodayStr = getYMD(now);

    const prevDate = new Date(now);
    prevDate.setDate(now.getDate() - 1);
    const localYesterdayStr = getYMD(prevDate);

    const nextDate = new Date(now);
    nextDate.setDate(now.getDate() + 1);
    const localTomorrowStr = getYMD(nextDate);

    let activeShift: 'Morning' | 'Afternoon' | 'Night' = 'Morning';
    let activeDateStr = localTodayStr;
    let nextShift: 'Morning' | 'Afternoon' | 'Night' = 'Afternoon';
    let nextDateStr = localTodayStr;

    const parseMinutes = (timeStr?: string, fallback: number = 0): number => {
      if (!timeStr) return fallback;
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return fallback;
      return h * 60 + m;
    };

    const mCfg = shiftTimesConfig.find((s) => s.shift === 'Morning');
    const aCfg = shiftTimesConfig.find((s) => s.shift === 'Afternoon');
    const nCfg = shiftTimesConfig.find((s) => s.shift === 'Night');

    const mStart = parseMinutes(mCfg?.startTime, 450);
    const mEnd = parseMinutes(mCfg?.endTime, 870);
    const aStart = parseMinutes(aCfg?.startTime, 870);
    const aEnd = parseMinutes(aCfg?.endTime, 1260);
    const nStart = parseMinutes(nCfg?.startTime, 1260);

    if (totalMinutes >= mStart && totalMinutes < mEnd) {
      activeShift = 'Morning';
      activeDateStr = localTodayStr;
      nextShift = 'Afternoon';
      nextDateStr = localTodayStr;
    } else if (totalMinutes >= aStart && totalMinutes < aEnd) {
      activeShift = 'Afternoon';
      activeDateStr = localTodayStr;
      nextShift = 'Night';
      nextDateStr = localTodayStr;
    } else if (totalMinutes >= nStart) {
      activeShift = 'Night';
      activeDateStr = localTodayStr;
      nextShift = 'Morning';
      nextDateStr = localTomorrowStr;
    } else {
      // Between 00:00 and morning start -> Night shift of yesterday is currently running!
      activeShift = 'Night';
      activeDateStr = localYesterdayStr;
      nextShift = 'Morning';
      nextDateStr = localTodayStr;
    }

    return { activeShift, activeDateStr, nextShift, nextDateStr, localTodayStr, localTomorrowStr };
  }, [shiftTimesConfig]);

  // Currently On Duty Shift Item (Resolved accurately across night-shift boundary)
  const currentlyOnDutyItem = useMemo(() => {
    const match = scheduleList.find(
      (s) => s.date === liveShiftState.activeDateStr && s.shift === liveShiftState.activeShift
    );
    if (match) return match;

    const anyActive = scheduleList.find((s) => s.shift === liveShiftState.activeShift);
    return anyActive || scheduleList[0] || null;
  }, [scheduleList, liveShiftState]);

  // Next Active Shift Item
  const nextActiveShift = useMemo(() => {
    const match = scheduleList.find(
      (s) => s.date === liveShiftState.nextDateStr && s.shift === liveShiftState.nextShift
    );
    if (match) return match;

    return scheduleList.find((s) => s.id !== currentlyOnDutyItem?.id) || scheduleList[0] || null;
  }, [scheduleList, liveShiftState, currentlyOnDutyItem]);

  // Display shifts starting strictly after the Next Shift
  const upcomingTableSchedule = useMemo(() => {
    if (!nextActiveShift) return scheduleList.slice(0, 3);
    const nextIdx = scheduleList.findIndex((s) => s.id === nextActiveShift.id);
    if (nextIdx === -1) return scheduleList.slice(0, 3);
    
    // Return the upcoming shifts starting AFTER the Next Shift
    return scheduleList.slice(nextIdx + 1, nextIdx + 4);
  }, [scheduleList, nextActiveShift]);

  // Clean phone number for WhatsApp link
  const getWhatsAppLink = (airman?: Airman, customPhone?: string): string => {
    const raw = customPhone || airman?.mobileNo || '';
    const clean = raw.replace(/\D/g, '');
    if (!clean) return 'https://wa.me/';
    if (clean.startsWith('880')) return `https://wa.me/${clean}`;
    if (clean.startsWith('01')) return `https://wa.me/88${clean}`;
    return `https://wa.me/880${clean}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-fadeIn">
      {/* 1. TOP HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-14 bg-emerald-950/20 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center p-1 border border-emerald-500/20 shadow-xs">
            <Logo155UASU className="h-12 w-12" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                IDA Center Duty
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                155 UASU
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
              {currentDateFormatted || 'Friday, August 28, 2026'} • 24/7 Automation & Surveillance
            </p>
          </div>
        </div>

        {/* Right Controls: Live Clock & Admin Settings Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Live Clock Pill */}
          <div className="flex items-center space-x-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-1.5 rounded-full shadow-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs sm:text-sm font-black text-slate-800 dark:text-slate-200">
              {currentTime || '03:09:40 PM'}
            </span>
          </div>

          {/* Admin Settings Button */}
          {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center cursor-pointer border border-slate-200 dark:border-slate-700 shadow-xs"
              title="IDAC Settings (Responsibilities & Emergency Contacts)"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6 animate-fadeIn">
        {/* 2. CURRENTLY ON DUTY (LIVE ACTIVE SHIFT) */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#072418] via-[#0b3824] to-[#051c13] border border-emerald-800/60 shadow-xl p-6 sm:p-8 text-white">
          <div className="absolute -right-12 -top-12 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-500/40 text-emerald-300 text-[11px] font-black uppercase tracking-wider">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>CURRENTLY ON DUTY (LIVE)</span>
              </div>
              <span className="text-xs font-bold text-emerald-200/80 bg-emerald-900/40 px-3 py-1 rounded-lg border border-emerald-700/40">
                {currentlyOnDutyItem?.shift} Shift ({currentlyOnDutyItem?.shiftTime || 'Active Now'})
              </span>
            </div>

            {/* Render all slots in the current shift (supports 1 or 2 personnel) */}
            <div className="divide-y divide-white/10 space-y-3 pt-1">
              {currentlyOnDutyItem?.slots.map((slot, sIdx) => (
                <div key={slot.slotId || sIdx} className="pt-3 first:pt-0">
                  {slot.airman ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center space-x-3">
                          <span>
                            {slot.airman.rank} {slot.airman.name}
                          </span>
                        </div>
                        <p className="text-emerald-200/90 text-sm font-medium">
                          {slot.airman.flightName} Flight • {slot.airman.trade}
                        </p>
                      </div>

                      {/* Right Action Buttons (Call + WhatsApp) */}
                      <div className="flex items-center space-x-2 sm:justify-end shrink-0">
                        {slot.airman.mobileNo && (
                          <a
                            href={`tel:${slot.airman.mobileNo.replace(/\s+/g, '')}`}
                            className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer border border-white/20"
                            title={`Call ${slot.airman.name}`}
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <a
                          href={getWhatsAppLink(slot.airman)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
                          title={`Direct WhatsApp with ${slot.airman.name}`}
                        >
                          <svg className="w-5 h-5 fill-slate-950 text-slate-950" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.47-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xl sm:text-2xl font-black text-amber-300">
                          {slot.fallbackFlight || 'Mechanics'} Flt
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. NEXT SHIFT CARD */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-[#0d2137] via-[#0f2d4a] to-[#0a1828] border border-cyan-800/60 shadow-xl p-6 sm:p-7 text-white">
          <div className="absolute -right-12 -top-12 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 text-[11px] font-black uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>NEXT SHIFT</span>
              </div>
              <span className="text-xs font-bold text-cyan-200/80 bg-cyan-900/40 px-3 py-1 rounded-lg border border-cyan-700/40">
                {nextActiveShift?.shift} Shift • {nextActiveShift?.shiftTime}
              </span>
            </div>

            {/* Render all slots in the next shift */}
            <div className="divide-y divide-white/10 space-y-3 pt-1">
              {nextActiveShift?.slots.map((slot, sIdx) => (
                <div key={slot.slotId || sIdx} className="pt-3 first:pt-0">
                  {slot.airman ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center space-x-3">
                          <span>
                            {slot.airman.rank} {slot.airman.name}
                          </span>
                        </div>
                        <p className="text-cyan-200/90 text-sm font-medium">
                          {slot.airman.flightName} Flight • {slot.airman.trade} • {nextActiveShift.dateDisplay}
                        </p>
                      </div>

                      {/* Right Action Buttons (Call + WhatsApp) */}
                      <div className="flex items-center space-x-2 sm:justify-end shrink-0">
                        {slot.airman.mobileNo && (
                          <a
                            href={`tel:${slot.airman.mobileNo.replace(/\s+/g, '')}`}
                            className="w-10 h-10 rounded-2xl bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer border border-white/20"
                            title={`Call ${slot.airman.name}`}
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        <a
                          href={getWhatsAppLink(slot.airman)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-10 h-10 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-emerald-950/40"
                          title={`Direct WhatsApp with ${slot.airman.name}`}
                        >
                          <svg className="w-5 h-5 fill-slate-950 text-slate-950" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.47-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-lg sm:text-xl font-bold text-cyan-200">
                          {slot.fallbackFlight || 'Mechanics'} Flt
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. UPCOMING SCHEDULE TABLE (2 Days) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Upcoming Schedule
              </h2>
            </div>
            
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-[11px] font-black uppercase text-slate-400 tracking-wider">
                  <th className="py-3.5 px-6">Date / Day</th>
                  <th className="py-3.5 px-6">Shift</th>
                  <th className="py-3.5 px-6">Assigned Person</th>
                  <th className="py-3.5 px-6 text-right">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">
                      Loading IDA schedule...
                    </td>
                  </tr>
                ) : upcomingTableSchedule.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">
                      No schedule found for this range.
                    </td>
                  </tr>
                ) : (
                  upcomingTableSchedule.map((item) => {
                    const shiftBadgeClass =
                      item.shift === 'Morning'
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : item.shift === 'Afternoon'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800';

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Date / Day */}
                        <td className="py-3.5 px-6 whitespace-nowrap align-top">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {item.dateDisplay}
                          </div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {item.dayDisplay}
                          </div>
                        </td>

                        {/* Shift Badge */}
                        <td className="py-3.5 px-6 whitespace-nowrap align-top">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${shiftBadgeClass}`}
                          >
                            {item.shift}
                          </span>
                        </td>

                        {/* Assigned Person / Slots */}
                        <td className="py-3.5 px-6 align-top">
                          <div className="space-y-2">
                            {item.slots.map((slot, sIdx) => (
                              <div key={slot.slotId || sIdx} className="flex items-start space-x-2">
                                {item.slots.length > 1 && (
                                  <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                                    {sIdx + 1}.
                                  </span>
                                )}
                                <div>
                                  {slot.airman ? (
                                    <>
                                      <div className="font-black text-slate-900 dark:text-slate-100">
                                        {slot.airman.rank} {slot.airman.name}
                                      </div>
                                      <div className="text-[11px] text-slate-400 font-medium">
                                        {slot.airman.flightName} Flight • {slot.airman.trade}
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <span className="font-bold text-amber-600 dark:text-amber-400">
                                        {slot.fallbackFlight || 'Mechanics'} Flt
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>

                        

                        {/* Actions (Call + WhatsApp for all detailed personnel) */}
                        <td className="py-3.5 px-6 text-right whitespace-nowrap align-top">
                          <div className="space-y-1.5 flex flex-col items-end">
                            {item.slots.map((slot, sIdx) =>
                              slot.airman ? (
                                <div key={slot.slotId || sIdx} className="inline-flex items-center space-x-1.5">
                                  {slot.airman.mobileNo && (
                                    <a
                                      href={`tel:${slot.airman.mobileNo.replace(/\s+/g, '')}`}
                                      className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all shadow-2xs cursor-pointer"
                                      title={`Call ${slot.airman.name}`}
                                    >
                                      <Phone className="w-3.5 h-3.5" />
                                    </a>
                                  )}
                                  <a
                                    href={getWhatsAppLink(slot.airman)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-2xs cursor-pointer"
                                    title={`WhatsApp Chat with ${slot.airman.name}`}
                                  >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.47-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                                  </a>
                                </div>
                              ) : (
                                <span key={slot.slotId || sIdx} className="text-slate-400 text-[11px] italic h-7 flex items-center">
                                  -
                                </span>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. DUTIES RESPONSIBILITY CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Duties Responsibility
              </h2>
            </div>
            {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="text-xs text-slate-400 hover:text-emerald-600 font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Edit List</span>
              </button>
            )}
          </div>

          <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            {responsibilities.map((r) => (
              <li key={r.id} className="flex items-start space-x-2">
                <span className="text-emerald-500 font-bold select-none">•</span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* 6. EMERGENCY CONTACT CARD */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-amber-500">
              <AlertTriangle className="w-5 h-5" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Emergency Contact
              </h2>
            </div>
            {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="text-xs text-slate-400 hover:text-amber-500 font-semibold flex items-center space-x-1 cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Manage Contacts</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            {emergencyContacts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80"
              >
                <div>
                  <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
                    {c.remark?.trim() ? (
                      <span>
                        {c.name} ({c.remark.trim()})
                      </span>
                    ) : (
                      <span>{c.name}</span>
                    )}
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                    {c.phone}
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 shrink-0">
                  <a
                    href={`tel:${c.phone.replace(/\s+/g, '')}`}
                    className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                    title={`Call ${c.name}`}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  <a
                    href={getWhatsAppLink(undefined, c.whatsappPhone || c.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
                    title={`Message ${c.name} on WhatsApp`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.878-.788-1.47-1.761-1.643-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                          </svg>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* IDAC Settings Modal */}
      <IdacSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          fetchSettings();
        }}
        airmen={airmen}
      />
    </div>
  );
};

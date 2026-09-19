import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Airman, AirmanDutyStats, ConflictAlert, FlightName, DutyAssignment } from '../types';
import { DUTY_TYPES, DUTY_TYPE_MAP } from '../data/dutyTypes';
import { BarChart3, ShieldCheck, AlertCircle, Award, Scale, Layers, RefreshCw, Calendar, X, ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { calculateDutyStats, getDaysInMonth } from '../data/rosterGenerator';

interface DutyAnalyticsProps {
  airmen: Airman[];
  onViewProfile: (airman: Airman, config?: any) => void;
}

export const DutyAnalytics: React.FC<DutyAnalyticsProps> = ({ airmen, onViewProfile }) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1);

  const monthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;

  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
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

  const [filterMode, setFilterMode] = useState<'ALL' | 'HOLIDAY'>('ALL');
  const [selectedFlight, setSelectedFlight] = useState<FlightName | null>(null);
  
  const [selectedDuty, setSelectedDuty] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?month=${monthKey}`);
      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const handleGlobalUpdate = () => {
      fetchAnalytics();
      try {
        setCustomHolidays(JSON.parse(localStorage.getItem('baf_custom_holidays') || '[]'));
      } catch {}
      try {
        setRemovedHolidays(JSON.parse(localStorage.getItem('baf_removed_holidays') || '[]'));
      } catch {}
    };
    window.addEventListener('baf_state_updated', handleGlobalUpdate);
    return () => window.removeEventListener('baf_state_updated', handleGlobalUpdate);
  }, [monthKey]);

  // Holiday Logic - Supports both Adding holidays (any weekday) & Removing holidays (e.g. Friday working day)
  const isHolidayDate = (dateStr: string, dObj: Date) => {
    if (removedHolidays.includes(dateStr)) return false;
    const isWeekend = dObj.getDay() === 5 || dObj.getDay() === 6; // Friday / Saturday
    return isWeekend || customHolidays.includes(dateStr);
  };

  const handleToggleHoliday = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dObj = new Date(y, m - 1, d);
    const currentlyHoliday = isHolidayDate(dateStr, dObj);
    const isWeekend = dObj.getDay() === 5 || dObj.getDay() === 6;

    if (currentlyHoliday) {
      // Was a holiday -> Make it a WORKING DAY
      if (isWeekend) {
        setRemovedHolidays((prev) => {
          const updated = prev.includes(dateStr) ? prev : [...prev, dateStr];
          try {
            localStorage.setItem('baf_removed_holidays', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
      if (customHolidays.includes(dateStr)) {
        setCustomHolidays((prev) => {
          const updated = prev.filter((item) => item !== dateStr);
          try {
            localStorage.setItem('baf_custom_holidays', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    } else {
      // Was a working day -> Make it a HOLIDAY
      if (isWeekend) {
        // Restore Friday/Saturday default holiday
        setRemovedHolidays((prev) => {
          const updated = prev.filter((item) => item !== dateStr);
          try {
            localStorage.setItem('baf_removed_holidays', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      } else {
        // Normal weekday, add to custom holidays
        setCustomHolidays((prev) => {
          const updated = prev.includes(dateStr) ? prev : [...prev, dateStr];
          try {
            localStorage.setItem('baf_custom_holidays', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    }
    window.dispatchEvent(new Event('baf_state_updated'));
  };

  // Recalculate stats based on filters
  const filteredAssignments = useMemo(() => {
    if (filterMode === 'ALL') return assignments;
    return assignments.filter(a => {
      const dateObj = new Date(a.date);
      return isHolidayDate(a.date, dateObj);
    });
  }, [assignments, filterMode, customHolidays, removedHolidays]);

  const stats = useMemo(() => {
    return calculateDutyStats(airmen, filteredAssignments, currentYear, currentMonth);
  }, [airmen, filteredAssignments, currentYear, currentMonth]);

  // Totals dynamically computed for the active flight (or overall if none selected)
  const totals = useMemo(() => {
    const targetStats = selectedFlight ? stats.filter(s => s.flightName === selectedFlight) : stats;
    return targetStats.reduce((acc, s) => {
      acc.totalGD = (acc.totalGD || 0) + (s.totalGD || 0);
      acc.totalBTF = (acc.totalBTF || 0) + (s.totalBTF || 0);
      acc.totalNTF = (acc.totalNTF || 0) + (s.totalNTF || 0);
      acc.totalHalishahar = (acc.totalHalishahar || 0) + (s.totalHalishahar || 0);
      acc.totalAirport = (acc.totalAirport || 0) + (s.totalAirport || 0);
      acc.totalIDAC = (acc.totalIDAC || 0) + (s.totalIDAC || 0);
      return acc;
    }, {} as any);
  }, [stats, selectedFlight]);

  const airmanMap = new Map(airmen.map((a) => [a.id, a]));

  const getDutyCountExcludingAirfield = (s: AirmanDutyStats) => {
    return (
      (s.totalGD || 0) +
      (s.totalBTF || 0) +
      (s.totalNTF || 0) +
      (s.totalHalishahar || 0) +
      (s.totalIDAC || 0)
    );
  };

  const relevantStats = selectedFlight ? stats.filter(s => s.flightName === selectedFlight) : stats;

  const sortedByDutyCount = [...relevantStats].sort(
    (a, b) => getDutyCountExcludingAirfield(b) - getDutyCountExcludingAirfield(a)
  );

  const highestDuties = sortedByDutyCount.slice(0, selectedFlight ? undefined : 5);
  const lowestDuties = [...sortedByDutyCount].reverse().slice(0, selectedFlight ? undefined : 5);

  const flights: FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];
  const flightDuties = flights.map((fl) => {
    const flStats = stats.filter((s) => s.flightName === fl);
    const totalGD = flStats.reduce((acc, s) => acc + (s.totalGD || 0), 0);
    const totalBTF = flStats.reduce((acc, s) => acc + (s.totalBTF || 0), 0);
    const totalNTF = flStats.reduce((acc, s) => acc + (s.totalNTF || 0), 0);
    const totalHalishahar = flStats.reduce((acc, s) => acc + (s.totalHalishahar || 0), 0);
    const totalAirport = flStats.reduce((acc, s) => acc + (s.totalAirport || 0), 0);
    const totalIDAC = flStats.reduce((acc, s) => acc + (s.totalIDAC || 0), 0);
    const totalAll = flStats.reduce((acc, s) => acc + s.totalDutyCount, 0);
    return {
      flightName: fl,
      totalGD,
      totalBTF,
      totalNTF,
      totalHalishahar,
      totalAirport,
      totalIDAC,
      totalAll,
      airmenCount: flStats.length,
      avgPerAirman: flStats.length ? (totalAll / flStats.length).toFixed(1) : '0',
    };
  });

  // Calendar rendering
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const monthDate = new Date(currentYear, currentMonth - 1, 1);
  const startDay = monthDate.getDay(); // 0 = Sunday
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyCells = Array.from({ length: startDay }, (_, i) => i);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="relative">
      <div className={selectedDuty ? 'print:hidden space-y-6' : 'space-y-6'}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col items-center justify-center mb-4 gap-4 relative">
          <div className="text-center">
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center justify-center space-x-2">
              <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Duty Analysis & Fairness Equity Monitor</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Workload distribution, duty posts, and flight comparisons.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 w-full">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1); }
                  else setCurrentMonth(m => m - 1);
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>

              <div className="relative">
                <button
                  onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                  className="flex items-center justify-center space-x-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs w-auto"
                >
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  <span>{monthNames[currentMonth - 1]} {currentYear}</span>
                </button>

                {isCalendarOpen && (
                  <>
                    <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-xs" onClick={() => setIsCalendarOpen(false)}></div>
                    <div className="w-[280px] sm:w-[290px] border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xl absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 p-2.5 select-none">
                      <div className="flex items-center justify-between px-1.5 py-1 mb-1 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <h2 className="text-xs font-black text-slate-800 dark:text-slate-100">
                            {monthNames[currentMonth - 1]} {currentYear}
                          </h2>
                          <p className="text-[9px] text-slate-400 font-medium">Click date to toggle Holiday / Workday</p>
                        </div>
                        <button
                          onClick={() => setIsCalendarOpen(false)}
                          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 text-center mb-1">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                          <div
                            key={idx}
                            className={`py-1 text-[9px] font-black uppercase ${
                              idx === 5 || idx === 6 ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            {day}
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1">
                        {emptyCells.map((i) => (
                          <div key={`empty-${i}`} className="h-7 w-full" />
                        ))}
                        {daysArray.map((day) => {
                          const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                          const dObj = new Date(currentYear, currentMonth - 1, day);
                          const isHoliday = isHolidayDate(dateStr, dObj);
                          const isWeekend = dObj.getDay() === 5 || dObj.getDay() === 6;
                          const isWorkingWeekend = isWeekend && !isHoliday;

                          return (
                            <button
                              key={day}
                              onClick={() => handleToggleHoliday(dateStr)}
                              title={
                                isHoliday
                                  ? `${day} ${monthNames[currentMonth - 1]}: Holiday (Click to make Working Day)`
                                  : `${day} ${monthNames[currentMonth - 1]}: Working Day (Click to make Holiday)`
                              }
                              className={`h-7 w-full rounded-md flex flex-col items-center justify-center transition-all ${
                                isHoliday
                                  ? 'bg-rose-500/15 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-black border border-rose-500/30 hover:bg-rose-500/25'
                                  : isWorkingWeekend
                                  ? 'bg-emerald-500/15 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-black border border-emerald-500/40 hover:bg-emerald-500/25'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold'
                              }`}
                            >
                              <span className="text-[11px] leading-none">{day}</span>
                              {isHoliday ? (
                                <span className="text-[6.5px] leading-none font-black text-rose-500 mt-0.5">H</span>
                              ) : isWorkingWeekend ? (
                                <span className="text-[6.5px] leading-none font-black text-emerald-600 dark:text-emerald-400 mt-0.5">W</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-2 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[8px] font-bold text-slate-500 dark:text-slate-400 px-1">
                        <div className="flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />
                          <span>Holiday (H)</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          <span>Work Fri/Sat (W)</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <button
                onClick={() => {
                  if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1); }
                  else setCurrentMonth(m => m + 1);
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            </div>
            
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shadow-inner relative z-0">
              <button
                onClick={() => setFilterMode('ALL')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                All Days
              </button>
              <button
                onClick={() => setFilterMode('HOLIDAY')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filterMode === 'HOLIDAY' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Holidays Only
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
          <p className="text-xs font-bold">Calculating Duty Analytics...</p>
        </div>
      ) : (
        <>
          {/* Flight Filter Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black text-slate-600 dark:text-slate-300">
                Flight View:
              </span>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shadow-inner">
                <button
                  onClick={() => setSelectedFlight(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    selectedFlight === null
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  All Flights (Overall)
                </button>
                {flights.map((fl) => (
                  <button
                    key={fl}
                    onClick={() => setSelectedFlight(fl)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      selectedFlight === fl
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {fl} Flight
                  </button>
                ))}
              </div>
            </div>

            {selectedFlight ? (
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-3 py-1 rounded-xl">
                  Showing: {selectedFlight} Flight
                </span>
                <button
                  onClick={() => setSelectedFlight(null)}
                  className="text-xs font-bold text-slate-500 hover:text-red-500 underline transition-colors"
                >
                  Reset to All
                </button>
              </div>
            ) : (
              <span className="text-xs text-slate-400 font-medium">
                Showing overall unit duty metrics (155 UASU)
              </span>
            )}
          </div>

          {/* Overview Cards (Full names for all duties - dynamic for flight) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { 
                id: 'ALL', 
                label: selectedFlight ? `All Duties (${selectedFlight.substring(0, 3)} Flt)` : 'All Duties', 
                count: (totals.totalGD || 0) + (totals.totalBTF || 0) + (totals.totalNTF || 0) + (totals.totalHalishahar || 0) + (totals.totalIDAC || 0), 
                color: 'emerald' 
              },
              { 
                id: 'GD', 
                label: selectedFlight ? `Base Security (${selectedFlight.substring(0, 3)} Flt)` : 'Base Security Duty', 
                count: totals.totalGD || 0, 
                color: 'red' 
              },
              { 
                id: 'BTF', 
                label: selectedFlight ? `Taskforce (${selectedFlight.substring(0, 3)} Flt)` : 'Base Taskforce Duty', 
                count: totals.totalBTF || 0, 
                color: 'amber' 
              },
              { 
                id: 'NTF', 
                label: selectedFlight ? `Najirpara (${selectedFlight.substring(0, 3)} Flt)` : 'Najirpara Taskforce', 
                count: totals.totalNTF || 0, 
                color: 'orange' 
              },
              { 
                id: 'HTF', 
                label: selectedFlight ? `Halishahar (${selectedFlight.substring(0, 3)} Flt)` : 'Halishahar Taskforce', 
                count: totals.totalHalishahar || 0, 
                color: 'blue' 
              },
              { 
                id: 'IDAC', 
                label: selectedFlight ? `IDAC Duty (${selectedFlight.substring(0, 3)} Flt)` : 'IDAC Duty', 
                count: totals.totalIDAC || 0, 
                color: 'teal' 
              },
            ].map(duty => (
              <button
                key={duty.id}
                onClick={() => setSelectedDuty(duty.id)}
                className={`bg-white dark:bg-slate-900 border border-${duty.color}-200 dark:border-${duty.color}-900/60 rounded-2xl p-3.5 shadow-xs text-left hover:scale-[1.02] transition-transform`}
              >
                <span className={`text-[10px] font-black text-${duty.color}-600 dark:text-${duty.color}-400 uppercase tracking-wider block`}>
                  {duty.label}
                </span>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
                    {duty.count}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">View</span>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span>Flight-wise Duty Distribution</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Duty counters per flight with full names. Click a flight to filter the lists below.
                </p>
              </div>
              {selectedFlight && (
                <button
                  onClick={() => setSelectedFlight(null)}
                  className="text-xs font-bold px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600"
                >
                  Clear Flight Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {flightDuties.map((fl) => (
                <button
                  key={fl.flightName}
                  onClick={() => setSelectedFlight(selectedFlight === fl.flightName ? null : fl.flightName)}
                  className={`text-left p-4 rounded-2xl border transition-all shadow-xs ${selectedFlight === fl.flightName ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                      {fl.flightName} Flight
                    </span>
                    <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Avg: {fl.avgPerAirman}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-[11px] font-medium">Base Security Duty:</span>
                      <span className="font-mono font-black text-red-600 dark:text-red-400">{fl.totalGD}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-[11px] font-medium">Base Taskforce Duty:</span>
                      <span className="font-mono font-black text-amber-600 dark:text-amber-400">{fl.totalBTF}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-[11px] font-medium">Najirpara Taskforce:</span>
                      <span className="font-mono font-black text-orange-600 dark:text-orange-400">{fl.totalNTF}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-[11px] font-medium">Halishahar Taskforce:</span>
                      <span className="font-mono font-black text-blue-600 dark:text-blue-400">{fl.totalHalishahar}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-[11px] font-medium">Airfield Duty:</span>
                      <span className="font-mono font-black text-cyan-600 dark:text-cyan-400">{fl.totalAirport}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span className="text-[11px] font-medium">IDAC Duty:</span>
                      <span className="font-mono font-black text-teal-600 dark:text-teal-400">{fl.totalIDAC}</span>
                    </div>
                    <div className="flex justify-between text-slate-900 dark:text-slate-100 font-black border-t border-slate-200 dark:border-slate-700 pt-2 text-xs">
                      <span>Total Assigned Duties:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm font-black">
                        {fl.totalAll}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Duty Equity Monitor */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Highest Duty Load */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 max-h-[500px] overflow-y-auto">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center space-x-2 sticky top-0 bg-white dark:bg-slate-900 py-2">
                <AlertCircle className="w-4 h-4" />
                <span>{selectedFlight ? `Highest Duty Load (${selectedFlight} Flight)` : 'Highest Duty Load Personnel (Top 5)'}</span>
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {highestDuties.map((s) => {
                  const airman = airmanMap.get(s.airmanId);
                  const effectiveCount = getDutyCountExcludingAirfield(s);
                  return (
                    <div key={s.airmanId} className="py-2.5 flex items-center justify-between">
                      <div>
                        <button
                          onClick={() => airman && onViewProfile(airman)}
                          className="font-black text-slate-900 dark:text-slate-100 hover:text-emerald-600 text-left"
                        >
                          {s.rank} {s.airmanName}
                        </button>
                        <p className="text-[11px] text-slate-400 font-semibold">{s.flightName} Flight</p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm text-red-600 dark:text-red-400 font-mono">
                          {effectiveCount} Duties
                        </span>
                        <div className="text-[10px] text-slate-400 font-medium">
                          GD:{s.totalGD} | BTF:{s.totalBTF} | NTF:{s.totalNTF} | HTF:{s.totalHalishahar} | IDAC:{s.totalIDAC || 0}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lowest Duty Load */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 max-h-[500px] overflow-y-auto">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center space-x-2 sticky top-0 bg-white dark:bg-slate-900 py-2">
                <Award className="w-4 h-4" />
                <span>{selectedFlight ? `Lowest Duty Load (${selectedFlight} Flight)` : 'Lowest Duty Load Personnel (Top 5)'}</span>
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {lowestDuties.map((s) => {
                  const airman = airmanMap.get(s.airmanId);
                  const effectiveCount = getDutyCountExcludingAirfield(s);
                  return (
                    <div key={s.airmanId} className="py-2.5 flex items-center justify-between">
                      <div>
                        <button
                          onClick={() => airman && onViewProfile(airman)}
                          className="font-black text-slate-900 dark:text-slate-100 hover:text-emerald-600 text-left"
                        >
                          {s.rank} {s.airmanName}
                        </button>
                        <p className="text-[11px] text-slate-400 font-semibold">{s.flightName} Flight</p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-sm text-emerald-600 dark:text-emerald-400 font-mono">
                          {effectiveCount} Duties
                        </span>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Leave: {s.totalLeave} Days
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      </div>
      {/* Duty Details Modal */}
      {selectedDuty && (
        <DutyDetailsModal
          dutyId={selectedDuty}
          assignments={filteredAssignments}
          airmen={airmen}
          onClose={() => setSelectedDuty(null)}
          onViewProfile={onViewProfile}
          currentYear={currentYear}
          currentMonth={currentMonth}
          selectedFlight={selectedFlight}
        />
      )}
    </div>
  );
};

// Modal Component for Duty Details
const DutyDetailsModal: React.FC<{
  dutyId: string;
  assignments: DutyAssignment[];
  airmen: Airman[];
  currentYear: number;
  currentMonth: number;
  selectedFlight?: FlightName | null;
  onClose: () => void;
  onViewProfile: (airman: Airman, config?: any) => void;
}> = ({ dutyId, assignments, airmen, currentYear, currentMonth, selectedFlight, onClose, onViewProfile }) => {
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [modalFlight, setModalFlight] = useState<FlightName | null>(selectedFlight || null);

  const mapDutyIdToType = (id: string) => {
    if (id === 'GD') return 'GD';
    if (id === 'BTF') return 'BTF';
    if (id === 'NTF') return 'NTF';
    if (id === 'HTF') return 'HALISHAHAR';
    if (id === 'AIRPORT') return 'AIRPORT';
    if (id === 'IDAC') return 'IDAC';
    return '';
  };

  const targetType = mapDutyIdToType(dutyId);

  const rawRelevantAssignments = assignments.filter(a => {
    if (dutyId === 'ALL') {
      return ['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA'].includes(a.dutyCode);
    }
    if (dutyId === 'IDAC') {
      return a.dutyCode === 'IDAC' || a.dutyCode === 'IDA';
    }
    return a.dutyCode === targetType;
  });
  
  const uniqueRelevantAssignmentsMap = new Map();
  rawRelevantAssignments.forEach(a => {
      const key = a.airmanId + '-' + a.date + '-' + a.dutyCode + '-' + (a.idaShift || '');
      if (!uniqueRelevantAssignmentsMap.has(key)) {
          uniqueRelevantAssignmentsMap.set(key, a);
      }
  });
  const relevantAssignments = Array.from(uniqueRelevantAssignmentsMap.values());
  

  const uniqueAirmanIds = Array.from(new Set(relevantAssignments.map(a => a.airmanId)));
  const isHeavyDuty = ['GD', 'BTF', 'NTF', 'AIRPORT', 'HALISHAHAR', 'IDAC'].includes(dutyId);
  const dutyAirmen = airmen
    .filter(a => {
      if (!a.active) return false;
      if (modalFlight && a.flightName !== modalFlight) return false;
      return uniqueAirmanIds.includes(a.id);
    })
    .sort((a, b) => {
      const getUniqueCount = (id: string) => {
        return relevantAssignments.filter(x => x.airmanId === id).length;
      };
      const aCount = getUniqueCount(a.id);
      const bCount = getUniqueCount(b.id);
      if (bCount !== aCount) return bCount - aCount;
      return a.serNo - b.serNo;
    });

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const allDaysMatrix = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const activeDaysMatrix = new Set(
    relevantAssignments.map(a => parseInt(a.date.split('-')[2], 10))
  );
  const daysArray = allDaysMatrix.filter(day => activeDaysMatrix.has(day));

  const renderTableContent = () => (
    <table className="w-full text-left text-xs border-collapse">
      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/90 z-10 shadow-xs backdrop-blur-md print:static print:bg-white print:shadow-none print:text-black print:border-b-2 print:border-black">
        <tr>
          <th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 w-12 text-center">Ser</th>
          <th className="px-3 py-2.5 font-black text-slate-600 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 whitespace-nowrap" style={{ width: '1%' }}>Name</th>
          <th className="px-3 py-2.5 font-black text-emerald-600 dark:text-emerald-400 border-b border-r border-slate-200 dark:border-slate-700 w-16 text-center">Total</th>
          {daysArray.map(day => {
            const dateObj = new Date(currentYear, currentMonth - 1, day);
            const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            return (
              <th key={day} className="px-1 py-2 font-bold text-slate-600 dark:text-slate-400 border-b border-r border-slate-200 dark:border-slate-700 w-10 text-center leading-tight">
                <div className="text-[14px]">{day}</div>
                <div className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">{dayOfWeek}</div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {dutyAirmen.map((airman, idx) => (
          <tr key={airman.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
            <td className="px-3 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center font-bold text-slate-500">
              {idx + 1}
            </td>
            <td className="px-3 py-2 border-b border-r border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 cursor-pointer hover:text-emerald-600 whitespace-nowrap" onClick={() => onViewProfile(airman)}>
              {airman.rank} {airman.name}
            </td>
            <td className="px-3 py-2 border-b border-r border-slate-200 dark:border-slate-700 text-center">
              <span className="inline-flex items-center justify-center min-w-[28px] h-7 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-black rounded-lg text-[13px]">
                {relevantAssignments.filter(a => a.airmanId === airman.id).length}
              </span>
            </td>
            {daysArray.map(day => {
              const dateStr = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
              const assignmentsOnDateRaw = relevantAssignments
                .filter(a => a.airmanId === airman.id && a.date === dateStr);
                
              const uniqueMap = new Map();
              assignmentsOnDateRaw.forEach(a => {
                  const key = a.dutyCode + '-' + (a.idaShift || '');
                  if (!uniqueMap.has(key)) {
                      uniqueMap.set(key, a);
                  }
              });
              const assignmentsOnDate = Array.from(uniqueMap.values())
                .sort((a, b) => {
                  const getWeight = (shift) => {
                    if (shift === 'Morning') return 1;
                    if (shift === 'Afternoon') return 2;
                    if (shift === 'Night') return 3;
                    return 0;
                  };
                  return getWeight(a.idaShift) - getWeight(b.idaShift);
                });
              return (
                <td key={day} className="p-0 border-b border-r border-slate-200 dark:border-slate-700 text-center relative group">
                  {assignmentsOnDate.length > 0 ? (
                    <div className="w-full h-full min-h-[30px] flex flex-col items-center justify-center bg-emerald-50 dark:bg-emerald-900/20" title={assignmentsOnDate.map(a => a.dutyCode).join(', ')}>
                      {assignmentsOnDate.map((a, i) => {
                        let label = a.dutyCode;
                        if (dutyId === 'IDAC' || dutyId === 'ALL') {
                          if (a.dutyCode === 'IDAC' || a.dutyCode === 'IDA') {
                            if (a.idaShift === 'Morning') label = 'IDAC-A';
                            else if (a.idaShift === 'Afternoon') label = 'IDAC-B';
                            else if (a.idaShift === 'Night') label = 'IDAC-C';
                            else label = 'IDAC-A'; // Default fallback
                          } else {
                            label = label.substring(0, 3);
                          }
                        } else {
                          label = label.substring(0, 3);
                        }
                        return (
                          <span key={i} className="text-[9px] leading-tight font-black text-emerald-700 dark:text-emerald-400">
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs print:static print:inset-auto print:p-0 print:bg-transparent print:backdrop-blur-none print:z-auto print:block print:w-full">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none print:rounded-none print:max-w-full print:max-h-none print:h-auto print:bg-white print:text-black print:overflow-visible print:block">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 justify-between items-center bg-slate-50 dark:bg-slate-800/50 print:bg-white print:border-none print:px-0 print:py-2 print:text-black">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>{dutyId} Duty Matrix - {currentMonth}/{currentYear}</span>
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">
              Showing {dutyAirmen.length} airmen {modalFlight ? `(${modalFlight} Flight)` : '(All Flights)'}
            </p>
          </div>
          
          <div className="flex items-center space-x-3 print:hidden">
            {/* Flight Tabs */}
            <div className="flex items-center bg-slate-200/80 dark:bg-slate-700/80 p-1 rounded-xl">
              <button
                onClick={() => setModalFlight(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  modalFlight === null
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All
              </button>
              {(['Avionics', 'Mechanics', 'GCS', 'Admin'] as FlightName[]).map(fl => (
                <button
                  key={fl}
                  onClick={() => setModalFlight(fl)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    modalFlight === fl
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {fl.substring(0, 3)}
                </button>
              ))}
            </div>

            <div className="flex items-center space-x-1 border-l border-slate-200 dark:border-slate-700 pl-2">
              <button onClick={() => setShowPrintPreview(true)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors" title="Print Matrix">
                <Printer className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
              <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors" title="Close">
                <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-0 overflow-auto flex-1 print:overflow-visible print:h-auto print:flex-none print:block">
          {dutyAirmen.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-bold">
              No assignments found for this duty.
            </div>
          ) : renderTableContent()}
        </div>
      </div>

      {/* Print Preview Portal */}
      {showPrintPreview && createPortal(
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900/90 backdrop-blur-sm overflow-hidden print:bg-white print:static print:h-auto print:w-auto print:overflow-visible print:block">
          <div className="flex-none bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between shadow-2xl print:hidden z-10 sticky top-0">
            <h2 className="text-white font-bold text-lg">Print Preview</h2>
            <div className="flex items-center space-x-3 text-white">
              <button
                onClick={() => window.print()}
                className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>Official Export / Print</span>
              </button>
              <button
                onClick={() => setShowPrintPreview(false)}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer"
              >
                <span>Close</span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-slate-800 p-4 sm:p-8 flex justify-center print:bg-white print:p-0 print:block print:overflow-visible h-[calc(100vh-80px)]">
            <div className="bg-white text-black p-8 sm:p-12 shadow-2xl max-w-[1200px] w-full mx-auto print:shadow-none print:p-0 print:w-full print:max-w-none print:m-0 h-max min-h-full">
              <div className="text-center mb-6 border-b-2 border-black pb-4">
                <h1 className="text-2xl font-black">{dutyId} Duty Matrix</h1>
                <p className="text-sm font-bold mt-1">Month: {currentMonth}/{currentYear}</p>
              </div>
              <div className="overflow-x-auto">
                {renderTableContent()}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

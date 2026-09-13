const fs = require('fs');
const content = `import React, { useState, useEffect, useMemo } from 'react';
import { Airman, AirmanDutyStats, ConflictAlert, FlightName, DutyAssignment } from '../types';
import { DUTY_TYPES, DUTY_TYPE_MAP } from '../data/dutyTypes';
import { BarChart3, ShieldCheck, AlertCircle, Award, Scale, Layers, RefreshCw, Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { calculateDutyStats, getDaysInMonth } from '../data/rosterGenerator';

interface DutyAnalyticsProps {
  airmen: Airman[];
  onViewProfile: (airman: Airman) => void;
}

export const DutyAnalytics: React.FC<DutyAnalyticsProps> = ({ airmen, onViewProfile }) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1);

  const monthKey = \`\${currentYear}-\${currentMonth.toString().padStart(2, '0')}\`;

  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  const [customHolidays, setCustomHolidays] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('baf_custom_holidays') || '[]');
    } catch {
      return [];
    }
  });

  const [filterMode, setFilterMode] = useState<'ALL' | 'HOLIDAY'>('ALL');
  const [selectedFlight, setSelectedFlight] = useState<FlightName | null>(null);
  
  const [selectedDuty, setSelectedDuty] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(\`/api/analytics?month=\${monthKey}\`);
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
    const handleGlobalUpdate = () => fetchAnalytics();
    window.addEventListener('baf_state_updated', handleGlobalUpdate);
    return () => window.removeEventListener('baf_state_updated', handleGlobalUpdate);
  }, [monthKey]);

  // Holiday Logic
  const handleToggleHoliday = (dateStr: string) => {
    setCustomHolidays((prev) => {
      const updated = prev.includes(dateStr)
        ? prev.filter((d) => d !== dateStr)
        : [...prev, dateStr];
      try {
        localStorage.setItem('baf_custom_holidays', JSON.stringify(updated));
      } catch (err) {}
      return updated;
    });
  };

  const isHolidayDate = (dateStr: string, dObj: Date) => {
    const isWeekend = dObj.getDay() === 5 || dObj.getDay() === 6; // Friday / Saturday
    return isWeekend || customHolidays.includes(dateStr);
  };

  // Recalculate stats based on filters
  const filteredAssignments = useMemo(() => {
    if (filterMode === 'ALL') return assignments;
    return assignments.filter(a => {
      const dateObj = new Date(a.date);
      return isHolidayDate(a.date, dateObj);
    });
  }, [assignments, filterMode, customHolidays]);

  const stats = useMemo(() => {
    return calculateDutyStats(airmen, filteredAssignments, currentYear, currentMonth);
  }, [airmen, filteredAssignments, currentYear, currentMonth]);

  const totals = useMemo(() => {
    return stats.reduce((acc, s) => {
      acc.totalGD = (acc.totalGD || 0) + (s.totalGD || 0);
      acc.totalBTF = (acc.totalBTF || 0) + (s.totalBTF || 0);
      acc.totalNTF = (acc.totalNTF || 0) + (s.totalNTF || 0);
      acc.totalHalishahar = (acc.totalHalishahar || 0) + (s.totalHalishahar || 0);
      acc.totalAirport = (acc.totalAirport || 0) + (s.totalAirport || 0);
      acc.totalIDAC = (acc.totalIDAC || 0) + (s.totalIDAC || 0);
      return acc;
    }, {} as any);
  }, [stats]);

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
    <div className="space-y-6 relative">
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between mb-4 gap-4">
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Duty Analysis & Fairness Equity Monitor</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Workload distribution, duty posts, and flight comparisons.
            </p>
          </div>
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 shadow-inner">
            <button
              onClick={() => setFilterMode('ALL')}
              className={\`px-4 py-2 rounded-lg text-xs font-bold transition-all \${filterMode === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}\`}
            >
              All Days
            </button>
            <button
              onClick={() => setFilterMode('HOLIDAY')}
              className={\`px-4 py-2 rounded-lg text-xs font-bold transition-all \${filterMode === 'HOLIDAY' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}\`}
            >
              Holidays Only
            </button>
          </div>
        </div>

        {/* Full Calendar */}
        <div className="border border-slate-200 dark:border-slate-700/50 rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50">
            <button
              onClick={() => {
                if (currentMonth === 1) { setCurrentMonth(12); setCurrentYear(y => y - 1); }
                else setCurrentMonth(m => m - 1);
              }}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-200">
              {monthNames[currentMonth - 1]} {currentYear}
            </h2>
            <button
              onClick={() => {
                if (currentMonth === 12) { setCurrentMonth(1); setCurrentYear(y => y + 1); }
                else setCurrentMonth(m => m + 1);
              }}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center border-b border-slate-200 dark:border-slate-700/50 bg-slate-100 dark:bg-slate-800/80">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-white dark:bg-slate-900">
            {emptyCells.map(i => (
              <div key={\`empty-\${i}\`} className="p-2 border-b border-r border-slate-100 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-900/20" />
            ))}
            {daysArray.map(day => {
              const dateStr = \`\${currentYear}-\${currentMonth.toString().padStart(2, '0')}-\${day.toString().padStart(2, '0')}\`;
              const dObj = new Date(currentYear, currentMonth - 1, day);
              const isHoliday = isHolidayDate(dateStr, dObj);
              return (
                <button
                  key={day}
                  onClick={() => handleToggleHoliday(dateStr)}
                  title="Click to toggle custom holiday"
                  className={\`p-3 border-b border-r border-slate-100 dark:border-slate-800/50 flex flex-col items-center justify-center transition-colors \${isHoliday ? 'bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}\`}
                >
                  <span className={\`text-sm font-bold \${isHoliday ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}\`}>
                    {day}
                  </span>
                  {isHoliday && <span className="text-[9px] font-bold text-red-500 dark:text-red-400 uppercase mt-0.5">Holiday</span>}
                </button>
              );
            })}
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
          {/* Overview Cards (Full names for all duties) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { id: 'GD', label: 'Base Security Duty', count: totals.totalGD || 0, color: 'red' },
              { id: 'BTF', label: 'Base Taskforce Duty', count: totals.totalBTF || 0, color: 'amber' },
              { id: 'NTF', label: 'Najirpara Taskforce', count: totals.totalNTF || 0, color: 'orange' },
              { id: 'HTF', label: 'Halishahar Taskforce', count: totals.totalHalishahar || 0, color: 'blue' },
              { id: 'AIRPORT', label: 'Airfield Duty', count: totals.totalAirport || 0, color: 'cyan' },
              { id: 'IDAC', label: 'IDAC Duty', count: totals.totalIDAC || 0, color: 'teal' },
            ].map(duty => (
              <button
                key={duty.id}
                onClick={() => setSelectedDuty(duty.id)}
                className={\`bg-white dark:bg-slate-900 border border-\${duty.color}-200 dark:border-\${duty.color}-900/60 rounded-2xl p-3.5 shadow-xs text-left hover:scale-[1.02] transition-transform\`}
              >
                <span className={\`text-[10px] font-black text-\${duty.color}-600 dark:text-\${duty.color}-400 uppercase tracking-wider block\`}>
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
                  className={\`text-left p-4 rounded-2xl border transition-all shadow-xs \${selectedFlight === fl.flightName ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 ring-1 ring-emerald-500' : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-800'}\`}
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
                <span>{selectedFlight ? \`Highest Duty Load (\${selectedFlight} Flight)\` : 'Highest Duty Load Personnel (Top 5)'}</span>
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
                <span>{selectedFlight ? \`Lowest Duty Load (\${selectedFlight} Flight)\` : 'Lowest Duty Load Personnel (Top 5)'}</span>
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

      {/* Duty Details Modal */}
      {selectedDuty && (
        <DutyDetailsModal
          dutyId={selectedDuty}
          assignments={filteredAssignments}
          airmen={airmen}
          onClose={() => setSelectedDuty(null)}
          onViewProfile={onViewProfile}
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
  onClose: () => void;
  onViewProfile: (airman: Airman) => void;
}> = ({ dutyId, assignments, airmen, onClose, onViewProfile }) => {
  const airmanMap = new Map(airmen.map(a => [a.id, a]));
  
  const mapDutyIdToType = (id: string) => {
    if (id === 'GD') return 'GD';
    if (id === 'BTF') return 'BTF';
    if (id === 'NTF') return 'NTF';
    if (id === 'HTF') return 'Halishahar';
    if (id === 'AIRPORT') return 'Airport';
    if (id === 'IDAC') return 'IDAC';
    return '';
  };

  const targetType = mapDutyIdToType(dutyId);

  const relevantAssignments = assignments.filter(a => {
    if (dutyId === 'IDAC') {
      return a.dutyType === 'IDAC_MORNING' || a.dutyType === 'IDAC_AFTERNOON' || a.dutyType === 'IDAC_NIGHT' || a.dutyType === 'IDAC';
    }
    return a.dutyType === targetType;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Duty Detailed View</span>
            </h2>
            <p className="text-xs text-slate-500 font-semibold mt-1">Showing all records for this duty type</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          {relevantAssignments.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No assignments found for this duty.
            </div>
          ) : (
            <div className="space-y-3">
              {relevantAssignments.map((a, i) => {
                const airman = airmanMap.get(a.airmanId);
                return (
                  <div key={\`\${a.airmanId}-\${a.date}-\${i}\`} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                    <div>
                      <span className="text-xs font-bold text-slate-400 block mb-1">
                        {new Date(a.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      {airman ? (
                        <button
                          onClick={() => { onClose(); onViewProfile(airman); }}
                          className="font-black text-sm text-slate-900 dark:text-slate-100 hover:text-emerald-600 text-left flex items-center space-x-2"
                        >
                          <span>{airman.rank} {airman.name}</span>
                        </button>
                      ) : (
                        <span className="font-bold text-sm text-slate-500">Unknown Airman ({a.airmanId})</span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-3 py-1 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                        {a.dutyType}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
`
fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

import { DateNavigator } from './DateNavigator';
import React, { useState } from 'react';
import { Airman, FlightName, IDAShift } from '../types';
import { X, Calendar, Clock, User, Check, RefreshCw, Sparkles, Shield } from 'lucide-react';
import { sortAirmenBySeniority } from '../utils/seniority';
import { getFlightDutyQuotaForDate, getIdacShiftsForDateAndFlight, getFlightsForIdacShift } from '../data/officialDutyRatioMatrix';


const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
interface IdacDutyAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  airmen: Airman[];
  selectedDate: string;
  onAssignSuccess: () => void;
}

export const IdacDutyAssignModal: React.FC<IdacDutyAssignModalProps> = ({
  isOpen,
  onClose,
  airmen,
  selectedDate,
  onAssignSuccess,
}) => {
  const [date, setDate] = useState<string>(selectedDate || new Date().toISOString().split('T')[0]);
  const [selectedFlight, setSelectedFlight] = useState<FlightName | ''>('');

  const [shift, setShift] = useState<IDAShift | "">("");
  const [selectedAirmanId, setSelectedAirmanId] = useState<string>('');
  const [notes, setNotes] = useState<string>('IDA Center Standby / Surveillance Monitor');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isAutoScheduling, setIsAutoScheduling] = useState<boolean>(false);
  const [autoScheduleDays, setAutoScheduleDays] = useState<number>(7);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const availableFlights = React.useMemo(() => {
    if (!shift) return [];
    return getFlightsForIdacShift(date, shift);
  }, [date, shift]);

  React.useEffect(() => {
    if (shift && availableFlights.length > 0) {
      if (!selectedFlight || !availableFlights.includes(selectedFlight as any)) {
        setSelectedFlight(availableFlights[0]);
      }
    } else if (!shift) {
      setSelectedFlight('');
    }
  }, [shift, availableFlights, selectedFlight]);

  // Filter airmen by flight
  const flightAirmen = sortAirmenBySeniority(airmen.filter((a) => a.flightName === selectedFlight));

  // Default airman selection
  React.useEffect(() => {
    if (flightAirmen.length > 0) {
      if (!selectedAirmanId || !flightAirmen.some((a) => a.id === selectedAirmanId)) {
        setSelectedAirmanId(flightAirmen[0].id);
      }
    }
  }, [selectedFlight, flightAirmen, selectedAirmanId]);

  if (!isOpen) return null;

  // Single Manual Assign
  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) {
      alert('Please select a shift');
      return;
    }
    if (!selectedFlight) {
      alert('Please select a flight');
      return;
    }
    if (!selectedAirmanId) {
      alert('Please select an airman');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('');
    try {
      const res = await fetch('/api/roster/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: selectedAirmanId,
          date,
          dutyCode: 'IDAC',
          idaShift: shift as IDAShift,
          notes,
        }),
      });

      if (res.ok) {
        setStatusMessage('✅ Shift assigned successfully.');
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
        onAssignSuccess();
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to assign duty.');
      }
    } catch (err: any) {
      alert('Network error while assigning duty.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Auto-Schedule IDAC Shifts maintaining Duty Ratio for X days
  const handleAutoSchedule = async () => {
    if (!confirm(`Generate IDAC schedule for ${autoScheduleDays} days maintaining Flight Duty Ratio?`)) return;

    setIsAutoScheduling(true);
    setStatusMessage('');
    try {
      const startDate = new Date(date);
      const assignmentsToPost: Array<{
        airmanId: string;
        date: string;
        dutyCode: string;
        idaShift: IDAShift;
        notes: string;
      }> = [];

      const flightList: FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];
      const shifts: IDAShift[] = ['Morning', 'Afternoon', 'Night'];

      // Keep round-robin pointers per flight
      const flightPointer: Record<FlightName, number> = {
        Avionics: 0,
        Mechanics: 0,
        GCS: 0,
        Admin: 0,
      };

      for (let i = 0; i < autoScheduleDays; i++) {
        const cur = new Date(startDate);
        cur.setDate(cur.getDate() + i);
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        shifts.forEach((sh) => {
          flightList.forEach((flt) => {
            const quota = getFlightDutyQuotaForDate(dateStr, flt, 'IDAC', sh);
            if (quota > 0) {
              const eligibleAirmen = airmen.filter((a) => a.flightName === flt);
              if (eligibleAirmen.length > 0) {
                for (let q = 0; q < quota; q++) {
                  const ptr = flightPointer[flt] % eligibleAirmen.length;
                  const assignedAirman = eligibleAirmen[ptr];
                  flightPointer[flt]++;

                  assignmentsToPost.push({
                    airmanId: assignedAirman.id,
                    date: dateStr,
                    dutyCode: 'IDAC',
                    idaShift: sh,
                    notes: `IDAC ${sh} Shift (${flt})`,
                  });
                }
              }
            }
          });
        });
      }

      // Post assignments
      const res = await fetch('/api/roster/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments: assignmentsToPost }),
      });

      if (res.ok) {
        setStatusMessage(`✅ Generated ${assignmentsToPost.length} IDAC shift assignments across ${autoScheduleDays} days.`);
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
        onAssignSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        alert('Failed to save generated roster.');
      }
    } catch (e: any) {
      alert('Error during auto-scheduling: ' + e.message);
    } finally {
      setIsAutoScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs select-none overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-none sm:rounded-3xl shadow-2xl overflow-hidden animate-scaleIn h-full sm:h-auto">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">
                Assign IDAC Duty
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Schedule individual shift or auto-generate maintaining duty ratio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-2xl text-center">
            {statusMessage}
          </div>
        )}

        <div className="p-6 space-y-6">
          {/* Manual Assignment Form */}
          <form onSubmit={handleManualAssign} className="space-y-4">
            <div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Manual Shift Assignment
            </div>

            {/* Date & Shift */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Duty Date
                </label>
                <DateNavigator
                  
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Shift Time
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value as IDAShift)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="" disabled>Select Shift</option>
                  {(['Morning', 'Afternoon', 'Night'] as IDAShift[]).map((s) => {
                    const timeLabel = s === 'Morning' ? '07:30 - 14:30' : s === 'Afternoon' ? '14:30 - 21:00' : '21:00 - 07:30';
                    return (
                      <option key={s} value={s}>
                        {s} ({timeLabel})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Flight Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Flight (Duty Ratio Allocation)
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {!shift && <div className="col-span-4 text-xs text-slate-500">Please select a shift first</div>}
                {shift ? (availableFlights.length > 0 ? availableFlights : (['Avionics', 'Mechanics', 'GCS', 'Admin'] as FlightName[])).map((flt) => (
                  <button
                    key={flt}
                    type="button"
                    onClick={() => setSelectedFlight(flt)}
                    disabled={availableFlights.length > 0 && !availableFlights.includes(flt)}
                    className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      selectedFlight === flt
                        ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {flt}
                  </button>
                )) : null}
              </div>
            </div>

            {/* Airman Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Select Airman ({selectedFlight} Flight)
              </label>
              <select
                value={selectedAirmanId}
                onChange={(e) => setSelectedAirmanId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-teal-500 cursor-pointer"
              >
                {flightAirmen.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatAirmanName(a.rank)} {a.name} ({a.trade})
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Duty Notes / Task
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. IDA Standby & Power Check"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{isSubmitting ? 'Saving...' : 'Assign Shift'}</span>
              </button>
            </div>
          </form>

          {/* Ratio-Based Auto Scheduling Card */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-xs font-black text-slate-800 dark:text-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Auto-Schedule IDAC by Flight Ratio</span>
              </div>
              <div className="flex items-center space-x-1">
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setAutoScheduleDays(d)}
                    className={`px-2 py-1 text-[11px] font-bold rounded-lg border cursor-pointer ${
                      autoScheduleDays === d
                        ? 'bg-amber-500 text-slate-950 border-amber-500 font-black'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {d} Days
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Automatically distributes Morning, Afternoon, and Night shifts starting from {date} according to official flight duty ratios (Avionics, Mechanics, GCS, Admin quotas).
            </p>

            <button
              type="button"
              onClick={handleAutoSchedule}
              disabled={isAutoScheduling}
              className="w-full py-2.5 px-4 bg-linear-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 rounded-xl text-xs font-black flex items-center justify-center space-x-2 cursor-pointer shadow-xs disabled:opacity-50"
            >
              {isAutoScheduling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Generating Schedule...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Generate {autoScheduleDays}-Day IDAC Schedule</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

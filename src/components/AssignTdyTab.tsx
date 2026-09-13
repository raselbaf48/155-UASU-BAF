import React, { useState, useMemo, useEffect } from 'react';
import { Airman, FlightName } from '../types';
import { getCurrentUserSession } from '../utils/authSession';
import { sortAirmenBySeniority } from '../utils/seniority';
import { DateNavigator } from './DateNavigator';
import { RefreshCw, Check } from 'lucide-react';


const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
interface AssignTdyTabProps {
  airmen: Airman[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignTdyTab: React.FC<AssignTdyTabProps> = ({ airmen, onClose, onSuccess }) => {
  const session = getCurrentUserSession();
  const isAdmin = session?.assignedRole === 'ADMIN';
  const adminFlight = session?.flightName;
  const isSuperAdmin = ((session?.assignedRole === 'SUPER_ADMIN' || session?.assignedRole === 'OWNER') || session?.assignedRole === 'OWNER');
  const todayStr = new Date().toISOString().split('T')[0];

  const [tdyFlight, setTdyFlight] = useState<FlightName>('Avionics');
  const [tdyAirmanId, setTdyAirmanId] = useState<string>('');
  
  // Date selection states
  const [tdyFromDate, setTdyFromDate] = useState<string>(todayStr);
  const [tdyToDate, setTdyToDate] = useState<string>(todayStr);
  
  const [tdyDestination, setTdyDestination] = useState<string>('');
  const [tdyCustomDestination, setTdyCustomDestination] = useState<string>('');
  const [tdyRemarks, setTdyRemarks] = useState<string>('');
  
  const [selectedPresetDays, setSelectedPresetDays] = useState<number | null>(1); // Default to Today
  const [savingTdy, setSavingTdy] = useState<boolean>(false);
  const [tdySuccessMsg, setTdySuccessMsg] = useState<string>('');

  useEffect(() => {
    if (isAdmin && adminFlight) {
      setTdyFlight(adminFlight);
    }
  }, [isAdmin, adminFlight]);

  const tdyAirmenList = useMemo(() => {
    return sortAirmenBySeniority(airmen.filter((a) => a.flightName === tdyFlight));
  }, [airmen, tdyFlight]);

  const handlePresetToggle = (days: number) => {
    if (days === 1) {
      const todayStr = new Date().toISOString().split('T')[0];
      setTdyFromDate(todayStr);
      setTdyToDate(todayStr);
      setSelectedPresetDays(1);
    } else {
      setSelectedPresetDays(days);
      if (tdyFromDate) {
        const d = new Date(tdyFromDate);
        d.setDate(d.getDate() + days - 1);
        setTdyToDate(d.toISOString().split('T')[0]);
      }
    }
  };

  const tdyDurationDays = useMemo(() => {
    if (!tdyFromDate || !tdyToDate) return 0;
    const f = new Date(tdyFromDate);
    const t = new Date(tdyToDate);
    return Math.max(0, Math.round((t.getTime() - f.getTime()) / (1000 * 3600 * 24)) + 1);
  }, [tdyFromDate, tdyToDate]);

  const handleGrantTdySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tdyAirmanId || !tdyFromDate || !tdyToDate || tdyFromDate > tdyToDate || !tdyDestination) {
      alert('Invalid date range, missing airman, or missing destination.');
      return;
    }
    const finalDest = tdyDestination === 'Custom' ? tdyCustomDestination : tdyDestination;
    if (tdyDestination === 'Custom' && !finalDest) {
      alert('Please enter custom destination');
      return;
    }

    setSavingTdy(true);
    setTdySuccessMsg('');

    try {
      const fullNotes = tdyRemarks.trim() ? `${finalDest} - ${tdyRemarks.trim()}` : finalDest;

      const res = await fetch('/api/roster/assign-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: tdyAirmanId,
          dutyCode: 'TDY',
          fromDate: tdyFromDate,
          toDate: tdyToDate,
          notes: fullNotes
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTdySuccessMsg('TDY recorded successfully!');
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
        setTimeout(() => {
          onSuccess();
        }, 800);
      } else {
        alert(data.error || 'Failed to record TDY');
      }
    } catch (err: any) {
      alert(`Failed to record TDY: ${err.message}`);
    } finally {
      setSavingTdy(false);
    }
  };

  const presetLocations = ['AIR HQ', 'BAF AKR', 'BAF BSR', 'BAF MTR', 'BAF CXB', 'BAF SMD'];

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-y-auto">
      <div className="p-4 space-y-4">
        {tdySuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl text-center">
            {tdySuccessMsg}
          </div>
        )}

        <form onSubmit={handleGrantTdySubmit} className="space-y-4">
          {/* Flight Filter Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Flight
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['Avionics', 'Mechanics', 'GCS', 'Admin'] as FlightName[]).map((flt) => {
                const isDisabledFlt = (isAdmin && adminFlight && flt !== adminFlight);
                return (
                  <button
                    key={flt}
                    type="button"
                    onClick={() => !isDisabledFlt && setTdyFlight(flt)}
                    disabled={isDisabledFlt}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      isDisabledFlt ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700' :
                      tdyFlight === flt
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

          {/* Select Airman */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Select Airman <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-semibold">
                {tdyAirmenList.length} Airmen in {tdyFlight}
              </span>
            </div>
            
            <select
              value={tdyAirmanId}
              onChange={(e) => setTdyAirmanId(e.target.value)}
              className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer ${
                !tdyAirmanId
                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50/40 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
              required
            >
              <option value="" disabled>— Select an Airman —</option>
              {tdyAirmenList.map((a) => (
                <option key={a.id} value={a.id}>{formatAirmanName(a.rank)} {a.name}</option>
              ))}
            </select>
          </div>

          {/* Destination */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Destination (Mandatory) <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
               {presetLocations.map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setTdyDestination(loc);
                      setTdyCustomDestination('');
                    }}
                    className={`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      tdyDestination === loc
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {loc}
                  </button>
               ))}
               <button
                  type="button"
                  onClick={() => setTdyDestination('Custom')}
                  className={`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    tdyDestination === 'Custom'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Custom
                </button>
            </div>
            
            {tdyDestination === 'Custom' && (
              <input
                type="text"
                value={tdyCustomDestination}
                onChange={(e) => setTdyCustomDestination(e.target.value)}
                placeholder="Enter custom destination..."
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer ${
                  !tdyCustomDestination ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-slate-700 focus:border-amber-500'
                }`}
                required
              />
            )}
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Remarks (Optional)
            </label>
            <input
              type="text"
              value={tdyRemarks}
              onChange={(e) => setTdyRemarks(e.target.value)}
              placeholder="Additional notes..."
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
            />
          </div>

          {/* Assignment Date Presets */}
          <div>
             <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                Assignment Date
              </label>
             <div className="grid grid-cols-5 gap-1.5 mb-3">
              {[{label: 'Today', val: 1}, {label: '2 Days', val: 2}, {label: '3 Days', val: 3}, {label: '7 Days', val: 7}, {label: '15 Days', val: 15}].map((opt) => {
                const isSelected = selectedPresetDays === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => handlePresetToggle(opt.val)}
                    className={`py-1.5 px-1 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs text-center border ${
                      isSelected
                        ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-500/50 shadow-sm'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 hover:text-amber-700 dark:hover:text-amber-300 hover:border-amber-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range (Dynamic based on Preset) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                From Date
              </label>
              <DateNavigator
                value={tdyFromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setTdyFromDate(val);
                  
                  if (!tdyToDate || tdyToDate < val) {
                    setTdyToDate(val);
                  }

                  // Keep To Date in sync if it's a single day selection
                  if (selectedPresetDays === 1 || selectedPresetDays === -1) {
                      setTdyToDate(val);
                      const todayStr = new Date().toISOString().split('T')[0];
                      setSelectedPresetDays(val === todayStr ? 1 : -1);
                  } else if (selectedPresetDays !== null) {
                      const d = new Date(val);
                      d.setDate(d.getDate() + selectedPresetDays - 1);
                      setTdyToDate(d.toISOString().split('T')[0]);
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
              />
            </div>
            
            {/* Show To Date only if > 1 day selected, or if user is manually overriding */}
            {selectedPresetDays !== 1 && selectedPresetDays !== -1 && (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    To Date
                  </label>
                  <DateNavigator
                    value={tdyToDate}
                    min={tdyFromDate}
                    onChange={(e) => {
                      setTdyToDate(e.target.value);
                      setSelectedPresetDays(null); // Custom end date removes preset
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                  />
                </div>
            )}
          </div>

          {/* Real-time Duration Summary */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Total TDY Span:</span>
              <span className="text-sm font-black text-amber-700 dark:text-amber-400">
                {tdyDurationDays} Calendar Day{tdyDurationDays > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Modal Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={savingTdy}
              className="px-5 py-2 text-xs font-black text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              {savingTdy ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm & Record TDY</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

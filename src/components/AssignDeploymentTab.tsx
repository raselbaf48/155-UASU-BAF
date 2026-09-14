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
interface AssignDeploymentTabProps {
  airmen: Airman[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignDeploymentTab: React.FC<AssignDeploymentTabProps> = ({ airmen, onClose, onSuccess }) => {
  const session = getCurrentUserSession();
  const isAdmin = session?.assignedRole === 'ADMIN';
  const adminFlight = session?.flightName;
  const isSuperAdmin = ((session?.assignedRole === 'SUPER_ADMIN' || session?.assignedRole === 'OWNER') || session?.assignedRole === 'OWNER');
  const todayStr = new Date().toISOString().split('T')[0];

  const [deploymentFlight, setDeploymentFlight] = useState<FlightName>('Avionics');
  const [deploymentAirmanId, setDeploymentAirmanId] = useState<string>('');
  const [deploymentFromDate, setDeploymentFromDate] = useState<string>(todayStr);
  const [deploymentToDate, setDeploymentToDate] = useState<string>(todayStr);
  const [deploymentLocation, setDeploymentLocation] = useState<string>('');
  const [deploymentCustomDestination, setDeploymentCustomDestination] = useState<string>('');
  const [deploymentRemarks, setDeploymentRemarks] = useState<string>('');
  
  const [selectedPresetDays, setSelectedPresetDays] = useState<number | null>(null);
  const [savingDeployment, setSavingDeployment] = useState<boolean>(false);
  const [deploymentSuccessMsg, setDeploymentSuccessMsg] = useState<string>('');

  useEffect(() => {
    if (isAdmin && adminFlight) {
      setDeploymentFlight(adminFlight);
    }
  }, [isAdmin, adminFlight]);

  const deploymentAirmenList = useMemo(() => {
    return sortAirmenBySeniority(airmen.filter((a) => a.flightName === deploymentFlight));
  }, [airmen, deploymentFlight]);

  const handlePresetToggle = (days: number) => {
    if (selectedPresetDays === days) {
      setSelectedPresetDays(null);
      setDeploymentToDate(deploymentFromDate);
    } else {
      setSelectedPresetDays(days);
      if (deploymentFromDate) {
        const d = new Date(deploymentFromDate);
        d.setDate(d.getDate() + days - 1);
        setDeploymentToDate(d.toISOString().split('T')[0]);
      }
    }
  };

  const deploymentDurationDays = useMemo(() => {
    if (!deploymentFromDate || !deploymentToDate) return 0;
    const f = new Date(deploymentFromDate);
    const t = new Date(deploymentToDate);
    return Math.max(0, Math.round((t.getTime() - f.getTime()) / (1000 * 3600 * 24)) + 1);
  }, [deploymentFromDate, deploymentToDate]);

  const handleGrantDeploymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deploymentAirmanId || !deploymentFromDate || !deploymentToDate || deploymentFromDate > deploymentToDate || !deploymentLocation) {
      alert('Invalid date range, missing airman, or missing destination.');
      return;
    }
    const finalDest = deploymentLocation === 'Custom' ? deploymentCustomDestination : deploymentLocation;
    if (deploymentLocation === 'Custom' && !finalDest) {
      alert('Please enter custom destination');
      return;
    }

    setSavingDeployment(true);
    setDeploymentSuccessMsg('');

    try {
      const fullNotes = finalDest;
      const dutyCodeToUse = finalDest === 'Canteen' ? 'CANTEEN' : finalDest.includes('Bake') ? 'BAKE_N_BITE' : 'ATT';

      const res = await fetch('/api/roster/assign-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: deploymentAirmanId,
          dutyCode: dutyCodeToUse,
          fromDate: deploymentFromDate,
          toDate: deploymentToDate,
          notes: fullNotes
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setDeploymentSuccessMsg('Deployment recorded successfully!');
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
        setTimeout(() => {
          onSuccess();
        }, 800);
      } else {
        alert(data.error || 'Failed to record deployment');
      }
    } catch (err: any) {
      alert(`Failed to record deployment: ${err.message}`);
    } finally {
      setSavingDeployment(false);
    }
  };

  // Custom preset locations array to render nicely
  const presetLocations = ['Canteen', 'Bake & Bite'];

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-y-auto">
      <div className="p-4 space-y-4">
        {deploymentSuccessMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl text-center">
            {deploymentSuccessMsg}
          </div>
        )}

        <form onSubmit={handleGrantDeploymentSubmit} className="space-y-4">
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
                    onClick={() => !isDisabledFlt && setDeploymentFlight(flt)}
                    disabled={isDisabledFlt}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                      isDisabledFlt ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700' :
                      deploymentFlight === flt
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
                {deploymentAirmenList.length} Airmen in {deploymentFlight}
              </span>
            </div>
            
            <select
              value={deploymentAirmanId}
              onChange={(e) => setDeploymentAirmanId(e.target.value)}
              className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer ${
                !deploymentAirmanId
                  ? 'border-amber-400 dark:border-amber-600 bg-amber-50/40 dark:bg-amber-950/20'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
              required
            >
              <option value="" disabled>— Select an Airman —</option>
              {deploymentAirmenList.map((a) => (
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
                      setDeploymentLocation(loc);
                      setDeploymentCustomDestination('');
                    }}
                    className={`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      deploymentLocation === loc
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {loc}
                  </button>
               ))}
               <button
                  type="button"
                  onClick={() => setDeploymentLocation('Custom')}
                  className={`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    deploymentLocation === 'Custom'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Custom
                </button>
            </div>
            
            {deploymentLocation === 'Custom' && (
              <input
                type="text"
                value={deploymentCustomDestination}
                onChange={(e) => setDeploymentCustomDestination(e.target.value)}
                placeholder="Enter custom deployment location..."
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer ${
                  !deploymentCustomDestination ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'
                }`}
                required
              />
            )}
          </div>



          {/* Date Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                From Date
              </label>
              <DateNavigator
                value={deploymentFromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setDeploymentFromDate(val);
                  
                  if (!deploymentToDate || deploymentToDate < val) {
                    setDeploymentToDate(val);
                  }
                  
                  if (selectedPresetDays !== null) {
                    const d = new Date(val);
                    d.setDate(d.getDate() + selectedPresetDays - 1);
                    setDeploymentToDate(d.toISOString().split('T')[0]);
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
                value={deploymentToDate}
                min={deploymentFromDate}
                onChange={(e) => {
                  setDeploymentToDate(e.target.value);
                  setSelectedPresetDays(null);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Presets & Real-time Duration */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Quick Deployment Duration Presets:</span>
              <span className="text-[11px] text-slate-400">Sets 'To Date' automatically</span>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {[3, 7, 14, 30, 60].map((days) => {
                const isSelected = selectedPresetDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handlePresetToggle(days)}
                    className={`py-2 px-1 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs text-center border ${
                      isSelected
                        ? 'bg-teal-600 text-white border-teal-600 ring-2 ring-teal-500/50 shadow-sm'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-teal-50 dark:hover:bg-teal-950/50 hover:text-teal-700 dark:hover:text-teal-300 hover:border-teal-300'
                    }`}
                  >
                    {days} Days
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700/80 pt-3 mt-1">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Total Deployment Span:</span>
              <span className="text-sm font-black text-teal-700 dark:text-teal-400">
                {deploymentDurationDays} Calendar Day{deploymentDurationDays > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Modal Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="submit"
              disabled={savingDeployment}
              className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              {savingDeployment ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirm & Record Deployment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

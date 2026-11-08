import React, { useState, useMemo, useEffect } from 'react';
import { Airman, FlightName, DutyAssignment } from '../types';
import { getCurrentUserSession } from '../utils/authSession';
import { sortAirmenBySeniority } from '../utils/seniority';
import { DateNavigator } from './DateNavigator';
import { RefreshCw, Check, AlertCircle } from 'lucide-react';
import { localDb } from '../services/localDatabase';
import { getAirmanDisposalForRange, AirmanDisposalStatus } from '../utils/airmanDisposalHelper';

import { formatRank, formatAirmanName } from '../utils/rankFormatter';

interface AssignDeploymentTabProps {
  airmen: Airman[];
  initialFromDate?: string;
  initialToDate?: string;
  initialFlight?: FlightName;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignDeploymentTab: React.FC<AssignDeploymentTabProps> = ({
  airmen,
  initialFromDate,
  initialToDate,
  initialFlight,
  onClose,
  onSuccess,
}) => {
  const session = getCurrentUserSession();
  const isAdmin = session?.assignedRole === 'ADMIN';
  const adminFlight = session?.flightName;
  const isSuperAdmin = ((session?.assignedRole === 'SUPER_ADMIN' || session?.assignedRole === 'OWNER') || session?.assignedRole === 'OWNER');
  const todayStr = new Date().toISOString().split('T')[0];

  const [deploymentFlight, setDeploymentFlight] = useState<FlightName>(
    initialFlight || (isAdmin && adminFlight ? adminFlight : 'Avionics')
  );
  const [deploymentAirmanId, setDeploymentAirmanId] = useState<string>('');
  const [deploymentFromDate, setDeploymentFromDate] = useState<string>(initialFromDate || todayStr);
  const [deploymentToDate, setDeploymentToDate] = useState<string>(initialToDate || initialFromDate || todayStr);
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

  const [assignmentsMap, setAssignmentsMap] = useState<Record<string, DutyAssignment[]>>(() => {
    return localDb.getDb()?.assignments || {};
  });

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await fetch('/api/duty-assignments');
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data === 'object') {
            setAssignmentsMap(data);
          }
        }
      } catch {
        setAssignmentsMap(localDb.getDb()?.assignments || {});
      }
    };
    fetchAssignments();

    const handleUpdate = () => {
      setAssignmentsMap({ ...(localDb.getDb()?.assignments || {}) });
    };
    window.addEventListener('baf_state_updated', handleUpdate);
    return () => window.removeEventListener('baf_state_updated', handleUpdate);
  }, []);

  const airmenDisposalMap = useMemo(() => {
    const map = new Map<string, AirmanDisposalStatus>();
    for (const a of deploymentAirmenList) {
      const status = getAirmanDisposalForRange(
        a.id,
        deploymentFromDate,
        deploymentToDate,
        assignmentsMap,
        'DEPLOYMENT'
      );
      map.set(a.id, status);
    }
    return map;
  }, [deploymentAirmenList, deploymentFromDate, deploymentToDate, assignmentsMap]);

  // If selected airman becomes disabled because date changed, deselect them
  useEffect(() => {
    if (deploymentAirmanId) {
      const status = airmenDisposalMap.get(deploymentAirmanId);
      if (status?.disabled) {
        setDeploymentAirmanId('');
      }
    }
  }, [airmenDisposalMap, deploymentAirmanId]);

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

    const status = airmenDisposalMap.get(deploymentAirmanId);
    if (status?.disabled) {
      alert(`Cannot assign Deployment: ${status.disabledReason || 'Selected airman has an active conflict during this date range.'}`);
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
              {deploymentAirmenList.map((a) => {
                const status = airmenDisposalMap.get(a.id);
                const disposalTag = status?.dropdownLabel ? ` — ${status.dropdownLabel}` : '';
                return (
                  <option
                    key={a.id}
                    value={a.id}
                    disabled={status?.disabled}
                    className={status?.disabled ? 'text-rose-500 font-bold bg-slate-100 dark:bg-slate-900' : ''}
                  >
                    {formatAirmanName(a.rank)} {a.name}{disposalTag}
                  </option>
                );
              })}
            </select>
            {deploymentAirmanId && airmenDisposalMap.get(deploymentAirmanId) && (
              <div className="mt-2 space-y-1.5">
                {airmenDisposalMap.get(deploymentAirmanId)?.disabled ? (
                  <div className="flex items-start space-x-2 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Cannot Assign Deployment (Active Conflict):</p>
                      <p className="text-[11px] mt-0.5">{airmenDisposalMap.get(deploymentAirmanId)?.disabledReason}</p>
                    </div>
                  </div>
                ) : airmenDisposalMap.get(deploymentAirmanId)?.dropdownLabel ? (
                  <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">
                      Disposal on Selected Date:
                    </span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">
                      {airmenDisposalMap.get(deploymentAirmanId)?.disposalSummary}
                    </span>
                  </div>
                ) : null}
              </div>
            )}
            {!deploymentAirmanId && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                * Please select an eligible airman (personnel on Deployment, Leave, or TDY are marked unavailable)
              </p>
            )}
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
                placeholder="Enter deployment base/location (e.g. Barishal, Bogura)"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none focus:border-emerald-500"
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
                  const newFrom = e.target.value;
                  setDeploymentFromDate(newFrom);
                  if (deploymentToDate < newFrom) setDeploymentToDate(newFrom);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                To Date
              </label>
              <DateNavigator
                value={deploymentToDate}
                min={deploymentFromDate}
                onChange={(e) => setDeploymentToDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 dark:text-white outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Preset Duration Buttons */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Preset Durations
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 3, 7, 15, 30].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => handlePresetToggle(days)}
                  className={`py-1.5 px-2 text-xs font-black rounded-lg border transition-all cursor-pointer ${
                    selectedPresetDays === days
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-1 ring-emerald-500'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {days === 1 ? '1 Day' : `${days} Days`}
                </button>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingDeployment || !deploymentAirmanId || !deploymentLocation || airmenDisposalMap.get(deploymentAirmanId)?.disabled}
              className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5"
            >
              {savingDeployment ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Assign Deployment</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

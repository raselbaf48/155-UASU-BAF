import React, { useState, useEffect } from 'react';
import { Airman, ConflictAlert } from '../types';
import { ShieldAlert, AlertTriangle, CheckCircle2, RefreshCw, Calendar, ArrowRight, User, Wrench, Check, Trash2 } from 'lucide-react';

interface DutyConflictMonitorProps {
  airmen: Airman[];
  onViewProfile: (airman: Airman) => void;
  onNavigateToRegister?: () => void;
}

export const DutyConflictMonitor: React.FC<DutyConflictMonitorProps> = ({
  airmen,
  onViewProfile,
  onNavigateToRegister,
}) => {
  const today = new Date();
  const [monthKey, setMonthKey] = useState<string>(
    `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}`
  );
  const [alerts, setAlerts] = useState<ConflictAlert[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [solvingId, setSolvingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/analytics?month=${monthKey}`);
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.conflictAlerts || []);
      }
    } catch (err) {
      console.error('Failed to load conflict alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const handleGlobalUpdate = () => {
      fetchAlerts();
    };
    window.addEventListener('baf_state_updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('baf_state_updated', handleGlobalUpdate);
    };
  }, [monthKey]);

  // Click to Solve specific conflict
  const handleSolveConflict = async (conflict: ConflictAlert, index: number) => {
    const alertKey = `alert-${conflict.airmanId}-${conflict.date}-${index}`;
    setSolvingId(alertKey);

    try {
      // First fetch current assignments for this date to determine the conflicting entry
      const mKey = conflict.date.slice(0, 7);
      const resRoster = await fetch(`/api/roster?month=${mKey}`);
      if (resRoster.ok) {
        const rosterData = await resRoster.json();
        const assignments: any[] = Array.isArray(rosterData.assignments)
          ? rosterData.assignments
          : Array.isArray(rosterData)
          ? rosterData
          : [];

        const dayAssignments = assignments.filter((a) => a.airmanId === conflict.airmanId && a.date === conflict.date);

        // If airman is on LEAVE or TDY alongside an operational duty, remove the operational duty
        const hasLeaveOrTdy = dayAssignments.some((a) => a.dutyCode === 'LEAVE' || a.dutyCode === 'TDY');
        const operationalDuty = dayAssignments.find((a) => a.dutyCode !== 'LEAVE' && a.dutyCode !== 'TDY');

        if (hasLeaveOrTdy && operationalDuty) {
          await fetch('/api/roster/delete-range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              airmanId: conflict.airmanId,
              fromDate: conflict.date,
              toDate: conflict.date,
              dutyCode: operationalDuty.dutyCode,
              idaShift: operationalDuty.idaShift,
            }),
          });
        } else if (dayAssignments.length > 1) {
          // If multiple operational duties assigned on same day, remove the duplicate
          const toRemove = dayAssignments[dayAssignments.length - 1];
          await fetch('/api/roster/delete-range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              airmanId: conflict.airmanId,
              fromDate: conflict.date,
              toDate: conflict.date,
              dutyCode: toRemove.dutyCode,
              idaShift: toRemove.idaShift,
            }),
          });
        } else if (dayAssignments.length === 1) {
          // If back-to-back night shift violation, remove the day's conflicting shift
          const toRemove = dayAssignments[0];
          await fetch('/api/roster/delete-range', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              airmanId: conflict.airmanId,
              fromDate: conflict.date,
              toDate: conflict.date,
              dutyCode: toRemove.dutyCode,
              idaShift: toRemove.idaShift,
            }),
          });
        }
      }

      setSuccessMsg(`✅ Conflict on ${conflict.date} resolved for ${conflict.airmanName}!`);
      window.dispatchEvent(new CustomEvent('baf_state_updated'));
      await fetchAlerts();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      console.error('Error solving conflict:', err);
      window.alert(`Failed to auto-resolve conflict: ${err.message}`);
    } finally {
      setSolvingId(null);
    }
  };

  // Solve all conflicts in batch
  const handleSolveAllConflicts = async () => {
    if (!confirm(`Are you sure you want to auto-reconcile all ${alerts.length} conflict(s)? Conflicting overlapping duties will be cleared.`)) {
      return;
    }
    setLoading(true);
    try {
      for (let i = 0; i < alerts.length; i++) {
        const alert = alerts[i];
        const mKey = alert.date.slice(0, 7);
        const resRoster = await fetch(`/api/roster?month=${mKey}`);
        if (resRoster.ok) {
          const rosterData = await resRoster.json();
          const assignments: any[] = Array.isArray(rosterData.assignments)
            ? rosterData.assignments
            : Array.isArray(rosterData)
            ? rosterData
            : [];
          const dayAssignments = assignments.filter((a) => a.airmanId === alert.airmanId && a.date === alert.date);
          const hasLeaveOrTdy = dayAssignments.some((a) => a.dutyCode === 'LEAVE' || a.dutyCode === 'TDY');
          const operationalDuty = dayAssignments.find((a) => a.dutyCode !== 'LEAVE' && a.dutyCode !== 'TDY');

          if (hasLeaveOrTdy && operationalDuty) {
            await fetch('/api/roster/delete-range', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                airmanId: alert.airmanId,
                fromDate: alert.date,
                toDate: alert.date,
                dutyCode: operationalDuty.dutyCode,
                idaShift: operationalDuty.idaShift,
              }),
            });
          }
        }
      }
      setSuccessMsg(`✅ All conflicts successfully auto-reconciled!`);
      window.dispatchEvent(new CustomEvent('baf_state_updated'));
      await fetchAlerts();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (e: any) {
      console.error('Error solving all conflicts:', e);
      alert(`Failed to resolve all conflicts: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const airmanMap = new Map(airmen.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 text-xs font-black uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Smart Duty Governance • 155 UASU BAF</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1">
            Duty Conflict Monitor
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Automatic detection of leave, TDY, back-to-back shift violations, and rest period compliance with 1-click auto-solve.
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-slate-400 font-medium">Month:</span>
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="bg-transparent font-black outline-none text-slate-900 dark:text-slate-100 cursor-pointer"
          />
        </div>
      </div>

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 rounded-xl text-emerald-800 dark:text-emerald-200 text-xs font-bold text-center flex items-center justify-center space-x-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Overview Status Banner */}
      {loading ? (
        <div className="p-16 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
          <p className="text-xs font-bold">Checking roster compliance...</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-md">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-emerald-900 dark:text-emerald-200">
            No Conflicts Detected (All Rosters Compliant)
          </h3>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 max-w-md mx-auto">
            All duty assignments for {monthKey} strictly adhere to BAF protocols. No overlapping duties, leave conflicts, or rest period violations found.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
              <div>
                <h4 className="text-xs font-black text-rose-900 dark:text-rose-200">
                  {alerts.length} Potential Conflict{alerts.length > 1 ? 's' : ''} Detected
                </h4>
                <p className="text-[11px] text-rose-700 dark:text-rose-400">
                  Use the 1-Click Solve buttons below or auto-reconcile all conflicts at once.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleSolveAllConflicts}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Auto-Solve All</span>
              </button>

              {onNavigateToRegister && (
                <button
                  onClick={onNavigateToRegister}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                >
                  Open Register
                </button>
              )}
            </div>
          </div>

          {/* Conflict Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {alerts.map((alert, index) => {
              const airman = airmanMap.get(alert.airmanId);
              const alertKey = `alert-${alert.airmanId}-${alert.date}-${index}`;
              const isSolvingThis = solvingId === alertKey;

              return (
                <div
                  key={alert.id ? `${alert.id}-${index}` : alertKey}
                  className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/60 rounded-2xl p-4 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                        {alert.ruleType || 'RULE CONFLICT'}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                        {alert.date}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 mt-2 flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{alert.airmanName}</span>
                    </h4>

                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 font-medium leading-relaxed">
                      {alert.message}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      disabled={isSolvingThis}
                      onClick={() => handleSolveConflict(alert, index)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-black flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      {isSolvingThis ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Solving...</span>
                        </>
                      ) : (
                        <>
                          <Wrench className="w-3 h-3" />
                          <span>Click to Solve</span>
                        </>
                      )}
                    </button>

                    {airman && (
                      <button
                        onClick={() => onViewProfile(airman)}
                        className="text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 flex items-center space-x-1 cursor-pointer"
                      >
                        <span>View Airman</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


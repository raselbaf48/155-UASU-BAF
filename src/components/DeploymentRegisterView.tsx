import { DateNavigator } from './DateNavigator';
import React, { useState, useEffect, useMemo } from 'react';
import { Airman, FlightName, UserRole } from '../types';
import { getCurrentUserSession } from '../utils/authSession';
import { Calendar, Search, Filter, Printer, Download, FileSpreadsheet, Eye, ShieldCheck, Plus, RefreshCw, X, Check, FileText, MapPin, History } from 'lucide-react';
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
interface DeploymentRegisterViewProps {
  role?: UserRole;
  airmen: Airman[];
  onViewProfile?: (airman: Airman, config?: any) => void;
}

interface AttRecord {
  airmanId: string;
  totalAttDays: number;
  currentlyOnAtt: boolean;
  currentAttLocation?: string;
  currentAttRange?: string;
  attEntries: Array<{
    date: string;
    notes?: string;
  }>;
}

export const DeploymentRegisterView: React.FC<DeploymentRegisterViewProps> = ({
  role = 'ADMIN',
  airmen: rawAirmen,
  onViewProfile,
}) => {
  const airmen = React.useMemo(() => rawAirmen.filter(a => a.active !== false), [rawAirmen]);
  const session = getCurrentUserSession();
  const isAdmin = session?.assignedRole === 'ADMIN';
  const isSuperAdmin = (role === 'SUPER_ADMIN' || role === 'OWNER');
  const adminFlight = session?.flightName;
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedFlight, setSelectedFlight] = useState<FlightName | 'All'>(isAdmin && adminFlight ? adminFlight : 'All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>(() => String(new Date().getFullYear()));
  const [summaryFilter, setSummaryFilter] = useState<'OnAtt' | 'TotalAtt' | 'Available' | null>(null);
  const [attData, setAttData] = useState<Record<string, AttRecord>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Grant / Record Deployment Modal
  const [showGrantAttModal, setShowGrantAttModal] = useState<boolean>(false);
  useEffect(() => {
    if (showGrantAttModal) {
      const activeIds = (Object.values(attData) as AttRecord[])
        .filter(rec => rec.currentlyOnAtt)
        .map(rec => rec.airmanId);
      setAttAirmanId('');
    }
  }, [showGrantAttModal, attData]);
  const [grantAttFlight, setGrantAttFlight] = useState<FlightName | 'All'>('All');
  const [attAirmanId, setAttAirmanId] = useState<string>('');
  const [attDestination, setAttDestination] = useState<string>('');
  const [attCustomDestination, setAttCustomDestination] = useState<string>('');
  const [attRemarks, setAttRemarks] = useState<string>('');
  const [attLocation, setAttLocation] = useState<string>('BAF Base Matiur Rahman');
  const [attFromDate, setAttFromDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [attToDate, setAttToDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [savingAtt, setSavingAtt] = useState<boolean>(false);
  const [attSuccessMsg, setAttSuccessMsg] = useState<string>('');
  const [selectedPresetDays, setSelectedPresetDays] = useState<number | null>(null);

  // Calculate calendar days in current Deployment selection
  const attDurationDays = useMemo(() => {
    try {
      const [sY, sM, sD] = attFromDate.split('-').map(Number);
      const [eY, eM, eD] = attToDate.split('-').map(Number);
      const curr = new Date(Date.UTC(sY, sM - 1, sD));
      const end = new Date(Date.UTC(eY, eM - 1, eD));
      const diff = Math.round((end.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return diff > 0 ? diff : 1;
    } catch {
      return 1;
    }
  }, [attFromDate, attToDate]);

  // Filter airmen for Grant Deployment Modal (Strictly 4 flights: Avionics, Mechanics, GCS, Admin)
  const grantAirmenList = useMemo(() => {
    const list = grantAttFlight === 'All' ? airmen : airmen.filter((a) => a.flightName === grantAttFlight);
    return sortAirmenBySeniority(list);
  }, [airmen, grantAttFlight]);

  // Selection is now multiple and defaults to none.
  // Allowed cross-flight selection

  // Apply preset duration
  const applyPresetDays = (days: number) => {
    try {
      setSelectedPresetDays(days);
      const [y, m, d] = attFromDate.split('-').map(Number);
      const start = new Date(Date.UTC(y, m - 1, d));
      start.setUTCDate(start.getUTCDate() + (days - 1));
      const endYear = start.getUTCFullYear();
      const endMonth = String(start.getUTCMonth() + 1).padStart(2, '0');
      const endDay = String(start.getUTCDate()).padStart(2, '0');
      setAttToDate(`${endYear}-${endMonth}-${endDay}`);
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch all assignments for the year to calculate Deployment days
  const fetchAttRecords = async () => {
    setLoading(true);
    try {
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
      const recordMap: Record<string, AttRecord> = {};

      airmen.forEach((a) => {
        recordMap[a.id] = {
          airmanId: a.id,
          totalAttDays: 0,
          currentlyOnAtt: false,
          attEntries: [],
        };
      });

      Object.keys(recordMap).forEach((airmanId) => {
        const rec = recordMap[airmanId];
        const airmanAttAssignments = allAssignments
          .filter((ass: any) => ass && ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(ass.dutyCode) && ass.airmanId === airmanId && ass.date)
          .reduce((acc: any[], curr: any) => {
            // Because we now store both deployment and base duties, 
            // deduplicate by date so we don't count the same day twice for deployments
            if (!acc.some(a => a.date === curr.date)) {
              acc.push(curr);
            }
            return acc;
          }, [])
          .sort((a: any, b: any) => a.date.localeCompare(b.date));

        airmanAttAssignments.forEach((ass: any) => {
          rec.totalAttDays++;
          rec.attEntries.push({
            date: ass.date,
            notes: ass.notes,
          });

          if (ass.date === todayStr) {
            rec.currentlyOnAtt = true;
            rec.currentAttLocation = ass.notes || 'Deployment Outstation';
          }
        });
      });

      setAttData(recordMap);
    } catch (err) {
      console.error('Failed to load Deployment records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttRecords();
    const handleGlobalUpdate = () => {
      fetchAttRecords();
    };
    window.addEventListener('baf_state_updated', handleGlobalUpdate);
    return () => {
      window.removeEventListener('baf_state_updated', handleGlobalUpdate);
    };
  }, [selectedYear, airmen]);

  // Handle Granting Deployment
  const handleGrantAttSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attAirmanId) {
      alert('Please select at least one airman');
      return;
    }
    if (!attDestination) {
      alert('Please select a destination');
      return;
    }
    const finalDest = attDestination === 'Custom' ? attCustomDestination : attDestination;
    if (attDestination === 'Custom' && !finalDest) {
      alert('Please enter custom destination');
      return;
    }

    if (!attFromDate || !attToDate || attFromDate > attToDate) {
      alert('Invalid date range');
      return;
    }

    setSavingAtt(true);
    try {
      const notes = finalDest;
      
      const dutyCodeToUse = finalDest === 'Canteen' ? 'CANTEEN' : finalDest.includes('Bake') ? 'BAKE_N_BITE' : 'ATT';
      await fetch('/api/roster/assign-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: attAirmanId,
          dutyCode: dutyCodeToUse,
          fromDate: attFromDate,
          toDate: attToDate,
          notes: notes,
        }),
      });

      setAttSuccessMsg(`✅ Deployment granted to 1 airman (${attDurationDays} days)!`);
      window.dispatchEvent(new CustomEvent('baf_state_updated'));
      await fetchAttRecords();
      setTimeout(() => {
        setShowGrantAttModal(false);
        setAttSuccessMsg('');
      }, 1300);
    } catch (err: any) {
      console.error('Error recording Deployment:', err);
      alert(`Failed to record Deployment: ${err.message}`);
    } finally {
      setSavingAtt(false);
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
      const rec = attData[a.id];
      if (summaryFilter === 'OnAtt' && (!rec || !rec.currentlyOnAtt)) return false;
      if (summaryFilter === 'TotalAtt' && (!rec || rec.totalAttDays <= 0)) return false;
      if (summaryFilter === 'Available' && (rec && rec.currentlyOnAtt)) return false;
    }
    return true;
  });

  // Calculate overall stats
  const attRecordsList: AttRecord[] = Object.values(attData);
  const totalAttDaysAll = attRecordsList.reduce((sum: number, r: AttRecord) => sum + r.totalAttDays, 0);
  const activeAttCount = attRecordsList.filter((r: AttRecord) => r.currentlyOnAtt).length;

  return (
    <div className="duty-register-print space-y-6">
      {/* Top Banner / Header Card */}
      <div className="bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden border border-slate-700/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <MapPin className="w-4 h-4" />
              <span>Temporary Duty (Deployment) Tracking</span>
              <span>•</span>
              <span>155 UASU BAF</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Annual Deployment Register
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Official register of Temporary Duty (Deployment), outstation detachments, unit training courses, and temporary deployments across all flights.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none cursor-pointer backdrop-blur-xs transition-colors"
            >
              <option value="2026" className="text-slate-900">Year 2026</option>
              <option value="2025" className="text-slate-900">Year 2025</option>
              <option value="2027" className="text-slate-900">Year 2027</option>
            </select>

            <button
              onClick={() => setShowHistoryModal(true)}
              className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer backdrop-blur-xs"
              title="View all recorded duty and Deployment entry history"
            >
              <History className="w-4 h-4 text-emerald-300" />
              <span>Deployment History</span>
            </button>

            {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
              <button
                onClick={() => {
                  setAttAirmanId('');
                  setShowGrantAttModal(true);
                }}
                className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black shadow-lg shadow-emerald-900/30 transition-all cursor-pointer transform hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4" />
                <span>Grant / Record Deployment</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(() => {
          const currentList = attRecordsList.filter((r: any) => r.currentlyOnAtt);
          return (
            <div 
          onClick={() => setSummaryFilter(summaryFilter === 'OnAtt' ? null : 'OnAtt')}
          className={`bg-white dark:bg-slate-900 border rounded-xl p-4 shadow-xs flex flex-col h-full max-h-[140px] cursor-pointer transition-all ${summaryFilter === 'OnAtt' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}>
              <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 shrink-0 flex justify-between">
                <span>Currently On Deployment</span>
                
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

        <div 
          onClick={() => setSummaryFilter(summaryFilter === 'TotalAtt' ? null : 'TotalAtt')}
          className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all ${summaryFilter === 'TotalAtt' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Deployment Days ({selectedYear})</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalAttDaysAll} Days</h4>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Across All Flights</p>
          </div>
          <div className="p-3 bg-sky-50 dark:bg-sky-950/60 rounded-xl text-sky-600 dark:text-sky-400">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div 
          onClick={() => setSummaryFilter(summaryFilter === 'Available' ? null : 'Available')}
          className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 shadow-xs flex items-center justify-between cursor-pointer transition-all ${summaryFilter === 'Available' ? 'ring-2 ring-emerald-500 border-emerald-500' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-300'}`}>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Available Personnel</p>
            <h4 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{airmen.length - activeAttCount} Airmen</h4>
            <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">At Base Location</p>
          </div>
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Flight Filter + Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Flight Pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {(['All', 'Avionics', 'Mechanics', 'GCS', 'Admin'] as (FlightName | 'All')[]).map((fl) => {
            const isDisabledFlt = isAdmin && adminFlight && fl !== adminFlight;
            return (
            <button
              key={fl}
              onClick={() => !isDisabledFlt && setSelectedFlight(fl)}
              disabled={isDisabledFlt}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all shrink-0 ${
                isDisabledFlt ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600' :
                selectedFlight === fl
                  ? 'bg-emerald-600 text-white shadow-xs cursor-pointer'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer'
              }`}
            >
              {fl === 'All' ? 'All Flights' : `${fl} Flight`}
            </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, BD, rank..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Deployment Table */}
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
                <th className="py-3 px-3 text-center bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 font-black">
                  Total Deployment Days ({selectedYear})
                </th>
                <th className="py-3 px-4 text-center">Destination</th>
                <th className="py-3 px-4 text-center">Current Status</th>
                
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Loading Deployment Register...
                  </td>
                </tr>
              ) : filteredAirmen.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No airmen match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredAirmen.map((airman, idx) => {
                  const rec = attData[airman.id] || {
                    airmanId: airman.id,
                    totalAttDays: 0,
                    currentlyOnAtt: false,
                    attEntries: [],
                  };

                  return (
                    <tr
                      key={airman.id}
                      onClick={() => onViewProfile && onViewProfile(airman, { initialTab: 'history', initialCategory: 'ATT', historyOnly: true })}
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
                          onClick={() => onViewProfile && onViewProfile(airman, { initialTab: 'history', initialCategory: 'ATT', historyOnly: true })}
                          className="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline text-left cursor-pointer"
                          title="Click to view full duty & Deployment history"
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
                      <td className="py-3 px-3 text-center font-mono font-black text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20">
                        {rec.totalAttDays > 0 ? (
                          <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/70 rounded-full font-black text-xs">
                            {rec.totalAttDays} Days
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300 font-bold">
                        {rec.currentlyOnAtt ? (rec.currentAttLocation || 'Outstation') : '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {rec.currentlyOnAtt ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200 font-black text-[10px] animate-pulse">
                            On Deployment ({rec.currentAttLocation || 'Outstation'})
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            At Base
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

      {/* Grant / Record Deployment Modal */}
      {showGrantAttModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Grant / Record Deployment
                  </h3>
                  <p className="text-xs text-slate-400">Temporary Duty Outstation / Detachment</p>
                </div>
              </div>
              <button
                onClick={() => setShowGrantAttModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {attSuccessMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl text-center">
                {attSuccessMsg}
              </div>
            )}

            <form onSubmit={handleGrantAttSubmit} className="space-y-4">
              {/* Flight Selector (Strictly 4 Flights) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Flight
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {(['Avionics', 'Mechanics', 'GCS', 'Admin'] as FlightName[]).map((flt) => {
                    const isPastDate = attFromDate < todayStr;
                    const isDisabledFlt = (isAdmin && adminFlight && flt !== adminFlight) || (isPastDate && !isSuperAdmin);
                    const setterStateValue = grantAttFlight === flt; // This is a bit hacky, let's just do an exact replace depending on the file
                    return (
                    <button
                      key={flt}
                      type="button"
                      onClick={() => !isDisabledFlt && setGrantAttFlight(flt)}
                      disabled={isDisabledFlt}
                      className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                        isDisabledFlt ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700' :
                        grantAttFlight === flt
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
                    Select Airman
                  </label>
                  <span className="text-[11px] text-slate-400 font-semibold">
                    {grantAirmenList.length} Airmen in {grantAttFlight}
                  </span>
                </div>
                
                {attFromDate < todayStr && session?.assignedRole !== 'SUPER_ADMIN' && session?.assignedRole !== 'OWNER' ? (
                  <div className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-3 text-xs font-bold text-slate-500 text-center">
                    🚫 Cannot modify past dates.
                  </div>
                ) : (
                  <select
                  value={attAirmanId}
                  onChange={(e) => setAttAirmanId(e.target.value)}
                  className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer ${
                    !attAirmanId
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
              </div>

                            {/* Deployment Destination */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Destination (Mandatory) <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['Canteen', 'Bake & Bite'].map((dest) => (
                    <button
                      key={dest}
                      type="button"
                      onClick={() => {
                        setAttDestination(dest);
                        setAttCustomDestination('');
                      }}
                      className={`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                        attDestination === dest
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {dest}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAttDestination('Custom')}
                    className={`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      attDestination === 'Custom'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {attDestination === 'Custom' && (
                  <input
                    type="text"
                    value={attCustomDestination}
                    onChange={(e) => setAttCustomDestination(e.target.value)}
                    placeholder="Enter custom destination..."
                    className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer ${
                      !attCustomDestination ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'
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
                    
                    value={attFromDate}
                    onChange={(e) => {
                      const newFrom = e.target.value;
                      setAttFromDate(newFrom);
                      if (!attToDate || attToDate < newFrom) {
                        setAttToDate(newFrom);
                      }
                      if (selectedPresetDays !== null) {
                        const d = new Date(newFrom);
                        d.setDate(d.getDate() + selectedPresetDays - 1);
                        setAttToDate(d.toISOString().split('T')[0]);
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
                    
                    value={attToDate}
                    min={attFromDate}
                    onChange={(e) => {
                      setAttToDate(e.target.value);
                      setSelectedPresetDays(null);
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Quick Presets (3, 7, 14, 30, 60 Days) */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">Quick Deployment Duration Presets:</span>
                  <span className="text-[11px] text-slate-400">Sets 'To Date' automatically</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[3, 7, 14, 30, 60].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => applyPresetDays(days)}
                      className={`py-1.5 px-1 bg-white dark:bg-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-black text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-2xs text-center ${
                        selectedPresetDays === days ? 'ring-2 ring-emerald-500 bg-emerald-50 text-emerald-800' : ''
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </div>

              {/* Total Duration Summary */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-400">Total Deployment Span:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {attDurationDays} Calendar Day{attDurationDays > 1 ? 's' : ''}
                </span>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrantAttModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAtt}
                  className="px-5 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-md shadow-emerald-900/20 transition-all cursor-pointer flex items-center space-x-1.5"
                >
                  {savingAtt ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Deployment...</span>
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
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <EntryHistoryModal
          airmen={airmen}
          filterType="DEPLOYMENT"
          onClose={() => setShowHistoryModal(false)}
          onRefreshData={() => {
            fetchAttRecords();
          }}
        />
      )}
    </div>
  );
};

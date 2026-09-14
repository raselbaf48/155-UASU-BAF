import { DateNavigator } from './DateNavigator';
import React, { useState, useEffect } from 'react';
import { Airman, DutyAssignment } from '../types';
import { X, Shield, Phone, MapPin, Award, Calendar, FileText, User, Filter, Printer, Clock, Settings, Trash2 } from 'lucide-react';
import { DUTY_TYPE_MAP } from '../data/dutyTypes';


const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
interface AirmanProfileModalProps {
  airman: Airman;
  onClose: () => void;
  onEditAirman?: (airman: Airman) => void;
  onRemoveAirman?: (airmanId: string) => void;
  role?: string;
  initialTab?: 'profile' | 'history';
  initialCategory?: string;
  historyOnly?: boolean;
}

export const AirmanProfileModal: React.FC<AirmanProfileModalProps> = ({ airman, onClose, onEditAirman, onRemoveAirman, role, initialTab = 'profile', initialCategory = 'ALL', historyOnly = false }) => {
  const [activeTab, setActiveTab] = useState<'history' | 'profile'>(historyOnly ? 'history' : initialTab);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
  });
  const [toDate, setToDate] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-${lastDay}`;
  });
  const [assignments, setAssignments] = useState<DutyAssignment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const [fromY, fromM] = fromDate.slice(0, 7).split('-').map(Number);
        const [toY, toM] = toDate.slice(0, 7).split('-').map(Number);
        const months: string[] = [];

        let curY = fromY;
        let curM = fromM;
        while (curY < toY || (curY === toY && curM <= toM)) {
          months.push(`${curY}-${String(curM).padStart(2, '0')}`);
          curM++;
          if (curM > 12) {
            curM = 1;
            curY++;
          }
          if (months.length > 24) break;
        }

        const promises = months.map((mKey) =>
          fetch(`/api/roster?month=${mKey}`)
            .then(async (res) => {
              if (!res.ok) return [];
              const data = await res.json();
              if (data && Array.isArray(data.assignments)) {
                return data.assignments as DutyAssignment[];
              }
              if (Array.isArray(data)) {
                return data as DutyAssignment[];
              }
              return [];
            })
            .catch(() => [] as DutyAssignment[])
        );

        const results = await Promise.all(promises);
        const all: DutyAssignment[] = results.flat();
        const airmanAss = all.filter(
          (a) => a && a.airmanId === airman.id && a.date >= fromDate && a.date <= toDate
        );
        airmanAss.sort((a, b) => a.date.localeCompare(b.date));
        setAssignments(airmanAss);
      } catch (err) {
        console.error('Failed to load airman history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [airman.id, fromDate, toDate]);

  // Duty counts
  const gdCount = assignments.filter((a) => a.dutyCode === 'GD').length;
  const btfCount = assignments.filter((a) => a.dutyCode === 'BTF').length;
  const ntfCount = assignments.filter((a) => a.dutyCode === 'NTF').length;
  const halishaharCount = assignments.filter((a) => a.dutyCode === 'HALISHAHAR').length;
  const idacCount = assignments.filter((a) => a.dutyCode === 'IDAC' || a.dutyCode === 'IDA').length;
  const clCount = assignments.filter(
    (a) =>
      a.dutyCode === 'LEAVE' &&
      ((a.notes && a.notes.toLowerCase().includes('casual')) || (a.notes && a.notes.toLowerCase().includes('cl')))
  ).length;
  const alCount = assignments.filter(
    (a) =>
      a.dutyCode === 'LEAVE' &&
      ((a.notes && a.notes.toLowerCase().includes('annual')) || (a.notes && a.notes.toLowerCase().includes('al')))
  ).length;
  const totalLeave = assignments.filter((a) => a.dutyCode === 'LEAVE').length;

  
  const getGroupedList = (list) => {
    if (list.length === 0) return [];
    
    // Sort by dutyCode then date to group correctly and detect duplicates
    const sorted = [...list].sort((a, b) => {
      if (a.dutyCode !== b.dutyCode) return (a.dutyCode || '').localeCompare(b.dutyCode || '');
      return a.date.localeCompare(b.date);
    });
    
    const groups = [];
    let currentGroup = [sorted[0]];
    
    for (let i = 1; i < sorted.length; i++) {
      const current = sorted[i];
      const prev = currentGroup[currentGroup.length - 1];
      
      const currDate = new Date(current.date);
      const prevDate = new Date(prev.date);
      const diffTime = Math.abs(currDate.getTime() - prevDate.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0 && current.dutyCode === prev.dutyCode) {
        // Exact duplicate date for same duty type, ignore it
        continue;
      }
      
      if (diffDays === 1 && current.dutyCode === prev.dutyCode && current.notes === prev.notes) {
        currentGroup.push(current);
      } else {
        groups.push(currentGroup);
        currentGroup = [current];
      }
    }
    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }
    
    return groups;
  };

  const formatDateRange = (startDate, endDate) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formatSingle = (dateStr) => {
      if(!dateStr) return '';
      const parts = dateStr.split('-');
      const d = parseInt(parts[2], 10);
      const m = months[parseInt(parts[1], 10) - 1];
      return `${d < 10 ? '0' + d : d} ${m}`;
    };
    
    if (startDate === endDate) return formatSingle(startDate);
    return `${formatSingle(startDate)} - ${formatSingle(endDate)}`;
  };

  const filteredList = assignments.filter((a) => {
    if (categoryFilter === 'DUTY') return !['LEAVE', 'TDY', 'ATT', 'DUTY_OFF', 'ON_PARADE'].includes(a.dutyCode);
    if (categoryFilter === 'ATT') return a.dutyCode === 'ATT' || a.dutyCode === 'BAKE_N_BITE';
    if (categoryFilter === 'LEAVE') return a.dutyCode === 'LEAVE';
    if (categoryFilter === 'TDY') return a.dutyCode === 'TDY';
    return true;
  });

  const isGroupedView = categoryFilter === 'LEAVE' || categoryFilter === 'TDY' || categoryFilter === 'ATT';
  const groupedList = isGroupedView ? getGroupedList(filteredList) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-xs p-0 sm:p-5">
      <div className="bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-3xl shadow-2xl max-w-2xl w-full h-full sm:h-auto sm:max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 border border-emerald-400/50 flex items-center justify-center text-white text-lg font-black shadow-md">
              {formatAirmanName(airman.rank)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  {airman.bdNo}
                </span>
                <span className="text-xs font-bold text-slate-300">
                  #{airman.serNo}
                </span>
              </div>
              <h2 className="text-lg font-black mt-1 text-white">{airman.name}</h2>
              <p className="text-xs text-slate-400 font-semibold">
                {airman.flightName} Flight • {airman.trade}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            
            {onEditAirman && !historyOnly && (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
              <button
                onClick={() => { onClose(); onEditAirman(airman); }}
                className="p-2 rounded-xl text-emerald-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Edit Airman Profile"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            
            {onRemoveAirman && !historyOnly && (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 rounded-xl text-red-500 hover:text-white hover:bg-red-500/20 transition-colors ml-1"
                title="Remove Airman"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            
          </div>
        </div>

        {!historyOnly && (
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-5 pt-3 shrink-0">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-4 text-xs font-extrabold border-b-2 transition-all ${
              activeTab === 'profile'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Profile Details
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-4 text-xs font-extrabold border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            History
          </button>
        </div>
      )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'history' ? (
            <div className="space-y-4">
              {/* Filter Row */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                    <button
                      onClick={() => {
                        const d = new Date();
                        const y = d.getFullYear();
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
                        setFromDate(`${y}-${m}-01`);
                        setToDate(`${y}-${m}-${lastDay}`);
                      }}
                      className="px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => {
                        const d = new Date();
                        const y = d.getFullYear();
                        setFromDate(`${y}-01-01`);
                        setToDate(`${y}-12-31`);
                      }}
                      className="px-2 py-0.5 rounded text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Full Year
                    </button>
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="text-slate-500">From:</span>
                    <DateNavigator
                      
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg font-mono text-xs"
                    />
                    <span className="text-slate-500">To:</span>
                    <DateNavigator
                      
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Category toggle */}
                {!historyOnly && (
                  <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                    {(['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-2.5 py-1 rounded-lg transition-all ${
                          categoryFilter === cat
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Counters Summary */}
              {!historyOnly && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-center">
                  <div className="text-[10px] font-bold text-red-700 dark:text-red-300 uppercase">GD</div>
                  <div className="text-base font-black text-red-800 dark:text-red-200">{gdCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center">
                  <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">BTF</div>
                  <div className="text-base font-black text-amber-800 dark:text-amber-200">{btfCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 text-center">
                  <div className="text-[10px] font-bold text-orange-700 dark:text-orange-300 uppercase">NTF</div>
                  <div className="text-base font-black text-orange-800 dark:text-orange-200">{ntfCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-center">
                  <div className="text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase">IDAC</div>
                  <div className="text-base font-black text-teal-800 dark:text-teal-200">{idacCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-center">
                  <div className="text-[10px] font-bold text-sky-700 dark:text-sky-300 uppercase">Casual (CL)</div>
                  <div className="text-base font-black text-sky-800 dark:text-sky-200">{clCount}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-center">
                  <div className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase">Annual (AL)</div>
                  <div className="text-base font-black text-purple-800 dark:text-purple-200">{alCount}</div>
                </div>
              </div>
              )}

              
            {/* Assignments Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                {isGroupedView ? (
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3.5">Ser No</th>
                        <th className="py-2.5 px-3.5">{categoryFilter === 'LEAVE' ? 'Leave Type' : 'Destination'}</th>
                        <th className="py-2.5 px-3.5">Period</th>
                        <th className="py-2.5 px-3.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loading ? (
                        <tr><td colSpan={4} className="py-6 text-center text-slate-400">Loading duty history...</td></tr>
                      ) : groupedList.length === 0 ? (
                        <tr><td colSpan={4} className="py-6 text-center text-slate-400">No records found for this period.</td></tr>
                      ) : (
                        groupedList.map((group, idx) => {
                          const first = group[0];
                          const last = group[group.length - 1];
                          const typeOrDest = categoryFilter === 'LEAVE' ? (first.notes || 'Leave') : (first.notes || (categoryFilter === 'TDY' ? 'TDY' : 'Deployment'));
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {String(idx + 1).padStart(2, '0')}
                              </td>
                              <td className="py-2.5 px-3.5 font-bold text-slate-700 dark:text-slate-300">
                                {typeOrDest}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap">
                                {formatDateRange(first.date, last.date)}
                              </td>
                              <td className="py-2.5 px-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                                {String(group.length).padStart(2, '0')} days
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table className="w-full text-center border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold uppercase text-[10px] tracking-wider">
                        <th className="py-2.5 px-3.5">Date</th>
                        <th className="py-2.5 px-3.5">Duty / Status</th>
                        <th className="py-2.5 px-3.5">Shift</th>
                        <th className="py-2.5 px-3.5">Remarks / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {loading ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            Loading duty history...
                          </td>
                        </tr>
                      ) : filteredList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-400">
                            No duty or leave records found for this period.
                          </td>
                        </tr>
                      ) : (
                        filteredList.map((item, idx) => {
                          const typeInfo = DUTY_TYPE_MAP[item.dutyCode];
                          return (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {item.date}
                              </td>
                              <td className="py-2.5 px-3.5">
                                <span
                                  className={`px-2 py-0.5 rounded font-black text-[10px] ${
                                    typeInfo?.badgeBg || 'bg-slate-100'
                                  } ${typeInfo?.badgeText || 'text-slate-800'}`}
                                >
                                  {typeInfo?.name || item.dutyCode}
                                </span>
                              </td>
                              <td className="py-2.5 px-3.5 font-semibold text-slate-600 dark:text-slate-400">
                                {item.shift || '-'}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-600 dark:text-slate-400">
                                {item.notes || '-'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          ) : (
            /* Profile Details Tab */
            <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300">
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Serial Number
                  </span>
                  <span className="font-mono font-black text-sm text-slate-900 dark:text-slate-100">
                    #{airman.serNo}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Rank & Seniority
                  </span>
                  <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                    {formatAirmanName(airman.rank)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Trade Specialty
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {airman.trade}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                    Assigned Flight
                  </span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400">
                    {airman.flightName} Flight
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Block / Quarter Address:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{airman.addressBlock}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Mobile Contact Number:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{airman.mobileNo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">Flight In-Charge Remarks:</span>
                  <span className="italic text-slate-600 dark:text-slate-300">{airman.remarks || 'None'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/60 p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-black bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fadeIn rounded-2xl">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-red-100 dark:border-red-900/30">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Airman?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to completely remove this airman? This action cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (onRemoveAirman) onRemoveAirman(airman.id);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/20 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

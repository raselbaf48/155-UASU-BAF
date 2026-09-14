import { DateNavigator } from './DateNavigator';
import React, { useState, useEffect, useMemo } from 'react';
import { Airman, DutyAssignment } from '../types';
import { X, Shield, Phone, MapPin, Award, Calendar, FileText, User, Filter, Printer, Clock, Settings, Trash2, Check, RefreshCw, AlertCircle } from 'lucide-react';
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

const presetLocations = ['AIR HQ', 'BAF AKR', 'BAF BSR', 'BAF MTR', 'BAF CXB', 'BAF SMD'];

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
  
  const [editingGroup, setEditingGroup] = useState<DutyAssignment[] | null>(null);
  const [editFromDate, setEditFromDate] = useState<string>('');
  const [editToDate, setEditToDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editTdyDestination, setEditTdyDestination] = useState<string>('');
  const [editTdyCustomDestination, setEditTdyCustomDestination] = useState<string>('');
  const [editTdyRemarks, setEditTdyRemarks] = useState<string>('');

  const [editLeaveType, setEditLeaveType] = useState<string>('Casual');

  const [editIncludeF295, setEditIncludeF295] = useState<boolean>(false);
  const [editF295Option, setEditF295Option] = useState<'2' | '3' | 'custom'>('2');
  const [editF295CustomDays, setEditF295CustomDays] = useState<number>(0);


  const [editDepLocation, setEditDepLocation] = useState<string>('');
  const [editDepCustomLocation, setEditDepCustomLocation] = useState<string>('');
  const [editDepRemarks, setEditDepRemarks] = useState<string>('');

  const presetDeployLocations = ['Canteen', 'Bake & Bite'];
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [deletingGroup, setDeletingGroup] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const [editSelectedPresetDays, setEditSelectedPresetDays] = useState<number | null>(null);
  const [editCustomLeaveDays, setEditCustomLeaveDays] = useState<number>(1);
  const [editIsCustomPresetActive, setEditIsCustomPresetActive] = useState<boolean>(false);
  const [editTdyPresetDays, setEditTdyPresetDays] = useState<number | null>(null);
  const [editDepPresetDays, setEditDepPresetDays] = useState<number | null>(null);

  const editLeaveDurationDays = useMemo(() => {
    if (!editFromDate || !editToDate) return 0;
    const f = new Date(editFromDate);
    const t = new Date(editToDate);
    return Math.round((t.getTime() - f.getTime()) / (1000 * 3600 * 24)) + 1;
  }, [editFromDate, editToDate]);

  useEffect(() => {
    if (editingGroup && editingGroup[0].dutyCode === 'LEAVE') {
      if (editLeaveDurationDays <= 10 && !['Sick', 'Recreation', 'Annual'].includes(editLeaveType)) {
        setEditLeaveType('Casual');
      }
    }
  }, [editLeaveDurationDays, editingGroup, editLeaveType]);

  const getEditF295Days = (checked: boolean, opt: string, customVal: number) => {
    return checked ? (opt === '2' ? 2 : opt === '3' ? 3 : customVal) : 0;
  };

  const updateEditToDateWithBase = (baseDays: number, f295Days: number) => {
    if (editFromDate) {
      const d = new Date(editFromDate);
      d.setDate(d.getDate() + baseDays + f295Days - 1);
      setEditToDate(d.toISOString().split('T')[0]);
    }
  };

  const handleEditPresetToggle = (days: number) => {
    if (editSelectedPresetDays === days) {
      setEditSelectedPresetDays(null);
      setEditToDate(editFromDate);
    } else {
      setEditSelectedPresetDays(days);
      setEditIsCustomPresetActive(false);
      updateEditToDateWithBase(days, getEditF295Days(editIncludeF295, editF295Option, editF295CustomDays));
    }
  };

  const handleEditCustomLeaveDaysChange = (days: number) => {
    setEditCustomLeaveDays(days);
    setEditSelectedPresetDays(null);
    setEditIsCustomPresetActive(true);
    updateEditToDateWithBase(days, getEditF295Days(editIncludeF295, editF295Option, editF295CustomDays));
  };

  const handleEditF295Toggle = (checked: boolean) => {
    setEditIncludeF295(checked);
    let currentCustom = editF295CustomDays;
    if (checked && editF295Option === 'custom' && editF295CustomDays === 0) {
      currentCustom = 1;
      setEditF295CustomDays(1);
    }
    
    if (editSelectedPresetDays !== null) {
      updateEditToDateWithBase(editSelectedPresetDays, getEditF295Days(checked, editF295Option, currentCustom));
    } else if (editIsCustomPresetActive) {
      updateEditToDateWithBase(editCustomLeaveDays, getEditF295Days(checked, editF295Option, currentCustom));
    } else {
      const oldF295 = getEditF295Days(editIncludeF295, editF295Option, editF295CustomDays);
      const base = Math.max(1, editLeaveDurationDays - oldF295);
      updateEditToDateWithBase(base, getEditF295Days(checked, editF295Option, currentCustom));
    }
  };

  const handleEditF295OptionChange = (opt: '2' | '3' | 'custom', customVal?: number) => {
    setEditF295Option(opt);
    let currentCustom = editF295CustomDays;
    if (opt === 'custom') {
      currentCustom = customVal ?? Math.max(1, editF295CustomDays);
      setEditF295CustomDays(currentCustom);
    }
    
    if (editSelectedPresetDays !== null) {
      updateEditToDateWithBase(editSelectedPresetDays, getEditF295Days(editIncludeF295, opt, currentCustom));
    } else if (editIsCustomPresetActive) {
      updateEditToDateWithBase(editCustomLeaveDays, getEditF295Days(editIncludeF295, opt, currentCustom));
    } else {
      const oldF295 = getEditF295Days(editIncludeF295, editF295Option, editF295CustomDays);
      const base = Math.max(1, editLeaveDurationDays - oldF295);
      updateEditToDateWithBase(base, getEditF295Days(editIncludeF295, opt, currentCustom));
    }
  };

  const editModalDaysCalc = useMemo(() => {
    const f295Extra = editIncludeF295 ? (editF295Option === '2' ? 2 : editF295Option === '3' ? 3 : editF295CustomDays) : 0;
    
    if (!editFromDate || !editToDate) return { grossDays: 0, netLeaveDays: 0, f295Days: 0, totalCalendarDays: 0 };
    const f = new Date(editFromDate);
    const t = new Date(editToDate);
    const gross = Math.round((t.getTime() - f.getTime()) / (1000 * 3600 * 24)) + 1;
    return {
      grossDays: gross,
      netLeaveDays: Math.max(0, gross - f295Extra),
      f295Days: f295Extra,
      totalCalendarDays: gross
    };
  }, [editFromDate, editToDate, editIncludeF295, editF295Option, editF295CustomDays]);

  useEffect(() => {
    const handleUpdate = () => setRefreshKey(k => k + 1);
    window.addEventListener('baf_roster_updated', handleUpdate);
    return () => window.removeEventListener('baf_roster_updated', handleUpdate);
  }, []);

  const handleGroupClick = (group: DutyAssignment[]) => {
    setEditingGroup(group);
    setEditFromDate(group[0].date);
    setEditToDate(group[group.length - 1].date);
    const rawNotes = group[0].notes || '';
    setEditNotes(rawNotes);

    if (group[0].dutyCode === 'TDY') {
        let dest = 'Custom';
        let customDest = rawNotes;
        let rem = '';
        let matched = false;
        for (const loc of presetLocations) {
            if (rawNotes.startsWith(loc)) {
                dest = loc;
                customDest = '';
                const remainder = rawNotes.substring(loc.length).trim();
                rem = remainder.startsWith('-') ? remainder.substring(1).trim() : remainder;
                matched = true;
                break;
            }
        }
        if (!matched && rawNotes.includes('-')) {
           const parts = rawNotes.split('-');
           customDest = parts[0].trim();
           rem = parts.slice(1).join('-').trim();
        }
        setEditTdyDestination(dest);
        setEditTdyCustomDestination(customDest);
        setEditTdyRemarks(rem);
    } else if (group[0].dutyCode === 'LEAVE') {
        let type = 'Casual';
        if (rawNotes.includes('Annual')) type = 'Annual';
        else if (rawNotes.includes('Sick')) type = 'Sick';
        else if (rawNotes.includes('Recreation')) type = 'Recreation';
        setEditLeaveType(type);

        const f295Match = rawNotes.match(/\(F-295: (\d+) Free Days\)/);
        if (f295Match && f295Match[1]) {
            setEditIncludeF295(true);
            const days = parseInt(f295Match[1], 10);
            if (days === 2) {
                setEditF295Option('2');
            } else if (days === 3) {
                setEditF295Option('3');
            } else {
                setEditF295Option('custom');
                setEditF295CustomDays(days);
            }
        } else {
            setEditIncludeF295(false);
            setEditF295Option('2');
            setEditF295CustomDays(0);
        }
    } else if (group[0].dutyCode === 'ATT') {
        let dest = 'Custom';
        let customDest = rawNotes;
        let rem = '';
        let matched = false;
        for (const loc of presetDeployLocations) {
            if (rawNotes.startsWith(loc)) {
                dest = loc;
                customDest = '';
                const remainder = rawNotes.substring(loc.length).trim();
                rem = remainder.startsWith('-') ? remainder.substring(1).trim() : remainder;
                matched = true;
                break;
            }
        }
        if (!matched && rawNotes.includes('-')) {
           const parts = rawNotes.split('-');
           customDest = parts[0].trim();
           rem = parts.slice(1).join('-').trim();
        }
        setEditDepLocation(dest);
        setEditDepCustomLocation(customDest);
        setEditDepRemarks(rem);
    }
    
    setErrorMsg('');
  };

  const handleSaveEdit = async () => {
    if (!editingGroup) return;
    
    let finalNotes = editNotes;
    let finalDutyCode = editingGroup[0].dutyCode;
    if (editingGroup[0].dutyCode === 'TDY') {
        const destToUse = editTdyDestination === 'Custom' ? editTdyCustomDestination : editTdyDestination;
        if (!destToUse) {
            setErrorMsg('Please select or enter a destination.');
            return;
        }
        finalNotes = destToUse;
        finalDutyCode = destToUse === 'Canteen' ? 'CANTEEN' : destToUse.includes('Bake') ? 'BAKE_N_BITE' : 'ATT';
    } else if (editingGroup[0].dutyCode === 'LEAVE') {
        // Keep user typed notes if they modified it manually, otherwise reconstruct
        const fullTypeName = editLeaveType === 'Casual' ? 'Casual Leave' : editLeaveType === 'Annual' ? 'Annual Leave' : editLeaveType === 'Sick' ? 'Sick Leave' : editLeaveType === 'Recreation' ? 'Recreation Leave' : 'Leave';
        const f295Extra = editIncludeF295 ? (editF295Option === '2' ? 2 : editF295Option === '3' ? 3 : editF295CustomDays) : 0;
        finalNotes = f295Extra > 0 ? `${fullTypeName} (F-295: ${f295Extra} Free Days)` : fullTypeName;
    } else if (['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(editingGroup[0].dutyCode)) {
        const destToUse = editDepLocation === 'Custom' ? editDepCustomLocation : editDepLocation;
        if (!destToUse) {
            setErrorMsg('Please select or enter a deployment location.');
            return;
        }
        finalNotes = destToUse;
        finalDutyCode = destToUse === 'Canteen' ? 'CANTEEN' : destToUse.includes('Bake') ? 'BAKE_N_BITE' : 'ATT';
    }
    
    setSavingEdit(true);
    setErrorMsg('');
    try {

      await fetch('/api/roster/delete-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: airman.id,
          fromDate: editingGroup[0].date,
          toDate: editingGroup[editingGroup.length - 1].date,
          dutyCode: editingGroup[0].dutyCode,
        }),
      });

      const res = await fetch('/api/roster/assign-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: airman.id,
          dutyCode: finalDutyCode,
          idaShift: editingGroup[0].idaShift,
          fromDate: editFromDate,
          toDate: editToDate,
          notes: finalNotes,
        }),
      });

      if (!res.ok) throw new Error('Failed to update entry');
      
      setEditingGroup(null);
      
      // refresh hack
      setFromDate(prev => prev.slice());
      const fetchEvt = new CustomEvent('baf_roster_updated');
      window.dispatchEvent(fetchEvt);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save edits');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!editingGroup) return;
    if (!confirm('Are you sure you want to completely remove this entry?')) return;
    setDeletingGroup(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/roster/delete-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: airman.id,
          fromDate: editingGroup[0].date,
          toDate: editingGroup[editingGroup.length - 1].date,
          dutyCode: editingGroup[0].dutyCode,
        }),
      });
      if (!res.ok) throw new Error('Failed to delete entry');
      
      setEditingGroup(null);
      setFromDate(prev => prev.slice());
      const fetchEvt = new CustomEvent('baf_roster_updated');
      window.dispatchEvent(fetchEvt);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete');
    } finally {
      setDeletingGroup(false);
    }
  };


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
  }, [airman.id, fromDate, toDate, refreshKey]);

  const getGroupedList = (list: any[]) => {
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

      if (current.dutyCode === prev.dutyCode && (diffDays === 1 || diffDays === 0) && current.notes === prev.notes) {
        if (diffDays === 1) { // avoid adding same date duplicates
          currentGroup.push(current);
        }
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

  const countWithF295Deduction = (list: any[], filterFn: any) => {
    let count = 0;
    const groups = getGroupedList(list);
    for (const group of groups) {
      const first = group[0];
      if (filterFn(first)) {
        let groupDays = group.length;
        if (first.dutyCode === 'LEAVE' && first.notes) {
          const match = first.notes.match(/\(F-295: (\d+) Free Days\)/);
          if (match && match[1]) {
            groupDays = Math.max(0, groupDays - parseInt(match[1], 10));
          }
        }
        count += groupDays;
      }
    }
    return count;
  };

  // Duty counts
  const gdCount = assignments.filter((a) => a.dutyCode === 'GD').length;
  const btfCount = assignments.filter((a) => a.dutyCode === 'BTF').length;
  const ntfCount = assignments.filter((a) => a.dutyCode === 'NTF').length;
  const halishaharCount = assignments.filter((a) => a.dutyCode === 'HALISHAHAR').length;
  const idacCount = assignments.filter((a) => a.dutyCode === 'IDAC' || a.dutyCode === 'IDA').length;
  const clCount = countWithF295Deduction(assignments, (a) => a.dutyCode === 'LEAVE' && ((a.notes && a.notes.toLowerCase().includes('casual')) || (a.notes && a.notes.toLowerCase().includes('cl'))));
  const alCount = countWithF295Deduction(assignments, (a) => a.dutyCode === 'LEAVE' && ((a.notes && a.notes.toLowerCase().includes('annual')) || (a.notes && a.notes.toLowerCase().includes('al'))));
  const totalLeave = countWithF295Deduction(assignments, (a) => a.dutyCode === 'LEAVE');

  
  
  
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
    if (categoryFilter === 'ATT') return ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(a.dutyCode);
    if (categoryFilter === 'LEAVE') return a.dutyCode === 'LEAVE';
    if (categoryFilter === 'TDY') return a.dutyCode === 'TDY';
    if (categoryFilter !== 'ALL') {
      // Allow specific duty code filtering like 'GD', 'IDAC'
      if (categoryFilter === 'IDAC') return a.dutyCode === 'IDAC' || a.dutyCode === 'IDA';
      return a.dutyCode === categoryFilter;
    }
    return true;
  });

  const isGroupedView = categoryFilter === 'LEAVE' || categoryFilter === 'TDY' || categoryFilter === 'ATT';
  const groupedList = isGroupedView ? getGroupedList(filteredList) : [];

  const _todayD = new Date();
  const _currY = _todayD.getFullYear();
  const _currM = String(_todayD.getMonth() + 1).padStart(2, '0');
  const _currLastDay = new Date(_currY, _todayD.getMonth() + 1, 0).getDate();
  const isThisMonthActive = fromDate === `${_currY}-${_currM}-01` && toDate === `${_currY}-${_currM}-${_currLastDay}`;
  const isFullYearActive = fromDate === `${_currY}-01-01` && toDate === `${_currY}-12-31`;
  const isDutyMatrixMode = historyOnly && initialCategory && !['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT'].includes(initialCategory);

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
                      className={`px-2 py-0.5 rounded ${isThisMonthActive ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-600' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
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
                      className={`px-2 py-0.5 rounded ${isFullYearActive ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white ring-1 ring-slate-300 dark:ring-slate-600' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
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
                {isDutyMatrixMode ? (
                  <div className="text-[12px] font-black text-slate-800 dark:text-white px-3 py-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg">
                    {DUTY_TYPE_MAP[initialCategory as any]?.name || initialCategory}
                  </div>
                ) : !historyOnly && (
                  <div className="flex items-center space-x-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] font-bold">
                    {(['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT'].includes(categoryFilter) ? ['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT'] : ['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT', categoryFilter]).map((cat) => (
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
                <div className="flex-1 overflow-y-auto relative">
                {editingGroup ? (
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm animate-fadeIn">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900 dark:text-white">Edit / Remove Entry</h3>
                      <button onClick={() => setEditingGroup(null)} className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 rounded-lg">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {errorMsg && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center space-x-2 font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}
                    <div className="space-y-4">
                      

                      {editingGroup[0].dutyCode === 'LEAVE' ? (
                        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                From Date
              </label>
              <DateNavigator
                value={editFromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditFromDate(val);
                  if (editToDate < val) setEditToDate(val);
                  
                  if (editSelectedPresetDays !== null) {
                    const d = new Date(val);
                    const extra = editIncludeF295 ? (editF295Option === '2' ? 2 : editF295Option === '3' ? 3 : editF295CustomDays) : 0;
                    d.setDate(d.getDate() + editSelectedPresetDays + extra - 1);
                    setEditToDate(d.toISOString().split('T')[0]);
                  } else if (editIsCustomPresetActive) {
                    const d = new Date(val);
                    const extra = editIncludeF295 ? (editF295Option === '2' ? 2 : editF295Option === '3' ? 3 : editF295CustomDays) : 0;
                    d.setDate(d.getDate() + editCustomLeaveDays + extra - 1);
                    setEditToDate(d.toISOString().split('T')[0]);
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
                value={editToDate}
                min={editFromDate}
                onChange={(e) => {
                  setEditToDate(e.target.value);
                  setEditSelectedPresetDays(null);
                  setEditIsCustomPresetActive(false);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* Quick Duration Presets & Custom Leave Days */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">Quick Leave Presets:</span>
              <span className="text-[11px] text-slate-400">Click to Select / Unselect</span>
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5">
              {[3, 4, 7, 15, 21, 30].map((days) => {
                const isSelected = editSelectedPresetDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => handleEditPresetToggle(days)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs text-center border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/50 shadow-sm'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300'
                    }`}
                  >
                    {days} Days
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => { setEditSelectedPresetDays(null); setEditIsCustomPresetActive(true); handleEditCustomLeaveDaysChange(editCustomLeaveDays); }}
                className={`py-1.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs text-center border ${
                  editIsCustomPresetActive
                    ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-500/50 shadow-sm'
                    : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300'
                }`}
              >
                Custom
              </button>
              
              {editIsCustomPresetActive && (
                <div className="flex items-center space-x-1 ml-1 animate-fadeIn">
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={editCustomLeaveDays}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                      handleEditCustomLeaveDaysChange(val);
                    }}
                    className="w-14 px-2 py-1 text-xs font-black text-center bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-[11px] text-slate-500 font-semibold">Days</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center space-x-2.5 cursor-pointer select-none group"
                  onClick={() => setEditIncludeF295(!editIncludeF295)}
                >
                  <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out ${editIncludeF295 ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400 dark:group-hover:bg-slate-500'}`}>
                    <span className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${editIncludeF295 ? 'translate-x-4.5' : 'translate-x-0.5'}`} style={{ transform: editIncludeF295 ? 'translateX(18px)' : 'translateX(3px)' }} />
                  </div>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Include F-295 (Journey Time)
                  </span>
                </div>
                {editIncludeF295 && (
                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                    +{editF295Option === '2' ? '2' : editF295Option === '3' ? '3' : editF295CustomDays} Days Added
                  </span>
                )}
              </div>

              {editIncludeF295 && (
                <div className="flex flex-wrap items-center gap-2 pl-6 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => handleEditF295OptionChange('2')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      editF295Option === '2'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    2 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditF295OptionChange('3')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      editF295Option === '3'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    3 Days
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEditF295OptionChange('custom')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      editF295Option === 'custom'
                        ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    Custom
                  </button>
                  {editF295Option === 'custom' && (
                    <div className="flex items-center space-x-1">
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={editF295CustomDays}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setEditF295CustomDays(val);
                          handleEditF295OptionChange('custom', val);
                        }}
                        className="w-14 px-2 py-0.5 text-xs font-bold bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none"
                      />
                      <span className="text-[11px] text-slate-500">Days</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Leave Type Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Leave Type
              </label>
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                Duration: {editLeaveDurationDays} Day{editLeaveDurationDays > 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-1.5">
              <button
                type="button"
                disabled={editLeaveDurationDays > 10}
                onClick={() => setEditLeaveType('Casual')}
                className={`py-2 text-xs font-black rounded-xl border transition-all ${
                  editLeaveDurationDays > 10 ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:border-slate-700' :
                  editLeaveType === 'Casual'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-xs cursor-pointer'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 cursor-pointer'
                }`}
              >
                Casual Leave
              </button>
              <button
                type="button"
                onClick={() => setEditLeaveType('Annual')}
                className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                  editLeaveType === 'Annual'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Annual Leave
              </button>
              <button
                type="button"
                onClick={() => setEditLeaveType('Recreation')}
                className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                  editLeaveType === 'Recreation'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Recreation Leave
              </button>
              <button
                type="button"
                onClick={() => setEditLeaveType('Sick')}
                className={`py-2 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                  editLeaveType === 'Sick'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}
              >
                Sick Leave
              </button>
            </div>
            {editLeaveDurationDays > 10 ? (
              <p className="text-[10.5px] text-slate-400">
                Duration is &gt; 10 days: Casual Leave disabled. Selected {editLeaveType || 'None'}.
              </p>
            ) : (
              <p className="text-[10.5px] text-slate-400">
                Duration is &le; 10 days: Casual Leave auto-selected. Selected {editLeaveType || 'None'}.
              </p>
            )}
          </div>

          {/* Real-time duration & Military F-295 summary badge */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs space-y-1.5">
            <div className="flex items-center justify-between font-bold text-emerald-900 dark:text-emerald-200">
              <span>Net Leave Balance Count:</span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                {editModalDaysCalc.netLeaveDays} Day{editModalDaysCalc.netLeaveDays > 1 ? 's' : ''}
              </span>
            </div>
            <div className="text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between border-t border-emerald-200/60 dark:border-emerald-800/60 pt-1.5">
              <span>Total Calendar Span: <strong>{editModalDaysCalc.totalCalendarDays} Days</strong></span>
              {editModalDaysCalc.f295Days > 0 ? (
                <span className="font-bold text-purple-700 dark:text-purple-300 bg-purple-100/80 dark:bg-purple-900/60 px-2 py-0.5 rounded-md">
                  F-295 (Free Leave): {editModalDaysCalc.f295Days} Day(s)
                </span>
              ) : (
                <span className="text-slate-500 dark:text-slate-400">No F-295 free days (F-295: 0)</span>
              )}
            </div>
          </div>

          
                        </div>
                      ) : editingGroup[0].dutyCode === 'TDY' ? (
                        <div className="space-y-4">

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
                      setEditTdyDestination(loc);
                      setEditTdyCustomDestination('');
                    }}
                    className={`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      editTdyDestination === loc
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {loc}
                  </button>
               ))}
               <button
                  type="button"
                  onClick={() => setEditTdyDestination('Custom')}
                  className={`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    editTdyDestination === 'Custom'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Custom
                </button>
            </div>
            
            {editTdyDestination === 'Custom' && (
              <input
                type="text"
                value={editTdyCustomDestination}
                onChange={(e) => setEditTdyCustomDestination(e.target.value)}
                placeholder="Enter custom destination..."
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer ${
                  !editTdyCustomDestination ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-slate-700 focus:border-amber-500'
                }`}
                required
              />
            )}
          </div>

          {/* Assignment Date Presets */}
          <div>
             <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                Assignment Date
              </label>
             <div className="grid grid-cols-5 gap-1.5 mb-3">
              {[{label: 'Today', val: 1}, {label: '2 Days', val: 2}, {label: '3 Days', val: 3}, {label: '7 Days', val: 7}, {label: '15 Days', val: 15}].map((opt) => {
                const isSelected = editTdyPresetDays === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => {
    setEditTdyPresetDays(opt.val);
    if (editFromDate) {
      const d = new Date(editFromDate);
      d.setDate(d.getDate() + opt.val - 1);
      setEditToDate(d.toISOString().split('T')[0]);
    }
  }}
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
                value={editFromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditFromDate(val);
                  
                  if (!editToDate || editToDate < val) {
                    setEditToDate(val);
                  }

                  // Keep To Date in sync if it's a single day selection
                  if (editTdyPresetDays === 1 || editTdyPresetDays === -1) {
                      setEditToDate(val);
                      const todayStr = new Date().toISOString().split('T')[0];
                      setEditTdyPresetDays(val === todayStr ? 1 : -1);
                  } else if (editTdyPresetDays !== null) {
                      const d = new Date(val);
                      d.setDate(d.getDate() + editTdyPresetDays - 1);
                      setEditToDate(d.toISOString().split('T')[0]);
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
              />
            </div>
            
            {/* Show To Date only if > 1 day selected, or if user is manually overriding */}
            {editTdyPresetDays !== 1 && editTdyPresetDays !== -1 && (
                <div className="animate-fadeIn">
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                    To Date
                  </label>
                  <DateNavigator
                    value={editToDate}
                    min={editFromDate}
                    onChange={(e) => {
                      setEditToDate(e.target.value);
                      setEditTdyPresetDays(null); // Custom end date removes preset
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
                {editLeaveDurationDays} Calendar Day{editLeaveDurationDays > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          
                        </div>
                      ) : ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(editingGroup[0].dutyCode) ? (
                        <div className="space-y-4">

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
              Destination (Mandatory) <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
               {presetDeployLocations.map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      setEditDepLocation(loc);
                      setEditDepCustomLocation('');
                    }}
                    className={`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                      editDepLocation === loc
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {loc}
                  </button>
               ))}
               <button
                  type="button"
                  onClick={() => setEditDepLocation('Custom')}
                  className={`py-1.5 px-3 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    editDepLocation === 'Custom'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Custom
                </button>
            </div>
            
            {editDepLocation === 'Custom' && (
              <input
                type="text"
                value={editDepCustomLocation}
                onChange={(e) => setEditDepCustomLocation(e.target.value)}
                placeholder="Enter custom deployment location..."
                className={`w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer ${
                  !editDepCustomLocation ? 'border-amber-400 dark:border-amber-600' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500'
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
                value={editFromDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditFromDate(val);
                  
                  if (!editToDate || editToDate < val) {
                    setEditToDate(val);
                  }
                  
                  if (editDepPresetDays !== null) {
                    const d = new Date(val);
                    d.setDate(d.getDate() + editDepPresetDays - 1);
                    setEditToDate(d.toISOString().split('T')[0]);
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
                value={editToDate}
                min={editFromDate}
                onChange={(e) => {
                  setEditToDate(e.target.value);
                  setEditDepPresetDays(null);
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
                const isSelected = editDepPresetDays === days;
                return (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
    setEditDepPresetDays(days);
    if (editFromDate) {
      const d = new Date(editFromDate);
      d.setDate(d.getDate() + days - 1);
      setEditToDate(d.toISOString().split('T')[0]);
    }
  }}
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
                {editLeaveDurationDays} Calendar Day{editLeaveDurationDays > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">From Date</label>
                              <DateNavigator
                                value={editFromDate}
                                onChange={(e) => setEditFromDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium cursor-pointer"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">To Date</label>
                              <DateNavigator
                                value={editToDate}
                                onChange={(e) => setEditToDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium cursor-pointer"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Extra Details</label>
                            <input
                              type="text"
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              placeholder="Remarks or details..."
                              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium"
                            />
                          </div>
                        </div>
                      )}
                      

                      <div className="flex items-center gap-3 pt-2">
                        <button onClick={handleDeleteGroup} disabled={deletingGroup || savingEdit} className="flex-1 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
                          {deletingGroup ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          Remove
                        </button>
                        <button onClick={handleSaveEdit} disabled={savingEdit || deletingGroup} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-emerald-500/20">
                          {savingEdit ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                ) : isGroupedView ? (
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
                            <tr key={idx} onClick={() => handleGroupClick(group)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" title="Click to edit or remove">
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
                                {(() => {
                                  let days = group.length;
                                  if (first.dutyCode === 'LEAVE' && first.notes) {
                                    const match = first.notes.match(/\(F-295: (\d+) Free Days\)/);
                                    if (match && match[1]) {
                                      days = Math.max(0, days - parseInt(match[1], 10));
                                    }
                                  }
                                  return `${String(days).padStart(2, '0')} days`;
                                })()}
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
                        {isDutyMatrixMode ? (
                          <th className="py-2.5 px-3.5">Day</th>
                        ) : (
                          <>
                            <th className="py-2.5 px-3.5">Duty / Status</th>
                            <th className="py-2.5 px-3.5">Shift</th>
                            <th className="py-2.5 px-3.5">Remarks / Details</th>
                          </>
                        )}
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
                            <tr key={idx} onClick={() => handleGroupClick([item])} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" title="Click to edit or remove">
                              <td className="py-2.5 px-3.5 font-mono font-bold text-slate-800 dark:text-slate-200">
                                {item.date}
                              </td>
                              {isDutyMatrixMode ? (
                                <td className="py-2.5 px-3.5 font-semibold text-slate-600 dark:text-slate-400">
                                  {new Date(item.date).toLocaleDateString('en-US', { weekday: 'long' })}
                                </td>
                              ) : (
                                <>
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
                                </>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}
              </div>
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

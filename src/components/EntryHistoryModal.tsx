import { DateNavigator } from './DateNavigator';
import React, { useState, useEffect } from 'react';
import { ActivityHistoryItem, Airman, DutyCategoryCode, IDAShift } from '../types';
import { getCurrentUserSession } from '../utils/authSession';
import { DUTY_TYPES } from '../data/dutyTypes';

const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
import {
  History,
  X,
  Trash2,
  Edit3,
  Search,
  Check,
  Calendar,
  AlertCircle,
  RefreshCw,
  Clock,
} from 'lucide-react';

interface EntryHistoryModalProps {
  airmen: Airman[];
  onClose: () => void;
  onRefreshData?: () => void;
  filterType?: 'LEAVE' | 'TDY' | 'DEPLOYMENT' | 'DUTY' | 'SYSTEM' | 'ALL';
}

export const EntryHistoryModal: React.FC<EntryHistoryModalProps> = ({
  airmen,
  onClose,
  onRefreshData,
  filterType = 'ALL'
}) => {
  const [historyList, setHistoryList] = useState<ActivityHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Editing state
  const [editingItem, setEditingItem] = useState<ActivityHistoryItem | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<ActivityHistoryItem | null>(null);
  const [editAirmanId, setEditAirmanId] = useState<string>('');
  const [editDutyCode, setEditDutyCode] = useState<DutyCategoryCode>('GD');
  const [editIdaShift, setEditIdaShift] = useState<IDAShift>('Morning');
  const [editFromDate, setEditFromDate] = useState<string>('');
  const [editToDate, setEditToDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);

  const session = getCurrentUserSession();
  const isAdmin = session?.assignedRole === 'ADMIN';
  const adminFlight = session?.flightName;
  const todayStr = new Date().toISOString().split('T')[0];

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/roster/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryList(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch entry history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = (item: ActivityHistoryItem) => {
    if (isAdmin && adminFlight && item.airmanId) {
      const target = airmen.find(a => a.id === item.airmanId);
      if (target && target.flightName !== adminFlight) {
        alert("You cannot delete entries for personnel outside your flight.");
        return;
      }
    }
    if (isAdmin && item.fromDate < todayStr) {
      alert("You cannot delete entries for past dates.");
      return;
    }
    setConfirmDeleteItem(item);
  };

  const confirmDeleteAction = async () => {
    if (!confirmDeleteItem) return;
    
    setActionLoadingId(confirmDeleteItem.id);
    setSuccessMsg('');
    setErrorMsg('');

    try {
      const res = await fetch('/api/roster/undo-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId: confirmDeleteItem.id }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setSuccessMsg(result.message || 'Successfully deleted entry.');
        fetchHistory();
        if (onRefreshData) onRefreshData();
      } else {
        setErrorMsg(result.error || 'Failed to delete entry.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete entry.');
    } finally {
      setActionLoadingId(null);
      setConfirmDeleteItem(null);
    }
  };

  const startEditing = (item: ActivityHistoryItem) => {
    if (isAdmin && adminFlight && item.airmanId) {
      const target = airmen.find(a => a.id === item.airmanId);
      if (target && target.flightName !== adminFlight) {
        alert("You cannot edit entries for personnel outside your flight.");
        return;
      }
    }
    if (isAdmin && item.fromDate < todayStr) {
      alert("You cannot edit entries for past dates.");
      return;
    }
    setEditingItem(item);
    setEditAirmanId(item.airmanId);
    setEditDutyCode(item.dutyCode || 'GD');
    setEditIdaShift((item.idaShift && item.idaShift !== 'undefined' ? item.idaShift : 'Morning'));
    setEditFromDate(item.fromDate);
    setEditToDate(item.toDate || item.fromDate);
    setEditNotes(item.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setSavingEdit(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // 1. Delete original dates for original airman
      await fetch('/api/roster/delete-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: editingItem.airmanId,
          fromDate: editingItem.fromDate,
          toDate: editingItem.toDate || editingItem.fromDate,
        }),
      });

      // 2. Assign new range (for selected airman)
      const res = await fetch('/api/roster/assign-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: editAirmanId || editingItem.airmanId,
          dutyCode: editDutyCode,
          idaShift: editDutyCode === 'IDAC' || editDutyCode === 'IDA' ? editIdaShift : undefined,
          fromDate: editFromDate,
          toDate: editToDate,
          notes: editNotes,
        }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        const targetAirman = airmen.find((a) => a.id === (editAirmanId || editingItem.airmanId));
        setSuccessMsg(`Updated entry for ${targetAirman ? `${targetAirman.rank} ${targetAirman.name}` : editingItem.airmanName}`);
        setEditingItem(null);
        fetchHistory();
        if (onRefreshData) onRefreshData();
      } else {
        setErrorMsg(result.error || 'Failed to update entry.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update entry.');
    } finally {
      setSavingEdit(false);
    }
  };

    const filteredHistory = historyList.filter((item) => {
    // Hide corrupted logs immediately
    if (!item.actionType && !item.type) return false;
    if (item.actionType === 'undefined' || item.type === 'undefined') return false;

    const isSystem = item.actionType === 'SYSTEM_ACTION' || item.type === 'SYSTEM_ACTION';
    
    // Check missing airman
    const air = airmen.find((a) => a.id === item.airmanId);
    const resolvedName = air ? air.name : item.airmanName;
    if (!isSystem && (!resolvedName || resolvedName === 'undefined')) return false;

    // Check missing duty for non-system logs
    if (!isSystem && (!item.dutyCode || item.dutyCode === 'undefined')) return false;

    // Check missing date
    if (!item.fromDate || item.fromDate === 'undefined') return false;

    // Type filters
    if (filterType === 'LEAVE' && item.dutyCode !== 'LEAVE') return false;
    if (filterType === 'TDY' && item.dutyCode !== 'TDY') return false;
    if (filterType === 'DEPLOYMENT' && item.dutyCode !== 'DEPLOYMENT') return false;
    if (filterType === 'DUTY' && (item.dutyCode === 'LEAVE' || item.dutyCode === 'TDY' || item.dutyCode === 'DEPLOYMENT')) return false;
    if (filterType === 'SYSTEM' && !isSystem) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (resolvedName || '').toLowerCase().includes(q) ||
      (item.dutyCode || '').toLowerCase().includes(q) ||
      (item.notes && item.notes.toLowerCase().includes(q)) ||
      (item.fromDate && item.fromDate.includes(q)) ||
      (item.toDate && item.toDate.includes(q))
    );
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-slate-800 shadow-2xl max-w-4xl w-full p-6 space-y-4 relative overflow-hidden h-full sm:h-auto sm:max-h-[92vh] flex flex-col font-sans">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <span>Entry History</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
                  {filteredHistory.length} Total
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Showing assignments with exact from-date to to-date ranges.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Refresh Last Entries"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-600 hover:text-emerald-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-rose-600 hover:text-rose-800">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search all entries (Airman name, BD, Duty, Date)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500"
          />
        </div>

        {/* Edit Modal Popup */}
        {editingItem && (
          <div className="p-4 bg-slate-100 dark:bg-slate-800 border border-emerald-500/50 rounded-xl space-y-3 shrink-0 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-emerald-600" />
                <span>Edit / Reassign Entry: <strong>{editingItem.airmanName}</strong></span>
              </span>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Airman / Personnel
                </label>
                <select
                  value={editAirmanId}
                  onChange={(e) => setEditAirmanId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none font-medium"
                >
                  {airmen.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatAirmanName(a.rank)} {a.name} ({a.flightName} - {a.bdNo})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Duty Type
                </label>
                <select
                  value={editDutyCode}
                  onChange={(e) => setEditDutyCode(e.target.value as DutyCategoryCode)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none font-medium"
                >
                  {DUTY_TYPES.map((dt) => (
                    <option key={dt.code} value={dt.code}>
                      {dt.name} ({dt.code})
                    </option>
                  ))}
                </select>
              </div>

              {(editDutyCode === 'IDAC' || editDutyCode === 'IDA') && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    IDAC Shift
                  </label>
                  <select
                    value={editIdaShift}
                    onChange={(e) => setEditIdaShift(e.target.value as IDAShift)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none font-medium"
                  >
                    <option value="Morning">Morning (08:00 - 14:00)</option>
                    <option value="Afternoon">Afternoon (14:00 - 20:00)</option>
                    <option value="Night">Night (20:00 - 08:00)</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  From Date
                </label>
                <DateNavigator
                  
                  value={editFromDate}
                  onChange={(e) => setEditFromDate(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  To Date
                </label>
                <DateNavigator
                  
                  value={editToDate}
                  onChange={(e) => setEditToDate(e.target.value)}
                  required
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none font-semibold"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Notes / Location
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Optional remarks or assignment location..."
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none"
                />
              </div>

              <div className="sm:col-span-1 flex items-end">
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all shadow-xs flex items-center justify-center space-x-1"
                >
                  {savingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* History Records List (Last 10 Entries) */}
        <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
          {loading ? (
            <div className="p-10 text-center text-slate-400 text-xs flex flex-col items-center space-y-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
              <span>Loading last entries...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              No recent entry records found. Any new duty or leave assignments will appear here.
            </div>
          ) : (
            filteredHistory.map((item, index) => {
              const dt = new Date(item.timestamp);
              const timeStr = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const dateStr = dt.toLocaleDateString('en-GB', { month: 'short', day: '2-digit', year: '2-digit' }).replace(/Sept/gi, 'Sep');

              const air = airmen.find((a) => a.id === item.airmanId);
              const isLeave = item.dutyCode === 'LEAVE' || item.actionType === 'GRANT_LEAVE';
              const isDelete = item.actionType === 'DELETE_ASSIGNMENT' || item.actionType === 'CLEAR_RANGE';

              // Calculate number of days
              const fD = new Date(item.fromDate);
              const tD = new Date(item.toDate || item.fromDate);
              let diffDays = Math.max(1, Math.round((tD.getTime() - fD.getTime()) / (1000 * 60 * 60 * 24)) + 1);
              if (isNaN(diffDays)) diffDays = 1;
              
              if (item.notes && (item.dutyCode === 'LEAVE' || item.actionType === 'GRANT_LEAVE')) {
                  const match = item.notes.match(/\(F-295: (\d+) Free Days\)/);
                  if (match && match[1]) {
                      diffDays = Math.max(0, diffDays - parseInt(match[1], 10));
                  }
              }

              return (
                <div
                  key={item.id}
                  className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start space-x-3">
                    {/* Index Badge */}
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 font-black text-xs shrink-0 mt-0.5">
                      #{index + 1}
                    </div>

                    <div className="space-y-1.5">
                      {(item.actionType === 'SYSTEM_ACTION' || item.type === 'SYSTEM_ACTION') ? (
                        <div className="flex flex-col space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                              SYSTEM ACTION
                            </span>
                            <span className="flex items-center space-x-1 text-slate-400 text-[11px]">
                              <Clock className="w-3 h-3" />
                              <span>Logged: {dateStr} at {timeStr}</span>
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1">
                            {[item.description, item.notes].find(v => v && v !== 'undefined') || ''}
                          </div>
                        </div>
                      ) : (
                        <>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          isDelete
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                            : isLeave
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                        }`}>
                          {(item.actionType || item.type || '').replace(/_/g, ' ')}
                        </span>

                        <span className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                          {air ? `${air.rank} ${air.name}` : (item.airmanName === 'undefined' ? '' : item.airmanName)}
                        </span>

                        {air && (
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            (BD: {air.bdNo} • {air.flightName} Flt • {air.trade})
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                          Duty: {item.dutyCode === 'undefined' ? '' : item.dutyCode} {item.dutyCode && item.dutyCode.includes('IDA') ? ` ${(item.idaShift && item.idaShift !== 'undefined' ? item.idaShift : 'Morning')}` : ''}
                        </span>
                      </div>

                      {/* Date Range Details */}
                      <div className="flex items-center space-x-3 text-slate-600 dark:text-slate-300 text-xs flex-wrap gap-y-1">
                        <span className="flex items-center space-x-1 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {(!item.fromDate || item.fromDate === 'undefined') ? '' : (item.fromDate === item.toDate
                              ? `${item.fromDate} (1 Day)`
                              : `${item.fromDate} to ${item.toDate} (${diffDays} Days)`)}
                          </span>
                        </span>

                        {(item.notes && item.notes !== 'undefined') && (
                          <span className="text-slate-600 dark:text-slate-400">
                            • Note: <em className="text-slate-800 dark:text-slate-200 font-medium">{item.notes}</em>
                          </span>
                        )}

                        <span className="flex items-center space-x-1 text-slate-400 text-[11px]">
                          <Clock className="w-3 h-3" />
                          <span>Logged: {dateStr} at {timeStr}</span>
                        </span>
                                            </div>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center space-x-2 shrink-0 self-end sm:self-center">
                    {item.actionType !== 'SYSTEM_ACTION' && (
                      <>
                    <button
                      onClick={() => startEditing(item)}
                      className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition-colors flex items-center space-x-1"
                      title="Edit this entry or change airman"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleDelete(item)}
                      disabled={actionLoadingId === item.id}
                      className="px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold rounded-lg transition-colors flex items-center space-x-1"
                      title="Delete this entry and revert its effect"
                    >
                      {actionLoadingId === item.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      )}
                      <span>Delete</span>
                    </button>
                    </>
                    )}
                  </div>
                </div>
              );
            })
          )}
          
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 shrink-0">
          <span>Showing {filteredHistory.length} Total log entries</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirm Delete Popup */}
      {confirmDeleteItem && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-sm w-full mx-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Confirm Deletion</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Are you sure you want to delete this entry for <span className="font-bold text-slate-800 dark:text-slate-200">{confirmDeleteItem.airmanName}</span>?
              This action will revert the assignment and cannot be undone.
            </p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setConfirmDeleteItem(null)}
                disabled={actionLoadingId !== null}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteAction}
                disabled={actionLoadingId !== null}
                className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl flex items-center space-x-2 transition-colors disabled:opacity-50"
              >
                {actionLoadingId === confirmDeleteItem.id ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

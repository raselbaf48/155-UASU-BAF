import React, { useState, useEffect } from 'react';
import { X, Trash2, Calendar, Clock, Edit2, Save } from 'lucide-react';

interface FlgWgHistoryModalProps {
  onClose: () => void;
  onSelectDate?: (date: string) => void;
}

export const FlgWgHistoryModal: React.FC<FlgWgHistoryModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  useEffect(() => {
    loadLogs();
  }, []);


  const parseActionToRaw = (actionStr: string) => {
    const raw: any = {
      totalStr: 0, detTdy: 0, leave: 0, edExPpgf: 0,
      cmhBnsBsh: 0, officeDuty: 0, baseAirfieldDuty: 0, driving: 0
    };
    if (!actionStr) return raw;
    const parts = actionStr.split(',');
    parts.forEach(p => {
       const part = p.trim();
       const match = part.match(/(.+) \+([0-9]+)/);
       if (match) {
         const label = match[1].trim();
         const val = parseInt(match[2], 10);
         if (label === 'Total Str') raw.totalStr = val;
         if (label === 'Det/Tdy') raw.detTdy = val;
         if (label === 'Leave') raw.leave = val;
         if (label === 'ED/EX') raw.edExPpgf = val;
         if (label === 'CMH') raw.cmhBnsBsh = val;
         if (label === 'Office') raw.officeDuty = val;
         if (label === 'Base/Airfield') raw.baseAirfieldDuty = val;
         if (label === 'Driving') raw.driving = val;
       }
    });
    return raw;
  };

  const loadLogs = () => {
    let allLogs: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('flg_wg_logs_')) {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        const dateStr = key.replace('flg_wg_logs_', '');
        allLogs = [...allLogs, ...parsed.map((p: any) => ({ ...p, dateStr }))];
      }
    }
    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    // Assign mock IDs to old logs without IDs so we can key them
    allLogs = allLogs.map(l => {
      const log = l.id ? l : { ...l, id: Math.random().toString(36).substring(7) };
      if (!log.raw) {
        log.raw = parseActionToRaw(log.action);
      }
      return log;
    });
    setLogs(allLogs);
  };

  const handleRemove = (log: any) => {
    if (log.raw) {
      adjustUnitData(log.dateStr, log.unit, log.raw, true);
    }
    deleteLogEntry(log);
    setEditingLogId(null);
  };

  const deleteLogEntry = (log: any) => {
    const key = `flg_wg_logs_${log.dateStr}`;
    let logsForDate = JSON.parse(localStorage.getItem(key) || '[]');
    logsForDate = logsForDate.filter((l: any) => l.id !== log.id);
    localStorage.setItem(key, JSON.stringify(logsForDate));
    
    setLogs(prev => prev.filter(l => l.id !== log.id));
  };

  const adjustUnitData = (dateStr: string, unit: string, raw: any, isSubtract: boolean) => {
    const key = `flg_wg_data_${dateStr}`;
    const dataStr = localStorage.getItem(key);
    if (!dataStr) return;
    
    let data = JSON.parse(dataStr);
    const unitIndex = data.findIndex((d: any) => d.unit === unit);
    if (unitIndex !== -1) {
      const u = data[unitIndex];
      const mult = isSubtract ? -1 : 1;
      
      u.totalStr = (u.totalStr || 0) + (raw.totalStr || 0) * mult;
      u.detTdy = (u.detTdy || 0) + (raw.detTdy || 0) * mult;
      u.leave = (u.leave || 0) + (raw.leave || 0) * mult;
      u.edExPpgf = (u.edExPpgf || 0) + (raw.edExPpgf || 0) * mult;
      u.cmhBnsBsh = (u.cmhBnsBsh || 0) + (raw.cmhBnsBsh || 0) * mult;
      u.officeDuty = (u.officeDuty || 0) + (raw.officeDuty || 0) * mult;
      u.baseAirfieldDuty = (u.baseAirfieldDuty || 0) + (raw.baseAirfieldDuty || 0) * mult;
      u.driving = (u.driving || 0) + (raw.driving || 0) * mult;
      
      localStorage.setItem(key, JSON.stringify(data));
      // Dispatch event so FlyingWingStateView re-renders
      window.dispatchEvent(new CustomEvent('flg_wg_data_updated', { detail: dateStr }));
    }
  };

  const startEdit = (log: any) => {
    if (editingLogId === log.id) {
      setEditingLogId(null);
      return;
    }
    setEditingLogId(log.id);
    setEditForm({ ...(log.raw || {}) });
  };

  const cancelEdit = () => {
    setEditingLogId(null);
    setEditForm({});
  };

  const handleEditSubmit = (log: any) => {
    if (!log.raw) return; // Cannot edit old logs without raw
    // Calculate delta: new - old
    const delta = {
      totalStr: (editForm.totalStr || 0) - (log.raw.totalStr || 0),
      detTdy: (editForm.detTdy || 0) - (log.raw.detTdy || 0),
      leave: (editForm.leave || 0) - (log.raw.leave || 0),
      edExPpgf: (editForm.edExPpgf || 0) - (log.raw.edExPpgf || 0),
      cmhBnsBsh: (editForm.cmhBnsBsh || 0) - (log.raw.cmhBnsBsh || 0),
      officeDuty: (editForm.officeDuty || 0) - (log.raw.officeDuty || 0),
      baseAirfieldDuty: (editForm.baseAirfieldDuty || 0) - (log.raw.baseAirfieldDuty || 0),
      driving: (editForm.driving || 0) - (log.raw.driving || 0),
    };

    // 1. Adjust data by delta (isSubtract = false because delta is new-old)
    adjustUnitData(log.dateStr, log.unit, delta, false);

    // 2. Build new action string
    let changes = [];
    if (editForm.totalStr) changes.push(`Total Str +${editForm.totalStr}`);
    if (editForm.detTdy) changes.push(`Det/Tdy +${editForm.detTdy}`);
    if (editForm.leave) changes.push(`Leave +${editForm.leave}`);
    if (editForm.edExPpgf) changes.push(`ED/EX +${editForm.edExPpgf}`);
    if (editForm.cmhBnsBsh) changes.push(`CMH +${editForm.cmhBnsBsh}`);
    if (editForm.officeDuty) changes.push(`Office +${editForm.officeDuty}`);
    if (editForm.baseAirfieldDuty) changes.push(`Base/Airfield +${editForm.baseAirfieldDuty}`);
    if (editForm.driving) changes.push(`Driving +${editForm.driving}`);
    const newAction = changes.join(', ');

    // 3. Update log entry in storage
    const key = `flg_wg_logs_${log.dateStr}`;
    let logsForDate = JSON.parse(localStorage.getItem(key) || '[]');
    const logIndex = logsForDate.findIndex((l: any) => l.id === log.id);
    if (logIndex !== -1) {
      logsForDate[logIndex].raw = { ...editForm };
      logsForDate[logIndex].action = newAction;
      localStorage.setItem(key, JSON.stringify(logsForDate));
    }

    // 4. Update local state
    setLogs(prev => prev.map(l => {
      if (l.id === log.id) {
        return { ...l, raw: { ...editForm }, action: newAction };
      }
      return l;
    }));

    setEditingLogId(null);
  };

  const renderEditField = (label: string, field: string) => (
    <div className="flex items-center justify-between py-1">
      <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
      <input
        type="number"
        value={editForm[field] || ''}
        onChange={(e) => setEditForm({ ...editForm, [field]: parseInt(e.target.value) || 0 })}
        className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-right outline-none focus:border-emerald-500"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm no-print">
      <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-2xl shadow-xl w-full max-w-lg overflow-hidden text-slate-800 dark:text-slate-100 flex flex-col h-full sm:h-auto sm:max-h-[85vh]">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            Flying Wing History & Logs
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900">
          {logs.length === 0 ? (
            <div className="text-center text-slate-500 py-12 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed">
              <Calendar className="w-8 h-8 mx-auto mb-3 opacity-20" />
              No disposals recorded yet.
            </div>
          ) : (
            <div className="space-y-3 max-w-xl mx-auto">
              {logs.map((log) => (
                <div key={log.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm transition-all hover:border-emerald-200 dark:hover:border-emerald-800">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm mr-2">{log.unit}</span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {log.dateStr}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-3">
                    {editingLogId === log.id ? (
                      <div className="space-y-3">
                        {log.raw ? (
                          <>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
                              {renderEditField('Total Str', 'totalStr')}
                              {renderEditField('Det/Tdy', 'detTdy')}
                              {renderEditField('Leave', 'leave')}
                              {renderEditField('ED/EX/PP/GF', 'edExPpgf')}
                              {renderEditField('CMH/ BNS/ BSH', 'cmhBnsBsh')}
                              {renderEditField('Office Duty', 'officeDuty')}
                              {renderEditField('Base/Airfield', 'baseAirfieldDuty')}
                              {renderEditField('Driving', 'driving')}
                            </div>
                            <div className="flex items-center justify-between pt-2">
                              <button 
                                onClick={() => handleRemove(log)}
                                className="px-3 py-2 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors flex items-center gap-1"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                              <div className="flex gap-2">
                                <button 
                                  onClick={cancelEdit}
                                  className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={() => handleEditSubmit(log)}
                                  className="px-3 py-2 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <Save className="w-3 h-3" />
                                  Save
                                </button>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-100 dark:border-rose-900/30">
                            <p className="text-sm text-rose-600 dark:text-rose-400 mb-3">This older log cannot be edited because it lacks detailed quantity data. You can only remove it.</p>
                            <div className="flex justify-between">
                              <button onClick={() => handleRemove(log)} className="px-3 py-2 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg flex items-center gap-1">
                                <Trash2 className="w-3 h-3" />
                                Delete Entry
                              </button>
                              <button onClick={cancelEdit} className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {log.action || <span className="text-slate-400 italic">No details recorded</span>}
                        </div>
                        <button 
                          onClick={() => startEdit(log)}
                          className="mt-3 w-full py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 shadow-sm"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit / Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

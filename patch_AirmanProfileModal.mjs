import fs from 'fs';

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

if (!content.includes('import { Check')) {
  content = content.replace(
    "Trash2 } from 'lucide-react';",
    "Trash2, Check, RefreshCw, AlertCircle } from 'lucide-react';"
  );
}

const stateInjection = `
  const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);
  
  const [editingGroup, setEditingGroup] = useState<DutyAssignment[] | null>(null);
  const [editFromDate, setEditFromDate] = useState<string>('');
  const [editToDate, setEditToDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [deletingGroup, setDeletingGroup] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleGroupClick = (group: DutyAssignment[]) => {
    setEditingGroup(group);
    setEditFromDate(group[0].date);
    setEditToDate(group[group.length - 1].date);
    setEditNotes(group[0].notes || '');
    setErrorMsg('');
  };

  const handleSaveEdit = async () => {
    if (!editingGroup) return;
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
        }),
      });

      const res = await fetch('/api/roster/assign-range', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: airman.id,
          dutyCode: editingGroup[0].dutyCode,
          idaShift: editingGroup[0].idaShift,
          fromDate: editFromDate,
          toDate: editToDate,
          notes: editNotes,
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
`;

content = content.replace("const [categoryFilter, setCategoryFilter] = useState<string>(initialCategory);", stateInjection);

// Replace hover className with cursor pointer and onClick
content = content.replace(
  '<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">',
  '<tr key={idx} onClick={() => handleGroupClick(group)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" title="Click to edit or remove">'
);
// In case there are multiple matches, replaceAll:
content = content.replaceAll(
  '<tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">',
  '<tr key={idx} onClick={() => handleGroupClick(group)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" title="Click to edit or remove">'
);

// Inject Edit Form
const uiInjection = `
              <div className="flex-1 overflow-y-auto relative">
                {editingGroup ? (
                  <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 m-4 shadow-sm animate-fadeIn">
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
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">From Date</label>
                          <input type="date" value={editFromDate} onChange={(e) => setEditFromDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">To Date</label>
                          <input type="date" value={editToDate} onChange={(e) => setEditToDate(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 uppercase tracking-wider">Destination / Details</label>
                        <input type="text" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Destination or details..." className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none text-sm font-medium" />
                      </div>
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
                ) : (categoryFilter !== 'ALL' && categoryFilter !== 'DUTY') ? (
`;

content = content.replace(
  '<div className="flex-1 overflow-y-auto">\n                {(categoryFilter !== \'ALL\' && categoryFilter !== \'DUTY\') ? (',
  uiInjection
);
// There might be another <div className="flex-1 overflow-y-auto"> without exactly that match, so I will do:
content = content.replace(
  '<div className="flex-1 overflow-y-auto">\n                {(categoryFilter !== \'ALL\' && categoryFilter !== \'DUTY\') ?',
  uiInjection.trim()
);

fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);


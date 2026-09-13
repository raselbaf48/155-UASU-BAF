import React, { useState, useEffect } from 'react';
import { Rank, FlightName, DutyCategoryCode } from '../types';
import { getCustomDuties, saveCustomDuties, CustomDutyConfig, removeCustomDuty, addCustomDuty } from '../utils/customDuties';
import { Plus, Trash2, Shield, Settings, Info } from 'lucide-react';

const ALL_FLIGHTS: FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];
const ALL_RANKS: Rank[] = ['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];

const CATEGORIES = ['Security', 'Taskforce', 'Special', 'Status', 'Off'] as const;

export const CustomDutiesTab: React.FC = () => {
  const [duties, setDuties] = useState<CustomDutyConfig[]>(getCustomDuties());
  
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState<Partial<CustomDutyConfig>>({
    name: '',
    shortName: '',
    category: 'Status',
    isCountedAsDuty: false,
    eligibleFlights: [],
    eligibleRanks: []
  });

  const handleSave = () => {
    if (!draft.name || !draft.shortName) return;
    
    // Auto-generate code from shortname
    let newCode = draft.shortName.toUpperCase().replace(/\s+/g, '_') as DutyCategoryCode;
    
    // Ensure uniqueness
    const existingCodes = new Set(getCustomDuties().map(d => d.code));
    let counter = 1;
    let finalCode = newCode;
    while (existingCodes.has(finalCode) || finalCode === 'GD' || finalCode === 'IDAC' || finalCode === 'TDY' || finalCode === 'ATT' || finalCode === 'LEAVE') {
      finalCode = `${newCode}_${counter}` as DutyCategoryCode;
      counter++;
    }
    newCode = finalCode;

    const newDuty: CustomDutyConfig = {
      isCustom: true,
      code: newCode,
      name: draft.name,
      shortName: draft.shortName,
      category: draft.category || 'Status',
      isCountedAsDuty: !!draft.isCountedAsDuty,
      description: `Custom Duty: ${draft.name}`,
      color: 'bg-indigo-600 text-white',
      badgeBg: 'bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-700',
      badgeText: 'text-indigo-800 dark:text-indigo-300',
      eligibleFlights: draft.eligibleFlights && draft.eligibleFlights.length > 0 ? draft.eligibleFlights : undefined,
      eligibleRanks: draft.eligibleRanks && draft.eligibleRanks.length > 0 ? draft.eligibleRanks : undefined,
    };

    addCustomDuty(newDuty);
    setDuties(getCustomDuties());
    setIsAdding(false);
    setDraft({
      name: '',
      shortName: '',
      category: 'Status',
      isCountedAsDuty: false,
      eligibleFlights: [],
      eligibleRanks: []
    });
  };

  const toggleFlight = (f: FlightName) => {
    const current = draft.eligibleFlights || [];
    if (current.includes(f)) {
      setDraft({ ...draft, eligibleFlights: current.filter(x => x !== f) });
    } else {
      setDraft({ ...draft, eligibleFlights: [...current, f] });
    }
  };

  const toggleRank = (r: Rank) => {
    const current = draft.eligibleRanks || [];
    if (current.includes(r)) {
      setDraft({ ...draft, eligibleRanks: current.filter(x => x !== r) });
    } else {
      setDraft({ ...draft, eligibleRanks: [...current, r] });
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Custom Duties</h3>
          <p className="text-xs text-slate-500">Create new duty types and restrict them by Flight or Rank.</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" /> Add New Duty
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Duty Name</label>
              <input 
                type="text" 
                value={draft.name} 
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Special Guard"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Short Name</label>
              <input 
                type="text" 
                value={draft.shortName} 
                onChange={(e) => setDraft({ ...draft, shortName: e.target.value })}
                placeholder="e.g. SG"
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:text-white"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Category</label>
              <select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value as any })}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-sm outline-none focus:border-indigo-500 dark:text-white"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className="space-y-2 flex flex-col justify-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={draft.isCountedAsDuty}
                  onChange={(e) => setDraft({ ...draft, isCountedAsDuty: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300"
                />
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Counts towards total duty count</span>
              </label>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" /> Eligible Flights
              <span className="text-xs font-normal text-slate-500">(Leave empty for all flights)</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {ALL_FLIGHTS.map(f => (
                <button
                  key={f}
                  onClick={() => toggleFlight(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    (draft.eligibleFlights || []).includes(f)
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-indigo-500" /> Eligible Ranks
              <span className="text-xs font-normal text-slate-500">(Leave empty for all ranks)</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {ALL_RANKS.map(r => (
                <button
                  key={r}
                  onClick={() => toggleRank(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    (draft.eligibleRanks || []).includes(r)
                      ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => setIsAdding(false)}
              className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={!draft.name || !draft.shortName}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-sm transition-colors"
            >
              Save Custom Duty
            </button>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        {duties.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Info className="w-8 h-8 mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-bold">No custom duties defined yet.</p>
            <p className="text-xs mt-1">Click "Add New Duty" to create your first custom duty.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {duties.map(d => (
              <div key={d.code} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">{d.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/50">{d.shortName}</span>
                  </div>
                  <div className="flex gap-4 mt-2">
                    <div className="text-xs text-slate-500">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Category:</span> {d.category}
                    </div>
                    <div className="text-xs text-slate-500">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Flights:</span> {d.eligibleFlights ? d.eligibleFlights.join(', ') : 'All'}
                    </div>
                    <div className="text-xs text-slate-500">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Ranks:</span> {d.eligibleRanks ? d.eligibleRanks.join(', ') : 'All'}
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this duty?')) {
                      removeCustomDuty(d.code);
                      setDuties(getCustomDuties());
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

import { DUTY_TYPE_MAP } from '../data/dutyTypes';
import React, { useState, useEffect, useMemo } from 'react';
import { AlertCircle, Settings, Info, Users, ChevronDown, ChevronUp, Calendar, X, Save, Power, PowerOff, Trash, Filter, Plus, Minus } from 'lucide-react';
import { localDb } from '../services/localDatabase';
import { Airman, Rank, FlightName, DutyCategoryCode } from '../types';
import { addCustomDuty, CustomDutyConfig, removeCustomDuty } from '../utils/customDuties';

const DEFAULT_TOTAL_DUTY = {
  syDuty: 88,
  btfDuty: 22,
  ntfDuty: 40,
  idacMorning: 31,
  idacAfternoon: 31,
  idacNight: 62,
  reception: 31,
  airfieldDuty: 93,
};

const DEFAULT_MANPOWER = {
  mechSgt: 5,
  mechCpl: 6,
  aviSgt: 4,
  aviCpl: 3,
  gcsSgt: 5,
  gcsCpl: 6,
  adminSgt: 0,
  adminCpl: 1,
};

import { DutyRatioTable } from '../data/officialDutyRatioMatrix';



const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
// Helper function to auto-distribute duty data based on manpower
const autoDistributeTableData = (table: DutyRatioTable, currentManpower: any) => {
    const includesSgt = table.eligibleRanks ? table.eligibleRanks.includes('Sgt') : table.id !== 'security_duty';
    const isCplOnly = !includesSgt;
    const dutyTotal = table.totalRequiredMonth || 0;
    
    const flights = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
    const flightPools: Record<string, number> = {};
    let actualPoolSize = 0;
    
    flights.forEach(fl => {
        let fltCpl = 0, fltSgt = 0;
        if (fl === 'Mechanics') { fltCpl = currentManpower.mechCpl; fltSgt = currentManpower.mechSgt; }
        if (fl === 'Avionics') { fltCpl = currentManpower.aviCpl; fltSgt = currentManpower.aviSgt; }
        if (fl === 'GCS') { fltCpl = currentManpower.gcsCpl; fltSgt = currentManpower.gcsSgt; }
        if (fl === 'Admin') { fltCpl = currentManpower.adminCpl; fltSgt = currentManpower.adminSgt; }
        
        let fltPool = isCplOnly ? fltCpl : (fltCpl + fltSgt);
        if (table.eligibleFlights && !table.eligibleFlights.includes(fl as any)) {
            fltPool = 0;
        }
        flightPools[fl] = fltPool;
        actualPoolSize += fltPool;
    });
    
    const flightQuotas: Record<string, number> = { Mechanics: 0, Avionics: 0, GCS: 0, Admin: 0 };
    
    if (dutyTotal > 0 && actualPoolSize > 0) {
        const exactVals = flights.map(fl => {
            const exact = (flightPools[fl] / actualPoolSize) * dutyTotal;
            return { flight: fl, exact: exact, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
        });
        
        let allocated = 0;
        exactVals.forEach(item => { flightQuotas[item.flight] = item.floor; allocated += item.floor; });
        let remaining = dutyTotal - allocated;
        
        const sortedForDistribution = [...exactVals]
            .filter(item => flightPools[item.flight] > 0)
            .sort((a, b) => b.remainder - a.remainder);
            
        for (let i = 0; i < remaining && i < sortedForDistribution.length; i++) {
            flightQuotas[sortedForDistribution[i].flight] += 1;
        }
    }
    
    if (!table.data) table.data = { Mechanics: [], Avionics: [], GCS: [], Admin: [] } as any;
    
    // Determine daily slots. If dailyRequirements is present and its sum matches dutyTotal, use it.
    // Otherwise, generate a default dailyRequirements that perfectly spreads dutyTotal.
    let dailyReqs = table.dailyRequirements || new Array(31).fill(0);
    const reqSum = dailyReqs.reduce((a, b) => a + b, 0);
    
    if (reqSum !== dutyTotal || reqSum === 0) {
        dailyReqs = new Array(31).fill(0);
        if (dutyTotal > 0) {
            const step = 31 / dutyTotal;
            let current = 0;
            for (let i = 0; i < dutyTotal; i++) {
                let idx = Math.floor(current);
                if (idx > 30) idx = 30;
                dailyReqs[idx]++;
                current += step;
            }
        }
        table.dailyRequirements = dailyReqs; // Update it so UI shows perfectly
    }
    
    // Create an array of available slots based on dailyReqs
    const availableSlots: number[] = [];
    dailyReqs.forEach((count, dayIdx) => {
        for (let i = 0; i < count; i++) {
            availableSlots.push(dayIdx);
        }
    });
    
    // Sort flights by quota descending to assign the biggest quotas first
    const sortedFlights = flights.map(f => ({ name: f, quota: flightQuotas[f] || 0 })).sort((a, b) => b.quota - a.quota);
    
    const assignedData: Record<string, number[]> = {
        Mechanics: new Array(31).fill(0),
        Avionics: new Array(31).fill(0),
        GCS: new Array(31).fill(0),
        Admin: new Array(31).fill(0)
    };
    
    // Distribute quotas evenly across the available slots
    let slotIdx = 0;
    sortedFlights.forEach(fl => {
        const step = availableSlots.length / fl.quota;
        let current = 0;
        for (let i = 0; i < fl.quota; i++) {
            // Assign to the slot
            const actualSlot = availableSlots[Math.floor(slotIdx + current) % availableSlots.length];
            assignedData[fl.name][actualSlot]++;
            current += step;
        }
        slotIdx += (step / 2); // Offset to avoid overlapping same days too much
    });
    
    table.data = assignedData as any;
    
    return table;
};

export interface DutyRatioConfigPanelProps {
  matrix?: DutyRatioTable[];
  onMatrixChange?: (newMatrix: DutyRatioTable[]) => void;
  activeTab?: 'DUTY_DISTRIBUTION' | 'MANPOWER' | 'DUTY_LIST';
  targetDate?: string;
}

export const DutyRatioConfigPanel: React.FC<DutyRatioConfigPanelProps> = ({ activeTab, matrix, onMatrixChange, targetDate }) => {
  const [totalDuty, setTotalDuty] = useState(() => {
    const savedDuty = localStorage.getItem('baf_duty_distribution_total_duty');
    return savedDuty ? JSON.parse(savedDuty) : DEFAULT_TOTAL_DUTY;
  });
  
  const [manpower, setManpower] = useState(() => {
    const savedManpower = localStorage.getItem('baf_duty_distribution_manpower');
    return savedManpower ? JSON.parse(savedManpower) : DEFAULT_MANPOWER;
  });

  const [customFltDist, setCustomFltDist] = useState<Record<string, Record<string, number | undefined>>>(() => {
    const saved = localStorage.getItem('baf_duty_distribution_custom_flt');
    return saved ? JSON.parse(saved) : {};
  });

  const [showExactRatio, setShowExactRatio] = useState(false);

  useEffect(() => {
    localStorage.setItem('baf_duty_distribution_total_duty', JSON.stringify(totalDuty));
    localStorage.setItem('baf_duty_distribution_custom_flt', JSON.stringify(customFltDist));
    window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated'));
  }, [totalDuty, customFltDist]);


  
  const [showNominalRoll, setShowNominalRoll] = useState(false);
  const [nominalRollFlightFilter, setNominalRollFlightFilter] = useState<FlightName | 'All'>('All');
  const [disposals, setDisposals] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('baf_duty_distribution_disposals_' + (targetDate || 'default'));
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    const saved = localStorage.getItem('baf_duty_distribution_disposals_' + (targetDate || 'default'));
    setDisposals(saved ? JSON.parse(saved) : {});
  }, [targetDate]);

  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState<number | null>(null);
  
  // Edit Duty Modal State
  const [editingDutyIdx, setEditingDutyIdx] = useState<number | null>(null);
  const [editDutySerNo, setEditDutySerNo] = useState<number | ''>('');
  const [editDutyName, setEditDutyName] = useState('');
  const [editDutyFlights, setEditDutyFlights] = useState<FlightName[]>([]);
  const [editDutyRanks, setEditDutyRanks] = useState<Rank[]>([]);
  
  // New Duty Modal State
  const [isAddingNewDuty, setIsAddingNewDuty] = useState(false);
  const [newDutySerNo, setNewDutySerNo] = useState<number | ''>('');
  const [newDutyName, setNewDutyName] = useState('');
  const [newDutyFlights, setNewDutyFlights] = useState<FlightName[]>(['Mechanics', 'Avionics', 'GCS', 'Admin']);
  const [newDutyRanks, setNewDutyRanks] = useState<Rank[]>(['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2']);

  const [settingsTableIdx, setSettingsTableIdx] = useState<number | null>(null);
  const [airmen, setAirmen] = useState<Airman[]>([]);
  useEffect(() => {
    const allAirmen = localDb.getAirmen().filter(a => a.active);
    const sgtAndBelow = allAirmen.filter(a => !['MWO', 'SWO', 'WO'].includes(a.rank));
    setAirmen(sgtAndBelow);
  }, []);

  useEffect(() => {
    localStorage.setItem('baf_duty_distribution_disposals_' + (targetDate || 'default'), JSON.stringify(disposals));
    window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated'));
  }, [disposals, targetDate]);

  const airmanDefaults = useMemo(() => {
    const map: Record<string, string> = {};
    let gcsTdyCount = 0;
    const assignments = targetDate ? (localDb.getRoster(targetDate.substring(0, 7)).assignments || []).filter(a => a.date === targetDate) : [];

    airmen.forEach(a => {
      const myAssignments = assignments.filter(assign => assign.airmanId === a.id);
      const bake = myAssignments.find(assign => assign.dutyCode === 'BAKE_N_BITE');
      const canteen = myAssignments.find(assign => assign.dutyCode === 'CANTEEN');

      if (bake) {
        map[a.id] = 'Bake & Bite';
      } else if (canteen) {
        map[a.id] = 'Canteen';
      } else if (myAssignments.some(assign => assign.dutyCode === 'TDY')) {
        if (a.flightName === 'GCS' && ['Cpl', 'LAC', 'AC-1', 'AC-2'].includes(a.rank)) {
          if (gcsTdyCount < 1) {
            map[a.id] = 'TDY';
            gcsTdyCount++;
          } else {
            map[a.id] = '-';
          }
        } else {
          map[a.id] = '-';
        }
      } else if (a.rank === 'Sgt' && (a.trade === 'Sec Asst GD' || (a.trade && a.trade.toLowerCase().includes('sec asst')))) {
        map[a.id] = 'Orderly Room';
      } else if (a.rank === 'Sgt' && (a.trade === 'Admin asst' || a.trade === 'Admin Asst' || (a.trade && a.trade.toLowerCase().includes('admin asst')))) {
        map[a.id] = 'UWO';
      } else {
        map[a.id] = '-';
      }
    });

    return map;
  }, [airmen, targetDate]);

  const filteredAirmen = useMemo(() => {
    if (nominalRollFlightFilter === 'All') return airmen;
    return airmen.filter(a => a.flightName === nominalRollFlightFilter);
  }, [airmen, nominalRollFlightFilter]);

  const getEffectiveManpower = () => {
    const counts = {
      mechSgt: 0, mechCpl: 0,
      aviSgt: 0, aviCpl: 0,
      gcsSgt: 0, gcsCpl: 0,
      adminSgt: 0, adminCpl: 0,
    };

    airmen.forEach(a => {
      let disp = disposals[a.id];
      // For migration of existing bad data
      if (disp === 'Deployment' || disp === 'Deployment (Bake & Bite)' || disp === 'Deployment (Canteen)') {
         disp = undefined; // Force recalculation if it's the generic word
      }
      
      if (disp === undefined || disp === '') {
        disp = airmanDefaults[a.id];
      }

      if (!disp || disp.trim() === '' || disp.trim() === '-') {
        const isSgt = a.rank === 'Sgt';
        if (a.flightName === 'Mechanics') isSgt ? counts.mechSgt++ : counts.mechCpl++;
        if (a.flightName === 'Avionics') isSgt ? counts.aviSgt++ : counts.aviCpl++;
        if (a.flightName === 'GCS') isSgt ? counts.gcsSgt++ : counts.gcsCpl++;
        if (a.flightName === 'Admin') isSgt ? counts.adminSgt++ : counts.adminCpl++;
      }
    });
    return counts;
  };

  const effManpower = getEffectiveManpower();
  // Override manpower with calculated effManpower so that totalSgt etc uses it!
  const currentManpower = effManpower;
  
  const totalSgt = currentManpower.mechSgt + currentManpower.aviSgt + currentManpower.gcsSgt + currentManpower.adminSgt;
  const totalCpl = currentManpower.mechCpl + currentManpower.aviCpl + currentManpower.gcsCpl + currentManpower.adminCpl;
  const totalSgtAndBelow = totalSgt + totalCpl;

  useEffect(() => {
    localStorage.setItem('baf_duty_distribution_manpower', JSON.stringify(currentManpower));
    window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated'));
  }, [JSON.stringify(currentManpower)]);

  const calculatedMatrixDistributions = useMemo(() => {
    if (!matrix) return {};
    const result: Record<string, Record<string, { autoVal: number, exactVal: number }>> = {};
    
    // Tracker to balance pure ties across different duty types
    const tieBreakerTracker: Record<string, number> = {
      'Mechanics': 0, 'Avionics': 0, 'GCS': 0, 'Admin': 0
    };
    
    matrix.forEach(t => {
      const isSecurity = t.id === 'security_duty';
      const dutyTotal = t.totalRequiredMonth || 0;
      
      const flights = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
      const flightPools: Record<string, number> = {};
      
      let actualPoolSize = 0;
      flights.forEach(fl => {
        let fltCpl = 0, fltSgt = 0;
        if (fl === 'Mechanics') { fltCpl = currentManpower.mechCpl; fltSgt = currentManpower.mechSgt; }
        if (fl === 'Avionics') { fltCpl = currentManpower.aviCpl; fltSgt = currentManpower.aviSgt; }
        if (fl === 'GCS') { fltCpl = currentManpower.gcsCpl; fltSgt = currentManpower.gcsSgt; }
        if (fl === 'Admin') { fltCpl = currentManpower.adminCpl; fltSgt = currentManpower.adminSgt; }
        
        let fltPool = isSecurity ? fltCpl : (fltCpl + fltSgt);
        if (t.eligibleFlights && !t.eligibleFlights.includes(fl as any)) {
          fltPool = 0;
        }
        flightPools[fl] = fltPool;
        actualPoolSize += fltPool;
      });

      if (dutyTotal === 0 || actualPoolSize === 0) {
        result[t.id] = flights.reduce((acc, fl) => ({ ...acc, [fl]: { autoVal: 0, exactVal: 0 } }), {});
        return;
      }

      const exactVals = flights.map(fl => {
        const exact = (flightPools[fl] / actualPoolSize) * dutyTotal;
        return {
          flight: fl,
          exact: exact,
          floor: Math.floor(exact),
          remainder: exact - Math.floor(exact)
        };
      });

      const allocated = exactVals.reduce((sum, item) => sum + item.floor, 0);
      const remaining = dutyTotal - allocated;

      const sortedForDistribution = [...exactVals]
        .filter(item => flightPools[item.flight] > 0)
        .sort((a, b) => {
        const diff = b.remainder - a.remainder;
        if (Math.abs(diff) > 1e-9) {
          return diff; // larger remainder first
        }
        const floorDiff = a.floor - b.floor;
        if (floorDiff !== 0) {
          return floorDiff; // tie breaker 1: lower total duty (floor) first
        }
        // tie breaker 2: alternate based on who has received fewer extra tie-breaker duties
        return tieBreakerTracker[a.flight] - tieBreakerTracker[b.flight];
      });

      for (let i = 0; i < remaining && i < sortedForDistribution.length; i++) {
        sortedForDistribution[i].floor += 1;
        // Record allocation to balance future pure ties
        tieBreakerTracker[sortedForDistribution[i].flight] += 1;
      }

      result[t.id] = {};
      exactVals.forEach(item => {
        result[t.id][item.flight] = { autoVal: item.floor, exactVal: item.exact };
      });
    });
    
    return result;
  }, [matrix, JSON.stringify(currentManpower), totalCpl, totalSgtAndBelow]);

  return (
    <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-8 min-h-max overflow-auto text-sm font-sans relative" style={{ fontFamily: 'Arial, sans-serif' }}>
      
      {/* Main Headers */}
      <div className="text-center mb-6">
        <div className="font-bold underline text-lg">All Duties</div>
        <div className="font-bold underline text-lg">155 UASU BAF</div>
      </div>

      {/* Conditionally rendered Top Tables Flex */}
      <div className="flex flex-col md:flex-row justify-center gap-12 mb-8">
        
                {(!activeTab || activeTab === 'DUTY_LIST' || activeTab === 'TOTAL_DUTY') && (
          <div className="w-full max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="font-bold underline text-center flex-1">DUTY LIST</div>
              <button
                onClick={() => {
                  setNewDutyName('');
                  setNewDutyFlights(['Mechanics', 'Avionics', 'GCS', 'Admin']);
                  setNewDutyRanks(['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2']);
                  setIsAddingNewDuty(true);
                }}
                className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
              >
                + Add New
              </button>
            </div>
            
            
            {/* Box Type Duty List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {matrix && matrix.map((table, idx) => {
                const maxDaily = Math.max(...(table.dailyRequirements || []), table.totalRequiredDaily || 0);
                return (
                  <div key={table.id} className={`relative p-4 rounded-xl border transition-colors ${table.isDisabled ? 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 opacity-60' : 'bg-white border-indigo-100 shadow-sm dark:bg-slate-900 dark:border-indigo-900/50'}`}>
                    
                    {/* Action buttons */}
                    <div className="absolute top-2 right-2 flex items-center space-x-1">
                      <button 
                        onClick={() => {
                          if (onMatrixChange) {
                            const newMatrix = [...matrix];
                            newMatrix[idx] = { ...newMatrix[idx], isDisabled: !newMatrix[idx].isDisabled };
                            onMatrixChange(newMatrix);
                          }
                        }}
                        className={`p-1.5 rounded-md transition-colors ${table.isDisabled ? 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}
                        title={table.isDisabled ? 'Enable Duty' : 'Disable Duty (Temporary)'}
                      >
                        {table.isDisabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => {
                          setEditingDutyIdx(idx);
                          setEditDutyName(table.title);
                          setEditDutySerNo(table.serNo ?? '');
                          setEditDutyFlights(table.eligibleFlights || ['Mechanics', 'Avionics', 'GCS', 'Admin']);
                          setEditDutyRanks(table.eligibleRanks || ['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2']);
                        }}
                        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        title="Duty Settings"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Duty Name */}
                    <div className="pr-16 mb-4">
                      <div className={`w-full bg-transparent font-bold text-base truncate ${table.isDisabled ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-200'}`}>
                        {table.serNo !== undefined ? `${table.serNo}. ` : ''}{table.title}
                      </div>
                    </div>

                    {/* Daily Req Box */}
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">Daily Max Req</span>
                        <div className="flex items-baseline space-x-1">
                          <span className={`font-mono text-xl font-black ${table.isDisabled ? 'text-slate-400' : 'text-indigo-600 dark:text-indigo-400'}`}>{maxDaily}</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => setSettingsTableIdx(idx)}
                        className={`p-2 rounded-full transition-colors ${table.isDisabled ? 'text-slate-400 cursor-not-allowed' : 'text-indigo-500 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50'}`}
                        disabled={table.isDisabled}
                        title="Configure Daily Requirements"
                      >
                        <Calendar className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Monthly Total:</span>
                      {(() => {
                        const calculatedTotal = (table.dailyRequirements && Array.isArray(table.dailyRequirements) && table.dailyRequirements.length > 0)
                          ? table.dailyRequirements.reduce((sum, v) => sum + (Number(v) || 0), 0)
                          : (table.totalRequiredMonth || (table.totalRequiredDaily ? table.totalRequiredDaily * 31 : 0) || ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((sum, fl) => sum + (table.data?.[fl as FlightName]?.reduce((s, c) => s + c, 0) || 0), 0));
                        return (
                          <span className={`text-sm font-bold font-mono ${table.isDisabled ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {calculatedTotal}
                          </span>
                        );
                      })()}
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Modal for Calendar configuration */}
            {settingsTableIdx !== null && matrix && matrix[settingsTableIdx] && (
              <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                  
                  {/* Modal Header */}
                  <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">Configure Daily Requirements</h3>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{matrix[settingsTableIdx].title}</span>
                        <span className="text-xs px-2 py-0.5 rounded-md font-bold font-mono bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200">
                          Total: {((matrix[settingsTableIdx].dailyRequirements && matrix[settingsTableIdx].dailyRequirements!.length > 0)
                            ? matrix[settingsTableIdx].dailyRequirements!.reduce((a, b) => a + (Number(b) || 0), 0)
                            : (matrix[settingsTableIdx].totalRequiredMonth || (matrix[settingsTableIdx].totalRequiredDaily ? matrix[settingsTableIdx].totalRequiredDaily * 31 : 0)))} days
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSettingsTableIdx(null)}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                    >
                      <X className="w-5 h-5 text-slate-500" />
                    </button>
                  </div>

                  {/* Modal Body */}
                  <div className="p-6 overflow-y-auto">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-5 border border-indigo-100 dark:border-indigo-900/50">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
                        <div>
                           <h4 className="font-bold text-sm text-indigo-900 dark:text-indigo-300 mb-1">Set Requirement for All Days</h4>
                           <p className="text-xs text-indigo-700/80 dark:text-indigo-300/70">Applies a default value to the entire month.</p>
                        </div>
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm w-fit">
                            <button 
                              onClick={() => {
                                const input = document.getElementById('panelGlobalReqInput') as HTMLInputElement;
                                let val = parseInt(input.value, 10);
                                if (isNaN(val)) val = 0;
                                if (val > 0) input.value = (val - 1).toString();
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition-colors"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <input 
                              type="text"
                              readOnly
                              id="panelGlobalReqInput"
                              className="w-12 px-1 py-1 text-base font-bold font-mono text-center bg-transparent border-none focus:outline-none text-slate-800 dark:text-slate-100"
                              defaultValue={matrix[settingsTableIdx]?.totalRequiredDaily || 0}
                            />
                            <button 
                              onClick={() => {
                                const input = document.getElementById('panelGlobalReqInput') as HTMLInputElement;
                                let val = parseInt(input.value, 10);
                                if (isNaN(val)) val = 0;
                                input.value = (val + 1).toString();
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 transition-colors"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <button 
                            onClick={() => {
                              const val = parseInt((document.getElementById('panelGlobalReqInput') as HTMLInputElement).value, 10);
                              if (isNaN(val)) return;
                              if (onMatrixChange) {
                                const updated = [...matrix];
                                updated[settingsTableIdx] = { ...updated[settingsTableIdx] };
                                updated[settingsTableIdx].dailyRequirements = new Array(31).fill(val);
                                updated[settingsTableIdx].totalRequiredDaily = val;
                                updated[settingsTableIdx].totalRequiredMonth = val * 31;
                                onMatrixChange(updated);
                              }
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm w-full sm:w-auto"
                          >
                            Apply to All
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map((dayNum, idx) => {
                          const table = matrix[settingsTableIdx];
                          let req = table?.dailyRequirements?.[idx];
                          if (req === undefined && table) {
                              if (table.totalRequiredDaily && (table.totalRequiredDaily * 31 === table.totalRequiredMonth)) {
                                  req = table.totalRequiredDaily;
                              } else {
                                  req = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => acc + (table.data[fl as FlightName]?.[idx] || 0), 0);
                              }
                          }
                          return (
                            <div key={dayNum} className="flex flex-col items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2 shadow-sm w-full max-w-[120px] mx-auto">
                              <label className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">Day {dayNum}</label>
                              <div className="flex items-center justify-between w-full px-1">
                                <button 
                                  onClick={() => {
                                    if (onMatrixChange) {
                                      const updated = [...matrix];
                                      updated[settingsTableIdx] = { ...updated[settingsTableIdx] };
                                      const currentReqs = updated[settingsTableIdx].dailyRequirements ? [...updated[settingsTableIdx].dailyRequirements!] : new Array(31).fill(updated[settingsTableIdx].totalRequiredDaily || 0);
                                      if (currentReqs[idx] > 0) {
                                        currentReqs[idx] -= 1;
                                        updated[settingsTableIdx].dailyRequirements = currentReqs;
                                        updated[settingsTableIdx].totalRequiredMonth = currentReqs.reduce((a, b) => a + b, 0);
                                        updated[settingsTableIdx].totalRequiredDaily = Math.max(...currentReqs);
                                        onMatrixChange(updated);
                                      }
                                    }
                                  }}
                                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                                >
                                  <Minus className="w-4 h-4" />
                                </button>
                                <span className="font-mono font-bold text-lg text-slate-800 dark:text-slate-200 w-8 text-center select-none flex-shrink-0">
                                  {req}
                                </span>
                                <button 
                                  onClick={() => {
                                    if (onMatrixChange) {
                                      const updated = [...matrix];
                                      updated[settingsTableIdx] = { ...updated[settingsTableIdx] };
                                      const currentReqs = updated[settingsTableIdx].dailyRequirements ? [...updated[settingsTableIdx].dailyRequirements!] : new Array(31).fill(updated[settingsTableIdx].totalRequiredDaily || 0);
                                      currentReqs[idx] += 1;
                                      updated[settingsTableIdx].dailyRequirements = currentReqs;
                                      updated[settingsTableIdx].totalRequiredMonth = currentReqs.reduce((a, b) => a + b, 0);
                                      updated[settingsTableIdx].totalRequiredDaily = Math.max(...currentReqs);
                                      onMatrixChange(updated);
                                    }
                                  }}
                                  className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 text-indigo-600 dark:text-indigo-400 transition-colors"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Monthly Requirement:</span>
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-mono font-black text-sm">
                        {((matrix[settingsTableIdx]?.dailyRequirements && matrix[settingsTableIdx]?.dailyRequirements!.length > 0)
                          ? matrix[settingsTableIdx]?.dailyRequirements!.reduce((a, b) => a + (Number(b) || 0), 0)
                          : (matrix[settingsTableIdx]?.totalRequiredMonth || (matrix[settingsTableIdx]?.totalRequiredDaily ? matrix[settingsTableIdx]?.totalRequiredDaily * 31 : 0)))}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">days</span>
                    </div>
                    <button 
                      onClick={() => {
                        if (onMatrixChange && matrix[settingsTableIdx]) {
                          const updated = [...matrix];
                          const cur = { ...updated[settingsTableIdx] };
                          if (cur.dailyRequirements && cur.dailyRequirements.length > 0) {
                            cur.totalRequiredMonth = cur.dailyRequirements.reduce((a, b) => a + (Number(b) || 0), 0);
                            cur.totalRequiredDaily = Math.max(...cur.dailyRequirements);
                            updated[settingsTableIdx] = cur;
                            onMatrixChange(updated);
                          }
                        }
                        setSettingsTableIdx(null);
                      }}
                      className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md rounded-xl transition-colors flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>Done</span>
                    </button>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

        </div>

        {(!activeTab || activeTab === 'MANPOWER') && (
          <>
          <div className="w-full max-w-4xl mx-auto space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <div className="font-bold underline text-center mb-4 text-slate-800 dark:text-slate-200">EFFECTIVE MANPOWER</div>
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse border border-slate-400 dark:border-slate-700 text-center bg-white dark:bg-slate-900 text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800">
                    <tr>
                      <th className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-bold">Flight</th>
                      <th className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-bold">Sgt</th>
                      <th className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-bold">Cpl & Below</th>
                      <th className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-bold text-indigo-700 dark:text-indigo-400">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {['Mechanics', 'Avionics', 'GCS', 'Admin'].map(fl => {
                       const sgtKey = fl === 'Mechanics' ? 'mechSgt' : fl === 'Avionics' ? 'aviSgt' : fl === 'GCS' ? 'gcsSgt' : 'adminSgt';
                       const cplKey = fl === 'Mechanics' ? 'mechCpl' : fl === 'Avionics' ? 'aviCpl' : fl === 'GCS' ? 'gcsCpl' : 'adminCpl';
                       const sgtCount = currentManpower[sgtKey as keyof typeof currentManpower];
                       const cplCount = currentManpower[cplKey as keyof typeof currentManpower];
                       return (
                        <tr key={fl}>
                          <td className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-semibold text-slate-700 dark:text-slate-300">{fl}</td>
                          <td className="border border-slate-400 dark:border-slate-700 px-3 py-2">{sgtCount}</td>
                          <td className="border border-slate-400 dark:border-slate-700 px-3 py-2">{cplCount}</td>
                          <td className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-bold text-indigo-600 dark:text-indigo-400">{sgtCount + cplCount}</td>
                        </tr>
                       );
                    })}
                    <tr className="bg-slate-50 dark:bg-slate-800/50">
                      <td className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-black">Total</td>
                      <td className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-black">{totalSgt}</td>
                      <td className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-black">{totalCpl}</td>
                      <td className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-black text-indigo-700 dark:text-indigo-400">{totalSgtAndBelow}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowNominalRoll(!showNominalRoll)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-center space-x-2 font-bold text-slate-700 dark:text-slate-300">
                    <Users className="w-5 h-5 text-indigo-500" />
                    <span>Nominal Roll</span>
                  </div>
                  {showNominalRoll ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
                </button>
                
                {showNominalRoll && (
                  <div className="p-0 overflow-x-auto">
                    {/* Flight Filter Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center space-x-2 text-xs">
                        <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <Filter className="w-3.5 h-3.5 text-indigo-500" />
                          Flight:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(['All', 'Mechanics', 'Avionics', 'GCS', 'Admin'] as const).map(flt => (
                            <button
                              key={flt}
                              type="button"
                              onClick={() => setNominalRollFlightFilter(flt)}
                              className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                                nominalRollFlightFilter === flt
                                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {flt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        Total: <span className="font-bold text-indigo-600 dark:text-indigo-400">{filteredAirmen.length}</span> Airmen
                      </div>
                    </div>

                    <table className="w-full text-xs border-collapse table-auto">
                      <thead className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold">
                        <tr>
                          <th className="px-3 py-2 text-center border-b border-slate-300 dark:border-slate-600 whitespace-nowrap">Ser No</th>
                          <th className="px-3 py-2 text-center border-b border-slate-300 dark:border-slate-600 whitespace-nowrap">Rank</th>
                          <th className="px-3 py-2 text-center border-b border-slate-300 dark:border-slate-600 whitespace-nowrap">Name</th>
                          <th className="px-3 py-2 text-center border-b border-slate-300 dark:border-slate-600 whitespace-nowrap">Trade</th>
                          <th className="px-3 py-2 text-center border-b border-slate-300 dark:border-slate-600 whitespace-nowrap">Flight</th>
                          <th className="px-3 py-2 text-center border-b border-slate-300 dark:border-slate-600 whitespace-nowrap">Disposal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {filteredAirmen.map((a, idx) => {
                          const defaultDisp = airmanDefaults[a.id] || '-';
                          let currentVal = (disposals[a.id] !== undefined && disposals[a.id] !== '') ? disposals[a.id] : defaultDisp;
                          
                          // Migration for old bad state
                          if (currentVal === 'Deployment' || currentVal === 'Deployment (Bake & Bite)' || currentVal === 'Deployment (Canteen)') {
                             currentVal = defaultDisp;
                          }

                          if (!currentVal || currentVal.trim() === '') {
                             currentVal = '-';
                          }

                          const isEven = idx % 2 === 0;

                          return (
                            <tr 
                              key={a.id} 
                              className={`transition-colors hover:bg-indigo-50/50 dark:hover:bg-slate-700/50 ${
                                isEven ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/40'
                              }`}
                            >
                              <td className="px-3 py-2 text-center font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">{idx + 1}</td>
                              <td className="px-3 py-2 text-center font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{formatAirmanName(a.rank)}</td>
                              <td className="px-3 py-2 text-center text-slate-800 dark:text-slate-200 whitespace-nowrap">{a.name}</td>
                              <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">{a.trade}</td>
                              <td className="px-3 py-2 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">{a.flightName}</td>
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                <select
                                  value={currentVal}
                                  onChange={(e) => setDisposals({ ...disposals, [a.id]: e.target.value })}
                                  className="w-full min-w-[120px] px-2 py-1 text-xs text-center bg-transparent border-0 border-b border-transparent hover:border-slate-300 focus:border-indigo-500 text-slate-800 dark:text-slate-200 outline-none focus:ring-0 transition-colors cursor-pointer"
                                >
                                  <option value="-" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">-</option>
                                  <option value="Orderly Room" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Orderly Room</option>
                                  <option value="UWO" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">UWO</option>
                                  <option value="TDY" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">TDY</option>
                                  <option value="Bake & Bite" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Bake & Bite</option>
                                  <option value="Canteen" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Canteen</option>
                                  {currentVal && !['-', 'Orderly Room', 'UWO', 'TDY', 'Bake & Bite', 'Canteen'].includes(currentVal) && (
                                    <option value={currentVal} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">{currentVal}</option>
                                  )}
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            </div>

                    </>
      )}

      {(!activeTab || activeTab === 'DUTY_DISTRIBUTION') && (
        <>
          {/* DISTRIBUTION AS PER MANPOWER */}
          <div className="mb-8 overflow-x-auto">
            <div className="text-center mb-2">
              <div className="font-bold underline text-sm mb-0.5">DISTRIBUTION AS PER MANPOWER</div>
              <div className="underline text-sm">FORMULA</div>
            </div>
            <table className="border-collapse border border-slate-400 dark:border-slate-700 text-center w-full min-w-[900px] text-[13px] bg-white dark:bg-slate-900">
              <thead>
                <tr>
                  {matrix && matrix.map(t => (
                    <th key={t.id} className="border border-slate-400 dark:border-slate-700 px-2 py-2 font-bold">{t.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="text-[10px]">
                  {matrix && matrix.map(t => {
                     const isSecurity = t.id === 'security_duty';
                     return (
                       <td key={t.id} className="border border-slate-400 dark:border-slate-700 px-1 py-1">
                         Total {t.title} ÷ Total<br/>
                         {(() => {
                           const ranksToUse = t.eligibleRanks || DUTY_TYPE_MAP.get(t.dutyCode as any)?.eligibleRanks;
                           if (ranksToUse && ranksToUse.length > 0) {
                              const RANK_ORDER = ['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];
                              const sorted = [...ranksToUse].sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b));
                              return sorted[0] + ' & Below';
                           }
                           return isSecurity ? 'Cpl & Below' : 'Sgt & Below';
                         })()}
                       </td>
                     );
                  })}
                </tr>
                <tr>
                  {matrix && matrix.map(t => {
                     const isSecurity = t.id === 'security_duty';
                     let poolSize = 0;
                     ['Mechanics', 'Avionics', 'GCS', 'Admin'].forEach(fl => {
                       if (t.eligibleFlights && !t.eligibleFlights.includes(fl as any)) return;
                       
                       let fltCpl = 0, fltSgt = 0;
                       if (fl === 'Mechanics') { fltCpl = currentManpower.mechCpl; fltSgt = currentManpower.mechSgt; }
                       if (fl === 'Avionics') { fltCpl = currentManpower.aviCpl; fltSgt = currentManpower.aviSgt; }
                       if (fl === 'GCS') { fltCpl = currentManpower.gcsCpl; fltSgt = currentManpower.gcsSgt; }
                       if (fl === 'Admin') { fltCpl = currentManpower.adminCpl; fltSgt = currentManpower.adminSgt; }
                       
                       poolSize += isSecurity ? fltCpl : (fltCpl + fltSgt);
                     });
                     
                     const val = poolSize > 0 ? ((t.totalRequiredMonth || 0) / poolSize) : 0;
                     return (
                       <td key={t.id} className="border border-slate-400 dark:border-slate-700 px-2 py-1 font-mono">
                         {val.toFixed(2)}
                       </td>
                     );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* DISTRIBUTION AS PER FLIGHT */}
          <div className="overflow-x-auto pb-4">
            <div className="flex flex-col items-center mb-4 relative w-full">
              <div className="font-bold underline text-sm mb-2 md:mb-0.5 mt-1 md:mt-0">DISTRIBUTION AS PER FLIGHT</div>
              <div className="w-full flex justify-center md:absolute md:right-0 md:top-0 mb-3 md:mb-0 md:w-auto">
                <button 
                  onClick={() => setShowExactRatio(!showExactRatio)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors ${showExactRatio ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                  title="Toggle view of exact mathematical ratio before rounding"
                >
                  <Info className="w-4 h-4" />
                  <span>{showExactRatio ? 'Hide Exact Ratio' : 'View Exact Ratio'}</span>
                </button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 max-w-xl text-center">
                Values auto-generate intelligently to exactly match the target total. You can edit cells manually. Delete manual values to revert to auto.
              </div>
            </div>
            
            <table className="border-collapse border border-slate-400 dark:border-slate-700 text-center w-full min-w-[900px] bg-white dark:bg-slate-900 text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-400 dark:border-slate-700 px-2 py-2 font-bold bg-slate-100 dark:bg-slate-800 text-center w-32">DUTY PER FLIGHT</th>
                  {matrix && matrix.map(t => (
                    <th key={t.id} className="border border-slate-400 dark:border-slate-700 px-2 py-2 font-bold bg-slate-100 dark:bg-slate-800">{t.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Mechanics', 'Avionics', 'GCS', 'Admin'].map(fl => {
                  return (
                    <tr key={fl}>
                      <td className="border border-slate-400 dark:border-slate-700 px-2 py-1 font-bold text-center bg-slate-50 dark:bg-slate-800">
                        {fl} FLT
                      </td>
                      {matrix && matrix.map(t => {
                        const isSecurity = t.id === 'security_duty';
                        const poolSize = isSecurity ? totalCpl : totalSgtAndBelow;
                        const dutyTotal = t.totalRequiredMonth || 0;
                        const dppVal = poolSize > 0 ? (dutyTotal / poolSize) : 0;
                        
                        let fltCpl = 0, fltSgt = 0;
                        if (fl === 'Mechanics') { fltCpl = currentManpower.mechCpl; fltSgt = currentManpower.mechSgt; }
                        if (fl === 'Avionics') { fltCpl = currentManpower.aviCpl; fltSgt = currentManpower.aviSgt; }
                        if (fl === 'GCS') { fltCpl = currentManpower.gcsCpl; fltSgt = currentManpower.gcsSgt; }
                        if (fl === 'Admin') { fltCpl = currentManpower.adminCpl; fltSgt = currentManpower.adminSgt; }
                        
                        // Retrieve pre-calculated LRM values
                        const distribution = calculatedMatrixDistributions[t.id]?.[fl];
                        const exactVal = distribution?.exactVal || 0;
                        const autoVal = distribution?.autoVal || 0;
                        
                        const manualVal = t.flightTargets?.[fl as keyof typeof t.flightTargets];
                        
                        return (
                          <td key={t.id} className="border border-slate-400 dark:border-slate-700 px-0 py-0 relative">
                            {t.eligibleFlights && !t.eligibleFlights.includes(fl as any) ? (
                                <div className="w-full text-center text-slate-400 bg-slate-100 dark:bg-slate-800/50 py-1">N/A</div>
                            ) : showExactRatio ? (
                              <div className="w-full h-full min-h-[30px] flex items-center justify-center text-xs whitespace-nowrap px-1">
                                <span className="text-slate-500 dark:text-slate-400">{exactVal.toFixed(2)}</span>
                                <span className="mx-1 text-slate-300 dark:text-slate-600">➤</span>
                                <span className={manualVal !== undefined ? 'text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 font-bold'}>
                                  {manualVal !== undefined ? manualVal : autoVal}
                                </span>
                              </div>
                            ) : (
                              <input
                                type="number"
                                className={`w-full h-full min-h-[30px] px-1 text-center bg-transparent outline-none focus:bg-indigo-50 dark:focus:bg-indigo-900/30 ${manualVal !== undefined ? 'text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300'}`}
                                placeholder={autoVal.toString()}
                                value={manualVal !== undefined ? manualVal : ''}
                                onChange={(e) => {
                                  if (onMatrixChange) {
                                     const val = e.target.value ? parseInt(e.target.value) : undefined;
                                     const newMatrix = [...matrix];
                                     const tIdx = newMatrix.findIndex(x => x.id === t.id);
                                     if (tIdx >= 0) {
                                        const newTargets = { ...(newMatrix[tIdx].flightTargets || {}) };
                                        if (val !== undefined) newTargets[fl] = val;
                                        else delete newTargets[fl];
                                        newMatrix[tIdx] = { ...newMatrix[tIdx], flightTargets: newTargets };
                                        onMatrixChange(newMatrix);
                                     }
                                  }
                                }}
                              />
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                <tr className="font-bold bg-slate-100 dark:bg-slate-800">
                  <td className="border border-slate-400 dark:border-slate-700 px-2 py-1 text-center">TOTAL</td>
                  {matrix && matrix.map(t => {
                    let totalVal = 0;
                    ['Mechanics', 'Avionics', 'GCS', 'Admin'].forEach(fl => {
                       const manual = t.flightTargets?.[fl as keyof typeof t.flightTargets];
                       if (manual !== undefined) {
                         totalVal += manual;
                       } else {
                         totalVal += calculatedMatrixDistributions[t.id]?.[fl]?.autoVal || 0;
                       }
                    });
                    
                    const warning = totalVal !== t.totalRequiredMonth;
                    return (
                      <td key={t.id} className={`border border-slate-400 dark:border-slate-700 px-2 py-1 ${warning ? 'text-red-600 dark:text-red-400' : ''}`}>
                        {totalVal}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
            
            <div className="flex justify-end mt-2">
              <button 
                onClick={() => {
                  if (onMatrixChange && matrix) {
                    const newMatrix = matrix.map(t => ({ ...t, flightTargets: {} }));
                    onMatrixChange(newMatrix);
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                Reset All Manual Edits to Auto
              </button>
            </div>
          </div>
        </>
      )}

      {deleteConfirmIdx !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6 transform transition-all">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Delete Duty</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">Are you sure you want to delete this duty? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirmIdx(null)} className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
              <button onClick={() => {
                if (onMatrixChange && matrix && deleteConfirmIdx !== null) {
                  const dutyToDelete = matrix[deleteConfirmIdx];
                  if (dutyToDelete) {
                    // Try to remove from custom duties if it's a custom duty
                    removeCustomDuty(dutyToDelete.dutyCode);
                  }
                  const newMatrix = matrix.filter((_, i) => i !== deleteConfirmIdx);
                  onMatrixChange(newMatrix);
                }
                setDeleteConfirmIdx(null);
              }} className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Duty Modal */}
      {isAddingNewDuty && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg">Add New Duty</h3>
              <button onClick={() => setIsAddingNewDuty(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-5">
              
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Ser No (Optional)</label>
                <input
                  type="number"
                  value={newDutySerNo}
                  onChange={e => setNewDutySerNo(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                  placeholder="e.g. 1"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Duty Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newDutyName}
                  onChange={e => setNewDutyName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                  placeholder="e.g. Special Guard"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Eligible Flights</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Mechanics', 'Avionics', 'GCS', 'Admin'].map(flt => (
                    <label key={flt} className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <input 
                        type="checkbox" 
                        checked={newDutyFlights.includes(flt as FlightName)} 
                        onChange={(e) => {
                          if (e.target.checked) setNewDutyFlights([...newDutyFlights, flt as FlightName]);
                          else setNewDutyFlights(newDutyFlights.filter(f => f !== flt));
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-semibold">{flt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Eligible Ranks</label>
                <div className="grid grid-cols-4 gap-2">
                  {['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'].map(rank => (
                    <label key={rank} className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <input 
                        type="checkbox" 
                        checked={newDutyRanks.includes(rank as Rank)} 
                        onChange={(e) => {
                          if (e.target.checked) setNewDutyRanks([...newDutyRanks, rank as Rank]);
                          else setNewDutyRanks(newDutyRanks.filter(r => r !== rank));
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">{rank}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end space-x-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
              <button onClick={() => setIsAddingNewDuty(false)} className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (!newDutyName.trim()) return;
                  const newCode = 'CUST_' + Date.now().toString();
                  const newCustomDuty: CustomDutyConfig = {
                    code: newCode as DutyCategoryCode,
                    name: newDutyName,
                    shortName: newDutyName.substring(0, 4).toUpperCase(),
                    category: 'Special',
                    color: 'bg-indigo-600 text-white',
                    badgeBg: 'bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-700',
                    badgeText: 'text-indigo-800 dark:text-indigo-300',
                    isCountedAsDuty: true,
                    description: newDutyName,
                    isCustom: true,
                    eligibleFlights: newDutyFlights,
                    eligibleRanks: newDutyRanks
                  };
                  
                  // Add globally
                  addCustomDuty(newCustomDuty);
                  
                  // Add to matrix
                  if (matrix && onMatrixChange) {
                    const newSerNo = newDutySerNo === '' ? undefined : Number(newDutySerNo);
                    if (newSerNo !== undefined) {
                      const isDuplicate = matrix.some((t) => t.serNo === newSerNo);
                      if (isDuplicate) {
                        alert('This Ser No is already in use. Please choose a different one.');
                        return;
                      }
                    }
                    const newMatrix = [...matrix];
                    newMatrix.push({
                      id: newCode,
                      title: newDutyName,
                      serNo: newSerNo,
                      dutyCode: newCode as DutyCategoryCode,
                      totalRequiredMonth: 0,
                      totalRequiredDaily: 0,
                      eligibleFlights: newDutyFlights,
                      eligibleRanks: newDutyRanks,
                      data: {
                        Mechanics: Array(31).fill(0),
                        Avionics: Array(31).fill(0),
                        GCS: Array(31).fill(0),
                        Admin: Array(31).fill(0),
                      }
                    });
                    newMatrix.sort((a, b) => {
                      if (a.serNo !== undefined && b.serNo !== undefined) return a.serNo - b.serNo;
                      if (a.serNo !== undefined) return -1;
                      if (b.serNo !== undefined) return 1;
                      return 0;
                    });
                    onMatrixChange(newMatrix);
                  }
                  
                  setIsAddingNewDuty(false);
                }}
                disabled={!newDutyName.trim()}
                className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md rounded-xl transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Duty Modal */}
      {editingDutyIdx !== null && matrix && matrix[editingDutyIdx] && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-lg">Duty Settings</h3>
              <button onClick={() => setEditingDutyIdx(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-5">
              
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Ser No (Optional)</label>
                <input
                  type="number"
                  value={editDutySerNo}
                  onChange={e => setEditDutySerNo(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                  placeholder="e.g. 1"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">Duty Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editDutyName}
                  onChange={e => setEditDutyName(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-900 dark:text-slate-100"
                  placeholder="e.g. Special Guard"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Eligible Flights</label>
                <div className="grid grid-cols-2 gap-2">
                  {['Mechanics', 'Avionics', 'GCS', 'Admin'].map(flt => (
                    <label key={flt} className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <input 
                        type="checkbox" 
                        checked={editDutyFlights.includes(flt as FlightName)} 
                        onChange={(e) => {
                          if (e.target.checked) setEditDutyFlights([...editDutyFlights, flt as FlightName]);
                          else setEditDutyFlights(editDutyFlights.filter(f => f !== flt));
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-semibold">{flt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Eligible Ranks</label>
                <div className="grid grid-cols-4 gap-2">
                  {['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'].map(rank => (
                    <label key={rank} className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <input 
                        type="checkbox" 
                        checked={editDutyRanks.includes(rank as Rank)} 
                        onChange={(e) => {
                          if (e.target.checked) setEditDutyRanks([...editDutyRanks, rank as Rank]);
                          else setEditDutyRanks(editDutyRanks.filter(r => r !== rank));
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">{rank}</span>
                    </label>
                  ))}
                </div>
              </div>

            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
              <button 
                onClick={() => {
                  setDeleteConfirmIdx(editingDutyIdx);
                  setEditingDutyIdx(null);
                }} 
                className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors flex items-center space-x-2"
              >
                <Trash className="w-4 h-4" />
                <span>Delete Duty</span>
              </button>
              
              <div className="flex space-x-3">
                <button onClick={() => setEditingDutyIdx(null)} className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors">
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (!editDutyName.trim()) return;
                    if (matrix && editingDutyIdx !== null && onMatrixChange) {
                      const newSerNo = editDutySerNo === '' ? undefined : Number(editDutySerNo);
                      if (newSerNo !== undefined) {
                        const isDuplicate = matrix.some((t, i) => i !== editingDutyIdx && t.serNo === newSerNo);
                        if (isDuplicate) {
                          alert('This Ser No is already in use. Please choose a different one.');
                          return;
                        }
                      }
                      const newMatrix = [...matrix];
                      const currentTable = newMatrix[editingDutyIdx];

                      const updatedTable = {
                        ...currentTable,
                        title: editDutyName,
                        serNo: newSerNo,
                        eligibleFlights: editDutyFlights,
                        eligibleRanks: editDutyRanks
                      };

                      newMatrix[editingDutyIdx] = updatedTable;
                      newMatrix.sort((a, b) => {
                        if (a.serNo !== undefined && b.serNo !== undefined) return a.serNo - b.serNo;
                        if (a.serNo !== undefined) return -1;
                        if (b.serNo !== undefined) return 1;
                        return 0;
                      });
                      onMatrixChange(newMatrix);
                    }
                    setEditingDutyIdx(null);
                  }}
                  disabled={!editDutyName.trim()}
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md rounded-xl transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

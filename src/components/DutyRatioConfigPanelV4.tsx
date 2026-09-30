import { DUTY_TYPE_MAP } from '../data/dutyTypes';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AlertCircle, Settings, Info, Users, ChevronDown, ChevronUp, Calendar, X, Save, Power, PowerOff, Trash, Filter, Plus, Minus, Printer, Edit2, Shield, Cloud, RefreshCw, CheckCircle2, Copy, Check, UploadCloud, RotateCcw } from 'lucide-react';
import { localDb } from '../services/localDatabase';
import { Airman, Rank, FlightName, DutyCategoryCode } from '../types';
import { addCustomDuty, CustomDutyConfig, removeCustomDuty } from '../utils/customDuties';
import { getSavedCustomDisposals, saveCustomDisposal, removeSavedCustomDisposal } from '../utils/customDisposalStore';
import { calculateBalancedAutoTargets, calculateExactDutyRatios, roundDutyByRule, isFixedEqualDuty, DEFAULT_MANPOWER } from '../utils/dutyDistribution';
import { pushDutyListToCloud, pullDutyListFromCloud, DutySyncResult } from '../utils/dutyCloudSync';

const STANDARD_DISPOSALS = [
  '-',
  'Orderly Room',
  'UWO',
  'TDY (Air HQ)',
  'TDY (HSIA)',
  'Att (SAIA)',
  'Bake & Bite',
  'Canteen',
];

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

import { DutyRatioTable, AllotmentType } from '../data/officialDutyRatioMatrix';



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
  onOpenManpowerExport?: () => void;
}

export const DutyRatioConfigPanel: React.FC<DutyRatioConfigPanelProps> = ({ activeTab, matrix, onMatrixChange, targetDate, onOpenManpowerExport }) => {
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
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [recentlyResetDutyId, setRecentlyResetDutyId] = useState<string | null>(null);

  const handleResetSingleDuty = (dutyId: string) => {
    if (onMatrixChange && matrix) {
      const newMatrix = matrix.map((t) => {
        if (t.id === dutyId) {
          const copy = { ...t };
          delete copy.flightTargets;
          return copy;
        }
        return t;
      });
      onMatrixChange(newMatrix);
      setRecentlyResetDutyId(dutyId);
      setTimeout(() => {
        setRecentlyResetDutyId(null);
      }, 2000);
    }
  };

  const handleResetAllDuties = () => {
    if (onMatrixChange && matrix) {
      const newMatrix = matrix.map((t) => {
        const copy = { ...t };
        delete copy.flightTargets;
        return copy;
      });
      onMatrixChange(newMatrix);
      setShowResetConfirmModal(false);
    }
  };

  useEffect(() => {
    localStorage.setItem('baf_duty_distribution_total_duty', JSON.stringify(totalDuty));
    localStorage.setItem('baf_duty_distribution_custom_flt', JSON.stringify(customFltDist));
    window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated'));
  }, [totalDuty, customFltDist]);


  
  const [showNominalRoll, setShowNominalRoll] = useState(false);
  const [nominalRollFlightFilter, setNominalRollFlightFilter] = useState<FlightName | 'All'>('All');
  const [nominalRollRankFilter, setNominalRollRankFilter] = useState<string>('All');
  const [disposals, setDisposals] = useState<Record<string, string>>(() => {
    const master = localStorage.getItem('baf_duty_distribution_disposals_master');
    if (master) {
      try { return JSON.parse(master); } catch(e) {}
    }
    const current = localStorage.getItem('baf_duty_distribution_disposals_' + (targetDate || 'default'));
    if (current) {
      try { return JSON.parse(current); } catch(e) {}
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('baf_duty_distribution_disposals_')) {
        const val = localStorage.getItem(k);
        if (val && val !== '{}') {
          try { return JSON.parse(val); } catch(e) {}
        }
      }
    }
    return {};
  });

  const saveAndSyncDisposals = (updatedDisposals: Record<string, string>) => {
    setDisposals(updatedDisposals);
    const valStr = JSON.stringify(updatedDisposals);
    
    // Save to master key so it remains persistent and unchanged across dates
    localStorage.setItem('baf_duty_distribution_disposals_master', valStr);

    const dateKey = targetDate || 'default';
    const storageKey = 'baf_duty_distribution_disposals_' + dateKey;
    localStorage.setItem(storageKey, valStr);
    
    const pendingKey = 'baf_pending_disposals_sync_baf_duty_distribution_disposals_master';
    localStorage.setItem(pendingKey, String(Date.now()));

    // Directly and reliably push to Supabase Cloud app_settings
    localDb.syncSettingToCloud('baf_duty_distribution_disposals_master', valStr).then(() => {
      setTimeout(() => {
        localStorage.removeItem(pendingKey);
      }, 5000);
    });
    localDb.syncSettingToCloud(storageKey, valStr);

    // When Manpower disposals change, auto-reset manual flightTargets so the new Manpower calculation takes effect immediately
    if (matrix && onMatrixChange) {
      const resetMatrix = matrix.map(t => {
        if (!t.flightTargets) return t;
        const copy = { ...t };
        delete copy.flightTargets;
        return copy;
      });
      onMatrixChange(resetMatrix);
    }

    window.dispatchEvent(new CustomEvent('baf_duty_ratio_updated'));
  };

  // Keep disposals persistent across date changes (Dt change korleo Manpower Er Disposal change hbe na)
  useEffect(() => {
    const handleSettingsUpdated = () => {
      const pendingKey = 'baf_pending_disposals_sync_baf_duty_distribution_disposals_master';
      const pendingTime = Number(localStorage.getItem(pendingKey) || 0);
      if (Date.now() - pendingTime < 45000) {
        return; // Don't overwrite fresh local edits
      }
      const saved = localStorage.getItem('baf_duty_distribution_disposals_master') || localStorage.getItem('baf_duty_distribution_disposals_' + (targetDate || 'default'));
      if (saved) {
        try {
          setDisposals(JSON.parse(saved));
        } catch(e) {}
      }
    };
    window.addEventListener('baf_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('baf_settings_updated', handleSettingsUpdated);
  }, []);

  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState<number | null>(null);
  
  // Edit Duty Modal State
  const [editingDutyIdx, setEditingDutyIdx] = useState<number | null>(null);
  const [editDutySerNo, setEditDutySerNo] = useState<number | ''>('');
  const [editDutyName, setEditDutyName] = useState('');
  const [editDutyFlights, setEditDutyFlights] = useState<FlightName[]>([]);
  const [editDutyRanks, setEditDutyRanks] = useState<Rank[]>([]);
  const [editDutyAllotmentType, setEditDutyAllotmentType] = useState<AllotmentType>('ratio');
  
  // New Duty Modal State
  const [isAddingNewDuty, setIsAddingNewDuty] = useState(false);
  const [newDutySerNo, setNewDutySerNo] = useState<number | ''>('');
  const [newDutyName, setNewDutyName] = useState('');
  const [newDutyFlights, setNewDutyFlights] = useState<FlightName[]>(['Mechanics', 'Avionics', 'GCS', 'Admin']);
  const [newDutyRanks, setNewDutyRanks] = useState<Rank[]>(['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2']);
  const [newDutyAllotmentType, setNewDutyAllotmentType] = useState<AllotmentType>('ratio');

  // Cloud Sync State for "All Duty & Daily Quota"
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showRlsModal, setShowRlsModal] = useState<boolean>(false);
  const [hasCopiedSql, setHasCopiedSql] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const handleCloudSync = async () => {
    setIsSyncingCloud(true);
    setCloudSyncMsg(null);
    try {
      const pullRes = await pullDutyListFromCloud();
      if (pullRes.success) {
        if (pullRes.matrix && onMatrixChange) {
          onMatrixChange(pullRes.matrix);
        }
        setLastSyncTime(new Date().toLocaleTimeString());
        setCloudSyncMsg({ text: pullRes.message || 'Synced successfully!', type: 'success' });
        setTimeout(() => setCloudSyncMsg(null), 4000);
      } else if (pullRes.isRlsBlocked) {
        setShowRlsModal(true);
        setCloudSyncMsg({ text: 'Cloud Table RLS is blocking access', type: 'error' });
      } else {
        setCloudSyncMsg({ text: pullRes.message || 'Cloud sync failed', type: 'error' });
      }
    } catch (err: any) {
      setCloudSyncMsg({ text: err.message || 'Network sync error', type: 'error' });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handlePushToCloud = async () => {
    if (!matrix || matrix.length === 0) return;
    setIsSyncingCloud(true);
    setCloudSyncMsg(null);
    try {
      const pushRes = await pushDutyListToCloud(matrix);
      if (pushRes.success) {
        setLastSyncTime(new Date().toLocaleTimeString());
        setCloudSyncMsg({ text: pushRes.message || 'Saved to Cloud!', type: 'success' });
        setTimeout(() => setCloudSyncMsg(null), 4000);
      } else if (pushRes.isRlsBlocked) {
        setShowRlsModal(true);
        setCloudSyncMsg({ text: 'Cloud Table RLS is blocking access', type: 'error' });
      } else {
        setCloudSyncMsg({ text: pushRes.message || 'Cloud push failed', type: 'error' });
      }
    } catch (err: any) {
      setCloudSyncMsg({ text: err.message || 'Network sync error', type: 'error' });
    } finally {
      setIsSyncingCloud(false);
    }
  };

  // Auto-sync once on mount if in DUTY_LIST view
  useEffect(() => {
    if (activeTab === 'DUTY_LIST' || activeTab === 'TOTAL_DUTY') {
      pullDutyListFromCloud().then(res => {
        if (res.success && res.matrix && onMatrixChange) {
          onMatrixChange(res.matrix);
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      });
    }
  }, [activeTab]);

  const [savedCustomList, setSavedCustomList] = useState<string[]>(() => getSavedCustomDisposals());
  const [openDropdownAirmanId, setOpenDropdownAirmanId] = useState<string | null>(null);
  const [deletingCustomItem, setDeletingCustomItem] = useState<string | null>(null);
  const [customModalAirman, setCustomModalAirman] = useState<{ id: string; name: string; rank: string; flightName: string; currentValue: string } | null>(null);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    const handleCustomUpdate = () => {
      setSavedCustomList(getSavedCustomDisposals());
    };
    window.addEventListener('baf_custom_disposals_updated', handleCustomUpdate);
    return () => window.removeEventListener('baf_custom_disposals_updated', handleCustomUpdate);
  }, []);

  const handleSaveCustomDisposal = () => {
    if (!customModalAirman) return;
    const trimmed = customInput.trim();
    const finalVal = trimmed || '-';
    
    if (trimmed && !STANDARD_DISPOSALS.includes(trimmed)) {
      saveCustomDisposal(trimmed, true);
      setSavedCustomList(getSavedCustomDisposals());
    }

    saveAndSyncDisposals({
      ...disposals,
      [customModalAirman.id]: finalVal,
    });

    setCustomModalAirman(null);
    setCustomInput('');
  };

  const handleConfirmDeleteCustomItem = () => {
    if (!deletingCustomItem) return;
    const itemToDelete = deletingCustomItem;
    const updated = removeSavedCustomDisposal(itemToDelete);
    setSavedCustomList(updated);

    // Clean from disposals state for all airmen so it does not persist or re-save
    const next = { ...disposals };
    let changed = false;
    Object.keys(next).forEach(id => {
      if (next[id] && typeof next[id] === 'string' && next[id].trim().toLowerCase() === itemToDelete.trim().toLowerCase()) {
        next[id] = '-';
        changed = true;
      }
    });
    if (changed) {
      saveAndSyncDisposals(next);
    }

    setDeletingCustomItem(null);
  };

  const [settingsTableIdx, setSettingsTableIdx] = useState<number | null>(null);
  const [airmen, setAirmen] = useState<Airman[]>([]);
  useEffect(() => {
    const allAirmen = localDb.getAirmen().filter(a => a.active);
    const sgtAndBelow = allAirmen.filter(a => !['MWO', 'SWO', 'WO'].includes(a.rank));
    setAirmen(sgtAndBelow);
  }, []);

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
            map[a.id] = 'TDY (Air HQ)';
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
    return airmen.filter(a => {
      if (nominalRollFlightFilter !== 'All' && a.flightName !== nominalRollFlightFilter) {
        return false;
      }
      if (nominalRollRankFilter === 'All') {
        return true;
      }
      if (nominalRollRankFilter === 'Cpl & Below') {
        return ['Cpl', 'LAC', 'AC-1', 'AC-2'].includes(a.rank);
      }
      return a.rank === nominalRollRankFilter;
    });
  }, [airmen, nominalRollFlightFilter, nominalRollRankFilter]);

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
      if (disp === 'TDY') {
        disp = 'TDY (Air HQ)';
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

  const [activeDistributionCell, setActiveDistributionCell] = useState<{ tableId: string; flight: string } | null>(null);
  const activeCellRef = useRef<HTMLTableCellElement | null>(null);

  useEffect(() => {
    if (!activeDistributionCell) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (activeCellRef.current && !activeCellRef.current.contains(e.target as Node)) {
        setActiveDistributionCell(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [activeDistributionCell]);

  const handleTargetChange = (tableId: string, fl: string, val: number | undefined) => {
    if (!onMatrixChange || !matrix) return;
    const newMatrix = [...matrix];
    const tIdx = newMatrix.findIndex(x => x.id === tableId);
    if (tIdx >= 0) {
      const newTargets = { ...(newMatrix[tIdx].flightTargets || {}) };
      if (val !== undefined && !isNaN(val)) {
        newTargets[fl] = val;
      } else {
        delete newTargets[fl];
      }
      newMatrix[tIdx] = { ...newMatrix[tIdx], flightTargets: newTargets };
      onMatrixChange(newMatrix);
    }
  };

  const calculatedMatrixDistributions = useMemo(() => {
    if (!matrix) return {};
    const balanced = calculateBalancedAutoTargets(matrix, currentManpower, false);
    const exactRatios = calculateExactDutyRatios(matrix, currentManpower);
    const result: Record<string, Record<string, { autoVal: number, exactVal: number }>> = {};
    
    matrix.forEach(t => {
      result[t.id] = {};
      const flights = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
      flights.forEach(fl => {
        const autoVal = balanced[fl as FlightName]?.[t.id] ?? 0;
        const exactVal = exactRatios[t.id]?.[fl as FlightName] ?? autoVal;
        result[t.id][fl] = { autoVal, exactVal };
      });
    });
    
    return result;
  }, [matrix, JSON.stringify(currentManpower)]);

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
            <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-bold underline text-base">DUTY LIST</span>
                {lastSyncTime && (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Cloud Synced
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCloudSync}
                  disabled={isSyncingCloud}
                  className="px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-700 rounded-lg shadow-sm transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
                  title="Sync with Supabase table 'All Duty & Daily Quota'"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                  <span>{isSyncingCloud ? 'Syncing...' : 'Cloud Sync'}</span>
                </button>
                <button
                  onClick={() => {
                    setNewDutyName('');
                    setNewDutyFlights(['Mechanics', 'Avionics', 'GCS', 'Admin']);
                    setNewDutyRanks(['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2']);
                    setIsAddingNewDuty(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                >
                  + Add New
                </button>
              </div>
            </div>

            {cloudSyncMsg && (
              <div className={`mb-4 p-2.5 rounded-xl text-xs font-medium flex items-center justify-between border ${
                cloudSyncMsg.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
              }`}>
                <span>{cloudSyncMsg.text}</span>
                {cloudSyncMsg.type === 'error' && (
                  <button
                    onClick={() => setShowRlsModal(true)}
                    className="ml-2 underline font-bold hover:text-amber-950 dark:hover:text-amber-100 cursor-pointer"
                  >
                    View SQL Fix
                  </button>
                )}
              </div>
            )}

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
                            pushDutyListToCloud(newMatrix).catch(console.warn);
                          }
                        }}
                        className={`p-1.5 rounded-md transition-colors ${table.isDisabled ? 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700' : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`}
                        title={table.isDisabled ? 'Enable Duty' : 'Disable Duty (Temporary)'}
                      >
                        {table.isDisabled ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => {
                          const elig = table.eligibleFlights || ['Mechanics', 'Avionics', 'GCS', 'Admin'];
                          setEditingDutyIdx(idx);
                          setEditDutyName(table.title);
                          setEditDutySerNo(table.serNo ?? '');
                          setEditDutyFlights(elig);
                          setEditDutyRanks(table.eligibleRanks || (table.title.toLowerCase().includes('security') ? ['Cpl', 'LAC', 'AC-1', 'AC-2'] : ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2']));
                          setEditDutyAllotmentType(elig.length === 1 ? 'equal' : (table.allotmentType || (isFixedEqualDuty(table) ? 'equal' : 'ratio')));
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

                    <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-500 dark:text-slate-400 font-semibold">Allotment:</span>
                      {table.eligibleFlights && table.eligibleFlights.length === 1 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          One From Each Flt (Must)
                        </span>
                      ) : (table.allotmentType === 'equal' || isFixedEqualDuty(table)) ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          One From Each Flt
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          As Per Ratio
                        </span>
                      )}
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
                                pushDutyListToCloud(updated).catch(console.warn);
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
                                        pushDutyListToCloud(updated).catch(console.warn);
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
                                      pushDutyListToCloud(updated).catch(console.warn);
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
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-4">
                <div className="font-bold underline text-center sm:text-left text-slate-800 dark:text-slate-200 text-base">EFFECTIVE MANPOWER</div>
              </div>
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
                    {/* Flight & Rank Filter Bar */}
                    <div className="flex flex-col gap-2.5 px-4 py-2.5 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                      {/* Row 1: Flight Filter & Total Counter */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center space-x-2 text-xs">
                          <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 min-w-[50px]">
                            <Filter className="w-3.5 h-3.5 text-indigo-500" />
                            Flight:
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(['All', 'Mechanics', 'Avionics', 'GCS', 'Admin'] as const).map(flt => (
                              <button
                                key={flt}
                                type="button"
                                onClick={() => setNominalRollFlightFilter(flt)}
                                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
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

                      {/* Row 2: Rank Filter (flt er niche) */}
                      <div className="flex items-center space-x-2 text-xs pt-1.5 border-t border-slate-200 dark:border-slate-700/60">
                        <span className="font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 min-w-[50px]">
                          <Shield className="w-3.5 h-3.5 text-indigo-500" />
                          Rank:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(['All', 'Sgt', 'Cpl & Below', 'Cpl', 'LAC', 'AC-1', 'AC-2'] as const).map(rk => (
                            <button
                              key={rk}
                              type="button"
                              onClick={() => setNominalRollRankFilter(rk)}
                              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                nominalRollRankFilter === rk
                                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-500'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600'
                              }`}
                            >
                              {rk}
                            </button>
                          ))}
                        </div>
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
                          if (currentVal === 'TDY') {
                             currentVal = 'TDY (Air HQ)';
                          }

                          if (!currentVal || currentVal.trim() === '') {
                             currentVal = '-';
                          }

                          const isCustomVal = currentVal && !STANDARD_DISPOSALS.includes(currentVal);
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
                              <td className="px-3 py-2 text-left font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{a.name}</td>
                              <td className="px-3 py-2 text-left text-slate-600 dark:text-slate-400 whitespace-nowrap">{a.trade}</td>
                              <td className="px-3 py-2 text-left text-slate-600 dark:text-slate-400 whitespace-nowrap">{a.flightName}</td>
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center">
                                  <select
                                    value={currentVal || '-'}
                                    onChange={(e) => {
                                      saveAndSyncDisposals({ ...disposals, [a.id]: e.target.value });
                                    }}
                                    className="min-w-[130px] max-w-[165px] px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
                                  >
                                    <option value="-">-</option>
                                    <option value="Orderly Room">Orderly Room</option>
                                    <option value="UWO">UWO</option>
                                    <option value="TDY (Air HQ)">TDY (Air HQ)</option>
                                    <option value="TDY (HSIA)">TDY (HSIA)</option>
                                    <option value="Att (SAIA)">Att (SAIA)</option>
                                    <option value="Bake & Bite">Bake & Bite</option>
                                    <option value="Canteen">Canteen</option>
                                  </select>
                                </div>
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
                  {matrix && matrix.filter(t => !t.isDisabled).map(t => (
                    <th key={t.id} className="border border-slate-400 dark:border-slate-700 px-2 py-2 font-bold">{t.title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="text-[10px]">
                  {matrix && matrix.filter(t => !t.isDisabled).map(t => {
                     const isSecurity = t.id === 'security_duty';
                     const isEqual = isFixedEqualDuty(t);
                     return (
                       <td key={t.id} className="border border-slate-400 dark:border-slate-700 px-1 py-1">
                         {isEqual ? (
                           <>
                             Total {t.title} ÷ Total<br/>
                             Eligible Flights
                           </>
                         ) : (
                           <>
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
                           </>
                         )}
                       </td>
                     );
                  })}
                </tr>
                <tr>
                  {matrix && matrix.filter(t => !t.isDisabled).map(t => {
                     const isSecurity = t.id === 'security_duty';
                     const isEqual = isFixedEqualDuty(t);
                     const elig = t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights : ['Mechanics', 'Avionics', 'GCS', 'Admin'];
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
                     
                     const val = isEqual 
                       ? (elig.length > 0 ? ((t.totalRequiredMonth || 0) / elig.length) : 0)
                       : (poolSize > 0 ? ((t.totalRequiredMonth || 0) / poolSize) : 0);
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
            <div className="flex flex-col items-center justify-center mb-4 w-full gap-2">
              <div className="font-bold underline text-sm text-center">DISTRIBUTION AS PER FLIGHT</div>
              <div className="flex justify-center items-center gap-2">
                <button 
                  onClick={() => setShowExactRatio(!showExactRatio)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold border transition-colors shadow-xs ${showExactRatio ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 dark:hover:bg-slate-700'}`}
                  title="Toggle view of exact mathematical ratio before rounding"
                >
                  <Info className="w-4 h-4" />
                  <span>{showExactRatio ? 'Hide Exact Ratio' : 'View Exact Ratio'}</span>
                </button>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 text-center max-w-xl">
                দশমিকের পর ৫০ বা তার কম থাকলে আগের পূর্ণ সংখ্যা এবং ৫০ এর বেশি থাকলে পরের পূর্ণ সংখ্যা হবে। মোট ম্যাচ না করলে লাল রঙে দেখাবে (ম্যানুয়ালি পরিবর্তনযোগ্য)।
              </div>
            </div>
            
            <table className="border-collapse border border-slate-400 dark:border-slate-700 text-center w-full min-w-[900px] bg-white dark:bg-slate-900 text-sm">
              <thead>
                <tr>
                  <th className="border border-slate-400 dark:border-slate-700 px-2 py-2 font-bold bg-slate-100 dark:bg-slate-800 text-center w-32">DUTY PER FLIGHT</th>
                  {matrix && matrix.filter(t => !t.isDisabled).map(t => (
                    <th key={t.id} className="border border-slate-400 dark:border-slate-700 px-2 py-2 font-bold bg-slate-100 dark:bg-slate-800">{t.title}</th>
                  ))}
                  <th className="border border-slate-400 dark:border-slate-700 px-3 py-2 font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200 text-center w-28">TOTAL DUTY</th>
                </tr>
              </thead>
              <tbody>
                {['Mechanics', 'Avionics', 'GCS', 'Admin'].map(fl => {
                  let flightTotalDuties = 0;
                  matrix && matrix.filter(t => !t.isDisabled).forEach(t => {
                    if (t.eligibleFlights && !t.eligibleFlights.includes(fl as any)) return;
                    const manualVal = t.flightTargets?.[fl as keyof typeof t.flightTargets];
                    const autoVal = calculatedMatrixDistributions[t.id]?.[fl]?.autoVal || 0;
                    flightTotalDuties += (manualVal !== undefined ? manualVal : autoVal);
                  });

                  return (
                    <tr key={fl}>
                      <td className="border border-slate-400 dark:border-slate-700 px-2 py-1 font-bold text-center bg-slate-50 dark:bg-slate-800">
                        {fl} FLT
                      </td>
                      {matrix && matrix.filter(t => !t.isDisabled).map(t => {
                        const isSecurity = t.id === 'security_duty';
                        const poolSize = isSecurity ? totalCpl : totalSgtAndBelow;
                        const dutyTotal = t.totalRequiredMonth || 0;
                        const dppVal = poolSize > 0 ? (dutyTotal / poolSize) : 0;
                        
                        let fltCpl = 0, fltSgt = 0;
                        if (fl === 'Mechanics') { fltCpl = currentManpower.mechCpl; fltSgt = currentManpower.mechSgt; }
                        if (fl === 'Avionics') { fltCpl = currentManpower.aviCpl; fltSgt = currentManpower.aviSgt; }
                        if (fl === 'GCS') { fltCpl = currentManpower.gcsCpl; fltSgt = currentManpower.gcsSgt; }
                        if (fl === 'Admin') { fltCpl = currentManpower.adminCpl; fltSgt = currentManpower.adminSgt; }
                        
                        // Retrieve pre-calculated rule-based values
                        const distribution = calculatedMatrixDistributions[t.id]?.[fl];
                        const exactVal = distribution?.exactVal || 0;
                        const autoVal = distribution?.autoVal || 0;
                        
                        const manualVal = t.flightTargets?.[fl as keyof typeof t.flightTargets];
                        const isOverridden = manualVal !== undefined && manualVal !== autoVal;
                        const currentVal = manualVal !== undefined ? manualVal : autoVal;
                        const isActive = activeDistributionCell?.tableId === t.id && activeDistributionCell?.flight === fl;
                        
                        return (
                          <td 
                            key={t.id} 
                            ref={isActive ? activeCellRef : undefined}
                            onClick={() => {
                              if (t.eligibleFlights && !t.eligibleFlights.includes(fl as any)) return;
                              setActiveDistributionCell({ tableId: t.id, flight: fl });
                            }}
                            className={`border border-slate-400 dark:border-slate-700 px-0 py-0 relative transition-colors ${
                              t.eligibleFlights && !t.eligibleFlights.includes(fl as any)
                                ? ''
                                : isActive
                                ? 'bg-indigo-50 dark:bg-indigo-950/70 ring-2 ring-indigo-500 z-10'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer'
                            }`}
                          >
                            {t.eligibleFlights && !t.eligibleFlights.includes(fl as any) ? (
                              <div className="w-full text-center text-slate-400 bg-slate-100 dark:bg-slate-800/50 py-1">N/A</div>
                            ) : isActive ? (
                              <div className="w-full h-full min-h-[30px] flex items-center justify-center px-1 py-0.5 gap-1 select-none" onClick={(e) => e.stopPropagation()}>
                                {showExactRatio && (
                                  <span className="text-slate-500 dark:text-slate-400 text-[10px] whitespace-nowrap">
                                    {exactVal.toFixed(2)} ➤
                                  </span>
                                )}
                                <div
                                  className={`min-w-[24px] px-1 py-0.5 text-center font-bold font-mono text-xs rounded border select-none ${
                                    isOverridden
                                      ? 'bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-900/60 dark:text-indigo-200 dark:border-indigo-600 font-black ring-1 ring-indigo-400/50'
                                      : 'bg-white text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600'
                                  }`}
                                >
                                  {currentVal}
                                </div>
                                <div className="flex flex-col gap-[1px]" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleTargetChange(t.id, fl, currentVal + 1)}
                                    className="w-3.5 h-3 flex items-center justify-center bg-indigo-50 hover:bg-indigo-200 active:bg-indigo-300 dark:bg-indigo-950/60 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-[2px] border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                    title="Increase (+1)"
                                  >
                                    <ChevronUp className="w-2.5 h-2.5 stroke-[3]" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleTargetChange(t.id, fl, Math.max(0, currentVal - 1))}
                                    className="w-3.5 h-3 flex items-center justify-center bg-indigo-50 hover:bg-indigo-200 active:bg-indigo-300 dark:bg-indigo-950/60 dark:hover:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-[2px] border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                                    title="Decrease (-1)"
                                  >
                                    <ChevronDown className="w-2.5 h-2.5 stroke-[3]" />
                                  </button>
                                </div>
                              </div>
                            ) : showExactRatio ? (
                              <div className="w-full h-full min-h-[30px] flex items-center justify-center text-xs whitespace-nowrap px-1">
                                <span className="text-slate-500 dark:text-slate-400">{exactVal.toFixed(2)}</span>
                                <span className="mx-1 text-slate-300 dark:text-slate-600">➤</span>
                                <span className={isOverridden ? 'text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 font-bold'}>
                                  {currentVal}
                                </span>
                              </div>
                            ) : (
                              <div className="w-full h-full min-h-[30px] flex items-center justify-center text-xs px-1">
                                <span className={isOverridden ? 'text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300 font-bold'}>
                                  {currentVal}
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="border border-slate-400 dark:border-slate-700 px-2 py-1 font-bold text-center bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 font-mono text-sm">
                        {flightTotalDuties}
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-bold bg-slate-100 dark:bg-slate-800">
                  <td className="border border-slate-400 dark:border-slate-700 px-2 py-1 text-center">TOTAL</td>
                  {matrix && matrix.filter(t => !t.isDisabled).map(t => {
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
                      <td 
                        key={t.id} 
                        className={`border border-slate-400 dark:border-slate-700 px-2 py-1 text-center font-bold transition-colors ${
                          warning 
                            ? 'text-red-600 dark:text-red-400 bg-red-100/60 dark:bg-red-950/50 font-black' 
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                        title={warning ? `Current total: ${totalVal}, Target: ${t.totalRequiredMonth}` : `Matched: ${totalVal}`}
                      >
                        {totalVal}
                      </td>
                    );
                  })}
                  <td className={`border border-slate-400 dark:border-slate-700 px-2 py-1 text-center font-black font-mono text-sm ${
                    (() => {
                      let grandTotal = 0;
                      let grandRequired = 0;
                      ['Mechanics', 'Avionics', 'GCS', 'Admin'].forEach(fl => {
                        matrix && matrix.filter(t => !t.isDisabled).forEach(t => {
                          if (t.eligibleFlights && !t.eligibleFlights.includes(fl as any)) return;
                          const manual = t.flightTargets?.[fl as keyof typeof t.flightTargets];
                          grandTotal += (manual !== undefined ? manual : (calculatedMatrixDistributions[t.id]?.[fl]?.autoVal || 0));
                        });
                      });
                      matrix && matrix.filter(t => !t.isDisabled).forEach(t => {
                        grandRequired += (t.totalRequiredMonth || 0);
                      });
                      return grandTotal !== grandRequired
                        ? 'text-red-600 dark:text-red-400 bg-red-100/80 dark:bg-red-950/60 font-black'
                        : 'bg-indigo-200 dark:bg-indigo-900 text-indigo-950 dark:text-indigo-100';
                    })()
                  }`}>
                    {(() => {
                      let grandTotal = 0;
                      ['Mechanics', 'Avionics', 'GCS', 'Admin'].forEach(fl => {
                        matrix && matrix.filter(t => !t.isDisabled).forEach(t => {
                          if (t.eligibleFlights && !t.eligibleFlights.includes(fl as any)) return;
                          const manual = t.flightTargets?.[fl as keyof typeof t.flightTargets];
                          grandTotal += (manual !== undefined ? manual : (calculatedMatrixDistributions[t.id]?.[fl]?.autoVal || 0));
                        });
                      });
                      return grandTotal;
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
            
            <div className="flex justify-end mt-3">
              <button 
                type="button"
                onClick={() => setShowResetConfirmModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors shadow-xs bg-white text-slate-700 border-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 cursor-pointer"
                title="Reset to default auto calculation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reset to Default Modal - Select Single Active Duty or Reset All */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div 
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 dark:border-slate-800 overflow-hidden transform transition-all animate-scaleUp flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-slate-800 dark:to-amber-950/20 shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-xl">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    Reset Duty to Default Quota
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    যে ডিউটিতে ক্লিক করবেন শুধুমাত্র সেই ডিউটিটি রিসেট হবে
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Instruction Banner */}
            <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 shrink-0">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                তালিকা থেকে যেকোনো ডিউটিতে ক্লিক করুন—<strong>শুধুমাত্র সেই ডিউটির</strong> ম্যানুয়াল কোটা রিস্টোর হয়ে অটো রেশিওতে ফিরে যাবে।
              </div>
            </div>

            {/* Active Duties Scrollable List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-100 dark:divide-slate-800/60">
              {(() => {
                const activeDuties = (matrix || []).filter((t) => !t.isDisabled);
                if (activeDuties.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                      কোনো সক্রিয় ডিউটি পাওয়া যায়নি।
                    </div>
                  );
                }
                return activeDuties.map((t, idx) => {
                  const hasManualTargets = !!t.flightTargets && Object.values(t.flightTargets).some((v) => (v ?? 0) > 0);
                  const isRecentlyReset = recentlyResetDutyId === t.id;
                  const monthTotal = (t.dailyRequirements && t.dailyRequirements.length > 0)
                    ? t.dailyRequirements.reduce((sum, v) => sum + (Number(v) || 0), 0)
                    : (t.totalRequiredMonth || (t.totalRequiredDaily ? t.totalRequiredDaily * 31 : 0));
                  const isSingleFlt = t.eligibleFlights && t.eligibleFlights.length === 1;

                  return (
                    <div
                      key={t.id}
                      onClick={() => handleResetSingleDuty(t.id)}
                      className={`pt-2.5 first:pt-0 group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                        isRecentlyReset
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                          : hasManualTargets
                          ? 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50/40 dark:hover:bg-amber-950/20 shadow-xs'
                          : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                      title={`Click to reset ${t.title} to default auto quota`}
                    >
                      <div className="flex items-center space-x-3 min-w-0 pr-2">
                        <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                          {t.serNo !== undefined ? t.serNo : (idx + 1)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                              {t.title}
                            </h4>
                            {isSingleFlt && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shrink-0">
                                1 Flt (Must Equal)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>Req: <strong className="font-mono text-slate-700 dark:text-slate-300">{monthTotal}</strong></span>
                            <span>•</span>
                            <span className="truncate">
                              {t.eligibleFlights && t.eligibleFlights.length > 0 ? t.eligibleFlights.join(', ') : 'All Flights'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {isRecentlyReset ? (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 flex items-center space-x-1 animate-fadeIn">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Reset Done!</span>
                          </span>
                        ) : hasManualTargets ? (
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                              Manual Quota
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetSingleDuty(t.id);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100/70 hover:bg-amber-200/70 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 flex items-center space-x-1 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              Default Auto
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResetSingleDuty(t.id);
                              }}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center space-x-1 transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            <div className="px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleResetAllDuties}
                className="px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5"
                title="Reset all manual adjustments for all duties at once"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset All Active Duties</span>
              </button>

              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
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
                          const updated = e.target.checked
                            ? [...newDutyFlights, flt as FlightName]
                            : newDutyFlights.filter(f => f !== flt);
                          setNewDutyFlights(updated);
                          if (updated.length === 1) {
                            setNewDutyAllotmentType('equal');
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-semibold">{flt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Allotment Type */}
              {newDutyFlights.length === 1 ? (
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Allotment Type
                  </label>
                  <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">One From Each Flt</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-200">
                          Must
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 leading-tight">
                        যেহেতু শুধুমাত্র ১টি ফ্লাইট নির্বাচিত ({newDutyFlights[0]}), তাই Allotment Type অবশ্যই <strong>One From Each Flt</strong> হবে।
                      </p>
                    </div>
                  </div>
                </div>
              ) : newDutyFlights.length >= 2 ? (
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Allotment Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewDutyAllotmentType('ratio')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        newDutyAllotmentType === 'ratio'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="newAllotmentType"
                          checked={newDutyAllotmentType === 'ratio'}
                          onChange={() => setNewDutyAllotmentType('ratio')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">As Per Ratio</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-6 leading-tight">
                        Total duty ÷ Total eligible personnel of flight
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewDutyAllotmentType('equal')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        newDutyAllotmentType === 'equal'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="newAllotmentType"
                          checked={newDutyAllotmentType === 'equal'}
                          onChange={() => setNewDutyAllotmentType('equal')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">One From Each Flt</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-6 leading-tight">
                        Total duty ÷ Eligible flights (All flights get same allotment)
                      </p>
                    </button>
                  </div>
                </div>
              ) : null}

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
                      allotmentType: newDutyFlights.length === 1 ? 'equal' : newDutyAllotmentType,
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
                    pushDutyListToCloud(newMatrix).catch(console.warn);
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
                          const updated = e.target.checked
                            ? [...editDutyFlights, flt as FlightName]
                            : editDutyFlights.filter(f => f !== flt);
                          setEditDutyFlights(updated);
                          if (updated.length === 1) {
                            setEditDutyAllotmentType('equal');
                          }
                        }}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300 font-semibold">{flt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Allotment Type */}
              {editDutyFlights.length === 1 ? (
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Allotment Type
                  </label>
                  <div className="p-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">One From Each Flt</span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-200">
                          Must
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 leading-tight">
                        যেহেতু শুধুমাত্র ১টি ফ্লাইট নির্বাচিত ({editDutyFlights[0]}), তাই Allotment Type অবশ্যই <strong>One From Each Flt</strong> হবে।
                      </p>
                    </div>
                  </div>
                </div>
              ) : editDutyFlights.length >= 2 ? (
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Allotment Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditDutyAllotmentType('ratio')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        editDutyAllotmentType === 'ratio'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="editAllotmentType"
                          checked={editDutyAllotmentType === 'ratio'}
                          onChange={() => setEditDutyAllotmentType('ratio')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">As Per Ratio</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-6 leading-tight">
                        Total duty ÷ Total eligible personnel of flight
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditDutyAllotmentType('equal')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        editDutyAllotmentType === 'equal'
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="editAllotmentType"
                          checked={editDutyAllotmentType === 'equal'}
                          onChange={() => setEditDutyAllotmentType('equal')}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">One From Each Flt</span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-6 leading-tight">
                        Total duty ÷ Eligible flights (All flights get same allotment)
                      </p>
                    </button>
                  </div>
                </div>
              ) : null}

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

                      const finalAllotmentType: AllotmentType = editDutyFlights.length === 1 ? 'equal' : editDutyAllotmentType;
                      const allotmentTypeChanged = currentTable.allotmentType !== finalAllotmentType;
                      const updatedTable = {
                        ...currentTable,
                        title: editDutyName,
                        serNo: newSerNo,
                        eligibleFlights: editDutyFlights,
                        eligibleRanks: editDutyRanks,
                        allotmentType: finalAllotmentType,
                        flightTargets: allotmentTypeChanged ? undefined : currentTable.flightTargets,
                      };

                      newMatrix[editingDutyIdx] = updatedTable;
                      newMatrix.sort((a, b) => {
                        if (a.serNo !== undefined && b.serNo !== undefined) return a.serNo - b.serNo;
                        if (a.serNo !== undefined) return -1;
                        if (b.serNo !== undefined) return 1;
                        return 0;
                      });
                      onMatrixChange(newMatrix);
                      pushDutyListToCloud(newMatrix).catch(console.warn);
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

      {/* Custom Disposal (Others) Modal */}
      {customModalAirman && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Disposal (Others)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {formatAirmanName(customModalAirman.rank)} {customModalAirman.name} ({customModalAirman.flightName})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomModalAirman(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Custom Disposal নাম লিখুন:
              </label>
              <input
                autoFocus
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                placeholder="যেমন: Hospital, Special Duty, Escort..."
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveCustomDisposal();
                  }
                }}
              />
            </div>

            {savedCustomList.filter(item => !STANDARD_DISPOSALS.includes(item)).length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-slate-400 mb-1.5">পূর্বের সংরক্ষিত তালিকা:</div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {savedCustomList
                    .filter(item => !STANDARD_DISPOSALS.includes(item))
                    .map(item => (
                      <div
                        key={item}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      >
                        <button
                          type="button"
                          onClick={() => setCustomInput(item)}
                          className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 font-medium cursor-pointer"
                        >
                          {item}
                        </button>
                        <button
                          type="button"
                          title={`Remove ${item}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingCustomItem(item);
                          }}
                          className="text-slate-400 hover:text-red-500 rounded p-0.5 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCustomModalAirman(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={handleSaveCustomDisposal}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                সংরক্ষণ করুন (Save)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Custom Disposal Confirmation Modal */}
      {deletingCustomItem && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <Trash className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  কাস্টম ডিসপোজাল মুছে ফেলতে চান?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  "{deletingCustomItem}" অপশনটি তালিকা থেকে স্থায়ীভাবে মুছে ফেলা হবে এবং এটি আর ফিরে আসবে না।
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setDeletingCustomItem(null)}
                className="px-3.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCustomItem}
                className="px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer"
              >
                মুছে ফেলুন (Remove)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supabase RLS Permission Helper Modal */}
      {showRlsModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Enable Cloud Sync Permission (Supabase RLS)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRlsModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Supabase-এ নতুন তৈরি করা <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono font-bold text-indigo-600 dark:text-indigo-400">&quot;All Duty &amp; Daily Quota&quot;</code> টেবিলে ডিফল্টভাবে Row Level Security (RLS) সক্রিয় থাকায় অ্যাপ থেকে সরাসরি ডেটা সিঙ্ক করা ব্লক হচ্ছে।
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                নিচের SQL কমান্ডটি Supabase SQL Editor-এ রান করুন:
              </label>
              <div className="relative bg-slate-950 text-slate-100 rounded-xl p-3 font-mono text-xs border border-slate-800 select-all">
                <code>ALTER TABLE &quot;All Duty &amp; Daily Quota&quot; DISABLE ROW LEVEL SECURITY;</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('ALTER TABLE "All Duty & Daily Quota" DISABLE ROW LEVEL SECURITY;');
                    setHasCopiedSql(true);
                    setTimeout(() => setHasCopiedSql(false), 2500);
                  }}
                  className="absolute right-2 top-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  {hasCopiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{hasCopiedSql ? 'Copied!' : 'Copy SQL'}</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowRlsModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                বন্ধ করুন (Close)
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRlsModal(false);
                  handleCloudSync();
                }}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>রান করেছি, পুনরায় সিঙ্ক করুন (Retry Sync)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

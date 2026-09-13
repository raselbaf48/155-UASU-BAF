import React, { useState, useEffect } from 'react';
import { FlightName } from '../types';

const FLYING_WING_UNITS = ['Flg WG HQ', '1 SQN BAF', '3 SQN BAF', '5 SQN BAF', '21 SQN BAF', '105 AJTU BAF', '155 UASU BAF', '301 SAM UNIT'];
import { Printer, Settings, X, Plus } from 'lucide-react';

interface FlyingWingUnitData {
  unit: string;
  totalStr: number;
  detTdy: number;
  disposals: Record<string, number>;
}

interface FlyingWingStateViewProps {
  isAddModalOpen: boolean;
  onCloseAddModal: () => void;
  onOpenAddModal: () => void;
  isPrepModalOpen?: boolean;
  onClosePrepModal?: () => void;
  isPrintMode?: boolean;
  date: string;
  uasuStats: any;
}

interface SignatureDetails {
  name: string;
  rank: string;
  designation: string;
}

const DISPOSAL_COLUMNS = [
  'Leave',
  'Course',
  'Class/Exam',
  'AWOL/Detention',
  'Sick report',
  'ED/ EX PPGF',
  'CMH/ BNS/ BSH/Qrnt',
  'U/C, U/Board',
  'Office Duty',
  'Aft/Ni flg/Ni Duty/Flg',
  'TF/Base/Airfield Duty',
  'Off Duty',
  'K/O',
  'Mess/ Canteen /Bakery',
  'Driving',
  'PT/Parade on Unit',
  'Games /Guard of Honor'
];

// The default list for the dropdown
const ALL_DISPOSAL_OPTIONS = [
  'Total Str',
  'Det/Tdy',
  ...DISPOSAL_COLUMNS
];

export function FlyingWingStateView({
  isAddModalOpen,
  onCloseAddModal,
  onOpenAddModal,
  isPrepModalOpen,
  onClosePrepModal,
  isPrintMode,
  date,
  uasuStats
}: FlyingWingStateViewProps) {
  const [unitsData, setUnitsData] = useState<FlyingWingUnitData[]>([]);
  const [customColumns, setCustomColumns] = useState<string[]>([]);
  const [historicalCustomCats, setHistoricalCustomCats] = useState<string[]>(() => { try { const saved = localStorage.getItem('flg_wg_historical_custom'); return saved ? JSON.parse(saved).map(s => s === 'Total Strength' ? 'Total Str' : (s === 'Det/Tdy' ? 'Det/Tdy' : s)) : []; } catch { return []; } });
  
  // Custom disposals selected globally for the form
  const [formSavedDisposals, setFormSavedDisposals] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('flg_wg_saved_disposals_v4');
      return saved ? JSON.parse(saved).map(s => s === 'Total Strength' ? 'Total Str' : (s === 'Det/Tdy' ? 'Det/Tdy' : s)) : [...ALL_DISPOSAL_OPTIONS];
    } catch { return [...ALL_DISPOSAL_OPTIONS]; }
  });

  const getSavedPrep = (): SignatureDetails => {
    try {
      const saved = localStorage.getItem('flg_wg_prepared_by');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { name: '', rank: '', designation: '' };
  };
  const [preparedBy, setPreparedBy] = useState<SignatureDetails>(getSavedPrep());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`flg_wg_data_${date}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const migrated = parsed.map((d: any) => {
          if (d.disposals) return d;
          return {
            unit: d.unit,
            totalStr: d.totalStr || 0,
            detTdy: d.detTdy || 0,
            disposals: {
              'Leave': d.leave || 0,
              'ED/ EX PPGF': d.edExPpgf || 0,
              'CMH/ BNS/ BSH/Qrnt': d.cmhBnsBsh || 0,
              'Office Duty': d.officeDuty || 0,
              'TF/Base/Airfield Duty': d.baseAirfieldDuty || 0,
              'Driving': d.driving || 0
            }
          };
        });
        setUnitsData(migrated);
        
        // Extract custom columns from data
        const allKeys = new Set<string>();
        migrated.forEach((d: FlyingWingUnitData) => {
          Object.keys(d.disposals).forEach(k => allKeys.add(k));
        });
        const custom = Array.from(allKeys).filter(k => !DISPOSAL_COLUMNS.includes(k));
        setCustomColumns(custom);
        return;
      }
    } catch (e) {}
    
    setUnitsData(FLYING_WING_UNITS.map(unit => ({
      unit, totalStr: 0, detTdy: 0, disposals: {}
    })));
  }, [date]);

  const handlePrepSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onClosePrepModal) onClosePrepModal();
  };

  useEffect(() => {
    localStorage.setItem('flg_wg_prepared_by', JSON.stringify(preparedBy));
  }, [preparedBy]);

  const saveData = (data: FlyingWingUnitData[]) => {
    setUnitsData(data);
    localStorage.setItem(`flg_wg_data_${date}`, JSON.stringify(data));
    
    const allKeys = new Set<string>();
    data.forEach((d: FlyingWingUnitData) => {
      Object.keys(d.disposals).forEach(k => allKeys.add(k));
    });
    const custom = Array.from(allKeys).filter(k => !DISPOSAL_COLUMNS.includes(k));
    setCustomColumns(custom);
  };

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/Sept/gi, 'Sep');
    } catch {
      return dateStr;
    }
  };

  // Replace default unit "155 UASU BAF" with stats from parade state if needed
  const displayData = unitsData.map(d => {
    if (d.unit === '155 UASU BAF' && uasuStats) {
      return {
        ...d,
        totalStr: uasuStats.totalStr,
        detTdy: uasuStats.detTdy,
        disposals: {
          ...d.disposals,
          'Leave': uasuStats.leave,
          'ED/ EX PPGF': uasuStats.edExPpgf,
          'CMH/ BNS/ BSH/Qrnt': uasuStats.cmhBnsBsh,
          'Office Duty': uasuStats.officeDuty,
          'TF/Base/Airfield Duty': uasuStats.baseAirfieldDuty
        }
      };
    }
    return d;
  });

  // Modal State
  const [selectedUnit, setSelectedUnit] = useState<string>('');
    const [formDisposalValues, setFormDisposalValues] = useState<Record<string, number>>({});
  
  const [showDisposalDropdown, setShowDisposalDropdown] = useState(false);
  const [customDisposalText, setCustomDisposalText] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [isEditingDisposals, setIsEditingDisposals] = useState(false);

  useEffect(() => {
    if (isAddModalOpen && selectedUnit) {
      const existing = displayData.find(d => d.unit === selectedUnit);
      const vals: Record<string, number> = {};
      if (existing) {
        vals['Total Str'] = existing.totalStr || 0;
        vals['Det/Tdy'] = existing.detTdy || 0;
        Object.entries(existing.disposals).forEach(([k, v]) => {
          vals[k] = v as number;
        });
        
        // Ensure any keys present in this unit's data are visible in the form
        setFormSavedDisposals(prev => {
          const newKeys = Object.keys(vals).filter(k => !prev.includes(k) && vals[k] > 0);
          if (newKeys.length > 0) {
            const updated = [...prev, ...newKeys];
            localStorage.setItem('flg_wg_saved_disposals_v4', JSON.stringify(updated));
            return updated;
          }
          return prev;
        });
      }
      setFormDisposalValues(vals);
    }
  }, [selectedUnit, isAddModalOpen]);

  const handleAddDisposalToForm = (name: string) => {
    if (!ALL_DISPOSAL_OPTIONS.includes(name) && !historicalCustomCats.includes(name)) {
      const newHistory = [...historicalCustomCats, name];
      setHistoricalCustomCats(newHistory);
      localStorage.setItem('flg_wg_historical_custom', JSON.stringify(newHistory));
    }
    if (!formSavedDisposals.includes(name)) {
      const updated = [...formSavedDisposals, name];
      setFormSavedDisposals(updated);
      localStorage.setItem('flg_wg_saved_disposals_v4', JSON.stringify(updated));
    }
    setShowDisposalDropdown(false);
    setShowCustomInput(false);
    setCustomDisposalText('');
  };

  const handleRemoveDisposalFromForm = (name: string) => {
    if (!ALL_DISPOSAL_OPTIONS.includes(name) && !historicalCustomCats.includes(name)) {
      const newHistory = [...historicalCustomCats, name];
      setHistoricalCustomCats(newHistory);
      localStorage.setItem('flg_wg_historical_custom', JSON.stringify(newHistory));
    }
    const updated = formSavedDisposals.filter(d => d !== name);
    setFormSavedDisposals(updated);
    localStorage.setItem('flg_wg_saved_disposals_v4', JSON.stringify(updated));
    
    // Also remove its value from current edit
    const newVals = { ...formDisposalValues };
    delete newVals[name];
    setFormDisposalValues(newVals);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit) return;

    const newData = unitsData.map(d => {
      if (d.unit === selectedUnit) {
        const newDisposals: Record<string, number> = {};
        let newDetTdy = 0;
        let newTotalStr = 0;
        
        Object.entries(formDisposalValues).forEach(([k, v]) => {
          const val = v as number;
          if (val > 0) {
            if (k === 'Total Str' || k === 'Total Strength') newTotalStr = val;
            else if (k === 'Det/Tdy' || k === 'Det/Tdy') newDetTdy = val;
            else newDisposals[k] = val;
          }
        });
        
        return {
          ...d,
          totalStr: newTotalStr,
          detTdy: newDetTdy,
          disposals: newDisposals
        };
      }
      return d;
    });

    saveData(newData);
    onCloseAddModal();
  };

  // Totals calculation
  let t_totalStr = 0, t_detTdy = 0, t_effStr = 0, t_totalOut = 0, t_onPt = 0;
  const colTotals: Record<string, number> = {};

  return (
    <div className="bg-white dark:bg-slate-900 text-black dark:text-white print:text-black w-full min-h-screen p-4 sm:p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
      <div className="relative mb-6 text-center">
        <h1 className="font-bold tracking-wide underline inline-block text-base uppercase">
          CONSOLIDATED NIGHT COUNT STATE : BAF AIRMEN
        </h1>
        <br />
        <h2 className="font-bold tracking-wide mt-1 underline inline-block text-base uppercase">
          FLG WG
        </h2>
        <div className="text-right font-bold pr-1 text-[13px] mt-2">
          Date: {formatDateShort(date)}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-center border-collapse border border-black dark:border-slate-500 print:border-black text-[11px]">
          <thead className="font-bold">
            <tr>
              <th className="border border-black dark:border-slate-500 print:border-black p-1 w-24 align-middle text-center">Sqn/Unit</th>
              <th className="border border-black dark:border-slate-500 print:border-black p-1 break-words w-8 align-middle text-center"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Total Str</div></th>
              <th className="border border-black dark:border-slate-500 print:border-black p-1 break-words w-8 align-middle text-center"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Det/Tdy</div></th>
              <th className="border border-black dark:border-slate-500 print:border-black p-1 break-words w-8 align-middle text-center"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Eff Str</div></th>
              
              {DISPOSAL_COLUMNS.map(col => (
                <th key={col} className="border border-black dark:border-slate-500 print:border-black p-1 break-words w-6 align-middle text-center">
                  <div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">
                    {col}
                  </div>
                </th>
              ))}
              {customColumns.map(col => (
                <th key={col} className="border border-black dark:border-slate-500 print:border-black p-1 break-words w-6 align-middle text-center text-blue-800 dark:text-blue-300 print:text-blue-800">
                  <div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">
                    {col}
                  </div>
                </th>
              ))}

              <th className="border border-black dark:border-slate-500 print:border-black p-1 break-words w-6 align-middle text-center"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">Total Out PT/Parade</div></th>
              <th className="border border-black dark:border-slate-500 print:border-black p-1 break-words w-6 align-middle text-center"><div className="w-full h-32 flex items-center justify-center [writing-mode:vertical-lr] [transform:rotate(180deg)] text-[10px] leading-tight">On PT / Parade(Forecast)</div></th>
              <th className="border border-black dark:border-slate-500 print:border-black p-1 w-16 align-middle text-center">Rmks</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((d, index) => {
              const effStr = (d.totalStr || 0) - (d.detTdy || 0);
              let totalOut = 0;
              
              DISPOSAL_COLUMNS.forEach(col => {
                totalOut += (d.disposals[col] as number) || 0;
              });
              customColumns.forEach(col => {
                totalOut += d.disposals[col] || 0;
              });
              
              const onPt = effStr - totalOut;

              t_totalStr += (d.totalStr as number) || 0;
              t_detTdy += (d.detTdy as number) || 0;
              t_effStr += effStr;
              t_totalOut += totalOut;
              t_onPt += onPt;

              return (
                <tr key={d.unit} className={index === displayData.length - 1 ? 'font-bold' : ''}>
                  <td className="border border-black dark:border-slate-500 print:border-black p-1 text-center font-bold">{d.unit}</td>
                  <td className="border border-black dark:border-slate-500 print:border-black p-1">{d.totalStr || 0}</td>
                  <td className="border border-black dark:border-slate-500 print:border-black p-1">{d.detTdy || 0}</td>
                  <td className="border border-black dark:border-slate-500 print:border-black p-1">{effStr}</td>
                  
                  {DISPOSAL_COLUMNS.map(col => {
                    const val = d.disposals[col] || 0;
                    colTotals[col] = (colTotals[col] || 0) + val;
                    return <td key={col} className="border border-black dark:border-slate-500 print:border-black p-1">{val || 0}</td>;
                  })}
                  {customColumns.map(col => {
                    const val = d.disposals[col] || 0;
                    colTotals[col] = (colTotals[col] || 0) + val;
                    return <td key={col} className="border border-black dark:border-slate-500 print:border-black p-1">{val || 0}</td>;
                  })}

                  <td className="border border-black dark:border-slate-500 print:border-black p-1">{totalOut || 0}</td>
                  <td className="border border-black dark:border-slate-500 print:border-black p-1">{onPt || 0}</td>
                  <td className="border border-black dark:border-slate-500 print:border-black p-1"></td>
                </tr>
              );
            })}
            
            <tr className="font-bold">
              <td className="border border-black dark:border-slate-500 print:border-black p-1 text-center">Total</td>
              <td className="border border-black dark:border-slate-500 print:border-black p-1">{t_totalStr}</td>
              <td className="border border-black dark:border-slate-500 print:border-black p-1">{t_detTdy}</td>
              <td className="border border-black dark:border-slate-500 print:border-black p-1">{t_effStr}</td>
              {DISPOSAL_COLUMNS.map(col => (
                <td key={col} className="border border-black dark:border-slate-500 print:border-black p-1">{colTotals[col] || 0}</td>
              ))}
              {customColumns.map(col => (
                <td key={col} className="border border-black dark:border-slate-500 print:border-black p-1">{colTotals[col] || 0}</td>
              ))}
              <td className="border border-black dark:border-slate-500 print:border-black p-1">{t_totalOut}</td>
              <td className="border border-black dark:border-slate-500 print:border-black p-1">{t_onPt}</td>
              <td className="border border-black dark:border-slate-500 print:border-black p-1"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="w-full mt-16 mb-4 flex justify-start text-xs">
        <div className="flex flex-col items-start">
          <div className="mb-10 ">Prepared By</div>
          <div className="text-left">
            <div className="text-xs uppercase font-black">{preparedBy.name}</div>
            <div className="text-[11px] font-bold uppercase">{preparedBy.rank}</div>
            <div className="text-[11px] ">{preparedBy.designation}</div>
          </div>
        </div>
      </div>

      {isPrepModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm no-print">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden text-slate-800 border border-slate-200">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-bold">Prepared By Signature</h3>
            </div>
            <form onSubmit={handlePrepSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">Name</label>
                <input type="text" value={preparedBy.name} onChange={e => setPreparedBy({...preparedBy, name: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg text-sm" placeholder="e.g. A K M RAHMAN" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Rank</label>
                <input type="text" value={preparedBy.rank} onChange={e => setPreparedBy({...preparedBy, rank: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg text-sm" placeholder="e.g. SGT" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Designation</label>
                <input type="text" value={preparedBy.designation} onChange={e => setPreparedBy({...preparedBy, designation: e.target.value})} className="w-full p-2 bg-slate-50 border rounded-lg text-sm" placeholder="e.g. i/c Orderly Room" />
              </div>
              <div className="pt-2">
                <button type="submit" className="w-full py-2 bg-slate-900 text-white rounded-lg font-bold">Save Signature</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs no-print overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md my-8 text-slate-900 dark:text-white flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="font-bold text-lg">Add Disposal (Flg Wg)</h3>
                <p className="text-[11px] text-slate-500">Record disposals unit-wise</p>
              </div>
              <button onClick={() => onCloseAddModal()} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold text-2xl transition-colors">&times;</button>
            </div>
            
            <form onSubmit={handleAddSubmit} className="p-5 overflow-y-auto flex-1 space-y-6">
              {/* 1. Select Unit */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                  1. Select Unit <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:border-emerald-500 shadow-xs cursor-pointer"
                  required
                >
                  <option value="" disabled>— Select Unit —</option>
                  {FLYING_WING_UNITS.filter(u => u !== '155 UASU BAF').map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              
              
              {/* Disposals and counts block always visible */}
              <div className="space-y-4 animate-fadeIn">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                      2. Disposals & Counts
                    </label>
                    {sessionStorage.getItem('baf_user_role') === 'SUPER_ADMIN' && (
                    <button
                      type="button"
                      onClick={() => setIsEditingDisposals(!isEditingDisposals)}
                      className={`p-1 rounded-md transition-colors cursor-pointer ${isEditingDisposals ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                      title="Manage Categories"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {formSavedDisposals.map((cat) => (
                      <div key={cat} className="flex items-center gap-2 group">
                        <div className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
                          {cat}
                        </div>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={formDisposalValues[cat] || ''}
                          onChange={(e) => {
                            const val = e.target.value ? parseInt(e.target.value) : 0;
                            setFormDisposalValues({...formDisposalValues, [cat]: val});
                          }}
                          className="w-20 p-1.5 text-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-emerald-500 text-sm font-bold"
                        />
                        {isEditingDisposals && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDisposalFromForm(cat)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="Remove category from form"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        )}
                      </div>
                    ))}
                    {/* Add Button */}
                    <div className="pt-2 relative">
                      <button
                        type="button"
                        onClick={() => setShowDisposalDropdown(!showDisposalDropdown)}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-400 bg-slate-50 dark:bg-slate-900 transition-all cursor-pointer flex items-center space-x-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {formSavedDisposals.length === 0 && <span>Add Category</span>}
                      </button>
                      {showDisposalDropdown && (
                        <div className="absolute top-full mt-1 left-0 w-56 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1">
                          {Array.from(new Set([...ALL_DISPOSAL_OPTIONS, ...historicalCustomCats, ...customColumns])).filter(opt => !formSavedDisposals.includes(opt)).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleAddDisposalToForm(opt)}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-900 dark:hover:text-emerald-100 transition-colors"
                            >
                              {opt}
                            </button>
                          ))}
                          
                          <div className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1 px-2">
                            {!showCustomInput ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowCustomInput(true);
                                }}
                                className="w-full text-left px-2 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                              >
                                ✨ Custom...
                              </button>
                            ) : (
                              <div className="flex items-center space-x-1 p-1">
                                <input
                                  autoFocus
                                  type="text"
                                  value={customDisposalText}
                                  onChange={(e) => setCustomDisposalText(e.target.value)}
                                  placeholder="Custom name"
                                  className="flex-1 px-2 py-1 text-xs border rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && customDisposalText.trim()) {
                                      e.preventDefault();
                                      handleAddDisposalToForm(customDisposalText.trim());
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    if (customDisposalText.trim()) {
                                      handleAddDisposalToForm(customDisposalText.trim());
                                    }
                                  }}
                                  className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold cursor-pointer"
                                >
                                  Add
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </form>
            
            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <button
                type="button"
                onClick={handleAddSubmit}
                disabled={!selectedUnit}
                className={`w-full py-2.5 rounded-xl text-sm font-black shadow-xs transition-all ${!selectedUnit ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'}`}
              >
                Save Disposals
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

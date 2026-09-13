import React, { useState, useEffect, useMemo } from 'react';
import { FlightName, DutyCategoryCode, IDAShift, Airman, Rank } from '../types';
import {
  DutyRatioTable,
  getStoredDutyMatrix,
  saveDutyMatrix,
  resetDutyMatrixToDefault,
  parseDayNumber,
} from '../data/officialDutyRatioMatrix';
import { X, Check, RefreshCw, Sliders, Info, Calculator, Table as TableIcon, Save } from 'lucide-react';

interface FlightDutyRatioModalProps {
  date: string;
  airmen?: Airman[];
  onClose: () => void;
  onRatiosUpdated?: () => void;
}

interface DutyRatioItemConfig {
  tableId: string;
  title: string;
  dutyCode: DutyCategoryCode;
  shiftLabel?: IDAShift;
  badgeBg: string;
  badgeText: string;
  shortName: string;
  defaultMonthly: number;
  perPersonBase: "CPL_AND_BELOW" | "SGT_AND_BELOW";
  description?: string;
}

const CONFIGURABLE_DUTY_ITEMS: DutyRatioItemConfig[] = [
  { tableId: 'security_duty', title: 'BASE SECURITY DUTY', dutyCode: 'GD', badgeBg: 'bg-blue-100 dark:bg-blue-950', badgeText: 'text-blue-700 dark:text-blue-300', shortName: 'GD', defaultMonthly: 88, perPersonBase: 'CPL_AND_BELOW' },
  { tableId: 'base_tf', title: 'BASE TASKFORCE DUTY', dutyCode: 'BTF', badgeBg: 'bg-sky-100 dark:bg-sky-950', badgeText: 'text-sky-700 dark:text-sky-300', shortName: 'BTF', defaultMonthly: 22, perPersonBase: 'SGT_AND_BELOW' },
  { tableId: 'nazirpara_tf', title: 'NAZIRPARA TASKFORCE', dutyCode: 'NTF', badgeBg: 'bg-amber-100 dark:bg-amber-950', badgeText: 'text-amber-700 dark:text-amber-300', shortName: 'NTF', defaultMonthly: 40, perPersonBase: 'SGT_AND_BELOW' },
  { tableId: 'idac_mor', title: 'IDAC MORNING', dutyCode: 'IDAC', shiftLabel: 'Morning', badgeBg: 'bg-yellow-100 dark:bg-yellow-950', badgeText: 'text-yellow-800 dark:text-yellow-300', shortName: 'IDAC-MOR', defaultMonthly: 31, perPersonBase: 'SGT_AND_BELOW' },
  { tableId: 'idac_an', title: 'IDAC AFTERNOON', dutyCode: 'IDAC', shiftLabel: 'Afternoon', badgeBg: 'bg-emerald-100 dark:bg-emerald-950', badgeText: 'text-emerald-800 dark:text-emerald-300', shortName: 'IDAC-A/N', defaultMonthly: 31, perPersonBase: 'SGT_AND_BELOW' },
  { tableId: 'idac_nt', title: 'IDAC NIGHT', dutyCode: 'IDAC', shiftLabel: 'Night', badgeBg: 'bg-red-100 dark:bg-red-950', badgeText: 'text-red-800 dark:text-red-300', shortName: 'IDAC-NT', defaultMonthly: 62, perPersonBase: 'SGT_AND_BELOW' },
  { tableId: 'reception', title: 'RECEPTION', dutyCode: 'RECEPTION', badgeBg: 'bg-pink-100 dark:bg-pink-950', badgeText: 'text-pink-700 dark:text-pink-300', shortName: 'REC', defaultMonthly: 31, perPersonBase: 'SGT_AND_BELOW' },
  { tableId: 'airport_duty', title: 'AIRFIELD DUTY', dutyCode: 'AIRPORT', badgeBg: 'bg-purple-100 dark:bg-purple-950', badgeText: 'text-purple-700 dark:text-purple-300', shortName: 'AIRFIELD', defaultMonthly: 93, perPersonBase: 'SGT_AND_BELOW' },
  { tableId: 'halishahar_duty', title: 'HALISHAHAR', dutyCode: 'HALISHAHAR', badgeBg: 'bg-teal-100 dark:bg-teal-950', badgeText: 'text-teal-700 dark:text-teal-300', shortName: 'HLSH', defaultMonthly: 0, perPersonBase: 'SGT_AND_BELOW' },
];

const FLIGHTS: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];

export const FlightDutyRatioModal: React.FC<FlightDutyRatioModalProps> = ({
  date,
  airmen = [],
  onClose,
  onRatiosUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'CALCULATOR' | 'MATRIX'>('CALCULATOR');
  const [matrix, setMatrix] = useState<DutyRatioTable[]>(() => getStoredDutyMatrix());
  const [savedMsg, setSavedMsg] = useState<string>('');
  
  // Daily Matrix State
  const [selectedDate, setSelectedDate] = useState<string>(date || new Date().toISOString().split('T')[0]);
  const [activeTabFlight, setActiveTabFlight] = useState<FlightName>('Mechanics');
  const dayNum = parseDayNumber(selectedDate || date);
  const dayIndex = Math.max(0, Math.min(30, dayNum - 1));

  // Calculator State
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    const initialTotals: Record<string, number> = {};
    CONFIGURABLE_DUTY_ITEMS.forEach(item => {
      const existing = matrix.find(m => m.id === item.tableId);
      initialTotals[item.tableId] = existing?.totalRequiredMonth || item.defaultMonthly;
    });
    setMonthlyTotals(initialTotals);
  }, [matrix]);

  // Manpower Calculation
  const manpower = useMemo(() => {
    const stats = {
      Mechanics: { sgtAndBelow: 0, cplAndBelow: 0 },
      Avionics: { sgtAndBelow: 0, cplAndBelow: 0 },
      GCS: { sgtAndBelow: 0, cplAndBelow: 0 },
      Admin: { sgtAndBelow: 0, cplAndBelow: 0 },
      Total: { sgtAndBelow: 0, cplAndBelow: 0 }
    };

    airmen.forEach(a => {
      const r = a.rank.toUpperCase();
      const f = a.flightName;
      if (!FLIGHTS.includes(f)) return;
      
      const isSgtAndBelow = ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'].includes(r);
      const isCplAndBelow = ['CPL', 'LAC', 'AC'].includes(r);
      
      if (isSgtAndBelow) {
        stats[f as FlightName].sgtAndBelow++;
        stats.Total.sgtAndBelow++;
      }
      if (isCplAndBelow) {
        stats[f as FlightName].cplAndBelow++;
        stats.Total.cplAndBelow++;
      }
    });
    return stats;
  }, [airmen]);

  // Distribution Calculation
  const distribution = useMemo(() => {
    const dist: Record<string, { perPerson: number; flightQuotas: Record<FlightName, number> }> = {};
    
    CONFIGURABLE_DUTY_ITEMS.forEach(item => {
      const totalReq = monthlyTotals[item.tableId] || 0;
      const baseTotal = item.perPersonBase === 'CPL_AND_BELOW' ? manpower.Total.cplAndBelow : manpower.Total.sgtAndBelow;
      
      const perPerson = baseTotal > 0 ? (totalReq / baseTotal) : 0;
      
      const flightQuotas = { Mechanics: 0, Avionics: 0, GCS: 0, Admin: 0 };
      
      if (totalReq > 0 && baseTotal > 0) {
        let remaining = totalReq;
        FLIGHTS.forEach(f => {
          const fBase = item.perPersonBase === 'CPL_AND_BELOW' ? manpower[f].cplAndBelow : manpower[f].sgtAndBelow;
          let quota = Math.round(perPerson * fBase);
          flightQuotas[f] = quota;
          remaining -= quota;
        });
        
        // Adjust remaining to the flight with the most manpower
        if (remaining !== 0) {
           let maxF = FLIGHTS[0];
           let maxV = -1;
           FLIGHTS.forEach(f => {
             const fBase = item.perPersonBase === 'CPL_AND_BELOW' ? manpower[f].cplAndBelow : manpower[f].sgtAndBelow;
             if (fBase > maxV) { maxV = fBase; maxF = f; }
           });
           flightQuotas[maxF] = Math.max(0, flightQuotas[maxF] + remaining);
        }
      }
      
      dist[item.tableId] = { perPerson, flightQuotas };
    });
    
    return dist;
  }, [monthlyTotals, manpower]);

  const handleAutoDistribute = () => {
    if (!window.confirm('Are you sure? This will overwrite the entire 31-day matrix for all duties based on the calculated quotas!')) return;
    
    const newMatrix = [...matrix];
    
    CONFIGURABLE_DUTY_ITEMS.forEach(item => {
      let table = newMatrix.find(t => t.id === item.tableId);
      if (!table) {
        table = {
          id: item.tableId,
          title: item.title,
          dutyCode: item.dutyCode,
          shiftLabel: item.shiftLabel,
          totalRequiredMonth: monthlyTotals[item.tableId],
          data: { Mechanics: new Array(31).fill(0), Avionics: new Array(31).fill(0), GCS: new Array(31).fill(0), Admin: new Array(31).fill(0) }
        };
        newMatrix.push(table);
      }
      
      table.totalRequiredMonth = monthlyTotals[item.tableId];
      
      const quotas = distribution[item.tableId].flightQuotas;
      
      let dailyReqs = table!.dailyRequirements || new Array(31).fill(0);
      const reqSum = dailyReqs.reduce((a, b) => a + b, 0);
      
      if (reqSum !== table!.totalRequiredMonth || reqSum === 0) {
          dailyReqs = new Array(31).fill(0);
          if (table!.totalRequiredMonth > 0) {
              const step = 31 / table!.totalRequiredMonth;
              let current = 0;
              for (let i = 0; i < table!.totalRequiredMonth; i++) {
                  let idx = Math.floor(current);
                  if (idx > 30) idx = 30;
                  dailyReqs[idx]++;
                  current += step;
              }
          }
          table!.dailyRequirements = dailyReqs;
      }
      
      const availableSlots: number[] = [];
      dailyReqs.forEach((count, dayIdx) => {
          for (let i = 0; i < count; i++) {
              availableSlots.push(dayIdx);
          }
      });
      
      const sortedFlights = FLIGHTS.map(f => ({ name: f, quota: quotas[f] || 0 })).sort((a, b) => b.quota - a.quota);
      
      const assignedData: Record<string, number[]> = {
          Mechanics: new Array(31).fill(0),
          Avionics: new Array(31).fill(0),
          GCS: new Array(31).fill(0),
          Admin: new Array(31).fill(0)
      };
      
      let slotIdx = 0;
      sortedFlights.forEach(fl => {
          const step = availableSlots.length / (fl.quota || 1);
          let current = 0;
          for (let i = 0; i < fl.quota; i++) {
              if (availableSlots.length > 0) {
                  const actualSlot = availableSlots[Math.floor(slotIdx + current) % availableSlots.length];
                  assignedData[fl.name][actualSlot]++;
              }
              current += step;
          }
          slotIdx += (step / 2);
      });
      
      FLIGHTS.forEach(f => {
          table!.data[f] = assignedData[f];
      });
    });
    
    setMatrix(newMatrix);
    saveDutyMatrix(newMatrix);
    setSavedMsg('✅ Matrix Auto-Distributed & Saved!');
    if (onRatiosUpdated) onRatiosUpdated();
    setTimeout(() => setSavedMsg(''), 2000);
  };

  const setQuotaForTable = (tableId: string, flight: FlightName, count: number) => {
    const val = Math.max(0, count);
    const updated = matrix.map((t) => {
      if (t.id === tableId) {
        const flightData = { ...t.data };
        const arr = [...(flightData[flight] || new Array(31).fill(0))];
        arr[dayIndex] = val;
        flightData[flight] = arr;
        return { ...t, data: flightData };
      }
      return t;
    });
    setMatrix(updated);
  };

  const handleSaveMatrix = () => {
    saveDutyMatrix(matrix);
    setSavedMsg(`✅ Daily matrix saved!`);
    if (onRatiosUpdated) onRatiosUpdated();
    setTimeout(() => setSavedMsg(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl w-full max-w-6xl h-full sm:h-auto sm:max-h-[90vh] shadow-2xl flex flex-col border-0 sm:border border-slate-200 dark:border-slate-800 overflow-hidden relative">
        
        {/* Header */}
        <div className="flex-none flex items-start justify-between border-b border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                Dynamic Duty Ratio Manager
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                Calculate distribution per manpower formula or edit daily matrix.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-rose-500 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {savedMsg && (
          <div className="flex-none p-3 mx-6 mt-4 bg-emerald-100 dark:bg-emerald-950/90 text-emerald-900 dark:text-emerald-200 rounded-xl border border-emerald-300 dark:border-emerald-800 text-sm font-bold text-center">
            {savedMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex-none px-6 pt-4 flex space-x-2 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('CALCULATOR')}
            className={`px-4 py-3 border-b-2 font-bold text-sm flex items-center space-x-2 transition-colors ${activeTab === 'CALCULATOR' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Calculator className="w-4 h-4" />
            <span>Monthly Distribution Formula</span>
          </button>
          <button
            onClick={() => setActiveTab('MATRIX')}
            className={`px-4 py-3 border-b-2 font-bold text-sm flex items-center space-x-2 transition-colors ${activeTab === 'MATRIX' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <TableIcon className="w-4 h-4" />
            <span>Daily Matrix Editor</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
          
          {activeTab === 'CALCULATOR' && (
            <div className="space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Manpower Table */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-1">
                  <h3 className="font-black text-slate-800 dark:text-slate-200 mb-4 flex items-center"><Info className="w-4 h-4 mr-2 text-indigo-500"/> Effective Manpower</h3>
                  <table className="w-full text-sm text-center">
                    <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2 font-bold rounded-tl-lg">Flight</th>
                        <th className="p-2 font-bold text-center">Sgt & Below</th>
                        <th className="p-2 font-bold text-center rounded-tr-lg">Cpl & Below</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {FLIGHTS.map(f => (
                        <tr key={f}>
                          <td className="p-2 font-bold">{f}</td>
                          <td className="p-2 text-center text-slate-600 dark:text-slate-400">{manpower[f].sgtAndBelow}</td>
                          <td className="p-2 text-center text-slate-600 dark:text-slate-400">{manpower[f].cplAndBelow}</td>
                        </tr>
                      ))}
                      <tr className="bg-indigo-50 dark:bg-indigo-900/20">
                        <td className="p-2 font-black text-indigo-700 dark:text-indigo-300">TOTAL</td>
                        <td className="p-2 font-black text-center text-indigo-700 dark:text-indigo-300">{manpower.Total.sgtAndBelow}</td>
                        <td className="p-2 font-black text-center text-indigo-700 dark:text-indigo-300">{manpower.Total.cplAndBelow}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Monthly Totals & Distribution */}
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm col-span-1 lg:col-span-2 overflow-x-auto">
                  <h3 className="font-black text-slate-800 dark:text-slate-200 mb-4 flex items-center justify-between">
                    <span>Distribution per Manpower</span>
                    <button onClick={handleAutoDistribute} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md">
                      Auto-Distribute to 31 Days
                    </button>
                  </h3>
                  <table className="w-full text-xs text-center whitespace-nowrap">
                    <thead className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300">
                      <tr>
                        <th className="p-2 font-bold rounded-tl-lg">Duty Name</th>
                        <th className="p-2 font-bold text-center">Total Req.</th>
                        <th className="p-2 font-bold text-center border-r border-slate-200 dark:border-slate-600">Per Person</th>
                        {FLIGHTS.map(f => (
                          <th key={f} className="p-2 font-bold text-center">{f.substring(0,4)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {CONFIGURABLE_DUTY_ITEMS.map(item => {
                        const dist = distribution[item.tableId];
                        const totalAllocated = FLIGHTS.reduce((sum, f) => sum + dist.flightQuotas[f], 0);
                        return (
                          <tr key={item.tableId}>
                            <td className="p-2 font-bold">
                              <span className={`px-2 py-0.5 rounded text-[10px] ${item.badgeBg} ${item.badgeText}`}>{item.shortName}</span>
                            </td>
                            <td className="p-1">
                              <input 
                                type="number" 
                                value={monthlyTotals[item.tableId] || 0}
                                onChange={(e) => setMonthlyTotals({...monthlyTotals, [item.tableId]: parseInt(e.target.value) || 0})}
                                className="w-16 p-1 text-center bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded font-bold"
                              />
                            </td>
                            <td className="p-2 text-center text-slate-500 border-r border-slate-200 dark:border-slate-600">
                              {dist.perPerson.toFixed(2)}
                            </td>
                            {FLIGHTS.map(f => (
                              <td key={f} className="p-2 text-center font-bold text-slate-700 dark:text-slate-300">
                                {dist.flightQuotas[f]}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {activeTab === 'MATRIX' && (
            <div className="space-y-6">
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex space-x-2">
                  {FLIGHTS.map((flight) => (
                    <button
                      key={flight}
                      onClick={() => setActiveTabFlight(flight)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                        activeTabFlight === flight
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {flight}
                    </button>
                  ))}
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-300">Day:</span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dayNum}
                    onChange={(e) => {
                      const d = parseInt(e.target.value) || 1;
                      const dateObj = new Date(selectedDate);
                      dateObj.setDate(d);
                      setSelectedDate(dateObj.toISOString().split('T')[0]);
                    }}
                    className="w-16 p-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-center font-bold"
                  />
                  <button onClick={handleSaveMatrix} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md flex items-center space-x-2">
                    <Save className="w-4 h-4"/> <span>Save Daily</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {CONFIGURABLE_DUTY_ITEMS.map((item) => {
                  const table = matrix.find((t) => t.id === item.tableId);
                  const currentCount = table?.data[activeTabFlight]?.[dayIndex] || 0;
                  
                  return (
                    <div key={item.tableId} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${item.badgeBg} ${item.badgeText}`}>
                            {item.shortName}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{item.description}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Required:</span>
                        <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                          <button
                            onClick={() => setQuotaForTable(item.tableId, activeTabFlight, currentCount - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            -
                          </button>
                          <span className="w-10 text-center font-black text-slate-900 dark:text-white text-base">
                            {currentCount}
                          </span>
                          <button
                            onClick={() => setQuotaForTable(item.tableId, activeTabFlight, currentCount + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};

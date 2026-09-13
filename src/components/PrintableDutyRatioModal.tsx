import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { DutyRatioTable } from '../data/officialDutyRatioMatrix';
import { FlightName } from '../types';
import { Printer, X, Download, FileSpreadsheet } from 'lucide-react';
import { exportTableToCSV } from '../utils/csvExport';
import { exportHtmlToWord } from '../utils/htmlExport';
import { DUTY_TYPE_MAP } from '../data/dutyTypes';

interface PrintableDutyRatioModalProps {
  matrix: DutyRatioTable[];
  selectedFlightFilter: FlightName | 'Overall';
  onClose: () => void;
}

export const PrintableDutyRatioModal: React.FC<PrintableDutyRatioModalProps> = ({
  matrix,
  selectedFlightFilter,
  onClose,
}) => {
  const daysArray = Array.from({ length: 31 }, (_, i) => i + 1);

  const getPdfTitle = () => `Duty_Ratio_Matrix_Complete.pdf`;

  const handlePrint = () => {
    document.title = getPdfTitle();
    setTimeout(() => {
      window.print();
    }, 100);
  };
  
  // Get manpower from local storage as calculated by the main view
  const currentManpowerStr = localStorage.getItem('baf_duty_distribution_manpower');
  const currentManpower = currentManpowerStr ? JSON.parse(currentManpowerStr) : {
    mechSgt: 5, mechCpl: 6,
    aviSgt: 4, aviCpl: 3,
    gcsSgt: 5, gcsCpl: 6,
    adminSgt: 0, adminCpl: 1,
  };
  
  const totalSgt = currentManpower.mechSgt + currentManpower.aviSgt + currentManpower.gcsSgt + currentManpower.adminSgt;
  const totalCpl = currentManpower.mechCpl + currentManpower.aviCpl + currentManpower.gcsCpl + currentManpower.adminCpl;
  const totalSgtAndBelow = totalSgt + totalCpl;

  const calculatedMatrixDistributions = useMemo(() => {
    if (!matrix) return {};
    const result: Record<string, Record<string, { autoVal: number, exactVal: number }>> = {};
    
    // Tracker to balance pure ties across different duty types
    const tieBreakerTracker: Record<string, number> = {
      'Mechanics': 0, 'Avionics': 0, 'GCS': 0, 'Admin': 0
    };
    
    matrix.forEach(t => {
      const includesSgt = t.eligibleRanks ? t.eligibleRanks.includes('Sgt') : t.id !== 'security_duty';
      const isCplOnly = !includesSgt;
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
        
        let fltPool = isCplOnly ? fltCpl : (fltCpl + fltSgt);
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
  }, [matrix, currentManpower]);

  const bgAlt = (idx: number) => idx % 2 === 1 ? '#f8fafc' : '#ffffff';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 print:bg-white animate-fadeIn overflow-hidden print:static print:h-auto print:w-auto print:overflow-visible print:block text-black " style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {/* Top Header Controls (Hidden on Print) */}
      <div className="flex-none bg-slate-900 border-b border-slate-700 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl print:hidden z-10 sticky top-0">
        <div className="flex items-center space-x-3 text-white">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm font-black tracking-widest">
              OFFICIAL DUTY RATIO PRINT PREVIEW
            </h1>
            <p className="text-[10px] text-slate-400 font-mono">
              Use 'Save as PDF' or Print directly
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          
          <button
            onClick={() => exportTableToCSV('print-duty-ratio-content', 'Duty_Ratio_Matrix_Complete.csv')}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => exportHtmlToWord('print-duty-ratio-content', 'Duty_Ratio_Matrix_Complete.doc')}
            className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Document</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
          >
            <Printer className="w-5 h-5" />
            <span>Official Export / Print</span>
          </button>
        </div>
      </div>

      {/* Printable Content Area */}
      <div className="flex-1 overflow-y-auto overflow-x-auto print:overflow-visible flex justify-start sm:justify-center print:block">
        
        <div id="print-duty-ratio-content" className="w-max sm:w-full max-w-none sm:max-w-[1200px] mx-auto py-4 sm:py-8 px-2 sm:px-8 print:p-0 print:m-0 print:w-full print:max-w-none text-black bg-white">
          <style>{`
            @media print {
              @page { size: A4 portrait; margin: 8mm; }
              body { 
                 background: white !important; 
                 color: black !important;
                -webkit-print-color-adjust: exact !important; 
                 print-color-adjust: exact !important; 
               }
              
              /* Prevent page breaks inside tables and rows */
              table { page-break-inside: avoid !important; break-inside: avoid !important; }
              tr    { page-break-inside: avoid !important; break-inside: avoid !important; }
              thead { display: table-header-group !important; }
              tfoot { display: table-footer-group !important; }
              /* Force elements with these classes to avoid breaking */
              .print\:break-inside-avoid {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              /* Hide scrollbars during print */
              ::-webkit-scrollbar { display: none; }
              
              /* Hide main app, only show portal */
              #root {
                display: none !important;
              }
            }
          `}</style>

          
          {/* PAGE 1: All Duties Summary */}
          <div className="pb-8 pt-4 print:pb-4 print:pt-0">
            <div className="text-center mb-6">
              <h2 className="text-lg font-black underline uppercase">All Duties</h2>
              <h3 className="text-md font-black uppercase">155 UASU BAF</h3>
            </div>

            <div className="flex flex-col gap-10 print:gap-4">
              {/* Top two tables side-by-side */}
              <div className="flex justify-center gap-12">
                {/* TOTAL DUTY Table */}
                <div>
                  <h4 className="font-bold underline text-center mb-2">TOTAL DUTY</h4>
                  <table className="no-zebra border-collapse border border-black text-center text-[12px] bg-white text-black w-full print:min-w-0">
                    <thead>
                      <tr className="bg-slate-100 print:bg-white">
                        <th className="border border-black p-1.5 w-40">Duty Name</th>
                        <th className="border border-black p-1.5 w-20">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.filter(t => !t.isDisabled).map(t => (
                        <tr key={t.id} className="even:bg-gray-100 print:even:bg-gray-100">
                          <td className="border border-black p-1.5 text-center px-3">{t.title.split('(')[0].trim()}</td>
                          <td className="border border-black p-1.5">{t.totalRequiredMonth}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* EFFECTIVE MANPOWER Table */}
                <div>
                  <h4 className="font-bold underline text-center mb-2">EFFECTIVE MANPOWER</h4>
                  <table className="no-zebra border-collapse border border-black text-center text-[12px] bg-white text-black w-full print:min-w-0">
                    <thead>
                      <tr className="bg-slate-100 print:bg-white">
                        <th className="border border-black p-1.5 w-24">Flight</th>
                        <th className="border border-black p-1.5 w-16">Sgt</th>
                        <th className="border border-black p-1.5 w-24">Cpl & Below</th>
                        <th className="border border-black p-1.5 w-16">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'Mech', sgt: currentManpower.mechSgt, cpl: currentManpower.mechCpl },
                        { name: 'Avi', sgt: currentManpower.aviSgt, cpl: currentManpower.aviCpl },
                        { name: 'GCS', sgt: currentManpower.gcsSgt, cpl: currentManpower.gcsCpl },
                        { name: 'Admin', sgt: currentManpower.adminSgt, cpl: currentManpower.adminCpl }
                      ].map(row => (
                        <tr key={row.name} className="even:bg-gray-100 print:even:bg-gray-100">
                          <td className="border border-black p-1.5">{row.name}</td>
                          <td className="border border-black p-1.5">{row.sgt}</td>
                          <td className="border border-black p-1.5">{row.cpl}</td>
                          <td className="border border-black p-1.5">{row.sgt + row.cpl}</td>
                        </tr>
                      ))}
                      <tr className="font-bold bg-slate-100 print:bg-white">
                        <td className="border border-black p-1.5">Total</td>
                        <td className="border border-black p-1.5">{totalSgt}</td>
                        <td className="border border-black p-1.5">{totalCpl}</td>
                        <td className="border border-black p-1.5">{totalSgtAndBelow}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* DISTRIBUTION AS PER MANPOWER Table */}
              <div className="print:mt-2 print:block print:overflow-visible" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                <h4 className="font-bold underline text-center mb-2">DISTRIBUTION AS PER MANPOWER</h4>
                <div className="text-center font-bold underline mb-1 text-[11px]">FORMULA</div>
                <table className="no-zebra border-collapse border border-black text-center text-[12px] bg-white text-black w-full print:min-w-0">
                  <thead>
                    <tr className="bg-slate-100 print:bg-white">
                      <th className="border border-black p-1.5 w-40" rowSpan={2}>DUTY PER PERSON</th>
                      {matrix.filter(t => !t.isDisabled).map(t => (
                        <th key={t.id} className="border border-black p-1">{t.title.split('(')[0].trim()}</th>
                      ))}
                    </tr>
                    <tr className="bg-slate-100 print:bg-white">
                      {matrix.filter(t => !t.isDisabled).map(t => {
                        const includesSgt = t.eligibleRanks ? t.eligibleRanks.includes('Sgt') : t.id !== 'security_duty';
                        const isCplOnly = !includesSgt;
                        return (
                          <td key={t.id} className="border border-black p-1 text-[10px] leading-tight text-gray-800">
                            Total {t.title.split('(')[0].trim()} ÷<br/>
                            Total {isCplOnly ? 'Cpl & Below' : 'Sgt & Below'}
                          </td>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-black p-1.5 font-bold text-center px-2">DUTY PER PERSON</td>
                      {matrix.filter(t => !t.isDisabled).map(t => {
                        const includesSgt = t.eligibleRanks ? t.eligibleRanks.includes('Sgt') : t.id !== 'security_duty';
                        const isCplOnly = !includesSgt;
                        const pool = isCplOnly ? totalCpl : totalSgtAndBelow;
                        return (
                          <td key={t.id} className="border border-black p-1.5 font-bold">
                            {pool > 0 ? (t.totalRequiredMonth / pool).toFixed(2) : '0.00'}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* DISTRIBUTION AS PER FLIGHT Table */}
              <div className="print:mt-2 print:block print:overflow-visible" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                <h4 className="font-bold underline text-center mb-2">DISTRIBUTION AS PER FLIGHT</h4>
                <div className="text-center font-bold underline mb-1 text-[11px]">FORMULA</div>
                <table className="no-zebra border-collapse border border-black text-center text-[12px] bg-white text-black w-full print:min-w-0">
                  <thead>
                    <tr className="bg-slate-100 print:bg-white">
                      <th className="border border-black p-1.5 w-40" rowSpan={2}>DUTY PER FLIGHT</th>
                      {matrix.filter(t => !t.isDisabled).map(t => (
                        <th key={t.id} className="border border-black p-1">{t.title.split('(')[0].trim()}</th>
                      ))}
                    </tr>
                    <tr className="bg-slate-100 print:bg-white">
                      {matrix.filter(t => !t.isDisabled).map(t => {
                        const includesSgt = t.eligibleRanks ? t.eligibleRanks.includes('Sgt') : t.id !== 'security_duty';
                        const isCplOnly = !includesSgt;
                        return (
                          <td key={`f-${t.id}`} className="border border-black p-1 text-[10px] leading-tight text-gray-800">
                            Per Person {t.title.split('(')[0].trim()} x<br/>
                            Total {isCplOnly ? 'Cpl & Below' : 'Sgt & Below'} of Flight
                          </td>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {['Mechanics', 'Avionics', 'GCS', 'Admin'].map(fl => {
                      const displayFl = fl === 'Mechanics' ? 'MECHANICS FLT' : fl === 'Avionics' ? 'AVIONICS FLT' : fl === 'GCS' ? 'GCS FLT' : 'ADMIN FLT';
                      return (
                        <tr key={fl} className="even:bg-gray-100 print:even:bg-gray-100">
                          <td className="border border-black p-1 text-center px-2 font-bold">{displayFl}</td>
                          {matrix.filter(t => !t.isDisabled).map(t => {
                            const autoVal = calculatedMatrixDistributions[t.id]?.[fl]?.autoVal || 0;
                            return <td key={t.id} className="border border-black p-1">{autoVal}</td>;
                          })}
                        </tr>
                      );
                    })}
                    <tr className="font-bold bg-slate-100 print:bg-white">
                      <td className="border border-black p-1.5 text-center px-2 uppercase">Total Duty</td>
                      {matrix.filter(t => !t.isDisabled).map(t => (
                        <td key={t.id} className="border border-black p-1.5">{t.totalRequiredMonth}</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
          {/* PAGE 2+: Matrices */}
          <div className="pt-4">
            {matrix.filter(t => !t.isDisabled).map((table, matrixIdx) => {
              const cleanTitle = table.title.split('(')[0].trim();
              
              const MAX_COLS_PER_PAGE = 31;
              const daysChunks = [];
              for (let i = 0; i < 31; i += MAX_COLS_PER_PAGE) {
                const daysArrayLocal = Array.from({ length: 31 }, (_, idx) => idx + 1);
                daysChunks.push(daysArrayLocal.slice(i, i + MAX_COLS_PER_PAGE));
              }

              return daysChunks.map((chunk, chunkIdx) => {
                return (
                  <div key={`${table.id}-${chunkIdx}`} className="mb-8 print:mb-4 overflow-x-auto print:overflow-visible" style={{ pageBreakInside: "avoid", breakInside: "avoid" }}>
                  <div className="flex justify-between items-end mb-1">
                    <div className="font-bold underline uppercase text-[13px]">{cleanTitle} {daysChunks.length > 1 ? ` (Part ${chunkIdx + 1})` : ''}</div>
                    <div className="flex border border-black text-[12px]">
                      <div className="px-2 py-0.5 border-r border-black" style={{ backgroundColor: '#ffffff' }}>Total Duty</div>
                      <div className="px-4 py-0.5 font-bold" style={{ backgroundColor: '#ffffff' }}>{table.totalRequiredMonth}</div>
                    </div>
                  </div>
                  
                  <table className="no-zebra w-full border-collapse border border-black text-center text-[11px] sm:text-[10px] print:text-[10px] print:min-w-0">
                    <thead>
                      <tr style={{ backgroundColor: '#ffffff' }}>
                        <th colSpan={2} className="border border-black font-bold p-1 w-20">Date</th>
                        {chunk.map(d => (
                          <th key={d} className="border border-black font-bold p-1 w-6">{d}</th>
                        ))}
                        <th className="border border-black font-bold p-1 w-12">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {['Mechanics', 'Avionics', 'GCS', 'Admin'].map((fl, i) => {
                        const flName = fl as FlightName;
                        const rowData = table.data[flName] || Array(31).fill(0);
                        const rowSum = rowData.reduce((a, b) => a + b, 0);
                        const displayFl = fl === 'Mechanics' ? 'Mech' : fl === 'Avionics' ? 'AVI' : fl;
                        
                        return (
                          <tr key={fl} style={{ backgroundColor: bgAlt(i) }}>
                            <td colSpan={2} className="border border-black font-bold p-1">{displayFl}</td>
                            {chunk.map(d => {
                              const dayIdx = d - 1;
                              return (
                                <td key={dayIdx} className="border border-black p-1">{rowData[dayIdx] > 0 ? rowData[dayIdx] : ''}</td>
                              );
                            })}
                            <td className="border border-black p-1 font-bold">{rowSum > 0 ? rowSum : ''}</td>
                          </tr>
                        );
                      })}
                      
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <td rowSpan={2} className="border border-black font-bold p-1 text-center align-middle w-10">Daily</td>
                        <td className="border border-black font-bold p-1 w-10">Total</td>
                        {chunk.map((d) => {
                          const i = d - 1;
                          const sum = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => {
                            const val = table.data[fl as FlightName]?.[i] || 0;
                            return acc + val;
                          }, 0);
                          return <td key={i} className="border border-black p-1 font-bold">{sum > 0 ? sum : ''}</td>;
                        })}
                        <td className="border border-black p-1 font-bold">{table.totalRequiredMonth}</td>
                      </tr>
                      <tr style={{ backgroundColor: '#f1f5f9' }}>
                        <td className="border border-black font-bold p-1">Req.</td>
                        {chunk.map((d) => {
                          const i = d - 1;
                          let req = table.dailyRequirements?.[i];
                          if (req === undefined) {
                              if (table.totalRequiredDaily && (table.totalRequiredDaily * 31 === table.totalRequiredMonth)) {
                                  req = table.totalRequiredDaily;
                              } else {
                                  req = ['Mechanics', 'Avionics', 'GCS', 'Admin'].reduce((acc, fl) => acc + (table.data[fl as FlightName]?.[i] || 0), 0);
                              }
                          }
                          return <td key={i} className="border border-black p-1">{req > 0 ? req : ''}</td>;
                        })}
                        <td className="border border-black p-1">{table.totalRequiredMonth}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                );
              });
            })}
          </div>
        </div>
      </div>
    </div>
  , document.body);
};

import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Check,
  RefreshCw,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { DutyRatioTable } from '../data/officialDutyRatioMatrix';
import { FlightName } from '../types';

interface ImportDutyRatioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMatrix: DutyRatioTable[];
  onImport: (newMatrix: DutyRatioTable[]) => void;
}

interface ParsedMatrixRow {
  id: string;
  dutyType: string;
  matchedTableId: string | null;
  flight: string;
  matchedFlight: FlightName | null;
  days: number[];
  errors: string[];
}

const VALID_FLIGHTS: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];

export const ImportDutyRatioModal: React.FC<ImportDutyRatioModalProps> = ({
  isOpen,
  onClose,
  currentMatrix,
  onImport,
}) => {
  const [rows, setRows] = useState<ParsedMatrixRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const matchTable = (rawDuty: string): DutyRatioTable | undefined => {
    const clean = rawDuty.toLowerCase().replace(/[^a-z0-9]/g, '');
    return currentMatrix.find((t) => {
      const tClean = t.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const idClean = t.id.toLowerCase().replace(/[^a-z0-9]/g, '');
      return tClean.includes(clean) || clean.includes(tClean) || idClean.includes(clean) || clean.includes(idClean);
    });
  };

  const matchFlight = (rawFlight: string): FlightName | null => {
    const clean = rawFlight.trim().toLowerCase();
    if (clean.includes('mech')) return 'Mechanics';
    if (clean.includes('avionic') || clean === 'avi') return 'Avionics';
    if (clean.includes('gcs')) return 'GCS';
    if (clean.includes('admin') || clean === 'adm') return 'Admin';
    return null;
  };

  const processData = (data: any[][]) => {
    if (!data || data.length < 2) {
      alert('The uploaded file is empty or missing data rows.');
      return;
    }

    const headers = data[0].map((h: any) => String(h || '').trim().toLowerCase());

    const dutyColIdx = headers.findIndex((h) => h.includes('duty') || h.includes('type') || h.includes('table'));
    const flightColIdx = headers.findIndex((h) => h.includes('flight') || h.includes('flt') || h.includes('section'));

    // Find day columns (e.g. Day 1..31 or 1..31)
    const dayIndices: number[] = [];
    for (let day = 1; day <= 31; day++) {
      let idx = headers.findIndex((h) => h === `day ${day}` || h === `day_${day}` || h === `d${day}` || h === String(day) || h === `day${day}`);
      if (idx === -1 && data[0].length >= day + 1) {
        // Fallback positional indexing if columns start after Duty Type & Flight
        idx = (flightColIdx >= 0 ? flightColIdx : 1) + day;
      }
      dayIndices.push(idx);
    }

    const parsed: ParsedMatrixRow[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
        continue;
      }

      const rawDuty = dutyColIdx >= 0 && row[dutyColIdx] ? String(row[dutyColIdx]).trim() : `Table ${i}`;
      const rawFlight = flightColIdx >= 0 && row[flightColIdx] ? String(row[flightColIdx]).trim() : '';

      const matchedT = matchTable(rawDuty);
      const matchedF = matchFlight(rawFlight);

      const days: number[] = [];
      const errors: string[] = [];

      for (let d = 0; d < 31; d++) {
        const col = dayIndices[d];
        let val = 0;
        if (col >= 0 && row[col] !== undefined && row[col] !== null) {
          const num = parseInt(String(row[col]), 10);
          if (isNaN(num)) {
            errors.push(`Day ${d + 1} has non-numeric value: ${row[col]}`);
          } else if (num < 0 || num > 99) {
            errors.push(`Day ${d + 1} quota out of range (0–99): ${num}`);
          } else {
            val = num;
          }
        }
        days.push(val);
      }

      if (!matchedT) {
        errors.push(`Unrecognized Duty Type "${rawDuty}". Expected one of: ${currentMatrix.map((m) => m.title).join(', ')}`);
      }
      if (!matchedF) {
        errors.push(`Unrecognized Flight "${rawFlight}". Expected: Mechanics, Avionics, GCS, Admin`);
      }

      parsed.push({
        id: `row-${i}-${Date.now()}`,
        dutyType: rawDuty,
        matchedTableId: matchedT ? matchedT.id : null,
        flight: rawFlight,
        matchedFlight: matchedF,
        days,
        errors,
      });
    }

    setRows(parsed);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    parseFile(file);
  };

  const parseFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.data as any[][]);
        },
        error: (err) => {
          alert(`CSV Parse Error: ${err.message}`);
        },
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const firstSheet = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];
          processData(data);
        } catch (err: any) {
          alert(`Excel Read Error: ${err.message}`);
        }
      };
      reader.readAsBinaryString(file);
    } else {
      alert('Please upload a valid .csv or .xlsx Excel file.');
    }
  };

  const handleDownloadSample = () => {
    const headers = ['Duty Type', 'Flight', ...Array.from({ length: 31 }, (_, i) => `Day ${i + 1}`)];
    const sampleRows: any[][] = [];

    currentMatrix.forEach((table) => {
      VALID_FLIGHTS.forEach((fl) => {
        const days = table.data[fl] || Array(31).fill(0);
        sampleRows.push([table.title, fl, ...days]);
      });
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'BAF_155_UASU_Duty_Ratio_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalErrors = rows.reduce((sum, r) => sum + r.errors.length, 0);
  const canImport = rows.length > 0 && totalErrors === 0 && !isImporting;

  const handleApplyImport = () => {
    if (!canImport) return;
    setIsImporting(true);

    try {
      // Clone current matrix
      const newMatrix: DutyRatioTable[] = JSON.parse(JSON.stringify(currentMatrix));

      rows.forEach((row) => {
        if (!row.matchedTableId || !row.matchedFlight) return;
        const targetTable = newMatrix.find((t) => t.id === row.matchedTableId);
        if (targetTable) {
          targetTable.data[row.matchedFlight] = [...row.days];
        }
      });

      onImport(newMatrix);
      onClose();
    } catch (err: any) {
      alert(`Import error: ${err?.message || 'Unknown'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full my-0 sm:my-6 flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold shadow-md">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Import Duty Ratio Quotas
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-950 border border-indigo-500/40 text-indigo-400 uppercase">
                  Scale 1–31
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload a CSV or Excel spreadsheet containing official daily duty quotas for all flights.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Upload + Template */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  setFileName(file.name);
                  parseFile(file);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`md:col-span-2 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-4 ring-indigo-500/20'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 flex items-center justify-center mb-2 shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {fileName ? `Selected: ${fileName}` : 'Click to select or drag & drop CSV/Excel matrix file'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Format: Duty Type, Flight, Day 1 through Day 31
              </p>
            </div>

            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Official Ratio Scale</span>
                </div>
                <p className="text-xs text-indigo-800 dark:text-indigo-200/80 mt-1 leading-relaxed">
                  Download our current duty quota scale as a pre-filled template with all 8 duty tables and 4 flights.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="mt-4 w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Current Matrix (.csv)</span>
              </button>
            </div>
          </div>

          {/* Parsed Rows Preview */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    Parsed Ratio Tables ({rows.length} flight entries)
                  </span>
                  {totalErrors === 0 ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ready to Apply (0 Errors)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>{totalErrors} Errors Found in Sheet</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-700">#</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-700">Duty Type</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-700">Flight</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-700">Total Month</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-700">Validation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
                      {rows.map((row, idx) => {
                        const hasError = row.errors.length > 0;
                        const rowTotal = row.days.reduce((a, b) => a + b, 0);
                        return (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              hasError
                                ? 'bg-rose-50/60 dark:bg-rose-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="p-2 text-slate-500 font-mono">{idx + 1}</td>
                            <td className="p-2 font-bold text-slate-900 dark:text-white">
                              {row.dutyType}
                              {row.matchedTableId && (
                                <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                                  ✓ matched
                                </span>
                              )}
                            </td>
                            <td className="p-2 font-semibold text-slate-700 dark:text-slate-300">
                              {row.flight} ({row.matchedFlight || 'Unknown'})
                            </td>
                            <td className="p-2 font-black font-mono text-indigo-600 dark:text-indigo-400">
                              {rowTotal} slots
                            </td>
                            <td className="p-2 whitespace-nowrap">
                              {hasError ? (
                                <div className="text-rose-600 dark:text-rose-400 font-bold flex items-center space-x-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{row.errors[0]}</span>
                                </div>
                              ) : (
                                <div className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                  <span>Valid</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {rows.length > 0 ? (
              <span>
                <strong>{rows.length}</strong> flight quotas parsed •{' '}
                {totalErrors === 0 ? 'All validations passed' : `${totalErrors} errors to fix`}
              </span>
            ) : (
              <span>Select a spreadsheet with columns: Duty Type, Flight, Day 1..31</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyImport}
              disabled={!canImport}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all cursor-pointer"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Apply Duty Ratios</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
import { exportDutyRatioMatrixExcel } from '../utils/csvExport';

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
    if (!rawDuty) return undefined;
    const stripped = rawDuty.replace(/^(duty\s*:?|table\s*\d*:?|\d+[\.\-\)]\s*)/i, '').trim();
    const clean = stripped.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean) return undefined;

    // 1. Direct code / id / title match
    const directMatch = currentMatrix.find((t) => {
      const tClean = t.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const tCleanNoParen = t.title.split('(')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const idClean = t.id.toLowerCase().replace(/[^a-z0-9]/g, '');
      const codeClean = (t.dutyCode || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return (
        tClean === clean ||
        tCleanNoParen === clean ||
        idClean === clean ||
        codeClean === clean ||
        tClean.includes(clean) ||
        clean.includes(tClean) ||
        tCleanNoParen.includes(clean) ||
        clean.includes(tCleanNoParen) ||
        idClean.includes(clean) ||
        clean.includes(idClean)
      );
    });
    if (directMatch) return directMatch;

    // 2. Military and duty aliases
    const lower = stripped.toLowerCase();

    // Base Security Duty / GD / Guard Duty
    if (
      lower.includes('base sec') ||
      lower.includes('basesec') ||
      lower.includes('security') ||
      lower.includes('guard duty') ||
      lower.includes('general duty') ||
      clean === 'gd' ||
      clean === 'gdduty'
    ) {
      const found = currentMatrix.find((t) => t.id === 'security_duty' || t.dutyCode === 'GD');
      if (found) return found;
    }

    // Base Taskforce / BTF
    if (
      (lower.includes('base') && (lower.includes('tf') || lower.includes('taskforce') || lower.includes('task force'))) ||
      clean === 'btf' ||
      clean === 'basetf'
    ) {
      const found = currentMatrix.find((t) => t.id === 'base_tf' || t.dutyCode === 'BTF');
      if (found) return found;
    }

    // Nazirpara Taskforce / NTF
    if (
      lower.includes('nazirpara') ||
      lower.includes('najirpara') ||
      clean === 'ntf' ||
      clean === 'nazirparatf' ||
      clean === 'najirparatf'
    ) {
      const found = currentMatrix.find((t) => t.id === 'nazirpara_tf' || t.dutyCode === 'NTF');
      if (found) return found;
    }

    // IDAC Shifts (Morning, Afternoon, Night)
    if (lower.includes('idac') || lower.includes('ida')) {
      if (lower.includes('mor') || lower.includes('morning')) {
        const found = currentMatrix.find((t) => t.id === 'idac_mor' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Morning'));
        if (found) return found;
      }
      if (lower.includes('aft') || lower.includes('afternoon') || lower.includes('a/n') || clean.includes('an')) {
        const found = currentMatrix.find((t) => t.id === 'idac_an' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Afternoon'));
        if (found) return found;
      }
      if (lower.includes('night') || lower.includes('nit') || clean.includes('nt') || lower.includes('ngt')) {
        const found = currentMatrix.find((t) => t.id === 'idac_nt' || (t.dutyCode === 'IDAC' && t.shiftLabel === 'Night'));
        if (found) return found;
      }
    }

    // Airport / Airfield
    if (lower.includes('airport') || lower.includes('airfield') || clean === 'apt') {
      const found = currentMatrix.find((t) => t.id === 'airport_duty' || t.dutyCode === 'AIRPORT');
      if (found) return found;
    }

    // Halishahar / Reception / Receiption Duty
    if (
      lower.includes('reception') ||
      lower.includes('receiption') ||
      clean === 'rec' ||
      clean === 'reception' ||
      clean === 'receiption' ||
      lower.includes('k/o') ||
      lower.includes('key orderly') ||
      lower.includes('halishahar') ||
      clean === 'hal'
    ) {
      const found = currentMatrix.find(
        (t) =>
          t.id === 'reception_duty' ||
          t.dutyCode === 'RECEPTION' ||
          t.title.toLowerCase().includes('reception') ||
          t.title.toLowerCase().includes('receiption') ||
          t.id === 'halishahar_duty' ||
          t.dutyCode === 'HALISHAHAR'
      );
      if (found) return found;
    }

    return currentMatrix.find((t) => {
      const titleLower = t.title.toLowerCase();
      return titleLower.includes(lower) || lower.includes(titleLower);
    });
  };

  const matchFlight = (rawFlight: string): FlightName | null => {
    if (!rawFlight) return null;
    const str = String(rawFlight).trim();
    if (!str) return null;

    const lower = str.toLowerCase();
    // Strip leading serial numbers, bullets, brackets: e.g. "1. Mech Flt" -> "mech flt"
    const stripped = lower.replace(/^[\d\s\.\-\)\(\[\]\:\*]+/, '').trim();
    const clean = stripped.replace(/[^a-z0-9]/g, '');

    // Skip summary / header / table titles
    if (
      lower.startsWith('daily') ||
      lower === 'total' ||
      lower.startsWith('total') ||
      lower.startsWith('req') ||
      lower === 'date' ||
      lower === 'flight' ||
      lower === 'flt' ||
      lower === 'duty' ||
      lower === 'table' ||
      lower === 'sl' ||
      lower === 'ser' ||
      lower === 'no'
    ) {
      return null;
    }

    // 1. GCS (Ground Control Station)
    // Matches: "GCS", "G.C.S", "G.C.S.", "GCS Flt", "GCS Flight", "Ground Control", "Ground Control Station", "FLT GCS", "FLT-GCS", "G Flt", "G-Flt", "G/Flt", "GF", "জিসিএস"
    if (
      clean.includes('gcs') ||
      clean === 'g' ||
      clean === 'gf' ||
      clean === 'gflt' ||
      clean.startsWith('gflt') ||
      clean === 'gc' ||
      lower.includes('ground control') ||
      lower.includes('ground station') ||
      lower.includes('g.c.s') ||
      lower.startsWith('g ') ||
      lower.startsWith('g-') ||
      lower.startsWith('g/') ||
      lower.startsWith('g_') ||
      lower.includes('g flight') ||
      lower.includes('g/flt') ||
      lower.includes('g-flt') ||
      lower.includes('জিসিএস')
    ) {
      return 'GCS';
    }

    // 2. Avionics
    // Matches: "Avi", "AVI", "Avi Flt", "Avi Flight", "Avionics", "Avionic", "Avionics Flt", "Avionics Flight", "Avn", "AVN", "Avn Flt", "Radar", "Armament", "Radio", "Instrument", "FLT AVI", "FLT-AVI", "A Flt", "A-Flt", "A/Flt", "AF", "এভিওনিক্স", "এভি"
    if (
      lower.includes('avionic') ||
      lower.includes('avi') ||
      lower.includes('avn') ||
      lower.includes('radar') ||
      lower.includes('armament') ||
      lower.includes('radio') ||
      lower.includes('instrument') ||
      clean === 'a' ||
      clean === 'af' ||
      clean === 'aflt' ||
      clean.startsWith('aflt') ||
      lower.startsWith('a ') ||
      lower.startsWith('a-') ||
      lower.startsWith('a/') ||
      lower.startsWith('a_') ||
      lower.includes('a flight') ||
      lower.includes('a/flt') ||
      lower.includes('a-flt') ||
      lower.includes('এভি')
    ) {
      return 'Avionics';
    }

    // 3. Mechanics
    // Matches: "Mech", "MECH", "Mech Flt", "Mech Flight", "Mechanic", "Mechanics", "Mechanics Flt", "Mechanics Flight", "Maint", "Maintenance", "Maint Flt", "Maintenance Flt", "FLT MECH", "FLT-MECH", "Airframe", "Engine", "A&E", "M Flt", "M-Flt", "M/Flt", "MF", "মেকানিক্স", "মেক"
    if (
      lower.includes('mechanic') ||
      lower.includes('mech') ||
      lower.includes('maint') ||
      lower.includes('airframe') ||
      lower.includes('engine') ||
      clean === 'm' ||
      clean === 'mf' ||
      clean === 'mflt' ||
      clean.startsWith('mflt') ||
      lower.startsWith('m ') ||
      lower.startsWith('m-') ||
      lower.startsWith('m/') ||
      lower.startsWith('m_') ||
      lower.includes('m flight') ||
      lower.includes('m/flt') ||
      lower.includes('m-flt') ||
      lower.includes('মেক')
    ) {
      return 'Mechanics';
    }

    // 4. Admin
    // Matches: "Admin", "Adm", "Admin Flt", "Admin Flight", "Adm Flt", "Administration", "Administrative", "FLT ADM", "FLT-ADM", "Support", "AD", "AD Flt", "এডমিন", "অ্যাডমিন"
    if (
      lower.includes('admin') ||
      lower.includes('adm') ||
      lower.includes('administrative') ||
      lower.includes('administration') ||
      lower.includes('support') ||
      clean === 'ad' ||
      clean === 'adflt' ||
      lower.startsWith('ad ') ||
      lower.startsWith('ad-') ||
      lower.startsWith('ad/') ||
      lower.includes('এডমিন') ||
      lower.includes('অ্যাডমিন')
    ) {
      return 'Admin';
    }

    return null;
  };

  const processData = (data: any[][]) => {
    if (!data || data.length < 2) {
      alert('The uploaded file is empty or missing data rows.');
      return;
    }

    // Search first 5 rows to see if there is a flat header row with both Duty & Flight
    let headerRowIdx = -1;
    let dutyColIdx = -1;
    let flightColIdx = -1;

    for (let r = 0; r < Math.min(data.length, 5); r++) {
      const rowLower = (data[r] || []).map((c) => String(c || '').trim().toLowerCase());
      const dIdx = rowLower.findIndex((c) => c.includes('duty') || c.includes('table'));
      const fIdx = rowLower.findIndex((c) => c.includes('flight') || c.includes('flt') || c.includes('section'));
      if (dIdx !== -1 && fIdx !== -1) {
        headerRowIdx = r;
        dutyColIdx = dIdx;
        flightColIdx = fIdx;
        break;
      }
    }

    const parsed: ParsedMatrixRow[] = [];

    if (headerRowIdx !== -1) {
      // ----------------------------------------------------
      // MODE 1: Flat Column Format
      // ----------------------------------------------------
      const headerRowLower = (data[headerRowIdx] || []).map((c) => String(c || '').trim().toLowerCase());

      const dayIndices: number[] = [];
      for (let day = 1; day <= 31; day++) {
        let idx = headerRowLower.findIndex((h) => h === `day ${day}` || h === `day_${day}` || h === `d${day}` || h === String(day) || h === `day${day}`);
        if (idx === -1 && data[headerRowIdx].length >= day + 1) {
          idx = (flightColIdx >= 0 ? flightColIdx : 1) + day;
        }
        dayIndices.push(idx);
      }

      let lastSeenDuty = '';

      for (let i = headerRowIdx + 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
          continue;
        }

        let rawDuty = dutyColIdx >= 0 && row[dutyColIdx] ? String(row[dutyColIdx]).trim() : '';

        // Check if this row is comment, repeated header, or daily summary BEFORE updating lastSeenDuty
        const lowerDuty = rawDuty.toLowerCase();
        if (
          lowerDuty.startsWith('#') ||
          lowerDuty.includes('duty type') ||
          lowerDuty.includes('duty name') ||
          lowerDuty.startsWith('daily')
        ) {
          continue;
        }

        let rawFlight = flightColIdx >= 0 && row[flightColIdx] ? String(row[flightColIdx]).trim() : '';
        if (!rawFlight) {
          for (let c = 0; c < Math.min(row.length, 4); c++) {
            if (c !== dutyColIdx) {
              const mf = matchFlight(String(row[c] || ''));
              if (mf) {
                rawFlight = String(row[c] || '').trim();
                break;
              }
            }
          }
        }

        const lowerFlight = rawFlight.toLowerCase();
        if (['total', 'daily total', 'req', 'req.', 'daily req', 'grand total'].includes(lowerFlight)) {
          continue;
        }

        if (!rawDuty && lastSeenDuty) {
          rawDuty = lastSeenDuty;
        } else if (rawDuty) {
          lastSeenDuty = rawDuty;
        }

        const matchedT = matchTable(rawDuty);
        const matchedF = matchFlight(rawFlight);

        const days: number[] = [];
        const errors: string[] = [];

        for (let d = 0; d < 31; d++) {
          const col = dayIndices[d];
          let val = 0;
          if (col >= 0 && row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
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
          dutyType: rawDuty || (matchedT ? matchedT.title : 'Unknown Duty'),
          matchedTableId: matchedT ? matchedT.id : null,
          flight: rawFlight,
          matchedFlight: matchedF,
          days,
          errors,
        });
      }
    } else {
      // ----------------------------------------------------
      // MODE 2: Export CSV Block Matrix Format (Date, 1..31, Total)
      // ----------------------------------------------------
      let currentDutyObj: DutyRatioTable | null = null;
      let dayIndices: number[] = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
          continue;
        }

        // 1. Skip comment lines
        const firstNonEmpty = row.find((c) => c !== null && c !== undefined && String(c).trim() !== '');
        if (firstNonEmpty && String(firstNonEmpty).trim().startsWith('#')) {
          continue;
        }

        // 2. Check if this row is a column header row (e.g. "Date, 1, 2, ... 31" or "Flight, 1, 2, ... 31")
        const rowLower = row.map((c) => String(c || '').trim().toLowerCase());
        const hasNumbers = rowLower.some((h) => h === '1' || h === 'day 1' || h === 'd1' || h === 'day_1' || h === '1.0');
        const hasDateOrFlt = rowLower.some((h) => h === 'date' || h === 'flight' || h === 'flt' || h === 'section');

        if (hasNumbers && (hasDateOrFlt || rowLower[0] === 'date' || rowLower[0] === 'flight' || rowLower[1] === '1')) {
          dayIndices = [];
          for (let day = 1; day <= 31; day++) {
            let idx = rowLower.findIndex((h) => h === String(day) || h === `day ${day}` || h === `d${day}` || h === `day_${day}` || h === `${day}.0`);
            if (idx === -1) {
              const baseIdx = (rowLower[0] === 'date' || rowLower[0] === 'flight' || rowLower[0] === 'flt') ? 1 : 0;
              idx = baseIdx + (day - 1);
            }
            dayIndices.push(idx);
          }
          continue;
        }

        // 3. Skip summary / footer rows like Daily Total, Daily Req, Total
        const firstTwoCells = `${String(row[0] || '')} ${String(row[1] || '')}`.toLowerCase();
        if (
          firstTwoCells.includes('daily total') ||
          firstTwoCells.includes('daily req') ||
          firstTwoCells.trim() === 'total' ||
          firstTwoCells.startsWith('total ') ||
          firstTwoCells.includes('grand total')
        ) {
          continue;
        }

        // 4. Look for a Flight Name in the first 4 columns
        let fltCol = -1;
        let matchedF: FlightName | null = null;
        let rawFlight = '';

        for (let c = 0; c < Math.min(row.length, 4); c++) {
          const cellVal = String(row[c] || '').trim();
          if (!cellVal) continue;
          const mf = matchFlight(cellVal);
          if (mf) {
            fltCol = c;
            matchedF = mf;
            rawFlight = cellVal;
            break;
          }
        }

        // 5. Look for a Duty Header in this row
        let rowMatchedT: DutyRatioTable | undefined;
        for (let c = 0; c < (fltCol !== -1 ? fltCol : Math.min(row.length, 3)); c++) {
          const cellVal = String(row[c] || '').trim();
          if (!cellVal) continue;
          const mt = matchTable(cellVal);
          if (mt) {
            rowMatchedT = mt;
            break;
          }
        }

        if (rowMatchedT) {
          currentDutyObj = rowMatchedT;
        }

        // If this row is a duty header with NO flight, advance to next row
        if (!matchedF) {
          if (!rowMatchedT) {
            const mt = matchTable(String(row[0] || ''));
            if (mt) {
              currentDutyObj = mt;
            }
          }
          continue;
        }

        // 6. Process flight row
        if (matchedF) {
          const days: number[] = [];
          const errors: string[] = [];

          if (!currentDutyObj) {
            errors.push(`Flight "${rawFlight}" found before any Duty heading`);
          }

          for (let d = 0; d < 31; d++) {
            const col = (dayIndices[d] !== undefined && dayIndices[d] >= 0) ? dayIndices[d] : (fltCol + 1 + d);
            let val = 0;
            if (row[col] !== undefined && row[col] !== null && String(row[col]).trim() !== '') {
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

          parsed.push({
            id: `row-${i}-${Date.now()}-${matchedF}`,
            dutyType: currentDutyObj ? currentDutyObj.title : 'Unknown Duty',
            matchedTableId: currentDutyObj ? currentDutyObj.id : null,
            flight: rawFlight,
            matchedFlight: matchedF,
            days,
            errors,
          });
          continue;
        }
      }
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

  const handleDownloadExcelSample = () => {
    exportDutyRatioMatrixExcel(currentMatrix, 'BAF_155_UASU_Duty_Ratio_Template.xlsx');
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

      // Recalculate totalRequiredMonth for updated tables
      newMatrix.forEach((table) => {
        const total = VALID_FLIGHTS.reduce((sum, fl) => {
          return sum + (table.data[fl] || []).reduce((a, b) => a + b, 0);
        }, 0);
        if (total > 0) {
          table.totalRequiredMonth = total;
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
                Upload an Excel spreadsheet (.xlsx) containing official daily duty quotas for all flights.
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
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-400 flex items-center justify-center mb-2 shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {fileName ? `Selected: ${fileName}` : 'Click to select or drag & drop Excel (.xlsx) matrix file'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Format: Duty Matrix with Date, 1 through 31, Total (Official Excel Workbook format)
              </p>
            </div>

            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/70 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wide">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Standard Excel Template</span>
                </div>
                <p className="text-xs text-indigo-800 dark:text-indigo-200/80 mt-1 leading-relaxed">
                  Download the official duty ratio spreadsheet template in Microsoft Excel (.xlsx) format with live formulas (Date, 1..31 for all duties).
                </p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleDownloadExcelSample}
                  className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Download Excel Workbook with Live Formulas"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Template (.xlsx)</span>
                </button>
              </div>
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

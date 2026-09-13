import React, { useState, useRef } from 'react';
import { Airman, FlightName, Rank } from '../types';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Edit2,
  Check,
  RefreshCw,
  Users,
  Shield,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { localDb } from '../services/localDatabase';

interface BulkImportAirmenModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingAirmen: Airman[];
  onImportComplete: () => void;
}

export interface ParsedAirmanRow {
  id: string;
  rank: string;
  name: string;
  bdNo: string;
  trade: string;
  addressBlock: string;
  mobileNo: string;
  flightName: string;
  remarks: string;
  errors: string[];
  warnings: string[];
}

const VALID_RANKS: Rank[] = ['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];
const VALID_FLIGHTS: FlightName[] = ['Avionics', 'Mechanics', 'GCS', 'Admin'];

export const BulkImportAirmenModal: React.FC<BulkImportAirmenModalProps> = ({
  isOpen,
  onClose,
  existingAirmen,
  onImportComplete,
}) => {
  const [rows, setRows] = useState<ParsedAirmanRow[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const normalizeBd = (bd: string) => {
    return bd.trim().replace(/^BD\/?/i, '').replace(/\s+/g, '').toLowerCase();
  };

  const normalizeRank = (raw: string): { rank: Rank; valid: boolean } => {
    const trimmed = raw.trim().toUpperCase();
    const found = VALID_RANKS.find((r) => r.toUpperCase() === trimmed);
    if (found) return { rank: found, valid: true };
    if (trimmed === 'SERGEANT') return { rank: 'Sgt', valid: true };
    if (trimmed === 'CORPORAL') return { rank: 'Cpl', valid: true };
    if (trimmed === 'LEADING AIRMAN') return { rank: 'LAC', valid: true };
    return { rank: 'LAC', valid: false };
  };

  const normalizeFlight = (raw: string): { flight: FlightName; valid: boolean } => {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.includes('avionic') || trimmed === 'avi') return { flight: 'Avionics', valid: true };
    if (trimmed.includes('mechanic') || trimmed === 'mech') return { flight: 'Mechanics', valid: true };
    if (trimmed.includes('gcs')) return { flight: 'GCS', valid: true };
    if (trimmed.includes('admin') || trimmed === 'adm') return { flight: 'Admin', valid: true };
    return { flight: 'Admin', valid: false };
  };

  const validateRows = (rawRows: ParsedAirmanRow[], existing: Airman[]): ParsedAirmanRow[] => {
    const existingBdSet = new Set(existing.map((a) => normalizeBd(a.bdNo)));
    const fileBdCount: Record<string, number> = {};

    // Count BD numbers in this file
    rawRows.forEach((r) => {
      const norm = normalizeBd(r.bdNo);
      if (norm) {
        fileBdCount[norm] = (fileBdCount[norm] || 0) + 1;
      }
    });

    return rawRows.map((row) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Required Name
      if (!row.name.trim()) {
        errors.push('Name is required');
      }

      // Required BD No
      const normBd = normalizeBd(row.bdNo);
      if (!row.bdNo.trim() || !normBd) {
        errors.push('BD Number is required');
      } else {
        if (existingBdSet.has(normBd)) {
          const match = existing.find((a) => normalizeBd(a.bdNo) === normBd);
          errors.push(`BD/${row.bdNo} already exists in Nominal Roll (${match?.rank} ${match?.name})`);
        }
        if (fileBdCount[normBd] > 1) {
          errors.push(`Duplicate BD/${row.bdNo} appears multiple times in this file`);
        }
      }

      // Rank validation
      const rankCheck = normalizeRank(row.rank);
      if (!rankCheck.valid) {
        errors.push(`Invalid rank "${row.rank}". Allowed: MWO, SWO, WO, Sgt, Cpl, LAC, AC-1, AC-2`);
      }

      // Flight validation
      const flightCheck = normalizeFlight(row.flightName);
      if (!flightCheck.valid) {
        errors.push(`Invalid flight "${row.flightName}". Allowed: Avionics, Mechanics, GCS, Admin`);
      }

      return {
        ...row,
        errors,
        warnings,
      };
    });
  };

  const processData = (data: any[][]) => {
    if (!data || data.length < 2) {
      alert('The file is empty or missing data rows.');
      return;
    }

    const headers = data[0].map((h: any) => String(h || '').trim().toLowerCase());

    const findCol = (keywords: string[]) => {
      return headers.findIndex((h) => keywords.some((k) => h.includes(k)));
    };

    const rankIdx = findCol(['rank', 'পদবি']);
    const nameIdx = findCol(['name', 'নাম', 'airman']);
    const bdIdx = findCol(['bd', 'bd no', 'bdno', 'service no', 'svc no', 'number']);
    const tradeIdx = findCol(['trade', 'ট্রেড']);
    const addressIdx = findCol(['address', 'living', 'block', 'quarter', 'qtr', 'mess']);
    const mobileIdx = findCol(['mobile', 'phone', 'cell', 'contact']);
    const flightIdx = findCol(['flight', 'flt', 'section']);
    const remarksIdx = findCol(['remarks', 'remark', 'note']);

    const parsed: ParsedAirmanRow[] = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
        continue;
      }

      const getVal = (idx: number, fallback = '') => (idx >= 0 && row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : fallback);

      const rawRank = getVal(rankIdx, 'LAC');
      const rawName = getVal(nameIdx, '');
      let rawBd = getVal(bdIdx, '');
      if (rawBd && !rawBd.toUpperCase().startsWith('BD')) {
        rawBd = `BD/${rawBd}`;
      }
      const rawTrade = getVal(tradeIdx, 'General Tech');
      const rawAddress = getVal(addressIdx, "");
      const rawMobile = getVal(mobileIdx, '01');
      const rawFlight = getVal(flightIdx, 'Admin');
      const rawRemarks = getVal(remarksIdx, '');

      parsed.push({
        id: `row-${i}-${Date.now()}`,
        rank: rawRank,
        name: rawName,
        bdNo: rawBd,
        trade: rawTrade,
        addressBlock: rawAddress,
        mobileNo: rawMobile,
        flightName: rawFlight,
        remarks: rawRemarks,
        errors: [],
        warnings: [],
      });
    }

    const validated = validateRows(parsed, existingAirmen);
    setRows(validated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    parseUploadedFile(file);
  };

  const parseUploadedFile = (file: File) => {
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setFileName(file.name);
      parseUploadedFile(file);
    }
  };

  const handleRowChange = (id: string, field: keyof ParsedAirmanRow, value: string) => {
    const updated = rows.map((r) => {
      if (r.id === id) {
        return { ...r, [field]: value };
      }
      return r;
    });
    setRows(validateRows(updated, existingAirmen));
  };

  const handleDeleteRow = (id: string) => {
    const updated = rows.filter((r) => r.id !== id);
    setRows(validateRows(updated, existingAirmen));
  };

  const handleDownloadSample = () => {
    const headers = ['Rank', 'Name', 'BD No', 'Trade', 'Address Block', 'Mobile No', 'Flight Name', 'Remarks'];
    const sampleRows = [
      ['Sgt', 'Sazzad Hossain', 'BD/478546', 'Avionic Tech', "Sgt's Mess Block 05", '01712345678', 'Avionics', 'UAV Operator'],
      ['CPL', 'Russel Ahmed', 'BD/489123', 'Mech Tech', "Airmen's Mess Block 08", '01812345678', 'Mechanics', 'Engine Tech'],
      ['LAC', 'Anowar Hossain', 'BD/495678', 'GCST', 'Svc Qtr D-14', '01912345678', 'GCS', 'Shift IC'],
      ['AC', 'Rakib Hasan', 'BD/498901', 'Admin Tech', 'Outside Base: Agrabad', '01612345678', 'Admin', 'Admin Clerk'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...sampleRows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'BAF_155_UASU_Airmen_Nominal_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalErrors = rows.reduce((sum, r) => sum + r.errors.length, 0);
  const canImport = rows.length > 0 && totalErrors === 0 && !isImporting;

  const handleImport = async () => {
    if (!canImport) return;
    setIsImporting(true);

    try {
      const airmenToImport = rows.map((r) => {
        const rankObj = normalizeRank(r.rank);
        const flightObj = normalizeFlight(r.flightName);
        let cleanBd = r.bdNo.trim();
        if (!cleanBd.toUpperCase().startsWith('BD')) {
          cleanBd = `BD/${cleanBd}`;
        }
        return {
          rank: rankObj.rank,
          name: r.name.trim(),
          bdNo: cleanBd,
          trade: r.trade.trim() || 'General Tech',
          addressBlock: r.addressBlock.trim(),
          mobileNo: r.mobileNo.trim() || '01700000000',
          flightName: flightObj.flight,
          remarks: r.remarks.trim() || 'Bulk Imported',
          code: `${rankObj.rank}-${r.name.trim().slice(0, 3).toUpperCase()}`,
        };
      });

      // Use localDb bulk add
      localDb.bulkAddAirmen(airmenToImport);

      onImportComplete();
      onClose();
    } catch (err: any) {
      alert(`Import failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 shadow-2xl max-w-5xl w-full my-0 sm:my-6 flex flex-col h-full sm:h-auto sm:max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-slate-900 via-slate-800 to-emerald-950 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black tracking-tight text-white">
                  Bulk Import Airmen to Nominal Roll
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-950 border border-emerald-500/40 text-emerald-400 uppercase">
                  CSV / Excel (.xlsx)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Upload nominal roster sheet to batch-create airmen records with instant validation.
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

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Upload Section + Template Download */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Drag and drop box */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`md:col-span-2 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 ring-4 ring-emerald-500/20'
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
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-2 shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {fileName ? `Selected: ${fileName}` : 'Click to select or drag & drop CSV/Excel file'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Supports .CSV and Excel .XLSX spreadsheets
              </p>
            </div>

            {/* Template Card */}
            <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wide">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Standard Template</span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-200/80 mt-1 leading-relaxed">
                  Download our pre-formatted spreadsheet template with the correct column headers and sample data.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadSample}
                className="mt-4 w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center space-x-2 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Sample CSV</span>
              </button>
            </div>
          </div>

          {/* Parsed Rows Preview */}
          {rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2.5">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    Parsed Rows ({rows.length})
                  </span>
                  {totalErrors === 0 ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ready to Import (0 Errors)</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>{totalErrors} Issues Found — Please edit or remove invalid rows</span>
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Tip: You can edit values directly in the table cells below.
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold sticky top-0 z-10">
                      <tr>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">#</th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Status</th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Rank</th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Name</th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">BD Number</th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Flight</th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Trade</th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Address / Mess</th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700">Mobile</th>
                        <th className="p-2.5 border-b border-slate-200 dark:border-slate-700 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900 font-medium">
                      {rows.map((row, idx) => {
                        const hasError = row.errors.length > 0;
                        return (
                          <tr
                            key={row.id}
                            className={`transition-colors ${
                              hasError
                                ? 'bg-rose-50/60 dark:bg-rose-950/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <td className="p-2.5 text-slate-500 font-mono">{idx + 1}</td>
                            <td className="p-2.5 whitespace-nowrap">
                              {hasError ? (
                                <div
                                  className="flex items-center space-x-1 text-rose-600 dark:text-rose-400 font-bold"
                                  title={row.errors.join('; ')}
                                >
                                  <AlertCircle className="w-4 h-4 shrink-0" />
                                  <span className="truncate max-w-[120px]">{row.errors[0]}</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>Valid</span>
                                </div>
                              )}
                            </td>
                            <td className="p-2">
                              <select
                                value={row.rank}
                                onChange={(e) => handleRowChange(row.id, 'rank', e.target.value)}
                                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                              >
                                {VALID_RANKS.map((r) => (
                                  <option key={r} value={r}>
                                    {r}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.name}
                                onChange={(e) => handleRowChange(row.id, 'name', e.target.value)}
                                className="w-32 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-semibold"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.bdNo}
                                onChange={(e) => handleRowChange(row.id, 'bdNo', e.target.value)}
                                className="w-28 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white font-bold"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={row.flightName}
                                onChange={(e) => handleRowChange(row.id, 'flightName', e.target.value)}
                                className="px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                              >
                                {VALID_FLIGHTS.map((f) => (
                                  <option key={f} value={f}>
                                    {f}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.trade}
                                onChange={(e) => handleRowChange(row.id, 'trade', e.target.value)}
                                className="w-28 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.addressBlock}
                                onChange={(e) => handleRowChange(row.id, 'addressBlock', e.target.value)}
                                className="w-36 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={row.mobileNo}
                                onChange={(e) => handleRowChange(row.id, 'mobileNo', e.target.value)}
                                className="w-28 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id)}
                                className="p-1 text-slate-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                title="Remove row"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
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

        {/* Modal Footer */}
        <div className="p-5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {rows.length > 0 ? (
              <span>
                <strong>{rows.length}</strong> airmen ready • {totalErrors === 0 ? 'All validations passed' : `${totalErrors} errors to resolve`}
              </span>
            ) : (
              <span>Please upload a CSV or Excel spreadsheet to begin</span>
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
              onClick={handleImport}
              disabled={!canImport}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs rounded-xl shadow-md flex items-center space-x-2 transition-all cursor-pointer"
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Users className="w-4 h-4" />
                  <span>Import {rows.length} Airmen</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

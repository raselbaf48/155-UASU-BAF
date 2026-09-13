import React, { useState, useRef, useEffect } from 'react';
import {
  FileUp,
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Calendar,
  Layers,
  UserCheck,
  ShieldCheck,
  Filter,
  Check,
  Trash2,
  Search,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Info,
  History,
  RotateCcw
} from 'lucide-react';
import { Airman, FlightName, DutyCategoryCode, IDAShift, DocumentAnalysisResult } from '../types';
import { DUTY_TYPES } from '../data/dutyTypes';


const formatAirmanName = (name: string) => {
  if (!name) return '';
  const lower = name.toLowerCase().trim();
  if (lower === 'sgt') return 'Sgt';
  if (lower === 'cpl') return 'Cpl';
  if (['mwo', 'swo', 'wo', 'lac', 'ac', 'mw'].includes(lower)) return lower.toUpperCase();
  return name.toLowerCase().split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};
interface UploadedFileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  base64: string;
}

interface PdfDutyImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  airmen: Airman[];
  onImportSuccess?: (importedDates: string[]) => void;
  onNavigateToTab?: (tab: any, date?: string) => void;
}

export const PdfDutyImportModal: React.FC<PdfDutyImportModalProps> = ({
  isOpen,
  onClose,
  airmen,
  onImportSuccess,
  onNavigateToTab,
}) => {
  const [activeInputTab, setActiveInputTab] = useState<'file' | 'text' | 'history'>('file');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [textSnippet, setTextSnippet] = useState<string>('');
  const [targetYear, setTargetYear] = useState<number>(2026);
  const [targetFlight, setTargetFlight] = useState<FlightName | 'Overall'>('Overall');

  // Flow states: 'upload' | 'analyzing' | 'review' | 'applying' | 'success'
  const [step, setStep] = useState<'upload' | 'analyzing' | 'review' | 'applying' | 'success'>('upload');
  const [analysisProgressMsg, setAnalysisProgressMsg] = useState<string>('Reading all pages & document structure...');
  const [analysisResult, setAnalysisResult] = useState<DocumentAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // History tab states
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [revertingBatchId, setRevertingBatchId] = useState<string | null>(null);
  const [historyToast, setHistoryToast] = useState<string>('');

  // Filter states in review
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('ALL');
  const [searchAirmanQuery, setSearchAirmanQuery] = useState<string>('');
  const [filterDutyCode, setFilterDutyCode] = useState<string>('ALL');
  const [filterFlight, setFilterFlight] = useState<string>('ALL');
  const [filterMatchStatus, setFilterMatchStatus] = useState<'ALL' | 'MATCHED' | 'UNMATCHED'>('ALL');

  const [importResult, setImportResult] = useState<{ appliedCount: number; dates: string[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch import history
  const fetchImportHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/import/history');
      if (res.ok) {
        const data = await res.json();
        setImportHistory(Array.isArray(data.history) ? data.history : []);
      }
    } catch (err) {
      console.error('Failed to load import history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeInputTab === 'history') {
      fetchImportHistory();
    }
  }, [isOpen, activeInputTab]);

  const handleRevertBatch = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to revert this import batch? Any imported duties in this batch will be rolled back.')) {
      return;
    }
    setRevertingBatchId(batchId);
    try {
      const res = await fetch('/api/import/revert-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryToast(data.message || 'Import batch reverted successfully.');
        setTimeout(() => setHistoryToast(''), 3000);
        fetchImportHistory();
        window.dispatchEvent(new CustomEvent('baf_state_updated'));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to revert import batch');
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setRevertingBatchId(null);
    }
  };

  // Cycle informative progress messages during analysis
  useEffect(() => {
    if (step !== 'analyzing') return;
    const messages = [
      'Extracting text across all PDF pages (supporting 20+ pages)...',
      'Detecting Flight banners (Avionics, Mechanics, GCS, Admin)...',
      'Correlating dates and column headers with duty positions...',
      'Matching Bangladesh Air Force Airmen (BD Number & Rank)...',
      'Aggregating multi-page duty assignments into comprehensive schedule...',
    ];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % messages.length;
      setAnalysisProgressMsg(messages[idx]);
    }, 2800);
    return () => clearInterval(interval);
  }, [step]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const processFiles = (files: File[]) => {
    setAnalysisError(null);
    const newItems: UploadedFileItem[] = [];

    let processedCount = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        newItems.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          type: file.type || 'application/pdf',
          base64: result,
        });
        processedCount++;
        if (processedCount === files.length) {
          setUploadedFiles((prev) => [...prev, ...newItems]);
        }
      };
      reader.onerror = () => {
        processedCount++;
        setAnalysisError('Some files could not be read. Please try again.');
      };
      reader.readAsDataURL(file);
    });
  };

  const removeFile = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleStartAnalysis = async () => {
    if (activeInputTab === 'file' && uploadedFiles.length === 0) {
      setAnalysisError('Please select or drop at least one PDF or image file first.');
      return;
    }
    if (activeInputTab === 'text' && !textSnippet.trim()) {
      setAnalysisError('Please paste duty table text or OCR content.');
      return;
    }

    setStep('analyzing');
    setAnalysisError(null);
    setAnalysisProgressMsg('Analyzing all pages from uploaded documents...');

    try {
      const payloadFiles = uploadedFiles.map((f) => ({
        name: f.name,
        base64: f.base64,
        mimeType: f.type,
      }));

      const response = await fetch('/api/import/analyze-duty-doc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: activeInputTab === 'file' && payloadFiles.length > 0 ? payloadFiles : undefined,
          fileBase64: activeInputTab === 'file' && payloadFiles.length === 1 ? payloadFiles[0].base64 : undefined,
          mimeType: activeInputTab === 'file' && payloadFiles.length === 1 ? payloadFiles[0].mimeType : undefined,
          textSnippet: activeInputTab === 'text' ? textSnippet : undefined,
          targetYear,
          targetFlight,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to analyze duty document');
      }

      const result: DocumentAnalysisResult = await response.json();
      if (!result.dates || result.dates.length === 0) {
        throw new Error('No dates or duty assignments could be detected in the document. Please verify the document format.');
      }

      setAnalysisResult(result);
      setStep('review');
    } catch (err: any) {
      console.error('Error analyzing document:', err);
      setAnalysisError(err.message || 'Error analyzing document');
      setStep('upload');
    }
  };

  // Toggle ignoring an individual assignment
  const handleToggleAssignment = (dateStr: string, asnIndex: number) => {
    if (!analysisResult) return;
    const updatedDates = analysisResult.dates.map((dateEntry) => {
      if (dateEntry.date === dateStr) {
        const updatedAssignments = [...dateEntry.assignments];
        updatedAssignments[asnIndex] = {
          ...updatedAssignments[asnIndex],
          isIgnored: !updatedAssignments[asnIndex].isIgnored,
        };
        return { ...dateEntry, assignments: updatedAssignments };
      }
      return dateEntry;
    });

    setAnalysisResult({ ...analysisResult, dates: updatedDates });
  };

  // Bulk actions: select all or deselect all
  const handleBulkSelect = (select: boolean) => {
    if (!analysisResult) return;
    const updatedDates = analysisResult.dates.map((d) => ({
      ...d,
      assignments: d.assignments.map((a) => ({
        ...a,
        isIgnored: !select,
      })),
    }));
    setAnalysisResult({ ...analysisResult, dates: updatedDates });
  };

  // Keep only matched airmen (ignore unmatched)
  const handleIgnoreUnmatched = () => {
    if (!analysisResult) return;
    const updatedDates = analysisResult.dates.map((d) => ({
      ...d,
      assignments: d.assignments.map((a) => ({
        ...a,
        isIgnored: !a.matchedAirmanId ? true : a.isIgnored,
      })),
    }));
    setAnalysisResult({ ...analysisResult, dates: updatedDates });
  };

  // Manually change matched airman
  const handleChangeAirman = (dateStr: string, asnIndex: number, newAirmanId: string) => {
    if (!analysisResult) return;
    const selectedAirman = airmen.find((a) => a.id === newAirmanId);

    const updatedDates = analysisResult.dates.map((dateEntry) => {
      if (dateEntry.date === dateStr) {
        const updatedAssignments = [...dateEntry.assignments];
        if (selectedAirman) {
          updatedAssignments[asnIndex] = {
            ...updatedAssignments[asnIndex],
            matchedAirmanId: selectedAirman.id,
            matchedAirmanName: selectedAirman.name,
            matchedAirmanRank: selectedAirman.rank,
            matchedAirmanTrade: selectedAirman.trade,
            matchedAirmanFlight: selectedAirman.flightName,
            matchedAirmanBdNo: selectedAirman.bdNo,
            confidence: 1.0,
            isIgnored: false,
          };
        } else {
          updatedAssignments[asnIndex] = {
            ...updatedAssignments[asnIndex],
            matchedAirmanId: null,
            confidence: 0,
          };
        }
        return { ...dateEntry, assignments: updatedAssignments };
      }
      return dateEntry;
    });

    setAnalysisResult({ ...analysisResult, dates: updatedDates });
  };

  // Manually change duty code
  const handleChangeDutyCode = (dateStr: string, asnIndex: number, newDutyCode: DutyCategoryCode) => {
    if (!analysisResult) return;
    const dutyInfo = DUTY_TYPES.find((d) => d.code === newDutyCode);

    const updatedDates = analysisResult.dates.map((dateEntry) => {
      if (dateEntry.date === dateStr) {
        const updatedAssignments = [...dateEntry.assignments];
        updatedAssignments[asnIndex] = {
          ...updatedAssignments[asnIndex],
          dutyCode: newDutyCode,
          dutyName: dutyInfo?.name || newDutyCode,
        };
        return { ...dateEntry, assignments: updatedAssignments };
      }
      return dateEntry;
    });

    setAnalysisResult({ ...analysisResult, dates: updatedDates });
  };

  // Manually change IDA shift
  const handleChangeIdaShift = (dateStr: string, asnIndex: number, newShift: IDAShift) => {
    if (!analysisResult) return;
    const updatedDates = analysisResult.dates.map((dateEntry) => {
      if (dateEntry.date === dateStr) {
        const updatedAssignments = [...dateEntry.assignments];
        updatedAssignments[asnIndex] = {
          ...updatedAssignments[asnIndex],
          idaShift: newShift,
        };
        return { ...dateEntry, assignments: updatedAssignments };
      }
      return dateEntry;
    });

    setAnalysisResult({ ...analysisResult, dates: updatedDates });
  };

  const handleApplyImport = async () => {
    if (!analysisResult) return;

    setStep('applying');
    setAnalysisError(null);

    try {
      const flatAssignments: any[] = [];

      for (const dateEntry of analysisResult.dates) {
        for (const asn of dateEntry.assignments) {
          if (asn.isIgnored || !asn.matchedAirmanId || asn.dutyCode === 'ON_PARADE' || asn.dutyCode === 'DUTY_OFF') continue;
          flatAssignments.push({
            airmanId: asn.matchedAirmanId,
            date: dateEntry.date,
            dutyCode: asn.dutyCode,
            idaShift: asn.dutyCode === 'IDAC' ? asn.idaShift || 'Morning' : undefined,
            notes: '',
          });
        }
      }

      if (flatAssignments.length === 0) {
        throw new Error('No valid duty assignments selected for import. (Duty Off and On Parade are automatically excluded).');
      }

      const response = await fetch('/api/import/apply-duty-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignments: flatAssignments,
          sourceDoc: analysisResult.documentTitle || 'PDF Duty Roster',
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save imported duties');
      }

      const resultData = await response.json();
      setImportResult({
        appliedCount: resultData.appliedCount || flatAssignments.length,
        dates: resultData.dates || [],
      });
      setStep('success');

      if (onImportSuccess) {
        onImportSuccess(resultData.dates || []);
      }
    } catch (err: any) {
      console.error('Error applying duties:', err);
      setAnalysisError(err.message || 'Failed to import duty data');
      setStep('review');
    }
  };

  const getDutyBadgeColor = (code: DutyCategoryCode) => {
    const info = DUTY_TYPES.find((d) => d.code === code);
    if (info) return { bg: info.badgeBg, text: info.badgeText };
    return { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-200' };
  };

  // Filtered dates and assignments
  const visibleDates = (analysisResult?.dates || [])
    .filter((d) => selectedDateFilter === 'ALL' || d.date === selectedDateFilter)
    .map((d) => {
      const filteredAssignments = d.assignments.filter((asn) => {
        // Search query
        if (searchAirmanQuery.trim()) {
          const q = searchAirmanQuery.toLowerCase();
          const nameMatch = (asn.matchedAirmanName || asn.rawText || '').toLowerCase().includes(q);
          const rankMatch = (asn.matchedAirmanRank || '').toLowerCase().includes(q);
          const bdMatch = (asn.matchedAirmanBdNo || '').toLowerCase().includes(q);
          const dutyMatch = (asn.dutyName || asn.dutyCode).toLowerCase().includes(q);
          if (!nameMatch && !rankMatch && !bdMatch && !dutyMatch) return false;
        }

        // Duty filter
        if (filterDutyCode !== 'ALL' && asn.dutyCode !== filterDutyCode) {
          return false;
        }

        // Flight filter
        if (filterFlight !== 'ALL' && asn.matchedAirmanFlight !== filterFlight) {
          return false;
        }

        // Match status filter
        if (filterMatchStatus === 'MATCHED' && !asn.matchedAirmanId) return false;
        if (filterMatchStatus === 'UNMATCHED' && asn.matchedAirmanId) return false;

        return true;
      });

      return {
        ...d,
        assignments: filteredAssignments,
      };
    })
    .filter((d) => d.assignments.length > 0 || (searchAirmanQuery === '' && filterDutyCode === 'ALL' && filterFlight === 'ALL' && filterMatchStatus === 'ALL'));

  const totalValidAssignmentsCount =
    analysisResult?.dates.reduce(
      (sum, d) => sum + d.assignments.filter((a) => !a.isIgnored && a.matchedAirmanId).length,
      0
    ) || 0;

  const totalPossibleAssignments =
    analysisResult?.dates.reduce((sum, d) => sum + d.assignments.length, 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-6 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border-0 sm:border border-slate-200 dark:border-slate-800 rounded-none sm:rounded-2xl shadow-2xl w-full max-w-6xl h-full sm:h-auto sm:max-h-[94vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-linear-to-r from-emerald-900 via-emerald-800 to-[#083822] text-white shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-700/60 rounded-xl border border-emerald-500/30 text-amber-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight">OCR / Text Duty Data Import</h2>
                <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 rounded-md">
                  Unlimited Pages (20+)
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                Upload 1 to 20+ page military Parade State PDFs or image rosters — all tables &amp; dates will be extracted and correlated
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: UPLOAD OR PASTE TEXT */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Input Mode Tabs & Parameters */}
              <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveInputTab('file')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeInputTab === 'file'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <FileUp className="w-4 h-4" />
                    <span>Upload PDF / Word (.docx) / Images</span>
                  </button>

                  <button
                    onClick={() => setActiveInputTab('text')}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeInputTab === 'text'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Paste Roster Text / Table</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveInputTab('history');
                      fetchImportHistory();
                    }}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      activeInputTab === 'history'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <History className="w-4 h-4" />
                    <span>Import History & Revert</span>
                  </button>
                </div>

                <div className="flex items-center space-x-3 text-xs text-slate-500">
                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Target Year:</span>
                    <select
                      value={targetYear}
                      onChange={(e) => setTargetYear(Number(e.target.value))}
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      <option value={2026}>2026</option>
                      <option value={2025}>2025</option>
                      <option value={2027}>2027</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">Flight Scope:</span>
                    <select
                      value={targetFlight}
                      onChange={(e) => setTargetFlight(e.target.value as any)}
                      className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      <option value="Overall">All Flights (Auto-Detect)</option>
                      <option value="Avionics">Avionics (AVI FLT)</option>
                      <option value="Mechanics">Mechanics (MECH FLT)</option>
                      <option value="GCS">GCS Flight</option>
                      <option value="Admin">Admin Flight</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Error banner if any */}
              {analysisError && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 flex items-start space-x-3 text-red-700 dark:text-red-300 text-xs">
                  <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
                  <div>
                    <span className="font-bold">Error:</span> {analysisError}
                  </div>
                </div>
              )}

              {/* Multi-Page & Multi-File Drag & Drop Upload Zone */}
              {activeInputTab === 'file' && (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 ${
                      uploadedFiles.length > 0
                        ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-slate-300 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 bg-slate-50/50 dark:bg-slate-800/30'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
                        <UploadCloud className="w-8 h-8" />
                      </div>

                      <div className="space-y-1">
                        <p className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          {uploadedFiles.length > 0
                            ? 'Click to add more files or drag and drop additional PDFs / Word docs / images'
                            : 'Click to browse or drag and drop your Multi-Page PDF / Word (.docx) / Image roster'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Supports 20+ page monthly Parade State PDFs, Word (.docx/.doc) tables, multi-flight rosters, and images (up to 50MB)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Uploaded Files List */}
                  {uploadedFiles.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                          <Layers className="w-4 h-4 text-emerald-600" />
                          <span>Selected Documents ({uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''})</span>
                        </span>
                        <button
                          onClick={() => setUploadedFiles([])}
                          className="text-[11px] text-red-600 hover:text-red-700 font-semibold"
                        >
                          Clear All
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {uploadedFiles.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                          >
                            <div className="flex items-center space-x-2.5 overflow-hidden">
                              <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                              <div className="truncate">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{f.name}</p>
                                <p className="text-[10px] text-slate-400">{(f.size / 1024).toFixed(1)} KB • {f.type}</p>
                              </div>
                            </div>
                            <button
                              onClick={(e) => removeFile(f.id, e)}
                              className="p-1 text-slate-400 hover:text-red-500 rounded transition-colors"
                              title="Remove file"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Text Input Area */}
              {activeInputTab === 'text' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Paste Roster Table Content or Multi-Page OCR Text:
                  </label>
                  <textarea
                    value={textSnippet}
                    onChange={(e) => setTextSnippet(e.target.value)}
                    placeholder={`e.g. 
PARADE STATE : AIRMEN AVI FLT
DT: 20-08-2026 THU
Security GD: 501309 Sgt Mizan, 509204 Cpl Anis
BTF: 502842 Sgt Belal
NTF: 508492 Cpl Tariq
IDA Center M: 504123 Sgt Faruk
IDA Center A: 506789 Cpl Karim
IDA Center N: 508111 LAC Jabbar

DT: 21-08-2026 FRI
Security GD: 509301 Cpl Rashed, 509999 LAC Jahid
...`}
                    rows={10}
                    className="w-full font-mono text-xs p-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-slate-500">
                    Tip: You can copy-paste from Word, PDF text, or scanner OCR. The system will use OCR and Regex to parse dates and match personnel automatically.
                  </p>
                </div>
              )}

              {/* Import History & Revert Tab */}
              {activeInputTab === 'history' && (
                <div className="space-y-4">
                  {historyToast && (
                    <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{historyToast}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Previously Imported Roster Batches
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        View past document imports and revert/rollback assignments if needed.
                      </p>
                    </div>
                    <button
                      onClick={fetchImportHistory}
                      disabled={loadingHistory}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-1"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? 'animate-spin' : ''}`} />
                      <span>Refresh</span>
                    </button>
                  </div>

                  {loadingHistory ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                      Loading import history...
                    </div>
                  ) : importHistory.length === 0 ? (
                    <div className="py-12 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                      <History className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Import History Found</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Any documents or text you import will be logged here with full undo capabilities.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                      {importHistory.map((batch: any) => (
                        <div
                          key={batch.id}
                          className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                                {batch.sourceDoc || 'Document Import'}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                                {batch.dutyCount || 0} Duties
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {batch.datesCount || (batch.dates ? batch.dates.length : 0)} Dates
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center space-x-2">
                              <span>{new Date(batch.timestamp).toLocaleString()}</span>
                              {batch.dates && batch.dates.length > 0 && (
                                <span>• Range: {batch.dates[0]} to {batch.dates[batch.dates.length - 1]}</span>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => handleRevertBatch(batch.id)}
                            disabled={revertingBatchId === batch.id}
                            className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300 font-bold text-xs border border-red-200 dark:border-red-800/60 flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${revertingBatchId === batch.id ? 'animate-spin' : ''}`} />
                            <span>{revertingBatchId === batch.id ? 'Reverting...' : 'Revert Batch'}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: ANALYZING ANIMATION */}
          {step === 'analyzing' && (
            <div className="py-16 flex flex-col items-center justify-center space-y-6 text-center max-w-md mx-auto">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-emerald-500/20 border-t-emerald-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-8 h-8 animate-pulse" />
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Multi-Page OCR/Text Analysis in Progress...
                </h3>
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 animate-pulse">
                  {analysisProgressMsg}
                </p>
                <p className="text-[11px] text-slate-400">
                  Processing all pages, parsing flights, and fuzzy-matching Bangladesh Air Force personnel.
                </p>
              </div>
            </div>
          )}

          {/* STEP 3: REVIEW & INTERACTIVE CONFIRMATION */}
          {step === 'review' && analysisResult && (
            <div className="space-y-5">
              {/* Document Overview Header */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 uppercase">
                      {analysisResult.detectedFlight} Flight
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      {analysisResult.documentTitle}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 mt-1.5">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {analysisResult.dateRange.start} to {analysisResult.dateRange.end} ({analysisResult.totalDates} Days)
                      </span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center space-x-1 font-bold text-emerald-700 dark:text-emerald-400">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{totalValidAssignmentsCount} of {totalPossibleAssignments} Duties Selected</span>
                    </span>
                    <span>•</span>
                    <span className="flex items-center space-x-1 text-slate-600 dark:text-slate-400">
                      <Layers className="w-3.5 h-3.5" />
                      <span>{analysisResult.totalPages || 1} Pages Processed</span>
                    </span>
                  </div>
                </div>

                {/* Selective update badge */}
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Selective Update (Other airmen preserved)</span>
                  </div>
                </div>
              </div>

              {/* Filter & Quick Action Bar */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Search and Filters */}
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                  {/* Search query */}
                  <div className="relative min-w-[160px] flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search airman / BD / duty..."
                      value={searchAirmanQuery}
                      onChange={(e) => setSearchAirmanQuery(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  {/* Date Filter */}
                  <select
                    value={selectedDateFilter}
                    onChange={(e) => setSelectedDateFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <option value="ALL">All Dates ({analysisResult.dates.length})</option>
                    {analysisResult.dates.map((d) => (
                      <option key={d.date} value={d.date}>
                        {d.date} ({d.dayName})
                      </option>
                    ))}
                  </select>

                  {/* Duty Type Filter */}
                  <select
                    value={filterDutyCode}
                    onChange={(e) => setFilterDutyCode(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <option value="ALL">All Duties</option>
                    {DUTY_TYPES.filter((d) => d.code !== 'DUTY_OFF' && d.code !== 'ON_PARADE').map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>

                  {/* Flight Filter */}
                  <select
                    value={filterFlight}
                    onChange={(e) => setFilterFlight(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <option value="ALL">All Flights</option>
                    <option value="Avionics">Avionics</option>
                    <option value="Mechanics">Mechanics</option>
                    <option value="GCS">GCS</option>
                    <option value="Admin">Admin</option>
                  </select>

                  {/* Match Status */}
                  <select
                    value={filterMatchStatus}
                    onChange={(e) => setFilterMatchStatus(e.target.value as any)}
                    className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="MATCHED">Matched Only</option>
                    <option value="UNMATCHED">Unmatched Only</option>
                  </select>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleBulkSelect(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center space-x-1 transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Select All</span>
                  </button>

                  <button
                    onClick={() => handleBulkSelect(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center space-x-1 transition-colors"
                  >
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Deselect All</span>
                  </button>

                  <button
                    onClick={handleIgnoreUnmatched}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-[11px] flex items-center space-x-1 transition-colors"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                    <span>Keep Matched Only</span>
                  </button>
                </div>
              </div>

              {/* Assignments List Grouped by Date */}
              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {visibleDates.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-400">
                    No duty assignments match the current search or filters.
                  </div>
                ) : (
                  visibleDates.map((dateEntry) => (
                    <div
                      key={dateEntry.date}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 overflow-hidden shadow-xs"
                    >
                      {/* Date Header */}
                      <div className="bg-slate-100/80 dark:bg-slate-800 px-4 py-2.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                            {dateEntry.date.split('-')[2]}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-slate-900 dark:text-white">
                              {dateEntry.date} ({dateEntry.dayName})
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {dateEntry.assignments.filter((a) => !a.isIgnored && a.matchedAirmanId).length} Active Duties
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Duty Rows */}
                      <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {dateEntry.assignments.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            No matching duties for this date.
                          </div>
                        ) : (
                          dateEntry.assignments.map((asn, idx) => {
                            const badge = getDutyBadgeColor(asn.dutyCode);
                            return (
                              <div
                                key={`${dateEntry.date}-${idx}`}
                                className={`p-3 sm:px-4 flex flex-wrap items-center justify-between gap-3 transition-colors ${
                                  asn.isIgnored ? 'opacity-40 bg-slate-50 dark:bg-slate-900/40' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                                }`}
                              >
                                {/* Left: Checkbox + Duty Type badge */}
                                <div className="flex items-center space-x-3 min-w-[200px]">
                                  <input
                                    type="checkbox"
                                    checked={!asn.isIgnored}
                                    onChange={() => handleToggleAssignment(dateEntry.date, idx)}
                                    className="rounded text-emerald-600 focus:ring-emerald-500"
                                    title="Include / Exclude this duty"
                                  />

                                  <div className="flex flex-col">
                                    <div className="flex items-center space-x-1.5">
                                      <span
                                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${badge.bg} ${badge.text}`}
                                      >
                                        {asn.dutyName || asn.dutyCode}
                                      </span>
                                      {asn.dutyCode === 'IDAC' && (
                                        <select
                                          value={asn.idaShift || 'Morning'}
                                          onChange={(e) =>
                                            handleChangeIdaShift(dateEntry.date, idx, e.target.value as IDAShift)
                                          }
                                          className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded px-1.5 py-0.5"
                                        >
                                          <option value="Morning">Morning</option>
                                          <option value="Afternoon">Afternoon</option>
                                          <option value="Night">Night</option>
                                        </select>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]" title={asn.rawText}>
                                      Raw: "{asn.rawText}"
                                    </span>
                                  </div>
                                </div>

                                {/* Center: Matched Airman Dropdown / Pill */}
                                <div className="flex-1 min-w-[240px]">
                                  <div className="flex items-center space-x-2">
                                    <select
                                      value={asn.matchedAirmanId || ''}
                                      onChange={(e) => handleChangeAirman(dateEntry.date, idx, e.target.value)}
                                      className={`w-full text-xs font-semibold rounded-lg px-2.5 py-1.5 border transition-all ${
                                        asn.matchedAirmanId
                                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-slate-800 dark:text-slate-100'
                                          : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                                      }`}
                                    >
                                      <option value="">-- Select Airman --</option>
                                      {airmen.map((a) => (
                                        <option key={a.id} value={a.id}>
                                          {formatAirmanName(a.rank)} {a.name} (BD/{a.bdNo}, {a.flightName} Flt)
                                        </option>
                                      ))}
                                    </select>

                                    {asn.confidence > 0 && (
                                      <span
                                        className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 shrink-0"
                                        title={`Match Confidence: ${Math.round(asn.confidence * 100)}%`}
                                      >
                                        {Math.round(asn.confidence * 100)}%
                                      </span>
                                    )}
                                  </div>

                                  {/* Security Duty Rank Conflict Warning */}
                                  {asn.dutyCode === 'GD' && asn.matchedAirmanRank && ['MWO', 'SWO', 'WO', 'Sgt'].includes(asn.matchedAirmanRank) && (
                                    <div className="mt-1 text-[10px] font-bold text-red-600 dark:text-red-400 flex items-center space-x-1">
                                      <span>⚠️ Assigning Security Duty (GD) to {asn.matchedAirmanRank} violates protocol (GD is restricted to Cpl, LAC, AC).</span>
                                    </div>
                                  )}
                                </div>

                                {/* Right: Change duty category dropdown */}
                                <div className="flex items-center space-x-2 shrink-0">
                                  <select
                                    value={asn.dutyCode}
                                    onChange={(e) =>
                                      handleChangeDutyCode(dateEntry.date, idx, e.target.value as DutyCategoryCode)
                                    }
                                    className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 font-semibold"
                                  >
                                    {DUTY_TYPES.filter((dt) => dt.code !== 'DUTY_OFF' && dt.code !== 'ON_PARADE').map((dt) => (
                                      <option key={dt.code} value={dt.code}>
                                        {dt.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 4: APPLYING PROGRESS */}
          {step === 'applying' && (
            <div className="py-16 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-600 animate-spin" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Saving duty assignments to 155 UASU Roster...
              </h3>
              <p className="text-xs text-slate-500">Updating local database and syncing all parade states in real-time.</p>
            </div>
          )}

          {/* STEP 5: SUCCESS CONFIRMATION */}
          {step === 'success' && importResult && (
            <div className="py-10 flex flex-col items-center justify-center space-y-6 text-center max-w-md mx-auto">
              <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg animate-in zoom-in-50">
                <Check className="w-10 h-10 stroke-[3]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  Duty Data Successfully Imported!
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {importResult.appliedCount} duty assignments
                  </span>{' '}
                  across{' '}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {importResult.dates.length} dates
                  </span>{' '}
                  have been saved and applied to 155 UASU Parade State.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    if (onNavigateToTab) {
                      onNavigateToTab('parade-state', importResult.dates[0]);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md hover:bg-emerald-700 transition-colors flex items-center space-x-2"
                >
                  <span>View in Parade State</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => {
                    onClose();
                    if (onNavigateToTab) {
                      onNavigateToTab('register', importResult.dates[0]);
                    }
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs shadow-md hover:bg-slate-700 transition-colors flex items-center space-x-2"
                >
                  <span>View Monthly Register</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
          {step === 'upload' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleStartAnalysis}
                disabled={activeInputTab === 'file' ? uploadedFiles.length === 0 : !textSnippet.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Analyze All Pages ({uploadedFiles.length || (textSnippet ? 1 : 0)})</span>
              </button>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                onClick={() => setStep('upload')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Upload New / Add Files</span>
              </button>

              <div className="flex items-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                >
                  Discard
                </button>

                <button
                  onClick={handleApplyImport}
                  disabled={totalValidAssignmentsCount === 0}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all flex items-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Import &amp; Apply to Roster ({totalValidAssignmentsCount})</span>
                </button>
              </div>
            </>
          )}

          {(step === 'analyzing' || step === 'applying') && (
            <div className="w-full text-center text-xs font-semibold text-slate-400">
              Processing, please wait...
            </div>
          )}

          {step === 'success' && (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

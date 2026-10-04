import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, 
  Upload, 
  Clipboard, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  X, 
  Layers, 
  RefreshCw,
  Search,
  Check,
  History,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Calendar,
  Info
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { pushKeyToCloud, pullKeyFromCloud } from '../utils/canteenCloudSync';
import { formatCanteenDate } from '../utils/dateUtils';

export const getRunningMonthKey = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const formatMonthName = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

export const formatShortMonth = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') return 'Current';
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

export const formatPrevMonthKey = (monthKey: string): string => {
  const parts = monthKey.split('-').map(Number);
  if (parts.length < 2) return monthKey;
  const prevDate = new Date(parts[0], parts[1] - 2, 1);
  return `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
};

export const getDateForMonthKey = (monthKey: string, day: number = 28): string => {
  if (!monthKey || monthKey === 'ALL') {
    return formatCanteenDate(new Date());
  }
  const parts = monthKey.split('-').map(Number);
  if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    const year = parts[0];
    const monthIndex = parts[1] - 1;
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate();
    const effectiveDay = Math.min(day, lastDayOfMonth);
    const d = new Date(year, monthIndex, effectiveDay);
    return formatCanteenDate(d);
  }
  return formatCanteenDate(new Date());
};

export interface BillImportBatchItem {
  airman_id: string;
  bdNo: string;
  rank: string;
  surname: string;
  targetMonth?: string;
  lastMonth?: string;
  dueLastMonth: number;
  advanceLastMonth: number;
  dueThisMonth: number;
  importedAmount: number;
  resultingDue: number;
}

export interface BillImportBatch {
  id: string;
  timestamp: string;
  displayDate: string;
  sourceName: string;
  targetMonth?: string;
  lastMonth?: string;
  mode: 'SET' | 'ADD';
  totalMembers: number;
  totalAmount: number;
  createdTransactionIds?: (string | number)[];
  items: BillImportBatchItem[];
}

interface BulkImportInitialBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: any[];
  onSuccess: (updatedMembers: any[]) => void;
  selectedMonth?: string;
  initialTab?: 'FILE' | 'PASTE' | 'HISTORY';
}

export interface ParsedBillRow {
  id: string;
  rawBd: string;
  bdNo: string;
  targetMonth: string;      // This Month (e.g. 2026-10 or 2026-09)
  lastMonth: string;        // Last Month (e.g. 2026-09 or 2026-08)
  dueLastMonth: number;     // Due (Last Month)
  advanceLastMonth: number; // Advance (Last Month)
  dueThisMonth: number;     // Due (This Month)
  totalDue: number;         // Resulting net due
  finalAdvance: number;     // Resulting net advance
  amount: number;
  member: any | null;
  currentDue: number;
  status: 'matched' | 'unmatched';
}

export const BulkImportInitialBillsModal: React.FC<BulkImportInitialBillsModalProps> = ({
  isOpen,
  onClose,
  members,
  onSuccess,
  selectedMonth = 'ALL',
  initialTab = 'FILE'
}) => {
  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE' | 'HISTORY'>(initialTab);
  const [targetMonth, setTargetMonth] = useState<string>(() => {
    return selectedMonth && selectedMonth !== 'ALL' ? selectedMonth : getRunningMonthKey();
  });

  const lastMonth = useMemo(() => formatPrevMonthKey(targetMonth), [targetMonth]);

  const [importMode, setImportMode] = useState<'SET' | 'ADD'>('SET');
  const [createTransaction, setCreateTransaction] = useState<boolean>(true);
  const [pasteText, setPasteText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedBillRow[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [searchPreview, setSearchPreview] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available past and future months for dropdown
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    set.add(curKey);

    for (let i = 1; i <= 12; i++) {
      const prev = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.add(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
    }
    for (let i = 1; i <= 2; i++) {
      const next = new Date(now.getFullYear(), now.getMonth() + i, 1);
      set.add(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
    }

    return Array.from(set).sort().reverse();
  }, []);

  useEffect(() => {
    if (selectedMonth && selectedMonth !== 'ALL') {
      setTargetMonth(selectedMonth);
    }
  }, [selectedMonth]);

  // History state
  const [importHistory, setImportHistory] = useState<BillImportBatch[]>(() => {
    try {
      const raw = localStorage.getItem('canteen_bill_import_history');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [rollbackBatch, setRollbackBatch] = useState<BillImportBatch | null>(null);
  const [isRollingBack, setIsRollingBack] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initialTab when modal opens or prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Load cloud history on mount
  useEffect(() => {
    const loadCloudHistory = async () => {
      try {
        const cloudData = await pullKeyFromCloud('canteen_bill_import_history');
        if (Array.isArray(cloudData) && cloudData.length > 0) {
          setImportHistory(cloudData);
          localStorage.setItem('canteen_bill_import_history', JSON.stringify(cloudData));
        }
      } catch (e) {
        console.warn('Error fetching cloud import history:', e);
      }
    };
    loadCloudHistory();
  }, []);

  // Build member lookup map by cleaned BD No
  const memberMap = useMemo(() => {
    const map = new Map<string, any>();
    members.forEach((m) => {
      const clean = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
      if (clean) map.set(clean, m);
    });
    return map;
  }, [members]);

  // Parse raw matrix / text data into structured rows:
  // Format: SL | BD No | Rank | Surname | Due (Last Month) | Advance (Last Month) | Due (This Month)
  const processRawData = (rows: any[][]) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!Array.isArray(rows) || rows.length === 0) {
      setErrorMessage('কোনো ডাটা পাওয়া যায়নি।');
      return;
    }

    const result: ParsedBillRow[] = [];
    const seenBd = new Set<string>();

    const parseNum = (val: any): number => {
      if (val === null || val === undefined || val === '') return 0;
      const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : Math.abs(parsed);
    };

    // 1. Detect Header Row and Column Indexes
    let headerRowIdx = -1;
    let slColIdx = -1;
    let bdColIdx = -1;
    let dueLastMonthColIdx = -1;
    let advLastMonthColIdx = -1;
    let dueThisMonthColIdx = -1;
    let fallbackAmountColIdx = -1;

    const lastMonthName = formatMonthName(lastMonth).toLowerCase();
    const lastMonthAbbr = lastMonthName.split(' ')[0].slice(0, 3);
    const thisMonthName = formatMonthName(targetMonth).toLowerCase();
    const thisMonthAbbr = thisMonthName.split(' ')[0].slice(0, 3);

    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const lowerCells = row.map((c) => String(c ?? '').trim().toLowerCase());

      const hasBd = lowerCells.some((c) => c.includes('bd') || c.includes('airman') || c.includes('বিডি'));
      const hasBillOrDue = lowerCells.some(
        (c) => c.includes('due') || c.includes('bill') || c.includes('adv') || c.includes('বকেয়া') || c.includes('অগ্রীম') || c.includes('টাকা')
      );
      const hasName = lowerCells.some((c) => c.includes('name') || c.includes('surname') || c.includes('rank') || c.includes('নাম'));

      if (hasBd || (hasBillOrDue && (hasName || lowerCells.some((c) => c === 'sl' || c === 'ser')))) {
        headerRowIdx = r;
        lowerCells.forEach((c, idx) => {
          if (c === 'sl' || c === 'ser' || c === 'serial' || c.startsWith('sl') || c.includes('ক্রমিক') || c === '#') {
            slColIdx = idx;
          } else if (c.includes('bd') || c.includes('airman') || c.includes('বিডি')) {
            bdColIdx = idx;
          } else {
            const hasLastMonthSignal = 
              c.includes('last') || 
              c.includes('prev') || 
              c.includes('পূর্ব') || 
              c.includes('আগের') || 
              (lastMonthAbbr && c.includes(lastMonthAbbr)) || 
              c.includes(lastMonth);

            const hasThisMonthSignal = 
              c.includes('this') || 
              c.includes('curr') || 
              c.includes('চলতি') || 
              c.includes('বর্তমান') || 
              (thisMonthAbbr && c.includes(thisMonthAbbr)) || 
              c.includes(targetMonth);

            if (c.includes('adv') || c.includes('advance') || c.includes('অগ্রীম') || c.includes('ogrim')) {
              advLastMonthColIdx = idx;
            } else if (c.includes('due') || c.includes('bill') || c.includes('বকেয়া') || c.includes('বিল') || c.includes('টাকা')) {
              if (hasThisMonthSignal && !hasLastMonthSignal) {
                dueThisMonthColIdx = idx;
              } else if (hasLastMonthSignal) {
                dueLastMonthColIdx = idx;
              } else {
                if (dueLastMonthColIdx === -1) dueLastMonthColIdx = idx;
                else if (dueThisMonthColIdx === -1) dueThisMonthColIdx = idx;
                else if (fallbackAmountColIdx === -1) fallbackAmountColIdx = idx;
              }
            } else if (c.includes('amount') || c.includes('টাকা')) {
              if (fallbackAmountColIdx === -1) fallbackAmountColIdx = idx;
            }
          }
        });
        break;
      }
    }

    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

    for (let r = startRow; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const strRow = row.map((c) => String(c ?? '').trim());

      // Skip completely empty rows
      if (strRow.every((c) => !c)) continue;

      // Skip repeated header rows
      const joined = strRow.join(' ').toLowerCase();
      if (
        (joined.includes('bd no') || joined.includes('rank') || joined.includes('surname')) &&
        (joined.includes('due') || joined.includes('bill') || joined.includes('advance'))
      ) {
        continue;
      }

      let detectedBd = '';

      // Find BD Number
      if (bdColIdx >= 0 && bdColIdx < strRow.length) {
        const rawBd = strRow[bdColIdx] || '';
        const numOnly = rawBd.replace(/\D/g, '');
        if (numOnly.length >= 4 && numOnly.length <= 7) {
          detectedBd = numOnly;
        }
      }

      if (!detectedBd) {
        for (let i = 0; i < strRow.length; i++) {
          if (i === slColIdx) continue;
          const n = strRow[i].replace(/\D/g, '');
          if (n.length >= 4 && n.length <= 7) {
            detectedBd = n;
            break;
          }
        }
      }

      if (!detectedBd) continue;
      if (seenBd.has(detectedBd)) continue;
      seenBd.add(detectedBd);

      const matchedMember = memberMap.get(detectedBd) || null;
      const currentDue = matchedMember
        ? Number(matchedMember.Due ?? matchedMember.due ?? matchedMember.baki ?? 0)
        : 0;

      let dueLastMonth = 0;
      let advanceLastMonth = 0;
      let dueThisMonth = 0;

      if (dueLastMonthColIdx >= 0 && dueLastMonthColIdx < strRow.length) {
        dueLastMonth = parseNum(strRow[dueLastMonthColIdx]);
      }
      if (advLastMonthColIdx >= 0 && advLastMonthColIdx < strRow.length) {
        advanceLastMonth = parseNum(strRow[advLastMonthColIdx]);
      }
      if (dueThisMonthColIdx >= 0 && dueThisMonthColIdx < strRow.length) {
        dueThisMonth = parseNum(strRow[dueThisMonthColIdx]);
      }

      // Fallback if headers were not identified (e.g. raw copy-paste or template without headers)
      if (dueLastMonth === 0 && advanceLastMonth === 0 && dueThisMonth === 0) {
        let foundBdIdx = -1;
        for (let i = 0; i < strRow.length; i++) {
          if (strRow[i].replace(/\D/g, '') === detectedBd) {
            foundBdIdx = i;
            break;
          }
        }

        if (foundBdIdx >= 0) {
          const numericColsAfterBd: number[] = [];
          for (let i = foundBdIdx + 1; i < strRow.length; i++) {
            const val = strRow[i];
            if (val !== '' && val !== undefined) {
              const p = parseFloat(val.replace(/[^0-9.-]/g, ''));
              if (!isNaN(p)) {
                numericColsAfterBd.push(Math.abs(p));
              }
            }
          }

          if (numericColsAfterBd.length === 1) {
            // Single amount defaults to Due (This Month)
            dueThisMonth = numericColsAfterBd[0];
          } else if (numericColsAfterBd.length === 2) {
            // Due (Last Month), Due (This Month)
            dueLastMonth = numericColsAfterBd[0];
            dueThisMonth = numericColsAfterBd[1];
          } else if (numericColsAfterBd.length >= 3) {
            // Due (Last Month), Advance (Last Month), Due (This Month)
            dueLastMonth = numericColsAfterBd[0];
            advanceLastMonth = numericColsAfterBd[1];
            dueThisMonth = numericColsAfterBd[2];
          }
        }
      }

      // Calculate Net Total Due and Final Advance
      const totalDebits = dueLastMonth + dueThisMonth;
      const totalCredits = advanceLastMonth;

      let netDue = 0;
      let finalAdv = 0;

      if (totalDebits >= totalCredits) {
        netDue = totalDebits - totalCredits;
        finalAdv = 0;
      } else {
        netDue = 0;
        finalAdv = totalCredits - totalDebits;
      }

      const effectiveAmount = netDue > 0 ? netDue : (dueThisMonth > 0 ? dueThisMonth : dueLastMonth);

      result.push({
        id: `${detectedBd}_${targetMonth}`,
        rawBd: detectedBd,
        bdNo: detectedBd,
        targetMonth,
        lastMonth,
        dueLastMonth,
        advanceLastMonth,
        dueThisMonth,
        totalDue: netDue,
        finalAdvance: finalAdv,
        amount: effectiveAmount,
        member: matchedMember,
        currentDue,
        status: matchedMember ? 'matched' : 'unmatched'
      });
    }

    if (result.length === 0) {
      setErrorMessage('কোনো বৈধ ডাটা পাওয়া যায়নি। অনুগ্রহ করে ফাইল বা টেক্সটের ফরম্যাট চেক করুন।');
    } else {
      setParsedRows(result);
    }
  };

  // Handle Excel or CSV file upload
  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();

    const isBinary = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let sheetData: any[][] = [];

        if (isBinary) {
          const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        } else {
          const text = typeof data === 'string' ? data : new TextDecoder().decode(data as ArrayBuffer);
          sheetData = text
            .split('\n')
            .map((line) => line.split(/[,\t]/).map((s) => s.trim()))
            .filter((arr) => arr.length > 0 && arr.some((s) => s.length > 0));
        }

        processRawData(sheetData);
      } catch (err: any) {
        setErrorMessage(`ফাইল রিড করতে সমস্যা হয়েছে: ${err?.message || 'Unknown error'}`);
      }
    };

    if (isBinary) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  // Handle direct paste text parsing
  const handleParsePaste = () => {
    if (!pasteText.trim()) {
      setErrorMessage('অনুগ্রহ করে টেক্সট বা এক্সেল থেকে কপি করা লাইনগুলো পেস্ট করুন।');
      return;
    }

    const lines = pasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const rows: any[][] = lines.map((line) => {
      if (line.includes('\t')) return line.split('\t');
      if (line.includes(',')) return line.split(',');
      if (line.includes(';')) return line.split(';');
      return line.split(/\s+/);
    });

    processRawData(rows);
  };

  // Download Exact Requested Template with Month Names in Headers:
  // SL | BD No | Rank | Surname | Due (Last Month - MonthName) | Advance (Last Month - MonthName) | Due (This Month - MonthName)
  // No extra columns after that!
  const handleDownloadTemplate = () => {
    const lastMonthLabel = formatMonthName(lastMonth);
    const thisMonthLabel = formatMonthName(targetMonth);

    const templateData = members.map((m, idx) => ({
      'SL': idx + 1,
      'BD No': String(m['BD No'] || '').trim(),
      'Rank': String(m['Rank'] || '').trim(),
      'Surname': String(m['Surname'] || '').trim(),
      [`Due (Last Month - ${lastMonthLabel})`]: '',
      [`Advance (Last Month - ${lastMonthLabel})`]: '',
      [`Due (This Month - ${thisMonthLabel})`]: ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 12 },
      { wch: 22 },
      { wch: 32 },
      { wch: 34 },
      { wch: 32 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bills_Template');
    XLSX.writeFile(workbook, `Cafe_UAV_Bills_Template_${lastMonth}_${targetMonth}.xlsx`);
  };

  // Filter preview rows
  const filteredPreview = useMemo(() => {
    if (!searchPreview.trim()) return parsedRows;
    const term = searchPreview.toLowerCase();
    return parsedRows.filter((r) => {
      const bdMatch = r.bdNo.includes(term);
      const nameMatch = r.member ? String(r.member['Surname'] || '').toLowerCase().includes(term) : false;
      const rankMatch = r.member ? String(r.member['Rank'] || '').toLowerCase().includes(term) : false;
      return bdMatch || nameMatch || rankMatch;
    });
  }, [parsedRows, searchPreview]);

  // Statistics
  const stats = useMemo(() => {
    const total = parsedRows.length;
    const matched = parsedRows.filter((r) => r.status === 'matched').length;
    const unmatched = total - matched;
    const totalDueLastMonth = parsedRows.reduce((sum, r) => sum + (r.dueLastMonth || 0), 0);
    const totalAdvanceLastMonth = parsedRows.reduce((sum, r) => sum + (r.advanceLastMonth || 0), 0);
    const totalDueThisMonth = parsedRows.reduce((sum, r) => sum + (r.dueThisMonth || 0), 0);
    const totalNetDue = parsedRows.reduce((sum, r) => sum + (r.totalDue || 0), 0);

    return { total, matched, unmatched, totalDueLastMonth, totalAdvanceLastMonth, totalDueThisMonth, totalNetDue };
  }, [parsedRows]);

  // Filter history rows
  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return importHistory;
    const term = historySearch.toLowerCase();
    return importHistory.filter((b) => 
      b.displayDate.toLowerCase().includes(term) ||
      b.sourceName.toLowerCase().includes(term) ||
      b.mode.toLowerCase().includes(term) ||
      (b.targetMonth && b.targetMonth.toLowerCase().includes(term)) ||
      b.items.some((item) => item.bdNo.includes(term) || item.surname.toLowerCase().includes(term))
    );
  }, [importHistory, historySearch]);

  // Execute Batch Import with Cloud Persistence
  const handleExecuteImport = async () => {
    const matchedRows = parsedRows.filter((r) => r.status === 'matched' && r.member);
    if (matchedRows.length === 0) {
      setErrorMessage('ইম্পোর্ট করার জন্য কোনো ম্যাচিং সদস্য পাওয়া যায়নি!');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const updatedMembersMap = new Map<string, any>();
      members.forEach((m) => {
        const clean = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
        updatedMembersMap.set(clean, { ...m });
      });

      const newTxs: any[] = [];
      const newTxIds: (string | number)[] = [];
      const batchItems: BillImportBatchItem[] = [];

      for (const row of matchedRows) {
        const targetMember = updatedMembersMap.get(row.bdNo);
        if (!targetMember) continue;

        const oldDue = Number(targetMember.Due ?? targetMember.due ?? targetMember.baki ?? 0);
        const oldAdv = Number(targetMember.Advance ?? targetMember.advance ?? targetMember.ogrim ?? 0);

        const debits = row.dueLastMonth + row.dueThisMonth;
        const credits = row.advanceLastMonth;

        let finalDue = 0;
        let finalAdv = 0;

        if (importMode === 'SET') {
          if (debits >= credits) {
            finalDue = debits - credits;
            finalAdv = 0;
          } else {
            finalDue = 0;
            finalAdv = credits - debits;
          }
        } else {
          // ADD Mode
          const currentNet = oldDue - oldAdv;
          const netChange = debits - credits;
          const resultingNet = currentNet + netChange;
          if (resultingNet >= 0) {
            finalDue = resultingNet;
            finalAdv = 0;
          } else {
            finalDue = 0;
            finalAdv = Math.abs(resultingNet);
          }
        }

        targetMember.Due = finalDue;
        targetMember.due = finalDue;
        targetMember.baki = finalDue;
        targetMember.Advance = finalAdv;
        targetMember.advance = finalAdv;
        targetMember.ogrim = finalAdv;

        batchItems.push({
          airman_id: targetMember.airman_id,
          bdNo: row.bdNo,
          rank: targetMember['Rank'] || '',
          surname: targetMember['Surname'] || '',
          targetMonth,
          lastMonth,
          dueLastMonth: row.dueLastMonth,
          advanceLastMonth: row.advanceLastMonth,
          dueThisMonth: row.dueThisMonth,
          importedAmount: row.totalDue,
          resultingDue: finalDue
        });

        // Create transactions in canteen_txs
        if (createTransaction) {
          // 1. Due (Last Month) Transaction
          if (row.dueLastMonth > 0) {
            const txId = Date.now() + Math.random();
            newTxIds.push(txId);
            newTxs.push({
              id: txId,
              date: getDateForMonthKey(lastMonth, 28),
              airman_id: targetMember.airman_id,
              bdNo: targetMember['BD No'] || targetMember.bdNo,
              memberName: `${targetMember['Rank'] || ''} ${targetMember['Surname'] || ''}`.trim(),
              rank: targetMember['Rank'] || targetMember.rank || '',
              items: `বকেয়া বিল (${formatMonthName(lastMonth)})`,
              soldItems: [],
              amount: row.dueLastMonth,
              type: 'INITIAL_BILL',
              gateway: 'DUE',
              billType: 'CANTEEN'
            });
          }

          // 2. Advance (Last Month) Transaction
          if (row.advanceLastMonth > 0) {
            const txId = Date.now() + Math.random();
            newTxIds.push(txId);
            newTxs.push({
              id: txId,
              date: getDateForMonthKey(lastMonth, 25),
              airman_id: targetMember.airman_id,
              bdNo: targetMember['BD No'] || targetMember.bdNo,
              memberName: `${targetMember['Rank'] || ''} ${targetMember['Surname'] || ''}`.trim(),
              rank: targetMember['Rank'] || targetMember.rank || '',
              items: `অগ্রীম জমা / Advance (${formatMonthName(lastMonth)})`,
              soldItems: [],
              amount: row.advanceLastMonth,
              type: 'BILL PAYMENT',
              gateway: 'ADVANCE',
              billType: 'CANTEEN'
            });
          }

          // 3. Due (This Month) Transaction
          if (row.dueThisMonth > 0) {
            const txId = Date.now() + Math.random();
            newTxIds.push(txId);
            newTxs.push({
              id: txId,
              date: getDateForMonthKey(targetMonth, 28),
              airman_id: targetMember.airman_id,
              bdNo: targetMember['BD No'] || targetMember.bdNo,
              memberName: `${targetMember['Rank'] || ''} ${targetMember['Surname'] || ''}`.trim(),
              rank: targetMember['Rank'] || targetMember.rank || '',
              items: `ক্যান্টিন বিল (${formatMonthName(targetMonth)})`,
              soldItems: [],
              amount: row.dueThisMonth,
              type: 'INITIAL_BILL',
              gateway: 'DUE',
              billType: 'CANTEEN'
            });
          }
        }
      }

      // Update Supabase Canteen_Member table in parallel chunks of 15
      for (let i = 0; i < matchedRows.length; i += 15) {
        const chunk = matchedRows.slice(i, i + 15);
        await Promise.all(
          chunk.map((row) => {
            const targetMember = updatedMembersMap.get(row.bdNo);
            if (!targetMember) return Promise.resolve();
            return supabase
              .from('Canteen_Member')
              .update({ Due: targetMember.Due })
              .eq('airman_id', targetMember.airman_id);
          })
        );
      }

      // Save transactions to Cloud (canteen_txs)
      if (newTxs.length > 0) {
        try {
          const existingTxs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
          const mergedTxs = [...newTxs, ...existingTxs];
          localStorage.setItem('canteen_txs', JSON.stringify(mergedTxs));
          await pushKeyToCloud('canteen_txs', mergedTxs);
        } catch (e) {
          console.warn('Failed to append initial bill transactions to cloud:', e);
        }
      }

      // Save History Batch
      const newBatch: BillImportBatch = {
        id: `BATCH-${Date.now()}`,
        timestamp: new Date().toISOString(),
        displayDate: new Date().toLocaleString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        sourceName: activeTab === 'FILE' ? (fileName || 'Excel/CSV File') : 'Direct Copy-Paste',
        targetMonth,
        lastMonth,
        mode: importMode,
        totalMembers: matchedRows.length,
        totalAmount: stats.totalNetDue,
        createdTransactionIds: newTxIds,
        items: batchItems
      };

      const updatedHistory = [newBatch, ...importHistory];
      setImportHistory(updatedHistory);
      try {
        localStorage.setItem('canteen_bill_import_history', JSON.stringify(updatedHistory));
        await pushKeyToCloud('canteen_bill_import_history', updatedHistory);
      } catch (e) {
        console.warn('Failed saving import history:', e);
      }

      // Update Local Cache & Dispatch Global Events
      const updatedMembersList = Array.from(updatedMembersMap.values());
      try {
        localStorage.setItem('canteen_members_cache', JSON.stringify(updatedMembersList));
      } catch {}

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      onSuccess(updatedMembersList);

      setSuccessMessage(
        `সফলভাবে ${matchedRows.length} জন সদস্যের (${formatMonthName(lastMonth)} ও ${formatMonthName(targetMonth)}) বকেয়া ও অগ্রীম বিল আপডেট করা হয়েছে!`
      );

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(`ইম্পোর্ট ব্যর্থ হয়েছে: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Rollback / Remove an Import Batch
  const handleRollbackBatch = async (batch: BillImportBatch, revertDues = true) => {
    setIsRollingBack(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (revertDues) {
        // 1. Revert each member's Due back to previousDue in Supabase
        const updatedMembersMap = new Map<string, any>();
        members.forEach((m) => {
          const clean = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
          updatedMembersMap.set(clean, { ...m });
        });

        const updatePromises = batch.items.map(async (item) => {
          const member = updatedMembersMap.get(item.bdNo);
          if (member) {
            member.Due = item.resultingDue - item.importedAmount; // Or revert
          }
          return supabase
            .from('Canteen_Member')
            .update({ Due: Math.max(0, (member?.Due || 0)) })
            .eq('airman_id', item.airman_id);
        });

        await Promise.all(updatePromises);

        // 2. Remove associated transactions if any
        if (batch.createdTransactionIds && batch.createdTransactionIds.length > 0) {
          try {
            const rawTxs = localStorage.getItem('canteen_txs');
            if (rawTxs) {
              const txs = JSON.parse(rawTxs);
              const txIdSet = new Set(batch.createdTransactionIds.map(String));
              const filteredTxs = txs.filter((t: any) => !txIdSet.has(String(t.id)));
              localStorage.setItem('canteen_txs', JSON.stringify(filteredTxs));
              await pushKeyToCloud('canteen_txs', filteredTxs);
            }
          } catch (e) {
            console.warn('Failed removing txs on rollback:', e);
          }
        }

        const updatedList = Array.from(updatedMembersMap.values());
        try {
          localStorage.setItem('canteen_members_cache', JSON.stringify(updatedList));
        } catch {}

        onSuccess(updatedList);
      }

      // 4. Remove batch from history
      const nextHistory = importHistory.filter((b) => b.id !== batch.id);
      setImportHistory(nextHistory);
      try {
        localStorage.setItem('canteen_bill_import_history', JSON.stringify(nextHistory));
        await pushKeyToCloud('canteen_bill_import_history', nextHistory);
      } catch (e) {
        console.warn('Failed updating import history:', e);
      }

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      setRollbackBatch(null);
      setSuccessMessage(
        revertDues
          ? `ইম্পোর্ট ব্যাচ (${batch.displayDate}) সফলভাবে রিমুভ ও সদস্যদের বকেয়া রিভার্স করা হয়েছে!`
          : `ইম্পোর্ট হিস্টোরি রেকর্ড সফলভাবে মুছে ফেলা হয়েছে!`
      );
    } catch (err: any) {
      setErrorMessage(`রিভার্স ব্যর্থ হয়েছে: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsRollingBack(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[80] flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200 relative">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                BULK IMPORT BILLS
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {formatShortMonth(targetMonth)}
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-bold">
                Due (Last Month), Advance (Last Month) ও Due (This Month) ফরম্যাটে বিল ইম্পোর্ট
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="hidden sm:flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer shadow-sm"
              title="Download Excel Template in requested format"
            >
              <Download className="w-4 h-4 text-indigo-400" />
              <span>Download Template (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Target Month Selector Banner */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">
                  টার্গেট বিলের মাস (Target Month)
                </span>
                <p className="text-xs text-slate-300 font-bold">
                  যেই মাস সিলেক্ট করবেন, টেমপ্লেটে সেই মাসের এবং তার আগের মাসের হিসাব আসবে
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <select
                value={targetMonth}
                onChange={(e) => setTargetMonth(e.target.value)}
                className="bg-slate-900 border border-slate-700 hover:border-indigo-500/50 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[200px]"
              >
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthName(m)} {m === getRunningMonthKey() ? '(চলতি মাস)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Explanation Strip */}
          <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-2xl flex items-start space-x-2.5 text-xs text-indigo-200">
            <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong>টেমপ্লেট কলাম বিন্যাস:</strong> নির্বাচিত মাস <strong>{formatMonthName(targetMonth)}</strong> এর জন্য এক্সেল ফাইলে থাকবে: <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300">Due (Last Month) [{formatShortMonth(lastMonth)}]</code>, <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-300">Advance (Last Month) [{formatShortMonth(lastMonth)}]</code> এবং <code className="bg-slate-900 px-1.5 py-0.5 rounded text-sky-300">Due (This Month) [{formatShortMonth(targetMonth)}]</code>। এরপরে কোনো বাড়তি কলাম থাকবে না।
            </div>
          </div>

          {/* Success or Error Alerts */}
          {successMessage && (
            <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl flex items-center space-x-3 text-emerald-200 text-xs font-bold animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-4 bg-rose-950/60 border border-rose-500/40 rounded-2xl flex items-center space-x-3 text-rose-200 text-xs font-bold animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Tab Switcher: Upload File, Direct Paste, and Import History */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center space-x-2 flex-wrap gap-y-2">
              <button
                type="button"
                onClick={() => setActiveTab('FILE')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'FILE'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Excel / CSV</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('PASTE')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'PASTE'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>Direct Copy-Paste</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'HISTORY'
                    ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5 text-amber-400" />
                <span>Import History</span>
                {importHistory.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-slate-900 text-amber-300 rounded-full text-[10px] font-mono border border-amber-500/30">
                    {importHistory.length}
                  </span>
                )}
              </button>
            </div>

            {/* Mobile Template Download Button */}
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="sm:hidden flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-xl text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Template</span>
            </button>
          </div>

          {/* TAB 1: File Upload */}
          {activeTab === 'FILE' && (
            <div className="space-y-3">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-indigo-500/60 rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all bg-slate-950/40 hover:bg-slate-950/70 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(f);
                  }}
                />
                <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="text-sm font-black text-white">
                  {fileName ? `নির্বাচিত ফাইল: ${fileName}` : 'এক্সেল (.xlsx, .xls) অথবা CSV ফাইল সিলেক্ট করতে ক্লিক করুন'}
                </p>
                <p className="text-xs text-slate-400 mt-1 font-bold">
                  বা ফাইলটি ড্র্যাগ করে এখানে এনে ছেড়ে দিন
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: Direct Copy-Paste */}
          {activeTab === 'PASTE' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Excel বা টেক্সট থেকে কপি করা লাইনগুলো নিচে পেস্ট করুন (BD No, Due Last Month, Advance Last Month, Due This Month):
                </label>
                <textarea
                  rows={5}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={`উদাহরণ:\n464358  500  100  850\n470696  1200  0   400\n465170  0    200  950\n(কলাম বা ট্যাব আলাদা হলেও কাজ করবে)`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-600"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParsePaste}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 cursor-pointer shadow-md"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Parse & Preview</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Import History & Rollback */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-400" />
                    <span>ইম্পোর্ট হিস্টোরি ও রিভার্স (Import History & Rollback)</span>
                  </h4>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    যেকোনো পূর্ববর্তী ভুল ইম্পোর্ট এক ক্লিকে সম্পূর্ণ রিভার্স করে আগের বকেয়া ফিরিয়ে আনা যাবে।
                  </p>
                </div>

                {importHistory.length > 0 && (
                  <div className="relative w-full sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search history..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {importHistory.length === 0 ? (
                <div className="border border-slate-800/80 rounded-2xl p-10 text-center space-y-3 bg-slate-950/30">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-500 flex items-center justify-center mx-auto">
                    <History className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-black text-slate-300">কোনো ইম্পোর্ট হিস্টোরি পাওয়া যায়নি</h4>
                  <p className="text-xs text-slate-500 font-bold max-w-md mx-auto">
                    নতুন কোনো এক্সেল ফাইল বা টেক্সট ইম্পোর্ট সম্পন্ন করলে তার সম্পূর্ণ রেকর্ড স্বয়ংক্রিয়ভাবে এখানে সংরক্ষিত থাকবে।
                  </p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-bold bg-slate-950/30 rounded-2xl border border-slate-800">
                  সার্চে কোনো হিস্টোরি ম্যাচ করেনি।
                </div>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredHistory.map((batch) => {
                    const isExpanded = expandedBatchId === batch.id;
                    return (
                      <div
                        key={batch.id}
                        className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden transition-all shadow-sm"
                      >
                        {/* Batch Header Bar */}
                        <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                              <FileSpreadsheet className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                <h5 className="text-xs font-black text-white truncate">
                                  {batch.sourceName}
                                </h5>
                                {batch.targetMonth && (
                                  <span className="text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/30">
                                    {batch.targetMonth}
                                  </span>
                                )}
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                  batch.mode === 'SET'
                                    ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                }`}>
                                  {batch.mode === 'SET' ? 'বকেয়া প্রতিস্থাপন (SET)' : 'বকেয়া যোগ (ADD)'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5 font-bold">
                                {batch.displayDate} • {batch.totalMembers} Members • Total: ৳{batch.totalAmount.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
                            <button
                              type="button"
                              onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer border border-slate-700"
                            >
                              <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => setRollbackBatch(batch)}
                              className="px-3 py-1.5 bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 border border-rose-500/30 transition-all cursor-pointer"
                              title="Rollback & Remove this import batch"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Rollback</span>
                            </button>
                          </div>
                        </div>

                        {/* Expanded Member Details Table */}
                        {isExpanded && (
                          <div className="border-t border-slate-800/80 bg-slate-900/60 p-4 animate-in fade-in duration-200">
                            <h6 className="text-[11px] font-black text-indigo-400 uppercase tracking-wider mb-2">
                              এই ব্যাচে অন্তর্ভুক্ত সদস্যদের তালিকা ({batch.items.length}):
                            </h6>
                            <div className="border border-slate-800 rounded-xl overflow-hidden max-h-48 overflow-y-auto overflow-x-auto">
                              <table className="w-full text-left text-xs text-slate-300 min-w-[540px]">
                                <thead className="bg-slate-950 text-slate-400 text-[10px] font-black uppercase tracking-wider sticky top-0 border-b border-slate-800">
                                  <tr>
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">BD No</th>
                                    <th className="px-3 py-2">Member</th>
                                    <th className="px-3 py-2 text-right font-mono">Due (Last Month)</th>
                                    <th className="px-3 py-2 text-right font-mono">Adv (Last Month)</th>
                                    <th className="px-3 py-2 text-right font-mono">Due (This Month)</th>
                                    <th className="px-3 py-2 text-right font-mono">Resulting Due</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-sans">
                                  {batch.items.map((item, i) => (
                                    <tr key={i} className="hover:bg-slate-800/30">
                                      <td className="px-3 py-1.5 text-slate-500 font-mono">{i + 1}</td>
                                      <td className="px-3 py-1.5 font-mono font-bold text-white">#{item.bdNo}</td>
                                      <td className="px-3 py-1.5 font-bold text-slate-200">
                                        {item.rank} {item.surname}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-mono text-amber-400">
                                        ৳{item.dueLastMonth || 0}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-mono text-emerald-400">
                                        ৳{item.advanceLastMonth || 0}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-mono text-sky-400">
                                        ৳{item.dueThisMonth || 0}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-mono font-black text-rose-400">
                                        ৳{item.resultingDue}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Import Modes & Settings (Show on FILE or PASTE tab after rows parsed) */}
          {activeTab !== 'HISTORY' && parsedRows.length > 0 && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-400" />
                    <span>ইম্পোর্ট অপশন (Import Settings)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 font-bold">
                    নতুন বিলটি কিভাবে সেভ করতে চান তা নির্ধারণ করুন
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('SET')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      importMode === 'SET'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    বকেয়া প্রতিস্থাপন (Set Total Due)
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('ADD')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      importMode === 'ADD'
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    বকেয়া যোগ করুন (Add to Due)
                  </button>
                </div>
              </div>

              {/* Transaction record toggle */}
              <label className="flex items-center space-x-2.5 cursor-pointer text-xs font-bold text-slate-300">
                <input
                  type="checkbox"
                  checked={createTransaction}
                  onChange={(e) => setCreateTransaction(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                />
                <span>
                  সদস্যের সংশ্লিষ্ট মাসের মাসিক স্টেটমেন্টে বকেয়া/অগ্রীম রেকর্ড যুক্ত করুন (Create Monthly Transaction Records)
                </span>
              </label>

              {/* Statistics Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Parsed</span>
                  <span className="text-base sm:text-lg font-black text-white font-mono">{stats.total}</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block">Matched</span>
                  <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">{stats.matched}</span>
                </div>
                <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block truncate">
                    Due ({formatShortMonth(lastMonth)})
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-300 font-mono">৳{stats.totalDueLastMonth.toLocaleString()}</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block truncate">
                    Adv ({formatShortMonth(lastMonth)})
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-300 font-mono">৳{stats.totalAdvanceLastMonth.toLocaleString()}</span>
                </div>
                <div className="bg-sky-950/30 border border-sky-500/20 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider block truncate">
                    Due ({formatShortMonth(targetMonth)})
                  </span>
                  <span className="text-base sm:text-lg font-black text-sky-300 font-mono">৳{stats.totalDueThisMonth.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Preview Table (On FILE or PASTE tab after rows parsed) */}
          {activeTab !== 'HISTORY' && parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    ডাটা প্রিভিউ ({filteredPreview.length} / {parsedRows.length})
                  </h4>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by BD No, Rank, Name..."
                    value={searchPreview}
                    onChange={(e) => setSearchPreview(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="border border-slate-800 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-black text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2.5">#</th>
                      <th className="px-3 py-2.5">BD No</th>
                      <th className="px-3 py-2.5">Member</th>
                      <th className="px-3 py-2.5 text-right font-mono">
                        Due (Last Month)
                        <span className="block text-[10px] text-amber-300 font-sans font-black">{formatMonthName(lastMonth)}</span>
                      </th>
                      <th className="px-3 py-2.5 text-right font-mono">
                        Advance (Last Month)
                        <span className="block text-[10px] text-emerald-300 font-sans font-black">{formatMonthName(lastMonth)}</span>
                      </th>
                      <th className="px-3 py-2.5 text-right font-mono">
                        Due (This Month)
                        <span className="block text-[10px] text-sky-300 font-sans font-black">{formatMonthName(targetMonth)}</span>
                      </th>
                      <th className="px-3 py-2.5 text-right font-mono">সর্বমোট বকেয়া (Total Due)</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredPreview.map((row, idx) => {
                      const resultingDue = importMode === 'SET'
                        ? row.totalDue
                        : (row.currentDue + row.totalDue);

                      return (
                        <tr key={row.id || idx} className="hover:bg-slate-800/40">
                          <td className="px-3 py-2 text-slate-500 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2 font-mono font-bold text-white">#{row.bdNo}</td>
                          <td className="px-3 py-2">
                            {row.member ? (
                              <span className="font-bold text-white">
                                {row.member['Rank']} {row.member['Surname']}
                              </span>
                            ) : (
                              <span className="text-amber-400 font-bold italic">সদস্য পাওয়া যায়নি</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-amber-300">
                            ৳{row.dueLastMonth || 0}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-emerald-400">
                            ৳{row.advanceLastMonth || 0}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-sky-300">
                            ৳{row.dueThisMonth || 0}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-black text-rose-300">
                            <span className="px-2 py-0.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200">
                              ৳{resultingDue}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.status === 'matched' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Check className="w-3 h-3 mr-1" />
                                Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Not Found
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-black uppercase transition-all cursor-pointer"
          >
            Close
          </button>

          {activeTab !== 'HISTORY' && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={isProcessing || stats.matched === 0}
                onClick={handleExecuteImport}
                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center space-x-2 shadow-lg cursor-pointer ${
                  isProcessing || stats.matched === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-500/25 active:translate-y-0.5'
                }`}
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Updating Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Import ({stats.matched} Members)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Rollback / Remove Confirmation Dialog */}
        {rollbackBatch && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-[90] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 space-y-4">
              <div className="flex items-start space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    REMOVE & ROLLBACK IMPORT BATCH?
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    ইম্পোর্ট হিস্টোরি ও বকেয়া রিভার্স নিশ্চিতকরণ
                  </p>
                </div>
              </div>

              {/* Batch Info Card */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-xs space-y-1.5 font-bold">
                <div className="flex justify-between text-slate-400">
                  <span>তারিখ ও সময়:</span>
                  <span className="text-white font-mono">{rollbackBatch.displayDate}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>ফাইল / উৎস:</span>
                  <span className="text-white truncate max-w-[200px]">{rollbackBatch.sourceName}</span>
                </div>
                {rollbackBatch.targetMonth && (
                  <div className="flex justify-between text-slate-400">
                    <span>বিলের মাস:</span>
                    <span className="text-indigo-400 font-mono">
                      {rollbackBatch.lastMonth ? `${formatShortMonth(rollbackBatch.lastMonth)} & ` : ''}
                      {formatShortMonth(rollbackBatch.targetMonth)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>মোট সদস্য:</span>
                  <span className="text-amber-400 font-mono">{rollbackBatch.totalMembers} জন</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>মোট টাকার পরিমাণ:</span>
                  <span className="text-emerald-400 font-mono">৳{rollbackBatch.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-200 text-xs font-bold leading-relaxed">
                ⚠️ <strong>মনোযোগ দিন:</strong> 'Revert Dues & Remove' চাপলে এই ব্যাচে অন্তর্ভুক্ত সকল সদস্যের বকেয়া এই ইম্পোর্টের পূর্বের অবস্থায় স্বয়ংক্রিয়ভাবে ফিরে যাবে এবং সংশ্লিষ্ট ট্রানজেকশন মুছে যাবে।
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={isRollingBack}
                  onClick={() => setRollbackBatch(null)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={isRollingBack}
                  onClick={() => handleRollbackBatch(rollbackBatch, false)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-700"
                  title="Delete history log only without changing dues"
                >
                  Delete Log Only
                </button>

                <button
                  type="button"
                  disabled={isRollingBack}
                  onClick={() => handleRollbackBatch(rollbackBatch, true)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer"
                >
                  {isRollingBack ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Reverting Database...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Revert Dues & Remove</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

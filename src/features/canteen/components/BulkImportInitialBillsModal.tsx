import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
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
  Info,
  ArrowLeftRight
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { pushKeyToCloud, pullKeyFromCloud, recordDeletedTxId } from '../utils/canteenCloudSync';
import { formatCanteenDate } from '../utils/dateUtils';
import { sortCanteenMembersByOfficeSeniority } from '../utils/canteenSeniority';
import { formatBengaliMonthYear, getPaymentCycleMonthKey } from '../utils/exportCanteenBillExcel';
import { getTxMonthKey, getTxEffectiveMonth } from '../pages/MemberDB';
import { deduplicateCanteenTransactions, getFormattedDateForMonth } from '../utils/importHistoryTxs';
import JSZip from 'jszip';

export const getMonthShortName = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') {
    return new Date().toLocaleDateString('en-US', { month: 'short' });
  }
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short' });
};

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

export const getMonthOnlyName = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'long' });
  }
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long' });
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
  advanceMonth?: string;
  dueLastMonth: number;
  advanceLastMonth: number;
  dueThisMonth: number;
  unitFund?: number;
  othersFund?: number;
  importedAmount: number;
  resultingDue: number;
  previousDue?: number;
  previousAdvance?: number;
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
  allTxs?: any[];
}

export interface ParsedBillRow {
  id: string;
  sl?: number;
  rawBd: string;
  bdNo: string;
  targetMonth: string;      // This Month (e.g. 2026-10 or 2026-09)
  lastMonth: string;        // Last Month (e.g. 2026-09 or 2026-08)
  advanceMonth?: string;    // Advance month
  dueLastMonth: number;     // Due (Last Month)
  advanceLastMonth: number; // Advance (Last Month)
  dueThisMonth: number;     // Due (This Month)
  unitFund: number;         // Unit Fund
  othersFund: number;       // Others
  totalDue: number;         // Resulting net due
  finalAdvance: number;     // Resulting net advance
  amount: number;
  member: any | null;
  currentDue: number;
  status: 'matched' | 'unmatched';
  rank?: string;
  surname?: string;
  isValid?: boolean;
}

export const BulkImportInitialBillsModal: React.FC<BulkImportInitialBillsModalProps> = ({
  isOpen,
  onClose,
  members,
  onSuccess,
  selectedMonth = 'ALL',
  initialTab = 'FILE',
  allTxs = []
}) => {
  const [activeTab, setActiveTab] = useState<'FILE' | 'PASTE' | 'HISTORY'>(initialTab);
  const [targetMonth, setTargetMonth] = useState<string>(() => {
    // Default import month is ALWAYS the month prior to the current running month (e.g. Sep if running month is Oct)
    return formatPrevMonthKey(getRunningMonthKey());
  });

  const lastMonth = useMemo(() => formatPrevMonthKey(targetMonth), [targetMonth]);

  const effectiveTxs = useMemo(() => {
    if (allTxs && allTxs.length > 0) return allTxs;
    try {
      return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    } catch {
      return [];
    }
  }, [allTxs]);

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

  // Default import month is ALWAYS running month's previous month (e.g. Sep if running month is Oct)
  useEffect(() => {
    if (isOpen) {
      setTargetMonth(formatPrevMonthKey(getRunningMonthKey()));
    }
  }, [isOpen]);

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
  const [isResettingAll, setIsResettingAll] = useState<boolean>(false);
  const [showResetAllConfirm, setShowResetAllConfirm] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawDataRef = useRef<any[][] | null>(null);

  // Sync initialTab when modal opens or prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  // Load cloud history on mount or when modal opens
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

  // Build member lookup maps by cleaned BD No, raw BD, airman_id, Rank + Surname, and Surname
  const { memberMap, memberByNameMap } = useMemo(() => {
    const map = new Map<string, any>();
    const nameMap = new Map<string, any>();

    members.forEach((m) => {
      const rawBd = String(m['BD No'] || m.bdNo || '').trim();
      const cleanBd = rawBd.replace(/\D/g, '');
      const airmanId = String(m.airman_id || '').trim();
      const cleanAirmanId = airmanId.replace(/\D/g, '');

      if (cleanBd) map.set(cleanBd, m);
      if (rawBd) map.set(rawBd.toLowerCase(), m);
      if (cleanAirmanId) map.set(cleanAirmanId, m);
      if (airmanId) map.set(airmanId.toLowerCase(), m);

      if (cleanBd) {
        map.set(`bd/${cleanBd}`, m);
        map.set(`bd-${cleanBd}`, m);
        map.set(`bd ${cleanBd}`, m);
      }

      const surname = String(m['Surname'] || m.surname || m['Full Name'] || m.name || '').trim().toLowerCase();
      const rank = String(m['Rank'] || m.rank || '').trim().toLowerCase();
      if (surname) {
        nameMap.set(surname, m);
        if (rank) {
          nameMap.set(`${rank} ${surname}`, m);
          nameMap.set(`${rank}-${surname}`, m);
        }
      }
    });

    return { memberMap: map, memberByNameMap: nameMap };
  }, [members]);

  // Month Names Map for Smart Freeform Parsing
  const SMART_MONTH_MAP: Record<string, string> = {
    jan: '01', january: '01', januray: '01', জানু: '01', জানুয়ারি: '01',
    feb: '02', february: '02', ফেব: '02', ফেব্রুয়ারি: '02',
    mar: '03', march: '03', মার্চ: '03',
    apr: '04', april: '04', এপ্রিল: '04',
    may: '05', মে: '05',
    jun: '06', june: '06', জুন: '06',
    jul: '07', july: '07', জুলাই: '07',
    aug: '08', august: '08', আগস্ট: '08', অগাস্ট: '08',
    sep: '09', sept: '09', september: '09', সেপ্টে: '09', সেপ্টেম্বর: '09',
    oct: '10', october: '10', অক্টো: '10', অক্টোবর: '10',
    nov: '11', november: '11', নভে: '11', নভেম্বর: '11',
    dec: '12', december: '12', ডিসে: '12', ডিসেম্বর: '12',
  };

  const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Intelligent parser for Free-form / Note format:
  // e.g.:
  // Aug
  // Sgt Rubel    115 Advance
  // Sgt Absar    230 Due
  // Sep
  // Sgt Asad     450 Due
  const parseSmartFreeformText = (text: string, defaultTargetMonth: string): ParsedBillRow[] | null => {
    if (!text || !text.trim()) return null;

    const rawLines = text.split('\n').map((l) => l.trim());
    let currentTargetMonth = defaultTargetMonth || formatPrevMonthKey(getRunningMonthKey());
    let currentLastMonth = formatPrevMonthKey(currentTargetMonth);
    let currentYear = parseInt(currentTargetMonth.split('-')[0], 10) || new Date().getFullYear();

    const parsedResults: ParsedBillRow[] = [];

    const detectMonthHeading = (line: string): string | null => {
      const clean = line.replace(/^[#\-*:=\s\[]+|[#\-*:=\s\]]+$/g, '').trim().toLowerCase();
      const stripped = clean.replace(/\b(month|billing|bill|মাস)\b/gi, '').trim();
      const tokens = stripped.split(/[\s,/:—-]+/).filter(Boolean);
      if (tokens.length === 0 || tokens.length > 4) return null;

      for (const t of tokens) {
        if (SMART_MONTH_MAP[t]) {
          const mNum = SMART_MONTH_MAP[t];
          let yr = currentYear;
          for (const other of tokens) {
            if (other !== t) {
              const num = parseInt(other, 10);
              if (num >= 2020 && num <= 2035) yr = num;
              else if (num >= 20 && num <= 35) yr = 2000 + num;
            }
          }
          return `${yr}-${mNum}`;
        }
      }

      const numMatch = clean.match(/\b(202[0-9])[-/](0?[1-9]|1[0-2])\b/) || clean.match(/\b(0?[1-9]|1[0-2])[-/](202[0-9])\b/);
      if (numMatch) {
        if (numMatch[1].length === 4) return `${numMatch[1]}-${numMatch[2].padStart(2, '0')}`;
        return `${numMatch[2]}-${numMatch[1].padStart(2, '0')}`;
      }
      return null;
    };

    const matchMemberInLine = (line: string): { member: any; matchedSubstr: string } | null => {
      const lower = line.toLowerCase();

      // 1. Check BD No in line
      const bdMatches = line.match(/\b(?:bd[/\s-]*)?(\d{5,7})\b/gi);
      if (bdMatches) {
        for (const rawMatch of bdMatches) {
          const digits = rawMatch.replace(/\D/g, '');
          const found = memberMap.get(digits) || memberMap.get(`bd/${digits}`);
          if (found) {
            return { member: found, matchedSubstr: rawMatch };
          }
        }
      }

      // 2. Rank + Surname match
      for (const m of members) {
        const rank = String(m['Rank'] || m.rank || '').trim().toLowerCase();
        const surname = String(m['Surname'] || m.surname || '').trim().toLowerCase();
        if (rank && surname) {
          const full = `${rank} ${surname}`;
          const rx = new RegExp(`(^|[^a-zA-Z0-9])${escapeRegex(full)}([^a-zA-Z0-9]|$)`, 'i');
          if (rx.test(lower)) {
            return { member: m, matchedSubstr: `${m['Rank']} ${m['Surname']}` };
          }
        }
      }

      // 3. Surname match
      for (const m of members) {
        const surname = String(m['Surname'] || m.surname || '').trim().toLowerCase();
        if (surname && surname.length >= 3) {
          const rx = new RegExp(`(^|[^a-zA-Z0-9])${escapeRegex(surname)}([^a-zA-Z0-9]|$)`, 'i');
          if (rx.test(lower)) {
            return { member: m, matchedSubstr: m['Surname'] || m.surname };
          }
        }
      }

      // 4. Bangla Name match
      for (const m of members) {
        const bn = (m.nameBn || m['Name (Bangla)'] || '').trim().toLowerCase();
        if (bn && bn.length >= 2 && lower.includes(bn)) {
          return { member: m, matchedSubstr: bn };
        }
      }

      return null;
    };

    let slCounter = 1;

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      if (!line) continue;

      const detectedMonth = detectMonthHeading(line);
      if (detectedMonth) {
        currentTargetMonth = detectedMonth;
        currentLastMonth = formatPrevMonthKey(currentTargetMonth);
        currentYear = parseInt(currentTargetMonth.split('-')[0], 10) || currentYear;
        continue;
      }

      const memberMatch = matchMemberInLine(line);
      if (!memberMatch) {
        continue;
      }

      const matchedMember = memberMatch.member;
      const detectedBd = String(matchedMember['BD No'] || matchedMember.bdNo || matchedMember.airman_id || `MEMBER_${slCounter}`).replace(/\D/g, '');

      const enDigitLine = line.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
      const lineWithoutMember = enDigitLine.replace(new RegExp(escapeRegex(memberMatch.matchedSubstr), 'gi'), ' ');

      let dueLastMonth = 0;
      let advanceLastMonth = 0;
      let dueThisMonth = 0;
      let unitFund = 0;
      let othersFund = 0;

      const numMatches = Array.from(lineWithoutMember.matchAll(/(?:৳|tk|amount[:\s]*)?([0-9]+(?:\.[0-9]+)?)/gi));
      const amounts = numMatches.map((m) => parseFloat(m[1])).filter((n) => !isNaN(n));

      const lowerRem = lineWithoutMember.toLowerCase();

      const isAdvance = /\b(advance|adv|advan|অগ্রিম|অগ্রীম|cr|credit)\b/i.test(lowerRem) || lowerRem.includes('(-)');
      const isDue = /\b(due|baki|bill|বকেয়া|বিল|debit|dr)\b/i.test(lowerRem);
      const isPrev = /\b(last|prev|previous|আগের|পূর্ব)\b/i.test(lowerRem);
      const isUnitFund = /\b(unit\s*fund|uf|ইউনিট\s*ফান্ড)\b/i.test(lowerRem);
      const isOthers = /\b(others?|অন্যান্য)\b/i.test(lowerRem);

      let advanceMonth = currentLastMonth;
      if (amounts.length === 1) {
        const amt = amounts[0];
        if (isAdvance) {
          advanceLastMonth = amt;
          // When a single advance is listed under a month heading (e.g. "Aug Sgt Rubel 115 Advance"),
          // unless 'last'/'prev' keyword is explicitly mentioned, the advance belongs to currentTargetMonth!
          advanceMonth = isPrev ? currentLastMonth : currentTargetMonth;
        } else if (isUnitFund) {
          unitFund = amt;
        } else if (isOthers) {
          othersFund = amt;
        } else if (isPrev) {
          dueLastMonth = amt;
        } else {
          dueThisMonth = amt;
        }
      } else if (amounts.length >= 2) {
        if (amounts.length >= 3) {
          dueLastMonth = amounts[0];
          advanceLastMonth = amounts[1];
          advanceMonth = currentLastMonth;
          dueThisMonth = amounts[2];
          if (amounts.length >= 4) unitFund = amounts[3];
          if (amounts.length >= 5) othersFund = amounts[4];
        } else if (amounts.length === 2) {
          if (isAdvance && isDue) {
            dueThisMonth = amounts[0];
            advanceLastMonth = amounts[1];
            advanceMonth = currentLastMonth;
          } else {
            dueLastMonth = amounts[0];
            dueThisMonth = amounts[1];
          }
        }
      }

      const currentDue = Number(matchedMember.Due ?? matchedMember.due ?? matchedMember.baki ?? 0);
      const debits = dueLastMonth + dueThisMonth + unitFund + othersFund;
      const credits = advanceLastMonth;

      let netDue = 0;
      let finalAdv = 0;
      if (debits >= credits) {
        netDue = debits - credits;
        finalAdv = 0;
      } else {
        netDue = 0;
        finalAdv = credits - debits;
      }

      const effectiveAmount = netDue > 0
        ? netDue
        : (dueThisMonth + unitFund + othersFund > 0
            ? dueThisMonth + unitFund + othersFund
            : (dueLastMonth > 0 ? dueLastMonth : advanceLastMonth));

      parsedResults.push({
        id: `${detectedBd}_${currentTargetMonth}_${slCounter}`,
        sl: slCounter++,
        rawBd: detectedBd,
        bdNo: detectedBd,
        targetMonth: currentTargetMonth,
        lastMonth: currentLastMonth,
        advanceMonth,
        dueLastMonth,
        advanceLastMonth,
        dueThisMonth,
        unitFund,
        othersFund,
        totalDue: netDue,
        finalAdvance: finalAdv,
        amount: effectiveAmount,
        member: matchedMember,
        surname: matchedMember['Surname'] || matchedMember.surname || '',
        rank: matchedMember['Rank'] || matchedMember.rank || '',
        currentDue,
        status: 'matched',
        isValid: true
      });
    }

    return parsedResults.length > 0 ? parsedResults : null;
  };

  // Parse raw matrix / text data into structured rows:
  // Format: SL | BD No | Rank | Surname | Due (Last Month) | Advance (Last Month) | Due (This Month)
  const processRawData = (rows: any[][], overrideTargetMonth?: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!Array.isArray(rows) || rows.length === 0) {
      setErrorMessage('কোনো ডাটা পাওয়া যায়নি।');
      return;
    }

    const parseNum = (val: any): number => {
      if (val === null || val === undefined || val === '') return 0;
      const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? 0 : Math.abs(parsed);
    };

    // 1. Detect Header Row and Column Indexes
    let headerRowIdx = -1;
    let slColIdx = -1;
    let bdColIdx = -1;
    let rankColIdx = -1;
    let surnameColIdx = -1;
    let dueLastMonthColIdx = -1;
    let advLastMonthColIdx = -1;
    let dueThisMonthColIdx = -1;
    let unitFundColIdx = -1;
    let othersFundColIdx = -1;
    let fallbackAmountColIdx = -1;

    let detectedMonthFromHeader: string | null = null;

    const monthMap: Record<string, string> = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };

    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const lowerCells = row.map((c) => String(c ?? '').replace(/\r?\n/g, ' ').trim().toLowerCase());

      const hasBd = lowerCells.some((c) => c.includes('bd') || c.includes('airman') || c.includes('বিডি'));
      const hasBillOrDue = lowerCells.some(
        (c) => c.includes('due') || c.includes('bill') || c.includes('adv') || c.includes('বকেয়া') || c.includes('অগ্রীম') || c.includes('টাকা') || c.includes('fund')
      );
      const hasName = lowerCells.some((c) => c.includes('name') || c.includes('surname') || c.includes('rank') || c.includes('নাম'));

      if (hasBd || (hasBillOrDue && (hasName || lowerCells.some((c) => c === 'sl' || c === 'ser' || c === '#')))) {
        headerRowIdx = r;
        const dueCols: number[] = [];
        const advCols: number[] = [];

        lowerCells.forEach((c, idx) => {
          if (c === 'sl' || c === 'ser' || c === 'serial' || c.startsWith('sl') || c.includes('ক্রমিক') || c === '#') {
            slColIdx = idx;
          } else if (c.includes('bd') || c.includes('airman') || c.includes('বিডি')) {
            bdColIdx = idx;
          } else if (c.includes('rank') || c.includes('পদবী')) {
            rankColIdx = idx;
          } else if (c.includes('surname') || c.includes('name') || c.includes('নাম')) {
            surnameColIdx = idx;
          } else if (c.includes('unit fund') || c.includes('unit_fund') || c.includes('ইউনিট ফান্ড') || c === 'unit fund' || c === 'unit') {
            unitFundColIdx = idx;
          } else if (c.includes('others') || c.includes('other') || c.includes('অন্যান্য') || c === 'others') {
            othersFundColIdx = idx;
          } else if (c.includes('adv') || c.includes('advance') || c.includes('অগ্রীম') || c.includes('ogrim')) {
            advCols.push(idx);
          } else if (c.includes('due') || c.includes('bill') || c.includes('বকেয়া') || c.includes('বিল')) {
            dueCols.push(idx);
          } else if (c.includes('amount') || c.includes('টাকা')) {
            if (fallbackAmountColIdx === -1) fallbackAmountColIdx = idx;
          }
        });

        // Assign amount columns cleanly: first due column is Last Month, second due column is This Month
        if (dueCols.length >= 2) {
          dueLastMonthColIdx = dueCols[0];
          dueThisMonthColIdx = dueCols[1];
        } else if (dueCols.length === 1) {
          const cText = lowerCells[dueCols[0]];
          if (cText.includes('last') || cText.includes('prev') || cText.includes('পূর্ব') || cText.includes('আগের')) {
            dueLastMonthColIdx = dueCols[0];
          } else {
            dueThisMonthColIdx = dueCols[0];
          }
        }

        if (advCols.length >= 1) {
          advLastMonthColIdx = advCols[0];
        }

        // Detect month name from dueThisMonthColIdx or header cells (e.g. "Due (Sep)" -> 09)
        if (dueThisMonthColIdx >= 0) {
          const cellStr = lowerCells[dueThisMonthColIdx];
          for (const [abbr, num] of Object.entries(monthMap)) {
            if (cellStr.includes(abbr)) {
              detectedMonthFromHeader = num;
              break;
            }
          }
        }

        break;
      }
    }

    // Determine active targetMonth and lastMonth
    let activeTargetMonth = overrideTargetMonth || targetMonth;
    if (!overrideTargetMonth && detectedMonthFromHeader) {
      const curYr = targetMonth ? parseInt(targetMonth.split('-')[0], 10) : new Date().getFullYear();
      const detectedKey = `${curYr}-${detectedMonthFromHeader}`;
      if (detectedKey !== targetMonth) {
        activeTargetMonth = detectedKey;
        setTargetMonth(detectedKey);
        setSuccessMessage(`ফাইল থেকে টার্গেট মাস সনাক্ত করা হয়েছে: ${formatMonthName(detectedKey)}`);
      }
    }

    const activeLastMonth = formatPrevMonthKey(activeTargetMonth);

    // Standard fallback if headers were missing or partially identified
    if (dueLastMonthColIdx === -1 && dueThisMonthColIdx === -1) {
      const sampleRow = rows[headerRowIdx >= 0 ? headerRowIdx + 1 : 0] || [];
      if (sampleRow.length >= 7) {
        slColIdx = slColIdx >= 0 ? slColIdx : 0;
        bdColIdx = bdColIdx >= 0 ? bdColIdx : 1;
        rankColIdx = rankColIdx >= 0 ? rankColIdx : 2;
        surnameColIdx = surnameColIdx >= 0 ? surnameColIdx : 3;
        dueLastMonthColIdx = 4;
        advLastMonthColIdx = 5;
        dueThisMonthColIdx = 6;
        if (sampleRow.length >= 8) unitFundColIdx = 7;
        if (sampleRow.length >= 9) othersFundColIdx = 8;
      }
    } else {
      // If template had 8 or 9 columns but unitFund / others was not identified by name
      const headerLen = rows[headerRowIdx] ? rows[headerRowIdx].length : 0;
      if (unitFundColIdx === -1 && headerLen >= 8) {
        unitFundColIdx = 7;
      }
      if (othersFundColIdx === -1 && headerLen >= 9) {
        othersFundColIdx = 8;
      }
    }

    const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
    const result: ParsedBillRow[] = [];
    const seenBd = new Set<string>();

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
        (joined.includes('due') || joined.includes('bill') || joined.includes('advance') || joined.includes('fund'))
      ) {
        continue;
      }

      let detectedBd = '';
      let matchedMember: any = null;

      // 1. Primary: read from designated BD No column (Supports 1-digit, 2-digit, 4-digit, 6-digit BDs)
      if (bdColIdx >= 0 && bdColIdx < strRow.length) {
        let rawVal = String(strRow[bdColIdx] ?? '').trim();
        if (rawVal.endsWith('.0')) rawVal = rawVal.slice(0, -2);

        const cleanDigits = rawVal.replace(/\D/g, '');
        if (cleanDigits) {
          detectedBd = cleanDigits;
          matchedMember = memberMap.get(cleanDigits) || memberMap.get(rawVal.toLowerCase()) || null;
        } else if (rawVal) {
          detectedBd = rawVal;
          matchedMember = memberMap.get(rawVal.toLowerCase()) || null;
        }
      }

      // 2. Secondary: Match by Rank & Surname if available in row
      if (!matchedMember) {
        const surnameVal = surnameColIdx >= 0 ? String(strRow[surnameColIdx] ?? '').trim().toLowerCase() : '';
        const rankVal = rankColIdx >= 0 ? String(strRow[rankColIdx] ?? '').trim().toLowerCase() : '';
        if (surnameVal) {
          if (rankVal && memberByNameMap.has(`${rankVal} ${surnameVal}`)) {
            matchedMember = memberByNameMap.get(`${rankVal} ${surnameVal}`);
          } else if (memberByNameMap.has(surnameVal)) {
            matchedMember = memberByNameMap.get(surnameVal);
          }
          if (matchedMember && !detectedBd) {
            detectedBd = String(matchedMember['BD No'] || matchedMember.bdNo || matchedMember.airman_id || '').replace(/\D/g, '');
          }
        }
      }

      // 3. Fallback: Search other columns (strictly EXCLUDING amount and SL columns)
      if (!detectedBd) {
        const excludedCols = new Set([
          slColIdx,
          dueLastMonthColIdx,
          advLastMonthColIdx,
          dueThisMonthColIdx,
          unitFundColIdx,
          othersFundColIdx,
          fallbackAmountColIdx,
          rankColIdx,
          surnameColIdx
        ]);

        for (let i = 0; i < strRow.length; i++) {
          if (excludedCols.has(i)) continue;
          let val = String(strRow[i] ?? '').trim();
          if (val.endsWith('.0')) val = val.slice(0, -2);
          const digits = val.replace(/\D/g, '');
          if (digits && (memberMap.has(digits) || memberMap.has(val.toLowerCase()))) {
            detectedBd = digits;
            matchedMember = memberMap.get(digits) || memberMap.get(val.toLowerCase());
            break;
          }
        }
      }

      if (!detectedBd) {
        const surnameVal = surnameColIdx >= 0 ? String(strRow[surnameColIdx] ?? '').trim() : '';
        const rawBdCol = bdColIdx >= 0 ? String(strRow[bdColIdx] ?? '').trim() : '';
        if (surnameVal || rawBdCol) {
          detectedBd = rawBdCol || surnameVal || `ROW-${r}`;
        } else {
          continue;
        }
      }

      if (seenBd.has(detectedBd)) {
        detectedBd = `${detectedBd}_${r}`;
      }
      seenBd.add(detectedBd);

      const rowSl = slColIdx >= 0 && strRow[slColIdx] ? parseInt(strRow[slColIdx], 10) : (r - startRow + 1);

      const currentDue = matchedMember
        ? Number(matchedMember.Due ?? matchedMember.due ?? matchedMember.baki ?? 0)
        : 0;

      let dueLastMonth = 0;
      let advanceLastMonth = 0;
      let dueThisMonth = 0;
      let unitFund = 0;
      let othersFund = 0;

      if (dueLastMonthColIdx >= 0 && dueLastMonthColIdx < strRow.length) {
        dueLastMonth = parseNum(strRow[dueLastMonthColIdx]);
      }
      if (advLastMonthColIdx >= 0 && advLastMonthColIdx < strRow.length) {
        advanceLastMonth = parseNum(strRow[advLastMonthColIdx]);
      }
      if (dueThisMonthColIdx >= 0 && dueThisMonthColIdx < strRow.length) {
        dueThisMonth = parseNum(strRow[dueThisMonthColIdx]);
      }
      if (unitFundColIdx >= 0 && unitFundColIdx < strRow.length) {
        unitFund = parseNum(strRow[unitFundColIdx]);
      }
      if (othersFundColIdx >= 0 && othersFundColIdx < strRow.length) {
        othersFund = parseNum(strRow[othersFundColIdx]);
      }

      // Fallback if headers were not identified
      if (dueLastMonth === 0 && advanceLastMonth === 0 && dueThisMonth === 0 && unitFund === 0 && othersFund === 0) {
        let foundBdIdx = bdColIdx >= 0 ? bdColIdx : -1;
        if (foundBdIdx === -1) {
          for (let i = 0; i < strRow.length; i++) {
            if (strRow[i].replace(/\D/g, '') === detectedBd) {
              foundBdIdx = i;
              break;
            }
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
            dueThisMonth = numericColsAfterBd[0];
          } else if (numericColsAfterBd.length === 2) {
            dueLastMonth = numericColsAfterBd[0];
            dueThisMonth = numericColsAfterBd[1];
          } else if (numericColsAfterBd.length === 3) {
            dueLastMonth = numericColsAfterBd[0];
            advanceLastMonth = numericColsAfterBd[1];
            dueThisMonth = numericColsAfterBd[2];
          } else if (numericColsAfterBd.length === 4) {
            dueLastMonth = numericColsAfterBd[0];
            advanceLastMonth = numericColsAfterBd[1];
            dueThisMonth = numericColsAfterBd[2];
            unitFund = numericColsAfterBd[3];
          } else if (numericColsAfterBd.length >= 5) {
            dueLastMonth = numericColsAfterBd[0];
            advanceLastMonth = numericColsAfterBd[1];
            dueThisMonth = numericColsAfterBd[2];
            unitFund = numericColsAfterBd[3];
            othersFund = numericColsAfterBd[4];
          }
        }
      }

      // Calculate Net Total Due and Final Advance
      // Total debits = previous month due + this month canteen due + unit fund + others fund
      const totalDebits = dueLastMonth + dueThisMonth + unitFund + othersFund;
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

      const effectiveAmount = netDue > 0 ? netDue : (dueThisMonth + unitFund + othersFund > 0 ? dueThisMonth + unitFund + othersFund : dueLastMonth);

      result.push({
        id: `${detectedBd}_${activeTargetMonth}`,
        sl: rowSl,
        rawBd: detectedBd,
        bdNo: detectedBd,
        targetMonth: activeTargetMonth,
        lastMonth: activeLastMonth,
        advanceMonth: activeLastMonth,
        dueLastMonth,
        advanceLastMonth,
        dueThisMonth,
        unitFund,
        othersFund,
        totalDue: netDue,
        finalAdvance: finalAdv,
        amount: effectiveAmount,
        member: matchedMember,
        currentDue,
        status: matchedMember ? 'matched' : 'unmatched'
      });
    }

    if (result.length === 0) {
      // Fallback: Check if rows can be parsed by smart freeform parser
      const rowStrings = rows.map((r) => Array.isArray(r) ? r.join(' ') : String(r)).join('\n');
      const smartFallback = parseSmartFreeformText(rowStrings, activeTargetMonth);
      if (smartFallback && smartFallback.length > 0) {
        setErrorMessage(null);
        const sortedSmart = [...smartFallback].sort((a, b) => (a.sl || 0) - (b.sl || 0));
        setParsedRows(sortedSmart);
        setSuccessMessage(`সফলভাবে ${sortedSmart.length} জনের বিল ডাটা পাওয়া গেছে। প্রিভিউ দেখে কনফার্ম করুন।`);
        return;
      }
      setErrorMessage('কোনো বৈধ ডাটা পাওয়া যায়নি। অনুগ্রহ করে ফাইল বা টেক্সটের ফরম্যাট চেক করুন।');
    } else {
      const sortedResult = [...result].sort((a, b) => (a.sl || 0) - (b.sl || 0));
      setParsedRows(sortedResult);
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

        rawDataRef.current = sheetData;
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

    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Try smart free-form parser first (e.g. "Aug\nSgt Rubel 115 Advance\nSgt Absar 230 Due\n\nSep\nSgt Asad 450 Due")
    const smartResults = parseSmartFreeformText(pasteText, targetMonth);
    if (smartResults && smartResults.length > 0) {
      const sortedSmart = [...smartResults].sort((a, b) => (a.sl || 0) - (b.sl || 0));
      rawDataRef.current = sortedSmart.map(r => [r.bdNo, r.rank, r.surname, r.dueLastMonth, r.advanceLastMonth, r.dueThisMonth]);
      setParsedRows(sortedSmart);
      if (sortedSmart[0].targetMonth && sortedSmart[0].targetMonth !== targetMonth) {
        setTargetMonth(sortedSmart[0].targetMonth);
      }
      setSuccessMessage(`সফলভাবে ${sortedSmart.length} জনের বিল ডাটা পাওয়া গেছে। প্রিভিউ দেখে নিশ্চিত করুন।`);
      return;
    }

    // 2. Fallback: Standard tabular splitting
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

    rawDataRef.current = rows;
    processRawData(rows);
  };

  // Download Exact Requested Template:
  // SL | BD No | Rank | Surname | Due\n(Month) | Advance\n(Month) | Due\n(Month)
  // Font: Arial, All center aligned, Name & Rank left aligned
  // Heading row is frozen so it stays visible while scrolling
  // Wrap text with Due on top line and short month (e.g. (Aug)) on bottom line
  // Carries over all unpaid dues from previous months (e.g. May through August when downloading for September)
  const handleDownloadTemplate = async () => {
    const lastMonthShort = getMonthShortName(lastMonth); // e.g. "Aug"
    const thisMonthShort = getMonthShortName(targetMonth); // e.g. "Sep"

    // Strictly sort members according to Member DB seniority
    const sortedMembers = sortCanteenMembersByOfficeSeniority(members);

    // Common Border Style for clean gridlines
    const cellBorder = {
      top: { style: 'thin', color: { rgb: 'D1D5DB' } },
      bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
      left: { style: 'thin', color: { rgb: 'D1D5DB' } },
      right: { style: 'thin', color: { rgb: 'D1D5DB' } },
    };

    const headers = [
      'SL',
      'BD No',
      'Rank',
      'Surname',
      `Due\n(${lastMonthShort})`,
      `Advance\n(${lastMonthShort})`,
      `Due\n(${thisMonthShort})`,
      'Unit Fund',
      'Others'
    ];

    const aoa: any[][] = [];
    aoa.push(headers);

    sortedMembers.forEach((m, idx) => {
      const memberBdClean = String(m['BD No'] || m.bdNo || m.airman_id || '').replace(/\D/g, '');
      const memberTxs = effectiveTxs.filter((tx: any) => {
        if (m.airman_id && tx.airman_id === m.airman_id) return true;
        if (memberBdClean) {
          const txBdClean = String(tx.bdNo || tx.airman_id || '').replace(/\D/g, '');
          if (txBdClean === memberBdClean) return true;
        }
        return false;
      });

      const getTxMonth = (tx: any) => {
        const isPay = tx.type === 'BILL PAYMENT' || tx.type === 'PAYMENT';
        if (isPay) {
          return getPaymentCycleMonthKey(tx.date || tx.timestamp || tx.created_at || tx.createdAt) || tx.monthKey || '';
        }
        return tx.monthKey || getTxMonthKey(tx.date) || '';
      };

      // Older transactions strictly prior to targetMonth (e.g. May, June, July, August when target is September)
      const olderTxs = memberTxs.filter((tx: any) => {
        const txMonth = getTxMonth(tx);
        return txMonth && txMonth < targetMonth;
      });

      const olderCharges = olderTxs
        .filter((tx: any) => tx.type !== 'BILL PAYMENT')
        .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);

      const olderPayments = olderTxs
        .filter((tx: any) => tx.type === 'BILL PAYMENT')
        .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);

      const olderNet = olderCharges - olderPayments;

      // Current and future month transactions
      const currentMonthTxs = memberTxs.filter((tx: any) => getTxMonth(tx) === targetMonth);
      const currentCharges = currentMonthTxs
        .filter((tx: any) => tx.type !== 'BILL PAYMENT')
        .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
      const currentPayments = currentMonthTxs
        .filter((tx: any) => tx.type === 'BILL PAYMENT')
        .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
      const currentNet = Math.max(0, currentCharges - currentPayments);

      const futureTxs = memberTxs.filter((tx: any) => {
        const txMonth = getTxMonth(tx);
        return txMonth && txMonth > targetMonth;
      });
      const futureNet = Math.max(0, futureTxs
        .filter((tx: any) => tx.type !== 'BILL PAYMENT')
        .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0) -
        futureTxs
        .filter((tx: any) => tx.type === 'BILL PAYMENT')
        .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0)
      );

      const memberTotalDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
      const memberTotalAdvance = Number(m.Advance ?? m.advance ?? m.ogrim ?? 0);

      let pastDue = 0;
      let pastAdvance = 0;
      let thisMonthDue = 0;

      if (olderTxs.length > 0) {
        if (olderNet > 0) {
          pastDue = olderNet;
          pastAdvance = 0;
        } else if (olderNet < 0) {
          pastDue = 0;
          pastAdvance = Math.abs(olderNet);
        }
      }

      if (currentNet > 0) {
        thisMonthDue = currentNet;
      }

      // If member profile has a cumulative due greater than what older transactions alone recorded
      if (memberTotalDue > 0) {
        const remainingAfterOlder = Math.max(0, memberTotalDue - pastDue - futureNet);
        if (thisMonthDue === 0 && remainingAfterOlder > 0) {
          // Attribute member profile due to targetMonth when downloading that month's template
          thisMonthDue = remainingAfterOlder;
        } else if (thisMonthDue > 0) {
          const diff = Math.max(0, memberTotalDue - thisMonthDue - futureNet);
          if (diff > pastDue) {
            pastDue = diff;
            pastAdvance = 0;
          }
        }
      }

      if (pastDue === 0 && memberTotalAdvance > 0 && pastAdvance === 0) {
        pastAdvance = memberTotalAdvance;
      }

      // Check for current/target month Unit Fund or Others Fund if already logged
      const currentUnitFundTx = currentMonthTxs.find((tx: any) => {
        const cat = String(tx.billType || tx.items || '').toUpperCase();
        return cat.includes('UNIT');
      });
      const currentOthersFundTx = currentMonthTxs.find((tx: any) => {
        const cat = String(tx.billType || tx.items || '').toUpperCase();
        return cat.includes('OTHER');
      });

      const existingUnitFund = currentUnitFundTx ? Number(currentUnitFundTx.amount || 0) : 0;
      const existingOthersFund = currentOthersFundTx ? Number(currentOthersFundTx.amount || 0) : 0;

      aoa.push([
        idx + 1,
        String(m['BD No'] || m.bdNo || '').trim(),
        String(m['Rank'] || m.rank || '').trim(),
        String(m['Surname'] || m.surname || m['Full Name'] || m.name || '').trim(),
        pastDue > 0 ? pastDue : '',
        pastAdvance > 0 ? pastAdvance : '',
        thisMonthDue > 0 ? thisMonthDue : '',
        existingUnitFund > 0 ? existingUnitFund : '',
        existingOthersFund > 0 ? existingOthersFund : ''
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // Set Column Widths (9 columns total)
    worksheet['!cols'] = [
      { wch: 8 },  // SL
      { wch: 14 }, // BD No
      { wch: 14 }, // Rank
      { wch: 24 }, // Surname
      { wch: 18 }, // Due (Last Month)
      { wch: 18 }, // Advance (Last Month)
      { wch: 18 }, // Due (This Month)
      { wch: 16 }, // Unit Fund
      { wch: 16 }, // Others
    ];

    // Set Row Heights (36pt for Header Row to display wrapped text comfortably)
    worksheet['!rows'] = [
      { hpt: 36 }, // Header Row with wrap text
      ...Array(sortedMembers.length).fill({ hpt: 20 }) // Data rows
    ];

    // Style Header Row (Row 0): Font Arial Bold, All Center Aligned, Light Gray Fill, Wrap Text enabled
    for (let c = 0; c < 9; c++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c });
      if (worksheet[addr]) {
        worksheet[addr].s = {
          font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '000000' } },
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          border: cellBorder,
          fill: { fgColor: { rgb: 'F3F4F6' } }
        };
      }
    }

    // Style Data Rows: Font Arial, All Center Aligned, ONLY Name & Rank Left Aligned
    for (let i = 0; i < sortedMembers.length; i++) {
      const r = i + 1;
      for (let c = 0; c < 9; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!worksheet[addr]) {
          worksheet[addr] = { t: 's', v: '' };
        }
        const isLeftAlign = (c === 2 || c === 3); // c=2 is Rank, c=3 is Surname/Name
        worksheet[addr].s = {
          font: { name: 'Arial', sz: 11, color: { rgb: '000000' } },
          alignment: {
            horizontal: isLeftAlign ? 'left' : 'center',
            vertical: 'center',
            wrapText: false
          },
          border: cellBorder
        };
      }
    }

    // Freeze Pane Settings (Heading row 1 is frozen)
    worksheet['!views'] = [
      { state: 'frozen', xSplit: 0, ySplit: 1, activePane: 'bottomLeft', topLeftCell: 'A2' }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bills_Template');
    const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const filename = `Cafe_UAV_Bills_Template_${lastMonthShort}_${thisMonthShort}.xlsx`;

    // Inject Freeze Pane into sheet1.xml to guarantee row 1 freeze across Excel and mobile apps
    try {
      const zip = await JSZip.loadAsync(wbout);
      let sheetXml = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
      if (sheetXml) {
        sheetXml = sheetXml.replace(
          /<sheetView workbookViewId="0"[^>]*\/>/g,
          '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>'
        );
        zip.file('xl/worksheets/sheet1.xml', sheetXml);
        const finalBlob = await zip.generateAsync({
          type: 'blob',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        saveAs(finalBlob, filename);
        return;
      }
    } catch (zipErr) {
      console.warn('Freeze pane zip injection warning:', zipErr);
    }

    const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, filename);
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
    const totalUnitFund = parsedRows.reduce((sum, r) => sum + (r.unitFund || 0), 0);
    const totalOthersFund = parsedRows.reduce((sum, r) => sum + (r.othersFund || 0), 0);
    const totalNetDue = parsedRows.reduce((sum, r) => sum + (r.totalDue || 0), 0);

    return { total, matched, unmatched, totalDueLastMonth, totalAdvanceLastMonth, totalDueThisMonth, totalUnitFund, totalOthersFund, totalNetDue };
  }, [parsedRows]);

  // Detected unique months in current parsed rows
  const detectedMonthsList = useMemo(() => {
    const set = new Set<string>();
    parsedRows.forEach((r) => {
      if (r.targetMonth) set.add(r.targetMonth);
    });
    return Array.from(set).sort();
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
      // Unique members map to strictly prevent member duplication
      const uniqueMembersMap = new Map<string, any>();
      const lookupIndex = new Map<string, any>();

      members.forEach((m) => {
        const clean = String(m['BD No'] || m.bdNo || m.airman_id || '').replace(/\D/g, '');
        const airmanId = String(m.airman_id || '').trim().toLowerCase();
        const primaryKey = (clean && clean !== '0') ? `bd_${clean}` : (airmanId ? `airman_${airmanId}` : `name_${String(m.Rank || '').trim()}_${String(m.Surname || '').trim()}`);
        if (!primaryKey) return;

        if (!uniqueMembersMap.has(primaryKey)) {
          uniqueMembersMap.set(primaryKey, { ...m });
        } else {
          const existing = uniqueMembersMap.get(primaryKey);
          if (m.Due !== undefined && (existing.Due === undefined || Number(m.Due) > Number(existing.Due))) {
            existing.Due = m.Due;
            existing.due = m.Due;
            existing.baki = m.Due;
          }
          if (m.Advance !== undefined && (existing.Advance === undefined || Number(m.Advance) > Number(existing.Advance))) {
            existing.Advance = m.Advance;
            existing.advance = m.Advance;
            existing.ogrim = m.Advance;
          }
          if (!existing['Rank'] && m['Rank']) existing['Rank'] = m['Rank'];
          if (!existing['Surname'] && m['Surname']) existing['Surname'] = m['Surname'];
          if (!existing['Contact'] && (m['Contact'] || m['Mobile No'])) existing['Contact'] = m['Contact'] || m['Mobile No'];
          if (!existing.airman_id && m.airman_id) existing.airman_id = m.airman_id;
          if (!existing['BD No'] && m['BD No']) existing['BD No'] = m['BD No'];
        }
        const memberRef = uniqueMembersMap.get(primaryKey);

        const rawBd = String(m['BD No'] || m.bdNo || '').trim().toLowerCase();
        const surname = String(m.Surname || m.surname || '').trim().toLowerCase();
        const rank = String(m.Rank || m.rank || '').trim().toLowerCase();

        if (clean) lookupIndex.set(clean, memberRef);
        if (airmanId) lookupIndex.set(airmanId, memberRef);
        if (rawBd) lookupIndex.set(rawBd, memberRef);
        if (surname) lookupIndex.set(surname, memberRef);
        if (rank && surname) lookupIndex.set(`${rank} ${surname}`, memberRef);
      });

      const newTxs: any[] = [];
      const newTxIds: (string | number)[] = [];
      const batchItems: BillImportBatchItem[] = [];

      for (const row of matchedRows) {
        const targetMember = lookupIndex.get(row.bdNo) || 
          (row.member?.airman_id ? lookupIndex.get(String(row.member.airman_id).toLowerCase()) : null) ||
          (row.rawBd ? lookupIndex.get(row.rawBd.toLowerCase()) : null);
        if (!targetMember) continue;

        const oldDue = Number(targetMember.Due ?? targetMember.due ?? targetMember.baki ?? 0);
        const oldAdv = Number(targetMember.Advance ?? targetMember.advance ?? targetMember.ogrim ?? 0);

        const debits = row.dueLastMonth + row.dueThisMonth + (row.unitFund || 0) + (row.othersFund || 0);
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

        const rowTargetMonth = row.targetMonth || targetMonth;
        const rowLastMonth = row.lastMonth || formatPrevMonthKey(rowTargetMonth);

        batchItems.push({
          airman_id: targetMember.airman_id,
          bdNo: row.bdNo,
          rank: targetMember['Rank'] || '',
          surname: targetMember['Surname'] || '',
          targetMonth: rowTargetMonth,
          lastMonth: rowLastMonth,
          dueLastMonth: row.dueLastMonth,
          advanceLastMonth: row.advanceLastMonth,
          dueThisMonth: row.dueThisMonth,
          unitFund: row.unitFund || 0,
          othersFund: row.othersFund || 0,
          importedAmount: row.totalDue,
          resultingDue: finalDue,
          previousDue: oldDue,
          previousAdvance: oldAdv
        });

        // Create transactions in canteen_txs
        if (createTransaction) {
          const cleanBdNo = String(targetMember['BD No'] || targetMember.bdNo || row.bdNo || '').replace(/\D/g, '');
          const cleanAirmanId = targetMember.airman_id || (cleanBdNo ? `airman-${cleanBdNo}` : undefined);
          const fullMemberName = `${targetMember['Rank'] || ''} ${targetMember['Surname'] || ''}`.trim() || `BD-${cleanBdNo}`;

          // 1. Due (Last Month) Transaction
          if (row.dueLastMonth > 0) {
            const txId = `tx-import-${Date.now()}-${cleanBdNo}-dueLast-${Math.floor(Math.random() * 1000)}`;
            newTxIds.push(txId);
            newTxs.push({
              id: txId,
              date: getFormattedDateForMonth(rowLastMonth, 28),
              monthKey: rowLastMonth,
              airman_id: cleanAirmanId,
              bdNo: targetMember['BD No'] || targetMember.bdNo || (cleanBdNo ? `BD/${cleanBdNo}` : ''),
              memberName: fullMemberName,
              rank: targetMember['Rank'] || targetMember.rank || '',
              items: `বকেয়া বিল (${formatBengaliMonthYear(rowLastMonth)})`,
              soldItems: [],
              amount: row.dueLastMonth,
              type: 'INITIAL_BILL',
              gateway: 'DUE',
              billType: 'CANTEEN'
            });
          }

          // 2. Advance Transaction
          if (row.advanceLastMonth > 0) {
            const advMonth = row.advanceMonth || (row.dueThisMonth === 0 && row.dueLastMonth === 0 ? rowTargetMonth : rowLastMonth);
            const txId = `tx-import-${Date.now()}-${cleanBdNo}-adv-${Math.floor(Math.random() * 1000)}`;
            newTxIds.push(txId);
            newTxs.push({
              id: txId,
              date: getFormattedDateForMonth(advMonth, 25),
              monthKey: advMonth,
              airman_id: cleanAirmanId,
              bdNo: targetMember['BD No'] || targetMember.bdNo || (cleanBdNo ? `BD/${cleanBdNo}` : ''),
              memberName: fullMemberName,
              rank: targetMember['Rank'] || targetMember.rank || '',
              items: `অগ্রীম জমা / Advance (${formatBengaliMonthYear(advMonth)})`,
              soldItems: [],
              amount: row.advanceLastMonth,
              type: 'BILL PAYMENT',
              gateway: 'ADVANCE',
              billType: 'CANTEEN'
            });
          }

          // 3. Due (This Month) Transaction
          if (row.dueThisMonth > 0) {
            const txId = `tx-import-${Date.now()}-${cleanBdNo}-dueThis-${Math.floor(Math.random() * 1000)}`;
            newTxIds.push(txId);
            newTxs.push({
              id: txId,
              date: getFormattedDateForMonth(rowTargetMonth, 28),
              monthKey: rowTargetMonth,
              airman_id: cleanAirmanId,
              bdNo: targetMember['BD No'] || targetMember.bdNo || (cleanBdNo ? `BD/${cleanBdNo}` : ''),
              memberName: fullMemberName,
              rank: targetMember['Rank'] || targetMember.rank || '',
              items: `ক্যান্টিন বিল (${formatBengaliMonthYear(rowTargetMonth)})`,
              soldItems: [],
              amount: row.dueThisMonth,
              type: 'INITIAL_BILL',
              gateway: 'DUE',
              billType: 'CANTEEN'
            });
          }

          // 3b. Fallback Single / Direct Bill Transaction (If separate Due This Month column was not present)
          if (row.dueThisMonth === 0 && row.dueLastMonth === 0 && (row.totalDue > 0 || row.amount > 0)) {
            const fallbackAmount = row.totalDue > 0 ? row.totalDue : row.amount;
            const txId = `tx-import-${Date.now()}-${cleanBdNo}-fallback-${Math.floor(Math.random() * 1000)}`;
            newTxIds.push(txId);
            newTxs.push({
              id: txId,
              date: getFormattedDateForMonth(rowTargetMonth, 28),
              monthKey: rowTargetMonth,
              airman_id: cleanAirmanId,
              bdNo: targetMember['BD No'] || targetMember.bdNo || (cleanBdNo ? `BD/${cleanBdNo}` : ''),
              memberName: fullMemberName,
              rank: targetMember['Rank'] || targetMember.rank || '',
              items: `ক্যান্টিন বিল (${formatBengaliMonthYear(rowTargetMonth)})`,
              soldItems: [],
              amount: fallbackAmount,
              type: 'INITIAL_BILL',
              gateway: 'DUE',
              billType: 'CANTEEN'
            });
          }

          // 4. Unit Fund Transaction
          if ((row.unitFund || 0) > 0) {
            const txId = `tx-import-${Date.now()}-${cleanBdNo}-unitFund-${Math.floor(Math.random() * 1000)}`;
            newTxIds.push(txId);
            newTxs.push({
              id: txId,
              date: getFormattedDateForMonth(rowTargetMonth, 28),
              monthKey: rowTargetMonth,
              airman_id: cleanAirmanId,
              bdNo: targetMember['BD No'] || targetMember.bdNo || (cleanBdNo ? `BD/${cleanBdNo}` : ''),
              memberName: fullMemberName,
              rank: targetMember['Rank'] || targetMember.rank || '',
              items: `ইউনিট ফান্ড (${formatBengaliMonthYear(rowTargetMonth)})`,
              soldItems: [],
              amount: row.unitFund,
              type: 'INITIAL_BILL',
              gateway: 'DUE',
              billType: 'UNIT_FUND'
            });
          }

          // 5. Others Fund Transaction
          if ((row.othersFund || 0) > 0) {
            const txId = `tx-import-${Date.now()}-${cleanBdNo}-othersFund-${Math.floor(Math.random() * 1000)}`;
            newTxIds.push(txId);
            newTxs.push({
              id: txId,
              date: getFormattedDateForMonth(rowTargetMonth, 28),
              monthKey: rowTargetMonth,
              airman_id: cleanAirmanId,
              bdNo: targetMember['BD No'] || targetMember.bdNo || (cleanBdNo ? `BD/${cleanBdNo}` : ''),
              memberName: fullMemberName,
              rank: targetMember['Rank'] || targetMember.rank || '',
              items: `অন্যান্য ফান্ড (${formatBengaliMonthYear(rowTargetMonth)})`,
              soldItems: [],
              amount: row.othersFund,
              type: 'INITIAL_BILL',
              gateway: 'DUE',
              billType: 'OTHERS'
            });
          }
        }
      }

      // 1. Save and merge transactions with existing ledger:
      // STRICT SELECTIVE REPLACEMENT:
      // Only replace older transactions matching the EXACT same member AND EXACT same month AND EXACT same category as newly added!
      // All other months (e.g. Asad & Rubel's Sep due when Aug advance is imported), POS sales, and other members remain 100% intact!
      let mergedTxs: any[] = [];
      if (newTxs.length > 0) {
        try {
          const existingTxs: any[] = JSON.parse(localStorage.getItem('canteen_txs') || '[]');

          const getTxSubCat = (t: any): string => {
            const isAdv = t.gateway === 'ADVANCE' || String(t.items || '').includes('অগ্রীম') || String(t.items || '').toLowerCase().includes('advance');
            if (isAdv) return 'ADVANCE';
            if (t.billType === 'UNIT_FUND' || String(t.items || '').includes('ইউনিট ফান্ড')) return 'UNIT_FUND';
            if (t.billType === 'OTHERS' || String(t.items || '').includes('অন্যান্য ফান্ড')) return 'OTHERS';
            return 'CANTEEN';
          };

          const newImportKeys = new Set<string>();
          newTxs.forEach((nt) => {
            const cleanBd = String(nt.bdNo || nt.airman_id || '').replace(/\D/g, '');
            const mKey = nt.monthKey || getTxEffectiveMonth(nt);
            const cat = getTxSubCat(nt);
            if (cleanBd && mKey) {
              newImportKeys.add(`${cleanBd}__${mKey}__${cat}`);
            }
          });

          const keptExistingTxs = existingTxs.filter((t: any) => {
            if (!t || !t.id) return false;
            // Real POS sale items must NEVER be replaced by imports
            if (t.type === 'SALE' || (Array.isArray(t.soldItems) && t.soldItems.length > 0)) {
              return true;
            }
            const isImportableOrInitial = t.type === 'INITIAL_BILL' ||
              t.type === 'AMOUNT_CHANGE' ||
              t.isAmountChange ||
              String(t.id).startsWith('tx-import-') ||
              String(t.id).startsWith('init-') ||
              (t.type === 'BILL PAYMENT' && (t.gateway === 'ADVANCE' || String(t.id).startsWith('tx-import-')));

            if (!isImportableOrInitial) {
              return true; // Keep other normal payments
            }

            const cleanBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
            const mKey = t.monthKey || getTxEffectiveMonth(t);
            const cat = getTxSubCat(t);

            const matchKey = `${cleanBd}__${mKey}__${cat}`;
            if (newImportKeys.has(matchKey)) {
              // Exact replacement: this older bill/advance for this member and month is cleanly replaced by the new one
              return false;
            }
            // Retain transactions for all other months completely intact!
            return true;
          });

          mergedTxs = deduplicateCanteenTransactions([...keptExistingTxs, ...newTxs]);
          localStorage.setItem('canteen_txs', JSON.stringify(mergedTxs));
          await pushKeyToCloud('canteen_txs', mergedTxs);
        } catch (e) {
          console.warn('Failed to merge and push initial bill transactions:', e);
        }
      }

      // 2. Recompute each affected member's Due & Advance from their full ledger in mergedTxs
      const updatedMembersToSync = Array.from(uniqueMembersMap.values()).filter((m) => {
        return batchItems.some((b) => b.airman_id === m.airman_id || String(b.bdNo).replace(/\D/g, '') === String(m['BD No'] || m.bdNo || '').replace(/\D/g, ''));
      });

      if (mergedTxs.length > 0) {
        for (const m of updatedMembersToSync) {
          const cleanBd = String(m['BD No'] || m.bdNo || m.airman_id || '').replace(/\D/g, '');
          const memberAllTxs = mergedTxs.filter((t: any) => {
            if (!t) return false;
            const tBd = String(t.bdNo || t.airman_id || '').replace(/\D/g, '');
            if (cleanBd && tBd && cleanBd === tBd) return true;
            if (m.airman_id && t.airman_id && String(m.airman_id).toLowerCase() === String(t.airman_id).toLowerCase()) return true;
            return false;
          });

          let salesCharges = 0;
          const initialTxsByGroup = new Map<string, any[]>();
          memberAllTxs.forEach((tx: any) => {
            if (!tx || tx.type === 'BILL PAYMENT' || tx.type === 'REVERTED' || tx.isReverted) return;
            const isInit = tx.type === 'INITIAL_BILL' || 
              tx.type === 'AMOUNT_CHANGE' ||
              tx.isAmountChange ||
              String(tx.id || '').startsWith('tx-init-') || 
              String(tx.id || '').startsWith('init-') || 
              String(tx.items || '').includes('ক্যান্টিন বিল') || 
              String(tx.items || '').includes('বকেয়া বিল') ||
              String(tx.items || '').includes('ইউনিট ফান্ড') ||
              String(tx.items || '').includes('অন্যান্য ফান্ড');
            if (!isInit) {
              salesCharges += Number(tx.amount || 0);
            } else {
              const mKey = tx.monthKey || getTxEffectiveMonth(tx) || 'DEFAULT';
              const cKey = tx.billType || (String(tx.items || '').includes('ইউনিট ফান্ড') ? 'UNIT_FUND' : (String(tx.items || '').includes('অন্যান্য ফান্ড') ? 'OTHERS' : 'CANTEEN'));
              const groupKey = `${mKey}__${cKey}`;
              if (!initialTxsByGroup.has(groupKey)) initialTxsByGroup.set(groupKey, []);
              initialTxsByGroup.get(groupKey)!.push(tx);
            }
          });

          let initCharges = 0;
          initialTxsByGroup.forEach((group) => {
            const sorted = [...group].sort((a, b) => {
              const timeA = new Date(a.created_at || a.createdAt || a.timestamp || 0).getTime() || 0;
              const timeB = new Date(b.created_at || b.createdAt || b.timestamp || 0).getTime() || 0;
              return timeB - timeA;
            });
            initCharges += Number(sorted[0].amount || 0);
          });

          const totalCharges = salesCharges + initCharges;
          const totalCredits = memberAllTxs
            .filter((tx: any) => (tx.type === 'BILL PAYMENT' || tx.gateway === 'ADVANCE') && !tx.isReverted && tx.status !== 'REVERTED')
            .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);

          let finalDue = 0;
          let finalAdv = 0;
          if (totalCharges >= totalCredits) {
            finalDue = totalCharges - totalCredits;
            finalAdv = 0;
          } else {
            finalDue = 0;
            finalAdv = totalCredits - totalCharges;
          }

          m.Due = finalDue;
          m.due = finalDue;
          m.baki = finalDue;
          m.Advance = finalAdv;
          m.advance = finalAdv;
          m.ogrim = finalAdv;
        }
      }

      // 3. Update Supabase Canteen_Member table in parallel chunks of 15
      for (let i = 0; i < updatedMembersToSync.length; i += 15) {
        const chunk = updatedMembersToSync.slice(i, i + 15);
        await Promise.all(
          chunk.map((m) => {
            return supabase
              .from('Canteen_Member')
              .update({ Due: m.Due })
              .eq('airman_id', m.airman_id);
          })
        );
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

      // Update Local Cache & Dispatch Global Events (strictly deduplicated unique members)
      const updatedMembersList = sortCanteenMembersByOfficeSeniority(Array.from(uniqueMembersMap.values()));
      try {
        localStorage.setItem('canteen_members_cache', JSON.stringify(updatedMembersList));
      } catch {}

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_bill_import_history_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      onSuccess(updatedMembersList);

      const allBatchMonths = Array.from(new Set(batchItems.map((b) => b.targetMonth).filter(Boolean)));
      const monthNamesStr = allBatchMonths.length > 0
        ? allBatchMonths.map((m) => formatMonthName(m)).join(', ')
        : `${formatMonthName(lastMonth)} ও ${formatMonthName(targetMonth)}`;

      setSuccessMessage(
        `সফলভাবে ${matchedRows.length} জন সদস্যের (${monthNamesStr}) বকেয়া ও বিল আপডেট করা হয়েছে!`
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
      // Build unique members map and lookup index to prevent any duplication
      const uniqueMembersMap = new Map<string, any>();
      const lookupIndex = new Map<string, any>();

      members.forEach((m) => {
        const clean = String(m['BD No'] || m.bdNo || m.airman_id || '').replace(/\D/g, '');
        const airmanId = String(m.airman_id || '').trim().toLowerCase();
        const primaryKey = (clean && clean !== '0') ? `bd_${clean}` : (airmanId ? `airman_${airmanId}` : `name_${String(m.Rank || '').trim()}_${String(m.Surname || '').trim()}`);
        if (!primaryKey) return;
        if (!uniqueMembersMap.has(primaryKey)) {
          uniqueMembersMap.set(primaryKey, { ...m });
        }
        const memberRef = uniqueMembersMap.get(primaryKey);

        const rawBd = String(m['BD No'] || m.bdNo || '').trim().toLowerCase();
        const surname = String(m.Surname || m.surname || '').trim().toLowerCase();
        const rank = String(m.Rank || m.rank || '').trim().toLowerCase();

        if (clean) lookupIndex.set(clean, memberRef);
        if (airmanId) lookupIndex.set(airmanId, memberRef);
        if (rawBd) lookupIndex.set(rawBd, memberRef);
        if (surname) lookupIndex.set(surname, memberRef);
        if (rank && surname) lookupIndex.set(`${rank} ${surname}`, memberRef);
      });

      if (revertDues) {
        // 1. Revert each member's Due back to previousDue in Supabase
        const updatesList: { airman_id?: string; bdNo?: string; newDue: number }[] = [];

        batch.items.forEach((item) => {
          const member = lookupIndex.get(item.bdNo) || 
            (item.airman_id ? lookupIndex.get(item.airman_id.toLowerCase()) : null);

          const targetAirmanId = member?.airman_id || item.airman_id;
          const targetBd = member?.['BD No'] || member?.bdNo || item.bdNo;

          let newDue = 0;
          if (item.previousDue !== undefined) {
            newDue = Math.max(0, Number(item.previousDue || 0));
          } else {
            const change = Number(item.importedAmount || (item.dueLastMonth + item.dueThisMonth + (item.unitFund || 0) + (item.othersFund || 0)));
            newDue = Math.max(0, (item.resultingDue || 0) - change);
          }

          if (member) {
            member.Due = newDue;
            member.due = newDue;
            member.baki = newDue;
          }

          if (targetAirmanId || targetBd) {
            updatesList.push({
              airman_id: targetAirmanId,
              bdNo: targetBd,
              newDue
            });
          }
        });

        // Run Supabase updates in chunks of 15
        for (let i = 0; i < updatesList.length; i += 15) {
          const chunk = updatesList.slice(i, i + 15);
          await Promise.all(
            chunk.map((item) => {
              if (item.airman_id) {
                return supabase.from('Canteen_Member').update({ Due: item.newDue }).eq('airman_id', item.airman_id);
              }
              return supabase.from('Canteen_Member').update({ Due: item.newDue }).eq('BD No', item.bdNo);
            })
          );
        }

        // 2. Remove associated transactions and record tombstones so they NEVER return
        try {
          const rawTxs = localStorage.getItem('canteen_txs');
          let txs: any[] = rawTxs ? JSON.parse(rawTxs) : [];
          try {
            const cloudTxs = await pullKeyFromCloud('canteen_txs');
            if (Array.isArray(cloudTxs) && cloudTxs.length > txs.length) {
              txs = cloudTxs;
            }
          } catch {}

          const txIdSet = new Set((batch.createdTransactionIds || []).map(String));
          const itemBdSet = new Set<string>();
          batch.items.forEach((i) => {
            const clean = String(i.bdNo || '').replace(/\D/g, '');
            if (clean) itemBdSet.add(clean);
            if (i.airman_id) itemBdSet.add(String(i.airman_id).toLowerCase());
          });

          const filteredTxs = txs.filter((t: any) => {
            if (txIdSet.has(String(t.id))) {
              recordDeletedTxId(t.id);
              return false;
            }
            const tBd = String(t.bdNo || '').replace(/\D/g, '');
            const tAirman = String(t.airman_id || '').toLowerCase();
            const isInitial = t.type === 'INITIAL_BILL' || 
              String(t.items || '').includes('বকেয়া বিল') ||
              String(t.items || '').includes('ক্যান্টিন বিল') ||
              String(t.items || '').includes('ইউনিট ফান্ড') ||
              String(t.items || '').includes('অন্যান্য ফান্ড') ||
              (t.type === 'BILL PAYMENT' && t.gateway === 'ADVANCE');

            if (isInitial && (itemBdSet.has(tBd) || itemBdSet.has(tAirman))) {
              const tMonth = getTxMonthKey(t.date);
              if (!batch.targetMonth || tMonth === batch.targetMonth || (batch.lastMonth && tMonth === batch.lastMonth)) {
                recordDeletedTxId(t.id);
                return false;
              }
            }
            return true;
          });

          localStorage.setItem('canteen_txs', JSON.stringify(filteredTxs));
          await pushKeyToCloud('canteen_txs', filteredTxs);
        } catch (e) {
          console.warn('Failed removing txs on rollback:', e);
        }

        const updatedList = sortCanteenMembersByOfficeSeniority(Array.from(uniqueMembersMap.values()));
        try {
          localStorage.setItem('canteen_members_cache', JSON.stringify(updatedList));
        } catch {}

        onSuccess(updatedList);
      }

      // 3. Remove batch from history
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
          ? `ইম্পোর্ট ব্যাচ (${batch.displayDate}) সফলভাবে মুছে ফেলা হয়েছে এবং সকল সদস্যের বকেয়া রিভার্স করা হয়েছে!`
          : `ইম্পোর্ট হিস্টোরি রেকর্ড সফলভাবে মুছে ফেলা হয়েছে!`
      );
    } catch (err: any) {
      setErrorMessage(`রিভার্স ব্যর্থ হয়েছে: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsRollingBack(false);
    }
  };

  // Reset ALL initial bills for all members (One-Click Clean Slate)
  const handleResetAllMembersDues = async () => {
    setIsResettingAll(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      // 1. Reset Due to 0 in Supabase for all members unconditionally
      const { error } = await supabase.from('Canteen_Member').update({ Due: 0 }).neq('airman_id', '');
      if (error) {
        console.warn('Supabase reset Due warning:', error);
      }

      // 2. Remove all INITIAL_BILL transactions from canteen_txs
      try {
        const rawTxs = localStorage.getItem('canteen_txs');
        let txs: any[] = rawTxs ? JSON.parse(rawTxs) : [];
        try {
          const cloudTxs = await pullKeyFromCloud('canteen_txs');
          if (Array.isArray(cloudTxs) && cloudTxs.length > txs.length) {
            txs = cloudTxs;
          }
        } catch {}

        const filteredTxs = txs.filter((t: any) => {
          const isInitial = t.type === 'INITIAL_BILL' || 
            String(t.items || '').includes('বকেয়া বিল') ||
            String(t.items || '').includes('ক্যান্টিন বিল') ||
            String(t.items || '').includes('ইউনিট ফান্ড') ||
            String(t.items || '').includes('অন্যান্য ফান্ড') ||
            (t.type === 'BILL PAYMENT' && t.gateway === 'ADVANCE');
          if (isInitial) {
            recordDeletedTxId(t.id);
            return false;
          }
          return true;
        });
        localStorage.setItem('canteen_txs', JSON.stringify(filteredTxs));
        await pushKeyToCloud('canteen_txs', filteredTxs);
      } catch (txErr) {
        console.warn('Error clearing txs on reset all:', txErr);
      }

      // 3. Clear members cache & state (strictly deduplicated)
      const seen = new Set<string>();
      const updatedMembers: any[] = [];
      members.forEach((m) => {
        const key = String(m.airman_id || m['BD No'] || '').trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          updatedMembers.push({ ...m, Due: 0, due: 0, baki: 0, Advance: 0, advance: 0, ogrim: 0 });
        }
      });
      const sortedCleaned = sortCanteenMembersByOfficeSeniority(updatedMembers);
      try {
        localStorage.setItem('canteen_members_cache', JSON.stringify(sortedCleaned));
      } catch {}

      // 4. Clear import history
      localStorage.setItem('canteen_bill_import_history', '[]');
      await pushKeyToCloud('canteen_bill_import_history', []);
      setImportHistory([]);

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      onSuccess(sortedCleaned);
      setShowResetAllConfirm(false);
      setSuccessMessage('সকল সদস্যের পূর্ববর্তী সকল বকেয়া ও বিল সফলভাবে মুছে ৳০ (শূন্য) করা হয়েছে!');
    } catch (err: any) {
      setErrorMessage(`বকেয়া রিসেট করতে সমস্যা হয়েছে: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsResettingAll(false);
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
                  {detectedMonthsList.length > 0 ? detectedMonthsList.map(m => formatShortMonth(m)).join(', ') : 'AUTO'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-bold">
                Due (Last Month), Advance (Last Month), Due (This Month), Unit Fund ও Others ফরম্যাটে বিল ইম্পোর্ট
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
          {/* Smart Auto-Detect Month Banner */}
          {activeTab !== 'HISTORY' && (
            <div className="p-3 sm:p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-indigo-200 shadow-xs">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">
                    স্বয়ংক্রিয় মাস সনাক্তকরণ (Auto-Detect Month)
                  </span>
                  <p className="text-[11px] text-slate-300 font-bold truncate">
                    এক্সেল বা টেক্সটে উল্লেখিত মাস অনুযায়ী (যেমন Aug, Sep) স্বয়ংক্রিয়ভাবে বিল যোগ হবে
                  </p>
                </div>
              </div>

              {detectedMonthsList.length > 0 && (
                <div className="flex items-center space-x-2 shrink-0 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">সনাক্তকৃত মাস:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {detectedMonthsList.map((m) => (
                      <span key={m} className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-black">
                        {formatShortMonth(m)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

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

                <div className="flex items-center space-x-2 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowResetAllConfirm(true)}
                    className="px-3 py-1.5 bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 border border-rose-500/30 transition-all cursor-pointer shadow-sm"
                    title="Reset all member dues to 0 and clear initial bills"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>সকলের বকেয়া রিসেট (Reset All Dues)</span>
                  </button>

                  {importHistory.length > 0 && (
                    <div className="relative w-full sm:w-52">
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
                              <table className="w-full text-left text-xs text-slate-300 min-w-[680px]">
                                <thead className="bg-slate-950 text-slate-400 text-[10px] font-black uppercase tracking-wider sticky top-0 border-b border-slate-800">
                                  <tr>
                                    <th className="px-3 py-2">#</th>
                                    <th className="px-3 py-2">BD No</th>
                                    <th className="px-3 py-2">Member</th>
                                    <th className="px-3 py-2 text-right font-mono">Due (Last Month)</th>
                                    <th className="px-3 py-2 text-right font-mono">Adv (Last Month)</th>
                                    <th className="px-3 py-2 text-right font-mono">Due (This Month)</th>
                                    <th className="px-3 py-2 text-right font-mono">Unit Fund</th>
                                    <th className="px-3 py-2 text-right font-mono">Others</th>
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
                                      <td className="px-3 py-1.5 text-right font-mono text-purple-400">
                                        ৳{item.unitFund || 0}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-mono text-indigo-400">
                                        ৳{item.othersFund || 0}
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
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
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
                    Due (Last Month)
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-300 font-mono">৳{stats.totalDueLastMonth.toLocaleString()}</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider block truncate">
                    Advance (Last Month)
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-300 font-mono">৳{stats.totalAdvanceLastMonth.toLocaleString()}</span>
                </div>
                <div className="bg-sky-950/30 border border-sky-500/20 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider block truncate">
                    Due (This Month)
                  </span>
                  <span className="text-base sm:text-lg font-black text-sky-300 font-mono">৳{stats.totalDueThisMonth.toLocaleString()}</span>
                </div>
                <div className="bg-purple-950/30 border border-purple-500/20 rounded-xl p-3 text-center">
                  <span className="text-[10px] font-black text-purple-400 uppercase tracking-wider block truncate">
                    Unit Fund
                  </span>
                  <span className="text-base sm:text-lg font-black text-purple-300 font-mono">৳{stats.totalUnitFund.toLocaleString()}</span>
                </div>
                <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider block truncate">
                    Others
                  </span>
                  <span className="text-base sm:text-lg font-black text-indigo-300 font-mono">৳{stats.totalOthersFund.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Preview Table (On FILE or PASTE tab after rows parsed) */}
          {activeTab !== 'HISTORY' && parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    ডাটা প্রিভিউ ({filteredPreview.length} / {parsedRows.length})
                  </h4>
                  <div className="flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-bold">
                    <ArrowLeftRight className="w-3 h-3 text-indigo-400 shrink-0 animate-pulse" />
                    <span>বামে-ডানে স্ক্রোল করে দেখুন (Swipe ⇄)</span>
                  </div>
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

              {/* Scrollable Container with overflow-x-auto & touch-pan-x for Mobile */}
              <div className="border border-slate-800 rounded-2xl max-h-64 sm:max-h-80 overflow-y-auto overflow-x-auto touch-pan-x scrollbar-thin scrollbar-thumb-slate-700 bg-slate-950/40">
                <table className="w-full text-left text-xs text-slate-300 min-w-[860px] border-collapse">
                  <thead className="bg-slate-950 text-slate-400 uppercase font-black text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                    <tr>
                      <th className="px-3 py-2.5 whitespace-nowrap bg-slate-950">#</th>
                      <th className="px-3 py-2.5 whitespace-nowrap bg-slate-950">BD No</th>
                      <th className="px-3 py-2.5 whitespace-nowrap bg-slate-950">Member</th>
                      <th className="px-3 py-2.5 whitespace-nowrap bg-slate-950 text-indigo-400">Month (মাস)</th>
                      <th className="px-3 py-2.5 text-right font-mono whitespace-nowrap bg-slate-950">
                        Due (Last Month)
                      </th>
                      <th className="px-3 py-2.5 text-right font-mono whitespace-nowrap bg-slate-950">
                        Advance (Last Month)
                      </th>
                      <th className="px-3 py-2.5 text-right font-mono whitespace-nowrap bg-slate-950">
                        Due (This Month)
                      </th>
                      <th className="px-3 py-2.5 text-right font-mono whitespace-nowrap bg-slate-950">
                        Unit Fund
                      </th>
                      <th className="px-3 py-2.5 text-right font-mono whitespace-nowrap bg-slate-950">
                        Others
                      </th>
                      <th className="px-3 py-2.5 text-right font-mono whitespace-nowrap bg-slate-950">সর্বমোট বকেয়া (Total Due)</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap bg-slate-950">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {filteredPreview.map((row, idx) => {
                      const resultingDue = importMode === 'SET'
                        ? row.totalDue
                        : (row.currentDue + row.totalDue);

                      return (
                        <tr key={row.id || idx} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-3 py-2 text-slate-500 font-mono whitespace-nowrap">{row.sl ?? (idx + 1)}</td>
                          <td className="px-3 py-2 font-mono font-bold text-white whitespace-nowrap">#{row.bdNo}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.member ? (
                              <span className="font-bold text-white">
                                {row.member['Rank']} {row.member['Surname']}
                              </span>
                            ) : (
                              <span className="text-amber-400 font-bold italic">সদস্য পাওয়া যায়নি</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 font-mono font-black text-indigo-300 text-[10px]">
                              {formatShortMonth(row.targetMonth)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-amber-300 whitespace-nowrap">
                            ৳{row.dueLastMonth || 0}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-emerald-400 whitespace-nowrap">
                            ৳{row.advanceLastMonth || 0}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-sky-300 whitespace-nowrap">
                            ৳{row.dueThisMonth || 0}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-purple-300 whitespace-nowrap">
                            ৳{row.unitFund || 0}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-indigo-300 whitespace-nowrap">
                            ৳{row.othersFund || 0}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-black text-rose-300 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-200">
                              ৳{resultingDue}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
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
        <AnimatePresence>
          {rollbackBatch && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-[90] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.88, y: 24, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                className="bg-slate-900 border border-rose-500/30 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-rose-500 to-red-600" />
                <div className="flex items-start space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <AlertTriangle className="w-6 h-6 animate-pulse" />
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
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer active:scale-95"
                  >
                    বাতিল (Cancel)
                  </button>

                  <button
                    type="button"
                    disabled={isRollingBack}
                    onClick={() => handleRollbackBatch(rollbackBatch, true)}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95"
                  >
                    {isRollingBack ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>বকেয়া রিভার্স হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>সকলের বকেয়া রিভার্স ও রিমুভ (Revert Dues & Remove)</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reset All Member Dues Confirmation Dialog */}
        <AnimatePresence>
          {showResetAllConfirm && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-md z-[90] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.88, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.88, y: 24, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4 relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />
                <div className="flex items-start space-x-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <AlertTriangle className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                      RESET ALL MEMBER DUES TO ৳০?
                    </h3>
                    <p className="text-xs text-slate-400 font-bold mt-0.5">
                      সকল সদস্যের বকেয়া ও ইম্পোর্ট হিস্টোরি সম্পূর্ণ রিসেট
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs space-y-2 font-bold leading-relaxed text-slate-300">
                  <p>
                    ⚠️ আপনি কি নিশ্চিত যে আপনি ডেটাবেজের <strong className="text-rose-400">সকল ৭৬ জন সদস্যের বকেয়া শূন্য (৳০)</strong> করতে চান এবং পূর্ববর্তী সকল প্রাথমিক বকেয়া ট্রানজেকশন ও ইম্পোর্ট হিস্টোরি ক্লিয়ার করতে চান?
                  </p>
                  <p className="text-[11px] text-amber-300">
                    এটি করলে পুরো সিস্টেম সম্পূর্ণ ফ্রেশ অবস্থায় চলে আসবে এবং আপনি নতুন ৯-কলামের এক্সেল ফাইল দিয়ে নতুন করে বিল ইম্পোর্ট করতে পারবেন।
                  </p>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={isResettingAll}
                    onClick={() => setShowResetAllConfirm(false)}
                    className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer active:scale-95"
                  >
                    বাতিল (Cancel)
                  </button>

                  <button
                    type="button"
                    disabled={isResettingAll}
                    onClick={handleResetAllMembersDues}
                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/30 flex items-center justify-center space-x-2 transition-all cursor-pointer active:scale-95"
                  >
                    {isResettingAll ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>রিসেট হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4" />
                        <span>হ্যাঁ, সকলের বকেয়া শূন্য করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

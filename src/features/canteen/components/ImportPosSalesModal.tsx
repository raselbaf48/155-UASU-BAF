import React, { useState, useRef, useMemo } from 'react';
import { 
  X, Upload, FileSpreadsheet, Download, CheckCircle2, 
  AlertCircle, AlertTriangle, ArrowRight, Loader2, RefreshCw,
  Search, Check, Trash2, ShoppingCart, UserCheck, DollarSign,
  Calendar, ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../supabase';
import { pushKeyToCloud } from '../utils/canteenCloudSync';
import { deductRawStockForSales } from '../utils/recipeManager';
import { getCanteenMenuCache, setCanteenMenuCache, normalizeCatalogKey, isOneTimeBoxItem } from '../utils/canteenMenuData';
import { formatCanteenDate, toYMDDate } from '../utils/dateUtils';
import { sortCanteenMembersByOfficeSeniority } from '../utils/canteenSeniority';
import { formatRankBn, formatMemberNameBn, toBengaliNum } from '../utils/exportCanteenBillExcel';
import { DEFAULT_MEMBER_BANGLA_NAMES } from '../utils/memberBanglaNames';
import { getMenuItemBanglaName } from '../utils/menuBanglaNames';

interface ImportPosSalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: any[];
  catalog: any[];
  onImportComplete?: () => void;
}

interface ParsedSaleRow {
  rowId: string;
  date: string;
  bdNo: string;
  rank: string;
  memberName: string;
  matchedMember: any | null;
  menuItemName: string;
  matchedMenuItem: any | null;
  qty: number;
  unitPrice: number;
  discount: number;
  totalAmount: number;
  paymentMode: 'DUE' | 'PAID';
  remarks?: string;
  isValid: boolean;
  warning?: string;
  selected: boolean;
  sourceSheet?: string;
}

// Official 27 food columns matching 155 UASU BAF Canteen daily matrix sheet
const OFFICIAL_MATRIX_FOOD_COLUMNS = [
  { bn: 'পরোটা', enMatch: 'porata', price: 10 },
  { bn: 'ডিম ভাজি', enMatch: 'egg fry', price: 15 },
  { bn: 'ডিম পোচ', enMatch: 'egg poach', price: 15 },
  { bn: 'ডিম সিদ্ধ', enMatch: 'boiled egg', price: 15 },
  { bn: 'দুধ চা', enMatch: 'milk tea', price: 10 },
  { bn: 'রং চা', enMatch: 'liquor tea', price: 6 },
  { bn: 'ব্ল্যাক কফি', enMatch: 'black coffee', price: 15 },
  { bn: 'দুধ কফি', enMatch: 'milk coffee', price: 20 },
  { bn: 'গ্রীন টি', enMatch: 'green tea', price: 8 },
  { bn: 'নুডুলস', enMatch: 'noodles', price: 25 },
  { bn: 'ডিম নুডুলস', enMatch: 'egg noodles', price: 35 },
  { bn: 'ড্রাই কেক', enMatch: 'dry cake', price: 12 },
  { bn: 'নরমাল বিস্কুট', enMatch: 'normal biscuit', price: 10 },
  { bn: 'এনার্জি বিস্কুট', enMatch: 'energy biscuit', price: 15 },
  { bn: 'লেবুর শরবত', enMatch: 'lemon juice', price: 15 },
  { bn: 'স্পেশাল পোলাও / বিরিয়ানি / খিচুড়ি', enMatch: 'chicken biryani', price: 120 },
  { bn: 'ডিম খিচুড়ি', enMatch: 'egg khichuri', price: 60 },
  { bn: 'হালিম', enMatch: 'halim', price: 40 },
  { bn: 'চটপটি', enMatch: 'chotpoti', price: 30 },
  { bn: 'গ্রীল সবজি', enMatch: 'vegetable', price: 20 },
  { bn: 'অফলাতুন / হটডগ', enMatch: 'hotdog', price: 35 },
  { bn: 'সিংগারা', enMatch: 'singara', price: 8 },
  { bn: 'সুইট রোল', enMatch: 'chicken roll', price: 25 },
  { bn: 'সবজি', enMatch: 'vegetable', price: 15 },
  { bn: 'স্যান্ডউইচ', enMatch: 'sandwich', price: 30 },
  { bn: 'কলা', enMatch: 'banana', price: 10 },
  { bn: 'অন্যান্য', enMatch: 'other', price: 10 },
];

function banglaToEnglishDigits(str: any): string {
  if (typeof str === 'number') return String(str);
  if (!str) return '0';
  let s = String(str).trim();
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  for (let i = 0; i < 10; i++) {
    s = s.replace(new RegExp(bn[i], 'g'), String(i));
  }
  return s;
}

function parseBanglaNumber(val: any): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (!val) return 0;
  const converted = banglaToEnglishDigits(val);
  const cleaned = converted.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseBanglaOrEnglishDate(val: any, fallbackDate?: string): string {
  if (!val) return fallbackDate || new Date().toISOString().split('T')[0];
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  let str = String(val).trim();
  str = banglaToEnglishDigits(str);

  const months: Record<string, string> = {
    'জানুয়ারি': '01', 'জানুয়ারি': '01', 'january': '01', 'jan': '01',
    'ফেব্রুয়ারি': '02', 'ফেব্রুয়ারি': '02', 'february': '02', 'feb': '02',
    'মার্চ': '03', 'march': '03', 'mar': '03',
    'এপ্রিল': '04', 'april': '04', 'apr': '04',
    'মে': '05', 'may': '05',
    'জুন': '06', 'june': '06', 'jun': '06',
    'জুলাই': '07', 'july': '07', 'jul': '07',
    'আগস্ট': '08', 'আগষ্ট': '08', 'august': '08', 'aug': '08',
    'সেপ্টেম্বর': '09', 'september': '09', 'sep': '09',
    'অক্টোবর': '10', 'october': '10', 'oct': '10',
    'নভেম্বর': '11', 'november': '11', 'nov': '11',
    'ডিসেম্বর': '12', 'december': '12', 'dec': '12'
  };

  for (const [mName, mNum] of Object.entries(months)) {
    if (str.toLowerCase().includes(mName)) {
      const dayMatch = str.match(/\b([1-9]|[12][0-9]|3[01])\b/);
      const yearMatch = str.match(/\b(20\d\d)\b/);
      const year = yearMatch ? yearMatch[1] : String(new Date().getFullYear());
      const day = dayMatch ? dayMatch[1].padStart(2, '0') : '01';
      return `${year}-${mNum}-${day}`;
    }
  }

  const ymd = toYMDDate(str);
  if (ymd) return ymd;

  return fallbackDate || new Date().toISOString().split('T')[0];
}

function matchFoodHeaderToCatalog(header: string, catalog: any[]): any {
  if (!header) return null;
  const cleanHeader = header.trim().toLowerCase();

  const aliases: Array<{ match: RegExp | string; catalogKey: string }> = [
    { match: /পরোটা|porata|paratha|c‡ivUv/i, catalogKey: 'porata' },
    { match: /ডিম ভাজি|ভাজি ডিম|dim vaji|egg fry|omlet|omelet|mumlet|wWg fvwR|wWgfvwR/i, catalogKey: 'egg fry' },
    { match: /ডিম পোচ|পোচ|poach|wWg †cvP/i, catalogKey: 'egg poach' },
    { match: /ডিম সিদ্ধ|সিদ্ধ ডিম|boiled egg|wWg wm×/i, catalogKey: 'boiled egg' },
    { match: /দুধ চা|milk tea|`ya Pv|`yaPv/i, catalogKey: 'milk tea' },
    { match: /রং চা|রঙ চা|লিকার চা|liquor tea|raw tea|is Pv|isPv|wjsKvi/i, catalogKey: 'liquor tea' },
    { match: /ব্ল্যাক কফি|black coffee|eø¨vK Kwd/i, catalogKey: 'black coffee' },
    { match: /দুধ কফি|milk coffee|`ya Kwd/i, catalogKey: 'milk coffee' },
    { match: /গ্রীন টি|গ্রিন টি|green tea|MÖxb wU/i, catalogKey: 'green tea' },
    { match: /ডিম নুডুলস|ডিম নুডলস|egg noodles|wWg byWjm/i, catalogKey: 'egg noodles' },
    { match: /নুডুলস|নুডলস|noodles|byWjm/i, catalogKey: 'noodles' },
    { match: /ড্রাই কেক|কেক|dry cake|WªvB †KK/i, catalogKey: 'dry cake' },
    { match: /নরমাল বিস্কুট|normal biscuit|bigvj we¯‹zU/i, catalogKey: 'normal biscuit' },
    { match: /এনার্জি বিস্কুট|energy biscuit|GbvwR© we¯‹zU/i, catalogKey: 'energy biscuit' },
    { match: /লেবুর শরবত|লেবুর জুস|lemon juice|‡jeyi kieZ/i, catalogKey: 'lemon juice' },
    { match: /পোলাও|বিরিয়ানি|বিরিয়ানি|পোলাও.*বিরিয়ানি|polao|pulaw|biryani|biriyani|‡cvjvI|weBrain|wewiqvwb/i, catalogKey: 'chicken biryani' },
    { match: /ডিম খিচুড়ি|ডিম খিচুড়ি|egg khichuri|egg khicuri|wWg wLPzwo/i, catalogKey: 'egg khichuri' },
    { match: /খিচুড়ি|খিচুড়ি|khichuri|wLPzwo/i, catalogKey: 'khichuri' },
    { match: /হালিম|halim|nvwjg/i, catalogKey: 'halim' },
    { match: /চটপটি|chotpoti|PUcwU/i, catalogKey: 'chotpoti' },
    { match: /গ্রীল সবজি|সবজি|shobji|vegetable|mewR/i, catalogKey: 'vegetable' },
    { match: /হটডগ|অফলাতুন|hotdog|nUWM|AdjvZzb/i, catalogKey: 'hotdog' },
    { match: /সিংগারা|সিঙ্গারা|singara|wmsMviv/i, catalogKey: 'singara' },
    { match: /সুইট রোল|চিকেন রোল|রোল|roll|myBU †ivj|†ivj/i, catalogKey: 'chicken roll' },
    { match: /স্যান্ডউইচ|sandwich|sanwitch|m¨vÛDBP/i, catalogKey: 'sandwich' },
    { match: /কলা|banana|Kjv/i, catalogKey: 'banana' },
    { match: /অন্যান্য|other|misc|Ab¨vb¨/i, catalogKey: 'other' },
  ];

  for (const item of catalog) {
    const enName = (item.name || item.name_en || '').toLowerCase();
    const bnName = (item.name_bn || item.nameBn || item['Name (BN)'] || getMenuItemBanglaName(item) || '').toLowerCase();
    if (cleanHeader === enName || cleanHeader === bnName || enName.includes(cleanHeader) || bnName.includes(cleanHeader)) {
      return item;
    }
  }

  for (const alias of aliases) {
    const matches = typeof alias.match === 'string' ? cleanHeader.includes(alias.match) : alias.match.test(cleanHeader);
    if (matches) {
      const found = catalog.find((c: any) => {
        const en = (c.name || c.name_en || '').toLowerCase();
        const bn = (c.name_bn || c.nameBn || c['Name (BN)'] || getMenuItemBanglaName(c) || '').toLowerCase();
        return en.includes(alias.catalogKey) || bn.includes(alias.catalogKey);
      });
      if (found) return found;
    }
  }

  return null;
}

function findMemberByRankAndName(rankVal: string, nameVal: string, members: any[]): any {
  if (!nameVal && !rankVal) return null;
  const cleanName = String(nameVal || '').trim().toLowerCase();
  const cleanRank = String(rankVal || '').trim().toLowerCase();

  const bdMatch = cleanName.match(/\b(\d{4,7})\b/) || cleanRank.match(/\b(\d{4,7})\b/);
  if (bdMatch) {
    const mem = members.find(m => String(m['BD No'] || m.airman_id || '').includes(bdMatch[1]));
    if (mem) return mem;
  }

  for (const m of members) {
    const mBn = String(m.name_bn || m.NameBn || formatMemberNameBn(m.Surname || m.Name) || '').trim().toLowerCase();
    const mEn = String(m.Surname || m.Name || '').trim().toLowerCase();
    if (cleanName && (cleanName === mBn || mBn.includes(cleanName) || cleanName.includes(mBn))) {
      return m;
    }
    if (cleanName && (cleanName === mEn || mEn.includes(cleanName) || cleanName.includes(mEn))) {
      return m;
    }
  }

  for (const m of members) {
    const bd = String(m['BD No'] || m.airman_id || '').trim();
    const cleanBd = bd.replace(/\D/g, '');
    const mappedBn = DEFAULT_MEMBER_BANGLA_NAMES[bd] || DEFAULT_MEMBER_BANGLA_NAMES[cleanBd] || DEFAULT_MEMBER_BANGLA_NAMES[`BD/${cleanBd}`];
    if (mappedBn && cleanName && (mappedBn.toLowerCase() === cleanName || mappedBn.toLowerCase().includes(cleanName) || cleanName.includes(mappedBn.toLowerCase()))) {
      return m;
    }
  }

  for (const m of members) {
    const mRank = String(m.Rank || m.rank || '').toLowerCase();
    const mSurname = String(m.Surname || m.Name || '').toLowerCase();
    if (cleanRank && mRank && (cleanRank.includes(mRank) || mRank.includes(cleanRank))) {
      if (cleanName && mSurname && (mSurname.includes(cleanName) || cleanName.includes(mSurname))) {
        return m;
      }
    }
  }

  return null;
}

export const ImportPosSalesModal: React.FC<ImportPosSalesModalProps> = ({
  isOpen,
  onClose,
  members,
  catalog,
  onImportComplete,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedSaleRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<'MEMBER_WISE_MATRIX' | 'DATE_WISE_MATRIX' | 'LIST' | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'VALID' | 'WARNING'>('ALL');
  const [dateTemplateMemberId, setDateTemplateMemberId] = useState<string>('ALL');
  
  // Options
  const [updateMemberDue, setUpdateMemberDue] = useState(true);
  const [deductStock, setDeductStock] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Generate and download Official 155 UASU BAF Daily Canteen Bill Matrix Template
  const handleDownloadOfficialMatrixTemplate = () => {
    try {
      const sortedMembers = sortCanteenMembersByOfficeSeniority(members);
      const rows: any[][] = [];

      // Row 1: Empty spacer
      rows.push([]);

      // Row 2: Title Banner (Col C onwards)
      const titleRow = new Array(30).fill('');
      titleRow[3] = 'ক্যান্টিন বিল : ১৫৫ ইউএএসইউ বিএএফ';
      rows.push(titleRow);

      // Row 3: Date Banner (Top Right)
      const dateRow = new Array(30).fill('');
      const todayDate = new Date();
      const todayStrBn = `${toBengaliNum(todayDate.getDate())} অক্টোবর ২০২৬`;
      dateRow[24] = 'তারিখ';
      dateRow[25] = todayStrBn;
      rows.push(dateRow);

      // Row 4: Empty spacer
      rows.push([]);

      // Row 5: Column Headers matching official sheet
      const headerRow = [
        '',
        'ক্রমিক নং',
        'পদবী',
        'নাম',
        ...OFFICIAL_MATRIX_FOOD_COLUMNS.map(c => c.bn),
        'মোট বিল'
      ];
      rows.push(headerRow);

      // Rows 6+: Member data rows in official seniority order
      sortedMembers.forEach((m, idx) => {
        const serBn = toBengaliNum(idx + 1);
        const rankBn = formatRankBn(m.Rank || m.rank || '');
        const memberNameBn = m.name_bn || m.NameBn || formatMemberNameBn(m.Surname || m.Name || '') || m.Surname || m.Name || '';

        const rowData = [
          '',
          serBn,
          rankBn,
          memberNameBn,
          // Pre-fill a couple sample consumption items on first 3 rows so user sees how it works
          idx === 0 ? 2 : (idx === 1 ? 1 : ''), // পরোটা
          idx === 0 ? 1 : (idx === 2 ? 1 : ''), // ডিম ভাজি
          '', // ডিম পোচ
          idx === 1 ? 1 : '', // ডিম সিদ্ধ
          idx === 0 ? 1 : (idx === 1 ? 2 : ''), // দুধ চা
          ...new Array(OFFICIAL_MATRIX_FOOD_COLUMNS.length - 5).fill(''),
          idx === 0 ? 45 : (idx === 1 ? 35 : (idx === 2 ? 15 : 0)) // মোট বিল
        ];
        rows.push(rowData);
      });

      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      // Freeze header pane so Row 5 stays visible
      worksheet['!views'] = [{ state: 'frozen', ySplit: 5, xSplit: 0, activePane: 'bottomLeft' }];
      worksheet['!freeze'] = { xSplit: 0, ySplit: 5 };

      // Set column widths
      worksheet['!cols'] = [
        { wch: 3 },  // Col A
        { wch: 10 }, // ক্রমিক নং
        { wch: 14 }, // পদবী
        { wch: 18 }, // নাম
        ...OFFICIAL_MATRIX_FOOD_COLUMNS.map(() => ({ wch: 12 })),
        { wch: 14 }  // মোট বিল
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, '1'); // Tab name "1" matching daily tabs

      // Add a second day tab "2" for multi-day demonstration
      const worksheetDay2 = XLSX.utils.aoa_to_sheet([
        [],
        ['', '', '', 'ক্যান্টিন বিল : ১৫৫ ইউএএসইউ বিএএফ'],
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'তারিখ', '২ অক্টোবর ২০২৬'],
        [],
        headerRow,
        ...sortedMembers.slice(0, 15).map((m, idx) => [
          '',
          toBengaliNum(idx + 1),
          formatRankBn(m.Rank || m.rank || ''),
          m.name_bn || m.NameBn || formatMemberNameBn(m.Surname || m.Name || '') || m.Surname || m.Name || '',
          idx === 0 ? 1 : '',
          idx === 0 ? 1 : '',
          '', '', '',
          ...new Array(OFFICIAL_MATRIX_FOOD_COLUMNS.length - 5).fill(''),
          idx === 0 ? 25 : 0
        ])
      ]);
      worksheetDay2['!cols'] = worksheet['!cols'];
      XLSX.utils.book_append_sheet(workbook, worksheetDay2, '2');

      const dateStr = new Date().toISOString().split('T')[0];
      XLSX.writeFile(workbook, `155_UASU_Canteen_MemberWise_Daily_Bill_Matrix_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Failed to download official matrix template:', err);
      setErrorMessage('Failed to generate template file. Please try again.');
    }
  };

  // Generate and download Template 2: Date-wise Matrix Template (Member Fixed, Left: 1-31 Date)
  const handleDownloadDateWiseMatrixTemplate = (overrideMemberId?: string) => {
    try {
      const targetMemberId = overrideMemberId || dateTemplateMemberId;
      const sortedMembers = sortCanteenMembersByOfficeSeniority(members);
      const workbook = XLSX.utils.book_new();
      const daysInMonth = 31; // Monthly 31-day ledger

      // Header row for Date-wise matrix (Col 1: Sl, Col 2: Date, Col 3..: Food items)
      const dateHeaderRow = [
        '',
        'ক্রমিক নং',
        'তারিখ',
        ...OFFICIAL_MATRIX_FOOD_COLUMNS.map(c => c.bn),
        'মোট বিল'
      ];

      // If specific member selected, generate single sheet. If ALL, generate for unit members
      let membersToGenerate: any[] = [];
      if (targetMemberId && targetMemberId !== 'ALL') {
        const found = sortedMembers.find(m => String(m.airman_id || m['BD No'] || '').toLowerCase() === targetMemberId.toLowerCase());
        membersToGenerate = found ? [found] : sortedMembers.slice(0, 10);
      } else {
        membersToGenerate = sortedMembers.slice(0, Math.min(15, sortedMembers.length));
      }

      membersToGenerate.forEach((m, mIdx) => {
        const rankBn = formatRankBn(m.Rank || m.rank || '');
        const memberNameBn = m.name_bn || m.NameBn || formatMemberNameBn(m.Surname || m.Name || '') || m.Surname || m.Name || '';
        const bdNo = String(m['BD No'] || m.airman_id || '');
        const cleanBd = bdNo.replace(/\D/g, '') || `BD-${mIdx + 1}`;

        const rows: any[][] = [];
        // Row 1: Title
        rows.push(['', '', '', 'ক্যান্টিন বিল (মাসিক তারিখ ভিত্তিক শিট) : ১৫৫ ইউএএসইউ বিএএফ']);
        // Row 2: Member fixed info
        rows.push([
          '',
          '',
          `সদস্য: ${rankBn} ${memberNameBn}`,
          `বিডি নং: ${bdNo}`,
          '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          'মাস:',
          'অক্টোবর ২০২৬'
        ]);
        // Row 3: Spacer
        rows.push([]);
        // Row 4: Column Headers
        rows.push(dateHeaderRow);

        // Rows 5..35: Days 1 to 31
        for (let d = 1; d <= daysInMonth; d++) {
          const dStrBn = `${toBengaliNum(d)} অক্টোবর ২০২৬`;
          const rowData = [
            '',
            toBengaliNum(d),
            dStrBn,
            // Sample consumption on day 1 & day 2 for demonstration
            (d === 1 && mIdx === 0) ? 2 : (d === 2 && mIdx === 0 ? 1 : ''), // পরোটা
            (d === 1 && mIdx === 0) ? 1 : '', // ডিম ভাজি
            '', // ডিম পোচ
            '', // ডিম সিদ্ধ
            (d === 1 && mIdx === 0) ? 1 : (d === 2 && mIdx === 0 ? 2 : ''), // দুধ চা
            ...new Array(OFFICIAL_MATRIX_FOOD_COLUMNS.length - 5).fill(''),
            (d === 1 && mIdx === 0) ? 45 : (d === 2 && mIdx === 0 ? 30 : 0) // মোট বিল
          ];
          rows.push(rowData);
        }

        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws['!views'] = [{ state: 'frozen', ySplit: 4, xSplit: 0, activePane: 'bottomLeft' }];
        ws['!freeze'] = { xSplit: 0, ySplit: 4 };
        ws['!cols'] = [
          { wch: 3 },  // Col A
          { wch: 10 }, // ক্রমিক নং
          { wch: 18 }, // তারিখ
          ...OFFICIAL_MATRIX_FOOD_COLUMNS.map(() => ({ wch: 12 })),
          { wch: 14 }  // মোট বিল
        ];

        const tabTitle = `${memberNameBn.slice(0, 10)} (${cleanBd.slice(-4)})`.replace(/[\\/?*:[\]]/g, '');
        XLSX.utils.book_append_sheet(workbook, ws, tabTitle || `Member_${mIdx + 1}`);
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const memberSuffix = (targetMemberId && targetMemberId !== 'ALL' && membersToGenerate[0])
        ? `_${(membersToGenerate[0].Surname || 'Member').replace(/\s+/g, '_')}`
        : '_MultiMembers';
      XLSX.writeFile(workbook, `155_UASU_Canteen_DateWise_Bill_Matrix${memberSuffix}_${dateStr}.xlsx`);
    } catch (err: any) {
      console.error('Failed to download date-wise matrix template:', err);
      setErrorMessage('Failed to generate Date-wise template.');
    }
  };

  // Download Standard Flat List Template (Alternative)
  const handleDownloadStandardListTemplate = () => {
    try {
      const templateData = [
        {
          'Date (YYYY-MM-DD)': new Date().toISOString().split('T')[0],
          'BD No': 'BD/470696',
          'Rank': 'SWO',
          'Member Name': 'Moshiur',
          'Menu Item': 'PORATA',
          'Quantity': 2,
          'Unit Price': 10,
          'Discount': 0,
          'Total Amount': 20,
          'Payment Mode (DUE/PAID)': 'DUE',
          'Remarks': 'Breakfast'
        },
        {
          'Date (YYYY-MM-DD)': new Date().toISOString().split('T')[0],
          'BD No': 'BD/465170',
          'Rank': 'WO',
          'Member Name': 'Jahid',
          'Menu Item': 'MILK TEA',
          'Quantity': 1,
          'Unit Price': 10,
          'Discount': 0,
          'Total Amount': 10,
          'Payment Mode (DUE/PAID)': 'DUE',
          'Remarks': 'Evening Tea'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      worksheet['!cols'] = [
        { wch: 18 }, { wch: 15 }, { wch: 12 }, { wch: 22 },
        { wch: 24 }, { wch: 12 }, { wch: 14 }, { wch: 12 },
        { wch: 16 }, { wch: 22 }, { wch: 20 }
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'POS_List_Template');
      XLSX.writeFile(workbook, `POS_Sales_List_Template_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err: any) {
      console.error('Failed to download list template:', err);
    }
  };

  const normalizeMode = (val: any): 'DUE' | 'PAID' => {
    const s = String(val || '').toUpperCase().trim();
    if (s.includes('PAID') || s.includes('CASH') || s.includes('নগদ') || s.includes('পরিশোধ')) {
      return 'PAID';
    }
    return 'DUE';
  };

  const processFile = async (uploadedFile: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setFile(uploadedFile);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const catalogList = catalog.filter((it: any) => !isOneTimeBoxItem(it));

      const memberMap = new Map<string, any>();
      members.forEach((m: any) => {
        const id = String(m.airman_id || '').toLowerCase().trim();
        const bd = String(m['BD No'] || m.bdNo || '').toLowerCase().trim();
        if (id) memberMap.set(id, m);
        if (bd) memberMap.set(bd, m);
      });

      const extractedRows: ParsedSaleRow[] = [];
      let foundMatrixFormat = false;
      let hasMemberWise = false;
      let hasDateWise = false;

      // Scan all sheets in the workbook (supports multi-day sheets like 1, 2, 3...)
      for (const sheetName of workbook.SheetNames) {
        // Skip summary chit or menu price reference sheets
        const sNameUpper = sheetName.toUpperCase();
        if (sNameUpper.includes('MENU PRICE') || sNameUpper.includes('FINAL CHIT')) {
          continue;
        }

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rawMatrix: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (rawMatrix.length < 2) continue;

        // Step 1: Detect if this sheet is in Matrix format
        let matrixHeaderRowIdx = -1;
        let colRankIdx = -1;
        let colNameIdx = -1;
        let colSerIdx = -1;

        for (let rIdx = 0; rIdx < Math.min(rawMatrix.length, 12); rIdx++) {
          const row = rawMatrix[rIdx];
          if (!Array.isArray(row)) continue;

          for (let cIdx = 0; cIdx < row.length; cIdx++) {
            const cell = String(row[cIdx] || '').trim();
            if (cell.includes('পদবী') || cell.toLowerCase() === 'rank' || cell.includes('c`ex') || cell.includes('পদবি')) {
              colRankIdx = cIdx;
            }
            if (cell.includes('নাম') || cell.toLowerCase() === 'name' || cell.includes('bvg')) {
              colNameIdx = cIdx;
            }
            if (cell.includes('ক্রমিক') || cell.includes('ক্র') || cell.toLowerCase().includes('sl') || cell.toLowerCase().includes('ser') || cell.includes('µwgK')) {
              colSerIdx = cIdx;
            }
          }

          if (colRankIdx !== -1 && colNameIdx !== -1) {
            matrixHeaderRowIdx = rIdx;
            break;
          }
        }

        if (matrixHeaderRowIdx !== -1) {
          foundMatrixFormat = true;
          hasMemberWise = true;
          const headerRow = rawMatrix[matrixHeaderRowIdx];

          // Detect Sheet / Header Date
          let sheetDate = '';
          for (let r = 0; r <= matrixHeaderRowIdx; r++) {
            const row = rawMatrix[r] || [];
            for (let c = 0; c < row.length; c++) {
              const cellText = String(row[c] || '').trim();
              if (cellText.includes('তারিখ') || cellText.toLowerCase().includes('date') || cellText.includes('ZvwiL')) {
                const nextCell = String(row[c + 1] || row[c + 2] || '').trim();
                sheetDate = parseBanglaOrEnglishDate(nextCell || cellText);
                break;
              }
            }
            if (sheetDate) break;
          }

          // If no date in cells, check if sheet name is a day number (e.g. "1", "2", "15")
          if (!sheetDate) {
            const dayNum = parseInt(banglaToEnglishDigits(sheetName), 10);
            if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
              const now = new Date();
              sheetDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            } else {
              sheetDate = new Date().toISOString().split('T')[0];
            }
          }

          // Map Food Columns (columns after Col Name up to "মোট বিল")
          const foodCols: Array<{ colIdx: number; headerName: string; catalogItem: any }> = [];
          for (let c = colNameIdx + 1; c < headerRow.length; c++) {
            const hText = String(headerRow[c] || '').trim();
            if (!hText) continue;
            if (hText.includes('মোট বিল') || hText.toLowerCase().includes('total')) {
              continue; // stop at total bill column
            }
            const matchedItem = matchFoodHeaderToCatalog(hText, catalogList);
            foodCols.push({
              colIdx: c,
              headerName: hText,
              catalogItem: matchedItem
            });
          }

          // Process Member Data Rows
          for (let r = matrixHeaderRowIdx + 1; r < rawMatrix.length; r++) {
            const row = rawMatrix[r] || [];
            const rankVal = String(row[colRankIdx] || '').trim();
            const nameVal = String(row[colNameIdx] || '').trim();

            if (!nameVal && !rankVal) continue;
            if (nameVal.includes('সর্বমোট') || nameVal.includes('মোট') || rankVal.includes('মোট')) {
              break; // Reached footer total row
            }

            const matchedMem = findMemberByRankAndName(rankVal, nameVal, members);
            const bdNo = matchedMem ? (matchedMem['BD No'] || matchedMem.bdNo || matchedMem.airman_id) : '';
            const finalRank = rankVal || (matchedMem?.Rank || matchedMem?.rank || '');
            const finalName = nameVal || (matchedMem?.Surname || matchedMem?.Name || 'Member');

            // Scan each food column for consumption
            foodCols.forEach((fc) => {
              const cellVal = row[fc.colIdx];
              const qty = parseBanglaNumber(cellVal);

              if (qty > 0) {
                const unitPrice = fc.catalogItem ? Number(fc.catalogItem.price || 0) : 10;
                const totalAmount = qty * unitPrice;
                const warnings: string[] = [];

                if (!matchedMem) {
                  warnings.push(`Member "${nameVal}" not matched in DB`);
                }
                if (!fc.catalogItem) {
                  warnings.push(`Item "${fc.headerName}" not in catalog`);
                }

                extractedRows.push({
                  rowId: `pos_matrix_${sheetName}_r${r}_c${fc.colIdx}_${Date.now()}_${Math.random()}`,
                  date: sheetDate,
                  bdNo: bdNo || `N/A (${nameVal})`,
                  rank: finalRank,
                  memberName: finalName,
                  matchedMember: matchedMem || null,
                  menuItemName: fc.catalogItem?.name || fc.headerName,
                  matchedMenuItem: fc.catalogItem || null,
                  qty,
                  unitPrice,
                  discount: 0,
                  totalAmount,
                  paymentMode: 'DUE',
                  remarks: `Matrix Import: Sheet "${sheetName}"`,
                  isValid: warnings.length === 0,
                  warning: warnings.length > 0 ? warnings.join('; ') : undefined,
                  selected: true,
                  sourceSheet: sheetName
                });
              }
            });
          }
        } else {
          // Step 1B: Detect if this sheet is in Date-wise Matrix format (Member Fixed, Left: Date Col)
          let dateMatrixHeaderRowIdx = -1;
          let colDateIdx = -1;

          for (let rIdx = 0; rIdx < Math.min(rawMatrix.length, 12); rIdx++) {
            const row = rawMatrix[rIdx];
            if (!Array.isArray(row)) continue;

            for (let cIdx = 0; cIdx < row.length; cIdx++) {
              const cell = String(row[cIdx] || '').trim();
              if (
                cell.includes('তারিখ') || cell.toLowerCase() === 'date' || cell.includes('ZvwiL') ||
                cell === 'দিন' || cell.toLowerCase() === 'day'
              ) {
                let matchedFood = 0;
                for (let fc = cIdx + 1; fc < row.length; fc++) {
                  const hText = String(row[fc] || '').trim();
                  if (matchFoodHeaderToCatalog(hText, catalogList)) {
                    matchedFood++;
                  }
                }
                if (matchedFood >= 1) {
                  dateMatrixHeaderRowIdx = rIdx;
                  colDateIdx = cIdx;
                  break;
                }
              }
            }
            if (dateMatrixHeaderRowIdx !== -1) break;
          }

          if (dateMatrixHeaderRowIdx !== -1) {
            foundMatrixFormat = true;
            hasDateWise = true;
            const headerRow = rawMatrix[dateMatrixHeaderRowIdx];

            // 1. Identify Fixed Member for this sheet (from header banner cells or sheet tab name)
            let fixedRank = '';
            let fixedName = '';
            let fixedBd = '';

            const sheetBdMatch = sheetName.match(/\b(\d{4,7})\b/);
            if (sheetBdMatch) fixedBd = sheetBdMatch[1];

            for (let r = 0; r <= dateMatrixHeaderRowIdx; r++) {
              const row = rawMatrix[r] || [];
              for (let c = 0; c < row.length; c++) {
                const cellText = String(row[c] || '').trim();
                if (!cellText) continue;
                const bdMatch = cellText.match(/BD[\s\/\-_:]*(\d{4,7})/i) || cellText.match(/বিডি[\s\/\-_:]*(\d{4,7})/i) || cellText.match(/\b(\d{5,7})\b/);
                if (bdMatch && !fixedBd) {
                  fixedBd = bdMatch[1];
                }
                if (cellText.includes('সদস্য') || cellText.includes('নাম') || cellText.includes('পদবী')) {
                  const nextCell = String(row[c + 1] || row[c + 2] || '').trim();
                  const combined = `${cellText} ${nextCell}`;
                  const m = findMemberByRankAndName('', combined, members) || findMemberByRankAndName('', nextCell, members);
                  if (m) {
                    fixedRank = m.Rank || m.rank || '';
                    fixedName = m.Surname || m.Name || '';
                    if (!fixedBd) fixedBd = m['BD No'] || m.bdNo || m.airman_id;
                  }
                }
              }
            }

            let matchedMem = null;
            if (fixedBd) {
              const cleanBd = fixedBd.replace(/\D/g, '');
              matchedMem = members.find(m => String(m['BD No'] || m.airman_id || '').replace(/\D/g, '').includes(cleanBd));
            }
            if (!matchedMem && (fixedName || fixedRank)) {
              matchedMem = findMemberByRankAndName(fixedRank, fixedName, members);
            }
            if (!matchedMem) {
              matchedMem = findMemberByRankAndName('', sheetName, members);
            }

            const finalBd = matchedMem ? (matchedMem['BD No'] || matchedMem.bdNo || matchedMem.airman_id) : (fixedBd ? `BD/${fixedBd}` : 'N/A');
            const finalRank = matchedMem ? (matchedMem.Rank || matchedMem.rank || '') : (fixedRank || '');
            const finalName = matchedMem ? (matchedMem.Surname || matchedMem.Name || '') : (fixedName || sheetName);

            // 2. Identify month & year from banner or current
            let sheetYear = new Date().getFullYear();
            let sheetMonth = String(new Date().getMonth() + 1).padStart(2, '0');
            for (let r = 0; r <= dateMatrixHeaderRowIdx; r++) {
              const row = rawMatrix[r] || [];
              for (const cell of row) {
                const cStr = String(cell || '');
                const parsed = parseBanglaOrEnglishDate(cStr);
                if (parsed && parsed.length === 10) {
                  const parts = parsed.split('-');
                  sheetYear = parseInt(parts[0], 10) || sheetYear;
                  sheetMonth = parts[1] || sheetMonth;
                  break;
                }
              }
            }

            // 3. Map food columns after colDateIdx
            const foodCols: Array<{ colIdx: number; headerName: string; catalogItem: any }> = [];
            for (let c = colDateIdx + 1; c < headerRow.length; c++) {
              const hText = String(headerRow[c] || '').trim();
              if (!hText) continue;
              if (hText.includes('মোট বিল') || hText.toLowerCase().includes('total') || hText.includes('‡gvU')) {
                continue;
              }
              const matchedItem = matchFoodHeaderToCatalog(hText, catalogList);
              foodCols.push({ colIdx: c, headerName: hText, catalogItem: matchedItem });
            }

            // 4. Process each date row
            for (let r = dateMatrixHeaderRowIdx + 1; r < rawMatrix.length; r++) {
              const row = rawMatrix[r] || [];
              const dateCell = row[colDateIdx];
              if (dateCell === undefined || dateCell === null || String(dateCell).trim() === '') continue;
              const dateStr = String(dateCell).trim();
              if (dateStr.includes('সর্বমোট') || dateStr.includes('মোট') || dateStr.toLowerCase().includes('total')) {
                break;
              }

              let rowDate = '';
              const dayNum = parseBanglaNumber(dateStr);
              if (dayNum >= 1 && dayNum <= 31 && !dateStr.includes('-') && !dateStr.includes('/') && !dateStr.includes('.')) {
                rowDate = `${sheetYear}-${sheetMonth}-${String(dayNum).padStart(2, '0')}`;
              } else {
                rowDate = parseBanglaOrEnglishDate(dateCell, `${sheetYear}-${sheetMonth}-01`);
              }

              foodCols.forEach((fc) => {
                const cellVal = row[fc.colIdx];
                const qty = parseBanglaNumber(cellVal);

                if (qty > 0) {
                  const unitPrice = fc.catalogItem ? Number(fc.catalogItem.price || 0) : 10;
                  const totalAmount = qty * unitPrice;
                  const warnings: string[] = [];

                  if (!matchedMem) {
                    warnings.push(`Member "${finalName}" not matched in DB`);
                  }
                  if (!fc.catalogItem) {
                    warnings.push(`Item "${fc.headerName}" not in catalog`);
                  }

                  extractedRows.push({
                    rowId: `pos_dt_matrix_${sheetName}_r${r}_c${fc.colIdx}_${Date.now()}_${Math.random()}`,
                    date: rowDate,
                    bdNo: finalBd,
                    rank: finalRank,
                    memberName: finalName,
                    matchedMember: matchedMem || null,
                    menuItemName: fc.catalogItem?.name || fc.headerName,
                    matchedMenuItem: fc.catalogItem || null,
                    qty,
                    unitPrice,
                    discount: 0,
                    totalAmount,
                    paymentMode: 'DUE',
                    remarks: `Date-wise Matrix: Sheet "${sheetName}"`,
                    isValid: warnings.length === 0,
                    warning: warnings.length > 0 ? warnings.join('; ') : undefined,
                    selected: true,
                    sourceSheet: sheetName
                  });
                }
              });
            }
          }
        }
      }

      // Step 2: Fallback to Standard List Format if no Matrix was found
      if (!foundMatrixFormat || extractedRows.length === 0) {
        setDetectedFormat('LIST');
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (rawJson.length === 0) {
          setErrorMessage('The uploaded file contains no data rows or recognizable tables.');
          setIsProcessing(false);
          return;
        }

        const parsedList: ParsedSaleRow[] = rawJson.map((row, index) => {
          let rawDate = row['Date (YYYY-MM-DD)'] || row['Date'] || row['date'] || row['তারিখ'] || '';
          let rawBd = row['BD No'] || row['BD NO'] || row['bdNo'] || row['বিডি নম্বর'] || row['Airman ID'] || '';
          let rawRank = row['Rank'] || row['rank'] || row['পদবী'] || '';
          let rawName = row['Member Name'] || row['Name'] || row['সদস্যের নাম'] || row['নাম'] || '';
          let rawItem = row['Menu Item'] || row['Item Name'] || row['আইটেমের নাম'] || row['খাবার'] || '';
          let rawQty = row['Quantity'] || row['Qty'] || row['পরিমাণ'] || row['সংখ্যা'] || 1;
          let rawPrice = row['Unit Price'] || row['Price'] || row['দর'] || row['মূল্য'] || '';
          let rawDiscount = row['Discount'] || row['ছাড়'] || 0;
          let rawTotal = row['Total Amount'] || row['Amount'] || row['মোট টাকা'] || row['মোট'] || '';
          let rawMode = row['Payment Mode (DUE/PAID)'] || row['Payment Mode'] || row['Status'] || 'DUE';
          let rawRemarks = row['Remarks'] || row['মন্তব্য'] || '';

          const bdStr = String(rawBd).trim();
          const parsedDate = parseBanglaOrEnglishDate(rawDate);
          const qtyNum = Math.max(1, parseBanglaNumber(rawQty) || 1);
          const discountNum = Math.max(0, parseBanglaNumber(rawDiscount) || 0);

          const matchedMem = bdStr ? (memberMap.get(bdStr.toLowerCase()) || null) : findMemberByRankAndName(rawRank, rawName, members);
          let finalRank = rawRank || (matchedMem?.Rank || matchedMem?.rank || '');
          let finalName = rawName || ([matchedMem?.Rank || matchedMem?.rank, matchedMem?.Surname || matchedMem?.surname || matchedMem?.Name || matchedMem?.name].filter(Boolean).join(' ') || '');

          const matchedItem = matchFoodHeaderToCatalog(String(rawItem), catalogList);
          let unitPriceNum = parseFloat(String(rawPrice));
          if (isNaN(unitPriceNum) || unitPriceNum <= 0) {
            unitPriceNum = matchedItem ? Number(matchedItem.price || 0) : 10;
          }

          let totalAmountNum = parseFloat(String(rawTotal));
          if (isNaN(totalAmountNum) || totalAmountNum <= 0) {
            totalAmountNum = Math.max(0, (qtyNum * unitPriceNum) - discountNum);
          }

          const warnings: string[] = [];
          if (!matchedMem) warnings.push('Member not matched');
          if (!matchedItem) warnings.push('Item not matched');

          return {
            rowId: `pos_list_${index}_${Date.now()}`,
            date: parsedDate,
            bdNo: bdStr || (matchedMem ? matchedMem['BD No'] : 'N/A'),
            rank: finalRank,
            memberName: finalName || 'Customer',
            matchedMember: matchedMem,
            menuItemName: matchedItem?.name || String(rawItem).trim(),
            matchedMenuItem: matchedItem,
            qty: qtyNum,
            unitPrice: unitPriceNum,
            discount: discountNum,
            totalAmount: totalAmountNum,
            paymentMode: normalizeMode(rawMode),
            remarks: String(rawRemarks).trim(),
            isValid: warnings.length === 0,
            warning: warnings.length > 0 ? warnings.join('; ') : undefined,
            selected: true,
            sourceSheet: sheetName
          };
        });

        setParsedRows(parsedList);
      } else {
        if (hasDateWise && !hasMemberWise) {
          setDetectedFormat('DATE_WISE_MATRIX');
        } else {
          setDetectedFormat('MEMBER_WISE_MATRIX');
        }
        setParsedRows(extractedRows);
      }

      setIsProcessing(false);
    } catch (err: any) {
      console.error('Error parsing sales file:', err);
      setErrorMessage(`Failed to parse file: ${err?.message || 'Invalid Excel/CSV format'}`);
      setIsProcessing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  };

  const toggleSelectRow = (rowId: string) => {
    setParsedRows(prev => prev.map(r => r.rowId === rowId ? { ...r, selected: !r.selected } : r));
  };

  const toggleSelectAll = () => {
    const allSelected = parsedRows.every(r => r.selected);
    setParsedRows(prev => prev.map(r => ({ ...r, selected: !allSelected })));
  };

  const removeRow = (rowId: string) => {
    setParsedRows(prev => prev.filter(r => r.rowId !== rowId));
  };

  const filteredDisplayRows = useMemo(() => {
    return parsedRows.filter(r => {
      if (filterMode === 'VALID' && !r.isValid) return false;
      if (filterMode === 'WARNING' && r.isValid) return false;
      if (searchFilter) {
        const s = searchFilter.toLowerCase();
        return r.bdNo.toLowerCase().includes(s) || 
               r.memberName.toLowerCase().includes(s) || 
               r.menuItemName.toLowerCase().includes(s) || 
               r.date.includes(s);
      }
      return true;
    });
  }, [parsedRows, filterMode, searchFilter]);

  const summary = useMemo(() => {
    const selectedRows = parsedRows.filter(r => r.selected);
    const totalQty = selectedRows.reduce((sum, r) => sum + r.qty, 0);
    const totalAmount = selectedRows.reduce((sum, r) => sum + r.totalAmount, 0);
    const dueAmount = selectedRows.filter(r => r.paymentMode === 'DUE').reduce((sum, r) => sum + r.totalAmount, 0);
    const paidAmount = selectedRows.filter(r => r.paymentMode === 'PAID').reduce((sum, r) => sum + r.totalAmount, 0);
    const validCount = selectedRows.filter(r => r.isValid).length;
    const warningCount = selectedRows.length - validCount;

    return {
      count: selectedRows.length,
      totalQty,
      totalAmount,
      dueAmount,
      paidAmount,
      validCount,
      warningCount
    };
  }, [parsedRows]);

  // Execute Import & commit to canteen_txs, Member Due, and Raw Stock
  const handleExecuteImport = async () => {
    const rowsToImport = parsedRows.filter(r => r.selected);
    if (rowsToImport.length === 0) {
      setErrorMessage('No rows selected for import.');
      return;
    }

    setIsApplying(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const newTransactions: any[] = [];
      const memberDueIncrements = new Map<string, number>();
      const stockDeductionList: Array<{ menuItemId: string; menuItemName: string; qty: number }> = [];

      for (const row of rowsToImport) {
        const txDateStr = formatCanteenDate(row.date);
        const airmanId = row.matchedMember?.airman_id || row.bdNo;
        const tx = {
          id: Date.now() + Math.random(),
          date: txDateStr,
          airman_id: airmanId,
          bdNo: row.bdNo,
          memberName: row.memberName,
          rank: row.rank || '',
          items: `${row.menuItemName} (${row.qty})`,
          soldItems: [{
            menuItemId: row.matchedMenuItem?.id || `item-${Date.now()}`,
            menuItemName: row.menuItemName,
            price: row.unitPrice,
            qty: row.qty
          }],
          originalAmount: (row.qty * row.unitPrice),
          discount: row.discount,
          amount: row.totalAmount,
          type: 'SALE',
          status: row.paymentMode,
          paymentStatus: row.paymentMode,
          gateway: row.paymentMode === 'PAID' ? 'CASH' : 'DUE',
          paymentMethod: row.paymentMode === 'PAID' ? 'CASH' : 'DUE',
          notes: row.remarks ? `Imported: ${row.remarks}` : 'Imported via Excel POS Sales'
        };

        newTransactions.push(tx);

        if (updateMemberDue && row.paymentMode === 'DUE') {
          const currentAdd = memberDueIncrements.get(airmanId) || 0;
          memberDueIncrements.set(airmanId, currentAdd + row.totalAmount);
        }

        if (deductStock) {
          stockDeductionList.push({
            menuItemId: row.matchedMenuItem?.id || '',
            menuItemName: row.menuItemName,
            qty: row.qty
          });
        }
      }

      // 1. Append transactions to canteen_txs in localStorage & Cloud
      const existingTxs: any[] = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const mergedTxs = [...newTransactions, ...existingTxs];
      localStorage.setItem('canteen_txs', JSON.stringify(mergedTxs));
      await pushKeyToCloud('canteen_txs', mergedTxs).catch(() => {});

      // 2. Update Member Dues in Supabase & memory if enabled
      if (updateMemberDue && memberDueIncrements.size > 0) {
        for (const [airmanId, addDue] of memberDueIncrements.entries()) {
          const targetMem = members.find(m => m.airman_id === airmanId || m['BD No'] === airmanId);
          if (targetMem) {
            const currentDue = Number(targetMem.Due ?? targetMem.due ?? targetMem.baki ?? 0);
            const newDue = currentDue + addDue;
            supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', targetMem.airman_id).then();
          }
        }
      }

      // 3. Deduct stock from raw inventory & menu cache if enabled
      if (deductStock && stockDeductionList.length > 0) {
        deductRawStockForSales(stockDeductionList);

        try {
          const currentCache = getCanteenMenuCache();
          if (currentCache && currentCache.length > 0) {
            const updatedCache = currentCache.map((menuItem: any) => {
              const matches = stockDeductionList.filter(s =>
                String(s.menuItemId) === String(menuItem.id) ||
                normalizeCatalogKey(s.menuItemName) === normalizeCatalogKey(menuItem.name || menuItem.name_en || '')
              );
              if (matches.length > 0) {
                const totalSold = matches.reduce((sum, m) => sum + m.qty, 0);
                const currentItemStock = menuItem.stock !== undefined ? Number(menuItem.stock) : (menuItem.max !== undefined ? Number(menuItem.max) : 50);
                const newStock = Math.max(0, currentItemStock - totalSold);
                return { ...menuItem, stock: newStock, max: newStock };
              }
              return menuItem;
            });
            setCanteenMenuCache(updatedCache);
          }
        } catch (e) {
          console.warn('Error adjusting menu stock cache:', e);
        }
      }

      // 4. Dispatch global realtime events
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_fund_updated'));
      window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
      window.dispatchEvent(new Event('canteen_inventory_updated'));
      window.dispatchEvent(new Event('storage'));

      setSuccessMessage(`✅ Successfully imported ${newTransactions.length} POS sales transactions (Total ৳${summary.totalAmount.toLocaleString()})!`);

      if (onImportComplete) {
        onImportComplete();
      }

      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('Failed to commit sales import:', err);
      setErrorMessage(`Failed to complete import: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <span>POS Sales Bulk Import (Excel / CSV)</span>
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                  {detectedFormat === 'MEMBER_WISE_MATRIX' 
                    ? 'Format: সদস্য ভিত্তিক (Member-Wise)' 
                    : detectedFormat === 'DATE_WISE_MATRIX'
                    ? 'Format: তারিখ ভিত্তিক (Date-Wise)'
                    : detectedFormat === 'LIST'
                    ? 'Format: সাধারণ লিস্ট (List)'
                    : 'XLSX / CSV'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                ১৫৫ ইউএএসইউ বিএএফ দৈনিক ক্যান্টিন বিল ও মাসিক সদস্য খতিয়ান অটো-ম্যাচিং ইমপোর্ট
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Template 1: Member-wise Matrix (Date Fixed, Left: Rank & Name) */}
            <button
              type="button"
              onClick={handleDownloadOfficialMatrixTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50 rounded-xl text-xs font-black tracking-wider transition-all shadow-sm cursor-pointer"
              title="Template 1: Member-wise (Date fixed, Left: Rank & Name)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>১. সদস্য ভিত্তিক (দৈনিক শিট)</span>
            </button>

            {/* Template 2: Date-wise Matrix (Member Fixed, Left: 1-31 Date) */}
            <button
              type="button"
              onClick={handleDownloadDateWiseMatrixTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-teal-900/80 hover:bg-teal-800 text-teal-200 border border-teal-500/50 rounded-xl text-xs font-black tracking-wider transition-all shadow-sm cursor-pointer"
              title="Template 2: Date-wise (Member fixed, Left: 1-31 Date)"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>২. তারিখ ভিত্তিক (মাসিক শিট)</span>
            </button>

            {/* Secondary Download: Standard List Template */}
            <button
              type="button"
              onClick={handleDownloadStandardListTemplate}
              className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
              title="Download Standard List Template"
            >
              <Download className="w-3 h-3 text-slate-400" />
              <span>লিস্ট</span>
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">

          {/* Success or Error Notice */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Step 1: Upload Box (If no file parsed yet) */}
          {parsedRows.length === 0 ? (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-3xl p-8 sm:p-12 text-center bg-slate-950/40 hover:bg-emerald-950/10 transition-all cursor-pointer group flex flex-col items-center justify-center space-y-3"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                />
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isProcessing ? (
                    <Loader2 className="w-7 h-7 animate-spin" />
                  ) : (
                    <Upload className="w-7 h-7" />
                  )}
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">
                    {isProcessing ? 'ফাইল প্রসেস করা হচ্ছে...' : 'ক্লিক করুন বা ড্র্যাগ করে ফেলুন (Drag & Drop)'}
                  </h4>
                  <p className="text-xs text-slate-400">
                    সাপোর্টেড ফরম্যাট: .xlsx, .xls, .csv (১৫৫ ইউএএসইউ দৈনিক শিট ম্যাট্রিক্স অথবা সাধারণ কলাম লিস্ট)
                  </p>
                </div>
              </div>

              {/* Template Format Guideline Box with 2 Explicit Download Cards */}
              <div className="bg-slate-950/70 rounded-3xl p-5 border border-slate-800 text-xs space-y-3.5 text-slate-300">
                <div className="font-black text-emerald-400 uppercase tracking-wider flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>১৫৫ ইউএএসইউ বিএএফ এক্সেল টেমপ্লেট ফরম্যাট (২টি মোড):</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800">
                    অটো-ডিটেকশন সক্রিয় (স্বয়ংক্রিয় সনাক্তকরণ)
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Card 1: Member-wise (Date Fixed, Left: Sl, Rank, Name) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 space-y-2.5 flex flex-col justify-between shadow-lg">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-emerald-300 flex items-center gap-1.5 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                          ১. সদস্য ভিত্তিক টেমপ্লেট (Member-wise)
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                          Date Fixed
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        • <strong>তারিখ ফিক্সড:</strong> হেডারে নির্দিষ্ট দিনের তারিখ থাকে。<br/>
                        • <strong>বামে সদস্য:</strong> বাম পাশের কলামে সদস্যদের <strong>ক্রমিক, পদবী ও নাম</strong> সাজানো থাকে。<br/>
                        • <strong>ডানে খাবার:</strong> পরোটা, ডিম ভাজি, ডিম সিদ্ধ, দুধ চা সহ ২৭টি খাবারের কলাম থাকে।
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadOfficialMatrixTemplate}
                      className="w-full mt-2 flex items-center justify-center space-x-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                    >
                      <Download className="w-4 h-4 text-emerald-200" />
                      <span>১. সদস্য ভিত্তিক টেমপ্লেট ডাউনলোড (XLSX)</span>
                    </button>
                  </div>

                  {/* Card 2: Date-wise (Member Fixed, Left: Sl, Date 1-31) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-teal-500/40 space-y-2.5 flex flex-col justify-between shadow-lg">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-teal-300 flex items-center gap-1.5 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-sm shadow-teal-400"></span>
                          ২. তারিখ ভিত্তিক টেমপ্লেট (Date-wise)
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-950/90 text-teal-300 font-mono font-bold border border-teal-500/40">
                          Member Fixed
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        • <strong>সদস্য ফিক্সড:</strong> ব্যানারে নির্দিষ্ট সদস্যের <strong>পদবী, নাম ও বিডি নং</strong> থাকে。<br/>
                        • <strong>বামে তারিখ:</strong> বাম পাশের কলামে ১ থেকে ৩১ তারিখ থাকে。<br/>
                        • <strong>ডানে খাবার:</strong> পরোটা, ডিম ভাজি, ডিম সিদ্ধ, চা সহ সারা মাসের প্রতিদিনের খাওয়ার সংখ্যা থাকে।
                      </p>

                      {/* Optional Member Selection Dropdown */}
                      <div className="pt-1">
                        <label className="text-[10px] text-teal-300/80 font-bold block mb-1">
                          সদস্য নির্বাচন (ঐচ্ছিক):
                        </label>
                        <select
                          value={dateTemplateMemberId}
                          onChange={(e) => setDateTemplateMemberId(e.target.value)}
                          className="w-full bg-slate-950 border border-teal-500/40 rounded-xl px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-teal-400 cursor-pointer"
                        >
                          <option value="ALL">সকল সদস্য (সদস্য প্রতি আলাদা ট্যাব)</option>
                          {members.slice(0, 50).map((m: any, mIdx: number) => {
                            const rank = m.Rank || m.rank || '';
                            const name = m.Surname || m.Name || m.name || '';
                            const bd = m['BD No'] || m.airman_id || '';
                            return (
                              <option key={m.airman_id || mIdx} value={m.airman_id || bd}>
                                {rank} {name} {bd ? `(${bd})` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadDateWiseMatrixTemplate()}
                      className="w-full mt-2 flex items-center justify-center space-x-2 py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-teal-600/30 transition-all cursor-pointer active:scale-95"
                    >
                      <Download className="w-4 h-4 text-teal-200" />
                      <span>২. তারিখ ভিত্তিক টেমপ্লেট ডাউনলোড (XLSX)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Step 2: Parsed Table Review */
            <div className="space-y-4">
              
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Selected</span>
                  <span className="text-lg font-black text-white">{summary.count} / {parsedRows.length}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Items Qty</span>
                  <span className="text-lg font-black text-indigo-400">{summary.totalQty} pcs</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Due Sales</span>
                  <span className="text-lg font-black text-amber-400">৳{summary.dueAmount.toLocaleString()}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Total Sales</span>
                  <span className="text-lg font-black text-emerald-400">৳{summary.totalAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors"
                  >
                    {parsedRows.every(r => r.selected) ? 'Deselect All' : 'Select All'}
                  </button>
                  <div className="flex rounded-xl bg-slate-900 p-0.5 border border-slate-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilterMode('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterMode === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      All ({parsedRows.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMode('VALID')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterMode === 'VALID' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                    >
                      Valid ({summary.validCount})
                    </button>
                    {summary.warningCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setFilterMode('WARNING')}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${filterMode === 'WARNING' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}
                      >
                        Warnings ({summary.warningCount})
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 flex-1 sm:max-w-xs">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder="Search member, item, BD no..."
                      className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setParsedRows([]);
                      setFile(null);
                      setDetectedFormat(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-xl transition-colors shrink-0"
                    title="Upload another file"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                <div className="overflow-x-auto max-h-[42vh]">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2.5 w-10 text-center">✓</th>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">BD No</th>
                        <th className="px-3 py-2.5">Member Name</th>
                        <th className="px-3 py-2.5">Menu Item</th>
                        <th className="px-3 py-2.5 text-center">Qty</th>
                        <th className="px-3 py-2.5 text-right">Price</th>
                        <th className="px-3 py-2.5 text-right">Total</th>
                        <th className="px-3 py-2.5 text-center">Mode</th>
                        <th className="px-3 py-2.5">Status</th>
                        <th className="px-3 py-2.5 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredDisplayRows.map((row) => (
                        <tr 
                          key={row.rowId} 
                          className={`hover:bg-slate-800/40 transition-colors ${!row.selected ? 'opacity-40' : ''}`}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={() => toggleSelectRow(row.rowId)}
                              className="rounded border-slate-700 text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-400">{row.date}</td>
                          <td className="px-3 py-2 font-bold text-white">{row.bdNo}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center space-x-1.5">
                              {row.rank && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-bold">
                                  {row.rank}
                                </span>
                              )}
                              <span className="font-bold truncate max-w-[140px]">{row.memberName}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 font-bold text-emerald-400">{row.menuItemName}</td>
                          <td className="px-3 py-2 text-center font-bold">{row.qty}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-400">৳{row.unitPrice}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-white">৳{row.totalAmount}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              row.paymentMode === 'PAID'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                            }`}>
                              {row.paymentMode}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            {row.isValid ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                                <Check className="w-3.5 h-3.5" /> Matched
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-bold" title={row.warning}>
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate max-w-[130px]">{row.warning}</span>
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeRow(row.rowId)}
                              className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                              title="Remove row"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Execution Options */}
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-2.5">
                <div className="text-xs font-black text-slate-300 uppercase tracking-wider">
                  ইমপোর্ট অপশন ও সমন্বয়:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center space-x-2.5 cursor-pointer bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <input
                      type="checkbox"
                      checked={updateMemberDue}
                      onChange={(e) => setUpdateMemberDue(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold text-white block">সদস্যের বকেয়ায় যোগ করুন (Update Member Due)</span>
                      <span className="text-[10px] text-slate-400">DUE ট্রানজ্যাকশনগুলোর টাকা সংশ্লিষ্ট মেম্বারের ব্যালেন্সে যোগ হবে</span>
                    </div>
                  </label>

                  <label className="flex items-center space-x-2.5 cursor-pointer bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                    <input
                      type="checkbox"
                      checked={deductStock}
                      onChange={(e) => setDeductStock(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-bold text-white block">স্টক সমন্বয় করুন (Deduct Inventory Stock)</span>
                      <span className="text-[10px] text-slate-400">রেসিপি অনুযায়ী কাঁচামাল ও মেনু স্টক স্বয়ংক্রিয়ভাবে কমে যাবে</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {parsedRows.length > 0 && (
              <span>
                {summary.count} rows selected • Total: <strong className="text-white">৳{summary.totalAmount.toLocaleString()}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isApplying || summary.count === 0}
                className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black tracking-wider uppercase transition-all shadow-lg shadow-emerald-900/30 cursor-pointer disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>ইমপোর্ট হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>ইমপোর্ট নিশ্চিত করুন ({summary.count})</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

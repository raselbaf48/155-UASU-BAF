import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  X, Upload, FileSpreadsheet, Download, CheckCircle2, 
  AlertCircle, AlertTriangle, ArrowRight, Loader2, RefreshCw,
  Search, Check, Trash2, ShoppingCart, UserCheck, DollarSign,
  Calendar, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  History, Edit3, Save, Undo2, ArrowUpDown, Filter
} from 'lucide-react';
import XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import { supabase } from '../../../supabase';
import { pushKeyToCloud, pullKeyFromCloud, recordDeletedTxId } from '../utils/canteenCloudSync';
import { deductRawStockForSales } from '../utils/recipeManager';
import { getCanteenMenuCache, setCanteenMenuCache, setCanteenMembersCache, normalizeCatalogKey, isOneTimeBoxItem } from '../utils/canteenMenuData';
import { formatCanteenDate, toYMDDate } from '../utils/dateUtils';
import { sortCanteenMembersByOfficeSeniority } from '../utils/canteenSeniority';
import { formatRankBn, formatMemberNameBn, toBengaliNum, formatBengaliMonthYear } from '../utils/exportCanteenBillExcel';
import { DEFAULT_MEMBER_BANGLA_NAMES } from '../utils/memberBanglaNames';
import { getMenuItemBanglaName } from '../utils/menuBanglaNames';
import { formatItemNameBn } from '../pages/MemberDB';
import { isSaleTransaction } from '../pages/PosSales';
import { getCanteenMenuItemOrder } from '../utils/menuOrdering';
import { toSutonny, fromSutonny } from '../utils/sutonnyConverter';

export interface PosImportBatchItem {
  id: string;
  date: string;
  airman_id?: string;
  bdNo: string;
  rank?: string;
  memberName: string;
  items: string;
  soldItems: Array<{
    menuItemId: string;
    menuItemName: string;
    price: number;
    qty: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  paymentMode: 'DUE' | 'PAID';
}

export interface PosImportBatch {
  id: string;
  createdAt: number;
  displayDate: string;
  sourceName: string;
  templateType: 'MEMBER_WISE_MATRIX' | 'DATE_WISE_MATRIX' | 'LIST' | string;
  totalTransactions: number;
  totalAmount: number;
  dueAmount: number;
  createdTransactionIds: string[];
  appliedMemberDue: boolean;
  deductedStock: boolean;
  items: PosImportBatchItem[];
}

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

/**
 * Returns real-time food columns matching the App's menu catalog.
 * Strictly preserves official menu ordering and dynamically synchronizes with App's catalog.
 */
export function getRealtimeCanteenFoodColumns(catalog: any[]): Array<{ bn: string; enMatch: string; price: number; id?: string }> {
  const activeCatalog = (Array.isArray(catalog) && catalog.length > 0 ? catalog : getCanteenMenuCache())
    .filter((item: any) => !isOneTimeBoxItem(item));

  // Sort strictly by official order priority
  const sorted = [...activeCatalog].sort((a: any, b: any) => {
    const aName = a.name_bn || a.nameBn || getMenuItemBanglaName(a) || a.name || '';
    const bName = b.name_bn || b.nameBn || getMenuItemBanglaName(b) || b.name || '';
    return getCanteenMenuItemOrder(aName) - getCanteenMenuItemOrder(bName);
  });

  return sorted.map((item: any) => {
    const bn = item.name_bn || item.nameBn || getMenuItemBanglaName(item) || item.name || '';
    const en = item.name || item.name_en || item.name_bn || '';
    return {
      bn: bn.trim(),
      enMatch: en.trim(),
      price: Number(item.price || 0),
      id: item.id
    };
  });
}

const SHORT_BENGALI_MONTHS = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

function formatShortBengaliDate(day: number, monthIndex: number, year: number): string {
  const shortMon = SHORT_BENGALI_MONTHS[monthIndex] || '';
  const shortYr = toBengaliNum(String(year).slice(-2));
  return `${toBengaliNum(day)} ${shortMon} ${shortYr}`;
}

/**
 * Determines whether a date is a holiday/weekend:
 * 1. Checks baf_removed_holidays (if marked as working day override)
 * 2. Checks official Bangladesh / BAF weekend: Friday (5) & Saturday (6)
 * 3. Checks baf_custom_holidays / baf_canteen_holidays (official public/special holidays)
 */
function isCanteenHolidayDate(dateYmd: string, dObj?: Date): boolean {
  let customHolidays: string[] = [];
  let removedHolidays: string[] = [];
  try {
    customHolidays = JSON.parse(localStorage.getItem('baf_custom_holidays') || '[]');
    removedHolidays = JSON.parse(localStorage.getItem('baf_removed_holidays') || '[]');
  } catch {}
  if (removedHolidays.includes(dateYmd)) return false;
  const targetDate = dObj || new Date(dateYmd);
  const dayOfWeek = targetDate.getDay();
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday / Saturday in BD
  return isWeekend || customHolidays.includes(dateYmd);
}

function parseDateWiseMatrixDate(dateStr: any, fallbackYear = 2026, fallbackMonth = 10): string {
  if (!dateStr) return '';
  const str = banglaToEnglishDigits(String(dateStr)).trim();
  
  // Look for: (day) (month_str) (year) e.g. "1 oct 26" or "1 অক্টো 26"
  const match = str.match(/^(\d{1,2})\s+([^\s\d]+)(?:\s+(\d{2,4}))?/i);
  if (match) {
    const d = match[1].padStart(2, '0');
    const monWord = match[2].toLowerCase();
    
    const bnMonthMap: Record<string, string> = {
      'জানু': '01', 'jan': '01',
      'ফেব্রু': '02', 'feb': '02',
      'মার্চ': '03', 'mar': '03',
      'এপ্রিল': '04', 'apr': '04',
      'মে': '05', 'may': '05',
      'জুন': '06', 'jun': '06',
      'জুলাই': '07', 'jul': '07',
      'আগস্ট': '08', 'আগষ্ট': '08', 'aug': '08',
      'সেপ্টে': '09', 'sep': '09',
      'অক্টো': '10', 'oct': '10',
      'নভে': '11', 'nov': '11',
      'ডিসে': '12', 'dec': '12',
    };
    
    let foundMonth = '';
    for (const [k, v] of Object.entries(bnMonthMap)) {
      if (monWord.includes(k) || k.includes(monWord)) {
        foundMonth = v;
        break;
      }
    }
    
    let yr = match[3];
    if (yr) {
      if (yr.length === 2) yr = '20' + yr;
    } else {
      yr = String(fallbackYear);
    }
    
    if (foundMonth) {
      return `${yr}-${foundMonth}-${d}`;
    }
  }

  // If simply day number 1-31
  const numOnly = parseBanglaNumber(str);
  if (numOnly >= 1 && numOnly <= 31 && !str.includes('-') && !str.includes('/') && !str.includes('.')) {
    return `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-${String(numOnly).padStart(2, '0')}`;
  }

  return parseBanglaOrEnglishDate(dateStr, `${fallbackYear}-${String(fallbackMonth).padStart(2, '0')}-01`);
}

const thinBlackBorder = {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } },
};

function applyExcelTableStyles(
  ws: any, 
  headerRowIdx: number, 
  startColIdx: number = 1
) {
  if (!ws || !ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);

  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      let cell = ws[cellAddress];

      const isInsideTable = R >= headerRowIdx && C >= startColIdx;
      const isHeaderRow = R === headerRowIdx && C >= startColIdx;

      if (isInsideTable) {
        if (!cell) {
          cell = { t: 's', v: '' };
          ws[cellAddress] = cell;
        }

        const isEvenDataRow = (R - headerRowIdx) % 2 === 0;
        const cellBgColor = isHeaderRow 
          ? '64748B' 
          : (isEvenDataRow ? 'FFFFFF' : 'F1F5F9');

        cell.s = {
          font: {
            name: 'SutonnyMJ',
            sz: 16,
            bold: isHeaderRow,
            color: { rgb: isHeaderRow ? 'FFFFFF' : '000000' }
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center',
            wrapText: true
          },
          border: thinBlackBorder,
          fill: { fgColor: { rgb: cellBgColor } }
        };
      } else if (cell && C >= startColIdx) {
        // Cells above table (e.g. member banner B1:C3)
        cell.s = {
          font: {
            name: 'SutonnyMJ',
            sz: 16,
            bold: C === startColIdx, // B column labels bold
            color: { rgb: '000000' }
          },
          alignment: {
            horizontal: 'center',
            vertical: 'center',
            wrapText: true
          },
          border: thinBlackBorder
        };
      }
    }
  }
}

/**
 * Calculates optimal autofit column widths for SutonnyMJ 16pt table sheets.
 * Guarantees headers and cell values are never clipped or overflowed.
 */
function calculateSheetColWidths(
  rows: any[][],
  minWidths: Record<number, number> = {},
  defaultMin = 9
): Array<{ wch: number }> {
  const maxLens: number[] = [];
  rows.forEach(row => {
    if (!Array.isArray(row)) return;
    row.forEach((cellVal, cIdx) => {
      let len = 0;
      if (cellVal !== null && cellVal !== undefined) {
        if (typeof cellVal === 'object' && cellVal.v !== undefined) {
          len = String(cellVal.v).length;
        } else {
          len = String(cellVal).length;
        }
      }
      maxLens[cIdx] = Math.max(maxLens[cIdx] || 0, len);
    });
  });

  return maxLens.map((len, cIdx) => {
    if (cIdx === 0) return { wch: 4 }; // Spacer Col A
    const minW = minWidths[cIdx] || defaultMin;
    const fitted = Math.max(minW, Math.ceil(len * 1.35) + 3);
    return { wch: Math.min(fitted, 45) };
  });
}

/**
 * Injects OpenXML freeze panes, font mappings, and native bestFit attributes directly into the XLSX package zip.
 * Guarantees Microsoft Excel, Google Sheets, Apple Numbers & LibreOffice render authentic SutonnyMJ
 * typography with perfect cell auto-fit and locked panes.
 */
async function downloadExcelWithNativeFreeze(
  workbook: any,
  filename: string,
  freezeOptions: { xSplit: number; ySplit: number; topLeftCell: string }
) {
  const rawArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const zip = await JSZip.loadAsync(rawArray);
  
  const paneXml = `<sheetViews><sheetView workbookViewId="0"><pane xSplit="${freezeOptions.xSplit}" ySplit="${freezeOptions.ySplit}" topLeftCell="${freezeOptions.topLeftCell}" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="${freezeOptions.topLeftCell}" sqref="${freezeOptions.topLeftCell}"/></sheetView></sheetViews>`;

  // 1. Patch xl/styles.xml to guarantee SutonnyMJ has Windows ANSI charset=0 and family=3
  // In Excel DirectWrite / GDI, this prevents fallback to Calibri / Nirmala UI
  const stylesEntry = zip.file('xl/styles.xml');
  if (stylesEntry) {
    let stylesContent = await stylesEntry.async('string');
    stylesContent = stylesContent.replace(/<font>([\s\S]*?)<\/font>/g, (_m, inner) => {
      let patched = inner;
      if (!patched.includes('<name val="SutonnyMJ"')) {
        patched = patched.replace(/<name val="[^"]*"\/>/, '<name val="SutonnyMJ"/>');
      }
      if (!patched.includes('<family')) {
        patched += '<family val="3"/>';
      }
      if (!patched.includes('<charset')) {
        patched += '<charset val="0"/>';
      }
      return '<font>' + patched + '</font>';
    });
    zip.file('xl/styles.xml', stylesContent);
  }

  // 2. Patch worksheets with freeze panes and bestFit="1" customWidth="1" attributes
  for (const fileName of Object.keys(zip.files)) {
    if (fileName.startsWith('xl/worksheets/sheet') && fileName.endsWith('.xml')) {
      const fileEntry = zip.file(fileName);
      if (fileEntry) {
        let content = await fileEntry.async('string');
        if (content.includes('<sheetViews')) {
          content = content.replace(/<sheetViews[^>]*>[\s\S]*?<\/sheetViews>|<sheetViews[^>]*\/>/, paneXml);
        } else {
          content = content.replace(/(<worksheet[^>]*>)/, `$1${paneXml}`);
        }

        // Add native bestFit="1" and customWidth="1" to col elements for seamless cell autofit in Excel
        if (content.includes('<col ')) {
          content = content.replace(/<col ([^>]*?)\/?>/g, (_colTag, attrs) => {
            let patchedAttrs = attrs;
            if (!patchedAttrs.includes('bestFit=')) {
              patchedAttrs += ' bestFit="1"';
            }
            if (!patchedAttrs.includes('customWidth=')) {
              patchedAttrs += ' customWidth="1"';
            }
            return `<col ${patchedAttrs}/>`;
          });
        }

        zip.file(fileName, content);
      }
    }
  }

  const modifiedBlob = await zip.generateAsync({ 
    type: 'blob', 
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  const url = URL.createObjectURL(modifiedBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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

function cleanFoodString(str: any): string {
  if (!str) return '';
  return String(str)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .toLowerCase();
}

function matchFoodHeaderToCatalog(header: string, catalog: any[]): any {
  if (!header) return null;
  const rawClean = cleanFoodString(header);
  const decodedClean = cleanFoodString(fromSutonny(header));
  const candidateTexts = [rawClean, decodedClean].filter(Boolean);

  // 1. Direct match against catalog item names (English, Bangla, normalized)
  for (const item of catalog) {
    const enName = cleanFoodString(item.name || item.name_en || '');
    const bnName = cleanFoodString(item.name_bn || item.nameBn || item['Name (BN)'] || getMenuItemBanglaName(item) || '');
    
    for (const cand of candidateTexts) {
      if (cand === enName || cand === bnName) return item;
      if (bnName && (cand.includes(bnName) || bnName.includes(cand))) return item;
      if (enName && (cand.includes(enName) || enName.includes(cand))) return item;
    }
  }

  // 2. Comprehensive Aliases covering all Mess / Canteen items (Sutonny, Unicode Bangla & English)
  const aliases: Array<{ match: RegExp | string; catalogKey: string }> = [
    { match: /পরোটা|porata|paratha|parota|porota|c‡ivUv/i, catalogKey: 'porata' },
    { match: /স্পেশাল.*ডিম.*পরোটা|ডিম.*পরোটা|egg.*paratha|wWg.*c‡ivUv/i, catalogKey: 'special egg porata' },
    { match: /ডিম ভাজি|ভাজি ডিম|dim vaji|egg fry|omlet|omelet|mumlet|wWg fvwR|wWgfvwR/i, catalogKey: 'egg fry' },
    { match: /ডিম পোচ|পোচ|poach|egg poach|wWg †cvP|†cvP/i, catalogKey: 'egg poach' },
    { match: /ডিম সিদ্ধ|সিদ্ধ ডিম|boiled egg|wWg wm×|wm× wWg/i, catalogKey: 'boiled egg' },
    { match: /দুধ চা|milk tea|`ya Pv|`yaPv/i, catalogKey: 'milk tea' },
    { match: /রং চা|রঙ চা|লিকার চা|liquor tea|raw tea|is Pv|isPv|wjsKvi Pv/i, catalogKey: 'liquor tea' },
    { match: /ব্ল্যাক কফি|black coffee|eø¨vK Kwd/i, catalogKey: 'black coffee' },
    { match: /দুধ কফি|milk coffee|`ya Kwd/i, catalogKey: 'milk coffee' },
    { match: /গ্রীন টি|গ্রিন টি|green tea|MÖxb wU/i, catalogKey: 'green tea' },
    { match: /ডিম নুডুলস|ডিম নুডলস|egg noodles|wWg byWjm|wWg byWjm/i, catalogKey: 'egg noodles' },
    { match: /নুডুলস|নুডলস|noodles|byWjm/i, catalogKey: 'noodles' },
    { match: /ড্রাই কেক|কেক|dry cake|cake|WªvB †KK|†KK/i, catalogKey: 'dry cake' },
    { match: /নরমাল বিস্কুট|বিস্কুট|normal biscuit|biscuit|bigvj we¯‹zU|we¯‹zU/i, catalogKey: 'normal biscuit' },
    { match: /এনার্জি বিস্কুট|energy biscuit|GbvwR© we¯‹zU/i, catalogKey: 'energy biscuit' },
    { match: /লেবুর শরবত|লেবুর জুস|শরবত|lemon juice|‡jeyi kieZ/i, catalogKey: 'lemon juice' },
    { match: /পোলাও|বিরিয়ানি|বিরিয়ানি|চিকেন বিরিয়ানি|polao|pulaw|biryani|biriyani|‡cvjvI|weBrain|wewiqvwb/i, catalogKey: 'chicken biryani' },
    { match: /ডিম খিচুড়ি|ডিম খিচুড়ি|egg khichuri|egg khicuri|wWg wLPzwo/i, catalogKey: 'egg khichuri' },
    { match: /খিচুড়ি|খিচুড়ি|khichuri|wLPzwo/i, catalogKey: 'khichuri' },
    { match: /হালিম|halim|nvwjg/i, catalogKey: 'halim' },
    { match: /চটপটি|chotpoti|PUcwU/i, catalogKey: 'chotpoti' },
    { match: /গ্রীল সবজি|সবজি|shobji|vegetable|mewR/i, catalogKey: 'vegetable' },
    { match: /হটডগ|অফলাতুন|hotdog|nUWM|AdjvZzb/i, catalogKey: 'hotdog' },
    { match: /সিংগারা|সিঙ্গারা|singara|wmsMviv/i, catalogKey: 'singara' },
    { match: /সমুচা|সোমোসা|সমোসা|somucha|samosa|mgyPv/i, catalogKey: 'somucha' },
    { match: /সুইট রোল|চিকেন রোল|রোল|roll|chicken roll|myBU †ivj|†ivj/i, catalogKey: 'chicken roll' },
    { match: /স্যান্ডউইচ|sandwich|sanwitch|m¨vÛDBP/i, catalogKey: 'sandwich' },
    { match: /পেটিস|প্যাটিস|প্যাট্টি|patties|patty|c¨vwUm/i, catalogKey: 'patties' },
    { match: /কলা|banana|Kjv/i, catalogKey: 'banana' },
    { match: /আপেল|apple|Av‡cj/i, catalogKey: 'apple' },
    { match: /দই|মিষ্টি দই|curd|yogurt|`B/i, catalogKey: 'curd' },
    { match: /মিষ্টি|sweet|wgwó/i, catalogKey: 'sweet' },
    { match: /পানি|mineral water|water|cvwb/i, catalogKey: 'water' },
    { match: /অন্যান্য|other|misc|Ab¨vb¨/i, catalogKey: 'other' },
  ];

  for (const alias of aliases) {
    const isMatched = candidateTexts.some(cand => 
      typeof alias.match === 'string' ? cand.includes(alias.match) : alias.match.test(cand)
    );
    if (isMatched) {
      const found = catalog.find((c: any) => {
        const en = cleanFoodString(c.name || c.name_en || '');
        const bn = cleanFoodString(c.name_bn || c.nameBn || c['Name (BN)'] || getMenuItemBanglaName(c) || '');
        return en.includes(alias.catalogKey) || bn.includes(alias.catalogKey) || normalizeCatalogKey(en) === normalizeCatalogKey(alias.catalogKey);
      });
      if (found) return found;
    }
  }

  return null;
}

function findMemberByRankAndName(rankVal: string, nameVal: string, members: any[]): any {
  if (!nameVal && !rankVal) return null;
  const rawName = String(nameVal || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const rawRank = String(rankVal || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const decodedName = fromSutonny(rawName).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  const decodedRank = fromSutonny(rawRank).replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

  const cleanNames = [rawName.toLowerCase(), decodedName.toLowerCase()].filter(Boolean);
  const cleanRanks = [rawRank.toLowerCase(), decodedRank.toLowerCase()].filter(Boolean);

  // 1. Check BD number embedded in name or rank string
  for (const str of [...cleanNames, ...cleanRanks]) {
    const bdMatch = str.match(/\b(\d{4,7})\b/);
    if (bdMatch) {
      const mem = members.find(m => String(m['BD No'] || m.airman_id || '').replace(/\D/g, '') === bdMatch[1]);
      if (mem) return mem;
    }
  }

  // 2. Exact or substring match on Member Bangla / English names
  for (const m of members) {
    const mBn = cleanFoodString(m.name_bn || m.NameBn || formatMemberNameBn(m.Surname || m.Name) || '');
    const mEn = cleanFoodString(m.Surname || m.Name || '');
    const bd = String(m['BD No'] || m.airman_id || '').trim();
    const cleanBd = bd.replace(/\D/g, '');
    const mappedBn = cleanFoodString(DEFAULT_MEMBER_BANGLA_NAMES[bd] || DEFAULT_MEMBER_BANGLA_NAMES[cleanBd] || DEFAULT_MEMBER_BANGLA_NAMES[`BD/${cleanBd}`] || '');

    for (const cn of cleanNames) {
      if (cn && (cn === mBn || cn === mEn || cn === mappedBn)) return m;
      if (cn && mBn && (cn.includes(mBn) || mBn.includes(cn))) return m;
      if (cn && mEn && (cn.includes(mEn) || mEn.includes(cn))) return m;
      if (cn && mappedBn && (cn.includes(mappedBn) || mappedBn.includes(cn))) return m;
    }
  }

  // 3. Match by Rank + Surname combination
  for (const m of members) {
    const mRank = cleanFoodString(m.Rank || m.rank || '');
    const mSurname = cleanFoodString(m.Surname || m.Name || '');
    const rankMatches = cleanRanks.some(cr => cr && mRank && (cr.includes(mRank) || mRank.includes(cr)));
    if (rankMatches) {
      const nameMatches = cleanNames.some(cn => cn && mSurname && (cn.includes(mSurname) || mSurname.includes(cn)));
      if (nameMatches) return m;
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
  // Active Tab: New Import vs Import History
  const [activeTab, setActiveTab] = useState<'IMPORT' | 'HISTORY'>('IMPORT');

  // Import History States
  const [posImportHistory, setPosImportHistory] = useState<PosImportBatch[]>(() => {
    try {
      const raw = localStorage.getItem('canteen_pos_import_history');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackBatch, setRollbackBatch] = useState<PosImportBatch | null>(null);
  const [editingItem, setEditingItem] = useState<{ batchId: string; item: PosImportBatchItem } | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<PosImportBatchItem>>({});

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
  const [templateMonth, setTemplateMonth] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  // Load and synchronize POS Import History
  useEffect(() => {
    if (!isOpen) return;
    const loadHistory = async () => {
      try {
        const raw = localStorage.getItem('canteen_pos_import_history');
        if (raw) setPosImportHistory(JSON.parse(raw));
        const cloudData = await pullKeyFromCloud('canteen_pos_import_history');
        if (Array.isArray(cloudData) && cloudData.length > 0) {
          setPosImportHistory(cloudData);
          localStorage.setItem('canteen_pos_import_history', JSON.stringify(cloudData));
        }
      } catch (err) {
        console.warn('Error fetching POS import history:', err);
      }
    };
    loadHistory();

    const handleHistoryUpdate = () => {
      try {
        const raw = localStorage.getItem('canteen_pos_import_history');
        if (raw) setPosImportHistory(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener('canteen_pos_import_history_updated', handleHistoryUpdate);
    return () => {
      window.removeEventListener('canteen_pos_import_history_updated', handleHistoryUpdate);
    };
  }, [isOpen]);

  const handlePrevTemplateMonth = () => {
    const [y, m] = templateMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    const prevKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setTemplateMonth(prevKey);
  };

  const handleNextTemplateMonth = () => {
    const [y, m] = templateMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    const nextKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setTemplateMonth(nextKey);
  };

  const availableTemplateMonths = useMemo(() => {
    const list = [];
    const now = new Date();
    const curYear = now.getFullYear();
    for (let y = curYear - 1; y <= curYear + 1; y++) {
      for (let m = 1; m <= 12; m++) {
        const key = `${y}-${String(m).padStart(2, '0')}`;
        list.push({
          key,
          label: `${formatBengaliMonthYear(key)} (${key})`
        });
      }
    }
    return list;
  }, []);
  
  // Options
  const [updateMemberDue, setUpdateMemberDue] = useState(true);
  const [deductStock, setDeductStock] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Generate and download Official 155 UASU BAF Daily Canteen Bill Matrix Template (31 Date tabs for selected Month)
  const handleDownloadOfficialMatrixTemplate = async () => {
    try {
      const sortedMembers = sortCanteenMembersByOfficeSeniority(members);
      const workbook = XLSX.utils.book_new();

      const selectedYm = templateMonth || toYMDDate(new Date()).slice(0, 7);
      const [selYearStr, selMonthStr] = selectedYm.split('-');
      const selYear = parseInt(selYearStr, 10);
      const selMonth = parseInt(selMonthStr, 10);
      const daysInMonth = new Date(selYear, selMonth, 0).getDate();

      // Real-time active food columns matching the App's menu catalog
      const allMemberFoodCols = getRealtimeCanteenFoodColumns(catalog);

      // Existing sales transactions in the system
      const existingTxs: any[] = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
        } catch {
          return [];
        }
      })();

      // Common black thin border for table cells
      const cellBorder = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      };

      // Header row (Last column "মোট বিল" removed as requested)
      const headerRow = [
        '',
        toSutonny('ক্রমিক নং'),
        toSutonny('বিডি নং'),
        toSutonny('পদবী'),
        toSutonny('নাম'),
        ...allMemberFoodCols.map(c => toSutonny(c.bn))
      ];

      // Generate 31 separate tabs (tab name '1'..'31') for the selected month
      for (let day = 1; day <= daysInMonth; day++) {
        const dayStr = String(day).padStart(2, '0');
        const dayYmd = `${selectedYm}-${dayStr}`;
        const dayStrBn = formatShortBengaliDate(day, selMonth - 1, selYear);

        const rows: any[][] = [];
        // Row 1: Empty spacer
        rows.push([]);

        // Row 2: Title Banner (Col C: মাস, Col D: মাসের নাম)
        const titleRow = new Array(headerRow.length).fill('');
        titleRow[2] = toSutonny('মাস');
        titleRow[3] = toSutonny(formatBengaliMonthYear(selectedYm));
        rows.push(titleRow);

        // Row 3: Date Banner (Col C: তারিখ, Col D: তারিখের মান - মাস ও মাসের নামের ঠিক নিচের সেলে)
        const dateRow = new Array(headerRow.length).fill('');
        dateRow[2] = toSutonny('তারিখ');
        dateRow[3] = toSutonny(dayStrBn);
        rows.push(dateRow);

        // Row 4: Spacer
        rows.push([]);

        // Row 5: Column Headers
        rows.push(headerRow);

        const colFoodTotals = new Array(allMemberFoodCols.length).fill(0);

        // Rows 6+: Member data rows in official seniority order
        sortedMembers.forEach((m, idx) => {
          const serBn = toBengaliNum(idx + 1);
          const rankBn = formatRankBn(m.Rank || m.rank || '');
          const memberNameBn = m.name_bn || m.NameBn || formatMemberNameBn(m.Surname || m.Name || '') || m.Surname || m.Name || '';

          const mAirman = String(m.airman_id || '').toLowerCase().trim();
          const mBd = String(m['BD No'] || m.bdNo || '').toLowerCase().trim();
          const mCleanDigits = (m['BD No'] || m.bdNo || m.airman_id || '').toString().replace(/\D/g, '');

          // Find existing entries on dayYmd for member m
          const dayTxs = existingTxs.filter((tx: any) => {
            if (!isSaleTransaction(tx)) return false;
            const txYmd = toYMDDate(tx.date || tx.paymentDate || tx.timestamp || tx.created_at || (typeof tx.id === 'number' ? tx.id : undefined));
            if (txYmd !== dayYmd) return false;

            const txAirman = String(tx.airman_id || tx.member_id || '').toLowerCase().trim();
            const txBd = String(tx.bdNo || '').toLowerCase().trim();
            const txDigits = (tx.bdNo || tx.airman_id || '').toString().replace(/\D/g, '');

            return (
              (mAirman && txAirman === mAirman) ||
              (mBd && txBd === mBd) ||
              (mCleanDigits && txDigits && mCleanDigits === txDigits)
            );
          });

          const foodQtyMap = new Map<number, number>();

          dayTxs.forEach((tx: any) => {
            let soldItems = tx.soldItems;
            if (typeof soldItems === 'string') {
              try { soldItems = JSON.parse(soldItems); } catch {}
            }

            if (Array.isArray(soldItems) && soldItems.length > 0) {
              soldItems.forEach((si: any) => {
                const rawName = String(si.menuItemName || si.name || si.itemName || '').trim();
                const rawBn = getMenuItemBanglaName(rawName) || formatItemNameBn(rawName) || rawName;
                const q = Number(si.qty || si.quantity || 1);

                let colIdx = allMemberFoodCols.findIndex(col => col.bn === rawBn || col.bn === rawName || col.enMatch.toLowerCase() === rawName.toLowerCase());
                if (colIdx === -1) {
                  colIdx = allMemberFoodCols.findIndex(col => {
                    const cEn = col.enMatch.toLowerCase();
                    const cBn = col.bn.toLowerCase();
                    const rLower = rawName.toLowerCase();
                    const rBnLower = rawBn.toLowerCase();
                    return cEn.includes(rLower) || rLower.includes(cEn) || cBn.includes(rBnLower) || rBnLower.includes(cBn);
                  });
                }

                if (colIdx >= 0) {
                  foodQtyMap.set(colIdx, (foodQtyMap.get(colIdx) || 0) + q);
                }
              });
            } else if (tx.items) {
              const parts = String(tx.items).split(/[,+;|\n]+/).map((s: string) => s.trim()).filter(Boolean);
              parts.forEach((p: string) => {
                let q = 1;
                let raw = p;
                const m1 = p.match(/^(.+?)\s*\(([\d০-৯]+)\)$/);
                if (m1) {
                  raw = m1[1].trim();
                  q = parseBanglaNumber(m1[2]) || 1;
                } else {
                  const m2 = p.match(/^(.+?)\s*[xX*×]\s*([\d০-৯]+)$/);
                  if (m2) {
                    raw = m2[1].trim();
                    q = parseBanglaNumber(m2[2]) || 1;
                  }
                }
                const rawBn = getMenuItemBanglaName(raw) || formatItemNameBn(raw) || raw;
                let colIdx = allMemberFoodCols.findIndex(col => col.bn === rawBn || col.bn === raw || col.enMatch.toLowerCase() === raw.toLowerCase());
                if (colIdx === -1) {
                  colIdx = allMemberFoodCols.findIndex(col => {
                    const cEn = col.enMatch.toLowerCase();
                    const cBn = col.bn.toLowerCase();
                    const rLower = raw.toLowerCase();
                    const rBnLower = rawBn.toLowerCase();
                    return cEn.includes(rLower) || rLower.includes(cEn) || cBn.includes(rBnLower) || rBnLower.includes(cBn);
                  });
                }
                if (colIdx >= 0) {
                  foodQtyMap.set(colIdx, (foodQtyMap.get(colIdx) || 0) + q);
                }
              });
            }
          });

          // Accumulate totals per food item column across members
          allMemberFoodCols.forEach((_, cIdx) => {
            const q = foodQtyMap.get(cIdx);
            if (q && q > 0) {
              colFoodTotals[cIdx] = (colFoodTotals[cIdx] || 0) + q;
            }
          });

          const rawBd = String(m['BD No'] || m.bdNo || m.airman_id || '').trim();
          const cleanDigits = rawBd.replace(/\D/g, '');
          const bdDisplay = cleanDigits ? cleanDigits : rawBd.replace(/^BD[\/\-\s]*/i, '').trim();

          const rowData = [
            '',
            toSutonny(serBn),
            bdDisplay,
            toSutonny(rankBn),
            toSutonny(memberNameBn),
            ...allMemberFoodCols.map((_, cIdx) => {
              const q = foodQtyMap.get(cIdx);
              return q && q > 0 ? q : '';
            })
          ];
          rows.push(rowData);
        });

        // Last row: Total Sum for Member 1 to Last with SUM formula
        const endMemberRowNumber = 5 + sortedMembers.length;
        const totalFooterRow: any[] = [
          '',
          toSutonny('সর্বমোট'),
          '',
          '',
          '',
          ...allMemberFoodCols.map((_, cIdx) => {
            const tot = colFoodTotals[cIdx];
            const colLetter = XLSX.utils.encode_col(cIdx + 5);
            return {
              t: 'n',
              v: tot && tot > 0 ? tot : 0,
              f: `SUM(${colLetter}6:${colLetter}${endMemberRowNumber})`
            };
          })
        ];
        rows.push(totalFooterRow);

        const worksheet = XLSX.utils.aoa_to_sheet(rows);

        // Freeze E Column (Columns A..E) and Row 5 (Rows 1..5) so member names & header stay locked
        worksheet['!views'] = [{ state: 'frozen', ySplit: 5, xSplit: 5, topLeftCell: 'F6', activePane: 'bottomRight' }];
        worksheet['!freeze'] = { xSplit: 5, ySplit: 5, topLeftCell: 'F6' };

        // Set dynamic autofit column widths formatted for SutonnyMJ 16
        worksheet['!cols'] = calculateSheetColWidths(
          rows,
          { 0: 4, 1: 9, 2: 12, 3: 14, 4: 20 },
          9
        );

        const officialWsRows: any[] = [];
        officialWsRows[0] = { hpt: 18 };
        officialWsRows[1] = { hpt: 26 };
        officialWsRows[2] = { hpt: 26 };
        officialWsRows[3] = { hpt: 16 };
        officialWsRows[4] = { hpt: 30 }; // Header Row 5
        for (let r = 5; r < rows.length - 1; r++) {
          officialWsRows[r] = { hpt: 26 };
        }
        officialWsRows[rows.length - 1] = { hpt: 28 }; // Total footer row
        worksheet['!rows'] = officialWsRows;

        // Format and style cells (B5 to Last Col / Row)
        const totalCols = headerRow.length;
        const totalRows = rows.length;

        // Month & Date Banner styling (C2:D3)
        const c2Addr = XLSX.utils.encode_cell({ r: 1, c: 2 });
        const d2Addr = XLSX.utils.encode_cell({ r: 1, c: 3 });
        const c3Addr = XLSX.utils.encode_cell({ r: 2, c: 2 });
        const d3Addr = XLSX.utils.encode_cell({ r: 2, c: 3 });

        if (worksheet[c2Addr]) {
          worksheet[c2Addr].s = {
            font: { name: 'SutonnyMJ', sz: 16, bold: true, color: { rgb: '000000' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: cellBorder,
            fill: { fgColor: { rgb: 'CBD5E1' } }
          };
        }
        if (worksheet[d2Addr]) {
          worksheet[d2Addr].s = {
            font: { name: 'SutonnyMJ', sz: 16, bold: true, color: { rgb: '000000' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: cellBorder,
            fill: { fgColor: { rgb: 'FFFFFF' } }
          };
        }
        if (worksheet[c3Addr]) {
          worksheet[c3Addr].s = {
            font: { name: 'SutonnyMJ', sz: 16, bold: true, color: { rgb: '000000' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: cellBorder,
            fill: { fgColor: { rgb: 'CBD5E1' } }
          };
        }
        if (worksheet[d3Addr]) {
          worksheet[d3Addr].s = {
            font: { name: 'SutonnyMJ', sz: 16, bold: true, color: { rgb: '000000' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: cellBorder,
            fill: { fgColor: { rgb: 'FFFFFF' } }
          };
        }

        // Header row styling: Bold, Center aligned, fill 64748B with white text
        for (let c = 1; c < totalCols; c++) {
          const addr = XLSX.utils.encode_cell({ r: 4, c });
          if (worksheet[addr]) {
            worksheet[addr].s = {
              font: { name: 'SutonnyMJ', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: cellBorder,
              fill: { fgColor: { rgb: '64748B' } }
            };
          }
        }

        // Data rows styling: Clean row-wise alternating colors (White #FFFFFF and Slate #F1F5F9), no column alternation
        for (let r = 5; r < totalRows - 1; r++) {
          const isEvenRow = (r - 5) % 2 === 0;
          const rowBgColor = isEvenRow ? 'FFFFFF' : 'F1F5F9';
          for (let c = 1; c < totalCols; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!worksheet[addr]) {
              worksheet[addr] = { t: 's', v: '' };
            }
            worksheet[addr].s = {
              font: { name: 'SutonnyMJ', sz: 16, color: { rgb: '000000' } },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: cellBorder,
              fill: { fgColor: { rgb: rowBgColor } }
            };
          }
        }

        // Total footer row styling (r = totalRows - 1): Bold, Center aligned, background #94A3B8, with borders
        const totalRowIdx = totalRows - 1;
        for (let c = 1; c < totalCols; c++) {
          const addr = XLSX.utils.encode_cell({ r: totalRowIdx, c });
          if (!worksheet[addr]) {
            worksheet[addr] = { t: 's', v: '' };
          }
          worksheet[addr].s = {
            font: { name: 'SutonnyMJ', sz: 16, bold: true, color: { rgb: '000000' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: cellBorder,
            fill: { fgColor: { rgb: '94A3B8' } }
          };
        }

        // Tab name as day number '1', '2', ..., '31'
        XLSX.utils.book_append_sheet(workbook, worksheet, String(day));
      }

      await downloadExcelWithNativeFreeze(
        workbook,
        `155_UASU_Canteen_MemberWise_31Days_Matrix_${selectedYm}.xlsx`,
        { xSplit: 5, ySplit: 5, topLeftCell: 'F6' }
      );
    } catch (err: any) {
      console.error('Failed to download official matrix template:', err);
      setErrorMessage('Failed to generate template file. Please try again.');
    }
  };

  // Generate and download Template 2: Date-wise Matrix Template (Member Fixed, Left: 1-31 Date)
  const handleDownloadDateWiseMatrixTemplate = async (overrideMemberId?: any) => {
    try {
      const rawTarget = (typeof overrideMemberId === 'string' && overrideMemberId.trim()) 
        ? overrideMemberId 
        : dateTemplateMemberId;
      const targetMemberId = String(rawTarget || 'ALL').trim();
      const sortedMembers = sortCanteenMembersByOfficeSeniority(members);
      const workbook = XLSX.utils.book_new();

      const selectedYm = templateMonth || toYMDDate(new Date()).slice(0, 7);
      const [selYearStr, selMonthStr] = selectedYm.split('-');
      const selYear = parseInt(selYearStr, 10);
      const selMonth = parseInt(selMonthStr, 10);
      const daysInMonth = new Date(selYear, selMonth, 0).getDate();

      // 1. Real-time active food columns matching the App's menu catalog
      const allFoodColumns = getRealtimeCanteenFoodColumns(catalog);

      // Header row for Date-wise matrix (Col 1: Sl, Col 2: Date, Col 3..: Food items; Last Col "মোট বিল" removed as requested)
      const dateHeaderRow = [
        '',
        toSutonny('ক্রমিক নং'),
        toSutonny('তারিখ'),
        ...allFoodColumns.map(c => toSutonny(c.bn))
      ];

      // Existing sales transactions in the system
      const existingTxs: any[] = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
        } catch {
          return [];
        }
      })();

      // If specific member selected, generate single sheet. If ALL, generate for unit members
      let membersToGenerate: any[] = [];
      if (targetMemberId && targetMemberId !== 'ALL') {
        const targetLower = targetMemberId.toLowerCase();
        const found = sortedMembers.find(m => {
          const mId = String(m.airman_id || '').toLowerCase();
          const mBd = String(m['BD No'] || '').toLowerCase();
          const mCleanBd = mBd.replace(/\D/g, '');
          const targetClean = targetLower.replace(/\D/g, '');
          return mId === targetLower || mBd === targetLower || (targetClean && mCleanBd === targetClean);
        });
        membersToGenerate = found ? [found] : sortedMembers.slice(0, 10);
      } else {
        membersToGenerate = sortedMembers;
      }

      membersToGenerate.forEach((m, mIdx) => {
        const rankBn = formatRankBn(m.Rank || m.rank || '');
        const memberNameBn = m.name_bn || m.NameBn || formatMemberNameBn(m.Surname || m.Name || '') || m.Surname || m.Name || '';
        const bdNo = String(m['BD No'] || m.airman_id || '');
        const cleanBd = bdNo.replace(/\D/g, '') || String(mIdx + 1);

        const mAirman = String(m.airman_id || '').toLowerCase().trim();
        const mBd = String(m['BD No'] || m.bdNo || '').toLowerCase().trim();
        const mCleanDigits = (m['BD No'] || m.bdNo || m.airman_id || '').toString().replace(/\D/g, '');

        const fullRankAndName = `${rankBn ? rankBn + ' ' : ''}${memberNameBn}`.trim();
        const rawBd = String(m['BD No'] || m.bdNo || m.airman_id || '');
        const cleanDigits = rawBd.replace(/\D/g, '') || cleanBd;
        const bdDisplay = cleanDigits ? cleanDigits : rawBd.replace(/^BD[\/\-\s]*/i, '').trim();

        const rows: any[][] = [];
        // Row 1: B1: 'র‍্যাংক ও নাম', C1: fullRankAndName
        rows.push(['', toSutonny('র‍্যাংক ও নাম'), toSutonny(fullRankAndName)]);
        // Row 2: B2: 'বিডি নং', C2: bdDisplay
        rows.push(['', toSutonny('বিডি নং'), bdDisplay]);
        // Row 3: B3: 'মাস', C3: formatBengaliMonthYear(selectedYm)
        rows.push(['', toSutonny('মাস'), toSutonny(formatBengaliMonthYear(selectedYm))]);
        // Row 4: Spacer
        rows.push([]);
        // Row 5: Column Headers (Col B: 'ক্রমিক নং', Col C: 'তারিখ', Col D..: Foods)
        rows.push(dateHeaderRow);

        const colFoodTotals = new Array(allFoodColumns.length).fill(0);

        // Rows 6.. (Days 1 to daysInMonth)
        for (let d = 1; d <= daysInMonth; d++) {
          const dayStr = String(d).padStart(2, '0');
          const rowYmd = `${selectedYm}-${dayStr}`;
          const dStrBn = formatShortBengaliDate(d, selMonth - 1, selYear);

          // Find existing entries on that date for member m
          const dayTxs = existingTxs.filter((tx: any) => {
            if (!isSaleTransaction(tx)) return false;
            const txYmd = toYMDDate(tx.date || tx.paymentDate || tx.timestamp || tx.created_at || (typeof tx.id === 'number' ? tx.id : undefined));
            if (txYmd !== rowYmd) return false;

            const txAirman = String(tx.airman_id || tx.member_id || '').toLowerCase().trim();
            const txBd = String(tx.bdNo || '').toLowerCase().trim();
            const txDigits = (tx.bdNo || tx.airman_id || '').toString().replace(/\D/g, '');

            return (
              (mAirman && txAirman === mAirman) ||
              (mBd && txBd === mBd) ||
              (mCleanDigits && txDigits && mCleanDigits === txDigits)
            );
          });

          const foodQtyMap = new Map<number, number>();

          dayTxs.forEach((tx: any) => {
            let soldItems = tx.soldItems;
            if (typeof soldItems === 'string') {
              try { soldItems = JSON.parse(soldItems); } catch {}
            }

            if (Array.isArray(soldItems) && soldItems.length > 0) {
              soldItems.forEach((si: any) => {
                const rawName = String(si.menuItemName || si.name || si.itemName || '').trim();
                const rawBn = getMenuItemBanglaName(rawName) || formatItemNameBn(rawName) || rawName;
                const q = Number(si.qty || si.quantity || 1);

                // Find matching column in allFoodColumns
                let colIdx = allFoodColumns.findIndex(col => col.bn === rawBn || col.bn === rawName || col.enMatch.toLowerCase() === rawName.toLowerCase());
                if (colIdx === -1) {
                  colIdx = allFoodColumns.findIndex(col => {
                    const cEn = col.enMatch.toLowerCase();
                    const cBn = col.bn.toLowerCase();
                    const rLower = rawName.toLowerCase();
                    const rBnLower = rawBn.toLowerCase();
                    return cEn.includes(rLower) || rLower.includes(cEn) || cBn.includes(rBnLower) || rBnLower.includes(cBn);
                  });
                }

                if (colIdx >= 0) {
                  foodQtyMap.set(colIdx, (foodQtyMap.get(colIdx) || 0) + q);
                }
              });
            } else if (tx.items) {
              const parts = String(tx.items).split(/[,+;|\n]+/).map((s: string) => s.trim()).filter(Boolean);
              parts.forEach((p: string) => {
                let q = 1;
                let raw = p;
                const m1 = p.match(/^(.+?)\s*\(([\d০-৯]+)\)$/);
                if (m1) {
                  raw = m1[1].trim();
                  q = parseBanglaNumber(m1[2]) || 1;
                } else {
                  const m2 = p.match(/^(.+?)\s*[xX*×]\s*([\d০-৯]+)$/);
                  if (m2) {
                    raw = m2[1].trim();
                    q = parseBanglaNumber(m2[2]) || 1;
                  }
                }
                const rawBn = getMenuItemBanglaName(raw) || formatItemNameBn(raw) || raw;
                let colIdx = allFoodColumns.findIndex(col => col.bn === rawBn || col.bn === raw || col.enMatch.toLowerCase() === raw.toLowerCase());
                if (colIdx === -1) {
                  colIdx = allFoodColumns.findIndex(col => {
                    const cEn = col.enMatch.toLowerCase();
                    const cBn = col.bn.toLowerCase();
                    const rLower = raw.toLowerCase();
                    const rBnLower = rawBn.toLowerCase();
                    return cEn.includes(rLower) || rLower.includes(cEn) || cBn.includes(rBnLower) || rBnLower.includes(cBn);
                  });
                }
                if (colIdx >= 0) {
                  foodQtyMap.set(colIdx, (foodQtyMap.get(colIdx) || 0) + q);
                }
              });
            }
          });

          const rowData: any[] = [
            '',
            toSutonny(toBengaliNum(d)),
            toSutonny(dStrBn)
          ];

          allFoodColumns.forEach((_, cIdx) => {
            const qty = foodQtyMap.get(cIdx);
            if (qty && qty > 0) {
              rowData.push(qty);
              colFoodTotals[cIdx] = (colFoodTotals[cIdx] || 0) + qty;
            } else {
              rowData.push('');
            }
          });

          rows.push(rowData);
        }

        // Last row: Month total for each food item across Days 1 to 31 (with SUM formula)
        const endDayRowNumber = 5 + daysInMonth;
        const totalFooterRow: any[] = [
          '',
          toSutonny('সর্বমোট'),
          '',
          ...allFoodColumns.map((_, cIdx) => {
            const totalQty = colFoodTotals[cIdx];
            const colLetter = XLSX.utils.encode_col(cIdx + 3);
            return {
              t: 'n',
              v: totalQty && totalQty > 0 ? totalQty : 0,
              f: `SUM(${colLetter}6:${colLetter}${endDayRowNumber})`
            };
          })
        ];
        rows.push(totalFooterRow);

        const ws = XLSX.utils.aoa_to_sheet(rows);
        // Freeze C Column (Columns A..C) and Row 5 (Rows 1..5)
        ws['!views'] = [{ state: 'frozen', ySplit: 5, xSplit: 3, topLeftCell: 'D6', activePane: 'bottomRight' }];
        ws['!freeze'] = { xSplit: 3, ySplit: 5, topLeftCell: 'D6' };
        // Dynamic autofit column widths formatted for SutonnyMJ 16
        ws['!cols'] = calculateSheetColWidths(
          rows,
          { 0: 4, 1: 9, 2: 16 },
          9
        );

        // Configure row properties: Holiday date rows (Friday, Saturday & custom holidays) are hidden by default.
        // Users can easily select adjacent rows and manually unhide them in Excel if needed.
        const wsRows: any[] = [];
        wsRows[0] = { hpt: 26 };
        wsRows[1] = { hpt: 26 };
        wsRows[2] = { hpt: 26 };
        wsRows[3] = { hpt: 16 };
        wsRows[4] = { hpt: 30 }; // Header Row 5

        for (let d = 1; d <= daysInMonth; d++) {
          const r = 4 + d;
          const dayStr = String(d).padStart(2, '0');
          const dayYmd = `${selectedYm}-${dayStr}`;
          const dateObj = new Date(selYear, selMonth - 1, d);
          const isHoliday = isCanteenHolidayDate(dayYmd, dateObj);

          if (isHoliday) {
            wsRows[r] = { hidden: true, hpt: 26 };
          } else {
            wsRows[r] = { hidden: false, hpt: 26 };
          }
        }
        wsRows[5 + daysInMonth] = { hpt: 28 }; // Total footer row
        ws['!rows'] = wsRows;

        // Common black thin border for table cells
        const cellBorder = {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        };

        const totalCols = dateHeaderRow.length;
        const totalRows = rows.length;

        // Top banner styling (B1..C3)
        for (let r = 0; r <= 2; r++) {
          for (let c = 1; c <= 2; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (ws[addr]) {
              const isLabel = (c === 1);
              ws[addr].s = {
                font: { name: 'SutonnyMJ', sz: 16, bold: true, color: { rgb: '000000' } },
                alignment: { horizontal: 'center', vertical: 'center' },
                border: cellBorder,
                fill: { fgColor: { rgb: isLabel ? 'CBD5E1' : 'FFFFFF' } }
              };
            }
          }
        }

        // Header row styling (r=4, Col B to Last): Bold, Center Aligned, with borders, fill 64748B with white text
        for (let c = 1; c < totalCols; c++) {
          const addr = XLSX.utils.encode_cell({ r: 4, c });
          if (ws[addr]) {
            ws[addr].s = {
              font: { name: 'SutonnyMJ', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: cellBorder,
              fill: { fgColor: { rgb: '64748B' } }
            };
          }
        }

        // Data rows styling (r=5 to totalRows-2):
        // Clean row-wise alternating colors (White #FFFFFF and Slate #F1F5F9), no column alternation.
        // Holiday rows (when manually unhidden in Excel) are styled with soft rose #FEE2E2 / #FECACA and bold text.
        for (let r = 5; r < totalRows - 1; r++) {
          const d = r - 4;
          const dayStr = String(d).padStart(2, '0');
          const dayYmd = `${selectedYm}-${dayStr}`;
          const dateObj = new Date(selYear, selMonth - 1, d);
          const isHoliday = isCanteenHolidayDate(dayYmd, dateObj);
          const isEvenRow = (r - 5) % 2 === 0;
          const rowBgColor = isHoliday 
            ? (isEvenRow ? 'FEE2E2' : 'FECACA') 
            : (isEvenRow ? 'FFFFFF' : 'F1F5F9');

          for (let c = 1; c < totalCols; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (!ws[addr]) {
              ws[addr] = { t: 's', v: '' };
            }

            ws[addr].s = {
              font: { 
                name: 'SutonnyMJ', 
                sz: 16, 
                bold: isHoliday && (c === 1 || c === 2),
                color: { rgb: isHoliday ? '991B1B' : '000000' } 
              },
              alignment: { horizontal: 'center', vertical: 'center' },
              border: cellBorder,
              fill: { fgColor: { rgb: rowBgColor } }
            };
          }
        }

        // Total footer row styling (r = totalRows - 1): Bold, Center aligned, background #94A3B8, with borders
        const totalRowIdx = totalRows - 1;
        for (let c = 1; c < totalCols; c++) {
          const addr = XLSX.utils.encode_cell({ r: totalRowIdx, c });
          if (!ws[addr]) {
            ws[addr] = { t: 's', v: '' };
          }
          ws[addr].s = {
            font: { name: 'SutonnyMJ', sz: 16, bold: true, color: { rgb: '000000' } },
            alignment: { horizontal: 'center', vertical: 'center' },
            border: cellBorder,
            fill: { fgColor: { rgb: '94A3B8' } }
          };
        }

        const tabTitle = `${memberNameBn.slice(0, 10)} (${cleanBd.slice(-4)})`.replace(/[\\/?*:[\]]/g, '');
        XLSX.utils.book_append_sheet(workbook, ws, tabTitle || `Member_${mIdx + 1}`);
      });

      const memberSuffix = (targetMemberId && targetMemberId !== 'ALL' && membersToGenerate[0])
        ? `_${(membersToGenerate[0].Surname || 'Member').replace(/\s+/g, '_')}`
        : '_MultiMembers';

      await downloadExcelWithNativeFreeze(
        workbook,
        `155_UASU_Canteen_DateWise_Bill_Matrix_${selectedYm}${memberSuffix}.xlsx`,
        { xSplit: 3, ySplit: 5, topLeftCell: 'D6' }
      );
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
          'BD No': '470696',
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
          'BD No': '465170',
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
        let colBdIdx = -1;

        for (let rIdx = 0; rIdx < Math.min(rawMatrix.length, 12); rIdx++) {
          const row = rawMatrix[rIdx];
          if (!Array.isArray(row)) continue;

          for (let cIdx = 0; cIdx < row.length; cIdx++) {
            const rawCell = String(row[cIdx] || '').trim();
            const decodedCell = fromSutonny(rawCell).trim();
            const cell = rawCell.toLowerCase();
            const dCell = decodedCell.toLowerCase();

            if (
              cell.includes('পদবী') || cell.includes('পদবি') || cell === 'rank' ||
              cell.includes('c`ex') || dCell.includes('পদবী') || dCell.includes('পদবি')
            ) {
              colRankIdx = cIdx;
            }
            if (
              cell.includes('নাম') || cell === 'name' ||
              cell.includes('bvg') || dCell.includes('নাম')
            ) {
              colNameIdx = cIdx;
            }
            if (
              cell.includes('ক্রমিক') || cell.includes('ক্র') || cell.includes('sl') || cell.includes('ser') ||
              cell.includes('µwgK') || dCell.includes('ক্রমিক') || dCell.includes('µwgK')
            ) {
              colSerIdx = cIdx;
            }
            if (
              cell.includes('বিডি') || cell.includes('bd') || cell.includes('service') ||
              cell.includes('wewW') || cell.includes('weww') || dCell.includes('বিডি') ||
              cell.includes('airman')
            ) {
              colBdIdx = cIdx;
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
          let detectedYear = new Date().getFullYear();
          let detectedMonth = String(new Date().getMonth() + 1).padStart(2, '0');

          // Check Row 2 (r=1) for C2 'মাস' and D2 month name
          const r2Daily = rawMatrix[1];
          if (r2Daily) {
            const c2 = String(r2Daily[2] || '').trim();
            const d2 = String(r2Daily[3] || '').trim();
            if ((c2.includes('মাস') || c2.includes('gvm') || fromSutonny(c2).includes('মাস')) && d2) {
              const parsedM = parseBanglaOrEnglishDate(d2) || parseBanglaOrEnglishDate(fromSutonny(d2));
              if (parsedM && parsedM.length === 10) {
                const parts = parsedM.split('-');
                detectedYear = parseInt(parts[0], 10) || detectedYear;
                detectedMonth = parts[1] || detectedMonth;
              }
            }
          }

          // Check Row 3 (r=2) for C3 'তারিখ' and D3 date value (directly under মাস & মাসের নাম)
          const r3Daily = rawMatrix[2];
          if (r3Daily) {
            const c3 = String(r3Daily[2] || '').trim();
            const d3 = String(r3Daily[3] || '').trim();
            if ((c3.includes('তারিখ') || c3.includes('ZvwiL') || fromSutonny(c3).includes('তারিখ')) && d3) {
              const parsedDate = parseDateWiseMatrixDate(d3, detectedYear, parseInt(detectedMonth, 10)) ||
                parseDateWiseMatrixDate(fromSutonny(d3), detectedYear, parseInt(detectedMonth, 10)) ||
                parseBanglaOrEnglishDate(d3) || parseBanglaOrEnglishDate(fromSutonny(d3));
              if (parsedDate && parsedDate.length === 10) {
                sheetDate = parsedDate;
              }
            }
          }

          if (!sheetDate) {
            for (let r = 0; r <= matrixHeaderRowIdx; r++) {
              const row = rawMatrix[r] || [];
              for (let c = 0; c < row.length; c++) {
                const cellText = String(row[c] || '').trim();
                const dText = fromSutonny(cellText).trim();
                if (
                  cellText.includes('তারিখ') || cellText.toLowerCase().includes('date') || 
                  cellText.includes('ZvwiL') || dText.includes('তারিখ')
                ) {
                  const nextCell = String(row[c + 1] || row[c + 2] || '').trim();
                  sheetDate = parseDateWiseMatrixDate(nextCell, detectedYear, parseInt(detectedMonth, 10)) || 
                    parseDateWiseMatrixDate(fromSutonny(nextCell), detectedYear, parseInt(detectedMonth, 10)) ||
                    parseBanglaOrEnglishDate(nextCell || cellText) || parseBanglaOrEnglishDate(fromSutonny(nextCell || cellText));
                  break;
                }
              }
              if (sheetDate) break;
            }
          }

          // If no date in cells, check if sheet name is a day number (e.g. "1", "2", "15")
          if (!sheetDate) {
            const dayNum = parseInt(banglaToEnglishDigits(sheetName), 10);
            if (!isNaN(dayNum) && dayNum >= 1 && dayNum <= 31) {
              sheetDate = `${detectedYear}-${detectedMonth}-${String(dayNum).padStart(2, '0')}`;
            } else {
              sheetDate = `${detectedYear}-${detectedMonth}-01`;
            }
          }

          // Map Food Columns (columns after max member column up to "মোট বিল")
          const maxMemberColIdx = Math.max(colNameIdx, colRankIdx, colBdIdx);
          const foodCols: Array<{ colIdx: number; headerName: string; catalogItem: any }> = [];
          for (let c = maxMemberColIdx + 1; c < headerRow.length; c++) {
            const hText = String(headerRow[c] || '').trim();
            if (!hText) continue;
            if (hText.includes('মোট বিল') || hText.toLowerCase().includes('total') || hText.includes('‡gvU')) {
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
            const rankVal = colRankIdx !== -1 ? String(row[colRankIdx] || '').trim() : '';
            const nameVal = colNameIdx !== -1 ? String(row[colNameIdx] || '').trim() : '';
            const bdVal = colBdIdx !== -1 ? String(row[colBdIdx] || '').trim() : '';
            const slVal = colSerIdx !== -1 ? String(row[colSerIdx] || '').trim() : '';

            if (!nameVal && !rankVal && !bdVal && !slVal) continue;
            if (
              nameVal.includes('সর্বমোট') || nameVal.includes('মোট') || 
              rankVal.includes('সর্বমোট') || rankVal.includes('মোট') || 
              bdVal.includes('সর্বমোট') || bdVal.includes('মোট') ||
              slVal.includes('সর্বমোট') || slVal.includes('মোট') ||
              fromSutonny(nameVal).includes('সর্বমোট') || fromSutonny(nameVal).includes('মোট')
            ) {
              break; // Reached footer total row
            }

            let matchedMem = null;
            const cleanDigits = bdVal.replace(/\D/g, '') || fromSutonny(bdVal).replace(/\D/g, '');
            if (cleanDigits) {
              matchedMem = members.find(m => String(m['BD No'] || m.airman_id || '').replace(/\D/g, '') === cleanDigits);
            }
            if (!matchedMem) {
              matchedMem = findMemberByRankAndName(rankVal, nameVal, members);
            }

            const bdNo = bdVal || (matchedMem ? (matchedMem['BD No'] || matchedMem.bdNo || matchedMem.airman_id) : '');
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

            // 1. Identify Fixed Member for this sheet (from header banner cells B1-C3 or sheet tab name)
            let fixedRank = '';
            let fixedName = '';
            let fixedBd = '';
            let sheetYear = new Date().getFullYear();
            let sheetMonth = String(new Date().getMonth() + 1).padStart(2, '0');

            const sheetBdMatch = sheetName.match(/\b(\d{4,7})\b/);
            if (sheetBdMatch) fixedBd = sheetBdMatch[1];
            const cleanSheetName = sheetName.replace(/\(\d+\)/, '').trim();

            for (let r = 0; r <= dateMatrixHeaderRowIdx; r++) {
              const row = rawMatrix[r] || [];
              for (let c = 0; c < row.length; c++) {
                const rawCellText = String(row[c] || '').trim();
                if (!rawCellText) continue;
                const decodedCellText = fromSutonny(rawCellText).trim();
                const cellText = (rawCellText + ' ' + decodedCellText).trim();

                const bdMatch = cellText.match(/BD[\s\/\-_:]*(\d{4,7})/i) || cellText.match(/বিডি[\s\/\-_:]*(\d{4,7})/i) || cellText.match(/\b(\d{5,7})\b/);
                if (bdMatch && !fixedBd) {
                  fixedBd = bdMatch[1];
                }
                if (
                  cellText.includes('র‍্যাংক ও নাম') || cellText.includes('পদবী ও নাম') ||
                  cellText.includes('Rank & Name') || cellText.includes('Rank and Name') ||
                  cellText.includes('i‍¨vsK I bvg') || cellText.includes('c`ex I bvg')
                ) {
                  const val = String(row[c + 1] || row[c + 2] || '').trim();
                  if (val) {
                    const matched = findMemberByRankAndName('', val, members);
                    if (matched) {
                      if (!fixedName) fixedName = matched.Surname || matched.Name || val;
                      if (!fixedRank) fixedRank = matched.Rank || matched.rank || '';
                      if (!fixedBd) fixedBd = String(matched['BD No'] || matched.airman_id || '').replace(/\D/g, '');
                    } else if (!fixedName) {
                      fixedName = fromSutonny(val) || val;
                    }
                  }
                }
                if (cellText === 'নাম' || cellText.toLowerCase() === 'name' || cellText.includes('সদস্য') || cellText === 'bvg') {
                  const val = String(row[c + 1] || row[c + 2] || '').trim();
                  if (val && !fixedName) fixedName = fromSutonny(val) || val;
                }
                if (cellText === 'র‍্যাংক' || cellText === 'পদবী' || cellText.toLowerCase() === 'rank' || cellText === 'c`ex') {
                  const val = String(row[c + 1] || row[c + 2] || '').trim();
                  if (val && !fixedRank) fixedRank = fromSutonny(val) || val;
                }
                if (
                  cellText.includes('বিডি নং') || cellText.includes('বিডি') || cellText.toLowerCase().includes('bd no') ||
                  cellText.includes('wewW') || cellText.toLowerCase().includes('weww')
                ) {
                  const rawVal = String(row[c + 1] || row[c + 2] || '').trim();
                  const valStr = rawVal + ' ' + fromSutonny(rawVal);
                  const m = valStr.match(/\b(\d{4,7})\b/);
                  if (m && !fixedBd) fixedBd = m[1];
                }
                if (cellText.includes('মাস') || cellText.toLowerCase().includes('month') || cellText.includes('gvm')) {
                  const val = String(row[c + 1] || row[c + 2] || '').trim();
                  if (val) {
                    const parsedM = parseBanglaOrEnglishDate(val) || parseBanglaOrEnglishDate(fromSutonny(val));
                    if (parsedM && parsedM.length === 10) {
                      const parts = parsedM.split('-');
                      sheetYear = parseInt(parts[0], 10) || sheetYear;
                      sheetMonth = parts[1] || sheetMonth;
                    }
                  }
                }
              }
            }

            let matchedMem = null;
            if (fixedBd) {
              const cleanBd = fixedBd.replace(/\D/g, '');
              matchedMem = members.find(m => String(m['BD No'] || m.airman_id || '').replace(/\D/g, '') === cleanBd);
            }
            if (!matchedMem && (fixedName || fixedRank)) {
              matchedMem = findMemberByRankAndName(fixedRank, fixedName, members);
            }
            if (!matchedMem) {
              matchedMem = findMemberByRankAndName('', cleanSheetName || sheetName, members);
            }

            const finalBd = matchedMem ? (matchedMem['BD No'] || matchedMem.bdNo || matchedMem.airman_id) : (fixedBd ? `BD/${fixedBd}` : 'N/A');
            const finalRank = matchedMem ? (matchedMem.Rank || matchedMem.rank || '') : (fixedRank || '');
            const finalName = matchedMem ? (matchedMem.Surname || matchedMem.Name || '') : (fixedName || cleanSheetName || sheetName);

            // 2. Identify month & year from banner cells (specifically C2/D2) or current
            // (sheetYear and sheetMonth already initialized above)

            // Check Row 2 (r=1) for C2 'মাস' and D2 month name
            const r2DateWise = rawMatrix[1];
            if (r2DateWise) {
              const c2Val = String(r2DateWise[2] || '').trim();
              const d2Val = String(r2DateWise[3] || '').trim();
              if (c2Val.includes('মাস') && d2Val) {
                const parsedM = parseBanglaOrEnglishDate(d2Val);
                if (parsedM && parsedM.length === 10) {
                  const parts = parsedM.split('-');
                  sheetYear = parseInt(parts[0], 10) || sheetYear;
                  sheetMonth = parts[1] || sheetMonth;
                }
              }
            }

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
              const slCell = colDateIdx > 0 ? String(row[colDateIdx - 1] || '').trim() : '';
              if (dateCell === undefined || dateCell === null || String(dateCell).trim() === '') {
                if (slCell.includes('সর্বমোট') || slCell.includes('মোট')) break;
                continue;
              }
              const dateStr = String(dateCell).trim();
              if (
                dateStr.includes('সর্বমোট') || dateStr.includes('মোট') || dateStr.toLowerCase().includes('total') ||
                slCell.includes('সর্বমোট') || slCell.includes('মোট') || slCell.toLowerCase().includes('total')
              ) {
                break;
              }

              let rowDate = parseDateWiseMatrixDate(dateStr, sheetYear, parseInt(sheetMonth, 10));
              if (!rowDate) {
                const dayNum = parseBanglaNumber(dateStr);
                if (dayNum >= 1 && dayNum <= 31 && !dateStr.includes('-') && !dateStr.includes('/') && !dateStr.includes('.')) {
                  rowDate = `${sheetYear}-${sheetMonth}-${String(dayNum).padStart(2, '0')}`;
                } else {
                  rowDate = parseBanglaOrEnglishDate(dateCell, `${sheetYear}-${sheetMonth}-01`);
                }
              } else {
                const ymdParts = rowDate.split('-');
                if (ymdParts.length === 3) {
                  sheetYear = parseInt(ymdParts[0], 10) || sheetYear;
                  sheetMonth = ymdParts[1] || sheetMonth;
                }
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

  // Execute Import & commit to canteen_txs, Member Due, and Raw Stock (Replaces previous entries on same date)
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
      // 1. Group imported rows by (member, date) so each day has one clean consolidated sale
      const groupedByMemberDate = new Map<string, ParsedSaleRow[]>();
      for (const row of rowsToImport) {
        const rowDateYmd = toYMDDate(row.date) || row.date;
        const airmanId = String(row.matchedMember?.airman_id || '').trim();
        const bdDigits = String(row.bdNo || row.matchedMember?.['BD No'] || '').replace(/\D/g, '');
        const memberNameClean = String(row.matchedMember?.Surname || row.matchedMember?.Name || row.memberName || '').trim().toLowerCase();
        const memberKey = airmanId || (bdDigits ? `bd_${bdDigits}` : `name_${memberNameClean}`);
        const key = `${memberKey}__${rowDateYmd}`;
        if (!groupedByMemberDate.has(key)) {
          groupedByMemberDate.set(key, []);
        }
        groupedByMemberDate.get(key)!.push(row);
      }

      // Build keys to replace:
      const importedMemberDateKeys = new Set<string>();
      rowsToImport.forEach(r => {
        const rowDateYmd = toYMDDate(r.date) || r.date;
        if (!rowDateYmd) return;

        const mAirman = String(r.matchedMember?.airman_id || '').toLowerCase().trim();
        const mBd = String(r.matchedMember?.['BD No'] || r.bdNo || '').toLowerCase().trim();
        const mDigits = String(r.bdNo || r.matchedMember?.airman_id || r.matchedMember?.['BD No'] || '').replace(/\D/g, '');
        const mName = String(r.matchedMember?.Surname || r.matchedMember?.Name || r.memberName || '').toLowerCase().trim();
        const mNameClean = mName.replace(/^(উইং কমাঃ|উইং কমান্ডার|স্কোয়াড্রন লিডার|ফ্লাইট লেফটেন্যান্ট|ফ্লাইং অফিসার|সুপারিন্টেন্ডেন্ট|ওয়ারেন্ট অফিসার|মাস্টার ওয়ারেন্ট অফিসার|কর্পোরাল|সার্জেন্ট|সিনিয়র ওয়ারেন্ট অফিসার|wg cdr|sqn ldr|flt lt|fg off|swo|mwo|wo|sgt|cpl|lac|ac)\.?\s*/i, '').trim();

        if (mAirman) importedMemberDateKeys.add(`${mAirman}__${rowDateYmd}`);
        if (mBd) importedMemberDateKeys.add(`${mBd}__${rowDateYmd}`);
        if (mDigits && mDigits.length >= 3) importedMemberDateKeys.add(`digits_${mDigits}__${rowDateYmd}`);
        if (mName) importedMemberDateKeys.add(`name_${mName}__${rowDateYmd}`);
        if (mNameClean) importedMemberDateKeys.add(`name_${mNameClean}__${rowDateYmd}`);
      });

      // Filter existing transactions: Keep transactions that are NOT on the replaced (member, date)
      const existingTxs: any[] = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const keptTransactions: any[] = [];
      const memberDueDeductions = new Map<string, number>();

      existingTxs.forEach((tx: any) => {
        if (!isSaleTransaction(tx)) {
          keptTransactions.push(tx);
          return;
        }

        const txDateYmd = toYMDDate(tx.date || tx.paymentDate || tx.timestamp || tx.created_at || (typeof tx.id === 'number' ? tx.id : undefined));
        const txAirman = String(tx.airman_id || tx.member_id || '').toLowerCase().trim();
        const txBd = String(tx.bdNo || '').toLowerCase().trim();
        const txDigits = (tx.bdNo || tx.airman_id || '').toString().replace(/\D/g, '');
        const txName = String(tx.memberName || tx.name || '').toLowerCase().trim();
        const txNameClean = txName.replace(/^(উইং কমাঃ|উইং কমান্ডার|স্কোয়াড্রন লিডার|ফ্লাইট লেফটেন্যান্ট|ফ্লাইং অফিসার|সুপারিন্টেন্ডেন্ট|ওয়ারেন্ট অফিসার|মাস্টার ওয়ারেন্ট অফিসার|কর্পোরাল|সার্জেন্ট|সিনিয়র ওয়ারেন্ট অফিসার|wg cdr|sqn ldr|flt lt|fg off|swo|mwo|wo|sgt|cpl|lac|ac)\.?\s*/i, '').trim();

        const isMatch = (
          (txAirman && txDateYmd && importedMemberDateKeys.has(`${txAirman}__${txDateYmd}`)) ||
          (txBd && txDateYmd && importedMemberDateKeys.has(`${txBd}__${txDateYmd}`)) ||
          (txDigits && txDigits.length >= 3 && txDateYmd && importedMemberDateKeys.has(`digits_${txDigits}__${txDateYmd}`)) ||
          (txName && txDateYmd && importedMemberDateKeys.has(`name_${txName}__${txDateYmd}`)) ||
          (txNameClean && txDateYmd && importedMemberDateKeys.has(`name_${txNameClean}__${txDateYmd}`))
        );

        if (isMatch) {
          // This old sale is being REPLACED by the new import entry!
          const txStatus = String(tx.status || tx.paymentStatus || tx.paymentMethod || 'DUE').toUpperCase();
          if (txStatus === 'DUE') {
            const memberKey = tx.airman_id || tx.bdNo || txDigits;
            const currentSub = memberDueDeductions.get(memberKey) || 0;
            memberDueDeductions.set(memberKey, currentSub + Number(tx.amount || 0));
          }
        } else {
          keptTransactions.push(tx);
        }
      });

      // 2. Generate new consolidated transactions
      const newTransactions: any[] = [];
      const memberDueAdditions = new Map<string, number>();
      const stockDeductionList: Array<{ menuItemId: string; menuItemName: string; qty: number }> = [];

      groupedByMemberDate.forEach((rowsGroup) => {
        const first = rowsGroup[0];
        const targetMember = first.matchedMember;
        const airmanId = targetMember ? targetMember.airman_id : first.bdNo;
        const memberName = targetMember ? (targetMember.Surname || targetMember.Name || targetMember.name || first.memberName) : first.memberName;
        const rank = targetMember ? (targetMember.Rank || targetMember.rank || first.rank) : first.rank;
        const bdNo = targetMember ? (targetMember['BD No'] || targetMember.bdNo || first.bdNo) : first.bdNo;

        const dayTotal = rowsGroup.reduce((sum, r) => sum + r.totalAmount, 0);
        const dayOriginal = rowsGroup.reduce((sum, r) => sum + (r.qty * r.unitPrice), 0);
        const dayDiscount = rowsGroup.reduce((sum, r) => sum + r.discount, 0);
        const txDateStr = formatCanteenDate(first.date);

        // Aggregate food items on that day so each unique food item has one clean line
        const itemAggMap = new Map<string, { menuItemId: string; menuItemName: string; price: number; qty: number; totalPrice: number }>();
        rowsGroup.forEach(r => {
          const normName = getMenuItemBanglaName(r.menuItemName) || formatItemNameBn(r.menuItemName) || r.menuItemName;
          const existing = itemAggMap.get(normName);
          if (existing) {
            existing.qty += r.qty;
            existing.totalPrice += r.totalAmount;
          } else {
            itemAggMap.set(normName, {
              menuItemId: r.matchedMenuItem?.id || `item-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
              menuItemName: normName,
              price: r.unitPrice,
              qty: r.qty,
              totalPrice: r.totalAmount
            });
          }
        });
        const soldItems = Array.from(itemAggMap.values());
        const itemsSummary = soldItems.map(s => `${s.menuItemName} (${s.qty})`).join(', ');

        const tx = {
          id: `tx-sale-import-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          date: txDateStr,
          timestamp: new Date(first.date).getTime() || Date.now(),
          airman_id: airmanId,
          bdNo: bdNo,
          memberName: memberName,
          rank: rank || '',
          items: itemsSummary,
          soldItems: soldItems,
          originalAmount: dayOriginal,
          discount: dayDiscount,
          amount: dayTotal,
          type: 'SALE',
          status: first.paymentMode || 'DUE',
          paymentStatus: first.paymentMode || 'DUE',
          gateway: (first.paymentMode === 'PAID') ? 'CASH' : 'DUE',
          paymentMethod: (first.paymentMode === 'PAID') ? 'CASH' : 'DUE',
          notes: `Date-wise Matrix Import (${first.date})`
        };

        newTransactions.push(tx);

        if (updateMemberDue && first.paymentMode !== 'PAID') {
          const currentAdd = memberDueAdditions.get(airmanId) || 0;
          memberDueAdditions.set(airmanId, currentAdd + dayTotal);
        }

        if (deductStock) {
          rowsGroup.forEach(r => {
            stockDeductionList.push({
              menuItemId: r.matchedMenuItem?.id || '',
              menuItemName: r.menuItemName,
              qty: r.qty
            });
          });
        }
      });

      // 3. Update Member Dues (New Due - Old Replaced Due)
      if (updateMemberDue) {
        const allMemberKeys = new Set([...memberDueAdditions.keys(), ...memberDueDeductions.keys()]);
        for (const key of allMemberKeys) {
          const add = memberDueAdditions.get(key) || 0;
          const sub = memberDueDeductions.get(key) || 0;
          const netChange = add - sub;
          if (netChange !== 0) {
            const targetMem = members.find(m => 
              m.airman_id === key || 
              m['BD No'] === key || 
              String(m['BD No'] || '').replace(/\D/g, '') === String(key).replace(/\D/g, '')
            );
            if (targetMem) {
              const currentDue = Number(targetMem.Due ?? targetMem.due ?? targetMem.baki ?? 0);
              const newDue = Math.max(0, currentDue + netChange);
              targetMem.Due = newDue;
              targetMem.due = newDue;
              targetMem.baki = newDue;
              supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', targetMem.airman_id).then();
            }
          }
        }
        setCanteenMembersCache(members);
      }

      // 4. Save merged transactions (new ones replace old ones on those dates)
      const mergedTxs = [...newTransactions, ...keptTransactions];
      localStorage.setItem('canteen_txs', JSON.stringify(mergedTxs));
      await pushKeyToCloud('canteen_txs', mergedTxs).catch(() => {});

      // 5. Deduct stock from raw inventory & menu cache if enabled
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

      // 5B. Record to POS Import History
      const importBatchId = `batch-pos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date();
      const displayDate = now.toLocaleDateString('bn-BD', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const newBatch: PosImportBatch = {
        id: importBatchId,
        createdAt: Date.now(),
        displayDate,
        sourceName: file?.name || (detectedFormat === 'MEMBER_WISE_MATRIX' ? 'সদস্য ভিত্তিক ম্যাট্রিক্স' : detectedFormat === 'DATE_WISE_MATRIX' ? 'তারিখ ভিত্তিক ম্যাট্রিক্স' : 'লিস্ট ফাইল'),
        templateType: detectedFormat || 'MEMBER_WISE_MATRIX',
        totalTransactions: newTransactions.length,
        totalAmount: summary.totalAmount,
        dueAmount: summary.dueAmount,
        createdTransactionIds: newTransactions.map(t => t.id),
        appliedMemberDue: updateMemberDue,
        deductedStock: deductStock,
        items: newTransactions.map(t => ({
          id: t.id,
          date: t.date,
          airman_id: t.airman_id,
          bdNo: t.bdNo,
          rank: t.rank,
          memberName: t.memberName,
          items: t.items,
          soldItems: t.soldItems,
          totalAmount: t.amount,
          paymentMode: t.paymentStatus || t.status || 'DUE'
        }))
      };

      const updatedHistory = [newBatch, ...posImportHistory];
      setPosImportHistory(updatedHistory);
      try {
        localStorage.setItem('canteen_pos_import_history', JSON.stringify(updatedHistory));
        await pushKeyToCloud('canteen_pos_import_history', updatedHistory).catch(() => {});
      } catch (err) {
        console.warn('Failed saving POS import history:', err);
      }

      // 6. Dispatch global realtime events
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_pos_import_history_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_fund_updated'));
      window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
      window.dispatchEvent(new Event('canteen_inventory_updated'));
      window.dispatchEvent(new Event('storage'));

      setSuccessMessage(`✅ Successfully imported ${newTransactions.length} daily POS entries (Old entries replaced, Total ৳${summary.totalAmount.toLocaleString()})!`);

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

  // Revert / Remove an entire Import Batch
  const handleDeleteBatch = async (batch: PosImportBatch, revertDues: boolean = true) => {
    setIsRollingBack(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      // 1. Revert member dues if they were applied
      if (revertDues && batch.appliedMemberDue) {
        const memberDuesToDeduct = new Map<string, number>();
        batch.items.forEach(it => {
          if (it.paymentMode === 'DUE') {
            const key = it.airman_id || it.bdNo || String(it.bdNo).replace(/\D/g, '');
            memberDuesToDeduct.set(key, (memberDuesToDeduct.get(key) || 0) + Number(it.totalAmount || 0));
          }
        });

        for (const [key, dueDeduct] of memberDuesToDeduct.entries()) {
          const targetMem = members.find(m => 
            m.airman_id === key || 
            m['BD No'] === key || 
            String(m['BD No'] || '').replace(/\D/g, '') === String(key).replace(/\D/g, '')
          );
          if (targetMem) {
            const curDue = Number(targetMem.Due ?? targetMem.due ?? 0);
            const newDue = Math.max(0, curDue - dueDeduct);
            targetMem.Due = newDue;
            targetMem.due = newDue;
            await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', targetMem.airman_id);
          }
        }
        setCanteenMembersCache(members);
      }

      // 2. Remove transactions from canteen_txs & record tombstones
      const rawTxs = localStorage.getItem('canteen_txs');
      let txs: any[] = rawTxs ? JSON.parse(rawTxs) : [];
      const txIdSet = new Set((batch.createdTransactionIds || []).map(String));

      txIdSet.forEach(id => recordDeletedTxId(id));

      const updatedTxs = txs.filter(t => !txIdSet.has(String(t.id)));
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
      await pushKeyToCloud('canteen_txs', updatedTxs).catch(() => {});

      // 3. Remove batch from history
      const nextHistory = posImportHistory.filter(b => b.id !== batch.id);
      setPosImportHistory(nextHistory);
      localStorage.setItem('canteen_pos_import_history', JSON.stringify(nextHistory));
      await pushKeyToCloud('canteen_pos_import_history', nextHistory).catch(() => {});

      // 4. Dispatch events
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_pos_import_history_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_fund_updated'));
      window.dispatchEvent(new Event('storage'));

      setRollbackBatch(null);
      setSuccessMessage(`ইম্পোর্ট ব্যাচ (${batch.displayDate}) সফলভাবে মুছে ফেলা হয়েছে এবং বকেয়া রিভার্স করা হয়েছে!`);
    } catch (err: any) {
      setErrorMessage(`ব্যাচ রিমুভ ব্যর্থ হয়েছে: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsRollingBack(false);
    }
  };

  // Remove a single item from an Import Batch
  const handleDeleteBatchItem = async (batchId: string, item: PosImportBatchItem) => {
    try {
      // 1. Revert Due if DUE
      if (item.paymentMode === 'DUE') {
        const key = item.airman_id || item.bdNo || String(item.bdNo).replace(/\D/g, '');
        const targetMem = members.find(m => 
          m.airman_id === key || 
          m['BD No'] === key || 
          String(m['BD No'] || '').replace(/\D/g, '') === String(key).replace(/\D/g, '')
        );
        if (targetMem) {
          const curDue = Number(targetMem.Due ?? targetMem.due ?? 0);
          const newDue = Math.max(0, curDue - item.totalAmount);
          targetMem.Due = newDue;
          targetMem.due = newDue;
          await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', targetMem.airman_id);
          setCanteenMembersCache(members);
        }
      }

      // 2. Remove tx from canteen_txs
      recordDeletedTxId(item.id);
      const rawTxs = localStorage.getItem('canteen_txs');
      let txs: any[] = rawTxs ? JSON.parse(rawTxs) : [];
      const updatedTxs = txs.filter(t => String(t.id) !== String(item.id));
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
      await pushKeyToCloud('canteen_txs', updatedTxs).catch(() => {});

      // 3. Update history
      const nextHistory = posImportHistory.map(b => {
        if (b.id !== batchId) return b;
        const newItems = b.items.filter(it => it.id !== item.id);
        const newTotal = newItems.reduce((sum, it) => sum + it.totalAmount, 0);
        const newDue = newItems.filter(it => it.paymentMode === 'DUE').reduce((sum, it) => sum + it.totalAmount, 0);
        return {
          ...b,
          totalTransactions: newItems.length,
          totalAmount: newTotal,
          dueAmount: newDue,
          createdTransactionIds: b.createdTransactionIds.filter(id => id !== item.id),
          items: newItems
        };
      }).filter(b => b.items.length > 0);

      setPosImportHistory(nextHistory);
      localStorage.setItem('canteen_pos_import_history', JSON.stringify(nextHistory));
      await pushKeyToCloud('canteen_pos_import_history', nextHistory).catch(() => {});

      // 4. Dispatch events
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_pos_import_history_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      setSuccessMessage('ট্রানজ্যাকশন সফলভাবে মুছে ফেলা হয়েছে!');
    } catch (err: any) {
      setErrorMessage(`রিমুভ ব্যর্থ হয়েছে: ${err?.message || 'Unknown error'}`);
    }
  };

  // Edit and Save a Transaction from an Import Batch
  const handleSaveEditBatchItem = async (batchId: string, originalItem: PosImportBatchItem, form: Partial<PosImportBatchItem>) => {
    try {
      const newAmount = Number(form.totalAmount !== undefined ? form.totalAmount : originalItem.totalAmount);
      const newMode = (form.paymentMode || originalItem.paymentMode || 'DUE') as 'DUE' | 'PAID';
      const newDate = form.date || originalItem.date;
      const newItemsStr = form.items || originalItem.items;

      // Due Adjustment
      const oldDue = originalItem.paymentMode === 'DUE' ? originalItem.totalAmount : 0;
      const nextDue = newMode === 'DUE' ? newAmount : 0;
      const netDueDiff = nextDue - oldDue;

      if (netDueDiff !== 0) {
        const key = originalItem.airman_id || originalItem.bdNo || String(originalItem.bdNo).replace(/\D/g, '');
        const targetMem = members.find(m => 
          m.airman_id === key || 
          m['BD No'] === key || 
          String(m['BD No'] || '').replace(/\D/g, '') === String(key).replace(/\D/g, '')
        );
        if (targetMem) {
          const curDue = Number(targetMem.Due ?? targetMem.due ?? 0);
          const updatedDue = Math.max(0, curDue + netDueDiff);
          targetMem.Due = updatedDue;
          targetMem.due = updatedDue;
          await supabase.from('Canteen_Member').update({ Due: updatedDue }).eq('airman_id', targetMem.airman_id);
          setCanteenMembersCache(members);
        }
      }

      // Update in canteen_txs
      const rawTxs = localStorage.getItem('canteen_txs');
      let txs: any[] = rawTxs ? JSON.parse(rawTxs) : [];
      const updatedTxs = txs.map(t => {
        if (String(t.id) === String(originalItem.id)) {
          return {
            ...t,
            date: formatCanteenDate(newDate),
            amount: newAmount,
            status: newMode,
            paymentStatus: newMode,
            paymentMethod: newMode === 'PAID' ? 'CASH' : 'DUE',
            gateway: newMode === 'PAID' ? 'CASH' : 'DUE',
            items: newItemsStr
          };
        }
        return t;
      });
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
      await pushKeyToCloud('canteen_txs', updatedTxs).catch(() => {});

      // Update in History batch
      const nextHistory = posImportHistory.map(b => {
        if (b.id !== batchId) return b;
        const newItems = b.items.map(it => {
          if (it.id === originalItem.id) {
            return {
              ...it,
              date: newDate,
              items: newItemsStr,
              totalAmount: newAmount,
              paymentMode: newMode
            };
          }
          return it;
        });
        const newTotal = newItems.reduce((sum, it) => sum + it.totalAmount, 0);
        const newDueTotal = newItems.filter(it => it.paymentMode === 'DUE').reduce((sum, it) => sum + it.totalAmount, 0);
        return {
          ...b,
          totalAmount: newTotal,
          dueAmount: newDueTotal,
          items: newItems
        };
      });

      setPosImportHistory(nextHistory);
      localStorage.setItem('canteen_pos_import_history', JSON.stringify(nextHistory));
      await pushKeyToCloud('canteen_pos_import_history', nextHistory).catch(() => {});

      // Dispatch events
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_pos_import_history_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      setEditingItem(null);
      setSuccessMessage('ট্রানজ্যাকশন সফলভাবে এডিট ও সেভ করা হয়েছে!');
    } catch (err: any) {
      setErrorMessage(`এডিট সেভ ব্যর্থ হয়েছে: ${err?.message || 'Unknown error'}`);
    }
  };

  // Inline correction handlers in Preview Table
  const handleAssignMemberToRow = (rowId: string, memberAirmanId: string) => {
    const target = members.find(m => m.airman_id === memberAirmanId || m['BD No'] === memberAirmanId);
    if (!target) return;
    setParsedRows(prev => prev.map(r => {
      if (r.rowId === rowId) {
        const rank = target.Rank || target.rank || '';
        const name = target.Surname || target.Name || target.name || '';
        const bd = target['BD No'] || target.bdNo || target.airman_id || '';
        const wasItemWarning = r.warning?.includes('Item');
        return {
          ...r,
          matchedMember: target,
          bdNo: bd,
          rank: rank,
          memberName: name,
          isValid: !wasItemWarning,
          warning: wasItemWarning ? r.warning?.split('; ').filter(w => w.includes('Item')).join('; ') : undefined
        };
      }
      return r;
    }));
  };

  const handleAssignMenuItemToRow = (rowId: string, menuItemId: string) => {
    const target = catalog.find(c => c.id === menuItemId || c.name === menuItemId);
    if (!target) return;
    setParsedRows(prev => prev.map(r => {
      if (r.rowId === rowId) {
        const unitPrice = Number(target.price || 0) || r.unitPrice;
        const total = r.qty * unitPrice;
        const wasMemberWarning = r.warning?.includes('Member');
        return {
          ...r,
          matchedMenuItem: target,
          menuItemName: target.name || target.name_en || r.menuItemName,
          unitPrice,
          totalAmount: total,
          isValid: !wasMemberWarning,
          warning: wasMemberWarning ? r.warning?.split('; ').filter(w => w.includes('Member')).join('; ') : undefined
        };
      }
      return r;
    }));
  };

  const filteredBatches = useMemo(() => {
    if (!historySearchTerm.trim()) return posImportHistory;
    const term = historySearchTerm.toLowerCase().trim();
    return posImportHistory.filter(b => {
      const matchBatch = 
        (b.displayDate || '').toLowerCase().includes(term) ||
        (b.sourceName || '').toLowerCase().includes(term) ||
        (b.templateType || '').toLowerCase().includes(term);
      if (matchBatch) return true;
      return (b.items || []).some(it => 
        (it.memberName || '').toLowerCase().includes(term) ||
        (it.bdNo || '').toLowerCase().includes(term) ||
        (it.items || '').toLowerCase().includes(term) ||
        (it.date || '').toLowerCase().includes(term)
      );
    });
  }, [posImportHistory, historySearchTerm]);

  const historyTotals = useMemo(() => {
    const totalBatches = posImportHistory.length;
    const totalTxs = posImportHistory.reduce((sum, b) => sum + (b.totalTransactions || 0), 0);
    const totalAmount = posImportHistory.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const dueAmount = posImportHistory.reduce((sum, b) => sum + (b.dueAmount || 0), 0);
    return { totalBatches, totalTxs, totalAmount, dueAmount };
  }, [posImportHistory]);

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
                <span>POS Import (Excel / CSV)</span>
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
            {/* Month Selection directly in Header - Styled exactly like Bill month option */}
            <div className="flex items-center bg-slate-850 rounded-xl px-1.5 py-1 border border-slate-700/80 shadow-inner">
              <button
                type="button"
                onClick={handlePrevTemplateMonth}
                className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                title="পূর্ববর্তী মাস (Previous Month)"
              >
                <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
              </button>
              <div className="px-2.5 py-0.5 text-center min-w-[110px] select-none">
                <span className="text-xs font-black text-white flex items-center justify-center space-x-1">
                  <Calendar className="w-3 h-3 text-indigo-400 mr-1" />
                  <span>{formatBengaliMonthYear(templateMonth)}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={handleNextTemplateMonth}
                className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-indigo-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                title="পরবর্তী মাস (Next Month)"
              >
                <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
              </button>
            </div>

            {/* Template 1: Member-wise Matrix (31 Date tabs for selected Month) */}
            <button
              type="button"
              onClick={handleDownloadOfficialMatrixTemplate}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-500/50 rounded-xl text-xs font-black tracking-wider transition-all shadow-sm cursor-pointer"
              title={`Template 1: Member-wise (৩১ দিনের ৩১টি ট্যাব, ${formatBengaliMonthYear(templateMonth)})`}
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>১. সদস্য ভিত্তিক (৩১ দিন)</span>
            </button>

            {/* Template 2: Date-wise Matrix (Member Fixed, Left: 1-31 Date) */}
            <button
              type="button"
              onClick={() => handleDownloadDateWiseMatrixTemplate()}
              className="flex items-center space-x-1.5 px-3 py-1.5 bg-teal-900/80 hover:bg-teal-800 text-teal-200 border border-teal-500/50 rounded-xl text-xs font-black tracking-wider transition-all shadow-sm cursor-pointer"
              title={`Template 2: Date-wise (${formatBengaliMonthYear(templateMonth)})`}
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>২. তারিখ ভিত্তিক</span>
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

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 bg-slate-950/40 border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('IMPORT')}
              className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'IMPORT'
                  ? 'border-emerald-400 text-emerald-300 bg-emerald-950/30'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>১. নতুন ইমপোর্ট (New Import)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HISTORY')}
              className={`flex items-center space-x-2 px-4 py-2.5 border-b-2 font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'HISTORY'
                  ? 'border-indigo-400 text-indigo-300 bg-indigo-950/30'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>২. ইমপোর্ট হিস্টোরি (Import History)</span>
              {posImportHistory.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-900/80 text-indigo-200 border border-indigo-500/30">
                  {posImportHistory.length}
                </span>
              )}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
            {activeTab === 'IMPORT' ? 'এক্সেল ফাইল নির্বাচন বা টেমপ্লেট ডাউনলোড করুন' : 'পূর্বে ইমপোর্ট করা ডাটা দেখা, এডিট ও রিমুভ করুন'}
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

          {/* Import Tab vs History Tab */}
          {activeTab === 'IMPORT' ? (
            <>
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
                  {/* Card 1: Member-wise (Date Fixed per Tab, 31 Daily Tabs for Selected Month) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-emerald-500/40 space-y-2.5 flex flex-col justify-between shadow-lg">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-emerald-300 flex items-center gap-1.5 text-sm">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400"></span>
                          ১. সদস্য ভিত্তিক টেমপ্লেট (Member-wise)
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-300 font-mono font-bold border border-emerald-500/40">
                          ৩১ দিনের ৩১টি ট্যাব
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        • <strong>মাসিক ৩১টি ট্যাব:</strong> নির্বাচিত মাসের <strong>১ থেকে ৩১ তারিখের জন্য ৩১টি আলাদা শিট ট্যাব</strong> তৈরি হবে。<br/>
                        • <strong>ফ্রিজ প্যান:</strong> <strong>E কলাম</strong> (নাম পর্যন্ত) ও <strong>৫ নম্বর সারি</strong> ফিক্সড/লক থাকে。<br/>
                        • <strong>ফরম্যাট ও কালার:</strong> আসল <strong>SutonnyMJ ১৬ সাইজ</strong> ফন্ট, <strong>সেল অটো-ফিট (Auto-fit)</strong>, সারিভিত্তিক অল্টারনেটিং কালার এবং বিডি নং-এ <strong>শুধু নম্বর (BD/ ছাড়া)</strong>।
                      </p>

                      {/* Month Selection preview in Card 1 - Bill style */}
                      <div className="pt-1 space-y-1.5">
                        <label className="text-[10px] text-emerald-300 font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                            <span>নির্বাচিত মাস:</span>
                          </span>
                        </label>
                        <div className="flex items-center bg-slate-950 rounded-xl px-1.5 py-1 border border-emerald-500/40 shadow-inner justify-between">
                          <button
                            type="button"
                            onClick={handlePrevTemplateMonth}
                            className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-emerald-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                            title="পূর্ববর্তী মাস (Previous Month)"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                          </button>
                          <div className="px-2.5 py-0.5 text-center select-none">
                            <span className="text-xs font-black text-white flex items-center justify-center space-x-1">
                              <Calendar className="w-3.5 h-3.5 text-emerald-400 mr-1" />
                              <span>{formatBengaliMonthYear(templateMonth)}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleNextTemplateMonth}
                            className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-emerald-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                            title="পরবর্তী মাস (Next Month)"
                          >
                            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDownloadOfficialMatrixTemplate}
                      className="w-full mt-2 flex items-center justify-center space-x-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                    >
                      <Download className="w-4 h-4 text-emerald-200" />
                      <span>১. সদস্য ভিত্তিক টেমপ্লেট (৩১টি ট্যাব) ডাউনলোড</span>
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
                        • <strong>সদস্য ফিক্সড:</strong> ব্যানারে নির্দিষ্ট সদস্যের <strong>পদবী, নাম ও বিডি নং (শুধু নম্বর)</strong> থাকে。<br/>
                        • <strong>ফ্রিজ প্যান:</strong> <strong>C কলাম</strong> (তারিখ পর্যন্ত) ও <strong>৫ নম্বর সারি</strong> ফিক্সড/লক থাকে。<br/>
                        • <strong>ছুটির দিন হাইড:</strong> শুক্র, শনি ও ছুটির দিনের সারি ডিফল্টভাবে হাইড থাকে (প্রয়োজনে আনহাইড করা যাবে)।<br/>
                        • <strong>ফরম্যাট ও কালার:</strong> আসল <strong>SutonnyMJ ১৬ সাইজ</strong> ফন্ট, <strong>সেল অটো-ফিট (Auto-fit)</strong> এবং সারিভিত্তিক অল্টারনেটিং কালার (কলামভিত্তিক অল্টারনেটিং কালার ছাড়া)।
                      </p>

                      {/* Month Selection - Bill Style */}
                      <div className="pt-1 space-y-1.5">
                        <label className="text-[10px] text-teal-300 font-bold flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-teal-400" />
                            <span>টেমপ্লেটের মাস নির্বাচন (Month):</span>
                          </span>
                        </label>
                        <div className="flex items-center bg-slate-950 rounded-xl px-1.5 py-1 border border-teal-500/40 shadow-inner justify-between">
                          <button
                            type="button"
                            onClick={handlePrevTemplateMonth}
                            className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-teal-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                            title="পূর্ববর্তী মাস (Previous Month)"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                          </button>
                          <div className="px-2.5 py-0.5 text-center select-none">
                            <span className="text-xs font-black text-white flex items-center justify-center space-x-1">
                              <Calendar className="w-3.5 h-3.5 text-teal-400 mr-1" />
                              <span>{formatBengaliMonthYear(templateMonth)}</span>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleNextTemplateMonth}
                            className="w-7 h-7 flex items-center justify-center bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 hover:from-slate-600 hover:to-slate-750 text-teal-300 hover:text-white rounded-lg transition-all cursor-pointer border-t border-slate-600/80 border-x border-slate-700/80 border-b-[2.5px] border-b-slate-950 shadow-[0_2px_4px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.2)] active:translate-y-[1.5px] active:border-b active:shadow-[0_0_1px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(0,0,0,0.6)]"
                            title="পরবর্তী মাস (Next Month)"
                          >
                            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" />
                          </button>
                        </div>
                      </div>

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
                          {members.map((m: any, mIdx: number) => {
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
                          <td className="px-3 py-2 font-bold text-white">
                            {row.bdNo}
                            {!row.matchedMember && (
                              <span className="block text-[10px] text-amber-400 font-normal">অপরিচিত</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center space-x-1.5">
                              {row.rank && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-500/30 font-bold shrink-0">
                                  {row.rank}
                                </span>
                              )}
                              <span className="font-bold truncate max-w-[140px]">{row.memberName}</span>
                            </div>
                            {!row.matchedMember && (
                              <select
                                value=""
                                onChange={(e) => handleAssignMemberToRow(row.rowId, e.target.value)}
                                className="mt-1 block w-full max-w-[160px] bg-amber-950/80 border border-amber-500/60 text-amber-200 text-[10px] rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                              >
                                <option value="">সদস্য সিলেক্ট করুন...</option>
                                {members.map(m => (
                                  <option key={m.airman_id} value={m.airman_id}>
                                    {m.Rank || ''} {m.Surname || m.Name || ''} ({m['BD No'] || m.airman_id})
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2 font-bold text-emerald-400">
                            <div>{row.menuItemName}</div>
                            {!row.matchedMenuItem && (
                              <select
                                value=""
                                onChange={(e) => handleAssignMenuItemToRow(row.rowId, e.target.value)}
                                className="mt-1 block w-full max-w-[160px] bg-amber-950/80 border border-amber-500/60 text-amber-200 text-[10px] rounded px-1.5 py-0.5 focus:outline-none cursor-pointer"
                              >
                                <option value="">মেনু আইটেম সিলেক্ট...</option>
                                {catalog.map(c => (
                                  <option key={c.id || c.name} value={c.id || c.name}>
                                    {c.name_bn || c.name} (৳{c.price || 0})
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
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
          </>
          ) : (
            /* Import History Tab Content */
            <div className="space-y-4">
              {/* Top Stats Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">মোট ইম্পোর্ট সেশন</span>
                  <span className="text-lg font-black text-white">{historyTotals.totalBatches} টি</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">মোট এন্ট্রি সংখ্যা</span>
                  <span className="text-lg font-black text-indigo-400">{historyTotals.totalTxs} টি</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">মোট বিক্রয়</span>
                  <span className="text-lg font-black text-emerald-400">৳{historyTotals.totalAmount.toLocaleString()}</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">মোট বকেয়া</span>
                  <span className="text-lg font-black text-amber-400">৳{historyTotals.dueAmount.toLocaleString()}</span>
                </div>
              </div>

              {/* History Search Bar */}
              <div className="flex items-center space-x-3 bg-slate-950/60 p-3 rounded-2xl border border-slate-800">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    placeholder="হিস্টোরি খুঁজুন: সদস্যের নাম, বিডি নম্বর, তারিখ বা আইটেম..."
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                {historySearchTerm && (
                  <button
                    type="button"
                    onClick={() => setHistorySearchTerm('')}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    রিসেট
                  </button>
                )}
              </div>

              {/* Batches List */}
              {filteredBatches.length === 0 ? (
                <div className="p-12 text-center bg-slate-950/30 rounded-3xl border border-slate-800/80 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center">
                    <History className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-300">কোনো ইম্পোর্ট হিস্টোরি পাওয়া যায়নি</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {historySearchTerm
                      ? `"${historySearchTerm}" সম্পর্কিত কোনো রেকর্ড নেই। ফিল্টার মুছে আবার চেষ্টা করুন।`
                      : 'নতুন এক্সেল ফাইল ইম্পোর্ট করলে এখানে স্বয়ংক্রিয়ভাবে হিস্টোরি রেকর্ড সেভ হবে, যা পরবর্তীতে প্রয়োজনমতো এডিট বা রিমুভ করতে পারবেন।'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {filteredBatches.map((batch) => {
                    const isExpanded = expandedBatchId === batch.id;
                    return (
                      <div
                        key={batch.id}
                        className="bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-2xl overflow-hidden transition-all shadow-md"
                      >
                        {/* Batch Card Header */}
                        <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/60">
                          <div className="flex items-start space-x-3">
                            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0 mt-0.5">
                              <History className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-white text-sm">{batch.displayDate}</span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                                  {batch.templateType === 'MEMBER_WISE_MATRIX' ? 'সদস্য ভিত্তিক' : batch.templateType === 'DATE_WISE_MATRIX' ? 'তারিখ ভিত্তিক' : 'লিস্ট'}
                                </span>
                                {batch.appliedMemberDue && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30 font-bold">
                                    বকেয়া সমন্বিত
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                                <span>উৎস: <strong className="text-slate-200">{batch.sourceName}</strong></span>
                                <span>•</span>
                                <span>মোট এন্ট্রি: <strong className="text-indigo-300">{batch.totalTransactions}</strong> টি</span>
                                <span>•</span>
                                <span>মোট বিক্রয়: <strong className="text-emerald-400">৳{batch.totalAmount.toLocaleString()}</strong></span>
                                <span>•</span>
                                <span>বকেয়া: <strong className="text-amber-400">৳{batch.dueAmount.toLocaleString()}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 self-end md:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              <span>{isExpanded ? 'লুকান' : 'বিস্তারিত ও এডিট'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setRollbackBatch(batch)}
                              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/40 text-rose-300 text-xs font-bold transition-colors cursor-pointer"
                              title="এই ব্যাচটি রিমুভ করুন ও বকেয়া রিভার্স করুন"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                              <span>রিমুভ (Remove)</span>
                            </button>
                          </div>
                        </div>

                        {/* Expanded Batch Items Table */}
                        {isExpanded && (
                          <div className="border-t border-slate-800 p-3 bg-slate-950/90 overflow-x-auto max-h-[380px]">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                              <thead className="bg-slate-900 text-slate-400 font-bold border-b border-slate-800 sticky top-0 z-10">
                                <tr>
                                  <th className="px-3 py-2">তারিখ (Date)</th>
                                  <th className="px-3 py-2">বিডি নং (BD)</th>
                                  <th className="px-3 py-2">সদস্যের নাম (Member)</th>
                                  <th className="px-3 py-2">আইটেম বিবরণ (Items)</th>
                                  <th className="px-3 py-2 text-right">টাকা (Amount)</th>
                                  <th className="px-3 py-2 text-center">পেমেন্ট মোড</th>
                                  <th className="px-3 py-2 text-center">অ্যাকশন</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                {batch.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-slate-800/40">
                                    <td className="px-3 py-2 font-mono text-slate-400">{item.date}</td>
                                    <td className="px-3 py-2 font-bold text-white">{item.bdNo}</td>
                                    <td className="px-3 py-2">
                                      <span className="font-bold">{item.memberName}</span>
                                      {item.rank && <span className="ml-1 text-[10px] text-indigo-300 font-bold">({item.rank})</span>}
                                    </td>
                                    <td className="px-3 py-2 text-emerald-300 truncate max-w-[220px]" title={item.items}>
                                      {item.items}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono font-bold text-white">
                                      ৳{item.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                          item.paymentMode === 'PAID'
                                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                                            : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                                        }`}
                                      >
                                        {item.paymentMode}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <div className="flex items-center justify-center space-x-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingItem({ batchId: batch.id, item });
                                            setEditFormData({
                                              date: item.date,
                                              items: item.items,
                                              totalAmount: item.totalAmount,
                                              paymentMode: item.paymentMode
                                            });
                                          }}
                                          className="p-1 rounded bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
                                          title="এডিট করুন"
                                        >
                                          <Edit3 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteBatchItem(batch.id, item)}
                                          className="p-1 rounded bg-rose-950/70 hover:bg-rose-900 text-rose-300 border border-rose-500/30 transition-colors cursor-pointer"
                                          title="এই এন্ট্রিটি মুছে ফেলুন"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {activeTab === 'IMPORT' ? (
              parsedRows.length > 0 && (
                <span>
                  {summary.count} rows selected • Total: <strong className="text-white">৳{summary.totalAmount.toLocaleString()}</strong>
                </span>
              )
            ) : (
              <span>
                মোট <strong className="text-indigo-300">{posImportHistory.length}</strong> টি ব্যাচে <strong className="text-white">{historyTotals.totalTxs}</strong> টি ট্রানজ্যাকশন সংরক্ষিত
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying || isRollingBack}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              {activeTab === 'HISTORY' ? 'বন্ধ করুন (Close)' : 'Cancel'}
            </button>

            {activeTab === 'IMPORT' && parsedRows.length > 0 && (
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

        {/* Edit Batch Item Modal */}
        {editingItem && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-indigo-400" />
                  <span>ইম্পোর্ট ট্রানজ্যাকশন এডিট</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 font-bold mb-1">তারিখ (Date):</label>
                  <input
                    type="date"
                    value={editFormData.date || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">সদস্যের নাম ও বিডি:</label>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-bold">
                    {editingItem.item.memberName} {editingItem.item.rank ? `(${editingItem.item.rank})` : ''} • BD: {editingItem.item.bdNo}
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1">আইটেম বিবরণ (Items Description):</label>
                  <input
                    type="text"
                    value={editFormData.items || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, items: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    placeholder="যেমন: পরোটা (2), ডিম ভাজি (1)"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">মোট টাকা (Amount ৳):</label>
                    <input
                      type="number"
                      value={editFormData.totalAmount || 0}
                      onChange={(e) => setEditFormData({ ...editFormData, totalAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">পেমেন্ট মোড:</label>
                    <select
                      value={editFormData.paymentMode || 'DUE'}
                      onChange={(e) => setEditFormData({ ...editFormData, paymentMode: e.target.value as 'DUE' | 'PAID' })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="DUE">বকেয়া (DUE)</option>
                      <option value="PAID">নগদ পরিশোধ (PAID)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveEditBatchItem(editingItem.batchId, editingItem.item, editFormData)}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>সংরক্ষণ করুন</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rollback / Remove Batch Confirmation Modal */}
        {rollbackBatch && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-center space-x-3 text-rose-400">
                <div className="p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">ইম্পোর্ট ব্যাচ রিমুভ নিশ্চিতকরণ</h4>
                  <p className="text-[11px] text-slate-400">এই অ্যাকশনটি সাবধানে সম্পন্ন করুন</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-2 text-slate-300">
                <div>তারিখ: <strong className="text-white">{rollbackBatch.displayDate}</strong></div>
                <div>উৎস: <strong className="text-white">{rollbackBatch.sourceName}</strong></div>
                <div>মোট এন্ট্রি: <strong className="text-indigo-300">{rollbackBatch.totalTransactions}</strong> টি</div>
                <div>মোট টাকার পরিমাণ: <strong className="text-emerald-400">৳{rollbackBatch.totalAmount.toLocaleString()}</strong></div>
              </div>

              <div className="text-xs text-rose-300/90 bg-rose-950/40 p-3 rounded-xl border border-rose-500/30">
                ⚠️ নিশ্চিত করলে এই ব্যাচের সকল সেলস ট্রানজ্যাকশন মুছে ফেলা হবে এবং সংশ্লিষ্ট সদস্যদের ব্যালেন্স থেকে বকেয়া টাকা স্বয়ংক্রিয়ভাবে বাদ (Revert) দেওয়া হবে।
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRollbackBatch(null)}
                  disabled={isRollingBack}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                >
                  না, বাতিল করুন
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBatch(rollbackBatch, true)}
                  disabled={isRollingBack}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-600/30 disabled:opacity-50 cursor-pointer"
                >
                  {isRollingBack ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>হ্যাঁ, মুছে ফেলুন</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Trash2, 
  FileText, 
  UserPlus, 
  Save, 
  X, 
  Settings, 
  Printer, 
  MessageCircle, 
  Image as ImageIcon, 
  Loader2, 
  Banknote, 
  ArrowLeft,
  Upload,
  RefreshCw,
  Calendar,
  CalendarDays,
  Plus,
  PlusCircle,
  Receipt,
  Filter,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Landmark,
  Layers,
  LayoutGrid,
  List,
  FileSpreadsheet,
  Coins,
  Edit3,
  History,
  Download,
  Users,
  User,
  Phone,
  PhoneCall,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Sliders,
  Share2
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl, getCanteenConfig, saveCanteenConfig } from '../utils/canteenSettings';
import { processGalleryImage } from '../utils/imageUpload';
import { formatCanteenDate } from '../utils/dateUtils';
import { SaveButton } from '../components/SaveButton';
import { BulkImportInitialBillsModal } from '../components/BulkImportInitialBillsModal';
import { SetInitialBillModal } from '../components/SetInitialBillModal';
import { PrintableCanteenBillModal } from '../components/PrintableCanteenBillModal';
import { restoreRawStockForSaleCancellation } from '../utils/recipeManager';
import { pushKeyToCloud, pullKeyFromCloud, recordDeletedTxId, getDeletedTxIds } from '../utils/canteenCloudSync';
import { syncImportHistoryToTransactions, deduplicateCanteenTransactions } from '../utils/importHistoryTxs';
import {
  exportCanteenBillToExcel,
  formatRankBn,
  formatMemberNameBn,
  formatBengaliMonthYear,
  toBengaliNum,
  getPaymentCycleMonthKey
} from '../utils/exportCanteenBillExcel';
import {
  generateStatementCanvasBlob,
  downloadStatementBlob,
  saveStatementToGalleryOrDownload,
  isGenericCanteenBill
} from '../utils/statementCanvasGenerator';
import { saveAs } from 'file-saver';
import { 
  sortCanteenMembersByOfficeSeniority,
  isCivilianMember,
  isAirmanMember 
} from '../utils/canteenSeniority';
export { isCivilianMember, isAirmanMember };
import { WhatsAppMessageTemplateBox } from '../components/WhatsAppMessageTemplateBox';
import {
  buildWhatsAppBillMessage,
  isMemberSeniorToManager,
  getWhatsAppTemplateConfig,
  syncWhatsAppTemplateConfigFromCloud
} from '../utils/canteenWhatsAppTemplate';
import { 
  getMemberBanglaName, 
  saveMemberBanglaName, 
  getMemberBanglaRank,
  saveMemberBanglaRank,
  BAF_RANKS_WITH_BN,
  syncMemberBanglaNamesFromCloud 
} from '../utils/memberBanglaNames';
import { 
  fetchCanteenMembersOnce, 
  getCanteenMembersCache, 
  fetchCanteenMenuOnce, 
  getCanteenMenuCache 
} from '../utils/canteenMenuData';
import { FundBatchBillPage } from './FundBatchBillPage';

export type BillCategory = 'ALL' | 'CANTEEN' | 'UNIT_FUND' | 'OTHERS';

// Official WhatsApp Brand SVG Icon
export const WhatsAppIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    width="24" 
    height="24" 
    className={className}
    fill="currentColor"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.05 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 00-3.473-8.413z" />
  </svg>
);

// Map English food item names to clear, authentic Bengali names
export const formatItemNameBn = (rawName?: string): string => {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (/[\u0980-\u09FF]/.test(trimmed)) return trimmed;

  const upper = trimmed.toUpperCase();
  const itemMap: Record<string, string> = {
    'COLD COFFEE': 'কোল্ড কফি',
    'HOT COFFEE': 'হট কফি',
    'MILK COFFEE': 'মিল্ক কফি',
    'COFFEE': 'কফি',
    'GREEN TEA': 'গ্রিন টি',
    'LIQUOR TEA': 'রং চা',
    'MILK TEA': 'দুধ চা',
    'RAW TEA': 'রং চা',
    'TEA': 'চা',
    'LEMON JUICE': 'লেমন জুস',
    'CHICKEN ONION': 'চিকেন অনিয়ন (পেঁয়াজু)',
    'CHICKEN PASTA': 'চিকেন পাস্তা',
    'PASTA': 'পাস্তা',
    'CHICKEN PULAW': 'চিকেন পোলাও',
    'CHOTPOTI': 'চটপটি',
    'DRY CAKE': 'ড্রাই কেক',
    'CAKE': 'কেক',
    'EGG FRY': 'ডিম ভাজি',
    'BOILED EGG': 'সিদ্ধ ডিম',
    'EGG MUMLET': 'ডিম অমলেট',
    'EGG KHICURI': 'ডিম খিচুড়ি',
    'EGG KHICHURI': 'ডিম খিচুড়ি',
    'EGG NOODLES': 'এগ নুডুলস',
    'NOODLES': 'নুডুলস',
    'HALIM': 'হালিম',
    'NORMAL BISCUIT': 'বিস্কুট',
    'BISCUIT': 'বিস্কুট',
    'ONE TIME BOX': 'ওয়ান টাইম বক্স',
    'PORATA': 'পরোটা',
    'PORATA (HOTEL)': 'পরোটা (হোটেল)',
    'PORATA (UNIT)': 'পরোটা (ইউনিট)',
    'ROASTED CHICKEN': 'রোস্ট চিকেন',
    'BEEF BURGER': 'বিফ বার্গার',
    'CHICKEN BURGER': 'চিকেন বার্গার',
    'BURGER': 'বার্গার',
    'SOSA': 'শসা',
    'SWARMA': 'শর্মা',
    'SHWARMA': 'শর্মা',
    'CHICKEN BIRIYANI': 'চিকেন বিরিয়ানি',
    'CHICKEN BIRYANI': 'চিকেন বিরিয়ানি',
    'CHICKEN CURRY': 'চিকেন কারি',
    'CHICKEN KHICHURI': 'চিকেন খিচুড়ি',
    'SINGARA': 'সিঙ্গারা',
    'SHINGARA': 'সিঙ্গারা',
    'SAMOSA': 'সমুচা',
    'SOMOSA': 'সমুচা',
    'PATTIES': 'প্যাটিস',
    'CHICKEN PATTIES': 'চিকেন প্যাটিস',
    'ROLL': 'রোল',
    'CHICKEN ROLL': 'চিকেন রোল',
    'SWEET': 'মিষ্টি',
    'SANDWICH': 'স্যান্ডউইচ',
    'CHICKEN SANDWICH': 'চিকেন স্যান্ডউইচ',
    'UNIT FUND': 'ইউনিট ফান্ড',
    'UNIT FUND BILL': 'ইউনিট ফান্ড বিল',
    'OTHERS': 'অন্যান্য',
    'OTHERS BILL': 'অন্যান্য বিল',
    'CANTEEN': 'ক্যান্টিন বিল',
    'CANTEEN BILL': 'ক্যান্টিন বিল',
    'INITIAL BILL': 'প্রারম্ভিক বিল'
  };

  if (itemMap[upper]) return itemMap[upper];

  for (const [enKey, bnVal] of Object.entries(itemMap)) {
    if (upper.includes(enKey)) {
      return upper.replace(enKey, bnVal);
    }
  }

  return trimmed;
};

export const isOfficerMember = (member: any): boolean => {
  const rank = String(member?.Rank || member?.rank || '').toUpperCase().trim();
  const officerRanks = [
    'AIR CHIEF MSHL', 'AIR MSHL', 'AVM', 'AIR CDRE', 'GP CAPT', 
    'WG CDR', 'SQN LDR', 'FLT LT', 'FLG OFFR', 'FG OFFR', 'PLT OFFR'
  ];
  return officerRanks.some(r => rank.includes(r)) || /officer|commander|leader|captain/i.test(rank);
};

// Extract YYYY-MM from date string with robust support for "DD Mon YY", "DD-Mon-YY", Bengali, "YYYY-MM", etc.
export const getTxMonthKey = (dateStr: any): string => {
  if (!dateStr) return '';
  if (typeof dateStr === 'object' && dateStr.monthKey) return String(dateStr.monthKey).trim();

  let str = String(dateStr).trim();
  if (!str || str === '-') return '';

  // 0. Bengali numerals conversion
  const bnDigits: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  str = str.replace(/[০-৯]/g, ch => bnDigits[ch] || ch);

  // 1. Direct YYYY-MM prefix (e.g. "2026-10", "2026-10-28", "2026/10/28")
  const ymdMatch = str.match(/^(\d{4})[-\/](\d{1,2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}`;
  }

  // 2. Format "DD Mon YY" or "DD-Mon-YY" or "DD Mon YYYY" (e.g. "28 Sep 26", "28-Aug-26", "28 Oct 2026")
  const MONTH_MAP: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
  };

  const dmyAlphaMatch = str.match(/^(\d{1,2})[\s\-\/\.]+([A-Za-z]{3,9})[\s\-\/\.]+(\d{2,4})/);
  if (dmyAlphaMatch) {
    const monStr = dmyAlphaMatch[2].slice(0, 3).toLowerCase();
    const mon = MONTH_MAP[monStr];
    let yr = parseInt(dmyAlphaMatch[3], 10);
    if (yr < 100) yr += 2000;
    if (mon) {
      return `${yr}-${mon}`;
    }
  }

  // 2b. Bengali month string (e.g. "আগস্ট ২০২৬", "সেপ্টেম্বর ২০২৬", "২৮ আগস্ট ২৬")
  const BN_MONTH_MAP: Record<string, string> = {
    'জানু': '01', 'ফেব্রু': '02', 'মার্চ': '03', 'এপ্রি': '04', 'মে': '05', 'জুন': '06',
    'জুলা': '07', 'আগস্ট': '08', 'সেপ্টে': '09', 'অক্টো': '10', 'নভে': '11', 'ডিসে': '12'
  };
  for (const [bnPrefix, mNum] of Object.entries(BN_MONTH_MAP)) {
    if (str.includes(bnPrefix)) {
      const yrMatch = str.match(/(\d{4}|\d{2})/);
      let yr = yrMatch ? parseInt(yrMatch[1], 10) : new Date().getFullYear();
      if (yr < 100) yr += 2000;
      return `${yr}-${mNum}`;
    }
  }

  // 3. Format DD-MM-YYYY or DD/MM/YYYY (e.g. "28-09-2026", "28/10/2026")
  const dmyNumMatch = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);
  if (dmyNumMatch) {
    let yr = parseInt(dmyNumMatch[3], 10);
    if (yr < 100) yr += 2000;
    const mon = dmyNumMatch[2].padStart(2, '0');
    return `${yr}-${mon}`;
  }

  // 4. Format MM-YYYY or MM/YYYY (e.g. "09/2026", "08-2026")
  const myNumMatch = str.match(/^(\d{1,2})[-\/](\d{4})/);
  if (myNumMatch) {
    return `${myNumMatch[2]}-${myNumMatch[1].padStart(2, '0')}`;
  }

  // 5. Timestamp or ISO date fallback
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      let y = d.getFullYear();
      if (y < 1970 && y >= 1900) y += 100;
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
  } catch {}

  return '';
};

// Extract YYYY-MM of the current running month
export const getRunningMonthKey = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

// Official menu catalog prices dictionary
// Official menu catalog prices dictionary with exact rates
export const DEFAULT_MENU_PRICES: Record<string, number> = {
  // Canteen Menu Official Catalog Items
  'COLD COFFEE': 40,
  'CHICKEN ONION': 45,
  'CHICKEN PASTA': 55,
  'CHICKEN PULAW': 65,
  'CHOTPOTI': 30,
  'DRY CAKE': 12,
  'EGG FRY': 18,
  'EGG KHICURI': 45,
  'EGG KHICHURI': 45,
  'EGG MUMLET': 15,
  'EGG NOODLES': 50,
  'GREEN TEA': 8,
  'HALIM': 50,
  'HOT COFFEE': 25,
  'LEMON JUICE': 10,
  'LIQUOR TEA': 5,
  'MILK COFFEE': 25,
  'MILK TEA': 12,
  'NOODLES': 30,
  'NORMAL BISCUIT': 5,
  'ONE TIME BOX': 5,
  'PASTA': 35,
  'PORATA': 15,
  'PORATA (HOTEL)': 10,
  'PORATA (UNIT)': 15,
  'RAW TEA': 5,
  'ROASTED CHICKEN': 80,
  'BEEF BURGER': 60,
  'CHICKEN BURGER': 50,
  'SOSA': 10,
  'SWARMA': 50,
  'SHWARMA': 50,
  'BOILED EGG': 15,
  'CHICKEN BIRIYANI': 65,
  'CHICKEN CURRY': 50,
  'CHICKEN BIRYANI': 65,
  'CHICKEN KHICHURI': 65,
  'SINGARA': 10,
  'SHINGARA': 10,
  'SAMOSA': 10,
  'SOMOSA': 10,
  'TEA': 12,
  'COFFEE': 25,
  'PATTIES': 25,
  'CHICKEN PATTIES': 30,
  'ROLL': 25,
  'CHICKEN ROLL': 30,
  'SWEET': 15,
  'SANDWICH': 35,
  'CHICKEN SANDWICH': 40,

  // Bengali transliterations / aliases
  'কোল্ড কফি': 40,
  'চিকেন অনিয়ন': 45,
  'চিকেন পেঁয়াজু': 45,
  'চিকেন পিয়াজু': 45,
  'চিকেন পাস্তা': 55,
  'পাস্তা': 35,
  'চিকেন পোলাও': 65,
  'চটপটি': 30,
  'ড্রাই কেক': 12,
  'ডিম ফ্রাই': 18,
  'ডিম খিচুড়ি': 45,
  'চিকেন খিচুড়ি': 65,
  'ডিম অমলেট': 15,
  'ডিম ওমলেট': 15,
  'ডিম মামলেট': 15,
  'নুডলস': 30,
  'ডিম নুডলস': 50,
  'গ্রিন টি': 8,
  'সবুজ চা': 8,
  'হালিম': 50,
  'হট কফি': 25,
  'লেবু জুস': 10,
  'লেবুর শরবত': 10,
  'লিকুয়ার চা': 5,
  'রং চা': 5,
  'লাল চা': 5,
  'মিল্ক কফি': 25,
  'দুধ চা': 12,
  'চা': 12,
  'বিস্কুট': 5,
  'নরমাল বিস্কুট': 5,
  'ওয়ান টাইম বক্স': 5,
  'ওয়ানটাইম বক্স': 5,
  'পরোটা': 15,
  'পরোটা (হোটেল)': 10,
  'হোটেল পরোটা': 10,
  'পরোটা (ইউনিট)': 15,
  'ইউনিট পরোটা': 15,
  'কাঁচা চা': 5,
  'রোস্টেড চিকেন': 80,
  'বিফ বার্গার': 60,
  'চিকেন বার্গার': 50,
  'বার্গার': 50,
  'শসা': 10,
  'সোয়ার্মা': 50,
  'শর্মা': 50,
  'ডিম সিদ্ধ': 15,
  'সিদ্ধ ডিম': 15,
  'চিকেন বিরিয়ানি': 65,
  'চিকেন বিরিয়ানী': 65,
  'চিকেন কারি': 50,
  'চিকেন কারী': 50,
  'সিঙ্গারা': 10,
  'সমুচা': 10,
  'কফি': 25,
  'প্যাটিস': 25,
  'চিকেন প্যাটিস': 30,
  'রোল': 25,
  'চিকেন রোল': 30,
  'মিষ্টি': 15,
  'স্যান্ডউইচ': 35,
  'চিকেন স্যান্ডউইচ': 40
};

// Robust catalog price resolver
export const lookupCatalogPrice = (itemName: string, catalog: any[] = []): number => {
  if (!itemName) return 0;
  const raw = String(itemName).trim();
  const clean = raw.toUpperCase().replace(/\s+/g, ' ');

  // 1. Check live catalog from Supabase Canteen_Menu first
  if (Array.isArray(catalog) && catalog.length > 0) {
    const direct = catalog.find((c: any) => {
      const cName = String(c.name || '').toUpperCase().trim().replace(/\s+/g, ' ');
      return cName === clean;
    });
    if (direct && Number(direct.price ?? direct.Price) > 0) {
      return Number(direct.price ?? direct.Price);
    }
  }

  // 2. Direct match in DEFAULT_MENU_PRICES dictionary
  if (DEFAULT_MENU_PRICES[clean] !== undefined) {
    return DEFAULT_MENU_PRICES[clean];
  }

  // 3. Normalized / fuzzy match in Supabase catalog
  if (Array.isArray(catalog) && catalog.length > 0) {
    const fuzzy = catalog.find((c: any) => {
      const cName = String(c.name || '').toUpperCase().trim().replace(/\s+/g, ' ');
      return cName.includes(clean) || clean.includes(cName);
    });
    if (fuzzy && Number(fuzzy.price ?? fuzzy.Price) > 0) {
      return Number(fuzzy.price ?? fuzzy.Price);
    }
  }

  // 4. Substring / alias matching in DEFAULT_MENU_PRICES
  for (const [key, price] of Object.entries(DEFAULT_MENU_PRICES)) {
    const kUpper = key.toUpperCase();
    if (clean.includes(kUpper) || kUpper.includes(clean)) {
      return price;
    }
  }

  return 0;
};

// Format month key to readable label e.g. "October 2026"
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

// Format month key to short label e.g. "OCT"
export const formatShortMonth = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') {
    const now = new Date();
    return now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  }
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
};

// Format month key to compact readable label e.g. "Oct 2026"
export const formatCompactMonth = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') {
    const now = new Date();
    return `${now.toLocaleDateString('en-US', { month: 'short' })} ${now.getFullYear()}`;
  }
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
  return `${date.toLocaleDateString('en-US', { month: 'short' })} ${date.getFullYear()}`;
};

// Categorize transaction into CANTEEN, UNIT_FUND, or OTHERS
export const getTxCategory = (tx: any): 'CANTEEN' | 'UNIT_FUND' | 'OTHERS' => {
  if (tx.billType) {
    const b = String(tx.billType).toUpperCase();
    if (b === 'UNIT_FUND' || b.includes('UNIT')) return 'UNIT_FUND';
    if (b === 'OTHERS' || b.includes('OTHER')) return 'OTHERS';
    return 'CANTEEN';
  }
  const desc = String(tx.items || tx.type || '').toLowerCase();
  if (desc.includes('unit fund') || desc.includes('unit_fund') || desc.includes('ইউনিট ফান্ড')) return 'UNIT_FUND';
  if (desc.includes('others') || desc.includes('other bill') || desc.includes('অন্যান্য')) return 'OTHERS';
  return 'CANTEEN';
};

// Military rank seniority weight calculation
export const getRankSeniorityWeight = (rankStr?: string): number => {
  if (!rankStr) return 999;
  const upper = rankStr.toUpperCase().trim();

  // Officer ranks
  if (upper.includes('AIR CHIEF') || upper === 'ACM') return 1;
  if (upper.includes('AIR MSHL') || upper.includes('AIR MARSHAL') || upper === 'AM') return 2;
  if (upper.includes('AVM') || upper.includes('AIR VICE')) return 3;
  if (upper.includes('AIR CDRE') || upper.includes('COMMODORE')) return 4;
  if (upper.includes('GP CAPT') || upper.includes('GROUP CAPTAIN')) return 5;
  if (upper.includes('WG CDR') || upper.includes('WING COMMANDER')) return 6;
  if (upper.includes('SQN LDR') || upper.includes('SQUADRON LEADER')) return 7;
  if (upper.includes('FLT LT') || upper.includes('FLIGHT LIEUTENANT')) return 8;
  if (upper.includes('FG OFFR') || upper.includes('FLYING OFFICER')) return 9;
  if (upper.includes('PLT OFFR') || upper.includes('PILOT OFFICER')) return 10;

  // Warrant Officers (JCOs)
  if (upper === 'MWO' || upper.includes('MASTER WARRANT')) return 20;
  if (upper === 'SWO' || upper.includes('SENIOR WARRANT')) return 21;
  if (upper === 'WO' || upper.includes('WARRANT')) return 22;

  // NCOs & Airmen
  if (upper === 'SGT' || upper.includes('SERGEANT')) return 30;
  if (upper === 'CPL' || upper.includes('CORPORAL')) return 31;
  if (upper === 'LAC' || upper.includes('LEADING')) return 32;
  if (upper === 'AC-1' || upper === 'AC1') return 33;
  if (upper === 'AC-2' || upper === 'AC2') return 34;
  if (upper === 'AC' || upper.includes('AIRCRAFTMAN')) return 35;

  // Civilian / NC(E) / Others
  if (upper.includes('NC(E)') || upper.includes('NCE')) return 40;
  if (upper.includes('CIV')) return 50;

  return 100;
};

interface StatementRow {
  sl: number;
  date: string;
  category?: string;
  item: string;
  qty: string | number;
  rate: string | number;
  total: number;
}

export interface StatementItemRow {
  itemName: string;
  qty: number;
  rate: number;
  total: number;
}

// Global in-memory cache to prevent repeated re-renders, flickering, and photo re-downloads across tab switches
let globalMembersCache: any[] | null = null;
let lastMembersSyncTimestamp = 0;

export const MemberDB: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BillCategory>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getRunningMonthKey());
  const [filterMode, setFilterMode] = useState<'AUTO' | 'ALL' | 'DUE'>('AUTO');
  const [rankTypeFilter, setRankTypeFilter] = useState<'OVERALL' | 'OFFICER' | 'AIRMEN' | 'CIVILIAN'>('OVERALL');
  const [viewMode, setViewMode] = useState<'BOX' | 'TABLE'>('BOX');
  const [, setBanglaVersion] = useState<number>(0);

  const [allTxs, setAllTxs] = useState<any[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const filtered = parsed.filter((t: any) => !String(t.id).startsWith('1791043520536'));
      if (filtered.length !== parsed.length) {
        localStorage.setItem('canteen_txs', JSON.stringify(filtered));
      }
      return filtered;
    } catch { return []; }
  });

  const [members, setMembers] = useState<any[]>(() => {
    if (globalMembersCache && globalMembersCache.length > 0) {
      return globalMembersCache;
    }
    const shared = getCanteenMembersCache();
    if (shared && shared.length > 0) {
      globalMembersCache = shared;
      return shared;
    }
    try {
      const cached = localStorage.getItem('canteen_members_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          globalMembersCache = parsed;
          return parsed;
        }
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = globalMembersCache || getCanteenMembersCache();
    return !(cached && cached.length > 0);
  });

  // Officer / Airmen / Civilian counts
  const officerCount = useMemo(() => members.filter(isOfficerMember).length, [members]);
  const airmenCount = useMemo(() => members.filter(isAirmanMember).length, [members]);
  const civilianCount = useMemo(() => members.filter(isCivilianMember).length, [members]);
  const overallCount = members.length;

  // Profile Modal state
  const [profileMember, setProfileMember] = useState<any | null>(null);
  const [profileTx, setProfileTx] = useState<any[]>([]);

  // Initial Bill Modals state
  const [isImportBillsModalOpen, setIsImportBillsModalOpen] = useState(false);
  const [importModalInitialTab, setImportModalInitialTab] = useState<'FILE' | 'PASTE' | 'HISTORY'>('FILE');
  const [initialBillMember, setInitialBillMember] = useState<any | null>(null);
  const [importHistoryCount, setImportHistoryCount] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('canteen_bill_import_history');
      if (raw) return JSON.parse(raw).length;
    } catch {}
    return 0;
  });

  // Statement Modal state
  const [statementMember, setStatementMember] = useState<any | null>(null);
  const [statementTx, setStatementTx] = useState<any[]>([]);
  const [statementCategory, setStatementCategory] = useState<BillCategory>('ALL');
  const [statementMonth, setStatementMonth] = useState<string>(() => getRunningMonthKey());
  const [isCapturingPic, setIsCapturingPic] = useState(false);
  const [statementImageFile, setStatementImageFile] = useState<File | null>(null);
  const [statementImageBlob, setStatementImageBlob] = useState<Blob | null>(null);
  const [whatsAppNotice, setWhatsAppNotice] = useState<string | null>(null);
  const [canteenConfig, setCanteenConfig] = useState<any>(() => getCanteenConfig());
  const [showWhatsAppTemplateBox, setShowWhatsAppTemplateBox] = useState<boolean>(false);
  const [showManagerModal, setShowManagerModal] = useState<boolean>(false);
  const [managerSearchTerm, setManagerSearchTerm] = useState<string>('');
  const [managerAssignSuccess, setManagerAssignSuccess] = useState<string | null>(null);

  useEffect(() => {
    const handleSettingsUpdate = (e: any) => {
      if (e?.detail) {
        setCanteenConfig(e.detail);
      }
    };
    window.addEventListener('canteen_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('canteen_settings_updated', handleSettingsUpdate);
  }, []);

  const handleAssignManager = (targetMember: any) => {
    const rank = targetMember['Rank'] || 'LAC';
    const surname = targetMember['Surname'] || '';
    const fullName = `${rank} ${surname}`.trim();
    const bd = String(targetMember['BD No'] || targetMember.airman_id?.replace(/\D/g, '') || '').trim();
    const contact = String(targetMember['Contact'] || targetMember['Mobile No'] || canteenConfig?.phone || '').trim();
    const dp = targetMember.DP || canteenConfig?.adminImage || '';

    const updated = {
      ...canteenConfig,
      managerName: fullName,
      managerBdNo: bd,
      phone: contact || canteenConfig?.phone,
      adminImage: dp || canteenConfig?.adminImage
    };

    setCanteenConfig(updated);
    saveCanteenConfig(updated);
    setManagerAssignSuccess(`${fullName} (${bd ? `BD: ${bd}` : ''}) কে সক্রিয় ক্যান্টিন ম্যানেজার হিসেবে নির্ধারণ করা হয়েছে!`);
    setTimeout(() => setManagerAssignSuccess(null), 4000);
  };

  useEffect(() => {
    syncWhatsAppTemplateConfigFromCloud().catch(() => {});
  }, []);

  // Menu catalog prices cache for accurate item rate calculations
  const [menuCatalog, setMenuCatalog] = useState<any[]>(() => getCanteenMenuCache());

  useEffect(() => {
    fetchCanteenMenuOnce().then((data) => {
      if (data && data.length > 0) {
        setMenuCatalog(data);
      }
    });
  }, []);

  const getMenuItemPrice = (name: string): number => {
    return lookupCatalogPrice(name, menuCatalog);
  };

  // Robust date/time parser to ensure newest transactions always sort to the top by real calendar date
  const parseTxTime = (tx: any): number => {
    if (!tx) return 0;

    let calendarTime = 0;

    // 1. Parse real date string first: "DD Mon YY", "DD Mon YYYY", "YYYY-MM-DD", Bengali digits, etc.
    const rawDate = tx.date || tx.txDate || '';
    if (rawDate && typeof rawDate === 'string') {
      let str = rawDate.trim();
      const bnDigits: Record<string, string> = {
        '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
        '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
      };
      str = str.replace(/[০-৯]/g, (ch) => bnDigits[ch] || ch);

      // A. "DD Mon YY" or "DD Mon YYYY" or "DD-Mon-YY" (e.g. "05 Oct 26", "28 Sep 26", "28 Aug 26")
      const MONTH_MAP: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
      };
      const dmyAlpha = str.match(/^(\d{1,2})[\s\-\/\.]+([A-Za-z]{3,9})[\s\-\/\.]+(\d{2,4})/);
      if (dmyAlpha) {
        const day = parseInt(dmyAlpha[1], 10);
        const mKey = dmyAlpha[2].slice(0, 3).toLowerCase();
        let yr = parseInt(dmyAlpha[3], 10);
        if (yr < 100) yr += 2000;
        const monIdx = MONTH_MAP[mKey];
        if (monIdx !== undefined) {
          calendarTime = new Date(yr, monIdx, day, 12, 0, 0).getTime();
        }
      }

      // B. Bengali month names (e.g. "২৮ আগস্ট ২৬", "২৮ সেপ্টেম্বর ২০২৬", "আগস্ট ২০২৬")
      if (!calendarTime) {
        const BN_MONTHS: Record<string, number> = {
          'জানু': 0, 'ফেব্রু': 1, 'মার্চ': 2, 'এপ্রি': 3, 'মে': 4, 'জুন': 5,
          'জুলা': 6, 'আগস্ট': 7, 'সেপ্টে': 8, 'অক্টো': 9, 'নভে': 10, 'ডিসে': 11
        };
        for (const [bnPrefix, mIdx] of Object.entries(BN_MONTHS)) {
          if (str.includes(bnPrefix)) {
            const dayMatch = str.match(/^(\d{1,2})/);
            const yrMatch = str.match(/(\d{4}|\d{2})$/) || str.match(/\s(\d{2,4})/);
            const day = dayMatch ? parseInt(dayMatch[1], 10) : 28;
            let yr = yrMatch ? parseInt(yrMatch[1], 10) : 2026;
            if (yr < 100) yr += 2000;
            calendarTime = new Date(yr, mIdx, day, 12, 0, 0).getTime();
            break;
          }
        }
      }

      // C. Format DD/MM/YYYY or DD-MM-YYYY
      if (!calendarTime) {
        const dmyNum = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
        if (dmyNum) {
          const day = parseInt(dmyNum[1], 10);
          const mon = parseInt(dmyNum[2], 10) - 1;
          let yr = parseInt(dmyNum[3], 10);
          if (yr < 100) yr += 2000;
          if (mon >= 0 && mon < 12) {
            calendarTime = new Date(yr, mon, day, 12, 0, 0).getTime();
          }
        }
      }

      // D. Format YYYY-MM-DD
      if (!calendarTime) {
        const ymdNum = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (ymdNum) {
          const yr = parseInt(ymdNum[1], 10);
          const mon = parseInt(ymdNum[2], 10) - 1;
          const day = parseInt(ymdNum[3], 10);
          calendarTime = new Date(yr, mon, day, 12, 0, 0).getTime();
        }
      }

      // E. Format YYYY-MM
      if (!calendarTime) {
        const ymNum = str.match(/^(\d{4})[\/\-](\d{1,2})/);
        if (ymNum) {
          const yr = parseInt(ymNum[1], 10);
          const mon = parseInt(ymNum[2], 10) - 1;
          calendarTime = new Date(yr, mon, 28, 12, 0, 0).getTime();
        }
      }

      // F. Standard Date fallback
      if (!calendarTime) {
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          calendarTime = d.getTime();
        }
      }
    }

    if (!calendarTime && tx.monthKey) {
      const [y, m] = String(tx.monthKey).split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        calendarTime = new Date(y, m - 1, 28, 12, 0, 0).getTime();
      }
    }

    // Secondary sub-day tie-breaker from createdAt or numeric ID timestamp
    let subDayTieBreaker = 0;
    if (tx.createdAt || tx.created_at) {
      const t = new Date(tx.createdAt || tx.created_at).getTime();
      if (!isNaN(t)) subDayTieBreaker = t % 86400000;
    }
    if (!subDayTieBreaker) {
      const numMatch = String(tx.id || '').match(/(\d{13})/);
      if (numMatch) {
        subDayTieBreaker = Number(numMatch[1]) % 86400000;
      }
    }

    if (calendarTime > 0) {
      return calendarTime + subDayTieBreaker;
    }

    // Fallback if no calendar date could be parsed
    if (tx.createdAt || tx.created_at) {
      const t = new Date(tx.createdAt || tx.created_at).getTime();
      if (!isNaN(t)) return t;
    }
    const numMatch = String(tx.id || '').match(/(\d{13})/);
    if (numMatch) {
      return Number(numMatch[1]);
    }

    return 0;
  };

  // Expanded history rows: Newest transactions at top, preserves previous bills & supports reverted payments
  const displayHistoryRows = useMemo(() => {
    const rows: Array<{
      rowId: string;
      ser: number;
      tx: any;
      txId: any;
      date: string;
      description: string;
      qty: string | number;
      amount: number;
      type: string;
    }> = [];

    let currentSer = 1;

    // Sort member transactions newest first
    const sortedProfileTx = [...profileTx].sort((a: any, b: any) => {
      const timeA = parseTxTime(a);
      const timeB = parseTxTime(b);
      if (timeA !== timeB) return timeB - timeA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

    sortedProfileTx.forEach((tx) => {
      if (tx.type === 'BILL PAYMENT') {
        const isReverted = tx.isReverted || tx.status === 'REVERTED' || String(tx.items || '').includes('[বাতিল');
        const isCash = String(tx.gateway || '').toUpperCase() === 'CASH' || String(tx.items || '').toUpperCase().includes('CASH');
        const methodStr = isCash ? 'Cash' : 'UCB';
        const desc = isReverted 
          ? `Bill Payment (বাতিল / REVERTED) - ${methodStr}`
          : `Bill Payment - ${methodStr}`;

        rows.push({
          rowId: `${tx.id}_pay`,
          ser: currentSer++,
          tx,
          txId: tx.id,
          date: tx.date,
          description: desc,
          qty: isReverted ? 'বাতিল' : '-',
          amount: tx.amount,
          type: isReverted ? 'REVERTED' : 'BILL PAYMENT'
        });
        return;
      }

      if (tx.type === 'INITIAL_BILL' || tx.type === 'AMOUNT_CHANGE' || tx.type === 'ADJUSTED') {
        const isChange = tx.isAmountChange || tx.type === 'AMOUNT_CHANGE' || String(tx.items || '').includes('Changed amount');
        rows.push({
          rowId: `${tx.id}_init`,
          ser: currentSer++,
          tx,
          txId: tx.id,
          date: tx.date,
          description: tx.items || (isChange ? `Changed amount from ${tx.previousAmount ?? ''} to ${tx.amount}` : 'বকেয়া বিল'),
          qty: '-',
          amount: tx.amount,
          type: isChange ? 'AMOUNT_CHANGE' : 'INITIAL_BILL'
        });
        return;
      }

      // 1. Structured soldItems (from POS)
      if (Array.isArray(tx.soldItems) && tx.soldItems.length > 0) {
        tx.soldItems.forEach((si: any, sIdx: number) => {
          const name = String(si.menuItemName || si.name || 'ক্যান্টিন খাদ্যদ্রব্য').trim();
          const qty = Number(si.qty || si.quantity || 1);
          let itemRate = Number(si.price || si.rate || 0);
          if (itemRate <= 0) {
            itemRate = lookupCatalogPrice(name, menuCatalog);
          }
          const itemTotal = itemRate > 0 ? (itemRate * qty) : Math.round((Number(tx.amount || 0) / tx.soldItems.length) * 100) / 100;
          rows.push({
            rowId: `${tx.id}_si_${sIdx}`,
            ser: currentSer++,
            tx,
            txId: tx.id,
            date: tx.date,
            description: name,
            qty: qty,
            amount: itemTotal,
            type: tx.type || 'SALE'
          });
        });
        return;
      }

      // 2. Comma-separated items in tx.items (e.g. "COLD COFFEE (1), CHICKEN ONION (1)")
      const itemsStr = String(tx.items || '').trim();
      if (itemsStr.includes(',')) {
        const parts = itemsStr.split(',').map((s: string) => s.trim()).filter(Boolean);
        parts.forEach((part: string, pIdx: number) => {
          let name = part;
          let qty: number | string = 1;
          const match = part.match(/^(.+?)\s*\(([0-9]+)\)$/);
          if (match) {
            name = match[1].trim();
            qty = parseInt(match[2], 10) || 1;
          }
          let price = lookupCatalogPrice(name, menuCatalog);
          const itemTotal = price > 0 ? (price * (Number(qty) || 1)) : Math.round((Number(tx.amount || 0) / parts.length) * 100) / 100;
          rows.push({
            rowId: `${tx.id}_part_${pIdx}`,
            ser: currentSer++,
            tx,
            txId: tx.id,
            date: tx.date,
            description: name,
            qty: qty,
            amount: itemTotal,
            type: tx.type || 'SALE'
          });
        });
        return;
      }

      // 3. Single item
      let qtyText: string | number = "-";
      let descText = tx.items || 'ক্যান্টিন খাদ্যদ্রব্য';
      if (tx.items && tx.items.includes('(')) {
        const match = tx.items.match(/^(.+?)\s*\(([0-9]+)\)$/);
        if (match) {
          descText = match[1].trim();
          qtyText = match[2];
        }
      }
      rows.push({
        rowId: `${tx.id}_single`,
        ser: currentSer++,
        tx,
        txId: tx.id,
        date: tx.date,
        description: descText,
        qty: qtyText,
        amount: tx.amount,
        type: tx.type || 'SALE'
      });
    });

    // Sort all rows newest first: latest dates on top, oldest at the bottom
    rows.sort((a, b) => {
      const timeA = parseTxTime(a.tx || { date: a.date, id: a.txId });
      const timeB = parseTxTime(b.tx || { date: b.date, id: b.txId });
      if (timeA !== timeB) return timeB - timeA;
      return String(b.txId || '').localeCompare(String(a.txId || ''));
    });

    // Re-index continuous serials after newest-first sorting: #1, #2, #3...
    rows.forEach((r, idx) => {
      r.ser = idx + 1;
    });

    // If no transactions found yet but member has an existing ledger Due, show Opening Balance row
    if (rows.length === 0 && profileMember) {
      const rawDue = Number(profileMember.Due ?? profileMember.due ?? profileMember.baki ?? 0);
      if (rawDue > 0) {
        rows.push({
          rowId: `synthetic-due-${profileMember.airman_id || profileMember['BD No'] || 'init'}`,
          ser: 1,
          tx: {
            id: `synthetic-due-${profileMember.airman_id || profileMember['BD No'] || 'init'}`,
            date: 'প্রারম্ভিক বকেয়া',
            amount: rawDue,
            type: 'INITIAL_BILL',
            items: 'প্রারম্ভিক বকেয়া বিল (Opening Balance)'
          },
          txId: `synthetic-due-${profileMember.airman_id || profileMember['BD No'] || 'init'}`,
          date: 'প্রারম্ভিক বকেয়া',
          description: 'প্রারম্ভিক বকেয়া বিল (Opening Balance)',
          qty: '-',
          amount: rawDue,
          type: 'INITIAL_BILL'
        });
      }
    }

    return rows;
  }, [profileTx, menuCatalog, profileMember]);

  // Profile history rows showing all member transactions directly
  const filteredProfileHistoryRows = useMemo(() => {
    return displayHistoryRows.map((r, idx) => ({ ...r, ser: idx + 1 }));
  }, [displayHistoryRows]);

  // Helper to compute effective charges for a member:
  // - All regular sales / food purchases are added up.
  // - For INITIAL_BILL / AMOUNT_CHANGE entries: if an amount was changed for a month,
  //   the newest change entry defines the active bill for that month,
  //   while earlier historical entries remain safely in the audit history table.
  const calculateEffectiveCharges = (txList: any[]): number => {
    let salesTotal = 0;
    const initialTxsByGroup = new Map<string, any[]>();

    txList.forEach((tx) => {
      if (!tx || tx.type === 'BILL PAYMENT' || tx.type === 'REVERTED' || tx.isReverted) return;

      const isInit = tx.type === 'INITIAL_BILL' || 
        tx.type === 'AMOUNT_CHANGE' ||
        tx.isAmountChange ||
        String(tx.id || '').startsWith('tx-init-') || 
        String(tx.id || '').startsWith('init-') || 
        String(tx.items || '').includes('ক্যান্টিন বিল') || 
        String(tx.items || '').includes('বকেয়া বিল') ||
        String(tx.items || '').includes('Changed amount from');

      if (!isInit) {
        salesTotal += Number(tx.amount || 0);
      } else {
        const mKey = tx.monthKey || getTxMonthKey(tx.date) || 'DEFAULT';
        const cKey = getTxCategory(tx);
        const groupKey = `${mKey}__${cKey}`;
        if (!initialTxsByGroup.has(groupKey)) {
          initialTxsByGroup.set(groupKey, []);
        }
        initialTxsByGroup.get(groupKey)!.push(tx);
      }
    });

    let initialBillsTotal = 0;
    initialTxsByGroup.forEach((groupTxs) => {
      if (groupTxs.length === 1) {
        initialBillsTotal += Number(groupTxs[0].amount || 0);
      } else {
        // Sort newest first by timestamp / created_at / id, prioritizing corrected transactions
        const sorted = [...groupTxs].sort((a, b) => {
          if (a.isAmountChange && !b.isAmountChange) return -1;
          if (!a.isAmountChange && b.isAmountChange) return 1;
          const timeA = new Date(a.created_at || a.createdAt || a.timestamp || 0).getTime() || 0;
          const timeB = new Date(b.created_at || b.createdAt || b.timestamp || 0).getTime() || 0;
          if (timeA !== timeB) return timeB - timeA;
          return String(b.id || '').localeCompare(String(a.id || ''));
        });
        initialBillsTotal += Number(sorted[0].amount || 0);
      }
    });

    return salesTotal + initialBillsTotal;
  };

  // Overall financial summary for open profile member (Billed, Paid, Net Due)
  const profileMemberStats = useMemo(() => {
    if (!profileMember) return { totalBilled: 0, totalPaid: 0, netDue: 0 };
    const effectiveBilled = calculateEffectiveCharges(profileTx || []);
    let paid = 0;
    (profileTx || []).forEach((t: any) => {
      if (!t) return;
      const isReverted = t.isReverted || t.status === 'REVERTED' || String(t.items || '').includes('[বাতিল');
      if (isReverted) return;
      if (t.type === 'BILL PAYMENT') {
        paid += Number(t.amount || 0);
      }
    });
    // Live ledger net due: Total Billed - Total Paid
    const netDue = (profileTx && profileTx.length > 0)
      ? Math.max(0, effectiveBilled - paid)
      : Number(profileMember.Due ?? profileMember.due ?? profileMember.baki ?? 0);
    return { totalBilled: effectiveBilled, totalPaid: paid, netDue };
  }, [profileMember, profileTx]);

  // Pay Bill Modal state
  const [payBillMember, setPayBillMember] = useState<any | null>(null);
  const [payBillCategory, setPayBillCategory] = useState<'ALL' | 'CANTEEN' | 'UNIT_FUND' | 'OTHERS'>('ALL');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'UCB'>('UCB');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  // Dynamic Payment Success Animation State
  const [paymentSuccessData, setPaymentSuccessData] = useState<{
    memberName: string;
    rank: string;
    surname: string;
    bdNo: string;
    dp?: string;
    paidAmount: number;
    previousDue: number;
    newDue: number;
    method: 'CASH' | 'UCB';
    category: string;
    txId: string;
    date: string;
    breakdownNote?: string;
  } | null>(null);

  // Dedicated Payment History State & Filters
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = useState(false);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<'ALL' | 'CASH' | 'UCB'>('ALL');
  const [paymentMonthFilter, setPaymentMonthFilter] = useState<string>(() => getRunningMonthKey());
  const [paymentToDelete, setPaymentToDelete] = useState<any | null>(null);
  const [isDeletingPayment, setIsDeletingPayment] = useState(false);
  const [paymentDeleteSuccessMsg, setPaymentDeleteSuccessMsg] = useState<string | null>(null);

  // Soft harmonic celebration chime via Web Audio API
  const playPaymentSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      // Arpeggio chord: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), C6 (1046.50Hz)
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.55);
      });
    } catch {}
  };

  // Deletion modals
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [txDeleteConfirmId, setTxDeleteConfirmId] = useState<any | null>(null);
  const [deletedTxNotice, setDeletedTxNotice] = useState<{
    description: string;
    amount: number;
    type: string;
    date: string;
  } | null>(null);
  const [duePulseKey, setDuePulseKey] = useState<number>(0);

  const playTrashPopSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.2);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch {}
  };
  // Contact Action Modal (Call / WhatsApp)
  const [contactActionMember, setContactActionMember] = useState<any | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // All Payment Transactions sorted newest first (Excludes reverted or deleted transactions)
  const allPaymentTxs = useMemo(() => {
    return (allTxs || [])
      .filter((t: any) => t && t.type === 'BILL PAYMENT' && !t.isReverted && t.status !== 'REVERTED' && !String(t.items || '').includes('[বাতিল / REVERTED]'))
      .sort((a: any, b: any) => {
        const timeA = parseTxTime(a);
        const timeB = parseTxTime(b);
        if (timeA !== timeB) return timeB - timeA;
        const idA = String(a.id || '');
        const idB = String(b.id || '');
        return idB.localeCompare(idA);
      });
  }, [allTxs]);

  // Payment counts for each method in the currently selected month
  const paymentCountsByMethod = useMemo(() => {
    const monthFiltered = allPaymentTxs.filter((tx: any) => {
      if (paymentMonthFilter !== 'ALL') {
        const txMonth = getPaymentCycleMonthKey(tx?.date || tx?.timestamp || tx?.created_at) || tx?.monthKey || getTxMonthKey(tx?.date);
        if (txMonth !== paymentMonthFilter) return false;
      }
      return true;
    });

    let allCount = monthFiltered.length;
    let cashCount = 0;
    let ucbCount = 0;

    monthFiltered.forEach((tx: any) => {
      const gw = String(tx.gateway || tx.items || '').toUpperCase();
      if (gw.includes('CASH')) cashCount++;
      else if (gw.includes('UCB')) ucbCount++;
      else cashCount++;
    });

    return { allCount, cashCount, ucbCount };
  }, [allPaymentTxs, paymentMonthFilter]);

  const filteredPaymentTxs = useMemo(() => {
    return allPaymentTxs.filter((tx: any) => {
      if (paymentMonthFilter !== 'ALL') {
        const txMonth = getPaymentCycleMonthKey(tx?.date || tx?.timestamp || tx?.created_at) || tx?.monthKey || getTxMonthKey(tx?.date);
        if (txMonth !== paymentMonthFilter) return false;
      }
      if (paymentMethodFilter !== 'ALL') {
        const gateway = String(tx.gateway || tx.items || '').toUpperCase();
        if (paymentMethodFilter === 'CASH' && !gateway.includes('CASH')) return false;
        if (paymentMethodFilter === 'UCB' && !gateway.includes('UCB')) return false;
      }
      if (paymentSearch.trim()) {
        const q = paymentSearch.toLowerCase().trim();
        const mName = String(tx.memberName || '').toLowerCase();
        const mRank = String(tx.rank || '').toLowerCase();
        const mBd = String(tx.bdNo || tx.airman_id || '').toLowerCase();
        const mItems = String(tx.items || '').toLowerCase();
        const mDate = String(tx.date || '').toLowerCase();
        return mName.includes(q) || mRank.includes(q) || mBd.includes(q) || mItems.includes(q) || mDate.includes(q);
      }
      return true;
    });
  }, [allPaymentTxs, paymentMonthFilter, paymentMethodFilter, paymentSearch]);

  const totalPaymentsAmount = useMemo(() => {
    return filteredPaymentTxs
      .filter((tx: any) => !tx.isReverted && tx.status !== 'REVERTED')
      .reduce((sum: number, tx: any) => sum + Number(tx.amount || 0), 0);
  }, [filteredPaymentTxs]);

  const getTelHref = (raw: any): string => {
    const clean = String(raw || '').replace(/[^\d+]/g, '');
    return `tel:${clean}`;
  };

  const getWhatsAppHref = (raw: any, memberName?: string, dueAmount?: number): string => {
    if (!raw) return '';
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) return '';
    let fullNumber = digits;
    if (fullNumber.startsWith('01') && fullNumber.length === 11) {
      fullNumber = '88' + fullNumber;
    } else if (!fullNumber.startsWith('88') && fullNumber.length === 10) {
      fullNumber = '880' + fullNumber;
    }
    const name = memberName ? memberName.trim() : 'সম্মানিত সদস্য';
    let msg = `আসসালামু আলাইকুম ${name}, CAFE UAV ক্যান্টিন সংক্রান্ত বিষয়ে যোগাযোগ করছি।`;
    if (dueAmount && dueAmount > 0) {
      msg += ` আপনার বর্তমান বকেয়া বিল ৳${dueAmount}।`;
    }
    const text = encodeURIComponent(msg);
    return `https://wa.me/${fullNumber}?text=${text}`;
  };

  const toEnglishDate = formatCanteenDate;

  // Load transactions from cloud on mount and keep synced
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // 1. Automatically reconcile transactions from import history (Aug, Sep, etc.)
        const reconciled = await syncImportHistoryToTransactions();
        if (isMounted && Array.isArray(reconciled) && reconciled.length > 0) {
          setAllTxs(reconciled);
        }

        // 2. Sync from cloud
        const cloudTxs = await pullKeyFromCloud('canteen_txs');
        if (isMounted && Array.isArray(cloudTxs) && cloudTxs.length > 0) {
          const deletedIds = getDeletedTxIds();
          const localTxs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
          const txMap = new Map();
          [...localTxs, ...cloudTxs, ...(reconciled || [])].forEach((t) => {
            if (t && t.id && !deletedIds.has(String(t.id)) && !t.isReverted && t.status !== 'REVERTED') {
              txMap.set(String(t.id), t);
            }
          });
          const merged = deduplicateCanteenTransactions(Array.from(txMap.values()));
          localStorage.setItem('canteen_txs', JSON.stringify(merged));
          setAllTxs(merged);
        }
      } catch (err) {
        console.warn('Could not sync canteen_txs from cloud on mount:', err);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Listen to transaction updates with debouncing to prevent thrashing on cloud pulls
  useEffect(() => {
    let debounceTimer: any = null;
    const handleTxsSync = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        try {
          const deletedIds = getDeletedTxIds();
          const raw = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
          const clean = raw.filter((t: any) => t && !deletedIds.has(String(t.id)) && !t.isReverted && t.status !== 'REVERTED');
          setAllTxs(prev => {
            if (prev.length === clean.length && JSON.stringify(prev) === JSON.stringify(clean)) {
              return prev;
            }
            return clean;
          });
        } catch {}
      }, 100);
    };
    window.addEventListener('canteen_txs_updated', handleTxsSync);
    window.addEventListener('canteen_bill_import_history_updated', handleTxsSync);
    window.addEventListener('canteen_state_updated', handleTxsSync);
    window.addEventListener('storage', handleTxsSync);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('canteen_txs_updated', handleTxsSync);
      window.removeEventListener('canteen_bill_import_history_updated', handleTxsSync);
      window.removeEventListener('canteen_state_updated', handleTxsSync);
      window.removeEventListener('storage', handleTxsSync);
    };
  }, []);

  // Listen to canteen members updates across all components and sync channels
  useEffect(() => {
    const handleMembersUpdated = (e: any) => {
      const updated = e?.detail || getCanteenMembersCache();
      if (Array.isArray(updated) && updated.length > 0) {
        globalMembersCache = updated;
        setMembers(updated);
        setLoading(false);
      }
    };
    window.addEventListener('canteen_members_updated', handleMembersUpdated);
    return () => {
      window.removeEventListener('canteen_members_updated', handleMembersUpdated);
    };
  }, []);

  // Sync Bengali names from cloud & listen to updates
  useEffect(() => {
    syncMemberBanglaNamesFromCloud().catch(() => {});
    const handleBanglaSync = () => setBanglaVersion(v => v + 1);
    window.addEventListener('canteen_member_bangla_names_updated', handleBanglaSync);
    return () => {
      window.removeEventListener('canteen_member_bangla_names_updated', handleBanglaSync);
    };
  }, []);

  // Sync import history batch count
  useEffect(() => {
    const updateImportBatchCount = () => {
      try {
        const raw = localStorage.getItem('canteen_bill_import_history');
        if (raw) setImportHistoryCount(JSON.parse(raw).length);
      } catch {}
    };
    pullKeyFromCloud('canteen_bill_import_history').then(data => {
      if (Array.isArray(data)) {
        setImportHistoryCount(data.length);
        localStorage.setItem('canteen_bill_import_history', JSON.stringify(data));
      }
    }).catch(() => {});
    window.addEventListener('canteen_bill_import_history_updated', updateImportBatchCount);
    window.addEventListener('storage', updateImportBatchCount);
    return () => {
      window.removeEventListener('canteen_bill_import_history_updated', updateImportBatchCount);
      window.removeEventListener('storage', updateImportBatchCount);
    };
  }, []);

  // Keep open Profile and open Statement in real-time sync with transactions (merging all sources)
  useEffect(() => {
    if (profileMember) {
      const local = (() => {
        try { return JSON.parse(localStorage.getItem('canteen_txs') || '[]'); } catch { return []; }
      })();
      const txMap = new Map<string, any>();
      (allTxs || []).forEach(t => { if (t?.id) txMap.set(String(t.id), t); });
      local.forEach((t: any) => { if (t?.id) txMap.set(String(t.id), t); });
      const mergedTxs = deduplicateCanteenTransactions(Array.from(txMap.values()));
      setProfileTx(filterMemberTxs(profileMember, mergedTxs));
    }
  }, [allTxs, profileMember]);

  useEffect(() => {
    if (statementMember) {
      const local = (() => {
        try { return JSON.parse(localStorage.getItem('canteen_txs') || '[]'); } catch { return []; }
      })();
      const txMap = new Map<string, any>();
      (allTxs || []).forEach(t => { if (t?.id) txMap.set(String(t.id), t); });
      local.forEach((t: any) => { if (t?.id) txMap.set(String(t.id), t); });
      const mergedTxs = deduplicateCanteenTransactions(Array.from(txMap.values()));
      setStatementTx(filterMemberTxs(statementMember, mergedTxs));
    }
  }, [allTxs, statementMember]);

  // Auto-dismiss dynamic payment confirmation animation after 4.5 seconds
  useEffect(() => {
    if (!paymentSuccessData) return;
    const timer = setTimeout(() => {
      setPaymentSuccessData(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [paymentSuccessData]);

  // Available months list derived from current date + past 12 months + transactions
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    const now = new Date();
    const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    set.add(curKey);

    for (let i = 1; i <= 12; i++) {
      const prev = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.add(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
    }

    allTxs.forEach((tx) => {
      const m = tx?.monthKey || getTxMonthKey(tx?.date);
      if (m) set.add(m);
    });

    return Array.from(set).sort().reverse();
  }, [allTxs]);

  const handlePrevMonth = () => {
    if (selectedMonth === 'ALL') {
      const curKey = getRunningMonthKey();
      setSelectedMonth(curKey);
      return;
    }
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx !== -1 && idx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[idx + 1]);
    } else {
      const [y, m] = selectedMonth.split('-').map(Number);
      const d = new Date(y, m - 2, 1);
      const prevKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonth(prevKey);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 'ALL') {
      const curKey = getRunningMonthKey();
      setSelectedMonth(curKey);
      return;
    }
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx > 0) {
      setSelectedMonth(availableMonths[idx - 1]);
    } else {
      const [y, m] = selectedMonth.split('-').map(Number);
      const d = new Date(y, m, 1);
      const nextKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      setSelectedMonth(nextKey);
    }
  };

  // Pre-index transactions by clean BD No and airman_id for O(1) lightning-fast member bill calculations
  const txIndex = useMemo(() => {
    const airmanMap = new Map<string, any[]>();
    const bdMap = new Map<string, any[]>();

    (allTxs || []).forEach((tx: any) => {
      if (!tx) return;
      const txAirman = String(tx.airman_id || tx.airmanId || '').trim().toLowerCase();
      if (txAirman) {
        if (!airmanMap.has(txAirman)) airmanMap.set(txAirman, []);
        airmanMap.get(txAirman)!.push(tx);
      }
      const txBdClean = String(tx.bdNo || tx['BD No'] || tx.bd_no || tx.airman_id || '').replace(/\D/g, '');
      const txBdNoZero = txBdClean.replace(/^0+/, '');
      if (txBdClean) {
        if (!bdMap.has(txBdClean)) bdMap.set(txBdClean, []);
        bdMap.get(txBdClean)!.push(tx);
      }
      if (txBdNoZero && txBdNoZero !== txBdClean) {
        if (!bdMap.has(txBdNoZero)) bdMap.set(txBdNoZero, []);
        bdMap.get(txBdNoZero)!.push(tx);
      }
    });

    return { airmanMap, bdMap };
  }, [allTxs]);

  // Helper to filter all transactions belonging to a specific member safely
  const filterMemberTxs = (member: any, txs: any[]): any[] => {
    if (!member || !Array.isArray(txs)) return [];

    if (txs === allTxs) {
      const mAirman = String(member.airman_id || member.airmanId || '').trim().toLowerCase();
      const mBdClean = String(member['BD No'] || member.bdNo || member.bd_no || member.airman_id || '').replace(/\D/g, '');
      const mBdCleanNoZero = mBdClean.replace(/^0+/, '');

      const foundTxs: any[] = [];
      const seenTxIds = new Set<string>();

      if (mAirman && txIndex.airmanMap.has(mAirman)) {
        txIndex.airmanMap.get(mAirman)!.forEach(t => {
          if (t && t.id && !seenTxIds.has(String(t.id))) {
            seenTxIds.add(String(t.id));
            foundTxs.push(t);
          }
        });
      }

      if (mBdClean && txIndex.bdMap.has(mBdClean)) {
        txIndex.bdMap.get(mBdClean)!.forEach(t => {
          if (t && t.id && !seenTxIds.has(String(t.id))) {
            seenTxIds.add(String(t.id));
            foundTxs.push(t);
          }
        });
      }

      if (mBdCleanNoZero && mBdCleanNoZero !== mBdClean && txIndex.bdMap.has(mBdCleanNoZero)) {
        txIndex.bdMap.get(mBdCleanNoZero)!.forEach(t => {
          if (t && t.id && !seenTxIds.has(String(t.id))) {
            seenTxIds.add(String(t.id));
            foundTxs.push(t);
          }
        });
      }

      if (foundTxs.length > 0) return foundTxs;
    }

    const mAirman = String(member.airman_id || member.airmanId || '').trim().toLowerCase();
    const mBdClean = String(member['BD No'] || member.bdNo || member.bd_no || member.airman_id || '').replace(/\D/g, '');
    const mBdCleanNoZero = mBdClean.replace(/^0+/, '');
    const mSurname = String(member['Surname'] || member.surname || '').trim().toLowerCase();
    const mRank = String(member['Rank'] || member.rank || '').trim().toLowerCase();

    return txs.filter((tx: any) => {
      if (!tx) return false;
      const txAirman = String(tx.airman_id || tx.airmanId || '').trim().toLowerCase();
      if (mAirman && txAirman && mAirman === txAirman) return true;

      const txBdClean = String(tx.bdNo || tx['BD No'] || tx.bd_no || tx.airman_id || '').replace(/\D/g, '');
      const txBdCleanNoZero = txBdClean.replace(/^0+/, '');
      if (mBdClean && txBdClean && (mBdClean === txBdClean || (mBdCleanNoZero && mBdCleanNoZero === txBdCleanNoZero))) return true;

      if (mSurname && tx.memberName) {
        const txName = String(tx.memberName).toLowerCase();
        if (txName.includes(mSurname) && (!mRank || mRank === '-' || txName.includes(mRank))) {
          return true;
        }
      }
      return false;
    });
  };

  // Calculate bill for a member given selected category and month
  const getMemberFilteredBill = (member: any, category: BillCategory, month: string) => {
    const totalDue = getMemberTotalDue(member, category);
    if (totalDue === 0) {
      return 0;
    }

    const memberTxs = filterMemberTxs(member, allTxs);

    if (category === 'ALL' && month === 'ALL') {
      return totalDue;
    }

    if (month === 'ALL') {
      return totalDue;
    }

    const matchingTxs = memberTxs.filter((tx) => {
      const cat = getTxCategory(tx);
      const catMatch = category === 'ALL' || cat === category;
      const isPay = tx?.type === 'BILL PAYMENT' || tx?.type === 'PAYMENT';
      const txMonth = isPay
        ? (getPaymentCycleMonthKey(tx?.date || tx?.timestamp || tx?.created_at || tx?.createdAt) || tx?.monthKey || '')
        : (tx?.monthKey || getTxMonthKey(tx.date));
      const monthMatch = txMonth === month;
      return catMatch && monthMatch;
    });

    const charges = calculateEffectiveCharges(matchingTxs);

    // If transactions exist for this specific month, compute month's remaining unpaid charges
    if (matchingTxs.length > 0) {
      const categoryTxs = category === 'ALL'
        ? memberTxs
        : memberTxs.filter((tx) => getTxCategory(tx) === category || (tx.type === 'BILL PAYMENT' && (tx.billType === 'ALL' || tx.billType === category || !tx.billType)));

      const allPaymentsTotal = categoryTxs
        .filter((tx) => tx.type === 'BILL PAYMENT' && !tx.isReverted && tx.status !== 'REVERTED')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      const beforeTxs = categoryTxs.filter((tx) => {
        const isPay = tx?.type === 'BILL PAYMENT' || tx?.type === 'PAYMENT';
        const m = isPay
          ? (getPaymentCycleMonthKey(tx?.date || tx?.timestamp || tx?.created_at || tx?.createdAt) || tx?.monthKey || '')
          : (tx?.monthKey || getTxMonthKey(tx.date));
        return m < month;
      });
      const chargesBefore = calculateEffectiveCharges(beforeTxs);

      const paymentsAvailableForThisMonth = Math.max(0, allPaymentsTotal - chargesBefore);
      return Math.min(totalDue, Math.max(0, charges - paymentsAvailableForThisMonth));
    }

    // Only if the member has NO transactions at all, fallback to initial profile due if viewing the current running month
    if (memberTxs.length === 0 && (month === getRunningMonthKey() || month === '2026-10') && totalDue > 0) {
      return totalDue;
    }

    return 0;
  };

  // Helper to calculate Member's Total Due (পূর্ববর্তী সব বকেয়া + চলতি মাসের বিল - মোট পরিশোধ)
  const getMemberTotalDue = (member: any, category: BillCategory = 'ALL'): number => {
    if (!member) return 0;
    const profileDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
    const memberTxs = filterMemberTxs(member, allTxs);

    if (category === 'ALL') {
      const allCharges = calculateEffectiveCharges(memberTxs);
      const allPayments = memberTxs
        .filter((tx) => tx.type === 'BILL PAYMENT' && !tx.isReverted && tx.status !== 'REVERTED')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const netTxDue = Math.max(0, allCharges - allPayments);

      // If transactions exist for this member, netTxDue is the accurate ledger balance
      if (memberTxs.length > 0) {
        return netTxDue;
      }
      return profileDue;
    }

    // Sub-category filters (CANTEEN, UNIT_FUND, OTHERS)
    const unitFundTxList = memberTxs.filter((tx) => getTxCategory(tx) === 'UNIT_FUND');
    const unitFundCharges = calculateEffectiveCharges(unitFundTxList);
    const unitFundPayments = unitFundTxList
      .filter((tx) => tx.type === 'BILL PAYMENT' && !tx.isReverted && tx.status !== 'REVERTED')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const unitFundDue = Math.max(0, unitFundCharges - unitFundPayments);

    const othersTxList = memberTxs.filter((tx) => getTxCategory(tx) === 'OTHERS');
    const othersCharges = calculateEffectiveCharges(othersTxList);
    const othersPayments = othersTxList
      .filter((tx) => tx.type === 'BILL PAYMENT' && !tx.isReverted && tx.status !== 'REVERTED')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    const othersDue = Math.max(0, othersCharges - othersPayments);

    if (category === 'UNIT_FUND') {
      return unitFundDue;
    }

    if (category === 'OTHERS') {
      return othersDue;
    }

    if (category === 'CANTEEN') {
      const canteenTxList = memberTxs.filter((tx) => getTxCategory(tx) === 'CANTEEN');
      const canteenCharges = calculateEffectiveCharges(canteenTxList);
      const canteenPayments = memberTxs
        .filter((tx) => (tx.billType === 'CANTEEN' || tx.billType === 'ALL' || (!tx.billType && getTxCategory(tx) === 'CANTEEN')) && tx.type === 'BILL PAYMENT' && !tx.isReverted && tx.status !== 'REVERTED')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const netCanteenTx = Math.max(0, canteenCharges - canteenPayments);

      if (memberTxs.length > 0) {
        return netCanteenTx;
      }
      const baseCanteenDue = Math.max(0, profileDue - unitFundDue - othersDue);
      return Math.max(baseCanteenDue, netCanteenTx);
    }

    return profileDue;
  };

  const openPayBill = (member: any) => {
    const totalDue = getMemberTotalDue(member, selectedCategory);
    if (totalDue <= 0) return; // Prevent paying if Total Due is Nil
    setPayBillMember({
      ...member,
      Due: totalDue,
      due: totalDue,
      baki: totalDue
    });
    setPayBillCategory(selectedCategory);
    setPayAmount(totalDue > 0 ? String(totalDue) : '');
    setPayMethod('UCB');
  };

  // Helper to get effective DP with fallback to manager config or device cache
  const getMemberEffectiveDp = (m: any): string => {
    if (m?.DP && typeof m.DP === 'string' && m.DP.trim()) return m.DP.trim();
    const bdClean = String(m?.['BD No'] || m?.airman_id || '').replace(/\D/g, '');
    const surnameClean = String(m?.['Surname'] || '').toLowerCase();

    // 1. If Manager / Rasel (BD 474455)
    if (bdClean === '474455' || surnameClean === 'rasel') {
      try {
        const cfg = getCanteenConfig();
        if (cfg.adminImage) return cfg.adminImage;
      } catch {}
    }

    // 2. Check device local storage cache for this member if previously stored
    if (typeof window !== 'undefined' && bdClean) {
      try {
        const stored = localStorage.getItem(`canteen_member_${bdClean}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.dp) return parsed.dp;
        }
      } catch {}
    }

    return '';
  };

  // Open Statement Modal
  const openStatement = (member: any) => {
    const effDp = getMemberEffectiveDp(member);
    const effDue = getMemberTotalDue(member, 'ALL');
    setStatementMember({ 
      ...member, 
      Due: effDue,
      due: effDue,
      baki: effDue,
      DP: effDp || member['DP'] || '' 
    });
    setStatementCategory('ALL');
    const runningMonth = getRunningMonthKey();
    setStatementMonth(selectedMonth !== 'ALL' ? selectedMonth : runningMonth);
    try {
      const local = (() => {
        try { return JSON.parse(localStorage.getItem('canteen_txs') || '[]'); } catch { return []; }
      })();
      const txMap = new Map<string, any>();
      (allTxs || []).forEach((t: any) => { if (t?.id) txMap.set(String(t.id), t); });
      local.forEach((t: any) => { if (t?.id) txMap.set(String(t.id), t); });
      const mergedTxs = deduplicateCanteenTransactions(Array.from(txMap.values()));
      const memberTxs = filterMemberTxs(member, mergedTxs);
      setStatementTx(memberTxs);
    } catch (e) {
      setStatementTx([]);
    }
  };

  // Open Profile Modal (Read-only view of member details and history)
  const openProfile = (member: any) => {
    const effDp = getMemberEffectiveDp(member);
    const fullMember = {
      ...member,
      DP: effDp || member['DP'] || ''
    };
    setProfileMember(fullMember);
    try {
      const local = (() => {
        try { return JSON.parse(localStorage.getItem('canteen_txs') || '[]'); } catch { return []; }
      })();
      const txMap = new Map<string, any>();
      (allTxs || []).forEach((t: any) => { if (t?.id) txMap.set(String(t.id), t); });
      local.forEach((t: any) => { if (t?.id) txMap.set(String(t.id), t); });
      const mergedTxs = deduplicateCanteenTransactions(Array.from(txMap.values()));
      const memberTxs = filterMemberTxs(member, mergedTxs);
      setProfileTx(memberTxs);
    } catch (e) {
      setProfileTx([]);
    }
  };

  // Build Aggregated Statement rows matching: দ্রব্যের নাম, পরিমাণ, দর, মোট
  const parseStatementAggregatedItems = (txs: any[]): StatementItemRow[] => {
    const itemMap = new Map<string, { itemName: string; qty: number; total: number; rates: number[] }>();

    // Deduplicate initial bills per month and category, keeping only the latest corrected amount
    const initialTxsByGroup = new Map<string, any>();
    const regularTxs: any[] = [];

    (txs || []).forEach((tx) => {
      if (!tx || tx.type === 'BILL PAYMENT' || tx.type === 'REVERTED' || tx.isReverted || tx.status === 'REVERTED' || String(tx.items || '').includes('[বাতিল')) return;

      const isInit = tx.type === 'INITIAL_BILL' || 
        tx.type === 'AMOUNT_CHANGE' ||
        tx.isAmountChange ||
        String(tx.id || '').startsWith('tx-init-') || 
        String(tx.id || '').startsWith('init-') || 
        String(tx.items || '').includes('ক্যান্টিন বিল') || 
        String(tx.items || '').includes('বকেয়া বিল') ||
        String(tx.items || '').includes('Changed amount from');

      if (isInit) {
        const mKey = tx.monthKey || getTxMonthKey(tx.date) || 'DEFAULT';
        const cKey = getTxCategory(tx);
        const groupKey = `${mKey}__${cKey}`;
        const existing = initialTxsByGroup.get(groupKey);
        if (!existing) {
          initialTxsByGroup.set(groupKey, tx);
        } else {
          const timeA = new Date(existing.created_at || existing.createdAt || existing.timestamp || 0).getTime() || 0;
          const timeB = new Date(tx.created_at || tx.createdAt || tx.timestamp || 0).getTime() || 0;
          if (timeB >= timeA) {
            initialTxsByGroup.set(groupKey, tx);
          }
        }
      } else {
        regularTxs.push(tx);
      }
    });

    const effectiveTxs = [...regularTxs, ...Array.from(initialTxsByGroup.values())];

    effectiveTxs.forEach((tx) => {
      if (tx.type === 'BILL PAYMENT') return;

      // Skip Unit Fund & Others Fund - they appear in dedicated statement summary rows
      const cat = getTxCategory(tx);
      if (cat === 'UNIT_FUND' || cat === 'OTHERS') return;

      const itemsStr = String(tx.items || '').trim();
      // Skip previous due initial bill - it is displayed in the বকেয়া বিল summary row
      if (itemsStr.includes('বকেয়া বিল')) return;

      // 1. If tx has structured soldItems array (from POS)
      if (Array.isArray(tx.soldItems) && tx.soldItems.length > 0) {
        tx.soldItems.forEach((si: any) => {
          const name = String(si.menuItemName || si.name || 'ক্যান্টিন খাদ্যদ্রব্য').trim();
          const qty = Number(si.qty || si.quantity || 1);
          let itemRate = Number(si.price || si.rate || 0);
          if (itemRate <= 0) {
            itemRate = lookupCatalogPrice(name, menuCatalog);
          }
          const itemTotal = itemRate > 0 ? itemRate * qty : (Number(tx.amount || 0) / (tx.soldItems.length || 1));

          if (!itemMap.has(name)) {
            itemMap.set(name, { itemName: name, qty: 0, total: 0, rates: [] });
          }
          const rec = itemMap.get(name)!;
          rec.qty += qty;
          rec.total += itemTotal;
          if (itemRate > 0) rec.rates.push(itemRate);
        });
        return;
      }

      // 2. Parse from tx.items string (e.g. "চা (2), সিঙ্গারা (1)" or "প্যাটিস")
      const fallbackStr = tx.items || 'ক্যান্টিন খরচ';
      const parts = String(fallbackStr).split(',').map((s) => s.trim()).filter(Boolean);

      if (parts.length === 1) {
        const match = parts[0].match(/^(.+?)\s*\(([0-9]+)\)$/);
        if (match) {
          const name = match[1].trim();
          const qty = parseInt(match[2], 10) || 1;
          const total = Number(tx.amount || 0);
          let rate = lookupCatalogPrice(name, menuCatalog);
          if (rate <= 0) {
            rate = qty > 0 ? Math.round((total / qty) * 100) / 100 : total;
          }
          const finalTotal = (rate > 0 && Math.abs(rate * qty - total) <= 2) ? rate * qty : total;

          if (!itemMap.has(name)) {
            itemMap.set(name, { itemName: name, qty: 0, total: 0, rates: [] });
          }
          const rec = itemMap.get(name)!;
          rec.qty += qty;
          rec.total += finalTotal;
          if (rate > 0) rec.rates.push(rate);
        } else {
          let name = parts[0].trim();
          if (name.includes('Changed amount') || tx.isAmountChange) {
            name = `ক্যান্টিন বিল (${formatBengaliMonthYear(tx.monthKey || statementMonth)})`;
          }
          const total = Number(tx.amount || 0);
          let rate = lookupCatalogPrice(name, menuCatalog);
          if (rate <= 0) rate = total;

          if (!itemMap.has(name)) {
            itemMap.set(name, { itemName: name, qty: 0, total: 0, rates: [] });
          }
          const rec = itemMap.get(name)!;
          rec.qty += 1;
          rec.total += total;
          rec.rates.push(rate > 0 ? rate : total);
        }
      } else if (parts.length > 1) {
        let parsed: { name: string; qty: number; rate: number }[] = [];
        parts.forEach((p) => {
          const match = p.match(/^(.+?)\s*\(([0-9]+)\)$/);
          if (match) {
            const q = parseInt(match[2], 10) || 1;
            const nm = match[1].trim();
            const r = lookupCatalogPrice(nm, menuCatalog);
            parsed.push({ name: nm, qty: q, rate: r });
          } else {
            const nm = p.trim();
            const r = lookupCatalogPrice(nm, menuCatalog);
            parsed.push({ name: nm, qty: 1, rate: r });
          }
        });

        const txAmount = Number(tx.amount || 0);
        parsed.forEach((item) => {
          let itemRate = item.rate;
          let subTotal = 0;
          if (itemRate > 0) {
            subTotal = itemRate * item.qty;
          } else {
            const totalQty = parsed.reduce((sum, p) => sum + p.qty, 0);
            itemRate = totalQty > 0 ? Math.round((txAmount / totalQty) * 100) / 100 : txAmount / parts.length;
            subTotal = Math.round(itemRate * item.qty * 100) / 100;
          }

          if (!itemMap.has(item.name)) {
            itemMap.set(item.name, { itemName: item.name, qty: 0, total: 0, rates: [] });
          }
          const rec = itemMap.get(item.name)!;
          rec.qty += item.qty;
          rec.total += subTotal;
          if (itemRate > 0) rec.rates.push(itemRate);
        });
      } else {
        const name = itemsStr.trim();
        const total = Number(tx.amount || 0);
        let rate = lookupCatalogPrice(name, menuCatalog);
        if (rate <= 0) rate = total;

        if (!itemMap.has(name)) {
          itemMap.set(name, { itemName: name, qty: 0, total: 0, rates: [] });
        }
        const rec = itemMap.get(name)!;
        rec.qty += 1;
        rec.total += total;
        rec.rates.push(rate > 0 ? rate : total);
      }
    });

    const rows: StatementItemRow[] = [];
    itemMap.forEach((val) => {
      const safeQty = val.qty > 0 ? val.qty : 1;
      // 1. Direct catalog lookup for accurate unit price (দর)
      let finalRate = lookupCatalogPrice(val.itemName, menuCatalog);

      // 2. If not found in catalog, check recorded rates from transactions
      if (finalRate <= 0 && val.rates.length > 0) {
        finalRate = Math.round(val.rates[0] * 100) / 100;
      }

      // 3. Fallback to unit cost
      if (finalRate <= 0 && safeQty > 0) {
        finalRate = Math.round((val.total / safeQty) * 100) / 100;
      }

      if (finalRate <= 0 && val.total > 0) {
        finalRate = val.total;
      }

      // Calculate accurate total (পরিমাণ × দর)
      const calculatedTotal = (finalRate > 0 && safeQty > 0)
        ? Math.round(finalRate * safeQty * 100) / 100
        : Math.round(val.total * 100) / 100;

      rows.push({
        itemName: val.itemName,
        qty: safeQty,
        rate: finalRate > 0 ? finalRate : Math.round(calculatedTotal / safeQty),
        total: calculatedTotal
      });
    });

    return rows.sort((a, b) => b.total - a.total);
  };

  // Build Statement rows matching legacy breakdown if needed
  const parseStatementRows = (txs: any[]): StatementRow[] => {
    const rows: StatementRow[] = [];
    let sl = 1;

    txs.forEach((tx) => {
      const txDate = toEnglishDate(tx.date);

      if (tx.type === 'BILL PAYMENT') {
        rows.push({
          sl: sl++,
          date: txDate,
          item: `বিল পরিশোধ (${tx.gateway || 'CASH'})`,
          qty: '-',
          rate: '-',
          total: -(tx.amount || 0)
        });
        return;
      }

      const itemsStr = tx.items || 'ক্যান্টিন খরচ';
      const parts = itemsStr.split(',').map((s: string) => s.trim()).filter(Boolean);

      if (parts.length === 1) {
        const match = parts[0].match(/^(.+?)\s*\(([0-9]+)\)$/);
        if (match) {
          const itemName = match[1].trim();
          const qty = parseInt(match[2], 10) || 1;
          const total = Number(tx.amount || 0);
          let rate = lookupCatalogPrice(itemName, menuCatalog);
          if (rate <= 0) {
            rate = qty > 0 ? Math.round((total / qty) * 100) / 100 : total;
          }
          const finalTotal = (rate > 0 && Math.abs(rate * qty - total) <= 2) ? rate * qty : total;
          rows.push({
            sl: sl++,
            date: txDate,
            item: itemName,
            qty: qty,
            rate: rate,
            total: finalTotal
          });
        } else {
          const name = parts[0];
          const total = Number(tx.amount || 0);
          let rate = lookupCatalogPrice(name, menuCatalog);
          if (rate <= 0) rate = total;
          rows.push({
            sl: sl++,
            date: txDate,
            item: name,
            qty: 1,
            rate: rate,
            total: total
          });
        }
      } else if (parts.length > 1) {
        let totalQty = 0;
        parts.forEach((p: string) => {
          const match = p.match(/^(.+?)\s*\(([0-9]+)\)$/);
          if (match) {
            totalQty += parseInt(match[2], 10) || 1;
          } else {
            totalQty += 1;
          }
        });

        const total = Number(tx.amount || 0);
        rows.push({
          sl: sl++,
          date: txDate,
          item: itemsStr,
          qty: totalQty || '-',
          rate: totalQty > 0 ? Math.round((total / totalQty) * 100) / 100 : '-',
          total: total
        });
      } else {
        const total = Number(tx.amount || 0);
        rows.push({
          sl: sl++,
          date: txDate,
          item: itemsStr,
          qty: 1,
          rate: total,
          total: total
        });
      }
    });

    return rows;
  };

  // 1. Share statement picture directly to WhatsApp (Via Web Share with picture attached)
  const handleShareWhatsAppImage = async (
    member: any, 
    items: StatementItemRow[], 
    totalDue: number, 
    totalMonthBill: number, 
    previousDue: number,
    unitFundBill: number = 0,
    othersFundBill: number = 0,
    monthKey: string = 'ALL'
  ) => {
    const rank = getMemberBanglaRank(member) || formatRankBn(member.Rank || member.rank || '');
    const surname = getMemberBanglaName(member) || formatMemberNameBn(member.Surname || member.surname || '');
    const fileName = `ক্যাফে_ইউএভি_${rank}_${surname}_বিল.png`;

    let file = statementImageFile;
    let blob = statementImageBlob;

    if (!file || !blob) {
      try {
        blob = await generateStatementCanvasBlob({
          statementMonth: monthKey,
          statementMember: member,
          items,
          totalMonthBill,
          previousDue,
          unitFundBill,
          othersFundBill,
          effectivePayments,
          netPayable: totalDue,
          rankBn: rank,
          nameBn: surname
        });
        if (blob) {
          file = new File([blob], fileName, { type: 'image/png' });
          setStatementImageBlob(blob);
          setStatementImageFile(file);
        }
      } catch (e) {
        console.warn('Canvas generator note:', e);
      }
    }

    // Copy member name/contact to clipboard so user can quickly paste in WhatsApp search
    const contact = (member.Contact || member.contact || member['Mobile No'] || '').trim();
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(contact || `${rank} ${surname}`);
      } catch {}
    }

    const { message: shareText } = buildWhatsAppBillMessage({
      member,
      totalDue,
      monthKey,
      managerName: canteenConfig?.managerName || 'LAC Nishad',
      managerBdNo: canteenConfig?.managerBdNo,
      rankBn: rank,
      nameBn: surname
    });

    // Mobile Web Share API - Sends the actual Statement Picture directly to WhatsApp!
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `ক্যাফে ইউএভি - ${rank} ${surname}`,
          text: shareText
        });
        return;
      } catch (shareErr: any) {
        if (shareErr.name === 'AbortError') return;
        console.warn('Share error fallback:', shareErr);
      }
    }

    // Fallback if Web Share is not supported
    if (blob) {
      downloadStatementBlob(blob, fileName);
    }
    const cleanPhone = contact.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('01') ? '88' + cleanPhone : cleanPhone;
    window.open(fullPhone ? `https://wa.me/${fullPhone}` : `https://wa.me/`, '_blank');
  };

  // 2. Direct WhatsApp chat to specific member with pre-filled bill text & picture copied/saved
  const handleDirectWhatsAppChat = async (
    member: any, 
    items: StatementItemRow[], 
    totalDue: number, 
    totalMonthBill: number, 
    previousDue: number,
    unitFundBill: number = 0,
    othersFundBill: number = 0,
    monthKey: string = 'ALL'
  ) => {
    const rank = getMemberBanglaRank(member) || formatRankBn(member.Rank || member.rank || '');
    const surname = getMemberBanglaName(member) || formatMemberNameBn(member.Surname || member.surname || '');
    const fileName = `ক্যাফে_ইউএভি_${rank}_${surname}_বিল.png`;

    let contact = (member.Contact || member.contact || member['Mobile No'] || '').trim();
    if (!contact) {
      contact = prompt(`"${rank} ${surname}" এর WhatsApp মোবাইল নম্বর লিখুন (e.g. 017XXXXXXXX):`) || '';
    }
    let phone = contact.replace(/\D/g, '');
    if (phone.startsWith('01') && phone.length === 11) {
      phone = '88' + phone;
    } else if (phone.length === 10 && phone.startsWith('1')) {
      phone = '880' + phone;
    }

    // 1. Ensure Statement Picture is generated and ready
    let blob = statementImageBlob;
    let file = statementImageFile;
    if (!blob) {
      try {
        blob = await generateStatementCanvasBlob({
          statementMonth: monthKey,
          statementMember: member,
          items,
          totalMonthBill,
          previousDue,
          unitFundBill,
          othersFundBill,
          effectivePayments,
          netPayable: totalDue,
          rankBn: rank,
          nameBn: surname
        });
        if (blob) {
          setStatementImageBlob(blob);
          file = new File([blob], fileName, { type: 'image/png' });
          setStatementImageFile(file);
        }
      } catch (err) {
        console.warn('Canvas generator note:', err);
      }
    }

    // 2. Save image to device gallery & copy to clipboard for instant 1-tap paste
    if (blob) {
      downloadStatementBlob(blob, fileName);
      if (navigator.clipboard && (window as any).ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
        } catch (clipErr) {
          console.warn('Clipboard write note:', clipErr);
        }
      }
    }

    // 3. Build WhatsApp message using the configurable Senior / Junior template
    const { message: msg, isSenior } = buildWhatsAppBillMessage({
      member,
      totalDue,
      monthKey,
      managerName: canteenConfig?.managerName || 'LAC Nishad',
      managerBdNo: canteenConfig?.managerBdNo,
      rankBn: rank,
      nameBn: surname
    });

    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
      setWhatsAppNotice(`✅ ${rank} ${surname} (${isSenior ? 'সিনিয়র স্যার' : 'মেম্বার'}) এর চ্যাটে বিল ওপেন হয়েছে! স্লিপের ছবি গ্যালারিতে সেভ ও কপি হয়েছে। চ্যাটে 📎 (Gallery) বা Paste থেকে ছবিটি সেন্ড করুন।`);
      setTimeout(() => setWhatsAppNotice(null), 6000);
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  // Pay bill execution
  const handleSettleAccount = async () => {
    if (!payBillMember) return;
    if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) return;

    setIsSubmittingPayment(true);
    try {
      const amount = Number(payAmount);
      const totalDueBefore = getMemberTotalDue(payBillMember, 'ALL');
      const newDue = Math.max(0, totalDueBefore - amount);
      
      // Update Supabase Canteen table 'Due' column
      await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', payBillMember.airman_id);
      
      const isCash = String(payMethod).toUpperCase() === 'CASH';
      const gatewayFormatted = isCash ? 'Cash' : 'UCB';
      const paymentItemDesc = `Bill Payment - ${gatewayFormatted}`;
      const catLabel = payBillCategory === 'ALL' ? 'ALL BILLS' : payBillCategory.replace('_', ' ');
      const payeeName = `${payBillMember.Rank || payBillMember.rank || ''} ${payBillMember.Surname || payBillMember['Surname'] || payBillMember.name || ''}`.trim();

      const now = new Date();
      const paymentMonthCycle = getPaymentCycleMonthKey(now);

      const tx = {
        id: 'tx-pay-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        date: formatCanteenDate(now),
        created_at: now.toISOString(),
        createdAt: now.toISOString(),
        timestamp: now.getTime(),
        monthKey: paymentMonthCycle,
        airman_id: payBillMember.airman_id,
        bdNo: payBillMember['BD No'] || payBillMember.airman_id,
        memberName: payeeName,
        rank: payBillMember.Rank || payBillMember.rank || '',
        items: paymentItemDesc,
        amount: amount,
        type: 'BILL PAYMENT',
        billType: payBillCategory,
        gateway: isCash ? 'CASH' : 'UCB'
      };

      const rawStored = localStorage.getItem('canteen_txs');
      let txs = rawStored ? JSON.parse(rawStored) : [];

      const updatedTxs = [tx, ...txs];
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
      setAllTxs(updatedTxs);
      await pushKeyToCloud('canteen_txs', updatedTxs);
      
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('baf_state_updated'));
      window.dispatchEvent(new Event('storage'));
      
      const updatedMember = { ...payBillMember, Due: newDue, baki: newDue };
      
      // Play celebratory harmonic chime
      playPaymentSuccessSound();

      // Activate dynamic confirmation animation
      setPaymentSuccessData({
        memberName: payeeName,
        rank: payBillMember.Rank || payBillMember.rank || '',
        surname: payBillMember.Surname || payBillMember['Surname'] || payBillMember.name || '',
        bdNo: String(payBillMember['BD No'] || payBillMember.airman_id || '').replace(/\D/g, ''),
        dp: resolveImageUrl(payBillMember.DP),
        paidAmount: amount,
        previousDue: totalDueBefore,
        newDue: newDue,
        method: isCash ? 'CASH' : 'UCB',
        category: catLabel,
        txId: tx.id,
        date: tx.date,
        breakdownNote: paymentItemDesc
      });

      setPayBillMember(null);
      setPayAmount('');
      setMembers(prev => prev.map(m => m.airman_id === updatedMember.airman_id ? updatedMember : m));
      
      if (globalMembersCache) {
        globalMembersCache = globalMembersCache.map((m: any) => m.airman_id === updatedMember.airman_id ? updatedMember : m);
        try { localStorage.setItem('canteen_members_cache', JSON.stringify(globalMembersCache)); } catch {}
      }

      if (profileMember && profileMember.airman_id === updatedMember.airman_id) {
        setProfileMember(updatedMember);
        setProfileTx(filterMemberTxs(updatedMember, updatedTxs));
      }
      if (statementMember && statementMember.airman_id === updatedMember.airman_id) {
        setStatementMember(updatedMember);
        setStatementTx(filterMemberTxs(updatedMember, updatedTxs));
      }
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // Remove history transaction (reversing due automatically)
  const handleRemoveTx = async (txToRemove: any, explicitMember?: any) => {
    if (!txToRemove) return;
    const targetMember = explicitMember || profileMember || statementMember || members.find((m: any) => {
      const txBdClean = String(txToRemove.bdNo || txToRemove.airman_id || '').replace(/\D/g, '');
      const mBdClean = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
      return (txToRemove.airman_id && m.airman_id === txToRemove.airman_id) || (txBdClean && mBdClean === txBdClean);
    });
    if (!targetMember) {
      setTxDeleteConfirmId(null);
      return;
    }

    const amountToReverse = Number(txToRemove.amount || 0);
    const currentDue = Number(targetMember.Due ?? targetMember.due ?? targetMember.baki ?? 0);
    let newDue = currentDue;
    
    if (txToRemove.type === 'BILL PAYMENT') {
      newDue = currentDue + amountToReverse;
    } else {
      newDue = Math.max(0, currentDue - amountToReverse);
    }
    
    // 1. Update Supabase Canteen_Member table
    try {
      if (targetMember.airman_id) {
        await supabase
          .from('Canteen_Member')
          .update({ Due: newDue })
          .eq('airman_id', targetMember.airman_id);
      }
      if (targetMember['BD No']) {
        await supabase
          .from('Canteen_Member')
          .update({ Due: newDue })
          .eq('BD No', String(targetMember['BD No']).trim());
      }
    } catch (e) {
      console.warn('Error updating member Due in Supabase on remove tx:', e);
    }

    // 1b. Restore raw stock back to inventory if this was a sale/item order
    if (txToRemove.type !== 'BILL PAYMENT') {
      const itemsToRestore: Array<{ menuItemId?: string; menuItemName: string; qty: number }> = [];

      if (txToRemove.soldItems && Array.isArray(txToRemove.soldItems) && txToRemove.soldItems.length > 0) {
        for (const item of txToRemove.soldItems) {
          const qty = Number(item.qty || item.quantity) || 0;
          if (qty > 0) {
            itemsToRestore.push({
              menuItemId: item.menuItemId || item.id,
              menuItemName: item.menuItemName || item.name || '',
              qty
            });
          }
        }
      } else if (txToRemove.items) {
        const itemsArray = String(txToRemove.items).split(/[,+;|\n]+/).map((s: string) => s.trim()).filter(Boolean);
        for (const itemStr of itemsArray) {
          const parenMatch = itemStr.match(/^(.+?)\s*\(\s*(\d+)\s*\)$/);
          const xMatchEnd = itemStr.match(/^(.+?)\s*[xX*]\s*(\d+)$/);
          const xMatchStart = itemStr.match(/^(\d+)\s*[xX*]\s*(.+)$/);
          const colonMatch = itemStr.match(/^(.+?)\s*[:\-]\s*(\d+)$/);

          if (parenMatch) {
            itemsToRestore.push({ menuItemName: parenMatch[1].trim(), qty: parseInt(parenMatch[2], 10) });
          } else if (xMatchEnd) {
            itemsToRestore.push({ menuItemName: xMatchEnd[1].trim(), qty: parseInt(xMatchEnd[2], 10) });
          } else if (xMatchStart) {
            itemsToRestore.push({ menuItemName: xMatchStart[2].trim(), qty: parseInt(xMatchStart[1], 10) });
          } else if (colonMatch) {
            itemsToRestore.push({ menuItemName: colonMatch[1].trim(), qty: parseInt(colonMatch[2], 10) });
          } else {
            itemsToRestore.push({ menuItemName: itemStr.trim(), qty: 1 });
          }
        }
      }

      if (itemsToRestore.length > 0) {
        try {
          restoreRawStockForSaleCancellation(itemsToRestore, {
            id: txToRemove.id,
            memberName: targetMember ? `${targetMember['Rank'] || ''} ${targetMember['Surname'] || ''}` : '',
            date: txToRemove.date
          });
          window.dispatchEvent(new Event('canteen_raw_inventory_updated'));
          window.dispatchEvent(new Event('canteen_inventory_updated'));
        } catch (err) {
          console.warn('Failed to restore raw stock in MemberDB handleRemoveTx:', err);
        }
      }
    }
    
    // 2. Handle transaction in localStorage and Supabase app_settings cloud sync
    const txIdStr = String(txToRemove.id);
    let newTxs: any[] = [];
    try {
      // Record deleted ID permanently so cloud sync never resurrects it
      recordDeletedTxId(txIdStr);

      const rawTxs = localStorage.getItem('canteen_txs');
      const txs = rawTxs ? JSON.parse(rawTxs) : [];
      // Completely remove the transaction from list and cloud
      newTxs = txs.filter((t: any) => String(t.id) !== txIdStr);
      localStorage.setItem('canteen_txs', JSON.stringify(newTxs));
      await pushKeyToCloud('canteen_txs', newTxs);
    } catch (e) {
      console.warn('Error updating canteen_txs on remove tx:', e);
    }

    // 3. Update allTxs React state so all calculations and cards recompute immediately
    setAllTxs(newTxs);
    
    // 4. Update member object in all states and local cache
    const updatedMember = { 
      ...targetMember, 
      Due: newDue, 
      due: newDue, 
      baki: newDue 
    };

    setMembers(prev => {
      const next = prev.map(m => 
        (m.airman_id === updatedMember.airman_id || (m['BD No'] && m['BD No'] === updatedMember['BD No'])) 
          ? updatedMember 
          : m
      );
      try {
        localStorage.setItem('canteen_members_cache', JSON.stringify(next));
      } catch {}
      return next;
    });
    
    if (profileMember) {
      setProfileMember(updatedMember);
      setProfileTx(prev => prev.filter(t => String(t.id) !== txIdStr));
    }

    if (statementMember) {
      setStatementMember(updatedMember);
      setStatementTx(prev => prev.filter(t => String(t.id) !== txIdStr));
    }

    // Update individual member local cache
    const cleanBd = String(targetMember['BD No'] || targetMember.airman_id || '').replace(/\D/g, '').toLowerCase();
    if (cleanBd) {
      try {
        const rawStored = localStorage.getItem(`canteen_member_${cleanBd}`);
        const stored = rawStored ? JSON.parse(rawStored) : {};
        localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({ ...stored, Due: newDue, due: newDue, baki: newDue }));
      } catch {}
    }

    // 5. Notify all listeners
    window.dispatchEvent(new Event('canteen_txs_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));

    // 6. Play dynamic audio feedback and show animated notification banner
    playTrashPopSound();
    setDeletedTxNotice({
      description: txToRemove.items || txToRemove.description || 'রেকর্ড',
      amount: amountToReverse,
      type: txToRemove.type || 'RECORD',
      date: txToRemove.date || ''
    });
    setDuePulseKey(prev => prev + 1);
    setTimeout(() => {
      setDeletedTxNotice(null);
    }, 4500);

    setTxDeleteConfirmId(null);
  };

  const handleConfirmDeletePayment = async () => {
    if (!paymentToDelete) return;
    setIsDeletingPayment(true);
    try {
      const targetMember = members.find((m: any) => {
        const txBdClean = String(paymentToDelete.bdNo || paymentToDelete.airman_id || '').replace(/\D/g, '');
        const mBdClean = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
        return (paymentToDelete.airman_id && m.airman_id === paymentToDelete.airman_id) || (txBdClean && mBdClean === txBdClean);
      });

      await handleRemoveTx(paymentToDelete, targetMember);

      const memName = targetMember ? `${targetMember.Rank || targetMember.rank || ''} ${targetMember.Surname || targetMember.surname || ''}`.trim() : (paymentToDelete.memberName || 'সদস্য');
      setPaymentDeleteSuccessMsg(`৳${Number(paymentToDelete.amount || 0).toLocaleString()} টাকার পেমেন্ট বাতিল করা হয়েছে এবং ${memName}-এর বকেয়া আগের অবস্থায় ফিরিয়ে দেওয়া হয়েছে।`);
      setPaymentToDelete(null);
      setTimeout(() => setPaymentDeleteSuccessMsg(null), 5000);
    } catch (err) {
      console.warn('Error deleting payment:', err);
    } finally {
      setIsDeletingPayment(false);
    }
  };

  // Helper to format, deduplicate, and sort members by rank seniority
  const formatAndSortMembers = (data: any[]) => {
    const seen = new Set<string>();
    const uniqueList: any[] = [];

    for (const m of data) {
      if (!m) continue;
      const cleanBd = String(m['BD No'] || m.bdNo || '').replace(/\D/g, '');
      const airmanId = String(m.airman_id || '').trim().toLowerCase();
      if (cleanBd === '48456') continue;

      const primaryKey = (cleanBd && cleanBd !== '0') ? `bd_${cleanBd}` : (airmanId ? `airman_${airmanId}` : `name_${String(m.Rank || '').trim()}_${String(m.Surname || '').trim()}`);

      const existingIdx = uniqueList.findIndex((item) => {
        const iBd = String(item['BD No'] || item.bdNo || '').replace(/\D/g, '');
        const iAirman = String(item.airman_id || '').trim().toLowerCase();
        if (cleanBd && iBd && cleanBd === iBd) return true;
        if (airmanId && iAirman && airmanId === iAirman) return true;
        return false;
      });

      if (existingIdx >= 0) {
        const existing = uniqueList[existingIdx];
        if (m.Due !== undefined && m.Due !== null) {
          existing.Due = Number(m.Due);
          existing.due = Number(m.Due);
          existing.baki = Number(m.Due);
        }
        if (m.Advance !== undefined && m.Advance !== null) {
          existing.Advance = Number(m.Advance);
          existing.advance = Number(m.Advance);
          existing.ogrim = Number(m.Advance);
        }
        if (!existing['Rank'] && m['Rank']) existing['Rank'] = m['Rank'];
        if (!existing['Surname'] && m['Surname']) existing['Surname'] = m['Surname'];
        if (!existing['Contact'] && (m['Contact'] || m['Mobile No'])) existing['Contact'] = m['Contact'] || m['Mobile No'];
        continue;
      }

      if (seen.has(primaryKey)) continue;
      if (cleanBd && seen.has(`bd_${cleanBd}`)) continue;
      if (airmanId && seen.has(`airman_${airmanId}`)) continue;

      seen.add(primaryKey);
      if (cleanBd) seen.add(`bd_${cleanBd}`);
      if (airmanId) seen.add(`airman_${airmanId}`);

      const effectiveDp = getMemberEffectiveDp(m);
      uniqueList.push({
        ...m,
        Role: m.Role ?? m.role ?? 'Member',
        role: m.Role ?? m.role ?? 'Member',
        Due: Number(m.Due ?? m.due ?? m.baki ?? 0),
        baki: Number(m.Due ?? m.due ?? m.baki ?? 0),
        DP: effectiveDp || m.DP || ''
      });
    }

    // Sort strictly by Office Nominal Roll Seniority & BAF Hierarchy
    return sortCanteenMembersByOfficeSeniority(uniqueList);
  };

  // Auto-sync Biodata silently in background ONLY if Canteen_Member is completely empty
  const autoSyncBiodata = async () => {
    try {
      const { data: biodata } = await supabase.from('Biodata Register').select('*');
      if (biodata && biodata.length > 0) {
        const { data: existingCanteen } = await supabase.from('Canteen_Member').select('airman_id, Due, DP, Role');
        const existingDueMap = new Map();
        const existingDpMap = new Map();
        const existingRoleMap = new Map();
        if (existingCanteen) {
          existingCanteen.forEach((m: any) => {
            existingDueMap.set(m.airman_id, Number(m.Due ?? m.due ?? m.baki ?? 0));
            existingDpMap.set(m.airman_id, m.DP || null);
            existingRoleMap.set(m.airman_id, m.Role || 'Member');
          });
        }

        const payload = biodata
          .filter((b: any) => b.airman_id && String(b['BD No'] || '').replace(/\D/g, '') !== '48456')
          .map((b: any) => {
            const currentDp = existingDpMap.get(b.airman_id) || getMemberEffectiveDp(b) || null;
            return {
              airman_id: b.airman_id,
              "BD No": b['BD No'] || '',
              "Rank": b['Rank'] || '',
              "Surname": b['Surname'] || '',
              "Contact": b['Mobile No'] || '',
              Due: existingDueMap.has(b.airman_id) ? existingDueMap.get(b.airman_id) : 0,
              DP: currentDp,
              Role: existingRoleMap.get(b.airman_id) || 'Member'
            };
          });

        await supabase.from('Canteen_Member').upsert(payload, { onConflict: 'airman_id' });
        
        // Refresh after background upsert
        const { data: refreshed } = await supabase.from('Canteen_Member').select('*');
        if (refreshed && refreshed.length > 0) {
          const sorted = formatAndSortMembers(refreshed);
          globalMembersCache = sorted;
          setMembers(sorted);
          try {
            localStorage.setItem('canteen_members_cache', JSON.stringify(sorted));
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Auto-sync biodata silent note:', err);
    }
  };

  // Smart Delta-Sync: Check if cloud data matches local data.
  // ONLY download/update the exact items that changed in the cloud; keep everything else completely intact!
  const fetchMembers = async (forceSync = false) => {
    // If local cache is present and we synced recently (< 45s), avoid unnecessary queries
    const now = Date.now();
    if (!forceSync && globalMembersCache && globalMembersCache.length > 0 && (now - lastMembersSyncTimestamp < 45000)) {
      return;
    }

    try {
      const cloudData = await fetchCanteenMembersOnce(forceSync);
      if (!cloudData) return;

      lastMembersSyncTimestamp = Date.now();

      if (cloudData.length === 0) {
        if (!globalMembersCache || globalMembersCache.length === 0) {
          await autoSyncBiodata();
        }
        return;
      }

      setMembers((prevMembers) => {
        const baseList = prevMembers && prevMembers.length > 0 ? prevMembers : (globalMembersCache || []);
        
        if (!baseList || baseList.length === 0) {
          const sorted = formatAndSortMembers(cloudData);
          globalMembersCache = sorted;
          try {
            localStorage.setItem('canteen_members_cache', JSON.stringify(sorted));
          } catch {}
          return sorted;
        }

        const localMap = new Map<string, any>();
        baseList.forEach((m) => {
          const key = String(m.airman_id || m['BD No'] || '').trim();
          if (key) localMap.set(key, m);
        });

        let hasAnyDifference = false;
        const updatedList: any[] = [];

        for (const cloudM of cloudData) {
          const key = String(cloudM.airman_id || cloudM['BD No'] || '').trim();
          if (!key) continue;
          const bdClean = String(cloudM['BD No'] || cloudM.airman_id || '').replace(/\D/g, '');
          if (bdClean === '48456') continue;

          const localM = localMap.get(key);

          if (!localM) {
            // New member found in cloud
            hasAnyDifference = true;
            const effectiveDp = getMemberEffectiveDp(cloudM);
            updatedList.push({
              ...cloudM,
              Role: cloudM.Role ?? cloudM.role ?? 'Member',
              role: cloudM.Role ?? cloudM.role ?? 'Member',
              Due: Number(cloudM.Due ?? cloudM.due ?? cloudM.baki ?? 0),
              baki: Number(cloudM.Due ?? cloudM.due ?? cloudM.baki ?? 0),
              DP: effectiveDp || cloudM.DP || ''
            });
          } else {
            // Compare each field to see if anything changed
            const cloudDue = Number(cloudM.Due ?? cloudM.due ?? cloudM.baki ?? 0);
            const localDue = Number(localM.Due ?? localM.due ?? localM.baki ?? 0);
            const cloudDp = String(cloudM.DP || '').trim();
            const localDp = String(localM.DP || '').trim();
            const cloudRole = String(cloudM.Role ?? cloudM.role ?? '').trim();
            const localRole = String(localM.Role ?? localM.role ?? '').trim();
            const cloudRank = String(cloudM.Rank || '').trim();
            const localRank = String(localM.Rank || '').trim();
            const cloudSurname = String(cloudM.Surname || '').trim();
            const localSurname = String(localM.Surname || '').trim();
            const cloudContact = String(cloudM.Contact || cloudM['Mobile No'] || '').trim();
            const localContact = String(localM.Contact || localM['Mobile No'] || '').trim();

            const isDueDiff = Math.abs(cloudDue - localDue) > 0.01;
            const isDpDiff = Boolean(cloudDp && cloudDp !== localDp);
            const isRoleDiff = cloudRole !== localRole;
            const isRankDiff = cloudRank !== localRank;
            const isNameDiff = cloudSurname !== localSurname;
            const isContactDiff = cloudContact !== localContact;

            if (isDueDiff || isDpDiff || isRoleDiff || isRankDiff || isNameDiff || isContactDiff) {
              hasAnyDifference = true;
              // Only update the changed member, preserving unchanged local fields
              const effectiveDp = isDpDiff ? cloudDp : (localM.DP || getMemberEffectiveDp(cloudM));
              updatedList.push({
                ...localM,
                ...cloudM,
                Contact: cloudContact || localContact || '',
                Role: cloudRole || localM.Role,
                role: cloudRole || localM.Role,
                Due: cloudDue,
                baki: cloudDue,
                DP: effectiveDp || localM.DP || ''
              });
            } else {
              // EXACT SAME OBJECT REFERENCE!
              // React will NOT re-render this member card or re-download its image!
              updatedList.push(localM);
            }
          }
        }

        if (updatedList.length !== baseList.length) {
          hasAnyDifference = true;
        }

        // If Cloud matches App data: Zero re-renders, zero photo re-downloads!
        if (!hasAnyDifference) {
          return baseList;
        }

        // Only sort and persist when there is an actual delta change
        const sorted = sortCanteenMembersByOfficeSeniority(updatedList);
        globalMembersCache = sorted;
        try {
          localStorage.setItem('canteen_members_cache', JSON.stringify(sorted));
        } catch {}
        return sorted;
      });
    } catch (err) {
      console.warn('Smart delta sync note:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Initial check (lightweight delta sync)
    fetchMembers(false);

    // 2. Safety timeout
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    // 3. Subscribe to realtime updates on Canteen_Member table (debounced delta sync)
    let debounceTimer: any = null;
    const channelName = `canteen_members_realtime_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen_Member' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchMembers(true);
        }, 1200);
      })
      .subscribe();

    return () => {
      clearTimeout(safetyTimer);
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredMembers = members.filter(m => {
    // Top Overall / Officer / Airmen / Civilian Filter
    if (rankTypeFilter === 'OFFICER' && !isOfficerMember(m)) return false;
    if (rankTypeFilter === 'AIRMEN' && !isAirmanMember(m)) return false;
    if (rankTypeFilter === 'CIVILIAN' && !isCivilianMember(m)) return false;

    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase().trim();
    const bdNo = String(m['BD No'] || '').toLowerCase();
    const rank = String(m['Rank'] || '').toLowerCase();
    const rankBn = (getMemberBanglaRank(m) || formatRankBn(m['Rank'])).toLowerCase();
    const surname = String(m['Surname'] || '').toLowerCase();
    const role = String(m['Role'] || '').toLowerCase();
    const bnName = (getMemberBanglaName(m) || formatMemberNameBn(m['Surname'])).toLowerCase();
    const contact = String(m['Contact'] || m['Mobile No'] || '').toLowerCase();

    // 1. Text field search matching (BD No, Rank, Bangla Rank, Surname, Bangla Name, Role, Contact)
    if (
      bdNo.includes(term) ||
      rank.includes(term) ||
      rankBn.includes(term) ||
      surname.includes(term) ||
      role.includes(term) ||
      bnName.includes(term) ||
      contact.includes(term)
    ) {
      return true;
    }

    // 2. Bill / Total Due amount search matching (e.g. searching '123' finds member with 123 due, also supports '৳123' and Bengali '১২৩')
    const normalizedDigits = term.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
    const cleanNum = normalizedDigits.replace(/[^0-9.]/g, '');

    if (cleanNum.length > 0) {
      const totalDueCurrent = getMemberTotalDue(m, selectedCategory);
      const totalDueAll = getMemberTotalDue(m, 'ALL');
      const monthBill = getMemberFilteredBill(m, selectedCategory, selectedMonth);
      const rawProfileDue = Number(m.Due ?? m.due ?? m.baki ?? 0);

      const billCandidates = [
        totalDueCurrent,
        Math.round(totalDueCurrent),
        totalDueAll,
        Math.round(totalDueAll),
        monthBill,
        Math.round(monthBill),
        rawProfileDue,
        Math.round(rawProfileDue),
      ];

      const matchesBillNumber = billCandidates.some((val) => {
        const valStr = String(val);
        if (cleanNum === '0') {
          return val === 0;
        }
        return valStr === cleanNum || valStr.includes(cleanNum);
      });

      if (matchesBillNumber) return true;
    }

    return false;
  });

  // Summary statistics for active filter
  const { totalFilteredBill, countWithBills } = useMemo(() => {
    let sum = 0;
    let count = 0;
    filteredMembers.forEach((m) => {
      const b = getMemberFilteredBill(m, selectedCategory, selectedMonth);
      const totalDue = getMemberTotalDue(m, selectedCategory);
      const hasDueInScope = selectedMonth === 'ALL' ? totalDue > 0 : b > 0;
      if (hasDueInScope) {
        sum += b;
        count++;
      }
    });
    return { totalFilteredBill: sum, countWithBills: count };
  }, [filteredMembers, selectedCategory, selectedMonth, allTxs]);

  // When selectedMonth or selectedCategory changes, reset filterMode to AUTO
  // so that if the new month has no due, 'ALL' is automatically selected; if it has due, 'DUE' is selected
  useEffect(() => {
    setFilterMode('AUTO');
  }, [selectedMonth, selectedCategory]);

  // Determine if Due filter is active:
  // Default is AUTO: filters by Due if countWithBills > 0, otherwise shows All if Due is 0.
  const isDueFilterActive = useMemo(() => {
    if (filterMode === 'DUE') return true;
    if (filterMode === 'ALL') return false;
    return countWithBills > 0;
  }, [filterMode, countWithBills]);

  const displayedMemberList = useMemo(() => {
    // When user types in search bar, do not suppress members with 0 current-month bill so their search always returns the matched members
    const isSearching = searchTerm.trim().length > 0;
    const list = (!isDueFilterActive || isSearching) ? filteredMembers : filteredMembers.filter((m) => {
      const b = getMemberFilteredBill(m, selectedCategory, selectedMonth);
      const totalDue = getMemberTotalDue(m, selectedCategory);
      return selectedMonth === 'ALL' ? totalDue > 0 : b > 0;
    });
    return sortCanteenMembersByOfficeSeniority(list);
  }, [filteredMembers, isDueFilterActive, selectedCategory, selectedMonth, allTxs, searchTerm]);

  const handleExportBills = () => {
    setIsPrintModalOpen(true);
  };

  // Statement rows calculation for Statement modal
  const filteredStatementTxs = useMemo(() => {
    return statementTx.filter((tx) => {
      const txMonth = tx?.monthKey || getTxMonthKey(tx.date);
      return statementMonth === 'ALL' || txMonth === statementMonth;
    });
  }, [statementTx, statementMonth]);

  const statementAggregatedItems = useMemo(() => {
    return parseStatementAggregatedItems(filteredStatementTxs);
  }, [filteredStatementTxs, menuCatalog]);

  const totalMonthBill = useMemo(() => {
    const itemTotal = statementAggregatedItems.reduce((sum, r) => sum + r.total, 0);
    if (itemTotal > 0) return itemTotal;
    if (statementMember) {
      const filtered = getMemberFilteredBill(statementMember, 'ALL', statementMonth);
      if (filtered > 0) return filtered;
      const totalDue = getMemberTotalDue(statementMember, 'ALL');
      if (totalDue > 0) return totalDue;
    }
    return 0;
  }, [statementAggregatedItems, statementMember, statementMonth, allTxs]);

  const unitFundBill = useMemo(() => {
    return filteredStatementTxs
      .filter((tx) => getTxCategory(tx) === 'UNIT_FUND' && tx.type !== 'BILL PAYMENT')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [filteredStatementTxs]);

  const othersFundBill = useMemo(() => {
    return filteredStatementTxs
      .filter((tx) => getTxCategory(tx) === 'OTHERS' && tx.type !== 'BILL PAYMENT')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [filteredStatementTxs]);

  const memberTotalDue = statementMember ? getMemberTotalDue(statementMember, 'ALL') : 0;

  // বকেয়া বিল হিসাব:
  let previousDue = 0;
  const currentMonthCharges = totalMonthBill + unitFundBill + othersFundBill;
  if (memberTotalDue > currentMonthCharges) {
    previousDue = Math.max(0, Math.round((memberTotalDue - currentMonthCharges) * 100) / 100);
  } else if (memberTotalDue > 0 && currentMonthCharges === 0) {
    previousDue = memberTotalDue;
  } else {
    previousDue = 0;
  }

  // All payments by member to check if settled
  const allMemberPayments = (statementTx || [])
    .filter((tx) => tx.type === 'BILL PAYMENT' && !tx.isReverted && tx.status !== 'REVERTED')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const currentMonthPayments = filteredStatementTxs
    .filter((tx) => tx.type === 'BILL PAYMENT' && !tx.isReverted && tx.status !== 'REVERTED')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const effectivePayments = currentMonthPayments > 0
    ? currentMonthPayments
    : (memberTotalDue === 0 && allMemberPayments > 0 ? Math.min(totalMonthBill + previousDue + unitFundBill + othersFundBill, allMemberPayments) : 0);

  const netPayable = memberTotalDue === 0
    ? 0
    : Math.max(0, totalMonthBill + previousDue + unitFundBill + othersFundBill - effectivePayments);

  // Pre-render the statement slip into an image file so WhatsApp click has fresh user activation and instant image file ready
  useEffect(() => {
    if (!statementMember) {
      setStatementImageFile(null);
      setStatementImageBlob(null);
      return;
    }

    const rank = getMemberBanglaRank(statementMember) || formatRankBn(statementMember.Rank || statementMember.rank || '');
    const surname = getMemberBanglaName(statementMember) || formatMemberNameBn(statementMember.Surname || statementMember.surname || '');
    const fileName = `ক্যাফে_ইউএভি_${rank}_${surname}_বিল.png`;

    let isCancelled = false;

    generateStatementCanvasBlob({
      statementMonth,
      statementMember,
      items: statementAggregatedItems,
      totalMonthBill,
      previousDue,
      unitFundBill,
      othersFundBill,
      effectivePayments,
      netPayable,
      rankBn: rank,
      nameBn: surname
    }).then((blob) => {
      if (isCancelled || !blob) return;
      setStatementImageBlob(blob);
      const file = new File([blob], fileName, { type: 'image/png' });
      setStatementImageFile(file);
    }).catch((err) => {
      console.warn('Canvas pre-rendering note:', err);
    });

    return () => {
      isCancelled = true;
    };
  }, [
    statementMember?.airman_id, 
    statementMonth, 
    statementAggregatedItems, 
    totalMonthBill, 
    previousDue, 
    netPayable
  ]);

  const handleDownloadStatementPic = async () => {
    if (!statementMember) return;
    setIsCapturingPic(true);
    try {
      const rank = getMemberBanglaRank(statementMember) || formatRankBn(statementMember?.['Rank'] || statementMember?.rank || '');
      const surname = getMemberBanglaName(statementMember) || formatMemberNameBn(statementMember?.['Surname'] || statementMember?.surname || 'Member');
      const fileName = `ক্যাফে_ইউএভি_${rank}_${surname}_বিল.png`;

      let blob = statementImageBlob;
      if (!blob) {
        blob = await generateStatementCanvasBlob({
          statementMonth,
          statementMember,
          items: statementAggregatedItems,
          totalMonthBill,
          previousDue,
          unitFundBill,
          othersFundBill,
          effectivePayments,
          netPayable,
          rankBn: rank,
          nameBn: surname
        });
        if (blob) {
          setStatementImageBlob(blob);
          const file = new File([blob], fileName, { type: 'image/png' });
          setStatementImageFile(file);
        }
      }

      if (blob) {
        const result = await saveStatementToGalleryOrDownload(blob, statementImageFile, fileName);
        if (result.method === 'share') {
          setWhatsAppNotice('ছবিটি গ্যালারিতে সেভ করতে শেয়ার অপশন থেকে "Save to Photos/Gallery" অথবা হোয়াটসঅ্যাপ নির্বাচন করুন।');
          setTimeout(() => setWhatsAppNotice(null), 5000);
        } else {
          setWhatsAppNotice('স্টেটমেন্টের ছবি সফলভাবে ডাউনলোড করা হয়েছে!');
          setTimeout(() => setWhatsAppNotice(null), 4000);
        }
      } else {
        alert('ছবি ডাউনলোড করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
      }
    } catch (err) {
      console.error('Error downloading statement picture:', err);
      alert('ছবি তৈরি করতে সমস্যা হয়েছে।');
    } finally {
      setIsCapturingPic(false);
    }
  };

  const grandTotalDue = useMemo(() => {
    return members.reduce((sum, m) => sum + Number(m.Due ?? m.due ?? m.baki ?? 0), 0);
  }, [members]);

  const membersWithDueCount = useMemo(() => {
    return members.filter((m) => Number(m.Due ?? m.due ?? m.baki ?? 0) > 0).length;
  }, [members]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* If WhatsApp Template Box is open, render dedicated Message Format page (nothing else) */}
      {showWhatsAppTemplateBox ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Top Bar with Back Button */}
          <div className="flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-2.5 sm:p-3.5 rounded-2xl shadow-xl">
            <div className="flex items-center space-x-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setShowWhatsAppTemplateBox(false)}
                className="flex items-center justify-center space-x-1.5 px-3 py-1.5 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-xs border border-slate-700 active:scale-95 group shrink-0"
                title="Back"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-emerald-400 group-hover:-translate-x-0.5 transition-transform" />
                <span>Back</span>
              </button>
              <div className="h-5 w-px bg-slate-800 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-xs sm:text-base font-black text-white uppercase tracking-tight flex items-center gap-1.5 truncate">
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366] shrink-0" />
                  <span className="truncate">Default Message Format</span>
                </h2>
                <p className="text-[10px] text-slate-400 truncate hidden xs:block">
                  বিল নোটিশ ও ব্যাংক একাউন্ট সংক্রান্ত তথ্য
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowWhatsAppTemplateBox(false)}
              className="p-1.5 h-8 w-8 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0 border border-slate-700/80"
              title="Back"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Dedicated Message Format Content - Only message format related info */}
          <WhatsAppMessageTemplateBox 
            canteenConfig={canteenConfig}
            currentMonth={selectedMonth}
          />
        </div>
      ) : (selectedCategory === 'UNIT_FUND' || selectedCategory === 'OTHERS') ? (
        <FundBatchBillPage
          category={selectedCategory}
          members={members}
          allTxs={allTxs}
          selectedMonth={selectedMonth}
          onBack={() => setSelectedCategory('CANTEEN')}
          onCategoryChange={(cat) => setSelectedCategory(cat)}
          onSuccess={() => fetchMembers(true)}
          openStatement={openStatement}
          openPayBill={openPayBill}
          openProfile={openProfile}
          setInitialBillMember={setInitialBillMember}
          handleExportBills={handleExportBills}
          getMemberBanglaName={getMemberBanglaName}
          getMemberBanglaRank={getMemberBanglaRank}
          formatRankBn={formatRankBn}
          formatMemberNameBn={formatMemberNameBn}
          getMemberTotalDue={getMemberTotalDue}
          getMemberFilteredBill={getMemberFilteredBill}
        />
      ) : (
        <>
          {/* Top Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2.5">
                <Receipt className="w-6 h-6 sm:w-7 sm:h-7 text-indigo-400" />
                <span>BILL MANAGEMENT</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Canteen Bill, Unit Fund Bill & Others Bill Administration
              </p>
            </div>

            {/* Action Buttons: Manager, WhatsApp Template Toggle & Payment History */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setShowManagerModal(true)}
                className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 border bg-indigo-950/70 hover:bg-indigo-900/90 text-indigo-300 hover:text-white border-indigo-700/60"
                title="ক্যান্টিন ম্যানেজার নির্ধারণ ও বিবরণ"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <span>
                  Manager: {canteenConfig?.managerName ? canteenConfig.managerName.split(' ')[0] : 'Assign'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowWhatsAppTemplateBox(true)}
                className="flex items-center justify-center space-x-1.5 px-3.5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95 border bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700"
                title="Default Message Format পেজ খুলুন"
              >
                <WhatsAppIcon className="w-4 h-4 text-emerald-400" />
                <span>Default Msg Format</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPaymentHistoryOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-900/40 transition-all cursor-pointer active:scale-95 border border-indigo-400/30 group"
              >
                <History className="w-4 h-4 text-indigo-200 group-hover:rotate-[-45deg] transition-transform" />
                <span>Payment History</span>
                <span className="px-1.5 py-0.5 rounded-full bg-black/30 text-[10px] font-mono font-black text-indigo-200 border border-indigo-400/20">
                  {allPaymentTxs.length}
                </span>
              </button>
            </div>
          </div>

      {/* Manager Assignment Notification Banner */}
      {managerAssignSuccess && (
        <div className="p-3 bg-indigo-950/90 border border-indigo-500/50 rounded-xl flex items-center justify-between text-xs text-indigo-200 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{managerAssignSuccess}</span>
          </div>
          <button onClick={() => setManagerAssignSuccess(null)} className="text-indigo-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Delete / Success Notification Banner */}
      {paymentDeleteSuccessMsg && (
        <div className="p-3 bg-emerald-950/80 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs text-emerald-200 animate-fadeIn">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{paymentDeleteSuccessMsg}</span>
          </div>
          <button onClick={() => setPaymentDeleteSuccessMsg(null)} className="text-emerald-400 hover:text-white p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Summary Banner (Compact 2-Column Row: Monthly Total Due & Overall Total Due Side-by-Side) */}
      <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
        {/* Card 1: Monthly Total Due */}
        <div className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700/80 rounded-xl p-2 sm:p-2.5 flex items-center space-x-2 shadow-xs min-w-0 transition-colors">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-slate-400 truncate">
              Monthly Billed
            </p>
            <p className="text-sm sm:text-base font-black text-emerald-400 font-mono tracking-tight truncate leading-tight mt-0.5">
              ৳{totalFilteredBill.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Card 2: Overall Total Due */}
        <div 
          onClick={() => {
            if (selectedMonth !== 'ALL') {
              setSelectedMonth('ALL');
              setFilterMode('DUE');
            } else {
              setFilterMode(isDueFilterActive ? 'ALL' : 'DUE');
            }
          }}
          className="bg-gradient-to-br from-rose-950/70 via-red-950/40 to-slate-900 border border-rose-500/40 hover:border-rose-400/80 rounded-xl p-2 sm:p-2.5 flex items-center justify-between shadow-xs transition-all cursor-pointer group min-w-0"
          title="সকল সদস্যের সর্বমোট প্রদেয় বকেয়া"
        >
          <div className="flex items-center space-x-2 min-w-0 flex-1">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-300 shrink-0">
              <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-rose-300 truncate">
                Total Due
              </p>
              <p className="text-sm sm:text-base font-black text-white font-mono tracking-tight drop-shadow-sm truncate leading-tight mt-0.5">
                ৳{grandTotalDue.toLocaleString()}
              </p>
            </div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-rose-400 group-hover:translate-x-0.5 transition-transform shrink-0 ml-0.5" />
        </div>
      </div>

      {/* Top Filter: Overall, Officer, Airmen, Civilian (Selected member box removed) */}
      <div className="w-full min-w-0 bg-slate-900/90 border border-slate-800 rounded-2xl p-1.5 sm:p-2 shadow-sm">
        <div className="grid grid-cols-4 w-full items-center gap-1 sm:gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/80">
          <button
            type="button"
            onClick={() => setRankTypeFilter('OVERALL')}
            className={`px-1 sm:px-3 py-1.5 rounded-lg text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${
              rankTypeFilter === 'OVERALL'
                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 hidden xs:inline-block sm:inline-block" />
            <span>OVERALL</span>
            <span className="px-1 py-0.2 rounded-md bg-white/15 text-[8px] sm:text-[9px] font-mono font-bold">
              {overallCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRankTypeFilter('OFFICER')}
            className={`px-1 sm:px-3 py-1.5 rounded-lg text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${
              rankTypeFilter === 'OFFICER'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 hidden xs:inline-block sm:inline-block" />
            <span>OFFICER</span>
            <span className="px-1 py-0.2 rounded-md bg-white/15 text-[8px] sm:text-[9px] font-mono font-bold">
              {officerCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRankTypeFilter('AIRMEN')}
            className={`px-1 sm:px-3 py-1.5 rounded-lg text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${
              rankTypeFilter === 'AIRMEN'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 hidden xs:inline-block sm:inline-block" />
            <span>AIRMEN</span>
            <span className="px-1 py-0.2 rounded-md bg-white/15 text-[8px] sm:text-[9px] font-mono font-bold">
              {airmenCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRankTypeFilter('CIVILIAN')}
            className={`px-1 sm:px-3 py-1.5 rounded-lg text-[9px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 sm:space-x-1.5 ${
              rankTypeFilter === 'CIVILIAN'
                ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
            }`}
          >
            <Coffee className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 hidden xs:inline-block sm:inline-block" />
            <span>CIVILIAN</span>
            <span className="px-1 py-0.2 rounded-md bg-white/15 text-[8px] sm:text-[9px] font-mono font-bold">
              {civilianCount}
            </span>
          </button>
        </div>
      </div>

      {/* Bill Category Tabs & Compact Month Selector */}
      <div className="bg-slate-900/85 border border-slate-800 rounded-xl p-2.5 sm:p-3 space-y-2.5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
          {/* Bill Category Filter Pills: All, Canteen, Unit Fund, Others - Responsive grid on mobile so All is never pushed out */}
          <div className="w-full sm:w-auto grid grid-cols-4 sm:flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-950/90 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-700 text-white shadow-xs ring-1 ring-slate-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span>All</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('CANTEEN')}
              className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                selectedCategory === 'CANTEEN'
                  ? 'bg-amber-600 text-white shadow-xs ring-1 ring-amber-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Canteen</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('UNIT_FUND')}
              className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                selectedCategory === 'UNIT_FUND'
                  ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="truncate">Unit Fund</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('OTHERS')}
              className={`px-1.5 sm:px-2.5 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1 ${
                selectedCategory === 'OTHERS'
                  ? 'bg-cyan-600 text-white shadow-xs ring-1 ring-cyan-400/50'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Others</span>
            </button>
          </div>

          {/* Ultra-compact Month Selector (Clean, small, tight pill) */}
          <div className="flex items-center justify-start sm:justify-end shrink-0">
            <div className="inline-flex items-center bg-slate-950/90 rounded-lg p-0.5 border border-slate-800 shadow-xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer active:scale-90"
                title="পূর্ববর্তী মাস"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-indigo-400" />
              </button>

              <div className="px-2 text-center select-none">
                <span className="text-[11px] font-black uppercase tracking-wider flex items-center justify-center space-x-1 text-slate-200">
                  <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span className="font-mono">{formatCompactMonth(selectedMonth)}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                className="w-6 h-6 flex items-center justify-center hover:bg-slate-800 text-slate-400 hover:text-white rounded transition-colors cursor-pointer active:scale-90"
                title="পরবর্তী মাস"
              >
                <ChevronRight className="w-3.5 h-3.5 text-indigo-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter Info Strip with Total Billed & Quick Filter Switch */}
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-800/60 flex-wrap gap-2">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Showing: <strong className="text-white">{selectedCategory === 'CANTEEN' ? 'Canteen' : selectedCategory === 'UNIT_FUND' ? 'Unit Fund' : selectedCategory === 'OTHERS' ? 'Others' : 'All Bills'}</strong>
              {' • '}
              <strong className="text-indigo-300 font-mono">{formatCompactMonth(selectedMonth)}</strong>
            </span>
            <span className="text-slate-500 hidden sm:inline">|</span>
            <span className="text-emerald-400 font-mono font-black">
              Total Billed: ৳{totalFilteredBill.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Quick Toggle: All vs Only with Bills */}
            <div className="flex items-center bg-slate-950 rounded-xl p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => setFilterMode('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  !isDueFilterActive
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('DUE')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  isDueFilterActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Due ({countWithBills})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Search Input & View Switcher (Box View vs Table View) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search members by BD No, Rank, Surname, Bill, or বাংলা নাম..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-10 py-3 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Actions: Import Button & Export Button (Only when ALL is selected) & View Mode Toggle (Icons Only) */}
        <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0 flex-wrap gap-y-2">
          {selectedCategory === 'ALL' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setImportModalInitialTab('FILE');
                  setIsImportBillsModalOpen(true);
                }}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-emerald-500/25 border-t border-emerald-300/40 active:translate-y-0.5 transition-all cursor-pointer"
                title="Bulk Import Initial Bills (Excel / CSV / Copy-Paste / History)"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>IMPORT</span>
              </button>

              <button
                type="button"
                onClick={handleExportBills}
                className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-indigo-500/25 border-t border-indigo-300/40 active:translate-y-0.5 transition-all cursor-pointer"
                title="Export Bill (Print Preview, PDF & Excel)"
              >
                <Printer className="w-4 h-4" />
                <span>EXPORT (PDF)</span>
              </button>
            </>
          )}

          {/* View Mode Toggle: Box vs Table (Icons only) */}
          <div className="flex items-center bg-slate-900 rounded-2xl p-1 border border-slate-800 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('BOX')}
              className={`p-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center ${
                viewMode === 'BOX'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Box / Card View"
              aria-label="Box View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`p-2 rounded-xl text-xs transition-all cursor-pointer flex items-center justify-center ${
                viewMode === 'TABLE'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
              aria-label="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {loading && members.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <div key={k} className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 h-36 animate-pulse flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-850 border border-slate-800" />
              <div className="space-y-2.5 flex-1">
                <div className="h-4 bg-slate-800 rounded-lg w-28" />
                <div className="h-5 bg-slate-800 rounded-lg w-44" />
                <div className="h-3 bg-slate-800/80 rounded w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedMemberList.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <p className="text-slate-400 font-bold text-sm">
            {isDueFilterActive 
              ? 'No members found with due in this category/month' 
              : 'No member records found'}
          </p>
          {isDueFilterActive ? (
            <button
              onClick={() => setFilterMode('ALL')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center space-x-2 cursor-pointer shadow-md shadow-indigo-600/30 transition-all"
            >
              <span>Show All Members ({filteredMembers.length})</span>
            </button>
          ) : (
            <button
              onClick={() => fetchMembers(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider inline-flex items-center space-x-2 cursor-pointer shadow-md shadow-indigo-600/30 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Members</span>
            </button>
          )}
        </div>
       ) : viewMode === 'BOX' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedMemberList.map((member, i) => {
            const memberDp = resolveImageUrl(member.DP);
            const totalDue = getMemberTotalDue(member, selectedCategory);
            const displayedBill = getMemberFilteredBill(member, selectedCategory, selectedMonth);

            return (
              <div 
                key={member.airman_id || i} 
                onClick={() => openProfile(member)} 
                className="relative bg-gradient-to-b from-slate-800/90 via-slate-900 to-slate-950 rounded-3xl p-5 border-t border-t-slate-600/60 border-x border-x-slate-700/60 border-b-4 border-b-slate-950 shadow-[0_12px_24px_-4px_rgba(0,0,0,0.65),0_4px_8px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_-2px_4px_0_rgba(0,0,0,0.4)] hover:-translate-y-1.5 hover:shadow-[0_20px_35px_-6px_rgba(0,0,0,0.8),0_0_22px_0_rgba(79,70,229,0.3),inset_0_1px_0_0_rgba(255,255,255,0.2)] hover:border-b-indigo-900 transition-all duration-300 cursor-pointer group flex flex-col justify-between overflow-hidden"
              >
                {/* Top Section: Avatar & Member Info (Left) + Total Due (Right) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                    {/* 3D Embossed Avatar Frame */}
                    <div className="w-12 h-12 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black text-xl shadow-[inset_0_2px_5px_rgba(0,0,0,0.8),0_3px_8px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-300 overflow-hidden shrink-0 border border-slate-700/70">
                      {memberDp ? (
                        <img 
                          src={memberDp} 
                          alt={member['Surname']} 
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="text-indigo-400 font-black">
                          {(member['Surname'] || 'U').charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-1.5 mb-1 flex-wrap gap-y-1">
                        {member['Rank'] && member['Rank'] !== '-' ? (
                          <>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 border-t border-indigo-400/40 border-b-2 border-indigo-950 text-indigo-300 shadow-sm shrink-0 font-mono">
                              {member['Rank']}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-950/70 border border-indigo-500/30 text-indigo-200 font-sans shrink-0">
                              {getMemberBanglaRank(member) || formatRankBn(member['Rank'])}
                            </span>
                          </>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                            -
                          </span>
                        )}
                        <span className="text-[10px] font-mono font-bold text-slate-400">
                          BD/{member['BD No'] || member.airman_id?.replace(/\D/g, '') || '-'}
                        </span>
                        {String(member['BD No']).trim() === String(canteenConfig?.managerBdNo).trim() && (
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-indigo-500/25 border border-indigo-400/50 text-indigo-300 font-mono shadow-sm">
                            Manager
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline space-x-1.5 flex-wrap gap-y-0.5">
                        <h3 className="font-black text-white text-base leading-snug group-hover:text-indigo-300 transition-colors break-words" title={`${member['Rank']} ${member['Surname']}`}>
                          {member['Surname']}
                        </h3>
                        <span className="text-emerald-400 font-sans text-xs font-bold">
                          ({getMemberBanglaName(member) || formatMemberNameBn(member['Surname'])})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Middle Row: Contact & Month Bill Badge */}
                <div className="mt-3.5 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {member.Contact || member['Mobile No'] ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setContactActionMember(member);
                        setCopiedPhone(false);
                      }}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-xs font-mono font-bold transition-all cursor-pointer group/num active:scale-95 shrink-0"
                      title="Click to Call or Send WhatsApp Message"
                    >
                      <PhoneCall className="w-3.5 h-3.5 text-emerald-400 group-hover/num:scale-110 transition-transform shrink-0" />
                      <span className="font-bold underline decoration-emerald-500/40 underline-offset-2">
                        {member.Contact || member['Mobile No']}
                      </span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-500 font-mono italic">
                      No Contact
                    </span>
                  )}

                  {/* Selected Month Bill Badge */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openStatement(member);
                    }}
                    className={`px-2.5 py-1 rounded-xl border shadow-sm transition-all cursor-pointer inline-flex items-center space-x-1.5 active:scale-95 group/carddue shrink-0 ${
                      displayedBill > 0
                        ? 'bg-gradient-to-r from-amber-950/70 via-slate-900 to-amber-950/50 border-amber-500/50 text-amber-200 hover:border-amber-400 shadow-amber-950/30 ring-1 ring-amber-500/20'
                        : 'bg-slate-950/80 border-slate-700/80 text-slate-400 hover:bg-slate-800 hover:border-slate-500 shadow-black/40'
                    }`}
                    title={`${formatMonthName(selectedMonth)} এর হিসাব বিবরণী দেখুন (Click to view Statement)`}
                  >
                    <Calendar className={`w-3.5 h-3.5 ${displayedBill > 0 ? 'text-amber-400' : 'text-slate-500'} group-hover/carddue:rotate-6 transition-transform shrink-0`} />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 font-sans shrink-0">
                      {formatShortMonth(selectedMonth)} BILL:
                    </span>
                    <span className={`text-xs font-black font-mono tracking-tight shrink-0 ${displayedBill > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                      ৳{displayedBill.toLocaleString()}
                    </span>
                  </button>
                </div>

                {/* Bottom Action Bar: Left side = Statement, Right side = Pay Bill */}
                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center space-x-2.5">
                  {/* Left Side: Statement */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openStatement(member);
                    }}
                    className="flex-1 py-2 px-3 bg-slate-800/90 hover:bg-slate-700/90 text-indigo-300 hover:text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-1.5 border border-slate-700/70 transition-all shadow-sm active:translate-y-0.5 group/btn"
                    title="View Statement & Monthly Bill"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400 group-hover/btn:scale-110 transition-transform" />
                    <span>STATEMENT</span>
                  </button>

                  {/* Right Side: Pay Bill */}
                  <button
                    type="button"
                    disabled={totalDue <= 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (totalDue <= 0) return;
                      openPayBill(member);
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-1.5 transition-all group/btn ${
                      totalDue > 0
                        ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)] border-t border-emerald-300/40 active:translate-y-0.5 cursor-pointer'
                        : 'bg-slate-800/50 text-slate-500 border border-slate-800/80 cursor-not-allowed opacity-50 shadow-none pointer-events-none'
                    }`}
                    title={totalDue > 0 ? "Direct Pay Bill" : "কোনো বকেয়া নেই (Total Due is Nil)"}
                  >
                    <Banknote className={`w-3.5 h-3.5 ${totalDue > 0 ? 'group-hover/btn:scale-110 text-white' : 'text-slate-500'} transition-transform`} />
                    <span className="truncate">PAY BILL</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/90 text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5 text-center w-12 font-mono">#</th>
                  <th className="px-4 py-3.5">Rank & Name</th>
                  <th className="px-4 py-3.5 font-mono">BD No</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Contact</th>
                  <th className="px-4 py-3.5 text-right font-mono" title="নির্বাচিত মাসের অর্জিত বিল (অর্ডার/চার্জ - পেমেন্ট)">
                    {selectedCategory === 'ALL'
                      ? `${formatMonthName(selectedMonth)} Bill`
                      : selectedCategory === 'CANTEEN'
                      ? `${formatShortMonth(selectedMonth)} Canteen Bill`
                      : selectedCategory === 'UNIT_FUND'
                      ? `${formatShortMonth(selectedMonth)} Unit Fund Bill`
                      : `${formatShortMonth(selectedMonth)} Others Bill`}
                  </th>
                  <th className="px-4 py-3.5 text-right font-mono text-xs font-black uppercase tracking-wider text-rose-300" title="আগের সব বকেয়া সহ মোট বকেয়া (লেজার ব্যালেন্স)">
                    Total Due
                  </th>
                  <th className="px-4 py-3.5 text-center w-52">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {displayedMemberList.map((member, i) => {
                  const memberDp = resolveImageUrl(member.DP);
                  const totalDue = getMemberTotalDue(member, selectedCategory);
                  const displayedBill = getMemberFilteredBill(member, selectedCategory, selectedMonth);

                  return (
                    <tr 
                      key={member.airman_id || i}
                      onClick={() => openProfile(member)}
                      className={`transition-colors cursor-pointer group ${
                        i % 2 === 0
                          ? 'bg-slate-900 hover:bg-slate-800/80'
                          : 'bg-slate-800/40 hover:bg-slate-800/80'
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-slate-500 font-mono font-bold">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-center font-black text-xs text-indigo-400 overflow-hidden shrink-0 shadow-inner">
                            {memberDp ? (
                              <img src={memberDp} alt={member['Surname']} referrerPolicy="no-referrer" loading="lazy" decoding="async" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                              <span>{(member['Surname'] || 'U').charAt(0)}</span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 whitespace-nowrap">
                            {member['Rank'] && member['Rank'] !== '-' ? (
                              <>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 font-mono shrink-0">
                                  {member['Rank']}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 font-sans shrink-0">
                                  {getMemberBanglaRank(member) || formatRankBn(member['Rank'])}
                                </span>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-400 bg-slate-800 border border-slate-700 shrink-0">
                                -
                              </span>
                            )}
                            <span className="font-black text-white group-hover:text-indigo-300 transition-colors text-xs shrink-0">
                              {member['Surname']}
                            </span>
                            <span className="font-bold text-emerald-400 font-sans text-xs shrink-0">
                              ({getMemberBanglaName(member) || formatMemberNameBn(member['Surname'])})
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono text-slate-300 bg-slate-950/70 border border-slate-700/60 inline-block shadow-inner">
                          #{member['BD No']}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold text-slate-300">
                          {member.Role || 'Member'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs" onClick={(e) => e.stopPropagation()}>
                        {member.Contact || member['Mobile No'] ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setContactActionMember(member);
                              setCopiedPhone(false);
                            }}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 text-xs font-mono font-bold transition-all cursor-pointer group/tblph active:scale-95"
                            title="Click to Call or Send WhatsApp Message"
                          >
                            <PhoneCall className="w-3 h-3 text-emerald-400 group-hover/tblph:scale-110 transition-transform shrink-0" />
                            <span className="font-bold underline decoration-emerald-500/30 underline-offset-2">
                              {member.Contact || member['Mobile No']}
                            </span>
                          </button>
                        ) : (
                          <span className="text-slate-500 italic">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-base font-black font-mono ${displayedBill === 0 ? 'text-slate-400' : 'text-amber-400'}`}>
                          ৳{displayedBill.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setInitialBillMember(member)}
                          className={`px-3 py-1.5 rounded-xl border text-sm font-black font-mono transition-all cursor-pointer inline-flex items-center space-x-2 shadow-sm ${
                            totalDue > 0
                              ? 'bg-rose-950/80 border-rose-500/70 text-rose-200 hover:bg-rose-900/90 hover:border-rose-400 ring-1 ring-rose-500/30'
                              : 'bg-slate-950/80 border-slate-700/80 text-emerald-400 hover:bg-slate-800'
                          }`}
                          title="Click to set/edit Total Due"
                        >
                          <Coins className={`w-3.5 h-3.5 ${totalDue > 0 ? 'text-amber-400' : 'text-emerald-400'}`} />
                          <span className={totalDue > 0 ? 'text-rose-200 text-sm font-black' : 'text-emerald-400 text-sm font-bold'}>
                            ৳{totalDue.toLocaleString()}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            type="button"
                            onClick={() => openStatement(member)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg text-[11px] font-black uppercase flex items-center space-x-1 border border-slate-700 transition-all cursor-pointer"
                            title="Statement"
                          >
                            <FileText className="w-3 h-3 text-indigo-400" />
                            <span>Statement</span>
                          </button>
                          <button
                            type="button"
                            disabled={totalDue <= 0}
                            onClick={() => {
                              if (totalDue <= 0) return;
                              openPayBill(member);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase flex items-center space-x-1 shadow-xs transition-all ${
                              totalDue > 0
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white cursor-pointer'
                                : 'bg-slate-800/50 text-slate-500 border border-slate-800 cursor-not-allowed opacity-50 shadow-none pointer-events-none'
                            }`}
                            title={totalDue > 0 ? "Pay Bill" : "কোনো বকেয়া নেই (Total Due is Nil)"}
                          >
                            <Banknote className={`w-3 h-3 ${totalDue > 0 ? 'text-white' : 'text-slate-500'}`} />
                            <span>PAY BILL</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInitialBillMember(member)}
                            className="p-1.5 bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 rounded-lg text-[11px] font-black uppercase border border-slate-700 transition-all cursor-pointer"
                            title="Set Initial Bill / প্রারম্ভিক বকেয়া"
                          >
                            <Coins className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>
      )}

      {/* Profile Modal (No Pay Bill, No Statement, DP hidden before Edit mode) */}
      {profileMember && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-2xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-indigo-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow">
                  {profileMember.DP ? (
                    <img 
                      src={resolveImageUrl(profileMember.DP)} 
                      alt={profileMember['Surname']} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="font-black text-xl text-indigo-400">
                      {(profileMember['Surname'] || 'U').charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2 flex-wrap">
                    <h2 className="text-xl font-black text-white flex items-center gap-1.5 flex-wrap">
                      {profileMember['Rank'] && profileMember['Rank'] !== '-' && (
                        <>
                          <span>{profileMember['Rank']}</span>
                          <span className="text-indigo-300 font-sans text-sm font-bold">
                            ({getMemberBanglaRank(profileMember) || formatRankBn(profileMember['Rank'])})
                          </span>
                        </>
                      )}
                      <span>{profileMember['Surname']}</span>
                      <span className="text-emerald-400 font-sans text-sm font-bold">
                        ({getMemberBanglaName(profileMember) || formatMemberNameBn(profileMember['Surname'])})
                      </span>
                    </h2>
                  </div>
                  <p className="text-xs font-bold text-indigo-400 font-mono">BD No: {profileMember['BD No']}</p>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center space-x-2">
                {String(profileMember['BD No']).trim() === String(canteenConfig?.managerBdNo).trim() ? (
                  <span className="px-2.5 py-1.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Active Manager</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAssignManager(profileMember)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="এই সদস্যকে ক্যান্টিন ম্যানেজার নির্ধারণ করুন"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Make Manager</span>
                  </button>
                )}
                <button 
                  onClick={() => setProfileMember(null)} 
                  className="p-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors ml-1 cursor-pointer" 
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto bg-slate-900/50 flex-1 space-y-6">
              {/* VIEW MODE: Read-only Member Profile & History */}
              <div className="space-y-6">
                  {/* Basic Member Info & Summary Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Role / পদবি</p>
                      <p className="text-xs font-black text-indigo-300 uppercase tracking-wide truncate">
                        {profileMember['Role'] || profileMember.role || 'Member'}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5 truncate">
                        {profileMember['Contact'] || 'No Contact'}
                      </p>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট বিল (Billed)</p>
                      <p className="text-base font-black font-mono text-amber-400">
                        ৳{profileMemberStats.totalBilled.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold">কেনাকাটা ও ইম্পোর্ট</p>
                    </div>

                    <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">মোট জমা (Paid)</p>
                      <p className="text-base font-black font-mono text-emerald-400">
                        ৳{profileMemberStats.totalPaid.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold">পরিশোধকৃত টাকা</p>
                    </div>

                    <div 
                      key={duePulseKey}
                      className={`bg-slate-800/80 p-3 rounded-2xl border flex flex-col justify-between transition-all duration-300 ${
                        duePulseKey > 0 ? 'border-rose-500/60 shadow-lg shadow-rose-500/20 ring-1 ring-rose-500/30 animate-success-pop' : 'border-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">অবশিষ্ট বকেয়া (Due)</p>
                        <p className={`text-base font-black font-mono ${profileMemberStats.netDue === 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                          ৳{profileMemberStats.netDue.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold">বর্তমান বকেয়া</p>
                      </div>
                    </div>
                  </div>

                  {/* Transaction History Section */}
                  <div className="space-y-3">
                    {/* Dynamic Removal Notification Banner */}
                    <AnimatePresence>
                      {deletedTxNotice && (
                        <motion.div
                          initial={{ opacity: 0, y: -16, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -12, scale: 0.95 }}
                          transition={{ type: 'spring', stiffness: 450, damping: 28 }}
                          className="p-3 bg-gradient-to-r from-rose-950/80 via-slate-900 to-rose-950/70 border border-rose-500/40 rounded-2xl flex items-center justify-between shadow-lg shadow-rose-950/40 text-xs text-rose-200"
                        >
                          <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/30">
                              <Trash2 className="w-4 h-4 animate-bounce" />
                            </div>
                            <div>
                              <p className="font-bold text-white text-[11px] leading-tight">
                                ট্রানজ্যাকশন সফলভাবে অপসারিত হয়েছে!
                              </p>
                              <p className="text-[10px] text-rose-300 font-mono">
                                {deletedTxNotice.description} (৳{deletedTxNotice.amount.toLocaleString()}) বকেয়া সমন্বয় সম্পন্ন।
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDeletedTxNotice(null)}
                            className="p-1 text-rose-400 hover:text-white rounded-lg hover:bg-rose-500/20 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="flex items-center space-x-2">
                      <History className="w-4 h-4 text-indigo-400" />
                      <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">
                        Transaction History
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 font-mono px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700">
                        {filteredProfileHistoryRows.length} records
                      </span>
                    </div>

                    {filteredProfileHistoryRows.length === 0 ? (
                      <div className="bg-slate-800/80 rounded-2xl p-8 text-center text-slate-400 font-bold border border-slate-700 text-xs">
                        কোনো লেনদেন পাওয়া যায়নি (No transactions found)
                      </div>
                    ) : (
                      <>
                        {/* Mobile Card View (sm:hidden) */}
                        <div className="sm:hidden space-y-2.5">
                          <AnimatePresence mode="popLayout">
                            {filteredProfileHistoryRows.map((row) => (
                              <motion.div 
                                key={row.rowId || row.txId || row.ser}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{
                                  opacity: 0,
                                  x: -70,
                                  scale: 0.9,
                                  backgroundColor: 'rgba(244, 63, 94, 0.25)',
                                  transition: { duration: 0.35, ease: 'easeOut' }
                                }}
                                transition={{ duration: 0.22 }}
                                className="bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700/80 space-y-2.5"
                              >
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-900 text-indigo-300 font-bold border border-slate-700">
                                    #{row.ser}
                                  </span>
                                  <span className="text-slate-400 font-bold">
                                    {toEnglishDate(row.date)}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                                    row.type === 'BILL PAYMENT'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                      : row.type === 'AMOUNT_CHANGE'
                                      ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                      : row.type === 'INITIAL_BILL'
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                      : row.type === 'REVERTED'
                                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                                      : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                  }`}>
                                    {row.type === 'REVERTED' ? 'REVERTED / বাতিল' : row.type === 'BILL PAYMENT' ? 'পরিশোধ / PAYMENT' : row.type === 'AMOUNT_CHANGE' ? 'বিল সংশোধন / CHANGE' : row.type === 'INITIAL_BILL' ? 'ইম্পোর্ট / প্রারম্ভিক বিল' : (row.type || 'খাবার / SALE')}
                                  </span>
                                </div>

                                <div className={`text-xs font-bold ${row.type === 'REVERTED' ? 'text-slate-400 line-through' : 'text-white'} break-words flex items-center gap-1.5 flex-wrap`}>
                                  <span>{row.description}</span>
                                  {row.type === 'INITIAL_BILL' && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                      ইম্পোর্ট বিল
                                    </span>
                                  )}
                                  {row.type === 'AMOUNT_CHANGE' && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                      বিল সংশোধন
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
                                  <div className="flex items-center space-x-2">
                                    {row.qty !== '-' && (
                                      <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-700/50">
                                        Qty: {row.qty}
                                      </span>
                                    )}
                                    <span className={`text-sm font-black font-mono ${
                                      row.type === 'REVERTED'
                                        ? 'text-slate-400/70 line-through font-mono'
                                        : row.type === 'BILL PAYMENT'
                                        ? 'text-emerald-400'
                                        : row.type === 'INITIAL_BILL' || row.type === 'AMOUNT_CHANGE'
                                        ? 'text-amber-400'
                                        : 'text-rose-400'
                                    }`}>
                                      ৳{row.amount}
                                    </span>
                                  </div>

                                  {row.type !== 'REVERTED' ? (
                                    <button 
                                      type="button"
                                      onClick={() => setTxDeleteConfirmId(row.tx)} 
                                      className="px-2.5 py-1 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-lg border border-rose-500/20 text-[11px] font-bold transition-all active:scale-95 flex items-center space-x-1 cursor-pointer"
                                      title={row.type === 'BILL PAYMENT' ? 'Revert Payment' : 'Remove Record'}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>{row.type === 'BILL PAYMENT' ? 'Revert' : 'Delete'}</span>
                                    </button>
                                  ) : (
                                    <span className="text-[10px] font-mono text-rose-400/80 font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/40">
                                      বাতিলকৃত
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>

                        {/* Desktop Table View (hidden sm:block) */}
                        <div className="hidden sm:block bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-700">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300 min-w-[500px]">
                              <thead className="bg-slate-900/80 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-700">
                                <tr>
                                  <th className="px-4 py-3">Ser</th>
                                  <th className="px-4 py-3">Date</th>
                                  <th className="px-4 py-3">Description</th>
                                  <th className="px-4 py-3 text-center">Qty</th>
                                  <th className="px-4 py-3 text-right">Amount</th>
                                  <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-700/50">
                                <AnimatePresence mode="popLayout">
                                  {filteredProfileHistoryRows.map((row) => (
                                    <motion.tr 
                                      key={row.rowId || row.txId || row.ser} 
                                      layout
                                      initial={{ opacity: 0, y: 6 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{
                                        opacity: 0,
                                        x: -80,
                                        scale: 0.92,
                                        backgroundColor: 'rgba(244, 63, 94, 0.25)',
                                        transition: { duration: 0.35, ease: 'easeOut' }
                                      }}
                                      transition={{ duration: 0.22 }}
                                      className={`hover:bg-slate-700/20 ${row.type === 'REVERTED' ? 'bg-rose-950/20' : ''}`}
                                    >
                                      <td className="px-4 py-2.5 font-mono">{row.ser}</td>
                                      <td className="px-4 py-2.5 font-mono">{toEnglishDate(row.date)}</td>
                                      <td className={`px-4 py-2.5 font-bold ${row.type === 'REVERTED' ? 'text-slate-400 line-through' : ''}`}>
                                        <div className="flex items-center space-x-1.5 flex-wrap">
                                          <span>{row.description}</span>
                                          {row.type === 'INITIAL_BILL' && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                              ইম্পোর্ট বিল
                                            </span>
                                          )}
                                          {row.type === 'AMOUNT_CHANGE' && (
                                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                              বিল সংশোধন
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-2.5 text-center font-bold">
                                        {row.type === 'REVERTED' ? (
                                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-rose-950/60 text-rose-400 border border-rose-900/50">বাতিল</span>
                                        ) : (
                                          row.qty
                                        )}
                                      </td>
                                      <td className={`px-4 py-2.5 text-right font-black ${
                                        row.type === 'REVERTED'
                                          ? 'text-slate-400/70 line-through font-mono'
                                          : row.type === 'BILL PAYMENT'
                                          ? 'text-emerald-400 font-mono'
                                          : row.type === 'INITIAL_BILL' || row.type === 'AMOUNT_CHANGE'
                                          ? 'text-amber-400 font-mono'
                                          : 'text-rose-400 font-mono'
                                      }`}>
                                        ৳{row.amount}
                                      </td>
                                      <td className="px-4 py-2.5 text-center">
                                        {row.type !== 'REVERTED' ? (
                                          <button 
                                            type="button"
                                            onClick={() => setTxDeleteConfirmId(row.tx)} 
                                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all active:scale-90 cursor-pointer" 
                                            title={row.type === 'BILL PAYMENT' ? 'Revert Payment' : 'Remove Record'}
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        ) : (
                                          <span className="text-[10px] text-rose-400/80 font-bold font-mono">
                                            Reverted
                                          </span>
                                        )}
                                      </td>
                                    </motion.tr>
                                  ))}
                                </AnimatePresence>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Statement Modal (Opened via Card Left-Side "STATEMENT" button) */}
      {statementMember && (
        <div 
          onClick={() => setStatementMember(null)}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 rounded-[2rem] sm:rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[92vh]"
          >
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex flex-col gap-3">
              {/* Row 1: Member Info (Left) + Prominent Back/Close 'X' Button (Always at top right) */}
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl bg-slate-800 border border-indigo-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {statementMember.DP ? (
                      <img 
                        src={resolveImageUrl(statementMember.DP)} 
                        alt={statementMember['Surname']} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="font-black text-base text-indigo-400">
                        {(statementMember['Surname'] || 'U').charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base sm:text-lg font-black text-white truncate leading-tight">
                      {getMemberBanglaRank(statementMember) || formatRankBn(statementMember['Rank'] || statementMember.rank || '')} {getMemberBanglaName(statementMember) || formatMemberNameBn(statementMember['Surname'] || '')}
                    </h2>
                    <p className="text-[11px] font-bold text-slate-400 font-mono truncate mt-0.5">
                      মাসিক হিসাব বিবরণী • {formatBengaliMonthYear(statementMonth)}
                    </p>
                  </div>
                </div>

                {/* Top-Right Back / Close 'X' Button - Always fixed at top right */}
                <button 
                  type="button"
                  onClick={() => setStatementMember(null)} 
                  className="w-10 h-10 rounded-2xl bg-slate-800/90 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-slate-700/80 hover:border-rose-500/40 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-md active:scale-90"
                  title="বন্ধ করুন (Back / Close)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Row 2: Action Buttons: Direct WhatsApp Chat, Share Image, Download Pic, Print */}
              <div className="flex items-center gap-2 overflow-x-auto w-full pt-0.5 scrollbar-none">
                {/* 1. WHATSAPP Direct Chat with Member (Full breakdown & copied/saved statement picture) */}
                <button 
                  type="button"
                  onClick={() => handleDirectWhatsAppChat(statementMember, statementAggregatedItems, netPayable, totalMonthBill, previousDue, unitFundBill, othersFundBill, statementMonth)}
                  disabled={isCapturingPic}
                  className="flex items-center space-x-1.5 px-3.5 py-2 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-[#25D366]/25 active:translate-y-0.5 whitespace-nowrap cursor-pointer disabled:opacity-60"
                  title="সরাসরি সদস্যের হোয়াটসঅ্যাপ চ্যাটে স্টেটমেন্ট ও ছবি পাঠান"
                >
                  <WhatsAppIcon className="w-4 h-4 shrink-0 text-white" />
                  <span>WHATSAPP (সরাসরি চ্যাট ও ছবি)</span>
                </button>

                {/* 2. Share Image via System Share (Attaches picture directly in WhatsApp) */}
                <button 
                  type="button"
                  onClick={() => handleShareWhatsAppImage(statementMember, statementAggregatedItems, netPayable, totalMonthBill, previousDue, unitFundBill, othersFundBill, statementMonth)}
                  disabled={isCapturingPic}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-emerald-800/25 active:translate-y-0.5 whitespace-nowrap cursor-pointer disabled:opacity-60"
                  title="ছবি সরাসরি হোয়াটসঅ্যাপে শেয়ার করুন"
                >
                  <Share2 className="w-4 h-4 shrink-0 text-white" />
                  <span>ছবি সহ শেয়ার</span>
                </button>

                {/* 3. Download Pic Button */}
                <button 
                  type="button"
                  onClick={handleDownloadStatementPic}
                  disabled={isCapturingPic}
                  className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md border border-slate-700/80 active:translate-y-0.5 disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  title="স্টেটমেন্টের ছবি ডাউনলোড করুন"
                >
                  {isCapturingPic ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0 text-indigo-400" />
                  ) : (
                    <Download className="w-4 h-4 shrink-0 text-indigo-400" />
                  )}
                  <span>ছবি ডাউনলোড</span>
                </button>

                {/* 4. Print */}
                <button 
                  type="button"
                  onClick={() => window.print()} 
                  className="flex items-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-indigo-500/20 active:translate-y-0.5 whitespace-nowrap cursor-pointer"
                  title="প্রিন্ট করুন"
                >
                  <Printer className="w-4 h-4 shrink-0" />
                  <span>প্রিন্ট</span>
                </button>
              </div>

              {/* WhatsApp Notification Toast (Floating, Non-blocking) */}
              {whatsAppNotice && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] max-w-lg w-[92%] bg-slate-900/95 border border-emerald-500/50 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-[#25D366] flex items-center justify-center shrink-0">
                      <WhatsAppIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white leading-tight">
                        {whatsAppNotice}
                      </p>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        💡 টিপস: চ্যাটে 📎 (Gallery) অথবা কীবোর্ডে Paste করলেই ছবিটি সেন্ড হয়ে যাবে।
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhatsAppNotice(null)}
                    className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 shrink-0 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Modal Month Filter Bar (Hidden when printing - Bill Cat removed as requested) */}
            <div className="px-5 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center space-x-2 text-xs font-bold text-slate-300">
                <Receipt className="w-4 h-4 text-indigo-400" />
                <span>মাসিক হিসাব বিবরণী (Monthly Itemized Statement)</span>
              </div>

              {/* Month selector in statement modal */}
              <div className="flex items-center space-x-2">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-slate-400">মাস নির্বাচন:</span>
                <select
                  value={statementMonth}
                  onChange={(e) => setStatementMonth(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatBengaliMonthYear(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Statement Content Area - Exact replica of Pic 2 with Sutonny Mj font */}
            <div className="p-4 sm:p-6 overflow-y-auto bg-slate-950/40 flex-1 print:p-0 print:bg-white print:overflow-visible flex justify-center">
              <div 
                id="statement-paper-slip" 
                style={{ fontFamily: "'SutonnyMJ', 'SutonnyOMJ', 'Noto Serif Bengali', 'Tiro Bangla', 'SolaimanLipi', 'Kalpurush', serif" }}
                className="bg-white rounded-none sm:rounded-2xl p-6 sm:p-8 text-black w-full max-w-md mx-auto shadow-sm"
              >
                
                {/* Header Banner matching Pic 2 */}
                <div className="text-center mb-5">
                  <div className="flex items-center justify-center space-x-2 text-2xl sm:text-3xl font-black text-black tracking-tight">
                    <span>🍽️</span>
                    <span>ক্যাফে ইউএভি</span>
                    <span>🍽️</span>
                  </div>
                  <p className="text-sm sm:text-base font-bold text-slate-700 mt-1">
                    মাসিক বিল বিবরণী
                  </p>
                  <div className="w-full h-1 bg-black mt-4"></div>
                </div>

                {/* Statement Paper Table matching Pic 2 - Normal white cells */}
                <table className="w-full border-collapse border-2 border-black text-sm sm:text-base font-bold text-black bg-white">
                  <tbody>
                    <tr className="bg-white">
                      <td className="border border-black p-3 text-left w-1/3 bg-white font-black">মাসের নাম</td>
                      <td className="border border-black p-3 text-left font-black bg-white" colSpan={3}>
                        {formatBengaliMonthYear(statementMonth)}
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border border-black p-3 text-left bg-white font-black">পদবী ও নাম</td>
                      <td className="border border-black p-3 text-left font-black bg-white" colSpan={3}>
                        {getMemberBanglaRank(statementMember) || formatRankBn(statementMember['Rank'] || statementMember.rank || '')} {getMemberBanglaName(statementMember) || formatMemberNameBn(statementMember['Surname'] || '')}
                      </td>
                    </tr>
                    
                    {/* Heading Row: দ্রব্যের নাম , পরিমাণ , দর, মোট (Bold & Center Align) */}
                    <tr className="bg-white text-center font-black">
                      <th className="border border-black p-3 text-center font-black w-2/5 bg-white">দ্রব্যের নাম</th>
                      <th className="border border-black p-3 text-center font-black w-1/5 bg-white">পরিমাণ</th>
                      <th className="border border-black p-3 text-center font-black w-1/5 bg-white">দর</th>
                      <th className="border border-black p-3 text-center font-black w-1/5 bg-white">মোট</th>
                    </tr>

                    {/* Items Rows - All 4 columns visible: দ্রব্যের নাম, পরিমাণ, দর, মোট */}
                    {statementAggregatedItems.length === 0 ? (
                      <tr className="bg-white">
                        <td className="border border-black p-3 text-left font-bold bg-white">
                          ক্যান্টিন বিল ({formatBengaliMonthYear(statementMonth)})
                        </td>
                        <td className="border border-black p-3 text-center font-bold bg-white">১</td>
                        <td className="border border-black p-3 text-center font-bold bg-white">
                          ৳{toBengaliNum(totalMonthBill)}
                        </td>
                        <td className="border border-black p-3 text-center font-bold bg-white">
                          ৳{toBengaliNum(totalMonthBill)}
                        </td>
                      </tr>
                    ) : (
                      statementAggregatedItems.map((item, idx) => {
                        const isGeneric = isGenericCanteenBill(item.itemName);
                        const displayName = isGeneric ? `ক্যান্টিন বিল (${formatBengaliMonthYear(statementMonth)})` : formatItemNameBn(item.itemName);
                        const qty = item.qty > 0 ? item.qty : 1;
                        const rate = item.rate > 0 ? item.rate : Math.round(item.total / qty);
                        return (
                          <tr key={idx} className="bg-white">
                            <td className="border border-black p-3 text-left font-bold bg-white">{displayName}</td>
                            <td className="border border-black p-3 text-center font-bold bg-white">{toBengaliNum(qty)}</td>
                            <td className="border border-black p-3 text-center font-bold bg-white">
                              ৳{toBengaliNum(rate)}
                            </td>
                            <td className="border border-black p-3 text-center font-bold bg-white">
                              ৳{toBengaliNum(item.total)}
                            </td>
                          </tr>
                        );
                      })
                    )}

                    {/* Summary Rows - Normal white cells, no alternating grey */}
                    <tr className="bg-white">
                      <td className="border border-black p-3 text-right font-black bg-white" colSpan={3}>
                        মোট বিল
                      </td>
                      <td className="border border-black p-3 text-center font-black bg-white">
                        ৳{toBengaliNum(totalMonthBill)}
                      </td>
                    </tr>

                    {/* বকেয়া বিল (যদি ০ থাকে তাহলে Hide থাকবে) */}
                    {previousDue > 0 && (
                      <tr className="bg-white">
                        <td className="border border-black p-3 text-right font-black bg-white" colSpan={3}>
                          বকেয়া বিল
                        </td>
                        <td className="border border-black p-3 text-center font-black bg-white">
                          ৳{toBengaliNum(previousDue)}
                        </td>
                      </tr>
                    )}

                    {/* ইউনিট ফান্ড (যদি ০ থাকে তাহলে Hide থাকবে) */}
                    {unitFundBill > 0 && (
                      <tr className="bg-white">
                        <td className="border border-black p-3 text-right font-black bg-white" colSpan={3}>
                          ইউনিট ফান্ড
                        </td>
                        <td className="border border-black p-3 text-center font-black bg-white">
                          ৳{toBengaliNum(unitFundBill)}
                        </td>
                      </tr>
                    )}

                    {/* অন্যান্য (যদি ০ থাকে তাহলে Hide থাকবে) */}
                    {othersFundBill > 0 && (
                      <tr className="bg-white">
                        <td className="border border-black p-3 text-right font-black bg-white" colSpan={3}>
                          অন্যান্য
                        </td>
                        <td className="border border-black p-3 text-center font-black bg-white">
                          ৳{toBengaliNum(othersFundBill)}
                        </td>
                      </tr>
                    )}

                    {effectivePayments > 0 && (
                      <tr className="bg-white">
                        <td className="border border-black p-3 text-right font-black bg-white" colSpan={3}>
                          পরিশোধিত বিল
                        </td>
                        <td className="border border-black p-3 text-center font-black bg-white text-emerald-700">
                          -৳{toBengaliNum(effectivePayments)}
                        </td>
                      </tr>
                    )}
                    <tr className="bg-white">
                      <td className="border border-black p-3 text-right font-black bg-white" colSpan={3}>
                        সর্বমোট প্রদেয় বিল
                      </td>
                      <td className="border border-black p-3 text-center font-black text-[#e11d48] bg-white text-base sm:text-lg">
                        ৳{toBengaliNum(netPayable)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pay Bill Modal (Direct from card's Right Side "PAY BILL" button) */}
      {payBillMember && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight">SETTLE ACCOUNT</h3>
                <p className="text-[10px] text-slate-400 uppercase font-bold">{payBillMember['Rank']} {payBillMember['Surname']}</p>
              </div>
              <button onClick={() => setPayBillMember(null)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Due Amount</p>
              <p className="text-3xl font-black text-rose-500 font-mono">
                ৳{(getMemberTotalDue(payBillMember, payBillCategory || selectedCategory) || payBillMember.Due || payBillMember.baki || 0).toLocaleString()}
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Payment Amount (৳)
                </label>
                <input 
                  type="number"
                  placeholder="0.00"
                  value={payAmount ?? ""}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-lg font-black font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Payment Method
                </label>
                <div className="flex space-x-2">
                  <button 
                    type="button"
                    onClick={() => setPayMethod('UCB')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${payMethod === 'UCB' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    UCB
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPayMethod('CASH')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${payMethod === 'CASH' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                  >
                    CASH
                  </button>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleSettleAccount}
                disabled={isSubmittingPayment || !payAmount || Number(payAmount) <= 0}
                className="w-full mt-4 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-lg shadow-emerald-950/50 flex items-center justify-center space-x-2 cursor-pointer active:translate-y-0.5"
              >
                {isSubmittingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>পেমেন্ট নিশ্চিত করা হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>CONFIRM PAYMENT</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Payment Success Confirmation Modal with Celebration Animation */}
      {paymentSuccessData && (
        <div 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[90] flex items-center justify-center p-4 animate-in fade-in duration-300"
          onClick={() => setPaymentSuccessData(null)}
        >
          <div 
            className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/50 rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md shadow-[0_0_60px_-10px_rgba(16,185,129,0.45),0_25px_50px_-12px_rgba(0,0,0,0.85)] animate-success-pop relative overflow-hidden text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dynamic Celebration Confetti Particles radiating outward */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {[
                { tx: '-120px', ty: '-140px', tr: '240deg', color: 'bg-emerald-400', size: 'w-2.5 h-2.5 rounded-full', delay: '0.05s' },
                { tx: '130px', ty: '-150px', tr: '380deg', color: 'bg-amber-400', size: 'w-2 h-3 rounded-sm', delay: '0.08s' },
                { tx: '-80px', ty: '-180px', tr: '190deg', color: 'bg-cyan-400', size: 'w-3 h-2 rounded-sm', delay: '0.1s' },
                { tx: '90px', ty: '-190px', tr: '420deg', color: 'bg-teal-300', size: 'w-2.5 h-2.5 rounded-full', delay: '0.02s' },
                { tx: '-160px', ty: '-90px', tr: '160deg', color: 'bg-yellow-300', size: 'w-2 h-2.5 rounded-sm', delay: '0.12s' },
                { tx: '150px', ty: '-80px', tr: '300deg', color: 'bg-emerald-300', size: 'w-3 h-3 rounded-full', delay: '0.07s' },
                { tx: '-50px', ty: '-210px', tr: '280deg', color: 'bg-indigo-400', size: 'w-2 h-3 rounded-sm', delay: '0.15s' },
                { tx: '40px', ty: '-220px', tr: '340deg', color: 'bg-pink-400', size: 'w-2.5 h-2.5 rounded-full', delay: '0.04s' },
                { tx: '-140px', ty: '-40px', tr: '210deg', color: 'bg-amber-300', size: 'w-2.5 h-2.5 rounded-full', delay: '0.18s' },
                { tx: '140px', ty: '-30px', tr: '400deg', color: 'bg-teal-400', size: 'w-3 h-2 rounded-sm', delay: '0.11s' },
                { tx: '-100px', ty: '-120px', tr: '170deg', color: 'bg-emerald-400', size: 'w-2 h-2 rounded-full', delay: '0.06s' },
                { tx: '110px', ty: '-110px', tr: '310deg', color: 'bg-cyan-300', size: 'w-2.5 h-3 rounded-sm', delay: '0.14s' },
                { tx: '-20px', ty: '-170px', tr: '260deg', color: 'bg-yellow-400', size: 'w-3 h-2 rounded-sm', delay: '0.09s' },
                { tx: '20px', ty: '-180px', tr: '350deg', color: 'bg-emerald-200', size: 'w-2 h-2 rounded-full', delay: '0.16s' },
                { tx: '-180px', ty: '-110px', tr: '200deg', color: 'bg-teal-200', size: 'w-2.5 h-2.5 rounded-sm', delay: '0.13s' },
                { tx: '170px', ty: '-120px', tr: '390deg', color: 'bg-amber-400', size: 'w-2 h-2.5 rounded-full', delay: '0.03s' },
                { tx: '-60px', ty: '-130px', tr: '150deg', color: 'bg-cyan-400', size: 'w-2.5 h-2.5 rounded-full', delay: '0.17s' },
                { tx: '70px', ty: '-140px', tr: '330deg', color: 'bg-emerald-400', size: 'w-3 h-2 rounded-sm', delay: '0.05s' },
                { tx: '-110px', ty: '-200px', tr: '270deg', color: 'bg-lime-400', size: 'w-2 h-3 rounded-sm', delay: '0.19s' },
                { tx: '100px', ty: '-210px', tr: '360deg', color: 'bg-sky-400', size: 'w-2.5 h-2.5 rounded-full', delay: '0.08s' }
              ].map((p, idx) => (
                <div
                  key={idx}
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${p.size} ${p.color} animate-confetti-particle shadow-sm`}
                  style={{
                    '--tx': p.tx,
                    '--ty': p.ty,
                    '--tr': p.tr,
                    animationDelay: p.delay
                  } as React.CSSProperties}
                />
              ))}
            </div>

            {/* Glowing Backdrop Aura */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/25 rounded-full blur-3xl pointer-events-none"></div>

            {/* Close Button Top Right */}
            <button
              type="button"
              onClick={() => setPaymentSuccessData(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer z-10"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Animated Checkmark Circle with Radial Pulse Waves */}
            <div className="relative w-24 h-24 mx-auto mb-5 flex items-center justify-center">
              {/* Outer expanding pulse wave 1 */}
              <div className="absolute inset-0 rounded-full bg-emerald-500/30 animate-pulse-expand pointer-events-none"></div>
              {/* Outer expanding pulse wave 2 */}
              <div 
                className="absolute inset-0 rounded-full bg-teal-400/25 animate-pulse-expand pointer-events-none" 
                style={{ animationDelay: '0.4s' }}
              ></div>

              {/* Main Glowing Circle */}
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 via-emerald-500 to-teal-400 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.6),inset_0_2px_4px_rgba(255,255,255,0.4)] border-2 border-emerald-300/40">
                <svg
                  className="w-10 h-10 text-white drop-shadow-md"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" className="animate-checkmark-draw" />
                </svg>
              </div>

              {/* Sparkle Badges */}
              <Sparkles className="absolute -top-1 -right-1 w-6 h-6 text-amber-300 animate-bounce" />
              <Sparkles className="absolute -bottom-1 -left-1 w-5 h-5 text-emerald-300 animate-pulse" />
            </div>

            {/* Title & Celebration Heading */}
            <div className="space-y-1 mb-4">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>বিল পরিশোধ সফল হয়েছে</span>
              </span>
              <h3 className="text-2xl font-black text-white tracking-tight">
                Payment Confirmed!
              </h3>
            </div>

            {/* Paid Amount Display Card with Emerald Glow */}
            <div className="my-4 py-4 px-5 bg-gradient-to-r from-emerald-950/80 via-slate-900 to-emerald-950/80 rounded-2xl border border-emerald-500/40 shadow-inner">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300 mb-0.5">
                পরিশোধকৃত পরিমাণ (Amount Paid)
              </p>
              <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-400 tracking-tight flex items-center justify-center space-x-1">
                <span>৳</span>
                <span>{paymentSuccessData.paidAmount.toLocaleString()}</span>
              </div>
              <div className="mt-2 flex items-center justify-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[11px] font-black uppercase font-mono border border-emerald-500/30 inline-flex items-center space-x-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>{paymentSuccessData.method} PAYMENT</span>
                </span>
                <span className="text-[11px] font-bold text-slate-400">
                  • {paymentSuccessData.category}
                </span>
              </div>
            </div>

            {/* Member Identity & Ledger Adjustment Breakdown */}
            <div className="space-y-2 text-left bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-xs font-bold">
              {/* Member Row */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center space-x-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 text-xs font-black text-indigo-400">
                    {paymentSuccessData.dp ? (
                      <img src={paymentSuccessData.dp} alt={paymentSuccessData.surname} className="w-full h-full object-cover" />
                    ) : (
                      (paymentSuccessData.surname || 'U').charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-indigo-300 uppercase font-mono mr-1.5">{paymentSuccessData.rank}</span>
                    <span className="text-white font-black truncate">{paymentSuccessData.surname}</span>
                  </div>
                </div>
                <span className="font-mono text-slate-400 text-xs shrink-0">
                  BD/{paymentSuccessData.bdNo}
                </span>
              </div>

              {/* Due Balance Shift Row */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">পূর্বে মোট বকেয়া:</span>
                <span className="font-mono text-slate-300 line-through">৳{paymentSuccessData.previousDue.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-black">বর্তমান অবশিষ্ট বকেয়া:</span>
                <span className={`font-mono text-base font-black ${paymentSuccessData.newDue === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {paymentSuccessData.newDue === 0 ? '৳০ (সম্পূর্ণ পরিশোধিত)' : `৳${paymentSuccessData.newDue.toLocaleString()}`}
                </span>
              </div>

              {/* Transaction Reference & Date */}
              <div className="flex items-center justify-between pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-500 font-mono">
                <span>TX: {paymentSuccessData.txId.slice(0, 14)}...</span>
                <span>{paymentSuccessData.date}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-5 flex items-center space-x-3">
              <button
                type="button"
                onClick={() => {
                  const m = members.find(mem => String(mem['BD No'] || mem.airman_id || '').replace(/\D/g, '') === paymentSuccessData.bdNo);
                  setPaymentSuccessData(null);
                  if (m) openStatement(m);
                }}
                className="flex-1 py-3 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-slate-700 flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm active:translate-y-0.5"
              >
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>রসিদ / হিসাব</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentSuccessData(null)}
                className="flex-1 py-3 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-emerald-900/40 flex items-center justify-center space-x-1.5 cursor-pointer active:translate-y-0.5"
              >
                <span>সম্পন্ন (DONE)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Dynamic Auto-dismiss Progress Bar */}
            <div className="mt-4 w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full animate-countdown-bar rounded-full"></div>
            </div>
          </div>
        </div>
      )}



      {/* Remove History Tx Confirm Modal */}
      <AnimatePresence>
        {txDeleteConfirmId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-800 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
              <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-rose-500/30 shadow-inner">
                <Trash2 className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">
                {txDeleteConfirmId.type === 'BILL PAYMENT' ? 'Revert Payment?' : 'Remove Record?'}
              </h3>
              <p className="text-sm font-bold text-slate-400 mb-6">
                {txDeleteConfirmId.type === 'BILL PAYMENT'
                  ? `Are you sure you want to revert this payment of ৳${txDeleteConfirmId.amount}? Member Due will be restored, and it will remain recorded as a Reverted Payment in History.`
                  : 'Are you sure you want to remove this transaction record? Due will be reversed.'}
              </p>
              
              <div className="flex space-x-3">
                <button 
                  type="button"
                  onClick={() => setTxDeleteConfirmId(null)} 
                  className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  CANCEL
                </button>
                <button 
                  type="button"
                  onClick={() => handleRemoveTx(txDeleteConfirmId)} 
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-xs font-black tracking-widest hover:bg-rose-500 transition-all shadow-md shadow-rose-500/30 active:scale-95 cursor-pointer"
                >
                  {txDeleteConfirmId.type === 'BILL PAYMENT' ? 'REVERT PAYMENT' : 'REMOVE'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contact Action Modal (Direct Phone Call / WhatsApp Message) */}
      {contactActionMember && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[85] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setContactActionMember(null)}
        >
          <div 
            className="bg-slate-900 border border-slate-700/80 rounded-[2rem] p-6 w-full max-w-md shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-200 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top decorative gradient glow */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-indigo-500"></div>

            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {contactActionMember.DP ? (
                    <img
                      src={resolveImageUrl(contactActionMember.DP)}
                      alt={contactActionMember['Surname']}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="font-black text-lg text-emerald-400">
                      {(contactActionMember['Surname'] || 'U').charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-1.5 mb-0.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
                      {contactActionMember['Rank']}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-slate-400">
                      BD/{contactActionMember['BD No'] || contactActionMember.airman_id?.replace(/\D/g, '') || '-'}
                    </span>
                  </div>
                  <h3 className="font-black text-white text-base leading-tight">
                    {contactActionMember['Surname']}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setContactActionMember(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Phone Number Display Box with Copy Button */}
            <div className="my-5 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">যোগাযোগের নম্বর (Phone / Mobile)</p>
                  <p className="text-lg font-black font-mono text-emerald-400 truncate tracking-wide">
                    {contactActionMember.Contact || contactActionMember['Mobile No']}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const num = String(contactActionMember.Contact || contactActionMember['Mobile No'] || '');
                  if (num) {
                    navigator.clipboard.writeText(num);
                    setCopiedPhone(true);
                    setTimeout(() => setCopiedPhone(false), 2000);
                  }
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-black inline-flex items-center space-x-1.5 transition-all cursor-pointer ${
                  copiedPhone 
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/30' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                }`}
                title="Copy Number to Clipboard"
              >
                {copiedPhone ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>কপি হয়েছে</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>কপি</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Balance/Due Status Notice */}
            {(() => {
              const due = getMemberTotalDue(contactActionMember, selectedCategory);
              return (
                <div className="mb-5 px-3.5 py-2.5 bg-slate-800/50 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">বর্তমান বকেয়া (Total Due):</span>
                  <span className={`font-mono font-black ${due > 0 ? 'text-rose-400 text-sm' : 'text-emerald-400 text-sm'}`}>
                    ৳{due.toLocaleString()}
                  </span>
                </div>
              );
            })()}

            {/* Direct Action Buttons: Call & WhatsApp */}
            <div className="space-y-3">
              {/* Direct Phone Call Button */}
              <a
                href={getTelHref(contactActionMember.Contact || contactActionMember['Mobile No'])}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center space-x-2.5 shadow-lg shadow-emerald-900/40 border-t border-emerald-300/40 active:translate-y-0.5 transition-all group/call"
              >
                <PhoneCall className="w-5 h-5 shrink-0 group-hover/call:scale-110 transition-transform" />
                <span>সরাসরি কল করুন (Phone Call)</span>
              </a>

              {/* WhatsApp Message Button */}
              {(() => {
                const due = getMemberTotalDue(contactActionMember, selectedCategory);
                return (
                  <a
                    href={getWhatsAppHref(
                      contactActionMember.Contact || contactActionMember['Mobile No'],
                      `${contactActionMember['Rank'] || ''} ${contactActionMember['Surname'] || ''}`.trim(),
                      due
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-4 bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-2xl text-sm font-black uppercase tracking-wider flex items-center justify-center space-x-2.5 shadow-lg shadow-teal-900/40 border-t border-teal-300/40 active:translate-y-0.5 transition-all group/wa"
                  >
                    <MessageCircle className="w-5 h-5 shrink-0 group-hover/wa:scale-110 transition-transform" />
                    <span>হোয়াটসঅ্যাপ মেসেজ পাঠান (WhatsApp)</span>
                  </a>
                );
              })()}
            </div>

            {/* Close / Cancel Button */}
            <button
              type="button"
              onClick={() => setContactActionMember(null)}
              className="w-full mt-4 py-2.5 bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer border border-slate-700/60"
            >
              বন্ধ করুন (Close)
            </button>
          </div>
        </div>
      )}

      {/* Bulk Import Initial Bills Modal */}
      {isImportBillsModalOpen && (
        <BulkImportInitialBillsModal
          isOpen={isImportBillsModalOpen}
          onClose={() => setIsImportBillsModalOpen(false)}
          members={members}
          selectedMonth={selectedMonth}
          initialTab={importModalInitialTab}
          allTxs={allTxs}
          onSuccess={(updatedList) => {
            setMembers(formatAndSortMembers(updatedList));
            try {
              const freshTxs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
              setAllTxs(freshTxs);
            } catch {}
          }}
        />
      )}

      {/* Set Initial Bill Modal (Single Member) */}
      {initialBillMember && (
        <SetInitialBillModal
          isOpen={!!initialBillMember}
          onClose={() => setInitialBillMember(null)}
          member={initialBillMember}
          initialMonth={selectedMonth !== 'ALL' ? selectedMonth : getRunningMonthKey()}
          allTxs={allTxs}
          onSuccess={(updatedMember) => {
            setMembers((prev) =>
              prev.map((m) =>
                m.airman_id === updatedMember.airman_id || m['BD No'] === updatedMember['BD No']
                  ? updatedMember
                  : m
              )
            );
            if (globalMembersCache) {
              globalMembersCache = globalMembersCache.map((m: any) =>
                m.airman_id === updatedMember.airman_id || m['BD No'] === updatedMember['BD No']
                  ? updatedMember
                  : m
              );
            }
            try {
              const freshTxs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
              setAllTxs(freshTxs);
              if (profileMember && (profileMember.airman_id === updatedMember.airman_id || profileMember['BD No'] === updatedMember['BD No'])) {
                setProfileMember(updatedMember);
                setProfileTx(filterMemberTxs(updatedMember, freshTxs));
              }
              if (statementMember && (statementMember.airman_id === updatedMember.airman_id || statementMember['BD No'] === updatedMember['BD No'])) {
                setStatementMember(updatedMember);
                setStatementTx(filterMemberTxs(updatedMember, freshTxs));
              }
            } catch {}
          }}
        />
      )}

      {/* Printable Canteen Bill Modal (Office App Style Print Preview, PDF & Excel) */}
      {isPrintModalOpen && (
        <PrintableCanteenBillModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          members={members}
          allTxs={allTxs}
          selectedCategory={selectedCategory}
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />
      )}

      {/* Payment History Modal */}
      {isPaymentHistoryOpen && (
        <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                    <span>Payment History</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                      {allPaymentTxs.length}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    সকল সদস্যের বিল পরিশোধের তালিকা এবং পেমেন্ট বাতিল ব্যবস্থা
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentHistoryOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Stats Bar */}
            <div className="p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="সদস্যের নাম, বিডি নম্বর, তারিখ দিয়ে খুঁজুন..."
                  value={paymentSearch}
                  onChange={(e) => setPaymentSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              {/* Month Selector, Quick Method Filters & Total Summary */}
              <div className="flex flex-wrap items-center gap-2 shrink-0 justify-between sm:justify-end">
                {/* Month Dropdown with default Running Month */}
                <div className="flex items-center space-x-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <select
                    value={paymentMonthFilter}
                    onChange={(e) => setPaymentMonthFilter(e.target.value)}
                    className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer"
                  >
                    <option value="ALL" className="bg-slate-900 text-white">সব মাস (All Months)</option>
                    {availableMonths.map((m) => (
                      <option key={m} value={m} className="bg-slate-900 text-white">
                        {formatBengaliMonthYear(m)} {m === getRunningMonthKey() ? '(চলতি মাস)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Method Buttons with Total Numbers */}
                <div className="flex items-center bg-slate-950 rounded-xl p-0.5 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPaymentMethodFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center space-x-1 ${
                      paymentMethodFilter === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>ALL</span>
                    <span className="opacity-90 font-mono">({paymentCountsByMethod.allCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethodFilter('CASH')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center space-x-1 ${
                      paymentMethodFilter === 'CASH'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>CASH</span>
                    <span className="opacity-90 font-mono">({paymentCountsByMethod.cashCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethodFilter('UCB')}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer flex items-center space-x-1 ${
                      paymentMethodFilter === 'UCB'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <span>UCB</span>
                    <span className="opacity-90 font-mono">({paymentCountsByMethod.ucbCount})</span>
                  </button>
                </div>

                {/* মোট আদায় অনুযায়ী আপডেট */}
                <div className="px-3 py-1 bg-emerald-950/60 border border-emerald-500/30 rounded-xl flex items-center space-x-1.5 text-xs">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">মোট আদায়:</span>
                  <span className="text-emerald-400 font-mono font-black">৳{totalPaymentsAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Payments List Area */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-2.5 divide-y divide-slate-800/60">
              {filteredPaymentTxs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Receipt className="w-10 h-10 mx-auto text-slate-600 opacity-60" />
                  <p className="text-sm font-bold text-slate-400">কোনো পেমেন্ট হিস্ট্রি পাওয়া যায়নি</p>
                  <p className="text-xs text-slate-500">
                    {paymentSearch ? 'অনুসন্ধানের সাথে কোনো রেকর্ড মিলছে না।' : 'এখনও পর্যন্ত কোনো বিল পেমেন্ট জমা হয়নি।'}
                  </p>
                </div>
              ) : (
                filteredPaymentTxs.map((tx: any, idx: number) => {
                  const targetMember = members.find((m: any) => {
                    const txBdClean = String(tx.bdNo || tx.airman_id || '').replace(/\D/g, '');
                    const mBdClean = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
                    return (tx.airman_id && m.airman_id === tx.airman_id) || (txBdClean && mBdClean === txBdClean);
                  });
                  const memberEffectiveDp = targetMember ? getMemberEffectiveDp(targetMember) : '';
                  const rank = String(tx.rank || targetMember?.Rank || targetMember?.rank || '').trim();
                  const rawName = String(tx.memberName || (targetMember ? `${targetMember.Surname || ''}` : 'সদস্য')).trim();
                  let cleanName = rawName;
                  if (rank && cleanName.toLowerCase().startsWith(rank.toLowerCase())) {
                    cleanName = cleanName.slice(rank.length).trim();
                  }
                  const displayName = rank ? `${rank} ${cleanName}` : cleanName;
                  const cleanBd = String(tx.bdNo || targetMember?.['BD No'] || tx.airman_id || '').replace(/\D/g, '');
                  const currentMemberDue = targetMember ? getMemberTotalDue(targetMember, 'ALL') : 0;

                  return (
                    <div
                      key={tx.id || idx}
                      className="pt-2.5 first:pt-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-950/40 hover:bg-slate-800/40 border border-slate-800/60 rounded-2xl transition-colors"
                    >
                      {/* Left: Member Info & Avatar */}
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <span className="text-[10px] font-mono text-slate-500 font-bold shrink-0 w-6 text-center">
                          #{idx + 1}
                        </span>

                        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 overflow-hidden text-indigo-400">
                          {memberEffectiveDp ? (
                            <img
                              src={resolveImageUrl(memberEffectiveDp)}
                              alt={displayName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <Users className="w-5 h-5 text-indigo-300" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                              {displayName}
                            </h4>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-slate-800 text-slate-400 font-bold">
                              BD/{cleanBd}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                            <span className="font-mono text-indigo-300 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {toEnglishDate(tx.date)}
                            </span>
                            <span>•</span>
                            <span className="text-slate-400 truncate max-w-[240px]">
                              {tx.items || 'বিল পরিশোধ'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Paid Amount, Gateway & Delete Action */}
                      <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 pl-9 sm:pl-0">
                        <div className="text-right">
                          <p className={`text-sm sm:text-base font-black font-mono leading-tight ${
                            tx.isReverted || tx.status === 'REVERTED' ? 'text-rose-400 line-through' : 'text-emerald-400'
                          }`}>
                            {tx.isReverted || tx.status === 'REVERTED' ? '৳' : '+৳'}{Number(tx.amount || 0).toLocaleString()}
                          </p>
                          <div className="flex items-center space-x-1.5 justify-end mt-0.5">
                            {tx.isReverted || tx.status === 'REVERTED' ? (
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-rose-950/80 text-rose-300 border border-rose-500/40 font-mono">
                                বাতিলকৃত / REVERTED
                              </span>
                            ) : (
                              <span className="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                                {tx.gateway || 'CASH'}
                              </span>
                            )}
                            <span className="text-[9px] text-slate-500 font-mono">
                              বর্তমান বকেয়া: ৳{currentMemberDue.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Delete / Revert Status Button */}
                        {tx.isReverted || tx.status === 'REVERTED' ? (
                          <span className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-500 text-xs font-mono font-bold">
                            বাতিলকৃত
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPaymentToDelete({ ...tx, targetMember })}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-white border border-rose-900/50 flex items-center space-x-1 text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-xs"
                            title="এই পেমেন্ট বাতিল করুন (সদস্যের বকেয়া আগের অবস্থায় ফিরে যাবে এবং হিস্টোরিতে সংরক্ষিত থাকবে)"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            <span className="text-[11px]">Revert</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400 shrink-0">
              <span className="text-[11px]">
                পেমেন্ট মুছে দিলে সংশ্লিষ্ট সদস্যের বকেয়া (Due) স্বয়ংক্রিয়ভাবে আগের অবস্থায় ফিরে যায়।
              </span>
              <button
                type="button"
                onClick={() => setIsPaymentHistoryOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Delete Confirmation Dialog */}
      <AnimatePresence>
        {paymentToDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[220] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.88, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 28 }}
              className="bg-slate-900 border border-rose-500/50 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 mx-auto">
                <AlertCircle className="w-7 h-7 animate-pulse" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  পেমেন্ট বাতিল নিশ্চিত করুন
                </h3>
                <p className="text-xs text-slate-400">
                  আপনি কি নিশ্চিত যে আপনি এই পেমেন্ট রেকর্ডটি মুছে ফেলতে চান?
                </p>
              </div>

              {/* Transaction Summary Card */}
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">সদস্যের নাম:</span>
                  <span className="font-bold text-white">{paymentToDelete.memberName || 'সদস্য'}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">বিডি নম্বর (BD No):</span>
                  <span className="font-mono font-bold text-white">BD/{String(paymentToDelete.bdNo || '').replace(/\D/g, '')}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">পরিশোধের তারিখ:</span>
                  <span className="font-mono text-indigo-300">{toEnglishDate(paymentToDelete.date)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400">পরিশোধের মাধ্যম:</span>
                  <span className="font-bold text-slate-200">{paymentToDelete.gateway || 'CASH'}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm">
                  <span className="font-bold text-slate-300">পরিশোধিত অর্থ (Amount):</span>
                  <span className="font-mono font-black text-emerald-400 text-base">
                    ৳{Number(paymentToDelete.amount || 0).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Consequence Notice */}
              <div className="p-3 bg-rose-950/50 border border-rose-800/60 rounded-xl text-[11px] text-rose-200 space-y-1 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 text-rose-300">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>বকেয়া পুনর্বহাল বিজ্ঞপ্তি:</span>
                </p>
                <p>
                  পেমেন্ট মুছে দিলে সদস্যের বকেয়া (Due) অবিলম্বে <strong>৳{Number(paymentToDelete.amount || 0).toLocaleString()} বৃদ্ধি পেয়ে পূর্বের অবস্থায় ফিরে যাবে</strong> এবং ক্লাউডেও স্বয়ংক্রিয়ভাবে আপডেট হবে।
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingPayment}
                  onClick={() => setPaymentToDelete(null)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-50 active:scale-95"
                >
                  ফিরে যান (Cancel)
                </button>

                <button
                  type="button"
                  disabled={isDeletingPayment}
                  onClick={handleConfirmDeletePayment}
                  className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-lg shadow-rose-900/50 disabled:opacity-50 active:scale-95"
                >
                  {isDeletingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>মুছে ফেলা হচ্ছে...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>হ্যাঁ, বাতিল করুন</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Manager Management Modal (Moved from Settings to Member DB - PIN removed) */}
        {showManagerModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[160] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col space-y-5">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-tight">
                      CANTEEN MANAGER MANAGEMENT
                    </h3>
                    <p className="text-xs text-slate-400">
                      সক্রিয় ক্যান্টিন ম্যানেজার নির্বাচন ও তথ্য বিবরণী
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowManagerModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Current Active Manager Card */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-indigo-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                  {canteenConfig?.adminImage ? (
                    <img
                      src={resolveImageUrl(canteenConfig.adminImage)}
                      alt={canteenConfig.managerName || 'Manager'}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  ) : (
                    <span className="font-black text-white text-2xl">
                      {(canteenConfig?.managerName || 'M').charAt(0)}
                    </span>
                  )}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase tracking-wider">
                      CURRENT ACTIVE MANAGER
                    </span>
                    {canteenConfig?.managerBdNo && (
                      <span className="text-[10px] font-mono text-slate-400">
                        BD: {canteenConfig.managerBdNo}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-black text-white truncate">
                    {canteenConfig?.managerName || 'No Manager Set Yet'}
                  </h4>
                  <div className="text-xs text-slate-300 font-mono">
                    {canteenConfig?.phone ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{canteenConfig.phone}</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">No contact phone</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Member Selection Section */}
              <div className="flex-1 overflow-hidden flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-300 uppercase tracking-wider">
                    SELECT NEW MANAGER FROM MEMBER DATABASE
                  </label>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">
                    {members.length} Members
                  </span>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={managerSearchTerm}
                    onChange={(e) => setManagerSearchTerm(e.target.value)}
                    placeholder="Search by BD No, Rank, or Surname..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  {managerSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setManagerSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Filtered Members List */}
                <div className="flex-1 overflow-y-auto max-h-60 divide-y divide-slate-800/80 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-2 space-y-1">
                  {members
                    .filter((m) => {
                      if (!managerSearchTerm.trim()) return true;
                      const term = managerSearchTerm.toLowerCase().trim();
                      const bd = String(m['BD No'] || '').toLowerCase();
                      const name = String(m['Surname'] || '').toLowerCase();
                      const rank = String(m['Rank'] || '').toLowerCase();
                      return bd.includes(term) || name.includes(term) || rank.includes(term);
                    })
                    .slice(0, 60)
                    .map((m) => {
                      const isCurrent = String(m['BD No']).trim() === String(canteenConfig?.managerBdNo).trim();
                      return (
                        <div key={m.airman_id || m['BD No']} className="p-2.5 flex items-center justify-between gap-3 hover:bg-slate-900/70 rounded-xl transition-colors">
                          <div className="flex items-center space-x-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400 overflow-hidden shrink-0">
                              {m.DP ? (
                                <img src={resolveImageUrl(m.DP)} alt="" className="w-full h-full object-cover" />
                              ) : (
                                (m['Surname'] || 'U').charAt(0)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">
                                {m['Rank']} {m['Surname']}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400">
                                BD: {m['BD No']} {m.Contact ? `• ${m.Contact}` : ''}
                              </p>
                            </div>
                          </div>

                          {isCurrent ? (
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black uppercase shrink-0">
                              Active Manager
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                handleAssignManager(m);
                                setShowManagerModal(false);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                            >
                              Set as Manager
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Footer info */}
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
                <span>ম্যানেজার পরিবর্তন তথ্য রিয়েল-টাইমে ক্লাউডে সংরক্ষিত হবে।</span>
                <button
                  type="button"
                  onClick={() => setShowManagerModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </AnimatePresence>
    </div>
  );
};

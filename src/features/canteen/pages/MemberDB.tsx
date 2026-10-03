import React, { useState, useEffect, useMemo } from 'react';
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
  Users
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl, getCanteenConfig } from '../utils/canteenSettings';
import { processGalleryImage } from '../utils/imageUpload';
import { formatCanteenDate } from '../utils/dateUtils';
import { SaveButton } from '../components/SaveButton';
import { BulkImportInitialBillsModal } from '../components/BulkImportInitialBillsModal';
import { SetInitialBillModal } from '../components/SetInitialBillModal';
import { PrintableCanteenBillModal } from '../components/PrintableCanteenBillModal';
import { restoreRawStockForSaleCancellation } from '../utils/recipeManager';
import { pushKeyToCloud } from '../utils/canteenCloudSync';
import { exportCanteenBillToExcel } from '../utils/exportCanteenBillExcel';
import { sortCanteenMembersByOfficeSeniority } from '../utils/canteenSeniority';

export type BillCategory = 'ALL' | 'CANTEEN' | 'UNIT_FUND' | 'OTHERS';

// Extract YYYY-MM from date string
export const getTxMonthKey = (dateStr: any): string => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
    const parts = String(dateStr).split(/[\/\-\s]/);
    if (parts.length >= 3) {
      if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}`;
      if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}`;
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
  if (!monthKey || monthKey === 'ALL') return 'All Months';
  const parts = monthKey.split('-');
  if (parts.length < 2) return monthKey;
  const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
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
  if (desc.includes('unit fund') || desc.includes('unit_fund')) return 'UNIT_FUND';
  if (desc.includes('others') || desc.includes('other bill')) return 'OTHERS';
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

export const MemberDB: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BillCategory>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [onlyWithBill, setOnlyWithBill] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'BOX' | 'TABLE'>('BOX');

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
    try {
      const cached = localStorage.getItem('canteen_members_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    try {
      const cached = localStorage.getItem('canteen_members_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch {}
    return true;
  });

  // Member DP resolution state for profile edit
  const [resolvingDp, setResolvingDp] = useState(false);

  // Profile Modal state
  const [profileMember, setProfileMember] = useState<any | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavedProfile, setIsSavedProfile] = useState(false);
  const [editMemberData, setEditMemberData] = useState({ bdNo: '', rank: '', surname: '', contact: '', dp: '', role: 'Member', due: 0 });
  const [profileTx, setProfileTx] = useState<any[]>([]);

  // Initial Bill Modals state
  const [isImportBillsModalOpen, setIsImportBillsModalOpen] = useState(false);
  const [importModalInitialTab, setImportModalInitialTab] = useState<'FILE' | 'PASTE' | 'HISTORY'>('FILE');
  const [initialBillMember, setInitialBillMember] = useState<any | null>(null);

  // Statement Modal state
  const [statementMember, setStatementMember] = useState<any | null>(null);
  const [statementTx, setStatementTx] = useState<any[]>([]);
  const [statementCategory, setStatementCategory] = useState<BillCategory>('ALL');
  const [statementMonth, setStatementMonth] = useState<string>(() => getRunningMonthKey());

  // Menu catalog prices cache for accurate item rate calculations
  const [menuCatalog, setMenuCatalog] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('canteen_menu_cache');
      if (cached) return JSON.parse(cached);
    } catch {}
    return [];
  });

  useEffect(() => {
    const fetchMenuCatalog = async () => {
      try {
        const { data, error } = await supabase.from('Canteen_Menu').select('*');
        if (!error && data && data.length > 0) {
          setMenuCatalog(data);
          localStorage.setItem('canteen_menu_cache', JSON.stringify(data));
        }
      } catch (err) {
        console.warn('Could not fetch Canteen_Menu:', err);
      }
    };
    fetchMenuCatalog();
  }, []);

  const getMenuItemPrice = (name: string): number => {
    return lookupCatalogPrice(name, menuCatalog);
  };

  // Pay Bill Modal state
  const [payBillMember, setPayBillMember] = useState<any | null>(null);
  const [payBillCategory, setPayBillCategory] = useState<'ALL' | 'CANTEEN' | 'UNIT_FUND' | 'OTHERS'>('ALL');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'UCB'>('CASH');

  // Deletion modals
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [txDeleteConfirmId, setTxDeleteConfirmId] = useState<any | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const toEnglishDate = formatCanteenDate;

  // Listen to transaction updates
  useEffect(() => {
    const handleTxsSync = () => {
      try {
        setAllTxs(JSON.parse(localStorage.getItem('canteen_txs') || '[]'));
      } catch {}
    };
    window.addEventListener('canteen_txs_updated', handleTxsSync);
    window.addEventListener('canteen_state_updated', handleTxsSync);
    window.addEventListener('storage', handleTxsSync);
    return () => {
      window.removeEventListener('canteen_txs_updated', handleTxsSync);
      window.removeEventListener('canteen_state_updated', handleTxsSync);
      window.removeEventListener('storage', handleTxsSync);
    };
  }, []);

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
      const m = getTxMonthKey(tx.date);
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

  // Calculate bill for a member given selected category and month
  const getMemberFilteredBill = (member: any, category: BillCategory, month: string) => {
    const memberTxs = allTxs.filter(
      (tx) => tx.airman_id === member.airman_id || (member['BD No'] && tx.bdNo === member['BD No'])
    );

    if (category === 'ALL' && month === 'ALL') {
      const totalMemberDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
      const allCharges = memberTxs
        .filter((tx) => tx.type !== 'BILL PAYMENT')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const allPayments = memberTxs
        .filter((tx) => tx.type === 'BILL PAYMENT')
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const netTxBill = Math.max(0, allCharges - allPayments);
      return Math.max(totalMemberDue, netTxBill);
    }

    const matchingTxs = memberTxs.filter((tx) => {
      const cat = getTxCategory(tx);
      const catMatch = category === 'ALL' || cat === category;
      const txMonth = getTxMonthKey(tx.date);
      const monthMatch = month === 'ALL' || txMonth === month;
      return catMatch && monthMatch;
    });

    const charges = matchingTxs
      .filter((tx) => tx.type !== 'BILL PAYMENT')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const payments = matchingTxs
      .filter((tx) => tx.type === 'BILL PAYMENT')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

    const txBill = Math.max(0, charges - payments);

    if (month === 'ALL') {
      if (category === 'CANTEEN') {
        const unitFundDue = memberTxs
          .filter((tx) => getTxCategory(tx) === 'UNIT_FUND')
          .reduce((sum, tx) => sum + (tx.type === 'BILL PAYMENT' ? -Number(tx.amount || 0) : Number(tx.amount || 0)), 0);
        const othersDue = memberTxs
          .filter((tx) => getTxCategory(tx) === 'OTHERS')
          .reduce((sum, tx) => sum + (tx.type === 'BILL PAYMENT' ? -Number(tx.amount || 0) : Number(tx.amount || 0)), 0);
        const totalMemberDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
        const baseCanteenDue = Math.max(0, totalMemberDue - Math.max(0, unitFundDue) - Math.max(0, othersDue));
        return Math.max(txBill, baseCanteenDue);
      }
      return txBill;
    }

    return txBill;
  };

  // Direct Pay Bill opener
  const openPayBill = (member: any) => {
    setPayBillMember(member);
    setPayBillCategory(selectedCategory);
    const displayed = getMemberFilteredBill(member, selectedCategory, selectedMonth);
    const totalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
    const initialAmt = displayed > 0 ? displayed : totalDue;
    setPayAmount(initialAmt > 0 ? String(initialAmt) : '');
    setPayMethod('CASH');
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
    setStatementMember({ ...member, DP: effDp || member['DP'] || '' });
    setStatementCategory('ALL');
    const runningMonth = getRunningMonthKey();
    setStatementMonth(selectedMonth !== 'ALL' ? selectedMonth : runningMonth);
    try {
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const memberTxs = txs.filter((tx: any) => tx.airman_id === member.airman_id || (member['BD No'] && tx.bdNo === member['BD No']));
      setStatementTx(memberTxs);
    } catch (e) {
      setStatementTx([]);
    }
  };

  // Open Profile Modal
  const openProfile = (member: any) => {
    const effDp = getMemberEffectiveDp(member);
    const fullMember = {
      ...member,
      DP: effDp || member['DP'] || ''
    };
    setProfileMember(fullMember);
    setIsEditingProfile(false);
    setEditMemberData({
      bdNo: member['BD No'] || '',
      rank: member['Rank'] || '',
      surname: member['Surname'] || '',
      contact: member['Contact'] || member['Mobile No'] || '',
      role: member['Role'] || member.role || 'Member',
      dp: effDp || member['DP'] || '',
      due: Number(member.Due ?? member.due ?? member.baki ?? 0)
    });
    try {
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const memberTxs = txs.filter((tx: any) => tx.airman_id === member.airman_id);
      setProfileTx(memberTxs);
    } catch (e) {
      setProfileTx([]);
    }
  };

  // Build Aggregated Statement rows matching: দ্রব্যের নাম, পরিমাণ, দর, মোট
  const parseStatementAggregatedItems = (txs: any[]): StatementItemRow[] => {
    const itemMap = new Map<string, { itemName: string; qty: number; total: number; rates: number[] }>();

    txs.forEach((tx) => {
      if (tx.type === 'BILL PAYMENT') return;

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
      const itemsStr = tx.items || 'ক্যান্টিন খরচ';
      const parts = String(itemsStr).split(',').map((s) => s.trim()).filter(Boolean);

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
          const name = parts[0].trim();
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
      // 1. Direct catalog lookup for accurate unit price (দর)
      let finalRate = lookupCatalogPrice(val.itemName, menuCatalog);

      // 2. If not found in catalog, check recorded rates from transactions
      if (finalRate <= 0 && val.rates.length > 0) {
        finalRate = Math.round(val.rates[0] * 100) / 100;
      }

      // 3. Fallback to average unit cost
      if (finalRate <= 0 && val.qty > 0) {
        finalRate = Math.round((val.total / val.qty) * 100) / 100;
      }

      // Calculate accurate total (পরিমাণ × দর)
      const calculatedTotal = (finalRate > 0 && val.qty > 0)
        ? Math.round(finalRate * val.qty * 100) / 100
        : Math.round(val.total * 100) / 100;

      rows.push({
        itemName: val.itemName,
        qty: val.qty,
        rate: finalRate,
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

  // WhatsApp send handler with formatted bill breakdown
  const handleSendWhatsApp = (
    member: any, 
    items: StatementItemRow[], 
    totalDue: number, 
    totalMonthBill: number, 
    previousDue: number,
    monthKey: string = 'ALL'
  ) => {
    let contact = (member.Contact || member.contact || member['Mobile No'] || '').trim();
    if (!contact) {
      contact = prompt('সদস্যের WhatsApp নম্বর লিখুন (e.g. 017XXXXXXXX):') || '';
    }
    if (!contact) return;

    let phone = contact.replace(/\D/g, '');
    if (phone.startsWith('01') && phone.length === 11) {
      phone = '88' + phone;
    } else if (phone.length === 10 && phone.startsWith('1')) {
      phone = '880' + phone;
    }

    const rank = member.Rank || member.rank || '';
    const surname = member.Surname || member.surname || '';
    const monthTitle = formatMonthName(monthKey);

    let rowsList = '';
    if (items.length === 0) {
      rowsList = 'কোনো রেকর্ড পাওয়া যায়নি।\n';
    } else {
      rowsList = items.map((r, idx) => 
        `${idx + 1}. ${r.itemName} | পরিমাণ: ${r.qty} | দর: ৳${r.rate} | মোট: ৳${r.total}`
      ).join('\n');
    }

    const message = 
`🍽️ *CAFE UAV - মাসিক বিল বিবরণী*
📅 *মাসের নাম:* ${monthTitle}
👤 *পদবী ও নাম:* ${rank} ${surname}

━━━━━━━━━━━━━━━━━━━━━
*দ্রব্যের নাম | পরিমাণ | দর | মোট*
━━━━━━━━━━━━━━━━━━━━━
${rowsList}
━━━━━━━━━━━━━━━━━━━━━
💰 *মোট বিল:* ৳${totalMonthBill}
${previousDue > 0 ? `⏳ *বকেয়া বিল (পূর্ববর্তী মাস):* ৳${previousDue}\n` : ''}💳 *সর্বমোট প্রদেয় বিল:* ৳${totalDue}

(বিল পরিশোধের জন্য ধন্যবাদ - CAFE UAV)`;

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Pay bill execution
  const handleSettleAccount = async () => {
    if (!payBillMember) return;
    if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) return;

    const amount = Number(payAmount);
    const currentDue = Number(payBillMember.Due ?? payBillMember.due ?? payBillMember.baki ?? 0);
    const newDue = Math.max(0, currentDue - amount);
    
    // Update Supabase Canteen table 'Due' column
    await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', payBillMember.airman_id);
    
    const catLabel = payBillCategory === 'ALL' ? 'ALL BILLS' : payBillCategory.replace('_', ' ');
    const payeeName = `${payBillMember.Rank || payBillMember.rank || ''} ${payBillMember.Surname || payBillMember['Surname'] || payBillMember.name || ''}`.trim();
    const tx = {
      id: 'tx-pay-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: formatCanteenDate(new Date()),
      airman_id: payBillMember.airman_id,
      bdNo: payBillMember['BD No'] || payBillMember.airman_id,
      memberName: payeeName,
      rank: payBillMember.Rank || payBillMember.rank || '',
      items: `BILL PAYMENT - ${catLabel} (${payMethod})`,
      amount: amount,
      type: 'BILL PAYMENT',
      billType: payBillCategory,
      gateway: payMethod
    };
    const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    localStorage.setItem('canteen_txs', JSON.stringify([tx, ...txs]));
    
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('canteen_txs_updated'));
    window.dispatchEvent(new Event('baf_state_updated'));
    window.dispatchEvent(new Event('storage'));
    
    const updatedMember = { ...payBillMember, Due: newDue, baki: newDue };
    setPayBillMember(null);
    setPayAmount('');
    setMembers(prev => prev.map(m => m.airman_id === updatedMember.airman_id ? updatedMember : m));
    
    if (profileMember && profileMember.airman_id === updatedMember.airman_id) {
      setProfileMember(updatedMember);
      setProfileTx([tx, ...profileTx]);
    }
    if (statementMember && statementMember.airman_id === updatedMember.airman_id) {
      setStatementMember(updatedMember);
      setStatementTx([tx, ...statementTx]);
    }
  };

  // Remove history transaction
  const handleRemoveTx = async (txToRemove: any) => {
    if (!txToRemove) return;
    const targetMember = profileMember || statementMember;
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
      if (targetMember['BD No']) {
        await supabase
          .from('Canteen_Member')
          .update({ Due: newDue })
          .eq('BD No', String(targetMember['BD No']).trim());
      } else if (targetMember.airman_id) {
        await supabase
          .from('Canteen_Member')
          .update({ Due: newDue })
          .eq('airman_id', targetMember.airman_id);
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
    
    // 2. Remove transaction from localStorage and Supabase app_settings cloud sync
    const txIdStr = String(txToRemove.id);
    let newTxs: any[] = [];
    try {
      const rawTxs = localStorage.getItem('canteen_txs');
      const txs = rawTxs ? JSON.parse(rawTxs) : [];
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
      setEditMemberData(prev => ({ ...prev, due: newDue }));
    }

    if (statementMember) {
      setStatementMember(updatedMember);
      setStatementTx(prev => prev.filter(t => String(t.id) !== txIdStr));
    }

    // 5. Notify all listeners
    window.dispatchEvent(new Event('canteen_txs_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));

    setTxDeleteConfirmId(null);
  };

  // Helper to format and sort members by rank seniority
  const formatAndSortMembers = (data: any[]) => {
    const formatted = data
      .filter((m: any) => {
        const bd = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
        return bd !== '48456';
      })
      .map((m: any) => {
        const effectiveDp = getMemberEffectiveDp(m);
        // If Supabase didn't have DP but we found it in local storage or config, save it back to cloud
        if (!m.DP && effectiveDp && m.airman_id) {
          supabase.from('Canteen_Member').update({ DP: effectiveDp }).eq('airman_id', m.airman_id).then();
        }
        return {
          ...m,
          Role: m.Role ?? m.role ?? '',
          role: m.Role ?? m.role ?? '',
          Due: Number(m.Due ?? m.due ?? m.baki ?? 0),
          baki: Number(m.Due ?? m.due ?? m.baki ?? 0),
          DP: effectiveDp || m.DP || ''
        };
      });

    // Sort strictly by Office Nominal Roll Seniority & BAF Hierarchy
    return sortCanteenMembersByOfficeSeniority(formatted);
  };

  // Auto-sync Biodata silently in background if Canteen_Member is empty or missing airmen
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

  const fetchMembers = async (forceShowLoading = false) => {
    if (forceShowLoading) {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase.from('Canteen_Member').select('*');
      if (!error && data && data.length > 0) {
        const sorted = formatAndSortMembers(data);
        setMembers(sorted);
        try {
          localStorage.setItem('canteen_members_cache', JSON.stringify(sorted));
        } catch {}
      } else if (!data || data.length === 0) {
        // If table is completely empty, trigger sync
        await autoSyncBiodata();
      }
    } catch (err) {
      console.error('Error fetching Canteen members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Fetch instantly without waiting for any heavy sync
    fetchMembers();

    // 2. Safety timeout: never leave loading true for more than 2.5 seconds on slow/offline mobile
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    // 3. Subscribe to realtime updates on Canteen_Member table (debounced)
    let debounceTimer: any = null;
    const channel = supabase
      .channel('canteen_members_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen_Member' }, () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          fetchMembers(false);
        }, 600);
      })
      .subscribe();

    return () => {
      clearTimeout(safetyTimer);
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAutoResolveMemberDp = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.includes('photos.app.goo.gl') || trimmed.includes('photos.google.com/share') || trimmed.includes('drive.google.com')) {
      setResolvingDp(true);
      try {
        const direct = await fetchDirectImageUrl(trimmed);
        if (direct && direct !== trimmed) {
          setEditMemberData(prev => ({ ...prev, dp: direct }));
        }
      } catch (e) {
        console.warn('DP resolution failed:', e);
      } finally {
        setResolvingDp(false);
      }
    }
  };

  // Save edited member from Profile view
  const handleSaveProfileEdit = async () => {
    if (!profileMember) return;
    if (!editMemberData.bdNo || !editMemberData.rank || !editMemberData.surname) {
      return;
    }

    setIsSavingProfile(true);

    let finalDp = (editMemberData.dp || '').trim();
    if (finalDp.includes('photos.app.goo.gl') || finalDp.includes('photos.google.com/share')) {
      setResolvingDp(true);
      finalDp = await fetchDirectImageUrl(finalDp);
      setResolvingDp(false);
    }

    const newDue = Number(editMemberData.due || 0);
    const updatePayload = {
      "BD No": editMemberData.bdNo.trim(),
      "Rank": editMemberData.rank.trim(),
      "Surname": editMemberData.surname.trim(),
      "Contact": editMemberData.contact?.trim() || '',
      "Role": editMemberData.role || 'Member',
      Due: newDue,
      DP: finalDp || null
    };

    try {
      // 1. Update by airman_id in Supabase
      const { error } = await supabase
        .from('Canteen_Member')
        .update(updatePayload)
        .eq('airman_id', profileMember.airman_id);

      if (error) {
        console.warn("Failed update by airman_id, trying by BD No:", error);
        await supabase
          .from('Canteen_Member')
          .update(updatePayload)
          .eq('BD No', editMemberData.bdNo.trim());
      }

      // 2. Immediately update local state so UI updates instantly
      const updated = { 
        ...profileMember, 
        ...updatePayload, 
        Due: newDue,
        due: newDue,
        baki: newDue,
        role: editMemberData.role || 'Member',
        Role: editMemberData.role || 'Member',
        DP: finalDp 
      };
      setProfileMember(updated);
      setMembers(prev => {
        const next = prev.map(m => (m.airman_id === profileMember.airman_id || m['BD No'] === editMemberData.bdNo) ? updated : m);
        try {
          localStorage.setItem('canteen_members_cache', JSON.stringify(next));
        } catch {}
        return next;
      });
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
      
      // 3. Trigger beautiful animation on button box
      setIsSavedProfile(true);
      setTimeout(() => {
        setIsSavedProfile(false);
        setIsSavingProfile(false);
        setIsEditingProfile(false);
      }, 1050);
    } catch (err: any) {
      console.warn("Exception updating member:", err);
      const updated = { 
        ...profileMember, 
        ...updatePayload, 
        Due: newDue,
        due: newDue,
        baki: newDue,
        role: editMemberData.role || 'Member',
        Role: editMemberData.role || 'Member',
        DP: finalDp 
      };
      setProfileMember(updated);
      setMembers(prev => {
        const next = prev.map(m => (m.airman_id === profileMember.airman_id || m['BD No'] === editMemberData.bdNo) ? updated : m);
        try {
          localStorage.setItem('canteen_members_cache', JSON.stringify(next));
        } catch {}
        return next;
      });
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
      setIsSavedProfile(true);
      setTimeout(() => {
        setIsSavedProfile(false);
        setIsSavingProfile(false);
        setIsEditingProfile(false);
      }, 1050);
    }
  };

  const confirmDeleteMember = async (airman_id: string) => {
    const { error } = await supabase.from('Canteen_Member').delete().eq('airman_id', airman_id);
    if (!error) {
      setMembers(prev => prev.filter(m => m.airman_id !== airman_id));
      if (profileMember && profileMember.airman_id === airman_id) {
        setProfileMember(null);
      }
      if (statementMember && statementMember.airman_id === airman_id) {
        setStatementMember(null);
      }
    } else {
      alert("Error deleting member: " + error.message);
    }
    setDeleteConfirmId(null);
  };

  const filteredMembers = members.filter(m => 
    (m['BD No'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m['Rank'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m['Surname'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m['Role'] || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Summary statistics for active filter
  const { totalFilteredBill, countWithBills } = useMemo(() => {
    let sum = 0;
    let count = 0;
    filteredMembers.forEach((m) => {
      const b = getMemberFilteredBill(m, selectedCategory, selectedMonth);
      if (b > 0) {
        sum += b;
        count++;
      }
    });
    return { totalFilteredBill: sum, countWithBills: count };
  }, [filteredMembers, selectedCategory, selectedMonth, allTxs]);

  const displayedMemberList = useMemo(() => {
    const list = !onlyWithBill ? filteredMembers : filteredMembers.filter((m) => {
      const b = getMemberFilteredBill(m, selectedCategory, selectedMonth);
      return b > 0;
    });
    return sortCanteenMembersByOfficeSeniority(list);
  }, [filteredMembers, onlyWithBill, selectedCategory, selectedMonth, allTxs]);

  const handleExportBills = () => {
    setIsPrintModalOpen(true);
  };

  const resolvedEditDp = resolveImageUrl(editMemberData.dp);

  // Statement rows calculation for Statement modal
  const filteredStatementTxs = statementTx.filter((tx) => {
    const txMonth = getTxMonthKey(tx.date);
    return statementMonth === 'ALL' || txMonth === statementMonth;
  });

  const statementAggregatedItems = parseStatementAggregatedItems(filteredStatementTxs);
  const totalMonthBill = statementAggregatedItems.reduce((sum, r) => sum + r.total, 0);

  const currentMonthPayments = filteredStatementTxs
    .filter((tx) => tx.type === 'BILL PAYMENT')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const memberTotalDue = Number(statementMember?.Due ?? statementMember?.due ?? statementMember?.baki ?? 0);

  // বকেয়া বিল: আগের মাসে বা তার আগের বকেয়া বিল থাকলে তা দেখাবে
  let previousDue = 0;
  if (statementMonth !== 'ALL') {
    const olderTxs = statementTx.filter((tx) => {
      const m = getTxMonthKey(tx.date);
      return m && m < statementMonth;
    });
    const olderCharges = olderTxs
      .filter((tx) => tx.type !== 'BILL PAYMENT')
      .reduce((s, tx) => s + Number(tx.amount || 0), 0);
    const olderPayments = olderTxs
      .filter((tx) => tx.type === 'BILL PAYMENT')
      .reduce((s, tx) => s + Number(tx.amount || 0), 0);
    const olderNet = Math.max(0, olderCharges - olderPayments);

    if (olderNet > 0) {
      previousDue = Math.round(olderNet * 100) / 100;
    } else {
      const currentNet = Math.max(0, totalMonthBill - currentMonthPayments);
      previousDue = Math.max(0, Math.round((memberTotalDue - currentNet) * 100) / 100);
    }
  }

  const netPayable = statementMonth === 'ALL'
    ? (memberTotalDue > 0 ? memberTotalDue : totalMonthBill)
    : Math.max(0, Math.round((totalMonthBill + previousDue - currentMonthPayments) * 100) / 100);

  const grandTotalDue = useMemo(() => {
    return members.reduce((sum, m) => sum + Number(m.Due ?? m.due ?? m.baki ?? 0), 0);
  }, [members]);

  const membersWithDueCount = useMemo(() => {
    return members.filter((m) => Number(m.Due ?? m.due ?? m.baki ?? 0) > 0).length;
  }, [members]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-2.5">
            <Receipt className="w-7 h-7 text-indigo-400" />
            <span>BILL MANAGEMENT</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Canteen Bill, Unit Fund Bill & Others Bill Administration
          </p>
        </div>
      </div>

      {/* Prominent High-Visibility KPI Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Members</p>
            <p className="text-2xl font-black text-white font-mono">{members.length}</p>
            <p className="text-[11px] text-slate-500 font-bold mt-0.5">অ্যাক্টিভ মেম্বার ডাটাবেজ</p>
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5 shadow-sm">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current View Billed</p>
            <p className="text-2xl font-black text-emerald-400 font-mono">৳{totalFilteredBill.toLocaleString()}</p>
            <p className="text-[11px] text-indigo-300 font-bold mt-0.5">{formatMonthName(selectedMonth)}</p>
          </div>
        </div>

        <div 
          onClick={() => setOnlyWithBill(!onlyWithBill)}
          className="bg-gradient-to-br from-rose-950/90 via-red-950/70 to-slate-900 border border-rose-500/50 hover:border-rose-400 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-rose-950/40 transition-all cursor-pointer group"
          title="সকল সদস্যের সর্বমোট প্রদেয় বকেয়া (Click to filter members with due)"
        >
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-300 shrink-0 group-hover:scale-105 transition-transform">
              <Coins className="w-6 h-6 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-rose-300">TOTAL DUE (সর্বমোট বকেয়া)</p>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-rose-500/20 text-rose-200 border border-rose-500/30">
                  {membersWithDueCount} জন
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight drop-shadow-sm">
                ৳{grandTotalDue.toLocaleString()}
              </p>
              <p className="text-[11px] text-rose-300/90 font-bold mt-0.5">
                বকেয়া সদস্য ফিল্টার করতে ক্লিক করুন
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-rose-400 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      {/* Bill Category Tabs & Month Selector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 md:p-4 space-y-3 shadow-md">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Bill Category Filter Pills: Canteen Bill, Unit Fund Bill, Others Bill, All */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('CANTEEN')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                selectedCategory === 'CANTEEN'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-1 ring-amber-400/50'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-amber-400" />
              <span>Canteen Bill</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('UNIT_FUND')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                selectedCategory === 'UNIT_FUND'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/50'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Landmark className="w-3.5 h-3.5 text-indigo-400" />
              <span>Unit Fund Bill</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('OTHERS')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                selectedCategory === 'OTHERS'
                  ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 ring-1 ring-cyan-400/50'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Others Bill</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-700 text-white shadow-md ring-1 ring-slate-400/50'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-slate-300" />
              <span>All</span>
            </button>
          </div>

          {/* Month Selector: Left & Right Arrow Navigation (No Dropdown List) */}
          <div className="flex items-center space-x-2 self-start lg:self-auto w-full lg:w-auto">
            <div className="flex items-center bg-slate-950 rounded-2xl p-1 border border-slate-800 shadow-sm w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setSelectedMonth('ALL')}
                className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                  selectedMonth === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="All Months (সকল মাস)"
              >
                All
              </button>

              <div className="flex items-center bg-slate-900/90 rounded-xl px-1.5 py-0.5 border border-slate-700/60 ml-1.5 flex-1 sm:flex-initial justify-between">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0 active:scale-95"
                  title="পূর্ববর্তী মাস (Previous Month)"
                >
                  <ChevronLeft className="w-4 h-4 text-indigo-400 hover:text-white" />
                </button>

                <div className="px-3 py-1 text-center min-w-[120px] sm:min-w-[140px] select-none">
                  <span className={`text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 ${
                    selectedMonth !== 'ALL' ? 'text-white' : 'text-indigo-300'
                  }`}>
                    <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>{selectedMonth === 'ALL' ? 'সকল মাস' : formatMonthName(selectedMonth)}</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer shrink-0 active:scale-95"
                  title="পরবর্তী মাস (Next Month)"
                >
                  <ChevronRight className="w-4 h-4 text-indigo-400 hover:text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Info Strip with Total Billed & Quick Filter Switch */}
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 pt-2 border-t border-slate-800/60 flex-wrap gap-2">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Showing: <strong className="text-white">{selectedCategory === 'CANTEEN' ? 'Canteen Bill' : selectedCategory === 'UNIT_FUND' ? 'Unit Fund Bill' : selectedCategory === 'OTHERS' ? 'Others Bill' : 'All Bills'}</strong>
              {' • '}
              <strong className="text-indigo-300">{formatMonthName(selectedMonth)}</strong>
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
                onClick={() => setOnlyWithBill(false)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  !onlyWithBill
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({filteredMembers.length})
              </button>
              <button
                type="button"
                onClick={() => setOnlyWithBill(true)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  onlyWithBill
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                With Bills ({countWithBills})
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
            placeholder="Search members by BD No, Rank, or Surname..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
          />
        </div>

        {/* Actions: Import Initial Bills Button, Export Bill Button & View Mode Toggle */}
        <div className="flex items-center space-x-2.5 self-end sm:self-auto shrink-0 flex-wrap gap-y-2">
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
            <span>IMPORT BILLS</span>
          </button>

          <button
            type="button"
            onClick={handleExportBills}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-indigo-500/25 border-t border-indigo-300/40 active:translate-y-0.5 transition-all cursor-pointer"
            title="Export Bill (Print Preview, PDF & Excel)"
          >
            <Printer className="w-4 h-4" />
            <span>EXPORT BILL (PDF)</span>
          </button>

          {/* View Mode Toggle: Box vs Table */}
          <div className="flex items-center bg-slate-900 rounded-2xl p-1 border border-slate-800 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('BOX')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer ${
                viewMode === 'BOX'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Box / Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Box View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('TABLE')}
              className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer ${
                viewMode === 'TABLE'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <List className="w-3.5 h-3.5" />
              <span>Table View</span>
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
            {onlyWithBill 
              ? 'No members found with bills in this category/month' 
              : 'No member records found'}
          </p>
          {onlyWithBill ? (
            <button
              onClick={() => setOnlyWithBill(false)}
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
            const totalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
            const displayedBill = getMemberFilteredBill(member, selectedCategory, selectedMonth);

            const billLabel = selectedCategory === 'ALL' && selectedMonth === 'ALL'
              ? 'TOTAL DUE'
              : selectedCategory === 'CANTEEN'
              ? 'CANTEEN BILL'
              : selectedCategory === 'UNIT_FUND'
              ? 'UNIT FUND BILL'
              : selectedCategory === 'OTHERS'
              ? 'OTHERS BILL'
              : 'MONTHLY BILL';

            return (
              <div 
                key={member.airman_id || i} 
                onClick={() => openProfile(member)} 
                className="relative bg-gradient-to-b from-slate-800/90 via-slate-900 to-slate-950 rounded-3xl p-6 border-t border-t-slate-600/60 border-x border-x-slate-700/60 border-b-4 border-b-slate-950 shadow-[0_12px_24px_-4px_rgba(0,0,0,0.65),0_4px_8px_-2px_rgba(0,0,0,0.5),inset_0_1px_0_0_rgba(255,255,255,0.12),inset_0_-2px_4px_0_rgba(0,0,0,0.4)] hover:-translate-y-1.5 hover:shadow-[0_20px_35px_-6px_rgba(0,0,0,0.8),0_0_22px_0_rgba(79,70,229,0.3),inset_0_1px_0_0_rgba(255,255,255,0.2)] hover:border-b-indigo-900 transition-all duration-300 cursor-pointer group flex flex-col justify-between"
              >
                {/* Top Details (Avatar & Member Information) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* 3D Embossed Avatar Frame */}
                    <div className="w-14 h-14 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black text-2xl shadow-[inset_0_2px_5px_rgba(0,0,0,0.8),0_3px_8px_rgba(0,0,0,0.5)] group-hover:scale-105 transition-transform duration-300 overflow-hidden shrink-0 border border-slate-700/70">
                      {memberDp ? (
                        <img 
                          src={memberDp} 
                          alt={member['Surname']} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="text-indigo-400 font-black">
                          {(member['Surname'] || 'U').charAt(0)}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center space-x-1.5 mb-1 flex-wrap gap-y-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 border-t border-indigo-400/40 border-b-2 border-indigo-950 text-indigo-300 shadow-sm">
                          {member['Rank']}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          #{member['BD No']}
                        </span>
                        {member.Role && (
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-sm ${
                            member.Role.toLowerCase() === 'manager' 
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' 
                              : member.Role.toLowerCase() === 'staff' || member.Role.toLowerCase() === 'cook'
                              ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          }`}>
                            {member.Role}
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-white text-base leading-snug group-hover:text-indigo-300 transition-colors">
                        {member['Surname']}
                      </h3>
                    </div>
                  </div>

                  {/* Due / Bill amount */}
                  <div className="text-right flex flex-col items-end shrink-0 pl-2">
                    <p className="text-[10px] font-black text-slate-400 tracking-wider uppercase mb-0.5">
                      {billLabel}
                    </p>
                    <p className={`text-2xl sm:text-3xl font-black font-mono tracking-tight leading-none ${displayedBill === 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                      ৳{displayedBill.toLocaleString()}
                    </p>

                    {/* High-Visibility Large & Beautiful Total Due Badge */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setInitialBillMember(member);
                      }}
                      className={`mt-2.5 px-3.5 py-2 rounded-2xl border shadow-md transition-all cursor-pointer inline-flex items-center justify-between space-x-2.5 active:scale-95 group/carddue w-full max-w-[210px] ${
                        totalDue > 0
                          ? 'bg-gradient-to-r from-rose-950/95 via-red-950/90 to-rose-900/90 border-rose-500/70 text-rose-200 hover:border-rose-400 shadow-rose-950/40 ring-1 ring-rose-500/30'
                          : 'bg-gradient-to-r from-slate-950/90 to-slate-900/90 border-slate-700/80 text-slate-300 hover:bg-slate-800 hover:border-slate-500 shadow-black/40'
                      }`}
                      title="Click to set/edit Total Due"
                    >
                      <div className="flex items-center space-x-1.5 shrink-0">
                        <Coins className={`w-4 h-4 ${totalDue > 0 ? 'text-amber-400 animate-pulse' : 'text-slate-400'} group-hover/carddue:rotate-12 transition-transform`} />
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 font-sans">
                          TOTAL DUE:
                        </span>
                      </div>
                      <span className={`text-base sm:text-lg font-black font-mono tracking-tight shrink-0 ${totalDue > 0 ? 'text-rose-300' : 'text-emerald-400'}`}>
                        ৳{totalDue.toLocaleString()}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Bottom Action Bar: Left side = Statement, Right side = Pay Bill */}
                <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center space-x-2.5">
                  {/* Left Side: Statement */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openStatement(member);
                    }}
                    className="flex-1 py-2.5 px-3 bg-slate-800/90 hover:bg-slate-700/90 text-indigo-300 hover:text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-1.5 border border-slate-700/70 transition-all shadow-sm active:translate-y-0.5 group/btn"
                    title="View Statement & Monthly Bill"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400 group-hover/btn:scale-110 transition-transform" />
                    <span>STATEMENT</span>
                  </button>

                  {/* Right Side: Pay Bill */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPayBill(member);
                    }}
                    className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-1.5 shadow-[0_4px_12px_rgba(16,185,129,0.3)] border-t border-emerald-300/40 active:translate-y-0.5 transition-all group/btn"
                    title="Direct Pay Bill"
                  >
                    <Banknote className="w-3.5 h-3.5 group-hover/btn:scale-110 transition-transform" />
                    <span className="truncate">PAY BILL {displayedBill > 0 ? `(৳${displayedBill})` : totalDue > 0 ? `(৳${totalDue})` : ''}</span>
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
                  <th className="px-4 py-3.5 text-center w-12">#</th>
                  <th className="px-4 py-3.5">Member</th>
                  <th className="px-4 py-3.5">Rank & BD No</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Contact</th>
                  <th className="px-4 py-3.5 text-right font-mono">
                    {selectedCategory === 'ALL' && selectedMonth === 'ALL'
                      ? 'Total Due'
                      : selectedCategory === 'CANTEEN'
                      ? 'Canteen Bill'
                      : selectedCategory === 'UNIT_FUND'
                      ? 'Unit Fund Bill'
                      : selectedCategory === 'OTHERS'
                      ? 'Others Bill'
                      : 'Monthly Bill'}
                  </th>
                  <th className="px-4 py-3.5 text-right font-mono text-xs font-black uppercase tracking-wider text-rose-300">
                    Total Due
                  </th>
                  <th className="px-4 py-3.5 text-center w-52">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {displayedMemberList.map((member, i) => {
                  const memberDp = resolveImageUrl(member.DP);
                  const totalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
                  const displayedBill = getMemberFilteredBill(member, selectedCategory, selectedMonth);

                  return (
                    <tr 
                      key={member.airman_id || i}
                      onClick={() => openProfile(member)}
                      className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3 text-center text-slate-500 font-mono font-bold">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-700/80 flex items-center justify-center font-black text-xs text-indigo-400 overflow-hidden shrink-0 shadow-inner">
                            {memberDp ? (
                              <img src={memberDp} alt={member['Surname']} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                            ) : (
                              <span>{(member['Surname'] || 'U').charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <span className="font-black text-white group-hover:text-indigo-300 transition-colors text-sm block">
                              {member['Surname']}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-500/15 border border-indigo-400/30 text-indigo-300">
                            {member['Rank']}
                          </span>
                          <span className="font-mono text-slate-400 font-bold text-xs">
                            #{member['BD No']}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] font-bold text-slate-300">
                          {member.Role || 'Member'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400 text-xs">
                        {member['Contact'] || '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-base font-black font-mono ${displayedBill === 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                          ৳{displayedBill}
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
                            onClick={() => openPayBill(member)}
                            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-[11px] font-black uppercase flex items-center space-x-1 shadow-xs transition-all cursor-pointer"
                            title="Pay Bill"
                          >
                            <Banknote className="w-3 h-3" />
                            <span>Pay</span>
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
                  <h2 className="text-xl font-black text-white">{profileMember['Rank']} {profileMember['Surname']}</h2>
                  <p className="text-xs font-bold text-indigo-400 font-mono">BD No: {profileMember['BD No']}</p>
                </div>
              </div>

              {/* Header Right Actions */}
              <div className="flex items-center space-x-2">
                {!isEditingProfile ? (
                  <button 
                    onClick={() => setIsEditingProfile(true)} 
                    className="p-2.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors"
                    title="Edit Member Information"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsEditingProfile(false)} 
                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    setProfileMember(null);
                    setIsEditingProfile(false);
                  }} 
                  className="p-2.5 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors ml-1" 
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto bg-slate-900/50 flex-1 space-y-6">
              {/* EDIT MODE: Direct edit with DP input & Remove button at the bottom */}
              {isEditingProfile ? (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-black text-indigo-400 uppercase tracking-wider">EDIT MEMBER DETAILS</h3>
                    <span className="text-[10px] text-slate-400">ID: {profileMember.airman_id}</span>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">BD No</label>
                    <input 
                      type="text" 
                      value={editMemberData.bdNo ?? ""}
                      onChange={(e) => setEditMemberData({ ...editMemberData, bdNo: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Rank</label>
                      <input 
                        type="text" 
                        value={editMemberData.rank ?? ""}
                        onChange={(e) => setEditMemberData({ ...editMemberData, rank: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Surname</label>
                      <input 
                        type="text" 
                        value={editMemberData.surname ?? ""}
                        onChange={(e) => setEditMemberData({ ...editMemberData, surname: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Contact</label>
                      <input 
                        type="text" 
                        value={editMemberData.contact ?? ""}
                        onChange={(e) => setEditMemberData({ ...editMemberData, contact: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Role</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={editMemberData.role ?? "Member"}
                          onChange={(e) => setEditMemberData({ ...editMemberData, role: e.target.value })}
                          className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="e.g. Member, Manager"
                        />
                        <select
                          value={editMemberData.role ?? "Member"}
                          onChange={(e) => setEditMemberData({ ...editMemberData, role: e.target.value })}
                          className="bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="Member">Member</option>
                          <option value="Manager">Manager</option>
                          <option value="Staff">Staff</option>
                          <option value="Cook">Cook</option>
                          <option value="Cashier">Cashier</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Initial Due / Bill input */}
                  <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black text-indigo-300 tracking-widest uppercase flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-amber-400" />
                        <span>Initial Due / Bill (প্রারম্ভিক বকেয়া) ৳</span>
                      </label>
                      <span className="text-[10px] text-slate-500 font-mono">
                        Current: ৳{profileMember.Due ?? profileMember.due ?? 0}
                      </span>
                    </div>
                    <input 
                      type="number"
                      step="any"
                      min="0"
                      value={editMemberData.due ?? ""}
                      onChange={(e) => setEditMemberData({ ...editMemberData, due: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-700 text-white font-mono text-base font-black rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <p className="text-[10px] text-slate-400 font-bold">
                      সদস্যের পূর্ববর্তী মোট বকেয়া বা ওপেনিং ব্যালেন্স হিসাব
                    </p>
                  </div>

                  {/* Member Photo: Browse from Gallery in Edit Mode */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase block">
                        Photo
                      </label>
                      
                    </div>

                    <div className="bg-slate-900/80 border border-slate-700/80 rounded-2xl p-3 space-y-2.5">
                      <div className="flex items-center space-x-3">
                        <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                          {editMemberData.dp ? (
                            <img src={resolvedEditDp || editMemberData.dp} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-slate-500" />
                          )}
                        </div>

                        <div className="flex-1 flex flex-wrap items-center gap-2">
                          <label className="flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Browse from Gallery</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  try {
                                    const base64 = await processGalleryImage(file);
                                    setEditMemberData(prev => ({ ...prev, dp: base64 }));
                                  } catch (err) {
                                    console.error('Failed to load image from gallery:', err);
                                  }
                                }
                              }}
                            />
                          </label>

                          {editMemberData.dp && (
                            <button
                              type="button"
                              onClick={() => setEditMemberData(prev => ({ ...prev, dp: '' }))}
                              className="flex items-center space-x-1 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              title="Remove photo"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Save Changes Button with Animation */}
                  <SaveButton 
                    onClick={handleSaveProfileEdit}
                    isSaving={isSavingProfile}
                    isSaved={isSavedProfile}
                    idleText="SAVE CHANGES"
                    savingText="SAVING..."
                    savedText="SAVED SUCCESSFULLY! ✓"
                    className="w-full mt-4 py-3.5"
                  />

                  {/* Remove Member Option at the bottom */}
                  <div className="pt-6 border-t border-rose-900/30 text-center">
                    <button 
                      type="button"
                      onClick={() => setDeleteConfirmId(profileMember.airman_id)}
                      className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Member</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* VIEW MODE: Simple Member Info + History (NO Pay Bill, NO Statement, NO DP input) */
                <div className="space-y-6">
                  {/* Basic Member Info Cards (Without Pay Bill Button) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Role / পদবি</p>
                      <p className="text-sm font-black text-indigo-300 uppercase tracking-wide">
                        {profileMember['Role'] || profileMember.role || 'Member'}
                      </p>
                    </div>
                    <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact</p>
                      <p className="text-sm font-bold text-white font-mono">{profileMember['Contact'] || 'Not Provided'}</p>
                    </div>
                    <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                      <p className={`text-xl font-black font-mono ${(profileMember.Due ?? profileMember.baki) === 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                        ৳{profileMember.Due ?? profileMember.baki ?? 0}
                      </p>
                    </div>
                  </div>

                  {/* Transaction History Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center space-x-2">
                        <History className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Transaction History</span>
                      </h3>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">
                        Total {profileTx.length} records
                      </span>
                    </div>

                    {profileTx.length === 0 ? (
                      <div className="bg-slate-800/80 rounded-2xl p-8 text-center text-slate-400 font-bold border border-slate-700 text-xs">
                        No transactions found
                      </div>
                    ) : (
                      <>
                        {/* Mobile Card View (sm:hidden) */}
                        <div className="sm:hidden space-y-2.5">
                          {profileTx.map((tx, idx) => {
                            let qtyText = "-";
                            let descText = tx.items;
                            
                            if (tx.items && tx.items.includes('(')) {
                              const itemsList = tx.items.split(', ');
                              let totalQty = 0;
                              itemsList.forEach((it: string) => {
                                const match = it.match(/\((\d+)\)/);
                                if (match) totalQty += parseInt(match[1]);
                              });
                              if (totalQty > 0) qtyText = `${totalQty} pcs`;
                            }
                            if (tx.type === 'BILL PAYMENT') {
                              qtyText = "-";
                              descText = 'Payment Received - ' + (tx.gateway || 'CASH');
                            }

                            return (
                              <div key={tx.id || idx} className="bg-slate-800/90 p-3.5 rounded-2xl border border-slate-700/80 space-y-2.5">
                                <div className="flex items-center justify-between text-[11px] font-mono">
                                  <span className="px-2 py-0.5 rounded-md bg-slate-900 text-indigo-300 font-bold border border-slate-700">
                                    #{idx + 1}
                                  </span>
                                  <span className="text-slate-400 font-bold">
                                    {toEnglishDate(tx.date)}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase border ${
                                    tx.type === 'BILL PAYMENT'
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                      : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                  }`}>
                                    {tx.type || 'SALE'}
                                  </span>
                                </div>

                                <div className="text-xs font-bold text-white break-words">
                                  {descText}
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
                                  <div className="flex items-center space-x-2">
                                    {qtyText !== '-' && (
                                      <span className="text-[11px] font-mono font-bold text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded-md border border-slate-700/50">
                                        Qty: {qtyText}
                                      </span>
                                    )}
                                    <span className="text-sm font-black font-mono text-rose-400">
                                      ৳{tx.amount}
                                    </span>
                                  </div>

                                  <button 
                                    type="button"
                                    onClick={() => setTxDeleteConfirmId(tx)} 
                                    className="px-2.5 py-1 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-600 rounded-lg border border-rose-500/20 text-[11px] font-bold transition-colors flex items-center space-x-1"
                                    title="Remove Record"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
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
                              <tbody>
                                {profileTx.map((tx, idx) => {
                                  let qtyText = "-";
                                  let descText = tx.items;
                                  
                                  if (tx.items && tx.items.includes('(')) {
                                    const itemsList = tx.items.split(', ');
                                    let totalQty = 0;
                                    itemsList.forEach((it: string) => {
                                      const match = it.match(/\((\d+)\)/);
                                      if (match) totalQty += parseInt(match[1]);
                                    });
                                    if (totalQty > 0) qtyText = totalQty.toString();
                                  }
                                  if (tx.type === 'BILL PAYMENT') {
                                    qtyText = "-";
                                    descText = 'Payment Received - ' + (tx.gateway || 'CASH');
                                  }

                                  return (
                                    <tr key={tx.id || idx} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20">
                                      <td className="px-4 py-2.5 font-mono">{idx + 1}</td>
                                      <td className="px-4 py-2.5 font-mono">{toEnglishDate(tx.date)}</td>
                                      <td className="px-4 py-2.5 font-bold">{descText}</td>
                                      <td className="px-4 py-2.5 text-center font-bold">{qtyText}</td>
                                      <td className="px-4 py-2.5 text-right font-black text-rose-400">৳{tx.amount}</td>
                                      <td className="px-4 py-2.5 text-center">
                                        <button 
                                          type="button"
                                          onClick={() => setTxDeleteConfirmId(tx)} 
                                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer" 
                                          title="Remove Record"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Statement Modal (Opened via Card Left-Side "STATEMENT" button) */}
      {statementMember && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="w-11 h-11 rounded-xl bg-slate-800 border border-indigo-500/40 flex items-center justify-center overflow-hidden shrink-0">
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
                <div>
                  <h2 className="text-lg font-black text-white">{statementMember['Rank']} {statementMember['Surname']}</h2>
                  <p className="text-[11px] font-bold text-slate-400 font-mono">Monthly Statement • {formatMonthName(statementMonth)}</p>
                </div>
              </div>

              {/* Action Buttons: WhatsApp Send, Print Bill, Close */}
              <div className="flex items-center space-x-2.5">
                {/* Send via WhatsApp Button */}
                <button 
                  onClick={() => handleSendWhatsApp(statementMember, statementAggregatedItems, netPayable, totalMonthBill, previousDue, statementMonth)}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-emerald-500/20 active:translate-y-0.5"
                  title="Send Statement via WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WHATSAPP</span>
                </button>

                {/* Print Bill / PDF */}
                <button 
                  onClick={() => window.print()} 
                  className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md shadow-indigo-500/20 active:translate-y-0.5"
                  title="Print Bill / Save as PDF"
                >
                  <Printer className="w-4 h-4" />
                  <span>PRINT BILL</span>
                </button>

                <button 
                  onClick={() => setStatementMember(null)} 
                  className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors ml-1 cursor-pointer"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
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
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">সকল মাস (All Months)</option>
                  {availableMonths.map((m) => (
                    <option key={m} value={m}>
                      {formatMonthName(m)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Statement Content Area */}
            <div className="p-6 overflow-y-auto bg-slate-950/40 flex-1 print:p-0 print:bg-white print:overflow-visible">
              <div className="bg-white rounded-2xl p-8 border border-slate-300 text-black max-w-3xl mx-auto shadow-sm">
                
                {/* Header Banner */}
                <div className="text-center mb-6 border-b-2 border-black pb-4">
                  <h2 className="text-2xl font-black text-black tracking-wider">🍽️ CAFE UAV 🍽️</h2>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">
                    মাসিক বিল বিবরণী
                  </p>
                </div>

                {/* Statement Paper Table */}
                <table className="w-full border-collapse border border-black text-xs font-bold text-black mb-6">
                  <tbody>
                    <tr>
                      <td className="border border-black p-2.5 text-left w-1/4 bg-slate-50 font-black">মাসের নাম</td>
                      <td className="border border-black p-2.5 text-left font-black" colSpan={3}>
                        {formatMonthName(statementMonth)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2.5 text-left bg-slate-50 font-black">পদবী ও নাম</td>
                      {/* Statement er Namer Pase Bd No lagbe na */}
                      <td className="border border-black p-2.5 text-left font-black" colSpan={3}>
                        {statementMember['Rank']} {statementMember['Surname']}
                      </td>
                    </tr>
                    
                    {/* Heading Row: দ্রব্যের নাম , পরিমাণ , দর, মোট */}
                    <tr className="bg-slate-100 text-center font-black">
                      <td className="border border-black p-2.5 text-left">দ্রব্যের নাম</td>
                      <td className="border border-black p-2.5 w-24 text-center">পরিমাণ</td>
                      <td className="border border-black p-2.5 w-24 text-right">দর</td>
                      <td className="border border-black p-2.5 w-28 text-right">মোট</td>
                    </tr>

                    {statementAggregatedItems.length === 0 ? (
                      <tr>
                        <td className="border border-black p-4 text-center font-normal" colSpan={4}>
                          কোনো খাদ্যদ্রব্য খরচের রেকর্ড নেই
                        </td>
                      </tr>
                    ) : (
                      statementAggregatedItems.map((item, idx) => (
                        <tr key={idx} className="text-center">
                          <td className="border border-black p-2.5 text-left font-semibold">{item.itemName}</td>
                          <td className="border border-black p-2.5 font-mono text-center">{item.qty}</td>
                          <td className="border border-black p-2.5 text-right font-mono">
                            ৳{item.rate}
                          </td>
                          <td className="border border-black p-2.5 text-right font-mono font-black">
                            ৳{item.total}
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Summary Rows */}
                    <tr>
                      <td className="border border-black p-2.5 text-right font-black bg-slate-50" colSpan={3}>
                        মোট বিল
                      </td>
                      <td className="border border-black p-2.5 text-right font-black font-mono text-sm">
                        ৳{totalMonthBill}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2.5 text-right font-black bg-amber-50/60" colSpan={3}>
                        বকেয়া বিল {previousDue > 0 ? '(পূর্ববর্তী বকেয়া)' : ''}
                      </td>
                      <td className="border border-black p-2.5 text-right font-black font-mono text-sm text-amber-900">
                        ৳{previousDue}
                      </td>
                    </tr>
                    {currentMonthPayments > 0 && (
                      <tr>
                        <td className="border border-black p-2.5 text-right font-bold text-emerald-800 bg-emerald-50/60" colSpan={3}>
                          পরিশোধিত বিল
                        </td>
                        <td className="border border-black p-2.5 text-right font-bold font-mono text-sm text-emerald-700">
                          -৳{currentMonthPayments}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="border border-black p-2.5 text-right font-black bg-slate-100" colSpan={3}>
                        সর্বমোট প্রদেয় বিল
                      </td>
                      <td className="border border-black p-2.5 text-right font-black font-mono text-base text-rose-700 bg-slate-100">
                        ৳{netPayable}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {/* Signatures */}
                <div className="flex justify-between items-end pt-12 px-8 text-xs font-bold text-black text-center">
                  <div>
                    <div className="w-32 border-t border-black mb-1 mx-auto"></div>
                    <p>গ্রাহকের স্বাক্ষর</p>
                  </div>
                  <div>
                    <div className="w-32 border-t border-black mb-1 mx-auto"></div>
                    <p>ম্যানেজার</p>
                  </div>
                </div>
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
                ৳{payBillMember.Due ?? payBillMember.baki ?? 0}
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
                    onClick={() => setPayMethod('CASH')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${payMethod === 'CASH' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400'}`}
                  >
                    CASH
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPayMethod('UCB')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all ${payMethod === 'UCB' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400'}`}
                  >
                    UCB
                  </button>
                </div>
              </div>

              <button 
                type="button"
                onClick={handleSettleAccount}
                className="w-full mt-4 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-md shadow-emerald-500/20"
              >
                CONFIRM PAYMENT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Member Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-800 animate-in zoom-in-95 text-center">
            <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Delete Member?</h3>
            <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to remove this member from Canteen database?</p>
            
            <div className="flex space-x-3">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-700 transition-colors">
                CANCEL
              </button>
              <button onClick={() => confirmDeleteMember(deleteConfirmId)} className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-xs font-black tracking-widest hover:bg-rose-500 transition-colors shadow-md shadow-rose-500/30">
                DELETE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove History Tx Confirm Modal */}
      {txDeleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-800 animate-in zoom-in-95 text-center">
            <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Remove Record?</h3>
            <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to remove this transaction record? Due will be reversed.</p>
            
            <div className="flex space-x-3">
              <button onClick={() => setTxDeleteConfirmId(null)} className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-700 transition-colors">
                CANCEL
              </button>
              <button onClick={() => handleRemoveTx(txDeleteConfirmId)} className="flex-1 py-3 bg-rose-600 text-white rounded-xl text-xs font-black tracking-widest hover:bg-rose-500 transition-colors shadow-md shadow-rose-500/30">
                REMOVE
              </button>
            </div>
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
          onSuccess={(updatedList) => {
            setMembers(updatedList);
          }}
        />
      )}

      {/* Set Initial Bill Modal (Single Member) */}
      {initialBillMember && (
        <SetInitialBillModal
          isOpen={!!initialBillMember}
          onClose={() => setInitialBillMember(null)}
          member={initialBillMember}
          onSuccess={(updatedMember) => {
            setMembers((prev) =>
              prev.map((m) =>
                m.airman_id === updatedMember.airman_id || m['BD No'] === updatedMember['BD No']
                  ? updatedMember
                  : m
              )
            );
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
    </div>
  );
};

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Plus, Trash2, Banknote, X, Save, Edit2, AlertTriangle, CheckCircle2, 
  Calendar, Tag, FileText, Boxes, UserCheck, Layers, 
  Wallet, ShoppingCart, DollarSign, Store, Utensils,
  Check, PackagePlus, History, Clock, ArrowDownLeft, ArrowUpRight,
  Filter, CheckSquare, Sparkles, ChevronRight, User,
  ArrowLeft, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { formatCanteenDate } from '../utils/dateUtils';
import { 
  autoRestockFromExpense, 
  getRawInventoryItems, 
  RawInventoryItem 
} from '../utils/recipeManager';
import { supabase } from '../../../supabase';
import { pushKeyToCloud, pullKeyFromCloud, recordDeletedExpenseId, getDeletedExpenseIds } from '../utils/canteenCloudSync';
import { resolveImageUrl } from '../utils/canteenSettings';

export interface CivilianPerson {
  id: string;
  name: string;
  rank: string;
  surname?: string;
  role?: string;
  dp?: string | null;
  bdNo?: string;
}

export const matchesCivilian = (
  personStr: string | null | undefined, 
  civ: { name?: string; surname?: string; id?: string } | string | null | undefined
): boolean => {
  if (!personStr || !civ) return false;
  const clean = (s: string) => s.toLowerCase().replace(/^(civ|civilian|mr|md|chef|cook|staff)\.?\s+/i, '').trim();
  const target = clean(personStr);
  const cName = typeof civ === 'string' ? clean(civ) : clean(civ.name || '');
  const cSurname = typeof civ === 'string' ? '' : clean(civ.surname || '');
  
  if (target && cName && target === cName) return true;
  if (target && cSurname && target === cSurname) return true;
  if (target && cSurname && cSurname.length >= 2 && target.includes(cSurname)) return true;
  if (target && cName && cName.length >= 2 && target.includes(cName)) return true;
  if (cName && target.length >= 2 && cName.includes(target)) return true;
  if (cSurname && target.length >= 2 && cSurname.includes(target)) return true;
  return false;
};

export const getCivInitials = (civ: { surname?: string; name?: string } | null | undefined): string => {
  if (!civ) return 'CV';
  const str = civ.surname || civ.name || 'CV';
  return str.slice(0, 2).toUpperCase();
};

export const DUE_SHOPS = ['Grocessary Shop', 'Poultry Shop', 'Bake & Bite'] as const;
export type DueShopName = typeof DUE_SHOPS[number];

export interface ExpenseRecord {
  id: string | number;
  date: string;
  desc: string;
  subdesc?: string;
  category?: string;
  paymentMethod?: 'Cash' | 'Due' | string;
  dueShop?: 'Grocessary Shop' | 'Poultry Shop' | 'Bake & Bite' | string;
  amount: number;
  qty?: number;
  unit?: string;
  unitPrice?: number;
  detailedPerson?: string;
  isCustom?: boolean;
  rawItemId?: string;
  advanceId?: string;
}

export interface BazarAdvance {
  id: string;
  date: string;
  personName: string;
  amount: number;
  spentAmount: number;
  returnAmount: number;
  channel: 'CASH';
  purpose: string;
  status: 'ACTIVE' | 'SETTLED';
  settledDate?: string;
  notes?: string;
}

const STORAGE_KEY = 'canteen_expenses';
const ADVANCES_KEY = 'canteen_bazar_advances';

interface ItemRowInput {
  id: string;
  desc: string;
  rawItemId?: string;
  category: string;
  qty: number | '';
  unit: string;
  unitPrice: number | '';
  amount: number | '';
}

const CATEGORIES = [
  'Grocery',
  'Poultry',
  'Bakery',
  'Vegetables',
  'Dairy',
  'Spices',
  'Cooking Oil',
  'Beverages',
  'Snacks',
  'Gas & Fuel',
  'Cleaning',
  'Misc'
];

// Helper to extract "YYYY-MM" key from various date formats
const getYearMonthKey = (val: any): string => {
  if (!val) return '';
  let str = String(val).trim();
  const iso = str.match(/^(\d{4})[-\/](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${String(parseInt(iso[2], 10)).padStart(2, '0')}`;
  }
  const monMatch = str.match(/\b([A-Za-z]{3,9})\s+(\d{2,4})\b/);
  if (monMatch) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mIdx = months.indexOf(monMatch[1].slice(0, 3).toLowerCase());
    if (mIdx >= 0) {
      let yr = parseInt(monMatch[2], 10);
      if (yr < 100) yr += 2000;
      return `${yr}-${String(mIdx + 1).padStart(2, '0')}`;
    }
  }
  const dmy = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
  if (dmy) {
    let yr = parseInt(dmy[3], 10);
    if (yr < 100) yr += 2000;
    return `${yr}-${String(parseInt(dmy[2], 10)).padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return '';
};

// Convert canteen date string ("DD Mon YY" or similar) to YYYY-MM-DD for native HTML5 date input
const toInputDateValue = (str: string): string => {
  if (!str) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const monMatch = str.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})/);
  if (monMatch) {
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const mIdx = months.indexOf(monMatch[2].slice(0, 3).toLowerCase());
    if (mIdx >= 0) {
      let yr = parseInt(monMatch[3], 10);
      if (yr < 100) yr += 2000;
      const day = String(parseInt(monMatch[1], 10)).padStart(2, '0');
      return `${yr}-${String(mIdx + 1).padStart(2, '0')}-${day}`;
    }
  }
  const dmy = str.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2,4})/);
  if (dmy) {
    let yr = parseInt(dmy[3], 10);
    if (yr < 100) yr += 2000;
    const day = String(parseInt(dmy[1], 10)).padStart(2, '0');
    return `${yr}-${String(parseInt(dmy[2], 10)).padStart(2, '0')}-${day}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

// Format YYYY-MM key to English readable month label (e.g. "October 2026")
const formatMonthKeyLabel = (key: string): string => {
  if (!key || key === 'ALL') return 'সব মাস (All Records)';
  const parts = key.split('-');
  if (parts.length >= 2) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = new Date(y, m, 1);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    }
  }
  return key;
};

export const Expenditures: React.FC = () => {
  // Main states
  const [expenses, setExpenses] = useState<ExpenseRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [advances, setAdvances] = useState<BazarAdvance[]>(() => {
    try {
      const raw = localStorage.getItem(ADVANCES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [rawItems, setRawItems] = useState<RawInventoryItem[]>([]);
  const [civilians, setCivilians] = useState<CivilianPerson[]>([
    { id: 'civ-tanvir', name: 'Civ Tanvir', rank: 'Civ', surname: 'Tanvir', role: 'Staff', dp: null },
    { id: 'civ-nurnabi', name: 'Civ Nur Nabi', rank: 'Civ', surname: 'Nur Nabi', role: 'Cook', dp: null },
    { id: 'civ-akramul', name: 'Civ Akramul', rank: 'Civ', surname: 'Akramul', role: 'Staff', dp: null },
    { id: 'civ-sharif', name: 'Civ Sharif', rank: 'Civ', surname: 'Sharif', role: 'Staff', dp: null },
    { id: 'civ-irfan', name: 'Civ Irfan', rank: 'Civ', surname: 'Irfan', role: 'Staff', dp: null },
    { id: 'civ-sanwar', name: 'Civ Sanwar', rank: 'Civ', surname: 'Sanwar', role: 'Staff', dp: null }
  ]);

  // Main Page View Mode: 'list' (dashboard with records) | 'add-expense' (dedicated new page for expense entry)
  const [viewMode, setViewMode] = useState<'list' | 'add-expense'>('list');

  // Sorting order for main Expense Records: 'desc' (Latest on top, default) | 'asc' (Oldest on top)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Civilian History Modal
  const [viewingHistoryCiv, setViewingHistoryCiv] = useState<CivilianPerson | null>(null);
  const [civHistoryTab, setCivHistoryTab] = useState<'ADVANCE' | 'EXPENSE'>('ADVANCE');

  // Civilian Advance month filter (default running month, e.g. "2026-10")
  const runningMonthKey = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [civMonthFilter, setCivMonthFilter] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Unique month options for the combined Month filter
  const availableMonthOptions = useMemo(() => {
    const set = new Set<string>();
    set.add(runningMonthKey);
    const now = new Date();
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    advances.forEach(a => {
      const k = getYearMonthKey(a.date);
      if (k) set.add(k);
    });
    expenses.forEach(e => {
      const k = getYearMonthKey(e.date);
      if (k) set.add(k);
    });
    return Array.from(set).sort().reverse();
  }, [advances, expenses, runningMonthKey]);

  // Main UI Mode / Modal States
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddAdvanceModal, setShowAddAdvanceModal] = useState(false);
  const [showAdvanceBreakdownModal, setShowAdvanceBreakdownModal] = useState(false);

  // Search & Filters for Main Bottom Table ("Expence record ager moto nichei thakbe")
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<'ALL' | 'Cash' | 'Due'>('ALL');
  const [filterShop, setFilterShop] = useState<'ALL' | DueShopName>('ALL');
  const [filterPerson, setFilterPerson] = useState<string>('ALL');
  const [filterDateRange, setFilterDateRange] = useState<'ALL' | 'THIS_MONTH' | 'TODAY'>('ALL');

  // History / Expense Records Modal Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyChannelFilter, setHistoryChannelFilter] = useState<'ALL' | 'Cash' | 'Due'>('ALL');
  const [historyDateFilter, setHistoryDateFilter] = useState<'ALL' | 'THIS_MONTH' | 'TODAY'>('ALL');

  // New Expense Form State
  const [formDate, setFormDate] = useState(formatCanteenDate(new Date()));
  const [formPerson, setFormPerson] = useState('Civ Tanvir');
  const [formPaymentMethod, setFormPaymentMethod] = useState<'Cash' | 'Due'>('Cash');
  const [formDueShop, setFormDueShop] = useState<DueShopName>('Grocessary Shop');
  const [formDeductAdvance, setFormDeductAdvance] = useState(true);
  const [itemRows, setItemRows] = useState<ItemRowInput[]>([
    {
      id: 'row-1',
      desc: '',
      category: 'Grocery',
      qty: 1,
      unit: 'kg',
      unitPrice: '',
      amount: ''
    }
  ]);

  // Inventory Item Selector in Form (like Member Selection in POS Sales)
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('ALL');

  // Register Advance Form State
  const [advDate, setAdvDate] = useState(formatCanteenDate(new Date()));
  const [advPerson, setAdvPerson] = useState('Civ Tanvir');
  const [advAmount, setAdvAmount] = useState<number | ''>('');
  const [advPurpose, setAdvPurpose] = useState('Daily Bazar Advance');

  // Advance Settle / Return Modal State
  const [settlingAdvance, setSettlingAdvance] = useState<BazarAdvance | null>(null);
  const [settleSpent, setSettleSpent] = useState<number | ''>('');
  const [settleReturn, setSettleReturn] = useState<number | ''>('');
  const [settleNotes, setSettleNotes] = useState('');

  // Civilian Balance Settle Context State ("Sattle Balance : Civ Tanvir")
  const [settlingCivContext, setSettlingCivContext] = useState<{
    civ: CivilianPerson;
    displayName: string;
    issuedAmount: number;
    channel: 'CASH';
    totalExpense: number;
    addBalance: number;
    returnBalance: number;
  } | null>(null);

  // Edit Expense State
  const [editingExpense, setEditingExpense] = useState<ExpenseRecord | null>(null);

  // Delete Confirmation State
  const [deleteTargetId, setDeleteTargetId] = useState<string | number | null>(null);
  const [deleteTargetAdvance, setDeleteTargetAdvance] = useState<BazarAdvance | null>(null);

  // UI state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Audio chime feedback for success / deletion
  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Initial load & data listener
  useEffect(() => {
    setRawItems(getRawInventoryItems());

    // Pull from cloud silently
    const pullCloud = async () => {
      try {
        const cloudExp = await pullKeyFromCloud(STORAGE_KEY);
        if (Array.isArray(cloudExp)) {
          const deletedExpIds = getDeletedExpenseIds();
          const localExp: ExpenseRecord[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
          const map = new Map<string, ExpenseRecord>();
          [...cloudExp, ...localExp].forEach(e => {
            if (e && e.id && !deletedExpIds.has(String(e.id))) {
              map.set(String(e.id), e);
            }
          });
          const merged = Array.from(map.values());
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          setExpenses(merged);
        }

        const cloudAdv = await pullKeyFromCloud(ADVANCES_KEY);
        if (Array.isArray(cloudAdv)) {
          const localAdv: BazarAdvance[] = JSON.parse(localStorage.getItem(ADVANCES_KEY) || '[]');
          const advMap = new Map<string, BazarAdvance>();
          [...cloudAdv, ...localAdv].forEach(a => {
            if (a && a.id) advMap.set(String(a.id), a);
          });
          const mergedAdv = Array.from(advMap.values());
          localStorage.setItem(ADVANCES_KEY, JSON.stringify(mergedAdv));
          setAdvances(mergedAdv);
        }
      } catch (err) {
        console.warn('Expense sync error:', err);
      }
    };
    pullCloud();

    // Fetch civilians from Canteen_Member
    const fetchCivilians = async () => {
      try {
        const { data } = await supabase.from('Canteen_Member').select('*');
        if (data && Array.isArray(data)) {
          const civList: CivilianPerson[] = data
            .filter((m: any) => {
              const rank = (m.Rank || m.rank || '').toUpperCase();
              const role = (m.Role || m.role || '').toUpperCase();
              const name = (m.Surname || m.Name || '').toUpperCase();
              return rank.includes('CIV') || role.includes('STAFF') || role.includes('COOK') || name.includes('TANVIR');
            })
            .map((m: any) => {
              const surname = m.Surname || m.surname || m.Name || m.name || '';
              const rank = m.Rank || 'Civ';
              return {
                id: String(m.airman_id || m['BD No'] || surname),
                name: `${rank} ${surname}`.trim(),
                rank: rank,
                surname: surname,
                role: m.Role || 'Staff',
                dp: m.DP || m.dp || m.photo_url || null,
                bdNo: m['BD No'] || ''
              };
            });

          const defaultCivs: CivilianPerson[] = [
            { id: 'civ-tanvir', name: 'Civ Tanvir', rank: 'Civ', surname: 'Tanvir', role: 'Staff', dp: null },
            { id: 'civ-nurnabi', name: 'Civ Nur Nabi', rank: 'Civ', surname: 'Nur Nabi', role: 'Cook', dp: null },
            { id: 'civ-akramul', name: 'Civ Akramul', rank: 'Civ', surname: 'Akramul', role: 'Staff', dp: null },
            { id: 'civ-sharif', name: 'Civ Sharif', rank: 'Civ', surname: 'Sharif', role: 'Staff', dp: null },
            { id: 'civ-irfan', name: 'Civ Irfan', rank: 'Civ', surname: 'Irfan', role: 'Staff', dp: null },
            { id: 'civ-sanwar', name: 'Civ Sanwar', rank: 'Civ', surname: 'Sanwar', role: 'Staff', dp: null },
          ];

          defaultCivs.forEach(def => {
            if (!civList.some(c => matchesCivilian(c.name, def))) {
              civList.push(def);
            }
          });

          setCivilians(civList);
        }
      } catch (err) {
        console.warn('Failed to fetch civilians:', err);
      }
    };

    fetchCivilians();

    const handleSync = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        setExpenses(raw ? JSON.parse(raw) : []);
      } catch {}
      try {
        const rawAdv = localStorage.getItem(ADVANCES_KEY);
        if (rawAdv) {
          const parsedAdv: BazarAdvance[] = JSON.parse(rawAdv);
          let changed = false;
          const healed = parsedAdv.map(a => {
            const hasReturn = Number(a.returnAmount) > 0;
            const hasSettledNote = Boolean(a.notes && a.notes.includes('[Settled]'));
            const hasSettledDate = Boolean(a.settledDate);
            if ((hasReturn || hasSettledNote || hasSettledDate) && a.status !== 'SETTLED') {
              changed = true;
              return { ...a, status: 'SETTLED' as const };
            }
            return a;
          });
          if (changed) {
            localStorage.setItem(ADVANCES_KEY, JSON.stringify(healed));
          }
          setAdvances(healed);
        } else {
          setAdvances([]);
        }
      } catch {}
      setRawItems(getRawInventoryItems());
    };

    window.addEventListener('canteen_expenses_updated', handleSync);
    window.addEventListener('canteen_bazar_advances_updated', handleSync);
    window.addEventListener('canteen_state_updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('canteen_expenses_updated', handleSync);
      window.removeEventListener('canteen_bazar_advances_updated', handleSync);
      window.removeEventListener('canteen_state_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Today & Month strings
  const todayStr = useMemo(() => formatCanteenDate(new Date()), []);
  const currentMonthKey = useMemo(() => {
    const parts = todayStr.split('-');
    return parts.length >= 2 ? `${parts[1]}-${parts[2]}` : '';
  }, [todayStr]);

  // Helper to dynamically calculate total actual non-due spending for a person in realtime from expenses
  const getActualSpentForPerson = (
    personName: string, 
    civList: CivilianPerson[], 
    allExpenses: ExpenseRecord[]
  ): number => {
    if (!personName) return 0;
    const target = String(personName).trim().toLowerCase();
    const matchedCiv = civList.find(c => matchesCivilian(personName, c));
    return allExpenses.filter(e => {
      // Exclude shop Due expenses from advance spending
      if (String(e.paymentMethod || '').toLowerCase() === 'due') return false;
      if (matchedCiv) {
        return matchesCivilian(e.detailedPerson, matchedCiv);
      }
      return String(e.detailedPerson || '').trim().toLowerCase() === target;
    }).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  };

  // Calculate Metrics
  const metrics = useMemo(() => {
    let total = 0;
    let cash = 0;
    let due = 0;
    let grocDue = 0;
    let poultryDue = 0;
    let bakeDue = 0;

    expenses.forEach(e => {
      const isRefund = e.category === 'Refund' || e.paymentMethod === 'Refund' || String(e.desc || '').toLowerCase().includes('cash refund') || String(e.desc || '').toLowerCase().includes('উদ্বৃত্ত ফেরত');
      if (isRefund) return;

      const amt = Number(e.amount) || 0;
      total += amt;

      const method = String(e.paymentMethod || '').toLowerCase();
      if (method === 'cash') {
        cash += amt;
      } else if (method === 'due') {
        due += amt;
        const shop = String(e.dueShop || '').toLowerCase();
        if (shop.includes('poultry')) poultryDue += amt;
        else if (shop.includes('bake') || shop.includes('bite')) bakeDue += amt;
        else grocDue += amt;
      }
    });

    const activeAdvances = advances.filter(a => {
      const isSettled = a.status === 'SETTLED' || Number(a.returnAmount) > 0 || (a.notes && a.notes.includes('[Settled]')) || Boolean(a.settledDate);
      return String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && !isSettled;
    });
    const totalActiveAdvance = activeAdvances.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    
    // Dynamic active spent & available advance:
    // Calculates net available advance across civilians in realtime.
    // Only civilians with ACTIVE unsettled advances have an outstanding balance.
    // Once settled, their active balance is ৳0.
    let netAvailableAdvance = 0;
    let totalActiveSpent = 0;

    civilians.forEach(civ => {
      const civActiveAdvs = advances.filter(a => {
        const isSettled = a.status === 'SETTLED' || Number(a.returnAmount) > 0 || (a.notes && a.notes.includes('[Settled]')) || Boolean(a.settledDate);
        return matchesCivilian(a.personName, civ) && String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && !isSettled;
      });
      if (civActiveAdvs.length === 0) return;

      const totalActiveAdv = civActiveAdvs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
      const totalActiveSp = civActiveAdvs.reduce((s, a) => s + (Number(a.spentAmount) || 0), 0);
      const totalActiveRet = civActiveAdvs.reduce((s, a) => s + (Number(a.returnAmount) || 0), 0);
      const bal = totalActiveAdv - totalActiveSp - totalActiveRet;

      netAvailableAdvance += bal;
      totalActiveSpent += totalActiveSp;
    });

    const availableAdvance = netAvailableAdvance;

    return { 
      total, 
      cash, 
      due, 
      grocDue, 
      poultryDue, 
      bakeDue, 
      totalActiveAdvance, 
      totalActiveSpent, 
      availableAdvance, 
      activeAdvancesCount: activeAdvances.length 
    };
  }, [expenses, advances, civilians]);

  // Date parsing helper for reliable chronological sorting
  const parseExpenseDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    const parts = dateStr.trim().split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
      } else {
        // DD-MM-YYYY
        return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10)).getTime();
      }
    }
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? 0 : t;
  };

  // Helper to get active advance status and balance for a person
  const getPersonAdvanceStatus = (personName: string) => {
    const active = advances.filter(a => matchesCivilian(a.personName, { name: personName }) && a.status === 'ACTIVE');
    const totalAdv = active.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
    // Realtime spent from non-due expenses matching this person
    const totalSp = getActualSpentForPerson(personName, civilians, expenses);
    const balance = totalAdv - totalSp; // + => ami back pabo, - => amar kase pabe (supports negative balance)
    return {
      activeAdvances: active,
      totalAdvance: totalAdv,
      totalSpent: totalSp,
      balance,
      hasActive: active.length > 0
    };
  };

  // Group active advances by person to see "kar kase koto tk deya ase" with realtime spending and balances
  const personAdvances = useMemo(() => {
    const map = new Map<string, { 
      personName: string; 
      totalAdvance: number; 
      totalSpent: number;
      netBalance: number;
      activeItems: BazarAdvance[]; 
    }>();
    
    // Initialize with known civilians
    civilians.forEach(c => {
      map.set(c.name, { 
        personName: c.name, 
        totalAdvance: 0, 
        totalSpent: 0, 
        netBalance: 0, 
        activeItems: [] 
      });
    });

    // Add active advances
    advances.filter(a => a.status === 'ACTIVE').forEach(a => {
      const pName = a.personName || 'Unknown';
      const existing = map.get(pName) || { 
        personName: pName, 
        totalAdvance: 0, 
        totalSpent: 0, 
        netBalance: 0, 
        activeItems: [] 
      };
      existing.totalAdvance += (Number(a.amount) || 0);
      existing.activeItems.push(a);
      map.set(pName, existing);
    });

    // Calculate totalSpent dynamically from expenses in realtime for each person
    map.forEach((existing, pName) => {
      existing.totalSpent = getActualSpentForPerson(pName, civilians, expenses);
      existing.netBalance = existing.totalAdvance - existing.totalSpent;
    });

    const list = Array.from(map.values());
    return list.sort((a, b) => Math.abs(b.totalAdvance) - Math.abs(a.totalAdvance));
  }, [civilians, advances, expenses]);

  // Realtime reconciliation of active advances with expenses so stale spentAmounts are cleaned up
  useEffect(() => {
    let hasChanges = false;
    const reconciled = advances.map(adv => {
      if (adv.status !== 'ACTIVE') return adv;
      const actualSpent = getActualSpentForPerson(adv.personName, civilians, expenses);
      const currentSpent = Number(adv.spentAmount) || 0;
      if (currentSpent !== actualSpent) {
        hasChanges = true;
        return { ...adv, spentAmount: actualSpent };
      }
      return adv;
    });

    if (hasChanges) {
      setAdvances(reconciled);
      localStorage.setItem(ADVANCES_KEY, JSON.stringify(reconciled));
      pushKeyToCloud(ADVANCES_KEY, reconciled).catch(() => {});
    }
  }, [expenses, civilians, advances]);

  // Filtered List for Main Bottom Expense Records Table ("Expence record ager moto nichei thakbe")
  const filteredExpenses = useMemo(() => {
    const result = expenses.filter(e => {
      const search = searchTerm.toLowerCase();
      const matchSearch = 
        !search ||
        (e.desc || '').toLowerCase().includes(search) ||
        (e.date || '').toLowerCase().includes(search) ||
        (e.detailedPerson || '').toLowerCase().includes(search) ||
        (e.category || '').toLowerCase().includes(search) ||
        (e.dueShop || '').toLowerCase().includes(search);

      const method = String(e.paymentMethod || '').toLowerCase();
      let matchMethod = true;
      if (filterMethod === 'Cash') matchMethod = method === 'cash';
      else if (filterMethod === 'Due') matchMethod = method === 'due';

      let matchShop = true;
      if (filterShop !== 'ALL') matchShop = e.dueShop === filterShop;

      let matchPerson = true;
      if (filterPerson !== 'ALL') matchPerson = e.detailedPerson === filterPerson;

      let matchDate = true;
      if (filterDateRange === 'TODAY') {
        matchDate = e.date === todayStr;
      } else if (filterDateRange === 'THIS_MONTH') {
        matchDate = (e.date || '').endsWith(currentMonthKey);
      }

      return matchSearch && matchMethod && matchShop && matchPerson && matchDate;
    });

    return result.sort((a, b) => {
      const timeA = parseExpenseDate(a.date);
      const timeB = parseExpenseDate(b.date);
      if (timeA !== timeB) {
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      }
      return sortOrder === 'desc'
        ? String(b.id).localeCompare(String(a.id), undefined, { numeric: true })
        : String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
    });
  }, [expenses, searchTerm, filterMethod, filterShop, filterPerson, filterDateRange, todayStr, currentMonthKey, sortOrder]);

  // Inventory Items filtering for Item Selection panel (Like POS Sales Member selection)
  const availableInventoryCategories = useMemo(() => {
    const cats = new Set<string>();
    cats.add('ALL');
    rawItems.forEach(i => {
      if (i.category) cats.add(i.category.trim());
    });
    return Array.from(cats);
  }, [rawItems]);

  const filteredRawInventory = useMemo(() => {
    return rawItems.filter(item => {
      const s = inventorySearch.toLowerCase();
      const matchesSearch = 
        !s ||
        (item.name || '').toLowerCase().includes(s) ||
        (item.nameBn || '').toLowerCase().includes(s) ||
        (item.category || '').toLowerCase().includes(s);

      const matchesCat = inventoryCategoryFilter === 'ALL' || item.category === inventoryCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [rawItems, inventorySearch, inventoryCategoryFilter]);

  // Select an inventory item into current row or append new row
  const handleSelectInventoryItem = (item: RawInventoryItem) => {
    const itemName = item.nameBn || item.name;
    const cat = item.category || 'Grocery';
    const rate = item.unitCost || '';
    const unit = item.unit || 'kg';

    const isAlreadySelected = itemRows.some(r => r.rawItemId === item.id || r.desc === itemName);

    if (isAlreadySelected) {
      // 2nd click: deselect and remove from voucher items!
      setItemRows(prev => {
        const remaining = prev.filter(r => !(r.rawItemId === item.id || r.desc === itemName));
        if (remaining.length === 0) {
          return [{
            id: `row-${Date.now()}`,
            desc: '',
            category: 'Grocery',
            qty: 1,
            unit: 'kg',
            unitPrice: '',
            amount: ''
          }];
        }
        return remaining;
      });
      showToast(`✕ Deselected "${itemName}"`);
      return;
    }

    // 1st click: select and add to voucher items!
    setItemRows(prev => {
      // Find if first row is completely empty, use it
      const firstEmptyIndex = prev.findIndex(r => !r.desc.trim() && !r.amount);
      if (firstEmptyIndex !== -1) {
        return prev.map((r, i) => {
          if (i !== firstEmptyIndex) return r;
          const qty = r.qty || 1;
          const amt = typeof rate === 'number' && rate > 0 ? Number(qty) * rate : r.amount;
          return {
            ...r,
            desc: itemName,
            category: cat,
            rawItemId: item.id,
            unit: unit,
            unitPrice: rate,
            qty: qty,
            amount: amt
          };
        });
      }

      // Otherwise append new row
      return [
        ...prev,
        {
          id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          desc: itemName,
          category: cat,
          rawItemId: item.id,
          qty: 1,
          unit: unit,
          unitPrice: rate,
          amount: typeof rate === 'number' && rate > 0 ? rate : ''
        }
      ];
    });

    showToast(`✓ Selected "${itemName}"`);
  };

  // Add another manual row
  const handleAddRow = () => {
    setItemRows(prev => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        desc: '',
        category: formPaymentMethod === 'Due' && formDueShop === 'Poultry Shop' ? 'Poultry' :
                  formPaymentMethod === 'Due' && formDueShop === 'Bake & Bite' ? 'Bakery' : 'Grocery',
        qty: 1,
        unit: 'kg',
        unitPrice: '',
        amount: ''
      }
    ]);
  };

  const handleRemoveRow = (id: string) => {
    if (itemRows.length <= 1) return;
    setItemRows(prev => prev.filter(r => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof ItemRowInput, value: any) => {
    setItemRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const updated = { ...r, [field]: value };

      if (field === 'qty' || field === 'unitPrice') {
        const q = field === 'qty' ? parseFloat(value) : parseFloat(r.qty as any);
        const p = field === 'unitPrice' ? parseFloat(value) : parseFloat(r.unitPrice as any);
        if (!isNaN(q) && !isNaN(p) && q > 0 && p > 0) {
          updated.amount = Math.round(q * p);
        }
      }

      return updated;
    }));
  };

  // Form total amount
  const formTotalAmount = useMemo(() => {
    return itemRows.reduce((sum, r) => sum + (parseFloat(r.amount as any) || 0), 0);
  }, [itemRows]);

  // Save new expenses
  const handleSaveNewExpenses = async () => {
    const validRows = itemRows.filter(r => r.desc.trim() && (parseFloat(r.amount as any) > 0 || (parseFloat(r.qty as any) > 0 && parseFloat(r.unitPrice as any) > 0)));

    if (validRows.length === 0) {
      showToast('⚠️ Please enter at least one valid item name and amount.');
      return;
    }

    // 1. Play sound IMMEDIATELY inside user gesture
    playSuccessSound();

    try {
      const newRecords: ExpenseRecord[] = validRows.map((r, idx) => {
        const qtyNum = parseFloat(r.qty as any) || undefined;
        const priceNum = parseFloat(r.unitPrice as any) || undefined;
        let amt = parseFloat(r.amount as any);
        if (isNaN(amt) || amt <= 0) {
          amt = (qtyNum && priceNum) ? qtyNum * priceNum : 0;
        }

        return {
          id: `exp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          date: formDate,
          desc: r.desc.trim(),
          category: r.category || 'Grocery',
          paymentMethod: formPaymentMethod,
          dueShop: formPaymentMethod === 'Due' ? formDueShop : undefined,
          qty: qtyNum,
          unit: r.unit || 'kg',
          unitPrice: priceNum,
          amount: amt,
          detailedPerson: formPerson,
          rawItemId: r.rawItemId,
          isCustom: !r.rawItemId
        };
      });

      const updatedAll = [...newRecords, ...expenses];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAll));
      setExpenses(updatedAll);

      // Advance deduction check:
      // "add expence theke Due dileo kno irfan er advance balace theke kno kattese"
      // If paymentMethod is DUE, NEVER deduct from advance!
      const shouldDeductFromAdvance = formPaymentMethod !== 'Due' && formDeductAdvance;
      let updatedAdvances = advances;

      if (shouldDeductFromAdvance) {
        const personActive = advances.filter(a => matchesCivilian(a.personName, { name: formPerson }) && a.status === 'ACTIVE');
        if (personActive.length === 0) {
          // If person had no prior active advance record, create one with amount 0 so balance becomes negative (canteen owes them: "আমার কাছে পাবে")
          const newNegativeAdv: BazarAdvance = {
            id: `adv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            date: formDate,
            personName: formPerson,
            amount: 0,
            spentAmount: formTotalAmount,
            returnAmount: 0,
            channel: 'CASH',
            purpose: `Bazar: ${validRows.map(r => r.desc).join(', ').substring(0, 50)}`,
            status: 'ACTIVE'
          };
          updatedAdvances = [newNegativeAdv, ...advances];
        }

        // Reconcile spentAmount directly from actual expenses
        updatedAdvances = updatedAdvances.map(adv => {
          if (adv.status !== 'ACTIVE') return adv;
          const actualSpent = getActualSpentForPerson(adv.personName, civilians, updatedAll);
          return { ...adv, spentAmount: actualSpent };
        });

        localStorage.setItem(ADVANCES_KEY, JSON.stringify(updatedAdvances));
        setAdvances(updatedAdvances);
        pushKeyToCloud(ADVANCES_KEY, updatedAdvances).catch(() => {});
        window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
      }

      // Auto restock raw inventory if linked
      for (const rec of newRecords) {
        if (rec.rawItemId && rec.qty) {
          try {
            autoRestockFromExpense({
              desc: rec.desc,
              amount: rec.amount,
              date: rec.date,
              rawItemId: rec.rawItemId,
              rawItemQty: rec.qty
            });
          } catch {}
        }
      }

      // 2. Instant UI feedback & Navigation back to list view
      setShowAddForm(false);
      setViewMode('list');
      setItemRows([
        {
          id: 'row-1',
          desc: '',
          category: 'Grocery',
          qty: 1,
          unit: 'kg',
          unitPrice: '',
          amount: ''
        }
      ]);

      if (formPaymentMethod === 'Due') {
        showToast(`✅ Saved ${newRecords.length} item(s) (৳${formTotalAmount.toLocaleString()})! [${formDueShop}] এর বকেয়া হিসেবে সফলভাবে সংরক্ষিত হয়েছে।`);
      } else if (shouldDeductFromAdvance) {
        const pStatus = getPersonAdvanceStatus(formPerson);
        const postBal = pStatus.balance - formTotalAmount;
        const balNote = postBal > 0 
          ? ` (অবশিষ্ট অগ্রিম: ৳${postBal} - আমি ব্যাক পাবো)`
          : postBal < 0
          ? ` (ব্যালেন্স: -৳${Math.abs(postBal)} - আমার কাছে পাবে)`
          : ` (অগ্রিম সম্পূর্ণ সমান)`;
        showToast(`✅ Saved ${newRecords.length} item(s) (৳${formTotalAmount.toLocaleString()})! ${formPerson} এর অগ্রিম থেকে সমন্বয় করা হয়েছে${balNote}`);
      } else {
        showToast(`✅ Saved ${newRecords.length} item(s) (৳${formTotalAmount.toLocaleString()})! সরাসরি ক্যাশ খরচ হিসেবে সংরক্ষিত হয়েছে।`);
      }

      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updatedAll }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      // 3. Background Cloud Sync without blocking user experience
      Promise.all([
        pushKeyToCloud(STORAGE_KEY, updatedAll),
        ...(shouldDeductFromAdvance ? [pushKeyToCloud(ADVANCES_KEY, updatedAdvances)] : [])
      ]).catch(err => {
        console.warn('Background sync warning:', err);
      });
    } catch (err: any) {
      showToast(`⚠️ Failed to save: ${err?.message || 'Error occurred'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Register New Bazar Advance
  const handleSaveNewAdvance = async (targetPerson?: string, targetAmount?: number, targetPurpose?: string) => {
    const personToUse = targetPerson || advPerson;
    const amt = targetAmount !== undefined ? targetAmount : parseFloat(String(advAmount));
    if (isNaN(amt) || amt <= 0) {
      showToast('⚠️ Please enter a valid advance amount (> 0).');
      return;
    }

    try {
      const newAdv: BazarAdvance = {
        id: `adv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: advDate,
        personName: personToUse,
        amount: amt,
        spentAmount: 0,
        returnAmount: 0,
        channel: 'CASH',
        purpose: (targetPurpose || advPurpose).trim() || 'Daily Bazar Advance',
        status: 'ACTIVE'
      };

      const updatedAdvances = [newAdv, ...advances];
      localStorage.setItem(ADVANCES_KEY, JSON.stringify(updatedAdvances));
      setAdvances(updatedAdvances);

      try {
        await pushKeyToCloud(ADVANCES_KEY, updatedAdvances);
      } catch {}

      window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      playSuccessSound();
      showToast(`✅ Advance ৳${amt.toLocaleString()} issued to ${personToUse}!`);
      setAdvAmount('');
      setAdvPurpose('Daily Bazar Advance');
    } catch (err: any) {
      showToast(`⚠️ Failed to issue advance: ${err?.message || 'Error'}`);
    }
  };

  // Settle Civilian Balance ("Sattle Balance : Civ Tanvir")
  // "Total Expense amount jodi Issued amount er theke beshi hoy tahole Add Balance hbe (issued Amount er soman korte joto lage), Confirm dile Cash theke oi amount ta tanvir er acc e add hoye jbe"
  // "ar jodi total Expense amount jodi Issued amount er theke kom hoy tahole Return Balance hbe (Total expense Amount er soman korte joto lage), Confirm dile tanvir er acc oi amount ta e add hoye jbe Cash a add hoye jbe"
  const handleExecuteSettlement = async () => {
    if (!settlingCivContext) return;
    const { civ, displayName, issuedAmount, totalExpense, addBalance, returnBalance } = settlingCivContext;

    try {
      playSuccessSound();

      let updatedAdvances = [...advances];

      if (totalExpense > issuedAmount) {
        // Case 1: Total Expense > Issued Amount
        // Add Balance: Cash theke oi amount ta tanvir er acc e add hoye jbe
        const topUpAdv: BazarAdvance = {
          id: `adv-${Date.now()}-settle-topup-${civ.id}`,
          date: formatCanteenDate(new Date()),
          personName: displayName,
          amount: addBalance,
          spentAmount: addBalance,
          returnAmount: 0,
          channel: 'CASH',
          purpose: `Bazar Settle Top-up (Cash Balance Added)`,
          status: 'SETTLED',
          settledDate: formatCanteenDate(new Date()),
          notes: `Settled with Cash: +৳${addBalance} paid from Cash to ${displayName}'s account`
        };

        // Mark existing active advances for this person as SETTLED
        updatedAdvances = updatedAdvances.map(a => {
          const isMatch = matchesCivilian(a.personName, civ) || matchesCivilian(a.personName, displayName);
          const isActive = String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
          if (isMatch && isActive) {
            return {
              ...a,
              status: 'SETTLED' as const,
              spentAmount: a.amount,
              returnAmount: 0,
              settledDate: formatCanteenDate(new Date()),
              notes: (a.notes || '') + ' [Settled]'
            };
          }
          return a;
        });

        // Add topUpAdv so total advances equals total expenses
        updatedAdvances = [topUpAdv, ...updatedAdvances];
        showToast(`✅ Sattle Complete! Cash থেকে ৳${addBalance.toLocaleString()} ${displayName} এর অ্যাকাউন্টে যোগ হয়েছে।`);

      } else if (issuedAmount > totalExpense) {
        // Case 2: Issued Amount > Total Expense
        // Return Balance: Tanvir er acc theke Cash a add hoye jbe
        let remSpent = totalExpense;
        let remReturn = returnBalance;

        updatedAdvances = updatedAdvances.map(a => {
          const isMatch = matchesCivilian(a.personName, civ) || matchesCivilian(a.personName, displayName);
          const isActive = String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
          if (isMatch && isActive) {
            const advAmt = Number(a.amount) || 0;
            const allocatedSpent = Math.min(advAmt, remSpent);
            remSpent = Math.max(0, remSpent - allocatedSpent);

            const allocatedReturn = Math.min(advAmt - allocatedSpent, remReturn);
            remReturn = Math.max(0, remReturn - allocatedReturn);

            return {
              ...a,
              status: 'SETTLED' as const,
              spentAmount: allocatedSpent,
              returnAmount: allocatedReturn,
              settledDate: formatCanteenDate(new Date()),
              notes: (a.notes || '') + ` [Settled: ৳${allocatedReturn} returned to Cash]`
            };
          }
          return a;
        });

        // Record refund to Expense History as requested:
        // "Cash Advance er balance sattle kore dile jodi balace add hoy tahole oiya Advance History te asbe, jodi refund hoye tahole Expense History te jbe"
        if (returnBalance > 0) {
          try {
            const refundExp: ExpenseRecord = {
              id: `exp-${Date.now()}-settle-refund-${civ.id}`,
              date: formatCanteenDate(new Date()),
              desc: `Cash Refund: ${displayName} (অব্যবহৃত ক্যাশ ফেরত)`,
              category: 'Refund',
              paymentMethod: 'Refund',
              amount: returnBalance,
              detailedPerson: displayName,
            };
            const rawCurrentExp = localStorage.getItem(STORAGE_KEY);
            const currentExps: ExpenseRecord[] = rawCurrentExp ? JSON.parse(rawCurrentExp) : expenses;
            const updatedExps = [refundExp, ...currentExps.filter(e => e.id !== refundExp.id)];
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedExps));
            setExpenses(updatedExps);
            pushKeyToCloud(STORAGE_KEY, updatedExps).catch(() => {});
            window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updatedExps }));
          } catch (eErr) {
            console.warn('Could not save refund expense:', eErr);
          }
        }

        // Also record return into canteen_txs so Capital fund records and logs reflect return immediately
        if (returnBalance > 0) {
          try {
            const returnTx = {
              id: `tx-adv-ret-${Date.now()}-${civ.id}`,
              date: formatCanteenDate(new Date()),
              memberName: '',
              airman_id: '',
              isAdvance: true,
              type: 'ADVANCE_RETURN',
              items: `Advance Return (Settle Balance from ${displayName})`,
              gateway: 'CASH',
              amount: returnBalance,
              timestamp: Date.now()
            };
            const rawCurrent = localStorage.getItem('canteen_txs');
            const currentTxs = rawCurrent ? JSON.parse(rawCurrent) : [];
            const updatedTxs = [returnTx, ...currentTxs];
            localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
            pushKeyToCloud('canteen_txs', updatedTxs).catch(() => {});
            window.dispatchEvent(new Event('canteen_txs_updated'));
          } catch (txErr) {
            console.warn('Could not save advance return to canteen_txs:', txErr);
          }
        }

        showToast(`✅ Sattle Complete! ৳${returnBalance.toLocaleString()} উদ্বৃত্ত টাকা Cash এ যুক্ত হয়েছে।`);

      } else {
        // Case 3: Exactly equal
        updatedAdvances = updatedAdvances.map(a => {
          const isMatch = matchesCivilian(a.personName, civ) || matchesCivilian(a.personName, displayName);
          const isActive = String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE';
          if (isMatch && isActive) {
            return {
              ...a,
              status: 'SETTLED' as const,
              spentAmount: a.amount,
              returnAmount: 0,
              settledDate: formatCanteenDate(new Date()),
              notes: (a.notes || '') + ' [Settled]'
            };
          }
          return a;
        });

        showToast(`✅ Sattle Complete! ${displayName} এর হিসাব সম্পূর্ণ সমন্বয় (৳০) হয়েছে।`);
      }

      localStorage.setItem(ADVANCES_KEY, JSON.stringify(updatedAdvances));
      setAdvances(updatedAdvances);

      try {
        await pushKeyToCloud(ADVANCES_KEY, updatedAdvances);
      } catch {}

      window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      setSettlingCivContext(null);
    } catch (err: any) {
      showToast(`⚠️ Settle failed: ${err?.message || 'Error'}`);
    }
  };

  // Update an existing expense
  const handleSaveEdit = async () => {
    if (!editingExpense) return;
    setIsSaving(true);
    try {
      const updatedAll = expenses.map(e => String(e.id) === String(editingExpense.id) ? editingExpense : e);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAll));
      setExpenses(updatedAll);

      // Reconcile advances immediately on edit so spent amounts are updated without delay
      const reconciledAdvances = advances.map(adv => {
        if (adv.status !== 'ACTIVE') return adv;
        const actualSpent = getActualSpentForPerson(adv.personName, civilians, updatedAll);
        return { ...adv, spentAmount: actualSpent };
      });
      localStorage.setItem(ADVANCES_KEY, JSON.stringify(reconciledAdvances));
      setAdvances(reconciledAdvances);

      try {
        await pushKeyToCloud(STORAGE_KEY, updatedAll);
        pushKeyToCloud(ADVANCES_KEY, reconciledAdvances).catch(() => {});
      } catch {}

      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updatedAll }));
      window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast(`✅ Expense updated successfully!`);
      setEditingExpense(null);
    } catch (err: any) {
      showToast(`⚠️ Failed to update: ${err?.message || 'Error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete an expense
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    const targetId = String(deleteTargetId);
    try {
      // 1. Play chime immediately inside user interaction
      playSuccessSound();

      // 2. Close modal immediately for instant UI responsiveness
      setDeleteTargetId(null);

      // 3. Record tombstone in local & cloud so it NEVER resurrects
      recordDeletedExpenseId(targetId);

      // 4. Update local state & localStorage immediately
      const updatedAll = expenses.filter(e => String(e.id) !== targetId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAll));
      setExpenses(updatedAll);

      // Reconcile advances immediately on delete so spent amounts are updated without delay
      const reconciledAdvances = advances.map(adv => {
        if (adv.status !== 'ACTIVE') return adv;
        const actualSpent = getActualSpentForPerson(adv.personName, civilians, updatedAll);
        return { ...adv, spentAmount: actualSpent };
      });
      localStorage.setItem(ADVANCES_KEY, JSON.stringify(reconciledAdvances));
      setAdvances(reconciledAdvances);

      // 5. Show toast feedback immediately
      showToast(`✅ Expense record deleted successfully! (খরচের রেকর্ড সফলভাবে মুছে ফেলা হয়েছে)`);

      // 6. Broadcast sync events
      window.dispatchEvent(new CustomEvent('canteen_expenses_updated', { detail: updatedAll }));
      window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      // 7. Push deletion to cloud asynchronously in background without delaying UI
      pushKeyToCloud(STORAGE_KEY, updatedAll).catch(err => {
        console.warn('Cloud sync error on delete:', err);
      });
      pushKeyToCloud(ADVANCES_KEY, reconciledAdvances).catch(() => {});
    } catch (err: any) {
      showToast(`⚠️ Delete failed: ${err?.message || 'Error'}`);
    }
  };

  // Delete an advance record with confirmation popup
  const handleConfirmDeleteAdvance = async () => {
    if (!deleteTargetAdvance) return;
    const targetAdv = deleteTargetAdvance;
    try {
      playSuccessSound();
      setDeleteTargetAdvance(null);
      const updated = advances.filter(a => a.id !== targetAdv.id);
      setAdvances(updated);
      localStorage.setItem(ADVANCES_KEY, JSON.stringify(updated));
      showToast(`✅ Advance ৳${Number(targetAdv.amount).toLocaleString()} deleted successfully!`);
      window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));
      pushKeyToCloud(ADVANCES_KEY, updated).catch(err => {
        console.warn('Could not sync advance deletion to cloud:', err);
      });
    } catch (err: any) {
      showToast(`⚠️ Delete failed: ${err?.message || 'Error'}`);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-20">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-[200] bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black px-5 py-3 rounded-2xl shadow-2xl border border-emerald-400/40 flex items-center space-x-2 animate-in slide-in-from-top-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
          <span className="text-xs">{toastMessage}</span>
        </div>
      )}

            {/* DEDICATED NEW PAGE: ADD EXPENSE ("Add expence e click korle new page a dekhabe") */}
      {viewMode === 'add-expense' ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Top Bar with Back Button */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-lg">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all cursor-pointer flex items-center space-x-2 text-xs font-black uppercase border border-slate-700 shadow-sm active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-400" />
                <span>← ফিরে যান (Back to Register)</span>
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-black text-white uppercase tracking-tight">
                    NEW EXPENSE VOUCHER ENTRY
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-black border border-indigo-500/30">
                    নতুন খরচের ভাউচার
                  </span>
                </div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  ইনভেন্টরি আইটেম নির্বাচন করুন অথবা সরাসরি খরচের ভাউচার তৈরি করুন
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-2xl border border-emerald-500/20">
                VOUCHER TOTAL: ৳{formTotalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                    <PackagePlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                      NEW EXPENSE VOUCHER ENTRY
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold">
                      ইনভেন্টরি আইটেম সিলেক্ট করুন অথবা সরাসরি নতুন এন্ট্রি দিন
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    VOUCHER TOTAL: ৳{formTotalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Header Fields: Date, Person, Payment Channel */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
                {/* Date */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    VOUCHER DATE (তারিখ)
                  </label>
                  <input
                    type="text"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    placeholder="DD-MM-YYYY"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Person */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    DETAILER / PERSON (দায়িত্বপ্রাপ্ত ব্যক্তি)
                  </label>
                  <select
                    value={formPerson}
                    onChange={(e) => setFormPerson(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {civilians.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Payment Channel */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    PAYMENT METHOD (পরিশোধ মাধ্যম)
                  </label>
                  <select
                    value={formPaymentMethod}
                    onChange={(e) => setFormPaymentMethod(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Cash">Cash (নগদ ক্যাশ)</option>
                    <option value="Due">Due (বকেয়া দোকান বিল)</option>
                  </select>
                </div>
              </div>

              {/* Advance Status & Deduction Banner */}
              {formPaymentMethod === 'Due' ? (
                <div className="p-4 rounded-2xl border bg-slate-950/80 border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-black text-amber-300 uppercase">বকেয়া দোকান বিল ({formDueShop}):</span>
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 font-mono font-bold border border-amber-500/20">
                          ৳{formTotalAmount.toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        এই ভাউচারটি <strong className="text-amber-300">[{formDueShop}]</strong> এর বকেয়া রেজিস্টারে যুক্ত হবে। কোনো সিভিলিয়ানের অগ্রিম ব্যালেন্স থেকে টাকা কাটা হবে না।
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded-xl text-[11px] font-bold">
                    ✓ {formPerson} এর অগ্রিম ব্যালেন্স সুরক্ষিত থাকবে
                  </div>
                </div>
              ) : (() => {
                const advStatus = getPersonAdvanceStatus(formPerson);
                const afterBal = advStatus.balance - formTotalAmount;
                return (
                  <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
                    advStatus.totalAdvance > 0 
                      ? 'bg-amber-950/30 border-amber-500/40 text-amber-200' 
                      : 'bg-slate-950/80 border-slate-800 text-slate-300'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <span className="font-black text-white">{formPerson} এর অগ্রিম হিসাব:</span>
                          <span className="font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            প্রদত্ত অগ্রিম: ৳{advStatus.totalAdvance.toLocaleString()}
                          </span>
                          <span className="font-mono text-slate-400">
                            ইতিমধ্যে খরচ: ৳{advStatus.totalSpent.toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2 mt-2">
                          <button
                            type="button"
                            onClick={() => setFormDeductAdvance(!formDeductAdvance)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 border cursor-pointer ${
                              formDeductAdvance
                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-950/40'
                                : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-md border flex items-center justify-center transition-colors ${
                              formDeductAdvance ? 'bg-white border-white text-indigo-600' : 'border-slate-500 text-transparent'
                            }`}>
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                            <span>
                              Deduct this expense (৳{formTotalAmount.toLocaleString()}) from {formPerson}'s advance
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {formDeductAdvance ? (
                      <div className="shrink-0 flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800">
                        <span className="text-[11px] font-bold text-slate-400">ভাউচার পর ব্যালেন্স:</span>
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black border ${
                          afterBal > 0 
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                            : afterBal < 0 
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {afterBal > 0 
                            ? `+ ৳${afterBal.toLocaleString()} (আমি ব্যাক পাবো)` 
                            : afterBal < 0 
                            ? `- ৳${Math.abs(afterBal).toLocaleString()} (আমার কাছে পাবে)` 
                            : '৳০ (সমান)'}
                        </span>
                      </div>
                    ) : (
                      <div className="shrink-0 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-400 font-bold">
                        সরাসরি ক্যাশ খরচ (অগ্রিম অপরিবর্তিত)
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* If Payment Method is DUE: PROMINENT SHOP SELECTOR */}
              {formPaymentMethod === 'Due' && (
                <div className="bg-gradient-to-r from-amber-950/40 via-slate-950 to-amber-950/30 border-2 border-amber-500/50 rounded-2xl p-4 animate-in fade-in">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <Store className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-black text-amber-300 uppercase tracking-widest">
                        SELECT DUE SHOP (কোন দোকানে বকেয়া হবে):
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-400/80">
                      Auto added to Due Register ✓
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {DUE_SHOPS.map(shop => {
                      const isSelected = formDueShop === shop;
                      return (
                        <div
                          key={shop}
                          onClick={() => setFormDueShop(shop)}
                          className={`p-3.5 rounded-xl border text-xs font-black uppercase flex items-center justify-between cursor-pointer transition-all select-none ${
                            isSelected
                              ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-600/30 scale-[1.02]'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-amber-500/40'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            {shop === 'Grocessary Shop' && <ShoppingCart className="w-4 h-4 text-emerald-400" />}
                            {shop === 'Poultry Shop' && <Layers className="w-4 h-4 text-amber-400" />}
                            {shop === 'Bake & Bite' && <Utensils className="w-4 h-4 text-purple-400" />}
                            <span>{shop}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-white" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* INVENTORY ITEM PICKER (POS SALES MEMBER SELECTION STYLE) */}
              <div className="bg-slate-950/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center space-x-2 uppercase tracking-wider">
                      <Boxes className="w-4 h-4 text-indigo-400" />
                      <span>Select From Raw Inventory (ইনভেন্টরি আইটেম)</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      আইটেমে ক্লিক করলে স্বয়ংক্রিয়ভাবে নিচে খরচের ভাউচার তালিকায় যুক্ত হবে
                    </p>
                  </div>

                  <div className="text-xs font-mono text-slate-400">
                    <span>Available: </span>
                    <strong className="text-indigo-400">{filteredRawInventory.length} items</strong>
                  </div>
                </div>

                {/* Search & Category Filter Pills */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text"
                      value={inventorySearch}
                      onChange={(e) => setInventorySearch(e.target.value)}
                      placeholder="Search inventory items (Rice, Dal, Oil, Meat...)"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-9 py-2 text-xs font-bold text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                    {inventorySearch && (
                      <button 
                        onClick={() => setInventorySearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto scrollbar-none shrink-0">
                    {availableInventoryCategories.slice(0, 6).map((cat) => {
                      const isSel = inventoryCategoryFilter === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setInventoryCategoryFilter(cat)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                            isSel ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Inventory Items Grid */}
                <div className="max-h-[220px] overflow-y-auto pr-1">
                  {filteredRawInventory.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 text-xs">
                      No matching raw inventory items found. You can enter item details manually below.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      {filteredRawInventory.map((item) => {
                        const isSelectedInVoucher = itemRows.some(r => r.rawItemId === item.id || r.desc === (item.nameBn || item.name));
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelectInventoryItem(item)}
                            className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none active:scale-[0.98] ${
                              isSelectedInVoucher
                                ? 'bg-indigo-950/60 border-indigo-500 shadow-md ring-1 ring-indigo-500/40'
                                : 'bg-slate-900/70 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${
                                isSelectedInVoucher
                                  ? 'bg-indigo-600 border-indigo-500 text-white' 
                                  : 'border-slate-700 bg-slate-950 text-transparent'
                              }`}>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                              </div>

                              <div className="min-w-0">
                                <h5 className="text-xs font-black text-white truncate">
                                  {item.nameBn || item.name}
                                </h5>
                                <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                                  <span className="font-mono text-emerald-400">৳{item.unitCost}/{item.unit}</span>
                                  <span>•</span>
                                  <span>Stock: {item.currentStock} {item.unit}</span>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`p-1 rounded-lg text-[10px] font-black uppercase transition-all shrink-0 ${
                                isSelectedInVoucher
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white'
                              }`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Item Rows Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                    VOUCHER ITEMS LIST ({itemRows.length})
                  </span>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg text-[11px] font-bold uppercase transition-all flex items-center space-x-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Custom Row</span>
                  </button>
                </div>

                <div className="space-y-2.5">
                  {itemRows.map((row, idx) => (
                    <div 
                      key={row.id}
                      className="bg-slate-950/80 border border-slate-800 p-3 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center gap-2.5"
                    >
                      <div className="w-6 text-center text-slate-500 font-mono text-xs hidden md:block">
                        {idx + 1}
                      </div>

                      {/* Item Name */}
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Item Name (e.g. Broiler, Onion, Bread, Rice...)"
                          value={row.desc}
                          onChange={(e) => handleUpdateRow(row.id, 'desc', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                        />
                      </div>

                      {/* Category */}
                      <div className="w-full md:w-32">
                        <select
                          value={row.category}
                          onChange={(e) => handleUpdateRow(row.id, 'category', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-300 focus:outline-none"
                        >
                          {CATEGORIES.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Qty & Unit */}
                      <div className="flex items-center space-x-1 w-full md:w-32">
                        <input
                          type="number"
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) => handleUpdateRow(row.id, 'qty', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-2 py-2 text-xs font-bold text-white text-center focus:outline-none font-mono"
                        />
                        <select
                          value={row.unit}
                          onChange={(e) => handleUpdateRow(row.id, 'unit', e.target.value)}
                          className="w-16 bg-slate-900 border border-slate-700 rounded-xl px-1.5 py-2 text-xs font-bold text-slate-400 focus:outline-none text-center"
                        >
                          <option value="kg">kg</option>
                          <option value="pcs">pcs</option>
                          <option value="litre">litre</option>
                          <option value="pkt">pkt</option>
                          <option value="can">can</option>
                          <option value="gm">gm</option>
                          <option value="box">box</option>
                        </select>
                      </div>

                      {/* Unit Price */}
                      <div className="w-full md:w-24">
                        <input
                          type="number"
                          placeholder="Rate (৳)"
                          value={row.unitPrice}
                          onChange={(e) => handleUpdateRow(row.id, 'unitPrice', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-amber-300 text-center focus:outline-none font-mono"
                        />
                      </div>

                      {/* Total Amount */}
                      <div className="w-full md:w-28">
                        <input
                          type="number"
                          placeholder="Amount (৳)"
                          value={row.amount}
                          onChange={(e) => handleUpdateRow(row.id, 'amount', e.target.value)}
                          className="w-full bg-slate-900 border border-emerald-500/30 rounded-xl px-2.5 py-2 text-xs font-black text-emerald-400 text-right focus:outline-none font-mono"
                        />
                      </div>

                      {/* Delete row */}
                      {itemRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="p-2 text-slate-500 hover:text-rose-400 rounded-xl hover:bg-slate-900 transition-colors self-end md:self-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Action */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors"
                >
                  Cancel (বাতিল)
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveNewExpenses}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95 disabled:opacity-50 flex items-center space-x-2"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSaving ? 'Saving...' : `SAVE TO EXPENCE REGISTER (৳${formTotalAmount.toLocaleString()})`}
                  </span>
                </button>
              </div>

            </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800 shadow-md">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">
                  EXPENCE REGISTER
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-black border border-indigo-500/30">
                  DAILY EXPENSES
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Canteen Daily Expenses & Purchase Register • খরচের হিসাব
              </p>
            </div>
          </div>
        </div>

        {/* Header Right Status Badge */}
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 bg-slate-950 px-3.5 py-2 rounded-2xl border border-slate-800">
          <Calendar className="w-4 h-4 text-indigo-400" />
          <span>{todayStr}</span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-mono">{expenses.length} Records</span>
        </div>
      </div>

          {/* 4 Summary Metric Cards (Sequence: Total Expenses, Cash Paid, DUE, Available Advance) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Expense */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              TOTAL EXPENSES
            </span>
            <div className="w-8 h-8 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-white font-mono tracking-tight">
            ৳{metrics.total.toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-500 font-bold mt-1">
            {expenses.length} Total recorded voucher items
          </p>
        </div>

        {/* 2. Cash Expenses */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              CASH PAID
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
            ৳{metrics.cash.toLocaleString()}
          </h3>
          <p className="text-[10px] text-slate-400 font-bold mt-1">
            Direct Cash paid for items
          </p>
        </div>

        {/* 3. Due / Payable */}
        <div 
          onClick={() => setFilterMethod(filterMethod === 'Due' ? 'ALL' : 'Due')}
          className={`border rounded-3xl p-5 cursor-pointer transition-all ${
            filterMethod === 'Due' 
              ? 'bg-amber-950/50 border-amber-500 shadow-lg shadow-amber-950/40' 
              : 'bg-slate-900 border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400">
              DUE / PAYABLE
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Store className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-400 font-mono tracking-tight">
            ৳{metrics.due.toLocaleString()}
          </h3>
          <div className="flex items-center space-x-1 mt-1 text-[9px] font-mono text-slate-400">
            <span>G: ৳{metrics.grocDue}</span>
            <span>•</span>
            <span>P: ৳{metrics.poultryDue}</span>
            <span>•</span>
            <span>B: ৳{metrics.bakeDue}</span>
          </div>
        </div>

        {/* 4. AVAILABLE ADVANCE ("Advance 500 ase oikhane available advance hbe") */}
        <div 
          onClick={() => setShowAdvanceBreakdownModal(true)}
          className={`border rounded-3xl p-5 cursor-pointer transition-all shadow-sm group select-none active:scale-[0.98] ${
            metrics.availableAdvance < 0
              ? 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400 hover:bg-rose-950/30'
              : 'bg-slate-900 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/90'
          }`}
          title="Click to view who received how much advance (সিভিলিয়ানদের অগ্রিম ও সমন্বয় দেখতে ক্লিক করুন)"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <span className={`text-[10px] font-black uppercase tracking-wider ${
                metrics.availableAdvance < 0 ? 'text-rose-400' : 'text-amber-400'
              }`}>
                AVAILABLE ADVANCE (উপলব্ধ অগ্রিম)
              </span>
              {metrics.availableAdvance < 0 ? (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  ঘাটতি (নেগেটিভ)
                </span>
              ) : (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {metrics.activeAdvancesCount} Active
                </span>
              )}
            </div>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform ${
              metrics.availableAdvance < 0 ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <h3 className={`text-2xl font-black font-mono tracking-tight ${
            metrics.availableAdvance < 0 ? 'text-rose-400' : 'text-amber-400'
          }`}>
            {metrics.availableAdvance < 0 ? `-৳${Math.abs(metrics.availableAdvance).toLocaleString()}` : `৳${metrics.availableAdvance.toLocaleString()}`}
          </h3>
          <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400 font-bold group-hover:text-amber-300 transition-colors">
            <span className="flex items-center space-x-1">
              <span>{metrics.availableAdvance < 0 ? 'অগ্রিমের চেয়ে অতিরিক্ত খরচ' : 'সিভিলিয়ান স্টাফদের অগ্রিম হিসাব'}</span>
              <ChevronRight className="w-3 h-3 text-amber-400 inline" />
            </span>
            <span className="text-[9px] font-mono text-slate-500">
              Click to view
            </span>
          </div>
        </div>
      </div>

      {/* Action Bar Above Expense Records: "+ ADD EXPENSE" ("Add expence option ta Expence record er box er opore asbe") */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-3xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner shrink-0">
            <PackagePlus className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                নতুন দৈনন্দিন খরচ যুক্ত করুন (ADD EXPENSE)
              </h3>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                New Voucher
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              ইনভেন্টরি আইটেম সিলেক্ট করে বা নতুন বিবরণ দিয়ে খরচের ভাউচার এন্ট্রি করুন
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setViewMode('add-expense')}
          className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer active:scale-95 border border-indigo-400/30 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ ADD EXPENSE (নতুন খরচ যুক্ত করুন)</span>
        </button>
      </div>

          {/* EXPENCE RECORDS LIST (MAIN TABLE AT BOTTOM OF PAGE - "Expence record ager moto nichei thakbe") */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        {/* Header of Table */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <FileText className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">
                EXPENCE RECORDS (দৈনিক খরচের হিসাব ও রেজিস্টার)
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-bold mt-0.5">
              সকল দৈনন্দিন খরচের ভাউচার তালিকা, অনুসন্ধান ও হিসাব ব্যবস্থাপনা
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
              মোট রেকর্ড: <span className="text-white font-black">{filteredExpenses.length}</span>
            </span>
            <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
              মোট খরচ: ৳{filteredExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search expenses (item name, date, detailer person, shop)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Channel Filters */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            {(['ALL', 'Cash', 'Due'] as const).map(ch => (
              <button
                key={ch}
                type="button"
                onClick={() => setFilterMethod(ch)}
                className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                  filterMethod === ch ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          {/* Date Filter */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setFilterDateRange('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                filterDateRange === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterDateRange('THIS_MONTH')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                filterDateRange === 'THIS_MONTH' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setFilterDateRange('TODAY')}
              className={`px-3 py-1 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                filterDateRange === 'TODAY' ? 'bg-slate-800 text-cyan-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
          </div>

          {/* Person Filter */}
          <div className="shrink-0">
            <select
              value={filterPerson}
              onChange={(e) => setFilterPerson(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Persons</option>
              {civilians.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Due Shop Filter (visible when filterMethod is Due) */}
          {filterMethod === 'Due' && (
            <div className="shrink-0">
              <select
                value={filterShop}
                onChange={(e) => setFilterShop(e.target.value as any)}
                className="bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-amber-300 focus:outline-none"
              >
                <option value="ALL">All Due Shops</option>
                {DUE_SHOPS.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          {/* Sort Order Selector ("Expence record e show er jonno assending , Dessendion er option thakbe , default e Latest gula opore thakbe") */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setSortOrder('desc')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer flex items-center space-x-1.5 ${
                sortOrder === 'desc' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Latest expenses first (সর্বশেষ খরচ আগে - ডিফল্ট)"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              <span>Latest (নতুন আগে)</span>
            </button>
            <button
              type="button"
              onClick={() => setSortOrder('asc')}
              className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all cursor-pointer flex items-center space-x-1.5 ${
                sortOrder === 'asc' 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Oldest expenses first (পুরনো খরচ আগে)"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>Oldest (পুরনো আগে)</span>
            </button>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th 
                  className="py-3 px-3 cursor-pointer select-none hover:text-white transition-colors"
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                  title="Click to toggle Latest/Oldest sorting"
                >
                  <div className="flex items-center space-x-1">
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 inline" />
                  </div>
                </th>
                <th className="py-3 px-3">Item Description</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-center">Qty</th>
                <th className="py-3 px-3 text-center">Rate</th>
                <th className="py-3 px-3 text-right">Amount (৳)</th>
                <th className="py-3 px-3 text-center">Channel</th>
                <th className="py-3 px-3 text-center">Detailer</th>
                <th className="py-3 px-3 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-xs font-bold">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No expense records found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="py-2.5 px-3 text-white font-black">
                      <div className="flex items-center space-x-1.5">
                        <span>{item.desc}</span>
                        {item.isCustom && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Custom
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {item.category || 'Grocery'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-300 font-mono">
                      {item.qty ? `${item.qty} ${item.unit || 'kg'}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-center text-amber-300 font-mono">
                      {item.unitPrice ? `৳${item.unitPrice}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400">
                      ৳{Number(item.amount).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center text-[10px]">
                      <span className={`px-2 py-0.5 rounded font-black ${
                        String(item.paymentMethod || '').toLowerCase() === 'due'
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}>
                        {item.paymentMethod || 'Cash'} {item.dueShop ? `(${item.dueShop})` : ''}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-300 text-[11px]">
                      {item.detailedPerson || 'Civ Tanvir'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          type="button"
                          onClick={() => setEditingExpense(item)}
                          className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800 font-bold">
          <span>Showing {filteredExpenses.length} of {expenses.length} total recorded items</span>
          <span className="font-mono text-emerald-400 font-black">
            Total: ৳{filteredExpenses.reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString()}
          </span>
        </div>
      </div>
        </div>
      )}

      {/* ADVANCE BREAKDOWN MODAL ("কার কাছে কতো টাকা দেওয়া আছে" - 2 Columns Grid) */}
      <AnimatePresence>
        {showAdvanceBreakdownModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-5">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                      CIVILIAN STAFF ADVANCE REGISTER (অগ্রিম ও খরচের হিসাব)
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold">
                      সিভিলিয়ান স্টাফদের অগ্রিম গ্রহণ, খরচের ভাউচার ও সমন্বয় ব্যালেন্স
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanceBreakdownModal(false)}
                    className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: 2 Columns Grid for Civilians ("Advanc e click korle suhdu Civ der box asbe") */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
                  <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                    <span className="text-xs font-black text-slate-300 uppercase tracking-wider">
                      CIVILIAN MEMBERS ({civilians.length})
                    </span>

                    {/* COMBINED MONTH SELECTOR ("opore combined akta Month er box thakbe default e Running mont select thakbe , je month select korbo oi month onujayi data filtr korbe") */}
                    <div className="flex items-center space-x-2 bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-1.5 shadow-sm">
                      <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">মাস ফিল্টার:</span>
                      <select
                        value={civMonthFilter}
                        onChange={(e) => setCivMonthFilter(e.target.value)}
                        className="bg-transparent text-xs font-black text-amber-300 focus:outline-none cursor-pointer"
                      >
                        <option value="ALL" className="bg-slate-900 text-white">সব মাস (All Records)</option>
                        {availableMonthOptions.map(mKey => (
                          <option key={mKey} value={mKey} className="bg-slate-900 text-white">
                            {formatMonthKeyLabel(mKey)}{mKey === runningMonthKey ? ' (চলতি মাস)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Summary for selected month */}
                  {(() => {
                    const mAdvs = advances.filter(a => {
                      if (a.status !== 'ACTIVE') return false;
                      if (civMonthFilter === 'ALL') return true;
                      return getYearMonthKey(a.date) === civMonthFilter;
                    });
                    const mExps = expenses.filter(e => {
                      if (String(e.paymentMethod || '').toLowerCase() === 'due') return false;
                      if (e.desc && e.desc.includes('Advance Settle Payout')) return false;
                      if (e.category === 'Refund' || e.paymentMethod === 'Refund' || String(e.desc || '').toLowerCase().includes('cash refund') || String(e.desc || '').toLowerCase().includes('উদ্বৃত্ত ফেরত')) return false;
                      const civHasActive = advances.some(a => {
                        const isSettled = a.status === 'SETTLED' || Number(a.returnAmount) > 0 || (a.notes && a.notes.includes('[Settled]')) || Boolean(a.settledDate);
                        return String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && !isSettled && matchesCivilian(a.personName, { name: e.detailedPerson });
                      });
                      if (!civHasActive) return false;
                      if (civMonthFilter === 'ALL') return true;
                      return getYearMonthKey(e.date) === civMonthFilter;
                    });
                    const mTotAdv = mAdvs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
                    const mTotExp = mExps.reduce((s, e) => s + (Number(e.amount) || 0), 0);
                    const mBal = mTotAdv - mTotExp;

                    return (
                      <div className="flex items-center space-x-2 flex-wrap">
                        <div className="flex items-center space-x-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                          <span className="text-slate-400">অগ্রিম:</span>
                          <span className="font-mono font-black text-amber-400">৳{mTotAdv.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                          <span className="text-slate-400">খরচ:</span>
                          <span className="font-mono font-black text-slate-200">৳{mTotExp.toLocaleString()}</span>
                        </div>
                        <span className={`text-xs font-mono font-black px-3 py-1 rounded-xl border ${
                          mBal < 0 
                            ? 'text-rose-400 bg-rose-500/10 border-rose-500/30' 
                            : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                        }`}>
                          ব্যালেন্স: {mBal < 0 ? `-৳${Math.abs(mBal).toLocaleString()}` : `৳${mBal.toLocaleString()}`}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {civilians.map(civ => {
                    // Filter advances by selected month if not ALL
                    const civAdvs = advances.filter(a => {
                      if (!matchesCivilian(a.personName, civ)) return false;
                      if (civMonthFilter === 'ALL') return true;
                      return getYearMonthKey(a.date) === civMonthFilter;
                    });
                    const activeAdvs = civAdvs.filter(a => {
                      const isSettled = a.status === 'SETTLED' || Number(a.returnAmount) > 0 || (a.notes && a.notes.includes('[Settled]')) || Boolean(a.settledDate);
                      return String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && !isSettled;
                    });
                    const hasActive = activeAdvs.length > 0;

                    // Exclude shop Due expenses from civilian advance spending, filter by month
                    const civExpenses = expenses.filter(e => {
                      if (!matchesCivilian(e.detailedPerson, civ)) return false;
                      if (String(e.paymentMethod || '').toLowerCase() === 'due') return false;
                      if (e.desc && e.desc.includes('Advance Settle Payout')) return false;
                      if (e.category === 'Refund' || e.paymentMethod === 'Refund' || String(e.desc || '').toLowerCase().includes('cash refund') || String(e.desc || '').toLowerCase().includes('উদ্বৃত্ত ফেরত')) return false;
                      if (civMonthFilter === 'ALL') return true;
                      return getYearMonthKey(e.date) === civMonthFilter;
                    });

                    // Active advances only: if settled, active amount & balance are 0
                    const totalCivAdv = hasActive
                      ? activeAdvs.reduce((s, a) => s + (Number(a.amount) || 0), 0)
                      : 0;
                    const totalCivExp = hasActive
                      ? civExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
                      : 0;
                    const civBalance = hasActive ? (totalCivAdv - totalCivExp) : 0;

                    return (
                      <div
                        key={civ.id}
                        className="bg-slate-950/90 border border-slate-800 hover:border-amber-500/40 rounded-3xl p-5 space-y-4 transition-all shadow-md flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          {/* Top Row: Pic, Rank & Name, pase History button (Month removed from individual cards as requested) */}
                          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
                            {/* Left: Pic + Rank & Name */}
                            <div className="flex items-center space-x-3 min-w-0">
                              {civ.dp ? (
                                <img
                                  src={resolveImageUrl(civ.dp)}
                                  alt={civ.name}
                                  className="w-12 h-12 rounded-2xl object-cover border border-amber-500/40 shadow-inner shrink-0"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-sm shrink-0">
                                  {getCivInitials(civ)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <h4 className="text-sm font-black text-white truncate">
                                  {civ.rank ? `${civ.rank} ` : ''}{civ.surname || civ.name}
                                </h4>
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                                    {civ.role || 'Staff Civilian'}
                                  </span>
                                  {activeAdvs.length > 0 && (
                                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                      {activeAdvs.length} Active
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Right: History button (Individual month removed, combined month is at top) */}
                            <div className="flex flex-col items-end space-y-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => setViewingHistoryCiv(civ)}
                                className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center space-x-1 border border-indigo-500/30 transition-all cursor-pointer active:scale-95"
                                title="View transaction history"
                              >
                                <History className="w-3.5 h-3.5 text-indigo-400" />
                                <span>History</span>
                              </button>
                            </div>
                          </div>

                          {/* Middle Row (niche): Total Advance, Total Expence, Available balance */}
                          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                            <div className="bg-slate-900/80 border border-slate-800/80 p-2.5 rounded-2xl">
                              <span className="text-slate-400 block mb-0.5">Total Advance</span>
                              <span className="font-mono text-amber-400 font-black text-xs">
                                ৳{totalCivAdv.toLocaleString()}
                              </span>
                            </div>

                            <div className="bg-slate-900/80 border border-slate-800/80 p-2.5 rounded-2xl">
                              <span className="text-slate-400 block mb-0.5">Total Expence</span>
                              <span className="font-mono text-slate-200 font-black text-xs">
                                ৳{totalCivExp.toLocaleString()}
                              </span>
                            </div>

                            <div className={`p-2.5 rounded-2xl border ${
                              civBalance < 0 ? 'bg-rose-950/30 border-rose-800/60' : 'bg-slate-900/80 border-slate-800/80'
                            }`}>
                              <span className="text-slate-400 block mb-0.5">Available Balance</span>
                              <span className={`font-mono font-black text-xs ${
                                civBalance > 0 ? 'text-emerald-400' : civBalance < 0 ? 'text-rose-400' : 'text-slate-300'
                              }`}>
                                {civBalance < 0 ? `-৳${Math.abs(civBalance).toLocaleString()}` : `৳${civBalance.toLocaleString()}`}
                              </span>
                            </div>
                          </div>

                          {/* Balance Status Banner */}
                          <div className={`p-2.5 rounded-2xl border text-[11px] font-bold flex items-center justify-between ${
                            civBalance > 0
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                              : civBalance < 0
                              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                              : 'bg-slate-900 border-slate-800 text-slate-400'
                          }`}>
                            <span>হিসাব স্ট্যাটাস:</span>
                            <span className="font-mono font-black">
                              {civBalance > 0
                                ? `+ ৳${civBalance.toLocaleString()} (আমি ব্যাক পাবো)`
                                : civBalance < 0
                                ? `- ৳${Math.abs(civBalance).toLocaleString()} (আমার কাছে পাবে)`
                                : '৳০ (সমান)'}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Row (er niche): Add, Sattle */}
                        <div className="pt-3 border-t border-slate-800/80 flex items-center space-x-2.5">
                          {/* Add button */}
                          <button
                            type="button"
                            onClick={() => {
                              const personTitle = civ.rank ? `${civ.rank} ${civ.surname || civ.name}`.trim() : civ.name;
                              setAdvPerson(personTitle);
                              setAdvAmount('');
                              setAdvDate(formatCanteenDate(new Date()));
                              setAdvPurpose('Daily Bazar Advance');
                              setShowAddAdvanceModal(true);
                            }}
                            className="flex-1 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-md shadow-amber-600/30 cursor-pointer active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </button>

                          {/* Sattle button */}
                          <button
                            type="button"
                            disabled={!hasActive && civBalance === 0}
                            onClick={() => {
                              if (!hasActive && civBalance === 0) {
                                showToast(`ℹ️ ${civ.name} এর হিসাব ইতিমধ্যেই সমন্বয় করা আছে (ব্যালেন্স ৳০)।`);
                                return;
                              }
                              const personTitle = civ.rank ? `${civ.rank} ${civ.surname || civ.name}`.trim() : (civ.surname || civ.name);
                              const addBal = totalCivExp > totalCivAdv ? totalCivExp - totalCivAdv : 0;
                              const retBal = totalCivAdv > totalCivExp ? totalCivAdv - totalCivExp : 0;
                              setSettlingCivContext({
                                civ,
                                displayName: personTitle,
                                issuedAmount: totalCivAdv,
                                channel: 'CASH',
                                totalExpense: totalCivExp,
                                addBalance: addBal,
                                returnBalance: retBal
                              });
                            }}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all ${
                              hasActive || civBalance !== 0
                                ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95'
                                : 'bg-slate-800/80 text-slate-500 border border-slate-700/60 cursor-not-allowed opacity-60'
                            }`}
                          >
                            <CheckSquare className="w-3.5 h-3.5" />
                            <span>{hasActive || civBalance !== 0 ? 'Sattle' : 'Settled'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADD ADVANCE MODAL ("aitar opore asbe", "Add Advance : Civ Tanvir", "Dt (Box e click korle calender show hbe), Amount, Purpose") */}
      <AnimatePresence>
        {showAddAdvanceModal && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[80] flex items-center justify-center p-3 sm:p-5">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-amber-500/50 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              {/* Header: Headline formatted exactly as requested: "Add Advance : Civ Tanvir" */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-amber-300 uppercase tracking-tight">
                      Add Advance : {advPerson}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold">
                      {advPerson} এর জন্য বাজার অগ্রিম ক্যাশ প্রদান ভাউচার
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddAdvanceModal(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Content: Dt (clickable opens calendar), Amount, Purpose */}
              <div className="p-5 sm:p-6 space-y-4">
                {/* 1. DATE / তারিখ (Box click opens calendar) */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                    DATE (তারিখ)
                  </label>
                  <div 
                    onClick={() => {
                      const input = document.getElementById('adv-date-picker-input') as HTMLInputElement | null;
                      if (input && typeof (input as any).showPicker === 'function') {
                        try {
                          (input as any).showPicker();
                        } catch {
                          input.focus();
                        }
                      } else if (input) {
                        input.focus();
                      }
                    }}
                    className="relative inline-flex items-center space-x-2 bg-slate-950 hover:bg-slate-900 border border-slate-700 hover:border-amber-500 focus:border-amber-500 rounded-xl px-3 py-1.5 cursor-pointer transition-colors group select-none shadow-xs"
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform shrink-0" />
                    <span className="text-xs font-mono font-bold text-white tracking-wide">
                      {formatCanteenDate(advDate)}
                    </span>
                    <input
                      id="adv-date-picker-input"
                      type="date"
                      value={toInputDateValue(advDate)}
                      onChange={(e) => {
                        if (e.target.value) {
                          setAdvDate(formatCanteenDate(e.target.value));
                        }
                      }}
                      className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
                    />
                  </div>
                </div>

                {/* 2. ADVANCE AMOUNT (Default empty, Presets: 500, 1000, 1500, 2000) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      AMOUNT (টাকার পরিমাণ ৳)
                    </label>
                    <span className="text-[10px] text-amber-400/80 font-bold">
                      {advAmount ? `৳${Number(advAmount).toLocaleString()}` : 'Default: খালি'}
                    </span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-amber-400 font-mono">
                      ৳
                    </span>
                    <input
                      type="number"
                      placeholder="টাকার পরিমাণ লিখুন (যেমন: 1000)"
                      value={advAmount}
                      onChange={(e) => setAdvAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-amber-500/50 rounded-xl pl-9 pr-4 py-3 text-sm font-black text-amber-300 font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      autoFocus
                    />
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex items-center space-x-2 mt-2.5">
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Preset:
                    </span>
                    {[500, 1000, 1500, 2000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAdvAmount(val)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-mono font-black transition-all cursor-pointer ${
                          advAmount === val
                            ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-400'
                            : 'bg-slate-950 text-amber-300 hover:bg-slate-800 hover:text-white border border-slate-800'
                        }`}
                      >
                        ৳{val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. PURPOSE / NOTE */}
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1.5">
                    PURPOSE / NOTE (উদ্দেশ্য / বিবরণ)
                  </label>
                  <input
                    type="text"
                    placeholder="যেমন: Daily Bazar Advance"
                    value={advPurpose}
                    onChange={(e) => setAdvPurpose(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-3 flex items-center space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddAdvanceModal(false)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleSaveNewAdvance();
                      setShowAddAdvanceModal(false);
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-amber-600/30 flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Confirm Add Advance</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SETTLE BALANCE MODAL ("Sattle Balance : Civ Tanvir") */}
      <AnimatePresence>
        {settlingCivContext && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[85] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              {/* Header: "Sattle Balance : Civ Tanvir" */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                    <CheckSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                      Sattle Balance : {settlingCivContext.displayName}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-bold">
                      অগ্রিম ও প্রকৃত বাজার খরচের ব্যালেন্স সমন্বয়
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettlingCivContext(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body: niche box e Issued Amount, Channel, Total Expense (not Editable) */}
              <div className="p-6 space-y-4">
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  {/* Issued Amount */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Issued Amount
                    </span>
                    <span className="font-mono font-black text-base text-amber-400">
                      ৳{settlingCivContext.issuedAmount.toLocaleString()}
                    </span>
                  </div>

                  {/* Channel */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800/80">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Channel
                    </span>
                    <span className="font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-white font-mono border border-slate-700">
                      {settlingCivContext.channel}
                    </span>
                  </div>

                  {/* Total Expense (not Editable) */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">
                        Total Expense
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold">
                        (not Editable)
                      </span>
                    </div>
                    <span className="font-mono font-black text-base text-slate-200">
                      ৳{settlingCivContext.totalExpense.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Total Expense amount jodi Issued amount er theke beshi hoy -> Add Balance */}
                {settlingCivContext.totalExpense > settlingCivContext.issuedAmount ? (
                  <div className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-xs space-y-2">
                    <div className="flex items-center justify-between font-black">
                      <span className="text-rose-300 uppercase tracking-wider">
                        Add Balance
                      </span>
                      <span className="font-mono text-base text-rose-400 font-black">
                        + ৳{settlingCivContext.addBalance.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-300/90 font-medium leading-relaxed">
                      Issued Amount এর সমান করতে <strong>৳{settlingCivContext.addBalance.toLocaleString()}</strong> লাগবে। Confirm দিলে Cash থেকে এই টাকা <strong>{settlingCivContext.displayName}</strong> এর অ্যাকাউন্টে যোগ হয়ে হিসাব সমান (৳০) হয়ে যাবে।
                    </p>
                  </div>
                ) : settlingCivContext.totalExpense < settlingCivContext.issuedAmount ? (
                  /* ar jodi total Expense amount jodi Issued amount er theke kom hoy -> Return Balance */
                  <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 text-xs space-y-2">
                    <div className="flex items-center justify-between font-black">
                      <span className="text-emerald-300 uppercase tracking-wider">
                        Return Balance
                      </span>
                      <span className="font-mono text-base text-emerald-400 font-black">
                        - ৳{settlingCivContext.returnBalance.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-300/90 font-medium leading-relaxed">
                      Total Expense এর সমান করতে <strong>৳{settlingCivContext.returnBalance.toLocaleString()}</strong> ফেরত দিতে হবে। Confirm দিলে এই টাকা <strong>{settlingCivContext.displayName}</strong> এর হাত থেকে Cash এ যুক্ত হয়ে হিসাব সমান (৳০) হয়ে যাবে।
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-black">
                      <span className="text-slate-300 uppercase tracking-wider">
                        Balance: ৳০ (হিসাব সমান)
                      </span>
                      <span className="font-mono text-base text-slate-200">
                        ৳০
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Issued Amount এবং Total Expense সম্পূর্ণ সমান রয়েছে।
                    </p>
                  </div>
                )}

                {/* niche confirm er pase kiso thakbe na */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleExecuteSettlement}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 cursor-pointer active:scale-95"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Confirm</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QUICK EDIT MODAL */}
      <AnimatePresence>
        {editingExpense && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <Edit2 className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    EDIT EXPENCE RECORD
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs font-bold">
                <div>
                  <label className="text-slate-400 block mb-1">Date</label>
                  <input
                    type="text"
                    value={editingExpense.date}
                    onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Item Description</label>
                  <input
                    type="text"
                    value={editingExpense.desc}
                    onChange={(e) => setEditingExpense({ ...editingExpense, desc: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-slate-400 block mb-1">Qty</label>
                    <input
                      type="number"
                      value={editingExpense.qty || ''}
                      onChange={(e) => {
                        const q = parseFloat(e.target.value) || 0;
                        const p = Number(editingExpense.unitPrice) || 0;
                        setEditingExpense({
                          ...editingExpense,
                          qty: q,
                          amount: q > 0 && p > 0 ? q * p : editingExpense.amount
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-white text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Rate</label>
                    <input
                      type="number"
                      value={editingExpense.unitPrice || ''}
                      onChange={(e) => {
                        const p = parseFloat(e.target.value) || 0;
                        const q = Number(editingExpense.qty) || 0;
                        setEditingExpense({
                          ...editingExpense,
                          unitPrice: p,
                          amount: q > 0 && p > 0 ? q * p : editingExpense.amount
                        });
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-white text-center font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Total Amount (৳)</label>
                    <input
                      type="number"
                      value={editingExpense.amount}
                      onChange={(e) => setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-emerald-500/40 rounded-xl px-2 py-2 text-emerald-400 text-right font-mono font-black"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 block mb-1">Payment Method</label>
                    <select
                      value={editingExpense.paymentMethod || 'Cash'}
                      onChange={(e) => setEditingExpense({ ...editingExpense, paymentMethod: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Due">Due</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Detailer Person</label>
                    <select
                      value={editingExpense.detailedPerson || 'Civ Tanvir'}
                      onChange={(e) => setEditingExpense({ ...editingExpense, detailedPerson: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-emerald-300"
                    >
                      {civilians.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* If Due: Shop selector */}
                {String(editingExpense.paymentMethod || '').toLowerCase() === 'due' && (
                  <div>
                    <label className="text-amber-400 block mb-1">Due Shop</label>
                    <select
                      value={editingExpense.dueShop || 'Grocessary Shop'}
                      onChange={(e) => setEditingExpense({ ...editingExpense, dueShop: e.target.value })}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-3 py-2 text-amber-300"
                    >
                      {DUE_SHOPS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase transition-colors"
                >
                  Save Changes
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE EXPENSE CONFIRMATION DIALOG */}
      <AnimatePresence>
        {deleteTargetId && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  DELETE EXPENSE?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to remove this record? This action cannot be undone.
                </p>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetId(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DELETE ADVANCE CONFIRMATION DIALOG */}
      <AnimatePresence>
        {deleteTargetAdvance && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-rose-500/40 rounded-3xl w-full max-w-sm shadow-2xl p-6 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight">
                  DELETE ADVANCE RECORD?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Are you sure you want to delete this advance record?
                </p>
                <div className="mt-3 p-3 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-bold space-y-1 text-left">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Person:</span>
                    <span className="text-white">{deleteTargetAdvance.personName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Date:</span>
                    <span className="font-mono text-slate-300">{deleteTargetAdvance.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount:</span>
                    <span className="font-mono font-black text-amber-400">৳{Number(deleteTargetAdvance.amount).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetAdvance(null)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-black uppercase transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteAdvance}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase transition-colors shadow-lg shadow-rose-600/30 cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CIVILIAN HISTORY MODAL ("History") */}
      <AnimatePresence>
        {viewingHistoryCiv && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[70] flex items-center justify-center p-3 sm:p-5">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-indigo-500/40 rounded-3xl w-full max-w-2xl h-[85vh] min-h-[550px] max-h-[90vh] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
                <div className="flex items-center space-x-3">
                  {viewingHistoryCiv.dp ? (
                    <img
                      src={resolveImageUrl(viewingHistoryCiv.dp)}
                      alt={viewingHistoryCiv.name}
                      className="w-12 h-12 rounded-2xl object-cover border border-indigo-500/40 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-black text-sm border border-indigo-500/30 shrink-0">
                      {getCivInitials(viewingHistoryCiv)}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-black text-white uppercase tracking-tight">
                        {viewingHistoryCiv.name}
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        {viewingHistoryCiv.role || 'Staff Civilian'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                      অগ্রিম গ্রহণ, খরচের ভাউচার ও সমন্বয় ইতিহাস
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingHistoryCiv(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Summary Strip */}
                {(() => {
                  const civAdvs = advances.filter(a => matchesCivilian(a.personName, viewingHistoryCiv));
                  const activeCivAdvs = civAdvs.filter(a => {
                    const isSettled = a.status === 'SETTLED' || Number(a.returnAmount) > 0 || (a.notes && a.notes.includes('[Settled]')) || Boolean(a.settledDate);
                    return String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && !isSettled;
                  });
                  const hasActive = activeCivAdvs.length > 0;

                  // Exclude shop Due expenses and Refunds from civilian advance spending
                  const civExps = expenses.filter(e => 
                    matchesCivilian(e.detailedPerson, viewingHistoryCiv) &&
                    String(e.paymentMethod || '').toLowerCase() !== 'due' &&
                    e.category !== 'Refund' &&
                    e.paymentMethod !== 'Refund' &&
                    !String(e.desc || '').toLowerCase().includes('cash refund') &&
                    !String(e.desc || '').toLowerCase().includes('উদ্বৃত্ত ফেরত')
                  );
                  const totalAdv = civAdvs.reduce((s, a) => s + (Number(a.amount) || 0), 0);
                  const totalExp = civExps.reduce((s, e) => s + (Number(e.amount) || 0), 0);
                  
                  // Active unspent balance remaining in staff's hand:
                  // If all advances are settled, active balance is ৳0
                  const bal = hasActive
                    ? activeCivAdvs.reduce((s, a) => s + (Number(a.amount || 0) - Number(a.spentAmount || 0) - Number(a.returnAmount || 0)), 0)
                    : 0;

                  return (
                    <div className="grid grid-cols-3 gap-2.5 text-center text-xs font-bold">
                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px] mb-1">মোট অগ্রিম</span>
                        <span className="font-mono text-amber-400 font-black text-sm">৳{totalAdv.toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px] mb-1">বাজার খরচ (ক্যাশ)</span>
                        <span className="font-mono text-slate-200 font-black text-sm">৳{totalExp.toLocaleString()}</span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                        <span className="text-slate-400 block text-[10px] mb-1">অবশিষ্ট ব্যালেন্স</span>
                        <span className={`font-mono font-black text-sm ${bal > 0 ? 'text-emerald-400' : bal < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {hasActive 
                            ? (bal > 0 ? `+৳${bal.toLocaleString()}` : bal < 0 ? `-৳${Math.abs(bal).toLocaleString()}` : '৳০') 
                            : '৳০ (সমন্বিত)'}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* Tabs: Advance History & Expense History side-by-side */}
                {(() => {
                  const expenseList = expenses.filter(e => matchesCivilian(e.detailedPerson, viewingHistoryCiv));
                  
                  // Also include any settled advance returns if not already present in expenseList
                  // "Cash Advance er balance sattle kore dile jodi balace add hoy tahole oiya Advance History te asbe , jodi refund hoye tahole Expense History te jbe"
                  const returnItemsFromAdvs = advances
                    .filter(a => matchesCivilian(a.personName, viewingHistoryCiv) && Number(a.returnAmount) > 0)
                    .filter(a => {
                      const retAmt = Number(a.returnAmount);
                      return !expenseList.some(e => 
                        (e.category === 'Refund' || e.paymentMethod === 'Refund' || String(e.desc || '').toLowerCase().includes('cash refund')) &&
                        Math.abs(Number(e.amount) - retAmt) < 0.01
                      );
                    })
                    .map((a, idx) => ({
                      id: `ret-${a.id || idx}`,
                      date: a.settledDate || a.date,
                      desc: `Cash Refund: ${a.personName || viewingHistoryCiv?.name || 'Staff'} (উদ্বৃত্ত ক্যাশ ফেরত)`,
                      category: 'Refund',
                      amount: Number(a.returnAmount) || 0,
                      isDueExp: false,
                      isRefund: true,
                      dueShop: undefined,
                      rawExpenseId: undefined
                    }));

                  const allCivExpenseItems = [
                    ...expenseList.map(e => ({
                      id: e.id,
                      date: e.date,
                      desc: e.desc,
                      category: e.category,
                      amount: Number(e.amount) || 0,
                      isDueExp: String(e.paymentMethod || '').toLowerCase() === 'due',
                      isRefund: e.category === 'Refund' || e.paymentMethod === 'Refund' || String(e.desc || '').toLowerCase().includes('cash refund') || String(e.desc || '').toLowerCase().includes('উদ্বৃত্ত ফেরত'),
                      dueShop: e.dueShop,
                      rawExpenseId: e.id
                    })),
                    ...returnItemsFromAdvs
                  ].sort((a, b) => parseExpenseDate(b.date) - parseExpenseDate(a.date));

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setCivHistoryTab('ADVANCE')}
                          className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                            civHistoryTab === 'ADVANCE'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Advance History</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${civHistoryTab === 'ADVANCE' ? 'bg-amber-500/30 text-amber-200' : 'bg-slate-800 text-slate-400'}`}>
                            {advances.filter(a => matchesCivilian(a.personName, viewingHistoryCiv)).length}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCivHistoryTab('EXPENSE')}
                          className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                            civHistoryTab === 'EXPENSE'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Expense History</span>
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${civHistoryTab === 'EXPENSE' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-slate-800 text-slate-400'}`}>
                            {allCivExpenseItems.length}
                          </span>
                        </button>
                      </div>

                      {/* Tab Content: Advance History */}
                      {civHistoryTab === 'ADVANCE' && (
                        <div className="space-y-2 animate-fadeIn">
                          <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Advance History</span>
                          </h4>
                          {advances.filter(a => matchesCivilian(a.personName, viewingHistoryCiv)).length === 0 ? (
                            <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-xl text-center">কোনো অগ্রিম রেকর্ড নেই</p>
                          ) : (
                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                              {advances.filter(a => matchesCivilian(a.personName, viewingHistoryCiv)).map(a => (
                                <div key={a.id} className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs hover:border-slate-700 transition-colors">
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <span className="font-mono text-slate-400 text-[11px]">{a.date}</span>
                                      <span className="font-mono font-black text-amber-400">৳{Number(a.amount).toLocaleString()}</span>
                                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${a.status === 'ACTIVE' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                        {a.status}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5">{a.purpose || 'Daily Bazar Advance'}</p>
                                    {a.notes && <p className="text-[10px] text-slate-500 italic mt-0.5">{a.notes}</p>}
                                  </div>
                                  <div className="flex items-center space-x-2.5">
                                    {Number(a.spentAmount) > 0 && (
                                      <span className="text-[10px] font-mono text-slate-400">খরচ: ৳{a.spentAmount}</span>
                                    )}
                                    {Number(a.returnAmount) > 0 && (
                                      <span className="text-[10px] font-mono text-emerald-400 font-bold">ফেরত: ৳{a.returnAmount}</span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => setDeleteTargetAdvance(a)}
                                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                      title="Delete advance record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tab Content: Expense History */}
                      {civHistoryTab === 'EXPENSE' && (
                        <div className="space-y-2 animate-fadeIn">
                          <h4 className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            <span>Expense History</span>
                          </h4>
                          {allCivExpenseItems.length === 0 ? (
                            <p className="text-xs text-slate-500 italic p-3 bg-slate-950 rounded-xl text-center">কোনো খরচের ভাউচার নেই</p>
                          ) : (
                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                              {allCivExpenseItems.map(item => {
                                const isRefund = item.isRefund;
                                const isDueExp = item.isDueExp;
                                return (
                                  <div key={item.id} className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                                    <div>
                                      <div className="flex items-center space-x-2 flex-wrap">
                                        <span className="font-mono text-slate-400 text-[11px]">{item.date}</span>
                                        <span className="font-bold text-white">{item.desc}</span>
                                        <span className="text-[10px] text-slate-500">({item.category || (isRefund ? 'Refund' : 'Grocery')})</span>
                                        {isRefund && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                            ক্যাশ রিফান্ড [ফেরত]
                                          </span>
                                        )}
                                        {isDueExp && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded font-black bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                            বকেয়া [{item.dueShop || 'দোকান বিল'}] - অগ্রিম নয়
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className={`font-mono font-black ${isRefund ? 'text-cyan-400' : isDueExp ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {isRefund ? `+ ৳${item.amount.toLocaleString()} (ফেরত)` : `৳${item.amount.toLocaleString()}`}
                                      </span>
                                      {item.rawExpenseId && (
                                        <button
                                          type="button"
                                          onClick={() => setDeleteTargetId(item.rawExpenseId!)}
                                          className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                          title="Delete expense record"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

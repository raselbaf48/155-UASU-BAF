import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Landmark, 
  Layers, 
  ArrowLeft, 
  Search, 
  Check, 
  X, 
  Plus, 
  Trash2, 
  Loader2,
  Calendar, 
  Coins, 
  Users, 
  UserCheck, 
  Filter, 
  FileText, 
  Banknote, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Coffee, 
  Receipt, 
  ChevronLeft, 
  ChevronRight,
  Clock,
  Sparkles,
  PhoneCall,
  LayoutGrid,
  List,
  Tag,
  Wallet,
  CreditCard,
  ShieldCheck,
  AlertTriangle,
  Pencil,
  Settings,
  GripVertical
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { pushKeyToCloud, pullKeyFromCloud, recordDeletedTxId, reconcileExpenseOnFundTxDelete } from '../utils/canteenCloudSync';
import { resolveImageUrl, getCanteenConfig } from '../utils/canteenSettings';
import { formatCanteenDate } from '../utils/dateUtils';
import { formatBengaliMonthYear } from '../utils/exportCanteenBillExcel';
import { DateNavigator, getTodayYMD } from '../components/DateNavigator';
import { FundHistoryModal } from '../components/FundHistoryModal';
import { 
  BillCategory, 
  isOfficerMember, 
  isAirmanMember, 
  isCivilianMember, 
  getRunningMonthKey,
  getTxMonthKey,
  getTxCategory 
} from './MemberDB';
import { sortCanteenMembersByOfficeSeniority } from '../utils/canteenSeniority';

interface FundBatchBillPageProps {
  category: 'UNIT_FUND' | 'OTHERS';
  members: any[];
  allTxs: any[];
  selectedMonth: string;
  onBack: () => void;
  onCategoryChange: (category: BillCategory) => void;
  onSuccess: () => void;
  openStatement: (member: any) => void;
  openPayBill: (member: any) => void;
  openProfile: (member: any) => void;
  setInitialBillMember?: (member: any) => void;
  handleExportBills?: () => void;
  getMemberBanglaName: (m: any) => string;
  getMemberBanglaRank: (m: any) => string;
  formatRankBn: (r: string) => string;
  formatMemberNameBn: (n: string) => string;
  getMemberTotalDue: (member: any, category: BillCategory) => number;
  getMemberFilteredBill: (member: any, category: BillCategory, month: string) => number;
  onRemoveTx?: (tx: any) => Promise<void> | void;
}

export const formatActiveMonth = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') return 'All Months';
  const parts = String(monthKey).split('-');
  if (parts.length < 2) return monthKey;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const name = monthNames[month - 1] || parts[1];
  const yy = String(year).slice(-2);
  return `${name}-${yy}`;
};

export const FundBatchBillPage: React.FC<FundBatchBillPageProps> = ({
  category,
  members,
  allTxs,
  selectedMonth: initialSelectedMonth,
  onBack,
  onCategoryChange,
  onSuccess,
  openStatement,
  openPayBill,
  openProfile,
  setInitialBillMember,
  handleExportBills,
  getMemberBanglaName,
  getMemberBanglaRank,
  formatRankBn,
  formatMemberNameBn,
  getMemberTotalDue,
  getMemberFilteredBill,
  onRemoveTx,
}) => {
  const isUnitFund = category === 'UNIT_FUND';
  const categoryTitle = isUnitFund ? 'UNIT FUND' : 'OTHERS BILL';

  // Batch Add Form State
  const [amount, setAmount] = useState<string>('');
  const [amountMode, setAmountMode] = useState<'SAME' | 'DIFFERENT'>('SAME');
  const [memberCustomAmounts, setMemberCustomAmounts] = useState<Record<string, string>>({});
  const [fillAllInput, setFillAllInput] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(() => getTodayYMD());
  
  // Avro / Bijoy ANSI to Unicode converter helper for Bengali input
  const convertAvroAnsiToUnicode = (text: string): string => {
    if (!text) return '';
    const trimmed = text.trim();
    const wholeWords: Record<string, string> = {
      'evRvi': 'বাজার',
      'evRvi / evRvi m`vB': 'বাজার / বাজার সদাই',
      'gvm': 'মাস',
      'wWbvi': 'ডিনার',
      'wd': 'ফি',
      'wcKwbK': 'পিকনিক',
      'Pv': 'চা',
      'bv¯Ív': 'নাস্তা',
      'Awdm': 'অফিস',
      'dvÛ': 'ফান্ড',
      'Kj¨vY': 'কল্যাণ',
      'evsjv': 'বাংলা',
      'Av‡qvRb': 'আয়োজন',
      'me': 'মেস',
      'mgwó': 'সমষ্টি'
    };
    if (wholeWords[trimmed]) return wholeWords[trimmed];

    return text
      .replace(/\bevRvi\b/gi, 'বাজার')
      .replace(/\bwWbvi\b/gi, 'ডিনার')
      .replace(/\bwcKwbK\b/gi, 'পিকনিক')
      .replace(/\bbv¯Ív\b/gi, 'নাস্তা')
      .replace(/\bAwdm\b/gi, 'অফিস')
      .replace(/\bdvÛ\b/gi, 'ফান্ড')
      .replace(/\bKj¨vY\b/gi, 'কল্যাণ');
  };

  // Purpose Presets & Notes State
  const DEFAULT_PURPOSE_PRESETS = [
    'Mess Dinner Fee',
    'মেস ডিনার ফি',
    'Bazar / Market',
    'বাজার / বাজার সদাই',
    'Picnic & Refreshment',
    'পিকনিক ও রিফ্রেশমেন্ট',
    'Special Event Catering',
    'বিশেষ আয়োজন',
    'কল্যাণ তহবিল',
    'মেস তহবিল',
    'ক্রীড়া ও বিনোদন',
    'মসজিদ তহবিল',
    'অফিস ফান্ড',
    'Form-793'
  ];

  const [purposePresets, setPurposePresets] = useState<string[]>(() => {
    try {
      const deletedSet = new Set<string>();
      const delRaw = localStorage.getItem('canteen_deleted_purpose_presets');
      if (delRaw) {
        const parsedDel = JSON.parse(delRaw);
        if (Array.isArray(parsedDel)) parsedDel.forEach(p => deletedSet.add(String(p).trim()));
      }

      const saved = localStorage.getItem('canteen_purpose_presets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed.filter(p => typeof p === 'string' && !deletedSet.has(p.trim()));
          if (filtered.length > 0) return filtered;
        }
      }
      return DEFAULT_PURPOSE_PRESETS.filter(p => !deletedSet.has(p.trim()));
    } catch {}
    return DEFAULT_PURPOSE_PRESETS;
  });

  // Pull presets and deleted list from cloud on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [cloudPresets, cloudDeleted] = await Promise.all([
          pullKeyFromCloud('canteen_purpose_presets'),
          pullKeyFromCloud('canteen_deleted_purpose_presets')
        ]);
        if (!isMounted) return;

        const deletedSet = new Set<string>();
        try {
          const localDel = JSON.parse(localStorage.getItem('canteen_deleted_purpose_presets') || '[]');
          if (Array.isArray(localDel)) localDel.forEach(d => deletedSet.add(String(d).trim()));
        } catch {}
        if (Array.isArray(cloudDeleted)) {
          cloudDeleted.forEach(d => deletedSet.add(String(d).trim()));
          try {
            localStorage.setItem('canteen_deleted_purpose_presets', JSON.stringify(Array.from(deletedSet)));
          } catch {}
        }

        if (Array.isArray(cloudPresets) && cloudPresets.length > 0) {
          const filtered = cloudPresets.filter((p: any) => typeof p === 'string' && !deletedSet.has(p.trim()));
          if (filtered.length > 0) {
            setPurposePresets(filtered);
            try {
              localStorage.setItem('canteen_purpose_presets', JSON.stringify(filtered));
              localStorage.setItem('canteen_purpose_presets_customized', 'true');
            } catch {}
          } else {
            const fallbackList = DEFAULT_PURPOSE_PRESETS.filter(p => !deletedSet.has(p.trim()));
            setPurposePresets(fallbackList);
          }
        } else {
          // If cloud has no presets or empty array, provide default presets
          const fallbackList = DEFAULT_PURPOSE_PRESETS.filter(p => !deletedSet.has(p.trim()));
          setPurposePresets(fallbackList);
          pushKeyToCloud('canteen_purpose_presets', fallbackList).catch(() => {});
        }
      } catch {}
    })();
    return () => { isMounted = false; };
  }, []);
  const [purpose, setPurpose] = useState<string>('');
  const [singleMemberCategories, setSingleMemberCategories] = useState<string[]>([]);
  const [singleMemberCategoryAmounts, setSingleMemberCategoryAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string>('');
  const [newPresetInput, setNewPresetInput] = useState<string>('');
  const [isAddingPreset, setIsAddingPreset] = useState<boolean>(false);
  const [isEditingPresets, setIsEditingPresets] = useState<boolean>(false);

  const [othersFundSource, setOthersFundSource] = useState<'Cash' | 'UCB'>('Cash');
  const [cashDeductTarget, setCashDeductTarget] = useState<'MANAGER' | 'STAFF' | 'PREV_MANAGER'>('MANAGER');
  const [isPrevManager, setIsPrevManager] = useState<boolean>(false);
  const [selectedStaffName, setSelectedStaffName] = useState<string>('Civ Tanvir');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Officer & Airmen rank filter state
  const [officerRankFilter, setOfficerRankFilter] = useState<string>('ALL');
  const [airmanRankFilter, setAirmanRankFilter] = useState<string>('ALL');

  // Transaction edit & delete state
  const [txToEdit, setTxToEdit] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [txToDelete, setTxToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletedTxIds, setDeletedTxIds] = useState<Set<string>>(new Set());

  // Dynamic Success Popup State for Batch Post & Delete
  const [batchSuccessData, setBatchSuccessData] = useState<{
    memberCount: number;
    totalAmount: number;
    category: string;
    purpose: string;
    source: string;
    targetStaff?: string;
  } | null>(null);

  const [deleteSuccessData, setDeleteSuccessData] = useState<{
    memberName: string;
    bdNo: string;
    amount: number;
    purpose: string;
  } | null>(null);

  const playSuccessChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.5);
      });
    } catch {}
  };

  const playPopSound = () => {
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
      osc.stop(now + 0.23);
    } catch {}
  };

  const canteenConfig = useMemo(() => getCanteenConfig(), []);
  const managerName = canteenConfig?.managerName || 'LAC Nishad';

  // Civilian staff list
  const civilianStaffList = useMemo(() => {
    const civs: Array<{ id: string; name: string; surname: string }> = [];
    const seenNames = new Set<string>();

    members.forEach((m) => {
      if (isCivilianMember(m)) {
        const surname = m['Surname'] || m.surname || m.name || '';
        const rank = m['Rank'] || m.rank || 'Civ';
        const fullName = `${rank} ${surname}`.trim() || surname;
        const key = fullName.toLowerCase();
        if (fullName && !seenNames.has(key)) {
          seenNames.add(key);
          civs.push({
            id: String(m.airman_id || m['BD No'] || surname),
            name: fullName,
            surname: surname
          });
        }
      }
    });

    const defaultCivs = [
      { id: 'civ-tanvir', name: 'Civ Tanvir', surname: 'Tanvir' },
      { id: 'civ-nurnabi', name: 'Civ Nur Nabi', surname: 'Nur Nabi' },
      { id: 'civ-akramul', name: 'Civ Akramul', surname: 'Akramul' },
      { id: 'civ-sharif', name: 'Civ Sharif', surname: 'Sharif' },
      { id: 'civ-irfan', name: 'Civ Irfan', surname: 'Irfan' },
      { id: 'civ-sanwar', name: 'Civ Sanwar', surname: 'Sanwar' }
    ];

    defaultCivs.forEach((def) => {
      const key = def.name.toLowerCase();
      if (!seenNames.has(key)) {
        seenNames.add(key);
        civs.push(def);
      }
    });

    return civs;
  }, [members]);

  // Target month key computed directly from selected date (Date e ja thake oi month er bill er sathe add hbe)
  const targetMonthKey = useMemo(() => {
    if (!txDate) return getRunningMonthKey();
    const parts = txDate.split('-');
    if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
    const dateObj = new Date(txDate);
    return !isNaN(dateObj.getTime())
      ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
      : getRunningMonthKey();
  }, [txDate]);

  // Set of member IDs who already have a Unit Fund entry in this target month (Prevent double entry)
  const membersWithUnitFundThisMonth = useMemo(() => {
    const set = new Set<string>();
    if (category !== 'UNIT_FUND') return set;

    const localTxs = (() => {
      try {
        return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      } catch {
        return [];
      }
    })();
    const combinedTxs = [...(allTxs || []), ...localTxs];

    combinedTxs.forEach((tx: any) => {
      if (!tx) return;
      if (getTxCategory(tx) !== 'UNIT_FUND') return;
      if (tx.type === 'BILL PAYMENT' || tx.gateway === 'PAID') return;
      if (deletedTxIds.has(String(tx.id))) return;

      const txMonth = tx.monthKey || getTxMonthKey(tx.date || tx.created_at || tx.createdAt || tx.timestamp || tx);
      if (txMonth !== targetMonthKey) return;

      const cleanBd = String(tx.bdNo || tx['BD No'] || tx.airman_id || '').replace(/\D/g, '');
      const cleanBdNoZeros = cleanBd.replace(/^0+/, '');
      const airmanId = String(tx.airman_id || '').toLowerCase().trim();

      members.forEach((m) => {
        const mCleanBd = String(m['BD No'] || m.bdNo || m.airman_id || '').replace(/\D/g, '');
        const mCleanBdNoZeros = mCleanBd.replace(/^0+/, '');
        const mAirman = String(m.airman_id || '').toLowerCase().trim();

        const isBdMatch = cleanBd && mCleanBd && (cleanBd === mCleanBd || cleanBdNoZeros === mCleanBdNoZeros);
        const isAirmanMatch = airmanId && mAirman && airmanId === mAirman;

        if (isBdMatch || isAirmanMatch) {
          set.add(String(m.airman_id || m['BD No']));
        }
      });
    });

    return set;
  }, [allTxs, category, targetMonthKey, members, deletedTxIds]);

  // Member Selection State
  const [selectedAirmanIds, setSelectedAirmanIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [memberFilter, setMemberFilter] = useState<'ALL' | 'OFFICER' | 'AIRMEN' | 'CIVILIAN'>('ALL');
  const [dueListFilter, setDueListFilter] = useState<'ALL' | 'WITH_DUE'>('ALL');
  const [viewMode, setViewMode] = useState<'CARDS' | 'TABLE'>('TABLE');
  const [activeTab, setActiveTab] = useState<'ADD_BATCH' | 'RECENT_LOG'>('ADD_BATCH');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState<boolean>(false);
  const [historySearch, setHistorySearch] = useState<string>('');

  // Quick preset notes for Others fund
  const quickNotes = [
    'Mess Dinner Fee',
    'Picnic & Refreshment',
    'Farewell & Reception Gift',
    'Sports & Entertainment Fund',
    'Special Event Catering',
    'Emergency Welfare Grant',
    'Official Stationery & Token'
  ];

  const quickAmounts = [100, 200, 300, 500, 1000, 1500];

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Add custom purpose preset handler
  const handleAddPreset = () => {
    const raw = newPresetInput.trim();
    if (!raw) return;
    const trimmed = convertAvroAnsiToUnicode(raw);
    if (!trimmed) return;
    let updated = purposePresets;
    if (!purposePresets.includes(trimmed)) {
      updated = [...purposePresets, trimmed];
      setPurposePresets(updated);

      // Un-delete if previously deleted
      const currentDeleted: string[] = (() => {
        try {
          const s = localStorage.getItem('canteen_deleted_purpose_presets');
          return s ? JSON.parse(s) : [];
        } catch { return []; }
      })();
      const updatedDeleted = currentDeleted.filter(d => d !== trimmed);

      try {
        localStorage.setItem('canteen_purpose_presets', JSON.stringify(updated));
        localStorage.setItem('canteen_purpose_presets_customized', 'true');
        localStorage.setItem('canteen_deleted_purpose_presets', JSON.stringify(updatedDeleted));
      } catch {}
      pushKeyToCloud('canteen_purpose_presets', updated).catch(() => {});
      pushKeyToCloud('canteen_deleted_purpose_presets', updatedDeleted).catch(() => {});
      showToast(`Category "${trimmed}" added and saved!`);
    }
    if (selectedCount === 1 && !isUnitFund) {
      setSingleMemberCategories(prev => {
        const next = prev.includes(trimmed) ? prev : [...prev, trimmed];
        setPurpose(next.join(', '));
        return next;
      });
    } else {
      setPurpose(trimmed);
    }
    setNewPresetInput('');
    setIsAddingPreset(false);
  };

  const handleAddPresetWithName = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed) return;
    let updated = purposePresets;
    if (!purposePresets.includes(trimmed)) {
      updated = [...purposePresets, trimmed];
      setPurposePresets(updated);

      // Un-delete if previously deleted
      const currentDeleted: string[] = (() => {
        try {
          const s = localStorage.getItem('canteen_deleted_purpose_presets');
          return s ? JSON.parse(s) : [];
        } catch { return []; }
      })();
      const updatedDeleted = currentDeleted.filter(d => d !== trimmed);

      try {
        localStorage.setItem('canteen_purpose_presets', JSON.stringify(updated));
        localStorage.setItem('canteen_purpose_presets_customized', 'true');
        localStorage.setItem('canteen_deleted_purpose_presets', JSON.stringify(updatedDeleted));
      } catch {}
      pushKeyToCloud('canteen_purpose_presets', updated).catch(() => {});
      pushKeyToCloud('canteen_deleted_purpose_presets', updatedDeleted).catch(() => {});
      showToast(`Category "${trimmed}" added and saved!`);
    }
    setPurpose(trimmed);
    setNewPresetInput('');
    setIsAddingPreset(false);
  };

  const handleRemovePreset = (presetToRemove: string) => {
    const updated = purposePresets.filter(p => p !== presetToRemove);
    setPurposePresets(updated);

    // Track in deleted list so it NEVER returns from cloud or defaults
    const currentDeleted: string[] = (() => {
      try {
        const s = localStorage.getItem('canteen_deleted_purpose_presets');
        return s ? JSON.parse(s) : [];
      } catch { return []; }
    })();
    const updatedDeleted = Array.from(new Set([...currentDeleted, presetToRemove]));

    try {
      localStorage.setItem('canteen_purpose_presets', JSON.stringify(updated));
      localStorage.setItem('canteen_purpose_presets_customized', 'true');
      localStorage.setItem('canteen_deleted_purpose_presets', JSON.stringify(updatedDeleted));
    } catch {}
    pushKeyToCloud('canteen_purpose_presets', updated).catch(() => {});
    pushKeyToCloud('canteen_deleted_purpose_presets', updatedDeleted).catch(() => {});
    if (purpose === presetToRemove) {
      setPurpose(updated[0] || '');
    }
    showToast(`Category "${presetToRemove}" removed! It will not return.`);
  };

  const handleMovePreset = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex < 0 || 
      toIndex < 0 || 
      fromIndex >= purposePresets.length || 
      toIndex >= purposePresets.length || 
      fromIndex === toIndex
    ) return;
    const copy = [...purposePresets];
    const [movedItem] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, movedItem);
    setPurposePresets(copy);
    try {
      localStorage.setItem('canteen_purpose_presets', JSON.stringify(copy));
      localStorage.setItem('canteen_purpose_presets_customized', 'true');
    } catch {}
    pushKeyToCloud('canteen_purpose_presets', copy).catch(() => {});
    showToast(`"${movedItem}" এর অবস্থান পরিবর্তন করা হয়েছে`);
  };

  // Distinct officer ranks for officer rank filter
  const officerRanks = useMemo(() => {
    const ranksSet = new Set<string>();
    members.forEach((m) => {
      if (isOfficerMember(m)) {
        const r = String(m['Rank'] || m.rank || '').trim().toUpperCase();
        if (r && r !== '-') ranksSet.add(r);
      }
    });
    const standardOrder = [
      'AIR CHIEF MSHL', 'AIR MSHL', 'AVM', 'AIR CDRE', 'GP CAPT', 
      'WG CDR', 'SQN LDR', 'FLT LT', 'FLG OFFR', 'FG OFFR', 'PLT OFFR'
    ];
    return Array.from(ranksSet).sort((a, b) => {
      const idxA = standardOrder.findIndex(o => a.includes(o));
      const idxB = standardOrder.findIndex(o => b.includes(o));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [members]);

  // Distinct airman ranks for airman rank filter (Member selection theke Airmen er o Rank wise Filter kora jbe)
  const airmanRanks = useMemo(() => {
    const ranksSet = new Set<string>();
    members.forEach((m) => {
      if (isAirmanMember(m)) {
        const r = String(m['Rank'] || m.rank || '').trim().toUpperCase();
        if (r && r !== '-') ranksSet.add(r);
      }
    });
    const standardAirmanOrder = [
      'MWO', 'MASTER WARRANT OFFICER', 
      'SWO', 'SENIOR WARRANT OFFICER', 
      'WO', 'WARRANT OFFICER', 
      'SGT', 'SERGEANT', 
      'CPL', 'CORPORAL', 
      'LAC', 'LEADING AIRCRAFTMAN', 
      'AC', 'AIRCRAFTMAN'
    ];
    return Array.from(ranksSet).sort((a, b) => {
      const idxA = standardAirmanOrder.findIndex(o => a.includes(o) || o.includes(a));
      const idxB = standardAirmanOrder.findIndex(o => b.includes(o) || b.includes(o));
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [members]);

  // Filter members based on search and memberFilter, maintaining strict Rank Seniority (Officers > JCOs > Airmen > Civilians)
  const filteredMembers = useMemo(() => {
    const list = members.filter((m) => {
      // Role / Rank Filter
      if (memberFilter === 'OFFICER') {
        if (!isOfficerMember(m)) return false;
        if (officerRankFilter !== 'ALL') {
          const mRank = String(m['Rank'] || m.rank || '').trim().toUpperCase();
          if (!mRank.includes(officerRankFilter)) return false;
        }
      }
      if (memberFilter === 'AIRMEN') {
        if (!isAirmanMember(m)) return false;
        if (airmanRankFilter !== 'ALL') {
          const mRank = String(m['Rank'] || m.rank || '').trim().toUpperCase();
          if (!mRank.includes(airmanRankFilter)) return false;
        }
      }
      if (memberFilter === 'CIVILIAN') {
        if (!isCivilianMember(m)) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const bd = String(m['BD No'] || m.airman_id || '').toLowerCase();
        const name = String(m['Surname'] || '').toLowerCase();
        const rank = String(m['Rank'] || '').toLowerCase();
        const bnName = (getMemberBanglaName(m) || '').toLowerCase();
        const bnRank = (getMemberBanglaRank(m) || '').toLowerCase();
        if (!bd.includes(q) && !name.includes(q) && !rank.includes(q) && !bnName.includes(q) && !bnRank.includes(q)) {
          return false;
        }
      }

      return true;
    });

    return sortCanteenMembersByOfficeSeniority(list);
  }, [members, memberFilter, officerRankFilter, airmanRankFilter, searchQuery, getMemberBanglaName, getMemberBanglaRank]);

  // Members for the dues table/cards
  const displayedMembersForDues = useMemo(() => {
    const list = filteredMembers.filter((m) => {
      if (dueListFilter === 'WITH_DUE') {
        const due = getMemberTotalDue(m, category);
        return due > 0;
      }
      return true;
    });

    return sortCanteenMembersByOfficeSeniority(list);
  }, [filteredMembers, dueListFilter, category, getMemberTotalDue]);

  // Overall Statistics for this category based on selected date's billing month
  const stats = useMemo(() => {
    let totalDue = 0;
    let totalMonthBilled = 0;
    let membersWithDue = 0;

    members.forEach((m) => {
      const d = getMemberTotalDue(m, category);
      if (d > 0) {
        totalDue += d;
        membersWithDue += 1;
      }
      const mb = getMemberFilteredBill(m, category, targetMonthKey);
      totalMonthBilled += mb;
    });

    return { totalDue, totalMonthBilled, membersWithDue };
  }, [members, category, targetMonthKey, getMemberTotalDue, getMemberFilteredBill]);

  // Filter category transactions for recent log
  const categoryTransactions = useMemo(() => {
    return (allTxs || [])
      .filter((tx) => getTxCategory(tx) === category && !deletedTxIds.has(String(tx.id)))
      .sort((a, b) => {
        const timeA = new Date(a.date || a.created_at || 0).getTime() || a.timestamp || 0;
        const timeB = new Date(b.date || b.created_at || 0).getTime() || b.timestamp || 0;
        return timeB - timeA;
      });
  }, [allTxs, category, deletedTxIds]);

  const filteredHistoryTransactions = useMemo(() => {
    if (!historySearch.trim()) return categoryTransactions;
    const q = historySearch.toLowerCase().trim();
    return categoryTransactions.filter((tx) => {
      const name = String(tx.memberName || tx.name || '').toLowerCase();
      const bd = String(tx.bdNo || tx.airman_id || '').toLowerCase();
      const items = String(tx.items || tx.note || '').toLowerCase();
      const date = String(tx.date || tx.monthKey || '').toLowerCase();
      return name.includes(q) || bd.includes(q) || items.includes(q) || date.includes(q);
    });
  }, [categoryTransactions, historySearch]);

  // Selection helpers
  const handleToggleMember = (airmanId: string) => {
    if (isUnitFund && membersWithUnitFundThisMonth.has(airmanId)) {
      const m = members.find(mem => String(mem.airman_id || mem['BD No']) === airmanId);
      const mName = m ? `${m['Rank'] || ''} ${m['Surname'] || m['BD No']}`.trim() : 'এই সদস্য';
      showToast(`${mName} এর জন্য ${formatBengaliMonthYear(targetMonthKey)} (${targetMonthKey}) মাসে ইতিমধ্যে Unit Fund এন্ট্রি রয়েছে! একই মাসে ডাবল এন্ট্রি দেওয়া যাবে না।`, 'error');
      return;
    }
    setSelectedAirmanIds((prev) => {
      const next = new Set(prev);
      if (next.has(airmanId)) {
        next.delete(airmanId);
      } else {
        next.add(airmanId);
      }
      return next;
    });
  };

  const handleSelectAllFiltered = () => {
    setSelectedAirmanIds((prev) => {
      const next = new Set(prev);
      let skippedCount = 0;
      filteredMembers.forEach((m) => {
        const id = String(m.airman_id || m['BD No']);
        if (isUnitFund && membersWithUnitFundThisMonth.has(id)) {
          skippedCount++;
          return; // Skip members already billed for this month
        }
        next.add(id);
      });
      if (isUnitFund && skippedCount > 0) {
        showToast(`${skippedCount} জন সদস্যের এই মাসে ইতিমধ্যে Unit Fund থাকায় নির্বাচন থেকে বাদ রাখা হয়েছে।`, 'success');
      }
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedAirmanIds(new Set());
  };

  const handleSelectGroup = (filter: 'OFFICER' | 'AIRMEN' | 'CIVILIAN') => {
    setSelectedAirmanIds((prev) => {
      const next = new Set(prev);
      let skippedCount = 0;
      members.forEach((m) => {
        const matches = 
          (filter === 'OFFICER' && isOfficerMember(m)) ||
          (filter === 'AIRMEN' && isAirmanMember(m)) ||
          (filter === 'CIVILIAN' && isCivilianMember(m));
        if (matches) {
          const id = String(m.airman_id || m['BD No']);
          if (isUnitFund && membersWithUnitFundThisMonth.has(id)) {
            skippedCount++;
            return; // Skip members already billed for this month
          }
          next.add(id);
        }
      });
      if (isUnitFund && skippedCount > 0) {
        showToast(`${skippedCount} জন সদস্যের এই মাসে ইতিমধ্যে Unit Fund থাকায় নির্বাচন থেকে বাদ রাখা হয়েছে।`, 'success');
      }
      return next;
    });
  };

  // Submit Batch Bill Addition
  const handleBatchAddBill = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedAirmanIds.size === 0) {
      showToast('Please select at least one member to assign the bill', 'error');
      return;
    }

    // Validate each selected member or category has an amount > 0
    if (isMultiCatMode) {
      if (activeSingleMemberCats.length === 0) {
        showToast('অনুগ্রহ করে এই সদস্যের জন্য অন্তত একটি ক্যাটাগরি সিলেক্ট করুন', 'error');
        return;
      }
      for (const c of activeSingleMemberCats) {
        const raw = singleMemberCategoryAmounts[c] !== undefined ? singleMemberCategoryAmounts[c] : amount;
        const val = parseFloat(raw || '0');
        if (isNaN(val) || val <= 0) {
          showToast(`অনুগ্রহ করে "${c}" ক্যাটাগরির জন্য সঠিক টাকার পরিমাণ লিখুন`, 'error');
          return;
        }
      }
    } else {
      for (const id of Array.from(selectedAirmanIds)) {
        const raw = memberCustomAmounts[id] !== undefined ? memberCustomAmounts[id] : amount;
        const val = parseFloat(raw || '0');
        if (isNaN(val) || val <= 0) {
          const m = members.find(mem => String(mem.airman_id || mem['BD No']) === id);
          const name = m ? `${m['Rank'] || ''} ${m['Surname'] || m['BD No']}` : id;
          showToast(`Please enter a valid amount for ${name}`, 'error');
          return;
        }
      }
    }

    if (!isUnitFund && (isMultiCatMode ? activeSingleMemberCats.length === 0 : !purpose.trim())) {
      showToast('A description note or purpose is required for Others Bill', 'error');
      return;
    }

    // STRICT CHECK: Unit Fund cannot be added more than once to any member in the same month
    if (isUnitFund) {
      const selectedMemberList = members.filter((m) =>
        selectedAirmanIds.has(String(m.airman_id || m['BD No']))
      );
      const duplicateMembers = selectedMemberList.filter((m) =>
        membersWithUnitFundThisMonth.has(String(m.airman_id || m['BD No']))
      );

      if (duplicateMembers.length > 0) {
        const dupNames = duplicateMembers
          .map((m) => `${m['Rank'] || ''} ${m['Surname'] || m['BD No']}`.trim())
          .slice(0, 4)
          .join(', ');
        showToast(
          `নিম্নলিখিত সদস্যদের জন্য ${formatBengaliMonthYear(targetMonthKey)} (${targetMonthKey}) মাসে ইতিমধ্যে Unit Fund এন্ট্রি রয়েছে: ${dupNames}${
            duplicateMembers.length > 4 ? ` এবং আরও ${duplicateMembers.length - 4} জন` : ''
          }! একই মাসে ডাবল এন্ট্রি দেওয়া যাবে না।`,
          'error'
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const existingTxs = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
        } catch {
          return [];
        }
      })();

      const selectedMemberList = members.filter((m) =>
        selectedAirmanIds.has(String(m.airman_id || m['BD No']))
      );

      const now = Date.now();
      const finalPurpose = purpose.trim() || (isUnitFund ? 'Unit Fund Bill' : 'Others Bill');
      const finalNotes = notes.trim();
      const defaultDesc = isUnitFund ? 'Unit Fund Bill' : finalPurpose;

      // Format date for display matching POS Sales (e.g. 09 Oct 26)
      const formattedTxDate = formatCanteenDate(txDate);

      const targetMonth = targetMonthKey;
      const batchExpenseId = `exp-${category.toLowerCase()}-${now}`;

      const isPrevMgrActive = !isUnitFund && (isPrevManager || cashDeductTarget === 'PREV_MANAGER');

      const paymentMethodFormatted = othersFundSource === 'Cash'
        ? (isPrevMgrActive
            ? 'Cash (Prev Manager)'
            : `Cash (${cashDeductTarget === 'STAFF' ? (selectedStaffName || 'Civ Tanvir') : (managerName || 'Manager')})`)
        : 'UCB';

      let newBatchTxs: any[] = [];
      if (isMultiCatMode && activeSingleMemberCats.length > 0) {
        const singleMem = selectedMemberList[0];
        const cleanBdNo = String(singleMem['BD No'] || singleMem.airman_id || '').replace(/\D/g, '');
        newBatchTxs = activeSingleMemberCats.map((catName, idx) => {
          const raw = singleMemberCategoryAmounts[catName] !== undefined ? singleMemberCategoryAmounts[catName] : amount;
          const memberAmt = parseFloat(raw || '0') || 0;

          return {
            id: `tx-${category.toLowerCase()}-${cleanBdNo}-${targetMonth}-${now + idx}`,
            created_at: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            timestamp: now + idx,
            date: formattedTxDate,
            monthKey: targetMonth,
            airman_id: singleMem.airman_id,
            bdNo: singleMem['BD No'] || singleMem.bdNo,
            memberName: `${singleMem['Rank'] || ''} ${singleMem['Surname'] || ''}`.trim(),
            rank: singleMem['Rank'] || singleMem.rank || '',
            items: catName,
            note: finalNotes || undefined,
            soldItems: [],
            amount: memberAmt,
            type: 'INITIAL_BILL',
            gateway: 'DUE',
            billType: category,
            batchExpenseId,
            paymentMethod: paymentMethodFormatted,
            method: paymentMethodFormatted,
            source: isPrevMgrActive ? 'Cash (Prev Manager)' : othersFundSource,
            staffName: isPrevMgrActive ? 'Prev Manager' : (cashDeductTarget === 'STAFF' ? (selectedStaffName || 'Civ Tanvir') : (managerName || 'Manager')),
            cashDeductTarget: isPrevMgrActive ? 'PREV_MANAGER' : cashDeductTarget,
            isPrevManager: isPrevMgrActive ? true : undefined
          };
        });
      } else {
        newBatchTxs = selectedMemberList.map((m, idx) => {
          const cleanBdNo = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
          const mId = String(m.airman_id || m['BD No']);
          const raw = memberCustomAmounts[mId] !== undefined ? memberCustomAmounts[mId] : amount;
          const memberAmt = parseFloat(raw || '0') || 0;

          return {
            id: `tx-${category.toLowerCase()}-${cleanBdNo}-${targetMonth}-${now + idx}`,
            created_at: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            timestamp: now + idx,
            date: formattedTxDate,
            monthKey: targetMonth,
            airman_id: m.airman_id,
            bdNo: m['BD No'] || m.bdNo,
            memberName: `${m['Rank'] || ''} ${m['Surname'] || ''}`.trim(),
            rank: m['Rank'] || m.rank || '',
            items: isUnitFund ? 'Unit Fund Bill' : defaultDesc,
            note: isUnitFund ? undefined : (finalNotes || undefined),
            soldItems: [],
            amount: memberAmt,
            type: 'INITIAL_BILL',
            gateway: 'DUE',
            billType: isUnitFund ? 'UNIT_FUND' : category,
            batchExpenseId: isUnitFund ? undefined : batchExpenseId,
            paymentMethod: isUnitFund ? 'DUE' : paymentMethodFormatted,
            method: isUnitFund ? 'DUE' : paymentMethodFormatted,
            source: isUnitFund ? 'DUE' : (isPrevMgrActive ? 'Cash (Prev Manager)' : othersFundSource),
            staffName: isUnitFund ? undefined : (isPrevMgrActive ? 'Prev Manager' : (cashDeductTarget === 'STAFF' ? (selectedStaffName || 'Civ Tanvir') : (managerName || 'Manager'))),
            cashDeductTarget: isUnitFund ? undefined : (isPrevMgrActive ? 'PREV_MANAGER' : cashDeductTarget),
            isPrevManager: isPrevMgrActive ? true : undefined
          };
        });
      }

      const updatedTxs = [...newBatchTxs, ...existingTxs];
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));

      // Update members' Due in memory, localStorage and Supabase directly
      if (isMultiCatMode && activeSingleMemberCats.length > 0) {
        const singleMem = selectedMemberList[0];
        const totalSingleMemberAddedDue = newBatchTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        const curDue = Number(singleMem.Due ?? singleMem.due ?? singleMem.baki ?? 0);
        const newDue = curDue + totalSingleMemberAddedDue;
        singleMem.Due = newDue;
        singleMem.due = newDue;
        singleMem.baki = newDue;

        const cleanBd = String(singleMem['BD No'] || singleMem.airman_id || '').replace(/\D/g, '');
        if (cleanBd) {
          try {
            const rawStored = localStorage.getItem(`canteen_member_${cleanBd}`);
            const stored = rawStored ? JSON.parse(rawStored) : {};
            localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({ ...stored, Due: newDue, due: newDue, baki: newDue }));
          } catch {}
        }

        (async () => {
          try {
            if (singleMem.airman_id) {
              await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', singleMem.airman_id);
            }
            if (singleMem['BD No']) {
              await supabase.from('Canteen_Member').update({ Due: newDue }).eq('BD No', String(singleMem['BD No']).trim());
            }
          } catch (e) {
            console.warn('Member due update error on multi-category batch bill:', e);
          }
        })();
      } else {
        selectedMemberList.forEach((m) => {
          const mId = String(m.airman_id || m['BD No']);
          const raw = memberCustomAmounts[mId] !== undefined ? memberCustomAmounts[mId] : amount;
          const memberAmt = parseFloat(raw || '0') || 0;
          const curDue = Number(m.Due ?? m.due ?? m.baki ?? 0);
          const newDue = curDue + memberAmt;
          m.Due = newDue;
          m.due = newDue;
          m.baki = newDue;

          const cleanBd = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
          if (cleanBd) {
            try {
              const rawStored = localStorage.getItem(`canteen_member_${cleanBd}`);
              const stored = rawStored ? JSON.parse(rawStored) : {};
              localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({ ...stored, Due: newDue, due: newDue, baki: newDue }));
            } catch {}
          }

          (async () => {
            try {
              if (m.airman_id) {
                await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', m.airman_id);
              }
              if (m['BD No']) {
                await supabase.from('Canteen_Member').update({ Due: newDue }).eq('BD No', String(m['BD No']).trim());
              }
            } catch (e) {
              console.warn('Member due update error on Unit Fund batch bill:', e);
            }
          })();
        });
      }

      // ONLY for Others Fund: deduct total billed amount from Fund Cash or UCB as an expense so Capital All Logs receives entry
      // For Unit Fund: Purpose and Payment Method are NOT used, everything goes to Due directly without fund expense deduction.
      let updatedExpenses: any[] = [];
      let updatedAdvances: any[] = [];

      if (!isUnitFund && !isPrevMgrActive) {
        const totalBatchDeduction = totalBatchAmount;
        const existingExpenses = (() => {
          try {
            return JSON.parse(localStorage.getItem('canteen_expenses') || '[]');
          } catch {
            return [];
          }
        })();

        const memberBreakdown = selectedMemberList.map((m) => {
          const cleanBdNo = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
          const mId = String(m.airman_id || m['BD No']);
          const raw = memberCustomAmounts[mId] !== undefined ? memberCustomAmounts[mId] : amount;
          const memberAmt = parseFloat(raw || '0') || 0;
          const name = `${m['Rank'] || ''} ${m['Surname'] || ''}`.trim() || `BD-${cleanBdNo}`;
          return {
            airman_id: m.airman_id,
            bdNo: m['BD No'] || m.bdNo,
            name,
            amount: memberAmt,
            label: `${name}${m['BD No'] ? ` (BD-${m['BD No']})` : ''}: ৳${memberAmt.toLocaleString('en-US')}`
          };
        });

        const memberNamesStr = memberBreakdown.map(mb => mb.label).join(' • ');
        const detailedPersonDisplay = memberBreakdown.length === 1 
          ? memberBreakdown[0].label 
          : `${memberBreakdown.length} Members: ${memberNamesStr}`;

        const fundExpenseRecord = {
          id: batchExpenseId,
          date: formattedTxDate,
          desc: `OTHERS BILL: ${finalPurpose}`.toUpperCase(),
          subdesc: `Kar Jonno: ${memberNamesStr}${finalNotes ? ` • Note: ${finalNotes}` : ''} [${paymentMethodFormatted}]`,
          category: 'Others Bill',
          paymentMethod: paymentMethodFormatted,
          amount: totalBatchDeduction,
          detailedPerson: detailedPersonDisplay,
          memberBreakdown: memberBreakdown,
          isCustom: true
        };

        updatedExpenses = [fundExpenseRecord, ...existingExpenses];
        localStorage.setItem('canteen_expenses', JSON.stringify(updatedExpenses));
        window.dispatchEvent(new Event('canteen_expenses_updated'));

        // If Cash and Staff is selected: deduct from the staff member's account!
        if (othersFundSource === 'Cash' && cashDeductTarget === 'STAFF' && selectedStaffName) {
          const advancesRaw = localStorage.getItem('canteen_bazar_advances');
          const advances: any[] = advancesRaw ? JSON.parse(advancesRaw) : [];

          const targetStaff = selectedStaffName.trim().toLowerCase();
          const personActive = advances.filter((a) => {
            const pName = String(a.personName || '').trim().toLowerCase();
            const isSettled = a.status === 'SETTLED' || Number(a.returnAmount) > 0 || (a.notes && a.notes.includes('[Settled]')) || Boolean(a.settledDate);
            return (pName === targetStaff || pName.includes(targetStaff) || targetStaff.includes(pName)) &&
                   String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE' &&
                   !isSettled;
          });

          if (personActive.length === 0) {
            const newNegativeAdv = {
              id: `adv-${now}-${Math.random().toString(36).substring(2, 6)}`,
              date: formattedTxDate,
              personName: selectedStaffName,
              amount: 0,
              spentAmount: totalBatchDeduction,
              returnAmount: 0,
              channel: 'CASH',
              purpose: `OTHERS BILL: ${finalPurpose}`.toUpperCase(),
              status: 'ACTIVE',
              notes: `Auto deducted for Others Bill (${selectedMemberList.length} members)`
            };
            updatedAdvances = [newNegativeAdv, ...advances];
          } else {
            let deducted = false;
            updatedAdvances = advances.map((a) => {
              const pName = String(a.personName || '').trim().toLowerCase();
              const isSettled = a.status === 'SETTLED' || Number(a.returnAmount) > 0 || (a.notes && a.notes.includes('[Settled]')) || Boolean(a.settledDate);
              if (!deducted && (pName === targetStaff || pName.includes(targetStaff) || targetStaff.includes(pName)) && String(a.status || 'ACTIVE').toUpperCase() === 'ACTIVE' && !isSettled) {
                deducted = true;
                return {
                  ...a,
                  spentAmount: (Number(a.spentAmount) || 0) + totalBatchDeduction
                };
              }
              return a;
            });
          }

          localStorage.setItem('canteen_bazar_advances', JSON.stringify(updatedAdvances));
          window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
        }
      }

      // Fast background push to Supabase cloud without freezing user UI
      Promise.all([
        pushKeyToCloud('canteen_txs', updatedTxs),
        ...(!isUnitFund && !isPrevMgrActive && updatedExpenses.length > 0 ? [pushKeyToCloud('canteen_expenses', updatedExpenses)] : []),
        ...(!isUnitFund && !isPrevMgrActive && othersFundSource === 'Cash' && cashDeductTarget === 'STAFF' && selectedStaffName && updatedAdvances.length > 0 ? [pushKeyToCloud('canteen_bazar_advances', updatedAdvances)] : [])
      ]).catch((err) => console.warn('Background batch sync warning:', err));

      // Trigger sync events across the entire app
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('storage'));

      // Play audio chime and trigger dynamic success modal popup immediately
      playSuccessChime();

      setBatchSuccessData({
        memberCount: selectedMemberList.length,
        totalAmount: totalBatchAmount,
        category: isUnitFund ? 'Unit Fund' : 'Others Bill',
        purpose: isUnitFund ? 'Unit Fund Bill' : finalPurpose,
        source: isPrevMgrActive ? 'Prev Manager' : (isUnitFund ? 'DUE' : othersFundSource),
        targetStaff: (!isUnitFund && !isPrevMgrActive && othersFundSource === 'Cash' && cashDeductTarget === 'STAFF') ? selectedStaffName : undefined
      });

      // Reset form fields
      setAmount('');
      setMemberCustomAmounts({});
      setSingleMemberCategories([]);
      setSingleMemberCategoryAmounts({});
      setAmountMode('SAME');
      setFillAllInput('');
      setNotes('');
      setSelectedAirmanIds(new Set());
    } catch (err: any) {
      console.error('Batch add error:', err);
      showToast(`Failed to post batch bills: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save edited transaction
  const handleSaveEditTx = async (updatedData: {
    amount: number;
    date: string;
    items: string;
    note?: string;
    monthKey: string;
  }) => {
    if (!txToEdit) return;
    setIsSavingEdit(true);

    try {
      const existingTxs = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
        } catch {
          return [];
        }
      })();

      const oldAmount = Number(txToEdit.amount || 0);
      const newAmount = Number(updatedData.amount || 0);
      const amountDiff = newAmount - oldAmount;

      const formattedDate = formatCanteenDate(updatedData.date);

      const updatedTxs = existingTxs.map((t: any) => {
        if (String(t.id) === String(txToEdit.id)) {
          return {
            ...t,
            amount: newAmount,
            date: formattedDate,
            items: updatedData.items,
            note: updatedData.note || undefined,
            monthKey: updatedData.monthKey
          };
        }
        return t;
      });

      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));
      await pushKeyToCloud('canteen_txs', updatedTxs);

      // Adjust member Due if amount changed
      if (amountDiff !== 0) {
        const targetMember = members.find((m: any) => {
          if (!m) return false;
          if (txToEdit.airman_id && m.airman_id === txToEdit.airman_id) return true;
          const txBd = String(txToEdit.bdNo || txToEdit['BD No'] || '').trim();
          const mBd = String(m['BD No'] || m.bdNo || '').trim();
          if (txBd && mBd && txBd.toLowerCase() === mBd.toLowerCase()) return true;
          const txBdClean = txBd.replace(/\D/g, '');
          const mBdClean = mBd.replace(/\D/g, '');
          if (txBdClean && mBdClean && txBdClean === mBdClean) return true;
          return false;
        });

        if (targetMember) {
          const currentDue = Number(targetMember.Due ?? targetMember.due ?? targetMember.baki ?? 0);
          const newDue = Math.max(0, currentDue + amountDiff);

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
            console.warn('Supabase member due update on tx edit:', e);
          }

          targetMember.Due = newDue;
          targetMember.due = newDue;
          targetMember.baki = newDue;

          const cleanBd = String(targetMember['BD No'] || targetMember.airman_id || '').replace(/\D/g, '').toLowerCase();
          if (cleanBd) {
            try {
              const rawStored = localStorage.getItem(`canteen_member_${cleanBd}`);
              const stored = rawStored ? JSON.parse(rawStored) : {};
              localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({ ...stored, Due: newDue, due: newDue, baki: newDue }));
            } catch {}
          }
        }
      }

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('canteen_expenses_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast('Transaction updated successfully!');
      setTxToEdit(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Edit transaction error:', err);
      showToast(`Failed to update transaction: ${err?.message || 'Error'}`, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Delete an individual transaction with in-app confirmation & proper member due reversal
  const confirmDeleteTx = async () => {
    if (!txToDelete) return;
    const tx = txToDelete;
    const txIdStr = String(tx.id);
    setIsDeleting(true);

    try {
      // 1. Immediately record in permanently deleted IDs so it never comes back
      recordDeletedTxId(txIdStr);
      setDeletedTxIds((prev) => new Set(prev).add(txIdStr));

      // 2. Remove from canteen_txs in localStorage immediately
      const existingTxs = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
        } catch {
          return [];
        }
      })();
      const filtered = existingTxs.filter((t: any) => String(t.id) !== txIdStr);
      localStorage.setItem('canteen_txs', JSON.stringify(filtered));

      // 3. Find target member to reverse their Due locally and in memory
      const targetMember = members.find((m: any) => {
        if (!m) return false;
        if (tx.airman_id && m.airman_id === tx.airman_id) return true;
        const txBd = String(tx.bdNo || tx['BD No'] || '').trim();
        const mBd = String(m['BD No'] || m.bdNo || '').trim();
        if (txBd && mBd && txBd.toLowerCase() === mBd.toLowerCase()) return true;
        const txBdClean = txBd.replace(/\D/g, '');
        const mBdClean = mBd.replace(/\D/g, '');
        if (txBdClean && mBdClean) {
          if (txBdClean === mBdClean) return true;
          return false;
        }
        const txName = String(tx.memberName || tx.name || '').trim().toLowerCase();
        const mSurname = String(m.Surname || m.surname || '').trim().toLowerCase();
        if (txName && mSurname && (txName.includes(mSurname) || mSurname.includes(txName))) return true;
        return false;
      });

      const amountToReverse = Number(tx.amount || 0);
      let newDue = 0;
      if (targetMember) {
        const currentDue = Number(targetMember.Due ?? targetMember.due ?? targetMember.baki ?? 0);
        newDue = Math.max(0, currentDue - amountToReverse);
        targetMember.Due = newDue;
        targetMember.due = newDue;
        targetMember.baki = newDue;

        const cleanBd = String(targetMember['BD No'] || targetMember.airman_id || '').replace(/\D/g, '').toLowerCase();
        if (cleanBd) {
          try {
            const rawStored = localStorage.getItem(`canteen_member_${cleanBd}`);
            const stored = rawStored ? JSON.parse(rawStored) : {};
            localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({ ...stored, Due: newDue, due: newDue, baki: newDue }));
          } catch {}
        }
      }

      // 0ms instant feedback: play sound and show dynamic success modal view
      playPopSound();
      playSuccessChime();

      setDeleteSuccessData({
        memberName: String(tx.memberName || tx.name || `BD/${tx.bdNo || ''}`).trim(),
        bdNo: String(tx.bdNo || tx['BD No'] || ''),
        amount: amountToReverse,
        purpose: String(tx.items || tx.note || 'বিল রেকর্ড')
      });

      // Dispatch local event updates immediately
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('storage'));

      // Automatically reconcile and delete/update corresponding expense from canteen_expenses (Capital Log)
      try {
        reconcileExpenseOnFundTxDelete(tx, filtered);
      } catch (err) {
        console.warn('Error updating canteen_expenses on tx delete in FundBatchBillPage:', err);
      }

      // Perform background cloud and Supabase sync non-blockingly
      (async () => {
        try {
          await pushKeyToCloud('canteen_txs', filtered);
          if (onRemoveTx) {
            await onRemoveTx(tx).catch(() => {});
          }
          if (targetMember) {
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
          }
        } catch (e) {
          console.warn('Background delete sync error:', e);
        }
      })();

      // Auto close success popup after 2.5s
      setTimeout(() => {
        setDeleteSuccessData(null);
        setTxToDelete(null);
        if (onSuccess) onSuccess();
      }, 2500);
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
      setTxToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedCount = selectedAirmanIds.size;
  const numAmount = parseFloat(amount) || 0;
  const isMultiCatMode = selectedCount === 1 && !isUnitFund;
  const activeSingleMemberCats = useMemo(() => {
    return singleMemberCategories.length > 0 ? singleMemberCategories : (purpose.trim() ? [purpose.trim()] : []);
  }, [singleMemberCategories, purpose]);

  // Selected members list sorted by seniority
  const selectedMembersList = useMemo(() => {
    const list = members.filter((m) =>
      selectedAirmanIds.has(String(m.airman_id || m['BD No']))
    );
    return sortCanteenMembersByOfficeSeniority(list);
  }, [members, selectedAirmanIds]);

  const totalBatchAmount = useMemo(() => {
    if (selectedCount === 0) return 0;
    if (isMultiCatMode) {
      if (activeSingleMemberCats.length === 0) return 0;
      let sum = 0;
      activeSingleMemberCats.forEach((c) => {
        const raw = singleMemberCategoryAmounts[c] !== undefined ? singleMemberCategoryAmounts[c] : amount;
        sum += (parseFloat(raw || '0') || 0);
      });
      return sum;
    }
    let sum = 0;
    selectedAirmanIds.forEach((id) => {
      const raw = memberCustomAmounts[id] !== undefined ? memberCustomAmounts[id] : amount;
      const val = parseFloat(raw || '0') || 0;
      sum += val;
    });
    return sum;
  }, [selectedCount, isMultiCatMode, activeSingleMemberCats, singleMemberCategoryAmounts, selectedAirmanIds, memberCustomAmounts, amount]);

  const isAllMemberAmountsValid = useMemo(() => {
    if (selectedCount === 0) return false;
    if (isMultiCatMode) {
      if (activeSingleMemberCats.length === 0) return false;
      return activeSingleMemberCats.every((c) => {
        const raw = singleMemberCategoryAmounts[c] !== undefined ? singleMemberCategoryAmounts[c] : amount;
        const val = parseFloat(raw || '0');
        return !isNaN(val) && val > 0;
      });
    }
    for (const id of Array.from(selectedAirmanIds)) {
      const raw = memberCustomAmounts[id] !== undefined ? memberCustomAmounts[id] : amount;
      const val = parseFloat(raw || '0');
      if (isNaN(val) || val <= 0) return false;
    }
    return true;
  }, [selectedCount, isMultiCatMode, activeSingleMemberCats, singleMemberCategoryAmounts, selectedAirmanIds, memberCustomAmounts, amount]);

  const invalidCustomAmountsCount = useMemo(() => {
    if (selectedCount === 0) return 0;
    if (isMultiCatMode) {
      if (activeSingleMemberCats.length === 0) return 0;
      let count = 0;
      activeSingleMemberCats.forEach((c) => {
        const raw = singleMemberCategoryAmounts[c] !== undefined ? singleMemberCategoryAmounts[c] : amount;
        const val = parseFloat(raw || '0');
        if (isNaN(val) || val <= 0) count++;
      });
      return count;
    }
    let count = 0;
    selectedAirmanIds.forEach((id) => {
      const raw = memberCustomAmounts[id] !== undefined ? memberCustomAmounts[id] : amount;
      const val = parseFloat(raw || '0');
      if (isNaN(val) || val <= 0) count++;
    });
    return count;
  }, [selectedCount, isMultiCatMode, activeSingleMemberCats, singleMemberCategoryAmounts, selectedAirmanIds, memberCustomAmounts, amount]);

  const allSameMembers = useMemo(() => {
    if (selectedCount <= 1) return true;
    const ids = Array.from(selectedAirmanIds);
    const firstVal = memberCustomAmounts[ids[0]] !== undefined ? memberCustomAmounts[ids[0]] : amount;
    return ids.every(id => (memberCustomAmounts[id] !== undefined ? memberCustomAmounts[id] : amount) === firstVal);
  }, [selectedCount, selectedAirmanIds, memberCustomAmounts, amount]);

  const firstMemberAmt = useMemo(() => {
    if (selectedCount === 0) return 0;
    const firstId = Array.from(selectedAirmanIds)[0];
    const raw = memberCustomAmounts[firstId] !== undefined ? memberCustomAmounts[firstId] : amount;
    return parseFloat(raw || '0') || 0;
  }, [selectedCount, selectedAirmanIds, memberCustomAmounts, amount]);

  return (
    <div className="space-y-5 animate-in fade-in duration-300 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed top-4 right-4 z-[999] px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 text-sm font-bold border transition-all ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 shadow-emerald-900/30' 
            : 'bg-rose-950/90 text-rose-200 border-rose-500/50 shadow-rose-900/30'
        }`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header & Navigation Strip */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-3xl shadow-sm">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700 transition-colors cursor-pointer shrink-0 active:scale-95"
            title="Back to Canteen Bills"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isUnitFund 
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400 shadow-md shadow-indigo-500/10' 
                : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-500/10'
            }`}>
              {isUnitFund ? <Landmark className="w-5 h-5 sm:w-6 sm:h-6" /> : <Layers className="w-5 h-5 sm:w-6 sm:h-6" />}
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tight">
                  {isUnitFund ? 'UNIT FUND MANAGEMENT' : 'OTHERS BILL MANAGEMENT'}
                </h1>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase font-mono border ${
                  isUnitFund ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                }`}>
                  {isUnitFund ? 'UNIT FUND' : 'OTHERS BILL'}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 font-bold mt-0.5">
                {isUnitFund 
                  ? 'Batch assign and record fixed monthly Unit Fund subscriptions for members' 
                  : 'Batch charge specific expenses to members with automatic fund deductions'}
              </p>
            </div>
          </div>
        </div>

        {/* Upper Right Corner: Prominent History & Action Control */}
        <div className="flex items-center space-x-2 shrink-0 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95 border ${
              isUnitFund
                ? 'bg-slate-950 hover:bg-indigo-950/60 text-slate-200 hover:text-white border-slate-800 hover:border-indigo-500/50 shadow-black/40'
                : 'bg-slate-950 hover:bg-cyan-950/60 text-slate-200 hover:text-white border-slate-800 hover:border-cyan-500/50 shadow-black/40'
            } group`}
            title="View Audited Transaction History"
          >
            <Clock className={`w-4 h-4 transition-transform group-hover:rotate-[-30deg] ${
              isUnitFund ? 'text-indigo-400' : 'text-cyan-400'
            }`} />
            <span>History</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black ${
              isUnitFund 
                ? 'bg-indigo-950 text-indigo-300 border border-indigo-500/40'
                : 'bg-cyan-950 text-cyan-300 border border-cyan-500/40'
            }`}>
              {categoryTransactions.length}
            </span>
          </button>
        </div>
      </div>



      {/* ================= BATCH ADD BILL GENERATOR (POS SALES 2-SIDE LAYOUT) ================= */}
      {/* Interface ta POS Sales er moto 2 side a hbe:
          Left half: Member Selection
          Right half: Date, Cat, Amount (Cart er moto hbe), Payment Method (Only Cash + Cash Channel), Confirm */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* LEFT HALF: MEMBER SELECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-black text-xs flex items-center justify-center">
                1
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Member Selection</span>
              </h3>
            </div>
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 self-end sm:self-auto">
              <span>Selected:</span>
              <span className="px-2.5 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono font-black border border-indigo-500/30">
                {selectedCount} members
              </span>
            </div>
          </div>

          {/* Search Bar & Batch Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search member (BD No, Rank, Name)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Selection Shortcuts (Toggle between Select All and Clear) */}
            <div className="flex items-center shrink-0">
              {selectedCount > 0 ? (
                <button
                  type="button"
                  onClick={handleDeselectAll}
                  className="px-3.5 py-2.5 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95 shadow-sm"
                  title="Clear Selected Members"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="px-3.5 py-2.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center space-x-1.5 active:scale-95 shadow-sm"
                  title="Select All Filtered Members"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Select All ({filteredMembers.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Top Category Filter Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-1">
            {(['ALL', 'OFFICER', 'AIRMEN', 'CIVILIAN'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => {
                  setMemberFilter(cat);
                  if (cat !== 'OFFICER') setOfficerRankFilter('ALL');
                  if (cat !== 'AIRMEN') setAirmanRankFilter('ALL');
                }}
                className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                  memberFilter === cat
                    ? 'bg-slate-700 text-white shadow-xs'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Rank-wise secondary filter when OFFICER is selected */}
          {memberFilter === 'OFFICER' && officerRanks.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-2 px-2.5 bg-slate-950/90 rounded-2xl border border-indigo-500/30">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 shrink-0 mr-1 flex items-center space-x-1">
                <Filter className="w-3 h-3" />
                <span>Officer Rank:</span>
              </span>
              <button
                type="button"
                onClick={() => setOfficerRankFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all shrink-0 cursor-pointer ${
                  officerRankFilter === 'ALL'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                ALL RANKS
              </button>
              {officerRanks.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setOfficerRankFilter(r)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all shrink-0 cursor-pointer ${
                    officerRankFilter === r
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Rank-wise secondary filter when AIRMEN is selected */}
          {memberFilter === 'AIRMEN' && airmanRanks.length > 0 && (
            <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none py-2 px-2.5 bg-slate-950/90 rounded-2xl border border-cyan-500/30">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 shrink-0 mr-1 flex items-center space-x-1">
                <Filter className="w-3 h-3" />
                <span>Airmen Rank:</span>
              </span>
              <button
                type="button"
                onClick={() => setAirmanRankFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all shrink-0 cursor-pointer ${
                  airmanRankFilter === 'ALL'
                    ? 'bg-cyan-600 text-white shadow-xs'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                ALL RANKS
              </button>
              {airmanRanks.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setAirmanRankFilter(r)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all shrink-0 cursor-pointer ${
                    airmanRankFilter === r
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {/* Members Selection List Grid (Single Single niche niche) */}
          <div className="flex flex-col space-y-2 max-h-[560px] overflow-y-auto p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 scrollbar-none">
            {filteredMembers.length === 0 ? (
              <div className="w-full py-8 text-center text-slate-400 text-xs font-bold">
                No matching members found
              </div>
            ) : (
              filteredMembers.map((m, i) => {
                const airmanId = String(m.airman_id || m['BD No']);
                const isAlreadyBilledThisMonth = isUnitFund && membersWithUnitFundThisMonth.has(airmanId);
                const isSelected = selectedAirmanIds.has(airmanId);
                const memberDp = resolveImageUrl(m.DP);
                const currentDue = getMemberTotalDue(m, category);

                return (
                  <div
                    key={airmanId || `fund_m_${m['BD No'] || i}_${i}`}
                    onClick={() => handleToggleMember(airmanId)}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isAlreadyBilledThisMonth
                        ? 'bg-slate-950/40 border-slate-800/60 opacity-60 cursor-not-allowed'
                        : isSelected
                        ? 'bg-indigo-950/40 border-indigo-500/70 shadow-sm shadow-indigo-950/50 cursor-pointer ring-1 ring-indigo-500/30'
                        : 'bg-slate-950/60 hover:bg-slate-800/50 border-slate-800/80 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ${
                        isAlreadyBilledThisMonth
                          ? 'bg-slate-800 border-slate-700 text-indigo-400'
                          : isSelected 
                          ? 'bg-indigo-600 border-indigo-400 text-white' 
                          : 'bg-slate-900 border-slate-700 text-transparent'
                      }`}>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>

                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                        {memberDp ? (
                          <img
                            src={memberDp}
                            alt={m['Surname']}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        ) : (
                          <span className="font-black text-xs text-indigo-400">
                            {(m['Surname'] || 'U').charAt(0)}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                          {m['Rank'] && m['Rank'] !== '-' && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-black uppercase bg-indigo-500/15 text-indigo-300 font-mono">
                              {m['Rank']}
                            </span>
                          )}
                          <span className="font-black text-white text-xs truncate">
                            {m['Surname']}
                          </span>
                          {isAlreadyBilledThisMonth && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              ⚠️ Already Billed
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                          BD/{m['BD No']} • {m.Role || 'Member'}
                        </div>
                      </div>
                    </div>

                    {/* Current Fund Due */}
                    <div className="text-right shrink-0">
                      <div className="text-[9px] font-bold text-slate-400 uppercase">
                        DUE
                      </div>
                      <div className={`text-xs font-black font-mono ${
                        currentDue > 0 ? 'text-amber-400' : 'text-slate-500'
                      }`}>
                        ৳{currentDue.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT HALF: Date, Category, Amount (Cart), Payment Method, Confirm */}
        <div className="space-y-4">
          {/* 1. DATE BOX */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex items-center space-x-2.5 shrink-0">
                <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-black text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>Billing Date</span>
                </h3>
              </div>
              <div className="shrink-0">
                <DateNavigator 
                  value={txDate} 
                  onChange={setTxDate} 
                  format="dd_mm_yy"
                />
              </div>
            </div>
          </div>

          {/* 2. SELECT CATEGORY (Only for Others Fund; Unit Fund uses default) */}
          {!isUnitFund && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-black text-xs flex items-center justify-center">
                    3
                  </span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                    <Tag className="w-4 h-4 text-indigo-400" />
                    <span>Select Category <span className="text-rose-400">*</span></span>
                  </h3>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                    {activeSingleMemberCats.length} Selected
                  </span>
                  {/* Settings Gear Icon to toggle edit/delete mode */}
                  <button
                    type="button"
                    onClick={() => setIsEditingPresets(!isEditingPresets)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isEditingPresets
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                    title={isEditingPresets ? 'Done Editing Presets' : 'Manage Saved Presets'}
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isEditingPresets && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Settings className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>ক্যাটাগরি সাজানো ও মোছার মোড: ◀ ▶ বা ড্র্যাগ দিয়ে অবস্থান পরিবর্তন করুন, ✖ দিয়ে মুছুন</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingPresets(false)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] cursor-pointer shrink-0 transition-all shadow-xs"
                  >
                    সম্পন্ন (Done)
                  </button>
                </div>
              )}

              {/* Preset Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {purposePresets.map((preset, idx) => {
                  const isSelected = !isEditingPresets && activeSingleMemberCats.includes(preset);
                  return (
                    <div 
                      key={preset} 
                      draggable={isEditingPresets}
                      onDragStart={(e) => {
                        if (isEditingPresets) {
                          e.dataTransfer.setData('text/plain', String(idx));
                        }
                      }}
                      onDragOver={(e) => {
                        if (isEditingPresets) e.preventDefault();
                      }}
                      onDrop={(e) => {
                        if (!isEditingPresets) return;
                        e.preventDefault();
                        const fromIdx = Number(e.dataTransfer.getData('text/plain'));
                        if (!isNaN(fromIdx)) {
                          handleMovePreset(fromIdx, idx);
                        }
                      }}
                      className={`relative flex items-center transition-all ${
                        isEditingPresets 
                          ? 'bg-slate-950 border border-amber-500/40 rounded-xl p-1 shadow-sm gap-1' 
                          : ''
                      }`}
                    >
                      {/* Left arrow to move position earlier */}
                      {isEditingPresets && (
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMovePreset(idx, idx - 1);
                          }}
                          className={`p-1 rounded-lg text-xs transition-all cursor-pointer ${
                            idx === 0
                              ? 'text-slate-600 cursor-not-allowed'
                              : 'text-amber-400 hover:bg-amber-500/20 active:scale-95'
                          }`}
                          title="Move Left (←)"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingPresets) return;
                          const nextList = activeSingleMemberCats.includes(preset)
                            ? activeSingleMemberCats.filter(p => p !== preset)
                            : [...activeSingleMemberCats, preset];
                          setSingleMemberCategories(nextList);
                          setPurpose(nextList.join(', '));
                        }}
                        className={`py-1.5 rounded-xl text-xs font-bold transition-all truncate cursor-pointer ${
                          isEditingPresets 
                            ? 'px-2 border border-transparent text-amber-200 cursor-grab active:cursor-grabbing flex items-center gap-1' 
                            : 'px-3 border'
                        } ${
                          !isEditingPresets && isSelected
                            ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-950/90 text-indigo-100 shadow-sm'
                            : !isEditingPresets 
                              ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                              : ''
                        }`}
                      >
                        {isEditingPresets && (
                          <GripVertical className="w-3 h-3 text-amber-400/60" />
                        )}
                        <span>{preset}</span>
                        {isSelected && !isEditingPresets && (
                          <span className="ml-1 text-emerald-400 font-bold">✓</span>
                        )}
                      </button>

                      {/* Right arrow to move position later */}
                      {isEditingPresets && (
                        <button
                          type="button"
                          disabled={idx === purposePresets.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMovePreset(idx, idx + 1);
                          }}
                          className={`p-1 rounded-lg text-xs transition-all cursor-pointer ${
                            idx === purposePresets.length - 1
                              ? 'text-slate-600 cursor-not-allowed'
                              : 'text-amber-400 hover:bg-amber-500/20 active:scale-95'
                          }`}
                          title="Move Right (→)"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* ONLY show X button when gear button is ON (isEditingPresets is true) */}
                      {isEditingPresets && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePreset(preset);
                          }}
                          className="p-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-all cursor-pointer shadow-xs active:scale-95"
                          title={`Delete "${preset}"`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Inline Add Preset */}
                {!isEditingPresets && (
                  isAddingPreset ? (
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-indigo-500/60 rounded-xl p-1 max-w-full">
                      <input
                        type="text"
                        placeholder="Type category (e.g. Bazar, Mess...)"
                        value={newPresetInput}
                        onChange={(e) => setNewPresetInput(convertAvroAnsiToUnicode(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddPreset();
                          } else if (e.key === 'Escape') {
                            setIsAddingPreset(false);
                          }
                        }}
                        className="bg-transparent border-0 px-2 py-1 text-xs font-bold text-white outline-none placeholder:text-slate-500 w-44 sm:w-56"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleAddPreset}
                        className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsAddingPreset(false); setNewPresetInput(''); }}
                        className="p-1 text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer"
                        title="Cancel"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsAddingPreset(true)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-bold border border-dashed border-slate-700 hover:border-indigo-500 text-slate-400 hover:text-indigo-300 bg-slate-950 transition-all cursor-pointer flex items-center space-x-1"
                      title="Add Category"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Add Category</span>
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          {/* 3. AMOUNT (CART STYLE: Selected Members with Individual Amounts & live total) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-black text-xs flex items-center justify-center">
                  {isUnitFund ? '3' : '4'}
                </span>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                  <Coins className="w-4 h-4 text-indigo-400" />
                  <span>Amount (Cart) <span className="text-rose-400">*</span></span>
                </h3>
              </div>

              {selectedCount > 0 && (
                <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-indigo-300 self-start sm:self-auto">
                  {selectedCount} in Cart
                </span>
              )}
            </div>

            {selectedCount === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs font-bold bg-slate-950/60 rounded-2xl border border-dashed border-slate-800 space-y-2">
                <Users className="w-8 h-8 text-slate-600 mx-auto opacity-50" />
                <p>No members selected in cart.</p>
                <p className="text-[11px] text-slate-500">Please select members from the left panel.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Quick Toolbar: Fill All - ONLY shown if multiple members selected */}
                {selectedCount > 1 && (
                  <div className="flex items-center justify-between gap-2.5 p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                    <div className="text-xs font-bold text-slate-300">
                      Apply to all members:
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative w-28 sm:w-32">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">৳</span>
                        <input
                          type="number"
                          placeholder="Amount"
                          value={fillAllInput}
                          onChange={(e) => setFillAllInput(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono text-white outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!fillAllInput) return;
                          const next: Record<string, string> = {};
                          selectedAirmanIds.forEach((id) => {
                            next[id] = fillAllInput;
                          });
                          setMemberCustomAmounts(next);
                          showToast(`Applied ৳${fillAllInput} to all members`);
                        }}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm"
                      >
                        Apply All
                      </button>
                    </div>
                  </div>
                )}

                {/* Cart Rows: Single Member Multi-Category Mode vs Multiple Members Mode */}
                {isMultiCatMode ? (
                  <div className="space-y-3">
                    {/* Selected Member Header Card */}
                    {(() => {
                      const m = selectedMembersList[0];
                      if (!m) return null;
                      const memberDp = resolveImageUrl(m.DP);
                      return (
                        <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-indigo-500/30 flex items-center justify-between gap-3 shadow-md">
                          <div className="flex items-center space-x-3 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-indigo-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                              {memberDp ? (
                                <img
                                  src={memberDp}
                                  alt={m['Surname']}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="font-black text-sm text-indigo-400">
                                  {(m['Surname'] || 'M').charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                {m['Rank'] && m['Rank'] !== '-' && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                                    {m['Rank']}
                                  </span>
                                )}
                                <span className="font-black text-white text-sm truncate">
                                  {m['Surname']}
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex items-center gap-1.5">
                                <span>BD/{m['BD No']}</span>
                                <span>•</span>
                                <span className="text-emerald-400 font-bold">একক সদস্য (Single Member)</span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <span className="text-[10px] font-mono font-bold text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-xl border border-indigo-800/60 block">
                              {activeSingleMemberCats.length} Categories Selected
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Category List & Amount Boxes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-black text-slate-300">
                          ক্যাটাগরি ভিত্তিক বিলের তালিকা ও টাকার পরিমাণ
                        </span>
                        <span className="text-[10px] text-indigo-400 font-bold">
                          {activeSingleMemberCats.length}টি ক্যাটাগরি
                        </span>
                      </div>

                      {activeSingleMemberCats.length === 0 ? (
                        <div className="p-5 text-center text-slate-400 text-xs font-bold bg-slate-950/70 rounded-2xl border border-dashed border-slate-800 space-y-2">
                          <Tag className="w-6 h-6 text-indigo-400 mx-auto opacity-70" />
                          <p className="text-white font-bold">উপরে "Select Category" থেকে ক্যাটাগরি সিলেক্ট করুন</p>
                          <p className="text-[11px] text-slate-500 font-normal">
                            কোনো ক্যাটাগরি নির্বাচিত নেই। উপরে ক্যাটাগরি বাটনে ক্লিক করে নির্বাচন করুন।
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="max-h-72 overflow-y-auto space-y-2 p-2 bg-slate-950/70 border border-slate-800 rounded-2xl scrollbar-none">
                            {activeSingleMemberCats.map((catName, idx) => {
                              const catVal = singleMemberCategoryAmounts[catName] !== undefined ? singleMemberCategoryAmounts[catName] : '';
                              const numVal = parseFloat(catVal);
                              const isValidVal = !isNaN(numVal) && numVal > 0;

                              return (
                                <div
                                  key={`${catName}-${idx}`}
                                  className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                                    isValidVal
                                      ? 'bg-slate-900/95 border-slate-800/90 hover:border-slate-700'
                                      : 'bg-rose-950/15 border-rose-500/40'
                                  }`}
                                >
                                  <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                                    <span className="w-5 text-[10px] font-mono text-indigo-400 font-bold text-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 shrink-0">
                                      <Tag className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <span className="font-bold text-white text-xs block truncate">
                                        {catName}
                                      </span>
                                      <span className="text-[9px] text-slate-400 font-mono block mt-0.5">
                                        ক্যাটাগরি বিল এন্ট্রি
                                      </span>
                                    </div>
                                  </div>

                                  {/* Amount Box + Quick Remove Category */}
                                  <div className="flex items-center space-x-2 shrink-0">
                                    <div className="relative w-28 sm:w-32">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                                        ৳
                                      </span>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        placeholder="Amount"
                                        value={catVal}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setSingleMemberCategoryAmounts(prev => ({
                                            ...prev,
                                            [catName]: val
                                          }));
                                        }}
                                        className={`w-full bg-slate-950 border rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-white outline-none shadow-inner transition-all ${
                                          isValidVal
                                            ? 'border-slate-700 focus:border-indigo-500'
                                            : 'border-rose-500/50 focus:border-rose-400'
                                        }`}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const nextList = activeSingleMemberCats.filter(c => c !== catName);
                                        setSingleMemberCategories(nextList);
                                        setPurpose(nextList.join(', '));
                                      }}
                                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                                      title={`Remove "${catName}"`}
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Multiple Members List */
                  <div className="max-h-72 overflow-y-auto space-y-2 p-2 bg-slate-950/70 border border-slate-800 rounded-2xl scrollbar-none">
                    {selectedMembersList.map((m, idx) => {
                      const mId = String(m.airman_id || m['BD No']);
                      const memberDp = resolveImageUrl(m.DP);
                      const memberVal = memberCustomAmounts[mId] !== undefined ? memberCustomAmounts[mId] : '';
                      const numVal = parseFloat(memberVal);
                      const isValidVal = !isNaN(numVal) && numVal > 0;

                      return (
                        <div
                          key={mId}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2.5 transition-all ${
                            isValidVal
                              ? 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700'
                              : 'bg-rose-950/10 border-rose-500/30'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                            <span className="w-5 text-[10px] font-mono text-slate-500 text-center shrink-0">
                              {idx + 1}
                            </span>
                            <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                              {memberDp ? (
                                <img
                                  src={memberDp}
                                  alt={m['Surname']}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <span className="font-black text-xs text-indigo-400">
                                  {(m['Surname'] || 'M').charAt(0)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-1.5 flex-wrap">
                                {m['Rank'] && m['Rank'] !== '-' && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-indigo-500/15 text-indigo-300 font-mono">
                                    {m['Rank']}
                                  </span>
                                )}
                                <span className="font-bold text-white text-xs truncate">
                                  {m['Surname']}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 truncate">
                                BD/{m['BD No']}
                              </div>
                            </div>
                          </div>

                          {/* Amount Box + Quick Remove from Cart Button */}
                          <div className="flex items-center space-x-2 shrink-0">
                            <div className="relative w-28 sm:w-32">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                                ৳
                              </span>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                placeholder="Amount"
                                value={memberVal}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setMemberCustomAmounts((prev) => ({
                                    ...prev,
                                    [mId]: val
                                  }));
                                }}
                                className={`w-full bg-slate-950 border rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-black text-white outline-none shadow-inner transition-all ${
                                  isValidVal
                                    ? 'border-slate-700 focus:border-indigo-500'
                                    : 'border-rose-500/50 focus:border-rose-400'
                                }`}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleToggleMember(mId)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                              title="Remove from Cart"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Live Total Banner */}
                <div className="p-3 rounded-2xl bg-slate-950/90 border border-indigo-500/30 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-300 font-bold">
                      Total ({selectedCount}):
                    </span>
                    {invalidCustomAmountsCount > 0 ? (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                        ⚠️ {invalidCustomAmountsCount} Pending
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                        ✓ Ready
                      </span>
                    )}
                  </div>
                  <span className="font-mono font-black text-emerald-400 text-sm sm:text-base">
                    ৳{totalBatchAmount.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 4. PAYMENT METHOD (Only Cash + Cash Channel; Only for Others Fund) */}
          {!isUnitFund && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 flex-wrap gap-2">
                <div className="flex items-center space-x-2.5">
                  <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-black text-xs flex items-center justify-center">
                    5
                  </span>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                    <Wallet className="w-4 h-4 text-emerald-400" />
                    <span>Payment Method: Cash <span className="text-rose-400">*</span></span>
                  </h3>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Prev Manager Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = !(isPrevManager || cashDeductTarget === 'PREV_MANAGER');
                      setIsPrevManager(nextState);
                      if (nextState) {
                        setCashDeductTarget('PREV_MANAGER');
                      } else {
                        setCashDeductTarget('MANAGER');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border ${
                      isPrevManager || cashDeductTarget === 'PREV_MANAGER'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-sm ring-1 ring-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                    title="Toggle Prev Manager (Bills add to Member Due & Statement, but will NOT deduct from Manager/Staff account)"
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      isPrevManager || cashDeductTarget === 'PREV_MANAGER' ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'
                    }`} />
                    <span>Prev Manager</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                      isPrevManager || cashDeductTarget === 'PREV_MANAGER'
                        ? 'bg-amber-500/30 text-amber-200'
                        : 'bg-slate-700 text-slate-400'
                    }`}>
                      {isPrevManager || cashDeductTarget === 'PREV_MANAGER' ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/70 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                    CASH ONLY
                  </span>
                </div>
              </div>

              {/* Cash Channel / Source */}
              <div className="bg-slate-950/90 rounded-2xl p-3.5 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Cash Channel / Source:</span>
                  {(isPrevManager || cashDeductTarget === 'PREV_MANAGER') && (
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                      ⚠️ No Cash Account Deduction
                    </span>
                  )}
                </div>

                {/* Segmented Switch Buttons with Manager Cash, Staff Account, and Prev Manager */}
                <div className="grid grid-cols-3 gap-2 p-1 bg-slate-900 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setCashDeductTarget('MANAGER');
                      setIsPrevManager(false);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      cashDeductTarget === 'MANAGER' && !isPrevManager
                        ? 'bg-slate-800 text-white shadow-xs border border-slate-700'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="truncate">Manager Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCashDeductTarget('STAFF');
                      setIsPrevManager(false);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      cashDeductTarget === 'STAFF' && !isPrevManager
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                    <span className="truncate">Staff Account</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCashDeductTarget('PREV_MANAGER');
                      setIsPrevManager(true);
                    }}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                      cashDeductTarget === 'PREV_MANAGER' || isPrevManager
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                    <span className="truncate">Prev Manager</span>
                  </button>
                </div>

                {/* Channel Details Banner */}
                {isPrevManager || cashDeductTarget === 'PREV_MANAGER' ? (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-start space-x-2.5">
                    <span className="text-base leading-none">ℹ️</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-amber-300">
                        Prev Manager মোড সক্রিয় (No Cash Deduction)
                      </p>
                      <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                        বিল মেম্বারের একাউন্ট ও স্টেটমেন্টে যোগ হবে (Due বৃদ্ধি পাবে), কিন্তু বর্তমান ম্যানেজার বা স্টাফ ক্যাশ অ্যাকাউন্ট থেকে কোনো টাকা কাটা হবে না।
                      </p>
                    </div>
                  </div>
                ) : cashDeductTarget === 'STAFF' ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300">
                        Civilian Staff Member <span className="text-rose-400">*</span>
                      </label>
                      <span className="text-[10px] text-emerald-400 font-mono font-bold">
                        Selected: {selectedStaffName}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {civilianStaffList.map((st) => {
                        const isSelected = selectedStaffName === st.name;
                        return (
                          <button
                            key={st.id || st.name}
                            type="button"
                            onClick={() => setSelectedStaffName(st.name)}
                            className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border flex items-center space-x-2.5 ${
                              isSelected
                                ? 'bg-emerald-950/80 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/50'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                              isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {st.name.replace(/^(Civ\s*|Civilian\s*)/i, '').charAt(0) || 'S'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black truncate">{st.name}</p>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight block">
                                Staff
                              </span>
                            </div>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-300 font-bold flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>Deduction logged under Manager Cash ({managerName}).</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. NOTES (OPTIONAL) */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-2">
            <label className="block text-xs font-black uppercase text-slate-300 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Notes (Optional)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes or remarks..."
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-inner resize-none"
            />
          </div>

          {/* 6. CONFIRM & SUBMIT */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-2.5">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-black text-xs flex items-center justify-center">
                ✓
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Confirm</span>
              </h3>
            </div>

            {/* Calculation Summary Box */}
            <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Billing Date:</span>
                <span className="font-mono text-white font-black">{formatCanteenDate(txDate)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Target Month:</span>
                <span className="font-mono text-indigo-300 font-black">{formatBengaliMonthYear(targetMonthKey)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Selected Members:</span>
                <span className="font-mono text-white font-black">{selectedCount} members</span>
              </div>
              {!isUnitFund && (
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Category:</span>
                  <span className={`font-bold truncate max-w-[200px] ${(isMultiCatMode ? activeSingleMemberCats.length > 0 : purpose) ? 'text-indigo-300' : 'text-slate-500 italic'}`}>
                    {isMultiCatMode ? (activeSingleMemberCats.join(', ') || 'Not Selected') : (purpose || 'Not Selected')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span>Payment Channel:</span>
                <span className={`font-mono font-bold ${
                  !isUnitFund && (isPrevManager || cashDeductTarget === 'PREV_MANAGER')
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {!isUnitFund && (isPrevManager || cashDeductTarget === 'PREV_MANAGER')
                    ? 'Cash (Prev Manager) • No Account Deduction'
                    : `Cash (${cashDeductTarget === 'STAFF' ? selectedStaffName : 'Manager Cash'})`}
                </span>
              </div>
              <div className="border-t border-slate-800 pt-2.5 flex items-center justify-between text-sm font-black text-white">
                <span>Total Batch Amount:</span>
                <span className="font-mono text-xl text-amber-400 font-black">
                  {totalBatchAmount > 0 && selectedCount > 0 ? `৳${totalBatchAmount.toLocaleString()}` : 'Nil'}
                </span>
              </div>
            </div>

            {/* Action Submit Button */}
            <button
              type="button"
              disabled={isSubmitting || selectedCount === 0 || !isAllMemberAmountsValid || (!isUnitFund && (isMultiCatMode ? activeSingleMemberCats.length === 0 : !purpose.trim()))}
              onClick={handleBatchAddBill}
              className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xl active:scale-98 ${
                selectedCount > 0 && isAllMemberAmountsValid && (isUnitFund || (isMultiCatMode ? activeSingleMemberCats.length > 0 : purpose.trim()))
                  ? 'bg-gradient-to-r from-emerald-600 via-indigo-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800 shadow-none'
              }`}
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>{isUnitFund ? 'Confirm & Post Unit Fund Due' : 'Confirm'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Edit Transaction Modal */}
      {txToEdit && (
        <EditFundTxModal
          isOpen={Boolean(txToEdit)}
          onClose={() => setTxToEdit(null)}
          tx={txToEdit}
          onSave={handleSaveEditTx}
          isSaving={isSavingEdit}
          purposePresets={purposePresets}
        />
      )}

      {/* Delete Transaction Confirmation Modal */}
      {txToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 space-y-4 text-center relative overflow-hidden">
            {deleteSuccessData ? (
              /* Dynamic Success Animation View inside popup box */
              <div className="space-y-4 py-2 animate-in fade-in zoom-in-95 duration-200">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/40 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-9 h-9 animate-bounce text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-white">
                    রেকর্ড সফলভাবে মুছে ফেলা হয়েছে!
                  </h4>
                  <p className="text-xs text-slate-300 mt-1 line-clamp-1">
                    {deleteSuccessData.memberName} {deleteSuccessData.bdNo ? `(BD: ${deleteSuccessData.bdNo})` : ''}
                  </p>
                </div>
                <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800 text-xs space-y-1.5 text-left">
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400">সমন্বয়কৃত বকেয়া (Reversed):</span>
                    <span className="font-mono font-bold text-emerald-400 text-sm">
                      ৳{deleteSuccessData.amount.toLocaleString()}
                    </span>
                  </div>
                  {deleteSuccessData.purpose && (
                    <div className="flex justify-between items-center text-slate-300">
                      <span className="text-slate-400">বিবরণ:</span>
                      <span className="text-slate-200 font-medium truncate max-w-[170px]">
                        {deleteSuccessData.purpose}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteSuccessData(null);
                    setTxToDelete(null);
                    if (onSuccess) onSuccess();
                  }}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg transition-colors cursor-pointer"
                >
                  সম্পন্ন (Close)
                </button>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div className="text-center space-y-1">
                  <h4 className="text-base font-black text-white">Delete Transaction?</h4>
                  <p className="text-xs text-slate-400">
                    Are you sure you want to delete this bill of <strong className="text-white font-mono">৳{Number(txToDelete.amount || 0).toLocaleString()}</strong> for <strong>{txToDelete.memberName || txToDelete.name || `BD/${txToDelete.bdNo}`}</strong>?
                  </p>
                  <p className="text-[11px] text-amber-400/90 font-medium">
                    Member's due will be automatically reversed.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setTxToDelete(null)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteTx}
                    disabled={isDeleting}
                    className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-rose-950/50 cursor-pointer disabled:opacity-50"
                  >
                    {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Batch Bill Success Confirmation Modal with Celebration Animation */}
      {batchSuccessData && (
        <div 
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            setBatchSuccessData(null);
            if (onSuccess) onSuccess();
          }}
        >
          <div 
            className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-emerald-500/50 rounded-[2.5rem] p-6 sm:p-8 w-full max-w-md shadow-[0_0_60px_-10px_rgba(16,185,129,0.45),0_25px_50px_-12px_rgba(0,0,0,0.85)] animate-in zoom-in-95 relative overflow-hidden text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />
            
            {/* Glowing Backdrop Aura */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-emerald-500/25 rounded-full blur-3xl pointer-events-none"></div>

            {/* CheckCircle / Celebration Icon */}
            <div className="relative mx-auto w-20 h-20 mb-4">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75"></div>
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 p-0.5 shadow-xl shadow-emerald-500/30 flex items-center justify-center">
                <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
                </div>
              </div>
            </div>

            <div className="space-y-1 mb-5">
              <h3 className="text-xl font-black text-white tracking-tight">
                বিল সফলভাবে যুক্ত হয়েছে!
              </h3>
              <p className="text-xs text-emerald-400 font-semibold">
                Batch Bill Successfully Posted
              </p>
            </div>

            {/* Info Summary Card */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-xs space-y-2.5 text-left mb-5">
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" /> মোট সদস্য:
                </span>
                <span className="font-bold text-white bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                  {batchSuccessData.memberCount} জন
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-300">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" /> মোট টাকার পরিমাণ:
                </span>
                <span className="font-mono font-black text-emerald-400 text-base">
                  ৳{batchSuccessData.totalAmount.toLocaleString()}
                </span>
              </div>
              {batchSuccessData.category !== 'Unit Fund' ? (
                <>
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-400" /> উদ্দেশ্য / ফান্ড:
                    </span>
                    <span className="font-bold text-slate-200 line-clamp-1 max-w-[180px] text-right">
                      {batchSuccessData.purpose}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-slate-400" /> ফান্ড সোর্স:
                    </span>
                    <span className="font-semibold text-slate-300">
                      {batchSuccessData.source} {batchSuccessData.targetStaff ? `(${batchSuccessData.targetStaff})` : ''}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center text-slate-300">
                  <span className="text-slate-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-400" /> বিলের ধরন:
                  </span>
                  <span className="font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                    Unit Fund (সরাসরি বকেয়া যুক্ত হয়েছে)
                  </span>
                </div>
              )}
            </div>

            {/* Done Button */}
            <button
              type="button"
              onClick={() => {
                setBatchSuccessData(null);
                if (onSuccess) onSuccess();
              }}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm rounded-2xl shadow-xl shadow-emerald-950/50 transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>ঠিক আছে / সম্পন্ন (OK)</span>
            </button>
          </div>
        </div>
      )}

      {/* Dedicated History Modal (Separate Page like Sales History & Payment History) */}
      <FundHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        initialCategory={category}
        allTxs={allTxs}
        members={members}
        onRemoveTx={onRemoveTx}
        onSuccess={onSuccess}
        getMemberBanglaName={getMemberBanglaName}
        getMemberBanglaRank={getMemberBanglaRank}
        formatRankBn={formatRankBn}
        formatMemberNameBn={formatMemberNameBn}
      />
    </div>
  );
};

interface EditFundTxModalProps {
  isOpen: boolean;
  onClose: () => void;
  tx: any | null;
  onSave: (data: {
    amount: number;
    date: string;
    items: string;
    note?: string;
    monthKey: string;
  }) => Promise<void>;
  isSaving: boolean;
  purposePresets: string[];
}

export const EditFundTxModal: React.FC<EditFundTxModalProps> = ({
  isOpen,
  onClose,
  tx,
  onSave,
  isSaving,
  purposePresets
}) => {
  if (!isOpen || !tx) return null;

  const parseTxDateToYMD = (val: any): string => {
    if (!val) return getTodayYMD();
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
    if (typeof val === 'string') {
      const parts = val.trim().split(/\s+/);
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        const mIdx = monthNames.indexOf(parts[1].toLowerCase());
        if (mIdx !== -1) {
          const m = String(mIdx + 1).padStart(2, '0');
          let yr = parts[2];
          if (yr.length === 2) yr = `20${yr}`;
          return `${yr}-${m}-${day}`;
        }
      }
    }
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return getTodayYMD();
  };

  const [editAmount, setEditAmount] = useState<string>(String(tx.amount || ''));
  const [editDate, setEditDate] = useState<string>(() => parseTxDateToYMD(tx.date || tx.created_at || tx.timestamp));
  const [editItems, setEditItems] = useState<string>(tx.items || '');
  const [editNote, setEditNote] = useState<string>(tx.note || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (tx) {
      setEditAmount(String(tx.amount || ''));
      setEditDate(parseTxDateToYMD(tx.date || tx.created_at || tx.timestamp));
      setEditItems(tx.items || '');
      setEditNote(tx.note || '');
      setErrorMsg(null);
    }
  }, [tx]);

  const isUnit = tx ? getTxCategory(tx) === 'UNIT_FUND' : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(editAmount);
    const derivedItems = isUnit ? 'Unit Fund Bill' : editItems.trim();

    if (isNaN(num) || num <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0');
      return;
    }
    if (!isUnit && !editItems.trim()) {
      setErrorMsg('Purpose or description cannot be empty');
      return;
    }

    // Automatically derive monthKey from editDate (Date e ja thake oi month er bill er sathe add hbe)
    const derivedMonthKey = (() => {
      if (editDate) {
        const parts = editDate.split('-');
        if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
      }
      return tx.monthKey || getRunningMonthKey();
    })();

    try {
      await onSave({
        amount: num,
        date: editDate,
        items: derivedItems,
        note: editNote.trim() || undefined,
        monthKey: derivedMonthKey
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save changes');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-tight">Edit Transaction</h4>
              <p className="text-[11px] text-slate-400 font-bold">
                {tx.memberName || tx.name || `BD/${tx.bdNo}`} {tx.bdNo ? `(BD/${tx.bdNo})` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Amount */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-300 mb-1">
              Amount <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400 text-sm">
                ৳
              </span>
              <input
                type="number"
                min="1"
                step="1"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm font-mono font-black text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {[100, 200, 300, 500, 1000].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setEditAmount(String(q))}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    editAmount === String(q)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  ৳{q}
                </button>
              ))}
            </div>
          </div>

          {/* Date with POS Sales DateNavigator */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-300 mb-1">
              Billing Date
            </label>
            <DateNavigator
              value={editDate}
              onChange={setEditDate}
              label="Dt"
              format="dd_mm_yy"
            />
          </div>

          {/* Purpose / Items (Only for Others Fund; Unit Fund has fixed bill type) */}
          {!isUnit ? (
            <div>
              <label className="block text-xs font-black uppercase text-slate-300 mb-1">
                Purpose / Description <span className="text-rose-400">*</span>
              </label>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {purposePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setEditItems(preset)}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      editItems === preset
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={editItems}
                onChange={(e) => setEditItems(e.target.value)}
                placeholder="Enter purpose or description..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
                required
              />
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs flex justify-between items-center">
              <span className="text-slate-400 font-bold">Category:</span>
              <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 font-mono">
                Unit Fund Bill (Due)
              </span>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="Additional notes or remarks..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-lg shadow-indigo-950/50 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

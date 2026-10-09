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
  Settings
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { pushKeyToCloud, recordDeletedTxId } from '../utils/canteenCloudSync';
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
  
  // Purpose Presets & Notes State
  const DEFAULT_PURPOSE_PRESETS = [
    'বাজার',
    'ফরম-৭৯৩',
    'অন্য ক্যান্টিন বিল',
    'Mess Dinner Fee',
    'Picnic & Refreshment'
  ];

  const [purposePresets, setPurposePresets] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('canteen_purpose_presets');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_PURPOSE_PRESETS;
  });
  const [purpose, setPurpose] = useState<string>('বাজার');
  const [notes, setNotes] = useState<string>('');
  const [newPresetInput, setNewPresetInput] = useState<string>('');
  const [isAddingPreset, setIsAddingPreset] = useState<boolean>(false);
  const [isEditingPresets, setIsEditingPresets] = useState<boolean>(false);

  const [othersFundSource, setOthersFundSource] = useState<'Cash' | 'UCB'>('Cash');
  const [cashDeductTarget, setCashDeductTarget] = useState<'MANAGER' | 'STAFF'>('MANAGER');
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

  // Set of member IDs who already have a Unit Fund entry in this target month
  const membersWithUnitFundThisMonth = useMemo(() => {
    const set = new Set<string>();
    if (category !== 'UNIT_FUND') return set;

    (allTxs || []).forEach((tx: any) => {
      if (getTxCategory(tx) !== 'UNIT_FUND') return;
      if (tx.type === 'BILL PAYMENT' || tx.gateway === 'PAID') return;

      const txMonth = tx.monthKey || getTxMonthKey(tx);
      if (txMonth !== targetMonthKey) return;

      const cleanBd = String(tx.bdNo || tx['BD No'] || tx.airman_id || '').replace(/\D/g, '');
      const airmanId = String(tx.airman_id || '').toLowerCase().trim();

      members.forEach((m) => {
        const mCleanBd = String(m['BD No'] || m.bdNo || m.airman_id || '').replace(/\D/g, '');
        const mAirman = String(m.airman_id || '').toLowerCase().trim();
        if ((cleanBd && mCleanBd === cleanBd) || (airmanId && mAirman === airmanId)) {
          set.add(String(m.airman_id || m['BD No']));
        }
      });
    });

    return set;
  }, [allTxs, category, targetMonthKey, members]);

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
    const trimmed = newPresetInput.trim();
    if (!trimmed) return;
    if (!purposePresets.includes(trimmed)) {
      const updated = [...purposePresets, trimmed];
      setPurposePresets(updated);
      try {
        localStorage.setItem('canteen_purpose_presets', JSON.stringify(updated));
      } catch {}
    }
    setPurpose(trimmed);
    setNewPresetInput('');
    setIsAddingPreset(false);
  };

  const handleAddPresetWithName = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed) return;
    if (!purposePresets.includes(trimmed)) {
      const updated = [...purposePresets, trimmed];
      setPurposePresets(updated);
      try {
        localStorage.setItem('canteen_purpose_presets', JSON.stringify(updated));
      } catch {}
    }
    setPurpose(trimmed);
    setNewPresetInput('');
    setIsAddingPreset(false);
  };

  const handleRemovePreset = (presetToRemove: string) => {
    const updated = purposePresets.filter(p => p !== presetToRemove);
    setPurposePresets(updated);
    try {
      localStorage.setItem('canteen_purpose_presets', JSON.stringify(updated));
    } catch {}
    if (purpose === presetToRemove) {
      setPurpose(updated[0] || '');
    }
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
      showToast(`Unit Fund has already been billed for this member for ${targetMonthKey}! Duplicate billing in the same month is restricted.`, 'error');
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
      filteredMembers.forEach((m) => {
        const id = String(m.airman_id || m['BD No']);
        if (isUnitFund && membersWithUnitFundThisMonth.has(id)) {
          return; // Skip members already billed for this month
        }
        next.add(id);
      });
      return next;
    });
  };

  const handleDeselectAll = () => {
    setSelectedAirmanIds(new Set());
  };

  const handleSelectGroup = (filter: 'OFFICER' | 'AIRMEN' | 'CIVILIAN') => {
    setSelectedAirmanIds((prev) => {
      const next = new Set(prev);
      members.forEach((m) => {
        const matches = 
          (filter === 'OFFICER' && isOfficerMember(m)) ||
          (filter === 'AIRMEN' && isAirmanMember(m)) ||
          (filter === 'CIVILIAN' && isCivilianMember(m));
        if (matches) {
          const id = String(m.airman_id || m['BD No']);
          if (isUnitFund && membersWithUnitFundThisMonth.has(id)) {
            return; // Skip members already billed for this month
          }
          next.add(id);
        }
      });
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

    // Validate each selected member has an amount > 0
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

    if (!isUnitFund && !purpose.trim()) {
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
          .map((m) => `${m['Rank'] || ''} ${m['Surname'] || m['BD No']}`)
          .slice(0, 3)
          .join(', ');
        showToast(
          `The following members already have Unit Fund billed for ${targetMonthKey}: ${dupNames}${
            duplicateMembers.length > 3 ? ' and others' : ''
          }! Duplicate billing in the same month is restricted.`,
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
      const finalPurpose = purpose.trim() || (isUnitFund ? 'Unit Fund Subscription' : 'Others Bill');
      const finalNotes = notes.trim();
      const defaultDesc = isUnitFund
        ? (finalPurpose ? `Unit Fund (${finalPurpose})` : 'Unit Fund Bill')
        : finalPurpose;

      // Format date for display matching POS Sales (e.g. 09 Oct 26)
      const formattedTxDate = formatCanteenDate(txDate);

      const targetMonth = targetMonthKey;

      const newBatchTxs = selectedMemberList.map((m, idx) => {
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
          items: defaultDesc,
          note: finalNotes || undefined,
          soldItems: [],
          amount: memberAmt,
          type: 'INITIAL_BILL',
          gateway: 'DUE',
          billType: category
        };
      });

      const updatedTxs = [...newBatchTxs, ...existingTxs];
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));

      // Push member txs to cloud in background
      await pushKeyToCloud('canteen_txs', updatedTxs);

      // Automatically deduct total billed amount from Fund Cash or UCB as an expense so Capital All Logs receives entry
      const totalBatchDeduction = totalBatchAmount;
      const existingExpenses = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_expenses') || '[]');
        } catch {
          return [];
        }
      })();

      const detailedPerson = othersFundSource === 'Cash'
        ? (cashDeductTarget === 'STAFF' ? selectedStaffName : managerName)
        : 'UCB Bank';

      const fundExpenseRecord = {
        id: `exp-${category.toLowerCase()}-${now}`,
        date: formattedTxDate,
        desc: `${isUnitFund ? 'UNIT FUND' : 'OTHERS BILL'}: ${finalPurpose}`.toUpperCase(),
        subdesc: `Batch Bill: ${selectedMemberList.length} members (Total: ৳${totalBatchAmount.toLocaleString()})${finalNotes ? ` • Note: ${finalNotes}` : ''} [${othersFundSource === 'Cash' ? (cashDeductTarget === 'STAFF' ? `Staff: ${selectedStaffName}` : `Manager: ${managerName}`) : 'UCB Bank'}]`,
        category: isUnitFund ? 'Unit Fund' : 'Others Bill',
        paymentMethod: othersFundSource, // 'Cash' | 'UCB'
        amount: totalBatchDeduction,
        detailedPerson: detailedPerson,
        isCustom: true
      };

      const updatedExpenses = [fundExpenseRecord, ...existingExpenses];
      localStorage.setItem('canteen_expenses', JSON.stringify(updatedExpenses));
      await pushKeyToCloud('canteen_expenses', updatedExpenses);
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

        let updatedAdvances = advances;
        if (personActive.length === 0) {
          // If person had no active advance, create one so their spent balance is updated
          const newNegativeAdv = {
            id: `adv-${now}-${Math.random().toString(36).substring(2, 6)}`,
            date: formattedTxDate,
            personName: selectedStaffName,
            amount: 0,
            spentAmount: totalBatchDeduction,
            returnAmount: 0,
            channel: 'CASH',
            purpose: `${isUnitFund ? 'UNIT FUND' : 'OTHERS BILL'}: ${finalPurpose}`.toUpperCase(),
            status: 'ACTIVE',
            notes: `Auto deducted for ${isUnitFund ? 'Unit Fund' : 'Others'} Bill (${selectedMemberList.length} members)`
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
        await pushKeyToCloud('canteen_bazar_advances', updatedAdvances);
        window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
      }

      // Trigger sync events across the entire app
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('storage'));

      if (isUnitFund) {
        showToast(
          `Successfully posted Unit Fund bill for ${selectedMemberList.length} members (Total: ৳${totalBatchDeduction.toLocaleString()}) and recorded in Capital Logs!`
        );
      } else {
        showToast(
          `Successfully posted Others Bill for ${selectedMemberList.length} members and deducted ৳${totalBatchDeduction.toLocaleString()} from ${othersFundSource} Fund!`
        );
      }

      // Reset form
      setAmount('');
      setMemberCustomAmounts({});
      setAmountMode('SAME');
      setFillAllInput('');
      setNotes('');
      setSelectedAirmanIds(new Set());
      onSuccess();
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

      // 2. Remove from canteen_txs in localStorage and cloud immediately
      const existingTxs = (() => {
        try {
          return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
        } catch {
          return [];
        }
      })();
      const filtered = existingTxs.filter((t: any) => String(t.id) !== txIdStr);
      localStorage.setItem('canteen_txs', JSON.stringify(filtered));
      await pushKeyToCloud('canteen_txs', filtered);

      // 3. Delegate to onRemoveTx if provided from parent (MemberDB)
      if (onRemoveTx) {
        try {
          await onRemoveTx(tx);
        } catch (e) {
          console.warn('onRemoveTx call error in FundBatchBillPage:', e);
        }
      }

      // 4. Find target member to reverse their Due locally and in Supabase
      const targetMember = members.find((m: any) => {
        if (!m) return false;
        if (tx.airman_id && m.airman_id === tx.airman_id) return true;
        const txBd = String(tx.bdNo || tx['BD No'] || '').trim();
        const mBd = String(m['BD No'] || m.bdNo || '').trim();
        if (txBd && mBd && txBd.toLowerCase() === mBd.toLowerCase()) return true;
        const txBdClean = txBd.replace(/\D/g, '');
        const mBdClean = mBd.replace(/\D/g, '');
        if (txBdClean && mBdClean && txBdClean === mBdClean) return true;
        const txName = String(tx.memberName || tx.name || '').trim().toLowerCase();
        const mSurname = String(m.Surname || m.surname || '').trim().toLowerCase();
        if (txName && mSurname && (txName.includes(mSurname) || mSurname.includes(txName))) return true;
        return false;
      });

      if (targetMember) {
        const amountToReverse = Number(tx.amount || 0);
        const currentDue = Number(targetMember.Due ?? targetMember.due ?? targetMember.baki ?? 0);
        const newDue = Math.max(0, currentDue - amountToReverse);

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
          console.warn('Supabase member due update on delete:', e);
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

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('storage'));

      showToast('Transaction record deleted successfully');
      setTxToDelete(null);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const selectedCount = selectedAirmanIds.size;
  const numAmount = parseFloat(amount) || 0;

  // Selected members list sorted by seniority
  const selectedMembersList = useMemo(() => {
    const list = members.filter((m) =>
      selectedAirmanIds.has(String(m.airman_id || m['BD No']))
    );
    return sortCanteenMembersByOfficeSeniority(list);
  }, [members, selectedAirmanIds]);

  const totalBatchAmount = useMemo(() => {
    if (selectedCount === 0) return 0;
    let sum = 0;
    selectedAirmanIds.forEach((id) => {
      const raw = memberCustomAmounts[id] !== undefined ? memberCustomAmounts[id] : amount;
      const val = parseFloat(raw || '0') || 0;
      sum += val;
    });
    return sum;
  }, [selectedCount, selectedAirmanIds, memberCustomAmounts, amount]);

  const isAllMemberAmountsValid = useMemo(() => {
    if (selectedCount === 0) return false;
    for (const id of Array.from(selectedAirmanIds)) {
      const raw = memberCustomAmounts[id] !== undefined ? memberCustomAmounts[id] : amount;
      const val = parseFloat(raw || '0');
      if (isNaN(val) || val <= 0) return false;
    }
    return true;
  }, [selectedCount, selectedAirmanIds, memberCustomAmounts, amount]);

  const invalidCustomAmountsCount = useMemo(() => {
    if (selectedCount === 0) return 0;
    let count = 0;
    selectedAirmanIds.forEach((id) => {
      const raw = memberCustomAmounts[id] !== undefined ? memberCustomAmounts[id] : amount;
      const val = parseFloat(raw || '0');
      if (isNaN(val) || val <= 0) count++;
    });
    return count;
  }, [selectedCount, selectedAirmanIds, memberCustomAmounts, amount]);

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

      {/* Summary KPI Cards (without Active Month) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Monthly Billed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 truncate">
              {formatActiveMonth(targetMonthKey).toUpperCase()} BILLED
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isUnitFund ? 'bg-indigo-500/10 text-indigo-400' : 'bg-cyan-500/10 text-cyan-400'
            }`}>
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-white">
              ৳{stats.totalMonthBilled.toLocaleString()}
            </div>
            <p className="text-[11px] font-bold text-slate-400 truncate mt-1">
              Billed for {formatActiveMonth(targetMonthKey)}
            </p>
          </div>
        </div>

        {/* Total Overall Due */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 truncate">
              TOTAL {categoryTitle} DUE
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-rose-300">
              ৳{stats.totalDue.toLocaleString()}
            </div>
            <p className="text-[11px] font-bold text-slate-400 truncate mt-1">
              {stats.membersWithDue} members with outstanding due
            </p>
          </div>
        </div>
      </div>

      {/* ================= BATCH ADD BILL GENERATOR (SYNCHRONIZED SEQUENCE) ================= */}
      {/* Sequence: Date, Member selection, Select Cat, Amount, Payment Method, Confirm */}
      <div className="space-y-5">
        {/* STEP 1: DATE */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-black text-xs flex items-center justify-center">
                ১
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span>তারিখ (Billing Date)</span>
              </h3>
            </div>
            <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-xl bg-slate-950 text-indigo-300 border border-slate-800">
              Month: {formatActiveMonth(targetMonthKey)}
            </span>
          </div>
          <div>
            <DateNavigator 
              value={txDate} 
              onChange={setTxDate} 
              label="Dt"
              format="dd_mm_yy"
            />
          </div>
        </div>

        {/* STEP 2: MEMBER SELECTION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-black text-xs flex items-center justify-center">
                ২
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>সদস্য নির্বাচন (Member Selection)</span>
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

            {/* Selection Shortcuts */}
            <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="px-3 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer"
              >
                Select All ({filteredMembers.length})
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                disabled={selectedCount === 0}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All
              </button>
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

          {/* Members Selection List Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[380px] overflow-y-auto p-2.5 rounded-2xl bg-slate-950/70 border border-slate-800 scrollbar-none">
            {filteredMembers.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-400 text-xs font-bold">
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
                        ? 'bg-indigo-950/40 border-indigo-500/70 shadow-sm shadow-indigo-950/50 cursor-pointer'
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
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                              ✓ Billed
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

        {/* STEP 3: SELECT CAT */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-black text-xs flex items-center justify-center">
                ৩
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Tag className="w-4 h-4 text-indigo-400" />
                <span>ক্যাটাগরি / প্রিসেট নির্বাচন (Select Cat) {!isUnitFund && <span className="text-rose-400">*</span>}</span>
              </h3>
            </div>
            {/* Settings Gear Icon to toggle edit mode, like Add Disposal */}
            <button
              type="button"
              onClick={() => setIsEditingPresets(!isEditingPresets)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isEditingPresets
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={isEditingPresets ? 'Done Editing Presets' : 'Manage Saved Presets'}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Preset Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {purposePresets.map((preset) => {
              const isSelected = !isEditingPresets && purpose === preset;
              return (
                <div key={preset} className="relative group">
                  <button
                    type="button"
                    onClick={() => {
                      if (isEditingPresets) return;
                      setPurpose(preset);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all truncate ${
                      isEditingPresets
                        ? 'pr-7 opacity-85 cursor-default bg-slate-950 border-slate-700 text-slate-300'
                        : 'cursor-pointer'
                    } ${
                      isSelected
                        ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-950/90 text-indigo-100 shadow-sm'
                        : !isEditingPresets
                        ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                        : ''
                    }`}
                  >
                    {preset}
                  </button>
                  {isEditingPresets && (
                    <button
                      type="button"
                      onClick={() => handleRemovePreset(preset)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full bg-red-900/60 text-red-300 hover:bg-red-800 hover:text-white transition-colors cursor-pointer"
                      title="Delete preset"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Inline Add Preset: NO popup overflowing on mobile, NO suggested categories */}
            {!isEditingPresets && (
              isAddingPreset ? (
                <div className="flex items-center gap-1.5 bg-slate-950 border border-indigo-500/60 rounded-xl p-1 max-w-full">
                  <input
                    type="text"
                    placeholder="নতুন প্রিসেট..."
                    value={newPresetInput}
                    onChange={(e) => setNewPresetInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPreset();
                      } else if (e.key === 'Escape') {
                        setIsAddingPreset(false);
                      }
                    }}
                    className="bg-transparent border-0 px-2 py-1 text-xs font-bold text-white outline-none placeholder:text-slate-500 w-32 sm:w-44"
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
                  title="Add Preset"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Preset</span>
                </button>
              )
            )}
          </div>

          {/* Specify Custom Name / বিবরণ Input */}
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-1">
            <label className="text-[11px] font-bold text-slate-300 block">
              Specify Purpose Name / বিবরণ {!isUnitFund && <span className="text-rose-400">*</span>}
            </label>
            <input
              type="text"
              placeholder="e.g. বাজার, ফরম-৭৯৩, ইত্যাদি..."
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-700 bg-slate-900 text-white outline-none focus:border-indigo-500 shadow-inner"
              required={!isUnitFund}
            />
          </div>

          {/* Notes (ঐচ্ছিক) */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-300 mb-1.5 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Notes / বিশেষ বিবরণ (ঐচ্ছিক)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="প্রয়োজনীয় কোনো বাড়তি নোট বা বিবরণ লিখুন..."
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-inner resize-none"
            />
          </div>
        </div>

        {/* STEP 4: AMOUNT */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-black text-xs flex items-center justify-center">
                ৪
              </span>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                  <Coins className="w-4 h-4 text-indigo-400" />
                  <span>বিলের পরিমাণ (Amount) <span className="text-rose-400">*</span></span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  {selectedCount === 0 
                    ? 'প্রথমে উপরে সদস্য নির্বাচন করুন'
                    : selectedCount === 1 
                      ? 'নির্বাচিত ১ জন সদস্যের জন্য বিল'
                      : `নির্বাচিত ${selectedCount} জন সদস্যের জন্য বিলের পরিমাণ নির্ধারণ করুন`}
                </p>
              </div>
            </div>

            {selectedCount > 0 && (
              <span className="text-xs font-mono font-black px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-indigo-300 self-start sm:self-auto">
                {selectedCount} {selectedCount === 1 ? 'Member' : 'Members'}
              </span>
            )}
          </div>

          {selectedCount === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs font-bold bg-slate-950/60 rounded-2xl border border-dashed border-slate-800">
              <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
              বিলের পরিমাণ নির্ধারণ করতে অনুগ্রহ করে উপরে <span className="text-indigo-400">২য় ধাপ (সদস্য নির্বাচন)</span> থেকে এক বা একাধিক সদস্য সিলেক্ট করুন।
            </div>
          ) : (
            <div className="space-y-3.5">
              {/* Quick Toolbar: Fill All / সবগুলোতে দিন */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-3.5 bg-slate-950/80 rounded-2xl border border-slate-800">
                <div className="text-xs font-bold text-slate-300">
                  নিচে প্রতিটি নির্বাচিত সদস্যের নামের পাশে কাঙ্ক্ষিত পরিমাণ লিখুন:
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-32 sm:w-36">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">৳</span>
                    <input
                      type="number"
                      placeholder="একসাথে বসান"
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
                      showToast(`সকল সদস্যের জন্য ৳${fillAllInput} বসানো হয়েছে`);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-sm"
                  >
                    সবগুলোতে দিন
                  </button>
                </div>
              </div>

              {/* List of Selected Members with Name & Individual Amount Box Beside Them */}
              <div className="max-h-80 overflow-y-auto space-y-2 p-2 sm:p-2.5 bg-slate-950/70 border border-slate-800 rounded-2xl">
                {selectedMembersList.map((m, idx) => {
                  const mId = String(m.airman_id || m['BD No']);
                  const memberDp = resolveImageUrl(m.DP);
                  const memberVal = memberCustomAmounts[mId] !== undefined ? memberCustomAmounts[mId] : '';
                  const numVal = parseFloat(memberVal);
                  const isValidVal = !isNaN(numVal) && numVal > 0;

                  return (
                    <div
                      key={mId}
                      className={`p-2.5 sm:p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                        isValidVal
                          ? 'bg-slate-900/90 border-slate-800/90 hover:border-slate-700'
                          : 'bg-rose-950/10 border-rose-500/30'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0 flex-1">
                        <span className="w-5 text-[10px] font-mono text-slate-500 text-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
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

                      {/* Individual Amount Box Right Beside Member */}
                      <div className="relative w-32 sm:w-44 shrink-0">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-400 text-xs">
                          ৳
                        </span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="টাকার পরিমাণ"
                          value={memberVal}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMemberCustomAmounts((prev) => ({
                              ...prev,
                              [mId]: val
                            }));
                          }}
                          className={`w-full bg-slate-950 border rounded-xl pl-6 pr-2.5 py-2 text-xs font-mono font-black text-white outline-none shadow-inner transition-all ${
                            isValidVal
                              ? 'border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500'
                              : 'border-rose-500/50 focus:border-rose-400'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Live Total Banner */}
              <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-300 font-bold">
                    নির্বাচিত {selectedCount} জন সদস্যের মোট বিল:
                  </span>
                  {invalidCustomAmountsCount > 0 ? (
                    <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                      ⚠️ {invalidCustomAmountsCount} জনের পরিমাণ বাকি
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                      ✓ সবার পরিমাণ নির্ধারিত
                    </span>
                  )}
                </div>
                <span className="font-mono font-black text-emerald-400 text-base">
                  ৳{totalBatchAmount.toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* STEP 5: PAYMENT METHOD */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-3.5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2.5">
              <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 font-mono font-black text-xs flex items-center justify-center">
                ৫
              </span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
                <Wallet className="w-4 h-4 text-cyan-400" />
                <span>পেমেন্ট মাধ্যম (Payment Method) <span className="text-rose-400">*</span></span>
              </h3>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">Capital Fund</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setOthersFundSource('Cash')}
              className={`py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                othersFundSource === 'Cash'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-950/50 ring-2 ring-emerald-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Cash</span>
            </button>
            <button
              type="button"
              onClick={() => setOthersFundSource('UCB')}
              className={`py-3 px-4 rounded-2xl text-xs font-black flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                othersFundSource === 'UCB'
                  ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-950/50 ring-2 ring-cyan-400'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>UCB</span>
            </button>
          </div>

          {/* When Cash is selected: Staff option toggle & selection */}
          {othersFundSource === 'Cash' && (
            <div className="bg-slate-950/90 rounded-2xl p-3.5 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer select-none">
                  <input 
                    type="checkbox"
                    checked={cashDeductTarget === 'STAFF'}
                    onChange={(e) => setCashDeductTarget(e.target.checked ? 'STAFF' : 'MANAGER')}
                    className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-200">
                    Staff অপশন নির্বাচন (Staff Account)
                  </span>
                </label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800">
                  {cashDeductTarget === 'STAFF' ? 'Staff Account' : 'Auto Manager Cash'}
                </span>
              </div>

              {cashDeductTarget === 'STAFF' ? (
                <div className="space-y-1.5 pt-1.5 border-t border-slate-800">
                  <label className="block text-[10px] font-black uppercase text-slate-400">
                    Select Staff Member *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {civilianStaffList.map((st) => (
                      <button
                        key={st.id || st.name}
                        type="button"
                        onClick={() => setSelectedStaffName(st.name)}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-black text-center truncate transition-all cursor-pointer ${
                          selectedStaffName === st.name
                            ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-300'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                        }`}
                        title={st.name}
                      >
                        {st.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-indigo-950/30 border border-indigo-900/40 text-[11px] text-indigo-300 font-bold flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Staff নির্বাচন না করায় স্বয়ংক্রিয়ভাবে Manager ({managerName}) এর Cash থেকে টাকা কর্তন ও লগ করা হবে।</span>
                </div>
              )}
            </div>
          )}

          <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
            💡 মোট বিল {totalBatchAmount > 0 && selectedCount > 0 ? `৳${totalBatchAmount.toLocaleString()}` : ''} ক্যাপিটাল ফান্ডের{' '}
            {othersFundSource === 'Cash' ? (
              cashDeductTarget === 'STAFF' ? (
                <strong className="text-emerald-400">{selectedStaffName} এর Advance</strong>
              ) : (
                <strong className="text-indigo-300">Manager ({managerName}) Cash</strong>
              )
            ) : (
              <strong className="text-cyan-300">UCB Fund</strong>
            )}{' '}
            থেকে কর্তন হয়ে Capital এর All Logs-এ এন্ট্রি যোগ হবে।
          </p>
        </div>

        {/* STEP 6: CONFIRM */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center space-x-2.5 border-b border-slate-800 pb-2.5">
            <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-black text-xs flex items-center justify-center">
              ৬
            </span>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>বিল নিশ্চিতকরণ ও পোস্ট (Confirm)</span>
            </h3>
          </div>

          {/* Live Calculation Summary Box */}
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>Billing Date:</span>
              <span className="font-mono text-white font-black">{formatCanteenDate(txDate)}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>Selected Members:</span>
              <span className="font-mono text-white font-black">{selectedCount} members</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>Purpose / Category:</span>
              <span className="text-indigo-300 font-bold truncate max-w-[200px]">{purpose || (isUnitFund ? 'Unit Fund Subscription' : 'Others Bill')}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>Amount Per Member:</span>
              <span className="font-mono text-emerald-400 font-black">
                {amountMode === 'SAME'
                  ? (numAmount > 0 ? `৳${numAmount.toLocaleString()}` : 'Nil')
                  : `Individual Rates (ভিন্ন ভিন্ন পরিমাণ)`}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span>Payment Channel:</span>
              <span className="font-mono text-cyan-300 font-bold">
                {othersFundSource} {othersFundSource === 'Cash' ? `(${cashDeductTarget === 'STAFF' ? selectedStaffName : 'Manager Cash'})` : ''}
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
            disabled={isSubmitting || selectedCount === 0 || !isAllMemberAmountsValid || (!isUnitFund && !purpose.trim())}
            onClick={handleBatchAddBill}
            className={`w-full py-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xl active:scale-98 ${
              selectedCount > 0 && isAllMemberAmountsValid && (isUnitFund || purpose.trim())
                ? 'bg-gradient-to-r from-emerald-600 via-indigo-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800 shadow-none'
            }`}
          >
            {isSubmitting ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>
              {isSubmitting 
                ? 'Posting Bills...' 
                : `Confirm & Post Batch Bill (${selectedCount} Members • ${totalBatchAmount > 0 && selectedCount > 0 ? `৳${totalBatchAmount.toLocaleString()}` : 'Nil'})`}
            </span>
          </button>
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in zoom-in-95 space-y-4">
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(editAmount);
    if (isNaN(num) || num <= 0) {
      setErrorMsg('সঠিক টাকার পরিমাণ দিন (০ এর বেশি)');
      return;
    }
    if (!editItems.trim()) {
      setErrorMsg('উদ্দেশ্য বা বিবরণ খালি রাখা যাবে না');
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
        items: editItems.trim(),
        note: editNote.trim() || undefined,
        monthKey: derivedMonthKey
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'সংরক্ষণ ব্যর্থ হয়েছে');
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
              Amount (টাকা) <span className="text-rose-400">*</span>
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

          {/* Purpose / Items */}
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
              placeholder="উদ্দেশ্য বা বিবরণ লিখুন..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-black uppercase text-slate-300 mb-1">
              Notes / বিশেষ মন্তব্য (ঐচ্ছিক)
            </label>
            <input
              type="text"
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder="অতিরিক্ত মন্তব্য..."
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

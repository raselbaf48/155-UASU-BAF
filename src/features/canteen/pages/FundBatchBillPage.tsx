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
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { pushKeyToCloud, recordDeletedTxId } from '../utils/canteenCloudSync';
import { resolveImageUrl, getCanteenConfig } from '../utils/canteenSettings';
import { formatCanteenDate } from '../utils/dateUtils';
import { formatBengaliMonthYear } from '../utils/exportCanteenBillExcel';
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

  // Month navigation
  const [currentMonth, setCurrentMonth] = useState<string>(
    initialSelectedMonth && initialSelectedMonth !== 'ALL' ? initialSelectedMonth : getRunningMonthKey()
  );

  // Batch Add Form State
  const [amount, setAmount] = useState<string>('');
  const [txDate, setTxDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string>('');
  const [othersFundSource, setOthersFundSource] = useState<'Cash' | 'UCB'>('Cash');
  const [cashDeductTarget, setCashDeductTarget] = useState<'MANAGER' | 'STAFF'>('MANAGER');
  const [selectedStaffName, setSelectedStaffName] = useState<string>('Civ Tanvir');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Transaction delete confirmation state
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

  // Target month key computed from selected date
  const targetMonthKey = useMemo(() => {
    const dateObj = new Date(txDate);
    return !isNaN(dateObj.getTime())
      ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
      : currentMonth;
  }, [txDate, currentMonth]);

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

  // Filter members based on search and memberFilter, maintaining strict Rank Seniority (Officers > JCOs > Airmen > Civilians)
  const filteredMembers = useMemo(() => {
    const list = members.filter((m) => {
      // Role / Rank Filter
      if (memberFilter === 'OFFICER' && !isOfficerMember(m)) return false;
      if (memberFilter === 'AIRMEN' && !isAirmanMember(m)) return false;
      if (memberFilter === 'CIVILIAN' && !isCivilianMember(m)) return false;

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
  }, [members, memberFilter, searchQuery, getMemberBanglaName, getMemberBanglaRank]);

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

  // Overall Statistics for this category
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
      const mb = getMemberFilteredBill(m, category, currentMonth);
      totalMonthBilled += mb;
    });

    return { totalDue, totalMonthBilled, membersWithDue };
  }, [members, category, currentMonth, getMemberTotalDue, getMemberFilteredBill]);

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

  // Month navigation helpers
  const handlePrevMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  // Submit Batch Bill Addition
  const handleBatchAddBill = async (e: React.FormEvent) => {
    e.preventDefault();

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast('Please enter a valid amount greater than 0', 'error');
      return;
    }

    if (selectedAirmanIds.size === 0) {
      showToast('Please select at least one member to assign the bill', 'error');
      return;
    }

    if (!isUnitFund && !note.trim()) {
      showToast('A description note is required for Others Bill', 'error');
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
      const finalNote = note.trim();
      const defaultDesc = isUnitFund
        ? (finalNote ? `Unit Fund (${finalNote})` : 'Unit Fund Bill')
        : (finalNote ? `Others: ${finalNote}` : 'Others Bill');

      // Format date for display (e.g. 06 Oct 26)
      const dateObj = new Date(txDate);
      const enMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const formattedTxDate = !isNaN(dateObj.getTime())
        ? `${String(dateObj.getDate()).padStart(2, '0')} ${enMonths[dateObj.getMonth()]} ${String(dateObj.getFullYear()).slice(-2)}`
        : formatCanteenDate(new Date());

      const targetMonth = !isNaN(dateObj.getTime())
        ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
        : currentMonth;

      const newBatchTxs = selectedMemberList.map((m, idx) => {
        const cleanBdNo = String(m['BD No'] || m.airman_id || '').replace(/\D/g, '');
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
          note: finalNote || undefined,
          soldItems: [],
          amount: numAmount,
          type: 'INITIAL_BILL',
          gateway: 'DUE',
          billType: category
        };
      });

      const updatedTxs = [...newBatchTxs, ...existingTxs];
      localStorage.setItem('canteen_txs', JSON.stringify(updatedTxs));

      // Push member txs to cloud in background
      await pushKeyToCloud('canteen_txs', updatedTxs);

      // OTHERS BILL: Automatically deduct total billed amount from Fund Cash or UCB as an expense
      if (!isUnitFund) {
        const totalOthersDeduction = numAmount * selectedMemberList.length;
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

        const othersExpenseRecord = {
          id: `exp-others-${now}`,
          date: formattedTxDate,
          desc: `OTHERS BILL: ${finalNote}`.toUpperCase(),
          subdesc: `Bill charged to ${selectedMemberList.length} members (৳${numAmount.toLocaleString()} per member) [${othersFundSource === 'Cash' ? (cashDeductTarget === 'STAFF' ? `Staff: ${selectedStaffName}` : `Manager: ${managerName}`) : 'UCB Bank'}]`,
          category: 'Others Bill',
          paymentMethod: othersFundSource, // 'Cash' | 'UCB'
          amount: totalOthersDeduction,
          detailedPerson: detailedPerson,
          isCustom: true
        };

        const updatedExpenses = [othersExpenseRecord, ...existingExpenses];
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
              spentAmount: totalOthersDeduction,
              returnAmount: 0,
              channel: 'CASH',
              purpose: `OTHERS BILL: ${finalNote}`.toUpperCase(),
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
                  spentAmount: (Number(a.spentAmount) || 0) + totalOthersDeduction
                };
              }
              return a;
            });
          }

          localStorage.setItem('canteen_bazar_advances', JSON.stringify(updatedAdvances));
          await pushKeyToCloud('canteen_bazar_advances', updatedAdvances);
          window.dispatchEvent(new Event('canteen_bazar_advances_updated'));
        }
      }

      // Trigger sync events across the entire app
      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_members_updated'));
      window.dispatchEvent(new Event('storage'));

      if (isUnitFund) {
        showToast(
          `Successfully posted Unit Fund bill of ৳${numAmount.toLocaleString()} per member for ${selectedMemberList.length} members!`
        );
      } else {
        const totalOthersDeduction = numAmount * selectedMemberList.length;
        showToast(
          `Successfully posted Others Bill for ${selectedMemberList.length} members and deducted ৳${totalOthersDeduction.toLocaleString()} from ${othersFundSource} Fund!`
        );
      }

      // Reset form
      setAmount('');
      if (!isUnitFund) setNote('');
      setSelectedAirmanIds(new Set());
      onSuccess();
    } catch (err: any) {
      console.error('Batch add error:', err);
      showToast(`Failed to post batch bills: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setIsSubmitting(false);
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
  const totalBatchAmount = selectedCount * numAmount;

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
          {activeTab === 'ADD_BATCH' ? (
            <button
              type="button"
              onClick={() => setActiveTab('RECENT_LOG')}
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
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('ADD_BATCH')}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95 border ${
                isUnitFund
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white border-indigo-400/40 shadow-indigo-900/40'
                  : 'bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-500 hover:to-cyan-600 text-white border-cyan-400/40 shadow-cyan-900/40'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>New Batch Bill</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards & Month Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Month Selector Card - Clean, High Contrast with Active Month formatted (e.g. October-26) */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center space-x-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>ACTIVE MONTH</span>
            </span>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {formatActiveMonth(currentMonth)}
            </span>
          </div>

          <div className="flex items-center justify-between bg-slate-950/90 rounded-xl p-1 border border-slate-800 shadow-inner">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4 text-indigo-400" />
            </button>
            <div className="text-center font-black text-xs sm:text-sm text-white font-mono tracking-wide">
              {formatActiveMonth(currentMonth)}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4 text-indigo-400" />
            </button>
          </div>
        </div>

        {/* Monthly Billed & Total Due: Compact & Side-by-Side (grid-cols-2) */}
        <div className="md:col-span-2 grid grid-cols-2 gap-2.5 sm:gap-3">
          {/* Monthly Billed */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                MONTHLY BILLED
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                isUnitFund ? 'bg-indigo-500/10 text-indigo-400' : 'bg-cyan-500/10 text-cyan-400'
              }`}>
                <Coins className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black font-mono text-white">
                ৳{stats.totalMonthBilled.toLocaleString()}
              </div>
              <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                Total billed in {formatActiveMonth(currentMonth)}
              </p>
            </div>
          </div>

          {/* Total Overall Due */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 truncate">
                TOTAL {categoryTitle} DUE
              </span>
              <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                <Banknote className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black font-mono text-rose-300">
                ৳{stats.totalDue.toLocaleString()}
              </div>
              <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                {stats.membersWithDue} members with outstanding due
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ================= TAB 1: BATCH ADD BILL ================= */}
      {activeTab === 'ADD_BATCH' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Form Controls (Amount, Date, Note, Action Button) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center space-x-2">
                  <Coins className={`w-5 h-5 ${isUnitFund ? 'text-indigo-400' : 'text-cyan-400'}`} />
                  <span>Batch Billing Form</span>
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-1">
                  Set amount and date, then select members from the right
                </p>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-1.5">
                  Amount per Member <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-slate-400 text-base">
                    ৳
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Enter amount (e.g. 500)"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-9 pr-4 py-3 text-base font-mono font-black text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 shadow-inner"
                    required
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {quickAmounts.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setAmount(String(q))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition-all cursor-pointer ${
                        amount === String(q)
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      ৳{q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Input - Compact with Calendar Icon click trigger */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>Billing Date</span>
                  <span className="text-[10px] font-mono text-slate-400">Target Month: {targetMonthKey}</span>
                </label>
                <div 
                  onClick={() => {
                    try {
                      dateInputRef.current?.showPicker();
                    } catch (e) {
                      dateInputRef.current?.focus();
                    }
                  }}
                  className="inline-flex items-center space-x-2 bg-slate-950 border border-slate-700 hover:border-indigo-500/70 rounded-2xl px-3 py-2 cursor-pointer transition-all shadow-inner group"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      try {
                        dateInputRef.current?.showPicker();
                      } catch (err) {
                        dateInputRef.current?.focus();
                      }
                    }}
                    className="p-1 rounded-lg text-slate-400 group-hover:text-indigo-400 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Click to open calendar"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none cursor-pointer w-28 sm:w-32"
                  />
                </div>
              </div>

              {/* NOTE / REASON FIELD (PROMINENT AND CRITICAL FOR OTHERS) */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-300 mb-1.5 flex items-center justify-between">
                  <span>
                    Description / Purpose{' '}
                    {!isUnitFund && <span className="text-rose-400">*</span>}
                  </span>
                  {!isUnitFund && (
                    <span className="text-[10px] font-bold text-cyan-400 font-mono">Required</span>
                  )}
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    isUnitFund
                      ? 'Optional reference note (e.g. Welfare subscription)'
                      : 'Detailed purpose of charge (e.g. Mess Dinner Fee, Refreshments...)'
                  }
                  className={`w-full bg-slate-950 border rounded-2xl p-3 text-xs font-bold text-white focus:outline-none shadow-inner resize-none ${
                    !isUnitFund && !note.trim()
                      ? 'border-cyan-500/50 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20'
                      : 'border-slate-700 focus:border-indigo-500'
                  }`}
                  required={!isUnitFund}
                />
              </div>

              {/* For Others Bill: Fund Deduction Source (Cash or UCB) */}
              {!isUnitFund && (
                <div className="bg-slate-950/80 rounded-2xl p-3 border border-cyan-500/30 space-y-2.5">
                  <label className="block text-[11px] font-black uppercase text-cyan-300 flex items-center justify-between">
                    <span className="flex items-center space-x-1.5">
                      <Wallet className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Deduct from Fund Account *</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono font-normal">Canteen Fund</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOthersFundSource('Cash')}
                      className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                        othersFundSource === 'Cash'
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Cash (Drawer)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOthersFundSource('UCB')}
                      className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                        othersFundSource === 'UCB'
                          ? 'bg-cyan-600 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-400'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>UCB (Bank)</span>
                    </button>
                  </div>

                  {/* Cash Account Options: Manager vs Staff */}
                  {othersFundSource === 'Cash' && (
                    <div className="bg-slate-900/90 rounded-xl p-2.5 border border-slate-800/90 space-y-2 mt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase text-slate-300 flex items-center space-x-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Deduct Cash From *</span>
                        </label>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {cashDeductTarget === 'MANAGER' ? 'Manager Cash' : 'Staff Account'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCashDeductTarget('MANAGER')}
                          className={`py-1.5 px-2.5 rounded-lg text-[11px] font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                            cashDeductTarget === 'MANAGER'
                              ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
                          <span className="truncate">Manager ({managerName})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setCashDeductTarget('STAFF')}
                          className={`py-1.5 px-2.5 rounded-lg text-[11px] font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                            cashDeductTarget === 'STAFF'
                              ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                              : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-200" />
                          <span>Staff</span>
                        </button>
                      </div>

                      {/* Staff member selection list */}
                      {cashDeductTarget === 'STAFF' && (
                        <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                          <label className="block text-[10px] font-black uppercase text-slate-400">
                            Select Staff Member Account *
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
                                    : 'bg-slate-950 text-slate-300 hover:bg-slate-800 border border-slate-800'
                                }`}
                                title={st.name}
                              >
                                {st.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                    💡 Total bill {numAmount > 0 && selectedCount > 0 ? `৳${totalBatchAmount.toLocaleString()}` : 'amount'} will be automatically deducted from{' '}
                    {othersFundSource === 'Cash' ? (
                      cashDeductTarget === 'STAFF' ? (
                        <strong className="text-emerald-400">{selectedStaffName} এর Account / Advance</strong>
                      ) : (
                        <strong className="text-indigo-300">Manager ({managerName}) এর Cash Drawer</strong>
                      )
                    ) : (
                      <strong className="text-cyan-300">UCB Bank Fund</strong>
                    )}{' '}
                    upon posting.
                  </p>
                </div>
              )}

              {/* Live Calculation Summary Box */}
              <div className="bg-slate-950 rounded-2xl p-3.5 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Selected Members:</span>
                  <span className="font-mono text-white font-black">{selectedCount} members</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Amount Per Member:</span>
                  <span className="font-mono text-emerald-400 font-black">
                    {numAmount > 0 ? `৳${numAmount.toLocaleString()}` : 'Nil'}
                  </span>
                </div>
                <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-sm font-black text-white">
                  <span>Total Batch Amount:</span>
                  <span className="font-mono text-base text-amber-400 font-black">
                    {numAmount > 0 && selectedCount > 0 ? `৳${totalBatchAmount.toLocaleString()}` : 'Nil'}
                  </span>
                </div>
              </div>

              {/* Action Submit Button */}
              <button
                type="button"
                disabled={isSubmitting || selectedCount === 0 || numAmount <= 0 || (!isUnitFund && !note.trim())}
                onClick={handleBatchAddBill}
                className={`w-full py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg active:scale-98 ${
                  selectedCount > 0 && numAmount > 0 && (isUnitFund || note.trim())
                    ? isUnitFund
                      ? 'bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white shadow-indigo-600/30'
                      : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-cyan-600/30'
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
                    : `Post Batch Bill (${selectedCount} Members • ${numAmount > 0 && selectedCount > 0 ? `৳${totalBatchAmount.toLocaleString()}` : 'Nil'})`}
                </span>
              </button>
            </div>
          </div>

          {/* Right Column: Member Selection Grid / List */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
              {/* Header with Search and Group Selector */}
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

                {/* Quick Selection Shortcuts */}
                <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="px-2.5 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer"
                  >
                    Select All ({filteredMembers.length})
                  </button>
                  <button
                    type="button"
                    onClick={handleDeselectAll}
                    disabled={selectedCount === 0}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center justify-between border-y border-slate-800/80 py-2.5 flex-wrap gap-2">
                <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-none">
                  {(['ALL', 'OFFICER', 'AIRMEN', 'CIVILIAN'] as const).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setMemberFilter(cat)}
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

                <div className="flex items-center space-x-2 text-xs font-bold text-slate-400">
                  <span>Selected:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 font-mono font-black border border-indigo-500/30">
                    {selectedCount} members
                  </span>
                </div>
              </div>

              {/* Members Selection List */}
              <div className="max-h-[520px] overflow-y-auto space-y-2 pr-1 scrollbar-none">
                {filteredMembers.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs font-bold">
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
                          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
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
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-sans flex items-center space-x-1">
                                  <span>✓ Billed for {targetMonthKey}</span>
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              BD/{m['BD No']} • {m.Role || 'Member'}
                            </div>
                          </div>
                        </div>

                        {/* Current Fund Due */}
                        <div className="text-right shrink-0">
                          <div className="text-[10px] font-bold text-slate-400 uppercase">
                            CURRENT DUE
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
          </div>
        </div>
      )}

      {/* ================= RECENT TRANSACTION AUDIT LOG ================= */}
      {activeTab === 'RECENT_LOG' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-4 gap-3">
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={() => setActiveTab('ADD_BATCH')}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-bold flex items-center space-x-1.5 border border-slate-700/80 active:scale-95"
                title="Back to Generator"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Generator</span>
              </button>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-tight flex items-center space-x-2">
                  <Clock className={`w-4 h-4 ${isUnitFund ? 'text-indigo-400' : 'text-cyan-400'}`} />
                  <span>{categoryTitle} Transaction History & Audit Log</span>
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  Audited list of recently billed transactions • Delete incorrect entries anytime
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-slate-300">
                Total Records: <strong className="text-white font-mono">{categoryTransactions.length}</strong>
              </span>
            </div>
          </div>

          {/* Search bar inside History */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search history by member name, BD No, or description..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-inner"
            />
            {historySearch && (
              <button
                type="button"
                onClick={() => setHistorySearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-2xl">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-black border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Description / Purpose</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredHistoryTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500 font-bold">
                      {historySearch ? 'No matching records found' : 'No transaction records found for this category'}
                    </td>
                  </tr>
                ) : (
                  filteredHistoryTransactions.map((tx, idx) => (
                    <tr key={tx.id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {tx.date || tx.created_at?.split('T')[0] || '-'}
                        {tx.monthKey && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                            {tx.monthKey}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-white">
                          {tx.memberName || tx.name || `BD/${tx.bdNo}`}
                        </span>
                        {tx.bdNo && (
                          <span className="ml-1.5 text-[10px] font-mono text-slate-400">
                            #{tx.bdNo}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-indigo-300 font-bold text-xs inline-block">
                          {tx.items || tx.note || (isUnitFund ? 'Unit Fund' : 'Others Bill')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-emerald-400 text-sm">
                        ৳{Number(tx.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setTxToDelete(tx)}
                          className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                          title="Delete this transaction record"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
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
    </div>
  );
};

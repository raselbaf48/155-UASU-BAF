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
  List
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl, getCanteenConfig } from '../utils/canteenSettings';
import { processGalleryImage } from '../utils/imageUpload';
import { formatCanteenDate } from '../utils/dateUtils';
import { SaveButton } from '../components/SaveButton';

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

export const MemberDB: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<BillCategory>('ALL');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [onlyWithBill, setOnlyWithBill] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'BOX' | 'TABLE'>('BOX');

  const [allTxs, setAllTxs] = useState<any[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('canteen_txs') || '[]');
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
  const [editMemberData, setEditMemberData] = useState({ bdNo: '', rank: '', surname: '', contact: '', dp: '', role: 'Member' });
  const [profileTx, setProfileTx] = useState<any[]>([]);

  // Statement Modal state
  const [statementMember, setStatementMember] = useState<any | null>(null);
  const [statementTx, setStatementTx] = useState<any[]>([]);
  const [statementCategory, setStatementCategory] = useState<BillCategory>('ALL');
  const [statementMonth, setStatementMonth] = useState<string>('ALL');

  // Pay Bill Modal state
  const [payBillMember, setPayBillMember] = useState<any | null>(null);
  const [payBillCategory, setPayBillCategory] = useState<'ALL' | 'CANTEEN' | 'UNIT_FUND' | 'OTHERS'>('ALL');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'UCB'>('CASH');

  // Deletion modals
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [txDeleteConfirmId, setTxDeleteConfirmId] = useState<any | null>(null);

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
      if (availableMonths.length > 0) setSelectedMonth(availableMonths[0]);
      return;
    }
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx !== -1 && idx < availableMonths.length - 1) {
      setSelectedMonth(availableMonths[idx + 1]);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 'ALL') return;
    const idx = availableMonths.indexOf(selectedMonth);
    if (idx > 0) {
      setSelectedMonth(availableMonths[idx - 1]);
    } else if (idx === 0) {
      setSelectedMonth('ALL');
    }
  };

  // Calculate bill for a member given selected category and month
  const getMemberFilteredBill = (member: any, category: BillCategory, month: string) => {
    const memberTxs = allTxs.filter(
      (tx) => tx.airman_id === member.airman_id || (member['BD No'] && tx.bdNo === member['BD No'])
    );

    if (category === 'ALL' && month === 'ALL') {
      return Number(member.Due ?? member.due ?? member.baki ?? 0);
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
    setStatementCategory(selectedCategory);
    setStatementMonth(selectedMonth);
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
      dp: effDp || member['DP'] || ''
    });
    try {
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const memberTxs = txs.filter((tx: any) => tx.airman_id === member.airman_id);
      setProfileTx(memberTxs);
    } catch (e) {
      setProfileTx([]);
    }
  };

  // Build Statement rows matching: ক্রমিক নং, তারিখ, বিবরণ, পরিমাণ, দর, মোট
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
          const rate = qty > 0 ? Math.round((total / qty) * 100) / 100 : total;
          rows.push({
            sl: sl++,
            date: txDate,
            item: itemName,
            qty: qty,
            rate: rate,
            total: total
          });
        } else {
          const total = Number(tx.amount || 0);
          rows.push({
            sl: sl++,
            date: txDate,
            item: parts[0],
            qty: 1,
            rate: total,
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
    rows: StatementRow[], 
    totalDue: number, 
    totalExpenses: number, 
    monthKey: string = 'ALL',
    categoryKey: BillCategory = 'ALL'
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
    const catName = categoryKey === 'CANTEEN' 
      ? 'ক্যান্টিন বিল' 
      : categoryKey === 'UNIT_FUND' 
      ? 'ইউনিট ফান্ড বিল' 
      : categoryKey === 'OTHERS' 
      ? 'অন্যান্য বিল' 
      : 'সর্বমোট বিল';

    let rowsList = '';
    if (rows.length === 0) {
      rowsList = 'কোনো রেকর্ড পাওয়া যায়নি।\n';
    } else {
      rowsList = rows.map(r => 
        `${r.sl}. ${r.date} | ${r.item} | পরিমাণ: ${r.qty} | দর: ৳${r.rate} | মোট: ৳${r.total}`
      ).join('\n');
    }

    const message = 
`🍽️ *CAFE UAV - ${catName} বিবরণী*
📅 *মাসের নাম:* ${monthTitle}
👤 *পদবী ও নাম:* ${rank} ${surname}

━━━━━━━━━━━━━━━━━━━━━
*ক্রমিক নং | তারিখ | বিবরণ | পরিমাণ | দর | মোট*
━━━━━━━━━━━━━━━━━━━━━
${rowsList}
━━━━━━━━━━━━━━━━━━━━━
💰 *${catName}:* ৳${totalExpenses}
💳 *সর্বমোট প্রদেয় (DUE):* ৳${totalDue}

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
    const targetMember = profileMember || statementMember;
    if (!targetMember) return;

    const amountToReverse = txToRemove.amount || 0;
    const currentDue = Number(targetMember.Due ?? targetMember.due ?? targetMember.baki ?? 0);
    let newDue = currentDue;
    
    if (txToRemove.type === 'BILL PAYMENT') {
      newDue = currentDue + amountToReverse;
    } else {
      newDue = Math.max(0, currentDue - amountToReverse);
    }
    
    await supabase.from('Canteen_Member').update({ Due: newDue }).eq('airman_id', targetMember.airman_id);
    
    if (txToRemove.type !== 'BILL PAYMENT' && txToRemove.items) {
      const parts = txToRemove.items.split(',');
      for (const part of parts) {
        const match = part.trim().match(/(.+?)\s*\((\d+)\)$/);
        if (match) {
          const itemName = match[1].trim();
          const qty = parseInt(match[2], 10);
          try {
            await supabase.from('Canteen_Menu').select('*').eq('name', itemName).single();
          } catch {}
        }
      }
    }

    const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    const newTxs = txs.filter((t: any) => t.id !== txToRemove.id);
    localStorage.setItem('canteen_txs', JSON.stringify(newTxs));
    
    const updatedMember = { ...targetMember, Due: newDue, baki: newDue };
    setMembers(prev => prev.map(m => m.airman_id === updatedMember.airman_id ? updatedMember : m));
    
    if (profileMember) {
      setProfileMember(updatedMember);
      setProfileTx(prev => prev.filter(t => t.id !== txToRemove.id));
    }
    if (statementMember) {
      setStatementMember(updatedMember);
      setStatementTx(prev => prev.filter(t => t.id !== txToRemove.id));
    }

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

    // Sort by military Rank Seniority & BD Number
    formatted.sort((a, b) => {
      const weightA = getRankSeniorityWeight(a.Rank);
      const weightB = getRankSeniorityWeight(b.Rank);
      if (weightA !== weightB) return weightA - weightB;

      const bdA = parseInt(String(a['BD No'] || '').replace(/\D/g, ''), 10) || 9999999;
      const bdB = parseInt(String(b['BD No'] || '').replace(/\D/g, ''), 10) || 9999999;
      return bdA - bdB;
    });

    return formatted;
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

    const updatePayload = {
      "BD No": editMemberData.bdNo.trim(),
      "Rank": editMemberData.rank.trim(),
      "Surname": editMemberData.surname.trim(),
      "Contact": editMemberData.contact?.trim() || '',
      "Role": editMemberData.role || 'Member',
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
        role: editMemberData.role || 'Member',
        Role: editMemberData.role || 'Member',
        DP: finalDp 
      };
      setProfileMember(updated);
      setMembers(prev => prev.map(m => (m.airman_id === profileMember.airman_id || m['BD No'] === editMemberData.bdNo) ? updated : m));
      
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
        role: editMemberData.role || 'Member',
        Role: editMemberData.role || 'Member',
        DP: finalDp 
      };
      setProfileMember(updated);
      setMembers(prev => prev.map(m => (m.airman_id === profileMember.airman_id || m['BD No'] === editMemberData.bdNo) ? updated : m));
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
    if (!onlyWithBill) return filteredMembers;
    return filteredMembers.filter((m) => {
      const b = getMemberFilteredBill(m, selectedCategory, selectedMonth);
      return b > 0;
    });
  }, [filteredMembers, onlyWithBill, selectedCategory, selectedMonth, allTxs]);

  const resolvedEditDp = resolveImageUrl(editMemberData.dp);

  // Statement rows calculation for Statement modal
  const filteredStatementTxs = statementTx.filter((tx) => {
    const cat = getTxCategory(tx);
    const catMatch = statementCategory === 'ALL' || cat === statementCategory;
    const txMonth = getTxMonthKey(tx.date);
    const monthMatch = statementMonth === 'ALL' || txMonth === statementMonth;
    return catMatch && monthMatch;
  });

  const statementRows = parseStatementRows(filteredStatementTxs);
  const totalStatementExpenses = statementRows.reduce((sum, r) => sum + (r.total > 0 ? r.total : 0), 0);

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

          {/* Month Selector Dropdown with Prev/Next Controls */}
          <div className="flex items-center space-x-2 self-start lg:self-auto w-full lg:w-auto">
            {/* Prev Month Button */}
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors cursor-pointer shrink-0"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative flex-1 lg:w-56">
              <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 pointer-events-none" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 hover:border-slate-600 text-white rounded-xl pl-10 pr-8 py-2 text-xs font-black font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none"
              >
                <option value="ALL">All Months</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthName(m)}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                ▼
              </div>
            </div>

            {/* Next Month Button */}
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={selectedMonth === 'ALL'}
              className={`p-2 rounded-xl border border-slate-700 transition-colors shrink-0 ${
                selectedMonth === 'ALL'
                  ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer'
              }`}
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {(selectedCategory !== 'ALL' || selectedMonth !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('ALL');
                  setSelectedMonth('ALL');
                  setOnlyWithBill(false);
                }}
                className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 border border-slate-700"
                title="Reset Filters"
              >
                Reset
              </button>
            )}
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

        {/* View Mode Toggle: Box vs Table */}
        <div className="flex items-center bg-slate-900 rounded-2xl p-1 border border-slate-800 self-end sm:self-auto shrink-0 shadow-sm">
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
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase mb-0.5">{billLabel}</p>
                    <p className={`text-2xl font-black font-mono tracking-tighter leading-none ${displayedBill === 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                      ৳{displayedBill}
                    </p>
                    {(selectedCategory !== 'ALL' || selectedMonth !== 'ALL') && (
                      <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                        Total Due: ৳{totalDue}
                      </span>
                    )}
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
                  {(selectedCategory !== 'ALL' || selectedMonth !== 'ALL') && (
                    <th className="px-4 py-3.5 text-right font-mono">Total Due</th>
                  )}
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
                      {(selectedCategory !== 'ALL' || selectedMonth !== 'ALL') && (
                        <td className="px-4 py-3 text-right font-mono text-slate-400 text-xs font-bold">
                          ৳{totalDue}
                        </td>
                      )}
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
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Transaction History</h3>
                    
                    <div className="bg-slate-800/80 rounded-2xl overflow-hidden border border-slate-700">
                      <table className="w-full text-left text-xs text-slate-300">
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
                          {profileTx.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-bold">No transactions found</td>
                            </tr>
                          ) : (
                            profileTx.map((tx, idx) => {
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
                                <tr key={tx.id} className="border-b border-slate-700/50 last:border-0 hover:bg-slate-700/20">
                                  <td className="px-4 py-2.5 font-mono">{idx + 1}</td>
                                  <td className="px-4 py-2.5 font-mono">{toEnglishDate(tx.date)}</td>
                                  <td className="px-4 py-2.5 font-bold">{descText}</td>
                                  <td className="px-4 py-2.5 text-center font-bold">{qtyText}</td>
                                  <td className="px-4 py-2.5 text-right font-black text-rose-400">৳{tx.amount}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    <button 
                                      onClick={() => setTxDeleteConfirmId(tx)} 
                                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors" 
                                      title="Remove Record"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
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
                  <p className="text-[11px] font-bold text-slate-400 font-mono">Monthly Statement • সেপ্টেম্বর ২০২৫</p>
                </div>
              </div>

              {/* Action Buttons: WhatsApp Send, Print Bill, Close */}
              <div className="flex items-center space-x-2.5">
                {/* Send via WhatsApp Button */}
                <button 
                  onClick={() => handleSendWhatsApp(statementMember, statementRows, Number(statementMember.Due ?? 0), totalStatementExpenses, statementMonth, statementCategory)}
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
                  className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors ml-1"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Category & Month Filter Bar (Hidden when printing) */}
            <div className="px-5 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 print:hidden">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setStatementCategory('CANTEEN')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1 ${
                    statementCategory === 'CANTEEN'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  <Coffee className="w-3 h-3 text-amber-400" />
                  <span>Canteen Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementCategory('UNIT_FUND')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1 ${
                    statementCategory === 'UNIT_FUND'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  <Landmark className="w-3 h-3 text-indigo-400" />
                  <span>Unit Fund Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementCategory('OTHERS')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1 ${
                    statementCategory === 'OTHERS'
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  <Layers className="w-3 h-3 text-cyan-400" />
                  <span>Others Bill</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatementCategory('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase transition-all flex items-center space-x-1 ${
                    statementCategory === 'ALL'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  <Receipt className="w-3 h-3 text-slate-300" />
                  <span>All</span>
                </button>
              </div>

              {/* Month selector in statement modal */}
              <div className="flex items-center space-x-2">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <select
                  value={statementMonth}
                  onChange={(e) => setStatementMonth(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-white rounded-lg px-2.5 py-1 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">All Months</option>
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
                    {statementCategory === 'CANTEEN' 
                      ? 'মাসিক ক্যান্টিন বিল বিবরণী' 
                      : statementCategory === 'UNIT_FUND' 
                      ? 'ইউনিট ফান্ড বিল বিবরণী' 
                      : statementCategory === 'OTHERS' 
                      ? 'অন্যান্য বিল বিবরণী' 
                      : 'মাসিক সমন্বিত বিল বিবরণী'}
                  </p>
                </div>

                {/* Statement Paper Table */}
                <table className="w-full border-collapse border border-black text-xs font-bold text-black mb-6">
                  <tbody>
                    <tr>
                      <td className="border border-black p-2.5 text-left w-1/4 bg-slate-50 font-black">মাসের নাম</td>
                      <td className="border border-black p-2.5 text-left font-black" colSpan={5}>
                        {formatMonthName(statementMonth)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2.5 text-left bg-slate-50 font-black">বিল ক্যাটাগরি</td>
                      <td className="border border-black p-2.5 text-left font-bold" colSpan={5}>
                        {statementCategory === 'CANTEEN' 
                          ? 'Canteen Bill (ক্যান্টিন বিল)' 
                          : statementCategory === 'UNIT_FUND' 
                          ? 'Unit Fund Bill (ইউনিট ফান্ড বিল)' 
                          : statementCategory === 'OTHERS' 
                          ? 'Others Bill (অন্যান্য বিল)' 
                          : 'All Bills (সর্বমোট বিল)'}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2.5 text-left bg-slate-50 font-black">পদবী ও নাম</td>
                      {/* Statement er Namer Pase Bd No lagbe na */}
                      <td className="border border-black p-2.5 text-left font-black" colSpan={5}>
                        {statementMember['Rank']} {statementMember['Surname']}
                      </td>
                    </tr>
                    
                    {/* Heading Row: ক্রমিক নং, তারিখ, বিবরণ, পরিমাণ, দর, মোট */}
                    <tr className="bg-slate-100 text-center font-black">
                      <td className="border border-black p-2 w-14">ক্রমিক নং</td>
                      <td className="border border-black p-2 w-28">তারিখ</td>
                      <td className="border border-black p-2 text-left">বিবরণ</td>
                      <td className="border border-black p-2 w-16">পরিমাণ</td>
                      <td className="border border-black p-2 w-20 text-right">দর</td>
                      <td className="border border-black p-2 w-24 text-right">মোট</td>
                    </tr>

                    {statementRows.length === 0 ? (
                      <tr>
                        <td className="border border-black p-4 text-center font-normal" colSpan={6}>
                          কোনো ক্যান্টিন খরচ রেকর্ড নেই
                        </td>
                      </tr>
                    ) : (
                      statementRows.map(row => (
                        <tr key={row.sl} className="text-center">
                          <td className="border border-black p-2 font-mono">{row.sl}</td>
                          <td className="border border-black p-2 font-mono">{row.date}</td>
                          <td className="border border-black p-2 text-left font-semibold">{row.item}</td>
                          <td className="border border-black p-2 font-mono">{row.qty}</td>
                          <td className="border border-black p-2 text-right font-mono">
                            {row.rate !== '-' ? `৳${row.rate}` : '-'}
                          </td>
                          <td className="border border-black p-2 text-right font-mono font-black">
                            {row.total < 0 ? `-৳${Math.abs(row.total)}` : `৳${row.total}`}
                          </td>
                        </tr>
                      ))
                    )}

                    {/* Summary Rows */}
                    <tr>
                      <td className="border border-black p-2.5 text-right font-black bg-slate-50" colSpan={5}>
                        {statementCategory === 'CANTEEN' 
                          ? 'মোট ক্যান্টিন বিল' 
                          : statementCategory === 'UNIT_FUND' 
                          ? 'মোট ইউনিট ফান্ড বিল' 
                          : statementCategory === 'OTHERS' 
                          ? 'মোট অন্যান্য বিল' 
                          : 'মোট বিল'}
                      </td>
                      <td className="border border-black p-2.5 text-right font-black font-mono text-sm">
                        ৳{totalStatementExpenses}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2.5 text-right font-black bg-slate-100" colSpan={5}>
                        সর্বমোট প্রদেয় (DUE)
                      </td>
                      <td className="border border-black p-2.5 text-right font-black font-mono text-base text-rose-700 bg-slate-100">
                        ৳{statementMember.Due ?? statementMember.baki ?? '0.00'}
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
    </div>
  );
};

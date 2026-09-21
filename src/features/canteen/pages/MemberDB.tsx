import React, { useState, useEffect } from 'react';
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
  ArrowLeft 
} from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl } from '../utils/canteenSettings';
import { formatCanteenDate } from '../utils/dateUtils';

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
  item: string;
  qty: string | number;
  rate: string | number;
  total: number;
}

export const MemberDB: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Add Member Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMember, setNewMember] = useState({ bdNo: '', rank: '', surname: '', contact: '', dp: '' });
  const [resolvingDp, setResolvingDp] = useState(false);

  // Profile Modal state
  const [profileMember, setProfileMember] = useState<any | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editMemberData, setEditMemberData] = useState({ bdNo: '', rank: '', surname: '', contact: '', dp: '' });
  const [profileTx, setProfileTx] = useState<any[]>([]);

  // Statement Modal state
  const [statementMember, setStatementMember] = useState<any | null>(null);
  const [statementTx, setStatementTx] = useState<any[]>([]);

  // Pay Bill Modal state
  const [payBillMember, setPayBillMember] = useState<any | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'UCB'>('CASH');

  // Deletion modals
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [txDeleteConfirmId, setTxDeleteConfirmId] = useState<any | null>(null);

  const toEnglishDate = formatCanteenDate;

  // Direct Pay Bill opener with default amount equal to Total Due
  const openPayBill = (member: any) => {
    setPayBillMember(member);
    const totalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);
    setPayAmount(totalDue > 0 ? String(totalDue) : '');
    setPayMethod('CASH');
  };

  // Open Statement Modal
  const openStatement = (member: any) => {
    setStatementMember(member);
    try {
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const memberTxs = txs.filter((tx: any) => tx.airman_id === member.airman_id);
      setStatementTx(memberTxs);
    } catch (e) {
      setStatementTx([]);
    }
  };

  // Open Profile Modal
  const openProfile = (member: any) => {
    setProfileMember(member);
    setIsEditingProfile(false);
    setEditMemberData({
      bdNo: member['BD No'] || '',
      rank: member['Rank'] || '',
      surname: member['Surname'] || '',
      contact: member['Contact'] || '',
      dp: member['DP'] || ''
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
  const handleSendWhatsApp = (member: any, rows: StatementRow[], totalDue: number, totalExpenses: number) => {
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

    let rowsList = '';
    if (rows.length === 0) {
      rowsList = 'কোনো রেকর্ড পাওয়া যায়নি।\n';
    } else {
      rowsList = rows.map(r => 
        `${r.sl}. ${r.date} | ${r.item} | পরিমাণ: ${r.qty} | দর: ৳${r.rate} | মোট: ৳${r.total}`
      ).join('\n');
    }

    const message = 
`🍽️ *CAFE UAV - মাসিক ক্যান্টিন বিল বিবরণী*
📅 *মাসের নাম:* সেপ্টেম্বর ২০২৫
👤 *পদবী ও নাম:* ${rank} ${surname}

━━━━━━━━━━━━━━━━━━━━━
*ক্রমিক নং | তারিখ | বিবরণ | পরিমাণ | দর | মোট*
━━━━━━━━━━━━━━━━━━━━━
${rowsList}
━━━━━━━━━━━━━━━━━━━━━
💰 *মোট ক্যান্টিন বিল (খাবার):* ৳${totalExpenses}
💳 *সর্বমোট প্রদেয় (DUE):* ৳${totalDue}

(ক্যান্টিন বিল পরিশোধের জন্য ধন্যবাদ - CAFE UAV)`;

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
    
    const payeeName = [payBillMember.Rank || payBillMember.rank, payBillMember.Surname || payBillMember.surname || payBillMember.Name || payBillMember.name].filter(Boolean).join(' ') || payBillMember['BD No'] || payBillMember.airman_id;
    const tx = {
      id: 'tx-pay-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      date: formatCanteenDate(new Date()),
      airman_id: payBillMember.airman_id,
      bdNo: payBillMember['BD No'] || payBillMember.airman_id,
      memberName: payeeName,
      rank: payBillMember.Rank || payBillMember.rank || '',
      items: `BILL PAYMENT (${payMethod})`,
      amount: amount,
      type: 'BILL PAYMENT',
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

  // Auto-sync Biodata silently in background
  const autoSyncBiodata = async () => {
    try {
      const { data: biodata } = await supabase.from('Biodata Register').select('*');
      if (biodata && biodata.length > 0) {
        const { data: existingCanteen } = await supabase.from('Canteen_Member').select('airman_id, Due, DP');
        const existingDueMap = new Map();
        const existingDpMap = new Map();
        if (existingCanteen) {
          existingCanteen.forEach((m: any) => {
            existingDueMap.set(m.airman_id, Number(m.Due ?? m.due ?? m.baki ?? 0));
            existingDpMap.set(m.airman_id, m.DP || null);
          });
        }

        const payload = biodata.filter((b: any) => b.airman_id).map((b: any) => ({
          airman_id: b.airman_id,
          "BD No": b['BD No'] || '',
          "Rank": b['Rank'] || '',
          "Surname": b['Surname'] || '',
          "Contact": b['Mobile No'] || '',
          Due: existingDueMap.has(b.airman_id) ? existingDueMap.get(b.airman_id) : 0,
          DP: existingDpMap.has(b.airman_id) ? existingDpMap.get(b.airman_id) : null
        }));

        await supabase.from('Canteen_Member').upsert(payload, { onConflict: 'airman_id' });
      }
    } catch (err) {
      console.warn('Auto-sync biodata silent note:', err);
    }
  };

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('Canteen_Member').select('*');
    if (!error && data) {
      const formatted = data.map((m: any) => ({
        ...m,
        Due: Number(m.Due ?? m.due ?? m.baki ?? 0),
        baki: Number(m.Due ?? m.due ?? m.baki ?? 0),
        DP: m.DP || ''
      }));

      // Sort by military Rank Seniority & BD Number
      formatted.sort((a, b) => {
        const weightA = getRankSeniorityWeight(a.Rank);
        const weightB = getRankSeniorityWeight(b.Rank);
        if (weightA !== weightB) return weightA - weightB;

        const bdA = parseInt(String(a['BD No'] || '').replace(/\D/g, ''), 10) || 9999999;
        const bdB = parseInt(String(b['BD No'] || '').replace(/\D/g, ''), 10) || 9999999;
        return bdA - bdB;
      });

      setMembers(formatted);
    } else {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      await autoSyncBiodata();
      await fetchMembers();
    };
    init();

    // Subscribe to realtime updates on Canteen table
    const channel = supabase
      .channel('canteen_members_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Canteen' }, () => {
        fetchMembers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAutoResolveMemberDp = async (url: string, isForEdit = false) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.includes('photos.app.goo.gl') || trimmed.includes('photos.google.com/share') || trimmed.includes('drive.google.com')) {
      setResolvingDp(true);
      try {
        const direct = await fetchDirectImageUrl(trimmed);
        if (direct && direct !== trimmed) {
          if (isForEdit) {
            setEditMemberData(prev => ({ ...prev, dp: direct }));
          } else {
            setNewMember(prev => ({ ...prev, dp: direct }));
          }
        }
      } catch (e) {
        console.warn('DP resolution failed:', e);
      } finally {
        setResolvingDp(false);
      }
    }
  };

  // Add new member
  const handleAddMember = async () => {
    if (!newMember.bdNo || !newMember.rank || !newMember.surname) return;
    
    let finalDp = (newMember.dp || '').trim();
    if (finalDp.includes('photos.app.goo.gl') || finalDp.includes('photos.google.com/share')) {
      setResolvingDp(true);
      finalDp = await fetchDirectImageUrl(finalDp);
      setResolvingDp(false);
    }

    const payload = {
      airman_id: `airman-${newMember.bdNo}`,
      "BD No": newMember.bdNo,
      "Rank": newMember.rank,
      "Surname": newMember.surname,
      "Contact": newMember.contact,
      DP: finalDp || null,
      Due: 0
    };

    const { error } = await supabase.from('Canteen_Member').insert([payload]);
    if (!error) {
      setShowAddModal(false);
      fetchMembers();
      setNewMember({ bdNo: '', rank: '', surname: '', contact: '', dp: '' });
    } else {
      alert("Error adding member: " + error.message);
    }
  };

  // Save edited member from Profile view
  const handleSaveProfileEdit = async () => {
    if (!profileMember) return;
    if (!editMemberData.bdNo || !editMemberData.rank || !editMemberData.surname) {
      alert("BD No, Rank and Name are required.");
      return;
    }

    let finalDp = (editMemberData.dp || '').trim();
    if (finalDp.includes('photos.app.goo.gl') || finalDp.includes('photos.google.com/share')) {
      setResolvingDp(true);
      finalDp = await fetchDirectImageUrl(finalDp);
      setResolvingDp(false);
    }

    const updatePayload = {
      "BD No": editMemberData.bdNo,
      "Rank": editMemberData.rank,
      "Surname": editMemberData.surname,
      "Contact": editMemberData.contact,
      DP: finalDp || null
    };

    const { error } = await supabase.from('Canteen_Member').update(updatePayload).eq('airman_id', profileMember.airman_id);
    if (!error) {
      const updated = { ...profileMember, ...updatePayload, DP: finalDp };
      setProfileMember(updated);
      setMembers(prev => prev.map(m => m.airman_id === profileMember.airman_id ? updated : m));
      setIsEditingProfile(false);
    } else {
      alert("Error updating member: " + error.message);
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
    (m['Surname'] || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resolvedAddDp = resolveImageUrl(newMember.dp);
  const resolvedEditDp = resolveImageUrl(editMemberData.dp);

  // Statement rows calculation for Statement modal
  const statementRows = parseStatementRows(statementTx);
  const totalStatementExpenses = statementRows.reduce((sum, r) => sum + (r.total > 0 ? r.total : 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">MEMBER DATABASE</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            AIRMEN CANTEEN ACCOUNTS • SORTED BY RANK SENIORITY
          </p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button 
            onClick={() => {
              setNewMember({ bdNo: '', rank: '', surname: '', contact: '', dp: '' });
              setShowAddModal(true);
            }} 
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-black tracking-widest uppercase transition-colors shadow-md shadow-indigo-500/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>ADD MEMBER</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          placeholder="Search members by BD No, Rank, or Surname..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400 font-bold animate-pulse">Loading members from Canteen database...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMembers.map((member, i) => {
            const memberDp = resolveImageUrl(member.DP);
            const totalDue = Number(member.Due ?? member.due ?? member.baki ?? 0);

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
                      <div className="flex items-center space-x-1.5 mb-1">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 border-t border-indigo-400/40 border-b-2 border-indigo-950 text-indigo-300 shadow-sm">
                          {member['Rank']}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 font-mono">
                          #{member['BD No']}
                        </span>
                      </div>
                      <h3 className="font-black text-white text-base leading-snug group-hover:text-indigo-300 transition-colors">
                        {member['Surname']}
                      </h3>
                    </div>
                  </div>

                  {/* Due amount */}
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 tracking-widest uppercase mb-0.5">TOTAL DUE</p>
                    <p className={`text-2xl font-black font-mono tracking-tighter leading-none ${totalDue === 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
                      ৳{totalDue}
                    </p>
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
                    <span className="truncate">PAY BILL {totalDue > 0 ? `(৳${totalDue})` : ''}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add New Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-xl border border-slate-800 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">ADD NEW MEMBER</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">BD No (ID)</label>
                <input 
                  type="text" 
                  value={newMember.bdNo}
                  onChange={(e) => setNewMember({...newMember, bdNo: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 102341"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Rank</label>
                <input 
                  type="text" 
                  value={newMember.rank}
                  onChange={(e) => setNewMember({...newMember, rank: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. LAC"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Name / Surname</label>
                <input 
                  type="text" 
                  value={newMember.surname}
                  onChange={(e) => setNewMember({...newMember, surname: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. Jahid"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Contact Number</label>
                <input 
                  type="text" 
                  value={newMember.contact}
                  onChange={(e) => setNewMember({...newMember, contact: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 017XXXXXXXX"
                />
              </div>

              {/* DP Field with auto Google Photos resolve */}
              <div>
                <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block flex items-center justify-between">
                  <span>Profile Photo URL / Google Photos</span>
                  {resolvingDp && <span className="text-indigo-400 flex items-center space-x-1 font-bold"><Loader2 className="w-3 h-3 animate-spin" /><span>Resolving...</span></span>}
                </label>
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {resolvedAddDp ? (
                      <img src={resolvedAddDp} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-slate-500" />
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={newMember.dp}
                    onChange={(e) => {
                      setNewMember({...newMember, dp: e.target.value});
                      handleAutoResolveMemberDp(e.target.value, false);
                    }}
                    onPaste={(e) => {
                      const pasted = e.clipboardData.getData('text');
                      handleAutoResolveMemberDp(pasted, false);
                    }}
                    className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Paste Google Photos share link or Direct image URL..."
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  💡 Google Photos-এর লিঙ্ক দিলে স্বয়ংক্রিয়ভাবে সরাসরি ছবিতে কনভার্ট হবে।
                </p>
              </div>
            </div>

            <button 
              onClick={handleAddMember}
              className="w-full mt-6 flex items-center justify-center space-x-2 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/30"
            >
              <Save className="w-4 h-4" />
              <span>SAVE TO DATABASE</span>
            </button>
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
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">BD No (ID)</label>
                    <input 
                      type="text" 
                      value={editMemberData.bdNo}
                      onChange={(e) => setEditMemberData({ ...editMemberData, bdNo: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Rank</label>
                      <input 
                        type="text" 
                        value={editMemberData.rank}
                        onChange={(e) => setEditMemberData({ ...editMemberData, rank: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Name / Surname</label>
                      <input 
                        type="text" 
                        value={editMemberData.surname}
                        onChange={(e) => setEditMemberData({ ...editMemberData, surname: e.target.value })}
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Contact Number</label>
                    <input 
                      type="text" 
                      value={editMemberData.contact}
                      onChange={(e) => setEditMemberData({ ...editMemberData, contact: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* DP URL Input (Displayed ONLY in Edit mode as requested) */}
                  <div className="pt-2 border-t border-slate-800/80">
                    <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block flex items-center justify-between">
                      <span>Profile Photo URL (Google Photos / Direct)</span>
                      {resolvingDp && <span className="text-indigo-400 flex items-center space-x-1 font-bold"><Loader2 className="w-3 h-3 animate-spin" /><span>Resolving...</span></span>}
                    </label>
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                        {resolvedEditDp ? (
                          <img src={resolvedEditDp} alt="Preview" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                      <input 
                        type="text" 
                        value={editMemberData.dp}
                        onChange={(e) => {
                          setEditMemberData({ ...editMemberData, dp: e.target.value });
                          handleAutoResolveMemberDp(e.target.value, true);
                        }}
                        onPaste={(e) => {
                          const pasted = e.clipboardData.getData('text');
                          handleAutoResolveMemberDp(pasted, true);
                        }}
                        className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Google Photos share link or Direct image link..."
                      />
                    </div>
                  </div>

                  {/* Save Changes Button */}
                  <button 
                    onClick={handleSaveProfileEdit}
                    className="w-full mt-4 flex items-center justify-center space-x-2 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-md shadow-indigo-500/20"
                  >
                    <Save className="w-4 h-4" />
                    <span>SAVE CHANGES</span>
                  </button>

                  {/* Remove Member Option at the bottom */}
                  <div className="pt-6 border-t border-rose-900/30 text-center">
                    <button 
                      type="button"
                      onClick={() => setDeleteConfirmId(profileMember.airman_id)}
                      className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center space-x-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>REMOVE MEMBER FROM DATABASE</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* VIEW MODE: Simple Member Info + History (NO Pay Bill, NO Statement, NO DP input) */
                <div className="space-y-6">
                  {/* Basic Member Info Cards (Without Pay Bill Button) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact Number</p>
                      <p className="text-base font-bold text-white font-mono">{profileMember['Contact'] || 'Not Provided'}</p>
                    </div>
                    <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                      <p className={`text-2xl font-black font-mono ${(profileMember.Due ?? profileMember.baki) === 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
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
                  onClick={() => handleSendWhatsApp(statementMember, statementRows, Number(statementMember.Due ?? 0), totalStatementExpenses)}
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

            {/* Statement Content Area */}
            <div className="p-6 overflow-y-auto bg-slate-950/40 flex-1 print:p-0 print:bg-white print:overflow-visible">
              <div className="bg-white rounded-2xl p-8 border border-slate-300 text-black max-w-3xl mx-auto shadow-sm">
                
                {/* Header Banner */}
                <div className="text-center mb-6 border-b-2 border-black pb-4">
                  <h2 className="text-2xl font-black text-black tracking-wider">🍽️ CAFE UAV 🍽️</h2>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">মাসিক ক্যান্টিন বিল বিবরণী</p>
                </div>

                {/* Statement Paper Table */}
                <table className="w-full border-collapse border border-black text-xs font-bold text-black mb-6">
                  <tbody>
                    <tr>
                      <td className="border border-black p-2.5 text-left w-1/4 bg-slate-50 font-black">মাসের নাম</td>
                      <td className="border border-black p-2.5 text-left font-black" colSpan={5}>সেপ্টেম্বর ২০২৫</td>
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
                        মোট ক্যান্টিন বিল (খাবার)
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
                  value={payAmount}
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

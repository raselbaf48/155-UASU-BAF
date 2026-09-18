import React, { useState, useEffect } from 'react';
import { Search, Plus, Download, Edit2, Trash2, FileText, UserPlus, Save, X, RefreshCw, Settings, MoreVertical, Printer, MessageCircle, Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../supabase';
import { resolveImageUrl, fetchDirectImageUrl } from '../utils/canteenSettings';

export const MemberDB: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newMember, setNewMember] = useState({ bdNo: '', rank: '', surname: '', contact: '', dp: '' });
  const [resolvingDp, setResolvingDp] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statementMember, setStatementMember] = useState<any | null>(null);
  const [showPayBillModal, setShowPayBillModal] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'CASH' | 'UCB'>('CASH');
  const [txDeleteConfirmId, setTxDeleteConfirmId] = useState<any | null>(null);
  const [statementTx, setStatementTx] = useState<any[]>([]);
  const [profileTab, setProfileTab] = useState<'profile' | 'history' | 'statement'>('profile');
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [quickDpInput, setQuickDpInput] = useState('');
  const [updatingQuickDp, setUpdatingQuickDp] = useState(false);

  const handleSettleAccount = async () => {
    if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) return;
    const amount = Number(payAmount);
    const currentDue = Number(statementMember.Due ?? statementMember.due ?? statementMember.baki ?? 0);
    const newDue = Math.max(0, currentDue - amount);
    
    // Update Supabase Canteen table 'Due' column
    await supabase.from('Canteen').update({ Due: newDue }).eq('airman_id', statementMember.airman_id);
    
    const tx = {
      id: Date.now() + Math.random(),
      date: new Date().toLocaleDateString('bn-BD'),
      airman_id: statementMember.airman_id,
      items: 'BILL PAYMENT',
      amount: amount,
      type: 'BILL PAYMENT',
      gateway: payMethod
    };
    const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    localStorage.setItem('canteen_txs', JSON.stringify([tx, ...txs]));
    
    setStatementMember({ ...statementMember, Due: newDue, baki: newDue });
    setMembers(prev => prev.map(m => m.airman_id === statementMember.airman_id ? { ...m, Due: newDue, baki: newDue } : m));
    
    try {
      const memberTxs = [tx, ...txs].filter((t: any) => t.airman_id === statementMember.airman_id);
      setStatementTx(memberTxs);
    } catch(e) {}
    
    setShowPayBillModal(false);
    setPayAmount('');
  };

  const handleRemoveTx = async (txToRemove: any) => {
    let amountToReverse = txToRemove.amount || 0;
    let currentDue = Number(statementMember.Due ?? statementMember.due ?? statementMember.baki ?? 0);
    let newDue = currentDue;
    
    if (txToRemove.type === 'BILL PAYMENT') {
      newDue = currentDue + amountToReverse;
    } else {
      newDue = Math.max(0, currentDue - amountToReverse);
    }
    
    // Update Supabase Canteen table 'Due' column
    await supabase.from('Canteen').update({ Due: newDue }).eq('airman_id', statementMember.airman_id);
    
    if (txToRemove.type !== 'BILL PAYMENT') {
      if (txToRemove.items) {
        const parts = txToRemove.items.split(',');
        for (const part of parts) {
          const match = part.trim().match(/(.+?)\s*\((\d+)\)$/);
          if (match) {
            const itemName = match[1].trim();
            const qty = parseInt(match[2], 10);
            const { data: invData } = await supabase.from('Canteen_Inventory').select('*').eq('name', itemName).single();
            if (invData) {
              await supabase.from('Canteen_Inventory').update({ stock: (invData.stock || 0) + qty }).eq('id', invData.id);
            }
          }
        }
      }
    }

    const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
    const newTxs = txs.filter((t: any) => t.id !== txToRemove.id);
    localStorage.setItem('canteen_txs', JSON.stringify(newTxs));
    
    setStatementMember({ ...statementMember, Due: newDue, baki: newDue });
    setMembers(prev => prev.map(m => m.airman_id === statementMember.airman_id ? { ...m, Due: newDue, baki: newDue } : m));
    setStatementTx(statementTx.filter((t: any) => t.id !== txToRemove.id));
    setTxDeleteConfirmId(null);
  };

  const openStatement = (member: any) => {
    setStatementMember(member);
    setQuickDpInput(member.DP || '');
    setShowSettingsDropdown(false);
    try {
      const txs = JSON.parse(localStorage.getItem('canteen_txs') || '[]');
      const memberTxs = txs.filter((tx: any) => tx.airman_id === member.airman_id);
      setStatementTx(memberTxs);
    } catch(e) {
      setStatementTx([]);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('Canteen').select('*');
    if (!error && data) {
      const formatted = data.map((m: any) => ({
        ...m,
        Due: Number(m.Due ?? m.due ?? m.baki ?? 0),
        baki: Number(m.Due ?? m.due ?? m.baki ?? 0),
        DP: m.DP || ''
      }));
      setMembers(formatted);
    } else {
      console.error(error);
    }
    setLoading(false);
  };

  const handleSyncBiodata = async () => {
    setIsSyncing(true);
    try {
      const { data: biodata, error: bioErr } = await supabase.from('Biodata Register').select('*');
      if (bioErr) throw bioErr;

      if (biodata && biodata.length > 0) {
        const { data: existingCanteen } = await supabase.from('Canteen').select('airman_id, Due, DP');
        const existingDueMap = new Map();
        const existingDpMap = new Map();
        if (existingCanteen) {
          existingCanteen.forEach((m: any) => {
            existingDueMap.set(m.airman_id, Number(m.Due ?? m.due ?? m.baki ?? 0));
            existingDpMap.set(m.airman_id, m.DP || '');
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

        const { error: upsertErr } = await supabase.from('Canteen').upsert(payload, { onConflict: 'airman_id' });
        if (upsertErr) throw upsertErr;
      }
      await fetchMembers();
      alert("Successfully synced members from Biodata Register!");
    } catch (err: any) {
      alert("Error syncing: " + err.message);
    }
    setIsSyncing(false);
  };

  const handleAutoResolveMemberDp = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.includes('photos.app.goo.gl') || trimmed.includes('photos.google.com/share') || trimmed.includes('drive.google.com')) {
      setResolvingDp(true);
      try {
        const direct = await fetchDirectImageUrl(trimmed);
        if (direct && direct !== trimmed) {
          setNewMember(prev => ({ ...prev, dp: direct }));
        }
      } catch (e) {
        console.warn('DP resolution failed:', e);
      } finally {
        setResolvingDp(false);
      }
    }
  };

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

    if (isEditMode && editingId) {
      const updatePayload = {
        "BD No": newMember.bdNo,
        "Rank": newMember.rank,
        "Surname": newMember.surname,
        "Contact": newMember.contact,
        DP: finalDp || null
      };
      const { error } = await supabase.from('Canteen').update(updatePayload).eq('airman_id', editingId);
      if (!error) {
        setShowAddModal(false);
        // Realtime update in state
        setMembers(prev => prev.map(m => m.airman_id === editingId ? { ...m, ...updatePayload, DP: finalDp } : m));
        if (statementMember && statementMember.airman_id === editingId) {
          setStatementMember({ ...statementMember, ...updatePayload, DP: finalDp });
        }
      } else {
        alert("Error updating member: " + error.message);
      }
    } else {
      const { error } = await supabase.from('Canteen').insert([payload]);
      if (!error) {
        setShowAddModal(false);
        fetchMembers();
      } else {
        alert("Error adding member: " + error.message);
      }
    }
    setNewMember({ bdNo: '', rank: '', surname: '', contact: '', dp: '' });
    setIsEditMode(false);
    setEditingId(null);
  };

  const handleEdit = (member: any) => {
    setIsEditMode(true);
    setEditingId(member.airman_id);
    setNewMember({
      bdNo: member['BD No'] || '',
      rank: member['Rank'] || '',
      surname: member['Surname'] || '',
      contact: member['Contact'] || '',
      dp: member['DP'] || ''
    });
    setShowAddModal(true);
  };

  const confirmDeleteMember = async (airman_id: string) => {
    const { error } = await supabase.from('Canteen').delete().eq('airman_id', airman_id);
    if (!error) {
      setMembers(members.filter(m => m.airman_id !== airman_id));
      if (statementMember && statementMember.airman_id === airman_id) {
        setStatementMember(null);
      }
    } else {
      alert("Error deleting member: " + error.message);
    }
    setDeleteConfirmId(null);
  };

  const handleUpdateQuickDp = async () => {
    if (!statementMember) return;
    setUpdatingQuickDp(true);
    let val = quickDpInput.trim();
    if (val.includes('photos.app.goo.gl') || val.includes('photos.google.com/share')) {
      val = await fetchDirectImageUrl(val);
      setQuickDpInput(val);
    }

    const { error } = await supabase.from('Canteen').update({ DP: val || null }).eq('airman_id', statementMember.airman_id);
    if (!error) {
      setStatementMember({ ...statementMember, DP: val });
      setMembers(prev => prev.map(m => m.airman_id === statementMember.airman_id ? { ...m, DP: val } : m));
    } else {
      alert("Failed to update DP: " + error.message);
    }
    setUpdatingQuickDp(false);
  };

  const filteredMembers = members.filter(m => 
    (m['BD No'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m['Rank'] || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m['Surname'] || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const resolvedFormDp = resolveImageUrl(newMember.dp);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter">MEMBER DATABASE</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AIRMEN CANTEEN ACCOUNTS & DUES</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button 
            onClick={handleSyncBiodata} 
            disabled={isSyncing}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black tracking-widest uppercase transition-colors border border-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'SYNCING...' : 'SYNC BIODATA'}</span>
          </button>
          <button 
            onClick={() => {
              setIsEditMode(false);
              setEditingId(null);
              setNewMember({ bdNo: '', rank: '', surname: '', contact: '', dp: '' });
              setShowAddModal(true);
            }} 
            className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-4 py-3 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl text-xs font-black tracking-widest uppercase transition-colors shadow-md shadow-indigo-500/20"
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
          placeholder="Search by BD No, Rank, or Surname..." 
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
            const totalDue = member.Due ?? member.due ?? member.baki ?? 0;

            return (
              <div 
                key={member.airman_id || i} 
                onClick={() => openStatement(member)} 
                className={`bg-slate-900 rounded-[2rem] p-6 border transition-all duration-300 cursor-pointer hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(79,70,229,0.3)] hover:border-indigo-500/50 group ${i === 0 ? 'border-[#4f46e5]' : 'border-slate-800'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-black text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300 overflow-hidden shrink-0 border border-slate-700/60">
                      {memberDp ? (
                        <img 
                          src={memberDp} 
                          alt={member['Surname']} 
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        (member['Surname'] || 'U').charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-white text-base leading-tight mt-0.5">
                        {member['Rank']} {member['Surname']}
                      </h3>
                      <p className="text-xs text-indigo-400 font-mono mt-0.5">
                        BD: {member['BD No']}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-0.5">TOTAL DUE</p>
                    <p className={`text-2xl font-black tracking-tighter leading-none ${totalDue === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      ৳{totalDue}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-xl border border-slate-800 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-tighter">{isEditMode ? "EDIT MEMBER" : "ADD NEW MEMBER"}</h3>
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
                  placeholder="e.g. NISHAD"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1 block">Contact No</label>
                <input 
                  type="text" 
                  value={newMember.contact}
                  onChange={(e) => setNewMember({...newMember, contact: e.target.value})}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 01700000000"
                />
              </div>

              {/* DP URL input with Google Photos auto-resolution and preview */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black text-slate-400 tracking-widest uppercase block">
                    PROFILE PHOTO URL (DP)
                  </label>
                  <span className="text-[9px] font-bold text-indigo-400">
                    {resolvingDp ? 'Resolving...' : 'Google Photos / Web'}
                  </span>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    value={newMember.dp}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewMember({ ...newMember, dp: val });
                      if (val.includes('photos.app.goo.gl') || val.includes('photos.google.com/share')) {
                        handleAutoResolveMemberDp(val);
                      }
                    }}
                    onBlur={() => handleAutoResolveMemberDp(newMember.dp)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-4 pr-12 py-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                    placeholder="https://... (Google Photos or Web link)"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                    {resolvingDp ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    ) : resolvedFormDp ? (
                      <img 
                        src={resolvedFormDp} 
                        alt="DP Preview" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </div>
                <p className="text-[9px] text-slate-400 mt-1">
                  💡 Google Photos-এর শেয়ার লিঙ্ক দিলে এটি নিজে থেকেই ডিরেক্ট ছবিতে কনভার্ট হবে।
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

      {/* Delete Member Confirm Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-800 animate-in zoom-in-95 text-center">
            <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Delete Member?</h3>
            <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to delete this member account from Canteen database?</p>
            
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

      {/* Statement Modal */}
      {statementMember && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-[2.5rem] w-full max-w-4xl shadow-2xl border border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/80">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border-2 border-indigo-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow">
                    {statementMember.DP ? (
                      <img 
                        src={resolveImageUrl(statementMember.DP)} 
                        alt={statementMember['Surname']} 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span className="font-black text-xl text-indigo-400">
                        {(statementMember['Surname'] || 'U').charAt(0)}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">{statementMember['Rank']} {statementMember['Surname']}</h2>
                    <p className="text-xs font-bold text-indigo-400 font-mono">BD No: {statementMember['BD No']}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 relative">
                  <div className="relative">
                    <button onClick={() => setShowSettingsDropdown(!showSettingsDropdown)} className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-xl transition-colors" title="Settings">
                      <Settings className="w-5 h-5" />
                    </button>
                    
                    {showSettingsDropdown && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95">
                        <button 
                          onClick={() => { handleEdit(statementMember); setStatementMember(null); setShowSettingsDropdown(false); }} 
                          className="w-full text-left px-4 py-3 flex items-center space-x-3 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border-b border-slate-700"
                        >
                          <Edit2 className="w-4 h-4" />
                          <span className="text-sm font-bold">Edit Member</span>
                        </button>
                        <button 
                          onClick={() => { setDeleteConfirmId(statementMember.airman_id); setStatementMember(null); setShowSettingsDropdown(false); }} 
                          className="w-full text-left px-4 py-3 flex items-center space-x-3 text-rose-400 hover:bg-rose-900/30 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span className="text-sm font-bold">Delete Member</span>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <button onClick={() => setStatementMember(null)} className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-colors ml-2" title="Close">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Tabs */}
              <div className="flex space-x-6 border-b border-slate-800">
                <button onClick={() => setProfileTab('profile')} className={`pb-3 text-xs font-black tracking-widest uppercase transition-colors ${profileTab === 'profile' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-300'}`}>Profile</button>
                <button onClick={() => setProfileTab('history')} className={`pb-3 text-xs font-black tracking-widest uppercase transition-colors ${profileTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-300'}`}>History</button>
                <button onClick={() => setProfileTab('statement')} className={`pb-3 text-xs font-black tracking-widest uppercase transition-colors ${profileTab === 'statement' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-400 hover:text-slate-300'}`}>Statement</button>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6 overflow-y-auto bg-slate-900/50 flex-1 print:p-0 print:bg-slate-900 print:overflow-visible">
              
              {/* Profile Tab */}
              {profileTab === 'profile' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* DP Management Card */}
                    <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700 space-y-3">
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-900 border-2 border-indigo-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow">
                          {statementMember.DP ? (
                            <img 
                              src={resolveImageUrl(statementMember.DP)} 
                              alt={statementMember['Surname']} 
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          ) : (
                            <span className="text-2xl font-black text-indigo-400">
                              {(statementMember['Surname'] || 'U').charAt(0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PROFILE PHOTO (DP)</p>
                          <h4 className="text-base font-black text-white">{statementMember['Rank']} {statementMember['Surname']}</h4>
                          <p className="text-xs text-indigo-400 font-mono">BD: {statementMember['BD No']}</p>
                        </div>
                      </div>

                      {/* Quick DP URL update */}
                      <div className="pt-2 border-t border-slate-700/60 space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 block">
                          Google Photos / Web URL for DP:
                        </label>
                        <div className="flex space-x-2">
                          <input 
                            type="text"
                            placeholder="Paste Google Photos or Web image link..."
                            value={quickDpInput}
                            onChange={(e) => setQuickDpInput(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
                          />
                          <button
                            type="button"
                            onClick={handleUpdateQuickDp}
                            disabled={updatingQuickDp}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors shrink-0 disabled:opacity-50 flex items-center space-x-1"
                          >
                            {updatingQuickDp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            <span>UPDATE DP</span>
                          </button>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-tight">
                          ✨ URL প্রদান করলে এটি স্বয়ংক্রিয়ভাবে ক্লাউডে এবং রিয়েল-টাইমে আপডেট হবে।
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact</p>
                        <p className="text-sm font-bold text-white">{statementMember['Contact'] || 'N/A'}</p>
                      </div>
                      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                          <p className={`text-2xl font-black ${(statementMember.Due ?? statementMember.baki) === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            ৳{statementMember.Due ?? statementMember.baki ?? 0}
                          </p>
                        </div>
                        <button onClick={() => setShowPayBillModal(true)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black tracking-widest transition-colors shadow-md shadow-emerald-500/20">
                          PAY BILL
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {profileTab === 'history' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Transaction History</h3>
                    <button onClick={() => setProfileTab('statement')} className="flex items-center space-x-2 px-3 py-1.5 bg-indigo-900/30 text-indigo-400 hover:bg-indigo-900/50 rounded-lg text-[10px] font-black tracking-widest uppercase transition-colors shadow-sm">
                      <Printer className="w-3 h-3" />
                      <span>Statement</span>
                    </button>
                  </div>
                  
                  <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-700">
                        <tr>
                          <th className="px-4 py-3">Ser No</th>
                          <th className="px-4 py-3">Date</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3 text-center">Qty</th>
                          <th className="px-4 py-3 text-right">Amount</th>
                          <th className="px-4 py-3 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statementTx.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400 font-bold">No history found</td>
                          </tr>
                        ) : (
                          statementTx.map((tx, idx) => {
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
                                <td className="px-4 py-3 font-mono">{idx + 1}</td>
                                <td className="px-4 py-3 font-mono">{tx.date}</td>
                                <td className="px-4 py-3 font-bold">{descText}</td>
                                <td className="px-4 py-3 text-center font-bold">{qtyText}</td>
                                <td className="px-4 py-3 text-right font-black text-rose-400">৳{tx.amount}</td>
                                <td className="px-4 py-3 text-center">
                                  <button onClick={() => setTxDeleteConfirmId(tx)} className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors" title="Remove Record">
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
              )}

              {/* Statement Tab */}
              {profileTab === 'statement' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest">Monthly Statement Paper</h3>
                    <button onClick={() => window.print()} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black tracking-widest uppercase hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-500/20">
                      <Printer className="w-4 h-4" />
                      <span>PRINT BILL</span>
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl p-8 border border-slate-300 text-black max-w-2xl mx-auto shadow-sm">
                    <div className="text-center mb-6 border-b border-black pb-4">
                      <h2 className="text-2xl font-black text-black tracking-wider">🍽️ CAFE UAV 🍽️</h2>
                      <p className="text-xs font-bold text-slate-700 mt-0.5">মাসিক ক্যান্টিন বিল বিবরণী</p>
                    </div>

                    <table className="w-full border-collapse border border-black text-xs font-bold text-black text-center mb-6">
                      <tbody>
                        <tr>
                          <td className="border border-black p-2 text-left w-1/3">মাসের নাম</td>
                          <td className="border border-black p-2" colSpan={3}>চলতি মাস</td>
                        </tr>
                        <tr>
                          <td className="border border-black p-2 text-left">পদবী ও নাম</td>
                          <td className="border border-black p-2" colSpan={3}>{statementMember['Rank']} {statementMember['Surname']} ({statementMember['BD No']})</td>
                        </tr>
                        <tr className="bg-slate-100">
                          <td className="border border-black p-2">তারিখ</td>
                          <td className="border border-black p-2" colSpan={2}>বিবরণ</td>
                          <td className="border border-black p-2">টাকা</td>
                        </tr>
                        {statementTx.length === 0 ? (
                          <tr>
                            <td className="border border-black p-2 font-normal py-4" colSpan={4}>কোনো ক্যান্টিন খরচ রেকর্ড নেই</td>
                          </tr>
                        ) : (
                          statementTx.map(tx => (
                            <tr key={tx.id}>
                              <td className="border border-black p-2 font-mono">{tx.date}</td>
                              <td className="border border-black p-2" colSpan={2}>{tx.items}</td>
                              <td className="border border-black p-2 font-mono">৳{tx.amount}</td>
                            </tr>
                          ))
                        )}
                        <tr>
                          <td className="border border-black p-2 text-right" colSpan={3}>মোট ক্যান্টিন বিল (খাবার)</td>
                          <td className="border border-black p-2 font-mono">৳{statementTx.reduce((sum, tx) => sum + (tx.amount || 0), 0)}</td>
                        </tr>
                        <tr>
                          <td className="border border-black p-2 text-right font-black" colSpan={3}>সর্বমোট প্রদেয় (DUE)</td>
                          <td className="border border-black p-2 font-black text-sm font-mono">৳{statementMember.Due ?? statementMember.baki ?? '0.00'}</td>
                        </tr>
                      </tbody>
                    </table>

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
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pay Bill Modal */}
      {showPayBillModal && statementMember && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">SETTLE ACCOUNT</h3>
              <button onClick={() => setShowPayBillModal(false)} className="text-slate-400 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center mb-6">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Current Due Amount</p>
              <p className="text-3xl font-black text-rose-500 font-mono">
                ৳{statementMember.Due ?? statementMember.baki ?? 0}
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

      {/* Remove History Tx Confirm Modal */}
      {txDeleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
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

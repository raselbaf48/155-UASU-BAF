import React, { useState, useEffect } from 'react';
import { Search, Plus, Download, Edit2, Trash2, FileText, UserPlus, Save, X, RefreshCw, Settings, MoreVertical, Printer, MessageCircle } from 'lucide-react';
import { supabase } from '../../../supabase';

export const MemberDB: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newMember, setNewMember] = useState({ bdNo: '', rank: '', surname: '', contact: '' });
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

  
  const handleSettleAccount = async () => {
      if (!payAmount || isNaN(Number(payAmount)) || Number(payAmount) <= 0) return;
      const amount = Number(payAmount);
      const newDue = Math.max(0, (statementMember.baki || 0) - amount);
      
      await supabase.from('Canteen').update({ baki: newDue }).eq('airman_id', statementMember.airman_id);
      
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
      
      setStatementMember({...statementMember, baki: newDue});
      
      try {
          const memberTxs = [tx, ...txs].filter((t: any) => t.airman_id === statementMember.airman_id);
          setStatementTx(memberTxs);
      } catch(e) {}
      
      setShowPayBillModal(false);
      setPayAmount('');
      fetchMembers();
  };

  const handleRemoveTx = async (txToRemove: any) => {
      let amountToReverse = txToRemove.amount || 0;
      let newDue = statementMember.baki || 0;
      
      if (txToRemove.type === 'BILL PAYMENT') {
          newDue = newDue + amountToReverse;
      } else {
          newDue = Math.max(0, newDue - amountToReverse);
      }
      
      await supabase.from('Canteen').update({ baki: newDue }).eq('airman_id', statementMember.airman_id);
      
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
      
      setStatementMember({...statementMember, baki: newDue});
      setStatementTx(statementTx.filter((t: any) => t.id !== txToRemove.id));
      setTxDeleteConfirmId(null);
      fetchMembers();
  };

  const openStatement = (member: any) => {
      setStatementMember(member); setShowSettingsDropdown(false);
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
      setMembers(data);
    } else {
        console.error(error);
    }
    setLoading(false);
  };

  const handleSyncBiodata = async () => {
      setIsSyncing(true);
      try {
          // 1. Fetch from Biodata Register
          const { data: biodata, error: bioErr } = await supabase.from('Biodata Register').select('*');
          if (bioErr) throw bioErr;

          if (biodata && biodata.length > 0) {
              // Fetch existing canteen members to preserve baki
              const { data: existingCanteen } = await supabase.from('Canteen').select('airman_id, baki');
              const existingBakiMap = new Map();
              if (existingCanteen) {
                  existingCanteen.forEach(m => existingBakiMap.set(m.airman_id, m.baki));
              }

              // 2. Format for Canteen table (preserve existing baki)
              const payload = biodata.filter(b => b.airman_id).map((b: any) => ({
                  airman_id: b.airman_id,
                  "BD No": b['BD No'] || '',
                  "Rank": b['Rank'] || '',
                  "Surname": b['Surname'] || '',
                  "Contact": b['Mobile No'] || '',
                  baki: existingBakiMap.has(b.airman_id) ? existingBakiMap.get(b.airman_id) : 0
              }));

              // 3. Upsert into Canteen
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

  const handleAddMember = async () => {
    if (!newMember.bdNo || !newMember.rank || !newMember.surname) return;
    
    const payload = {
        airman_id: `airman-${newMember.bdNo}`,
        "BD No": newMember.bdNo,
        "Rank": newMember.rank,
        "Surname": newMember.surname,
        "Contact": newMember.contact,
        baki: 0
    };

    if (isEditMode && editingId) {
        // preserve baki, only update text fields
        const updatePayload = {
            "BD No": newMember.bdNo,
            "Rank": newMember.rank,
            "Surname": newMember.surname,
            "Contact": newMember.contact
        };
        const { error } = await supabase.from('Canteen').update(updatePayload).eq('airman_id', editingId);
        if (!error) {
            setShowAddModal(false);
            fetchMembers();
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
    setNewMember({ bdNo: '', rank: '', surname: '', contact: '' });
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
        contact: member['Contact'] || ''
    });
    setShowAddModal(true);
  };

  const confirmDelete = async (id: string) => {
      const { error } = await supabase.from('Canteen').delete().eq('airman_id', id);
      if(!error) {
          fetchMembers();
      }
      setDeleteConfirmId(null);
  };

  const rankOrder: Record<string, number> = {
      'MW': 1, 'SWO': 2, 'WO': 3,
      'SGT': 4, 'CPL': 5, 'LAC': 6, 'AC': 7
  };

  const sortedMembers = [...members].sort((a, b) => {
      const rA = (a['Rank'] || '').toUpperCase();
      const rB = (b['Rank'] || '').toUpperCase();
      const oA = rankOrder[rA] || 99;
      const oB = rankOrder[rB] || 99;
      return oA - oB;
  });

  const filteredMembers = sortedMembers.filter(m => {
      const name = m['Surname'] || '';
      const bd = m['BD No'] || '';
      return name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             bd.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300 pb-10">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
         <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">MEMBER DATABASE</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IDENTITY MANAGEMENT NODE</p>
         </div>
         <div className="flex items-center space-x-3">
            <button 
               onClick={handleSyncBiodata}
               disabled={isSyncing}
               className="flex items-center space-x-2 px-4 py-2 bg-emerald-900/30 text-emerald-600 rounded-xl text-xs font-bold tracking-widest hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
               <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
               <span>{isSyncing ? 'SYNCING...' : 'SYNC BIODATA'}</span>
            </button>
            <button onClick={() => setShowAddModal(true)} className="flex items-center space-x-2 px-4 py-2 bg-[#4f46e5] text-white rounded-xl text-xs font-bold tracking-widest hover:bg-[#4338ca] transition-colors shadow-md shadow-indigo-500/20">
               <UserPlus className="w-4 h-4" />
               <span>NEW MEMBER</span>
            </button>
         </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
         <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
         <input 
            type="text" 
            placeholder="Filter SID or Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
         />
      </div>

      {loading ? (
          <div className="text-center py-10 text-slate-400 font-bold animate-pulse">Loading members from Canteen table...</div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredMembers.map((member, i) => (
                <div key={member.airman_id || i} onClick={() => openStatement(member)} className={`bg-slate-900 rounded-[2rem] p-6 border transition-all duration-300 cursor-pointer hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(79,70,229,0.3)] hover:border-indigo-500/50 group ${i === 0 ? 'border-[#4f46e5]' : 'border-slate-800'}`}>
                   <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                         <div className="w-14 h-14 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-black text-2xl shadow-inner group-hover:scale-110 transition-transform duration-300">
                            {(member['Surname'] || 'U').charAt(0)}
                         </div>
                         <div>
                            <h3 className="font-black text-white text-base leading-tight mt-0.5">{member['Rank']} {member['Surname']}</h3>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-0.5">TOTAL DUE</p>
                         <p className={`text-2xl font-black tracking-tighter leading-none ${member.baki === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            ৳{member.baki || 0}
                         </p>
                      </div>
                   </div>
                </div>
             ))}
          </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95">
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
                        placeholder="e.g. AC-1"
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
               </div>

               <button 
                  onClick={handleAddMember}
                  className="w-full mt-8 flex items-center justify-center space-x-2 py-3.5 bg-indigo-600 text-white rounded-xl text-xs font-black tracking-widest hover:bg-indigo-700 transition-all shadow-md shadow-indigo-500/30"
               >
                  <Save className="w-4 h-4" />
                  <span>SAVE TO DATABASE</span>
               </button>
            </div>
         </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl animate-in zoom-in-95 text-center">
               <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
               </div>
               <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Delete Member?</h3>
               <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to delete this member? This action cannot be undone.</p>
               
               <div className="flex space-x-3">
                  <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-200 transition-colors">
                     CANCEL
                  </button>
                  <button onClick={() => confirmDelete(deleteConfirmId)} className="flex-1 py-3 bg-rose-900/300 text-white rounded-xl text-xs font-black tracking-widest hover:bg-rose-600 transition-colors shadow-md shadow-rose-500/30">
                     DELETE
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* Statement Modal */}
      {statementMember && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 rounded-[2rem] w-full max-w-2xl shadow-xl animate-in zoom-in-95 max-h-[90vh] flex flex-col overflow-hidden border border-slate-800 print:border-none print:shadow-none print:bg-white print:max-h-none print:max-w-none">
               
               {/* Modal Header (Hidden on print) */}
               <div className="p-6 border-b border-slate-800 flex flex-col print:hidden">
                  <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                          <div className="w-14 h-14 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-black text-2xl shadow-sm">
                              {(statementMember['Surname'] || 'U').charAt(0)}
                          </div>
                          <div>
                              <h2 className="text-xl font-black text-white">{statementMember['Rank']} {statementMember['Surname']}</h2>
                              <p className="text-xs font-bold text-indigo-400">BD No: {statementMember['BD No']}</p>
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
                      <button onClick={() => setProfileTab('profile')} className={`pb-3 text-xs font-black tracking-widest uppercase transition-colors ${profileTab === 'profile' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>Profile</button>
                      <button onClick={() => setProfileTab('history')} className={`pb-3 text-xs font-black tracking-widest uppercase transition-colors ${profileTab === 'history' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>History</button>
                      <button onClick={() => setProfileTab('statement')} className={`pb-3 text-xs font-black tracking-widest uppercase transition-colors ${profileTab === 'statement' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}>Statement</button>
                  </div>
               </div>

               {/* Content Area */}
               <div className="p-6 overflow-y-auto bg-slate-900/50 flex-1 print:p-0 print:bg-white print:overflow-visible">
                   
                   {/* Normal UI View (Hidden on print) */}
                   <div className="print:hidden">
                       {profileTab === 'profile' && (
                           <div className="space-y-6">
                               <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contact</p>
                                      <p className="text-sm font-bold text-white">{statementMember['Contact'] || 'N/A'}</p>
                                  </div>
                                  <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex justify-between items-center">
                                      <div>
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Due</p>
                                          <p className={`text-2xl font-black ${statementMember.baki === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>৳{statementMember.baki || 0}</p>
                                      </div>
                                      <button onClick={() => setShowPayBillModal(true)} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-black tracking-widest transition-colors shadow-md shadow-emerald-500/20">
                                          PAY BILL
                                      </button>
                                  </div>
                               </div>
                           </div>
                       )}
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
                                                   <td colSpan={4} className="px-4 py-8 text-center text-slate-500 font-bold">No history found</td>
                                               </tr>
                                           ) : (
                                               statementTx.map((tx, idx) => {
                                                   // Try to parse Qty from description if available, or just render "1" or total count.
                                                   // Usually tx.items looks like "Item A (2), Item B (1)"
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
                                                       <td className="px-4 py-3 font-medium">{idx + 1}</td>
                                                       <td className="px-4 py-3">{tx.date}</td>
                                                       <td className="px-4 py-3">{descText}</td>
                                                       <td className="px-4 py-3 text-center font-bold text-emerald-400">{qtyText}</td>
                                                       <td className="px-4 py-3 text-right font-black text-white">৳{tx.amount}</td>
                                                       <td className="px-4 py-3 text-center">
                                                           <button onClick={() => setTxDeleteConfirmId(tx)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-slate-800 rounded-lg transition-colors">
                                                               <Trash2 className="w-4 h-4" />
                                                           </button>
                                                       </td>
                                                   </tr>
                                               )})
                                           )}
                                       </tbody>
                                   </table>
                               </div>
                           </div>
                       )}
                       {profileTab === 'statement' && (
                           <div className="flex flex-col h-full space-y-4">
                               <div className="flex justify-end space-x-3">
                                   <button onClick={() => window.print()} className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-black tracking-widest uppercase hover:bg-indigo-500 transition-colors">
                                       <Printer className="w-4 h-4" />
                                       <span>Print PDF</span>
                                   </button>
                               </div>
                               <div className="bg-white p-6 rounded-xl text-black overflow-y-auto" style={{ maxHeight: '60vh' }}>
                                   {/* Re-use statement layout */}
                                   <div className="text-center mb-4 text-black">
                                       <h2 className="text-xl font-black text-black">🍽️ CAFE UAV 🍽️</h2>
                                       <p className="text-sm font-bold text-black border-b border-black inline-block px-2 pb-0.5 mt-1">মাসিক বিল বিবরণী</p>
                                   </div>
                                   <table className="w-full border-collapse border border-black text-xs font-bold text-black text-center mb-8">
                                       <tbody>
                                           <tr>
                                               <td className="border border-black p-2 text-left w-1/3">মাসের নাম</td>
                                               <td className="border border-black p-2" colSpan={3}>চলতি মাস</td>
                                           </tr>
                                           <tr>
                                               <td className="border border-black p-2 text-left">পদবী ও নাম</td>
                                               <td className="border border-black p-2" colSpan={3}>{statementMember['Rank']} {statementMember['Surname']} ({statementMember['BD No']})</td>
                                           </tr>
                                           <tr className="bg-gray-100">
                                               <td className="border border-black p-2">তারিখ</td>
                                               <td className="border border-black p-2" colSpan={2}>বিবরণ</td>
                                               <td className="border border-black p-2">টাকা</td>
                                           </tr>
                                           {statementTx.length === 0 ? (
                                               <tr>
                                                   <td className="border border-black p-2 font-normal py-4" colSpan={4}>এই মাসে কোনো ক্যান্টিন খরচ নেই</td>
                                               </tr>
                                           ) : (
                                               statementTx.map(tx => (
                                                   <tr key={tx.id}>
                                                       <td className="border border-black p-2">{tx.date}</td>
                                                       <td className="border border-black p-2" colSpan={2}>{tx.items}</td>
                                                       <td className="border border-black p-2">৳{tx.amount}</td>
                                                   </tr>
                                               ))
                                           )}
                                           <tr>
                                               <td className="border border-black p-2 text-right" colSpan={3}>মোট ক্যান্টিন বিল (খাবার)</td>
                                               <td className="border border-black p-2">৳{statementTx.reduce((sum, tx) => sum + (tx.amount || 0), 0)}</td>
                                           </tr>
                                           <tr>
                                               <td className="border border-black p-2 text-right" colSpan={3}>চলতি মাসের মোট (SUBTOTAL)</td>
                                               <td className="border border-black p-2">৳{statementTx.reduce((sum, tx) => sum + (tx.amount || 0), 0)}</td>
                                           </tr>
                                           <tr>
                                               <td className="border border-black p-2 text-right font-black" colSpan={3}>সর্বমোট প্রদেয়</td>
                                               <td className="border border-black p-2 font-black text-sm">৳{statementMember.baki || '0.00'}</td>
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

                   {/* Statement Paper (Only visible on print) */}
                   <div className="hidden print:block" id="statement-paper">
                       <div className="text-center mb-4 text-black">
                           <h2 className="text-xl font-black text-black">🍽️ CAFE UAV 🍽️</h2>
                           <p className="text-sm font-bold text-black border-b border-black inline-block px-2 pb-0.5 mt-1">মাসিক বিল বিবরণী</p>
                       </div>
                       
                       <table className="w-full border-collapse border border-black text-xs font-bold text-black text-center mb-8">
                           <tbody>
                               <tr>
                                   <td className="border border-black p-2 text-left w-1/3">মাসের নাম</td>
                                   <td className="border border-black p-2" colSpan={3}>চলতি মাস</td>
                               </tr>
                               <tr>
                                   <td className="border border-black p-2 text-left">পদবী ও নাম</td>
                                   <td className="border border-black p-2" colSpan={3}>{statementMember['Rank']} {statementMember['Surname']} ({statementMember['BD No']})</td>
                               </tr>
                               <tr className="bg-gray-100">
                                   <td className="border border-black p-2">তারিখ</td>
                                   <td className="border border-black p-2" colSpan={2}>বিবরণ</td>
                                   <td className="border border-black p-2">টাকা</td>
                               </tr>
                               
                               {statementTx.length === 0 ? (
                                   <tr>
                                       <td className="border border-black p-2 font-normal py-4" colSpan={4}>এই মাসে কোনো ক্যান্টিন খরচ নেই</td>
                                   </tr>
                               ) : (
                                   statementTx.map(tx => (
                                       <tr key={tx.id}>
                                           <td className="border border-black p-2">{tx.date}</td>
                                           <td className="border border-black p-2" colSpan={2}>{tx.items}</td>
                                           <td className="border border-black p-2">৳{tx.amount}</td>
                                       </tr>
                                   ))
                               )}
                               <tr>
                                   <td className="border border-black p-2 text-right" colSpan={3}>মোট ক্যান্টিন বিল (খাবার)</td>
                                   <td className="border border-black p-2">৳{statementTx.reduce((sum, tx) => sum + (tx.amount || 0), 0)}</td>
                               </tr>
                               <tr>
                                   <td className="border border-black p-2 text-right" colSpan={3}>চলতি মাসের মোট (SUBTOTAL)</td>
                                   <td className="border border-black p-2">৳{statementTx.reduce((sum, tx) => sum + (tx.amount || 0), 0)}</td>
                               </tr>
                               <tr>
                                   <td className="border border-black p-2 text-right font-black" colSpan={3}>সর্বমোট প্রদেয়</td>
                                   <td className="border border-black p-2 font-black text-sm">৳{statementMember.baki || '0.00'}</td>
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
            </div>
         </div>
      )}
    
      {/* Pay Bill Modal */}
      {showPayBillModal && statementMember && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
                  
                  <div className="flex items-center justify-between mb-8 relative z-10">
                      <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">RECORD PAYMENT</h2>
                      <button onClick={() => setShowPayBillModal(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-colors">
                          <X className="w-4 h-4" />
                      </button>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-center mb-6 relative z-10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">OUTSTANDING BALANCE</p>
                      <p className="text-4xl font-black text-rose-500 tracking-tighter">৳{statementMember.baki || 0}</p>
                  </div>
                  
                  <div className="mb-6 relative z-10">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">RECEIVED AMOUNT</p>
                      <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">৳</span>
                          <input 
                              type="number" 
                              value={payAmount}
                              onChange={(e) => setPayAmount(e.target.value)}
                              className="w-full bg-[#111827] text-white text-3xl font-black tracking-tighter py-5 pl-14 pr-6 rounded-3xl outline-none placeholder:text-slate-700 shadow-inner"
                              placeholder="0.00"
                          />
                      </div>
                  </div>
                  
                  <div className="flex space-x-2 p-1 bg-slate-50 rounded-2xl mb-8 border border-slate-100 relative z-10">
                      <button 
                          onClick={() => setPayMethod('CASH')}
                          className={`flex-1 py-3 text-xs font-black tracking-widest rounded-xl transition-all ${payMethod === 'CASH' ? 'bg-[#5b51ef] text-white shadow-md shadow-indigo-500/30' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                          CASH
                      </button>
                      <button 
                          onClick={() => setPayMethod('UCB')}
                          className={`flex-1 py-3 text-xs font-black tracking-widest rounded-xl transition-all ${payMethod === 'UCB' ? 'bg-[#5b51ef] text-white shadow-md shadow-indigo-500/30' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                          UCB
                      </button>
                  </div>
                  
                  <button onClick={handleSettleAccount} className="w-full py-5 bg-[#75cda6] hover:bg-[#63b993] text-white rounded-3xl text-sm font-black tracking-widest uppercase transition-colors shadow-lg shadow-emerald-500/20 relative z-10">
                      SETTLE ACCOUNT
                  </button>
              </div>
          </div>
      )}

      {/* Remove TX Confirm Modal */}
      {txDeleteConfirmId && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl border border-slate-800 animate-in zoom-in-95">
                  <div className="text-center">
                      <div className="w-16 h-16 bg-rose-900/30 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                          <Trash2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-2">Remove Record?</h3>
                      <p className="text-sm font-bold text-slate-400 mb-6">Are you sure you want to remove this history record? Member Due will be reversed.</p>
                      
                      <div className="flex space-x-3">
                          <button onClick={() => setTxDeleteConfirmId(null)} className="flex-1 py-3 bg-slate-800 text-slate-200 rounded-xl text-xs font-black tracking-widest hover:bg-slate-200 transition-colors">
                              CANCEL
                          </button>
                          <button onClick={() => handleRemoveTx(txDeleteConfirmId)} className="flex-1 py-3 bg-rose-900/30 text-white rounded-xl text-xs font-black tracking-widest hover:bg-rose-600 transition-colors shadow-md shadow-rose-500/30">
                              REMOVE
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
</div>
  );
};
const BanknoteIcon: React.FC<{className?: string}> = ({className}) => (
   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
);

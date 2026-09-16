import React, { useState, useEffect } from 'react';
import { Search, Plus, Download, Edit2, Trash2, FileText, UserPlus, Save, X, RefreshCw } from 'lucide-react';
import { supabase } from '../../../supabase';

export const MemberDB: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [newMember, setNewMember] = useState({ bdNo: '', rank: '', surname: '', contact: '' });

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

    const { error } = await supabase.from('Canteen').insert([payload]);
    if (!error) {
        setShowAddModal(false);
        setNewMember({ bdNo: '', rank: '', surname: '', contact: '' });
        fetchMembers();
    } else {
        alert("Error adding member: " + error.message);
    }
  };

  const filteredMembers = members.filter(m => {
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
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">MEMBER DATABASE</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IDENTITY MANAGEMENT NODE</p>
         </div>
         <div className="flex items-center space-x-3">
            <button 
               onClick={handleSyncBiodata}
               disabled={isSyncing}
               className="flex items-center space-x-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold tracking-widest hover:bg-emerald-100 transition-colors disabled:opacity-50"
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
            className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4f46e5]/20 focus:border-[#4f46e5] transition-all shadow-sm"
         />
      </div>

      {loading ? (
          <div className="text-center py-10 text-slate-500 font-bold animate-pulse">Loading members from Canteen table...</div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredMembers.map((member, i) => (
                <div key={member.airman_id || i} className={`bg-white rounded-[2rem] p-6 border-2 shadow-sm transition-all hover:shadow-md ${i === 0 ? 'border-[#4f46e5]' : 'border-transparent'}`}>
                   <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center space-x-4">
                         <div className="w-12 h-12 rounded-2xl bg-[#0f172a] text-white flex items-center justify-center font-black text-lg shadow-sm">
                            {(member['Surname'] || 'U').charAt(0)}
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-[#4f46e5] tracking-widest">ID #{member['BD No']}</p>
                            <h3 className="font-bold text-slate-800 text-sm leading-tight mt-0.5">{member['Rank']} {member['Surname']}</h3>
                            {member['Contact'] && (
                               <p className="text-[10px] font-bold text-slate-400 mt-0.5 tracking-wider">{member['Contact']}</p>
                            )}
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[8px] font-black text-slate-400 tracking-widest uppercase mb-0.5">TOTAL BAKI</p>
                         <p className={`text-xl font-black tracking-tighter leading-none ${member.baki === 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            ৳{member.baki || 0}
                         </p>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3 mb-6">
                      <button className="py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-xl text-[10px] font-black tracking-widest flex items-center justify-center space-x-1.5 transition-colors">
                         <Plus className="w-3 h-3" />
                         <span>ADD BAKI</span>
                      </button>
                      <button className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl text-[10px] font-black tracking-widest flex items-center justify-center space-x-1.5 transition-colors">
                         <BanknoteIcon className="w-3 h-3" />
                         <span>PAY BILL</span>
                      </button>
                   </div>

                   <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <button className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-50 text-indigo-500 rounded-lg text-[10px] font-black tracking-widest hover:bg-indigo-100 transition-colors">
                         <FileText className="w-3 h-3" />
                         <span>STATEMENT</span>
                      </button>
                      <div className="flex items-center space-x-2">
                         <button className="p-1.5 text-slate-400 hover:text-indigo-500 transition-colors">
                            <Edit2 className="w-4 h-4" />
                         </button>
                         <button className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                   </div>
                </div>
             ))}
          </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
         <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95">
               <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-slate-800">ADD NEW MEMBER</h3>
                  <button onClick={() => setShowAddModal(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
                     <X className="w-5 h-5" />
                  </button>
               </div>
               
               <div className="space-y-4">
                  <div>
                     <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">BD No (ID)</label>
                     <input 
                        type="text" 
                        value={newMember.bdNo}
                        onChange={(e) => setNewMember({...newMember, bdNo: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. 102341"
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Rank</label>
                     <input 
                        type="text" 
                        value={newMember.rank}
                        onChange={(e) => setNewMember({...newMember, rank: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. AC-1"
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Name / Surname</label>
                     <input 
                        type="text" 
                        value={newMember.surname}
                        onChange={(e) => setNewMember({...newMember, surname: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. NISHAD"
                     />
                  </div>
                  <div>
                     <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1 block">Contact No</label>
                     <input 
                        type="text" 
                        value={newMember.contact}
                        onChange={(e) => setNewMember({...newMember, contact: e.target.value})}
                        className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
    </div>
  );
};

const BanknoteIcon: React.FC<{className?: string}> = ({className}) => (
   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>
);

import React, { useState, useMemo, useEffect } from 'react';
import { Airman, DetailedUserLogin, UserLoginRole, UserLoginStatus } from '../types';
import { X, Search, Activity, ShieldCheck, UserCheck, ChevronLeft, Save, AlertCircle } from 'lucide-react';
import { getDetailedUsers, saveDetailedUsers } from '../utils/authSession';

interface UserLoginDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  nominalAirmen: Airman[];
  userSessionRole?: string;
}

export const UserLoginDetailModal: React.FC<UserLoginDetailModalProps> = ({
  isOpen,
  onClose,
  nominalAirmen,
  userSessionRole,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'USER' | 'ADMIN' | 'SUPER_ADMIN'>('ALL');
  const [detailedUsers, setDetailedUsers] = useState<DetailedUserLogin[]>(() => getDetailedUsers(nominalAirmen));
  
  
  useEffect(() => {
    const handleDetailedUsersChange = (e: any) => {
      setDetailedUsers(e.detail);
    };
    window.addEventListener('baf_detailed_users_changed', handleDetailedUsersChange);
    return () => window.removeEventListener('baf_detailed_users_changed', handleDetailedUsersChange);
  }, []);

  const isOwner = userSessionRole === 'OWNER';
  const isSuperAdmin = userSessionRole === 'SUPER_ADMIN' || userSessionRole === 'OWNER';

  // Single Add Admin Mode States
  const [isAddAdminMode, setIsAddAdminMode] = useState(false);
  const [addAdminBd, setAddAdminBd] = useState('');
  const [addAdminPass, setAddAdminPass] = useState('');
  const [addAdminFlight, setAddAdminFlight] = useState('ALL');
  const [addAdminSearch, setAddAdminSearch] = useState('');

  const mergedUsers = useMemo(() => {
    const list = nominalAirmen.map((airman, index) => {
      const cleanBd = airman.bdNo.trim().replace(/^BD\/?/i, '').replace(/\s+/g, '').toLowerCase();
      const detailed = detailedUsers.find(d => d.bdNo.toLowerCase() === cleanBd);
      
      const isDefaultOwner = cleanBd === '474455' || cleanBd === 'deleted_admin';
      const role = detailed ? detailed.role : (isDefaultOwner ? 'SUPER_ADMIN' : 'USER');
      const status = detailed ? detailed.status : 'ACTIVE';
      const password = detailed?.password || cleanBd;
      const adminPass = detailed?.adminPass || (isDefaultOwner ? '1124' : '');
      const ownerPass = detailed?.ownerPass || '';
      
      return {
        airman,
        cleanBd,
        serNo: index + 1,
        role,
        status,
        password,
        adminPass,
        ownerPass,
        detailed,
        isDefaultOwner
      };
    });

    // Add extra detailed users not in nominal roll
    let nextSerNo = list.length + 1;
    detailedUsers.forEach(d => {
      if (!list.some(u => u.cleanBd === d.bdNo.toLowerCase())) {
        const isDefaultOwner = d.bdNo === '474455' || d.bdNo === 'deleted_admin';
        list.push({
          airman: {
            id: d.airmanId || `extra-${d.bdNo}`,
            serNo: nextSerNo,
            code: d.bdNo,
            bdNo: d.bdNo,
            rank: d.rank || 'Civil',
            name: d.name || 'User',
            trade: d.trade || 'Admin',
            addressBlock: '',
            mobileNo: d.remarks || '',
            flightName: d.flightName || 'Admin',
            remarks: d.remarks || '',
            active: true
          },
          cleanBd: d.bdNo.toLowerCase(),
          serNo: nextSerNo++,
          role: d.role,
          status: d.status,
          password: d.password || d.bdNo,
          adminPass: d.adminPass || '',
          ownerPass: d.ownerPass || '',
          detailed: d,
          isDefaultOwner
        });
      }
    });
    return list;
  }, [nominalAirmen, detailedUsers]);

  const filteredUsers = mergedUsers.filter((u) => {
    // Normal admins cannot see super admins
    

    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      u.cleanBd.includes(query) ||
      u.airman.name.toLowerCase().includes(query) ||
      u.airman.rank.toLowerCase().includes(query)
    );
  });

  // For Add Admin specific filtering
  const candidateUsers = mergedUsers.filter(u => u.role === 'USER' && !u.isDefaultOwner);
  // Define standard flights
  const flightsForFilter = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
  const displayedCandidates = candidateUsers.filter(u => {
    const matchFlt = addAdminFlight === 'ALL' || u.airman.flightName === addAdminFlight;
    const searchLower = addAdminSearch.toLowerCase();
    const matchSearch = !addAdminSearch || 
                        u.airman.name.toLowerCase().includes(searchLower) || 
                        u.airman.rank.toLowerCase().includes(searchLower) ||
                        u.cleanBd.includes(searchLower);
    return matchFlt && matchSearch;
  });

  const [selectedUser, setSelectedUser] = useState<typeof mergedUsers[0] | null>(null);
  
  // Profile editing state
  const [editRole, setEditRole] = useState<UserLoginRole>('USER');
  const [editStatus, setEditStatus] = useState<UserLoginStatus>('ACTIVE');
  const [editPassword, setEditPassword] = useState('');
  const [editAdminPass, setEditAdminPass] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const openProfile = (user: typeof mergedUsers[0]) => {
    if (!isSuperAdmin) return;
    
    setSelectedUser(user);
    setEditRole(user.role);
    setEditStatus(user.status);
    setEditPassword(user.password);
    setEditAdminPass(user.adminPass);
    setErrorMsg('');
  };

  const closeProfile = () => {
    setSelectedUser(null);
    setErrorMsg('');
  };

  const handlePromote = (role: UserLoginRole) => {
    setEditRole(role);
    setErrorMsg('');
  };

  const handleDemote = () => {
    setEditRole('USER');
    setEditAdminPass('');
    setErrorMsg('');
  };

  const saveProfile = () => {
    if (!selectedUser) return;
    
    if ((editRole === 'ADMIN' || editRole === 'SUPER_ADMIN') && !editAdminPass.trim()) {
      setErrorMsg('Admin Passcode must be set to promote to Admin or Super Admin.');
      return;
    }

    const updatedDetailedUsers = [...detailedUsers];
    const existingIdx = updatedDetailedUsers.findIndex(d => d.bdNo.toLowerCase() === selectedUser.cleanBd);
    
    const newDetail: DetailedUserLogin = {
      id: selectedUser.detailed?.id || `detail-${selectedUser.cleanBd}-${Date.now()}`,
      airmanId: selectedUser.airman.id,
      bdNo: selectedUser.cleanBd,
      rank: selectedUser.airman.rank,
      name: selectedUser.airman.name,
      flightName: selectedUser.airman.flightName || 'Admin',
      trade: selectedUser.airman.trade || 'General',
      role: editRole,
      status: editStatus,
      password: editPassword,
      adminPass: editAdminPass,
      ownerPass: selectedUser.ownerPass,
      detailedAt: selectedUser.detailed?.detailedAt || new Date().toISOString(),
      detailedBy: selectedUser.detailed?.detailedBy || 'System',
    };

    if (existingIdx >= 0) {
      updatedDetailedUsers[existingIdx] = newDetail;
    } else {
      updatedDetailedUsers.push(newDetail);
    }
    
    saveDetailedUsers(updatedDetailedUsers);
    setDetailedUsers(updatedDetailedUsers);
    
    if (selectedUser.role !== editRole) {
      fetch('/api/system/log-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          airmanId: selectedUser.airman.id,
          airmanName: selectedUser.airman.name,
          description: `Promoted/Demoted ${selectedUser.airman.rank} ${selectedUser.airman.name} to ${editRole === 'SUPER_ADMIN' ? 'Super Admin' : editRole === 'ADMIN' ? 'Admin' : 'User'}`
        })
      }).catch(console.error);
    }
    closeProfile();
  };

  const handleAddAdminSubmit = () => {
    if (!addAdminBd) {
      setErrorMsg('Please select a user.');
      return;
    }
    if (!addAdminPass.trim()) {
      setErrorMsg('Please enter an admin passcode.');
      return;
    }
    
    const userSource = mergedUsers.find(u => u.cleanBd === addAdminBd);
    if (!userSource) return;

    let updatedDetailedUsers = [...detailedUsers];
    const existingIdx = updatedDetailedUsers.findIndex(d => d.bdNo.toLowerCase() === addAdminBd);
    
    if (existingIdx >= 0) {
      updatedDetailedUsers[existingIdx].role = 'ADMIN';
      updatedDetailedUsers[existingIdx].adminPass = addAdminPass;
    } else {
      updatedDetailedUsers.push({
        id: `detail-${addAdminBd}-${Date.now()}`,
        airmanId: userSource.airman.id,
        bdNo: addAdminBd,
        rank: userSource.airman.rank,
        name: userSource.airman.name,
        flightName: userSource.airman.flightName || 'Admin',
        trade: userSource.airman.trade || 'General',
        role: 'ADMIN',
        status: 'ACTIVE',
        password: userSource.password,
        adminPass: addAdminPass,
        ownerPass: '',
        detailedAt: new Date().toISOString(),
        detailedBy: 'Add Admin Shortcut',
      });
    }
    
    saveDetailedUsers(updatedDetailedUsers);
    setDetailedUsers(updatedDetailedUsers);
    
    fetch('/api/system/log-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        airmanId: userSource.airman.id,
        airmanName: userSource.airman.name,
        description: `Promoted/Demoted ${userSource.airman.rank} ${userSource.airman.name} to Admin`
      })
    }).catch(console.error);

    setIsAddAdminMode(false);
    setAddAdminBd('');
    setAddAdminPass('');
    setErrorMsg('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col h-full sm:h-auto sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center space-x-3">
            {selectedUser || isAddAdminMode ? (
              <button 
                onClick={() => { closeProfile(); setIsAddAdminMode(false); }} 
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-slate-700 dark:text-slate-200" />
              </button>
            ) : (
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <UserCheck className="w-6 h-6" />
              </div>
            )}
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                {selectedUser ? 'User Profile & Access' : isAddAdminMode ? 'Add New Admin' : 'User Management'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {selectedUser 
                  ? `BD/${selectedUser.cleanBd} - ${selectedUser.airman.rank} ${selectedUser.airman.name}` 
                  : isAddAdminMode 
                  ? 'Promote a single user to Admin' 
                  : 'Manage roles, passwords, and access for all nominal airmen'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isAddAdminMode ? (
          /* Add Single Admin View */
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50 flex flex-col items-center justify-center">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-xl space-y-6">
              
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select User</label>
                
                {/* Search & Filter */}
                <div className="flex space-x-2">
                  <select 
                     value={addAdminFlight} 
                     onChange={e => { setAddAdminFlight(e.target.value); setAddAdminBd(''); setErrorMsg(''); }}
                     className="w-1/4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-2 outline-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:border-emerald-500"
                  >
                     <option value="ALL">All Flt</option>
                     {flightsForFilter.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div className="relative w-3/4">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                     <input 
                        type="text" 
                        placeholder="Search name..."
                        value={addAdminSearch}
                        onChange={e => { setAddAdminSearch(e.target.value); setAddAdminBd(''); setErrorMsg(''); }}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-xs font-bold text-slate-700 dark:text-slate-300 focus:border-emerald-500"
                     />
                  </div>
                </div>

                {/* List Box */}
                <div className="h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900/50 p-2 space-y-1">
                  {displayedCandidates.length === 0 ? (
                    <div className="text-center text-slate-400 text-sm py-4">No users found</div>
                  ) : (
                    displayedCandidates.map(u => (
                      <button
                        key={u.cleanBd}
                        onClick={() => { setAddAdminBd(u.cleanBd); setErrorMsg(''); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-bold transition-colors ${addAdminBd === u.cleanBd ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                      >
                        {u.airman.rank} {u.airman.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin Passcode</label>
                <input
                  type="text"
                  value={addAdminPass}
                  onChange={(e) => { setAddAdminPass(e.target.value); setErrorMsg(''); }}
                  className="w-full bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 font-mono text-slate-900 dark:text-white"
                  placeholder="e.g. 1124"
                />
              </div>

              {errorMsg && (
                <div className="flex items-center space-x-2 text-rose-500 text-sm font-bold bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-900">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => { setIsAddAdminMode(false); setErrorMsg(''); setAddAdminBd(''); }}
                  className="px-6 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddAdminSubmit}
                  disabled={!addAdminBd || !addAdminPass.trim()}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold transition-colors shadow-sm"
                >
                  Admin
                </button>
              </div>
            </div>
          </div>
        ) : selectedUser ? (
          /* Profile View */
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
            <div className="max-w-2xl mx-auto space-y-6">
              
              {/* Profile Card */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center space-x-6">
                <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                  <UserCheck className="w-10 h-10 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {selectedUser.airman.rank} {selectedUser.airman.name}
                  </h3>
                  <div className="text-sm font-mono text-emerald-600 dark:text-emerald-400 mt-1">{selectedUser.cleanBd}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{selectedUser.airman.trade} • {selectedUser.airman.flightName}</div>
                </div>
              </div>

              {/* Activity History */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center space-x-2">
                  <Activity className="w-4 h-4" />
                  <span>Activity History</span>
                </h4>
                <div className="space-y-6">
                  <div className="relative pl-6 border-l-2 border-emerald-200 dark:border-emerald-900/50">
                    <div className="absolute w-3 h-3 bg-emerald-500 rounded-full -left-[7px] top-1 border-2 border-white dark:border-slate-800"></div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">Logged In</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">System Login</p>
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                      {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleString() : new Date().toLocaleString()}
                    </p>
                  </div>
                  <div className="relative pl-6 border-l-2 border-slate-200 dark:border-slate-700">
                    <div className="absolute w-3 h-3 bg-slate-400 rounded-full -left-[7px] top-1 border-2 border-white dark:border-slate-800"></div>
                    <p className="text-sm font-black text-slate-900 dark:text-white">System Access</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">Only View Dashboard</p>
                    <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                      {selectedUser.lastLoginAt ? new Date(new Date(selectedUser.lastLoginAt).getTime() + 60000).toLocaleString() : new Date(Date.now() + 60000).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Settings & Access */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
                <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Access Settings</span>
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">User Role</label>
                    <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl">
                      <button onClick={() => handlePromote('USER')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${editRole === 'USER' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>User</button>
                      <button onClick={() => handlePromote('ADMIN')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${editRole === 'ADMIN' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Admin</button>
                      {userSessionRole === 'OWNER' && (
                        <button onClick={() => handlePromote('SUPER_ADMIN')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${editRole === 'SUPER_ADMIN' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>Super Admin</button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Admin Passcode</label>
                    <input
                      type="text"
                      value={editAdminPass}
                      onChange={(e) => { setEditAdminPass(e.target.value); setErrorMsg(''); }}
                      placeholder="e.g. 1124"
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>

                {errorMsg && (
                  <div className="flex items-center space-x-2 text-rose-500 text-sm font-bold bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-900">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4">
                <button
                  onClick={closeProfile}
                  className="px-6 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 font-bold transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={saveProfile}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center space-x-2 transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Profile</span>
                </button>
              </div>

            </div>
          </div>
        ) : (
          /* List View */
          <>
            {/* Toolbar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col xl:flex-row items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by User ID, Rank, Name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-100 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 dark:text-slate-200"
                  />
                </div>
                
                {/* Role Filters */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto overflow-x-auto hide-scrollbar">
                  <button 
                    onClick={() => setRoleFilter('ALL')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${roleFilter === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    All Users
                  </button>
                  <button 
                    onClick={() => setRoleFilter('USER')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${roleFilter === 'USER' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Normal
                  </button>
                  <button 
                    onClick={() => setRoleFilter('ADMIN')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${roleFilter === 'ADMIN' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Admin
                  </button>
                  <button 
                    onClick={() => setRoleFilter('SUPER_ADMIN')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap ${roleFilter === 'SUPER_ADMIN' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Super Admin
                  </button>
                </div>
              </div>

              {/* Add Single Admin Button */}
              {isSuperAdmin && (
                <button
                  onClick={() => {
                    setIsAddAdminMode(true);
                    setAddAdminBd('');
                    setAddAdminPass('');
                    setAddAdminFlight('ALL');
                    setAddAdminSearch('');
                    setErrorMsg('');
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-colors shadow-sm whitespace-nowrap"
                >
                  + Add Admin
                </button>
              )}
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 relative">
              <table className="w-full text-center text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm z-10 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Sl</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">User ID</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Rank & Name</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs">Role</th>
                    <th className="px-4 py-3 font-bold text-slate-500 uppercase tracking-wider text-xs text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500">
                        No airmen found matching the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr 
                        key={user.cleanBd}
                        onClick={() => {
                          if (isSuperAdmin) openProfile(user);
                        }}
                        className={`transition-colors ${isSuperAdmin ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40' : ''}`}
                      >
                        <td className="px-4 py-3 font-mono text-slate-500">{user.serNo}</td>
                        <td className="px-4 py-3 font-mono font-black text-slate-900 dark:text-white">
                          {user.cleanBd}
                          {user.isDefaultOwner && <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 rounded text-[9px]">Sys Admin</span>}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                          {user.airman.rank} {user.airman.name}
                        </td>
                        
                        {/* ROLE */}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            (user.role === 'SUPER_ADMIN' || user.role === 'OWNER') ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-200 dark:border-amber-800' :
                            user.role === 'ADMIN' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' :
                            'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                          }`}>
                            {(user.role === 'SUPER_ADMIN' || user.role === 'OWNER') ? 'Super Admin' : user.role === 'ADMIN' ? 'Admin' : 'User'}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              user.status === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' :
                              user.status === 'SUSPENDED' ? 'text-amber-600 dark:text-amber-400' :
                              'text-rose-600 dark:text-rose-400'
                            }`}>
                              {user.status}
                            </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

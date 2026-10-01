import React, { useState, useEffect } from 'react';
import { 
  AirfieldShiftRoster, 
  DutyPost, 
  ShiftName 
} from '../types';
import { 
  getStoredAirfieldRoster, 
  saveStoredAirfieldRoster, 
  pullAirfieldRosterFromCloud, 
  calculateAirfieldStats 
} from '../utils/airfieldStorage';
import { AirfieldDashboardView } from './AirfieldDashboardView';
import { PostPersonnelView } from './PostPersonnelView';
import { FullRosterSheetView } from './FullRosterSheetView';
import { PostSettingsModal } from './PostSettingsModal';
import { 
  Plane, 
  Shield, 
  Users, 
  FileText, 
  ArrowLeft, 
  Menu, 
  X, 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  Cloud, 
  RefreshCw,
  LayoutDashboard,
  UserCheck,
  ChevronRight
} from 'lucide-react';

interface AirfieldLayoutProps {
  onBack: () => void;
}

export const AirfieldLayout: React.FC<AirfieldLayoutProps> = ({ onBack }) => {
  const [roster, setRoster] = useState<AirfieldShiftRoster>(() => getStoredAirfieldRoster());
  // 'dashboard' | 'sheet' | postId
  const [selectedView, setSelectedView] = useState<string>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);

  // Sync with cloud on initial mount
  useEffect(() => {
    setIsCloudSyncing(true);
    pullAirfieldRosterFromCloud()
      .then((cloudRoster) => {
        if (cloudRoster) {
          setRoster(cloudRoster);
        }
      })
      .finally(() => setIsCloudSyncing(false));

    const handleUpdate = (e: any) => {
      if (e.detail) setRoster(e.detail);
    };
    window.addEventListener('baf_airfield_roster_updated', handleUpdate);
    return () => window.removeEventListener('baf_airfield_roster_updated', handleUpdate);
  }, []);

  const handleUpdateRoster = (newRoster: AirfieldShiftRoster) => {
    setRoster(newRoster);
    saveStoredAirfieldRoster(newRoster);
  };

  const handleUpdatePost = (updatedPost: DutyPost) => {
    const updatedPosts = roster.posts.map((p) => (p.id === updatedPost.id ? updatedPost : p));
    const updatedRoster: AirfieldShiftRoster = {
      ...roster,
      posts: updatedPosts,
    };
    handleUpdateRoster(updatedRoster);
  };

  const handleDeletePost = (postId: string) => {
    const updatedPosts = roster.posts.filter((p) => p.id !== postId);
    const updatedRoster: AirfieldShiftRoster = {
      ...roster,
      posts: updatedPosts,
    };
    handleUpdateRoster(updatedRoster);
    if (selectedView === postId) {
      setSelectedView('dashboard');
    }
  };

  const handleCreatePost = (newPost: DutyPost) => {
    const updatedRoster: AirfieldShiftRoster = {
      ...roster,
      posts: [...roster.posts, newPost],
    };
    handleUpdateRoster(updatedRoster);
    setSelectedView(newPost.id);
  };

  const stats = calculateAirfieldStats(roster.posts);

  // Filtered post list based on search
  const filteredPosts = roster.posts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.dutyTime && p.dutyTime.toLowerCase().includes(searchQuery.toLowerCase())) ||
    p.personnel.some((pers) => pers.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedPost = roster.posts.find((p) => p.id === selectedView);

  const shifts: { id: ShiftName; label: string; time: string }[] = [
    { id: 'SHIFT-A', label: 'Shift A', time: '0600F - 1400F' },
    { id: 'SHIFT-B', label: 'Shift B', time: '1400F - 2200F' },
    { id: 'SHIFT-C', label: 'Shift C', time: '2200F - 0600F' },
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 text-slate-100 flex flex-col md:flex-row overflow-hidden font-sans">
      
      {/* Sidebar - Desktop */}
      <div className="w-72 md:w-80 border-r border-slate-800 bg-slate-950 flex-col shrink-0 h-full overflow-hidden hidden md:flex rounded-br-[36px] shadow-2xl">
        {/* Top Header */}
        <div className="p-5 pb-3 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center p-1 overflow-hidden shadow-sm shrink-0 text-indigo-400">
              <Plane className="w-5 h-5 -rotate-45" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400 block leading-tight">
                AIRFIELD OPERATIONS
              </span>
              <h1 className="font-black text-lg tracking-wider truncate text-white">
                SAIA (Chattogram)
              </h1>
            </div>
          </div>

          {/* Date & Shift Selector */}
          <div className="mt-4 p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5 text-slate-300 font-bold">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Date:</span>
              </div>
              <input
                type="date"
                value={roster.date}
                onChange={(e) => handleUpdateRoster({ ...roster, date: e.target.value })}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-white font-mono text-xs font-bold focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Shift Pill Buttons */}
            <div>
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                Active Shift ({roster.timeRange})
              </span>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs">
                {shifts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleUpdateRoster({ ...roster, shift: s.id, timeRange: s.time })}
                    className={`py-1 rounded-lg font-bold text-center transition-all cursor-pointer ${
                      roster.shift === s.id
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {s.label.replace('Shift ', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Readiness Strip */}
            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800">
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <UserCheck className="w-3 h-3" />
                <span>Active: {stats.activeCount}/{stats.targetActiveTotal}</span>
              </span>
              <span className="flex items-center gap-1 text-amber-400 font-bold">
                <Clock className="w-3 h-3" />
                <span>Stby: {stats.standbyCount}/{stats.targetStandbyTotal}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Primary Views: Dashboard & Master Sheet */}
        <div className="p-3 px-4 pb-1 space-y-2">
          {/* Dashboard Button */}
          <button
            onClick={() => setSelectedView('dashboard')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all font-bold text-xs cursor-pointer ${
              selectedView === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-slate-800/80 bg-slate-900/40'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <LayoutDashboard className="w-4 h-4" />
              <span>Operations Dashboard</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/30 text-emerald-300 font-bold">
              {stats.fulfillmentRate}% Live
            </span>
          </button>

          {/* Master Roster (Sheet) */}
          <button
            onClick={() => setSelectedView('sheet')}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl transition-all font-bold text-xs cursor-pointer ${
              selectedView === 'sheet'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-300 hover:bg-slate-900 hover:text-white border border-slate-800/80 bg-slate-900/40'
            }`}
          >
            <div className="flex items-center space-x-2.5">
              <FileText className="w-4 h-4" />
              <span>Master Roster Sheet</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/30 text-white font-bold">
              {roster.posts.length} Posts
            </span>
          </button>

          {/* Search Bar */}
          <div className="relative pt-1">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 mt-0.5" />
            <input
              type="text"
              placeholder="Search duty post or person..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Section Header: Duty Posts */}
        <div className="px-5 pt-3 pb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400">
          <span>Duty Posts ({filteredPosts.length})</span>
          <button
            onClick={() => setIsNewPostModalOpen(true)}
            className="p-1 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 rounded-lg transition-colors flex items-center gap-1 cursor-pointer font-bold text-[10px]"
            title="Add New Post"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Post</span>
          </button>
        </div>

        {/* Scrollable Duty Posts List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1.5 divide-y divide-slate-800/40">
          {filteredPosts.map((post, idx) => {
            const isActive = selectedView === post.id;
            const activeCount = post.personnel.filter((p) => (p.dutyStatus || 'Active') === 'Active').length;
            const standbyCount = post.personnel.filter((p) => p.dutyStatus === 'Standby').length;
            const targetActive = post.targetActiveStrength ?? post.targetStrength ?? 0;
            const postTime = post.dutyTime || roster.timeRange || '0600F - 1400F';

            const hasArms = post.personnel.some((p) => p.armsCount && p.armsCount > 0);
            const hasRt = post.personnel.some((p) => p.rtCount && p.rtCount > 0);

            return (
              <button
                key={post.id}
                onClick={() => setSelectedView(post.id)}
                className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer flex items-center justify-between group ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center space-x-1.5">
                    <span className={`text-[10px] font-black ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-xs truncate block">{post.name}</span>
                  </div>

                  {/* Time & Personnel Preview */}
                  <div className="flex items-center space-x-2 mt-0.5 text-[10px]">
                    <span className={`font-mono flex items-center gap-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                      <Clock className="w-2.5 h-2.5" />
                      <span>{postTime.split(' ')[0]}</span>
                    </span>

                    <span className={isActive ? 'text-emerald-200 font-bold' : 'text-emerald-400 font-medium'}>
                      Act: {activeCount}/{targetActive}
                    </span>

                    {standbyCount > 0 && (
                      <span className={isActive ? 'text-amber-200 font-bold' : 'text-amber-400 font-medium'}>
                        Stby: {standbyCount}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-1.5 shrink-0">
                  {hasArms && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-rose-400'}`} title="Has Arms" />
                  )}
                  {hasRt && (
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-sky-400'}`} title="Has RT" />
                  )}
                  <span
                    className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : activeCount === 0
                        ? 'bg-slate-800 text-rose-400'
                        : 'bg-slate-800 text-indigo-300'
                    }`}
                  >
                    {activeCount + standbyCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom Bar: Back to Portal button */}
        <div className="p-4 border-t border-slate-800 space-y-2 bg-slate-950/80">
          <button
            onClick={onBack}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-all font-bold text-xs uppercase tracking-wider border border-slate-800 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Main Portal</span>
          </button>
        </div>
      </div>

      {/* Mobile Top Header */}
      <div className="md:hidden flex items-center justify-between p-3.5 bg-slate-950 border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider block leading-none">
              AIRFIELD (SAIA)
            </span>
            <h1 className="font-black text-sm text-white truncate">
              {selectedView === 'dashboard'
                ? 'Operations Dashboard'
                : selectedView === 'sheet'
                ? 'Master Roster'
                : selectedPost?.name || 'Airfield Duty'}
            </h1>
          </div>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setSelectedView('dashboard')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
              selectedView === 'dashboard'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            Dash
          </button>
          <button
            onClick={() => setSelectedView('sheet')}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
              selectedView === 'sheet'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-300'
            }`}
          >
            Sheet
          </button>
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white"
            title="Exit"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] md:hidden flex"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-72 max-w-[85vw] h-full flex flex-col bg-slate-950 border-r border-slate-800 shadow-2xl animate-in slide-in-from-left-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Plane className="w-5 h-5 text-indigo-400 -rotate-45" />
                <span className="font-black text-white text-sm">AIRFIELD SAIA</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 border-b border-slate-800 space-y-1.5">
              <button
                onClick={() => {
                  setSelectedView('dashboard');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-bold text-xs ${
                  selectedView === 'dashboard' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-300'
                }`}
              >
                <span>Operations Dashboard</span>
                <span className="text-[10px] font-mono">{stats.fulfillmentRate}%</span>
              </button>

              <button
                onClick={() => {
                  setSelectedView('sheet');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl font-bold text-xs ${
                  selectedView === 'sheet' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-300'
                }`}
              >
                <span>Full Master Roster</span>
                <span className="text-[10px] font-mono">{roster.posts.length}</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider px-2 block">
                Duty Posts ({roster.posts.length})
              </span>
              {roster.posts.map((post, idx) => (
                <button
                  key={post.id}
                  onClick={() => {
                    setSelectedView(post.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between ${
                    selectedView === post.id
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  <span className="truncate">
                    #{idx + 1} {post.name}
                  </span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-black/20">
                    {post.personnel.length}
                  </span>
                </button>
              ))}
            </div>

            <div className="p-3 border-t border-slate-800">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onBack();
                }}
                className="w-full py-2.5 bg-slate-900 text-slate-300 rounded-xl text-xs font-bold"
              >
                Exit Airfield (SAIA)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-slate-900">
        {selectedView === 'dashboard' ? (
          <AirfieldDashboardView
            roster={roster}
            onUpdateRoster={handleUpdateRoster}
            onSelectPost={(pId) => setSelectedView(pId)}
            onOpenNewPostModal={() => setIsNewPostModalOpen(true)}
            onOpenSheetView={() => setSelectedView('sheet')}
          />
        ) : selectedView === 'sheet' ? (
          <FullRosterSheetView
            roster={roster}
            onUpdateRoster={handleUpdateRoster}
            onSelectPost={(pId) => setSelectedView(pId)}
          />
        ) : selectedPost ? (
          <PostPersonnelView
            post={selectedPost}
            onUpdatePost={handleUpdatePost}
            onDeletePost={handleDeletePost}
          />
        ) : (
          <AirfieldDashboardView
            roster={roster}
            onUpdateRoster={handleUpdateRoster}
            onSelectPost={(pId) => setSelectedView(pId)}
            onOpenNewPostModal={() => setIsNewPostModalOpen(true)}
            onOpenSheetView={() => setSelectedView('sheet')}
          />
        )}
      </div>

      {/* Create New Post Modal */}
      <PostSettingsModal
        isOpen={isNewPostModalOpen}
        onClose={() => setIsNewPostModalOpen(false)}
        post={null}
        onSavePost={handleCreatePost}
      />
    </div>
  );
};

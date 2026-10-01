import React, { useState } from 'react';
import { 
  AirfieldShiftRoster, 
  DutyPost, 
  ShiftName 
} from '../types';
import { calculateAirfieldStats } from '../utils/airfieldStorage';
import { 
  Plane, 
  Shield, 
  Users, 
  UserCheck, 
  UserPlus, 
  Clock, 
  Crosshair, 
  Radio, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Search, 
  Plus, 
  FileText, 
  Phone, 
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  Settings,
  ShieldAlert,
  Sparkles,
  RefreshCw
} from 'lucide-react';

interface AirfieldDashboardViewProps {
  roster: AirfieldShiftRoster;
  onUpdateRoster: (newRoster: AirfieldShiftRoster) => void;
  onSelectPost: (postId: string) => void;
  onOpenNewPostModal: () => void;
  onOpenSheetView: () => void;
}

export const AirfieldDashboardView: React.FC<AirfieldDashboardViewProps> = ({
  roster,
  onUpdateRoster,
  onSelectPost,
  onOpenNewPostModal,
  onOpenSheetView,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [postSearch, setPostSearch] = useState('');
  const [isEditingOfficers, setIsEditingOfficers] = useState(false);
  const [dutyOfficerName, setDutyOfficerName] = useState(roster.dutyOfficerName);
  const [dutyOfficerPhone, setDutyOfficerPhone] = useState(roster.dutyOfficerPhone);
  const [dutySncoName, setDutySncoName] = useState(roster.dutySncoName);

  const stats = calculateAirfieldStats(roster.posts);

  const shifts: { id: ShiftName; label: string; time: string }[] = [
    { id: 'SHIFT-A', label: 'Shift A', time: '0600F - 1400F' },
    { id: 'SHIFT-B', label: 'Shift B', time: '1400F - 2200F' },
    { id: 'SHIFT-C', label: 'Shift C', time: '2200F - 0600F' },
  ];

  const handleSaveOfficers = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateRoster({
      ...roster,
      dutyOfficerName: dutyOfficerName.trim(),
      dutyOfficerPhone: dutyOfficerPhone.trim(),
      dutySncoName: dutySncoName.trim(),
    });
    setIsEditingOfficers(false);
  };

  const handleShiftChange = (shiftId: ShiftName) => {
    const shiftObj = shifts.find((s) => s.id === shiftId);
    onUpdateRoster({
      ...roster,
      shift: shiftId,
      timeRange: shiftObj ? shiftObj.time : roster.timeRange,
    });
  };

  const filteredPosts = roster.posts.filter((post) => {
    const matchCat = filterCategory === 'all' || post.category === filterCategory;
    const matchSearch =
      post.name.toLowerCase().includes(postSearch.toLowerCase()) ||
      (post.breakdownNote && post.breakdownNote.toLowerCase().includes(postSearch.toLowerCase())) ||
      post.personnel.some((p) => p.name.toLowerCase().includes(postSearch.toLowerCase()));
    return matchCat && matchSearch;
  });

  const categories = ['all', 'Gate', 'Terminal', 'Security', 'Command', 'Special'];

  // Under-manned posts
  const underMannedPosts = roster.posts.filter((p) => {
    const activeTarget = p.targetActiveStrength ?? p.targetStrength ?? 0;
    const activeActual = p.personnel.filter((pers) => (pers.dutyStatus || 'Active') === 'Active').length;
    return activeTarget > 0 && activeActual < activeTarget;
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-900 text-slate-100 p-3 sm:p-6 lg:p-8 space-y-5 pb-36">
      
      {/* Top Banner / Hero Header */}
      <div className="rounded-3xl bg-slate-950 border border-slate-800 p-4 sm:p-6 lg:p-7 shadow-2xl relative shrink-0">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-[10px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-1.5">
                <Plane className="w-3.5 h-3.5 -rotate-45" />
                <span>SAIA AIRFIELD OPERATIONS COMMAND</span>
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] sm:text-[11px] font-black uppercase tracking-widest flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE ROSTER</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight">
              Airfield Duty Management Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
              Shah Amanat International Airport (SAIA), Chattogram • Real-time Active Duty, Standby Force, Post Duty Timing & Strength Quota Control.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={onOpenSheetView}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Full Master Sheet</span>
            </button>

            <button
              onClick={onOpenNewPostModal}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Duty Post</span>
            </button>
          </div>
        </div>

        {/* Operational Shift & Officer Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Shift Selector */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
              <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Duty Shift & Timing</span>
              </span>
              <span className="text-indigo-300 font-mono">{roster.timeRange}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {shifts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleShiftChange(s.id)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${
                    roster.shift === s.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  <span className="block">{s.label}</span>
                  <span className="text-[9px] opacity-75 font-mono block truncate">{s.time.split('-')[0]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duty Officer Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                Duty Officer
              </span>
              <h4 className="font-bold text-sm text-white truncate">{roster.dutyOfficerName || 'Not Assigned'}</h4>
              {roster.dutyOfficerPhone && (
                <a
                  href={`tel:${roster.dutyOfficerPhone}`}
                  className="text-xs text-emerald-400 hover:underline font-mono flex items-center gap-1 mt-0.5"
                >
                  <Phone className="w-3 h-3" />
                  <span>{roster.dutyOfficerPhone}</span>
                </a>
              )}
            </div>
            <button
              onClick={() => setIsEditingOfficers(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Edit Officers"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* Duty SNCO Card */}
          <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                Duty SNCO
              </span>
              <h4 className="font-bold text-sm text-white truncate">{roster.dutySncoName || 'Not Assigned'}</h4>
              <p className="text-xs text-indigo-400 font-mono mt-0.5">Stationed: Airport Ops Room</p>
            </div>
            <button
              onClick={() => setIsEditingOfficers(true)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Edit Officers"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 shrink-0">
        {/* Total Posts */}
        <div className="p-4 rounded-3xl bg-slate-950 border border-slate-800/90 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span className="uppercase tracking-wider text-[11px]">Total Posts</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white">{stats.totalPosts}</div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Airfield SAIA Points</span>
        </div>

        {/* Active Duty */}
        <div className="p-4 rounded-3xl bg-slate-950 border border-emerald-900/40 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-bold mb-1">
            <span className="uppercase tracking-wider text-[11px]">Active Duty</span>
            <UserCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-emerald-300">{stats.activeCount}</span>
            <span className="text-xs font-bold text-slate-500 font-mono">/ {stats.targetActiveTotal}</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.fulfillmentRate}%` }}
            />
          </div>
          <span className="text-[10px] text-emerald-400/80 font-bold mt-1 block">
            {stats.fulfillmentRate}% Target Manned
          </span>
        </div>

        {/* Standby Duty */}
        <div className="p-4 rounded-3xl bg-slate-950 border border-amber-900/40 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400 text-xs font-bold mb-1">
            <span className="uppercase tracking-wider text-[11px]">Standby Duty</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-black text-amber-300">{stats.standbyCount}</span>
            <span className="text-xs font-bold text-slate-500 font-mono">/ {stats.targetStandbyTotal}</span>
          </div>
          <span className="text-[10px] text-amber-400/80 font-bold mt-1 block">
            Relief & Backup Force
          </span>
        </div>

        {/* Arms Deployed */}
        <div className="p-4 rounded-3xl bg-slate-950 border border-rose-900/40 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-rose-400 text-xs font-bold mb-1">
            <span className="uppercase tracking-wider text-[11px]">Arms Deployed</span>
            <Crosshair className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-300">{stats.totalArms}</div>
          <span className="text-[10px] text-rose-400/80 font-mono block mt-0.5">Weapons on Posts</span>
        </div>

        {/* RT Comms */}
        <div className="p-4 rounded-3xl bg-slate-950 border border-sky-900/40 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-sky-400 text-xs font-bold mb-1">
            <span className="uppercase tracking-wider text-[11px]">RT Comms</span>
            <Radio className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-300">{stats.totalRt}</div>
          <span className="text-[10px] text-sky-400/80 font-mono block mt-0.5">Wireless Sets Active</span>
        </div>

        {/* Staff Breakdown */}
        <div className="p-4 rounded-3xl bg-slate-950 border border-slate-800/90 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 text-xs font-bold mb-1">
            <span className="uppercase tracking-wider text-[11px]">Staff Split</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-base font-black text-white mt-1">
            <span className="text-emerald-400">{stats.permanentCount}</span> P /{' '}
            <span className="text-amber-400">{stats.additionalCount}</span> Addl
          </div>
          <span className="text-[10px] text-slate-400 block mt-0.5">Total: {stats.totalPersonnel} Pers</span>
        </div>
      </div>

      {/* Under-Manned Alert (if any) */}
      {underMannedPosts.length > 0 && (
        <div className="rounded-3xl bg-amber-950/40 border border-amber-500/40 p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn shrink-0">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-amber-200 text-sm flex items-center gap-2">
                <span>Under-Manned Duty Posts Detected ({underMannedPosts.length})</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] uppercase font-mono font-black">
                  Action Required
                </span>
              </h3>
              <p className="text-xs text-amber-300/80 mt-1">
                The following posts have fewer active personnel than their target quota:{' '}
                <span className="font-bold text-white">
                  {underMannedPosts.map((p) => p.name).join(', ')}
                </span>
                .
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {underMannedPosts[0] && (
              <button
                onClick={() => onSelectPost(underMannedPosts[0].id)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-950 font-black rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>Manning: {underMannedPosts[0].name}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Duty Posts Section */}
      <div className="space-y-4 shrink-0">
        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'All Posts' : cat}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search post, time, rank, name..."
              value={postSearch}
              onChange={(e) => setPostSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Live Grid of Duty Posts */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPosts.map((post) => {
            const activePersonnel = post.personnel.filter((p) => (p.dutyStatus || 'Active') === 'Active');
            const standbyPersonnel = post.personnel.filter((p) => p.dutyStatus === 'Standby');
            const restPersonnel = post.personnel.filter((p) => p.dutyStatus === 'Rest');
            const targetActive = post.targetActiveStrength ?? post.targetStrength ?? 0;
            const targetStandby = post.targetStandbyStrength ?? 0;
            const isFullActive = activePersonnel.length >= targetActive;
            const postTime = post.dutyTime || roster.timeRange || '0600F - 1400F';

            return (
              <div
                key={post.id}
                onClick={() => onSelectPost(post.id)}
                className="rounded-3xl bg-slate-950 border border-slate-800 p-5 shadow-lg hover:border-indigo-500/70 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                <div>
                  {/* Header: Title, Category & Duty Time */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
                          {post.category || 'Security'}
                        </span>
                        {/* Time badge */}
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-indigo-950/70 border border-indigo-500/30 text-indigo-300 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{postTime}</span>
                        </span>
                      </div>
                      <h3 className="text-base font-black text-white mt-1.5 truncate group-hover:text-indigo-300 transition-colors">
                        {post.name}
                      </h3>
                    </div>

                    <div className="p-2 rounded-xl bg-slate-900 group-hover:bg-indigo-600 text-slate-400 group-hover:text-white transition-all shrink-0">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Quota Strength Counters */}
                  <div className="grid grid-cols-2 gap-2 my-3">
                    {/* Active Counter */}
                    <div className={`p-2.5 rounded-2xl border ${
                      isFullActive
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                    }`}>
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                        <span>Active Duty</span>
                        <UserCheck className="w-3 h-3" />
                      </div>
                      <div className="mt-1 flex items-baseline space-x-1">
                        <span className="text-lg font-black">{activePersonnel.length}</span>
                        <span className="text-xs text-slate-500 font-mono">/ {targetActive} Quota</span>
                      </div>
                    </div>

                    {/* Standby Counter */}
                    <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-800 text-slate-300">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-amber-400">
                        <span>Standby</span>
                        <Clock className="w-3 h-3" />
                      </div>
                      <div className="mt-1 flex items-baseline space-x-1">
                        <span className="text-lg font-black text-amber-300">{standbyPersonnel.length}</span>
                        <span className="text-xs text-slate-500 font-mono">/ {targetStandby} Quota</span>
                      </div>
                    </div>
                  </div>

                  {/* Active Persons Preview */}
                  <div className="space-y-1.5 mb-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                      Active On Duty ({activePersonnel.length})
                    </span>
                    {activePersonnel.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No active personnel assigned</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {activePersonnel.slice(0, 4).map((pers) => (
                          <span
                            key={pers.id}
                            className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-bold text-slate-200"
                          >
                            <span className="text-indigo-400 font-normal mr-1">{pers.rank}</span>
                            <span>{pers.name}</span>
                          </span>
                        ))}
                        {activePersonnel.length > 4 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-400">
                            +{activePersonnel.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Standby Persons Preview (if any) */}
                  {standbyPersonnel.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <span className="text-[10px] font-black uppercase text-amber-400/90 tracking-wider block">
                        Standby ({standbyPersonnel.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {standbyPersonnel.map((pers) => (
                          <span
                            key={pers.id}
                            className="px-2 py-0.5 rounded-lg bg-amber-950/30 border border-amber-500/20 text-[11px] font-mono text-amber-300"
                          >
                            {pers.rank} {pers.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rest Persons Preview (if any) */}
                  {restPersonnel.length > 0 && (
                    <div className="space-y-1 mt-2">
                      <span className="text-[10px] font-black uppercase text-sky-400/90 tracking-wider block">
                        In Rest / Relief ({restPersonnel.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {restPersonnel.map((pers) => (
                          <span
                            key={pers.id}
                            className="px-2 py-0.5 rounded-lg bg-sky-950/30 border border-sky-500/20 text-[11px] font-mono text-sky-300"
                          >
                            {pers.rank} {pers.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer: Equipment & Action */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    {post.breakdownNote && (
                      <span className="text-[10px] font-mono text-slate-400 font-bold">
                        {post.breakdownNote}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-indigo-400 group-hover:underline flex items-center gap-1">
                    <span>Manage Post</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Officers Modal */}
      {isEditingOfficers && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-indigo-400" />
              <span>Edit Shift Duty Officers</span>
            </h3>

            <form onSubmit={handleSaveOfficers} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Duty Officer Name
                </label>
                <input
                  type="text"
                  value={dutyOfficerName}
                  onChange={(e) => setDutyOfficerName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Duty Officer Phone
                </label>
                <input
                  type="tel"
                  value={dutyOfficerPhone}
                  onChange={(e) => setDutyOfficerPhone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase tracking-wider mb-1">
                  Duty SNCO Name
                </label>
                <input
                  type="text"
                  value={dutySncoName}
                  onChange={(e) => setDutySncoName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditingOfficers(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/30"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

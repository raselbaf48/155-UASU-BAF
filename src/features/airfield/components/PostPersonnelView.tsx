import React, { useState } from 'react';
import { DutyPost, DutyPerson, DutyStatusType } from '../types';
import { 
  Shield, 
  Users, 
  UserPlus, 
  Phone, 
  Crosshair, 
  Radio, 
  Edit3, 
  Trash2, 
  Settings, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Check,
  Clock,
  UserCheck,
  ArrowRightLeft,
  Calendar,
  Sparkles,
  Coffee,
  X,
  RefreshCw,
  Info
} from 'lucide-react';
import { AddEditPersonModal } from './AddEditPersonModal';
import { PostSettingsModal } from './PostSettingsModal';
import { generateFairRotationSchedule, formatDurationHoursMins } from '../utils/rotationScheduler';

interface PostPersonnelViewProps {
  post: DutyPost;
  onUpdatePost: (updatedPost: DutyPost) => void;
  onDeletePost: (postId: string) => void;
}

export const PostPersonnelView: React.FC<PostPersonnelViewProps> = ({
  post,
  onUpdatePost,
  onDeletePost,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalStatus, setAddModalStatus] = useState<DutyStatusType>('Active');
  const [editingPerson, setEditingPerson] = useState<DutyPerson | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRotationModalOpen, setIsRotationModalOpen] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const activePersonnel = post.personnel.filter((p) => (p.dutyStatus || 'Active') === 'Active');
  const standbyPersonnel = post.personnel.filter((p) => p.dutyStatus === 'Standby');
  const restPersonnel = post.personnel.filter((p) => p.dutyStatus === 'Rest');

  const targetActive = post.targetActiveStrength ?? post.targetStrength ?? 2;
  const targetStandby = post.targetStandbyStrength ?? 0;
  const postDutyTime = post.dutyTime || '0600F - 1400F';

  const totalArms = post.personnel.reduce((sum, p) => sum + (p.armsCount || 0), 0);
  const totalRt = post.personnel.reduce((sum, p) => sum + (p.rtCount || 0), 0);

  // Auto-calculated fair rotation info for preview
  const previewRotation = generateFairRotationSchedule(post);
  const activeRotationSchedule = post.rotationSchedule || previewRotation.schedule;

  const handleSavePerson = (person: DutyPerson) => {
    let updatedPersonnel: DutyPerson[];
    const exists = post.personnel.some((p) => p.id === person.id);
    if (exists) {
      updatedPersonnel = post.personnel.map((p) => (p.id === person.id ? person : p));
    } else {
      updatedPersonnel = [...post.personnel, person];
    }
    onUpdatePost({
      ...post,
      personnel: updatedPersonnel,
    });
  };

  const handleDeletePerson = (personId: string) => {
    if (confirm('Remove this person from the duty post?')) {
      onUpdatePost({
        ...post,
        personnel: post.personnel.filter((p) => p.id !== personId),
      });
    }
  };

  const handleSetStatus = (person: DutyPerson, newStatus: DutyStatusType) => {
    const updated = post.personnel.map((p) =>
      p.id === person.id ? { ...p, dutyStatus: newStatus } : p
    );
    onUpdatePost({
      ...post,
      personnel: updated,
    });
  };

  // Executes fair mathematical division of duty time
  const handleAutoDivideEqualRotation = () => {
    const { schedule, updatedPersonnel } = generateFairRotationSchedule(post);
    onUpdatePost({
      ...post,
      rotationSchedule: schedule,
      personnel: updatedPersonnel,
    });
    setIsRotationModalOpen(true);
  };

  const handleUpdateActiveQuota = (delta: number) => {
    const newTarget = Math.max(0, targetActive + delta);
    const updatedPost: DutyPost = {
      ...post,
      targetActiveStrength: newTarget,
      targetStrength: newTarget + targetStandby,
    };
    // Auto re-balance if personnel exist
    if (updatedPost.personnel.length > 0) {
      const { schedule, updatedPersonnel } = generateFairRotationSchedule(updatedPost);
      updatedPost.rotationSchedule = schedule;
      updatedPost.personnel = updatedPersonnel;
    }
    onUpdatePost(updatedPost);
  };

  const handleUpdateStandbyQuota = (delta: number) => {
    const newTarget = Math.max(0, targetStandby + delta);
    const updatedPost: DutyPost = {
      ...post,
      targetStandbyStrength: newTarget,
      targetStrength: targetActive + newTarget,
    };
    if (updatedPost.personnel.length > 0) {
      const { schedule, updatedPersonnel } = generateFairRotationSchedule(updatedPost);
      updatedPost.rotationSchedule = schedule;
      updatedPost.personnel = updatedPersonnel;
    }
    onUpdatePost(updatedPost);
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const renderPersonCard = (person: DutyPerson, currentStatus: DutyStatusType) => {
    const isPermanent = person.type === 'Permanent';
    const isAct = currentStatus === 'Active';
    const isStb = currentStatus === 'Standby';

    return (
      <div
        key={person.id}
        className={`rounded-2xl bg-slate-950 border p-5 shadow-lg relative flex flex-col justify-between transition-all group ${
          isAct
            ? 'border-slate-800/90 hover:border-emerald-500/60'
            : isStb
            ? 'border-slate-800/90 hover:border-amber-500/60'
            : 'border-slate-800/90 hover:border-sky-500/60'
        }`}
      >
        <div>
          {/* Top Row: Type & Actions */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isPermanent
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                }`}
              >
                {isPermanent ? 'Permanent (P)' : 'Additional'}
              </span>

              {/* Status Badge */}
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isAct
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                    : isStb
                    ? 'bg-amber-950 text-amber-300 border-amber-500/30'
                    : 'bg-sky-950 text-sky-300 border-sky-500/30'
                }`}
              >
                {isAct ? 'Active' : isStb ? 'Standby' : 'Rest'}
              </span>
            </div>

            <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  setEditingPerson(person);
                  setAddModalStatus(currentStatus);
                  setIsAddModalOpen(true);
                }}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Edit Person"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDeletePerson(person.id)}
                className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                title="Remove Person"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Rank & Name */}
          <div className="flex items-baseline space-x-2">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-wider">
              {person.rank}
            </span>
            <h4 className="text-lg font-black text-white truncate">
              {person.name}
            </h4>
          </div>

          {person.bdNo && (
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              BD No: <span className="text-slate-300 font-bold">{person.bdNo}</span>
            </p>
          )}

          {/* Duty Time Details (Equal Allocation) */}
          <div className="mt-2.5 p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <div className="flex items-center space-x-1.5 text-indigo-300 font-mono text-[11px]">
              <Clock className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="truncate">{person.dutyTime || postDutyTime}</span>
            </div>
          </div>

          {/* Weapon & Equipment Badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {person.armsCount ? (
              <span className="px-2 py-0.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] font-mono font-bold flex items-center gap-1">
                <Crosshair className="w-3 h-3" />
                <span>Arms-{String(person.armsCount).padStart(2, '0')}</span>
              </span>
            ) : null}

            {person.rtCount ? (
              <span className="px-2 py-0.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 text-[11px] font-mono font-bold flex items-center gap-1">
                <Radio className="w-3 h-3" />
                <span>RT-{String(person.rtCount).padStart(2, '0')}</span>
              </span>
            ) : null}

            {person.remarks && (
              <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 text-[11px] italic">
                {person.remarks}
              </span>
            )}
          </div>
        </div>

        {/* Bottom Row: Phone & Rotation Status Action Buttons */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          {person.mobileNo ? (
            <div className="flex items-center space-x-1.5 min-w-0">
              <a
                href={`tel:${person.mobileNo}`}
                className="flex items-center space-x-1 font-mono text-emerald-400 hover:text-emerald-300 font-bold truncate"
              >
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{person.mobileNo}</span>
              </a>
              <button
                onClick={() => handleCopyPhone(person.mobileNo!)}
                className="text-slate-500 hover:text-slate-300 p-1 shrink-0"
                title="Copy phone"
              >
                {copiedPhone === person.mobileNo ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          ) : (
            <span className="text-[10px] text-slate-500 italic">No phone added</span>
          )}

          {/* Quick Shift State Buttons */}
          <div className="flex items-center gap-1">
            {!isAct && (
              <button
                onClick={() => handleSetStatus(person, 'Active')}
                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-500/30 transition-all cursor-pointer"
                title="Move to Active Duty"
              >
                To Active
              </button>
            )}
            {!isStb && (
              <button
                onClick={() => handleSetStatus(person, 'Standby')}
                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 border border-amber-500/30 transition-all cursor-pointer"
                title="Move to Standby"
              >
                To Standby
              </button>
            )}
            {currentStatus !== 'Rest' && (
              <button
                onClick={() => handleSetStatus(person, 'Rest')}
                className="px-2 py-1 rounded-lg text-[10px] font-bold bg-sky-950/40 text-sky-300 hover:bg-sky-900/60 border border-sky-500/30 transition-all cursor-pointer"
                title="Move to Rest / Relief"
              >
                To Rest
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-slate-900 text-slate-100 p-3 sm:p-6 lg:p-8 space-y-5 pb-36">
      
      {/* Top Banner Card */}
      <div className="rounded-3xl bg-slate-950 border border-slate-800 p-4 sm:p-6 shadow-xl relative shrink-0">
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-widest text-indigo-400">
                    Duty Post ({post.category || 'Security'})
                  </span>
                  {/* Duty Time Pill */}
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-950 border border-indigo-500/30 text-indigo-300 font-mono font-bold text-xs flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-indigo-400" />
                    <span>Post Timing: {postDutyTime}</span>
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide mt-1">
                  {post.name}
                </h2>
              </div>
            </div>

            {/* Breakdown & Mobile */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {post.breakdownNote && (
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono font-bold">
                  Equipment: {post.breakdownNote}
                </span>
              )}
              {post.mobileNo && (
                <a
                  href={`tel:${post.mobileNo}`}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-mono font-bold flex items-center gap-1 hover:underline"
                >
                  <Phone className="w-3 h-3" />
                  <span>{post.mobileNo}</span>
                </a>
              )}
              {post.remarks && (
                <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400">
                  {post.remarks}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Auto Divide Equal Rotation Button */}
            <button
              onClick={handleAutoDivideEqualRotation}
              className="px-3.5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Automatically divide shift time equally among all assigned airmen"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Auto-Divide Equal Rotation</span>
            </button>

            {/* View Rotation Timeline Button */}
            <button
              onClick={() => setIsRotationModalOpen(true)}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-2xl border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
              title="View Complete Shift Rotation Matrix"
            >
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span>Rotation Schedule</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl border border-slate-700 transition-all cursor-pointer shadow-sm flex items-center gap-1.5 text-xs font-bold"
              title="Post Settings & Quotas"
            >
              <Settings className="w-4 h-4 text-indigo-400" />
            </button>

            <button
              onClick={() => {
                setEditingPerson(null);
                setAddModalStatus('Active');
                setIsAddModalOpen(true);
              }}
              className="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 transition-all cursor-pointer text-xs"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Assign Person</span>
            </button>
          </div>
        </div>

        {/* Quota Setting & Equal Allocation Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Active Duty Quota Setter */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block mb-0.5">
                Active Quota (অন-ডিউটি)
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-xl font-black text-white">{activePersonnel.length}</span>
                <span className="text-xs text-slate-400 font-bold">/ {targetActive} Quota</span>
              </div>
            </div>
            {/* Quick +/- Buttons */}
            <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => handleUpdateActiveQuota(-1)}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center text-xs cursor-pointer"
                title="Decrease Active Quota"
              >
                -
              </button>
              <span className="px-2 text-xs font-mono font-bold text-emerald-300">{targetActive}</span>
              <button
                onClick={() => handleUpdateActiveQuota(1)}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center text-xs cursor-pointer"
                title="Increase Active Quota"
              >
                +
              </button>
            </div>
          </div>

          {/* Standby Duty Quota Setter */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block mb-0.5">
                Standby Quota (স্ট্যান্ডবাই)
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-xl font-black text-white">{standbyPersonnel.length}</span>
                <span className="text-xs text-slate-400 font-bold">/ {targetStandby} Quota</span>
              </div>
            </div>
            {/* Quick +/- Buttons */}
            <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => handleUpdateStandbyQuota(-1)}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center text-xs cursor-pointer"
                title="Decrease Standby Quota"
              >
                -
              </button>
              <span className="px-2 text-xs font-mono font-bold text-amber-300">{targetStandby}</span>
              <button
                onClick={() => handleUpdateStandbyQuota(1)}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-bold flex items-center justify-center text-xs cursor-pointer"
                title="Increase Standby Quota"
              >
                +
              </button>
            </div>
          </div>

          {/* Rest / Relief Force Status */}
          <div className="p-3 rounded-2xl bg-slate-900 border border-sky-500/30 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-400 block mb-0.5 flex items-center gap-1">
                <Coffee className="w-3 h-3" />
                <span>Rest / Relief (বিশ্রাম)</span>
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-xl font-black text-sky-300">{restPersonnel.length}</span>
                <span className="text-xs text-slate-400 font-mono">/ {post.personnel.length} Total</span>
              </div>
            </div>
            <span className="text-[10px] text-sky-300/80 font-mono bg-sky-950/60 px-2 py-1 rounded-lg border border-sky-500/20">
              Rotational
            </span>
          </div>

          {/* Equal Time Guarantee Strip */}
          <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Equal Workload per Person</span>
            </span>
            <div className="text-xs font-bold text-slate-200 mt-1">
              Act: <span className="text-emerald-300 font-mono">{formatDurationHoursMins(activeRotationSchedule.perPersonActiveMinutes)}</span> • 
              Stby: <span className="text-amber-300 font-mono ml-1">{formatDurationHoursMins(activeRotationSchedule.perPersonStandbyMinutes)}</span> • 
              Rest: <span className="text-sky-300 font-mono ml-1">{formatDurationHoursMins(activeRotationSchedule.perPersonRestMinutes)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: ACTIVE DUTY PERSONNEL (অন-ডিউটি) */}
      <div className="space-y-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base font-black text-white tracking-wider uppercase flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Active Duty Personnel ({activePersonnel.length} / {targetActive})</span>
            </h3>
            <span className="text-xs font-mono text-indigo-300 bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
              Timing: {postDutyTime}
            </span>
          </div>

          <button
            onClick={() => {
              setEditingPerson(null);
              setAddModalStatus('Active');
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Active Person</span>
          </button>
        </div>

        {activePersonnel.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-800 p-8 text-center flex flex-col items-center justify-center space-y-2 bg-slate-950/40">
            <UserCheck className="w-8 h-8 text-slate-600" />
            <h4 className="font-bold text-white text-sm">No Active Personnel on {post.name}</h4>
            <p className="text-xs text-slate-400 max-w-sm">
              Target active quota is <span className="text-white font-bold">{targetActive}</span> persons. Click below to assign an airman to active duty.
            </p>
            <button
              onClick={() => {
                setEditingPerson(null);
                setAddModalStatus('Active');
                setIsAddModalOpen(true);
              }}
              className="mt-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              Assign Active Person
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePersonnel.map((person) => renderPersonCard(person, 'Active'))}
          </div>
        )}
      </div>

      {/* SECTION 2: STANDBY DUTY PERSONNEL (স্ট্যান্ডবাই) */}
      <div className="space-y-4 pt-4 border-t border-slate-800/80 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <h3 className="text-base font-black text-white tracking-wider uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Standby Duty Personnel ({standbyPersonnel.length} / {targetStandby})</span>
            </h3>
            <span className="text-xs text-slate-400">
              Immediate Relief & Backup Force
            </span>
          </div>

          <button
            onClick={() => {
              setEditingPerson(null);
              setAddModalStatus('Standby');
              setIsAddModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Add Standby Person</span>
          </button>
        </div>

        {standbyPersonnel.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-800/60 p-6 text-center flex flex-col items-center justify-center space-y-1.5 bg-slate-950/20">
            <p className="text-xs text-slate-400">
              No standby personnel assigned to this post. Target standby quota is{' '}
              <span className="text-amber-400 font-bold">{targetStandby}</span>.
            </p>
            <button
              onClick={() => {
                setEditingPerson(null);
                setAddModalStatus('Standby');
                setIsAddModalOpen(true);
              }}
              className="text-xs font-bold text-amber-400 hover:underline cursor-pointer"
            >
              + Assign Standby Person
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {standbyPersonnel.map((person) => renderPersonCard(person, 'Standby'))}
          </div>
        )}
      </div>

      {/* SECTION 3: REST & RELIEF FORCE (বিশ্রাম / রিলিফ) */}
      {restPersonnel.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-slate-800/80 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-3 h-3 rounded-full bg-sky-400" />
              <h3 className="text-base font-black text-white tracking-wider uppercase flex items-center gap-2">
                <Coffee className="w-4 h-4 text-sky-400" />
                <span>Rest & Relief Personnel ({restPersonnel.length} Persons)</span>
              </h3>
              <span className="text-xs text-sky-300 font-mono">
                Off-Duty Resting (Equal Rotation)
              </span>
            </div>

            <button
              onClick={() => {
                setEditingPerson(null);
                setAddModalStatus('Rest');
                setIsAddModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add to Rest</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {restPersonnel.map((person) => renderPersonCard(person, 'Rest'))}
          </div>
        </div>
      )}

      {/* Visual Shift Rotation Schedule Modal */}
      {isRotationModalOpen && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block">
                    {post.name} • TIMING: {postDutyTime}
                  </span>
                  <h3 className="text-lg font-black text-white">
                    Fair Rotation Schedule & Equal Workload Division
                  </h3>
                </div>
              </div>

              <button
                onClick={() => setIsRotationModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* Equal Allocation Summary Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-slate-950 border border-indigo-500/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-indigo-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Equal Time Guarantee (কারো ডিউটি সময় কম-বেশি হবে না)</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold text-[10px]">
                    100% Mathematically Equal
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30">
                    <span className="text-[10px] font-bold uppercase text-emerald-400 block mb-0.5">
                      Active Duty per Person
                    </span>
                    <span className="text-xl font-black text-white font-mono">
                      {formatDurationHoursMins(activeRotationSchedule.perPersonActiveMinutes)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Always exactly {targetActive} on duty</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30">
                    <span className="text-[10px] font-bold uppercase text-amber-400 block mb-0.5">
                      Standby Relief per Person
                    </span>
                    <span className="text-xl font-black text-white font-mono">
                      {formatDurationHoursMins(activeRotationSchedule.perPersonStandbyMinutes)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Always exactly {targetStandby} on standby</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900 border border-sky-500/30">
                    <span className="text-[10px] font-bold uppercase text-sky-400 block mb-0.5">
                      Rest & Relief per Person
                    </span>
                    <span className="text-xl font-black text-white font-mono">
                      {formatDurationHoursMins(activeRotationSchedule.perPersonRestMinutes)}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Always exactly {Math.max(0, post.personnel.length - (targetActive + targetStandby))} in rest
                    </span>
                  </div>
                </div>
              </div>

              {/* Slot by Slot Rotation Schedule Table */}
              <div className="rounded-2xl border border-slate-800 overflow-hidden shadow-lg bg-slate-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-300">
                      <th className="p-3">Slot #</th>
                      <th className="p-3">Time Range</th>
                      <th className="p-3 text-emerald-400">🟢 Active Duty ({targetActive} Pers)</th>
                      <th className="p-3 text-amber-400">🟡 Standby ({targetStandby} Pers)</th>
                      <th className="p-3 text-sky-400">🔵 In Rest ({Math.max(0, post.personnel.length - (targetActive + targetStandby))} Pers)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-medium">
                    {activeRotationSchedule.slots.map((slot) => {
                      const activeStaff = post.personnel.filter((p) => slot.activePersonIds.includes(p.id));
                      const standbyStaff = post.personnel.filter((p) => slot.standbyPersonIds.includes(p.id));
                      const restStaff = post.personnel.filter((p) => slot.restPersonIds.includes(p.id));

                      return (
                        <tr key={slot.slotIndex} className="hover:bg-slate-900/50 transition-colors">
                          <td className="p-3 font-mono font-black text-indigo-400">
                            Slot {slot.slotIndex}
                          </td>
                          <td className="p-3 font-mono font-bold text-white whitespace-nowrap">
                            ⏱ {slot.timeRange}
                          </td>
                          <td className="p-3 font-bold text-emerald-300">
                            <div className="flex flex-wrap gap-1.5">
                              {activeStaff.map((p) => (
                                <span key={p.id} className="px-2 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30">
                                  {p.rank} {p.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-3 font-bold text-amber-300">
                            <div className="flex flex-wrap gap-1.5">
                              {standbyStaff.length > 0 ? (
                                standbyStaff.map((p) => (
                                  <span key={p.id} className="px-2 py-0.5 rounded-lg bg-amber-950/60 border border-amber-500/30">
                                    {p.rank} {p.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 font-normal">-</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 font-bold text-sky-300">
                            <div className="flex flex-wrap gap-1.5">
                              {restStaff.length > 0 ? (
                                restStaff.map((p) => (
                                  <span key={p.id} className="px-2 py-0.5 rounded-lg bg-sky-950/60 border border-sky-500/30">
                                    {p.rank} {p.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 font-normal">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                Total Shift Duration: <span className="font-bold text-white">{postDutyTime}</span>
              </div>
              <button
                onClick={() => setIsRotationModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                Close Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Person Modal */}
      <AddEditPersonModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingPerson(null);
        }}
        onSave={handleSavePerson}
        initialPerson={editingPerson}
        postName={post.name}
        defaultDutyTime={postDutyTime}
        defaultDutyStatus={addModalStatus}
      />

      {/* Post Settings Modal */}
      <PostSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        post={post}
        onSavePost={onUpdatePost}
        onDeletePost={onDeletePost}
      />
    </div>
  );
};

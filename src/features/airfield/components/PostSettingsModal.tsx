import React, { useState, useEffect } from 'react';
import { DutyPost, DutyPerson, DutyStatusType } from '../types';
import {
  X,
  Shield,
  Trash2,
  Check,
  Phone,
  FileText,
  Clock,
  Users,
  UserCheck,
  UserPlus,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { AddEditPersonModal } from './AddEditPersonModal';

interface PostSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: DutyPost | null;
  onSavePost: (post: DutyPost) => void;
  onDeletePost?: (postId: string) => void;
}

export const PostSettingsModal: React.FC<PostSettingsModalProps> = ({
  isOpen,
  onClose,
  post,
  onSavePost,
  onDeletePost,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'Gate' | 'Terminal' | 'Command' | 'Security' | 'Special'>('Security');
  const [dutyTime, setDutyTime] = useState('0600F - 1400F');
  const [targetActiveStrength, setTargetActiveStrength] = useState<number>(2);
  const [targetStandbyStrength, setTargetStandbyStrength] = useState<number>(1);
  const [breakdownNote, setBreakdownNote] = useState('');
  const [mobileNo, setMobileNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [personnelList, setPersonnelList] = useState<DutyPerson[]>([]);
  const [isPersonModalOpen, setIsPersonModalOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<DutyPerson | null>(null);

  const commonTimes = ['0600F - 1400F', '1400F - 2200F', '2200F - 0600F', '24 Hours', 'Day Duty (0800 - 1600)'];

  useEffect(() => {
    if (post) {
      setName(post.name || '');
      setCategory(post.category || 'Security');
      setDutyTime(post.dutyTime || '0600F - 1400F');
      setTargetActiveStrength(post.targetActiveStrength ?? post.targetStrength ?? 2);
      setTargetStandbyStrength(post.targetStandbyStrength ?? 0);
      setBreakdownNote(post.breakdownNote || '');
      setMobileNo(post.mobileNo || '');
      setRemarks(post.remarks || '');
      setPersonnelList(post.personnel ? [...post.personnel] : []);
    } else {
      setName('');
      setCategory('Security');
      setDutyTime('0600F - 1400F');
      setTargetActiveStrength(2);
      setTargetStandbyStrength(1);
      setBreakdownNote('');
      setMobileNo('');
      setRemarks('');
      setPersonnelList([]);
    }
  }, [post, isOpen]);

  // Quick Preset Handlers for Personnel
  const handleLoadSampleTeam = () => {
    const samplePersons: DutyPerson[] = [
      { id: 'p_a', rank: 'LAC', name: 'A', type: 'Permanent', dutyStatus: 'Active', dutyTime: dutyTime || '0600F - 1400F', armsCount: 1, mobileNo: '01700-000001' },
      { id: 'p_b', rank: 'LAC', name: 'B', type: 'Permanent', dutyStatus: 'Active', dutyTime: dutyTime || '0600F - 1400F', armsCount: 1, mobileNo: '01700-000002' },
      { id: 'p_c', rank: 'Cpl', name: 'C', type: 'Permanent', dutyStatus: 'Standby', dutyTime: dutyTime || '0600F - 1400F', armsCount: 1, mobileNo: '01700-000003' },
      { id: 'p_d', rank: 'LAC', name: 'D', type: 'Additional', dutyStatus: 'Rest', dutyTime: dutyTime || '0600F - 1400F', rtCount: 1, mobileNo: '01700-000004' },
      { id: 'p_e', rank: 'LAC', name: 'E', type: 'Additional', dutyStatus: 'Rest', dutyTime: dutyTime || '0600F - 1400F', mobileNo: '01700-000005' },
    ];
    setPersonnelList(samplePersons);
    setTargetActiveStrength(2);
    setTargetStandbyStrength(1);
  };

  const handleLoadOfficialDriveway = () => {
    const officialPersons: DutyPerson[] = [
      { id: 'p_8', rank: 'LAC', name: 'Ashraf', type: 'Permanent', dutyStatus: 'Active', dutyTime: dutyTime || '0600F - 1400F', armsCount: 1, mobileNo: '01712-345678' },
      { id: 'p_9', rank: 'LAC', name: 'Rifat', type: 'Permanent', dutyStatus: 'Active', dutyTime: dutyTime || '0600F - 1400F', armsCount: 1, mobileNo: '01812-345678' },
      { id: 'p_10', rank: 'Cpl', name: 'Tamjid', type: 'Permanent', dutyStatus: 'Standby', dutyTime: dutyTime || '0600F - 1400F', armsCount: 1, mobileNo: '01912-345678' },
      { id: 'p_11', rank: 'LAC', name: 'Sarwer', type: 'Additional', dutyStatus: 'Rest', dutyTime: dutyTime || '0600F - 1400F', rtCount: 1, mobileNo: '01612-345678' },
      { id: 'p_12', rank: 'LAC', name: 'Saiful', type: 'Additional', dutyStatus: 'Rest', dutyTime: dutyTime || '0600F - 1400F', mobileNo: '01512-345678' },
    ];
    setPersonnelList(officialPersons);
    setTargetActiveStrength(2);
    setTargetStandbyStrength(1);
  };

  const handleSavePerson = (person: DutyPerson) => {
    setPersonnelList((prev) => {
      const idx = prev.findIndex((p) => p.id === person.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = person;
        return next;
      }
      return [...prev, person];
    });
    setEditingPerson(null);
    setIsPersonModalOpen(false);
  };

  const handleRemovePerson = (personId: string) => {
    setPersonnelList((prev) => prev.filter((p) => p.id !== personId));
  };

  const handleChangePersonStatus = (personId: string, newStatus: DutyStatusType) => {
    setPersonnelList((prev) =>
      prev.map((p) => (p.id === personId ? { ...p, dutyStatus: newStatus } : p))
    );
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const totalTarget = targetActiveStrength + targetStandbyStrength;

    const updatedPost: DutyPost = {
      id: post ? post.id : `post_${Date.now()}`,
      name: name.trim(),
      category,
      dutyTime: dutyTime.trim() || '0600F - 1400F',
      targetActiveStrength: Number(targetActiveStrength) || 0,
      targetStandbyStrength: Number(targetStandbyStrength) || 0,
      targetStrength: totalTarget,
      breakdownNote: breakdownNote.trim() || undefined,
      mobileNo: mobileNo.trim() || undefined,
      remarks: remarks.trim() || undefined,
      personnel: personnelList,
    };

    onSavePost(updatedPost);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            <span>{post ? 'Duty Post Configuration & Quota' : 'Create New Duty Post'}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm">
          {/* Post Name */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Duty Post Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Drive way (Terminal), VIP Gate, Apron..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Category & Duty Timing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="Gate">Gate</option>
                <option value="Terminal">Terminal</option>
                <option value="Security">Security</option>
                <option value="Command">Command</option>
                <option value="Special">Special</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Duty Timing</span>
              </label>
              <input
                type="text"
                value={dutyTime}
                onChange={(e) => setDutyTime(e.target.value)}
                placeholder="e.g. 0600F - 1400F"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-mono font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-xs"
              />
            </div>
          </div>

          {/* Quick Timing Preset Pills */}
          <div className="flex flex-wrap gap-1.5">
            {commonTimes.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setDutyTime(t)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
                  dutyTime === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Quota Strength Settings: Active & Standby ("koto jon thakbe oitao set kora jbe") */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <span className="text-xs font-black uppercase tracking-wider text-indigo-300 block">
              Required Personnel Quota (কত জন থাকবে)
            </span>

            <div className="grid grid-cols-2 gap-3">
              {/* Active Duty Quota */}
              <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30">
                <label className="block text-[11px] font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Active Duty Quota</span>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setTargetActiveStrength(Math.max(0, targetActiveStrength - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={targetActiveStrength}
                    onChange={(e) => setTargetActiveStrength(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-white font-mono font-black text-center text-base outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTargetActiveStrength(targetActiveStrength + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block text-center">Active on Post</span>
              </div>

              {/* Standby Duty Quota */}
              <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/30">
                <label className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Standby Quota</span>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setTargetStandbyStrength(Math.max(0, targetStandbyStrength - 1))}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={targetStandbyStrength}
                    onChange={(e) => setTargetStandbyStrength(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-white font-mono font-black text-center text-base outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTargetStandbyStrength(targetStandbyStrength + 1)}
                    className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center text-sm"
                  >
                    +
                  </button>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block text-center">Standby / Relief Force</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 text-center pt-1 border-t border-slate-800">
              Total Target Force for this post: <span className="font-bold text-white">{targetActiveStrength + targetStandbyStrength} Persons</span>
            </div>
          </div>

          {/* PERSONNEL MANAGEMENT SECTION (এই পোস্টে নিয়োজিত সকল ডিউটি পার্সনদের তালিকা) */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
              <div>
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                    Assigned Duty Personnel ({personnelList.length} জন)
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  এই পোস্টের এয়ারম্যানদের তালিকা ও ডিউটি স্ট্যাটাস (Active / Standby / Rest) পরিবর্তন বা রিমুভ করুন
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingPerson(null);
                  setIsPersonModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer self-start sm:self-auto shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ এয়ারম্যান যোগ করুন</span>
              </button>
            </div>

            {/* Quick Presets for Driveway / Terminal */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] uppercase font-bold text-slate-500 mr-1">কুইক প্রিসেট:</span>
              <button
                type="button"
                onClick={handleLoadSampleTeam}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/60 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-emerald-400" />
                <span>স্যাম্পল টিম (A, B, C, D, E)</span>
              </button>
              <button
                type="button"
                onClick={handleLoadOfficialDriveway}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Shield className="w-3 h-3 text-indigo-400" />
                <span>155 UASU ড্রাইভওয়ে স্কোয়াড</span>
              </button>
            </div>

            {/* Personnel List Items */}
            {personnelList.length === 0 ? (
              <div className="text-center py-6 px-4 rounded-xl bg-slate-900/60 border border-dashed border-slate-800 text-xs text-slate-400">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                <p>এই পোস্টে বর্তমানে কোনো এয়ারম্যান যুক্ত নেই।</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  উপরে &apos;+ এয়ারম্যান যোগ করুন&apos; অথবা প্রিসেট বাটনে চাপুন।
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {personnelList.map((person, idx) => {
                  const status = person.dutyStatus || 'Active';
                  return (
                    <div
                      key={person.id || idx}
                      className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      {/* Left: Info */}
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-black text-xs flex items-center justify-center shrink-0">
                          {person.rank || 'LAC'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-black text-white text-xs truncate">
                              {person.name}
                            </span>
                            {person.bdNo && (
                              <span className="text-[10px] font-mono text-slate-400">
                                ({person.bdNo})
                              </span>
                            )}
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                              {person.type || 'Permanent'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                            {person.mobileNo && (
                              <span className="flex items-center gap-1 font-mono text-slate-300">
                                <Phone className="w-2.5 h-2.5 text-indigo-400" />
                                {person.mobileNo}
                              </span>
                            )}
                            {person.armsCount ? (
                              <span className="text-amber-400/90 font-mono">
                                Arms: {person.armsCount}
                              </span>
                            ) : null}
                            {person.rtCount ? (
                              <span className="text-sky-400/90 font-mono">
                                RT: {person.rtCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Right: Status Switcher & Actions */}
                      <div className="flex items-center space-x-1.5 shrink-0 self-end sm:self-center">
                        {/* Status Switcher Buttons */}
                        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px] font-bold">
                          <button
                            type="button"
                            onClick={() => handleChangePersonStatus(person.id, 'Active')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                              status === 'Active'
                                ? 'bg-emerald-600 text-white font-black'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Set to Active Duty"
                          >
                            Active
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangePersonStatus(person.id, 'Standby')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                              status === 'Standby'
                                ? 'bg-amber-600 text-white font-black'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Set to Standby Duty"
                          >
                            Standby
                          </button>
                          <button
                            type="button"
                            onClick={() => handleChangePersonStatus(person.id, 'Rest')}
                            className={`px-2 py-0.5 rounded transition-all cursor-pointer ${
                              status === 'Rest'
                                ? 'bg-sky-600 text-white font-black'
                                : 'text-slate-400 hover:text-white'
                            }`}
                            title="Set to Rest / Relief"
                          >
                            Rest
                          </button>
                        </div>

                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingPerson(person);
                            setIsPersonModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                          title="Edit Person Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Remove / Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleRemovePerson(person.id)}
                          className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
                          title="Remove Person from Post"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Breakdown Note (Arms, RT) */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Equipment / Breakdown Note (e.g. Arms-02, RT-01)
            </label>
            <input
              type="text"
              value={breakdownNote}
              onChange={(e) => setBreakdownNote(e.target.value)}
              placeholder="e.g. Arms-02, RT-01"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Mobile No */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-indigo-400" />
              <span>Duty Post Mobile No</span>
            </label>
            <input
              type="tel"
              value={mobileNo}
              onChange={(e) => setMobileNo(e.target.value)}
              placeholder="e.g. 01700000000"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white font-mono focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Special Instructions / Remarks
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. 24/7 strictly manned, check identity card..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            {post && onDeletePost ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete post "${post.name}"?`)) {
                    onDeletePost(post.id);
                    onClose();
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Post</span>
              </button>
            ) : <div />}

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save Configuration</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Add / Edit Person Sub-Modal */}
      <AddEditPersonModal
        isOpen={isPersonModalOpen}
        onClose={() => {
          setIsPersonModalOpen(false);
          setEditingPerson(null);
        }}
        onSave={handleSavePerson}
        initialPerson={editingPerson}
        postName={name || 'Duty Post'}
        defaultDutyTime={dutyTime || '0600F - 1400F'}
        defaultDutyStatus="Active"
      />
    </div>
  );
};

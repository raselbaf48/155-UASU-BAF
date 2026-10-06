import React, { useState, useMemo } from 'react';
import { X, Check, Award, AlertCircle, ArrowUpDown, Shield, User, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import {
  getCanteenRankSeniorityRange,
  resolveCanteenTargetSeniority,
  reorderCanteenMemberSeniority,
  normalizeCanteenMembersSeniority,
  getCleanBdNo
} from '../utils/canteenSeniority';
import { saveMemberSeniority, saveBatchMemberSeniorities } from '../utils/memberSeniority';
import { getMemberBanglaName, getMemberBanglaRank } from '../utils/memberBanglaNames';
import { formatRankBn, formatMemberNameBn } from '../utils/exportCanteenBillExcel';
import { resolveImageUrl } from '../utils/canteenSettings';
import { playCelebrationSound } from '../utils/audioFeedback';

interface EditMemberSeniorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: any;
  allMembers: any[];
  onSuccess: (updatedMembers: any[]) => void;
}

export const EditMemberSeniorityModal: React.FC<EditMemberSeniorityModalProps> = ({
  isOpen,
  onClose,
  member,
  allMembers,
  onSuccess,
}) => {
  const rank = String(member?.Rank || member?.rank || '').trim();
  const cleanBd = getCleanBdNo(member?.['BD No'] || member?.bdNo || member?.airman_id);

  // Normalize baseline to get accurate current seniority and bounds
  const normalizedMembers = useMemo(() => {
    return normalizeCanteenMembersSeniority(allMembers || []);
  }, [allMembers]);

  const currentMemberInList = useMemo(() => {
    return normalizedMembers.find(
      (m) =>
        (m.airman_id && member?.airman_id && String(m.airman_id).toLowerCase() === String(member.airman_id).toLowerCase()) ||
        (cleanBd && getCleanBdNo(m['BD No'] || m.bdNo || m.airman_id) === cleanBd)
    ) || member;
  }, [normalizedMembers, member, cleanBd]);

  const currentSeniority = currentMemberInList?.seniority || currentMemberInList?.Seniority || 1;

  const [seniorityInput, setSeniorityInput] = useState<number | ''>(() => {
    return currentSeniority;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const rankRange = useMemo(() => {
    return getCanteenRankSeniorityRange(normalizedMembers, rank || 'LAC');
  }, [normalizedMembers, rank]);

  const targetResolved = useMemo(() => {
    if (seniorityInput === '' || !rank) return null;
    return resolveCanteenTargetSeniority(normalizedMembers, rank, Number(seniorityInput));
  }, [normalizedMembers, rank, seniorityInput]);

  if (!isOpen || !member) return null;

  const handleSave = async () => {
    if (seniorityInput === '' || !targetResolved) {
      setErrorMessage('অনুগ্রহ করে একটি বৈধ জ্যেষ্ঠতা নম্বর প্রদান করুন।');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const targetBdOrId = member.airman_id || cleanBd;
      const { updatedMembers, changedMembers } = reorderCanteenMemberSeniority(
        allMembers,
        targetBdOrId,
        targetResolved.resolvedSeniority
      );

      // Persist all affected members' seniorities to Cloud and Supabase Biodata Register
      if (changedMembers.length > 0) {
        const batchUpdates = changedMembers.map((cm) => ({
          bdNo: getCleanBdNo(cm['BD No'] || cm.bdNo || cm.airman_id),
          seniority: cm.seniority
        })).filter((item) => item.bdNo);

        await saveBatchMemberSeniorities(batchUpdates);
      } else {
        await saveMemberSeniority(cleanBd, targetResolved.resolvedSeniority);
      }

      setSaveSuccess(true);
      playCelebrationSound();
      setTimeout(() => {
        onSuccess(updatedMembers);
        onClose();
      }, 700);
    } catch (err: any) {
      console.error('Error saving member seniority:', err);
      setErrorMessage(err?.message || 'জ্যেষ্ঠতা নম্বর সংরক্ষণ করতে সমস্যা হয়েছে।');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToAuto = async () => {
    setIsSaving(true);
    setErrorMessage('');
    try {
      await saveMemberSeniority(cleanBd, null);
      // Re-sort normalized list
      const updated = allMembers.map((m) => {
        const mBd = getCleanBdNo(m['BD No'] || m.bdNo || m.airman_id);
        if (mBd === cleanBd) {
          const copy = { ...m };
          delete copy.Seniority;
          delete copy.seniority;
          return copy;
        }
        return m;
      });
      const reSorted = normalizeCanteenMembersSeniority(updated);
      setSaveSuccess(true);
      setTimeout(() => {
        onSuccess(reSorted);
        onClose();
      }, 600);
    } catch (err: any) {
      setErrorMessage('রিসেট করতে ব্যর্থ হয়েছে।');
    } finally {
      setIsSaving(false);
    }
  };

  const memberDp = resolveImageUrl(member.DP);
  const banglaRank = getMemberBanglaRank(member) || formatRankBn(member['Rank']);
  const banglaName = getMemberBanglaName(member) || formatMemberNameBn(member['Surname']);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-emerald-500/40 flex items-center justify-center overflow-hidden shrink-0 shadow">
              {memberDp ? (
                <img
                  src={memberDp}
                  alt={member['Surname']}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <span className="font-black text-xl text-emerald-400">
                  {(member['Surname'] || 'U').charAt(0)}
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 font-mono">
                  {rank || '-'}
                </span>
                {banglaRank && (
                  <span className="text-indigo-300 font-sans text-xs font-bold">
                    ({banglaRank})
                  </span>
                )}
                <h3 className="text-base font-black text-white">
                  {member['Surname']}
                </h3>
                {banglaName && (
                  <span className="text-emerald-400 font-sans text-xs font-bold">
                    ({banglaName})
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-400 font-mono mt-0.5">
                BD No: {member['BD No'] || member.bdNo || '-'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Seniority Settings Box (Exactly matching office app's Biodata Register) */}
          <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl space-y-3 shadow-inner">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="block text-xs font-black text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                <Award className="w-4 h-4 text-emerald-400" />
                <span>Seniority / জ্যেষ্ঠতা নম্বর ({rank || 'Member'})</span>
              </label>
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="text-[10px] font-mono font-bold bg-indigo-950/80 text-indigo-200 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                  {rank || 'Rank'} Range: #{rankRange.minSeniority} - #{rankRange.maxSeniority}
                </span>
                <span className="text-[10px] font-mono font-bold bg-emerald-900/60 text-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                  Current: #{currentSeniority}
                </span>
              </div>
            </div>

            {/* Input with # Prefix */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-mono font-black text-base shrink-0 shadow-md">
                  #
                </div>
                <input
                  type="number"
                  min="1"
                  max={normalizedMembers?.length || 999}
                  value={seniorityInput}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Math.max(1, Number(e.target.value));
                    setSeniorityInput(val);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder={`e.g. 1 (seniormost of ${rank || 'rank'}) or #${rankRange.minSeniority}`}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-emerald-500/40 focus:border-emerald-400 rounded-xl text-base font-black text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 font-mono shadow-inner transition-all"
                  autoFocus
                />
              </div>

              {/* Quick Select Buttons */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick:</span>
                <button
                  type="button"
                  onClick={() => setSeniorityInput(1)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-emerald-900/40 text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors cursor-pointer"
                >
                  ১ম (জ্যেষ্ঠতম) #{rankRange.minSeniority}
                </button>
                {rankRange.totalInRank > 2 && (
                  <button
                    type="button"
                    onClick={() => setSeniorityInput(Math.floor((rankRange.minSeniority + rankRange.maxSeniority) / 2))}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    মাঝামাঝি
                  </button>
                )}
                {rankRange.totalInRank > 1 && (
                  <button
                    type="button"
                    onClick={() => setSeniorityInput(rankRange.maxSeniority)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                  >
                    কনিষ্ঠতম #{rankRange.maxSeniority}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleResetToAuto}
                  disabled={isSaving}
                  className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700 border border-slate-700/60 transition-colors cursor-pointer flex items-center gap-1"
                  title="BD No অনুসারে স্বয়ংক্রিয় ক্রম রিসেট করুন"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Auto (BD No)</span>
                </button>
              </div>
            </div>

            {/* Dynamic Feedback showing resolved position */}
            {targetResolved && (
              <div className="text-xs font-bold text-emerald-200 bg-emerald-950/70 p-3 rounded-xl border border-emerald-500/40 flex items-center space-x-2.5 animate-in fade-in duration-150">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span>
                  লক্ষ্য ক্রম: <strong className="font-mono text-emerald-300 text-sm">#{targetResolved.resolvedSeniority}</strong> ({rank}-এর {targetResolved.relativeRankIndex === 1 ? '১ম (জ্যেষ্ঠতম)' : `${targetResolved.relativeRankIndex}তম`} ব্যক্তি হিসেবে নির্ধারিত হবে)
                </span>
              </div>
            )}

            {/* Explanation Note */}
            <p className="text-[11px] text-emerald-300/80 leading-relaxed font-medium">
              পদোন্নতির তারিখ বা ব্যাচ জ্যেষ্ঠতা অনুসারে ম্যানুয়ালি ক্রম পরিবর্তন করা যায়। সামরিক পদমর্যাদার নিয়ম অক্ষুণ্ণ রেখে মধ্যবর্তী সদস্যদের ক্রম স্বয়ংক্রিয়ভাবে সাজানো হবে এবং এটি অফিস Biodata Register-এ তাৎক্ষণিক সিঙ্ক হবে।
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-950/80 border border-rose-500/40 rounded-xl text-xs text-rose-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-500/50 rounded-xl text-xs text-emerald-200 flex items-center space-x-2 animate-in fade-in">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>জ্যেষ্ঠতা নম্বর সফলভাবে সংরক্ষিত এবং সিঙ্ক হয়েছে!</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            বাতিল / Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || seniorityInput === ''}
            className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 shadow-lg transition-all ${
              isSaving || seniorityInput === ''
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-900/30 cursor-pointer active:scale-95'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>সংরক্ষণ হচ্ছে...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>সংরক্ষিত!</span>
              </>
            ) : (
              <>
                <Award className="w-4 h-4 text-emerald-200" />
                <span>জ্যেষ্ঠতা সংরক্ষণ করুন</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

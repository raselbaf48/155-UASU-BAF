import React, { useState, useEffect } from 'react';
import { X, UserPlus, Check, AlertCircle, Edit3 } from 'lucide-react';
import { BAF_RANKS_WITH_BN, getMemberBanglaRank, getMemberBanglaName } from '../utils/memberBanglaNames';
import { supabase } from '../../../supabase';
import { sortCanteenMembersByOfficeSeniority, isAirmanMember } from '../utils/canteenSeniority';
import { setCanteenMembersCache, fetchCanteenMembersOnce } from '../utils/canteenMenuData';
import { pushKeyToCloud } from '../utils/canteenCloudSync';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberAdded?: (newMember: any) => void;
  onMemberUpdated?: (updatedMember: any) => void;
  existingMembers: any[];
  memberToEdit?: any | null;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  isOpen,
  onClose,
  onMemberAdded,
  onMemberUpdated,
  existingMembers,
  memberToEdit = null
}) => {
  const isEditMode = Boolean(memberToEdit);

  const [bdNo, setBdNo] = useState('');
  const [rank, setRank] = useState('LAC');
  const [rankBn, setRankBn] = useState('এলএসি');
  const [surname, setSurname] = useState('');
  const [nameBn, setNameBn] = useState('');
  const [contact, setContact] = useState('');
  const [dp, setDp] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Pre-fill fields when memberToEdit changes or modal opens
  useEffect(() => {
    if (memberToEdit) {
      const rawBd = String(memberToEdit['BD No'] || memberToEdit.bdNo || memberToEdit.airman_id || '').replace(/\D/g, '').trim();
      const currentRank = memberToEdit.Rank || memberToEdit.rank || 'LAC';
      const currentSurname = memberToEdit.Surname || memberToEdit.surname || memberToEdit.Name || '';
      const currentContact = String(memberToEdit.Contact || memberToEdit.contact || memberToEdit['Mobile No'] || '').replace(/\D/g, '');
      const currentDp = memberToEdit.DP || memberToEdit.dp || '';
      const currentNameBn = memberToEdit.Name_BN || memberToEdit.name_bn || memberToEdit.nameBn || getMemberBanglaName(memberToEdit) || '';
      const currentRankBn = memberToEdit.Rank_BN || memberToEdit.rank_bn || memberToEdit.rankBn || getMemberBanglaRank(memberToEdit) || '';

      setBdNo(rawBd);
      setRank(currentRank);
      setRankBn(currentRankBn);
      setSurname(currentSurname);
      setNameBn(currentNameBn);
      setContact(currentContact);
      setDp(currentDp);
    } else {
      setBdNo('');
      setRank('LAC');
      setRankBn('এলএসি');
      setSurname('');
      setNameBn('');
      setContact('');
      setDp('');
    }
    setErrorMsg('');
    setSuccessMsg('');
  }, [memberToEdit, isOpen]);

  if (!isOpen) return null;

  const cleanBd = bdNo.replace(/\D/g, '').trim();
  const cleanBdNoZero = cleanBd.replace(/^0+/, '');

  const oldCleanBd = memberToEdit
    ? String(memberToEdit['BD No'] || memberToEdit.bdNo || memberToEdit.airman_id || '').replace(/\D/g, '').trim()
    : '';

  // Duplicate check: In edit mode, ignore the member being edited!
  const existingDuplicateMember = cleanBd ? existingMembers.find(m => {
    if (isEditMode && memberToEdit) {
      const isSameMember = 
        (m.airman_id && memberToEdit.airman_id && m.airman_id === memberToEdit.airman_id) ||
        (oldCleanBd && String(m['BD No'] || m.bdNo || '').replace(/\D/g, '') === oldCleanBd);
      if (isSameMember) return false;
    }
    const mBd = String(m['BD No'] || m.bdNo || '').replace(/\D/g, '');
    const mBdNoZero = mBd.replace(/^0+/, '');
    if (!mBd) return false;
    return mBd === cleanBd || (cleanBdNoZero && mBdNoZero === cleanBdNoZero);
  }) : null;

  const isDuplicateBd = Boolean(existingDuplicateMember);

  const handleRankChange = (newRank: string) => {
    setRank(newRank);
    const autoBn = getMemberBanglaRank({ Rank: newRank });
    setRankBn(autoBn || '');
  };

  const handleSurnameChange = (newSurname: string) => {
    setSurname(newSurname);
    if (!nameBn || nameBn === getMemberBanglaName({ Surname: surname })) {
      const autoBn = getMemberBanglaName({ Surname: newSurname, "BD No": cleanBd });
      if (autoBn) setNameBn(autoBn);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!cleanBd) {
      setErrorMsg('অনুগ্রহ করে সঠিক বিডি নম্বর দিন (শুধুমাত্র সংখ্যা)।');
      return;
    }

    if (isDuplicateBd) {
      setErrorMsg(`বিডি নম্বর #${cleanBd} ইতিমধ্যে সদস্য "${existingDuplicateMember?.Rank || ''} ${existingDuplicateMember?.Surname || ''}" এর জন্য নিবন্ধিত আছে! একই বিডি নম্বরে ডুপ্লিকেট সদস্য তৈরি করা যাবে না।`);
      return;
    }

    if (!surname.trim()) {
      setErrorMsg('সদস্যের নাম (Surname) প্রদান করা বাধ্যতামূলক।');
      return;
    }

    const cleanContact = contact.replace(/\D/g, '').trim();
    if (cleanContact.length > 0 && cleanContact.length !== 11) {
      setErrorMsg(`মোবাইল নম্বর প্রদান করলে অবশ্যই ১১ ডিজিটের হতে হবে (যেমন: 017xxxxxxxx)। বর্তমানে ${cleanContact.length} ডিজিট রয়েছে।`);
      return;
    }

    setIsSaving(true);

    try {
      const oldAirmanId = memberToEdit?.airman_id || (oldCleanBd ? `airman-${oldCleanBd}` : `airman-${cleanBd}`);
      const newAirmanId = (memberToEdit?.airman_id && !memberToEdit.airman_id.startsWith('airman-') && cleanBd === oldCleanBd)
        ? memberToEdit.airman_id
        : `airman-${cleanBd}`;

      const isBdChanged = isEditMode && (cleanBd !== oldCleanBd || oldAirmanId !== newAirmanId);

      const targetMemberPayload: any = {
        ...(memberToEdit || {}),
        airman_id: newAirmanId,
        "BD No": cleanBd,
        bdNo: cleanBd,
        "Rank": rank === '-' ? '-' : (rank.trim() || 'LAC'),
        "Surname": surname.trim(),
        "Contact": cleanContact || '',
        "Role": memberToEdit?.Role || 'Member',
        DP: dp.trim() || memberToEdit?.DP || null,
        Due: memberToEdit?.Due ?? memberToEdit?.due ?? 0,
        due: memberToEdit?.Due ?? memberToEdit?.due ?? 0,
        baki: memberToEdit?.baki ?? memberToEdit?.Due ?? 0,
        Seniority: memberToEdit?.Seniority ?? memberToEdit?.seniority ?? 999,
        seniority: memberToEdit?.Seniority ?? memberToEdit?.seniority ?? 999,
        Name_BN: nameBn.trim() || null,
        name_bn: nameBn.trim() || null,
        nameBn: nameBn.trim() || null,
        Rank_BN: rankBn.trim() || null,
        rank_bn: rankBn.trim() || null,
        rankBn: rankBn.trim() || null,
        active: true
      };

      // 1. Transaction migration if BD changed or editing member
      if (isEditMode) {
        try {
          const rawLocalTxs = localStorage.getItem('canteen_txs');
          if (rawLocalTxs) {
            let txs = JSON.parse(rawLocalTxs);
            let hasTxModified = false;
            txs = txs.map((t: any) => {
              const isMatch = 
                (t.airman_id && (t.airman_id === oldAirmanId || t.airman_id === newAirmanId)) ||
                (oldCleanBd && String(t.bdNo || '').replace(/\D/g, '') === oldCleanBd);
              if (isMatch) {
                hasTxModified = true;
                return {
                  ...t,
                  airman_id: newAirmanId,
                  bdNo: cleanBd,
                  memberName: (targetMemberPayload.Rank !== '-' ? `${targetMemberPayload.Rank} ` : '') + targetMemberPayload.Surname,
                  rank: targetMemberPayload.Rank
                };
              }
              return t;
            });

            if (hasTxModified) {
              localStorage.setItem('canteen_txs', JSON.stringify(txs));
              pushKeyToCloud('canteen_txs', txs).catch(() => {});
              window.dispatchEvent(new CustomEvent('canteen_txs_updated', { detail: txs }));
            }
          }
        } catch (txErr) {
          console.warn('Transaction migration warning:', txErr);
        }
      }

      // 2. Immediate Local Save & Caching
      let updatedMembers: any[];
      if (isEditMode) {
        // Replace existing member in-place
        updatedMembers = existingMembers.map(m => {
          const isTarget = 
            (m.airman_id && (m.airman_id === oldAirmanId || m.airman_id === newAirmanId)) ||
            (oldCleanBd && String(m['BD No'] || m.bdNo || '').replace(/\D/g, '') === oldCleanBd);
          if (isTarget) {
            return targetMemberPayload;
          }
          return m;
        });

        // Filter out any accidental remaining duplicates of the old member
        if (isBdChanged) {
          updatedMembers = updatedMembers.filter(m => {
            if (m.airman_id === newAirmanId) return true;
            if (m.airman_id === oldAirmanId) return false;
            const mBd = String(m['BD No'] || m.bdNo || '').replace(/\D/g, '');
            if (oldCleanBd && mBd === oldCleanBd) return false;
            return true;
          });
        }
      } else {
        // Add new member
        updatedMembers = [
          targetMemberPayload,
          ...existingMembers.filter(m => {
            const mBd = String(m['BD No'] || '').replace(/\D/g, '');
            const mAid = String(m.airman_id || '').trim().toLowerCase();
            return mAid !== targetMemberPayload.airman_id.toLowerCase() && (!cleanBd || mBd !== cleanBd);
          })
        ];
      }

      const sorted = sortCanteenMembersByOfficeSeniority(updatedMembers);
      setCanteenMembersCache(sorted);

      try {
        localStorage.setItem('canteen_members_cache', JSON.stringify(sorted));
        if (oldCleanBd && oldCleanBd !== cleanBd) {
          localStorage.removeItem(`canteen_member_${oldCleanBd}`);
        }
        localStorage.setItem(`canteen_member_${cleanBd}`, JSON.stringify({
          dp: targetMemberPayload.DP || '',
          due: targetMemberPayload.Due || 0,
          rank: targetMemberPayload.Rank,
          surname: targetMemberPayload.Surname,
          contact: targetMemberPayload.Contact,
          bdNo: cleanBd
        }));
      } catch {}

      // 3. Dispatch events so all pages (POS Sales, Member DB, Due Register, etc.) update instantly
      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: sorted }));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('storage'));

      // 4. Direct Cloud Sync to Supabase Canteen_Member
      try {
        const supabaseRecord = {
          airman_id: targetMemberPayload.airman_id,
          "BD No": cleanBd,
          Rank: targetMemberPayload.Rank,
          Surname: targetMemberPayload.Surname,
          Contact: targetMemberPayload.Contact || '',
          Role: targetMemberPayload.Role,
          DP: targetMemberPayload.DP,
          Due: targetMemberPayload.Due ?? 0,
          Seniority: targetMemberPayload.Seniority,
          Name_BN: targetMemberPayload.Name_BN,
          Rank_BN: targetMemberPayload.Rank_BN,
          active: true,
          updated_at: new Date().toISOString()
        };

        // If BD was changed, remove old record from database first to guarantee no duplicate
        if (isBdChanged) {
          if (oldAirmanId) {
            await supabase.from('Canteen_Member').delete().eq('airman_id', oldAirmanId);
            await supabase.from('Canteen').delete().eq('airman_id', oldAirmanId);
          }
          if (oldCleanBd) {
            await supabase.from('Canteen_Member').delete().eq('BD No', oldCleanBd);
            await supabase.from('Canteen_Member').delete().eq('airman_id', `airman-${oldCleanBd}`);
            await supabase.from('Canteen').delete().eq('BD No', oldCleanBd);
            await supabase.from('Canteen').delete().eq('airman_id', `airman-${oldCleanBd}`);
          }
        }

        const { error: upsertErr } = await supabase
          .from('Canteen_Member')
          .upsert([supabaseRecord], { onConflict: 'airman_id' });

        if (upsertErr) {
          console.warn('Supabase Canteen_Member upsert warning:', upsertErr);
        }
        await fetchCanteenMembersOnce(true);
      } catch (cloudErr) {
        console.warn('Cloud save warning for member:', cloudErr);
      }

      setSuccessMsg(
        isEditMode
          ? `সদস্য #${cleanBd} (${targetMemberPayload.Surname}) এর তথ্য সফলভাবে আপডেট করা হয়েছে!`
          : `Member #${cleanBd} (${targetMemberPayload.Surname}) successfully added!`
      );

      if (isEditMode && onMemberUpdated) {
        onMemberUpdated(targetMemberPayload);
      } else if (!isEditMode && onMemberAdded) {
        onMemberAdded(targetMemberPayload);
      }

      setTimeout(() => {
        setIsSaving(false);
        onClose();
      }, 700);

    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving member');
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              {isEditMode ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white">
                {isEditMode ? 'Edit Member Profile' : 'Add New Member'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditMode ? 'সদস্যের তথ্য পরিবর্তন ও আপডেট করুন' : 'ক্যান্টিনে নতুন সদস্য যুক্ত করুন'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center space-x-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* BD No */}
          <div>
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider block mb-1">
              BD No / সার্ভিস নম্বর <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 474455 (শুধুমাত্র সংখ্যা)"
              value={bdNo}
              onChange={(e) => setBdNo(e.target.value.replace(/\D/g, ''))}
              className={`w-full bg-slate-950 text-white rounded-xl px-3 py-2.5 text-xs font-mono font-bold border focus:outline-none focus:ring-2 ${
                isDuplicateBd 
                  ? 'border-rose-500/80 focus:ring-rose-500/30' 
                  : 'border-slate-700 focus:border-indigo-500 focus:ring-indigo-500/30'
              }`}
            />
            {isDuplicateBd && (
              <p className="text-[11px] font-bold text-rose-400 mt-1">
                ⚠️ এই BD নম্বর (#{cleanBd}) ইতিমধ্যে রয়েছে!
              </p>
            )}
          </div>

          {/* Rank: English on Left, Bangla on Right */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider block mb-1">
                Rank / পদবি (English) <span className="text-rose-400">*</span>
              </label>
              <select
                value={rank}
                onChange={(e) => handleRankChange(e.target.value)}
                className="w-full bg-slate-950 text-white rounded-xl px-2.5 py-2.5 text-xs font-bold border border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 cursor-pointer"
              >
                {BAF_RANKS_WITH_BN.map(item => (
                  <option key={item.rank} value={item.rank}>
                    {item.rank === '-' ? '- (Without Rank)' : `${item.rank} — ${item.bn}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-black text-emerald-400 uppercase tracking-wider block mb-1">
                পদবি বাংলায়
              </label>
              <input
                type="text"
                placeholder="e.g. এলএসি, কর্পোরাল..."
                value={rankBn}
                onChange={(e) => setRankBn(e.target.value)}
                className="w-full bg-slate-950 text-emerald-300 placeholder-slate-600 rounded-xl px-2.5 py-2.5 text-xs font-bold border border-emerald-500/40 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* Name: Surname (EN) on Left, Bangla Name on Right */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider block mb-1">
                Surname / Name (EN) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Jahid, Sonia..."
                value={surname}
                onChange={(e) => handleSurnameChange(e.target.value)}
                className="w-full bg-slate-950 text-white rounded-xl px-3 py-2.5 text-xs font-bold border border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            <div>
              <label className="text-xs font-black text-emerald-400 uppercase tracking-wider block mb-1">
                বাংলা নাম
              </label>
              <input
                type="text"
                placeholder="e.g. জাহিদ, সোনিয়া..."
                value={nameBn}
                onChange={(e) => setNameBn(e.target.value)}
                className="w-full bg-slate-950 text-emerald-300 placeholder-slate-600 rounded-xl px-3 py-2.5 text-xs font-bold border border-emerald-500/40 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* Contact (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-slate-300 uppercase tracking-wider">
                Mobile / Contact (ঐচ্ছিক)
              </label>
              {contact && (
                <span className="text-[10px] font-mono text-slate-400">
                  {contact.length}/11 digits
                </span>
              )}
            </div>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={11}
              placeholder="e.g. 01712345678 (১১ ডিজিট)"
              value={contact}
              onChange={(e) => setContact(e.target.value.replace(/\D/g, '').slice(0, 11))}
              className="w-full bg-slate-950 text-white rounded-xl px-3 py-2.5 text-xs font-mono font-bold border border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Photo / DP URL (Optional) */}
          <div>
            <label className="text-xs font-black text-slate-300 uppercase tracking-wider block mb-1">
              Photo URL / ছবি (ঐচ্ছিক)
            </label>
            <input
              type="text"
              placeholder="Image link / data URL..."
              value={dp}
              onChange={(e) => setDp(e.target.value)}
              className="w-full bg-slate-950 text-white rounded-xl px-3 py-2.5 text-xs font-bold border border-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isDuplicateBd || !cleanBd || !surname.trim()}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center space-x-1.5"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{isEditMode ? 'Update Member' : 'Save Member'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

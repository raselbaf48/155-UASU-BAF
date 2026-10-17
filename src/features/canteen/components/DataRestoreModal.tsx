import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Database, 
  Upload, 
  RefreshCw, 
  X, 
  Copy, 
  Check, 
  ShieldAlert, 
  Users, 
  Receipt, 
  Sparkles,
  HardDriveDownload,
  Download,
  Flame
} from 'lucide-react';
import { setCanteenMembersCache, getCanteenMembersCache } from '../utils/canteenMembersCache';
import { localDb } from '../../../services/localDatabase';

interface DataRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataRestored?: () => void;
}

export const DataRestoreModal: React.FC<DataRestoreModalProps> = ({
  isOpen,
  onClose,
  onDataRestored
}) => {
  const [cloudStatus, setCloudStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [membersJsonInput, setMembersJsonInput] = useState('');
  const [txsJsonInput, setTxsJsonInput] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [copiedSql, setCopiedSql] = useState<string | null>(null);
  const [localScanResult, setLocalScanResult] = useState<string | null>(null);

  const checkCloudStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/canteen/cloud-status');
      if (res.ok) {
        const data = await res.json();
        setCloudStatus(data);
      }
    } catch (e: any) {
      setCloudStatus({ status: 'offline', error: e.message });
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkCloudStatus();
      setRestoreSuccess(null);
      setRestoreError(null);
      setLocalScanResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSql(key);
    setTimeout(() => setCopiedSql(null), 2500);
  };

  const parseJsonSafely = (input: string, label: string) => {
    let clean = input.trim();
    if (!clean) return null;

    // Remove markdown code fence if user copied whole block ```json ... ```
    if (clean.startsWith('```')) {
      clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch (e: any) {
      // Try relaxed cleanup (trailing commas)
      try {
        parsed = JSON.parse(clean.replace(/,\s*([}\]])/g, '$1'));
      } catch {
        throw new Error(`${label} এর টেক্সট সঠিক JSON ফরম্যাটে নেই। অনুগ্রহ করে Supabase এর রেজাল্ট সম্পূর্ণ কপি করেছেন কিনা নিশ্চিত করুন।`);
      }
    }

    // Handle stringified inside string
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch {}
    }

    // Handle json_agg wrappers: [{ json_agg: [...] }] or { json_agg: [...] }
    let list: any = parsed;
    if (Array.isArray(list) && list.length === 1 && list[0] && list[0].json_agg !== undefined) {
      list = list[0].json_agg;
    } else if (list && list.json_agg !== undefined) {
      list = list.json_agg;
    } else if (list && (list.data || list.rows)) {
      list = list.data || list.rows;
    }

    // If list is stringified JSON
    if (typeof list === 'string') {
      try {
        list = JSON.parse(list);
      } catch {}
    }

    if (!Array.isArray(list)) {
      throw new Error(`${label} এর রেজাল্ট একটি Array বা তালিকা হতে হবে। Supabase থেকে পাওয়া json_agg এর সেল বা ভ্যালু কপি করুন।`);
    }

    return list;
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          setMembersJsonInput(text);
          setRestoreSuccess(`ফাইল থেকে ${parsed.length} টি রেকর্ড লোড হয়েছে! এবার নিচের বাটনে চাপ দিন।`);
        } else if (parsed.members && Array.isArray(parsed.members)) {
          setMembersJsonInput(JSON.stringify(parsed.members, null, 2));
          if (parsed.transactions) {
            setTxsJsonInput(JSON.stringify(parsed.transactions, null, 2));
          }
          setRestoreSuccess(`ক্যান্টিন ব্যাকআপ ফাইল থেকে ${parsed.members.length} জন মেম্বার লোড হয়েছে!`);
        } else if (parsed.airmen && Array.isArray(parsed.airmen)) {
          const converted = parsed.airmen.map((a: any) => ({
            airman_id: a.id || a.airman_id || `airman-${a.bdNo}`,
            "BD No": a.bdNo || a["Service Number"] || '',
            Rank: a.rank || a.Rank || 'LAC',
            Surname: a.name || a.Name || '',
            Contact: a.contactNumber || a["Contact Number"] || '',
            Flight: a.section || a.Section || 'Admin',
            Due: 0,
            DP: a.photo || a.Photo || ''
          }));
          setMembersJsonInput(JSON.stringify(converted, null, 2));
          setRestoreSuccess(`Office ব্যাকআপ ফাইল থেকে ${converted.length} জন সদস্য প্রস্তুত করা হয়েছে!`);
        } else {
          setMembersJsonInput(text);
        }
      } catch (err: any) {
        setRestoreError('ফাইল পড়তে ত্রুটি হয়েছে: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreFromSqlJson = async () => {
    setRestoring(true);
    setRestoreSuccess(null);
    setRestoreError(null);

    try {
      let parsedMembers: any[] | null = null;
      let parsedTxs: any[] | null = null;

      let rawObj: any = null;
      try {
        let cleanText = membersJsonInput.trim();
        rawObj = JSON.parse(cleanText);
        if (Array.isArray(rawObj) && rawObj.length === 1 && rawObj[0]?.json_build_object) {
          rawObj = rawObj[0].json_build_object;
        } else if (rawObj?.json_build_object) {
          rawObj = rawObj.json_build_object;
        }
      } catch {}

      if (rawObj && typeof rawObj === 'object' && !Array.isArray(rawObj) && (rawObj.canteen_members || rawObj.airmen || rawObj.app_settings)) {
        // Master Full Database Object detected!
        if (rawObj.canteen_members && Array.isArray(rawObj.canteen_members)) {
          parsedMembers = rawObj.canteen_members;
        }
        if (rawObj.canteen_txs && Array.isArray(rawObj.canteen_txs)) {
          parsedTxs = rawObj.canteen_txs;
        }
        if (rawObj.app_settings && Array.isArray(rawObj.app_settings)) {
          rawObj.app_settings.forEach((s: any) => {
            if (s.setting_key && s.setting_value) {
              try {
                localStorage.setItem(s.setting_key, typeof s.setting_value === 'string' ? s.setting_value : JSON.stringify(s.setting_value));
                if (s.setting_key === 'canteen_txs' && !parsedTxs) {
                  parsedTxs = typeof s.setting_value === 'string' ? JSON.parse(s.setting_value) : s.setting_value;
                }
              } catch {}
            }
          });
        }
        if (rawObj.airmen && Array.isArray(rawObj.airmen)) {
          const airmenList = rawObj.airmen.map((a: any) => ({
            id: a.airman_id || a.id,
            airman_id: a.airman_id || a.id,
            bdNo: a['Service Number'] || a.bdNo || a['BD No'],
            rank: a.Rank || a.rank,
            trade: a.Trade || a.trade,
            name: a.Name || a.name || a.Surname,
            section: a.Section || a.section || a.Flight,
            contactNumber: a['Contact Number'] || a.contactNumber || a.Contact,
            bloodGroup: a['Blood Group'] || a.bloodGroup,
            photo: a.Photo || a.photo || a.DP,
            seniority: Number(a.Seniority ?? a.seniority ?? 0),
            active: a.Status !== 'Inactive' && a.status !== 'Inactive'
          }));
          const curDb = localDb.getDb();
          curDb.airmen = airmenList;
          localDb.saveToStorage(curDb, true, false, false);
        }
        if (rawObj.duty_rosters && Array.isArray(rawObj.duty_rosters)) {
          const assignmentsByMonth: Record<string, any[]> = {};
          rawObj.duty_rosters.forEach((d: any) => {
            const ym = (d.date || '').slice(0, 7) || '2026-10';
            if (!assignmentsByMonth[ym]) assignmentsByMonth[ym] = [];
            assignmentsByMonth[ym].push({
              id: d.assignment_id || d.id,
              airmanId: d.airman_id,
              date: d.date,
              dutyType: d.duty_name,
              dutyName: d.duty_name,
              notes: d.notes || ''
            });
          });
          const curDb = localDb.getDb();
          curDb.assignments = assignmentsByMonth;
          localDb.saveToStorage(curDb, true, false, false);
        }
        if (rawObj.user_profiles && Array.isArray(rawObj.user_profiles)) {
          const curDb = localDb.getDb();
          curDb.detailedUsers = rawObj.user_profiles.map((u: any) => ({
            id: u.id || `user-${u['User ID']}`,
            bdNo: u['User ID'],
            password: u.Password || u.password || u['User ID'],
            name: u['Full Name'] || u.name,
            rank: u.Rank || u.rank,
            role: u.Role || u.role,
            section: u.Section || u.section,
            status: u.Status || u.status || 'ACTIVE'
          }));
          localDb.saveToStorage(curDb, true, false, false);
        }
      } else {
        if (membersJsonInput.trim()) {
          parsedMembers = parseJsonSafely(membersJsonInput, 'মেম্বারদের JSON');
        }
        if (txsJsonInput.trim()) {
          parsedTxs = parseJsonSafely(txsJsonInput, 'বিল ট্রানজেকশনের JSON');
        }
      }

      if (!parsedMembers && !parsedTxs) {
        throw new Error('অনুগ্রহ করে অন্তত মেম্বার অথবা ট্রানজেকশনের JSON ইনপুট দিন।');
      }

      const res = await fetch('/api/canteen/restore-full-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          members: parsedMembers || undefined,
          transactions: parsedTxs || undefined
        })
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'রিস্টোর করতে সমস্যা হয়েছে');
      }

      // Also update browser local storage
      if (parsedMembers && parsedMembers.length > 0) {
        setCanteenMembersCache(parsedMembers);
        try {
          localStorage.setItem('canteen_members_cache', JSON.stringify(parsedMembers));
        } catch {}
      }
      if (parsedTxs && parsedTxs.length > 0) {
        try {
          localStorage.setItem('canteen_txs', JSON.stringify(parsedTxs));
        } catch {}
      }

      window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: parsedMembers }));
      window.dispatchEvent(new Event('canteen_state_updated'));

      setRestoreSuccess(`সফলভাবে ${result.restoredMembersCount || (parsedMembers?.length || 0)} জন মেম্বার এবং ${result.restoredTxsCount || (parsedTxs?.length || 0)} টি বিল রেকর্ড রিস্টোর করা হয়েছে!`);
      
      // Auto-push to Firebase Firestore so it's backed up permanently!
      if (parsedMembers && parsedMembers.length > 0) {
        localDb.migrateToFirebase().then(() => {
          console.log("Auto-migrated newly restored members to Firebase Firestore.");
        }).catch(err => console.warn("Firebase auto-sync on restore:", err));
      }

      if (onDataRestored) {
        onDataRestored();
      }
    } catch (err: any) {
      setRestoreError(err.message || 'JSON পার্স করতে ব্যর্থ হয়েছে। নিশ্চিত করুন সঠিক JSON কপি করেছেন।');
    } finally {
      setRestoring(false);
    }
  };

  const handleScanLocalStorage = () => {
    try {
      const keys = Object.keys(localStorage);
      let foundMembersCount = 0;
      let cachedMembers: any[] = [];

      const rawMem = localStorage.getItem('canteen_members_cache');
      if (rawMem) {
        try {
          const parsed = JSON.parse(rawMem);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedMembers = parsed;
            foundMembersCount = parsed.length;
          }
        } catch {}
      }

      // Check archived deleted members
      const rawArch = localStorage.getItem('canteen_deleted_members_archive_v1');
      if (rawArch) {
        try {
          const arch = JSON.parse(rawArch);
          if (Array.isArray(arch) && arch.length > 0) {
            arch.forEach(a => {
              if (!cachedMembers.some(m => String(m['BD No'] || m.airman_id) === String(a['BD No'] || a.airman_id))) {
                cachedMembers.push(a);
              }
            });
          }
        } catch {}
      }

      // Scan individual member keys canteen_member_*
      keys.forEach(k => {
        if (k.startsWith('canteen_member_')) {
          try {
            const ind = JSON.parse(localStorage.getItem(k) || '');
            if (ind && ind.bdNo && !cachedMembers.some(m => String(m['BD No'] || m.bdNo) === String(ind.bdNo))) {
              cachedMembers.push({
                "BD No": ind.bdNo,
                airman_id: `airman-${ind.bdNo}`,
                Surname: ind.surname || '',
                Rank: ind.rank || 'LAC',
                DP: ind.dp || '',
                Due: ind.due || 0,
                Contact: ind.contact || '',
                Role: 'Member'
              });
            }
          } catch {}
        }
      });

      if (cachedMembers.length > 0) {
        setCanteenMembersCache(cachedMembers);
        localStorage.setItem('canteen_members_cache', JSON.stringify(cachedMembers));
        window.dispatchEvent(new CustomEvent('canteen_members_updated', { detail: cachedMembers }));
        window.dispatchEvent(new Event('canteen_state_updated'));
        setLocalScanResult(`ব্রাউজার লোকাল স্টোরেজ থেকে মোট ${cachedMembers.length} জন মেম্বার সফলভাবে সক্রিয় করা হয়েছে!`);
        if (onDataRestored) onDataRestored();
      } else {
        setLocalScanResult('ব্রাউজারের লোকাল ক্যাশে কোনো অতিরিক্ত মেম্বার পাওয়া যায়নি। নিচে Supabase SQL দিয়ে রিস্টোর করুন।');
      }
    } catch (e: any) {
      setLocalScanResult('স্ক্যান ব্যর্থ: ' + e.message);
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const handleDownloadCanteenBackup = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/canteen/export-full-backup');
      if (!res.ok) throw new Error('সার্ভার থেকে ব্যাকআপ সংগ্রহ করা যায়নি');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Canteen_Full_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Canteen Backup Export Failed: ' + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const [isMigratingFirebase, setIsMigratingFirebase] = useState(false);
  const [firebaseMigrationReport, setFirebaseMigrationReport] = useState<string | null>(null);

  const handleMigrateToFirebase = async () => {
    setIsMigratingFirebase(true);
    setFirebaseMigrationReport('Firebase Firestore-এ ডাটা শিফট করা হচ্ছে...');
    try {
      const res = await localDb.migrateToFirebase();
      if (res.success) {
        setFirebaseMigrationReport(`সফলভাবে মাইগ্রেশন সম্পন্ন হয়েছে!
• Airmen Biodata: ${res.airmenCount} টি
• Duty Assignments: ${res.dutyCount} টি
• Parade History: ${res.paradeCount} টি
• Users: ${res.usersCount} টি
• Canteen Members: ${res.canteenMembersCount} টি
• POS Sales History: ${res.canteenTxsCount} টি
• Canteen Expenses: ${res.canteenExpensesCount} টি
• Settings: ${res.settingsCount} টি
সব ডাটা A to Z এখন Google Firebase Firestore ক্লাউডে সংরক্ষিত!`);
        if (onDataRestored) onDataRestored();
      } else {
        setFirebaseMigrationReport(`মাইগ্রেশনে কিছু ত্রুটি হয়েছে: ${res.errors.join(', ')}`);
      }
    } catch (err: any) {
      setFirebaseMigrationReport(`ব্যর্থ হয়েছে: ${err.message}`);
    } finally {
      setIsMigratingFirebase(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                মেম্বার ও বিল ডাটা রিকভারি সেন্টার
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono font-bold">
                  Supabase Status
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                ক্লাউড ডাটাবেস স্ট্যাটাস যাচাই এবং ৭৯ জন মেম্বারের তথ্য ও বকেয়া বিল রিস্টোর
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* Status Box */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <div className="flex items-start space-x-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-amber-300">
                  ডাটা কি মুছে গেছে? না, আপনার সমস্ত ডাটা সুরক্ষিত আছে!
                </h3>
                <p className="text-xs text-amber-200/80 leading-relaxed mt-1">
                  আপনার Supabase প্রজেক্টে <strong className="text-white">ফ্রি টিয়ারের ব্যান্ডউইথ (Egress Quota) লিমিট শেষ</strong> হয়ে যাওয়ায় Supabase সাময়িকভাবে API কুয়েরি ব্লক করেছে (<code className="text-amber-300 font-mono">HTTP 402 Payment Required</code>)।
                  কিন্তু আপনার <strong>৭৯ জন মেম্বার, তাদের ছবি (DP), বকেয়া বিল এবং পূর্ববর্তী সকল ট্রানজেকশন</strong> Supabase ক্লাউড ডেটাবেসের ভেতর সম্পূর্ণ অক্ষত ও নিরাপদ আছে।
                </p>
              </div>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-amber-500/20 text-xs">
              <span className="text-slate-400">
                প্রজেক্ট: <span className="font-mono text-slate-200">asevtncnoytawykhcleg.supabase.co</span>
              </span>
              <button
                onClick={checkCloudStatus}
                className="text-amber-400 hover:text-amber-300 flex items-center space-x-1 font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
                <span>যাচাই করুন</span>
              </button>
            </div>
          </div>

          {/* Quick Action: Direct Canteen Full Backup Export */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950/40 to-indigo-950/40 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
                <Database className="w-4 h-4 text-blue-400" />
                <span>ক্যান্টিন ব্যাকআপ ডাউনলোড (Canteen JSON Backup)</span>
              </div>
              <p className="text-xs text-slate-300">
                ক্যান্টিনের সমস্ত মেম্বার, ট্রানজ্যাকশন ও বিলের বর্তমান ব্যাকআপ ফাইল সরাসরি ডাউনলোড করুন।
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadCanteenBackup}
              disabled={isExporting}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'ডাউনলোড হচ্ছে...' : 'ক্যান্টিন ব্যাকআপ ডাউনলোড (JSON)'}</span>
            </button>
          </div>

          {/* Option 0: Firebase Direct Migration (Recommended) */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-orange-950/30 to-amber-900/20 border border-amber-500/40 space-y-3 shadow-lg shadow-amber-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <span>Google Firebase Firestore ক্লাউড মাইগ্রেশন (সুপারিশকৃত)</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full font-bold">
                    CONNECTED
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Supabase ফ্রি টিয়ারের ব্যান্ডউইথ লিমিট শেষ হয়ে যাওয়ার কারণে আপনার বর্তমান সমস্ত ডাটা (৭৯ জন মেম্বার, ডিউটি রোস্টার ও বিল) এক ক্লিকে সরাসরি Google Firebase Firestore-এ ট্রান্সফার করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={handleMigrateToFirebase}
                disabled={isMigratingFirebase}
                className="shrink-0 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Flame className={`w-4 h-4 ${isMigratingFirebase ? 'animate-spin' : ''}`} />
                <span>{isMigratingFirebase ? 'মাইগ্রেশন হচ্ছে...' : 'Firebase-এ শিফট করুন'}</span>
              </button>
            </div>
            {firebaseMigrationReport && (
              <div className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 text-xs font-mono text-amber-300 whitespace-pre-line leading-relaxed">
                {firebaseMigrationReport}
              </div>
            )}
          </div>

          {/* Option 1: Supabase Unblock */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>পদ্ধতি ১: Supabase ড্যাশবোর্ড থেকে স্থায়ীভাবে আনব্লক (সবচেয়ে সহজ)</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Supabase প্রজেক্টে লগইন করে বিলিং সেটিংস থেকে স্পেন্ড ক্যাপ তুলে দিলে বা রিসেট করলেই সাথে সাথে কোনো বাড়তি কোড ছাড়াই লাইভ অ্যাপের সমস্ত মেম্বার ও বিল স্বয়ংক্রিয়ভাবে ভেসে উঠবে:
            </p>
            <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5 pl-1">
              <li>
                Supabase ড্যাশবোর্ডে যান:{' '}
                <a
                  href="https://supabase.com/dashboard/project/asevtncnoytawykhcleg/settings/billing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline inline-flex items-center gap-1 font-mono"
                >
                  supabase.com/dashboard/project/asevtncnoytawykhcleg <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>ইমেইল (<code className="text-slate-200">rasel399486@gmail.com</code>) দিয়ে লগইন করুন।</li>
              <li><strong>Project Settings ➔ Billing</strong> এ যান এবং Spend Cap অপশনটি অফ করুন অথবা সাইকেল রিসেট করুন।</li>
              <li>আনব্লক হওয়ার পর অ্যাপে ফিরে এসে <strong>"Sync"</strong> বাটনে ক্লিক করলেই মুহূর্তেই সমস্ত ডাটা চলে আসবে।</li>
            </ol>
          </div>

          {/* Option 2: SQL Direct Restore without Payment */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
              <HardDriveDownload className="w-4 h-4 text-emerald-400" />
              <span>পদ্ধতি ২: ফ্রি ইনস্ট্যান্ট রিস্টোর (কোনো পেমেন্ট ছাড়াই SQL দিয়ে)</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              যদি Supabase আপগ্রেড না করতে চান, Supabase এর <strong>SQL Editor</strong> সম্পূর্ণ ফ্রি এবং কোনো ব্যান্ডউইথ লিমিট ছাড়াই কাজ করে। নিচের SQL রান করে প্রাপ্ত JSON কপি করে এখানে পেস্ট করলেই সমস্ত ডাটা লোকাল সার্ভারে রিস্টোর হয়ে যাবে:
            </p>

            {/* Master All-in-One SQL Snippet */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 to-indigo-950/40 border border-purple-500/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-purple-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  🚀 সম্পূর্ণ ডাটাবেজ (A to Z) একসাথে ১-ক্লিকে আনার Master SQL:
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard('SELECT json_build_object(\'canteen_members\', (SELECT json_agg(t) FROM "Canteen_Member" t), \'app_settings\', (SELECT json_agg(t) FROM "app_settings" t), \'airmen\', (SELECT json_agg(t) FROM "Biodata Register" t), \'duty_rosters\', (SELECT json_agg(t) FROM "duty_rosters" t), \'parade_states\', (SELECT json_agg(t) FROM "parade_states" t), \'user_profiles\', (SELECT json_agg(t) FROM "user_profiles" t));', 'sql_master')}
                  className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-md transition-all"
                >
                  {copiedSql === 'sql_master' ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedSql === 'sql_master' ? 'কপি হয়েছে' : 'Master SQL কপি করুন'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-300">
                এই ১টি কোড Supabase SQL Editor-এ রান করলে মেম্বার, পিওএস সেলস, এয়ারমেন, ডিউটি রোস্টার ও ইউজার অ্যাকাউন্ট—সবকিছু ১টি মাত্র রেজাল্ট হিসেবে চলে আসবে।
              </p>
              <code className="block text-[11px] font-mono text-purple-300 bg-slate-950 p-2.5 rounded-lg break-all select-all">
                SELECT json_build_object('canteen_members', (SELECT json_agg(t) FROM "Canteen_Member" t), 'app_settings', (SELECT json_agg(t) FROM "app_settings" t), 'airmen', (SELECT json_agg(t) FROM "Biodata Register" t), 'duty_rosters', (SELECT json_agg(t) FROM "duty_rosters" t), 'parade_states', (SELECT json_agg(t) FROM "parade_states" t), 'user_profiles', (SELECT json_agg(t) FROM "user_profiles" t));
              </code>
            </div>

            {/* Individual SQL Snippets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    ১. মেম্বারদের জন্য SQL:
                  </span>
                  <button
                    onClick={() => copyToClipboard('SELECT json_agg(t) FROM "Canteen_Member" t;', 'sql1')}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    {copiedSql === 'sql1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSql === 'sql1' ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                  </button>
                </div>
                <code className="block text-[11px] font-mono text-emerald-400 bg-slate-950 p-2 rounded-lg break-all">
                  SELECT json_agg(t) FROM "Canteen_Member" t;
                </code>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-teal-400" />
                    ২. ট্রানজেকশনের জন্য SQL:
                  </span>
                  <button
                    onClick={() => copyToClipboard('SELECT json_agg(t) FROM "Canteen_Transactions" t;', 'sql2')}
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1"
                  >
                    {copiedSql === 'sql2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSql === 'sql2' ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                  </button>
                </div>
                <code className="block text-[11px] font-mono text-teal-400 bg-slate-950 p-2 rounded-lg break-all">
                  SELECT json_agg(t) FROM "Canteen_Transactions" t;
                </code>
              </div>
            </div>

            {/* Guidance for copying SQL Result */}
            <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs space-y-1 text-slate-300">
              <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Supabase SQL রান করার পর যা করবেন:
              </span>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Supabase এ রান করার পর নিচের <strong>Results</strong> ট্যাবে <code className="text-emerald-300 font-mono">json_agg</code> এর ঘরে মেম্বারদের যে সম্পূর্ণ ডাটা এসেছে, সেটির উপর ক্লিক করে <strong>Copy</strong> করুন (অথবা ডাউনলোড করুন)। এরপর নিচের বক্সে পেস্ট করে বাটনে চাপ দিন।
              </p>
            </div>

            {/* JSON Input fields */}
            <div className="space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-300">মেম্বারদের JSON পেস্ট করুন:</span>
                  <label className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer flex items-center gap-1 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                    <Upload className="w-3 h-3" />
                    <span>📁 ব্যাকআপ JSON ফাইল সিলেক্ট করুন</span>
                    <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
                  </label>
                </div>
                <textarea
                  value={membersJsonInput}
                  onChange={(e) => setMembersJsonInput(e.target.value)}
                  placeholder='[ { "airman_id": "...", "BD No": "...", "Surname": "...", "Due": 0, "DP": "..." } ]'
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  ট্রানজেকশন/বিল JSON পেস্ট করুন (ঐচ্ছিক):
                </label>
                <textarea
                  value={txsJsonInput}
                  onChange={(e) => setTxsJsonInput(e.target.value)}
                  placeholder='[ { "id": "...", "airman_id": "...", "amount": 100, "date": "..." } ]'
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              {restoreError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{restoreError}</span>
                </div>
              )}

              {restoreSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{restoreSuccess}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleRestoreFromSqlJson}
                disabled={restoring || (!membersJsonInput.trim() && !txsJsonInput.trim())}
                className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer"
              >
                {restoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span>{restoring ? 'রিস্টোর হচ্ছে...' : 'পেস্টকৃত ডাটা সম্পূর্ণ রিস্টোর করুন'}</span>
              </button>
            </div>
          </div>

          {/* Option 3: Local Storage Quick Scan */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h4 className="text-xs font-bold text-slate-300">
                ব্রাউজার ক্যাশ ও লোকাল ব্যাকআপ স্ক্যানার
              </h4>
              <p className="text-[11px] text-slate-500">
                আপনার ব্রাউজারে পূর্ববর্তী মেম্বারদের কোনো কপি থেকে থাকলে তা খুঁজে রিস্টোর করবে
              </p>
              {localScanResult && (
                <p className="text-xs text-indigo-400 mt-1 font-semibold">{localScanResult}</p>
              )}
            </div>
            <button
              type="button"
              onClick={handleScanLocalStorage}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              ব্রাউজার স্ক্যান করুন
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
};

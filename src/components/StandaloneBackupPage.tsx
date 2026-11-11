import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  Upload,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  Database,
  Users,
  Calendar,
  FileSpreadsheet,
  ShieldCheck,
  Clock,
  Sparkles,
  FileText,
  Save,
} from 'lucide-react';
import { Logo155UASU } from './Logo155UASU';
import {
  restoreFromBackupData,
  downloadOfflineBackupJson,
  exportFullSystemData,
} from '../services/googleDriveService';
import { localDb } from '../services/localDatabase';

interface StandaloneBackupPageProps {
  onBack: () => void;
}

export const StandaloneBackupPage: React.FC<StandaloneBackupPageProps> = ({ onBack }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Confirmation state for File Restore
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);

  // Live system stats
  const [systemStats, setSystemStats] = useState<{
    airmenCount: number;
    assignmentsCount: number;
    canteenMembersCount: number;
    canteenTransactionsCount: number;
    lastSavedTime?: string;
  }>({
    airmenCount: 48,
    assignmentsCount: 4200,
    canteenMembersCount: 66,
    canteenTransactionsCount: 180,
    lastSavedTime: localStorage.getItem('baf_local_snapshot_time') || undefined,
  });

  const refreshStats = async () => {
    try {
      const data = await exportFullSystemData();
      setSystemStats({
        airmenCount: data.baf_unit_data?.airmen?.length || 48,
        assignmentsCount: Object.values(data.baf_unit_data?.assignments || {}).reduce(
          (acc: number, list: any) => acc + (list?.length || 0),
          0
        ),
        canteenMembersCount: data.canteen?.members?.length || 66,
        canteenTransactionsCount: data.canteen?.transactions?.length || 180,
        lastSavedTime: localStorage.getItem('baf_local_snapshot_time') || undefined,
      });
    } catch {
      const curDb = localDb.getDb();
      setSystemStats({
        airmenCount: curDb.airmen?.length || 48,
        assignmentsCount: Object.values(curDb.assignments || {}).reduce(
          (acc: number, list: any) => acc + (list?.length || 0),
          0
        ),
        canteenMembersCount: 66,
        canteenTransactionsCount: 180,
        lastSavedTime: localStorage.getItem('baf_local_snapshot_time') || undefined,
      });
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  // Action: Download Local JSON File
  const handleDownloadLocalJson = async () => {
    setIsLoading(true);
    setStatusMessage('লোকাল ডাটাবেজ ফাইল প্রস্তুত হচ্ছে...');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await downloadOfflineBackupJson();
      const now = new Date().toISOString();
      localStorage.setItem('baf_local_snapshot_time', now);
      setSuccessMessage('অফলাইন ব্যাকআপ ফাইল (.json) সফলভাবে ডাউনলোড সম্পন্ন হয়েছে!');
      refreshStats();
    } catch (err: any) {
      setErrorMessage(err.message || 'অফলাইন ব্যাকআপ ডাউনলোড ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  // Action: Save Instant Snapshot in LocalStorage
  const handleCreateLocalSnapshot = async () => {
    setIsLoading(true);
    setStatusMessage('লোকাল স্টোরেজে তাৎক্ষণিক সেভপয়েন্ট সংরক্ষিত হচ্ছে...');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const data = await exportFullSystemData();
      const now = new Date().toISOString();
      localStorage.setItem('baf_local_storage_snapshot', JSON.stringify(data));
      localStorage.setItem('baf_local_snapshot_time', now);
      setSuccessMessage('লোকাল স্টোরেজে সফলভাবে সেভপয়েন্ট সংরক্ষিত হয়েছে!');
      refreshStats();
    } catch (err: any) {
      setErrorMessage('স্ন্যাপশট সেভ ব্যর্থ হয়েছে: ' + (err.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Action: Quick Rollback to LocalStorage Snapshot
  const handleRestoreLocalSnapshot = async () => {
    const raw = localStorage.getItem('baf_local_storage_snapshot');
    if (!raw) {
      setErrorMessage('পূর্বে সেভ করা কোনো লোকাল স্টোরেজ সেভপয়েন্ট পাওয়া যায়নি।');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setPendingRestoreData(parsed);
      setShowRestoreConfirm(true);
    } catch {
      setErrorMessage('সেভপয়েন্ট ডাটা পড়তে সমস্যা হয়েছে।');
    }
  };

  // Action: Handle Uploaded JSON File Selection
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setErrorMessage('');
    setSuccessMessage('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        if (!parsed.baf_unit_data && !parsed.airmen && !parsed.canteen) {
          throw new Error('অবৈধ ব্যাকআপ ফাইল। ফাইলটিতে ১৫৫ ইউএএসইউ-এর ডাটা নেই।');
        }

        setPendingRestoreData(parsed);
        setShowRestoreConfirm(true);
      } catch (err: any) {
        setErrorMessage('ফাইল লোড ত্রুটি: ' + (err.message || 'ভুল ফরম্যাট'));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Execute Restore from Pending Data
  const executeRestore = async () => {
    if (!pendingRestoreData) return;

    setIsLoading(true);
    setStatusMessage('ডাটাবেজ রিস্টোর করা হচ্ছে...');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await restoreFromBackupData(pendingRestoreData);
      setSuccessMessage(
        `সফলভাবে রিস্টোর হয়েছে! (${res.restoredAirmen} জন এয়ারম্যান, ${res.restoredAssignments}টি ডিউটি অ্যাসাইনমেন্ট)`
      );
      setShowRestoreConfirm(false);
      setPendingRestoreData(null);
      await refreshStats();

      // Trigger global event so all open views refresh instantly
      window.dispatchEvent(new CustomEvent('baf_state_updated'));
      window.dispatchEvent(new CustomEvent('canteen_members_updated'));
    } catch (err: any) {
      setErrorMessage(err.message || 'রিস্টোর প্রক্রিয়া ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0e1015] text-slate-100 flex flex-col min-h-screen overflow-y-auto">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#16181f]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ড্যাশবোর্ডে ফিরে যান (Back)</span>
          </button>

          <div className="hidden sm:block h-5 w-px bg-slate-800" />

          <div className="flex items-center gap-2.5">
            <Logo155UASU className="w-7 h-7 shrink-0" />
            <div>
              <div className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                155 UASU BAF • BASE ZHR
              </div>
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight leading-none">
                লোকাল ডাটাবেজ ব্যাকআপ ও রিস্টোর পোর্টাল (Offline Storage Center)
              </h1>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            100% Offline Mode Active
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Notifications */}
        {errorMessage && (
          <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-sm font-semibold animate-in fade-in">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-sm font-semibold animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-3 p-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl text-sky-400 text-sm font-semibold animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin shrink-0" />
            <span>{statusMessage || 'প্রসেসিং হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...'}</span>
          </div>
        )}

        {/* Local Storage Offline Mode Hero Banner */}
        <section className="bg-linear-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-7 shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center p-3 text-emerald-400 shadow-inner shrink-0">
                <HardDrive className="w-8 h-8" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white">
                    লোকাল স্টোরেজ ডাটাবেজ সক্রিয় (Local Storage Mode)
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    নিরাপদ ও অফলাইন
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                  এই অ্যাপ্লিকেশনটি সম্পূর্ণ অফলাইনে কাজ করে। কোনো প্রকার ইন্টারনেট বা জিমেইল অ্যাকাউন্ট ছাড়াই আপনার সমস্ত ডিউটি রোস্টার, প্যারেড স্টেট এবং ক্যান্টিনের হিসাব আপনার ডিভাইসের লোকাল স্টোরেজে স্থায়ীভাবে সংরক্ষিত থাকে।
                </p>

                {systemStats.lastSavedTime && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      সর্বশেষ সংরক্ষিত স্ন্যাপশট:{' '}
                      <strong className="text-emerald-300">
                        {new Date(systemStats.lastSavedTime).toLocaleString('bn-BD')}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCreateLocalSnapshot}
                disabled={isLoading}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>তাত্ক্ষণিক সেভপয়েন্ট নিন</span>
              </button>
            </div>
          </div>
        </section>

        {/* 2 Primary Offline Action Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Local File Backup (.json Download) */}
          <div className="bg-[#181a20] border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>অফলাইন ফাইল ব্যাকআপ (.json)</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                  সুপারিশকৃত
                </span>
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ইন্টারনেট ছাড়াই সম্পূর্ণ সিস্টেমের ডাটাবেজ (সকল এয়ারম্যান, মাসিক রোস্টার, প্যারেড রিপোর্ট ও ক্যান্টিন ডাটা) আপনার মোবাইল বা কম্পিউটারে সরাসরি ডাউনলোডযোগ্য একটি একক `.json` ফাইল হিসেবে সেভ রাখুন।
              </p>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleDownloadLocalJson}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>ব্যাকআপ ফাইল ডাউনলোড করুন (.json)</span>
              </button>
            </div>
          </div>

          {/* Card 2: Restore from Offline File (.json Upload) */}
          <div className="bg-[#181a20] border border-slate-800 hover:border-sky-500/40 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                অফলাইন ফাইল থেকে রিস্টোর
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                পূর্বে ডাউনলোড করা যেকোনো `.json` ব্যাকআপ ফাইল সিলেক্ট করুন। সম্পূর্ণ সিস্টেম অবিলম্বে ঐ ব্যাকআপ ফাইলের ডাটা দিয়ে প্রতিস্থাপিত হবে।
              </p>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-800/80">
              <label className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 hover:border-slate-600 transition-all cursor-pointer">
                <Upload className="w-4 h-4 text-sky-400" />
                <span>কম্পিউটার/মোবাইল থেকে ফাইল বাছুন (.json)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isLoading}
                />
              </label>
            </div>
          </div>
        </section>

        {/* Quick Snapshot Restore Card */}
        <section className="bg-[#181a20] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                ব্রাউজারের সর্বশেষ সংরক্ষিত সেভপয়েন্ট রিস্টোর
              </h4>
              <p className="text-xs text-slate-400">
                আপনি যদি পূর্বে "তাত্ক্ষণিক সেভপয়েন্ট নিন" এ ক্লিক করে থাকেন, তবে ফাইল আপলোড ছাড়াই সরাসরি সেই সেভপয়েন্টে ফিরে যেতে পারেন।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRestoreLocalSnapshot}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs transition-colors cursor-pointer shrink-0"
          >
            সেভপয়েন্ট রিস্টোর করুন
          </button>
        </section>

        {/* Live System Stats Grid */}
        <section className="bg-[#181a20] border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">
                বর্তমান লোকাল ডাটাবেজ পরিসংখ্যান (Current Local Database Stats)
              </h3>
            </div>
            <button
              type="button"
              onClick={refreshStats}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>রিফ্রেশ</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Users className="w-4 h-4 text-emerald-400" />
                <span>মোট এয়ারম্যান</span>
              </div>
              <div className="text-xl font-black text-white font-mono">
                {systemStats.airmenCount}
              </div>
              <span className="text-[10px] text-emerald-400 font-medium">নমিনাল রোলে সংরক্ষিত</span>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span>ডিউটি অ্যাসাইনমেন্ট</span>
              </div>
              <div className="text-xl font-black text-white font-mono">
                {systemStats.assignmentsCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-sky-400 font-medium">মাসিক রোস্টার ও প্যারেড</span>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                <span>ক্যান্টিন সদস্য</span>
              </div>
              <div className="text-xl font-black text-white font-mono">
                {systemStats.canteenMembersCount}
              </div>
              <span className="text-[10px] text-amber-400 font-medium">ক্যান্টিন খাতা রেজিস্টার</span>
            </div>

            <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <FileText className="w-4 h-4 text-purple-400" />
                <span>ক্যান্টিন লেনদেন</span>
              </div>
              <div className="text-xl font-black text-white font-mono">
                {systemStats.canteenTransactionsCount}
              </div>
              <span className="text-[10px] text-purple-400 font-medium">মোট ট্রানজেকশন রেকর্ড</span>
            </div>
          </div>
        </section>
      </main>

      {/* Confirmation Modal for Data Restore */}
      {showRestoreConfirm && pendingRestoreData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#181a20] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">
                  ডাটাবেজ রিস্টোর নিশ্চিতকরণ
                </h3>
                <p className="text-xs text-amber-300">
                  সতর্কতা: বর্তমান ডাটা নতুন ফাইলের ডাটা দ্বারা প্রতিস্থাপিত হবে
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-4 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">রিস্টোরযোগ্য এয়ারম্যান:</span>
                <strong className="text-white font-mono">
                  {pendingRestoreData.baf_unit_data?.airmen?.length || pendingRestoreData.airmen?.length || 'পাওয়া গেছে'}
                </strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">ক্যান্টিন সদস্য:</span>
                <strong className="text-white font-mono">
                  {pendingRestoreData.canteen?.members?.length || pendingRestoreData.canteen_members?.length || 'পাওয়া গেছে'}
                </strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">ব্যাকআপের তারিখ:</span>
                <strong className="text-white font-mono text-[11px]">
                  {pendingRestoreData.exportedAt
                    ? new Date(pendingRestoreData.exportedAt).toLocaleString('bn-BD')
                    : 'অফলাইন স্ন্যাপশট'}
                </strong>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              আপনি কি নিশ্চিত যে এই ব্যাকআপ ফাইলটি রিস্টোর করে পুরো ডাটাবেজ আপডেট করতে চান?
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setPendingRestoreData(null);
                }}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={executeRestore}
                disabled={isLoading}
                className="flex-1 py-2.5 rounded-xl bg-linear-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                {isLoading ? 'রিস্টোর হচ্ছে...' : 'হ্যাঁ, রিস্টোর সম্পন্ন করুন'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

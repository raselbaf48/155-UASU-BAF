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
  Clock,
  FileText,
  Save,
  RotateCcw,
  Trash2,
  History,
  FileCheck,
  Check,
  X,
} from 'lucide-react';
import { Logo155UASU } from './Logo155UASU';
import {
  restoreFromBackupData,
  downloadOfflineBackupJson,
  exportFullSystemData,
} from '../services/googleDriveService';
import { localDb } from '../services/localDatabase';

export interface RestoreHistoryItem {
  id: string;
  timestamp: string;
  actionType: 'FILE_RESTORE' | 'SNAPSHOT_RESTORE' | 'SNAPSHOT_SAVE' | 'FILE_BACKUP';
  title: string;
  details: string;
  airmenCount?: number;
  assignmentsCount?: number;
  membersCount?: number;
  fileName?: string;
  status: 'SUCCESS' | 'ERROR';
}

const HISTORY_STORAGE_KEY = 'baf_backup_restore_history_v1';

function getInitialHistory(): RestoreHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

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
  const [pendingFileName, setPendingFileName] = useState<string>('');

  // Clear all confirmation modal
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);

  // Restore & Backup History
  const [historyList, setHistoryList] = useState<RestoreHistoryItem[]>(() => getInitialHistory());

  // Save history to localStorage permanently (never auto-deletes)
  const saveHistoryList = (list: RestoreHistoryItem[]) => {
    setHistoryList(list);
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to save restore history to localStorage:', e);
    }
  };

  const addHistoryItem = (item: Omit<RestoreHistoryItem, 'id'>) => {
    const newItem: RestoreHistoryItem = {
      ...item,
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    };
    const updated = [newItem, ...historyList];
    saveHistoryList(updated);
  };

  const deleteHistoryItem = (id: string) => {
    const updated = historyList.filter((item) => item.id !== id);
    saveHistoryList(updated);
    setSuccessMessage('হিস্ট্রি এন্ট্রি সফলভাবে মুছে ফেলা হয়েছে।');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleClearAllHistory = () => {
    saveHistoryList([]);
    setShowClearHistoryConfirm(false);
    setSuccessMessage('সমস্ত রিস্টোর হিস্ট্রি স্থায়ীভাবে মুছে ফেলা হয়েছে।');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

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
    setStatusMessage('ডাটাবেজ ফাইল প্রস্তুত হচ্ছে...');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await downloadOfflineBackupJson();
      const now = new Date().toISOString();
      localStorage.setItem('baf_local_snapshot_time', now);
      setSuccessMessage('ব্যাকআপ ফাইল (.json) সফলভাবে ডাউনলোড সম্পন্ন হয়েছে!');

      addHistoryItem({
        timestamp: now,
        actionType: 'FILE_BACKUP',
        title: 'অফলাইন ব্যাকআপ ডাউনলোড (.json)',
        details: `${systemStats.airmenCount} জন এয়ারম্যান, ${systemStats.assignmentsCount.toLocaleString()}টি রোস্টার অ্যাসাইনমেন্ট ও ক্যান্টিন ডাটা সংরক্ষিত হয়েছে`,
        airmenCount: systemStats.airmenCount,
        assignmentsCount: systemStats.assignmentsCount,
        membersCount: systemStats.canteenMembersCount,
        fileName: '155_UASU_BAF_Backup.json',
        status: 'SUCCESS',
      });

      refreshStats();
    } catch (err: any) {
      setErrorMessage(err.message || 'ব্যাকআপ ডাউনলোড ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
    }
  };

  // Action: Save Instant Snapshot in LocalStorage
  const handleCreateLocalSnapshot = async () => {
    setIsLoading(true);
    setStatusMessage('লোকাল সেভপয়েন্ট সংরক্ষিত হচ্ছে...');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const data = await exportFullSystemData();
      const now = new Date().toISOString();
      localStorage.setItem('baf_local_storage_snapshot', JSON.stringify(data));
      localStorage.setItem('baf_local_snapshot_time', now);
      setSuccessMessage('ব্রাউজার লোকাল স্টোরেজে সেভপয়েন্ট সংরক্ষিত হয়েছে!');

      addHistoryItem({
        timestamp: now,
        actionType: 'SNAPSHOT_SAVE',
        title: 'তাত্ক্ষণিক সেভপয়েন্ট সংরক্ষণ',
        details: `${systemStats.airmenCount} জন এয়ারম্যান, ${systemStats.assignmentsCount.toLocaleString()}টি অ্যাসাইনমেন্ট সংরক্ষিত`,
        airmenCount: systemStats.airmenCount,
        assignmentsCount: systemStats.assignmentsCount,
        membersCount: systemStats.canteenMembersCount,
        status: 'SUCCESS',
      });

      refreshStats();
    } catch (err: any) {
      setErrorMessage('সেভপয়েন্ট সংরক্ষণ ব্যর্থ হয়েছে: ' + (err.message || 'অজানা ত্রুটি'));
    } finally {
      setIsLoading(false);
    }
  };

  // Action: Quick Rollback to LocalStorage Snapshot
  const handleRestoreLocalSnapshot = async () => {
    const raw = localStorage.getItem('baf_local_storage_snapshot');
    if (!raw) {
      setErrorMessage('পূর্বে সংরক্ষিত কোনো লোকাল সেভপয়েন্ট পাওয়া যায়নি।');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setPendingRestoreData(parsed);
      setPendingFileName('লোকাল সেভপয়েন্ট স্ন্যাপশট');
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
    setPendingFileName(file.name);

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
      const now = new Date().toISOString();
      setSuccessMessage(
        `ডাটাবেজ সফলভাবে রিস্টোর হয়েছে! (${res.restoredAirmen} জন এয়ারম্যান, ${res.restoredAssignments.toLocaleString()}টি ডিউটি অ্যাসাইনমেন্ট)`
      );

      const isSnapshot = pendingFileName === 'লোকাল সেভপয়েন্ট স্ন্যাপশট';
      addHistoryItem({
        timestamp: now,
        actionType: isSnapshot ? 'SNAPSHOT_RESTORE' : 'FILE_RESTORE',
        title: isSnapshot ? 'সেভপয়েন্ট থেকে রিস্টোর' : 'ব্যাকআপ ফাইল রিস্টোর',
        details: `${res.restoredAirmen} জন এয়ারম্যান, ${res.restoredAssignments.toLocaleString()}টি অ্যাসাইনমেন্ট রিস্টোর সম্পন্ন`,
        airmenCount: res.restoredAirmen,
        assignmentsCount: res.restoredAssignments,
        membersCount: res.restoredMembers,
        fileName: pendingFileName,
        status: 'SUCCESS',
      });

      setShowRestoreConfirm(false);
      setPendingRestoreData(null);
      setPendingFileName('');
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

  const formatHistoryDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return d.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0e14] text-slate-100 flex flex-col min-h-screen overflow-y-auto">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#141721]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>ড্যাশবোর্ড (Back)</span>
          </button>

          <div className="hidden sm:block h-5 w-px bg-slate-800" />

          <div className="flex items-center gap-2.5">
            <Logo155UASU className="w-8 h-8 shrink-0" />
            <div>
              <div className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                155 UASU BAF • BASE ZHR
              </div>
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight leading-none">
                ডাটাবেজ ব্যাকআপ ও রিস্টোর পোর্টাল
              </h1>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            লোকাল অফলাইন মোড
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-7 space-y-6">
        {/* Alerts */}
        {errorMessage && (
          <div className="flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs sm:text-sm font-semibold animate-in fade-in">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage('')}
              className="p-1 hover:bg-rose-500/20 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs sm:text-sm font-semibold animate-in fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage('')}
              className="p-1 hover:bg-emerald-500/20 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-3 p-4 bg-sky-500/10 border border-sky-500/30 rounded-2xl text-sky-400 text-xs sm:text-sm font-semibold animate-pulse">
            <RefreshCw className="w-5 h-5 animate-spin shrink-0" />
            <span>{statusMessage || 'প্রসেসিং হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...'}</span>
          </div>
        )}

        {/* Section 1: Device Storage Overview Banner */}
        <section className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-500/30 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center p-2.5 text-emerald-400 shadow-inner shrink-0">
                <HardDrive className="w-6 h-6" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-black text-white">
                    ডিভাইস লোকাল স্টোরেজ (Local Storage)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    সুরক্ষিত
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  আপনার এয়ারম্যান বায়োডাটা, রোস্টার ও ক্যান্টিনের হিসাব ডিভাইসে সরাসরি সংরক্ষিত থাকে।
                </p>

                {systemStats.lastSavedTime && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1.5 font-mono">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      সর্বশেষ স্ন্যাপশট:{' '}
                      <strong className="text-emerald-300">
                        {formatHistoryDate(systemStats.lastSavedTime)}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateLocalSnapshot}
              disabled={isLoading}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>তাত্ক্ষণিক সেভপয়েন্ট তৈরি</span>
            </button>
          </div>
        </section>

        {/* Section 2: Backup & Restore Actions (Clean 2-Column Grid) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Local File Backup (.json Download) */}
          <div className="bg-[#151720] border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between transition-all group">
            <div className="space-y-2.5">
              <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  অফলাইন ব্যাকআপ ডাউনলোড (.json)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">
                  সুপারিশকৃত
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                সম্পূর্ণ ডাটাবেজ একক ফাইলে নিজের কম্পিউটার বা মোবাইলে ডাউনলোড করে নিরাপদ রাখুন।
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleDownloadLocalJson}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>ব্যাকআপ ফাইল ডাউনলোড (.json)</span>
              </button>
            </div>
          </div>

          {/* Card 2: Restore from Offline File (.json Upload) */}
          <div className="bg-[#151720] border border-slate-800 hover:border-sky-500/40 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between transition-all group">
            <div className="space-y-2.5">
              <div className="w-11 h-11 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                ব্যাকআপ ফাইল থেকে রিস্টোর
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                পূর্বে সেভ করা `.json` ব্যাকআপ ফাইল সিলেক্ট করে ডাটাবেজের সমস্ত ডাটা প্রতিস্থাপন করুন।
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80">
              <label className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 hover:border-slate-600 transition-all cursor-pointer">
                <Upload className="w-4 h-4 text-sky-400" />
                <span>ফাইল নির্বাচন করুন (.json)</span>
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

        {/* Section 3: Quick Snapshot Rollback */}
        <section className="bg-[#151720] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <RotateCcw className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">
                ব্রাউজার সেভপয়েন্ট রিস্টোর
              </h4>
              <p className="text-[11px] text-slate-400">
                ফাইল নির্বাচন ছাড়াই সরাসরি শেষ সংরক্ষিত সেভপয়েন্টে ডাটাবেজ ফিরিয়ে নিন।
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRestoreLocalSnapshot}
            disabled={isLoading}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-xs transition-colors cursor-pointer shrink-0"
          >
            সেভপয়েন্ট রিস্টোর
          </button>
        </section>

        {/* Section 4: Live Database Statistics */}
        <section className="bg-[#151720] border border-slate-800 rounded-3xl p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs sm:text-sm font-bold text-white">
                বর্তমান ডাটাবেজ পরিসংখ্যান
              </h3>
            </div>
            <button
              type="button"
              onClick={refreshStats}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>রিফ্রেশ</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>এয়ারম্যান সংখ্যা</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white font-mono">
                {systemStats.airmenCount}
              </div>
              <span className="text-[10px] text-emerald-400/80 font-medium">নমিনাল রোল</span>
            </div>

            <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                <span>ডিউটি রেকর্ড</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white font-mono">
                {systemStats.assignmentsCount.toLocaleString()}
              </div>
              <span className="text-[10px] text-sky-400/80 font-medium">রোস্টার ও প্যারেড</span>
            </div>

            <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                <span>ক্যান্টিন মেম্বার</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white font-mono">
                {systemStats.canteenMembersCount}
              </div>
              <span className="text-[10px] text-amber-400/80 font-medium">সদস্য তালিকা</span>
            </div>

            <div className="bg-slate-900/70 p-3.5 rounded-2xl border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <FileText className="w-3.5 h-3.5 text-purple-400" />
                <span>লেনদেন হিসেব</span>
              </div>
              <div className="text-lg sm:text-xl font-black text-white font-mono">
                {systemStats.canteenTransactionsCount}
              </div>
              <span className="text-[10px] text-purple-400/80 font-medium">মোট ট্রানজেকশন</span>
            </div>
          </div>
        </section>

        {/* Section 5: Restore History (রিস্টোর ও ব্যাকআপ হিস্ট্রি) */}
        <section className="bg-[#151720] border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  রিস্টোর হিস্ট্রি (Restore History)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold">
                  {historyList.length} টি রেকর্ড
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                ডাটাবেজ রিস্টোর ও ব্যাকআপের স্থায়ী লগ। আপনি ম্যানুয়ালি না মুছলে এগুলো কখনোই অটো ডিলিট হবে না।
              </p>
            </div>

            {historyList.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearHistoryConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold transition-colors cursor-pointer shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>সব হিস্ট্রি মুছুন</span>
              </button>
            )}
          </div>

          {/* History Items List */}
          {historyList.length === 0 ? (
            <div className="py-8 text-center space-y-2 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
              <FileCheck className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs font-medium text-slate-400">
                এখনো কোনো রিস্টোর বা ব্যাকআপের হিস্ট্রি সংরক্ষিত নেই।
              </p>
              <p className="text-[10px] text-slate-500">
                যেকোনো ব্যাকআপ নেওয়া বা রিস্টোর করার সাথে সাথে এখানে স্থায়ীভাবে রেকর্ড যুক্ত হবে।
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
              {historyList.map((item) => {
                const isRestore = item.actionType.includes('RESTORE');
                const isBackup = item.actionType === 'FILE_BACKUP';
                return (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 flex items-start justify-between gap-3 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          isRestore
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : isBackup
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        }`}
                      >
                        {isRestore ? (
                          <Upload className="w-4 h-4" />
                        ) : isBackup ? (
                          <Download className="w-4 h-4" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white">{item.title}</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                              isRestore
                                ? 'bg-amber-500/20 text-amber-300'
                                : isBackup
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-sky-500/20 text-sky-300'
                            }`}
                          >
                            {isRestore ? 'রিস্টোর' : isBackup ? 'ব্যাকআপ' : 'সেভপয়েন্ট'}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                            <Check className="w-3 h-3" /> সফল
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-300">{item.details}</p>

                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatHistoryDate(item.timestamp)}
                          </span>
                          {item.fileName && (
                            <span className="text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                              ফাইল: {item.fileName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Single Delete Button */}
                    <button
                      type="button"
                      onClick={() => deleteHistoryItem(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="এই হিস্ট্রি এন্ট্রি মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Confirmation Modal for Data Restore */}
      {showRestoreConfirm && pendingRestoreData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-[#161821] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-white">
                  ডাটাবেজ রিস্টোর নিশ্চিতকরণ
                </h3>
                <p className="text-[11px] text-amber-300">
                  বর্তমান ডাটাবেজের সমস্ত রেকর্ড নতুন ব্যাকআপ ডাটা দিয়ে প্রতিস্থাপিত হবে
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">এয়ারম্যান সংখ্যা:</span>
                <strong className="text-white font-mono">
                  {pendingRestoreData.baf_unit_data?.airmen?.length || pendingRestoreData.airmen?.length || 'পাওয়া গেছে'} জন
                </strong>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">ক্যান্টিন সদস্য:</span>
                <strong className="text-white font-mono">
                  {pendingRestoreData.canteen?.members?.length || pendingRestoreData.canteen_members?.length || 'পাওয়া গেছে'} জন
                </strong>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">ব্যাকআপের তারিখ:</span>
                <strong className="text-white font-mono text-[11px]">
                  {pendingRestoreData.exportedAt
                    ? formatHistoryDate(pendingRestoreData.exportedAt)
                    : 'অফলাইন সেভপয়েন্ট'}
                </strong>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              আপনি কি নিশ্চিত যে এই ব্যাকআপটি রিস্টোর করে সিস্টেমে প্রয়োগ করতে চান?
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setPendingRestoreData(null);
                  setPendingFileName('');
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
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                {isLoading ? 'রিস্টোর হচ্ছে...' : 'রিস্টোর সম্পন্ন করুন'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clearing All History */}
      {showClearHistoryConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-[#161821] border border-rose-500/40 rounded-3xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">
                  সমস্ত হিস্ট্রি মুছে ফেলবেন?
                </h3>
                <p className="text-[11px] text-rose-300">
                  এই পদক্ষেপটি অপরিবর্তনীয়
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              আপনি কি নিশ্চিত যে সংরক্ষিত সমস্ত রিস্টোর ও ব্যাকআপ হিস্ট্রি মুছে ফেলতে চান?
            </p>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowClearHistoryConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={handleClearAllHistory}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                হ্যাঁ, সব মুছুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

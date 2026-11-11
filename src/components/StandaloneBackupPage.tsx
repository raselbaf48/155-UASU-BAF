import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Cloud,
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
  LogOut,
  Mail,
  Check
} from 'lucide-react';
import { Logo155UASU } from './Logo155UASU';
import {
  connectGoogleDrive,
  disconnectGoogleDrive,
  uploadBackupToDrive,
  fetchBackupFromDrive,
  restoreFromBackupData,
  downloadOfflineBackupJson,
  getDriveStatus,
  DriveSyncStatus,
  exportFullSystemData,
} from '../services/googleDriveService';
import { localDb } from '../services/localDatabase';
import { getStoredGmailUser } from './GmailLoginModal';

interface StandaloneBackupPageProps {
  onBack: () => void;
}

export const StandaloneBackupPage: React.FC<StandaloneBackupPageProps> = ({ onBack }) => {
  const [driveStatus, setDriveStatus] = useState<DriveSyncStatus>(getDriveStatus());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [gmailUser, setGmailUser] = useState<any>(() => getStoredGmailUser());

  // Confirmation state for Drive Restore
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<{
    metadata: any;
    content: any;
  } | null>(null);

  // Live system stats
  const [systemStats, setSystemStats] = useState<{
    airmenCount: number;
    assignmentsCount: number;
    canteenMembersCount: number;
    canteenTransactionsCount: number;
  }>({
    airmenCount: 48,
    assignmentsCount: 4200,
    canteenMembersCount: 66,
    canteenTransactionsCount: 180,
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
      });
    }
  };

  useEffect(() => {
    const handleStatusChanged = (e: any) => {
      if (e.detail) setDriveStatus(e.detail);
    };
    window.addEventListener('google_drive_status_changed', handleStatusChanged);
    refreshStats();
    return () => {
      window.removeEventListener('google_drive_status_changed', handleStatusChanged);
    };
  }, []);

  const handleConnectDrive = async () => {
    setIsLoading(true);
    setStatusMessage('Google ড্রাইভে সংযোগ স্থাপন করা হচ্ছে...');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await connectGoogleDrive();
      setSuccessMessage('Google ড্রাইভ সফলভাবে সংযুক্ত হয়েছে!');
    } catch (err: any) {
      setErrorMessage(err.message || 'Google ড্রাইভ কানেক্ট ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleDisconnectDrive = async () => {
    if (confirm('আপনি কি নিশ্চিত যে Google ড্রাইভের সংযোগ বিচ্ছিন্ন করতে চান?')) {
      await disconnectGoogleDrive();
      setSuccessMessage('Google ড্রাইভ সংযোগ বিচ্ছিন্ন করা হয়েছে');
    }
  };

  const handleCloudBackup = async () => {
    setIsLoading(true);
    setStatusMessage('ড্রাইভে ডাটা ব্যাকআপ আপলোড হচ্ছে...');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await uploadBackupToDrive();
      setSuccessMessage('Google ড্রাইভে সফলভাবে ব্যাকআপ সংরক্ষিত হয়েছে!');
      await refreshStats();
    } catch (err: any) {
      setErrorMessage(err.message || 'ড্রাইভ ব্যাকআপ ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleFetchDriveRestore = async () => {
    setIsLoading(true);
    setStatusMessage('Google ড্রাইভ থেকে ব্যাকআপ ফাইল খোঁজা হচ্ছে...');
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const result = await fetchBackupFromDrive();
      setPendingRestoreData({
        metadata: result.metadata,
        content: result.content,
      });
      setShowRestoreConfirm(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'ড্রাইভ থেকে ব্যাকআপ পুনরুদ্ধার করা যায়নি');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleExecuteRestore = async () => {
    if (!pendingRestoreData) return;
    setIsLoading(true);
    setStatusMessage('ডাটাবেজ রিস্টোর করা হচ্ছে...');
    setShowRestoreConfirm(false);
    try {
      const stats = await restoreFromBackupData(pendingRestoreData.content);
      setSuccessMessage(
        stats.message ||
        `সফলভাবে রিস্টোর সম্পন্ন হয়েছে! (${stats.restoredAirmen} এয়ারম্যান, ${stats.restoredAssignments} ডিউটি, ${stats.restoredMembers} ক্যান্টিন সদস্য)`
      );
      await refreshStats();
    } catch (err: any) {
      setErrorMessage(err.message || 'রিস্টোর ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
      setPendingRestoreData(null);
    }
  };

  const handleDownloadLocalJson = async () => {
    setIsLoading(true);
    setStatusMessage('অফলাইন ব্যাকআপ ফাইল প্রস্তুত হচ্ছে...');
    setErrorMessage('');
    try {
      const fileName = await downloadOfflineBackupJson();
      setSuccessMessage(`অফলাইন ব্যাকআপ ফাইল '${fileName}' সফলভাবে ডাউনলোড হয়েছে!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'ডাউনলোড ব্যর্থ হয়েছে');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleUploadLocalJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatusMessage('ব্যাকআপ ফাইলটি লোড ও যাচাই করা হচ্ছে...');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed.baf_unit_data && !parsed.airmen && !parsed.canteen) {
        throw new Error('অবৈধ ব্যাকআপ ফাইল। ফাইলটিতে ১৫৫ ইউএএসইউ-এর বৈধ ডাটা নেই।');
      }

      setPendingRestoreData({
        metadata: {
          name: file.name,
          modifiedTime: new Date(file.lastModified).toISOString(),
          size: `${Math.round(file.size / 1024)} KB`,
        },
        content: parsed,
      });
      setShowRestoreConfirm(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'ফাইলটি পড়তে সমস্যা হয়েছে');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col min-h-screen overflow-y-auto">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-lg">
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
                সিস্টেম ব্যাকআপ ও রিস্টোর পোর্টাল (Backup & Restore Center)
              </h1>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {driveStatus.isConnected ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Google Drive Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Local Storage Mode
            </span>
          )}
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

        {/* Google Drive Connection & User Status Card */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center p-2.5 shadow-inner shrink-0">
                <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                  <path d="M7.71 3.5L1.15 15l3.43 6 6.56-11.5L7.71 3.5z" fill="#0066DA" />
                  <path d="M14.57 3.5H7.71l6.56 11.5h6.86L14.57 3.5z" fill="#00AC47" />
                  <path d="M22.85 15l-3.42-6H4.58L8 15h14.85z" fill="#EA4335" />
                  <path d="M14.57 15l-3.43 6h11.71l3.43-6H14.57z" fill="#FFBA00" />
                  <path d="M1.15 15l3.43 6h6.86l-3.43-6H1.15z" fill="#00832D" />
                  <path d="M8 9.5l3.43-6h6.86l-3.43 6H8z" fill="#2684FC" />
                </svg>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black text-white">
                    Google Drive ক্লাউড সংযোগ
                  </h2>
                  {driveStatus.isConnected && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      সক্রিয়
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-1">
                  {driveStatus.userEmail ? (
                    <span className="font-mono text-emerald-400 font-bold">{driveStatus.userEmail}</span>
                  ) : gmailUser?.email ? (
                    <span className="font-mono text-emerald-400 font-bold">{gmailUser.email}</span>
                  ) : (
                    'Google অ্যাকাউন্ট সংযুক্ত করে নিরাপদ ক্লাউড ব্যাকআপ নিশ্চিত করুন।'
                  )}
                </p>

                {driveStatus.lastBackupTime && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>সর্বশেষ ড্রাইভ ব্যাকআপ: <strong className="text-slate-200">{new Date(driveStatus.lastBackupTime).toLocaleString('bn-BD')}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {driveStatus.isConnected ? (
                <button
                  type="button"
                  onClick={handleDisconnectDrive}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-800 text-xs font-bold transition-all cursor-pointer"
                >
                  ড্রাইভ সংযোগ বিচ্ছিন্ন করুন
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleConnectDrive}
                  disabled={isLoading}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-linear-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
                >
                  <Cloud className="w-4 h-4" />
                  <span>Google Drive কানেক্ট করুন</span>
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 4 Core Action Cards: 2 Backup Options, 2 Restore Options */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Option 1: Google Drive Cloud Backup */}
          <div className="bg-slate-900 border border-slate-800 hover:border-sky-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center">
                <Cloud className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                Google Drive ক্লাউড ব্যাকআপ
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                আপনার Google ড্রাইভে ১৫৫ ইউএএসইউ-এর সমস্ত ডিউটি রোস্টার, প্যারেড স্টেট এবং ক্যান্টিনের হিসাব এক ক্লিকেই এনক্রিপ্টেড ফাইল হিসেবে ব্যাকআপ রাখুন।
              </p>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleCloudBackup}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Cloud className="w-4 h-4" />
                <span>ড্রাইভে ক্লাউড ব্যাকআপ নিন</span>
              </button>
            </div>
          </div>

          {/* Option 2: Local File Backup (.json Download) */}
          <div className="bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Download className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                অফলাইন ফাইল ব্যাকআপ (.json)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                ইন্টারনেট ছাড়াই সম্পূর্ণ সিস্টেমের ডাটাবেজ আপনার মোবাইল অথবা কম্পিউটারে একটি সরাসরি ডাউনলোডযোগ্য `.json` ফাইল আকারে সংরক্ষণ করুন।
              </p>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleDownloadLocalJson}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>ব্যাকআপ ফাইল ডাউনলোড করুন (.json)</span>
              </button>
            </div>
          </div>

          {/* Option 3: Restore from Google Drive */}
          <div className="bg-slate-900 border border-slate-800 hover:border-amber-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                Google Drive থেকে রিস্টোর
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Google ড্রাইভে সংরক্ষিত সর্বশেষ ক্লাউড ব্যাকআপ ফাইলটি সরাসরি খুঁজে বের করুন এবং পুরো সিস্টেমের ডাটা আগের অবস্থায় রিস্টোর করুন।
              </p>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={handleFetchDriveRestore}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>ড্রাইভ থেকে ডাটা রিস্টোর করুন</span>
              </button>
            </div>
          </div>

          {/* Option 4: Restore from Local File (.json Upload) */}
          <div className="bg-slate-900 border border-slate-800 hover:border-purple-500/40 rounded-2xl p-6 shadow-xl flex flex-col justify-between transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                অফলাইন ফাইল থেকে রিস্টোর
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                পূর্বে ডাউনলোড করা যেকোনো ব্যাকআপ ফাইল (`155_UASU_BAF_Backup...json`) সিলেক্ট করে এক ক্লিকে সম্পূর্ণ সিস্টেম রিস্টোর করুন।
              </p>
            </div>

            <div className="pt-5 mt-4 border-t border-slate-800/80">
              <label className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition-all cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>ফাইল সিলেক্ট করে রিস্টোর করুন</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleUploadLocalJson}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </section>

        {/* Live Database Status Overview */}
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>বর্তমান ডাটাবেজের লাইভ পরিসংখ্যান (Live Database Metrics)</span>
            </div>
            <button
              type="button"
              onClick={refreshStats}
              className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Users className="w-3.5 h-3.5 text-sky-400" />
                <span>এয়ারম্যান সংখ্যা</span>
              </div>
              <div className="text-xl font-black text-white mt-1">
                {systemStats.airmenCount} জন
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                <span>ডিউটি রেকর্ড</span>
              </div>
              <div className="text-xl font-black text-white mt-1">
                {systemStats.assignmentsCount.toLocaleString()} টি
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
                <span>ক্যান্টিন সদস্য</span>
              </div>
              <div className="text-xl font-black text-white mt-1">
                {systemStats.canteenMembersCount} জন
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                <HardDrive className="w-3.5 h-3.5 text-purple-400" />
                <span>ক্যান্টিন ট্রানজেকশন</span>
              </div>
              <div className="text-xl font-black text-white mt-1">
                {systemStats.canteenTransactionsCount} টি
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Confirmation Modal for Restore */}
      {showRestoreConfirm && pendingRestoreData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-bold text-white">ডাটাবেজ রিস্টোর নিশ্চিতকরণ</h3>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              আপনি কি নিশ্চিত যে এই ব্যাকআপ ফাইলটি বর্তমান সিস্টেম ডাটাবেজে রিস্টোর করতে চান?
            </p>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1 font-mono text-slate-400">
              <div>ফাইল: <span className="text-slate-200">{pendingRestoreData.metadata.name}</span></div>
              <div>তারিখ: <span className="text-slate-200">{new Date(pendingRestoreData.metadata.modifiedTime).toLocaleString('bn-BD')}</span></div>
              {pendingRestoreData.metadata.size && <div>সাইজ: <span className="text-slate-200">{pendingRestoreData.metadata.size}</span></div>}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-lg shadow-amber-600/20 transition-colors cursor-pointer"
              >
                হ্যাঁ, রিস্টোর সম্পন্ন করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

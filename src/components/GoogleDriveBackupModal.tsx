import React, { useState, useEffect } from 'react';
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

interface GoogleDriveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleDriveBackupModal: React.FC<GoogleDriveBackupModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [driveStatus, setDriveStatus] = useState<DriveSyncStatus>(getDriveStatus());
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Confirmation state for Drive Restore
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<{
    metadata: any;
    content: any;
  } | null>(null);
  const [isRestoringProgress, setIsRestoringProgress] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStage, setRestoreStage] = useState('');

  // Live data stats
  const [systemStats, setSystemStats] = useState<{
    airmenCount: number;
    assignmentsCount: number;
    canteenMembersCount: number;
    canteenTransactionsCount: number;
  }>({
    airmenCount: 49,
    assignmentsCount: 4258,
    canteenMembersCount: 66,
    canteenTransactionsCount: 186,
  });

  useEffect(() => {
    const handleStatusChanged = (e: any) => {
      if (e.detail) {
        setDriveStatus(e.detail);
      }
    };

    window.addEventListener('google_drive_status_changed', handleStatusChanged);
    refreshStats();

    return () => {
      window.removeEventListener('google_drive_status_changed', handleStatusChanged);
    };
  }, []);

  const refreshStats = async () => {
    try {
      const full = await exportFullSystemData();
      if (full && full.stats) {
        setSystemStats(full.stats);
      }
    } catch {}
  };

  if (!isOpen) return null;

  const handleConnect = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setStatusMessage('Google অ্যাকাউন্টে সাইন ইন প্রক্রিয়াধীন...');

    try {
      const res = await connectGoogleDrive();
      if (res) {
        setSuccessMessage(`স্বাগতম! ${res.user.displayName || res.user.email} সফলভাবে সংযুক্ত হয়েছে।`);
        refreshStats();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Google সাইন ইন সম্পন্ন করা সম্ভব হয়নি।');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('আপনি কি নিশ্চিত যে Google ড্রাইভের সংযোগ বিচ্ছিন্ন করতে চান?')) {
      return;
    }
    setIsLoading(true);
    try {
      await disconnectGoogleDrive();
      setSuccessMessage('Google ড্রাইভ সংযোগ বিচ্ছিন্ন করা হয়েছে।');
    } catch (err: any) {
      setErrorMessage(err.message || 'সংযোগ বিচ্ছিন্ন করতে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualBackup = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setStatusMessage('Google ড্রাইভে ব্যাকআপ তৈরি ও আপলোড করা হচ্ছে...');

    try {
      const res = await uploadBackupToDrive();
      if (res.success) {
        setSuccessMessage('Google ড্রাইভে সম্পূর্ণ ডাটাবেস সফলভাবে ব্যাকআপ হয়েছে! (155_UASU_BAF_Backup.json)');
        refreshStats();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'ড্রাইভ ব্যাকআপ ব্যর্থ হয়েছে।');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleInitiateRestore = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    setStatusMessage('Searching and downloading backup from Google Drive...');

    try {
      const backup = await fetchBackupFromDrive();
      setPendingRestoreData(backup);
      setShowRestoreConfirm(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'No backup found on Google Drive.');
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const runRestoreWithCircleProgress = async (payload: any, sourceLabel: string) => {
    setIsLoading(true);
    setIsRestoringProgress(true);
    setRestoreProgress(4);
    setRestoreStage('Starting database and settings restore...');
    setStatusMessage(sourceLabel);

    let targetPercent = 8;
    const progressTimer = window.setInterval(() => {
      setRestoreProgress((prev) => {
        if (prev < targetPercent) {
          const step = Math.max(1, Math.ceil((targetPercent - prev) * 0.35));
          return Math.min(targetPercent, prev + step);
        }
        return prev;
      });
    }, 45);

    try {
      const res = await restoreFromBackupData(payload, (pct, stageLabel) => {
        targetPercent = Math.max(targetPercent, pct);
        setRestoreStage(stageLabel);
        setStatusMessage(`${stageLabel} (${pct}%)`);
      });
      targetPercent = 100;
      setRestoreProgress(100);
      setRestoreStage('Database and settings restore completed!');
      await new Promise((resolve) => setTimeout(resolve, 600));
      setSuccessMessage(
        `Restore complete! Airmen: ${res.restoredAirmen}, Duty Records: ${res.restoredAssignments}, Settings: ${res.restoredSettings}`
      );
      refreshStats();
    } finally {
      window.clearInterval(progressTimer);
      setIsLoading(false);
      setIsRestoringProgress(false);
      setRestoreProgress(0);
      setRestoreStage('');
      setStatusMessage('');
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestoreData?.content) return;
    setShowRestoreConfirm(false);
    try {
      await runRestoreWithCircleProgress(pendingRestoreData.content, 'Restoring and syncing database...');
      setPendingRestoreData(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Restore process failed.');
    }
  };

  const handleOfflineFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        await runRestoreWithCircleProgress(parsed, 'Restoring data and settings from file...');
      } catch (err: any) {
        setErrorMessage(err?.message || 'Invalid backup file format! Please select a valid JSON file.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const formatTimestamp = (isoString?: string | null) => {
    if (!isoString) return 'এখনও কোনো ব্যাকআপ নেওয়া হয়নি';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('bn-BD', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Google Drive ক্লাউড ব্যাকআপ ও রিস্টোর
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Local + Personal Drive
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Firebase ও Supabase মুক্ত — আপনার নিজস্ব Google ড্রাইভে স্বয়ংক্রিয় রিয়েল-টাইম ব্যাকআপ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <div className="flex-1 text-xs leading-relaxed">{errorMessage}</div>
              <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-white">✕</button>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-start gap-3">
              <span className="text-lg">✅</span>
              <div className="flex-1 text-xs leading-relaxed">{successMessage}</div>
              <button onClick={() => setSuccessMessage('')} className="text-emerald-400 hover:text-white">✕</button>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl text-blue-300 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              <div className="text-xs font-medium">{statusMessage}</div>
            </div>
          )}

          {/* Account Connection State */}
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {driveStatus.userPhoto ? (
                  <img
                    src={driveStatus.userPhoto}
                    alt="User Avatar"
                    className="w-12 h-12 rounded-full border border-emerald-500/40 object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-700/80 border border-slate-600 flex items-center justify-center text-slate-300 font-bold text-lg">
                    {driveStatus.userName ? driveStatus.userName[0].toUpperCase() : 'G'}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-white flex items-center gap-2">
                    {driveStatus.userName || 'Google অ্যাকাউন্ট'}
                    {driveStatus.isConnected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        সংযুক্ত (Auto-Sync)
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        সংযুক্ত নেই
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {driveStatus.userEmail || 'ড্রাইভে রিয়েল-টাইম অটো ব্যাকআপ চালু করতে Gmail দিয়ে সাইন ইন করুন'}
                  </div>
                </div>
              </div>

              {/* Connect / Disconnect Button */}
              <div>
                {!driveStatus.isConnected ? (
                  <button
                    onClick={handleConnect}
                    disabled={isLoading}
                    className="flex items-center gap-2.5 px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-semibold rounded-xl text-xs transition shadow-sm disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    Sign in with Google
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition border border-slate-700"
                  >
                    ডিসকানেক্ট করুন
                  </button>
                )}
              </div>
            </div>

            {/* Last Backup Info */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">সর্বশেষ ড্রাইভ ব্যাকআপ:</span>
                <span className="text-slate-200 font-medium">
                  {formatTimestamp(driveStatus.lastBackupTime)}
                </span>
              </div>
              <div className="text-[11px] text-emerald-400/90 font-medium">
                {driveStatus.isConnected ? '✓ ডিউটি পরিবর্তনের সাথে সাথে স্বয়ংক্রিয় ব্যাকআপ হবে' : 'স্বয়ংক্রিয় ব্যাকআপ বন্ধ'}
              </div>
            </div>
          </div>

          {/* Current Local Database Status */}
          <div className="bg-slate-800/30 border border-slate-800 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
              বর্তমান লোকাল স্টোরেজের সুরক্ষিত ডাটা
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[11px]">মোট বিমানসেনা</div>
                <div className="text-lg font-bold text-emerald-400 mt-0.5">{systemStats.airmenCount} জন</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[11px]">ডিউটি অ্যাসাইনমেন্ট</div>
                <div className="text-lg font-bold text-sky-400 mt-0.5">{systemStats.assignmentsCount} টি</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[11px]">ক্যান্টিন সদস্য</div>
                <div className="text-lg font-bold text-amber-400 mt-0.5">{systemStats.canteenMembersCount} জন</div>
              </div>
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 text-[11px]">ক্যান্টিন লেনদেন</div>
                <div className="text-lg font-bold text-indigo-400 mt-0.5">{systemStats.canteenTransactionsCount} টি</div>
              </div>
            </div>
          </div>

          {/* Google Drive Actions (When Connected) */}
          {driveStatus.isConnected && (
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Google ড্রাইভ অ্যাকশন
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={handleManualBackup}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-xs transition shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  এখনই ড্রাইভে ব্যাকআপ নিন
                </button>

                <button
                  onClick={handleInitiateRestore}
                  disabled={isLoading}
                  className="flex items-center justify-center gap-2 p-3.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-medium text-xs transition shadow-lg shadow-sky-900/20 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Restore from Drive
                </button>
              </div>
            </div>
          )}

          {/* Offline File Backup & Restore (Always Available) */}
          <div className="space-y-3 pt-2">
            <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>অফলাইন ব্যাকআপ ফাইল বিকল্প</span>
              <span className="text-[11px] text-slate-500 lowercase font-normal">ইন্টারনেট ছাড়া ব্যবহার্য</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={downloadOfflineBackupJson}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                JSON ফাইল ডাউনলোড করুন
              </button>

              <label className="flex items-center justify-center gap-2 p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-medium transition cursor-pointer">
                <svg className="w-4 h-4 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                Restore from JSON File
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleOfflineFileRestore}
                  disabled={isLoading}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>লোকাল স্টোরেজ ও সার্ভার ফাইল সম্পূর্ণ অক্ষুণ্ণ</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
          >
            বন্ধ করুন
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Google Drive Restore */}
      {showRestoreConfirm && pendingRestoreData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Confirm Drive Restore</h3>
                <p className="text-xs text-slate-400">File: {pendingRestoreData.metadata.name}</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700/80 text-xs space-y-2">
              <div className="text-slate-300 font-medium">Drive Backup Summary:</div>
              <div className="grid grid-cols-2 gap-2 text-slate-400">
                <div>Airmen: <strong className="text-emerald-400">{pendingRestoreData.content?.baf_unit_data?.airmen?.length || pendingRestoreData.content?.airmen?.length || 0}</strong></div>
                <div>Duty Records: <strong className="text-sky-400">{Object.values(pendingRestoreData.content?.baf_unit_data?.assignments || pendingRestoreData.content?.assignments || {}).reduce((acc: number, arr: any) => acc + (arr?.length || 0), 0)}</strong></div>
                <div>Canteen Members: <strong className="text-amber-400">{pendingRestoreData.content?.canteen?.members?.length || pendingRestoreData.content?.canteen_members?.length || 0}</strong></div>
                <div>Transactions: <strong className="text-indigo-400">{pendingRestoreData.content?.canteen?.transactions?.length || pendingRestoreData.content?.canteen_transactions?.length || 0}</strong></div>
              </div>
              <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-700">
                Last Modified: {formatTimestamp(pendingRestoreData.metadata.modifiedTime)}
              </div>
            </div>

            <p className="text-xs text-amber-200/90 leading-relaxed">
              Are you sure you want to restore this backup? It will update your current database and settings.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setPendingRestoreData(null);
                }}
                disabled={isLoading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={isLoading}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-amber-900/30"
              >
                Yes, Restore Now
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Circle Percentage Progress Modal while Restoring */}
      {isRestoringProgress && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-sm bg-slate-900 border border-emerald-500/40 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center space-y-5">
            <div className="space-y-1">
              <h3 className="text-base font-black text-white">Restoring Database & Settings</h3>
              <p className="text-xs text-slate-400">Please wait, do not close or refresh...</p>
            </div>
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="driveRestoreCircleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="50%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(51, 65, 85, 0.45)" strokeWidth="10" />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke={restoreProgress >= 100 ? '#10b981' : 'url(#driveRestoreCircleGrad)'}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 50}
                  strokeDashoffset={2 * Math.PI * 50 * (1 - Math.min(100, Math.max(0, restoreProgress)) / 100)}
                  className="transition-all duration-150 ease-out"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black font-mono text-white tracking-tight">{restoreProgress}%</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  {restoreProgress >= 100 ? 'Complete' : 'Restoring'}
                </span>
              </div>
            </div>
            <div className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-2.5 text-xs font-semibold text-slate-200">
              {restoreStage || statusMessage || 'Restoring data...'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

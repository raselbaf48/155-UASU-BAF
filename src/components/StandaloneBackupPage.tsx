import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  Upload,
  RefreshCw,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  X,
  Cloud,
  CloudOff,
} from 'lucide-react';
import { Logo155UASU } from './Logo155UASU';
import {
  restoreFromBackupData,
  downloadOfflineBackupJson,
  exportFullSystemData,
} from '../services/googleDriveService';
import {
  localDb,
  getSyncLogs,
  clearSyncLogs,
  addSyncLog,
  getLocalCloudSyncLogs,
  addLocalCloudSyncLog,
  clearLocalCloudSyncLogs,
  getFirebaseSyncState,
} from '../services/localDatabase';
import { isFirebaseConfigured, isFirestoreQuotaExceeded } from '../firebase';
import {
  getPendingDeltaCount,
  probeFirebaseConnectionAndQuota,
} from '../services/firebaseFirestoreService';
import { getActiveUsersCount } from '../services/presenceService';
import {
  getCanteenSyncLogs,
  clearCanteenSyncLogs,
  performCanteenBackup,
  pullAllCanteenDataFromCloud,
} from '../features/canteen/utils/canteenCloudSync';

interface StandaloneBackupPageProps {
  onBack: () => void;
}

type CloudModeTab = 'LOCAL' | 'FIREBASE';

export const StandaloneBackupPage: React.FC<StandaloneBackupPageProps> = ({ onBack }) => {
  const [activeCloudTab, setActiveCloudTab] = useState<CloudModeTab>(() =>
    isFirestoreQuotaExceeded() || !isFirebaseConfigured ? 'LOCAL' : 'FIREBASE'
  );

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Shared Cloud Action Progress state
  const [cloudActionStatus, setCloudActionStatus] = useState<'' | 'Uploading...' | 'Downloading...'>('');
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncActionMessage, setSyncActionMessage] = useState<string>('');

  // Confirmation & Circle Percentage Progress state for File Restore
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [pendingRestoreData, setPendingRestoreData] = useState<any>(null);
  const [pendingFileName, setPendingFileName] = useState<string>('');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStage, setRestoreStage] = useState('');

  // Live Status & Strictly Separated Logs
  const [cloudState, setCloudState] = useState(() => getFirebaseSyncState());
  const [quotaExceeded, setQuotaExceeded] = useState(() => isFirestoreQuotaExceeded());
  const [pendingCount, setPendingCount] = useState(() => getPendingDeltaCount());
  const [activeUsers, setActiveUsers] = useState(() => getActiveUsersCount());
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  const [firebaseLogs, setFirebaseLogs] = useState(() =>
    [
      ...getSyncLogs().map((l) => ({ ...l, scope: 'Office / Duty' as const })),
      ...getCanteenSyncLogs().map((l) => ({ ...l, scope: 'Canteen' as const })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  );

  const [localCloudLogs, setLocalCloudLogs] = useState(() =>
    [...getLocalCloudSyncLogs()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  );

  const refreshCloudStatusAndLogs = () => {
    setCloudState(getFirebaseSyncState());
    setQuotaExceeded(isFirestoreQuotaExceeded());
    setPendingCount(getPendingDeltaCount());
    setActiveUsers(getActiveUsersCount());
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    setFirebaseLogs(
      [
        ...getSyncLogs().map((l) => ({ ...l, scope: 'Office / Duty' as const })),
        ...getCanteenSyncLogs().map((l) => ({ ...l, scope: 'Canteen' as const })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    );
    setLocalCloudLogs(
      [...getLocalCloudSyncLogs()].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    );
  };

  useEffect(() => {
    refreshCloudStatusAndLogs();

    const onSyncProgress = (e: any) => {
      const pct = Number(e?.detail?.percentage);
      const msg = e?.detail?.message;
      if (!isNaN(pct) && cloudActionStatus) {
        setSyncProgress(pct);
      }
      if (msg && cloudActionStatus) {
        setSyncActionMessage(String(msg));
      }
    };

    window.addEventListener('d1_sync_update', refreshCloudStatusAndLogs);
    window.addEventListener('baf_sync_logs_updated', refreshCloudStatusAndLogs);
    window.addEventListener('baf_local_cloud_logs_updated', refreshCloudStatusAndLogs);
    window.addEventListener('canteen_sync_logs_updated', refreshCloudStatusAndLogs);
    window.addEventListener('baf_firebase_quota_status', refreshCloudStatusAndLogs);
    window.addEventListener('baf_pending_delta_updated', refreshCloudStatusAndLogs);
    window.addEventListener('baf_active_users_changed', refreshCloudStatusAndLogs);
    window.addEventListener('baf_sync_progress', onSyncProgress);
    window.addEventListener('online', refreshCloudStatusAndLogs);
    window.addEventListener('offline', refreshCloudStatusAndLogs);

    return () => {
      window.removeEventListener('d1_sync_update', refreshCloudStatusAndLogs);
      window.removeEventListener('baf_sync_logs_updated', refreshCloudStatusAndLogs);
      window.removeEventListener('baf_local_cloud_logs_updated', refreshCloudStatusAndLogs);
      window.removeEventListener('canteen_sync_logs_updated', refreshCloudStatusAndLogs);
      window.removeEventListener('baf_firebase_quota_status', refreshCloudStatusAndLogs);
      window.removeEventListener('baf_pending_delta_updated', refreshCloudStatusAndLogs);
      window.removeEventListener('baf_active_users_changed', refreshCloudStatusAndLogs);
      window.removeEventListener('baf_sync_progress', onSyncProgress);
      window.removeEventListener('online', refreshCloudStatusAndLogs);
      window.removeEventListener('offline', refreshCloudStatusAndLogs);
    };
  }, [cloudActionStatus]);

  // LOCAL CLOUD ACTION 1: Backup (Downloads Offline .json Backup File + Logs to Local Cloud)
  const handleLocalOfflineBackup = async () => {
    if (cloudActionStatus || isLoading) return;
    setErrorMessage('');
    setSuccessMessage('');
    setCloudActionStatus('Uploading...');
    setSyncProgress(25);
    setSyncActionMessage('Preparing offline backup file (.json)...');

    try {
      const data = await exportFullSystemData();
      const airmenCount = data.baf_unit_data?.airmen?.length || localDb.getDb().airmen?.length || 0;
      const assignmentsCount = Object.values(data.baf_unit_data?.assignments || {}).reduce(
        (acc: number, list: any) => acc + (list?.length || 0),
        0
      );

      setSyncProgress(70);
      await downloadOfflineBackupJson();

      const now = new Date().toISOString();
      localStorage.setItem('baf_local_snapshot_time', now);

      addLocalCloudSyncLog({
        timestamp: now,
        type: 'PUSH',
        status: 'SUCCESS',
        message: `Offline backup (.json) downloaded: ${airmenCount} Airmen, ${assignmentsCount.toLocaleString()} Duty Records, Duty Settings & Preferences.`,
      });

      setSyncProgress(100);
      setSyncActionMessage('Backup Downloaded!');
      setSuccessMessage('অফলাইন ব্যাকআপ ফাইল (.json) সফলভাবে ডাউনলোড হয়েছে!');
      refreshCloudStatusAndLogs();
    } catch (err: any) {
      addLocalCloudSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PUSH',
        status: 'ERROR',
        message: `Offline backup failed: ${err?.message || 'Unknown error'}`,
      });
      setSyncActionMessage('Backup Failed!');
      setErrorMessage(err?.message || 'Backup download failed.');
      refreshCloudStatusAndLogs();
    } finally {
      setTimeout(() => {
        setCloudActionStatus('');
        setSyncProgress(0);
      }, 1400);
    }
  };

  // LOCAL CLOUD ACTION 2: Restore (Select .json Backup File)
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
          throw new Error('Invalid backup file. No 155 UASU database data found in this file.');
        }

        setPendingRestoreData(parsed);
        setShowRestoreConfirm(true);
      } catch (err: any) {
        addLocalCloudSyncLog({
          timestamp: new Date().toISOString(),
          type: 'PULL',
          status: 'ERROR',
          message: `Failed loading backup file "${file.name}": ${err?.message || 'Invalid JSON format'}`,
        });
        setErrorMessage('File load error: ' + (err.message || 'Invalid JSON format'));
        refreshCloudStatusAndLogs();
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  // Execute File Restore with Circle Percentage Progress + Log to Local Cloud Logs
  const executeRestore = async () => {
    if (!pendingRestoreData) return;

    setIsLoading(true);
    setIsRestoring(true);
    setRestoreProgress(4);
    setRestoreStage('Starting database and settings restore...');
    setErrorMessage('');
    setSuccessMessage('');

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
      const res = await restoreFromBackupData(pendingRestoreData, (pct, stageLabel) => {
        targetPercent = Math.max(targetPercent, pct);
        setRestoreStage(stageLabel);
      });

      targetPercent = 100;
      setRestoreProgress(100);
      setRestoreStage('Database and settings restore completed!');
      await new Promise((resolve) => setTimeout(resolve, 600));

      const now = new Date().toISOString();
      addLocalCloudSyncLog({
        timestamp: now,
        type: 'PULL',
        status: 'SUCCESS',
        message: `Restored from "${pendingFileName || 'backup.json'}": ${res.restoredAirmen} Airmen, ${res.restoredAssignments.toLocaleString()} Duty Records & ${res.restoredSettings} Settings.`,
      });

      setSuccessMessage(
        `Database restored successfully! (${res.restoredAirmen} Airmen, ${res.restoredAssignments.toLocaleString()} Duty Records, ${res.restoredSettings} Settings)`
      );

      setShowRestoreConfirm(false);
      setPendingRestoreData(null);
      setPendingFileName('');

      window.dispatchEvent(new CustomEvent('baf_state_updated'));
      window.dispatchEvent(new CustomEvent('canteen_members_updated'));
      refreshCloudStatusAndLogs();
    } catch (err: any) {
      addLocalCloudSyncLog({
        timestamp: new Date().toISOString(),
        type: 'PULL',
        status: 'ERROR',
        message: `Restore failed (${pendingFileName || 'backup.json'}): ${err?.message || 'Unknown error'}`,
      });
      setErrorMessage(err.message || 'Restore process failed.');
      setShowRestoreConfirm(false);
      refreshCloudStatusAndLogs();
    } finally {
      window.clearInterval(progressTimer);
      setIsLoading(false);
      setIsRestoring(false);
      setRestoreProgress(0);
      setRestoreStage('');
    }
  };

  // FIREBASE CLOUD ACTION 1: Push to Cloud
  const handleFirebasePush = async () => {
    if (cloudActionStatus || isLoading) return;
    setErrorMessage('');
    setSuccessMessage('');
    setCloudActionStatus('Uploading...');
    setSyncProgress(15);
    setSyncActionMessage('Uploading changed data to Firebase...');

    try {
      const probe = await probeFirebaseConnectionAndQuota(true);
      if (probe.quotaExceeded || isFirestoreQuotaExceeded()) {
        setSyncActionMessage('Firebase Quota Full!');
        setErrorMessage(
          'Firebase দৈনিক ফ্রি Quota পূর্ণ হয়ে গেছে। আপনার পরিবর্তন Local Cloud কিউ-তে সুরক্ষিত আছে।'
        );
        refreshCloudStatusAndLogs();
        return;
      }

      setSyncProgress(45);
      const pendingBefore = getPendingDeltaCount();
      const [officeOk, canteenOk] = await Promise.all([
        localDb.saveToFirebase(localDb.getDb(), true),
        performCanteenBackup(false),
      ]);

      setSyncProgress(100);
      if (officeOk && canteenOk) {
        if (pendingBefore === 0) {
          addSyncLog({
            timestamp: new Date().toISOString(),
            type: 'PUSH',
            status: 'SUCCESS',
            message: 'All Office, Duty & Canteen records are already in sync with Firebase Cloud.',
          });
        }
        setSyncActionMessage('Upload Completed!');
        setSuccessMessage('Firebase Cloud-এ ব্যাকআপ সফলভাবে সম্পন্ন হয়েছে!');
      } else {
        setSyncActionMessage('Partial Upload / Queued');
        setErrorMessage('আংশিক ব্যাকআপ হয়েছে বা অফলাইনে আছে। অনুগ্রহ করে Recent Sync Logs দেখুন।');
      }
      refreshCloudStatusAndLogs();
    } catch (err: any) {
      setSyncActionMessage('Upload Failed!');
      setErrorMessage('Firebase Cloud Push ব্যর্থ হয়েছে: ' + (err?.message || 'Unknown error'));
    } finally {
      setTimeout(() => {
        setCloudActionStatus('');
        setSyncProgress(0);
      }, 1400);
    }
  };

  // FIREBASE CLOUD ACTION 2: Pull from Cloud
  const handleFirebasePull = async () => {
    if (cloudActionStatus || isLoading) return;
    setErrorMessage('');
    setSuccessMessage('');
    setCloudActionStatus('Downloading...');
    setSyncProgress(15);
    setSyncActionMessage('Pulling latest data from Firebase Cloud...');

    try {
      const probe = await probeFirebaseConnectionAndQuota(true);
      if (probe.quotaExceeded || isFirestoreQuotaExceeded()) {
        setSyncActionMessage('Firebase Quota Exceeded');
        setErrorMessage(
          'Firebase Quota শেষ থাকার কারণে এই মুহূর্তে ক্লাউড থেকে ডাউনলোড করা যাচ্ছে না। Local Cloud সক্রিয় আছে।'
        );
        refreshCloudStatusAndLogs();
        return;
      }

      setSyncProgress(50);
      await Promise.all([
        localDb.syncFromFirebase({ isLoginSync: false, isQuotaRecovery: true }),
        pullAllCanteenDataFromCloud({ isLoginSync: false, isQuotaRecovery: true }),
      ]);

      setSyncProgress(100);
      setSyncActionMessage('Download Completed!');
      window.dispatchEvent(new CustomEvent('baf_state_updated'));
      window.dispatchEvent(new CustomEvent('canteen_members_updated'));
      setSuccessMessage('Firebase Cloud থেকে সর্বশেষ ডাটা সফলভাবে রিলোড হয়েছে!');
      refreshCloudStatusAndLogs();
    } catch (err: any) {
      setSyncActionMessage('Download Failed!');
      setErrorMessage('Firebase Cloud Pull ব্যর্থ হয়েছে: ' + (err?.message || 'Unknown error'));
    } finally {
      setTimeout(() => {
        setCloudActionStatus('');
        setSyncProgress(0);
      }, 1400);
    }
  };

  const handleClearActiveLogs = () => {
    if (activeCloudTab === 'LOCAL') {
      clearLocalCloudSyncLogs();
      setSuccessMessage('Local Cloud logs cleared.');
    } else {
      clearSyncLogs();
      clearCanteenSyncLogs();
      setSuccessMessage('Firebase Cloud logs cleared.');
    }
    refreshCloudStatusAndLogs();
    setTimeout(() => setSuccessMessage(''), 3000);
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

  const activeLogs = activeCloudTab === 'LOCAL' ? localCloudLogs : firebaseLogs;

  const getLogTitle = (log: any) => {
    if (activeCloudTab === 'LOCAL') {
      if (log.type === 'PUSH') {
        return log.message?.toLowerCase().includes('.json') || log.message?.toLowerCase().includes('offline')
          ? 'Offline Backup Downloaded'
          : 'Uploaded to Local Cloud';
      }
      return log.message?.toLowerCase().includes('restored') || log.message?.toLowerCase().includes('.json')
        ? 'Restored from Backup File'
        : 'Downloaded from Local Cloud';
    }
    return log.type === 'PULL' ? 'Downloaded from Cloud' : 'Uploaded to Cloud';
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0c0e14] text-slate-100 flex flex-col w-screen h-screen overflow-hidden">
      {/* Full-Width Top Header */}
      <header className="shrink-0 bg-[#141721]/95 backdrop-blur-md border-b border-slate-800/80 px-5 sm:px-10 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="hidden sm:block h-5 w-px bg-slate-800" />

          <div className="flex items-center gap-2.5">
            <Logo155UASU className="w-8 h-8 shrink-0" />
            <div>
              <div className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">
                155 UASU BAF • BASE ZHR
              </div>
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight leading-none">
                Database Cloud Sync & Backup
              </h1>
            </div>
          </div>
        </div>

        {/* Clean Live Status Pill */}
        <div className="flex items-center gap-2">
          {quotaExceeded ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Quota Full • Local Cloud
            </span>
          ) : cloudState.status === 'syncing' || cloudActionStatus !== '' ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/40">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              Syncing...
            </span>
          ) : !isOnline || !isFirebaseConfigured ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              Local Offline Mode
            </span>
          ) : pendingCount > 0 ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/40">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              {pendingCount} Pending
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Cloud Synced
            </span>
          )}
        </div>
      </header>

      {/* Full-Screen Laptop Body */}
      <main className="flex-1 w-full flex flex-col px-5 sm:px-10 lg:px-16 py-5 sm:py-7 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col gap-5">
          {/* Alerts */}
          {errorMessage && (
            <div className="shrink-0 flex items-center justify-between p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs sm:text-sm font-semibold animate-in fade-in">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="p-1 hover:bg-rose-500/20 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {successMessage && (
            <div className="shrink-0 flex items-center justify-between p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs sm:text-sm font-semibold animate-in fade-in">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{successMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMessage('')}
                className="p-1 hover:bg-emerald-500/20 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* 2-Option Mode Switcher: Local Cloud | Firebase Cloud */}
          <div className="shrink-0 w-full max-w-xl mx-auto bg-[#141927] border border-slate-800 rounded-2xl p-1.5 grid grid-cols-2 gap-2 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setActiveCloudTab('LOCAL');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeCloudTab === 'LOCAL'
                  ? 'bg-[#1e293b] text-emerald-400 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Local Cloud</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveCloudTab('FIREBASE');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeCloudTab === 'FIREBASE'
                  ? 'bg-[#1e293b] text-blue-400 border border-blue-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Cloud className="w-4 h-4" />
              <span>Firebase Cloud</span>
            </button>
          </div>

          {/* Full-Screen Main Interface Card (Same Clean Layout in Both Tabs) */}
          <section className="flex-1 w-full bg-[#131826] border border-slate-800/80 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl flex flex-col justify-between">
            {/* Upper Centered Action Area */}
            <div className="flex flex-col items-center justify-center text-center max-w-2xl w-full mx-auto">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 ${
                  activeCloudTab === 'LOCAL' ? 'bg-emerald-500/15' : 'bg-[#1e2b4d]'
                }`}
              >
                {activeCloudTab === 'LOCAL' ? (
                  <HardDrive className="w-8 h-8 text-emerald-400" />
                ) : (
                  <Cloud className="w-8 h-8 text-blue-400" />
                )}
              </div>

              <h2 className="text-2xl font-bold text-white mb-2">
                {activeCloudTab === 'LOCAL' ? 'Local Cloud Backup & Restore' : 'Firebase Cloud Sync'}
              </h2>

              <p className="text-sm text-slate-400 mb-7 max-w-lg leading-relaxed">
                {activeCloudTab === 'LOCAL'
                  ? 'সম্পূর্ণ ডাটাবেজ ও সেটিংস অফলাইন ফাইল (.json) হিসেবে ব্যাকআপ নিন অথবা আগের ব্যাকআপ ফাইল সিলেক্ট করে রিস্টোর করুন।'
                  : 'লোকাল ডাটাবেজ পরিবর্তনসমূহ Firebase Cloud-এ সংরক্ষণ করুন বা ক্লাউড থেকে সর্বশেষ ডাটা রিলোড করুন।'}
              </p>

              {/* Progress Bar */}
              {(cloudActionStatus === 'Uploading...' || cloudActionStatus === 'Downloading...') &&
                syncProgress >= 0 &&
                syncProgress <= 100 && (
                  <div className="w-full max-w-md mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                        {syncActionMessage || 'Processing...'}
                      </span>
                      <span className="text-xs font-bold text-slate-300">{syncProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-700">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${syncProgress}%` }}
                      />
                    </div>
                  </div>
                )}

              {/* Action Buttons: Backup / Restore for Local Cloud | Push to Cloud / Pull from Cloud for Firebase Cloud */}
              {activeCloudTab === 'LOCAL' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                  <button
                    type="button"
                    onClick={handleLocalOfflineBackup}
                    disabled={cloudActionStatus !== '' || isLoading}
                    className="relative group w-full overflow-hidden rounded-xl p-[1px] transition-all hover:shadow-[0_0_18px_-5px_rgba(59,130,246,0.35)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/45 to-indigo-600/45 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative flex flex-row items-center justify-center gap-2.5 w-full h-full bg-[#1e293b] px-5 py-4 rounded-xl border border-slate-700/50 transition-colors group-hover:bg-[#1e293b]/85">
                      <Download
                        className={`w-4 h-4 text-blue-400 ${
                          cloudActionStatus === 'Uploading...' ? 'animate-bounce' : ''
                        }`}
                      />
                      <span className="text-sm font-semibold tracking-wide text-slate-100">
                        {cloudActionStatus === 'Uploading...' && syncProgress === 100
                          ? 'Downloaded!'
                          : cloudActionStatus === 'Uploading...'
                          ? 'Preparing...'
                          : 'Backup (.json)'}
                      </span>
                    </div>
                  </button>

                  <label
                    className={`relative group w-full overflow-hidden rounded-xl p-[1px] transition-all hover:shadow-[0_0_18px_-5px_rgba(16,185,129,0.35)] ${
                      cloudActionStatus !== '' || isLoading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/45 to-teal-600/45 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative flex flex-row items-center justify-center gap-2.5 w-full h-full bg-[#1e293b] px-5 py-4 rounded-xl border border-slate-700/50 transition-colors group-hover:bg-[#1e293b]/85">
                      <Upload className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold tracking-wide text-slate-100">
                        Restore (Select File)
                      </span>
                    </div>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={cloudActionStatus !== '' || isLoading}
                    />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
                  <button
                    type="button"
                    onClick={handleFirebasePush}
                    disabled={cloudActionStatus !== '' || isLoading}
                    className="relative group w-full overflow-hidden rounded-xl p-[1px] transition-all hover:shadow-[0_0_18px_-5px_rgba(59,130,246,0.35)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/45 to-indigo-600/45 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative flex flex-row items-center justify-center gap-2.5 w-full h-full bg-[#1e293b] px-5 py-4 rounded-xl border border-slate-700/50 transition-colors group-hover:bg-[#1e293b]/85">
                      <Upload
                        className={`w-4 h-4 text-blue-400 ${
                          cloudActionStatus === 'Uploading...' ? 'animate-bounce' : ''
                        }`}
                      />
                      <span className="text-sm font-semibold tracking-wide text-slate-100">
                        {cloudActionStatus === 'Uploading...' && syncProgress === 100
                          ? 'Success!'
                          : cloudActionStatus === 'Uploading...'
                          ? 'Uploading...'
                          : 'Push to Cloud'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleFirebasePull}
                    disabled={cloudActionStatus !== '' || isLoading}
                    className="relative group w-full overflow-hidden rounded-xl p-[1px] transition-all hover:shadow-[0_0_18px_-5px_rgba(16,185,129,0.35)] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/45 to-teal-600/45 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative flex flex-row items-center justify-center gap-2.5 w-full h-full bg-[#1e293b] px-5 py-4 rounded-xl border border-slate-700/50 transition-colors group-hover:bg-[#1e293b]/85">
                      <Download
                        className={`w-4 h-4 text-emerald-400 ${
                          cloudActionStatus === 'Downloading...' ? 'animate-bounce' : ''
                        }`}
                      />
                      <span className="text-sm font-semibold tracking-wide text-slate-100">
                        {cloudActionStatus === 'Downloading...' && syncProgress === 100
                          ? 'Success!'
                          : cloudActionStatus === 'Downloading...'
                          ? 'Downloading...'
                          : 'Pull from Cloud'}
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Logs Section inside the Full-Screen Card */}
            <div className="mt-8 flex-1 flex flex-col min-h-[200px]">
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {activeCloudTab === 'LOCAL' ? 'Recent Backup & Restore Logs' : 'Recent Sync Logs'}
                </h3>
                {activeLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearActiveLogs}
                    className="text-xs font-semibold text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  >
                    Clear Logs
                  </button>
                )}
              </div>

              {activeLogs.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-10 bg-slate-800/30 rounded-2xl border border-slate-800/60">
                  <p className="text-sm font-bold text-slate-500">
                    {activeCloudTab === 'LOCAL'
                      ? 'No recent Backup or Restore logs.'
                      : 'No recent Firebase Sync logs.'}
                  </p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-[340px]">
                  {activeLogs.map((log: any) => (
                    <div
                      key={log.id}
                      className="p-4 bg-[#1b2234] border border-slate-700/50 rounded-xl flex justify-between items-start gap-4"
                    >
                      <div className="flex gap-3 min-w-0">
                        <div className="pt-1.5 shrink-0">
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white mb-0.5">{getLogTitle(log)}</p>
                          <p className="text-xs text-slate-400 break-words leading-relaxed">
                            {log.message}
                          </p>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono text-right shrink-0 mt-0.5">
                        {new Date(log.timestamp).toLocaleDateString()}
                        <br />
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Subtle Single-Line Auto-Sync & Color Legend Footer inside Firebase Tab */}
              {activeCloudTab === 'FIREBASE' && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                  <span>
                    {activeUsers >= 2
                      ? `একাধিক ইউজার (${activeUsers} জন) সক্রিয় — পরিবর্তন হলে ১০ সেকেন্ড পরপর Auto Backup`
                      : '১ জন ইউজার সক্রিয় — ৩০ মিনিট পরপর ও অ্যাপ বন্ধ করার আগে Auto Backup'}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <Cloud className="w-3.5 h-3.5" /> Synced
                    </span>
                    <span className="inline-flex items-center gap-1 text-indigo-400">
                      <Cloud className="w-3.5 h-3.5" /> Syncing
                    </span>
                    <span className="inline-flex items-center gap-1 text-sky-400">
                      <Cloud className="w-3.5 h-3.5" /> Queued
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-400">
                      <Cloud className="w-3.5 h-3.5" /> Quota Full
                    </span>
                    <span className="inline-flex items-center gap-1 text-rose-400">
                      <CloudOff className="w-3.5 h-3.5" /> Offline
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Confirmation & Circular Progress Modal for Backup File Restore */}
      {showRestoreConfirm && pendingRestoreData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in">
          <div
            className={`w-full max-w-md bg-[#161821] border ${
              isRestoring ? 'border-emerald-500/40' : 'border-amber-500/40'
            } rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95`}
          >
            {isRestoring ? (
              <div className="py-4 flex flex-col items-center text-center space-y-5">
                <div className="space-y-1">
                  <h3 className="text-base font-black text-white">
                    Restoring Database & Settings
                  </h3>
                  <p className="text-xs text-slate-400">
                    Please wait, do not close or refresh this page
                  </p>
                </div>

                {/* Circular Progress Gauge */}
                <div className="relative w-36 h-36 flex items-center justify-center">
                  <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 120 120">
                    <defs>
                      <linearGradient id="restoreCircleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#10b981" />
                        <stop offset="50%" stopColor="#06b6d4" />
                        <stop offset="100%" stopColor="#f59e0b" />
                      </linearGradient>
                    </defs>
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke="rgba(51, 65, 85, 0.45)"
                      strokeWidth="10"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="50"
                      fill="none"
                      stroke={restoreProgress >= 100 ? '#10b981' : 'url(#restoreCircleGrad)'}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={
                        2 * Math.PI * 50 * (1 - Math.min(100, Math.max(0, restoreProgress)) / 100)
                      }
                      className="transition-all duration-150 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {restoreProgress >= 100 ? (
                      <CheckCircle2 className="w-7 h-7 text-emerald-400 mb-0.5 animate-in zoom-in" />
                    ) : null}
                    <span className="text-2xl font-black font-mono text-white tracking-tight">
                      {restoreProgress}%
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                      {restoreProgress >= 100 ? 'Complete' : 'Restoring'}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Current Step:</span>
                    <span className="font-mono font-bold text-emerald-400">{restoreProgress}%</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-200">
                    {restoreStage || 'Restoring database and settings...'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 text-amber-400">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-white">
                      Confirm Database Restore
                    </h3>
                    <p className="text-[11px] text-amber-300">
                      Current database records and settings will be replaced with this backup data
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900/80 rounded-2xl p-3.5 border border-slate-800 text-xs text-slate-300 space-y-1.5">
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Airmen Count:</span>
                    <strong className="text-white font-mono">
                      {pendingRestoreData.baf_unit_data?.airmen?.length ||
                        pendingRestoreData.airmen?.length ||
                        'Found'}{' '}
                      Personnel
                    </strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Canteen Members:</span>
                    <strong className="text-white font-mono">
                      {pendingRestoreData.canteen?.members?.length ||
                        pendingRestoreData.canteen_members?.length ||
                        'Found'}{' '}
                      Members
                    </strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-800/80">
                    <span className="text-slate-400">Duty & Other Settings:</span>
                    <strong className="text-emerald-400 font-mono">
                      {pendingRestoreData.canteen?.settings?.length ||
                        pendingRestoreData.app_settings?.length ||
                        (pendingRestoreData.localSettings
                          ? Object.keys(pendingRestoreData.localSettings).length
                          : 0) ||
                        'Included'}{' '}
                      Items
                    </strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Backup Date:</span>
                    <strong className="text-white font-mono text-[11px]">
                      {pendingRestoreData.exportedAt
                        ? formatHistoryDate(pendingRestoreData.exportedAt)
                        : 'Offline Savepoint'}
                    </strong>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  Are you sure you want to restore this backup and apply it to the system?
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
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={executeRestore}
                    disabled={isLoading}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    Start Restore
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

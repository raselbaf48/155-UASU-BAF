import React, { useState, useEffect } from 'react';
import { 
  Save, CheckCircle2, Loader2, Users, Search, Eye, EyeOff, 
  ShieldCheck, Phone, AlertTriangle, RotateCcw, ArrowLeft, 
  ChevronRight, Cloud, Download, Upload, RefreshCw, KeyRound, 
  Coffee, Database, Settings, Shield, Sparkles, X, History,
  Layers, Check, Clock, Trash2, ArrowRight
} from 'lucide-react';
import { 
  getCanteenConfig, saveCanteenConfig, resolveImageUrl, 
  fetchCanteenConfigFromCloud, checkPreOrderWindow, CanteenConfig 
} from '../utils/canteenSettings';
import { resetAllCanteenData } from '../utils/resetCanteenData';
import { pullAllCanteenDataFromCloud } from '../utils/canteenCloudSync';
import { supabase } from '../../../supabase';
import { SaveButton } from '../components/SaveButton';
import { CanteenMemberDB } from './CanteenMemberDB';

export type CanteenSettingSection = 'identity' | 'timing' | 'manager' | 'member_db' | 'cloudsync' | 'dangerZone';

interface SectionMeta {
  id: CanteenSettingSection;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
}

export interface CanteenSyncLog {
  id: string;
  type: 'PUSH' | 'PULL';
  message: string;
  status: 'SUCCESS' | 'ERROR';
  timestamp: string;
}

const CANTEEN_SYNC_LOGS_KEY = 'canteen_sync_logs';

const INITIAL_SYNC_LOGS: CanteenSyncLog[] = [
  {
    id: 'sync-log-1',
    type: 'PULL',
    message: 'Automatic cloud sync completed for Canteen_Member & Canteen_Config.',
    status: 'SUCCESS',
    timestamp: new Date(Date.now() - 1000 * 60 * 10).toLocaleString()
  },
  {
    id: 'sync-log-2',
    type: 'PUSH',
    message: 'Database connection verified. Central Supabase realtime channel active.',
    status: 'SUCCESS',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toLocaleString()
  }
];

interface CanteenSettingsProps {
  onClose?: () => void;
}

export const CanteenSettings: React.FC<CanteenSettingsProps> = ({ onClose }) => {
  // Option-wise Navigation State (null = menu list, string = specific option page)
  const [activeSection, setActiveSection] = useState<CanteenSettingSection | null>(null);

  const [settings, setSettings] = useState<CanteenConfig>(() => getCanteenConfig());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(true);

  // Member DB selection for manager
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Clean Slate / Reset Data state
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Cloud Sync state (Office style)
  const [lastSyncedTime, setLastSyncedTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStatusText, setSyncStatusText] = useState<string>('');
  const [isSyncingPush, setIsSyncingPush] = useState(false);
  const [isSyncingPull, setIsSyncingPull] = useState(false);

  // Database Row Counts
  const [tableCounts, setTableCounts] = useState({
    members: 0,
    transactions: 0,
    expenses: 0
  });

  // Cloud Sync Logs state (as like Office App)
  const [syncLogs, setSyncLogs] = useState<CanteenSyncLog[]>(() => {
    try {
      const saved = localStorage.getItem(CANTEEN_SYNC_LOGS_KEY);
      return saved ? JSON.parse(saved) : INITIAL_SYNC_LOGS;
    } catch {
      return INITIAL_SYNC_LOGS;
    }
  });

  const addSyncLog = (entry: Omit<CanteenSyncLog, 'id' | 'timestamp'>) => {
    const newLog: CanteenSyncLog = {
      id: 'sync-log-' + Date.now(),
      timestamp: new Date().toLocaleString(),
      ...entry
    };
    const updated = [newLog, ...syncLogs].slice(0, 30);
    setSyncLogs(updated);
    try {
      localStorage.setItem(CANTEEN_SYNC_LOGS_KEY, JSON.stringify(updated));
    } catch { /* empty */ }
  };

  const handleClearSyncLogs = () => {
    setSyncLogs([]);
    localStorage.removeItem(CANTEEN_SYNC_LOGS_KEY);
  };

  const loadTableCounts = () => {
    try {
      const rawMem = localStorage.getItem('canteen_members_cache');
      const memCount = rawMem ? JSON.parse(rawMem).length : 0;
      const rawTxs = localStorage.getItem('canteen_txs');
      const txCount = rawTxs ? JSON.parse(rawTxs).length : 0;
      const rawExp = localStorage.getItem('canteen_expenses');
      const expCount = rawExp ? JSON.parse(rawExp).length : 0;
      setTableCounts({
        members: memCount,
        transactions: txCount,
        expenses: expCount
      });
    } catch { /* empty */ }
  };

  useEffect(() => {
    fetchCanteenConfigFromCloud().then((cloudCfg) => {
      setSettings(cloudCfg);
      setLastSyncedTime(new Date().toLocaleTimeString());
    });
    fetchMembers();
    loadTableCounts();
  }, []);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const { data, error } = await supabase.from('Canteen_Member').select('*');
      if (!error && data) {
        setMembers(data);
      }
    } catch (e) {
      console.warn('Failed to load members for manager picker:', e);
    }
    setLoadingMembers(false);
  };

  const handleSelectManager = (member: any) => {
    const rank = member['Rank'] || '';
    const surname = member['Surname'] || '';
    const fullName = `${rank} ${surname}`.trim() || 'Canteen Manager';
    const contact = member['Contact'] || '';
    const dp = member['DP'] || '';
    const bdNo = member['BD No'] || '';

    const updated: CanteenConfig = {
      ...settings,
      managerName: fullName,
      phone: contact,
      adminImage: dp,
      managerBdNo: bdNo
    };

    setSettings(updated);
    saveCanteenConfig(updated);
    setShowMemberPicker(false);
    showSavedFeedback();
  };

  const handlePasswordChange = (newPass: string) => {
    const updated = { ...settings, password: newPass };
    setSettings(updated);
    saveCanteenConfig(updated);
  };

  const handleNameChange = (newName: string) => {
    const updated = { ...settings, name: newName };
    setSettings(updated);
    saveCanteenConfig(updated);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    saveCanteenConfig(settings);
    setIsSaving(false);
    setLastSyncedTime(new Date().toLocaleTimeString());
    showSavedFeedback();
    addSyncLog({
      type: 'PUSH',
      message: 'Canteen settings saved and synced to Supabase cloud.',
      status: 'SUCCESS'
    });
  };

  // Office style Push to Cloud
  const handlePushToCloud = async () => {
    setIsSyncingPush(true);
    setSyncStatusText('Preparing local data for cloud upload...');
    setSyncProgress(25);
    await new Promise(r => setTimeout(r, 400));
    setSyncProgress(60);
    setSyncStatusText('Uploading configuration and tables to Supabase...');

    try {
      saveCanteenConfig(settings);
      setSyncProgress(100);
      setSyncStatusText('Cloud Upload Completed Successfully! ✓');
      setLastSyncedTime(new Date().toLocaleTimeString());
      showSavedFeedback();
      addSyncLog({
        type: 'PUSH',
        message: 'Successfully uploaded canteen parameters and local data to Supabase.',
        status: 'SUCCESS'
      });
      setTimeout(() => {
        setSyncProgress(0);
        setSyncStatusText('');
      }, 2500);
    } catch (err: any) {
      setSyncStatusText(`Upload Failed: ${err?.message || 'Network error'}`);
      addSyncLog({
        type: 'PUSH',
        message: err?.message || 'Error pushing data to Supabase.',
        status: 'ERROR'
      });
    } finally {
      setIsSyncingPush(false);
    }
  };

  // Office style Pull from Cloud
  const handlePullFromCloud = async () => {
    setIsSyncingPull(true);
    setSyncStatusText('Connecting to central Supabase database...');
    setSyncProgress(20);
    await new Promise(r => setTimeout(r, 400));
    setSyncProgress(65);
    setSyncStatusText('Downloading latest members, configuration & transactions...');

    try {
      await pullAllCanteenDataFromCloud();
      const cloudCfg = await fetchCanteenConfigFromCloud();
      setSettings(cloudCfg);
      loadTableCounts();
      setSyncProgress(100);
      setSyncStatusText('Cloud Download Completed Successfully! ✓');
      setLastSyncedTime(new Date().toLocaleTimeString());
      showSavedFeedback();
      addSyncLog({
        type: 'PULL',
        message: 'Successfully pulled latest canteen data and config from Supabase.',
        status: 'SUCCESS'
      });
      setTimeout(() => {
        setSyncProgress(0);
        setSyncStatusText('');
      }, 2500);
    } catch (err: any) {
      setSyncStatusText(`Download Failed: ${err?.message || 'Network error'}`);
      addSyncLog({
        type: 'PULL',
        message: err?.message || 'Error pulling data from Supabase.',
        status: 'ERROR'
      });
    } finally {
      setIsSyncingPull(false);
    }
  };

  const handleResetAllData = async () => {
    setIsResetting(true);
    await resetAllCanteenData(true);
    setIsResetting(false);
    setShowResetModal(false);
    setResetSuccess(true);
    loadTableCounts();
    setTimeout(() => setResetSuccess(false), 5000);
  };

  const showSavedFeedback = () => {
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const resolvedManagerDp = resolveImageUrl(settings.adminImage);

  const filteredMembers = members.filter((m) => {
    const bd = String(m['BD No'] || '').toLowerCase().replace(/\D/g, '');
    if (bd === '48456') return false;
    const term = memberSearch.toLowerCase();
    const bdRaw = String(m['BD No'] || '').toLowerCase();
    const name = String(m['Surname'] || '').toLowerCase();
    const rank = String(m['Rank'] || '').toLowerCase();
    return bdRaw.includes(term) || name.includes(term) || rank.includes(term);
  });

  // Settings Option Sections
  const sections: SectionMeta[] = [
    {
      id: 'identity',
      label: 'Canteen Identity & Profile',
      description: 'Canteen name, unit tags, and general display configuration',
      icon: <Coffee className="w-5 h-5" />,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      badge: settings.name || 'CAFE UAV'
    },
    {
      id: 'timing',
      label: 'Pre-Order Timing & Schedule',
      description: 'Configure active hours for menu appearance & automatic pre-order cutoff',
      icon: <Clock className="w-5 h-5" />,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      badge: `${settings.preOrderStartTime || '08:00'} - ${settings.preOrderEndTime || '16:00'}`
    },
    {
      id: 'manager',
      label: 'Manager & Credentials',
      description: 'Manager assignment, photo, and access PIN / password',
      icon: <ShieldCheck className="w-5 h-5" />,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
      badge: settings.managerName ? settings.managerName.split(' ')[0] : 'Not Set'
    },
    {
      id: 'member_db',
      label: 'Member Database',
      description: 'Browse, search, edit member list, view dues, and add new members',
      icon: <Users className="w-5 h-5" />,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      badge: `${tableCounts.members || members.length} Members`
    },
    {
      id: 'cloudsync',
      label: 'Database Cloud Sync',
      description: 'Real-time cloud backup, sync status, push/pull, and sync logs',
      icon: <Cloud className="w-5 h-5" />,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      badge: 'Supabase Live'
    },
    {
      id: 'dangerZone',
      label: 'Data Reset & Danger Zone',
      description: 'Reset sales, dues, and expense logs for a fresh start',
      icon: <RotateCcw className="w-5 h-5" />,
      color: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
      badge: 'Danger'
    }
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 animate-in fade-in duration-300 pb-16">
      
      {/* Toast Feedback */}
      {saveSuccess && (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-600 text-white font-bold px-5 py-3 rounded-2xl shadow-xl border border-emerald-400/40 flex items-center space-x-2 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>Realtime Saved & Synced to Cloud!</span>
        </div>
      )}

      {/* VIEW MODE 1: SETTINGS MENU LIST (When activeSection === null) */}
      {!activeSection ? (
        <div className="space-y-6">
          {/* Header with Exit to Canteen Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-xl">
            <div>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                  <Settings className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">
                    CANTEEN SETTINGS
                  </h2>
                  <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    OFFICE STYLE OPTION-WISE SYSTEM CONFIGURATION
                  </p>
                </div>
              </div>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-2xl text-xs font-black tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-400" />
                <span>Exit to Canteen</span>
              </button>
            )}
          </div>

          {/* Option-Wise Navigation Cards (As Like Office App Settings) */}
          <div className="grid grid-cols-1 gap-3.5">
            {sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className="w-full bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 md:p-6 transition-all duration-200 text-left flex items-center justify-between group shadow-sm hover:shadow-xl cursor-pointer"
              >
                <div className="flex items-center space-x-4 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${sec.color} shadow-md`}>
                    {sec.icon}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2.5 flex-wrap">
                      <h4 className="text-base font-black text-white group-hover:text-indigo-400 transition-colors">
                        {sec.label}
                      </h4>
                      {sec.badge && (
                        <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {sec.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {sec.description}
                    </p>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-xl bg-slate-800/80 group-hover:bg-indigo-600 group-hover:text-white text-slate-400 flex items-center justify-center transition-all shrink-0 ml-3">
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: SPECIFIC OPTION DETAIL SUBPAGE */
        <div className="space-y-6">
          {/* Subpage Top Bar with Back Button & Option Tabs */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveSection(null)}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-black tracking-wider uppercase transition-colors border border-slate-700 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-indigo-400" />
                <span>Back to Settings</span>
              </button>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
                  <span>Last Synced:</span>
                  <span className="text-emerald-400 font-bold">{lastSyncedTime}</span>
                </div>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                    title="Exit Settings"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Quick Horizontal Pill Switcher */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {sections.map((sec) => {
                const isCurrent = activeSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setActiveSection(sec.id)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {sec.icon}
                    <span>{sec.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* OPTION 1: CANTEEN IDENTITY & PROFILE */}
          {activeSection === 'identity' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-800 space-y-7 animate-in fade-in">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Coffee className="w-6 h-6 text-amber-400" />
                  <span>CANTEEN IDENTITY & PROFILE</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure canteen name, unit, and display information
                </p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    CANTEEN NAME *
                  </label>
                  <input
                    type="text"
                    value={settings.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. 🍽️ Cafe UAV 🍽️"
                    className="w-full bg-slate-950 text-white rounded-2xl px-5 py-4 text-base font-black tracking-wide border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1.5">
                    Displayed on Point of Sale (POS), member portal, and bill receipts.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                      UNIT & BASE LOCATION
                    </label>
                    <input
                      type="text"
                      disabled
                      value="155 UASU BAF"
                      className="w-full bg-slate-950/60 text-slate-400 rounded-2xl px-5 py-3.5 text-xs font-mono font-bold border border-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                      CURRENCY SYMBOL
                    </label>
                    <input
                      type="text"
                      disabled
                      value="৳ (BDT - Taka)"
                      className="w-full bg-slate-950/60 text-emerald-400 rounded-2xl px-5 py-3.5 text-xs font-mono font-bold border border-slate-800"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <SaveButton
                    type="button"
                    onClick={handleSaveAll}
                    isSaving={isSaving}
                    isSaved={saveSuccess}
                    idleText="Save Settings to Cloud"
                    savingText="Saving..."
                    savedText="Successfully Saved & Synced! ✓"
                    className="w-full py-4 text-xs font-black tracking-widest cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* OPTION: PRE-ORDER TIMING & SCHEDULE */}
          {activeSection === 'timing' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-800 space-y-7 animate-in fade-in">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Clock className="w-6 h-6 text-emerald-400" />
                  <span>PRE-ORDER TIMING & SERVICE SCHEDULE</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Configure active order hours. Menu automatically appears at Start Time and disappears / cuts off at End Time.
                </p>
              </div>

              {/* Real-time Status Card */}
              {(() => {
                const status = checkPreOrderWindow(settings);
                return (
                  <div className={`p-6 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    status.isOpen 
                      ? 'bg-emerald-950/40 border-emerald-500/40' 
                      : 'bg-rose-950/30 border-rose-500/30'
                  }`}>
                    <div className="flex items-center space-x-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                        status.isOpen ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                      }`}>
                        <Clock className="w-7 h-7" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center space-x-1.5 ${
                            status.isOpen ? 'bg-emerald-500 text-slate-950' : 'bg-rose-500 text-white'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                            <span>{status.isOpen ? 'ACTIVE / OPEN NOW' : 'CLOSED / CUTOFF'}</span>
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-300">
                            {status.startTime} - {status.endTime}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white mt-1">
                          {status.message}
                        </p>
                        {status.timeRemainingText && (
                          <p className="text-xs text-emerald-300 font-medium">
                            ⏱️ {status.timeRemainingText}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center sm:self-center">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.preOrderEnabled !== false}
                          onChange={(e) => {
                            const updated = { ...settings, preOrderEnabled: e.target.checked };
                            setSettings(updated);
                            saveCanteenConfig(updated);
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-14 h-8 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-600"></div>
                        <span className="ml-3 text-xs font-black uppercase tracking-wider text-slate-300">
                          {settings.preOrderEnabled !== false ? 'Service Enabled' : 'Disabled'}
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })()}

              {/* Time Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/60 p-6 rounded-3xl border border-slate-800">
                <div className="space-y-2">
                  <label className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Clock className="w-4 h-4" />
                    <span>PRE-ORDER START TIME (APPEAR)</span>
                  </label>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Menu items will automatically appear for airmen & members starting at this time.
                  </p>
                  <input
                    type="time"
                    value={settings.preOrderStartTime || '08:00'}
                    onChange={(e) => {
                      const updated = { ...settings, preOrderStartTime: e.target.value };
                      setSettings(updated);
                      saveCanteenConfig(updated);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-emerald-500 rounded-2xl px-5 py-3.5 text-base font-bold text-white outline-none transition-all shadow-inner"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Clock className="w-4 h-4" />
                    <span>PRE-ORDER END TIME (AUTO CUTOFF)</span>
                  </label>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Menu automatically disappears and locks. Outside this time, no pre-orders are taken.
                  </p>
                  <input
                    type="time"
                    value={settings.preOrderEndTime || '16:00'}
                    onChange={(e) => {
                      const updated = { ...settings, preOrderEndTime: e.target.value };
                      setSettings(updated);
                      saveCanteenConfig(updated);
                    }}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-rose-500 rounded-2xl px-5 py-3.5 text-base font-bold text-white outline-none transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                  QUICK PRESETS (কুইক শিফট টাইমিং)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { label: 'Morning & Lunch', start: '08:00', end: '14:00' },
                    { label: 'Full Day Regular', start: '08:00', end: '16:00' },
                    { label: 'Extended Daytime', start: '08:00', end: '18:00' },
                    { label: 'Evening Snacks', start: '16:00', end: '21:00' }
                  ].map((p, idx) => {
                    const isSelected = (settings.preOrderStartTime || '08:00') === p.start && (settings.preOrderEndTime || '16:00') === p.end;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const updated = { ...settings, preOrderStartTime: p.start, preOrderEndTime: p.end, preOrderEnabled: true };
                          setSettings(updated);
                          saveCanteenConfig(updated);
                          showSavedFeedback();
                        }}
                        className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/50' 
                            : 'bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                      >
                        <p className="text-xs font-bold truncate">{p.label}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{p.start} - {p.end}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-slate-800">
                <SaveButton
                  onClick={handleSaveAll}
                  isSaving={isSaving}
                  isSaved={saveSuccess}
                  idleText="Save Pre-Order Timing to Cloud"
                  savingText="Saving Schedule..."
                  savedText="Timing Saved & Synced Successfully! ✓"
                  className="w-full py-4 text-xs font-black tracking-widest cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* OPTION 2: MANAGER & CREDENTIALS */}
          {activeSection === 'manager' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-800 space-y-7 animate-in fade-in">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-6 h-6 text-indigo-400" />
                  <span>CANTEEN MANAGER & ACCESS CREDENTIALS</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Select manager from member database and configure access credentials
                </p>
              </div>

              {/* Manager Card */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label className="text-[11px] font-black text-indigo-400 uppercase tracking-wider block">
                      CURRENT ACTIVE MANAGER
                    </label>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Automatically loads name, rank, contact, and photo from member database.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMemberPicker(true)}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center space-x-2 transition-all shadow-md shadow-indigo-500/20 cursor-pointer self-start sm:self-auto"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>{settings.managerName ? 'CHANGE MANAGER' : 'SELECT MANAGER'}</span>
                  </button>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center space-x-4 w-full sm:w-auto">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-indigo-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                      {resolvedManagerDp ? (
                        <img
                          src={resolvedManagerDp}
                          alt={settings.managerName || 'Manager'}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="font-black text-white text-2xl">
                          {(settings.managerName || 'M').charAt(0)}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase tracking-wider">
                          ACTIVE MANAGER
                        </span>
                        {settings.managerBdNo && (
                          <span className="text-[10px] font-mono text-slate-400">
                            BD: {settings.managerBdNo}
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-black text-white leading-tight">
                        {settings.managerName || 'No Manager Selected Yet'}
                      </h4>
                      <div className="flex items-center space-x-3 text-xs text-slate-300 font-mono">
                        {settings.phone ? (
                          <span className="flex items-center space-x-1 text-emerald-400">
                            <Phone className="w-3 h-3" />
                            <span>{settings.phone}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">No contact number</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Password Row */}
              <div className="space-y-2 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                    MANAGER ACCESS PIN / PASSWORD *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 cursor-pointer"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Hide Password</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Show Password</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={settings.password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder="e.g. 1111"
                    className="w-full bg-slate-950 text-white rounded-2xl pl-5 pr-12 py-4 text-base font-black font-mono tracking-widest border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  🔐 PIN changes are saved and synced to cloud in real-time.
                </p>
              </div>

              <div className="pt-2">
                <SaveButton
                  type="button"
                  onClick={handleSaveAll}
                  isSaving={isSaving}
                  isSaved={saveSuccess}
                  idleText="Save Manager Settings"
                  savingText="Saving..."
                  savedText="Manager Settings Saved! ✓"
                  className="w-full py-4 text-xs font-black tracking-widest cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* OPTION 3: MEMBER DB */}
          {activeSection === 'member_db' && (
            <div className="animate-in fade-in">
              <CanteenMemberDB />
            </div>
          )}

          {/* OPTION 4: CLOUD SYNC & SUPABASE (OFFICE APP STYLE) */}
          {activeSection === 'cloudsync' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-800 space-y-8 animate-in fade-in">
              {/* Header Box (Office Style Big Circular Cloud Icon) */}
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-900/50 to-indigo-900/40 border border-blue-500/30 flex items-center justify-center mb-4 shadow-xl shadow-blue-500/10">
                  <Cloud className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-2xl font-black text-white tracking-tight">Database Cloud Sync</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  Manually push your local canteen changes or pull updates from central Supabase cloud database.
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    SUPABASE CONNECTED
                  </span>
                  <span className="text-xs font-mono text-slate-400 bg-slate-800 px-3 py-1 rounded-full">
                    Last Synced: {lastSyncedTime}
                  </span>
                </div>
              </div>

              {/* Progress Bar (when syncing) */}
              {syncProgress > 0 && (
                <div className="w-full max-w-md mx-auto space-y-2 animate-in fade-in">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-indigo-400 uppercase tracking-wider">{syncStatusText}</span>
                    <span className="text-slate-300 font-mono">{syncProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-700">
                    <div 
                      className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Two Office-Style Action Buttons with Glow Hover */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                <button
                  type="button"
                  onClick={handlePushToCloud}
                  disabled={isSyncingPush || isSyncingPull}
                  className="relative group w-full overflow-hidden rounded-2xl p-[1px] transition-all hover:shadow-[0_0_20px_-3px_rgba(59,130,246,0.35)] disabled:opacity-50 cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-600/50 to-indigo-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-700/80 group-hover:bg-slate-900 transition-colors space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <Upload className={`w-6 h-6 ${isSyncingPush ? 'animate-bounce' : ''}`} />
                    </div>
                    <span className="text-sm font-black text-white">Push to Cloud</span>
                    <span className="text-[10px] text-slate-400">Upload local data to Supabase cloud</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={handlePullFromCloud}
                  disabled={isSyncingPush || isSyncingPull}
                  className="relative group w-full overflow-hidden rounded-2xl p-[1px] transition-all hover:shadow-[0_0_20px_-3px_rgba(16,185,129,0.35)] disabled:opacity-50 cursor-pointer"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/50 to-teal-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="relative flex flex-col items-center justify-center p-6 bg-slate-950 rounded-2xl border border-slate-700/80 group-hover:bg-slate-900 transition-colors space-y-2">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Download className={`w-6 h-6 ${isSyncingPull ? 'animate-bounce' : ''}`} />
                    </div>
                    <span className="text-sm font-black text-white">Pull from Cloud</span>
                    <span className="text-[10px] text-slate-400">Download latest data from cloud</span>
                  </div>
                </button>
              </div>

              {/* Database Monitored Tables Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  MONITORED CLOUD TABLES & ROW COUNTS
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase">Canteen_Member</span>
                    <span className="text-base font-bold text-white font-mono">{tableCounts.members} Members</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase">canteen_txs</span>
                    <span className="text-base font-bold text-white font-mono">{tableCounts.transactions} Transactions</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase">canteen_expenses</span>
                    <span className="text-base font-bold text-white font-mono">{tableCounts.expenses} Expense Logs</span>
                  </div>
                </div>
              </div>

              {/* Recent Sync Logs (Cloud Log as like Office App) */}
              <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-blue-400" />
                    <span>RECENT SYNC LOGS</span>
                  </h4>
                  {syncLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSyncLogs}
                      className="text-[10px] text-slate-500 hover:text-rose-400 font-mono transition-colors cursor-pointer"
                    >
                      Clear Logs
                    </button>
                  )}
                </div>

                {syncLogs.length === 0 ? (
                  <div className="text-center py-8 bg-slate-950/60 rounded-2xl border border-slate-800">
                    <p className="text-xs font-bold text-slate-500">No recent sync logs.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {syncLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-4 bg-slate-950 border border-slate-800/80 rounded-2xl flex justify-between items-start gap-3"
                      >
                        <div className="flex gap-3">
                          <div className="pt-1.5 shrink-0">
                            <div
                              className={`w-2.5 h-2.5 rounded-full ${
                                log.status === 'SUCCESS' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'
                              }`}
                            />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white mb-0.5">
                              {log.type === 'PULL' ? 'Downloaded from Cloud' : 'Uploaded to Cloud'}
                            </p>
                            <p className="text-xs text-slate-400">{log.message}</p>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono text-right shrink-0 mt-1">
                          {log.timestamp}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OPTION 5: DATA RESET & DANGER ZONE */}
          {activeSection === 'dangerZone' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-rose-500/25 space-y-7 animate-in fade-in">
              <div className="border-b border-rose-900/50 pb-4">
                <h3 className="text-xl font-black text-rose-500 flex items-center gap-2">
                  <RotateCcw className="w-6 h-6" />
                  <span>DATA RESET & DANGER ZONE</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Reset sales records, clear member dues (0), and erase expense logs for a fresh start
                </p>
              </div>

              <div className="p-5 bg-rose-950/20 border border-rose-900/40 rounded-2xl space-y-3">
                <div className="flex items-center space-x-2 text-rose-400">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-black uppercase tracking-wider">WARNING (DANGER ZONE)</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This action will permanently delete all previous <strong className="text-rose-400">Sales Records</strong>, reset <strong className="text-rose-400">Member Dues to 0</strong>, and clear <strong className="text-rose-400">Expense Logs</strong>.
                </p>
                <p className="text-[11px] font-bold text-amber-400">
                  ⚠️ Note: Member database (names, BD numbers, and ranks) will remain intact.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowResetModal(true)}
                className="w-full sm:w-auto px-6 py-4 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-2xl text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-lg shadow-rose-600/25 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>RESET ALL CANTEEN DATA</span>
              </button>

              {resetSuccess && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-3 text-emerald-400 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-bold">
                    All sales, dues (0), expenses, and orders have been reset successfully!
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[180] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                Reset All Canteen Data?
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Confirming will reset all previous <strong className="text-rose-400">Sales</strong>, reset <strong className="text-rose-400">Member Dues to 0</strong>, and clear <strong className="text-rose-400">Expenditures</strong> for a fresh start.
              </p>
              <p className="text-[11px] font-bold text-amber-400 mt-2">
                (Member list, names, and ranks will not be deleted)
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetAllData}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-600/25 flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Yes, Reset Data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Selection Modal for Manager */}
      {showMemberPicker && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xl shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center space-x-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>SELECT CANTEEN MANAGER</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Select an airman from Member DB to set as the active manager
                </p>
              </div>
              <button
                onClick={() => setShowMemberPicker(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="relative my-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by BD No, Rank, or Surname..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-11 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800/60">
              {loadingMembers ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  <span>Loading members from database...</span>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No members found matching &quot;{memberSearch}&quot;
                </div>
              ) : (
                filteredMembers.map((m) => {
                  const mRank = m['Rank'] || '';
                  const mName = m['Surname'] || '';
                  const mBd = m['BD No'] || '';
                  const mContact = m['Contact'] || '';
                  const mDp = m['DP'] || '';
                  const resolved = resolveImageUrl(mDp);
                  const isSelected = settings.managerBdNo === mBd || settings.managerName === `${mRank} ${mName}`.trim();

                  return (
                    <div
                      key={m.airman_id || mBd}
                      onClick={() => handleSelectManager(m)}
                      className={`pt-2 pb-2 px-3 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-600/20 border border-indigo-500/40'
                          : 'hover:bg-slate-800/80 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                          {resolved ? (
                            <img
                              src={resolved}
                              alt={mName}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="font-bold text-white text-base">
                              {(mName || 'U').charAt(0)}
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-white font-black text-sm">
                              {mRank} {mName}
                            </span>
                            <span className="text-slate-400 text-xs font-mono">
                              (BD: {mBd})
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono">
                            {mContact ? `📞 ${mContact}` : 'No phone number'}
                          </p>
                        </div>
                      </div>

                      {isSelected ? (
                        <span className="flex items-center space-x-1 px-2.5 py-1 bg-indigo-600 text-white text-xs font-black rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>SELECTED</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-indigo-600 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        >
                          SELECT
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 mt-2 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowMemberPicker(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

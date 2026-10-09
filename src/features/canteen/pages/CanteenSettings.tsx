import React, { useState, useEffect } from 'react';
import { 
  Save, CheckCircle2, Loader2, Users, Search, 
  ShieldCheck, Phone, ArrowLeft, ChevronRight, 
  Cloud, Download, Upload, RefreshCw, Coffee, 
  Database, Settings, Sparkles, X, History,
  Layers, Check, Clock, Trash2, ArrowRight,
  Languages, Globe, RotateCcw
} from 'lucide-react';
import { 
  getCanteenConfig, saveCanteenConfig, resolveImageUrl, 
  fetchCanteenConfigFromCloud, checkPreOrderWindow, CanteenConfig,
  ItemDisplayLanguage, checkAndEnforceDailyMenuReset
} from '../utils/canteenSettings';
import { 
  pullAllCanteenDataFromCloud, 
  pushAllLocalDataToCloud,
  getCanteenSyncLogs, 
  clearCanteenSyncLogs, 
  CanteenSyncLog,
  queuePushKeyToCloud 
} from '../utils/canteenCloudSync';
import { getCanteenMembersCache, fetchCanteenMembersOnce } from '../utils/canteenMenuData';
import { supabase } from '../../../supabase';
import { SaveButton } from '../components/SaveButton';
import { CanteenMemberDB } from './CanteenMemberDB';

export type CanteenSettingSection = 'identity' | 'display_lang' | 'timing' | 'member_db' | 'cloudsync';

interface SectionMeta {
  id: CanteenSettingSection;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  badge?: string;
}

interface CanteenSettingsProps {
  onClose?: () => void;
}

export const CanteenSettings: React.FC<CanteenSettingsProps> = ({ onClose }) => {
  // Navigation State: null = list of headline options ("niche niche"), string = dedicated separate page for clicked option
  const [activeSection, setActiveSection] = useState<CanteenSettingSection | null>(null);

  const [settings, setSettings] = useState<CanteenConfig>(() => getCanteenConfig());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [dhakaTime, setDhakaTime] = useState(() => {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }).format(new Date());
    } catch {
      return new Date().toLocaleTimeString();
    }
  });

  useEffect(() => {
    const clockTimer = setInterval(() => {
      try {
        setDhakaTime(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Dhaka', hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }).format(new Date()));
      } catch {
        setDhakaTime(new Date().toLocaleTimeString());
      }
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const handleManualResetNow = () => {
    if (!window.confirm('আপনি কি নিশ্চিত যে এখনই আজকের কিউরেটেড মেনু এবং প্রি-অর্ডার সম্পূর্ণ রিসেট করতে চান?')) return;
    checkAndEnforceDailyMenuReset(true, settings);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 3500);
  };

  // Cloud Sync state
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

  // Cloud Sync Logs state - connected live to global Canteen Cloud Sync engine
  const [syncLogs, setSyncLogs] = useState<CanteenSyncLog[]>(() => getCanteenSyncLogs());

  useEffect(() => {
    const handleSyncLogsUpdated = (e: any) => {
      setSyncLogs(e?.detail || getCanteenSyncLogs());
    };
    window.addEventListener('canteen_sync_logs_updated', handleSyncLogsUpdated);
    return () => {
      window.removeEventListener('canteen_sync_logs_updated', handleSyncLogsUpdated);
    };
  }, []);

  const handleClearSyncLogs = () => {
    clearCanteenSyncLogs();
    setSyncLogs([]);
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
    loadTableCounts();
  }, []);

  const handleNameChange = (newName: string) => {
    const updated = { ...settings, name: newName };
    setSettings(updated);
    saveCanteenConfig(updated);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    saveCanteenConfig(settings);
    // Queue config to be backed up to Supabase
    queuePushKeyToCloud('baf_canteen_settings_v1', settings);
    setIsSaving(false);
    setLastSyncedTime(new Date().toLocaleTimeString());
    showSavedFeedback();
  };

  // Push to Cloud
  const handlePushToCloud = async () => {
    setIsSyncingPush(true);
    setSyncStatusText('Preparing local data for cloud upload...');
    setSyncProgress(25);
    await new Promise(r => setTimeout(r, 400));
    setSyncProgress(60);
    setSyncStatusText('Uploading configuration and tables to Supabase...');

    try {
      saveCanteenConfig(settings);
      const success = await pushAllLocalDataToCloud();
      if (success) {
        setSyncProgress(100);
        setSyncStatusText('Cloud Upload Completed Successfully! ✓');
        setLastSyncedTime(new Date().toLocaleTimeString());
        showSavedFeedback();
      } else {
        setSyncStatusText('Upload Failed. Check network connection.');
      }
      setTimeout(() => {
        setSyncProgress(0);
        setSyncStatusText('');
      }, 2500);
    } catch (err: any) {
      setSyncStatusText(`Upload Failed: ${err?.message || 'Network error'}`);
    } finally {
      setIsSyncingPush(false);
    }
  };

  // Pull from Cloud
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
      setTimeout(() => {
        setSyncProgress(0);
        setSyncStatusText('');
      }, 2500);
    } catch (err: any) {
      setSyncStatusText(`Download Failed: ${err?.message || 'Network error'}`);
    } finally {
      setIsSyncingPull(false);
    }
  };

  const showSavedFeedback = () => {
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  // Settings Option Sections (Manager moved to Member DB, Danger Zone & PIN removed)
  const sections: SectionMeta[] = [
    {
      id: 'identity',
      label: 'Canteen Identity & Profile',
      description: 'Canteen name, unit tags, and general display configuration',
      icon: <Coffee className="w-5 h-5 text-amber-400" />,
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      badge: settings.name || 'CAFE UAV'
    },
    {
      id: 'display_lang',
      label: 'Item Display Language (প্রদর্শনের ভাষা)',
      description: 'Set whether Menu & Raw Inventory display item names in Bangla (বাংলা) or English',
      icon: <Languages className="w-5 h-5 text-purple-400" />,
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
      badge: (settings.itemDisplayLanguage || 'bn') === 'en' 
        ? 'English Only' 
        : (settings.itemDisplayLanguage || 'bn') === 'both' 
          ? 'Bilingual (উভয় ভাষা)' 
          : 'Bangla (বাংলা)'
    },
    {
      id: 'timing',
      label: 'Pre-Order Schedule',
      description: 'Configure auto-reset time & pre-order active window',
      icon: <Clock className="w-5 h-5 text-emerald-400" />,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      badge: `Reset: ${settings.dailyResetTime || '15:00'}`
    },
    {
      id: 'member_db',
      label: 'Member Database',
      description: 'Browse, search, edit member list, view dues, and manage members',
      icon: <Users className="w-5 h-5 text-cyan-400" />,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
      badge: `${tableCounts.members} Members`
    },
    {
      id: 'cloudsync',
      label: 'Database Cloud Sync',
      description: 'Real-time cloud backup, sync status, push/pull, and sync logs',
      icon: <Cloud className="w-5 h-5 text-blue-400" />,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
      badge: 'Supabase Live'
    }
  ];

  const handleSelectSection = (secId: CanteenSettingSection) => {
    setActiveSection(secId);
    const mainEl = document.getElementById('canteen-main-content');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const handleBackToMenu = () => {
    setActiveSection(null);
    const mainEl = document.getElementById('canteen-main-content');
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
    try {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } catch {
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-16">
      
      {/* Toast Feedback */}
      {saveSuccess && (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-600 text-white font-bold px-5 py-3 rounded-2xl shadow-xl border border-emerald-400/40 flex items-center space-x-2 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>Realtime Saved & Synced to Cloud!</span>
        </div>
      )}

      {/* TOP VIEW 1: WHEN NO OPTION IS SELECTED, SHOW HEADLINES VERTICALLY ("niche niche sudhu headlines") */}
      {activeSection === null ? (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-xl p-6 rounded-3xl border border-slate-800 shadow-xl">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">
                  CANTEEN SETTINGS
                </h2>
                <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  SYSTEM & DATABASE CONFIGURATION
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
              <div className="flex items-center space-x-2 text-xs text-slate-400 font-mono bg-slate-950/70 border border-slate-800 px-3.5 py-2 rounded-xl">
                <span>Last Synced:</span>
                <span className="text-emerald-400 font-bold">{lastSyncedTime}</span>
              </div>

              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-black tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 text-indigo-400" />
                  <span>Exit to Canteen</span>
                </button>
              )}
            </div>
          </div>

          {/* Vertical Headlines List ("niche niche option gula asbe, sudhu headlines") */}
          <div className="space-y-3">
            {sections.map((sec) => (
              <button
                key={sec.id}
                type="button"
                onClick={() => handleSelectSection(sec.id)}
                className="w-full bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-4 sm:p-5 flex items-center justify-between group transition-transform active:scale-[0.99] touch-manipulation cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-center space-x-4 min-w-0">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${sec.color} shadow-sm`}>
                    {sec.icon}
                  </div>
                  <div className="text-left min-w-0">
                    <h4 className="text-base font-black text-white group-hover:text-indigo-400 transition-colors truncate">
                      {sec.label}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center space-x-3 shrink-0 ml-3">
                  {sec.badge && (
                    <span className="hidden sm:inline-block px-2.5 py-1 text-[10px] font-mono font-bold rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      {sec.badge}
                    </span>
                  )}
                  <div className="w-8 h-8 rounded-lg bg-slate-800 group-hover:bg-indigo-600 text-slate-400 group-hover:text-white flex items-center justify-center transition-colors">
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* TOP VIEW 2: WHEN AN OPTION IS CLICKED, ONLY THAT OPTION COMES ON A SEPARATE PAGE ("Je option a click korbo sudhu oita alada page a asbe") */
        <div className="space-y-6">
          {/* Subpage Top Bar with Back to Settings button */}
          <div className="bg-slate-900/90 backdrop-blur-xl p-4 sm:p-5 rounded-2xl border border-slate-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <button
                  type="button"
                  onClick={handleBackToMenu}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-xs font-black tracking-wider uppercase transition-transform active:scale-95 flex items-center gap-2 cursor-pointer shrink-0 touch-manipulation"
                >
                  <ArrowLeft className="w-4 h-4 text-indigo-400" />
                  <span>Back to Settings</span>
                </button>
                <div className="h-6 w-px bg-slate-800 shrink-0 hidden sm:block" />
                <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-tight truncate">
                  {sections.find(s => s.id === activeSection)?.label}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer hover:text-white"
                  >
                    Exit
                  </button>
                )}
              </div>
            </div>

            {/* Instant Option Switching Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 border-t border-slate-800/80">
              {sections.map(s => {
                const isCurrent = activeSection === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleSelectSection(s.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center space-x-1.5 ${
                      isCurrent 
                        ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400' 
                        : 'bg-slate-950/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* DEDICATED PAGE 1: CANTEEN IDENTITY & PROFILE */}
          {activeSection === 'identity' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-800 space-y-7">
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
                      CONTACT PHONE NUMBER
                    </label>
                    <input
                      type="text"
                      value={settings.phone || ''}
                      onChange={(e) => {
                        const updated = { ...settings, phone: e.target.value };
                        setSettings(updated);
                        saveCanteenConfig(updated);
                      }}
                      placeholder="e.g. +880 1601-676760"
                      className="w-full bg-slate-950 text-white rounded-2xl px-5 py-3.5 text-xs font-mono font-bold border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                      MANAGER SYSTEM KEY (ম্যানেজার সিস্টেম কি)
                    </label>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">
                      Default: 1111
                    </span>
                  </div>
                  <input
                    type="text"
                    value={settings.password || ''}
                    onChange={(e) => {
                      const updated = { ...settings, password: e.target.value };
                      setSettings(updated);
                      saveCanteenConfig(updated);
                    }}
                    placeholder="1111"
                    maxLength={10}
                    className="w-full bg-slate-950 text-white rounded-2xl px-5 py-3.5 text-xs font-mono font-bold border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    সাইডবার থেকে ম্যানেজার প্যানেলে প্রবেশ করার জন্য ব্যবহৃত ৪ ডিজিটের সিকিউরিটি কি (ডিফল্ট: 1111)।
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    FOOTER / MEMO NOTE
                  </label>
                  <input
                    type="text"
                    value={settings.footer || ''}
                    onChange={(e) => {
                      const updated = { ...settings, footer: e.target.value };
                      setSettings(updated);
                      saveCanteenConfig(updated);
                    }}
                    placeholder="e.g. Official Canteen of UAV | Integrity and Service"
                    className="w-full bg-slate-950 text-white rounded-2xl px-5 py-3.5 text-xs font-bold border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <SaveButton
                  type="button"
                  onClick={handleSaveAll}
                  isSaving={isSaving}
                  isSaved={saveSuccess}
                  idleText="Save Identity Settings"
                  savingText="Saving..."
                  savedText="Identity Saved Successfully! ✓"
                  className="w-full py-4 text-xs font-black tracking-widest cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* DEDICATED PAGE: MENU & INVENTORY DISPLAY LANGUAGE */}
          {activeSection === 'display_lang' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-800 space-y-8">
              <div className="border-b border-slate-800 pb-5">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <Languages className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                      <span>MENU & INVENTORY DISPLAY LANGUAGE</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      মেনু এবং ইনভেন্টরি পেজে আইটেমের নাম বাংলায় (বাংলা) দেখাবে নাকি ইংরেজিতে (English) তা এখান থেকে সেট করুন
                    </p>
                  </div>
                </div>
              </div>

              {/* Master Presets (3 Big Interactive Cards) */}
              <div className="space-y-3">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                  পছন্দের ভাষা নির্বাচন করুন (SELECT DISPLAY LANGUAGE)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Option 1: Bangla First / Only */}
                  {(() => {
                    const isSelected = (settings.itemDisplayLanguage || 'bn') === 'bn' && 
                                       (settings.menuDisplayLanguage || 'bn') === 'bn' && 
                                       (settings.inventoryDisplayLanguage || 'bn') === 'bn';
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const updated: CanteenConfig = {
                            ...settings,
                            itemDisplayLanguage: 'bn',
                            menuDisplayLanguage: 'bn',
                            inventoryDisplayLanguage: 'bn'
                          };
                          setSettings(updated);
                          saveCanteenConfig(updated);
                          showSavedFeedback();
                        }}
                        className={`p-5 rounded-3xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-purple-950/50 border-purple-500 text-white shadow-xl shadow-purple-950/40 ring-1 ring-purple-500'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl">🇧🇩</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase ${
                              isSelected ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isSelected ? 'সক্রিয় (ACTIVE)' : 'সুপারিশকৃত'}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-white mb-1">
                            বাংলায় প্রদর্শন (Bangla)
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed mb-3">
                            মেনু এবং কাঁচামাল ইনভেন্টরির সকল আইটেমের নাম স্পষ্ট অক্ষরে বাংলায় প্রদর্শিত হবে।
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-medium text-emerald-400">
                          যেমন: ডিম অমলেট, আলু, মুরগির মাংস
                        </div>
                      </button>
                    );
                  })()}

                  {/* Option 2: English Only */}
                  {(() => {
                    const isSelected = (settings.itemDisplayLanguage || 'bn') === 'en' && 
                                       (settings.menuDisplayLanguage || 'bn') === 'en' && 
                                       (settings.inventoryDisplayLanguage || 'bn') === 'en';
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const updated: CanteenConfig = {
                            ...settings,
                            itemDisplayLanguage: 'en',
                            menuDisplayLanguage: 'en',
                            inventoryDisplayLanguage: 'en'
                          };
                          setSettings(updated);
                          saveCanteenConfig(updated);
                          showSavedFeedback();
                        }}
                        className={`p-5 rounded-3xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-purple-950/50 border-purple-500 text-white shadow-xl shadow-purple-950/40 ring-1 ring-purple-500'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl">🇬🇧</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase ${
                              isSelected ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isSelected ? 'ACTIVE' : 'STANDARD'}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-white mb-1">
                            English Only (ইংরেজি)
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed mb-3">
                            All Menu and Raw Inventory items will be presented in English only.
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-medium text-indigo-400">
                          Example: EGG MUMLET, POTATO, CHICKEN
                        </div>
                      </button>
                    );
                  })()}

                  {/* Option 3: Bilingual (BN + EN) */}
                  {(() => {
                    const isSelected = (settings.itemDisplayLanguage || 'bn') === 'both' && 
                                       (settings.menuDisplayLanguage || 'bn') === 'both' && 
                                       (settings.inventoryDisplayLanguage || 'bn') === 'both';
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const updated: CanteenConfig = {
                            ...settings,
                            itemDisplayLanguage: 'both',
                            menuDisplayLanguage: 'both',
                            inventoryDisplayLanguage: 'both'
                          };
                          setSettings(updated);
                          saveCanteenConfig(updated);
                          showSavedFeedback();
                        }}
                        className={`p-5 rounded-3xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-purple-950/50 border-purple-500 text-white shadow-xl shadow-purple-950/40 ring-1 ring-purple-500'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-2xl">🌐</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black uppercase ${
                              isSelected ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {isSelected ? 'ACTIVE' : 'BILINGUAL'}
                            </span>
                          </div>
                          <h4 className="text-base font-black text-white mb-1">
                            উভয় ভাষা (Bilingual)
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed mb-3">
                            বাংলা ও ইংরেজি উভয় নামই একসাথে শিরোনাম ও বন্ধনীতে প্রদর্শিত হবে।
                          </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-medium text-purple-300 truncate">
                          যেমন: ডিম অমলেট (EGG MUMLET), আলু (POTATO)
                        </div>
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* Granular Individual Controls */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 space-y-6">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-purple-400" />
                    <span>স্বতন্ত্র কাস্টমাইজেশন (SEPARATE SETTINGS FOR MENU & INVENTORY)</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    আপনি চাইলে মেনু এবং ইনভেন্টরির জন্য আলাদা আলাদাও ভাষা নির্ধারণ করতে পারেন
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Menu Setting */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                    <div>
                      <span className="text-xs font-black text-indigo-300 uppercase tracking-wide block">
                        🍔 CANTEEN MENU ITEMS
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        মেনু কার্ড ও আইটেম তালিকা প্রদর্শনের ভাষা
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                      {(['bn', 'en', 'both'] as ItemDisplayLanguage[]).map((mode) => {
                        const active = (settings.menuDisplayLanguage || settings.itemDisplayLanguage || 'bn') === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              const updated: CanteenConfig = {
                                ...settings,
                                menuDisplayLanguage: mode
                              };
                              setSettings(updated);
                              saveCanteenConfig(updated);
                              showSavedFeedback();
                            }}
                            className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              active
                                ? 'bg-indigo-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-850'
                            }`}
                          >
                            {mode === 'bn' ? 'বাংলা (BN)' : mode === 'en' ? 'English (EN)' : 'উভয় (Both)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Inventory Setting */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-4 space-y-3">
                    <div>
                      <span className="text-xs font-black text-emerald-300 uppercase tracking-wide block">
                        📦 RAW INVENTORY ITEMS
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        কাঁচামাল ইনভেন্টরি ও বক্স/টেবিল ভিউয়ের ভাষা
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                      {(['bn', 'en', 'both'] as ItemDisplayLanguage[]).map((mode) => {
                        const active = (settings.inventoryDisplayLanguage || settings.itemDisplayLanguage || 'bn') === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => {
                              const updated: CanteenConfig = {
                                ...settings,
                                inventoryDisplayLanguage: mode
                              };
                              setSettings(updated);
                              saveCanteenConfig(updated);
                              showSavedFeedback();
                            }}
                            className={`py-2 px-1 text-center rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              active
                                ? 'bg-emerald-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white hover:bg-slate-850'
                            }`}
                          >
                            {mode === 'bn' ? 'বাংলা (BN)' : mode === 'en' ? 'English (EN)' : 'উভয় (Both)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Live Preview Box */}
              <div className="bg-slate-950/80 border border-purple-500/30 rounded-3xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span>লাইভ প্রিভিউ (LIVE PREVIEW IN CANTEEN)</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    Realtime simulation
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sample Menu Card Preview */}
                  {(() => {
                    const menuMode = settings.menuDisplayLanguage || settings.itemDisplayLanguage || 'bn';
                    const sampleMenu = {
                      name: 'COLD COFFEE',
                      nameBn: 'কোল্ড কফি'
                    };
                    const sampleMenuName = menuMode === 'bn' 
                      ? sampleMenu.nameBn 
                      : menuMode === 'en' 
                        ? sampleMenu.name 
                        : `${sampleMenu.nameBn} (${sampleMenu.name})`;
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5 shadow-md">
                        <div className="w-12 h-12 rounded-xl bg-indigo-950/70 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-black text-sm shrink-0">
                          ☕
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                            Menu Item Card
                          </span>
                          <h4 className="text-base font-black text-white truncate text-indigo-300">
                            {sampleMenuName}
                          </h4>
                          <span className="text-xs font-mono font-bold text-emerald-400">৳30 • In Stock</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sample Inventory Box Preview */}
                  {(() => {
                    const invMode = settings.inventoryDisplayLanguage || settings.itemDisplayLanguage || 'bn';
                    const sampleInv = {
                      name: 'POTATO',
                      nameBn: 'গোল আলু'
                    };
                    const sampleInvName = invMode === 'bn' 
                      ? sampleInv.nameBn 
                      : invMode === 'en' 
                        ? sampleInv.name 
                        : `${sampleInv.name} (${sampleInv.nameBn})`;
                    return (
                      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center space-x-3.5 shadow-md">
                        <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 flex items-center justify-center font-black text-sm shrink-0">
                          🥔
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">
                            Inventory Box Card
                          </span>
                          <h4 className="text-base font-black text-white truncate text-amber-300">
                            {sampleInvName}
                          </h4>
                          <span className="text-xs font-mono font-bold text-slate-400">Stock: 45 kg • OK</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-4 border-t border-slate-800">
                <SaveButton
                  type="button"
                  onClick={handleSaveAll}
                  isSaving={isSaving}
                  isSaved={saveSuccess}
                  idleText="Save Language Settings to Cloud"
                  savingText="Saving Language..."
                  savedText="Language Settings Saved & Synced! ✓"
                  className="w-full py-4 text-xs font-black tracking-widest cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* DEDICATED PAGE 2: PRE-ORDER SCHEDULE & AUTO-RESET */}
          {activeSection === 'timing' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-800 space-y-7">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-xl font-black text-white flex items-center gap-2">
                  <Clock className="w-6 h-6 text-emerald-400" />
                  <span>PRE-ORDER SCHEDULE</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  প্রতিদিনের কিউরেটেড মেনু ও প্রি-অর্ডার রিসেটের সময় এবং প্রি-অর্ডারের সময়সূচি নির্ধারণ করুন
                </p>
              </div>

              {/* Status Banner */}
              {(() => {
                const status = checkPreOrderWindow(settings);
                return (
                  <div className={`p-5 rounded-3xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    status.isOpen 
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`w-3 h-3 rounded-full ${status.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                        <h4 className="text-base font-black uppercase tracking-wider">
                          {status.isOpen ? 'PRE-ORDER WINDOW IS CURRENTLY ACTIVE (OPEN)' : 'PRE-ORDER IS CURRENTLY CLOSED (LOCKED)'}
                        </h4>
                      </div>
                      <p className="text-xs opacity-90">
                        {status.timeRemainingText || status.message}
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
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

              {/* 1. PRE-ORDER ACTIVE TIMING (মেম্বারদের প্রি-অর্ডার শুরু ও শেষ সময়) */}
              <div className="bg-slate-950/80 p-6 sm:p-7 rounded-3xl border border-indigo-500/30 shadow-lg space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <label className="text-sm font-black text-indigo-400 uppercase tracking-wider flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <span>PRE-ORDER ACTIVE TIMING (মেম্বারদের প্রি-অর্ডার উন্মুক্ত সময়)</span>
                    </label>
                    <p className="text-xs text-slate-400 mt-1">
                      এই নির্ধারিত সময়ে সাধারণ মেম্বাররা তাদের পোর্টালে মেনু দেখতে পারবে এবং প্রি-অর্ডার করতে পারবে। সময় শেষ হলে মেম্বারদের জন্য প্রি-অর্ডার বন্ধ হয়ে যাবে ও মেনু আড়াল থাকবে (ম্যানেজার ড্যাশবোর্ড থেকে দেখতে ও ম্যানুয়াল প্রি-অর্ডার নিতে পারবেন)।
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 shadow-inner">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>ঢাকা সময়: {dhakaTime}</span>
                    </span>
                    <span className="px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/40 rounded-xl text-xs font-black text-indigo-300 font-mono">
                      মেম্বার উইন্ডো: {settings.preOrderStartTime || '18:00'} - {settings.preOrderEndTime || '08:00'}
                    </span>
                  </div>
                </div>

                {/* Timing Inputs (Start and End) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                    <label className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Clock className="w-4 h-4" />
                      <span>PRE-ORDER START TIME (কখন থেকে শুরু হবে)</span>
                    </label>
                    <p className="text-[11px] text-slate-400 font-medium">
                      এই নির্ধারিত সময়ে সাধারণ মেম্বারদের জন্য প্রি-অর্ডার মেনু উন্মুক্ত হবে।
                    </p>
                    <input
                      type="time"
                      value={settings.preOrderStartTime || '18:00'}
                      onChange={(e) => {
                        const updated = { ...settings, preOrderStartTime: e.target.value };
                        setSettings(updated);
                        saveCanteenConfig(updated);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-2xl px-5 py-3.5 text-base font-bold text-white outline-none transition-all shadow-inner font-mono"
                    />
                  </div>

                  <div className="space-y-2 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                    <label className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <Clock className="w-4 h-4" />
                      <span>PRE-ORDER END TIME (কখন মেম্বার প্রি-অর্ডার বন্ধ হবে)</span>
                    </label>
                    <p className="text-[11px] text-slate-400 font-medium">
                      এই সময়ে সাধারণ মেম্বারদের প্রি-অর্ডার বন্ধ হবে ও মেনু আড়াল থাকবে (ম্যানেজার দেখতে পাবেন)।
                    </p>
                    <input
                      type="time"
                      value={settings.preOrderEndTime || '08:00'}
                      onChange={(e) => {
                        const updated = { ...settings, preOrderEndTime: e.target.value };
                        setSettings(updated);
                        saveCanteenConfig(updated);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-2xl px-5 py-3.5 text-base font-bold text-white outline-none transition-all shadow-inner font-mono"
                    />
                  </div>
                </div>

                {/* Shift Presets */}
                <div className="space-y-2.5 pt-1">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                    কুইক প্রি-অর্ডার শিডিউল প্রিসেট (PRE-ORDER TIMING PRESETS)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {[
                      { label: 'Morning & Lunch', start: '08:00', end: '14:00' },
                      { label: 'Full Day Regular', start: '08:00', end: '16:00' },
                      { label: 'Extended Daytime', start: '08:00', end: '18:00' },
                      { label: 'Overnight Shift', start: '18:00', end: '08:00' },
                      { label: 'Evening Snacks', start: '16:00', end: '21:00' },
                      { label: 'Night Shift', start: '20:00', end: '08:00' }
                    ].map((p, idx) => {
                      const isSelected = (settings.preOrderStartTime || '18:00') === p.start && (settings.preOrderEndTime || '08:00') === p.end;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const updated = { 
                              ...settings, 
                              preOrderStartTime: p.start, 
                              preOrderEndTime: p.end, 
                              preOrderEnabled: true 
                            };
                            setSettings(updated);
                            saveCanteenConfig(updated);
                            showSavedFeedback();
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                            isSelected 
                              ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/50 ring-1 ring-emerald-500/40' 
                              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                          }`}
                        >
                          <p className="text-xs font-bold truncate">{p.label}</p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">{p.start} - {p.end}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 2. DAILY MENU & DASHBOARD AUTO-RESET (মেনু ও লাইভ প্রি-অর্ডার স্বয়ংক্রিয় রিসেট সময়) */}
              <div className="bg-slate-950/80 p-6 sm:p-7 rounded-3xl border border-rose-500/30 shadow-lg space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <label className="text-sm font-black text-rose-400 uppercase tracking-wider flex items-center space-x-2">
                      <RotateCcw className="w-4 h-4 text-rose-400" />
                      <span>DAILY MENU & DASHBOARD AUTO-RESET (স্বয়ংক্রিয় মেনু ও প্রি-অর্ডার রিসেট সময়)</span>
                    </label>
                    <p className="text-xs text-slate-400 mt-1">
                      প্রতিদিন এই নির্ধারিত সময়ে ম্যানেজারের ড্যাশবোর্ড থেকে কিউরেটেড মেনু এবং লাইভ প্রি-অর্ডারের তালিকা সম্পূর্ণ রিসেট হয়ে খালি হবে। (যেসব প্রি-অর্ডার Complete করা হয়েছে সেগুলোর বিল ও ট্রানজাকশন মেম্বারের একাউন্টে সম্পূর্ণ সংরক্ষিত থাকবে)।
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs font-black text-rose-300 font-mono">
                      রিসেট সময়: {settings.dailyResetTime || '16:00'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="space-y-2 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80">
                    <label className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center space-x-1.5">
                      <RotateCcw className="w-4 h-4" />
                      <span>DAILY RESET TIME (দৈনিক মেনু অটো-রিসেট সময়)</span>
                    </label>
                    <p className="text-[11px] text-slate-400 font-medium">
                      এই সময়ে ম্যানেজারের কিউরেটেড মেনু এবং লাইভ প্রি-অর্ডার তালিকা রিসেট হয়ে খালি হবে।
                    </p>
                    <input
                      type="time"
                      value={settings.dailyResetTime || '16:00'}
                      onChange={(e) => {
                        const updated = { ...settings, dailyResetTime: e.target.value };
                        setSettings(updated);
                        saveCanteenConfig(updated);
                      }}
                      className="w-full bg-slate-950 border border-slate-700 focus:border-rose-500 rounded-2xl px-5 py-3.5 text-base font-bold text-white outline-none transition-all shadow-inner font-mono"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest block">
                      কুইক রিসেট সময় প্রিসেট (RESET TIME PRESETS)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['03:00', '08:00', '14:00', '16:00', '18:00', '23:59'].map((rTime, idx) => {
                        const isSelected = (settings.dailyResetTime || '16:00') === rTime;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const updated = { ...settings, dailyResetTime: rTime };
                              setSettings(updated);
                              saveCanteenConfig(updated);
                              showSavedFeedback();
                            }}
                            className={`py-2 px-3 rounded-xl border text-center transition-all cursor-pointer font-mono font-bold text-xs ${
                              isSelected
                                ? 'bg-rose-950/80 border-rose-500 text-rose-300 ring-1 ring-rose-500/40'
                                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                            }`}
                          >
                            {rTime}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Instant Force Reset Card */}
                <div className="p-4 sm:p-5 rounded-2xl bg-rose-950/20 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h5 className="text-xs font-black text-rose-300 uppercase tracking-wider flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-rose-400" />
                      <span>ম্যানুয়াল মেনু ও লাইভ প্রি-অর্ডার রিসেট (FORCE RESET MENU NOW)</span>
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      অটো রিসেট সময়ের অপেক্ষা না করে যদি এখনই মেনু ও লাইভ প্রি-অর্ডার তালিকা রিসেট করতে চান।
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {resetSuccess && (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 animate-in fade-in">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>মেনু সফলভাবে রিসেট হয়েছে!</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleManualResetNow}
                      className="px-4 py-2.5 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-200 rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap"
                    >
                      এখনই মেনু রিসেট করুন (Reset Now)
                    </button>
                  </div>
                </div>
              </div>

              {/* Save Button */}
              <div className="pt-2 border-t border-slate-800">
                <SaveButton
                  type="button"
                  onClick={handleSaveAll}
                  isSaving={isSaving}
                  isSaved={saveSuccess}
                  idleText="Save Pre-Order Timing & Auto-Reset to Cloud"
                  savingText="Saving Schedule..."
                  savedText="Timing Saved & Synced Successfully! ✓"
                  className="w-full py-4 text-xs font-black tracking-widest cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* DEDICATED PAGE 3: MEMBER DATABASE (Full, responsive MemberDB without hanging) */}
          {activeSection === 'member_db' && (
            <div className="space-y-6">
              <CanteenMemberDB />
            </div>
          )}

          {/* DEDICATED PAGE 4: DATABASE CLOUD SYNC */}
          {activeSection === 'cloudsync' && (
            <div className="bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-800 space-y-8">
              {/* Header Box */}
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
                </div>
              </div>

              {/* Progress Feedback */}
              {syncStatusText && (
                <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-2xl space-y-2 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white flex items-center gap-2">
                      {(isSyncingPush || isSyncingPull) && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />}
                      <span>{syncStatusText}</span>
                    </span>
                    <span className="font-mono text-blue-400 font-bold">{syncProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${syncProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 2 Big Action Cards: Push & Pull */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Push to Cloud */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-black text-white">Push to Cloud</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Upload current local configuration, parameters, and members cache to the central Supabase database.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isSyncingPush || isSyncingPull}
                    onClick={handlePushToCloud}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-blue-600/20 cursor-pointer"
                  >
                    {isSyncingPush ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Pushing to Cloud...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Push Local Data to Cloud</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Pull from Cloud */}
                <div className="bg-slate-950/70 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors">
                  <div className="space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Download className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-black text-white">Pull from Cloud</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Fetch fresh member lists, updated menu items, and canteen configuration from central Supabase database.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isSyncingPush || isSyncingPull}
                    onClick={handlePullFromCloud}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
                  >
                    {isSyncingPull ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Downloading Data...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Pull from Cloud Database</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Table Row Counts */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    <span>LOCAL & CLOUD RECORDS</span>
                  </span>
                  <button
                    type="button"
                    onClick={loadTableCounts}
                    className="text-[10px] font-bold text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Refresh Counts</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Members</span>
                    <span className="text-lg font-black text-white font-mono">{tableCounts.members}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Transactions</span>
                    <span className="text-lg font-black text-white font-mono">{tableCounts.transactions}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Expenses</span>
                    <span className="text-lg font-black text-white font-mono">{tableCounts.expenses}</span>
                  </div>
                </div>
              </div>

              {/* Cloud Sync Activity Logs - Exact style as Office Settings */}
              <div className="mt-8">
                <div className="flex items-center justify-between mb-4 px-2">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Recent Sync Logs
                  </h4>
                  {syncLogs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSyncLogs}
                      className="text-[10px] font-bold text-slate-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Logs</span>
                    </button>
                  )}
                </div>

                {syncLogs.length === 0 ? (
                  <div className="text-center py-8 bg-slate-800/30 rounded-2xl">
                    <p className="text-sm font-bold text-slate-500">No recent logs.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {syncLogs.map((log: any) => (
                      <div key={log.id} className="p-4 bg-[#1b2234] border border-slate-700/50 rounded-xl flex justify-between items-start">
                        <div className="flex gap-3">
                          <div className="pt-1.5 shrink-0">
                            <div className={`w-2.5 h-2.5 rounded-full ${log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white mb-1">
                              {log.type === 'PULL' ? 'Downloaded from Cloud' : 'Uploaded to Cloud'}
                            </p>
                            <p className="text-xs text-slate-400">{log.message}</p>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono text-right shrink-0 mt-1">
                          {new Date(log.timestamp).toLocaleDateString()}<br/>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

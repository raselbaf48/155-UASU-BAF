import React, { useState, useEffect } from 'react';
import { Save, Image as ImageIcon, CheckCircle2, Loader2, Users, Search, UserCheck, Eye, EyeOff, ShieldCheck, Phone, IdCard, AlertTriangle, RotateCcw } from 'lucide-react';
import { getCanteenConfig, saveCanteenConfig, resolveImageUrl, fetchDirectImageUrl, fetchCanteenConfigFromCloud, CanteenConfig } from '../utils/canteenSettings';
import { resetAllCanteenData } from '../utils/resetCanteenData';
import { supabase } from '../../../supabase';

export const CanteenSettings: React.FC = () => {
  const [settings, setSettings] = useState<CanteenConfig>(() => getCanteenConfig());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(true); // Password visible by default as requested
  const [resolvingLogo, setResolvingLogo] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);

  // Member DB selection
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Clean Slate / Reset Data state
  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleResetAllData = async () => {
    setIsResetting(true);
    await resetAllCanteenData(true);
    setIsResetting(false);
    setShowResetModal(false);
    setResetSuccess(true);
    setTimeout(() => setResetSuccess(false), 5000);
  };

  useEffect(() => {
    // 1. Initial config & Cloud pull
    fetchCanteenConfigFromCloud().then((cloudCfg) => {
      setSettings(cloudCfg);
    });

    // 2. Fetch members from Canteen table for Manager selection
    fetchMembers();
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

  const handleAutoResolveLogo = async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    if (trimmed.includes('photos.app.goo.gl') || trimmed.includes('photos.google.com/share') || trimmed.includes('drive.google.com')) {
      setResolvingLogo(true);
      try {
        const directUrl = await fetchDirectImageUrl(trimmed);
        if (directUrl && directUrl !== trimmed) {
          const updated = { ...settings, logoUrl: directUrl };
          setSettings(updated);
          saveCanteenConfig(updated);
          setLogoPreviewError(false);
        }
      } catch (err) {
        console.error('Logo resolution failed:', err);
      } finally {
        setResolvingLogo(false);
      }
    }
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
    let finalLogo = settings.logoUrl.trim();

    if (finalLogo.includes('photos.app.goo.gl') || finalLogo.includes('photos.google.com/share')) {
      setResolvingLogo(true);
      finalLogo = await fetchDirectImageUrl(finalLogo);
      setResolvingLogo(false);
    }

    const toSave: CanteenConfig = {
      ...settings,
      logoUrl: finalLogo
    };

    setSettings(toSave);
    saveCanteenConfig(toSave);
    setIsSaving(false);
    showSavedFeedback();
  };

  const showSavedFeedback = () => {
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const resolvedLogo = resolveImageUrl(settings.logoUrl);
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

  return (
    <div className="max-w-4xl space-y-7 animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
            SYSTEM CONFIGURATION
          </h2>
          <p className="text-[10px] md:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            IDENTITY & MANAGER PARAMETERS (CLOUD SYNCED)
          </p>
        </div>

        {saveSuccess && (
          <div className="flex items-center space-x-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-2xl text-xs font-bold animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Realtime Saved & Synced to Cloud!</span>
          </div>
        )}
      </div>

      {/* Main Configuration Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-slate-200/80 dark:border-slate-800 space-y-8">
        
        {/* Row 1: Canteen Name & Logo URL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-7">
          {/* CANTEEN NAME */}
          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              CANTEEN NAME
            </label>
            <input
              type="text"
              value={settings.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. 🍽️ Cafe UAV 🍽️"
              className="w-full bg-[#1a2333] dark:bg-[#111928] text-white rounded-2xl px-5 py-4 text-sm font-black tracking-wide border border-slate-700/60 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent transition-all"
            />
          </div>

          {/* LOGO URL */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                LOGO URL
              </label>
              <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 flex items-center space-x-1">
                {resolvingLogo ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                    <span>Resolving Photo...</span>
                  </>
                ) : (
                  <span>Google Photos / Web URL</span>
                )}
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                value={settings.logoUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setSettings({ ...settings, logoUrl: val });
                  setLogoPreviewError(false);
                  if (val.includes('photos.app.goo.gl') || val.includes('photos.google.com/share')) {
                    handleAutoResolveLogo(val);
                  }
                }}
                onBlur={() => handleAutoResolveLogo(settings.logoUrl)}
                placeholder="https://... (Google Photos / Web Image)"
                className="w-full bg-[#1a2333] dark:bg-[#111928] text-white rounded-2xl pl-5 pr-14 py-4 text-xs font-bold font-mono tracking-normal border border-slate-700/60 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent transition-all truncate"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 shadow">
                {resolvingLogo ? (
                  <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                ) : resolvedLogo && !logoPreviewError ? (
                  <img
                    src={resolvedLogo}
                    alt="Logo Preview"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain p-0.5"
                    onError={() => setLogoPreviewError(true)}
                  />
                ) : (
                  <ImageIcon className="w-4 h-4 text-slate-500" />
                )}
              </div>
            </div>
            <p className="text-[9px] text-slate-400 leading-tight">
              💡 Google Photos / Drive লিঙ্ক দিলেও স্বয়ংক্রিয়ভাবে সরাসরি ছবিতে রূপান্তরিত হবে।
            </p>
          </div>
        </div>

        {/* Row 2: CANTEEN MANAGER (Selected from Member DB with auto Rank, Name, Contact & DP) */}
        <div className="space-y-3 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-[12px] font-black text-indigo-400 dark:text-indigo-400 uppercase tracking-wider flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4" />
                <span>CANTEEN MANAGER (FROM MEMBER DATABASE)</span>
              </label>
              <p className="text-[10px] text-slate-400 mt-0.5">
                ম্যানেজার নির্বাচন করলে তার নাম, পদবী, মোবাইল নম্বর ও প্রোফাইল ছবি (DP) স্বয়ংক্রিয়ভাবে লোড হবে।
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowMemberPicker(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-xs font-black tracking-wider uppercase flex items-center space-x-2 transition-all shadow-md shadow-indigo-500/20"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{settings.managerName ? 'CHANGE MANAGER' : 'SELECT MANAGER'}</span>
            </button>
          </div>

          {/* Active Manager Card Display */}
          <div className="bg-[#1a2333] dark:bg-[#111928] border border-slate-700/80 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4 w-full sm:w-auto">
              {/* DP Avatar */}
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-indigo-500/50 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
                {resolvedManagerDp ? (
                  <img
                    src={resolvedManagerDp}
                    alt={settings.managerName || 'Manager'}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="font-black text-white text-2xl">
                    {(settings.managerName || 'M').charAt(0)}
                  </span>
                )}
              </div>

              {/* Details */}
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase tracking-wider">
                    CURRENT MANAGER
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

        {/* Row 3: MANAGER PASSWORD (Visible & Realtime Synced) */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              MANAGER PASSWORD
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
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
              placeholder="e.g. 0000"
              className="w-full bg-[#1a2333] dark:bg-[#111928] text-white rounded-2xl pl-5 pr-12 py-4 text-base font-black font-mono tracking-widest border border-slate-700/60 shadow-inner focus:outline-none focus:ring-2 focus:ring-[#4f46e5] focus:border-transparent transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[9px] text-slate-400 leading-tight">
            🔐 পাসওয়ার্ড টাইপ করার সাথে সাথেই রিয়েল-টাইমে সেভ হবে এবং ক্লাউডে সংরক্ষিত থাকবে।
          </p>
        </div>

        {/* Save / Sync Button */}
        <button
          type="button"
          onClick={handleSaveAll}
          disabled={isSaving}
          className="w-full py-4 bg-[#4f46e5] hover:bg-[#4338ca] active:scale-[0.99] text-white rounded-2xl text-xs font-black tracking-widest uppercase flex items-center justify-center space-x-2 transition-all shadow-md shadow-indigo-500/25 disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>SYNCING TO CLOUD...</span>
            </>
          ) : saveSuccess ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span className="text-emerald-200">SAVED & SYNCED TO CLOUD!</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>SYNC ALL SETTINGS TO CLOUD</span>
            </>
          )}
        </button>
      </div>

      {/* Brand New Start / Data Reset Section */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 md:p-10 shadow-sm border border-rose-500/20 dark:border-rose-950/40 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-rose-500">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-base md:text-lg font-black uppercase tracking-tight text-rose-500">
                DATA RESET & BRAND NEW START (ব্র্যান্ড নিউ শুরু)
              </h3>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              ক্যান্টিনের পূর্বের সকল বিক্রয় হিসাব (Sales), সদস্যদের বকেয়া (Due 0), খরচের তালিকা (Expenditures) এবং প্রি-অর্ডার সম্পূর্ণ রিসেট করে একদম নতুন করে শুরু করুন।
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="px-6 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-2xl text-xs font-black tracking-wider uppercase flex items-center justify-center space-x-2 transition-all shadow-lg shadow-rose-600/25 shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESET ALL CANTEEN DATA</span>
          </button>
        </div>

        {resetSuccess && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-3 text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span className="text-xs font-bold">
              ক্যান্টিনের বিক্রয়, বকেয়া (Due 0), খরচ (Expenditures) ও অর্ডারসমূহ সফলভাবে সম্পূর্ণ রিসেট করা হয়েছে! অ্যাপ একদম ফ্রেশ শুরু করার জন্য প্রস্তুত।
            </span>
          </div>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[180] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">
                সব ডাটা রিসেট করতে চান?
              </h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                এটি নিশ্চিত করলে ক্যান্টিনের সমস্ত পূর্ববর্তী <strong className="text-rose-400">বিক্রয় (Sale)</strong>, <strong className="text-rose-400">সদস্যদের বকেয়া (Due = 0)</strong>, <strong className="text-rose-400">খরচের হিসাব (Expenditures)</strong> এবং <strong className="text-rose-400">প্রি-অর্ডার</strong> মুছে গিয়ে অ্যাপটি সম্পূর্ণ ফ্রেশ শুরু হবে।
              </p>
              <p className="text-[11px] font-bold text-amber-400 mt-2">
                (সদস্যদের তালিকা, নাম ও পদবী অপরিবর্তিত থাকবে)
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="button"
                disabled={isResetting}
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-bold transition-colors"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                disabled={isResetting}
                onClick={handleResetAllData}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-rose-600/25 flex items-center justify-center space-x-2"
              >
                {isResetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>রিসেট হচ্ছে...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>হ্যাঁ, রিসেট করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Selection Modal */}
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
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800"
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
                          className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-indigo-600 rounded-lg text-xs font-bold transition-colors"
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
                onClick={() => setShowMemberPicker(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold"
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

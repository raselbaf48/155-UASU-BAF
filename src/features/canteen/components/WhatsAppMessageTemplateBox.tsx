import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Sparkles,
  CreditCard,
  Building,
  UserCheck,
  Shield,
  Eye,
  Users
} from 'lucide-react';
import {
  WhatsAppTemplateConfig,
  getWhatsAppTemplateConfig,
  saveWhatsAppTemplateConfig,
  DEFAULT_WHATSAPP_TEMPLATE_CONFIG,
  buildWhatsAppBillMessage,
  buildWhatsAppMultipleBillMessage,
  getManagerDisplayBangla
} from '../utils/canteenWhatsAppTemplate';

interface WhatsAppMessageTemplateBoxProps {
  canteenConfig?: any;
  currentMonth?: string;
  onSaved?: () => void;
}


export const WhatsAppMessageTemplateBox: React.FC<WhatsAppMessageTemplateBoxProps> = ({
  canteenConfig,
  currentMonth = '2026-10',
  onSaved
}) => {
  const [config, setConfig] = useState<WhatsAppTemplateConfig>(() => getWhatsAppTemplateConfig());
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [formatMode, setFormatMode] = useState<'individual' | 'multiple'>('individual');
  const [individualSubTab, setIndividualSubTab] = useState<'senior' | 'junior'>('senior');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setConfig(getWhatsAppTemplateConfig());
    };
    window.addEventListener('canteen_whatsapp_template_updated', handleUpdate);
    return () => window.removeEventListener('canteen_whatsapp_template_updated', handleUpdate);
  }, []);

  const handleSave = () => {
    saveWhatsAppTemplateConfig(config);
    setSaveSuccessMsg('মেসেজ ফরম্যাট সফলভাবে সংরক্ষিত হয়েছে!');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
    if (onSaved) onSaved();
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_WHATSAPP_TEMPLATE_CONFIG });
    saveWhatsAppTemplateConfig({ ...DEFAULT_WHATSAPP_TEMPLATE_CONFIG });
    setSaveSuccessMsg('ডিফল্ট ফরম্যাট রিস্টোর করা হয়েছে!');
    setTimeout(() => setSaveSuccessMsg(null), 3500);
    if (onSaved) onSaved();
  };

  // Sample data for Live Preview
  const sampleSeniorMember = {
    Rank: 'Sgt',
    Surname: 'Kabir',
    'BD No': '465001'
  };
  const sampleJuniorMember = {
    Rank: 'AC-1',
    Surname: 'Rahman',
    'BD No': '495001'
  };

  const managerDisplayName = canteenConfig?.managerName || 'LAC Nishad';

  const seniorPreview = buildWhatsAppBillMessage({
    member: sampleSeniorMember,
    totalDue: 345,
    monthKey: currentMonth,
    config,
    managerName: managerDisplayName
  });

  const juniorPreview = buildWhatsAppBillMessage({
    member: sampleJuniorMember,
    totalDue: 345,
    monthKey: currentMonth,
    config,
    managerName: managerDisplayName
  });

  const multiplePreview = buildWhatsAppMultipleBillMessage({
    monthKey: currentMonth,
    config,
    managerName: managerDisplayName
  });

  const insertVariable = (varName: string) => {
    if (formatMode === 'multiple') {
      setConfig(prev => ({
        ...prev,
        multipleTemplate: (prev.multipleTemplate || '') + varName
      }));
    } else if (individualSubTab === 'senior') {
      setConfig(prev => ({
        ...prev,
        seniorTemplate: prev.seniorTemplate + varName
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        juniorTemplate: prev.juniorTemplate + varName
      }));
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-xl overflow-hidden transition-all">
      {/* Header Bar */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] flex items-center justify-center shrink-0 shadow-inner">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 truncate">
              <span>WhatsApp মেসেজ ফরম্যাট</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Individual &amp; Multiple
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 font-bold truncate">
              একক মেম্বার (Individual) এবং সার্বিক/গ্রুপ (Multiple) বিল নোটিশের কাস্টমাইজেশন
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0" onClick={e => e.stopPropagation()}>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-900/40 active:scale-95 cursor-pointer"
            title="মেসেজ ফরম্যাট সংরক্ষণ করুন"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">সংরক্ষণ</span>
          </button>
          
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title={isExpanded ? 'সংকুচিত করুন' : 'প্রসারিত করুন'}
          >
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Success Notification Alert */}
      {saveSuccessMsg && (
        <div className="px-4 py-2 bg-emerald-950/80 border-b border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Bank & Account Info Row */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 sm:p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                <span>ব্যাংক ও একাউন্ট তথ্য (মেসেজে স্বয়ংক্রিয়ভাবে যুক্ত হবে)</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-950/60 border border-emerald-500/30 font-mono">
                United Commercial Bank Limited.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Account No
                </label>
                <input
                  type="text"
                  value={config.accountNo}
                  onChange={(e) => setConfig({ ...config, accountNo: e.target.value })}
                  placeholder="e.g. 123456789012"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  হিসাবধারীর নাম (Account Name)
                </label>
                <input
                  type="text"
                  value={config.accountName}
                  onChange={(e) => setConfig({ ...config, accountName: e.target.value })}
                  placeholder="MD RASEL HOSSEN"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <Building className="w-3 h-3 text-slate-400" />
                  <span>শাখার নাম (Branch)</span>
                </label>
                <input
                  type="text"
                  value={config.bankBranch}
                  onChange={(e) => setConfig({ ...config, bankBranch: e.target.value })}
                  placeholder="Kathgor Brunch"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                  <span>ম্যানেজার পদবী/নাম (বাংলা)</span>
                </label>
                <input
                  type="text"
                  value={config.managerTitle}
                  onChange={(e) => setConfig({ ...config, managerTitle: e.target.value })}
                  placeholder={getManagerDisplayBangla(config, managerDisplayName)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-indigo-500"
                  title="ডিফল্ট হিসেবে ম্যানেজারের বাংলা পদবী ও নাম ব্যবহৃত হবে"
                />
              </div>
            </div>
          </div>

          {/* Primary Format Selector Tabs: Individual Format vs Multiple Format */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setFormatMode('individual')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  formatMode === 'individual'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>১. একক ফরম্যাট (Individual Format)</span>
              </button>

              <button
                type="button"
                onClick={() => setFormatMode('multiple')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  formatMode === 'multiple'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>২. সার্বিক / গ্রুপ ফরম্যাট (Multiple Format)</span>
              </button>
            </div>

            {/* Quick Tag Insert Buttons */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
              <span className="text-[10px] font-bold text-slate-500">ট্যাগ ইনসার্ট:</span>
              {[
                { tag: '{মাস}', label: 'মাস' },
                ...(formatMode === 'individual' ? [{ tag: '{মোট_বিল}', label: 'বিল' }] : []),
                { tag: '{পরের_মাসের_৫_তারিখ}', label: '৫ তারিখ' },
                { tag: '{একাউন্ট_নম্বর}', label: 'হিসাব নং' },
                { tag: '{ম্যানেজার}', label: 'ম্যানেজার' }
              ].map(t => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => insertVariable(t.tag)}
                  className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 font-mono border border-slate-700 transition-colors cursor-pointer"
                  title={`${t.tag} যোগ করুন`}
                >
                  +{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-selector for Individual Format (Senior vs Junior) */}
          {formatMode === 'individual' && (
            <div className="flex items-center space-x-2 bg-slate-950/60 p-1.5 rounded-xl border border-slate-800/80 w-fit">
              <span className="text-[10px] font-bold text-slate-400 px-1">সম্বোধন ধরণ:</span>
              <button
                type="button"
                onClick={() => setIndividualSubTab('senior')}
                className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  individualSubTab === 'senior'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3 h-3" />
                <span>সিনিয়র মেম্বার (স্যার সম্বোধন)</span>
              </button>

              <button
                type="button"
                onClick={() => setIndividualSubTab('junior')}
                className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  individualSubTab === 'junior'
                    ? 'bg-indigo-600 text-white font-black shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-3 h-3" />
                <span>সাধারণ / জুনিয়র মেম্বার</span>
              </button>
            </div>
          )}

          {/* Textarea + Live Preview Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left Column: Template Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  {formatMode === 'multiple' ? (
                    <span className="text-emerald-400 font-black">সার্বিক তালিকা / গ্রুপ বিল নোটিশ ফরম্যাট (Multiple Format):</span>
                  ) : individualSubTab === 'senior' ? (
                    <span className="text-amber-400 font-black">একক সিনিয়র মেম্বারদের জন্য ফরম্যাট:</span>
                  ) : (
                    <span className="text-indigo-400 font-black">একক সাধারণ / জুনিয়র মেম্বারদের ফরম্যাট:</span>
                  )}
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {formatMode === 'multiple' ? 'গ্রুপ শেয়ারে ব্যবহৃত হবে' : individualSubTab === 'senior' ? 'স্বয়ংক্রিয় স্যার সম্বোধন' : 'স্বাভাবিক সম্বোধন'}
                </span>
              </div>

              {formatMode === 'multiple' ? (
                <textarea
                  value={config.multipleTemplate || ''}
                  onChange={(e) => setConfig({ ...config, multipleTemplate: e.target.value })}
                  rows={9}
                  className="w-full bg-slate-950 border border-emerald-500/30 focus:border-emerald-400 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:outline-none shadow-inner"
                  placeholder="সার্বিক নোটিশ মেসেজ ফরম্যাট..."
                />
              ) : individualSubTab === 'senior' ? (
                <textarea
                  value={config.seniorTemplate}
                  onChange={(e) => setConfig({ ...config, seniorTemplate: e.target.value })}
                  rows={9}
                  className="w-full bg-slate-950 border border-amber-500/30 focus:border-amber-400 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:outline-none shadow-inner"
                  placeholder="সিনিয়রদের মেসেজ ফরম্যাট..."
                />
              ) : (
                <textarea
                  value={config.juniorTemplate}
                  onChange={(e) => setConfig({ ...config, juniorTemplate: e.target.value })}
                  rows={9}
                  className="w-full bg-slate-950 border border-indigo-500/30 focus:border-indigo-400 rounded-xl p-3 text-xs text-white font-mono leading-relaxed focus:outline-none shadow-inner"
                  placeholder="জুনিয়রদের মেসেজ ফরম্যাট..."
                />
              )}
            </div>

            {/* Right Column: Real-time Live Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5 text-emerald-400 font-black">
                  <Eye className="w-3.5 h-3.5" />
                  <span>লাইভ প্রিভিউ (WhatsApp-এ যেমন দেখাবে):</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {formatMode === 'multiple' ? 'গ্রুপ / সার্বিক প্রিভিউ' : individualSubTab === 'senior' ? 'Sgt Kabir (Senior)' : 'AC-1 Rahman (Junior)'}
                </span>
              </div>

              <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-3 text-xs text-slate-200 font-sans leading-relaxed whitespace-pre-wrap shadow-inner h-[200px] overflow-y-auto">
                {formatMode === 'multiple' 
                  ? multiplePreview 
                  : (individualSubTab === 'senior' ? seniorPreview.message : juniorPreview.message)
                }
              </div>
            </div>
          </div>

          {/* Footer controls: Reset & Save */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ডিফল্ট ফরম্যাটে রিসেট</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-[#25D366]/25 active:scale-95 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>ফরম্যাট সংরক্ষণ করুন</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


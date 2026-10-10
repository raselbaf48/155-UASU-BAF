import React, { useState, useEffect } from 'react';
import { 
  Store, Plus, Edit2, Trash2, Check, X, 
  ArrowLeft, AlertTriangle, CheckCircle2,
  MapPin, Phone
} from 'lucide-react';
import { 
  DueShopConfig, 
  getDueShops, 
  addDueShop, 
  updateDueShop, 
  deleteDueShop,
  canDeleteDueShop,
  getShopDueAmount
} from '../utils/dueShopsConfig';

interface DueRegisterSettingsSectionProps {
  onBack: () => void;
}

const PRESET_EMOJIS = ['🛒', '🍗', '☕', '🥩', '🐟', '🥦', '🍞', '🥛', '🏪', '🍎', '🥚', '📦'];

const PRESET_COLORS: Array<{ key: string; label: string; bg: string; border: string; text: string }> = [
  { key: 'emerald', label: 'Emerald Green', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400' },
  { key: 'amber', label: 'Amber Gold', bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400' },
  { key: 'purple', label: 'Purple / Violet', bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-400' },
  { key: 'blue', label: 'Ocean Blue', bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-400' },
  { key: 'rose', label: 'Rose Red', bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-400' },
  { key: 'teal', label: 'Teal Cyan', bg: 'bg-teal-500/20', border: 'border-teal-500/40', text: 'text-teal-400' },
  { key: 'indigo', label: 'Royal Indigo', bg: 'bg-indigo-500/20', border: 'border-indigo-500/40', text: 'text-indigo-400' },
  { key: 'orange', label: 'Sunset Orange', bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-400' }
];

export const DueRegisterSettingsSection: React.FC<DueRegisterSettingsSectionProps> = ({ onBack }) => {
  const [shops, setShops] = useState<DueShopConfig[]>(() => getDueShops());
  const [toastMsg, setToastMsg] = useState<string>('');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<DueShopConfig | null>(null);

  // Form Fields (Note removed, Location & Contact No added)
  const [name, setName] = useState('');
  const [banglaName, setBanglaName] = useState('');
  const [location, setLocation] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [emoji, setEmoji] = useState('🛒');
  const [color, setColor] = useState('emerald');
  const [errorMsg, setErrorMsg] = useState('');

  // Delete Confirmation Modal
  const [deletingShop, setDeletingShop] = useState<DueShopConfig | null>(null);

  useEffect(() => {
    const handleShopsUpdated = (e: any) => {
      setShops(e?.detail || getDueShops());
    };
    window.addEventListener('canteen_due_shops_updated', handleShopsUpdated);
    window.addEventListener('storage', handleShopsUpdated);
    return () => {
      window.removeEventListener('canteen_due_shops_updated', handleShopsUpdated);
      window.removeEventListener('storage', handleShopsUpdated);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const openAddModal = () => {
    setEditingShop(null);
    setName('');
    setBanglaName('');
    setLocation('');
    setContactNo('');
    setEmoji('🏪');
    setColor('emerald');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (shop: DueShopConfig) => {
    setEditingShop(shop);
    setName(shop.name);
    setBanglaName(shop.banglaName || shop.name);
    setLocation(shop.location || '');
    setContactNo(shop.contactNo || shop.phone || '');
    setEmoji(shop.emoji || '🏪');
    setColor(shop.color || 'emerald');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSaveShop = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMsg('দোকানের ইংরেজি নাম লিখুন (Shop Name in English is required)');
      return;
    }

    // Check duplicate name
    const isDuplicate = shops.some(
      s => s.name.toLowerCase() === trimmedName.toLowerCase() && (!editingShop || s.id !== editingShop.id)
    );
    if (isDuplicate) {
      setErrorMsg('এই নামের দোকান ইতিমধ্যে বিদ্যমান রয়েছে! দয়া করে ভিন্ন নাম দিন।');
      return;
    }

    if (editingShop) {
      // Edit
      const oldName = editingShop.name;
      updateDueShop(editingShop.id, {
        name: trimmedName,
        banglaName: banglaName.trim() || trimmedName,
        location: location.trim(),
        contactNo: contactNo.trim(),
        phone: contactNo.trim(),
        emoji: emoji.trim() || '🏪',
        color
      }, oldName);
      showToast(`'${trimmedName}' সফলভাবে হালনাগাদ করা হয়েছে!`);
    } else {
      // Add
      addDueShop({
        name: trimmedName,
        banglaName: banglaName.trim() || trimmedName,
        location: location.trim(),
        contactNo: contactNo.trim(),
        phone: contactNo.trim(),
        emoji: emoji.trim() || '🏪',
        color
      });
      showToast(`নতুন দোকান '${trimmedName}' সফলভাবে যুক্ত হয়েছে!`);
    }

    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (!deletingShop) return;
    try {
      const check = canDeleteDueShop(deletingShop.name);
      if (!check.allowed) {
        alert(check.reason || 'বকেয়া থাকায় দোকানটি মুছে ফেলা সম্ভব নয়!');
        return;
      }
      deleteDueShop(deletingShop.id);
      showToast(`'${deletingShop.name}' সফলভাবে মুছে ফেলা হয়েছে!`);
      setDeletingShop(null);
    } catch (err: any) {
      alert(err?.message || 'বকেয়া থাকায় দোকানটি মুছে ফেলা সম্ভব নয়!');
    }
  };

  const getColorMeta = (colorKey?: string) => {
    return PRESET_COLORS.find(c => c.key === colorKey) || PRESET_COLORS[0];
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-6 right-6 z-[200] bg-emerald-600 text-white font-bold px-5 py-3 rounded-2xl shadow-xl border border-emerald-400/40 flex items-center space-x-2 animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-white" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header Bar (default Restore removed) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/90 backdrop-blur-xl p-5 sm:p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-3.5">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-md shrink-0 active:scale-95"
            title="পেছনে ফিরে যান (Back to Settings)"
          >
            <ArrowLeft className="w-5 h-5 text-indigo-400" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                DUE REGISTER
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                {shops.length} SHOPS
              </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              দোকান ব্যবস্থাপনা (ADD, EDIT, REMOVE)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openAddModal}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-slate-950 font-black rounded-xl text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20 active:translate-y-0.5"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>নতুন দোকান যোগ করুন</span>
          </button>
        </div>
      </div>

      {/* Informational Guidance Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-start space-x-3 text-xs text-slate-400">
        <Store className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-300">
            ডিউ রেজিস্টারে অন্তর্ভুক্ত দোকানসমূহ ও যোগাযোগের তথ্য এখান থেকে পরিচালনা করুন:
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            যেকোনো দোকান যোগ, সম্পাদনা (নাম, লোকেশন, ফোন নম্বর) বা মুছে ফেলা সম্ভব। সংরক্ষিত দোকানগুলো স্বয়ংক্রিয়ভাবে ডিউ রেজিস্টারে কার্যকর হবে।
          </p>
        </div>
      </div>

      {/* Shops Grid (No Due shown, No Notes shown, Location & Contact No displayed) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shops.map((shop, idx) => {
          const colorMeta = getColorMeta(shop.color);
          const shopContact = shop.contactNo || shop.phone;

          return (
            <div
              key={shop.id || idx}
              className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all group relative overflow-hidden"
            >
              {/* Top Accent Strip */}
              <div className={`absolute top-0 left-0 right-0 h-1.5 ${colorMeta.bg.replace('/20', '')}`} />

              <div>
                {/* Header: Emoji & Names */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className={`w-12 h-12 rounded-2xl ${colorMeta.bg} ${colorMeta.border} border flex items-center justify-center text-2xl shrink-0 shadow-inner group-hover:scale-105 transition-transform`}>
                      {shop.emoji || '🏪'}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-white tracking-tight uppercase truncate">
                        {shop.name}
                      </h3>
                      <p className="text-xs font-bold text-amber-400 truncate">
                        {shop.banglaName || shop.name}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${colorMeta.bg} ${colorMeta.text} ${colorMeta.border} shrink-0`}>
                    #{idx + 1}
                  </span>
                </div>

                {/* Location & Contact No Details */}
                <div className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-2.5 text-xs">
                  {/* Shop Location */}
                  <div className="flex items-start space-x-2.5">
                    <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        লোকেশন (Location)
                      </span>
                      {shop.location?.trim() ? (
                        <p className="text-xs font-semibold text-slate-200 break-words">
                          {shop.location}
                        </p>
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          লোকেশন উল্লেখ নেই
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contact No */}
                  <div className="flex items-start space-x-2.5">
                    <Phone className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                        যোগাযোগ (Contact No)
                      </span>
                      {shopContact?.trim() ? (
                        <a 
                          href={`tel:${shopContact.trim()}`}
                          className="text-xs font-bold text-emerald-400 hover:text-emerald-300 font-mono tracking-wide hover:underline inline-block"
                          title="কল করতে ক্লিক করুন"
                        >
                          {shopContact}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500 italic">
                          নম্বর উল্লেখ নেই
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Edit & Remove */}
              <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => openEditModal(shop)}
                  className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-black tracking-wider uppercase transition-all border border-slate-700 flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm active:translate-y-0.5"
                  title="দোকানের তথ্য সম্পাদনা করুন"
                >
                  <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>EDIT</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeletingShop(shop)}
                  className="py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded-xl text-xs font-black tracking-wider uppercase transition-all border border-rose-500/30 flex items-center justify-center space-x-1 cursor-pointer active:translate-y-0.5"
                  title="দোকান মুছে ফেলুন (Remove)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">REMOVE</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Shop Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-5">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl">
                  {emoji || '🏪'}
                </div>
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">
                    {editingShop ? 'EDIT SHOP (দোকান সম্পাদনা)' : 'ADD NEW SHOP (নতুন দোকান যোগ)'}
                  </h3>
                  <p className="text-[11px] font-bold text-slate-400">
                    দোকানের নাম, লোকেশন ও যোগাযোগের নম্বর প্রদান করুন
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveShop} className="space-y-4">
              {/* Field 1: Shop Name in English */}
              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-1.5">
                  Shop Name (English) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="e.g. Meat Shop, Fish Corner, Sweet Mart"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-bold text-sm focus:outline-none transition-colors"
                />
              </div>

              {/* Field 2: Shop Name in Bangla */}
              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-1.5">
                  দোকানের নাম (বাংলা)
                </label>
                <input
                  type="text"
                  value={banglaName}
                  onChange={(e) => setBanglaName(e.target.value)}
                  placeholder="যেমন: মাংসের দোকান, মাছের বাজার, মিষ্টির দোকান"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-bold text-sm focus:outline-none transition-colors"
                />
              </div>

              {/* Field 3: Shop Location */}
              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-400" />
                  <span>Shop Location (দোকানের অবস্থান / লোকেশন)</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="যেমন: ক্যান্টিন গেটের বিপরীতে, মেইন মার্কেট ২ নম্বর শেড"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-bold text-sm focus:outline-none transition-colors"
                />
              </div>

              {/* Field 4: Contact No */}
              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-1.5 flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Contact No (যোগাযোগ / ফোন নম্বর)</span>
                </label>
                <input
                  type="text"
                  value={contactNo}
                  onChange={(e) => setContactNo(e.target.value)}
                  placeholder="যেমন: ০১৭১২-৩৪৫৬৭৮"
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl text-white font-bold text-sm focus:outline-none transition-colors"
                />
              </div>

              {/* Field 5: Emoji Selector */}
              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-1.5">
                  Emoji Icon (আইকন প্রতীক)
                </label>
                <div className="flex items-center space-x-2 mb-2">
                  <input
                    type="text"
                    value={emoji}
                    maxLength={4}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="w-16 text-center text-xl px-2 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none"
                  />
                  <div className="flex-1 flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
                    {PRESET_EMOJIS.map((em) => (
                      <button
                        key={em}
                        type="button"
                        onClick={() => setEmoji(em)}
                        className={`w-9 h-9 text-lg rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                          emoji === em 
                            ? 'bg-amber-500/20 border-2 border-amber-400 scale-110' 
                            : 'bg-slate-950 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {em}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Field 6: Color Theme */}
              <div>
                <label className="block text-[11px] font-black text-slate-300 uppercase tracking-wider mb-1.5">
                  Color Theme (রং থিম)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setColor(c.key)}
                      className={`py-2 px-2.5 rounded-xl border text-[11px] font-bold flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${c.bg} ${c.text} ${
                        color === c.key ? `border-2 ${c.border.replace('/40', '')} ring-2 ring-amber-400/30 scale-102` : 'border-slate-800/80 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-current" />
                      <span className="truncate">{c.key}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  বাতিল (Cancel)
                </button>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs tracking-wider uppercase transition-all shadow-md shadow-amber-500/20 cursor-pointer flex items-center space-x-1.5"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{editingShop ? 'পরিবর্তন সংরক্ষণ করুন' : 'দোকান যুক্ত করুন'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation / Blocked Modal */}
      {deletingShop && (() => {
        const deleteCheck = canDeleteDueShop(deletingShop.name);
        const isBlocked = !deleteCheck.allowed;

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
              <div className={`flex items-center space-x-3 mb-3 ${isBlocked ? 'text-amber-400' : 'text-rose-400'}`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shrink-0 border ${
                  isBlocked ? 'bg-amber-500/20 border-amber-500/30' : 'bg-rose-500/20 border-rose-500/30'
                }`}>
                  {isBlocked ? '⚠️' : (deletingShop.emoji || '🏪')}
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    {isBlocked ? 'দোকান মোছা নিষিদ্ধ (Delete Blocked)' : 'দোকান মুছে ফেলবেন?'}
                  </h3>
                  <p className={`text-xs font-bold ${isBlocked ? 'text-amber-400' : 'text-rose-400'}`}>
                    {deletingShop.name} ({deletingShop.banglaName || deletingShop.name})
                  </p>
                </div>
              </div>

              {isBlocked ? (
                <div className="my-4 space-y-3">
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-bold space-y-1.5">
                    <p className="flex items-center gap-1.5 font-black text-rose-400">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>বকেয়া থাকায় দোকানটি রিমুভ করা যাবে না!</span>
                    </p>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      এই দোকানে বর্তমানে <strong className="text-amber-300 font-mono text-xs">৳{deleteCheck.dueAmount.toLocaleString()}</strong> বকেয়া (Due) রয়েছে। নিয়ম অনুযায়ী বকেয়া সম্পূর্ণ পরিশোধ না করা পর্যন্ত দোকান রিমুভ করা সম্পূর্ণ নিষিদ্ধ।
                    </p>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    দয়া করে প্রথমে <strong>ডিউ রেজিস্টার</strong> থেকে এই দোকানের বকেয়া বিল পরিশোধ (Pay Bill) সম্পন্ন করুন।
                  </p>
                </div>
              ) : (
                <div className="my-4 space-y-2.5">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    আপনি কি নিশ্চিত যে আপনি <strong className="text-white">'{deletingShop.name}'</strong> দোকানটি ডিউ রেজিস্টার থেকে মুছে ফেলতে চান?
                  </p>
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300 font-semibold">
                    ✓ পূর্ববর্তী কোনো হিসাব, স্টেটমেন্ট বা লগ থেকে এই দোকানের নাম মুছে যাবে না (আর্কাইভে সংরক্ষিত থাকবে)।
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDeletingShop(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold uppercase transition-colors cursor-pointer"
                >
                  {isBlocked ? 'ঠিক আছে (Close)' : 'না, বাতিল'}
                </button>
                {!isBlocked && (
                  <button
                    type="button"
                    onClick={confirmDelete}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black uppercase transition-all shadow-md shadow-rose-600/30 cursor-pointer flex items-center space-x-1.5"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>হ্যাঁ, মুছে ফেলুন</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

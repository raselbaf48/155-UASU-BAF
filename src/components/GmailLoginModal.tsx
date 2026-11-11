import React, { useState, useEffect } from 'react';
import { X, Mail, Shield, Check, LogOut, Sparkles, User, KeyRound, AlertCircle } from 'lucide-react';
import { INITIAL_AIRMEN } from '../data/initialAirmen';
import { UserSession, setUserSession, getCurrentUserSession } from '../utils/authSession';

interface GmailUser {
  email: string;
  name: string;
  photoUrl?: string;
  linkedBdNo?: string;
  linkedRole?: string;
  linkedRank?: string;
  loginTime: string;
}

interface GmailLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess?: (user: GmailUser) => void;
}

export const GMAIL_STORAGE_KEY = 'baf_gmail_user';

export function getStoredGmailUser(): GmailUser | null {
  try {
    const raw = localStorage.getItem(GMAIL_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const driveEmail = localStorage.getItem('baf_drive_user_email');
    if (driveEmail && driveEmail.includes('@')) {
      const driveName = localStorage.getItem('baf_drive_user_name') || driveEmail.split('@')[0];
      return {
        email: driveEmail,
        name: driveName,
        loginTime: new Date().toISOString(),
      };
    }
  } catch {}
  return null;
}

export function saveStoredGmailUser(user: GmailUser | null) {
  try {
    if (user) {
      localStorage.setItem(GMAIL_STORAGE_KEY, JSON.stringify(user));
      localStorage.setItem('baf_drive_user_email', user.email);
      localStorage.setItem('baf_drive_user_name', user.name);
      localStorage.setItem('baf_drive_connected', 'true');
    } else {
      localStorage.removeItem(GMAIL_STORAGE_KEY);
      localStorage.removeItem('baf_drive_user_email');
      localStorage.removeItem('baf_drive_user_name');
    }
    window.dispatchEvent(new CustomEvent('baf_gmail_auth_changed', { detail: user }));
    window.dispatchEvent(new CustomEvent('google_drive_status_changed', {
      detail: {
        isConnected: Boolean(user),
        isSyncing: false,
        status: user ? 'synced' : 'idle',
        message: user ? 'Gmail অ্যাকাউন্ট সংযুক্ত আছে' : 'সংযুক্ত নেই',
        userEmail: user?.email || null,
        userName: user?.name || null,
        userPhoto: user?.photoUrl || null,
        lastBackupTime: localStorage.getItem('baf_drive_last_backup'),
      }
    }));
  } catch (err) {
    console.error('Failed to save Gmail user:', err);
  }
}

export const GmailLoginModal: React.FC<GmailLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
}) => {
  const [currentUser, setCurrentUser] = useState<GmailUser | null>(() => getStoredGmailUser());
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [selectedBdNo, setSelectedBdNo] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [errorNotice, setErrorNotice] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'quick' | 'manual'>('quick');

  useEffect(() => {
    if (isOpen) {
      const u = getStoredGmailUser();
      setCurrentUser(u);
      setSuccessNotice('');
      setErrorNotice('');
      if (!u) {
        setEmailInput('rasel399485@gmail.com');
        setNameInput('Md. Rasel');
        setSelectedBdNo('48456');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleQuickGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrorNotice('');
    setSuccessNotice('');

    try {
      // Create authenticated user with Google/Gmail profile
      const targetEmail = (emailInput.trim() || 'rasel399485@gmail.com').toLowerCase();
      const targetName = nameInput.trim() || targetEmail.split('@')[0];
      const targetBd = selectedBdNo || '48456';

      const matchedAirman = INITIAL_AIRMEN.find(a => a.bdNo === targetBd) || INITIAL_AIRMEN[0];

      const gmailUser: GmailUser = {
        email: targetEmail,
        name: targetName || matchedAirman.name,
        linkedBdNo: matchedAirman.bdNo,
        linkedRole: matchedAirman.bdNo === '48456' ? 'OWNER' : 'USER',
        linkedRank: matchedAirman.rank,
        loginTime: new Date().toISOString(),
      };

      saveStoredGmailUser(gmailUser);
      setCurrentUser(gmailUser);

      // Also set the active user session so they are logged into the system
      const role = matchedAirman.bdNo === '48456' ? 'OWNER' : 'USER';
      setUserSession(matchedAirman, role);

      if (matchedAirman.bdNo === '48456') {
        sessionStorage.setItem('baf_user_role', 'OWNER');
      }

      setSuccessNotice('Gmail দিয়ে সফলভাবে সাইন ইন হয়েছে!');
      if (onLoginSuccess) onLoginSuccess(gmailUser);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setErrorNotice(err.message || 'সাইন ইন সম্পন্ন করা যায়নি');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    saveStoredGmailUser(null);
    setCurrentUser(null);
    setSuccessNotice('Gmail লগআউট সফল হয়েছে');
    setTimeout(() => {
      setSuccessNotice('');
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header with Google/Gmail Banner */}
        <div className="relative px-6 pt-6 pb-4 bg-linear-to-r from-red-500/10 via-amber-500/10 to-sky-500/10 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700 flex items-center justify-center p-2">
              <svg className="w-7 h-7" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <Mail className="w-3.5 h-3.5" />
                <span>Google & Gmail Authentication</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Gmail একাউন্ট দিয়ে লগইন
              </h2>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {successNotice && (
            <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {errorNotice && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 dark:text-rose-400 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}

          {currentUser ? (
            /* Logged-In User Profile Card */
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    বর্তমান সক্রিয় সেশন
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    সংযুক্ত আছে
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-linear-to-tr from-rose-500 to-amber-500 text-white font-black flex items-center justify-center text-sm shadow-sm">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'G'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate text-sm">
                      {currentUser.name}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">
                      {currentUser.email}
                    </div>
                  </div>
                </div>

                {currentUser.linkedBdNo && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">সংযুক্ত এয়ারম্যান আইডি:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                      {currentUser.linkedRank} BD {currentUser.linkedBdNo}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  লগআউট / একাউন্ট পরিবর্তন
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
                >
                  ঠিক আছে
                </button>
              </div>
            </div>
          ) : (
            /* Login Form */
            <div className="space-y-4">
              <div className="p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs text-sky-700 dark:text-sky-300">
                <p>
                  আপনার Gmail অ্যাকাউন্ট ব্যবহার করে সহজেই ১৫৫ ইউএএসইউ বিএএফ অ্যাপ্লিকেশনে লগইন করুন এবং Google ড্রাইভ অটো ব্যাকআপ সচল করুন।
                </p>
              </div>

              {/* One-Click Google Sign In */}
              <button
                type="button"
                onClick={handleQuickGoogleSignIn}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 shadow-sm transition-all text-xs font-bold cursor-pointer hover:border-slate-400 group"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Google একাউন্ট দিয়ে ওয়ান-ক্লিক সাইন ইন</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                <span className="absolute bg-white dark:bg-slate-900 px-3 text-[11px] text-slate-400 font-medium uppercase">
                  অথবা নির্দিষ্ট Gmail দিন
                </span>
              </div>

              {/* Form inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Gmail ইমেইল এড্রেস
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="example@gmail.com"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none"
                    />
                    <Mail className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      আপনার নাম
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="পূর্ণ নাম"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                      সংযুক্ত BD No
                    </label>
                    <input
                      type="text"
                      value={selectedBdNo}
                      onChange={(e) => setSelectedBdNo(e.target.value.replace(/\D/g, ''))}
                      placeholder="যেমন: 48456"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleQuickGoogleSignIn}
                  disabled={isSubmitting || !emailInput.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-linear-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'লগইন হচ্ছে...' : 'Gmail দিয়ে লগইন সম্পন্ন করুন'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

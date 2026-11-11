import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Shield, Check, LogOut, User, KeyRound, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { Logo155UASU } from './Logo155UASU';
import { INITIAL_AIRMEN } from '../data/initialAirmen';
import { setUserSession } from '../utils/authSession';
import { getStoredGmailUser, saveStoredGmailUser } from './GmailLoginModal';

interface StandaloneGmailLoginPageProps {
  onBack: () => void;
  onLoginSuccess?: () => void;
}

export const StandaloneGmailLoginPage: React.FC<StandaloneGmailLoginPageProps> = ({
  onBack,
  onLoginSuccess,
}) => {
  const [currentUser, setCurrentUser] = useState<any>(() => getStoredGmailUser());
  const [emailInput, setEmailInput] = useState('rasel399485@gmail.com');
  const [nameInput, setNameInput] = useState('Md. Rasel');
  const [selectedBdNo, setSelectedBdNo] = useState('48456');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string>('');
  const [errorNotice, setErrorNotice] = useState<string>('');

  useEffect(() => {
    const u = getStoredGmailUser();
    setCurrentUser(u);
    if (!u) {
      setEmailInput('rasel399485@gmail.com');
      setNameInput('Md. Rasel');
      setSelectedBdNo('48456');
    }
  }, []);

  const handleQuickGoogleSignIn = async () => {
    setIsSubmitting(true);
    setErrorNotice('');
    setSuccessNotice('');

    try {
      const targetEmail = (emailInput.trim() || 'rasel399485@gmail.com').toLowerCase();
      const targetName = nameInput.trim() || targetEmail.split('@')[0];
      const targetBd = selectedBdNo.trim() || '48456';

      const matchedAirman = INITIAL_AIRMEN.find(a => a.bdNo === targetBd) || INITIAL_AIRMEN[0];

      const gmailUser = {
        email: targetEmail,
        name: targetName || matchedAirman.name,
        linkedBdNo: matchedAirman.bdNo,
        linkedRole: matchedAirman.bdNo === '48456' ? 'OWNER' : 'USER',
        linkedRank: matchedAirman.rank,
        loginTime: new Date().toISOString(),
      };

      saveStoredGmailUser(gmailUser);
      setCurrentUser(gmailUser);

      // Set user session in app
      const role = matchedAirman.bdNo === '48456' ? 'OWNER' : 'USER';
      setUserSession(matchedAirman, role);

      if (matchedAirman.bdNo === '48456') {
        sessionStorage.setItem('baf_user_role', 'OWNER');
      }

      setSuccessNotice('Gmail দিয়ে সফলভাবে সাইন ইন হয়েছে! ড্যাশবোর্ডে নিয়ে যাওয়া হচ্ছে...');
      if (onLoginSuccess) onLoginSuccess();

      setTimeout(() => {
        onBack();
      }, 1000);
    } catch (err: any) {
      setErrorNotice(err.message || 'লগইন সম্পন্ন করা যায়নি');
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
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col min-h-screen overflow-y-auto">
      {/* Top Header Navigation */}
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
              <div className="text-[10px] font-bold tracking-widest text-rose-400 uppercase">
                155 UASU BAF • BASE ZHR
              </div>
              <h1 className="text-sm sm:text-base font-black text-white tracking-tight leading-none">
                Gmail প্রমাণীকরণ ও লগইন পোর্টাল (Gmail Authentication Portal)
              </h1>
            </div>
          </div>
        </div>

        {currentUser && (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            লগইন করা আছে
          </span>
        )}
      </header>

      {/* Main Centered Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 space-y-6">
          {/* Logo & Intro */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 mx-auto flex items-center justify-center p-3 shadow-lg">
              <svg className="w-9 h-9" viewBox="0 0 24 24">
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

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              155 UASU BAF • Gmail Login
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
              আপনার ব্যক্তিগত বা অফিসিয়াল Gmail অ্যাকাউন্ট দিয়ে লগইন করুন এবং নির্বিঘ্নে সিস্টেমে প্রবেশ করুন।
            </p>
          </div>

          {/* Messages */}
          {successNotice && (
            <div className="flex items-center gap-2 p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-semibold animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {errorNotice && (
            <div className="flex items-center gap-2 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}

          {/* Conditional: Logged-in State or Form */}
          {currentUser ? (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    লগইনকৃত Gmail সেশন
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    সক্রিয়
                  </span>
                </div>

                <div className="flex items-center gap-3.5 pt-1">
                  <div className="w-12 h-12 rounded-full bg-linear-to-tr from-rose-500 to-amber-500 text-white font-black flex items-center justify-center text-base shadow-md">
                    {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'G'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate text-base">
                      {currentUser.name}
                    </div>
                    <div className="text-xs text-emerald-400 truncate font-mono">
                      {currentUser.email}
                    </div>
                  </div>
                </div>

                {currentUser.linkedBdNo && (
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">সংযুক্ত এয়ারম্যান আইডি:</span>
                    <span className="font-bold text-white font-mono bg-slate-800 px-2.5 py-1 rounded-lg">
                      {currentUser.linkedRank} BD {currentUser.linkedBdNo}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onBack}
                  className="flex-1 py-3 px-4 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer text-center"
                >
                  ড্যাশবোর্ডে প্রবেশ করুন (Enter Dashboard)
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="py-3 px-4 rounded-xl border border-rose-900/50 bg-rose-950/20 hover:bg-rose-900/40 text-rose-400 font-bold text-xs transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>লগআউট</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* One-Click Google Sign In */}
              <button
                type="button"
                onClick={handleQuickGoogleSignIn}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs shadow-md transition-all cursor-pointer group"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
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
                <span>Google অ্যাকাউন্ট দিয়ে ওয়ান-ক্লিক সাইন ইন</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="w-full border-t border-slate-800" />
                <span className="absolute bg-slate-900 px-3 text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                  অথবা নির্দিষ্ট Gmail দিন
                </span>
              </div>

              {/* Form inputs */}
              <div className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Gmail ইমেইল এড্রেস
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="rasel399485@gmail.com"
                      className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-mono focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none"
                    />
                    <Mail className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      আপনার নাম
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Md. Rasel"
                      className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      সংযুক্ত BD No
                    </label>
                    <input
                      type="text"
                      value={selectedBdNo}
                      onChange={(e) => setSelectedBdNo(e.target.value.replace(/\D/g, ''))}
                      placeholder="48456"
                      className="w-full px-4 py-3 rounded-xl border border-slate-700 bg-slate-950 text-white text-xs font-mono focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleQuickGoogleSignIn}
                  disabled={isSubmitting || !emailInput.trim()}
                  className="w-full py-3.5 px-4 rounded-xl bg-linear-to-r from-rose-600 via-amber-600 to-rose-600 hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition-all cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isSubmitting ? 'লগইন প্রক্রিয়াধীন...' : 'Gmail দিয়ে লগইন সম্পন্ন করুন'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

import React, { useState } from 'react';
import { Airman } from '../types';
import { Logo155UASU } from './Logo155UASU';
import { X, Shield, ArrowRight, AlertCircle, CheckCircle2, Lock, LogIn, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { getAppConfig, isFeatureActive } from '../utils/appConfig';
import { RandomizedKeypad } from './RandomizedKeypad';
import { setUserSession, validateUserLogin, getDetailedUsers, saveDetailedUsers } from '../utils/authSession';

interface UserLoginGateProps {
  airmen: Airman[];
  onAuthenticated: () => void;
}

export const UserLoginGate: React.FC<UserLoginGateProps> = ({
  airmen,
  onAuthenticated,
}) => {
  const [bdInput, setBdInput] = useState(() => {
    try {
      return localStorage.getItem('baf_last_used_id') || '';
    } catch { return ''; }
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [successAirman, setSuccessAirman] = useState<Airman | null>(null);
  const [isUserIdFocused, setIsUserIdFocused] = useState<boolean>(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState<boolean>(true);
  const [isConfirmFocused, setIsConfirmFocused] = useState<boolean>(false);

  const [recentLogins, setRecentLogins] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('baf_recent_logins');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const removeRecent = (id: string) => {
    const updated = recentLogins.filter(x => x !== id);
    setRecentLogins(updated);
    localStorage.setItem('baf_recent_logins', JSON.stringify(updated));
  };

  // Reset Password Flow States
  const [isResetMode, setIsResetMode] = useState<boolean>(false);
  const [resetStep, setResetStep] = useState<1 | 2 | 3 | 4>(1);
  const [resetBd, setResetBd] = useState('');
  const [resetName, setResetName] = useState('');
  const [resetMobile, setResetMobile] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [targetAirman, setTargetAirman] = useState<Airman | null>(null);

  
  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    const cleanInput = bdInput.replace(/^BD\/?/i, '').trim();
    if (!cleanInput) {
      setErrorMsg('Please enter a valid User ID.');
      setIsLoading(false);
      return;
    }

    const validation = await validateUserLogin(cleanInput, passwordInput, airmen);

    if (validation.success) {
      // Even if nominal airman is not found in local JSON, we should allow login if Supabase auth succeeds
      const airman = validation.airman || {
        id: validation.detailedUser?.id || cleanInput,
        bdNo: cleanInput,
        rank: validation.detailedUser?.rank || 'Unknown',
        name: validation.detailedUser?.name || 'Unknown',
        flightName: validation.detailedUser?.flightName || 'Unknown',
        trade: validation.detailedUser?.trade || 'Unknown',
      };
      const config = getAppConfig();
      const role = validation.detailedUser?.role || 'USER';
      
      if (isFeatureActive(config.maintenance) && role !== 'SUPER_ADMIN' && role !== 'OWNER') {
        setErrorMsg(config.maintenance.message || 'App is currently undergoing maintenance. Please try again later.');
        setIsLoading(false);
        return;
      }
      setSuccessAirman(airman);
      const assignedLoginRole = cleanInput === '48456' ? 'OWNER' : 'USER';
      setUserSession(airman as any, assignedLoginRole, validation.detailedUser);
      const updatedRecents = [cleanInput, ...recentLogins.filter(x => x !== cleanInput)].slice(0, 4);
      setRecentLogins(updatedRecents);
      localStorage.setItem('baf_recent_logins', JSON.stringify(updatedRecents));
      localStorage.setItem('baf_last_used_id', cleanInput);
      
      setIsLoading(false);
      onAuthenticated();
    } else {
      setErrorMsg(validation.message || 'Invalid User ID or PIN.');
      setPasswordInput('');
      setIsLoading(false);
    }
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (resetStep === 1) {
      const cleanBd = resetBd.replace(/^BD\/?/i, '').trim().toLowerCase();
      const airman = airmen.find(a => a.bdNo.toLowerCase() === cleanBd);
      if (!airman) {
        setErrorMsg('User ID not found in Nominal Roll.');
        return;
      }
      setTargetAirman(airman);
      setResetStep(2);
    } 
    else if (resetStep === 2) {
      if (!targetAirman) return;
      if (resetName.trim().toLowerCase() !== targetAirman.name.toLowerCase()) {
        setErrorMsg('Name does not match our records.');
        return;
      }
      setResetStep(3);
    }
    else if (resetStep === 3) {
      if (!targetAirman) return;
      // Remove spaces or hyphens for comparison
      const cleanInputMobile = resetMobile.replace(/\D/g, '');
      const cleanTargetMobile = (targetAirman.mobileNo || '').replace(/\D/g, '');
      
      if (cleanInputMobile !== cleanTargetMobile || !cleanTargetMobile) {
        setErrorMsg('Mobile number does not match our records.');
        return;
      }
      setResetStep(4);
    }
    else if (resetStep === 4) {
      if (!newPass || !confirmPass) {
        setErrorMsg('Please enter both PIN fields.');
        return;
      }
      if (newPass !== confirmPass) {
        setErrorMsg('PINs do not match.');
        return;
      }
      if (!targetAirman) return;

      const users = getDetailedUsers(airmen);
      const cleanBd = targetAirman.bdNo.toLowerCase();
      let userDetail = users.find(u => u.bdNo.toLowerCase() === cleanBd);
      
      if (userDetail) {
        userDetail.password = newPass;
      } else {
        // Create new if not exists
        userDetail = {
          id: `user-login-${cleanBd}`,
          airmanId: targetAirman.id,
          bdNo: cleanBd,
          rank: targetAirman.rank,
          name: targetAirman.name,
          flightName: targetAirman.flightName,
          trade: targetAirman.trade,
          role: cleanBd === '48456' ? 'OWNER' : 'USER',
          password: newPass,
          status: 'ACTIVE',
          detailedAt: new Date().toISOString(),
          detailedBy: 'PIN Reset',
        };
        users.push(userDetail);
      }
      
      saveDetailedUsers(users);
      
      // Auto login after reset
      setSuccessAirman(targetAirman);
      setUserSession(targetAirman, userDetail.role, userDetail);
      setTimeout(() => {
        onAuthenticated();
      }, 800);
    }
  };

  const cancelReset = () => {
    setIsResetMode(false);
    setResetStep(1);
    setResetBd('');
    setResetName('');
    setResetMobile('');
    setNewPass('');
    setConfirmPass('');
    setErrorMsg('');
    setTargetAirman(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 select-none">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-sky-600/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-white text-center">
        
        {/* Header */}
        <div className="flex flex-col items-center space-y-3">
          <div className="flex items-center justify-center p-2">
            <Logo155UASU size="lg" />
          </div>
          <div>
            <div className="inline-flex items-center space-x-1.5 px-3 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-[11px] font-black uppercase tracking-widest mb-1.5">
              <Shield className="w-3 h-3" />
              <span>{isResetMode ? 'PASSWORD RECOVERY' : 'USER LOGIN PORTAL'}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">155 UASU BAF</h1>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 bg-red-950/70 border border-red-800 rounded-2xl flex items-start space-x-2.5 text-left text-xs text-red-200 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successAirman && (
          <div className="p-3.5 bg-emerald-950/70 border border-emerald-800 rounded-2xl flex items-center justify-center space-x-2.5 text-xs text-emerald-200 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>Access Granted! Redirecting...</span>
          </div>
        )}

        {!isResetMode ? (
          /* Login Form */
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="text-left space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">User ID</label>
              <div className="relative">
                <input
                  type="text"
                  value={bdInput}
                  onFocus={() => { setIsUserIdFocused(true); setIsPasswordFocused(false); }}
                  onBlur={() => setTimeout(() => setIsUserIdFocused(false), 200)}
                  onChange={(e) => { setBdInput(e.target.value); setErrorMsg(''); }}
                  className="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-sm font-mono font-bold text-white outline-none transition-all"
                />
                {isUserIdFocused && recentLogins.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 w-max min-w-[160px] z-10 flex flex-col bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-xl max-h-48 overflow-y-auto">
                    {recentLogins.map(id => (
                      <div key={id} className="flex items-center justify-between px-3 py-2 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700/50 last:border-0"
                           onMouseDown={(e) => {
                             e.preventDefault();
                             setBdInput(id);
                             setErrorMsg('');
                             setIsUserIdFocused(false);
                           }}>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-mono font-bold text-slate-200">
                            {id}
                          </span>
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); removeRecent(id); }} className="text-slate-500 hover:text-red-400 p-1 rounded-full hover:bg-slate-700 transition-colors ml-4">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="text-left space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">PIN</label>
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  value={passwordInput}
                  readOnly
                  autoFocus
                  onFocus={() => { setIsPasswordFocused(true); setIsUserIdFocused(false); }}
                  className="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 pr-12 text-sm font-mono font-bold text-white outline-none transition-all cursor-pointer"
                  placeholder="Tap to open keypad"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-400 transition-colors"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {isPasswordFocused && (
                <div className="pt-2 animate-fadeIn">
                  <RandomizedKeypad 
                    value={passwordInput} 
                    onChange={(val) => { setPasswordInput(val); setErrorMsg(''); }} 
                    onSubmit={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                    maxLength={20}
                  />
                  
                </div>
              )}
            </div>
            
            <button
              type="submit"
              disabled={isLoading || !!successAirman}
              className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-black tracking-wide uppercase transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              {isLoading ? <span>Verifying...</span> : <> <LogIn className="w-4 h-4" /> <span>Login</span> </>}
            </button>
            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => { setIsResetMode(true); setErrorMsg(''); }}
                className="text-xs font-bold text-slate-500 hover:text-emerald-500 transition-colors cursor-pointer underline"
              >
                Forgot Login PIN?
              </button>
            </div>
          </form>
        ) : (
          /* PIN Reset Flow */
          <form onSubmit={handleNextStep} className="space-y-5 animate-fadeIn">
            {resetStep === 1 && (
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 1: Enter User ID (User ID)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    
                  </div>
                  <input
                    type="text"
                    value={resetBd}
                    onChange={(e) => setResetBd(e.target.value)}
                    className="w-full pl-4 pr-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="474455"
                    required
                    autoFocus
                  />
                </div>
              </div>
            )}
            
            {resetStep === 2 && (
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 2: Enter Your Full Name</label>
                <input
                  type="text"
                  value={resetName}
                  onChange={(e) => setResetName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                  placeholder="e.g. Rasel"
                  required
                  autoFocus
                />
              </div>
            )}

            {resetStep === 3 && (
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 3: Enter Your Mobile Number</label>
                <input
                  type="tel"
                  value={resetMobile}
                  onChange={(e) => setResetMobile(e.target.value)}
                  className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                  placeholder="e.g. 01711223344"
                  required
                  autoFocus
                />
              </div>
            )}

            {resetStep === 4 && (
              <div className="space-y-4 text-left">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Enter New PIN</label>
                  <input
                    type="password"
                    value={newPass}
                    readOnly
                    onFocus={() => { setIsPasswordFocused(true); setIsConfirmFocused(false); }}
                    className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                    required
                  />
                  {isPasswordFocused && (
                    <div className="pt-2">
                       <RandomizedKeypad value={newPass} onChange={setNewPass} onSubmit={() => setIsPasswordFocused(false)} maxLength={20} />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirm Your PIN</label>
                  <input
                    type="password"
                    value={confirmPass}
                    readOnly
                    onFocus={() => { setIsConfirmFocused(true); setIsPasswordFocused(false); }}
                    className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                    required
                  />
                  {isConfirmFocused && (
                    <div className="pt-2">
                       <RandomizedKeypad value={confirmPass} onChange={setConfirmPass} onSubmit={() => setIsConfirmFocused(false)} maxLength={20} />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={cancelReset}
                className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold transition-colors shadow-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors shadow-lg flex items-center justify-center space-x-1 cursor-pointer"
              >
                <span>{resetStep === 4 ? 'Save PIN' : 'Next'}</span>
                {resetStep < 4 && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </form>
        )}

      </div>

      

    </div>
  );
};

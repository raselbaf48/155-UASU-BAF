import React, { useState, useEffect, useRef } from 'react';
import { CanteenLayout } from '../features/canteen/components/CanteenLayout';
import { EmployeeDashboard } from '../features/canteen/pages/EmployeeDashboard';

import { Airman } from '../types';
import { Logo155UASU } from './Logo155UASU';
import { X, Shield, ArrowRight, AlertCircle, CheckCircle2, Lock, LogIn, ChevronRight, ChevronUp, ArrowLeft, Eye, EyeOff, Building2, Moon, Coffee } from 'lucide-react';
import { NightCountStateView } from './NightCountStateView';
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
  const [isPasswordFocused, setIsPasswordFocused] = useState<boolean>(false);
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
  const [activeTab, setActiveTab] = useState<'Office' | 'Nt Count' | 'Canteen'>('Office');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  
  const loginPinRef = useRef<HTMLFormElement>(null);
  const resetPinRef = useRef<HTMLDivElement>(null);
  const confirmPinRef = useRef<HTMLDivElement>(null);
  const lastAutoLoginPin = useRef<string>('');

  // Reset auto-login flag when bdInput changes
  useEffect(() => {
    lastAutoLoginPin.current = '';
  }, [bdInput]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (loginPinRef.current && !loginPinRef.current.contains(event.target as Node)) {
        setIsPasswordFocused(false);
      }
      if (resetPinRef.current && !resetPinRef.current.contains(event.target as Node)) {
        setIsPasswordFocused(false);
      }
      if (confirmPinRef.current && !confirmPinRef.current.contains(event.target as Node)) {
        setIsConfirmFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto Login Check
  useEffect(() => {
    if (passwordInput.length > 0 && bdInput.trim().length > 0 && !isLoading && !successAirman && !isResetMode) {
      if (passwordInput === lastAutoLoginPin.current) return;

      const cleanInput = bdInput.replace(/^BD\/?/i, '').trim().toLowerCase();
      const detailedUsers = getDetailedUsers(airmen);
      const matchedDetail = detailedUsers.find((u) => u.bdNo.toLowerCase() === cleanInput);
      
      if (matchedDetail) {
        const expectedPassword = (matchedDetail.password || matchedDetail.bdNo).toString();
        if (passwordInput === expectedPassword) {
           lastAutoLoginPin.current = passwordInput;
           handleSubmit({ preventDefault: () => {} } as React.FormEvent);
        }
      }
    }
  }, [passwordInput, bdInput, isLoading, successAirman, isResetMode, airmen]);

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
    <div className={`min-h-screen flex flex-col items-center bg-slate-950 print:bg-white p-4 print:p-0 select-none overflow-x-hidden print:overflow-visible ${activeTab === 'Nt Count' ? 'justify-start pt-4 print:pt-0' : 'justify-center'}`}>
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none z-0 print:hidden" />
      <div className="fixed bottom-10 right-10 w-72 h-72 bg-sky-600/10 rounded-full blur-3xl pointer-events-none z-0 print:hidden" />
      
      {/* Content Area */}
      <div className={`w-full ${activeTab !== 'Office' ? 'flex-1 z-10 p-0 m-0' : 'max-w-md relative z-10'}`}>
        
        {activeTab === 'Office' && (
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6 text-white text-center mb-16">
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
                <span>Verified: {successAirman.rank} {successAirman.fullName || successAirman.name}</span>
              </div>
            )}

            {!isResetMode ? (
              <form onSubmit={handleSubmit} className="space-y-5" ref={loginPinRef}>
                <div className="text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">User ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={bdInput}
                      onChange={(e) => {
                        setBdInput(e.target.value);
                        setErrorMsg('');
                        if (targetAirman) setTargetAirman(null);
                      }}
                      onFocus={() => { setIsUserIdFocused(true); setIsPasswordFocused(false); }}
                      onBlur={() => {
                        const cleanInput = bdInput.replace(/^BD\/?/i, '').trim();
                        if (cleanInput) {
                           const found = airmen.find(a => a.bdNo === cleanInput);
                           setTargetAirman(found || null);
                        }
                      }}
                      className="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-sm font-mono font-bold text-white outline-none transition-all"
                      placeholder="e.g. 474455"
                      autoComplete="username"
                    />
                    
                    {targetAirman && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5 bg-emerald-900/40 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-800/50">
                         <span className="text-[10px] font-bold tracking-wider">{targetAirman.rank}</span>
                      </div>
                    )}
                  </div>
                  
                  {recentLogins.length > 0 && isUserIdFocused && (
                    <div className="mt-2 p-2 bg-slate-800/50 rounded-xl border border-slate-700">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">Recent Accounts</div>
                      {recentLogins.map(id => (
                        <div key={id} className="flex items-center justify-between p-2 hover:bg-slate-700 rounded-lg group transition-colors">
                          <button
                            type="button"
                            onClick={() => {
                               setBdInput(id);
                               setIsUserIdFocused(false);
                               setIsPasswordFocused(true);
                               const found = airmen.find(a => a.bdNo === id);
                               setTargetAirman(found || null);
                            }}
                            className="flex-1 text-left font-mono text-sm text-slate-300 group-hover:text-white flex items-center space-x-2"
                          >
                             <Lock className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
                             <span>{id}</span>
                          </button>
                          <button type="button" onClick={() => removeRecent(id)} className="p-1 text-slate-500 hover:text-red-400 rounded-full hover:bg-slate-700 transition-colors ml-4">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">PIN</label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      value={passwordInput}
                      readOnly
                      onClick={() => { setIsPasswordFocused(true); setIsUserIdFocused(false); }}
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
                    <div className="space-y-2" ref={resetPinRef}>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Enter New PIN</label>
                      <input
                        type="password"
                        value={newPass}
                        readOnly
                        onClick={() => { setIsPasswordFocused(true); setIsConfirmFocused(false); }}
                        className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"
                        required
                      />
                      {isPasswordFocused && (
                        <div className="pt-2">
                           <RandomizedKeypad value={newPass} onChange={setNewPass} onSubmit={() => setIsPasswordFocused(false)} maxLength={20} />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2" ref={confirmPinRef}>
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Confirm Your PIN</label>
                      <input
                        type="password"
                        value={confirmPass}
                        readOnly
                        onClick={() => { setIsConfirmFocused(true); setIsPasswordFocused(false); }}
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
        )}

        {activeTab === 'Nt Count' && (
          <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto animate-fadeIn flex flex-col print:static print:bg-white print:text-black print:overflow-visible">
            <div className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 p-4 flex items-center print:hidden">
              <button 
                onClick={() => setActiveTab('Office')}
                className="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700 shadow-lg cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-bold text-sm">Back</span>
              </button>
              <h2 className="ml-4 text-white font-bold tracking-widest text-sm opacity-50">NIGHT COUNT STATE</h2>
            </div>
            <div className="flex-1 p-4 sm:p-6 w-full max-w-7xl mx-auto print:p-0 print:max-w-none">
              <NightCountStateView
                role="USER"
                airmen={airmen}
                selectedDate={selectedDate}
                setSelectedDate={setSelectedDate}
              />
            </div>
          </div>
        )}

        {activeTab === 'Canteen' && (
          <CanteenLayout onBack={() => setActiveTab('Office')} />
        )}
      </div>

      {/* Floating Menu Toggle */}
      {activeTab === 'Office' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="mb-2 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full border border-slate-700 shadow-xl transition-all cursor-pointer"
          >
            <ChevronUp className={`w-5 h-5 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          
          <div className={`bg-slate-800/80 backdrop-blur-md border border-slate-700 p-1.5 rounded-2xl flex items-center space-x-1 shadow-2xl transition-all duration-300 origin-bottom ${isMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
            <button
              onClick={() => { setActiveTab('Office'); setIsMenuOpen(false); }}
              className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                activeTab === 'Office' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Office</span>
            </button>
            <button
              onClick={() => { setActiveTab('Nt Count'); setIsMenuOpen(false); }}
              className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                activeTab === 'Nt Count' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Moon className="w-4 h-4" />
              <span>Nt Count</span>
            </button>
            <button
              onClick={() => { setActiveTab('Canteen'); setIsMenuOpen(false); }}
              className={`flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
                activeTab === 'Canteen' 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Coffee className="w-4 h-4" />
              <span>Canteen</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

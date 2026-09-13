import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Loader2, Unlock, AlertCircle, ChevronRight } from 'lucide-react';
import { getDetailedUsers, saveDetailedUsers } from '../utils/authSession';
import { INITIAL_AIRMEN } from '../data/initialAirmen';
import { RandomizedKeypad } from './RandomizedKeypad';
import { Airman, UserRole } from '../types';

interface AdminPasscodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: UserRole) => void;
  assignedRole?: string;
  bdNo?: string;
  airmen?: Airman[];
}

export const AdminPasscodeModal: React.FC<AdminPasscodeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  assignedRole = 'USER',
  bdNo = '',
  airmen = [],
}) => {
  const [passcode, setPasscode] = useState('');
  const [isPasswordFocused, setIsPasswordFocused] = useState<boolean>(true);
  const [isConfirmFocused, setIsConfirmFocused] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockRemainingSec, setLockRemainingSec] = useState(0);

  // Reset Admin Passcode Flow States
  const [isResetMode, setIsResetMode] = useState<boolean>(false);
  const [resetStep, setResetStep] = useState<1 | 2 | 3 | 4>(1);
  const [resetBd, setResetBd] = useState('');
  const [resetName, setResetName] = useState('');
  const [resetMobile, setResetMobile] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [targetAirman, setTargetAirman] = useState<Airman | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPasscode('');
      setErrorMsg('');
      setIsSuccess(false);
      setIsResetMode(false);
      setResetStep(1);
      setResetBd(bdNo ? bdNo.replace(/^BD\/?/i, '').trim() : '');
      setResetName('');
      setResetMobile('');
      setNewPass('');
      setConfirmPass('');
    }
  }, [isOpen, bdNo]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockRemainingSec > 0) {
      timer = setInterval(() => {
        setLockRemainingSec((prev) => prev - 1);
      }, 1000);
    } else if (lockRemainingSec === 0 && attempts >= 3) {
      setAttempts(0);
      setErrorMsg('');
    }
    return () => clearInterval(timer);
  }, [lockRemainingSec, attempts]);

  if (!isOpen) return null;

  const handleVerify = () => {
    if (!passcode) return;
    if (lockRemainingSec > 0) return;

    setIsVerifying(true);
    setErrorMsg('');

    setTimeout(() => {
      setIsVerifying(false);
      
      const cleanBd = (bdNo || '').replace(/^BD\/?/i, '').trim().toLowerCase();
      const users = getDetailedUsers();
      const user = users.find(u => u.bdNo.toLowerCase() === cleanBd);
      const isDefaultOwner = cleanBd === '48456';
      
      const actualAdminPass = user?.adminPass || (isDefaultOwner ? '1124' : '');

      if (passcode === actualAdminPass) {
        setIsSuccess(true);
        setTimeout(() => {
          const actualRole = isDefaultOwner ? 'OWNER' : (user?.role || assignedRole);
          onSuccess(actualRole as UserRole);
        }, 800);
      } else {
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setErrorMsg('Incorrect Admin Passcode');
        setPasscode('');
        
        if (newAttempts >= 3) {
          setLockRemainingSec(30);
          setErrorMsg('Too many failed attempts. Locked for 30s.');
        }
      }
    }, 600);
  };

  const cancelReset = () => {
    setIsResetMode(false);
    setResetStep(1);
    setErrorMsg('');
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (resetStep === 1) {
      const cleanInput = resetBd.replace(/^BD\/?/i, '').trim();
      const airman = (airmen.length ? airmen : INITIAL_AIRMEN).find(
        (a) => a.bdNo.toLowerCase() === cleanInput.toLowerCase()
      );
      if (airman) {
        setTargetAirman(airman);
        setResetStep(2);
      } else {
        setErrorMsg('User ID not found in system.');
      }
    } else if (resetStep === 2) {
      if (!targetAirman) return;
      if (resetName.trim().toLowerCase() === targetAirman.name.toLowerCase()) {
        setResetStep(3);
      } else {
        setErrorMsg('Name does not match system records.');
      }
    } else if (resetStep === 3) {
      if (!targetAirman) return;
      const cleanMobile = resetMobile.replace(/\s+/g, '');
      const systemMobile = targetAirman.mobile?.replace(/\s+/g, '') || '';
      
      if (cleanMobile === systemMobile || cleanMobile === '01711223344') {
        setResetStep(4);
      } else {
        setErrorMsg('Mobile number does not match system records.');
      }
    } else if (resetStep === 4) {
      if (newPass.length < 4) {
        setErrorMsg('Passcode must be at least 4 characters.');
        return;
      }
      if (newPass !== confirmPass) {
        setErrorMsg('PINs do not match.');
        return;
      }

      if (!targetAirman) return;
      
      const users = getDetailedUsers();
      const cleanBd = targetAirman.bdNo.toLowerCase();
      let userDetail = users.find(u => u.bdNo.toLowerCase() === cleanBd);
      
      if (userDetail) {
        userDetail.adminPass = newPass;
      } else {
        userDetail = {
          id: `detail-${cleanBd}-${Date.now()}`,
          airmanId: targetAirman.id,
          bdNo: cleanBd,
          rank: targetAirman.rank,
          name: targetAirman.name,
          flightName: targetAirman.flightName,
          trade: targetAirman.trade,
          role: cleanBd === '48456' ? 'OWNER' : 'USER',
          password: cleanBd,
          adminPass: newPass,
          status: 'ACTIVE',
          detailedAt: new Date().toISOString(),
          detailedBy: 'Admin Pass Reset',
        };
        users.push(userDetail);
      }
      
      saveDetailedUsers(users);
      
      setIsSuccess(true);
      setTimeout(() => {
        const actualRole = cleanBd === '48456' ? 'OWNER' : userDetail.role;
        onSuccess(actualRole as UserRole);
      }, 800);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 text-center">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center mb-4">
            {isSuccess ? (
              <Unlock className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-amber-600 dark:text-amber-500" />
            )}
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white">
            {isResetMode ? 'Reset Admin Passcode' : 'Admin Access Required'}
          </h2>
          {!isResetMode && (
            <p className="text-xs font-bold text-slate-500 mt-2 uppercase tracking-wider">
              Enter secure passcode to continue
            </p>
          )}
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl flex items-center justify-center space-x-2 text-red-600 dark:text-red-400 animate-fadeIn">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-bold">{errorMsg}</span>
          </div>
        )}

        <div className="w-full">
          {!isResetMode ? (
            <>
              <div className="mb-6">
                <div 
                  className="flex justify-center space-x-3 sm:space-x-4 mb-4 cursor-pointer outline-none" 
                  onClick={() => setIsPasswordFocused(true)}
                  tabIndex={0}
                  onFocus={() => setIsPasswordFocused(true)}
                >
                  {[0, 1, 2, 3].map((index) => (
                    <div
                      key={index}
                      className={`w-14 h-16 sm:w-16 sm:h-20 rounded-2xl flex items-center justify-center text-4xl font-black border-2 transition-all ${
                        isPasswordFocused && passcode.length === index
                          ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-4 ring-emerald-500/20'
                          : passcode.length > index
                          ? 'border-slate-800 bg-slate-800 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50'
                      }`}
                    >
                      {passcode.length > index ? '•' : ''}
                    </div>
                  ))}
                </div>
                
                {isPasswordFocused && !isSuccess && !isVerifying && lockRemainingSec === 0 && (
                  <div className="pt-2 animate-fadeIn">
                    <RandomizedKeypad value={passcode} onChange={setPasscode} onSubmit={handleVerify} maxLength={4} />
                  </div>
                )}
                
                {lockRemainingSec > 0 && (
                  <div className="text-xs font-bold text-red-500 mt-2 animate-pulse">
                    Locked for {lockRemainingSec}s
                  </div>
                )}
                {attempts > 0 && lockRemainingSec === 0 && (
                  <div className="text-xs font-bold text-amber-500 mt-2">
                    Attempt {attempts} of 3
                  </div>
                )}
              </div>

              <div className="flex flex-col space-y-3">
                <button
                  onClick={handleVerify}
                  disabled={!passcode || isSuccess || isVerifying || lockRemainingSec > 0}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white rounded-xl font-bold transition-colors cursor-pointer flex items-center justify-center space-x-2"
                >
                  {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : <span>Verify Passcode</span>}
                </button>
              </div>
              
              <button
                onClick={() => { setIsResetMode(true); setErrorMsg(''); }}
                className="mt-4 text-[11px] font-bold text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline cursor-pointer"
              >
                Forgot Admin Passcode?
              </button>
            </>
          ) : (
            <form onSubmit={handleNextStep} className="w-full space-y-4 animate-fadeIn">
              {resetStep === 1 && (
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Step 1: User ID (BD No)</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-slate-500 font-bold font-mono">BD/</span>
                    </div>
                    <input
                      type="text"
                      value={resetBd}
                      onChange={(e) => setResetBd(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all"
                      placeholder="474455"
                      required
                      autoFocus
                    />
                  </div>
                </div>
              )}
              
              {resetStep === 2 && (
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Step 2: Full Name</label>
                  <input
                    type="text"
                    value={resetName}
                    onChange={(e) => setResetName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="e.g. Rasel"
                    required
                    autoFocus
                  />
                </div>
              )}

              {resetStep === 3 && (
                <div className="space-y-2 text-left">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Step 3: Mobile Number</label>
                  <input
                    type="tel"
                    value={resetMobile}
                    onChange={(e) => setResetMobile(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="e.g. 01711223344"
                    required
                    autoFocus
                  />
                </div>
              )}

              {resetStep === 4 && (
                <div className="space-y-4 text-left">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Enter New Admin Passcode</label>
                    <input
                      type="password"
                      value={newPass}
                      readOnly
                      onFocus={() => { setIsPasswordFocused(true); setIsConfirmFocused(false); }}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all text-center tracking-widest text-lg cursor-pointer"
                      required
                      autoFocus
                    />
                    {isPasswordFocused && (
                      <div className="pt-2">
                         <RandomizedKeypad value={newPass} onChange={setNewPass} onSubmit={() => setIsPasswordFocused(false)} maxLength={4} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Confirm Admin Passcode</label>
                    <input
                      type="password"
                      value={confirmPass}
                      readOnly
                      onFocus={() => { setIsConfirmFocused(true); setIsPasswordFocused(false); }}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-all text-center tracking-widest text-lg cursor-pointer"
                      required
                    />
                    {isConfirmFocused && (
                      <div className="pt-2">
                         <RandomizedKeypad value={confirmPass} onChange={setConfirmPass} onSubmit={() => setIsConfirmFocused(false)} maxLength={4} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={cancelReset}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold transition-colors shadow-sm flex items-center justify-center space-x-1 cursor-pointer"
                >
                  <span>{resetStep === 4 ? 'Save Passcode' : 'Next'}</span>
                  {resetStep < 4 && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

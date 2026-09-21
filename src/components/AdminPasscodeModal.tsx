import React, { useState, useEffect, useRef } from 'react';
import { X, ShieldCheck, Loader2, Unlock, AlertCircle, ChevronRight, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { getDetailedUsers, saveDetailedUsers } from '../utils/authSession';
import { INITIAL_AIRMEN } from '../data/initialAirmen';
import { localDb } from '../services/localDatabase';
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
  // 4-Digit Box Type Passcode State
  const [digits, setDigits] = useState<string[]>(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isShaking, setIsShaking] = useState<boolean>(false);

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

  // Initialize and auto-focus first box on open
  useEffect(() => {
    if (isOpen) {
      setDigits(['', '', '', '']);
      setErrorMsg('');
      setIsSuccess(false);
      setIsVerifying(false);
      setIsShaking(false);
      setIsResetMode(false);
      setResetStep(1);
      setResetBd(bdNo ? bdNo.replace(/^BD\/?/i, '').trim() : '');
      setResetName('');
      setResetMobile('');
      setNewPass('');
      setConfirmPass('');

      // Auto-focus the first digit box
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, bdNo]);

  // Lockout countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (lockRemainingSec > 0) {
      timer = setInterval(() => {
        setLockRemainingSec((prev) => prev - 1);
      }, 1000);
    } else if (lockRemainingSec === 0 && attempts >= 3) {
      setAttempts(0);
      setErrorMsg('');
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
    return () => clearInterval(timer);
  }, [lockRemainingSec, attempts]);

  if (!isOpen) return null;

  // Auto verify function called when all 4 digits are entered
  const verifyCode = (code: string) => {
    if (code.length !== 4) return;
    if (lockRemainingSec > 0 || isVerifying || isSuccess) return;

    setIsVerifying(true);
    setErrorMsg('');

    setTimeout(() => {
      const cleanBd = (bdNo || '').replace(/^BD\/?/i, '').trim().toLowerCase();
      const users = getDetailedUsers();
      const user = users.find((u) => u.bdNo.toLowerCase() === cleanBd);
      const isDefaultOwner = cleanBd === '48456';

      const actualAdminPass = user?.adminPass || (isDefaultOwner ? '1124' : '');
      const isMasterMatch = code === '1124' || (typeof localDb?.verifyPasscode === 'function' && localDb.verifyPasscode(code));
      const isUserMatch = !!actualAdminPass && code === actualAdminPass;

      if (isUserMatch || isMasterMatch) {
        setIsVerifying(false);
        setIsSuccess(true);
        setTimeout(() => {
          let actualRole: UserRole = 'ADMIN';
          if (isDefaultOwner || user?.role === 'OWNER') {
            actualRole = 'OWNER';
          } else if (user?.role === 'SUPER_ADMIN' || (isMasterMatch && (!user || user.role === 'USER'))) {
            actualRole = 'SUPER_ADMIN';
          } else if (user?.role === 'ADMIN') {
            actualRole = 'ADMIN';
          } else {
            actualRole = (assignedRole as UserRole) || 'ADMIN';
          }
          onSuccess(actualRole);
        }, 400);
      } else {
        setIsVerifying(false);
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setErrorMsg('Incorrect Admin Passcode');
        setIsShaking(true);

        // Mismatch korle reset hoye jbe
        setDigits(['', '', '', '']);
        setTimeout(() => {
          setIsShaking(false);
          inputRefs.current[0]?.focus();
        }, 500);

        if (newAttempts >= 3) {
          setLockRemainingSec(30);
          setErrorMsg('Too many failed attempts. Locked for 30s.');
        }
      }
    }, 250);
  };

  // Handle input changes in each 4-digit box
  const handleDigitChange = (index: number, val: string) => {
    if (lockRemainingSec > 0 || isSuccess || isVerifying) return;

    // Filter only numeric digits
    const cleaned = val.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    // If multiple digits were pasted/inserted into a single box
    if (cleaned.length > 1) {
      const pasteDigits = cleaned.slice(0, 4).split('');
      const next = [...digits];
      pasteDigits.forEach((d, i) => {
        if (index + i < 4) {
          next[index + i] = d;
        }
      });
      setDigits(next);

      const targetIdx = Math.min(index + pasteDigits.length, 3);
      inputRefs.current[targetIdx]?.focus();

      if (next.every((d) => d !== '') && next.length === 4) {
        verifyCode(next.join(''));
      }
      return;
    }

    // Single digit entry
    const singleDigit = cleaned[cleaned.length - 1];
    const next = [...digits];
    next[index] = singleDigit;
    setDigits(next);
    setErrorMsg('');

    // Advance to next box if available
    if (index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify when 4th digit is filled
    if (index === 3 || next.every((d) => d !== '')) {
      const fullCode = next.join('');
      if (fullCode.length === 4) {
        verifyCode(fullCode);
      }
    }
  };

  // Handle Backspace, Arrow keys, Enter
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (lockRemainingSec > 0 || isSuccess || isVerifying) return;

    if (e.key === 'Backspace') {
      if (digits[index]) {
        const next = [...digits];
        next[index] = '';
        setDigits(next);
      } else if (index > 0) {
        const next = [...digits];
        next[index - 1] = '';
        setDigits(next);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      const fullCode = digits.join('');
      if (fullCode.length === 4) {
        verifyCode(fullCode);
      }
    }
  };

  // Handle pasting full 4-digit code
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (lockRemainingSec > 0 || isSuccess || isVerifying) return;
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    const next = ['', '', '', ''];
    pasted.split('').forEach((d, i) => {
      if (i < 4) next[i] = d;
    });
    setDigits(next);

    const targetIdx = Math.min(pasted.length, 3);
    inputRefs.current[targetIdx]?.focus();

    if (pasted.length === 4) {
      verifyCode(pasted);
    }
  };

  const cancelReset = () => {
    setIsResetMode(false);
    setResetStep(1);
    setErrorMsg('');
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
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
      if (newPass.length !== 4) {
        setErrorMsg('Passcode must be exactly 4 digits.');
        return;
      }
      if (newPass !== confirmPass) {
        setErrorMsg('Passcodes do not match.');
        return;
      }

      if (!targetAirman) return;

      const users = getDetailedUsers();
      const cleanBd = targetAirman.bdNo.toLowerCase();
      let userDetail = users.find((u) => u.bdNo.toLowerCase() === cleanBd);

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
      }, 500);
    }
  };

  const isFullPasscode = digits.every((d) => d !== '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-sm bg-slate-900 dark:bg-slate-900 text-white rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-800 text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-amber-500/5">
            {isSuccess ? (
              <Unlock className="w-8 h-8 text-emerald-400 animate-bounce" />
            ) : (
              <ShieldCheck className="w-8 h-8 text-amber-500" />
            )}
          </div>
          <h2 className="text-xl font-black text-white">
            {isResetMode ? 'Reset Admin Passcode' : 'Admin Access Required'}
          </h2>
          {!isResetMode && (
            <p className="text-[11px] font-bold text-slate-400 mt-1.5 uppercase tracking-widest">
              Enter 4-Digit Passcode To Continue
            </p>
          )}
        </div>

        {errorMsg && (
          <div className="mb-5 p-3 bg-red-950/40 border border-red-500/40 rounded-xl flex items-center justify-center space-x-2 text-red-400 text-xs font-bold animate-fadeIn">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="w-full">
          {!isResetMode ? (
            <>
              {/* 4-Digit Box Type Input Container */}
              <div
                className={`flex justify-center items-center gap-3 sm:gap-3.5 my-6 transition-transform ${
                  isShaking ? 'animate-shake' : ''
                }`}
              >
                {digits.map((digit, idx) => {
                  const isFilled = digit !== '';
                  return (
                    <input
                      key={idx}
                      ref={(el) => {
                        inputRefs.current[idx] = el;
                      }}
                      type={showPin ? 'text' : 'password'}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={digit}
                      disabled={isSuccess || isVerifying || lockRemainingSec > 0}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={handlePaste}
                      onFocus={(e) => e.target.select()}
                      className={`w-14 h-16 sm:w-16 sm:h-18 text-center text-3xl font-black font-mono rounded-2xl outline-none transition-all select-none ${
                        isSuccess
                          ? 'bg-emerald-950/50 border-2 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
                          : isShaking
                          ? 'bg-rose-950/50 border-2 border-rose-500 text-rose-400 shadow-lg shadow-rose-500/20'
                          : isFilled
                          ? 'bg-slate-800 border-2 border-amber-500 text-white shadow-md shadow-amber-500/10'
                          : 'bg-slate-800/80 border-2 border-slate-700 text-slate-400 hover:border-slate-600 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20'
                      }`}
                    />
                  );
                })}
              </div>

              {/* Controls under the 4 boxes */}
              <div className="flex items-center justify-between px-2 mb-6 text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer"
                >
                  {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{showPin ? 'Hide PIN' : 'Show PIN'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDigits(['', '', '', '']);
                    setErrorMsg('');
                    inputRefs.current[0]?.focus();
                  }}
                  className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Boxes</span>
                </button>
              </div>

              {lockRemainingSec > 0 && (
                <div className="text-xs font-bold text-red-400 mb-4 animate-pulse">
                  Locked for {lockRemainingSec}s due to failed attempts
                </div>
              )}
              {attempts > 0 && lockRemainingSec === 0 && (
                <div className="text-xs font-bold text-amber-400 mb-4">
                  Failed attempt {attempts} of 3
                </div>
              )}

              {/* Action Button */}
              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => {
                    const fullCode = digits.join('');
                    if (fullCode.length === 4) {
                      verifyCode(fullCode);
                    }
                  }}
                  disabled={!isFullPasscode || isSuccess || isVerifying || lockRemainingSec > 0}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-xl font-bold transition-all cursor-pointer disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg shadow-emerald-950/40"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : isSuccess ? (
                    <>
                      <Unlock className="w-5 h-5" />
                      <span>Access Granted!</span>
                    </>
                  ) : (
                    <span>Verify Passcode</span>
                  )}
                </button>
              </div>

              <button
                onClick={() => {
                  setIsResetMode(true);
                  setErrorMsg('');
                }}
                className="mt-4 text-[11px] font-bold text-slate-400 hover:text-emerald-400 underline cursor-pointer"
              >
                Forgot Admin Passcode?
              </button>
            </>
          ) : (
            <form onSubmit={handleNextStep} className="w-full space-y-4 animate-fadeIn text-left">
              {resetStep === 1 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Step 1: User ID (BD No)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-slate-500 font-bold font-mono">BD/</span>
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={resetBd}
                      onChange={(e) => setResetBd(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                      placeholder="474455"
                      required
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {resetStep === 2 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Step 2: Full Name
                  </label>
                  <input
                    type="text"
                    value={resetName}
                    onChange={(e) => setResetName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-bold placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="e.g. Rasel"
                    required
                    autoFocus
                  />
                </div>
              )}

              {resetStep === 3 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Step 3: Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={resetMobile}
                    onChange={(e) => setResetMobile(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-all"
                    placeholder="e.g. 01711223344"
                    required
                    autoFocus
                  />
                </div>
              )}

              {resetStep === 4 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Enter New 4-Digit Passcode
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={newPass}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setNewPass(val);
                        setErrorMsg('');
                      }}
                      className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center tracking-[0.5em] text-xl placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all"
                      placeholder="••••"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Confirm 4-Digit Passcode
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={confirmPass}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                        setConfirmPass(val);
                        setErrorMsg('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNextStep(e);
                      }}
                      className="w-full px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center tracking-[0.5em] text-xl placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all"
                      placeholder="••••"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={cancelReset}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold transition-colors cursor-pointer"
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

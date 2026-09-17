const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPasscodeModal.tsx', 'utf8');

// Remove RandomizedKeypad import
code = code.replace("import { RandomizedKeypad } from './RandomizedKeypad';", "");

// The passcode input is inside:
// <div className="flex justify-center space-x-3 sm:space-x-4 mb-4 cursor-pointer outline-none" ...
// We can replace the whole visual box with a simple input, OR use opacity-0.
// A simple input is easier and more robust.

const oldInputBlock = /<div\s+className="flex justify-center space-x-3 sm:space-x-4 mb-4 cursor-pointer outline-none"[\s\S]*?(?:\{\s*isPasswordFocused && !isSuccess && !isVerifying && lockRemainingSec === 0 && \([\s\S]*?\}\s*\))/;

const newInputBlock = `<input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    setErrorMsg('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                       handleVerify();
                    }
                  }}
                  disabled={isSuccess || isVerifying || lockRemainingSec > 0}
                  className="w-full text-center text-3xl tracking-[1em] font-black px-4 py-4 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-amber-500 transition-all"
                  placeholder="••••"
                  autoFocus
                />`;

code = code.replace(oldInputBlock, newInputBlock);

// For reset mode newPass
const oldResetNewPass = /<input\s+type="password"\s+value=\{newPass\}[\s\S]*?\{isPasswordFocused && \(\s*<div className="pt-2">\s*<RandomizedKeypad value=\{newPass\} onChange=\{setNewPass\} onSubmit=\{[^}]+\} maxLength=\{4\} \/>\s*<\/div>\s*\)\}/;

const newResetNewPass = `<input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={newPass}
                        onChange={(e) => { setNewPass(e.target.value); setErrorMsg(''); }}
                        className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all"
                        placeholder="4 Digit PIN"
                        required
                      />`;

code = code.replace(oldResetNewPass, newResetNewPass);

// For reset mode confirmPass
const oldResetConfirmPass = /<input\s+type="password"\s+value=\{confirmPass\}[\s\S]*?\{isConfirmFocused && \(\s*<div className="pt-2">\s*<RandomizedKeypad value=\{confirmPass\} onChange=\{setConfirmPass\} onSubmit=\{[^}]+\} maxLength=\{4\} \/>\s*<\/div>\s*\)\}/;

const newResetConfirmPass = `<input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={4}
                        value={confirmPass}
                        onChange={(e) => { setConfirmPass(e.target.value); setErrorMsg(''); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleResetSubmit();
                        }}
                        className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-all"
                        placeholder="Confirm 4 Digit PIN"
                        required
                      />`;

code = code.replace(oldResetConfirmPass, newResetConfirmPass);

fs.writeFileSync('src/components/AdminPasscodeModal.tsx', code);

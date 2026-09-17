const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

// Remove RandomizedKeypad import
code = code.replace("import { RandomizedKeypad } from './RandomizedKeypad';", "");

// Password input logic
const oldPassInput = /<input\s+type=\{showPin \? "text" : "password"\}\s+value=\{passwordInput\}\s+readOnly\s+onClick=\{[^}]+\}\s+className="w-full bg-slate-800\/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500\/20 rounded-2xl px-4 py-3.5 pr-12 text-sm font-mono font-bold text-white outline-none transition-all cursor-pointer"\s+placeholder="Tap to open keypad"\s+\/>/;

const newPassInput = `<input
                      type={showPin ? "text" : "password"}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setErrorMsg('');
                      }}
                      className="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 pr-12 text-sm font-mono font-bold text-white outline-none transition-all"
                      placeholder="Enter PIN"
                    />`;

code = code.replace(oldPassInput, newPassInput);

// Remove the RandomizedKeypad block for passwordInput
const oldKeypadBlock1 = /\{isPasswordFocused && \([\s\S]*?<RandomizedKeypad[\s\S]*?maxLength=\{20\}\s*\/>\s*<\/div>\s*\)\}/;
code = code.replace(oldKeypadBlock1, "");


// Reset new pass
const oldResetNewPass = /<input\s+type="password"\s+value=\{newPass\}\s+readOnly\s+onClick=\{[^}]+\}\s+className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"\s+required\s+\/>\s*\{isPasswordFocused && \(\s*<div className="pt-2">\s*<RandomizedKeypad value=\{newPass\} onChange=\{setNewPass\} onSubmit=\{[^}]+\} maxLength=\{20\} \/>\s*<\/div>\s*\)\}/;

const newResetNewPass = `<input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={newPass}
                        onChange={(e) => { setNewPass(e.target.value); setErrorMsg(''); }}
                        className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                        placeholder="Enter New PIN"
                        required
                      />`;

code = code.replace(oldResetNewPass, newResetNewPass);


// Reset confirm pass
const oldResetConfirmPass = /<input\s+type="password"\s+value=\{confirmPass\}\s+readOnly\s+onClick=\{[^}]+\}\s+className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all cursor-pointer"\s+required\s+\/>\s*\{isConfirmFocused && \(\s*<div className="pt-2">\s*<RandomizedKeypad value=\{confirmPass\} onChange=\{setConfirmPass\} onSubmit=\{[^}]+\} maxLength=\{20\} \/>\s*<\/div>\s*\)\}/;

const newResetConfirmPass = `<input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={confirmPass}
                        onChange={(e) => { setConfirmPass(e.target.value); setErrorMsg(''); }}
                        className="w-full px-4 py-3.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 transition-all"
                        placeholder="Confirm New PIN"
                        required
                      />`;
code = code.replace(oldResetConfirmPass, newResetConfirmPass);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);

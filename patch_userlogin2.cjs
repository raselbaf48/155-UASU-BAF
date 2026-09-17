const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

// For reset mode newPass
const oldResetNewPass = `<input
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
                      )}`;

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

// For reset mode confirmPass
const oldResetConfirmPass = `<input
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
                      )}`;

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

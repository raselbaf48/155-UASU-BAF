const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

const oldInput = `<input
                      type={showPin ? "text" : "password"}
                      value={passwordInput}
                      readOnly
                      onClick={() => { setIsPasswordFocused(true); setIsUserIdFocused(false); }}
                      className="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 pr-12 text-sm font-mono font-bold text-white outline-none transition-all cursor-pointer"
                      placeholder="Tap to open keypad"
                    />`;

const newInput = `<input
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
                    
code = code.replace(oldInput, newInput);
fs.writeFileSync('src/components/UserLoginGate.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

const regex = /<input\s+type=\{showPin \? "text" : "password"\}\s+value=\{passwordInput\}\s+readOnly\s+onClick=\{[^}]+\}\s+className="w-full bg-slate-800\/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500\/20 rounded-2xl px-4 py-3.5 pr-12 text-sm font-mono font-bold text-white outline-none transition-all cursor-pointer"\s+placeholder="Tap to open keypad"\s+\/>/;

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
                    
code = code.replace(regex, newPassInput);
fs.writeFileSync('src/components/UserLoginGate.tsx', code);

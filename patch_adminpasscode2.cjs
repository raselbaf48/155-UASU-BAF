const fs = require('fs');
let code = fs.readFileSync('src/components/AdminPasscodeModal.tsx', 'utf8');

const regex = /<div\s+className="flex justify-center space-x-3 sm:space-x-4 mb-4 cursor-pointer outline-none"[\s\S]*?\{isPasswordFocused && !isSuccess && !isVerifying && lockRemainingSec === 0 && \(\s*<div className="pt-2 animate-fadeIn">\s*<RandomizedKeypad value=\{passcode\} onChange=\{setPasscode\} onSubmit=\{handleVerify\} maxLength=\{4\} \/>\s*<\/div>\s*\)\}/;

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
                
code = code.replace(regex, newInputBlock);
fs.writeFileSync('src/components/AdminPasscodeModal.tsx', code);

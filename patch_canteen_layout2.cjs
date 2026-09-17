const fs = require('fs');
const mgrFile = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(mgrFile, 'utf8');

const targetStr = `                <button 
                   onClick={handleLogin}
                   className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 active:scale-[0.98]"
                >
                   ESTABLISH SESSION
                </button>`;

const replaceStr = `                {loginTab === 'member' && (
                    <button 
                       onClick={handleLogin}
                       className="w-full bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 active:scale-[0.98]"
                    >
                       ESTABLISH SESSION
                    </button>
                )}`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync(mgrFile, code);

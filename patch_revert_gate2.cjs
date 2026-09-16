const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

code = code.replace(
    `{activeTab !== 'Canteen' && (
                <div className="text-left space-y-2">`,
    `<div className="text-left space-y-2">`
);

code = code.replace(
    `</div>
                  )}
                </div>)}
                
                <button
                  type="submit"`,
    `</div>
                  )}
                </div>
                
                <button
                  type="submit"`
);

code = code.replace(
    `{activeTab !== 'Canteen' && (<div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsResetMode(true); setErrorMsg(''); }}
                    className="text-xs font-bold text-slate-500 hover:text-emerald-500 transition-colors cursor-pointer underline"
                  >
                    Forgot Login PIN?
                  </button>
                </div>)}`,
    `<div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsResetMode(true); setErrorMsg(''); }}
                    className="text-xs font-bold text-slate-500 hover:text-emerald-500 transition-colors cursor-pointer underline"
                  >
                    Forgot Login PIN?
                  </button>
                </div>`
);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);

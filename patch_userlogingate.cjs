const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

// 1. Add states
if (!code.includes('isCanteenAuth')) {
    code = code.replace(
        "const [activeTab, setActiveTab] = useState<'Office' | 'Nt Count' | 'Canteen'>('Office');",
        "const [activeTab, setActiveTab] = useState<'Office' | 'Nt Count' | 'Canteen'>('Office');\n  const [isCanteenAuth, setIsCanteenAuth] = useState<boolean>(false);"
    );
}

// 2. Change activeTab rendering conditions
code = code.replace(
    "{activeTab === 'Office' && (",
    "{(activeTab === 'Office' || (activeTab === 'Canteen' && !isCanteenAuth)) && ("
);

// 3. Update titles
code = code.replace(
    "<span>{isResetMode ? 'PASSWORD RECOVERY' : 'USER LOGIN PORTAL'}</span>",
    "<span>{isResetMode ? 'PASSWORD RECOVERY' : (activeTab === 'Canteen' ? 'CANTEEN LOGIN PORTAL' : 'USER LOGIN PORTAL')}</span>"
);
code = code.replace(
    "<h1 className=\"text-2xl font-black tracking-tight text-white\">155 UASU BAF</h1>",
    "<h1 className=\"text-2xl font-black tracking-tight text-white\">{activeTab === 'Canteen' ? 'Canteen Management' : '155 UASU BAF'}</h1>"
);

// 4. Update handleSubmit to allow passwordless for Canteen
const submitStart = "const validation = await validateUserLogin(cleanInput, passwordInput, airmen);";
const newSubmitLogic = `
    if (activeTab === 'Canteen') {
      const airman = airmen.find(a => a.bdNo.toLowerCase() === cleanInput.toLowerCase());
      if (airman) {
        setIsLoading(false);
        setIsCanteenAuth(true);
        setSuccessAirman(airman);
        return;
      } else {
        setErrorMsg('User ID not found in Nominal Roll.');
        setIsLoading(false);
        return;
      }
    }

    const validation = await validateUserLogin(cleanInput, passwordInput, airmen);
`;
if (!code.includes("if (activeTab === 'Canteen') {\n      const airman = airmen.find")) {
    code = code.replace(submitStart, newSubmitLogic);
}

// 5. Hide password field and forgot PIN for Canteen
code = code.replace(
    `<div className="text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">PIN</label>`,
    `{activeTab !== 'Canteen' && (<div className="text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">PIN</label>`
);

code = code.replace(
    `</div>
                  )}
                </div>
                
                <button`,
    `</div>
                  )}
                </div>)}
                
                <button`
);

code = code.replace(
    `<div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsResetMode(true); setErrorMsg(''); }}
                    className="text-xs font-bold text-slate-500 hover:text-emerald-500 transition-colors cursor-pointer underline"
                  >
                    Forgot Login PIN?
                  </button>
                </div>`,
    `{activeTab !== 'Canteen' && (<div className="text-center mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsResetMode(true); setErrorMsg(''); }}
                    className="text-xs font-bold text-slate-500 hover:text-emerald-500 transition-colors cursor-pointer underline"
                  >
                    Forgot Login PIN?
                  </button>
                </div>)}`
);

// 6. Pass initialUser to CanteenLayout and handle back correctly
code = code.replace(
    `{activeTab === 'Canteen' && (
          <CanteenLayout onBack={() => setActiveTab('Office')} />
        )}`,
    `{activeTab === 'Canteen' && isCanteenAuth && (
          <CanteenLayout 
             initialMember={successAirman ? { name: successAirman.rank + ' ' + successAirman.name, bdNo: successAirman.bdNo } : undefined}
             onBack={() => { setActiveTab('Office'); setIsCanteenAuth(false); setBdInput(''); setSuccessAirman(null); }} 
          />
        )}`
);

// 7. Fix floating menu toggle condition
code = code.replace(
    "{activeTab === 'Office' && (\n        <div className=\"fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center\">",
    "{(activeTab === 'Office' || (activeTab === 'Canteen' && !isCanteenAuth)) && (\n        <div className=\"fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center\">"
);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

// Revert UserLoginGate changes
code = code.replace(
    "const [activeTab, setActiveTab] = useState<'Office' | 'Nt Count' | 'Canteen'>('Office');\n  const [isCanteenAuth, setIsCanteenAuth] = useState<boolean>(false);",
    "const [activeTab, setActiveTab] = useState<'Office' | 'Nt Count' | 'Canteen'>('Office');"
);

code = code.replace(
    "{(activeTab === 'Office' || (activeTab === 'Canteen' && !isCanteenAuth)) && (",
    "{activeTab === 'Office' && ("
);

code = code.replace(
    "<span>{isResetMode ? 'PASSWORD RECOVERY' : (activeTab === 'Canteen' ? 'CANTEEN LOGIN PORTAL' : 'USER LOGIN PORTAL')}</span>",
    "<span>{isResetMode ? 'PASSWORD RECOVERY' : 'USER LOGIN PORTAL'}</span>"
);

code = code.replace(
    "<h1 className=\"text-2xl font-black tracking-tight text-white\">{activeTab === 'Canteen' ? 'Canteen Management' : '155 UASU BAF'}</h1>",
    "<h1 className=\"text-2xl font-black tracking-tight text-white\">155 UASU BAF</h1>"
);

code = code.replace(
    `if (activeTab === 'Canteen') {
      const airman = airmen.find(a => a.bdNo === cleanInput);
      if (airman) {
        setIsLoading(false);
        setIsCanteenAuth(true);
        setSuccessAirman(null);
        return;
      } else {
        setErrorMsg('User ID not found.');
        setIsLoading(false);
        return;
      }
    }`,
    ""
);

code = code.replace(
    "if (activeTab === 'Canteen') { setIsCanteenAuth(true); setSuccessAirman(null); } else { onAuthenticated(); }",
    "onAuthenticated();"
);
code = code.replace(
    "if (activeTab === 'Canteen') { setIsCanteenAuth(true); setSuccessAirman(null); } else { onAuthenticated(); }",
    "onAuthenticated();"
);

code = code.replace(
    "{activeTab === 'Canteen' && isCanteenAuth && (",
    "{activeTab === 'Canteen' && ("
);

code = code.replace(
    "{(activeTab === 'Office' || (activeTab === 'Canteen' && !isCanteenAuth)) && (",
    "{activeTab === 'Office' && ("
);

code = code.replace(
    `<CanteenLayout onBack={() => { setActiveTab('Office'); setIsCanteenAuth(false); setBdInput(''); setPasswordInput(''); }} />`,
    `<CanteenLayout onBack={() => setActiveTab('Office')} />`
);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);

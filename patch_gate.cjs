const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

// Add isCanteenAuth state
code = code.replace(
    "const [activeTab, setActiveTab] = useState<'Office' | 'Nt Count' | 'Canteen'>('Office');",
    "const [activeTab, setActiveTab] = useState<'Office' | 'Nt Count' | 'Canteen'>('Office');\n  const [isCanteenAuth, setIsCanteenAuth] = useState<boolean>(false);"
);

// Update condition for login form
code = code.replace(
    "{activeTab === 'Office' && (",
    "{(activeTab === 'Office' || (activeTab === 'Canteen' && !isCanteenAuth)) && ("
);

// Update Title logic in login form
code = code.replace(
    "<span>{isResetMode ? 'PASSWORD RECOVERY' : 'USER LOGIN PORTAL'}</span>",
    "<span>{isResetMode ? 'PASSWORD RECOVERY' : (activeTab === 'Canteen' ? 'CANTEEN LOGIN PORTAL' : 'USER LOGIN PORTAL')}</span>"
);
code = code.replace(
    "<h1 className=\"text-2xl font-black tracking-tight text-white\">155 UASU BAF</h1>",
    "<h1 className=\"text-2xl font-black tracking-tight text-white\">{activeTab === 'Canteen' ? 'Canteen Management' : '155 UASU BAF'}</h1>"
);

// Update handleSubmit to check activeTab
code = code.replace(
    "setIsLoading(false);\n      onAuthenticated();",
    "setIsLoading(false);\n      if (activeTab === 'Canteen') { setIsCanteenAuth(true); setSuccessAirman(null); } else { onAuthenticated(); }"
);

// Update reset PIN auto login
code = code.replace(
    "setTimeout(() => {\n        onAuthenticated();\n      }, 800);",
    "setTimeout(() => {\n        if (activeTab === 'Canteen') { setIsCanteenAuth(true); setSuccessAirman(null); } else { onAuthenticated(); }\n      }, 800);"
);

// Update rendering of CanteenLayout
code = code.replace(
    "{activeTab === 'Canteen' && (",
    "{activeTab === 'Canteen' && isCanteenAuth && ("
);

// Update floating menu condition
code = code.replace(
    "{activeTab === 'Office' && (",
    "{(activeTab === 'Office' || (activeTab === 'Canteen' && !isCanteenAuth)) && ("
);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);

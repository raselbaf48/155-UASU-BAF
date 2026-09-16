const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

if (!code.includes('isCanteenManagerMode')) {
    code = code.replace(
        "const [isCanteenAuth, setIsCanteenAuth] = useState<boolean>(false);",
        "const [isCanteenAuth, setIsCanteenAuth] = useState<boolean>(false);\n  const [isCanteenManagerMode, setIsCanteenManagerMode] = useState<boolean>(false);"
    );
}

// Update title to include manager toggle
const oldTitle = `<h1 className="text-2xl font-black tracking-tight text-white">{activeTab === 'Canteen' ? 'Canteen Management' : '155 UASU BAF'}</h1>`;
const newTitle = `<h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center space-x-3">
            <span>{activeTab === 'Canteen' ? 'Canteen Management' : '155 UASU BAF'}</span>
          </h1>
          {activeTab === 'Canteen' && !isCanteenAuth && (
              <div className="flex justify-center mt-3">
                  <div className="bg-slate-800/50 p-1 rounded-xl flex items-center shadow-inner">
                      <button 
                          onClick={() => { setIsCanteenManagerMode(false); setBdInput(''); setPasswordInput(''); setErrorMsg(''); }}
                          className={\`px-4 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-all \${!isCanteenManagerMode ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}\`}
                      >
                          MEMBER
                      </button>
                      <button 
                          onClick={() => { setIsCanteenManagerMode(true); setBdInput(''); setPasswordInput(''); setErrorMsg(''); }}
                          className={\`px-4 py-1.5 rounded-lg text-xs font-bold tracking-widest transition-all \${isCanteenManagerMode ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}\`}
                      >
                          MANAGER
                      </button>
                  </div>
              </div>
          )}`;
code = code.replace(oldTitle, newTitle);


// Handle submit for both Member and Manager
const oldSubmit = `if (activeTab === 'Canteen') {
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
    }`;

const newSubmit = `if (activeTab === 'Canteen') {
      if (isCanteenManagerMode) {
          if (passwordInput === '1234') {
              setIsLoading(false);
              setIsCanteenAuth(true);
              setSuccessAirman({ name: 'System Admin', bdNo: '1234', rank: 'Manager' } as any);
              return;
          } else {
              setErrorMsg('Invalid Manager PIN. Try 1234');
              setIsLoading(false);
              return;
          }
      } else {
          const airman = airmen.find(a => a.bdNo.toLowerCase() === cleanInput.toLowerCase());
          if (airman) {
            setIsLoading(false);
            setIsCanteenAuth(true);
            setSuccessAirman(airman);
            return;
          } else {
            setErrorMsg('Member ID not found.');
            setIsLoading(false);
            return;
          }
      }
    }`;
code = code.replace(oldSubmit, newSubmit);

fs.writeFileSync('src/components/UserLoginGate.tsx', code);

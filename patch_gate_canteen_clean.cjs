const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

// 1. Remove title toggle
const oldTitleBlock = `<h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center space-x-3">
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
const newTitleBlock = `<h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center space-x-3">
            <span>{activeTab === 'Canteen' ? 'Canteen Management' : '155 UASU BAF'}</span>
          </h1>`;
code = code.replace(oldTitleBlock, newTitleBlock);

// 2. Remove submit logic for manager
const oldSubmitBlock = `if (activeTab === 'Canteen') {
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
const newSubmitBlock = `if (activeTab === 'Canteen') {
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
    }`;
code = code.replace(oldSubmitBlock, newSubmitBlock);

// 3. Remove PIN block visibility for Canteen
const pinFieldOld = `{(activeTab !== 'Canteen' || isCanteenManagerMode) && (<div className="text-left space-y-2">`;
const pinFieldNew = `{activeTab !== 'Canteen' && (<div className="text-left space-y-2">`;
code = code.replace(pinFieldOld, pinFieldNew);

// 4. Update the User ID field to NOT use isCanteenManagerMode in its condition
const userFieldOld = `{(activeTab !== 'Canteen' || !isCanteenManagerMode) && (<div className="text-left space-y-2">`;
const userFieldNew = `{true && (<div className="text-left space-y-2">`;
code = code.replace(userFieldOld, userFieldNew);


// 5. Update CanteenLayout usage
const canteenLayoutUsageOld = `<CanteenLayout 
             initialMember={successAirman ? { name: successAirman.name === 'System Admin' ? 'System Admin' : successAirman.rank + ' ' + successAirman.name, bdNo: successAirman.bdNo, role: successAirman.name === 'System Admin' ? 'manager' : 'employee' } : undefined}
             onBack={() => { setActiveTab('Office'); setIsCanteenAuth(false); setBdInput(''); setPasswordInput(''); setSuccessAirman(null); setIsCanteenManagerMode(false); }} 
          />`;
const canteenLayoutUsageNew = `<CanteenLayout 
             initialMember={successAirman ? { name: successAirman.rank + ' ' + successAirman.name, bdNo: successAirman.bdNo, role: 'employee' } : undefined}
             onBack={() => { setIsCanteenAuth(false); setBdInput(''); setPasswordInput(''); setSuccessAirman(null); }} 
          />`;
// Notice onBack: I am only setting Auth to false, which means activeTab stays 'Canteen'. This brings them back to Canteen login portal.
code = code.replace(canteenLayoutUsageOld, canteenLayoutUsageNew);


fs.writeFileSync('src/components/UserLoginGate.tsx', code);

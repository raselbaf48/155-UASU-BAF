const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

const userIdFieldBlockOld = `<div className="text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">{activeTab === 'Canteen' ? 'Member ID' : 'User ID'}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={bdInput}
                      onChange={(e) => {
                        setBdInput(e.target.value);
                        setErrorMsg('');
                        if (targetAirman) setTargetAirman(null);
                      }}
                      onFocus={() => { setIsUserIdFocused(true); setIsPasswordFocused(false); }}
                      onBlur={() => {
                        const cleanInput = bdInput.replace(/^BD\\/?/i, '').trim();
                        if (cleanInput) {
                           const found = airmen.find(a => a.bdNo === cleanInput);
                           setTargetAirman(found || null);
                        }
                      }}
                      className={\`w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-sm font-mono font-bold text-white outline-none transition-all \${activeTab !== 'Canteen' ? 'pr-12' : ''}\`}
                      placeholder="e.g. 474455"
                      autoComplete="username"
                    />
                    
                    {targetAirman && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5 bg-emerald-900/40 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-800/50">
                         <span className="text-[10px] font-bold tracking-wider">{targetAirman.rank}</span>
                      </div>
                    )}
                  </div>
                  {isUserIdFocused && recentLogins.length > 0 && !targetAirman && (
                    <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
                      <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-700">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Logins</span>
                      </div>
                      {recentLogins.map(id => (
                        <div key={id} className="flex items-center justify-between p-2 hover:bg-slate-700 rounded-lg group transition-colors">
                          <button
                            type="button"
                            onClick={() => { 
                               setBdInput(id); 
                               setIsUserIdFocused(false);
                               setIsPasswordFocused(true);
                               const found = airmen.find(a => a.bdNo === id);
                               setTargetAirman(found || null);
                            }}
                            className="flex-1 text-left font-mono text-sm text-slate-300 group-hover:text-white flex items-center space-x-2"
                          >
                             <Lock className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
                             <span>{id}</span>
                          </button>
                          <button type="button" onClick={() => removeRecent(id)} className="p-1 text-slate-500 hover:text-red-400 rounded-full hover:bg-slate-700 transition-colors ml-4">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>`;

const userIdFieldBlockNew = `{(activeTab !== 'Canteen' || !isCanteenManagerMode) && (<div className="text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">{activeTab === 'Canteen' ? 'Member ID' : 'User ID'}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={bdInput}
                      onChange={(e) => {
                        setBdInput(e.target.value);
                        setErrorMsg('');
                        if (targetAirman) setTargetAirman(null);
                      }}
                      onFocus={() => { setIsUserIdFocused(true); setIsPasswordFocused(false); }}
                      onBlur={() => {
                        const cleanInput = bdInput.replace(/^BD\\/?/i, '').trim();
                        if (cleanInput) {
                           const found = airmen.find(a => a.bdNo === cleanInput);
                           setTargetAirman(found || null);
                        }
                      }}
                      className={\`w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 text-sm font-mono font-bold text-white outline-none transition-all \${activeTab !== 'Canteen' ? 'pr-12' : ''}\`}
                      placeholder="e.g. 474455"
                      autoComplete="username"
                    />
                    
                    {targetAirman && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5 bg-emerald-900/40 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-800/50">
                         <span className="text-[10px] font-bold tracking-wider">{targetAirman.rank}</span>
                      </div>
                    )}
                  </div>
                  {isUserIdFocused && recentLogins.length > 0 && !targetAirman && activeTab !== 'Canteen' && (
                    <div className="absolute z-10 w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn">
                      <div className="px-3 py-2 bg-slate-900/50 border-b border-slate-700">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Logins</span>
                      </div>
                      {recentLogins.map(id => (
                        <div key={id} className="flex items-center justify-between p-2 hover:bg-slate-700 rounded-lg group transition-colors">
                          <button
                            type="button"
                            onClick={() => { 
                               setBdInput(id); 
                               setIsUserIdFocused(false);
                               setIsPasswordFocused(true);
                               const found = airmen.find(a => a.bdNo === id);
                               setTargetAirman(found || null);
                            }}
                            className="flex-1 text-left font-mono text-sm text-slate-300 group-hover:text-white flex items-center space-x-2"
                          >
                             <Lock className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
                             <span>{id}</span>
                          </button>
                          <button type="button" onClick={() => removeRecent(id)} className="p-1 text-slate-500 hover:text-red-400 rounded-full hover:bg-slate-700 transition-colors ml-4">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>)}`;
code = code.replace(userIdFieldBlockOld, userIdFieldBlockNew);


const pinFieldBlockOld = `{activeTab !== 'Canteen' && (<div className="text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">PIN</label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      value={passwordInput}
                      readOnly
                      onClick={() => { setIsPasswordFocused(true); setIsUserIdFocused(false); }}
                      className="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 pr-12 text-sm font-mono font-bold text-white outline-none transition-all cursor-pointer"
                      placeholder="Tap to open keypad"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {isPasswordFocused && (
                    <div className="pt-2 animate-fadeIn">
                      <RandomizedKeypad 
                        value={passwordInput} 
                        onChange={(val) => { setPasswordInput(val); setErrorMsg(''); }} 
                        onSubmit={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                        maxLength={20}
                      />                    
                    </div>
                  )}
                </div>)}`;

const pinFieldBlockNew = `{(activeTab !== 'Canteen' || isCanteenManagerMode) && (<div className="text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">{activeTab === 'Canteen' ? 'Manager PIN' : 'PIN'}</label>
                  <div className="relative">
                    <input
                      type={showPin ? "text" : "password"}
                      value={passwordInput}
                      readOnly
                      onClick={() => { setIsPasswordFocused(true); setIsUserIdFocused(false); }}
                      className="w-full bg-slate-800/90 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-2xl px-4 py-3.5 pr-12 text-sm font-mono font-bold text-white outline-none transition-all cursor-pointer"
                      placeholder="Tap to open keypad"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {isPasswordFocused && (
                    <div className="pt-2 animate-fadeIn">
                      <RandomizedKeypad 
                        value={passwordInput} 
                        onChange={(val) => { setPasswordInput(val); setErrorMsg(''); }} 
                        onSubmit={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                        maxLength={20}
                      />                    
                    </div>
                  )}
                </div>)}`;
code = code.replace(pinFieldBlockOld, pinFieldBlockNew);


// Fix CanteenLayout component initialMember passing
const canteenLayoutRenderOld = `<CanteenLayout 
             initialMember={successAirman ? { name: successAirman.rank + ' ' + successAirman.name, bdNo: successAirman.bdNo } : undefined}
             onBack={() => { setActiveTab('Office'); setIsCanteenAuth(false); setBdInput(''); setSuccessAirman(null); }} 
          />`;
const canteenLayoutRenderNew = `<CanteenLayout 
             initialMember={successAirman ? { name: successAirman.name === 'System Admin' ? 'System Admin' : successAirman.rank + ' ' + successAirman.name, bdNo: successAirman.bdNo, role: successAirman.name === 'System Admin' ? 'manager' : 'employee' } : undefined}
             onBack={() => { setActiveTab('Office'); setIsCanteenAuth(false); setBdInput(''); setPasswordInput(''); setSuccessAirman(null); setIsCanteenManagerMode(false); }} 
          />`;
code = code.replace(canteenLayoutRenderOld, canteenLayoutRenderNew);


fs.writeFileSync('src/components/UserLoginGate.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/components/UserLoginGate.tsx', 'utf8');

// The password field wrapper starts with `<div className="text-left space-y-2">\n                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">PIN</label>`
// Let's replace it
const targetStr = `<div className="text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">PIN</label>`;
const replaceStr = `{activeTab !== 'Canteen' && (
                <div className="text-left space-y-2">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">PIN</label>`;

code = code.replace(targetStr, replaceStr);

// We need to close the `)}` after the password field's `</div>` which is right before the `<button type="submit"`
const closeStr = `</div>
                
                <button
                  type="submit"`;
const replaceCloseStr = `</div>
                )}
                
                <button
                  type="submit"`;

code = code.replace(closeStr, replaceCloseStr);

// Fix the incorrect patching I did before `ref={resetPinRef}`
code = code.replace(`{activeTab !== 'Canteen' && (<div className="space-y-2" ref={resetPinRef}>`, `<div className="space-y-2" ref={resetPinRef}>`);
code = code.replace(`{activeTab !== 'Canteen' && (<div className="space-y-2 relative" ref={resetPinRef}>`, `<div className="space-y-2 relative" ref={resetPinRef}>`);
code = code.replace(`</div>
                  )}
                </div>)}`, `</div>
                  )}
                </div>`);
                
// Let's just fix it manually if previous replaces were messy
fs.writeFileSync('src/components/UserLoginGate.tsx', code);

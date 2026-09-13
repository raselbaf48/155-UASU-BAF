const fs = require('fs');
const path = 'src/components/AddEditAirmanModal.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove placeholders
content = content.replace(/placeholder="Airman Full Name"/g, 'placeholder=""');
content = content.replace(/placeholder="e\.g\. Rakib"/g, 'placeholder=""');
content = content.replace(/placeholder="478546"/g, 'placeholder=""');
content = content.replace(/placeholder="01000000000"/g, 'placeholder=""');
content = content.replace(/placeholder="123\/04"/g, 'placeholder=""');
content = content.replace(/placeholder="79\/05"/g, 'placeholder=""');
content = content.replace(/placeholder="Halishahar, Agrabad, Patenga"/g, 'placeholder=""');
content = content.replace(/placeholder="Enter reason\.\.\."/g, 'placeholder=""');

// 2. Compute address
const computeTarget = `      } else {
        if (outsideAddress.trim()) {
          return \`Outside Base: \${outsideAddress.trim()}\`;
        }
        return 'Outside Base';
      }`;
const computeReplace = `      } else {
        if (outsideAddress.trim()) {
          return outsideAddress.trim();
        }
        return '';
      }`;
content = content.replace(computeTarget, computeReplace);

// 3. Validation
const bdValidationTarget = `if (!bdNo.trim() || bdNo.trim() === 'BD/' || bdNo.trim() === 'BD') return setValidationError('Please enter a valid BD Number');`;
const bdValidationReplace = `    const rawBd = bdNo.trim().replace(/^BD\\/?/i, '').replace(/\\s+/g, '');
    if (!/^[4]\\d{5}$/.test(rawBd)) return setValidationError('BD Number must be exactly 6 digits and start with 4');`;
content = content.replace(bdValidationTarget, bdValidationReplace);

const mobileValidationTarget = `if (!mobileNo.trim() || mobileNo.trim() === '01') return setValidationError('Please enter a valid Mobile Number');`;
const mobileValidationReplace = `    const rawMobile = mobileNo.trim().replace(/\\s+/g, '');
    if (!/^\\d{11}$/.test(rawMobile)) return setValidationError('Mobile Number must be exactly 11 digits');`;
content = content.replace(mobileValidationTarget, mobileValidationReplace);

// 4. L_IN UI
const lInUiTarget = `                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Mess: <strong className="text-slate-800 dark:text-slate-200">{isSgtOrAbove(rank) ? "Sgt's Mess" : "Airmen's Mess"}</strong> (Automatic by Rank)
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Block No <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={blockNo}
                    onChange={(e) => {
                      setBlockNo(e.target.value);
                      if (validationError) setValidationError('');
                    }}
                    placeholder=""
                    className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>`;
const lInUiReplace = `                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    {isSgtOrAbove(rank) ? "Sgt's Mess" : "Airmen's Mess"} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-2 whitespace-nowrap">Block No:</span>
                    <input
                      type="text"
                      required
                      value={blockNo}
                      onChange={(e) => {
                        setBlockNo(e.target.value);
                        if (validationError) setValidationError('');
                      }}
                      placeholder=""
                      className="flex-1 bg-transparent text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden"
                    />
                  </div>
                </div>`;
content = content.replace(lInUiTarget, lInUiReplace);

// 5. L_OUT Labels
content = content.replace(/Quarter Number <span/g, 'Quarter No: <span');

// 6. Special Remarks block deletion
const remarksTargetRegex = /\{\/\*\s*Remarks\s*\*\/\}.*?<\/div>/s;
content = content.replace(remarksTargetRegex, '');

fs.writeFileSync(path, content);

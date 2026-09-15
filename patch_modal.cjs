const fs = require('fs');

const file = 'src/components/NightCountStateView.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add disposalSubCategory state
content = content.replace(
  "const [disposalCustomTitle, setDisposalCustomTitle] = useState<string>('');",
  "const [disposalCustomTitle, setDisposalCustomTitle] = useState<string>('');\n  const [disposalSubCategory, setDisposalSubCategory] = useState<string>('');"
);

// 2. Insert SUB_CATEGORIES_MAP and getSelectedDisposalLabel before handleAddDisposalSubmit
const helperCode = `
  const SUB_CATEGORIES_MAP: Record<string, string[]> = {
    'GD/TF/Airfield Duty': ['GD', 'TF', 'Airfield Duty'],
    'ED/ EX PPGF': ['ED', 'EX PPGF'],
    'CMH/ BNS/ BSH/Qnt': ['CMH', 'BNS', 'BSH', 'Qnt'],
    'U/C, U/ Board': ['U/C', 'U/ Board'],
    'Aft/ Ni flg/ Ni Duty': ['Aft', 'Ni flg', 'Ni Duty'],
    'Mess/ Canteen / Bakery': ['Mess', 'Canteen', 'Bakery'],
    'Games / Guard of Honor': ['Games', 'Guard of Honor']
  };

  const getSelectedDisposalLabel = () => {
    if (!disposalCategory) return '';
    if (disposalCategory.startsWith('OTHERS_')) {
      const title = disposalCategory.replace('OTHERS_', '');
      const found = ALL_DISPOSAL_OPTIONS.find(o => o.customTitle === title) || historicalCustomCats.find(o => o.customTitle === title);
      return found ? found.label : title;
    }
    const found = ALL_DISPOSAL_OPTIONS.find(o => o.code === disposalCategory);
    return found ? found.label : '';
  };
  
  const currentSubCategories = SUB_CATEGORIES_MAP[getSelectedDisposalLabel()] || [];

  // Handle Add Disposal submit (multi-person support)
`;

content = content.replace("// Handle Add Disposal submit (multi-person support)", helperCode);

// 3. Fix handleAddDisposalSubmit
const submitFind = `    try {
      const isCustom = disposalCategory === 'OTHERS';
      const effectiveDutyCode = isCustom ? 'OTHERS' : disposalCategory;
      const effectiveNotes = isCustom ? (disposalCustomTitle.trim() || 'Custom Disposal') : undefined;
      if (isCustom && effectiveNotes && effectiveNotes !== 'Custom Disposal') {`;

const submitReplace = `    try {
      const isCustom = disposalCategory === 'OTHERS' || disposalCategory.startsWith('OTHERS_');
      const effectiveDutyCode = isCustom ? 'OTHERS' : disposalCategory;
      let effectiveNotes = undefined;
      
      if (currentSubCategories.length > 0 && disposalSubCategory) {
        effectiveNotes = disposalSubCategory;
      } else if (isCustom) {
        if (disposalCategory.startsWith('OTHERS_') && disposalCategory !== 'OTHERS_Custom') {
           effectiveNotes = disposalCategory.replace('OTHERS_', '');
        } else {
           effectiveNotes = disposalCustomTitle.trim() || 'Custom Disposal';
        }
      }

      if (isCustom && effectiveNotes && effectiveNotes !== 'Custom Disposal') {`;

content = content.replace(submitFind, submitReplace);

// 4. Update the `<select>` for category to reset subcategory
const selectFind = `onChange={(e) => {
                        setDisposalCategory(e.target.value);
                        if (e.target.value !== 'OTHERS') {`;
const selectReplace = `onChange={(e) => {
                        setDisposalCategory(e.target.value);
                        setDisposalSubCategory('');
                        if (e.target.value !== 'OTHERS') {`;
content = content.replace(selectFind, selectReplace);

// 5. Inject the Sub Category dropdown right before the Custom Title input
const subCatUI = `
                {/* Sub Category Dropdown */}
                {currentSubCategories.length > 0 && (
                  <div className="col-span-2 mt-2">
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">
                      Sub Category <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={disposalSubCategory}
                      onChange={(e) => setDisposalSubCategory(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="" disabled>Select Sub Category...</option>
                      {currentSubCategories.map(sub => (
                         <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                )}
`;

const customTitleFind = `{/* Custom Title Input if OTHERS selected */}`;
content = content.replace(customTitleFind, subCatUI + '\n                ' + customTitleFind);

fs.writeFileSync(file, content);

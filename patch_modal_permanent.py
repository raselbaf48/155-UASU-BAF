with open('src/components/AddEditAirmanModal.tsx', 'r') as f:
    content = f.read()

# 1. State
state_search = "  const [bloodGroup, setBloodGroup] = useState(airmanToEdit?.bloodGroup || '');"
state_replace = "  const [bloodGroup, setBloodGroup] = useState(airmanToEdit?.bloodGroup || '');\n  const [permanentAddress, setPermanentAddress] = useState(airmanToEdit?.permanentAddress || '');"
content = content.replace(state_search, state_replace)

# 2. Save
save_search = "      bloodGroup: bloodGroup.trim(),"
save_replace = "      bloodGroup: bloodGroup.trim(),\n      permanentAddress: permanentAddress.trim(),"
content = content.replace(save_search, save_replace)

# 3. UI
ui_search = "          {/* Address Configuration (L/In vs L/Out) */}"
ui_replace = """          {/* Permanent Address */}
          {variant === 'biodata' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Permanent Address <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={permanentAddress}
                onChange={(e) => setPermanentAddress(e.target.value)}
                placeholder="Village, Post Office, Police Station, District"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
              />
            </div>
          )}

          {/* Address Configuration (L/In vs L/Out) */}"""
content = content.replace(ui_search, ui_replace)

with open('src/components/AddEditAirmanModal.tsx', 'w') as f:
    f.write(content)


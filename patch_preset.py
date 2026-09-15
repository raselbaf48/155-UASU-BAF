with open('src/components/AddEditAirmanModal.tsx', 'r') as f:
    content = f.read()

# 1. Add states
state_search = """  const [bloodGroup, setBloodGroup] = useState(airmanToEdit?.bloodGroup || '');
  const [permanentAddress, setPermanentAddress] = useState(airmanToEdit?.permanentAddress || '');"""
state_replace = """  const [bloodGroup, setBloodGroup] = useState(airmanToEdit?.bloodGroup || '');
  const [permanentAddress, setPermanentAddress] = useState(airmanToEdit?.permanentAddress || '');

  const [isAddressPreset, setIsAddressPreset] = useState(() => {
    const addr = airmanToEdit?.permanentAddress || '';
    return addr.includes('Vill:') && addr.includes('P/O:') && addr.includes('P/S:') && addr.includes('Dist:');
  });
  const [addrVill, setAddrVill] = useState(() => {
    const addr = airmanToEdit?.permanentAddress || '';
    const match = addr.match(/Vill:\s*(.*?)\s*;/);
    return match ? match[1] : '';
  });
  const [addrPO, setAddrPO] = useState(() => {
    const addr = airmanToEdit?.permanentAddress || '';
    const match = addr.match(/P\/O:\s*(.*?)\s*;/);
    return match ? match[1] : '';
  });
  const [addrPS, setAddrPS] = useState(() => {
    const addr = airmanToEdit?.permanentAddress || '';
    const match = addr.match(/P\/S:\s*(.*?)\s*;/);
    return match ? match[1] : '';
  });
  const [addrDist, setAddrDist] = useState(() => {
    const addr = airmanToEdit?.permanentAddress || '';
    const match = addr.match(/Dist:\s*(.*?)$/);
    return match ? match[1] : '';
  });"""
content = content.replace(state_search, state_replace)


# 2. Add computation logic in Save
save_search = """      bloodGroup: bloodGroup || '',
      permanentAddress: permanentAddress.trim() || '',
      remarks: remarks.trim(),"""
save_replace = """      bloodGroup: bloodGroup || '',
      permanentAddress: isAddressPreset ? `Vill: ${addrVill.trim()}; P/O: ${addrPO.trim()}; P/S: ${addrPS.trim()}; Dist: ${addrDist.trim()}` : permanentAddress.trim(),
      remarks: remarks.trim(),"""
content = content.replace(save_search, save_replace)


# 3. Add UI logic
ui_search = """          {/* Permanent Address */}
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
          )}"""

ui_replace = """          {/* Permanent Address */}
          {variant === 'biodata' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Permanent Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAddressPreset}
                    onChange={(e) => setIsAddressPreset(e.target.checked)}
                    className="w-3.5 h-3.5 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-600 dark:border-slate-600 dark:bg-slate-700"
                  />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Preset (Vill, P/O, P/S, Dist)</span>
                </label>
              </div>
              
              {isAddressPreset ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Vill</label>
                    <input
                      type="text"
                      value={addrVill}
                      onChange={(e) => setAddrVill(e.target.value)}
                      placeholder="Village Name"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Post Office</label>
                    <input
                      type="text"
                      value={addrPO}
                      onChange={(e) => setAddrPO(e.target.value)}
                      placeholder="Post Office"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">Police Station</label>
                    <input
                      type="text"
                      value={addrPS}
                      onChange={(e) => setAddrPS(e.target.value)}
                      placeholder="Police Station"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">District</label>
                    <input
                      type="text"
                      value={addrDist}
                      onChange={(e) => setAddrDist(e.target.value)}
                      placeholder="District Name"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <textarea
                  value={permanentAddress}
                  onChange={(e) => setPermanentAddress(e.target.value)}
                  placeholder="Village, Post Office, Police Station, District"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                />
              )}
            </div>
          )}"""
content = content.replace(ui_search, ui_replace)

with open('src/components/AddEditAirmanModal.tsx', 'w') as f:
    f.write(content)

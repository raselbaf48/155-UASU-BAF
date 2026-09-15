with open('src/components/NominalRoll.tsx', 'r') as f:
    content = f.read()

# 1. matchesStatus calculation
matchesStatus_search = """  const filteredAirmen = sortedAirmen.filter((airman) => {
    let matchesStatus = true;
    if (statusFilter === 'Active') {
      matchesStatus = airman.active !== false;
    } else if (statusFilter === 'Previous Airmen') {
      matchesStatus = airman.active === false;
    }"""
matchesStatus_replace = """  const filteredAirmen = sortedAirmen.filter((airman) => {
    let matchesStatus = true;
    if (variant === 'nominal') {
      matchesStatus = airman.active !== false;
    } else if (statusFilter === 'Active') {
      matchesStatus = airman.active !== false;
    } else if (statusFilter === 'Previous Airmen') {
      matchesStatus = airman.active === false;
    }"""
content = content.replace(matchesStatus_search, matchesStatus_replace)


# 2. Add Airman button
addAirman_search = """          {(role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? (
            <button
              onClick={onAddAirman}"""
addAirman_replace = """          {variant === 'biodata' && (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'OWNER') ? (
            <button
              onClick={onAddAirman}"""
content = content.replace(addAirman_search, addAirman_replace)

readOnly_search = """          ) : (
            <div className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-bold">
              <Eye className="w-3.5 h-3.5" />
              <span>Read-Only Directory</span>
            </div>
          )}"""
readOnly_replace = """          ) : variant === 'biodata' ? (
            <div className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-bold">
              <Eye className="w-3.5 h-3.5" />
              <span>Read-Only Directory</span>
            </div>
          ) : null}"""
content = content.replace(readOnly_search, readOnly_replace)

# 3. Status filter
statusFilter_search = """          {/* Status Filter */}
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">"""
statusFilter_replace = """          {/* Status Filter */}
          {variant === 'biodata' && (
          <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs">"""

statusFilter_end_search = """              <option value="Previous Airmen">Previous Airmen</option>
            </select>
          </div>
        </div>"""
statusFilter_end_replace = """              <option value="Previous Airmen">Previous Airmen</option>
            </select>
          </div>
          )}
        </div>"""
content = content.replace(statusFilter_search, statusFilter_replace)
content = content.replace(statusFilter_end_search, statusFilter_end_replace)

# 4. Status Column Header
statusTh_search = """                {variant === 'biodata' && <th className="py-3 px-4">Dt of Posting</th>}
                <th className="py-3 px-4 text-center">Status</th>
              </tr>"""
statusTh_replace = """                {variant === 'biodata' && <th className="py-3 px-4">Dt of Posting</th>}
                {variant === 'biodata' && <th className="py-3 px-4 text-center">Status</th>}
              </tr>"""
content = content.replace(statusTh_search, statusTh_replace)

# 5. Status Column Body
statusTd_search = """                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${airman.active !== false ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'}`}>
                      {airman.active !== false ? 'Active' : (airman.leaveReason || 'Inactive')}
                    </span>
                  </td>
                </tr>"""
statusTd_replace = """                  {variant === 'biodata' && (
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${airman.active !== false ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'}`}>
                      {airman.active !== false ? 'Active' : (airman.leaveReason || 'Inactive')}
                    </span>
                  </td>
                  )}
                </tr>"""
content = content.replace(statusTd_search, statusTd_replace)


with open('src/components/NominalRoll.tsx', 'w') as f:
    f.write(content)


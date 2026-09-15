with open('src/components/NominalRoll.tsx', 'r') as f:
    content = f.read()

thead_search = '''                {variant === 'biodata' && <th className="py-3 px-4">Blood Group</th>}
                <th className="py-3 px-4">{variant === 'biodata' ? 'Present Address' : 'Address'}</th>'''
thead_replace = '''                {variant === 'biodata' && <th className="py-3 px-4">Blood Group</th>}
                <th className="py-3 px-4">{variant === 'biodata' ? 'Present Address' : 'Address'}</th>
                {variant === 'biodata' && <th className="py-3 px-4">Permanent Address</th>}'''
content = content.replace(thead_search, thead_replace)

tbody_search = '''                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]" title={airman.addressBlock}>
                        {airman.addressBlock || '-'}
                      </span>
                    </div>
                  </td>'''
tbody_replace = '''                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]" title={airman.addressBlock}>
                        {airman.addressBlock || '-'}
                      </span>
                    </div>
                  </td>
                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                      <span className="truncate max-w-[150px] block" title={airman.permanentAddress}>
                        {airman.permanentAddress || '-'}
                      </span>
                    </td>
                  )}'''
content = content.replace(tbody_search, tbody_replace)

with open('src/components/NominalRoll.tsx', 'w') as f:
    f.write(content)


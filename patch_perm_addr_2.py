with open('src/components/NominalRoll.tsx', 'r') as f:
    content = f.read()

hdr_search = """                {variant === 'biodata' && <th className="py-3 px-4">Permanent Address</th>}"""
hdr_replace = """                {variant === 'biodata' && <th className="py-3 px-4 text-center">Permanent Address</th>}"""
content = content.replace(hdr_search, hdr_replace)

addr_search = """                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <div className="text-left leading-tight text-[11px] whitespace-normal min-w-[150px]" title={airman.permanentAddress}>
                        {airman.permanentAddress ? (
                          airman.permanentAddress.includes(';') ? (
                            airman.permanentAddress.split(';').map((part, i) => (
                              <span key={i} className="block">{part.trim()}</span>
                            ))
                          ) : (
                            <span className="block">{airman.permanentAddress}</span>
                          )
                        ) : '-'}
                      </div>
                    </td>
                  )}"""

addr_replace = """                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                      <div className="text-center leading-tight text-[11px] whitespace-normal min-w-[150px]" title={airman.permanentAddress}>
                        {airman.permanentAddress ? (
                          airman.permanentAddress.includes(';') ? (
                            (() => {
                              const parts = airman.permanentAddress.split(';').map(x => x.trim()).filter(Boolean);
                              const rows = [];
                              for (let i = 0; i < parts.length; i += 2) {
                                rows.push(parts.slice(i, i + 2).join('; '));
                              }
                              return rows.map((r, i) => <span key={i} className="block">{r}</span>);
                            })()
                          ) : (
                            <span className="block">{airman.permanentAddress}</span>
                          )
                        ) : '-'}
                      </div>
                    </td>
                  )}"""

content = content.replace(addr_search, addr_replace)

with open('src/components/NominalRoll.tsx', 'w') as f:
    f.write(content)

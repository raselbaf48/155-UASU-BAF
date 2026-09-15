with open('src/components/NominalRoll.tsx', 'r') as f:
    content = f.read()

addr_search = """                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                      <span className="truncate max-w-[150px] block" title={airman.permanentAddress}>
                        {airman.permanentAddress || '-'}
                      </span>
                    </td>
                  )}"""

addr_replace = """                  {variant === 'biodata' && (
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

content = content.replace(addr_search, addr_replace)

with open('src/components/NominalRoll.tsx', 'w') as f:
    f.write(content)

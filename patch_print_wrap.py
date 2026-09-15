with open('src/components/PrintableNominalRollModal.tsx', 'r') as f:
    content = f.read()

addr_old = """                      <td className="p-1.5 border border-black text-left">
                        {airman.addressBlock || '-'}
                      </td>
                      {variant === 'biodata' && (
                        <td className="p-1.5 border border-black text-left">
                          {airman.permanentAddress || '-'}
                        </td>
                      )}"""

addr_new = """                      <td className="p-1.5 border border-black text-left">
                        <div className="leading-tight whitespace-normal min-w-[100px]">
                          {airman.addressBlock || '-'}
                        </div>
                      </td>
                      {variant === 'biodata' && (
                        <td className="p-1.5 border border-black text-center">
                          <div className="leading-tight whitespace-normal min-w-[120px]">
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
content = content.replace(addr_old, addr_new)

with open('src/components/PrintableNominalRollModal.tsx', 'w') as f:
    f.write(content)

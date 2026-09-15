with open('src/components/PrintableNominalRollModal.tsx', 'r') as f:
    content = f.read()

addr_old = """                      <td className="p-1.5 border border-black text-left">
                        <div className="leading-tight whitespace-normal min-w-[100px]">
                          {airman.addressBlock || '-'}
                        </div>
                      </td>"""

addr_new = """                      <td className="p-1.5 border border-black text-left">
                        <div className="leading-tight whitespace-normal min-w-[100px]">
                          {airman.addressBlock ? (
                            airman.addressBlock.includes("Mess, Block No:") ? (
                              <>
                                <span className="block">{airman.addressBlock.split(", Block No:")[0]},</span>
                                <span className="block text-[10px] text-slate-500 font-bold">Block No:{airman.addressBlock.split(", Block No:")[1]}</span>
                              </>
                            ) : (
                              <span className="block">{airman.addressBlock}</span>
                            )
                          ) : '-'}
                        </div>
                      </td>"""

content = content.replace(addr_old, addr_new)

with open('src/components/PrintableNominalRollModal.tsx', 'w') as f:
    f.write(content)

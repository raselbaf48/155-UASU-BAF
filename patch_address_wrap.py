with open('src/components/NominalRoll.tsx', 'r') as f:
    content = f.read()

# We need to render the addressBlock with wrapping for Mess addresses
# Currently it is: <span className="truncate max-w-[150px]" title={airman.addressBlock}>{airman.addressBlock || '-'}</span>

import re

# We will create a helper function or inline the logic to split the address
# Since we are modifying React JSX, inline ternary or split logic works well.

# Let's replace the whole td for the address block
address_search = '''                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]" title={airman.addressBlock}>{airman.addressBlock || '-'}</span>
                    </div>
                  </td>'''

address_replace = '''                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    <div className="flex items-start space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                      <div className="text-left leading-tight" title={airman.addressBlock}>
                        {airman.addressBlock ? (
                          airman.addressBlock.includes("Mess, Block No:") ? (
                            <>
                              <span className="block">{airman.addressBlock.split(", Block No:")[0]},</span>
                              <span className="block text-[10px] text-slate-500 font-bold">Block No:{airman.addressBlock.split(", Block No:")[1]}</span>
                            </>
                          ) : (
                            <span className="block whitespace-normal min-w-[120px]">{airman.addressBlock}</span>
                          )
                        ) : '-'}
                      </div>
                    </div>
                  </td>'''

content = content.replace(address_search, address_replace)

with open('src/components/NominalRoll.tsx', 'w') as f:
    f.write(content)


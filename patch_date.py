with open('src/components/NominalRoll.tsx', 'r') as f:
    content = f.read()

date_search = """                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                      {airman.dateJoined ? new Date(airman.dateJoined).toLocaleDateString('en-GB') : '-'}
                    </td>
                  )}"""

date_replace = """                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium text-center">
                      {airman.dateJoined ? new Date(airman.dateJoined).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '-'}
                    </td>
                  )}"""

content = content.replace(date_search, date_replace)

with open('src/components/NominalRoll.tsx', 'w') as f:
    f.write(content)

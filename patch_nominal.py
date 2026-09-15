import re

with open('src/components/NominalRoll.tsx', 'r') as f:
    content = f.read()

# Interface changes
intf_search = '''interface NominalRollProps {
  airmen: Airman[];
  role: UserRole;
  userFlight?: string;'''
intf_replace = '''interface NominalRollProps {
  variant?: 'nominal' | 'biodata';
  airmen: Airman[];
  role: UserRole;
  userFlight?: string;'''
content = content.replace(intf_search, intf_replace)

prop_search = '''  onDeleteAirman,
  onViewProfile,
}: NominalRollProps) => {'''
prop_replace = '''  variant = 'nominal',
  onDeleteAirman,
  onViewProfile,
}: NominalRollProps) => {'''
content = content.replace(prop_search, prop_replace)

title_search = '''            <span>Nominal Roll Directory</span>'''
title_replace = '''            <span>{variant === 'biodata' ? 'Biodata Register Directory' : 'Nominal Roll Directory'}</span>'''
content = content.replace(title_search, title_replace)

add_search = '''            <span className="hidden sm:inline">Add Airman</span>'''
add_replace = '''            <span className="hidden sm:inline">{variant === 'biodata' ? 'Add Airman' : 'Add Airman'}</span>'''
content = content.replace(add_search, add_replace)

thead_search = '''              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4 w-12 text-center">Ser</th>
                <th className="py-3 px-4">BD No</th>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Trade</th>
                <th className="py-3 px-4">Flight</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>'''

thead_replace = '''              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-4 w-12 text-center">Ser</th>
                <th className="py-3 px-4">BD No</th>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Full Name</th>
                <th className="py-3 px-4">Trade</th>
                <th className="py-3 px-4">Flight</th>
                {variant === 'biodata' && <th className="py-3 px-4">Blood Group</th>}
                <th className="py-3 px-4">{variant === 'biodata' ? 'Present Address' : 'Address'}</th>
                <th className="py-3 px-4">Contact</th>
                {variant === 'biodata' && <th className="py-3 px-4">Dt of Posting</th>}
                <th className="py-3 px-4 text-center">Status</th>
              </tr>'''
content = content.replace(thead_search, thead_replace)

# Now we need to update the tbody. We need to find the exact structure
tbody_search = '''                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {airman.flightName}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]" title={airman.addressBlock}>
                        {airman.addressBlock || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {airman.mobileNo || '-'}
                  </td>
                  <td className="py-3 px-4 text-center">'''

tbody_replace = '''                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {airman.flightName}
                    </span>
                  </td>
                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                      {airman.bloodGroup || '-'}
                    </td>
                  )}
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]" title={airman.addressBlock}>
                        {airman.addressBlock || '-'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                    {airman.mobileNo || '-'}
                  </td>
                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {airman.dateJoined ? new Date(airman.dateJoined).toLocaleDateString('en-GB') : '-'}
                    </td>
                  )}
                  <td className="py-3 px-4 text-center">'''

content = content.replace(tbody_search, tbody_replace)

with open('src/components/NominalRoll.tsx', 'w') as f:
    f.write(content)


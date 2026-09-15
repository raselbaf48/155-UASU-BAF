with open('src/components/NominalRoll.tsx', 'r') as f:
    content = f.read()

# Blood Group injection (after Flight)
flight_search = '''                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {airman.flightName}
                    </span>
                  </td>'''
flight_replace = '''                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      {airman.flightName}
                    </span>
                  </td>
                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                      {airman.bloodGroup || '-'}
                    </td>
                  )}'''
content = content.replace(flight_search, flight_replace)

# Permanent Address injection (after AddressBlock)
address_search = '''                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{airman.addressBlock}</span>
                    </div>
                  </td>'''
address_replace = '''                  <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                    <div className="flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[150px]" title={airman.addressBlock}>{airman.addressBlock || '-'}</span>
                    </div>
                  </td>
                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 font-medium">
                      <span className="truncate max-w-[150px] block" title={airman.permanentAddress}>
                        {airman.permanentAddress || '-'}
                      </span>
                    </td>
                  )}'''
content = content.replace(address_search, address_replace)

# Dt of Posting injection (after MobileNo) - we need to search for MobileNo's closing td
mobile_search = '''                          </svg>
                        </a>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">'''
mobile_replace = '''                          </svg>
                        </a>
                      </div>
                    )}
                  </td>
                  {variant === 'biodata' && (
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap font-medium">
                      {airman.dateJoined ? new Date(airman.dateJoined).toLocaleDateString('en-GB') : '-'}
                    </td>
                  )}
                  <td className="py-3 px-4 text-center">'''
content = content.replace(mobile_search, mobile_replace)

with open('src/components/NominalRoll.tsx', 'w') as f:
    f.write(content)


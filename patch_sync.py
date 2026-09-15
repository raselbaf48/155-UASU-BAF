with open('src/services/localDatabase.ts', 'r') as f:
    content = f.read()

# Pull mapping update
pull_search = '''          flightName: s['Flight'] || '',
          trade: s['Trade'] || '',
          mobileNo: s['Mobile No'] || '',
          addressBlock: s['Address'] || 'L/O','''
pull_replace = '''          flightName: s['Flight'] || '',
          trade: s['Trade'] || '',
          mobileNo: s['Mobile No'] || '',
          bloodGroup: s['Blood Group'] || '',
          permanentAddress: s['Parmanet Address'] || s['Permanent Address'] || '',
          dateJoined: s['Dt of Posting'] || undefined,
          addressBlock: s['Address'] || 'L/O','''
content = content.replace(pull_search, pull_replace)

# Push mapping update
push_search = '''            'Mobile No': a.mobileNo || null,
            'Address': a.addressBlock || null,
            'Status': a.active === false ? 'SUSPENDED' : 'ACTIVE','''
push_replace = '''            'Mobile No': a.mobileNo || null,
            'Blood Group': a.bloodGroup || null,
            'Parmanet Address': a.permanentAddress || null,
            'Dt of Posting': a.dateJoined || null,
            'Address': a.addressBlock || null,
            'Status': a.active === false ? 'SUSPENDED' : 'ACTIVE','''
content = content.replace(push_search, push_replace)

with open('src/services/localDatabase.ts', 'w') as f:
    f.write(content)


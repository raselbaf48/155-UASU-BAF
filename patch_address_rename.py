with open('src/services/localDatabase.ts', 'r') as f:
    content = f.read()

pull_search = "addressBlock: s['Address'] || 'L/O',"
pull_replace = "addressBlock: s['Present Address'] || s['Address'] || 'L/O',"
content = content.replace(pull_search, pull_replace)

push_search = "'Address': a.addressBlock || null,"
push_replace = "'Present Address': a.addressBlock || null,"
content = content.replace(push_search, push_replace)

with open('src/services/localDatabase.ts', 'w') as f:
    f.write(content)

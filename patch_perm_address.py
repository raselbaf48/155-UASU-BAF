with open('src/services/localDatabase.ts', 'r') as f:
    content = f.read()

# Replace the push payload key
push_search = "'Parmanet Address': a.permanentAddress || null,"
push_replace = "'Permanent Address': a.permanentAddress || null,"
content = content.replace(push_search, push_replace)

with open('src/services/localDatabase.ts', 'w') as f:
    f.write(content)

with open('src/components/NominalRoll.tsx', 'r') as f:
    content = f.read()

hdr_search = """                {variant === 'biodata' && <th className="py-3 px-4">Dt of Posting</th>}"""
hdr_replace = """                {variant === 'biodata' && <th className="py-3 px-4 text-center">Dt of Posting</th>}"""
content = content.replace(hdr_search, hdr_replace)

with open('src/components/NominalRoll.tsx', 'w') as f:
    f.write(content)

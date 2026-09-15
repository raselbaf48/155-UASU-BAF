with open('src/components/AddEditAirmanModal.tsx', 'r') as f:
    content = f.read()

save_search = """      bloodGroup: bloodGroup || undefined,
      permanentAddress: permanentAddress.trim() || undefined,
      remarks: remarks.trim(),
      dateJoined: dateJoined || undefined,"""
save_replace = """      bloodGroup: bloodGroup || '',
      permanentAddress: permanentAddress.trim() || '',
      remarks: remarks.trim(),
      dateJoined: dateJoined || undefined,"""
content = content.replace(save_search, save_replace)

with open('src/components/AddEditAirmanModal.tsx', 'w') as f:
    f.write(content)

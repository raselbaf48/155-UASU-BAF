with open('src/components/AddEditAirmanModal.tsx', 'r') as f:
    content = f.read()

save_search = """      flightName,
      addressBlock: finalAddress,
      mobileNo: mobileNo.trim() || '01',
      remarks: remarks.trim(),
      dateJoined: dateJoined || undefined,"""
save_replace = """      flightName,
      addressBlock: finalAddress,
      mobileNo: mobileNo.trim() || '01',
      bloodGroup: bloodGroup || undefined,
      permanentAddress: permanentAddress.trim() || undefined,
      remarks: remarks.trim(),
      dateJoined: dateJoined || undefined,"""
content = content.replace(save_search, save_replace)

with open('src/components/AddEditAirmanModal.tsx', 'w') as f:
    f.write(content)

import re

file_path = "src/components/AddEditAirmanModal.tsx"
with open(file_path, "r") as f:
    content = f.read()

content = content.replace("dateJoined: dateJoined || undefined,", "dateJoined: dateJoined || '',")
content = content.replace("dateLeft: dateLeft || undefined,", "dateLeft: dateLeft || '',")
content = content.replace("jcoSeniorityOrder: ['MWO', 'SWO', 'WO'].includes(rank) ? (jcoSeniorityOrder ? Number(jcoSeniorityOrder) : 9999) : undefined,", "jcoSeniorityOrder: ['MWO', 'SWO', 'WO'].includes(rank) ? (jcoSeniorityOrder ? Number(jcoSeniorityOrder) : 9999) : null,")
content = content.replace("leaveReason: finalLeaveReason,", "leaveReason: finalLeaveReason || '',")

with open(file_path, "w") as f:
    f.write(content)

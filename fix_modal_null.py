import re

file_path = "src/components/AddEditAirmanModal.tsx"
with open(file_path, "r") as f:
    content = f.read()

# Instead of passing null, just set it to 9999 when not provided or not applicable, because 9999 means "no explicit order"
content = content.replace("jcoSeniorityOrder: ['MWO', 'SWO', 'WO'].includes(rank) ? (jcoSeniorityOrder ? Number(jcoSeniorityOrder) : 9999) : null,", "jcoSeniorityOrder: ['MWO', 'SWO', 'WO'].includes(rank) ? (jcoSeniorityOrder ? Number(jcoSeniorityOrder) : 9999) : 9999,")

with open(file_path, "w") as f:
    f.write(content)

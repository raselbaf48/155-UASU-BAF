import re

with open('src/services/localDatabase.ts', 'r') as f:
    content = f.read()

bad_block = """                 return duty;
             });"""

good_block = """                 return duty;
             });
             
             // Restore local duties that are not yet in Supabase
             currentMatrix.forEach((localDuty: any) => {
                 if (!formattedMatrix.find(d => d.id === localDuty.id)) {
                     formattedMatrix.push(localDuty);
                 }
             });"""

content = content.replace(bad_block, good_block)

with open('src/services/localDatabase.ts', 'w') as f:
    f.write(content)

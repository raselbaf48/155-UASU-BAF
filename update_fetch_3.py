import re

with open('src/services/localDatabase.ts', 'r') as f:
    content = f.read()

bad_block = """             });
             const newRaw = JSON.stringify(formattedMatrix);"""

good_block = """             });
             
             // Sort to match how the UI displays them, which prevents unnecessary JSON differences
             formattedMatrix.sort((a, b) => {
                if (a.serNo !== undefined && b.serNo !== undefined) return a.serNo - b.serNo;
                if (a.serNo !== undefined) return -1;
                if (b.serNo !== undefined) return 1;
                return 0;
             });
             
             const newRaw = JSON.stringify(formattedMatrix);"""

content = content.replace(bad_block, good_block)

with open('src/services/localDatabase.ts', 'w') as f:
    f.write(content)

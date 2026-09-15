import re

with open('src/components/TopHeader.tsx', 'r') as f:
    content = f.read()

old_switch = """      case 'leave-register':
        return { category: 'WORKFORCE', title: 'Leave Register' };"""

new_switch = """      case 'biodata-register':
        return { category: 'WORKFORCE', title: 'Biodata Register' };
      case 'leave-register':
        return { category: 'WORKFORCE', title: 'Leave Register' };"""

content = content.replace(old_switch, new_switch)

with open('src/components/TopHeader.tsx', 'w') as f:
    f.write(content)


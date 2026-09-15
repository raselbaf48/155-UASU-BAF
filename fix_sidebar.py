import re

with open('src/components/Sidebar.tsx', 'r') as f:
    content = f.read()

# Fix wrong imports
content = content.replace("import { UserCircle, Logo155UASU }", "import { Logo155UASU }")
content = content.replace("import { UserCircle, UserRole }", "import { UserRole }")
content = content.replace("import { UserCircle, UserSession }", "import { UserSession }")
content = content.replace("import { UserCircle, User }", "import { User }")

# Make sure it's in lucide-react (it might already be there because of the previous step?)
# The previous step didn't put it in lucide-react if it wasn't the first "import { ".
# Let's see if UserCircle is in lucide-react import
if "UserCircle" not in content.split("from 'lucide-react'")[0]:
    content = content.replace("from 'lucide-react';", "UserCircle,\n} from 'lucide-react';")

with open('src/components/Sidebar.tsx', 'w') as f:
    f.write(content)


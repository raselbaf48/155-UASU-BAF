import re

with open('src/components/Sidebar.tsx', 'r') as f:
    content = f.read()

# Replace all messy lucide-react imports with a clean one
messy_pattern = re.compile(r"import\s+\{[^}]*\}\s+from\s+'lucide-react';[\s\S]*?(?=export type)", re.MULTILINE)
clean_import = """import {
  LayoutDashboard,
  Users,
  Calendar,
  BarChart3,
  Shield,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Layers,
  Building2,
  Clock,
  UserCheck,
  FileText,
  AlertTriangle,
  Sparkles,
  Award,
  CalendarDays,
  PanelLeftClose,
  PanelLeft,
  Sliders,
  Settings,
  Moon,
  KeyRound,
  Lock,
  Unlock,
  LogOut,
  ClipboardList,
  Activity,
  UserCircle,
  User
} from 'lucide-react';

import { UserRole } from '../types';
import { UserSession } from '../utils/authSession';

"""

content = re.sub(messy_pattern, clean_import, content)

with open('src/components/Sidebar.tsx', 'w') as f:
    f.write(content)


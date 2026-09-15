with open('src/components/Sidebar.tsx', 'r') as f:
    content = f.read()

# Find the 'export type SidebarTab ='
split_idx = content.find("export type SidebarTab =")
rest_of_file = content[split_idx:]

clean_top = """import React, { useState } from 'react';
import { Logo155UASU } from './Logo155UASU';
import {
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

with open('src/components/Sidebar.tsx', 'w') as f:
    f.write(clean_top + rest_of_file)


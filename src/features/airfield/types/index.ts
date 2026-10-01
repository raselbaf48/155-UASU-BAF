export type AirfieldStaffType = 'Permanent' | 'Additional';
export type DutyStatusType = 'Active' | 'Standby' | 'Rest';

export interface RotationSlot {
  slotIndex: number; // 1, 2, 3...
  timeRange: string; // e.g. "06:00 - 06:30"
  blockIndex?: number; // 1, 2, 3...
  blockTimeRange?: string; // e.g. "06:00 - 07:30"
  activePersonIds: string[];
  standbyPersonIds: string[];
  restPersonIds: string[];
}

export interface RotationMajorBlock {
  blockIndex: number; // 1, 2, 3...
  timeRange: string; // e.g. "06:00 - 07:30"
  durationMinutes: number;
  activePersonIds: string[];
  subSlots: RotationSlot[];
}

export interface PostRotationSchedule {
  totalSlots: number;
  slotDurationMinutes: number;
  blockDurationMinutes?: number;
  totalBlocks?: number;
  blocks?: RotationMajorBlock[];
  slots: RotationSlot[];
  perPersonActiveMinutes: number;
  perPersonStandbyMinutes: number;
  perPersonRestMinutes: number;
  rulesSatisfied?: {
    noConsecutiveActive: boolean;
    noConsecutiveStandby: boolean;
    minRestOneHour: boolean;
    autoRestActive: boolean;
  };
}

export interface DutyPerson {
  id: string;
  name: string; // e.g. "Sharif", "Hridoy"
  rank: string; // e.g. "Sgt", "Cpl", "LAC"
  bdNo?: string;
  type: AirfieldStaffType;
  dutyStatus?: DutyStatusType; // 'Active' | 'Standby' | 'Rest'
  dutyTime?: string; // e.g. "06:00 - 07:36, 12:24 - 14:00 (3h 12m)"
  armsCount?: number; // e.g. 1
  rtCount?: number;   // e.g. 1
  mobileNo?: string;  // e.g. "01648799047"
  remarks?: string;
}

export interface DutyPost {
  id: string;
  name: string; // e.g. "Drive way (Terminal)", "Parking (Chk Post)"
  category?: 'Gate' | 'Terminal' | 'Command' | 'Security' | 'Special';
  dutyTime?: string; // e.g. "0600F - 1400F" or "24 Hours"
  targetActiveStrength?: number; // How many active duty persons required
  targetStandbyStrength?: number; // How many standby duty persons required
  targetStrength?: number; // Total target strength (active + standby or active)
  breakdownNote?: string; // e.g. "Arms-03, RT-01"
  mobileNo?: string;
  remarks?: string;
  rotationSchedule?: PostRotationSchedule;
  personnel: DutyPerson[];
}

export type ShiftName = 'SHIFT-A' | 'SHIFT-B' | 'SHIFT-C';

export interface AirfieldShiftRoster {
  id: string;
  date: string; // YYYY-MM-DD
  shift: ShiftName;
  timeRange: string; // e.g. "0600F-1400F"
  dutyOfficerName: string;
  dutyOfficerPhone: string;
  dutySncoName: string;
  posts: DutyPost[];
  updatedAt?: string;
}

export interface AirfieldDashboardStats {
  totalPosts: number;
  totalPersonnel: number;
  activeCount: number;
  standbyCount: number;
  restCount?: number;
  targetActiveTotal: number;
  targetStandbyTotal: number;
  targetTotal: number;
  permanentCount: number;
  additionalCount: number;
  totalArms: number;
  totalRt: number;
  fulfillmentRate: number;
  underMannedPostsCount: number;
}

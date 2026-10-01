import { AirfieldShiftRoster, DutyPost, DutyPerson, AirfieldDashboardStats } from '../types';
import { supabase, isSupabaseConfigured } from '../../../supabase';

export const INITIAL_DUTY_POSTS: DutyPost[] = [
  {
    id: 'post_snco',
    name: 'SNCO',
    category: 'Command',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 1,
    targetStandbyStrength: 1,
    targetStrength: 2,
    personnel: [
      { id: 'p_1', rank: 'Sgt', name: 'Tushar', type: 'Additional', dutyStatus: 'Active', dutyTime: '0600F - 1400F' },
      { id: 'p_1_sb', rank: 'Sgt', name: 'Akter', type: 'Permanent', dutyStatus: 'Standby', dutyTime: '0600F - 1400F' },
    ],
  },
  {
    id: 'post_supervisor',
    name: 'Supervisor',
    category: 'Command',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 1,
    targetStandbyStrength: 1,
    targetStrength: 2,
    breakdownNote: 'RT-03',
    mobileNo: '01648799047',
    personnel: [
      { id: 'p_2', rank: 'Sgt', name: 'Sharif', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', rtCount: 3, mobileNo: '01648799047' },
      { id: 'p_2_sb', rank: 'Sgt', name: 'Kabir', type: 'Permanent', dutyStatus: 'Standby', dutyTime: '0600F - 1400F' },
    ],
  },
  {
    id: 'post_duty_nco',
    name: 'Duty NCO',
    category: 'Command',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 1,
    targetStandbyStrength: 0,
    targetStrength: 1,
    personnel: [
      { id: 'p_3', rank: 'Sgt', name: 'Sadek', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F' },
    ],
  },
  {
    id: 'post_parking',
    name: 'Parking (Chk Post)',
    category: 'Security',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 2,
    targetStandbyStrength: 1,
    targetStrength: 3,
    breakdownNote: 'Arms-01, RT-01',
    personnel: [
      { id: 'p_4', rank: 'Cpl', name: 'Hridoy', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
      { id: 'p_5', rank: 'Sgt', name: 'Nur', type: 'Additional', dutyStatus: 'Active', dutyTime: '0600F - 1400F', rtCount: 1 },
      { id: 'p_5_sb', rank: 'LAC', name: 'Arif', type: 'Additional', dutyStatus: 'Standby', dutyTime: '0600F - 1400F' },
    ],
  },
  {
    id: 'post_entry_gate',
    name: 'Entry Gate (Chk Post)',
    category: 'Gate',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 2,
    targetStandbyStrength: 1,
    targetStrength: 3,
    breakdownNote: 'Arms-01, RT-01',
    personnel: [
      { id: 'p_6', rank: 'Cpl', name: 'Jahedul', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
      { id: 'p_7', rank: 'Sgt', name: 'Jibon', type: 'Additional', dutyStatus: 'Active', dutyTime: '0600F - 1400F', rtCount: 1 },
      { id: 'p_7_sb', rank: 'LAC', name: 'Hasan', type: 'Permanent', dutyStatus: 'Standby', dutyTime: '0600F - 1400F' },
    ],
  },
  {
    id: 'post_driveway',
    name: 'Drive way (Terminal)',
    category: 'Terminal',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 2,
    targetStandbyStrength: 1,
    targetStrength: 3,
    breakdownNote: 'Arms-03, RT-01',
    personnel: [
      { id: 'p_8', rank: 'LAC', name: 'Ashraf', type: 'Permanent', dutyStatus: 'Active', dutyTime: '06:00-07:36, 12:24-14:00 (3h 12m Act)', armsCount: 1 },
      { id: 'p_9', rank: 'LAC', name: 'Rifat', type: 'Permanent', dutyStatus: 'Active', dutyTime: '06:00-09:12 (3h 12m Act)', armsCount: 1 },
      { id: 'p_10', rank: 'Cpl', name: 'Tamjid', type: 'Permanent', dutyStatus: 'Standby', dutyTime: 'Standby: 06:00-07:36 (1h 36m Stby)', armsCount: 1 },
      { id: 'p_11', rank: 'LAC', name: 'Sarwer', type: 'Additional', dutyStatus: 'Rest', dutyTime: 'Rest / Relief (3h 12m Rest • 3h 12m Act)', rtCount: 1 },
      { id: 'p_12', rank: 'LAC', name: 'Saiful', type: 'Additional', dutyStatus: 'Rest', dutyTime: 'Rest / Relief (3h 12m Rest • 3h 12m Act)' },
    ],
  },
  {
    id: 'post_vip_gate',
    name: 'VIP Gate',
    category: 'Gate',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 2,
    targetStandbyStrength: 1,
    targetStrength: 3,
    breakdownNote: 'Arms-02, RT-01',
    personnel: [
      { id: 'p_13', rank: 'LAC', name: 'Noman', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
      { id: 'p_14', rank: 'Cpl', name: 'Jubayer', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1, rtCount: 1 },
    ],
  },
  {
    id: 'post_gate_4',
    name: 'Gate-4',
    category: 'Gate',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 2,
    targetStandbyStrength: 1,
    targetStrength: 3,
    breakdownNote: 'Arms-02',
    personnel: [
      { id: 'p_15', rank: 'Sgt', name: 'Ripple', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
      { id: 'p_16', rank: 'LAC', name: 'Mujahid', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
    ],
  },
  {
    id: 'post_gate_7',
    name: 'Gate-7',
    category: 'Gate',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 0,
    targetStandbyStrength: 0,
    targetStrength: 0,
    remarks: 'Closed / Inactive',
    personnel: [],
  },
  {
    id: 'post_cargo_gate_12',
    name: 'Cargo Gate-12',
    category: 'Gate',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 2,
    targetStandbyStrength: 1,
    targetStrength: 3,
    breakdownNote: 'Arms-02',
    personnel: [
      { id: 'p_17', rank: 'Sgt', name: 'Alamin', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
      { id: 'p_18', rank: 'Sgt', name: 'Anis', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
    ],
  },
  {
    id: 'post_gate_13',
    name: 'Gate-13',
    category: 'Gate',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 2,
    targetStandbyStrength: 1,
    targetStrength: 3,
    breakdownNote: 'Arms-01',
    personnel: [
      { id: 'p_19', rank: 'Cpl', name: 'Raihan', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
      { id: 'p_20', rank: 'LAC', name: 'Rasel', type: 'Additional', dutyStatus: 'Active', dutyTime: '0600F - 1400F' },
    ],
  },
  {
    id: 'post_gate_16',
    name: 'Gate-16',
    category: 'Gate',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 2,
    targetStandbyStrength: 1,
    targetStrength: 3,
    breakdownNote: 'Arms-02',
    personnel: [
      { id: 'p_21', rank: 'LAC', name: 'Sajib', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
      { id: 'p_22', rank: 'Cpl', name: 'Mushahid', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
    ],
  },
  {
    id: 'post_japani_gate',
    name: 'Japani Gate',
    category: 'Gate',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 2,
    targetStandbyStrength: 1,
    targetStrength: 3,
    breakdownNote: 'Arms-01, RT-01',
    personnel: [
      { id: 'p_23', rank: 'Cpl', name: 'Showrov', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
      { id: 'p_24', rank: 'Cpl', name: 'Alamin', type: 'Additional', dutyStatus: 'Active', dutyTime: '0600F - 1400F', rtCount: 1 },
    ],
  },
  {
    id: 'post_customs',
    name: 'Customs',
    category: 'Terminal',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 1,
    targetStandbyStrength: 1,
    targetStrength: 2,
    personnel: [
      { id: 'p_25', rank: 'Sgt', name: 'Reza', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F' },
    ],
  },
  {
    id: 'post_apron',
    name: 'Apron',
    category: 'Security',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 1,
    targetStandbyStrength: 1,
    targetStrength: 2,
    breakdownNote: 'RT-01',
    personnel: [
      { id: 'p_26', rank: 'Sgt', name: 'Rubel', type: 'Additional', dutyStatus: 'Active', dutyTime: '0600F - 1400F', rtCount: 1 },
    ],
  },
  {
    id: 'post_patrolling',
    name: 'Patrolling',
    category: 'Security',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 2,
    targetStandbyStrength: 1,
    targetStrength: 3,
    breakdownNote: 'Arms-01, RT-01',
    personnel: [
      { id: 'p_27', rank: 'LAC', name: 'Faruk', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F', armsCount: 1 },
      { id: 'p_28', rank: 'Cpl', name: 'Zahid', type: 'Additional', dutyStatus: 'Active', dutyTime: '0600F - 1400F', rtCount: 1 },
    ],
  },
  {
    id: 'post_terminal_gate_10_11',
    name: 'Terminal Gate-10 & Terminal Gate-11',
    category: 'Terminal',
    dutyTime: '0600F - 1400F',
    targetActiveStrength: 1,
    targetStandbyStrength: 1,
    targetStrength: 2,
    personnel: [
      { id: 'p_30', rank: 'Sgt', name: 'Omar', type: 'Permanent', dutyStatus: 'Active', dutyTime: '0600F - 1400F' },
    ],
  },
];

export const DEFAULT_AIRFIELD_ROSTER: AirfieldShiftRoster = {
  id: 'roster_default',
  date: new Date().toISOString().split('T')[0],
  shift: 'SHIFT-A',
  timeRange: '0600F-1400F',
  dutyOfficerName: 'Flg Offr Gazi Sazidur Rahman',
  dutyOfficerPhone: '01769505255',
  dutySncoName: 'Sgt Tushar',
  posts: INITIAL_DUTY_POSTS,
};

const STORAGE_KEY = 'baf_airfield_saia_roster_v3';

export function getStoredAirfieldRoster(): AirfieldShiftRoster {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.posts) && parsed.posts.length > 0) {
        return normalizeRoster(parsed);
      }
    }
  } catch (e) {
    console.warn('[AirfieldStorage] Error loading local roster:', e);
  }
  return DEFAULT_AIRFIELD_ROSTER;
}

export function saveStoredAirfieldRoster(roster: AirfieldShiftRoster) {
  try {
    const updated = { ...roster, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('baf_airfield_roster_updated', { detail: updated }));
    pushAirfieldRosterToCloud(updated).catch(console.warn);
  } catch (e) {
    console.error('[AirfieldStorage] Error saving local roster:', e);
  }
}

function normalizeRoster(roster: AirfieldShiftRoster): AirfieldShiftRoster {
  const normPosts = roster.posts.map((post) => {
    const defaultTime = post.dutyTime || roster.timeRange || '0600F - 1400F';
    const targetActive = post.targetActiveStrength ?? post.targetStrength ?? post.personnel.length;
    const targetStandby = post.targetStandbyStrength ?? 0;
    const targetTotal = post.targetStrength ?? (targetActive + targetStandby);

    const normPersonnel = post.personnel.map((p) => ({
      ...p,
      dutyStatus: p.dutyStatus || 'Active',
      dutyTime: p.dutyTime || defaultTime,
    }));

    return {
      ...post,
      dutyTime: defaultTime,
      targetActiveStrength: targetActive,
      targetStandbyStrength: targetStandby,
      targetStrength: targetTotal,
      personnel: normPersonnel,
    };
  });

  return {
    ...roster,
    posts: normPosts,
  };
}

export async function pushAirfieldRosterToCloud(roster: AirfieldShiftRoster) {
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('app_settings').upsert({
      setting_key: 'baf_airfield_saia_roster',
      setting_value: JSON.stringify(roster),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'setting_key' });
  } catch (e) {
    console.warn('[AirfieldStorage] Cloud push error:', e);
  }
}

export async function pullAirfieldRosterFromCloud(): Promise<AirfieldShiftRoster | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'baf_airfield_saia_roster')
      .maybeSingle();

    if (!error && data && data.setting_value) {
      const parsed = JSON.parse(data.setting_value);
      if (parsed && Array.isArray(parsed.posts)) {
        const norm = normalizeRoster(parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(norm));
        return norm;
      }
    }
  } catch (e) {
    console.warn('[AirfieldStorage] Cloud pull error:', e);
  }
  return null;
}

export function calculateAirfieldStats(posts: DutyPost[]): AirfieldDashboardStats {
  let totalPersonnel = 0;
  let activeCount = 0;
  let standbyCount = 0;
  let restCount = 0;
  let targetActiveTotal = 0;
  let targetStandbyTotal = 0;
  let permanentCount = 0;
  let additionalCount = 0;
  let totalArms = 0;
  let totalRt = 0;
  let underMannedPostsCount = 0;

  posts.forEach((post) => {
    const postActiveTarget = post.targetActiveStrength ?? post.targetStrength ?? 0;
    const postStandbyTarget = post.targetStandbyStrength ?? 0;
    targetActiveTotal += postActiveTarget;
    targetStandbyTotal += postStandbyTarget;

    let postActiveCount = 0;

    post.personnel.forEach((p) => {
      totalPersonnel += 1;
      const status = p.dutyStatus || 'Active';
      if (status === 'Active') {
        activeCount += 1;
        postActiveCount += 1;
      } else if (status === 'Standby') {
        standbyCount += 1;
      } else {
        restCount += 1;
      }

      if (p.type === 'Permanent') {
        permanentCount += 1;
      } else {
        additionalCount += 1;
      }

      if (p.armsCount) totalArms += Number(p.armsCount) || 0;
      if (p.rtCount) totalRt += Number(p.rtCount) || 0;
    });

    if (postActiveTarget > 0 && postActiveCount < postActiveTarget) {
      underMannedPostsCount += 1;
    }

    // Check post breakdownNote if individual weapon not set
    if (post.breakdownNote) {
      const armsMatch = post.breakdownNote.match(/Arms-(\d+)/i);
      const rtMatch = post.breakdownNote.match(/RT-(\d+)/i);
      const postPersonnelArms = post.personnel.reduce((s, p) => s + (p.armsCount || 0), 0);
      const postPersonnelRt = post.personnel.reduce((s, p) => s + (p.rtCount || 0), 0);

      if (armsMatch && postPersonnelArms === 0) {
        totalArms += parseInt(armsMatch[1], 10) || 0;
      }
      if (rtMatch && postPersonnelRt === 0) {
        totalRt += parseInt(rtMatch[1], 10) || 0;
      }
    }
  });

  const targetTotal = targetActiveTotal + targetStandbyTotal;
  const fulfillmentRate = targetActiveTotal > 0 ? Math.min(100, Math.round((activeCount / targetActiveTotal) * 100)) : 100;

  return {
    totalPosts: posts.length,
    totalPersonnel,
    activeCount,
    standbyCount,
    restCount,
    targetActiveTotal,
    targetStandbyTotal,
    targetTotal,
    permanentCount,
    additionalCount,
    totalArms,
    totalRt,
    fulfillmentRate,
    underMannedPostsCount,
  };
}

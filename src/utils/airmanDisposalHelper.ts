import { DutyAssignment } from '../types';
import { DUTY_TYPE_MAP } from '../data/dutyTypes';
import { localDb } from '../services/localDatabase';

export interface AirmanDisposalStatus {
  disposalSummary: string;
  dropdownLabel: string;
  disabled: boolean;
  disabledReason?: string;
  conflictType: 'LEAVE' | 'TDY' | 'DEPLOYMENT' | null;
  conflictingDates?: string[];
  primaryDutyCode?: string;
}

/**
 * Robust airman ID matching that handles:
 * - "BD/99066" vs "99066" vs "airman-99066"
 * - Numeric clean matches or lowercase string matches
 */
export function matchAirmanId(idA?: string, idB?: string): boolean {
  if (!idA || !idB) return false;
  if (idA === idB) return true;
  const cleanA = String(idA).replace(/^BD\//i, '').replace(/^airman-/i, '').replace(/\D/g, '').trim();
  const cleanB = String(idB).replace(/^BD\//i, '').replace(/^airman-/i, '').replace(/\D/g, '').trim();
  if (cleanA.length > 0 && cleanB.length > 0 && cleanA === cleanB) return true;
  const strA = String(idA).replace(/^BD\//i, '').replace(/^airman-/i, '').trim().toLowerCase();
  const strB = String(idB).replace(/^BD\//i, '').replace(/^airman-/i, '').trim().toLowerCase();
  return strA === strB;
}

/**
 * Returns an array of YYYY-MM-DD date strings between start and end date (inclusive)
 */
export function getDatesInRange(startDate: string, endDate: string): string[] {
  if (!startDate) return [];
  if (!endDate || endDate < startDate) return [startDate];

  const dates: string[] = [];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);

  const curr = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));

  while (curr <= end) {
    const y = curr.getUTCFullYear();
    const m = String(curr.getUTCMonth() + 1).padStart(2, '0');
    const d = String(curr.getUTCDate()).padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Format date nicely for summary labels (e.g., "18 Oct")
 */
function formatShortDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${day} ${monthNames[monthIndex] || parts[1]}`;
}

/**
 * Inspects all assignments for an airman across the specified date range and determines:
 * 1. Current disposal label
 * 2. Whether they are blocked from being assigned Leave, TDY, or Deployment
 * 3. Specific conflict reason
 */
export function getAirmanDisposalForRange(
  airmanId: string,
  fromDate: string,
  toDate: string,
  assignmentsMap: Record<string, DutyAssignment[]> = {},
  targetAction: 'LEAVE' | 'TDY' | 'DEPLOYMENT'
): AirmanDisposalStatus {
  const dates = getDatesInRange(fromDate, toDate || fromDate);
  if (dates.length === 0) {
    return {
      disposalSummary: 'On Parade',
      dropdownLabel: '',
      disabled: false,
      conflictType: null,
      primaryDutyCode: 'ON_PARADE',
    };
  }

  // Ensure we always have access to full assignments (from map or localDb)
  const allAssignmentsSource: Record<string, DutyAssignment[]> =
    assignmentsMap && Object.keys(assignmentsMap).length > 0
      ? assignmentsMap
      : typeof window !== 'undefined'
      ? localDb.getDb()?.assignments || {}
      : {};

  // Collect all matching assignments for this airman on these dates
  const matchedAssignments: DutyAssignment[] = [];
  for (const dateStr of dates) {
    const monthKey = dateStr.slice(0, 7);
    const monthList = allAssignmentsSource[monthKey] || [];
    const found = monthList.filter((a) => matchAirmanId(a.airmanId, airmanId) && a.date === dateStr);
    matchedAssignments.push(...found);
  }

  // Check for Leave
  const leaveAssignments = matchedAssignments.filter((a) => a.dutyCode === 'LEAVE');
  // Check for TDY
  const tdyAssignments = matchedAssignments.filter(
    (a) => a.dutyCode === 'TDY' || a.dutyCode === 'ATT' || a.dutyCode === 'DETT'
  );
  // Check for Deployment
  const depAssignments = matchedAssignments.filter(
    (a) =>
      (a.dutyCode as string) === 'DEPLOYMENT' ||
      a.dutyCode === 'CANTEEN' ||
      a.dutyCode === 'BAKE_N_BITE' ||
      (a.notes && a.notes.toLowerCase().includes('canteen')) ||
      (a.notes && a.notes.toLowerCase().includes('deployment'))
  );
  // Duty Off assignments (GD Off, Night Off, etc.)
  const dutyOffAssignments = matchedAssignments.filter(
    (a) => a.dutyCode === 'DUTY_OFF' || (a.notes && a.notes.toLowerCase().includes('off'))
  );
  // Other Operational Duties (GD, BTF, NTF, IDAC, etc.)
  const otherDutyAssignments = matchedAssignments.filter(
    (a) =>
      a.dutyCode !== 'LEAVE' &&
      a.dutyCode !== 'TDY' &&
      a.dutyCode !== 'ATT' &&
      a.dutyCode !== 'DETT' &&
      (a.dutyCode as string) !== 'DEPLOYMENT' &&
      a.dutyCode !== 'CANTEEN' &&
      a.dutyCode !== 'BAKE_N_BITE' &&
      a.dutyCode !== 'ON_PARADE' &&
      a.dutyCode !== 'DUTY_OFF'
  );

  // Helper to extract clean leave detail
  const getLeaveDetail = (ass: DutyAssignment): string => {
    const n = (ass.notes || '').toLowerCase();
    if (n.includes('casual')) return 'Casual Leave';
    if (n.includes('annual')) return 'Annual Leave';
    if (n.includes('recreation')) return 'Recreation Leave';
    if (n.includes('sick')) return 'Sick Leave';
    return ass.notes || 'Leave';
  };

  // Helper to extract clean TDY detail
  const getTdyDetail = (ass: DutyAssignment): string => {
    return ass.notes || 'TDY';
  };

  // Helper to extract clean Deployment detail
  const getDepDetail = (ass: DutyAssignment): string => {
    if (ass.dutyCode === 'CANTEEN' || (ass.notes && ass.notes.toLowerCase().includes('canteen'))) return 'Canteen';
    if (ass.dutyCode === 'BAKE_N_BITE' || (ass.notes && ass.notes.toLowerCase().includes('bite'))) return 'Bake & Bite';
    return ass.notes || 'Deployment';
  };

  // Helper to extract clean Duty detail
  const getDutyDetail = (ass: DutyAssignment): string => {
    if (ass.dutyCode === 'IDAC' || ass.dutyCode === 'IDA') {
      return `IDAC ${ass.idaShift ? `(${ass.idaShift})` : ''}`.trim();
    }
    const def = DUTY_TYPE_MAP.get(ass.dutyCode as any);
    return def?.name || ass.dutyCode;
  };

  // Build date hint helper
  const getDateHint = (list: DutyAssignment[]) => {
    if (dates.length <= 1 || list.length === 0) return '';
    const sorted = [...list].sort((x, y) => x.date.localeCompare(y.date));
    return ` (${formatShortDate(sorted[0].date)} - ${formatShortDate(sorted[sorted.length - 1].date)})`;
  };

  // 1. Target: LEAVE
  if (targetAction === 'LEAVE') {
    if (leaveAssignments.length > 0) {
      const first = leaveAssignments[0];
      const detail = getLeaveDetail(first);
      const hint = getDateHint(leaveAssignments);
      const fullLabel = `⛔ [Already on Leave - ${detail}${hint}]`;
      return {
        disposalSummary: `Already on Leave: ${detail}${hint}`,
        dropdownLabel: fullLabel,
        disabled: true,
        disabledReason: `Already on ${detail}. Cannot assign Leave again.`,
        conflictType: 'LEAVE',
        conflictingDates: leaveAssignments.map((a) => a.date),
        primaryDutyCode: 'LEAVE',
      };
    }

    if (tdyAssignments.length > 0) {
      const first = tdyAssignments[0];
      const detail = getTdyDetail(first);
      const hint = getDateHint(tdyAssignments);
      const fullLabel = `⛔ [On TDY - ${detail}${hint}]`;
      return {
        disposalSummary: `On TDY: ${detail}${hint}`,
        dropdownLabel: fullLabel,
        disabled: true,
        disabledReason: `Currently on TDY (${detail}). Cannot assign Leave while on TDY.`,
        conflictType: 'TDY',
        conflictingDates: tdyAssignments.map((a) => a.date),
        primaryDutyCode: 'TDY',
      };
    }

    if (depAssignments.length > 0) {
      const first = depAssignments[0];
      const detail = getDepDetail(first);
      const hint = getDateHint(depAssignments);
      const fullLabel = `⛔ [On Deployment - ${detail}${hint}]`;
      return {
        disposalSummary: `On Deployment: ${detail}${hint}`,
        dropdownLabel: fullLabel,
        disabled: true,
        disabledReason: `Currently on Deployment (${detail}). Cannot assign Leave while deployed.`,
        conflictType: 'DEPLOYMENT',
        conflictingDates: depAssignments.map((a) => a.date),
        primaryDutyCode: 'DEPLOYMENT',
      };
    }

    if (otherDutyAssignments.length > 0) {
      const first = otherDutyAssignments[0];
      const detail = getDutyDetail(first);
      return {
        disposalSummary: `On Duty: ${detail}`,
        dropdownLabel: `[On Duty - ${detail}]`,
        disabled: false,
        conflictType: null,
        primaryDutyCode: first.dutyCode,
      };
    }

    if (dutyOffAssignments.length > 0) {
      const offName = dutyOffAssignments[0].previousDutyName || dutyOffAssignments[0].notes || 'Duty Off';
      return {
        disposalSummary: `Duty Off: ${offName}`,
        dropdownLabel: `[Duty Off - ${offName}]`,
        disabled: false,
        conflictType: null,
        primaryDutyCode: 'DUTY_OFF',
      };
    }

    // Check yesterday's night duty if single date
    if (dates.length === 1) {
      const [y, m, d] = fromDate.split('-').map(Number);
      const yesterday = new Date(Date.UTC(y, m - 1, d - 1));
      const prevDateStr = yesterday.toISOString().split('T')[0];
      const prevMonthKey = prevDateStr.slice(0, 7);
      const prevMonthList = allAssignmentsSource[prevMonthKey] || [];
      const prevAss = prevMonthList.filter((a) => matchAirmanId(a.airmanId, airmanId) && a.date === prevDateStr);
      if (prevAss.length > 0) {
        const yestDuty = prevAss[0];
        const yCodeStr = String(yestDuty.dutyCode || '');
        const isEscortDuty =
          (yestDuty.dutyCode as any) === 'ESCORT' ||
          (yestDuty.dutyCode as any) === 'ESC' ||
          (yestDuty.dutyCode as any) === 'ESCT' ||
          yCodeStr.includes('1794394') ||
          (yestDuty.dutyName || '').toLowerCase().includes('escort') ||
          (yestDuty.notes || '').toLowerCase().includes('escort');

        const isNight =
          ['GD', 'BTF', 'NTF', 'AIRPORT'].includes(yestDuty.dutyCode as any) ||
          ((yestDuty.dutyCode === 'IDAC' || yestDuty.dutyCode === 'IDA') && yestDuty.idaShift === 'Night') ||
          (yestDuty.notes || '').toLowerCase().includes('idac') ||
          isEscortDuty;
        if (isNight) {
          let offName = 'GD Off';
          if (isEscortDuty) offName = 'Esct Off';
          else if (yestDuty.dutyCode === 'GD') offName = 'GD Off';
          else if (yestDuty.dutyCode === 'BTF') offName = 'BTF Off';
          else if (yestDuty.dutyCode === 'NTF') offName = 'NTF Off';
          else if (yestDuty.dutyCode === 'AIRPORT') offName = 'Airport Off';
          else if ((yestDuty.dutyCode === 'IDAC' || yestDuty.dutyCode === 'IDA') && yestDuty.idaShift === 'Night')
            offName = 'IDAC Nt Off';
          return {
            disposalSummary: `Night Off: ${offName}`,
            dropdownLabel: `[Duty Off - ${offName}]`,
            disabled: false,
            conflictType: null,
            primaryDutyCode: 'NIGHT_OFF',
          };
        }
      }
    }

    return {
      disposalSummary: 'On Parade',
      dropdownLabel: '',
      disabled: false,
      conflictType: null,
      primaryDutyCode: 'ON_PARADE',
    };
  }

  // 2. Target: TDY
  if (targetAction === 'TDY') {
    if (tdyAssignments.length > 0) {
      const first = tdyAssignments[0];
      const detail = getTdyDetail(first);
      const hint = getDateHint(tdyAssignments);
      const fullLabel = `⛔ [Already on TDY - ${detail}${hint}]`;
      return {
        disposalSummary: `Already on TDY: ${detail}${hint}`,
        dropdownLabel: fullLabel,
        disabled: true,
        disabledReason: `Already on TDY (${detail}). Cannot assign TDY again.`,
        conflictType: 'TDY',
        conflictingDates: tdyAssignments.map((a) => a.date),
        primaryDutyCode: 'TDY',
      };
    }

    if (leaveAssignments.length > 0) {
      const first = leaveAssignments[0];
      const detail = getLeaveDetail(first);
      const hint = getDateHint(leaveAssignments);
      const fullLabel = `⛔ [On Leave - ${detail}${hint}]`;
      return {
        disposalSummary: `On Leave: ${detail}${hint}`,
        dropdownLabel: fullLabel,
        disabled: true,
        disabledReason: `Currently on Leave (${detail}). Cannot assign TDY while on Leave.`,
        conflictType: 'LEAVE',
        conflictingDates: leaveAssignments.map((a) => a.date),
        primaryDutyCode: 'LEAVE',
      };
    }

    if (depAssignments.length > 0) {
      const first = depAssignments[0];
      const detail = getDepDetail(first);
      const hint = getDateHint(depAssignments);
      const fullLabel = `⛔ [On Deployment - ${detail}${hint}]`;
      return {
        disposalSummary: `On Deployment: ${detail}${hint}`,
        dropdownLabel: fullLabel,
        disabled: true,
        disabledReason: `Currently on Deployment (${detail}). Cannot assign TDY while deployed.`,
        conflictType: 'DEPLOYMENT',
        conflictingDates: depAssignments.map((a) => a.date),
        primaryDutyCode: 'DEPLOYMENT',
      };
    }

    if (otherDutyAssignments.length > 0) {
      const first = otherDutyAssignments[0];
      const detail = getDutyDetail(first);
      return {
        disposalSummary: `On Duty: ${detail}`,
        dropdownLabel: `[On Duty - ${detail}]`,
        disabled: false,
        conflictType: null,
        primaryDutyCode: first.dutyCode,
      };
    }

    if (dutyOffAssignments.length > 0) {
      const offName = dutyOffAssignments[0].previousDutyName || dutyOffAssignments[0].notes || 'Duty Off';
      return {
        disposalSummary: `Duty Off: ${offName}`,
        dropdownLabel: `[Duty Off - ${offName}]`,
        disabled: false,
        conflictType: null,
        primaryDutyCode: 'DUTY_OFF',
      };
    }

    return {
      disposalSummary: 'On Parade',
      dropdownLabel: '',
      disabled: false,
      conflictType: null,
      primaryDutyCode: 'ON_PARADE',
    };
  }

  // 3. Target: DEPLOYMENT
  if (targetAction === 'DEPLOYMENT') {
    if (depAssignments.length > 0) {
      const first = depAssignments[0];
      const detail = getDepDetail(first);
      const hint = getDateHint(depAssignments);
      const fullLabel = `⛔ [Already on Deployment - ${detail}${hint}]`;
      return {
        disposalSummary: `Already on Deployment: ${detail}${hint}`,
        dropdownLabel: fullLabel,
        disabled: true,
        disabledReason: `Already deployed (${detail}). Cannot assign Deployment again.`,
        conflictType: 'DEPLOYMENT',
        conflictingDates: depAssignments.map((a) => a.date),
        primaryDutyCode: 'DEPLOYMENT',
      };
    }

    if (leaveAssignments.length > 0) {
      const first = leaveAssignments[0];
      const detail = getLeaveDetail(first);
      const hint = getDateHint(leaveAssignments);
      const fullLabel = `⛔ [On Leave - ${detail}${hint}]`;
      return {
        disposalSummary: `On Leave: ${detail}${hint}`,
        dropdownLabel: fullLabel,
        disabled: true,
        disabledReason: `Currently on Leave (${detail}). Cannot assign Deployment while on Leave.`,
        conflictType: 'LEAVE',
        conflictingDates: leaveAssignments.map((a) => a.date),
        primaryDutyCode: 'LEAVE',
      };
    }

    if (tdyAssignments.length > 0) {
      const first = tdyAssignments[0];
      const detail = getTdyDetail(first);
      const hint = getDateHint(tdyAssignments);
      const fullLabel = `⛔ [On TDY - ${detail}${hint}]`;
      return {
        disposalSummary: `On TDY: ${detail}${hint}`,
        dropdownLabel: fullLabel,
        disabled: true,
        disabledReason: `Currently on TDY (${detail}). Cannot assign Deployment while on TDY.`,
        conflictType: 'TDY',
        conflictingDates: tdyAssignments.map((a) => a.date),
        primaryDutyCode: 'TDY',
      };
    }

    if (otherDutyAssignments.length > 0) {
      const first = otherDutyAssignments[0];
      const detail = getDutyDetail(first);
      return {
        disposalSummary: `On Duty: ${detail}`,
        dropdownLabel: `[On Duty - ${detail}]`,
        disabled: false,
        conflictType: null,
        primaryDutyCode: first.dutyCode,
      };
    }

    if (dutyOffAssignments.length > 0) {
      const offName = dutyOffAssignments[0].previousDutyName || dutyOffAssignments[0].notes || 'Duty Off';
      return {
        disposalSummary: `Duty Off: ${offName}`,
        dropdownLabel: `[Duty Off - ${offName}]`,
        disabled: false,
        conflictType: null,
        primaryDutyCode: 'DUTY_OFF',
      };
    }

    return {
      disposalSummary: 'On Parade',
      dropdownLabel: '',
      disabled: false,
      conflictType: null,
      primaryDutyCode: 'ON_PARADE',
    };
  }

  return {
    disposalSummary: 'On Parade',
    dropdownLabel: '',
    disabled: false,
    conflictType: null,
    primaryDutyCode: 'ON_PARADE',
  };
}

import { UserRole } from '../types';
import { getCurrentUserSession } from './authSession';

export interface DutyPermissionResult {
  canAssign: boolean;
  canEdit: boolean;
  canDelete: boolean;
  reason?: string;
}

/**
 * Standardized permission check for duty assignments, changes, and deletions.
 * Rules:
 * - USER: View only (no assignment, change, or deletion).
 * - ADMIN: Can only assign/change duties for their own flight; cannot modify past dates.
 * - SUPER_ADMIN & OWNER: Can change duties for all flights and past/present/future dates.
 */
export function checkDutyPermission(
  role: UserRole,
  targetFlight?: string,
  targetDate?: string,
  adminFlightOverride?: string
): DutyPermissionResult {
  const session = getCurrentUserSession();
  const effectiveRole = (session?.assignedRole as UserRole) || role;

  // 1. Super Admin and Owner have unrestricted access across all flights and dates
  if (effectiveRole === 'OWNER' || effectiveRole === 'SUPER_ADMIN') {
    return { canAssign: true, canEdit: true, canDelete: true };
  }

  // 2. Regular User has read-only access
  if (effectiveRole === 'USER' || !effectiveRole) {
    return {
      canAssign: false,
      canEdit: false,
      canDelete: false,
      reason: 'Regular users have read-only access.',
    };
  }

  // 3. Admin: restricted to own flight and non-past dates
  if (effectiveRole === 'ADMIN') {
    const adminFlight = adminFlightOverride || session?.flightName;
    const todayStr = new Date().toISOString().split('T')[0];

    // Check past date restriction
    if (targetDate && targetDate < todayStr) {
      return {
        canAssign: false,
        canEdit: false,
        canDelete: false,
        reason: 'Admins cannot assign or modify duties for past dates.',
      };
    }

    // Check flight restriction
    if (targetFlight && adminFlight && targetFlight !== 'All') {
      const normalize = (f: string) => f.toLowerCase().replace(/\s*flight/i, '').trim();
      if (normalize(targetFlight) !== normalize(adminFlight)) {
        return {
          canAssign: false,
          canEdit: false,
          canDelete: false,
          reason: `Admins can only manage duties for their own flight (${adminFlight}).`,
        };
      }
    }

    return { canAssign: true, canEdit: true, canDelete: true };
  }

  return {
    canAssign: false,
    canEdit: false,
    canDelete: false,
    reason: 'Unauthorized action.',
  };
}

/**
 * Checks if a specific date is in the past compared to today (UTC/local date string YYYY-MM-DD).
 */
export function isDateInPast(dateStr?: string): boolean {
  if (!dateStr) return false;
  const todayStr = new Date().toISOString().split('T')[0];
  return dateStr < todayStr;
}

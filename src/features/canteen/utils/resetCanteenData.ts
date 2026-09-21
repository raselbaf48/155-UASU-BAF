import { supabase } from '../../../supabase';
import { pushKeyToCloud } from './canteenCloudSync';

export const RESET_VERSION_KEY = 'canteen_clean_slate_v2026_09';

/**
 * Resets all Canteen transactional and financial data:
 * - Sales and transactions (canteen_txs)
 * - Member dues in Supabase (Due = 0) and cached dues
 * - Expenditures (canteen_expenses)
 * - Pre-orders (canteen_pre_orders)
 * - Recent members cache
 * - Syncs reset state to Supabase Cloud
 */
export async function resetAllCanteenData(resetDatabaseDues: boolean = true) {
  if (resetDatabaseDues) {
    try {
      await supabase.from('Canteen_Member').update({ Due: 0 }).neq('airman_id', '');
    } catch (err) {
      console.warn('Failed to reset Canteen dues in Supabase:', err);
    }
  }

  // Clear localStorage keys
  try {
    localStorage.setItem('canteen_txs', JSON.stringify([]));
    localStorage.setItem('canteen_pre_orders', JSON.stringify([]));
    localStorage.setItem('canteen_expenses', JSON.stringify([]));
    localStorage.setItem('canteen_recent_members', JSON.stringify([]));

    // Clear cached member records (canteen_member_*) so they reload fresh Due: 0
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('canteen_member_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    localStorage.setItem(RESET_VERSION_KEY, 'true');

    // Also push reset to Cloud so other devices clear as well
    pushKeyToCloud('canteen_txs', []);
    pushKeyToCloud('canteen_pre_orders', []);
    pushKeyToCloud('canteen_expenses', []);
    pushKeyToCloud('canteen_recent_members', []);
  } catch (err) {
    console.warn('Error clearing localStorage:', err);
  }

  // Dispatch events to notify all active components
  window.dispatchEvent(new Event('canteen_txs_updated'));
  window.dispatchEvent(new Event('canteen_state_updated'));
  window.dispatchEvent(new Event('canteen_expenses_updated'));
  window.dispatchEvent(new Event('canteen_members_updated'));
  window.dispatchEvent(new Event('storage'));
}

/**
 * Safe check on startup: Ensures clean slate flag is set without wiping valid cloud records
 */
export function autoCheckInitialCleanSlate() {
  if (typeof window === 'undefined') return;
  try {
    const hasReset = localStorage.getItem(RESET_VERSION_KEY);
    if (!hasReset) {
      localStorage.setItem(RESET_VERSION_KEY, 'true');
    }
  } catch (err) {
    console.warn('Auto check clean slate error:', err);
  }
}

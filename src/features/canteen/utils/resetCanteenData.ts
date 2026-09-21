import { supabase } from '../../../supabase';

export const RESET_VERSION_KEY = 'canteen_clean_slate_v2026_09';

/**
 * Resets all Canteen transactional and financial data:
 * - Sales and transactions (canteen_txs)
 * - Member dues in Supabase (Due = 0) and cached dues
 * - Expenditures (canteen_expenses)
 * - Pre-orders (canteen_pre_orders)
 * - Recent members cache
 */
export async function resetAllCanteenData(resetDatabaseDues: boolean = true) {
  if (resetDatabaseDues) {
    try {
      await supabase.from('Canteen').update({ Due: 0 }).neq('airman_id', '');
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
 * Automatically executed on initial load to ensure stale test data
 * (previous sales, due, expenditures) is wiped out for a brand new clean start.
 */
export function autoCheckInitialCleanSlate() {
  if (typeof window === 'undefined') return;
  try {
    const hasReset = localStorage.getItem(RESET_VERSION_KEY);
    if (!hasReset) {
      localStorage.setItem('canteen_txs', JSON.stringify([]));
      localStorage.setItem('canteen_pre_orders', JSON.stringify([]));
      localStorage.setItem('canteen_expenses', JSON.stringify([]));
      localStorage.setItem('canteen_recent_members', JSON.stringify([]));

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('canteen_member_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      localStorage.setItem(RESET_VERSION_KEY, 'true');

      // Also reset Supabase dues in the background
      Promise.resolve(supabase.from('Canteen').update({ Due: 0 }).neq('airman_id', ''))
        .then(() => {
          window.dispatchEvent(new Event('canteen_members_updated'));
        })
        .catch(() => {});

      window.dispatchEvent(new Event('canteen_txs_updated'));
      window.dispatchEvent(new Event('canteen_state_updated'));
      window.dispatchEvent(new Event('canteen_expenses_updated'));
    }
  } catch (err) {
    console.warn('Auto check clean slate error:', err);
  }
}

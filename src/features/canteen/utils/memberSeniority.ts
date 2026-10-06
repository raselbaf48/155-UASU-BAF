import { supabase } from '../../../supabase';
import { pushKeyToCloud, pullKeyFromCloud } from './canteenCloudSync';

const LOCAL_STORAGE_KEY = 'canteen_member_seniority';

export function getLocalSeniorityMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setLocalSeniorityMap(map: Record<string, number>): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Persist a member's manual Seniority rank position to:
 * 1. LocalStorage
 * 2. Canteen Cloud KV ('app_settings')
 * 3. Supabase 'Biodata Register' table (keeping office app completely in sync)
 */
export async function saveMemberSeniority(bdNo: string, seniority: number | null): Promise<void> {
  const cleanBd = String(bdNo || '').replace(/\D/g, '');
  if (!cleanBd) return;

  const currentMap = getLocalSeniorityMap();
  if (seniority === null || seniority === undefined) {
    delete currentMap[cleanBd];
  } else {
    currentMap[cleanBd] = Number(seniority);
  }

  setLocalSeniorityMap(currentMap);

  try {
    await pushKeyToCloud('canteen_member_seniority', currentMap);
  } catch (err) {
    console.warn('Note pushing canteen_member_seniority to cloud:', err);
  }

  // Update Supabase 'Biodata Register' table if member exists there
  try {
    await supabase
      .from('Biodata Register')
      .update({ Seniority: seniority !== null && seniority !== undefined ? Number(seniority) : null })
      .eq('BD No', cleanBd);
  } catch (err) {
    console.warn('Note updating Biodata Register Seniority:', err);
  }

  // Update Supabase 'Canteen_Member' table as well to keep both in complete sync
  try {
    await supabase
      .from('Canteen_Member')
      .update({ Seniority: seniority !== null && seniority !== undefined ? Number(seniority) : null })
      .eq('BD No', cleanBd);
  } catch (err) {
    console.warn('Note updating Canteen_Member Seniority:', err);
  }
}

/**
 * Persist multiple member seniority updates simultaneously
 */
export async function saveBatchMemberSeniorities(
  updates: Array<{ bdNo: string; seniority: number | null }>
): Promise<void> {
  if (!updates || updates.length === 0) return;

  const currentMap = getLocalSeniorityMap();
  for (const item of updates) {
    const cleanBd = String(item.bdNo || '').replace(/\D/g, '');
    if (!cleanBd) continue;
    if (item.seniority === null || item.seniority === undefined) {
      delete currentMap[cleanBd];
    } else {
      currentMap[cleanBd] = Number(item.seniority);
    }
  }

  setLocalSeniorityMap(currentMap);

  try {
    await pushKeyToCloud('canteen_member_seniority', currentMap);
  } catch (err) {
    console.warn('Note pushing canteen_member_seniority to cloud:', err);
  }

  // Update Supabase 'Biodata Register' and 'Canteen_Member' tables for each
  for (const item of updates) {
    const cleanBd = String(item.bdNo || '').replace(/\D/g, '');
    if (!cleanBd) continue;
    const senVal = item.seniority !== null && item.seniority !== undefined ? Number(item.seniority) : null;
    try {
      await supabase
        .from('Biodata Register')
        .update({ Seniority: senVal })
        .eq('BD No', cleanBd);
    } catch {}
    try {
      await supabase
        .from('Canteen_Member')
        .update({ Seniority: senVal })
        .eq('BD No', cleanBd);
    } catch {}
  }
}

/**
 * Fetch seniority mappings from both Cloud KV and 'Biodata Register' table
 */
export async function fetchAllMemberSeniorities(): Promise<Record<string, number>> {
  const merged: Record<string, number> = { ...getLocalSeniorityMap() };

  // 1. Pull from Biodata Register table
  try {
    const { data, error } = await supabase
      .from('Biodata Register')
      .select('"BD No", Seniority');
    if (!error && Array.isArray(data)) {
      data.forEach((row: any) => {
        const bd = String(row['BD No'] || '').replace(/\D/g, '');
        const s = row.Seniority;
        if (bd && s !== null && s !== undefined && !isNaN(Number(s))) {
          merged[bd] = Number(s);
        }
      });
    }
  } catch (err) {
    console.warn('Note fetching Biodata Register seniorities:', err);
  }

  // 2. Pull from Canteen Cloud KV
  try {
    const cloudKv = await pullKeyFromCloud('canteen_member_seniority');
    if (cloudKv && typeof cloudKv === 'object') {
      Object.assign(merged, cloudKv);
    }
  } catch (err) {
    console.warn('Note pulling canteen_member_seniority from cloud:', err);
  }

  setLocalSeniorityMap(merged);
  return merged;
}

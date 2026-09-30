import { supabase, isSupabaseConfigured } from '../supabase';
import { DutyRatioTable, getStoredDutyMatrix, saveDutyMatrix, INITIAL_OFFICIAL_DUTY_MATRIX } from '../data/officialDutyRatioMatrix';
import { FlightName, Rank } from '../types';

export interface DutyCloudRow {
  id?: number | string;
  ser_no: number;
  duty_name: string;
  eligible_flt: string;
  eligible_rank: string;
  total: number;
  Status?: string;
  status?: string;
  day_1?: number;
  day_2?: number;
  day_3?: number;
  day_4?: number;
  day_5?: number;
  day_6?: number;
  day_7?: number;
  day_8?: number;
  day_9?: number;
  day_10?: number;
  day_11?: number;
  day_12?: number;
  day_13?: number;
  day_14?: number;
  day_15?: number;
  day_16?: number;
  day_17?: number;
  day_18?: number;
  day_19?: number;
  day_20?: number;
  day_21?: number;
  day_22?: number;
  day_23?: number;
  day_24?: number;
  day_25?: number;
  day_26?: number;
  day_27?: number;
  day_28?: number;
  day_29?: number;
  day_30?: number;
  day_31?: number;
  [key: string]: any;
}

export interface DutySyncResult {
  success: boolean;
  message: string;
  count?: number;
  isRlsBlocked?: boolean;
  matrix?: DutyRatioTable[];
}

const TABLE_NAME = 'All Duty & Daily Quota';

/**
 * Parses flight names from comma-separated string or 'All Flt'
 */
function parseEligibleFlights(fltStr?: string): FlightName[] {
  if (!fltStr) return ['Mechanics', 'Avionics', 'GCS', 'Admin'];
  const s = fltStr.trim();
  if (s.toLowerCase() === 'all flt' || s.toLowerCase() === 'all') {
    return ['Mechanics', 'Avionics', 'GCS', 'Admin'];
  }
  const parts = s.split(/[,/|]+/).map(p => p.trim().toLowerCase());
  const res: FlightName[] = [];
  if (parts.some(p => p.includes('mech'))) res.push('Mechanics');
  if (parts.some(p => p.includes('avi'))) res.push('Avionics');
  if (parts.some(p => p.includes('gcs'))) res.push('GCS');
  if (parts.some(p => p.includes('admin'))) res.push('Admin');
  return res.length > 0 ? res : ['Mechanics', 'Avionics', 'GCS', 'Admin'];
}

/**
 * Parses rank names from comma-separated string or helper strings
 */
function parseEligibleRanks(rankStr?: string): Rank[] {
  if (!rankStr) return ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];
  const s = rankStr.trim();
  const lower = s.toLowerCase();
  if (lower === 'cpl & below' || lower === 'cpl and below') {
    return ['Cpl', 'LAC', 'AC-1', 'AC-2'];
  }
  if (lower === 'sgt & below' || lower === 'sgt and below') {
    return ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];
  }
  const allRanks: Rank[] = ['MWO', 'SWO', 'WO', 'Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];
  const parts = s.split(/[,/|]+/).map(p => p.trim().toLowerCase());
  const matched = allRanks.filter(r => parts.includes(r.toLowerCase()));
  return matched.length > 0 ? matched : ['Sgt', 'Cpl', 'LAC', 'AC-1', 'AC-2'];
}

/**
 * Extracts or calculates daily requirements (Day 1 to Day 31) for any duty table
 */
export function getDailyRequirementsFromTable(table: DutyRatioTable): number[] {
  // 1. If table has explicitly stored dailyRequirements with positive values, use it
  if (table.dailyRequirements && table.dailyRequirements.length === 31 && table.dailyRequirements.some(x => x > 0)) {
    return table.dailyRequirements;
  }

  // 2. If table has flight matrix data (Mechanics, Avionics, GCS, Admin), sum each day
  if (table.data) {
    const flights: FlightName[] = ['Mechanics', 'Avionics', 'GCS', 'Admin'];
    const reqs: number[] = [];
    for (let d = 0; d < 31; d++) {
      let daySum = 0;
      for (const fl of flights) {
        daySum += table.data[fl]?.[d] || 0;
      }
      reqs.push(daySum);
    }
    if (reqs.some(x => x > 0)) {
      return reqs;
    }
  }

  // 3. If totalRequiredDaily is set
  if (table.totalRequiredDaily && table.totalRequiredDaily > 0) {
    if (table.totalRequiredMonth && table.totalRequiredMonth < table.totalRequiredDaily * 31) {
      // e.g. totalRequiredMonth is 7 or 22: fill days up to totalRequiredMonth
      const reqs = new Array(31).fill(0);
      let count = 0;
      for (let i = 0; i < 31 && count < table.totalRequiredMonth; i++) {
        reqs[i] = table.totalRequiredDaily;
        count += table.totalRequiredDaily;
      }
      return reqs;
    }
    return new Array(31).fill(table.totalRequiredDaily);
  }

  // 4. If only totalRequiredMonth is set (e.g. 7 for Halishahar)
  if (table.totalRequiredMonth && table.totalRequiredMonth > 0) {
    const reqs = new Array(31).fill(0);
    const daysToFill = Math.min(31, table.totalRequiredMonth);
    for (let i = 0; i < daysToFill; i++) {
      reqs[i] = 1;
    }
    return reqs;
  }

  return new Array(31).fill(0);
}

/**
 * Convert a DutyRatioTable to the Supabase row format
 */
export function formatTableToCloudRow(table: DutyRatioTable, index: number): DutyCloudRow {
  const reqs = getDailyRequirementsFromTable(table);

  // Month Total: Dynamically calculated from daily requirements or stored totalRequiredMonth
  const computedTotal = (table.dailyRequirements && table.dailyRequirements.some(x => x > 0))
    ? table.dailyRequirements.reduce((a, b) => a + (Number(b) || 0), 0)
    : (table.totalRequiredMonth || reqs.reduce((a, b) => a + (Number(b) || 0), 0));

  // Comma-separated list of selected flights
  const fltStr = table.eligibleFlights && table.eligibleFlights.length > 0
    ? table.eligibleFlights.join(', ')
    : 'Mechanics, Avionics, GCS, Admin';

  // Comma-separated list of selected ranks
  const isSecurity = table.title.toLowerCase().includes('security');
  const rankStr = table.eligibleRanks && table.eligibleRanks.length > 0
    ? table.eligibleRanks.join(', ')
    : (isSecurity ? 'Cpl, LAC, AC-1, AC-2' : 'Sgt, Cpl, LAC, AC-1, AC-2');

  const statusStr = table.isDisabled ? 'Disable' : 'Active';

  const row: DutyCloudRow = {
    ser_no: table.serNo !== undefined && table.serNo !== null ? Number(table.serNo) : (index + 1),
    duty_name: table.title || `Duty ${index + 1}`,
    eligible_flt: fltStr,
    eligible_rank: rankStr,
    total: computedTotal,
    Status: statusStr,
  };

  for (let i = 1; i <= 31; i++) {
    row[`day_${i}`] = reqs[i - 1] ?? 0;
  }

  return row;
}

let isSyncInProgress = false;
let pendingMatrixToSync: DutyRatioTable[] | null = null;

/**
 * Push current app Duty List & daily quota to Supabase Cloud Table
 * Strictly updates existing rows in-place and only inserts when a new duty is added
 */
export async function pushDutyListToCloud(matrixInput?: DutyRatioTable[]): Promise<DutySyncResult> {
  if (!isSupabaseConfigured) {
    return { success: false, message: 'Supabase is not configured in .env' };
  }

  if (isSyncInProgress) {
    pendingMatrixToSync = matrixInput || null;
    return { success: true, message: 'Sync queued' };
  }

  isSyncInProgress = true;

  try {
    const matrix = matrixInput && matrixInput.length > 0 ? matrixInput : getStoredDutyMatrix();
    const rows = matrix.map((t, idx) => formatTableToCloudRow(t, idx));

    // Ensure Halishahar taskforce duty (total: 7) is included if not present
    const hasHalishahar = rows.some(r => r.duty_name.toLowerCase().includes('halishahar'));
    if (!hasHalishahar) {
      const hlRow: DutyCloudRow = {
        ser_no: 9,
        duty_name: 'HALISHAHAR TASKFORCE DUTY',
        eligible_flt: 'Mechanics, Avionics, GCS, Admin',
        eligible_rank: 'Sgt, Cpl, LAC, AC-1, AC-2',
        total: 7,
        Status: 'Active',
      };
      for (let i = 1; i <= 31; i++) {
        hlRow[`day_${i}`] = i <= 7 ? 1 : 0;
      }
      rows.push(hlRow);
    }

    // 1. Fetch current rows from database
    const { data: existing, error: selectErr } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('id', { ascending: true });

    if (selectErr) {
      console.warn('[DutyCloudSync] Select error:', selectErr);
      if (selectErr.message?.includes('violates row-level security') || selectErr.message?.includes('RLS')) {
        return {
          success: false,
          isRlsBlocked: true,
          message: 'Row Level Security (RLS) is blocking Cloud Sync. Please disable RLS in Supabase.',
        };
      }
      return { success: false, message: selectErr.message };
    }

    const existingRows = existing || [];

    // Deduplicate existing rows if duplicates exist in database (keep only first row per ser_no)
    const seenSerNo = new Map<number, any>();
    const duplicateIdsToDelete: (number | string)[] = [];
    existingRows.forEach(er => {
      const sNo = Number(er.ser_no);
      if (seenSerNo.has(sNo)) {
        duplicateIdsToDelete.push(er.id);
      } else {
        seenSerNo.set(sNo, er);
      }
    });

    if (duplicateIdsToDelete.length > 0) {
      await supabase.from(TABLE_NAME).delete().in('id', duplicateIdsToDelete);
    }

    // 2. In-place Update or Insert:
    // If a row for this duty already exists -> UPDATE in place (NO NEW ROW IS ADDED)
    // Only if a duty does NOT exist in DB -> INSERT a new row
    for (const row of rows) {
      const sNo = Number(row.ser_no);
      const existingMatch = seenSerNo.get(sNo) || 
        existingRows.find(er => er.duty_name?.trim().toLowerCase() === row.duty_name?.trim().toLowerCase());

      const dayFields: Record<string, number> = {};
      for (let i = 1; i <= 31; i++) {
        dayFields[`day_${i}`] = row[`day_${i}`] ?? 0;
      }

      if (existingMatch) {
        // UPDATE: Replaces the previous values with the new data in place
        const { error: updateErr } = await supabase
          .from(TABLE_NAME)
          .update({
            duty_name: row.duty_name,
            eligible_flt: row.eligible_flt,
            eligible_rank: row.eligible_rank,
            total: row.total,
            Status: row.Status || 'Active',
            ...dayFields,
          })
          .eq('id', existingMatch.id);

        if (updateErr) {
          console.warn('[DutyCloudSync] Error updating row in place:', updateErr);
        }
      } else {
        // INSERT: Only runs when a brand new duty was added in the app!
        const { error: insertErr } = await supabase
          .from(TABLE_NAME)
          .insert([row]);

        if (insertErr) {
          console.warn('[DutyCloudSync] Error inserting new duty row:', insertErr);
        }
      }
    }

    // 3. If a duty was removed from the app, delete only that duty's row
    const currentSerNos = new Set(rows.map(r => Number(r.ser_no)));
    const dutiesToDelete = existingRows.filter(er => !duplicateIdsToDelete.includes(er.id) && !currentSerNos.has(Number(er.ser_no)));
    if (dutiesToDelete.length > 0) {
      const idsToDelete = dutiesToDelete.map(d => d.id);
      await supabase.from(TABLE_NAME).delete().in('id', idsToDelete);
    }

    // Also backup to app_settings
    try {
      await supabase.from('app_settings').upsert({
        setting_key: 'baf_all_duties_cloud_sync',
        setting_value: JSON.stringify(matrix),
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });

      await supabase.from('app_settings').upsert({
        setting_key: 'baf_official_duty_matrix_v4',
        setting_value: JSON.stringify(matrix),
        updated_at: new Date().toISOString()
      }, { onConflict: 'setting_key' });
    } catch (e) {}

    return {
      success: true,
      count: rows.length,
      message: `Successfully updated ${rows.length} duties in Cloud Table!`,
    };
  } catch (err: any) {
    console.error('[DutyCloudSync] Unexpected error pushing to cloud:', err);
    return { success: false, message: err.message || 'Unknown network error' };
  } finally {
    isSyncInProgress = false;
    if (pendingMatrixToSync) {
      const next = pendingMatrixToSync;
      pendingMatrixToSync = null;
      setTimeout(() => pushDutyListToCloud(next), 400);
    }
  }
}

/**
 * Fetch Duty List from Cloud and update the app's matrix
 */
export async function pullDutyListFromCloud(): Promise<DutySyncResult> {
  if (!isSupabaseConfigured) {
    return { success: false, message: 'Supabase is not configured in .env' };
  }

  try {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('*')
      .order('ser_no', { ascending: true });

    if (error) {
      console.warn('[DutyCloudSync] Pull error:', error);
      if (error.message?.includes('violates row-level security') || error.message?.includes('RLS')) {
        return {
          success: false,
          isRlsBlocked: true,
          message: 'Row Level Security (RLS) is blocking Cloud Sync. Please disable RLS in Supabase.',
        };
      }
      return { success: false, message: error.message };
    }

    // If cloud table is empty, auto-push our current app duties to initialize the cloud table!
    if (!data || data.length === 0) {
      console.log('[DutyCloudSync] Cloud table is empty, auto-populating from app...');
      const pushRes = await pushDutyListToCloud();
      if (pushRes.success) {
        return {
          success: true,
          count: pushRes.count,
          message: `Cloud table was empty. Initialized Cloud with ${pushRes.count} app duties!`,
        };
      }
      return pushRes;
    }

    // Convert cloud rows to DutyRatioTable updates
    const currentMatrix = getStoredDutyMatrix();
    const updatedMatrix = [...currentMatrix];

    data.forEach((row: DutyCloudRow, idx: number) => {
      const title = (row.duty_name || '').trim();
      const serNo = row.ser_no || idx + 1;
      const totalMonth = Number(row.total) || 0;

      // Extract daily requirements day_1 to day_31
      const dailyReqs: number[] = [];
      for (let day = 1; day <= 31; day++) {
        dailyReqs.push(Number(row[`day_${day}`]) || 0);
      }

      // Check if this duty exists in currentMatrix by title or serNo or id
      let existingIdx = updatedMatrix.findIndex(
        t => t.title.toLowerCase().trim() === title.toLowerCase().trim() ||
             (t.serNo !== undefined && t.serNo === serNo)
      );

      // Check status from cloud
      const statusRaw = String(row.Status || row.status || '').trim().toLowerCase();
      const isDisabled = statusRaw === 'disable' || statusRaw === 'disabled';

      const eligFlights = parseEligibleFlights(row.eligible_flt);
      const isSingleFlt = eligFlights.length === 1;

      if (existingIdx !== -1) {
        // Update existing table
        const prev = updatedMatrix[existingIdx];
        updatedMatrix[existingIdx] = {
          ...prev,
          title: title || prev.title,
          serNo,
          totalRequiredMonth: totalMonth || prev.totalRequiredMonth,
          dailyRequirements: dailyReqs.some(r => r > 0) ? dailyReqs : prev.dailyRequirements,
          eligibleFlights: eligFlights,
          eligibleRanks: parseEligibleRanks(row.eligible_rank),
          allotmentType: isSingleFlt ? 'equal' : (prev.allotmentType || 'ratio'),
          isDisabled,
        };
      } else {
        // Add new custom duty from cloud
        const newId = `duty_cloud_${serNo}_${Date.now()}`;
        updatedMatrix.push({
          id: newId,
          serNo,
          title,
          dutyCode: 'GD',
          totalRequiredMonth: totalMonth,
          dailyRequirements: dailyReqs,
          eligibleFlights: eligFlights,
          eligibleRanks: parseEligibleRanks(row.eligible_rank),
          allotmentType: isSingleFlt ? 'equal' : 'ratio',
          isDisabled,
          data: {
            Mechanics: new Array(31).fill(0),
            Avionics: new Array(31).fill(0),
            GCS: new Array(31).fill(0),
            Admin: new Array(31).fill(0),
          },
        });
      }
    });

    saveDutyMatrix(updatedMatrix);

    return {
      success: true,
      count: data.length,
      matrix: updatedMatrix,
      message: `Successfully synchronized ${data.length} duties from Cloud!`,
    };
  } catch (err: any) {
    console.error('[DutyCloudSync] Error pulling from cloud:', err);
    return { success: false, message: err.message || 'Unknown network error' };
  }
}

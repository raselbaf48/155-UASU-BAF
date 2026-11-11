import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

export async function migrateAllToSupabase(urlInput?: string, keyInput?: string) {
  const url = urlInput || 
    process.env.SUPABASE_URL || 
    process.env.VITE_SUPABASE_URL || 
    '';

  const key = keyInput || 
    process.env.SUPABASE_SERVICE_ROLE_KEY || 
    process.env.SUPABASE_ANON_KEY || 
    process.env.VITE_SUPABASE_ANON_KEY || 
    '';

  if (!url || !key) {
    console.error('❌ Supabase URL and Key are required!');
    console.error('Usage: npx tsx scripts/migrate_all_to_supabase.ts <SUPABASE_URL> <SUPABASE_KEY>');
    return { success: false, error: 'Missing Supabase URL or Key' };
  }

  console.log(`🚀 Connecting to Supabase at: ${url}...`);
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const DATA_DIR = path.join(process.cwd(), 'data');
  const results: Record<string, number> = {};

  // 1. Migrate Airmen / Biodata Register
  try {
    const bafPath = path.join(DATA_DIR, 'baf_unit_data.json');
    if (fs.existsSync(bafPath)) {
      const bafData = JSON.parse(fs.readFileSync(bafPath, 'utf8'));
      const airmenList = bafData.airmen || [];
      if (airmenList.length > 0) {
        console.log(`📦 Migrating ${airmenList.length} Airmen to "Biodata Register"...`);
        const staffPayload = airmenList.map((a: any, idx: number) => {
          const cleanBd = String(a.bdNo || '').replace(/\D/g, '');
          const airmanId = a.id || (cleanBd ? `BD_${cleanBd}` : `airman_${idx}`);
          return {
            airman_id: airmanId,
            'BD No': cleanBd || a.bdNo || '000000',
            'Rank': a.rank || 'LAC',
            'Surname': a.name || 'Unknown',
            'Full Name': a.fullName || a.name || 'Unknown',
            'Flight': a.flightName || 'Admin',
            'Trade': a.trade || null,
            'Mobile No': a.mobileNo || null,
            'Blood Group': a.bloodGroup || null,
            'Seniority': a.seniority || (idx + 1),
            'Status': a.active === false ? 'SUSPENDED' : 'ACTIVE',
            active: a.active !== false
          };
        });

        // Batch upsert in chunks of 50
        for (let i = 0; i < staffPayload.length; i += 50) {
          const chunk = staffPayload.slice(i, i + 50);
          try {
            const { error } = await supabase.from('Biodata Register').upsert(chunk, { onConflict: 'airman_id' });
            if (error) {
              console.warn(`  ⚠️ Airmen chunk error (retrying individually):`, error.message);
              for (const item of chunk) {
                try { await supabase.from('Biodata Register').upsert([item], { onConflict: 'airman_id' }); } catch {}
              }
            }
          } catch (e: any) {
            console.warn(`  ⚠️ Batch upsert exception:`, e.message);
          }
        }
        results.airmen = staffPayload.length;
        console.log(`  ✅ Successfully migrated ${staffPayload.length} Airmen.`);
      }

      // 2. Migrate Duty Assignments / duty_rosters
      const assignmentsObj = bafData.assignments || {};
      const allAssignments: any[] = [];
      Object.keys(assignmentsObj).forEach((mKey) => {
        const list = assignmentsObj[mKey] || [];
        allAssignments.push(...list);
      });

      if (allAssignments.length > 0) {
        console.log(`📦 Migrating ${allAssignments.length} Duty Assignments to "duty_rosters"...`);
        const rosterPayload = allAssignments.map((a: any) => ({
          assignment_id: a.id || a.assignment_id || `asn_${a.airmanId}_${a.date}_${a.dutyCode}_${a.idaShift || 'n'}_${a.disposalScope || 'ALL'}`,
          airman_id: a.airmanId,
          date: a.date,
          duty_code: a.dutyCode,
          shift: a.shift || (['IDAC', 'IDA'].includes(a.dutyCode) ? (a.idaShift || 'Morning') : 'D'),
          ida_shift: a.idaShift || null,
          disposal_scope: a.disposalScope || 'ALL',
          notes: a.notes || '',
          updated_at: a.updatedAt || new Date().toISOString()
        }));

        for (let i = 0; i < rosterPayload.length; i += 100) {
          const chunk = rosterPayload.slice(i, i + 100);
          try {
            const { error } = await supabase.from('duty_rosters').upsert(chunk, { onConflict: 'assignment_id' });
            if (error) {
              console.warn(`  ⚠️ Duty rosters chunk error:`, error.message);
            }
          } catch (e: any) {
            console.warn(`  ⚠️ Duty rosters exception:`, e.message);
          }
        }
        results.dutyAssignments = rosterPayload.length;
        console.log(`  ✅ Successfully migrated ${rosterPayload.length} Duty Assignments.`);
      }

      // 3. Migrate Activity History / parade_states
      const historyList = bafData.activityHistory || [];
      if (historyList.length > 0) {
        console.log(`📦 Migrating ${historyList.length} History Logs to "parade_states"...`);
        const historyPayload = historyList.map((h: any, idx: number) => ({
          log_id: h.id || `hist_${h.date || 'unknown'}_${idx}`,
          airman_id: h.airmanId || h.airman_id || '',
          action_type: h.actionType || h.type || 'DUTY_ASSIGNED',
          duty_code: h.dutyCode || h.duty_code || '',
          from_date: h.fromDate || h.from_date || h.date,
          to_date: h.toDate || h.to_date || h.date,
          ida_shift: h.idaShift || h.ida_shift || null,
          notes: h.notes || h.description || '',
          timestamp: h.timestamp || h.updatedAt || new Date().toISOString()
        }));

        for (let i = 0; i < historyPayload.length; i += 100) {
          const chunk = historyPayload.slice(i, i + 100);
          try {
            await supabase.from('parade_states').upsert(chunk, { onConflict: 'log_id' });
          } catch {}
        }
        results.history = historyPayload.length;
        console.log(`  ✅ Successfully migrated ${historyPayload.length} History Logs.`);
      }

      // 4. Migrate User Accounts / user_profiles
      const usersList = bafData.detailedUsers || [];
      if (usersList.length > 0) {
        console.log(`📦 Migrating ${usersList.length} User Profiles to "user_profiles"...`);
        const userPayload = usersList.map((u: any) => ({
          'User ID': u.bdNo || u.userId || u.id,
          'PIN': u.pin || u.password || '1234',
          'Role': u.role || 'USER',
          'Status': u.status || 'ACTIVE',
          'Last Login': u.lastLogin || new Date().toISOString()
        }));
        try {
          await supabase.from('user_profiles').upsert(userPayload, { onConflict: 'User ID' });
        } catch {}
        results.users = userPayload.length;
        console.log(`  ✅ Successfully migrated ${userPayload.length} User Profiles.`);
      }
    }
  } catch (err: any) {
    console.error('Error migrating core unit data:', err);
  }

  // 5. Migrate Canteen Members
  try {
    const canteenMemPath = path.join(DATA_DIR, 'canteen_members.json');
    if (fs.existsSync(canteenMemPath)) {
      const memList = JSON.parse(fs.readFileSync(canteenMemPath, 'utf8'));
      if (Array.isArray(memList) && memList.length > 0) {
        console.log(`📦 Migrating ${memList.length} Canteen Members to "Canteen_Member"...`);
        const canteenPayload = memList.map((m: any, idx: number) => {
          const cleanBd = String(m['BD No'] || m.bdNo || '').replace(/\D/g, '');
          return {
            airman_id: m.airman_id || (cleanBd ? `BD/${cleanBd}` : `airman_${idx}`),
            'BD No': cleanBd || m['BD No'] || m.bdNo || '000000',
            'Rank': m['Rank'] || m.rank || 'LAC',
            'Surname': m['Surname'] || m.surname || m.name || '',
            'Contact': m['Contact'] || m.contact || '',
            'Due': Number(m['Due'] !== undefined ? m['Due'] : (m.due || 0)),
            'Role': m['Role'] || m.role || 'Member',
            'DP': m['DP'] || m.dp || '',
            'Seniority': m['Seniority'] !== undefined ? m['Seniority'] : (idx + 1),
            'Flight': m['Flight'] || m.flight || 'Admin',
            'Name_BN': m['Name_BN'] || m.nameBn || '',
            'Rank_BN': m['Rank_BN'] || m.rankBn || '',
            active: m.active !== false
          };
        });

        for (let i = 0; i < canteenPayload.length; i += 50) {
          const chunk = canteenPayload.slice(i, i + 50);
          try {
            await supabase.from('Canteen_Member').upsert(chunk, { onConflict: 'airman_id' });
          } catch {}
        }
        results.canteenMembers = canteenPayload.length;
        console.log(`  ✅ Successfully migrated ${canteenPayload.length} Canteen Members.`);
      }
    }
  } catch (err: any) {
    console.error('Error migrating canteen members:', err);
  }

  // 6. Migrate Canteen Transactions
  try {
    const canteenTxPath = path.join(DATA_DIR, 'canteen_transactions.json');
    if (fs.existsSync(canteenTxPath)) {
      const txList = JSON.parse(fs.readFileSync(canteenTxPath, 'utf8'));
      if (Array.isArray(txList) && txList.length > 0) {
        console.log(`📦 Migrating ${txList.length} Canteen Transactions to "Canteen_Transactions"...`);
        const txPayload = txList.map((tx: any, idx: number) => ({
          id: tx.id || `tx_${idx}`,
          created_at: tx.created_at || tx.createdAt || new Date().toISOString(),
          date: tx.date || new Date().toISOString().substring(0, 10),
          airman_id: tx.airman_id || tx.memberId || tx.bdNo || '',
          rank: tx.rank || '',
          items: typeof tx.items === 'string' ? tx.items : JSON.stringify(tx.items || []),
          amount: Number(tx.amount || 0),
          type: tx.type || 'BILL',
          gateway: tx.gateway || 'DUE'
        }));

        for (let i = 0; i < txPayload.length; i += 50) {
          const chunk = txPayload.slice(i, i + 50);
          try {
            await supabase.from('Canteen_Transactions').upsert(chunk, { onConflict: 'id' });
          } catch {}
        }
        results.canteenTransactions = txPayload.length;
        console.log(`  ✅ Successfully migrated ${txPayload.length} Canteen Transactions.`);
      }
    }
  } catch (err: any) {
    console.error('Error migrating canteen transactions:', err);
  }

  // 7. Migrate App Settings
  try {
    const settingsPath = path.join(DATA_DIR, 'app_settings.json');
    if (fs.existsSync(settingsPath)) {
      const settingsObj = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      const settingsList = Object.keys(settingsObj).map((key) => {
        const val = settingsObj[key];
        const valStr = typeof val === 'string' 
          ? val 
          : (val && typeof val === 'object' && val.setting_value !== undefined 
              ? (typeof val.setting_value === 'string' ? val.setting_value : JSON.stringify(val.setting_value)) 
              : JSON.stringify(val));
        return {
          setting_key: key,
          setting_value: valStr,
          updated_at: new Date().toISOString()
        };
      });

      if (settingsList.length > 0) {
        console.log(`📦 Migrating ${settingsList.length} App Settings to "app_settings"...`);
        for (let i = 0; i < settingsList.length; i += 50) {
          const chunk = settingsList.slice(i, i + 50);
          try {
            await supabase.from('app_settings').upsert(chunk, { onConflict: 'setting_key' });
          } catch {}
        }
        results.appSettings = settingsList.length;
        console.log(`  ✅ Successfully migrated ${settingsList.length} App Settings.`);
      }
    }
  } catch (err: any) {
    console.error('Error migrating app settings:', err);
  }

  console.log('🎉 Migration Completed Successfully!');
  console.log(JSON.stringify(results, null, 2));
  return { success: true, results };
}

// Allow CLI execution: npx tsx scripts/migrate_all_to_supabase.ts <URL> <KEY>
if (process.argv[1] && process.argv[1].endsWith('migrate_all_to_supabase.ts')) {
  const argUrl = process.argv[2];
  const argKey = process.argv[3];
  migrateAllToSupabase(argUrl, argKey).then((r) => {
    if (!r.success) process.exit(1);
  });
}

const fs = require('fs');
const https = require('https');

const projectId = "gen-lang-client-0792290659";
const databaseId = "ai-studio-155uasubaf-62d91e48-dc65-405a-a245-7b93430c79c8";
const apiKey = "AIzaSyDf2hvt5Pt8AwWSmkV_1yvSCQCpLtlKsiA";

function convertToFirestoreValue(val) {
  if (val === null || val === undefined) {
    return { nullValue: null };
  }
  if (typeof val === 'boolean') {
    return { booleanValue: val };
  }
  if (typeof val === 'number') {
    if (Number.isInteger(val)) {
      return { integerValue: String(val) };
    }
    return { doubleValue: val };
  }
  if (typeof val === 'string') {
    return { stringValue: val };
  }
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(convertToFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = convertToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function objectToFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = convertToFirestoreValue(v);
  }
  return { fields };
}

function firestoreSetDoc(collection, docId, data) {
  return new Promise((resolve, reject) => {
    const cleanDocId = encodeURIComponent(String(docId).replace(/\//g, '_'));
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collection}/${cleanDocId}?key=${apiKey}`;
    const payload = JSON.stringify(objectToFirestoreFields(data));

    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(true);
        } else {
          console.error(`Failed ${collection}/${cleanDocId} [${res.statusCode}]:`, body.slice(0, 150));
          resolve(false);
        }
      });
    });
    req.on('error', (err) => {
      console.error(`Request error ${collection}/${cleanDocId}:`, err.message);
      resolve(false);
    });
    req.write(payload);
    req.end();
  });
}

async function runMigration() {
  console.log("=== STARTING FULL MIGRATION TO FIREBASE FIRESTORE ===");
  let airmenCount = 0;
  let dutyCount = 0;
  let paradeCount = 0;
  let memberCount = 0;
  let settingsCount = 0;

  // 1. Canteen Members
  if (fs.existsSync('data/canteen_members.json')) {
    const members = JSON.parse(fs.readFileSync('data/canteen_members.json', 'utf8'));
    console.log(`Migrating ${members.length} Canteen Members...`);
    for (const m of members) {
      const docId = String(m.airman_id || m['BD No'] || `member_${Date.now()}`).replace(/\//g, '_');
      const cleanBd = String(m['BD No'] || m.service_number || '').replace(/\D/g, '');
      const record = {
        airman_id: docId,
        service_number: cleanBd || m['BD No'] || '',
        name: m.Surname || m.surname || m.Name || m.name || '',
        rank: m.Rank || m.rank || 'LAC',
        section: m.Section || m.section || m.Flight || 'Admin',
        phone: m.Contact || m['Contact Number'] || m.phone || '',
        avatar: (typeof m.DP === 'string' && m.DP.length < 500000) ? m.DP : '',
        total_due: Number(m.Due ?? m.total_due ?? 0),
        canteen_balance: Number(m.Balance ?? m.canteen_balance ?? 0),
        status: m.active !== false ? 'Active' : 'Inactive',
        name_bn: m.Name_BN || m.name_bn || '',
        rank_bn: m.Rank_BN || m.rank_bn || '',
        role: m.Role || 'Member',
        updated_at: new Date().toISOString()
      };
      const ok = await firestoreSetDoc('canteen_members', docId, record);
      if (ok) memberCount++;
    }
  }

  // 2. App Settings & Canteen Cloud Keys
  if (fs.existsSync('data/app_settings.json')) {
    const settings = JSON.parse(fs.readFileSync('data/app_settings.json', 'utf8'));
    const keys = Object.keys(settings);
    console.log(`Migrating ${keys.length} Settings keys...`);
    for (const key of keys) {
      const val = settings[key];
      const strVal = typeof val === 'string' ? val : JSON.stringify(val);
      const record = {
        setting_key: key,
        setting_value: strVal,
        updated_at: new Date().toISOString()
      };
      const ok = await firestoreSetDoc('app_settings', key, record);
      if (ok) settingsCount++;
    }
  }

  // 3. Airmen, Assignments & Parade States from baf_unit_data.json
  if (fs.existsSync('data/baf_unit_data.json')) {
    const unit = JSON.parse(fs.readFileSync('data/baf_unit_data.json', 'utf8'));

    // Airmen
    if (Array.isArray(unit.airmen)) {
      console.log(`Migrating ${unit.airmen.length} Airmen...`);
      for (const a of unit.airmen) {
        const docId = String(a.id || a.airman_id || a.bdNo).replace(/\//g, '_');
        const bdNo = String(a.bdNo || a['BD No'] || '');
        const rank = a.rank || a.Rank || 'LAC';
        const name = a.name || a.Name || a.fullName || 'Airman';
        const photo = (typeof a.photo === 'string' && a.photo.length < 500000) ? a.photo : '';

        const record = {
          airman_id: docId,
          id: docId,
          bdNo: bdNo,
          rank: rank,
          name: name,
          fullName: a.fullName || a['Full Name'] || name,
          flightName: a.flightName || a.flight || a.Section || 'Admin',
          trade: a.trade || a.Trade || 'General',
          bloodGroup: a.bloodGroup || a['Blood Group'] || '',
          contactNumber: a.contactNumber || a.mobileNo || a['Contact Number'] || '',
          presentAddress: a.presentAddress || a.addressBlock || 'L/O',
          permanentAddress: a.permanentAddress || '',
          dateOfBirth: a.dateOfBirth || '',
          dateJoined: a.dateJoined || '',
          active: a.active !== false,
          photoUrl: photo,
          seniority: Number(a.seniority ?? a.Seniority ?? 0),
          serNo: Number(a.serNo ?? a.seniority ?? 1),
          code: a.code || `${rank}-${name.slice(0, 3).toUpperCase()}`,
          remarks: a.remarks || '',
          updatedAt: new Date().toISOString()
        };
        const ok = await firestoreSetDoc('airmen', docId, record);
        if (ok) airmenCount++;
      }
    }

    // Duty Assignments
    if (unit.assignments && typeof unit.assignments === 'object') {
      const monthKeys = Object.keys(unit.assignments);
      console.log(`Migrating assignments across ${monthKeys.length} months...`);
      for (const mKey of monthKeys) {
        const arr = unit.assignments[mKey];
        if (Array.isArray(arr)) {
          for (const d of arr) {
            const docId = String(d.id || `${d.airmanId}_${d.date}_${d.shift || 'D'}`).replace(/\//g, '_');
            const record = {
              id: docId,
              assignmentId: docId,
              airmanId: d.airmanId || '',
              date: d.date || '',
              shift: d.shift || 'D',
              dutyType: d.dutyType || 'DUTY',
              dutyTypeCode: d.dutyTypeCode || d.dutyType || 'DUTY',
              monthKey: mKey,
              remarks: d.remarks || '',
              status: d.status || 'SCHEDULED',
              updatedAt: new Date().toISOString()
            };
            const ok = await firestoreSetDoc('duty_rosters', docId, record);
            if (ok) dutyCount++;
          }
        }
      }
    }

    // Parade Activity History
    if (Array.isArray(unit.activityHistory)) {
      console.log(`Migrating ${unit.activityHistory.length} Parade State entries...`);
      for (const p of unit.activityHistory) {
        const docId = String(p.id || `parade_${p.date}_${p.shift || 'MORNING'}`).replace(/\//g, '_');
        const record = {
          id: docId,
          date: p.date || '',
          shift: p.shift || 'MORNING',
          status: p.status || '',
          remarks: p.remarks || '',
          data: typeof p.data === 'string' ? p.data : JSON.stringify(p.data || {}),
          timestamp: p.timestamp || new Date().toISOString()
        };
        const ok = await firestoreSetDoc('parade_states', docId, record);
        if (ok) paradeCount++;
      }
    }
  }

  // 4. Create initial latest app_version record
  await firestoreSetDoc('app_versions', 'latest', {
    version_code: 1,
    version_name: '1.0.0',
    apk_url: '',
    release_notes: 'Initial production build with Firebase Firestore integration',
    created_at: new Date().toISOString()
  });

  console.log("\n=== MIGRATION COMPLETED SUCCESSFULLY ===");
  console.log(`✓ Canteen Members: ${memberCount}`);
  console.log(`✓ App Settings & Cloud Keys: ${settingsCount}`);
  console.log(`✓ Airmen Records: ${airmenCount}`);
  console.log(`✓ Duty Assignments: ${dutyCount}`);
  console.log(`✓ Parade State Entries: ${paradeCount}`);
}

runMigration().catch(console.error);

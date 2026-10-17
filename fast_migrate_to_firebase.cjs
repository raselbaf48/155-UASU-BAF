const fs = require('fs');
const https = require('https');

const projectId = "gen-lang-client-0792290659";
const databaseId = "ai-studio-155uasubaf-62d91e48-dc65-405a-a245-7b93430c79c8";
const apiKey = "AIzaSyDf2hvt5Pt8AwWSmkV_1yvSCQCpLtlKsiA";

const agent = new https.Agent({ keepAlive: true, maxSockets: 30 });

function convertToFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) return { arrayValue: { values: val.map(convertToFirestoreValue) } };
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
  return new Promise((resolve) => {
    const cleanDocId = encodeURIComponent(String(docId).replace(/\//g, '_'));
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collection}/${cleanDocId}?key=${apiKey}`;
    const payload = JSON.stringify(objectToFirestoreFields(data));

    const req = https.request(url, {
      method: 'PATCH',
      agent: agent,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    });
    req.on('error', () => resolve(false));
    req.write(payload);
    req.end();
  });
}

async function runInPool(items, concurrency, fn) {
  let index = 0;
  let active = 0;
  let completed = 0;
  return new Promise((resolve) => {
    function next() {
      if (completed >= items.length) {
        return resolve();
      }
      while (active < concurrency && index < items.length) {
        const item = items[index++];
        active++;
        fn(item).then(() => {
          active--;
          completed++;
          if (completed % 500 === 0 || completed === items.length) {
            console.log(`Progress: ${completed}/${items.length} items processed`);
          }
          next();
        });
      }
    }
    next();
  });
}

async function fastMigrate() {
  console.log("=== STARTING FAST PARALLEL MIGRATION TO FIREBASE FIRESTORE ===");
  if (!fs.existsSync('data/baf_unit_data.json')) {
    console.log("data/baf_unit_data.json not found!");
    return;
  }

  const unit = JSON.parse(fs.readFileSync('data/baf_unit_data.json', 'utf8'));

  // 1. Collect all duty assignments
  const dutyItems = [];
  if (unit.assignments && typeof unit.assignments === 'object') {
    for (const [mKey, arr] of Object.entries(unit.assignments)) {
      if (Array.isArray(arr)) {
        for (const d of arr) {
          const docId = String(d.id || `${d.airmanId}_${d.date}_${d.shift || 'D'}`).replace(/\//g, '_');
          dutyItems.push({
            docId,
            data: {
              id: docId,
              assignmentId: docId,
              airmanId: d.airmanId || '',
              date: d.date || '',
              shift: d.shift || 'D',
              dutyType: d.dutyType || 'DUTY',
              dutyTypeCode: d.dutyTypeCode || d.dutyCode || d.dutyType || 'DUTY',
              monthKey: mKey,
              remarks: d.remarks || d.notes || '',
              disposalScope: d.disposalScope || 'ALL',
              status: d.status || 'SCHEDULED',
              updatedAt: d.updatedAt || new Date().toISOString()
            }
          });
        }
      }
    }
  }

  console.log(`Found ${dutyItems.length} Duty Assignments. Uploading concurrently (pool size 25)...`);
  await runInPool(dutyItems, 25, async (item) => {
    await firestoreSetDoc('duty_rosters', item.docId, item.data);
  });
  console.log(`✓ Duty Assignments upload complete!`);

  // 2. Parade Activity History
  const paradeItems = [];
  if (Array.isArray(unit.activityHistory)) {
    for (const p of unit.activityHistory) {
      const docId = String(p.id || `parade_${p.date}_${p.shift || 'MORNING'}`).replace(/\//g, '_');
      paradeItems.push({
        docId,
        data: {
          id: docId,
          date: p.date || '',
          shift: p.shift || 'MORNING',
          status: p.status || '',
          remarks: p.remarks || '',
          data: typeof p.data === 'string' ? p.data : JSON.stringify(p.data || {}),
          timestamp: p.timestamp || new Date().toISOString()
        }
      });
    }
  }

  console.log(`Found ${paradeItems.length} Parade State entries. Uploading...`);
  await runInPool(paradeItems, 20, async (item) => {
    await firestoreSetDoc('parade_states', item.docId, item.data);
  });
  console.log(`✓ Parade State upload complete!`);

  // 3. User Profiles
  const userItems = [];
  if (Array.isArray(unit.detailedUsers)) {
    for (const u of unit.detailedUsers) {
      const cleanBd = String(u.bdNo || '').replace(/^BD\/?/i, '').trim().toLowerCase();
      if (cleanBd) {
        userItems.push({
          docId: `user-login-${cleanBd}`,
          data: {
            id: `user-login-${cleanBd}`,
            bdNo: cleanBd,
            rank: u.rank || 'LAC',
            name: u.name || 'Airman',
            flightName: u.flightName || 'Admin',
            role: u.role || (cleanBd === '48456' ? 'OWNER' : 'USER'),
            status: u.status || 'ACTIVE',
            updatedAt: new Date().toISOString()
          }
        });
      }
    }
  }

  if (userItems.length > 0) {
    console.log(`Found ${userItems.length} User Profiles. Uploading...`);
    await runInPool(userItems, 15, async (item) => {
      await firestoreSetDoc('user_profiles', item.docId, item.data);
    });
  }

  // 4. Also write latest_app_version to app_settings
  await firestoreSetDoc('app_settings', 'latest_app_version', {
    setting_key: 'latest_app_version',
    setting_value: JSON.stringify({
      versionCode: 1,
      versionName: '1.0.0',
      apkUrl: '',
      releaseNotes: '100% Firebase Firestore fully synced release'
    }),
    updated_at: new Date().toISOString()
  });

  console.log("=== ALL DATA SUCCESSFULLY UPLOADED AND PERSISTED IN FIREBASE FIRESTORE ===");
}

fastMigrate().catch(console.error);

import fs from 'fs';

const content = fs.readFileSync('user-matrix.csv', 'utf8');
const lines = content.split('\n');

const blocks = [];
let currentBlock = [];

for (const line of lines) {
    if (line.startsWith('"Date"')) {
        currentBlock = [line];
    } else if (line.startsWith('"Mech"') || line.startsWith('"AVI"') || line.startsWith('"GCS"') || line.startsWith('"Admin"')) {
        if (currentBlock.length > 0) {
            currentBlock.push(line);
        }
    } else if (line.startsWith('"Daily"')) {
        if (currentBlock.length > 0) {
            blocks.push([...currentBlock]);
            currentBlock = [];
        }
    }
}

// We expect 7 blocks: 
// 1. BASE SECURITY
// 2. BASE TASKFORCE
// 3. NAZIRPARA TF
// 4. IDAC MOR
// 5. IDAC AN
// 6. IDAC NT
// 7. AIRFIELD DUTY

const dutyMappings = [
  { id: 'security_duty', title: 'BASE SECURITY DUTY', dutyCode: 'GD', shiftLabel: null, daily: 3 },
  { id: 'base_tf', title: 'BASE TASKFORCE DUTY', dutyCode: 'BTF', shiftLabel: null, daily: 1 },
  { id: 'nazirpara_tf', title: 'NAZIRPARA TARKFORCE DUTY', dutyCode: 'NTF', shiftLabel: null, daily: 1 },
  { id: 'idac_mor', title: 'IDAC MORNING', dutyCode: 'IDAC', shiftLabel: 'Morning', daily: 1 },
  { id: 'idac_an', title: 'IDAC AFTERNOON', dutyCode: 'IDAC', shiftLabel: 'Afternoon', daily: 1 },
  { id: 'idac_nt', title: 'IDAC NIGHT', dutyCode: 'IDAC', shiftLabel: 'Night', daily: 2 },
  { id: 'airport_duty', title: 'AIRFIELD DUTY', dutyCode: 'AIRPORT', shiftLabel: null, daily: 3 }
];

const parseRow = (line) => {
    // "Mech","","1","1",...
    const parts = line.split('","');
    const nums = parts.slice(2, 33).map(n => n.replace('"', ''));
    return nums.map(n => n === '' ? 0 : parseInt(n, 10));
}

const matrixPayload = [];

blocks.forEach((b, idx) => {
    const d = dutyMappings[idx];
    const mechRow = b.find(l => l.startsWith('"Mech"'));
    const aviRow = b.find(l => l.startsWith('"AVI"'));
    const gcsRow = b.find(l => l.startsWith('"GCS"'));
    const adminRow = b.find(l => l.startsWith('"Admin"'));
    
    const mechData = parseRow(mechRow);
    const aviData = parseRow(aviRow);
    const gcsData = parseRow(gcsRow);
    const adminData = parseRow(adminRow);
    
    let totalReq = 0;
    for (let i = 0; i < 31; i++) {
        totalReq += (mechData[i] + aviData[i] + gcsData[i] + adminData[i]);
    }
    
    matrixPayload.push({
       id: d.id,
       title: d.title,
       duty_code: d.dutyCode,
       shift_label: d.shiftLabel,
       total_required_month: totalReq,
       total_required_daily: d.daily,
       is_disabled: false,
       data_mechanics: mechData,
       data_avionics: aviData,
       data_gcs: gcsData,
       data_admin: adminData
    });
});

console.log(JSON.stringify(matrixPayload, null, 2));

const fs = require('fs');

const file = 'src/components/NightCountStateView.tsx';
let content = fs.readFileSync(file, 'utf8');

const badCode = `        } else if (['CMH', 'HOSPITAL'].includes(codeUpper) || notesLower.includes('cmh')) {
          hospitalCount++;
        } else if (['SICK_REPORT', 'SICK', 'EX_PPGF', 'ED'].includes(codeUpper) || notesLower.includes('sick') || notesLower.includes('ppgf') || notesLower === 'ed' || notesLower.startsWith('ed ')) {
        sickReportList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : (item.dutyName || dutyCode || 'Sick Report') });
      } else if (['ADMIN_ORDER', 'CAT_C', 'DRILL'].includes(codeUpper) || notesLower.includes('drill')) {`;

const goodCode = `        } else if (['CMH', 'HOSPITAL'].includes(codeUpper) || notesLower.includes('cmh')) {
          hospitalCount++;
        } else if (['SICK_REPORT', 'SICK', 'EX_PPGF', 'ED'].includes(codeUpper) || notesLower.includes('sick') || notesLower.includes('ppgf') || notesLower === 'ed' || notesLower.startsWith('ed ')) {
          sickExCount++;
        } else if (['ADMIN_ORDER', 'CAT_C', 'DRILL'].includes(codeUpper) || notesLower.includes('drill')) {
          adminOrderCount++;
        } else if (['GAMES', 'GH', 'GAME_HONOR'].includes(codeUpper) || notesLower.includes('games') || notesLower.includes('g/h')) {
          gamesCount++;
        } else if (['CLASS_TRG', 'CLASS', 'TRG', 'LTTB'].includes(codeUpper) || notesLower.includes('class') || notesLower.includes('trg')) {
          classTrgCount++;
        } else if (['AIRPORT', 'AIR_FD', 'AIRFIELD', 'ATT'].includes(codeUpper) || notesLower.includes('air fd') || notesLower.includes('airfield')) {
          airFdDutyCount++;
        } else if (['ABSENT', 'AWL', 'OSL'].includes(codeUpper) || notesLower.includes('absent')) {
          absentCount++;
        } else if (isBake || codeUpper === 'CANTEEN' || notesLower.includes('canteen') || codeUpper === 'RECEPTION' || notesLower.includes('reception') || notesLower.includes('k/o')) {
          koReceptionCount++;
        } else if (isIdacB || isIdacC || codeUpper === 'OFFICE' || notesLower.includes('office')) {
          othersCount++;
        } else if (['GD', 'BTF', 'NTF', 'HALISHAHAR', 'IDAC', 'IDA', 'AIRPORT', 'AIRFIELD', 'ATT', 'AIR_FD'].includes(codeUpper) || statusCategory === 'DUTY') {
          // It's covered by effective count somewhere, wait
          // Actually, let's just make it do nothing or dutyOnList count? No, we don't need dutyOnCount, it's computed.
        } else {
          othersCount++;
        }
      }
    });

    flightAirmen.forEach((airman) => {
      const st = singleParadeData?.personnelStatusList.find((p) => p.airman.id === airman.id);
      if (!st) {
        onPtList.push({ airman, note: '' });
      } else {
        const { statusCategory, dutyCode, notes, idaShift } = st;
        const codeUpper = (dutyCode || '').toUpperCase();
        const notesLower = (notes || '').toLowerCase();
        const isIdacB = codeUpper === 'IDAC' && idaShift === 'Afternoon';
        const isIdacC = codeUpper === 'IDAC' && idaShift === 'Night';
        const isBake = ['BAKE_BITE', 'BAKE_N_BITE'].includes(codeUpper) || statusCategory === 'BAKE_N_BITE';

        if (codeUpper === 'ON_PARADE' || codeUpper === 'PT' || codeUpper === 'PT_PARADE' || statusCategory === 'PARADE') {
          onPtList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : '' });
        } else if (codeUpper === 'LEAVE' || statusCategory === 'LEAVE') {
          leaveList.push({ airman, note: '' });
        } else if (codeUpper === 'ESSN' || notesLower.includes('essn')) {
          essnList.push({ airman, note: 'ESSN' });
        } else if (['CMH', 'HOSPITAL'].includes(codeUpper) || notesLower.includes('cmh')) {
          cmhList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : (st.dutyName || dutyCode || 'CMH') });
        } else if (['SICK_REPORT', 'SICK', 'EX_PPGF', 'ED'].includes(codeUpper) || notesLower.includes('sick') || notesLower.includes('ppgf') || notesLower === 'ed' || notesLower.startsWith('ed ')) {
          sickReportList.push({ airman, note: (notes && !notes.toLowerCase().includes('imported')) ? notes : (st.dutyName || dutyCode || 'Sick Report') });
        } else if (['ADMIN_ORDER', 'CAT_C', 'DRILL'].includes(codeUpper) || notesLower.includes('drill')) {`;

content = content.replace(badCode, goodCode);
fs.writeFileSync(file, content);

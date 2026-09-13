const fs = require('fs');
const path = 'src/components/AddEditAirmanModal.tsx';
let content = fs.readFileSync(path, 'utf8');

const target1 = `  const [svcQtrNo, setSvcQtrNo] = useState<string>(() => {
    if (airmanToEdit?.addressBlock) {
      const match = airmanToEdit.addressBlock.match(/Svc\\s*Qtr\\s*(?:No[:\\s]*)?([^,]+)/i) || airmanToEdit.addressBlock.match(/Qtr\\s*(?:No[:\\s]*)?([^,]+)/i);
      if (match) return match[1].trim();
      if (airmanToEdit.addressBlock.toLowerCase().includes('qtr')) {
        return airmanToEdit.addressBlock.replace(/Svc|Qtr|No|:/gi, '').trim();
      }
    }
    return '';
  });`;

const replace1 = `  const [svcQtrNo, setSvcQtrNo] = useState<string>(() => {
    if (airmanToEdit?.addressBlock) {
      if (airmanToEdit.addressBlock.toLowerCase().includes('qtr') || airmanToEdit.addressBlock.toLowerCase().includes('quarter')) {
        const match = airmanToEdit.addressBlock.match(/Svc\\s*Qtr\\s*(?:No[:\\s]*)?([^,]+)/i) || airmanToEdit.addressBlock.match(/Qtr\\s*(?:No[:\\s]*)?([^,]+)/i);
        if (match) return \`Svc Qtr No: \${match[1].trim()}\`;
        return airmanToEdit.addressBlock.trim();
      }
    }
    return 'Svc Qtr No: ';
  });`;

const target2 = `      if (livingOutType === 'QUARTER') {
        if (svcQtrNo.trim()) {
          return \`Svc Qtr No: \${svcQtrNo.trim()}\`;
        }
        return 'Svc Qtr';
      }`;

const replace2 = `      if (livingOutType === 'QUARTER') {
        if (svcQtrNo.trim()) {
          return svcQtrNo.trim();
        }
        return 'Svc Qtr No: ';
      }`;

content = content.replace(target1, replace1).replace(target2, replace2);
fs.writeFileSync(path, content);

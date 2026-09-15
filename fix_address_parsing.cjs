const fs = require('fs');
let modal = fs.readFileSync('src/components/AddEditAirmanModal.tsx', 'utf8');

const livingTypeRegex = /const \[livingType, setLivingType\] = useState\<'L_IN' \| 'L_OUT' \| null\>\(\(\) => \{[\s\S]*?return null;\s*\}\);/;
const livingTypeReplacement = `const [livingType, setLivingType] = useState<'L_IN' | 'L_OUT' | null>(() => {
    if (airmanToEdit?.addressBlock) {
      const lower = airmanToEdit.addressBlock.toLowerCase();
      if (lower.includes('mess') || lower.match(/block/i) || lower === 'l/i' || lower === 'live in') {
        return 'L_IN';
      }
      if (lower.trim() !== '' && lower !== '-' && lower !== 'n/a' && lower !== 'l/o') {
        return 'L_OUT';
      }
    }
    return null;
  });`;

const livingOutTypeRegex = /const \[livingOutType, setLivingOutType\] = useState\<'QUARTER' \| 'OUTSIDE_BASE'\>\(\(\) => \{[\s\S]*?return 'QUARTER';\s*\}\);/;
const livingOutTypeReplacement = `const [livingOutType, setLivingOutType] = useState<'QUARTER' | 'OUTSIDE_BASE'>(() => {
    if (airmanToEdit?.addressBlock) {
      const lower = airmanToEdit.addressBlock.toLowerCase();
      if (lower.includes('qtr') || lower.includes('quarter')) {
        return 'QUARTER';
      }
      return 'OUTSIDE_BASE';
    }
    return 'QUARTER';
  });`;

const outsideAddressRegex = /const \[outsideAddress, setOutsideAddress\] = useState\<string\>\(\(\) => \{[\s\S]*?return '';\s*\}\);/;
const outsideAddressReplacement = `const [outsideAddress, setOutsideAddress] = useState<string>(() => {
    if (airmanToEdit?.addressBlock) {
      const lower = airmanToEdit.addressBlock.toLowerCase();
      if (!lower.includes('qtr') && !lower.includes('quarter') && !lower.includes('mess') && !lower.match(/block/i)) {
        return airmanToEdit.addressBlock.replace(/Outside\\s*Base[:\\s]*/gi, '').trim();
      }
    }
    return '';
  });`;

modal = modal.replace(livingTypeRegex, livingTypeReplacement);
modal = modal.replace(livingOutTypeRegex, livingOutTypeReplacement);
modal = modal.replace(outsideAddressRegex, outsideAddressReplacement);

fs.writeFileSync('src/components/AddEditAirmanModal.tsx', modal);
console.log("Replaced Address Parsing");

const fs = require('fs');

const files = [
  'src/components/PrintableNightCountModal.tsx',
  'src/components/NightCountStateView.tsx'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Need to replace the isLOut check.
  // The check looks like this:
  /*
    const isLOut = block.includes('qtr') || 
                   block.includes('quarter') || 
                   block.includes('outside') || block.includes('maizpara') ||
                   block.includes('l/o') ||
                   block.includes('l/out') ||
                   block.includes('living out') ||
                   block.includes('dhaka') ||
                   block.includes('mirpur') ||
                   block.includes('cantt') ||
                   block === 'lo' || 
                   block === 'l o';
  */
  
  const target1 = /const isLOut = block\.includes\('qtr'\) \|\|[\s\S]*?block === 'l o';/g;
  const replacement1 = `const isLOut = block.includes('qtr') || 
                   block.includes('quarter') || 
                   block.includes('outside') || block.includes('maizpara') ||
                   block.includes('l/o') ||
                   block.includes('l/out') ||
                   block.includes('living out') ||
                   block.includes('dhaka') ||
                   block.includes('mirpur') ||
                   block.includes('cantt') ||
                   block.includes('ghat') ||
                   block === 'lo' || 
                   block === 'l o';`;
                   
  content = content.replace(target1, replacement1);
  
  const target2 = /if \(block\.includes\('qtr'\) \|\| block\.includes\('quarter'\) \|\| block\.includes\('outside'\) \|\| block\.includes\('maizpara'\)\) return false;/g;
  const replacement2 = `if (block.includes('qtr') || block.includes('quarter') || block.includes('outside') || block.includes('maizpara') || block.includes('ghat') || block.includes('l/o') || block.includes('lo')) return false;`;
  
  content = content.replace(target2, replacement2);
  fs.writeFileSync(file, content);
}

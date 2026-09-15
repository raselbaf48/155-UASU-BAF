const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let inEffect = false;
  let effectStart = 0;
  
  // Just a simple heuristic: count occurrences of "useEffect"
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('useEffect(')) {
       // scan ahead for the matching closing bracket '}'
       let j = i;
       let foundClose = false;
       while (j < Math.min(i + 50, lines.length)) {
          if (lines[j].includes('}')) {
             if (lines[j].includes('}, [') || lines[j].includes('},[])') || lines[j].includes('}, [') || lines[j].includes('})') || lines[j].includes('}  )')) {
                // it has a dependency array or something
             }
             if (lines[j].match(/\}\s*\)$/)) {
                console.log(\`File \${filePath} line \${i} might have missing dep array\`);
             }
          }
          j++;
       }
    }
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      checkFile(fullPath);
    }
  }
}

walkDir('src');

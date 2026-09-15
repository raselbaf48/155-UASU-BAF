const fs = require('fs');
const path = require('path');

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // simplistic approach: look for set[A-Z]\w*\( 
  // but exclude if they are on the same line as useEffect, or within a known callback
  // this is hard.
}

// Just grep for set[A-Z] that are NOT inside a function?

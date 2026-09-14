const fs = require('fs');

let content = fs.readFileSync('src/services/localDatabase.ts', 'utf8');

const regex = /if \(\!isPT\) \{\s*const yestAss = yestMap\.get\(airmanId\);/g;

// I need to intercept the return around 1675.
// Let's find exactly where we can inject the check.

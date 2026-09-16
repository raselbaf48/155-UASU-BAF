const fs = require('fs');
let code = fs.readFileSync('src/components/PrintableNightCountModal.tsx', 'utf8');

// The replacement was partially done by `sed`. Let's clean it up.
// Let's replace:
// </div>
// ) : (
// with:
// </>)}</div> ) : (

code = code.replace(/<\/div>\s*\)\s*:\s*\(/, '</>)}</div>) : (');
code = code.replace(/<\/div>\s*\}\)\}\s*<\/div>\s*<!-- Row Edit Popover -->/g, '</>)}</div>)}</div>\n{/* Row Edit Popover */}');

fs.writeFileSync('src/components/PrintableNightCountModal.tsx', code);

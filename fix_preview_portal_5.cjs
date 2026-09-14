const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

const replacement = `            </table>
          )}
        </div>
      </div>
      
      {/* Print Preview Portal */}
      {showPrintPreview && createPortal(`;

content = content.replace("            </table>\n          )}\n        </div>\n      </div>\n      \n      {/* Print Preview Portal */}\n      {showPrintPreview && createPortal(", `            </table>
          )}
        </div>
      </div>
      
      {/* Print Preview Portal */}
      {showPrintPreview && createPortal(`);

// wait the issue is actually in the original modal:
//             </table>
//           )} <-- THIS curly brace closing might be unmatched if the opening was lost

const originalContent = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');
let fixed = originalContent;

const fixRegex = /<\/table>\s*\)\}\s*<\/div>\s*<\/div>/;
fixed = fixed.replace(fixRegex, `</table>
          )}
        </div>
      </div>`);

// Ensure the end of the file is well-formed JSX
const endMatch = fixed.match(/<\/div>\s*<\/div>\s*\{\/\* Print Preview Portal \*\/[\s\S]*\}\s*<\/div>\s*\);\s*\};\s*$/);
if(!endMatch) {
    // If it's broken, let's just restore the file from a git checkout, and re-apply our changes cleanly.
}

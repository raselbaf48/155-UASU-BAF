const fs = require('fs');
let code = fs.readFileSync('src/utils/docxExport.ts', 'utf8');

// Also update the sub headers for IDA Center Duty as in the screenshot
// The screenshot has 1 header row with merged cells or 2 header rows?
// The image shows:
// [Date] [Day] [Base Sec] [Base TF] [Najirpara TF] [Airfield] [Canteen] [Leave] [IDA CENTER DUTY (Morning, Afternoon, Night)] [Duty Off] [On Parade]
// Wait, our code has Halishahar, Bake N Bite, Tdy
// Let's just adjust it to match what they see if they request it, but for now just fix the things they specifically asked for:

// "Same dt 2 page a jbe na." -> cantSplit: true is added to rows.
// "Upore onk empty space ase oitao thakbe na" -> top margin reduced, spacing after reduced.
// "Dekho multi dt parade state e always Portrait mode e hbe" -> orientation is PORTRAIT now.

// Wait, the file naming:
// "Doc/ Pdf Download korle nam eivabe hbe"
// "Parade State - Avi Flt (dt -dt).pdf/docx"

fs.writeFileSync('src/utils/docxExport.ts', code);

const fs = require('fs');

const file = 'src/features/canteen/components/CanteenLayout.tsx';
let code = fs.readFileSync(file, 'utf8');

// Find all occurrences of the import statement for Settings
const searchString = "import { Settings } from '../pages/Settings';";
const firstIndex = code.indexOf(searchString);

if (firstIndex !== -1) {
    const secondIndex = code.indexOf(searchString, firstIndex + searchString.length);
    
    // If a second occurrence exists, remove it
    if (secondIndex !== -1) {
        code = code.substring(0, secondIndex) + code.substring(secondIndex + searchString.length);
        fs.writeFileSync(file, code);
        console.log("Duplicate Settings import removed.");
    } else {
        console.log("No duplicate Settings import found.");
    }
}

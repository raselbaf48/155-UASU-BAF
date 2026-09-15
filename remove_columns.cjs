const fs = require('fs');

function removeColumns(file) {
    let content = fs.readFileSync(file, 'utf8');

    // Remove Headers
    content = content.replace(/<th[^>]*>.*?Off Duty.*?<\/th>\n?/g, '');
    content = content.replace(/<th[^>]*>.*?K\/O.*?<\/th>\n?/g, '');
    content = content.replace(/<th[^>]*>.*?Mess\/ Canteen \/Bakery.*?<\/th>\n?/g, '');
    content = content.replace(/<th[^>]*>.*?Mess \/ Canteen \/ Bakery.*?<\/th>\n?/g, '');
    content = content.replace(/<th[^>]*>.*?Reception.*?<\/th>\n?/g, ''); // Just in case

    // Remove Values in tds
    content = content.replace(/<td[^>]*>\{offDutyCount \|\| '-'}<\/td>\n?/g, '');
    content = content.replace(/<td[^>]*>\{stats\.koReceptionCount \|\| '-'}<\/td>\n?/g, '');
    content = content.replace(/<td[^>]*>\{stats\.bakeBiteCount \|\| '-'}<\/td>\n?/g, '');

    fs.writeFileSync(file, content);
}

removeColumns('src/components/NightCountStateView.tsx');
removeColumns('src/components/PrintableNightCountModal.tsx');
console.log('Columns removed');

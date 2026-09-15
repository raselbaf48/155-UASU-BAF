const fs = require('fs');
let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

content = content.replace("const [rosterMode, setRosterMode] = useState<RosterMode>('BASE_DUTIES');", "const [rosterMode, setRosterMode] = useState<RosterMode>('BASE_DUTIES');\n  const [showPrintPreview, setShowPrintPreview] = useState(false);");

fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', content);

const fs = require('fs');
let content = fs.readFileSync('src/components/PrintableParadeStateModal.tsx', 'utf8');

content = content.replace("const [selectedFlight, setSelectedFlight] = useState<FlightName | 'Overall'>('Overall');", "const [selectedFlight, setSelectedFlight] = useState<FlightName | 'Overall'>(flight || initialFlight || 'Overall');");

fs.writeFileSync('src/components/PrintableParadeStateModal.tsx', content);

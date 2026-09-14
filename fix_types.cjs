const fs = require('fs');
let content = fs.readFileSync('src/components/DutyAnalytics.tsx', 'utf8');

content = content.replace(
  'onViewProfile: (airman: Airman) => void;',
  'onViewProfile: (airman: Airman, config?: any) => void;'
);
content = content.replace(
  'onViewProfile: (airman: Airman) => void;',
  'onViewProfile: (airman: Airman, config?: any) => void;'
);

fs.writeFileSync('src/components/DutyAnalytics.tsx', content);

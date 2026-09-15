const fs = require('fs');
let content = fs.readFileSync('src/components/DutyRosterPeriodView.tsx', 'utf8');

const strToFind = `        </button>
      </div>

  const renderDocument = () => (
    <>
      {/* ========================================================================= */}`;

const strToReplace = `        </button>
      </div>
    </div>
  );

  const renderDocument = () => (
    <>
      {/* ========================================================================= */}`;

content = content.replace(strToFind, strToReplace);
fs.writeFileSync('src/components/DutyRosterPeriodView.tsx', content);

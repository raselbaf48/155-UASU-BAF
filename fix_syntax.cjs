const fs = require('fs');
let code = fs.readFileSync('src/features/canteen/components/CanteenLayout.tsx', 'utf8');

code = code.replace(
`                      </button>
                      )}
                  </div>`,
`                      </button>
                  </div>`
);

fs.writeFileSync('src/features/canteen/components/CanteenLayout.tsx', code);

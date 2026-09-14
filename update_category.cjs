const fs = require('fs');

let content = fs.readFileSync('src/components/AirmanProfileModal.tsx', 'utf8');

const oldFilter = `  const filteredList = assignments.filter((a) => {
    if (categoryFilter === 'DUTY') return !['LEAVE', 'TDY', 'ATT', 'DUTY_OFF', 'ON_PARADE'].includes(a.dutyCode);
    if (categoryFilter === 'ATT') return ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(a.dutyCode);
    if (categoryFilter === 'LEAVE') return a.dutyCode === 'LEAVE';
    if (categoryFilter === 'TDY') return a.dutyCode === 'TDY';
    return true;
  });`;

const newFilter = `  const filteredList = assignments.filter((a) => {
    if (categoryFilter === 'DUTY') return !['LEAVE', 'TDY', 'ATT', 'DUTY_OFF', 'ON_PARADE'].includes(a.dutyCode);
    if (categoryFilter === 'ATT') return ['ATT', 'BAKE_N_BITE', 'CANTEEN', 'DEPLOYMENT'].includes(a.dutyCode);
    if (categoryFilter === 'LEAVE') return a.dutyCode === 'LEAVE';
    if (categoryFilter === 'TDY') return a.dutyCode === 'TDY';
    if (categoryFilter !== 'ALL') {
      // Allow specific duty code filtering like 'GD', 'IDAC'
      if (categoryFilter === 'IDAC') return a.dutyCode === 'IDAC' || a.dutyCode === 'IDA';
      return a.dutyCode === categoryFilter;
    }
    return true;
  });`;

content = content.replace(oldFilter, newFilter);

const oldButtons = `                    {(['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT'] as const).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={\`px-2.5 py-1 rounded-lg transition-all \${
                          categoryFilter === cat
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }\`}
                      >
                        {cat}
                      </button>
                    ))}`;

const newButtons = `                    {(['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT'].includes(categoryFilter) ? ['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT'] : ['ALL', 'DUTY', 'LEAVE', 'TDY', 'ATT', categoryFilter]).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={\`px-2.5 py-1 rounded-lg transition-all \${
                          categoryFilter === cat
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }\`}
                      >
                        {cat}
                      </button>
                    ))}`;

content = content.replace(oldButtons, newButtons);
fs.writeFileSync('src/components/AirmanProfileModal.tsx', content);

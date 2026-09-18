const http = require('http');
http.get('http://localhost:3000/api/parade-state?date=2026-09-19&shift=Morning&flight=Overall&stateType=PARADE', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    const rakib = json.personnelStatusList.find(p => p.airman.name.toLowerCase().includes('rakib'));
    console.log(rakib);
  });
});

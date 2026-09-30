import { supabase } from './src/supabase';

async function check() {
  const { data: airmen } = await supabase.from('Biodata Register').select('*');
  console.log('Total airmen:', airmen?.length);
  const flights: Record<string, { cpl: number, sgt: number, others: number }> = {};
  airmen?.forEach((a: any) => {
    const fl = a.flight_name || a.flightName || 'Unknown';
    if (!flights[fl]) flights[fl] = { cpl: 0, sgt: 0, others: 0 };
    const r = (a.rank || '').toLowerCase();
    if (r.includes('cpl')) flights[fl].cpl++;
    else if (r.includes('sgt')) flights[fl].sgt++;
    else flights[fl].others++;
  });
  console.log('Airmen by flight & rank:', JSON.stringify(flights, null, 2));

  const { data: settings } = await supabase.from('app_settings').select('*');
  console.log('App settings keys:', settings?.map((s: any) => s.setting_key));
  const matrixSetting = settings?.find((s: any) => s.setting_key === 'baf_official_duty_matrix_v4');
  if (matrixSetting) {
    console.log('Matrix in supabase found');
    const parsed = JSON.parse(matrixSetting.setting_value);
    console.log('Tables in supabase matrix:', parsed.map((t: any) => ({
      id: t.id,
      title: t.title,
      flightTargets: t.flightTargets
    })));
  }

  const mpSetting = settings?.find((s: any) => s.setting_key === 'baf_duty_distribution_manpower');
  if (mpSetting) {
    console.log('Manpower setting in supabase:', mpSetting.setting_value);
  }
}

check();

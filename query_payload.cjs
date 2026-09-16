const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://asevtncnoytawykhcleg.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE');
const a = {
  id: 'BD/472206',
  bdNo: '472206',
  rank: 'Cpl',
  name: 'Sajib',
  fullName: 'Md Sajib Rahman',
  flightName: 'Mechanics',
  trade: 'Eng Fitt',
  mobileNo: '01721273808',
  bloodGroup: '',
  permanentAddress: '',
  dateJoined: '',
  addressBlock: 'Maizpara',
  active: true,
  dateLeft: ''
};
const payload = {
  airman_id: a.id,
  'BD No': a.bdNo,
  'Rank': a.rank,
  'Surname': a.name,
  'Full Name': a.fullName || a.name,
  'Flight': a.flightName,
  'Trade': a.trade || null,
  'Mobile No': a.mobileNo || null,
  'Blood Group': a.bloodGroup || null,
  'Permanent Address': a.permanentAddress || null,
  'Dt of Posting': a.dateJoined || null,
  'Present Address': a.addressBlock || null,
  'Status': a.active === false ? 'SUSPENDED' : 'ACTIVE',
  'Unit Left date': a.dateLeft || null
};
supabase.from('Biodata Register').upsert([payload], { onConflict: 'airman_id' }).select().then(res => console.log(res)).catch(console.error);

import fs from 'fs';

const url = 'http://localhost:3000/api/supabase/rest/v1/sql';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZXZ0bmNub3l0YXd5a2hjbGVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkyNjEzMjksImV4cCI6MjEwNDgzNzMyOX0.YpeamrrHPpZdxGcj03PGIm4Z8OC9ShbLpJ16x9cl6RE';

const sql = `
drop table if exists public.duty_ratio_matrix;
create table public.duty_ratio_matrix (
  id text primary key,
  duty_id text not null,
  duty_title text not null,
  duty_code text not null,
  shift_label text,
  flight text not null,
  day_1 integer default 0,
  day_2 integer default 0,
  day_3 integer default 0,
  day_4 integer default 0,
  day_5 integer default 0,
  day_6 integer default 0,
  day_7 integer default 0,
  day_8 integer default 0,
  day_9 integer default 0,
  day_10 integer default 0,
  day_11 integer default 0,
  day_12 integer default 0,
  day_13 integer default 0,
  day_14 integer default 0,
  day_15 integer default 0,
  day_16 integer default 0,
  day_17 integer default 0,
  day_18 integer default 0,
  day_19 integer default 0,
  day_20 integer default 0,
  day_21 integer default 0,
  day_22 integer default 0,
  day_23 integer default 0,
  day_24 integer default 0,
  day_25 integer default 0,
  day_26 integer default 0,
  day_27 integer default 0,
  day_28 integer default 0,
  day_29 integer default 0,
  day_30 integer default 0,
  day_31 integer default 0,
  flight_total integer default 0,
  duty_total_daily integer default 0,
  is_disabled boolean default false
);
`;

const insertResp = await fetch(url, { 
   method: 'POST',
   headers: { 
       apikey, 
       authorization: 'Bearer ' + apikey,
       'Content-Type': 'application/json'
   },
   body: JSON.stringify({ query: sql })
});

console.log("Status:", insertResp.status);
console.log("Response:", await insertResp.text());

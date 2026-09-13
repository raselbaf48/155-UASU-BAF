import { DutyAssignment } from '../types';

interface DayRaw {
  day: number;
  gd?: string[]; // Base Security Duty
  btf?: string[]; // Base Taskforce Duty
  ntf?: string[]; // Najirpara Taskforce Duty
  airfield?: string[]; // Airfield Duty
  halishahar?: string[]; // Halishahar Duty
  bakeNBite?: string[]; // Bake & Bite
  tdy?: string[]; // TDY
  leave?: string[]; // Leave
  idaMorning?: string[];
  idaAfternoon?: string[];
  idaNight?: string[];
  dutyOff?: string[];
}

// Exact Parade State Data from 155 UASU BAF official Document (01 Jul - 31 Jul 2026)
const JULY_RAW_DATA: DayRaw[] = [
  {
    day: 1,
    gd: ['Cpl Omar', 'LAC Zubayer', 'LAC Tusar'],
    btf: ['LAC Rakib'],
    ntf: ['Sgt Imran', 'Cpl Ahsan', 'LAC Saidul'],
    airfield: ['Sgt Uzzal', 'Sgt Shohel'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Aminul', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)', 'LAC Nishad'],
    leave: ['WO Lutfar', 'Sgt Mustakim', 'LAC Rasel', 'LAC Ashraful'],
    idaMorning: ['Cpl Koraishi'],
    idaAfternoon: ['Sgt Fokrul'],
    dutyOff: ['Sgt Shishir'],
  },
  {
    day: 2,
    gd: ['Cpl Omar', 'LAC Tusar', 'LAC Rashed'],
    btf: ['LAC Rakib'],
    ntf: ['LAC Mahedi'],
    airfield: ['Sgt Uzzal', 'Sgt Shohel'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Aminul', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)', 'LAC Nishad'],
    leave: ['WO Lutfar', 'Sgt Mustakim', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['Sgt Imran', 'Cpl Ahsan', 'LAC Zubayer', 'LAC Saidul'],
  },
  {
    day: 3,
    gd: ['LAC Rashed', 'LAC Saidul'],
    btf: ['LAC Zubayer'],
    ntf: ['Cpl Harun'],
    airfield: ['Sgt Uzzal', 'Sgt Shohel'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Aminul', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)', 'LAC Nishad'],
    leave: ['WO Lutfar', 'Sgt Mustakim', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['Cpl Omar', 'LAC Mahedi', 'LAC Rakib', 'LAC Tusar'],
  },
  {
    day: 4,
    gd: ['Cpl Ahsan', 'Cpl Koraishi', 'LAC Saidul'],
    btf: ['LAC Zubayer'],
    ntf: ['Cpl Harun'],
    airfield: ['Sgt Uzzal', 'Sgt Shohel'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Aminul', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)', 'LAC Nishad'],
    leave: ['WO Lutfar', 'Sgt Mustakim', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['LAC Rashed'],
  },
  {
    day: 5,
    gd: ['Cpl Ahsan', 'Cpl Koraishi', 'LAC Zakirul'],
    ntf: ['Sgt Mustakim'],
    airfield: ['Sgt Uzzal', 'Sgt Shohel'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)', 'LAC Nishad'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['Cpl Harun', 'LAC Zubayer', 'LAC Saidul'],
  },
  {
    day: 6,
    gd: ['Cpl Omar', 'LAC Mahedi', 'LAC Zakirul'],
    btf: ['Cpl Akash'],
    ntf: ['Sgt Mustakim'],
    airfield: ['Sgt Uzzal', 'Sgt Shohel'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)', 'LAC Nishad'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['Cpl Ahsan', 'Cpl Koraishi'],
  },
  {
    day: 7,
    gd: ['Cpl Harun', 'LAC Mahedi', 'LAC Rakib'],
    btf: ['LAC Zubayer'],
    airfield: ['Sgt Uzzal', 'Sgt Shohel'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)', 'LAC Nishad'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    idaAfternoon: ['Sgt Mehedi'],
    dutyOff: ['Sgt Mustakim', 'Cpl Omar', 'Cpl Akash', 'LAC Zakirul'],
  },
  {
    day: 8,
    gd: ['Cpl Harun', 'LAC Mahedi', 'LAC Rakib'],
    btf: ['LAC Zubayer'],
    airfield: ['Sgt Uzzal', 'Sgt Shohel'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    idaAfternoon: ['Sgt Shishir'],
    idaNight: ['Sgt Mehedi'],
  },
  {
    day: 9,
    gd: ['Cpl Harun', 'LAC Rashed'],
    btf: ['LAC Rakib'],
    ntf: ['LAC Saidul'],
    airfield: ['Sgt Uzzal', 'Sgt Shohel', 'Cpl Koraishi'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['LAC Mahedi', 'LAC Zubayer'],
  },
  {
    day: 10,
    btf: ['LAC Rakib'],
    airfield: ['Sgt Mustakim', 'Sgt Shohel', 'Cpl Koraishi'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['Sgt Uzzal', 'Cpl Harun', 'LAC Rashed', 'LAC Saidul'],
  },
  {
    day: 11,
    airfield: ['Sgt Mustakim', 'Sgt Shohel', 'Cpl Koraishi'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['LAC Rakib'],
  },
  {
    day: 12,
    gd: ['Cpl Omar'],
    ntf: ['LAC Nishad'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'Cpl Koraishi'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['Sgt Shohel'],
  },
  {
    day: 13,
    gd: ['Cpl Omar'],
    ntf: ['LAC Nishad'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'Cpl Koraishi'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
  },
  {
    day: 14,
    gd: ['LAC Rakib'],
    btf: ['Sgt Uzzal'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'Cpl Koraishi'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['Cpl Omar', 'LAC Nishad'],
  },
  {
    day: 15,
    gd: ['LAC Rakib'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'Cpl Koraishi'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['Sgt Uzzal'],
  },
  {
    day: 16,
    ntf: ['Cpl Omar'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'Cpl Koraishi'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'LAC Rasel', 'LAC Ashraful', 'LAC Hridoy'],
    dutyOff: ['LAC Rakib'],
  },
  {
    day: 17,
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'Cpl Koraishi', 'LAC Rasel', 'LAC Hridoy'],
    dutyOff: ['Cpl Omar'],
  },
  {
    day: 18,
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'Cpl Koraishi', 'LAC Rasel', 'LAC Hridoy'],
    idaAfternoon: ['LAC Rakib'],
  },
  {
    day: 19,
    gd: ['LAC Rakib'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'Cpl Koraishi', 'LAC Rasel', 'LAC Hridoy'],
    idaMorning: ['Cpl Omar'],
  },
  {
    day: 20,
    gd: ['LAC Rakib'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'Cpl Koraishi', 'LAC Rasel'],
    idaAfternoon: ['Cpl Omar'],
  },
  {
    day: 21,
    gd: ['LAC Rakib'],
    ntf: ['Sgt Uzzal'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'Cpl Koraishi', 'LAC Rasel'],
    idaAfternoon: ['Cpl Omar'],
  },
  {
    day: 22,
    ntf: ['Sgt Uzzal'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'Cpl Koraishi', 'LAC Rasel'],
    idaNight: ['Cpl Omar'],
    dutyOff: ['LAC Rakib'],
  },
  {
    day: 23,
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'Cpl Koraishi', 'LAC Rasel'],
    idaMorning: ['Sgt Fokrul'],
    idaNight: ['LAC Rakib'],
    dutyOff: ['Sgt Uzzal', 'Cpl Omar'],
  },
  {
    day: 24,
    ntf: ['Sgt Uzzal'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'Cpl Koraishi', 'LAC Nishad', 'LAC Zubayer'],
    idaNight: ['LAC Rakib'],
    dutyOff: ['LAC Rakib'],
  },
  {
    day: 25,
    gd: ['LAC Rakib'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['WO Aminul', 'Cpl Koraishi', 'LAC Nishad', 'LAC Zubayer'],
    idaNight: ['Sgt Uzzal', 'Cpl Ahsan'],
    dutyOff: ['Sgt Uzzal'],
  },
  {
    day: 26,
    gd: ['LAC Rasel'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['Cpl Koraishi', 'LAC Nishad', 'LAC Zakirul', 'LAC Zubayer'],
    idaNight: ['Cpl Omar', 'Cpl Akash'],
    dutyOff: ['Sgt Uzzal', 'Cpl Ahsan', 'LAC Rakib'],
  },
  {
    day: 27,
    gd: ['LAC Rakib'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)'],
    leave: ['Cpl Omar', 'Cpl Koraishi', 'LAC Nishad', 'LAC Zakirul', 'LAC Zubayer'],
    idaMorning: ['LAC Rakib'],
    idaAfternoon: ['LAC Tusar'],
    idaNight: ['Sgt Mahid', 'LAC Rasel'],
    dutyOff: ['Cpl Akash', 'LAC Rasel'],
  },
  {
    day: 28,
    gd: ['LAC Hridoy'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Jahid', 'WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)', 'LAC Tusar'],
    leave: ['Cpl Omar', 'Cpl Koraishi', 'LAC Nishad', 'LAC Zakirul', 'LAC Zubayer'],
    idaAfternoon: ['LAC Rasel'],
    idaNight: ['LAC Joy'],
    dutyOff: ['Sgt Mahid', 'LAC Rakib'],
  },
  {
    day: 29,
    gd: ['LAC Mahedi', 'LAC Rakib', 'LAC Joy'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Jahid', 'WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)', 'LAC Tusar'],
    leave: ['Cpl Omar', 'Cpl Koraishi', 'LAC Nishad', 'LAC Zakirul', 'LAC Zubayer'],
    idaMorning: ['LAC Hridoy'],
    idaAfternoon: ['LAC Saidul'],
    idaNight: ['Cpl Sajib', 'Cpl Akash'],
  },
  {
    day: 30,
    gd: ['LAC Rasel', 'LAC Hridoy'],
    ntf: ['Sgt Uzzal'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Jahid', 'WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Mehedi (GS)', 'LAC Tusar'],
    leave: ['Cpl Omar', 'Cpl Koraishi', 'LAC Nishad', 'LAC Zakirul', 'LAC Zubayer'],
    idaMorning: ['LAC Saidul'],
    idaAfternoon: ['LAC Rakib'],
    idaNight: ['LAC Mahedi', 'LAC Saidul'],
    dutyOff: ['Cpl Sajib', 'Cpl Akash', 'LAC Mahedi', 'LAC Joy'],
  },
  {
    day: 31,
    gd: ['LAC Rakib', 'LAC Joy'],
    ntf: ['Sgt Fokrul', 'LAC Rashed'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Jahid', 'WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'WO Aminul', 'Cpl Omar', 'Cpl Koraishi', 'LAC Nishad', 'LAC Zakirul', 'LAC Zubayer'],
    idaMorning: ['Sgt Mustakim'],
    idaAfternoon: ['LAC Ashraful'],
    idaNight: ['LAC Rasel', 'LAC Mehedi (GS)'],
    dutyOff: ['Sgt Uzzal', 'LAC Rasel', 'LAC Mahedi', 'LAC Hridoy', 'LAC Saidul'],
  },
];

// Exact Parade State Data from 155 UASU BAF official Document (01 Aug - 31 Aug 2026)
const AUGUST_RAW_DATA: DayRaw[] = [
  {
    day: 1,
    gd: ['LAC Rasel', 'LAC Hridoy', 'LAC Saidul'],
    btf: ['Sgt Uzzal'],
    ntf: ['Sgt Shishir', 'LAC Mahedi'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Jahid', 'WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'WO Aminul', 'Sgt Imran', 'Cpl Omar', 'Cpl Koraishi', 'Cpl Sajib', 'LAC Nishad', 'LAC Zakirul', 'LAC Zubayer'],
    idaMorning: ['Sgt A. Gafur'],
    idaAfternoon: ['LAC Rakib'],
    idaNight: ['Cpl Ahsan', 'Cpl Akash'],
    dutyOff: ['Sgt Fokrul', 'LAC Joy', 'LAC Mehedi (GS)', 'LAC Rashed'],
  },
  {
    day: 2,
    gd: ['LAC Rakib', 'LAC Hridoy', 'LAC Mehedi (GS)'],
    btf: ['Sgt Uzzal'],
    ntf: ['Sgt Mahid'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'WO Aminul', 'Sgt Imran', 'Cpl Koraishi', 'Cpl Sajib', 'LAC Nishad', 'LAC Zakirul', 'LAC Zubayer', 'LAC Saidul'],
    idaMorning: ['Sgt Rubel'],
    idaAfternoon: ['LAC Mahedi'],
    idaNight: ['Sgt A. Gafur', 'Cpl Akash'],
    dutyOff: ['Sgt Shishir', 'Cpl Ahsan', 'Cpl Akash', 'LAC Rasel'],
  },
  {
    day: 3,
    gd: ['LAC Rasel', 'LAC Mehedi (GS)', 'LAC Zubayer'],
    btf: ['LAC Mahedi'],
    ntf: ['LAC Joy'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'WO Aminul', 'Sgt Imran', 'Cpl Koraishi', 'Cpl Sajib', 'LAC Nishad', 'LAC Zakirul', 'LAC Saidul'],
    idaMorning: ['Sgt Mehedi'],
    idaAfternoon: ['Cpl Ahsan'],
    idaNight: ['Sgt Mahid', 'Cpl Omar'],
    dutyOff: ['Sgt Uzzal', 'Sgt Mahid', 'Sgt A. Gafur', 'Cpl Akash', 'LAC Rakib', 'LAC Hridoy'],
  },
  {
    day: 4,
    gd: ['Cpl Ahsan', 'LAC Mehedi (GS)', 'LAC Zubayer'],
    btf: ['Sgt Mehedi'],
    ntf: ['LAC Joy'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Imran', 'Cpl Koraishi', 'Cpl Sajib', 'LAC Nishad', 'LAC Zakirul', 'LAC Saidul'],
    idaMorning: ['Cpl Akash'],
    idaAfternoon: ['LAC Hridoy'],
    idaNight: ['Sgt Shishir', 'LAC Mahedi'],
    dutyOff: ['Sgt Mahid', 'Cpl Omar', 'LAC Rasel', 'LAC Mahedi'],
  },
  {
    day: 5,
    gd: ['Cpl Ahsan', 'Cpl Akash', 'LAC Zubayer'],
    btf: ['LAC Rakib'],
    ntf: ['Cpl Omar'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Ashraful'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Imran', 'Cpl Koraishi', 'Cpl Sajib', 'LAC Nishad', 'LAC Zakirul', 'LAC Saidul'],
    idaMorning: ['LAC Rashed'],
    idaAfternoon: ['LAC Rasel'],
    idaNight: ['Sgt Mehedi', 'LAC Joy'],
    dutyOff: ['Sgt Shishir', 'Sgt Mehedi', 'LAC Mahedi', 'LAC Joy', 'LAC Mehedi (GS)'],
  },
  {
    day: 6,
    gd: ['Cpl Akash', 'LAC Rasel', 'LAC Rashed'],
    btf: ['Sgt Shishir'],
    ntf: ['Cpl Omar'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Imran', 'Cpl Koraishi', 'Cpl Sajib', 'LAC Nishad', 'LAC Zakirul', 'LAC Saidul'],
    idaMorning: ['Sgt Fokrul'],
    idaAfternoon: ['LAC Ashraful'],
    idaNight: ['Sgt Fokrul', 'Cpl Ahsan'],
    dutyOff: ['Sgt Mehedi', 'Cpl Ahsan', 'LAC Rakib', 'LAC Joy'],
  },
  {
    day: 7,
    gd: ['LAC Rasel', 'LAC Mehedi (GS)', 'LAC Rashed'],
    btf: ['LAC Ashraful'],
    ntf: ['LAC Mahedi'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Shariful'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Imran', 'Cpl Koraishi', 'Cpl Sajib', 'Cpl Maraz', 'LAC Rakib', 'LAC Nishad', 'LAC Zakirul', 'LAC Adnan', 'LAC Saidul'],
    idaMorning: ['LAC Joy'],
    idaAfternoon: ['LAC Hridoy'],
    idaNight: ['Sgt Mahid', 'Sgt Fokrul'],
    dutyOff: ['Sgt Fokrul', 'Cpl Omar', 'Cpl Ahsan', 'Cpl Akash'],
  },
  {
    day: 8,
    gd: ['Cpl Omar', 'LAC Hridoy', 'LAC Mehedi (GS)'],
    btf: ['LAC Ashraful'],
    ntf: ['LAC Mahedi'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Shariful'],
    tdy: ['WO Mojaffar', 'Sgt Riaz', 'Sgt Mobarak', 'Sgt Absar', 'Sgt Asad', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Imran', 'Cpl Koraishi', 'Cpl Sajib', 'Cpl Maraz', 'LAC Rakib', 'LAC Nishad', 'LAC Zakirul', 'LAC Adnan', 'LAC Saidul'],
    idaMorning: ['Cpl Akash'],
    idaAfternoon: ['LAC Zubayer'],
    idaNight: ['Sgt Mahid', 'LAC Rasel'],
    dutyOff: ['Sgt Mahid', 'Sgt Fokrul', 'LAC Rasel', 'LAC Rashed'],
  },
  {
    day: 9,
    gd: ['Cpl Ahsan', 'LAC Hridoy', 'LAC Mehedi (GS)'],
    btf: ['Sgt Fokrul'],
    ntf: ['Sgt Shishir'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Shariful'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Shohel', 'Sgt Imran', 'Cpl Koraishi', 'Cpl Sajib', 'Cpl Maraz', 'LAC Rakib', 'LAC Nishad', 'LAC Adnan'],
    idaMorning: ['Sgt Absar'],
    idaAfternoon: ['LAC Mahedi'],
    idaNight: ['Sgt Mehedi', 'Cpl Omar'],
    dutyOff: ['Sgt Mahid', 'Cpl Omar', 'LAC Rasel', 'LAC Ashraful'],
  },
  {
    day: 10,
    gd: ['Cpl Ahsan', 'LAC Ashraful'],
    btf: ['WO Lutfar', 'Sgt Riaz'],
    ntf: ['Sgt A. Gafur'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Shariful'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Shohel', 'Sgt Imran', 'Cpl Sajib', 'Cpl Maraz', 'LAC Rakib', 'LAC Nishad', 'LAC Adnan'],
    idaMorning: ['LAC Zakirul'],
    idaAfternoon: ['LAC Hridoy'],
    idaNight: ['LAC Mahedi', 'LAC Saidul'],
    dutyOff: ['Sgt Fokrul', 'Sgt Shishir', 'Sgt Mehedi', 'Cpl Omar', 'LAC Mehedi (GS)'],
  },
  {
    day: 11,
    gd: ['LAC Ashraful', 'LAC Zakirul'],
    btf: ['Cpl Akash'],
    ntf: ['Sgt Absar'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Shariful'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Shohel', 'Sgt Imran', 'Cpl Sajib', 'Cpl Maraz', 'LAC Rakib', 'LAC Nishad', 'LAC Adnan'],
    idaMorning: ['Cpl Ahsan'],
    idaAfternoon: ['LAC Rasel'],
    idaNight: ['Sgt A. Gafur', 'LAC Joy'],
    dutyOff: ['WO Lutfar', 'Sgt Riaz', 'Sgt A. Gafur', 'LAC Mahedi', 'LAC Saidul'],
  },
  {
    day: 12,
    gd: ['Cpl Omar', 'LAC Ashraful', 'LAC Zakirul'],
    btf: ['Cpl Akash'],
    ntf: ['Cpl Ahsan', 'LAC Rasel'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Shariful'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Shohel', 'Sgt Imran', 'Cpl Sajib', 'Cpl Maraz', 'LAC Rakib', 'LAC Nishad', 'LAC Adnan'],
    idaMorning: ['LAC Mahedi'],
    idaAfternoon: ['LAC Saidul'],
    idaNight: ['Sgt Absar', 'LAC Joy'],
    dutyOff: ['Sgt Absar', 'Sgt A. Gafur', 'LAC Joy'],
  },
  {
    day: 13,
    gd: ['LAC Rasel', 'LAC Mahedi', 'LAC Saidul'],
    ntf: ['Sgt Riaz', 'Cpl Ahsan'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Imran', 'Cpl Sajib', 'LAC Rakib', 'LAC Nishad'],
    idaMorning: ['LAC Saidul'],
    idaAfternoon: ['Cpl Omar'],
    idaNight: ['LAC Ashraful', 'LAC Mehedi (GS)'],
    dutyOff: ['Sgt Absar', 'LAC Joy', 'LAC Ashraful', 'LAC Zakirul'],
  },
  {
    day: 14,
    gd: ['LAC Rasel', 'LAC Mahedi', 'LAC Saidul'],
    btf: ['Sgt Riaz'],
    ntf: ['LAC Zakirul'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    halishahar: ['Cpl Omar'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Imran', 'Cpl Sajib', 'LAC Rakib', 'LAC Nishad', 'LAC Rashed'],
    idaNight: ['Sgt Ripon', 'Cpl Omar'],
    dutyOff: ['Cpl Ahsan', 'LAC Ashraful', 'LAC Mehedi (GS)'],
  },
  {
    day: 15,
    gd: ['LAC Rasel', 'LAC Mahedi', 'LAC Mehedi (GS)'],
    btf: ['Cpl Ahsan'],
    ntf: ['Sgt Shishir', 'LAC Ashraful'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    halishahar: ['Cpl Omar'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Imran', 'Cpl Sajib', 'LAC Rakib', 'LAC Nishad', 'LAC Rashed'],
    idaMorning: ['LAC Zakirul'],
    idaNight: ['Cpl Omar', 'LAC Zakirul'],
    dutyOff: ['Sgt Riaz', 'Sgt Ripon', 'LAC Saidul'],
  },
  {
    day: 16,
    gd: ['Cpl Ahsan', 'LAC Hridoy', 'LAC Mehedi (GS)'],
    btf: ['LAC Zakirul'],
    ntf: ['Sgt Riaz'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    halishahar: ['Cpl Omar'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Imran', 'LAC Nishad', 'LAC Rashed'],
    idaMorning: ['LAC Rakib'],
    idaNight: ['LAC Rasel', 'LAC Saidul'],
    dutyOff: ['Sgt Shishir', 'LAC Rasel', 'LAC Mahedi', 'LAC Ashraful'],
  },
  {
    day: 17,
    gd: ['LAC Joy', 'LAC Hridoy'],
    btf: ['Sgt Mahid'],
    ntf: ['Cpl Ahsan'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    halishahar: ['Cpl Omar'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['WO A. Baten', 'Sgt Uzzal', 'Sgt Imran', 'LAC Nishad', 'LAC Rashed'],
    idaMorning: ['LAC Rakib'],
    idaNight: ['Sgt Ripon', 'LAC Rasel'],
    dutyOff: ['Sgt Riaz', 'LAC Rasel', 'LAC Mehedi (GS)', 'LAC Saidul'],
  },
  {
    day: 18,
    gd: ['Cpl Ahsan', 'LAC Joy', 'LAC Ashraful'],
    btf: ['Sgt Mehedi'],
    ntf: ['Sgt Shohel'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    halishahar: ['Cpl Omar'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Nishad', 'LAC Rashed'],
    idaAfternoon: ['LAC Rakib'],
    idaNight: ['LAC Rasel', 'LAC Joy'],
    dutyOff: ['Sgt Mahid', 'Sgt Ripon', 'LAC Rasel', 'LAC Hridoy'],
  },
  {
    day: 19,
    gd: ['LAC Rakib', 'LAC Ashraful'],
    ntf: ['Sgt Absar', 'Sgt Shohel'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    halishahar: ['Cpl Omar'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Nishad', 'LAC Rashed'],
    idaAfternoon: ['Cpl Ahsan'],
    idaNight: ['LAC Mehedi (GS)'],
    dutyOff: ['Sgt Mehedi', 'LAC Rasel', 'LAC Joy'],
  },
  {
    day: 20,
    gd: ['Cpl Sajib', 'LAC Rakib', 'LAC Saidul'],
    ntf: ['LAC Mahedi'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    halishahar: ['Cpl Omar'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Nishad', 'LAC Rashed'],
    idaMorning: ['LAC Joy'],
    idaAfternoon: ['LAC Rasel'],
    idaNight: ['LAC Zakirul'],
    dutyOff: ['Sgt Absar', 'Sgt Shohel', 'LAC Ashraful', 'LAC Mehedi (GS)'],
  },
  {
    day: 21,
    gd: ['LAC Saidul'],
    ntf: ['Cpl Omar'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Nishad', 'LAC Rashed'],
    idaMorning: ['Cpl Akash'],
    idaAfternoon: ['Sgt Riaz'],
    idaNight: ['LAC Mehedi (GS)'],
    dutyOff: ['Cpl Sajib', 'LAC Mahedi', 'LAC Rakib', 'LAC Zakirul'],
  },
  {
    day: 22,
    gd: ['LAC Rasel', 'LAC Zakirul'],
    btf: ['LAC Joy'],
    ntf: ['Sgt Riaz'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Nishad', 'LAC Rashed'],
    idaMorning: ['Cpl Akash'],
    idaNight: ['Cpl Omar'],
    dutyOff: ['Cpl Omar', 'LAC Mehedi (GS)', 'LAC Saidul'],
  },
  {
    day: 23,
    gd: ['LAC Rakib', 'LAC Zakirul'],
    btf: ['Cpl Ahsan'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Nishad', 'LAC Rashed'],
    idaMorning: ['Cpl Omar'],
    idaAfternoon: ['Sgt Shishir'],
    idaNight: ['LAC Rasel'],
    dutyOff: ['Sgt Riaz', 'LAC Rasel'],
  },
  {
    day: 24,
    ntf: ['Sgt Fokrul', 'Sgt Shohel'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Nishad', 'LAC Rashed'],
    idaMorning: ['Cpl Akash'],
    idaAfternoon: ['LAC Mehedi (GS)'],
    idaNight: ['LAC Saidul'],
    dutyOff: ['Cpl Ahsan', 'LAC Rasel', 'LAC Rakib', 'LAC Zakirul'],
  },
  {
    day: 25,
    gd: ['Cpl Akash'],
    btf: ['Sgt Shishir'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Rashed'],
    idaNight: ['LAC Zakirul'],
    dutyOff: ['Sgt Fokrul', 'Sgt Shohel', 'LAC Saidul'],
  },
  {
    day: 26,
    gd: ['Cpl Akash'],
    ntf: ['LAC Saidul'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Rashed'],
    idaNight: ['LAC Mehedi (GS)'],
    dutyOff: ['LAC Zakirul'],
  },
  {
    day: 27,
    gd: ['LAC Joy'],
    ntf: ['LAC Saidul'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Rashed'],
    idaAfternoon: ['LAC Zakirul'],
    dutyOff: ['Cpl Akash', 'LAC Mehedi (GS)'],
  },
  {
    day: 28,
    gd: ['LAC Joy'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Rashed'],
    idaMorning: ['LAC Zakirul'],
    idaNight: ['LAC Mehedi (GS)'],
    dutyOff: ['LAC Saidul'],
  },
  {
    day: 29,
    gd: ['LAC Mehedi'],
    ntf: ['Cpl Akash'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Rashed'],
    idaAfternoon: ['LAC Saidul'],
    idaNight: ['LAC Joy'],
    dutyOff: ['LAC Joy'],
  },
  {
    day: 30,
    gd: ['LAC Mehedi'],
    ntf: ['Cpl Akash'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Rashed'],
    idaMorning: ['Sgt Shishir'],
    idaNight: ['LAC Joy'],
    dutyOff: ['LAC Joy'],
  },
  {
    day: 31,
    gd: ['LAC Mehedi'],
    airfield: ['Sgt Mustakim', 'Cpl Harun', 'LAC Zubayer'],
    bakeNBite: ['SWO Moshiur', 'Cpl Maraz', 'Cpl Shariful', 'LAC Adnan'],
    tdy: ['WO Mojaffar', 'Sgt Sojib', 'Cpl Ismail', 'LAC Tusar'],
    leave: ['Sgt Uzzal', 'Sgt Imran', 'LAC Rashed'],
    idaAfternoon: ['LAC Saidul'],
    dutyOff: ['Cpl Akash', 'LAC Joy'],
  },
];

// Mapping helper from name / alias to airmanId
export function getAirmanIdByName(name: string): string | null {
  const n = name.toLowerCase().trim();

  if (n.includes('moshiur')) return 'airman-1';
  if (n.includes('mostafa')) return 'airman-2';
  if (n.includes('jahid')) return 'airman-3';
  if (n.includes('mojaffar') || n.includes('mgfr')) return 'airman-4';
  if (n.includes('baten') || n.includes('btn')) return 'airman-5';
  if (n.includes('shahin')) return 'airman-6';
  if (n.includes('lutfar') || n.includes('lfr')) return 'airman-7';
  if (n.includes('aminul') || n.includes('amn')) return 'airman-8';
  if (n.includes('uzzal') || n.includes('uzl')) return 'airman-9';
  if (n.includes('riaz') || n.includes('riz')) return 'airman-10';
  if (n.includes('mobarak') || n.includes('mbk')) return 'airman-11';
  if (n.includes('rubel') || n.includes('rbl')) return 'airman-12';
  if (n.includes('absar') || n.includes('abs')) return 'airman-13';
  if (n.includes('mahid')) return 'airman-14';
  if (n.includes('asad') || n.includes('asd')) return 'airman-15';
  if (n.includes('fokrul') || n.includes('fkl')) return 'airman-16';
  if (n.includes('shishir') || n.includes('ssr')) return 'airman-17';
  if (n.includes('mustakim') || n.includes('mkm')) return 'airman-18';
  if (n.includes('sojib') || n.includes('sjb') && n.includes('sgt')) return 'airman-19';
  if (n.includes('sgt mehedi')) return 'airman-20';
  if (n.includes('ripon') || n.includes('rpn')) return 'airman-21';
  if (n.includes('gafur') || n.includes('gfr')) return 'airman-22';
  if (n.includes('shohel') || n.includes('shl')) return 'airman-23';
  if (n.includes('imran') || n.includes('imr')) return 'airman-24';
  if (n.includes('nahid')) return 'airman-25';
  if (n.includes('harun') || n.includes('hrn')) return 'airman-26';
  if (n.includes('omar') || n.includes('omr')) return 'airman-27';
  if (n.includes('ismail') || n.includes('ism')) return 'airman-28';
  if (n.includes('ahsan') || n.includes('ahs')) return 'airman-29';
  if (n.includes('koraishi') || n.includes('kors')) return 'airman-30';
  if (n.includes('cpl sajib') || n.includes('sajib')) return 'airman-31';
  if (n.includes('maraz') || n.includes('mrz')) return 'airman-32';
  if (n.includes('shariful') || n.includes('sfl')) return 'airman-33';
  if (n.includes('akash') || n.includes('aks')) return 'airman-34';
  if (n.includes('rasel') || n.includes('rsl')) return 'airman-35';
  if (n.includes('mahedi') && !n.includes('gs') && !n.includes('sgt')) return 'airman-36'; // LAC Mahedi Mech
  if (n.includes('rakib') || n.includes('rkb')) return 'airman-37';
  if (n.includes('joy')) return 'airman-38';
  if (n.includes('ashraful') || n.includes('asf')) return 'airman-39';
  if (n.includes('hridoy') || n.includes('hrd')) return 'airman-40';
  if (n.includes('mehedi (gs)') || (n.includes('mehedi') && n.includes('gcs'))) return 'airman-41'; // LAC Mehedi GCS
  if (n.includes('nishad') || n.includes('nsh')) return 'airman-42';
  if (n.includes('zakirul') || n.includes('zkr')) return 'airman-43';
  if (n.includes('zubayer') || n.includes('zby') || n.includes('zbr')) return 'airman-44';
  if (n.includes('tusar') || n.includes('tsr') || n.includes('thn')) return 'airman-45';
  if (n.includes('adnan') || n.includes('adn')) return 'airman-46';
  if (n.includes('rashed') || n.includes('rsd')) return 'airman-47';
  if (n.includes('saidul') || n.includes('sdl')) return 'airman-48';

  return null;
}

export function generateOfficialMonthAssignments(year: number, month: number): DutyAssignment[] {
  const isJuly = month === 7;
  const rawList = isJuly ? JULY_RAW_DATA : AUGUST_RAW_DATA;
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  const assignments: DutyAssignment[] = [];

  // Track daily duty codes for off calculation
  const airmanDailyDuty = new Map<string, Map<number, { dutyCode: DutyAssignment['dutyCode']; idaShift?: DutyAssignment['idaShift'] }>>();

  rawList.forEach((dayData) => {
    const day = dayData.day;
    const dayStr = day < 10 ? `0${day}` : `${day}`;
    const date = `${year}-${monthStr}-${dayStr}`;

    const addDuty = (names: string[] | undefined, dutyCode: DutyAssignment['dutyCode'], idaShift?: DutyAssignment['idaShift'], notes?: string) => {
      if (!names) return;
      names.forEach((name) => {
        const airmanId = getAirmanIdByName(name);
        if (!airmanId) return;

        if (!airmanDailyDuty.has(airmanId)) {
          airmanDailyDuty.set(airmanId, new Map());
        }
        airmanDailyDuty.get(airmanId)!.set(day, { dutyCode, idaShift });

        assignments.push({
          airmanId,
          date,
          dutyCode,
          idaShift,
          notes: notes || undefined,
        });
      });
    };

    addDuty(dayData.gd, 'GD', undefined, 'Base Security Duty');
    addDuty(dayData.btf, 'BTF', undefined, 'Base Taskforce Duty');
    addDuty(dayData.ntf, 'NTF', undefined, 'Najirpara Taskforce Duty');
    addDuty(dayData.airfield, 'AIRPORT', undefined, 'Airfield Duty');
    addDuty(dayData.halishahar, 'HALISHAHAR', undefined, 'Halishahar Duty');
    addDuty(dayData.bakeNBite, 'BAKE_N_BITE', undefined, 'Bake & Bite');
    addDuty(dayData.tdy, 'TDY', undefined, 'TDY / Attachment');
    addDuty(dayData.leave, 'LEAVE', undefined, 'Casual Leave (CL)');
    addDuty(dayData.idaMorning, 'IDAC', 'Morning', 'IDA Center Duty');
    addDuty(dayData.idaAfternoon, 'IDAC', 'Afternoon', 'IDA Center Duty');
    addDuty(dayData.idaNight, 'IDAC', 'Night', 'IDA Center Duty');

    // Add dutyOff with resolved previous night duty notes
    if (dayData.dutyOff) {
      dayData.dutyOff.forEach((name) => {
        const airmanId = getAirmanIdByName(name);
        if (!airmanId) return;

        // Check previous day's duty
        const yestDuty = airmanDailyDuty.get(airmanId)?.get(day - 1);
        let offNote = 'Duty Off';
        if (yestDuty) {
          if (yestDuty.dutyCode === 'IDAC' || yestDuty.dutyCode === 'IDA') {
            offNote = 'IDAC Nt Off';
          } else if (yestDuty.dutyCode === 'GD') {
            offNote = 'GD Off';
          } else if (yestDuty.dutyCode === 'BTF') {
            offNote = 'BTF Off';
          } else if (yestDuty.dutyCode === 'NTF') {
            offNote = 'NTF Off';
          } else if (yestDuty.dutyCode === 'AIRPORT') {
            offNote = 'Airfield Off';
          } else if (yestDuty.dutyCode === 'HALISHAHAR') {
            offNote = 'Halishahar Off';
          }
        } else if (name.toLowerCase().includes('rasel') || name.toLowerCase().includes('saidul')) {
          offNote = 'IDAC Nt Off';
        }

        // Only add DUTY_OFF if airman does not already have an active daytime duty scheduled
        const hasActiveDayDuty = assignments.some(
          (a) => a.airmanId === airmanId && a.date === date && a.dutyCode !== 'DUTY_OFF' && a.dutyCode !== 'IDAC'
        );

        if (!hasActiveDayDuty) {
          assignments.push({
            airmanId,
            date,
            dutyCode: 'DUTY_OFF',
            notes: offNote,
          });
        }
      });
    }
  });

  // Post-process LEAVE entries: Any contiguous leave span > 7 days (8 days or more) is automatically tagged as Annual Leave (AL)
  const leaveDaysByAirman = new Map<string, number[]>();
  assignments.forEach((a) => {
    if (a.dutyCode === 'LEAVE') {
      const dayNum = parseInt(a.date.split('-')[2], 10);
      if (!leaveDaysByAirman.has(a.airmanId)) {
        leaveDaysByAirman.set(a.airmanId, []);
      }
      leaveDaysByAirman.get(a.airmanId)!.push(dayNum);
    }
  });

  leaveDaysByAirman.forEach((days, airmanId) => {
    const sorted = Array.from(new Set(days)).sort((a, b) => a - b);
    // Find contiguous streaks
    let streak: number[] = [];
    const annualDays = new Set<number>();

    for (let i = 0; i < sorted.length; i++) {
      if (streak.length === 0 || sorted[i] === streak[streak.length - 1] + 1) {
        streak.push(sorted[i]);
      } else {
        if (streak.length > 7) {
          streak.forEach((d) => annualDays.add(d));
        }
        streak = [sorted[i]];
      }
    }
    if (streak.length > 7) {
      streak.forEach((d) => annualDays.add(d));
    }

    // Also check total month leave > 7 days
    if (sorted.length > 7) {
      sorted.forEach((d) => annualDays.add(d));
    }

    if (annualDays.size > 0) {
      assignments.forEach((a) => {
        if (a.airmanId === airmanId && a.dutyCode === 'LEAVE') {
          const d = parseInt(a.date.split('-')[2], 10);
          if (annualDays.has(d)) {
            a.notes = 'Annual Leave (AL)';
          }
        }
      });
    }
  });

  return assignments;
}

export function getOfficialParadeStateDocument(
  year: number = 2026,
  monthChoice: number | string = 'all',
  airmenList?: any[]
) {
  const monthsToProcess: number[] = [];
  if (monthChoice === 7 || monthChoice === '7' || monthChoice === '07' || monthChoice === 'july') {
    monthsToProcess.push(7);
  } else if (monthChoice === 8 || monthChoice === '8' || monthChoice === '08' || monthChoice === 'august') {
    monthsToProcess.push(8);
  } else {
    monthsToProcess.push(7, 8);
  }

  const airmen = airmenList || [];
  const findAirman = (id: string | null) => airmen.find((a: any) => a.id === id);

  const dates: any[] = [];

  monthsToProcess.forEach((m) => {
    const isJuly = m === 7;
    const rawList = isJuly ? JULY_RAW_DATA : AUGUST_RAW_DATA;
    const monthStr = m < 10 ? `0${m}` : `${m}`;

    rawList.forEach((dayData) => {
      const day = dayData.day;
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      const dateObj = new Date(year, m - 1, day);
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = dayNames[dateObj.getDay()];

      const dayAssignments: any[] = [];

      const addItems = (names: string[] | undefined, dutyCode: string, dutyName: string, idaShift?: string) => {
        if (!names) return;
        names.forEach((name) => {
          const airmanId = getAirmanIdByName(name);
          const matchedAirman = airmanId ? findAirman(airmanId) : null;
          dayAssignments.push({
            rawText: name,
            dutyCode,
            dutyName,
            idaShift: idaShift || null,
            matchedAirmanId: matchedAirman ? matchedAirman.id : airmanId,
            matchedAirmanName: matchedAirman ? matchedAirman.name : name,
            matchedAirmanRank: matchedAirman ? matchedAirman.rank : '',
            matchedAirmanTrade: matchedAirman ? matchedAirman.trade : '',
            matchedAirmanFlight: matchedAirman ? matchedAirman.flightName : 'Avionics',
            matchedAirmanBdNo: matchedAirman ? matchedAirman.bdNo : '',
            confidence: 0.98,
            isIgnored: false,
          });
        });
      };

      addItems(dayData.gd, 'GD', 'Base Security Duty');
      addItems(dayData.btf, 'BTF', 'Base Taskforce Duty');
      addItems(dayData.ntf, 'NTF', 'Najirpara Taskforce Duty');
      addItems(dayData.airfield, 'ATT', 'Airfield Duty');
      addItems(dayData.halishahar, 'HALISHAHAR', 'Halishahar Duty');
      addItems(dayData.bakeNBite, 'BAKE_N_BITE', 'Bake & Bite');
      addItems(dayData.tdy, 'TDY', 'TDY / Attachment');
      addItems(dayData.leave, 'LEAVE', 'Leave (CL/AL)');
      addItems(dayData.idaMorning, 'IDAC', 'IDA Center Duty', 'Morning');
      addItems(dayData.idaAfternoon, 'IDAC', 'IDA Center Duty', 'Afternoon');
      addItems(dayData.idaNight, 'IDAC', 'IDA Center Duty', 'Night');

      dates.push({
        date: dateStr,
        dayName,
        assignments: dayAssignments,
      });
    });
  });

  return {
    documentTitle: `PARADE STATE : AIRMEN AVI FLT (${monthsToProcess.includes(7) && monthsToProcess.includes(8) ? '01 Jul - 31 Aug' : monthsToProcess.includes(7) ? 'July' : 'August'} ${year})`,
    detectedFlight: 'Avionics',
    year,
    month: monthsToProcess[0],
    totalDates: dates.length,
    dateRange: {
      start: dates[0]?.date || `${year}-07-01`,
      end: dates[dates.length - 1]?.date || `${year}-08-31`,
    },
    dates,
  };
}


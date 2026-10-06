import { supabase } from '../../../supabase';
import { pushKeyToCloud, pullKeyFromCloud } from './canteenCloudSync';
import { formatRankBn, formatMemberNameBn } from './exportCanteenBillExcel';
import { isCivilianMember } from './canteenSeniority';

export const BANGLA_NAMES_STORAGE_KEY = 'canteen_member_bangla_names';

export interface BafRankOption {
  rank: string;
  bn: string;
}

export const BAF_RANKS_WITH_BN: BafRankOption[] = [
  { rank: 'Air Chief Mshl', bn: 'এয়ার চিফ মার্শাল' },
  { rank: 'Air Mshl', bn: 'এয়ার মার্শাল' },
  { rank: 'AVM', bn: 'এয়ার ভাইস মার্শাল' },
  { rank: 'Air Cdre', bn: 'এয়ার কমোডর' },
  { rank: 'Gp Capt', bn: 'গ্রুপ ক্যাপ্টেন' },
  { rank: 'Wg Cdr', bn: 'উইং কমাঃ' },
  { rank: 'Sqn Ldr', bn: 'স্কোঃ লীঃ' },
  { rank: 'Flt Lt', bn: 'ফ্লাঃ লেঃ' },
  { rank: 'Flg Offr', bn: 'ফ্লাঃ অঃ' },
  { rank: 'Plt Offr', bn: 'পাইলট অফিসার' },
  { rank: 'MWO', bn: 'মাঃওঃঅঃ (মাস্টার ওয়ারেন্ট অফিসার)' },
  { rank: 'SWO', bn: 'সিঃ ওঃ অঃ (সিনিয়র ওয়ারেন্ট অফিসার)' },
  { rank: 'WO', bn: 'ওঃঅঃ (ওয়ারেন্ট অফিসার)' },
  { rank: 'Sgt', bn: 'সার্জেন্ট' },
  { rank: 'Cpl', bn: 'কর্পোরাল' },
  { rank: 'LAC', bn: 'এলএসি' },
  { rank: 'AC-1', bn: 'এসি-১' },
  { rank: 'AC-2', bn: 'এসি-২' },
  { rank: 'NC(E)', bn: 'এনসি(ই)' },
  { rank: 'Civilian', bn: 'সিভিলিয়ান' },
  { rank: '-', bn: '-' }
];

/**
 * Standard pre-populated Bengali names for all canteen members and ranks.
 * The manager/user can edit any of these at any time in Member DB!
 */
export const DEFAULT_MEMBER_BANGLA_NAMES: Record<string, string> = {
  // LAC
  "BD/474513": "মেহেদী", "474513": "মেহেদী", "mahedi": "মেহেদী",
  "BD/474608": "জয়", "474608": "জয়", "joy": "জয়",
  "BD/474730": "আশরাফুল", "474730": "আশরাফুল", "ashraful": "আশরাফুল",
  "BD/475391": "জুবায়ের", "475391": "জুবায়ের", "zubayer": "জুবায়ের",
  "BD/474758": "হৃদয়", "474758": "হৃদয়", "hridoy": "হৃদয়",
  "BD/474806": "মেহেদী", "474806": "মেহেদী", "mehedi": "মেহেদী",
  "BD/476257": "সাইদুল", "476257": "সাইদুল", "saidul": "সাইদুল",
  "BD/475902": "আদনান", "475902": "আদনান", "adnan": "আদনান",
  "BD/474549": "রাকিব", "474549": "রাকিব", "rakib": "রাকিব",
  "BD/474455": "রাসেল", "474455": "রাসেল", "rasel": "রাসেল",
  "BD/475803": "তুষার", "475803": "তুষার", "tusar": "তুষার", "tushar": "তুষার",
  "BD/475296": "জাকিরুল", "475296": "জাকিরুল", "zakirul": "জাকিরুল",
  "BD/476023": "রাশেদ", "476023": "রাশেদ", "rashed": "রাশেদ",
  "BD/475268": "নিশাদ", "475268": "নিশাদ", "nishad": "নিশাদ",

  // Civilians & Staff (Actual Bengali names as in database)
  "airman-1": "তানভীর", "1": "তানভীর", "tanvir": "তানভীর", "tanveer": "তানভীর",
  "airman-13": "শরীফ", "13": "শরীফ", "sharif": "শরীফ",
  "airman-12": "ইরফান", "12": "ইরফান", "irfan": "ইরফান",
  "airman-2": "নূর নবী", "2": "নূর নবী", "nur nabi": "নূর নবী", "nur nobi": "নূর নবী",
  "airman-3": "আকরামুল", "3": "আকরামুল", "akramul": "আকরামুল",
  "airman-10": "আশিক", "10": "আশিক", "ashik": "আশিক",
  "airman-16": "মিজান", "16": "মিজান", "mizan": "মিজান",
  "airman-18": "ইউনিট গেস্ট", "18": "ইউনিট গেস্ট", "unit guest": "ইউনিট গেস্ট", "guest": "গেস্ট",

  // Officers (Wg Cdr, Sqn Ldr, Flt Lt, Flg Offr)
  "airman-9241": "আফতাব", "9241": "আফতাব", "aftab": "আফতাব",
  "airman-17": "সোনিয়া", "17": "সোনিয়া", "sonia": "সোনিয়া",
  "airman-14": "শোহানা", "14": "শোহানা", "shohana": "শোহানা",
  "airman-9533": "ফারহান", "9533": "ফারহান", "farhan": "ফারহান",
  "airman-9516": "তারেক", "9516": "তারেক", "tareq": "তারেক", "tarek": "তারেক",
  "airman-6": "ফারুকুল", "6": "ফারুকুল", "farukul": "ফারুকুল",
  "airman-5": "সাব্বির", "5": "সাব্বির", "sabbir": "সাব্বির",
  "airman-10157": "শর্মিলা", "10157": "শর্মিলা", "sharmila": "শর্মিলা",
  "airman-10076": "শাদমান", "10076": "শাদমান", "shadman": "শাদমান",
  "airman-10419": "রিফাতবিন", "10419": "রিফাতবিন", "rifatbin": "রিফাতবিন", "rifat": "রিফাত",
  "airman-10045": "মোস্তাবী", "10045": "মোস্তাবী", "mostavi": "মোস্তাবী",
  "airman-4": "কামরুল", "4": "কামরুল", "kamrul": "কামরুল",
  "airman-10427": "মনোয়ার", "10427": "মনোয়ার", "monawar": "মনোয়ার",
  "airman-8": "আহসান", "8": "আহসান", "ahsan": "আহসান",
  "airman-7": "ফারহান", "7": "ফারহান",
  "airman-10393": "তাসনোভা", "10393": "তাসনোভা", "tasnova": "তাসনোভা",
  "airman-10394": "হাসিব", "10394": "হাসিব", "hasib": "হাসিব",
  "airman-10482": "ওয়াসি", "10482": "ওয়াসি", "wasi": "ওয়াসি",
  "airman-9": "সাজিদ", "9": "সাজিদ", "sazid": "সাজিদ", "sajid": "সাজিদ",
  "airman-15": "মুসাব্বির", "15": "মুসাব্বির", "musabbir": "মুসাব্বির",

  // Warrant Officers (SWO, WO)
  "BD/470696": "মশিউর", "470696": "মশিউর", "mashiur": "মশিউর", "moshiur": "মশিউর",
  "BD/464358": "মোস্তফা", "464358": "মোস্তফা", "mostafa": "মোস্তফা",
  "BD/465917": "লুৎফর", "465917": "লুৎফর", "lutfar": "লুৎফর", "lutfor": "লুৎফর",
  "BD/465722": "শাহীন", "465722": "শাহীন", "shahin": "শাহীন",
  "BD/466218": "আমিনুল", "466218": "আমিনুল", "aminul": "আমিনুল",
  "BD/465669": "এ. বাতেন", "465669": "এ. বাতেন", "a. baten": "এ. বাতেন", "baten": "বাতেন",
  "BD/465199": "মোজাফফর", "465199": "মোজাফফর", "mojaffar": "মোজাফফর",
  "BD/465170": "জাহিদ", "465170": "জাহিদ", "jahid": "জাহিদ",

  // Sergeants (Sgt)
  "BD/467992": "উজ্জ্বল", "467992": "উজ্জ্বল", "uzzal": "উজ্জ্বল", "ujjal": "উজ্জ্বল",
  "BD/469598": "মুস্তাকিম", "469598": "মুস্তাকিম", "mustakim": "মুস্তাকিম",
  "BD/468582": "রিয়াজ", "468582": "রিয়াজ", "riaz": "রিয়াজ",
  "BD/468920": "আবসার", "468920": "আবসার", "absar": "আবসার",
  "BD/469965": "রিপন", "469965": "রিপন", "ripon": "রিপন",
  "BD/469412": "ফখরুল", "469412": "ফখরুল", "fokrul": "ফখরুল", "fakhrul": "ফখরুল",
  "BD/468603": "মোবারক", "468603": "মোবারক", "mobarak": "মোবারক",
  "BD/468892": "রুবেল", "468892": "রুবেল", "rubel": "রুবেল",
  "BD/468991": "মাহিদ", "468991": "মাহিদ", "mahid": "মাহিদ",
  "BD/470499": "নাহিদ", "470499": "নাহিদ", "nahid": "নাহিদ",
  "BD/470076": "এ. গফুর", "470076": "এ. গফুর", "a. gafur": "এ. গফুর", "gafur": "গফুর",
  "BD/469153": "আসাদ", "469153": "আসাদ", "asad": "আসাদ",
  "BD/469951": "মেহেদী", "469951": "মেহেদী",
  "BD/470089": "সোহেল", "470089": "সোহেল", "shohel": "সোহেল", "sohel": "সোহেল",
  "BD/471091": "ইমরান", "471091": "ইমরান", "imran": "ইমরান",
  "BD/469539": "শিশির", "469539": "শিশির", "shishir": "শিশির",

  // Corporals (Cpl)
  "BD/472206": "সজীব", "472206": "সজীব", "sajib": "সজীব", "sojib": "সজীব",
  "BD/471830": "ইসমাইল", "471830": "ইসমাইল", "ismail": "ইসমাইল",
  "BD/471833": "আহসান", "471833": "আহসান", "ahasan": "আহসান",
  "BD/472026": "কোরাইশী", "472026": "কোরাইশী", "koraishi": "কোরাইশী",
  "BD/473856": "আকাশ", "473856": "আকাশ", "akash": "আকাশ",
  "BD/473431": "মারাজ", "473431": "মারাজ", "maraz": "মারাজ",
  "BD/473673": "শরিফুল", "473673": "শরিফুল", "shariful": "শরিফুল",
  "BD/471467": "ওমর", "471467": "ওমর", "omar": "ওমর",
  "BD/471269": "হারুন", "471269": "হারুন", "harun": "হারুন"
};

/**
 * Common surname keyword mapping for auto-matching any member by name
 */
export const COMMON_SURNAME_DICTIONARY: Record<string, string> = {
  "tanvir": "তানভীর",
  "tanveer": "তানভীর",
  "sharif": "শরীফ",
  "irfan": "ইরফান",
  "nur nabi": "নূর নবী",
  "nur nobi": "নূর নবী",
  "akramul": "আকরামুল",
  "mahedi": "মেহেদী",
  "mehedi": "মেহেদী",
  "joy": "জয়",
  "ashraful": "আশরাফুল",
  "zubayer": "জুবায়ের",
  "hridoy": "হৃদয়",
  "saidul": "সাইদুল",
  "adnan": "আদনান",
  "rakib": "রাকিব",
  "rasel": "রাসেল",
  "ashik": "আশিক",
  "tusar": "তুষার",
  "tushar": "তুষার",
  "zakirul": "জাকিরুল",
  "rashed": "রাশেদ",
  "nishad": "নিশাদ",
  "aftab": "আফতাব",
  "sonia": "সোনিয়া",
  "shohana": "শোহানা",
  "farhan": "ফারহান",
  "tareq": "তারেক",
  "tarek": "তারেক",
  "farukul": "ফারুকুল",
  "sabbir": "সাব্বির",
  "sharmila": "শর্মিলা",
  "shadman": "শাদমান",
  "rifatbin": "রিফাতবিন",
  "rifat": "রিফাত",
  "mostavi": "মোস্তাবী",
  "kamrul": "কামরুল",
  "monawar": "মনোয়ার",
  "ahsan": "আহসান",
  "ahasan": "আহসান",
  "tasnova": "তাসনোভা",
  "hasib": "হাসিব",
  "wasi": "ওয়াসি",
  "sazid": "সাজিদ",
  "sajid": "সাজিদ",
  "musabbir": "মুসাব্বির",
  "moshiur": "মশিউর",
  "mashiur": "মশিউর",
  "mostafa": "মোস্তফা",
  "lutfar": "লুৎফর",
  "lutfor": "লুৎফর",
  "shahin": "শাহীন",
  "aminul": "আমিনুল",
  "baten": "বাতেন",
  "a. baten": "এ. বাতেন",
  "mojaffar": "মোজাফফর",
  "mizan": "মিজান",
  "jahid": "জাহিদ",
  "uzzal": "উজ্জ্বল",
  "ujjal": "উজ্জ্বল",
  "mustakim": "মুস্তাকিম",
  "riaz": "রিয়াজ",
  "absar": "আবসার",
  "ripon": "রিপন",
  "fokrul": "ফখরুল",
  "fakhrul": "ফখরুল",
  "mobarak": "মোবারক",
  "rubel": "রুবেল",
  "mahid": "মাহিদ",
  "nahid": "নাহিদ",
  "gafur": "গফুর",
  "a. gafur": "এ. গফুর",
  "asad": "আসাদ",
  "shohel": "সোহেল",
  "sohel": "সোহেল",
  "imran": "ইমরান",
  "shishir": "শিশির",
  "sajib": "সজীব",
  "sojib": "সজীব",
  "ismail": "ইসমাইল",
  "koraishi": "কোরাইশী",
  "akash": "আকাশ",
  "maraz": "মারাজ",
  "shariful": "শরিফুল",
  "omar": "ওমর",
  "harun": "হারুন",
  "unit guest": "ইউনিট গেস্ট",
  "guest": "গেস্ট"
};

let cachedBanglaNames: Record<string, string> | null = null;

/**
 * Get all current Bengali names (merged local, default, and cached)
 */
export function getAllMemberBanglaNames(): Record<string, string> {
  if (cachedBanglaNames) return cachedBanglaNames;

  try {
    const raw = localStorage.getItem(BANGLA_NAMES_STORAGE_KEY);
    const local = raw ? JSON.parse(raw) : {};
    cachedBanglaNames = { ...DEFAULT_MEMBER_BANGLA_NAMES, ...local };
  } catch {
    cachedBanglaNames = { ...DEFAULT_MEMBER_BANGLA_NAMES };
  }

  return cachedBanglaNames;
}

/**
 * Clean a name string by removing military ranks, parenthesis, and extra whitespaces
 */
function cleanSurname(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\b(lac|cpl|sgt|wo|swo|civ|flt\s*lt|sqn\s*ldr|wg\s*cdr|flg\s*offr|guest|airman|mr)\b/gi, '')
    .replace(/[()_.\-\/]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Get Bengali name for a member object or identifier
 */
export function getMemberBanglaName(memberOrId: any): string {
  if (!memberOrId) return '';
  const names = getAllMemberBanglaNames();

  // If passed an object
  if (typeof memberOrId === 'object') {
    // 1. Explicit override if already attached to object
    if (memberOrId.name_bn) return String(memberOrId.name_bn).trim();
    if (memberOrId.nameBn) return String(memberOrId.nameBn).trim();
    if (memberOrId.Surname_bn) return String(memberOrId.Surname_bn).trim();
    if (memberOrId.bangla_name) return String(memberOrId.bangla_name).trim();

    const airmanId = memberOrId.airman_id ? String(memberOrId.airman_id).trim() : '';
    const bdNoRaw = memberOrId['BD No'] || memberOrId.bdNo || memberOrId.bd_no || '';
    const bdNo = String(bdNoRaw).trim();
    const bdNoClean = bdNo.replace(/\D/g, '');
    const surname = memberOrId.Surname || memberOrId.surname || memberOrId.name || '';
    const surnameLower = String(surname).trim().toLowerCase();
    const cleaned = cleanSurname(surname);



    // Direct ID match
    if (airmanId && names[airmanId]) return names[airmanId];
    if (airmanId && names[airmanId.toLowerCase()]) return names[airmanId.toLowerCase()];

    // Direct BD No match
    if (bdNo && names[bdNo]) return names[bdNo];
    if (bdNo && names[`BD/${bdNo}`]) return names[`BD/${bdNo}`];
    if (bdNoClean && names[bdNoClean]) return names[bdNoClean];
    if (bdNoClean && names[`BD/${bdNoClean}`]) return names[`BD/${bdNoClean}`];

    // Surname exact match
    if (surnameLower && names[surnameLower]) return names[surnameLower];
    if (cleaned && names[cleaned]) return names[cleaned];

    // Check Common Surname Dictionary
    if (cleaned && COMMON_SURNAME_DICTIONARY[cleaned]) {
      return COMMON_SURNAME_DICTIONARY[cleaned];
    }

    // Check word-by-word in cleaned surname
    if (cleaned) {
      const parts = cleaned.split(' ');
      for (const p of parts) {
        if (p && names[p]) return names[p];
        if (p && COMMON_SURNAME_DICTIONARY[p]) return COMMON_SURNAME_DICTIONARY[p];
      }
    }

    // Fallback to comprehensive dictionary in exportCanteenBillExcel
    if (surname) {
      const fmt = formatMemberNameBn(surname);
      if (fmt && fmt !== surname) return fmt;
    }

    return formatMemberNameBn(cleaned) || '';
  }

  // If passed a string ID / BD / Surname
  const str = String(memberOrId).trim();
  const lower = str.toLowerCase();
  const cleaned = cleanSurname(str);
  const cleanDigits = str.replace(/\D/g, '');

  if (names[str]) return names[str];
  if (names[lower]) return names[lower];
  if (names[`BD/${str}`]) return names[`BD/${str}`];
  if (cleanDigits && names[cleanDigits]) return names[cleanDigits];
  if (cleanDigits && names[`BD/${cleanDigits}`]) return names[`BD/${cleanDigits}`];
  if (cleaned && names[cleaned]) return names[cleaned];
  if (cleaned && COMMON_SURNAME_DICTIONARY[cleaned]) return COMMON_SURNAME_DICTIONARY[cleaned];

  const fmt = formatMemberNameBn(str);
  if (fmt && fmt !== str) return fmt;

  return formatMemberNameBn(cleaned) || '';
}

/**
 * Save or update a member's Bengali name in local storage and Supabase Cloud
 */
export async function saveMemberBanglaName(
  memberIdOrBd: string, 
  nameBn: string, 
  additionalKeys?: string[]
): Promise<void> {
  const current = getAllMemberBanglaNames();
  const trimmedKey = String(memberIdOrBd).trim();
  const trimmedVal = String(nameBn).trim();

  if (trimmedKey) {
    current[trimmedKey] = trimmedVal;
    current[trimmedKey.toLowerCase()] = trimmedVal;
  }

  if (additionalKeys && Array.isArray(additionalKeys)) {
    additionalKeys.forEach(k => {
      if (k) {
        const clean = String(k).trim();
        if (clean) {
          current[clean] = trimmedVal;
          current[clean.toLowerCase()] = trimmedVal;
          const digits = clean.replace(/\D/g, '');
          if (digits) {
            current[digits] = trimmedVal;
            current[`BD/${digits}`] = trimmedVal;
          }
        }
      }
    });
  }

  cachedBanglaNames = { ...current };

  try {
    localStorage.setItem(BANGLA_NAMES_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('canteen_member_bangla_names_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));

    // Push to Supabase Cloud ('app_settings' table)
    await pushKeyToCloud(BANGLA_NAMES_STORAGE_KEY, current);
  } catch (err) {
    console.warn('Error saving Bengali name:', err);
  }
}

/**
 * Fetch and sync latest Bengali names from Supabase Cloud
 */
export async function syncMemberBanglaNamesFromCloud(): Promise<Record<string, string>> {
  try {
    const cloudData = await pullKeyFromCloud(BANGLA_NAMES_STORAGE_KEY);
    if (cloudData && typeof cloudData === 'object') {
      const merged = { ...DEFAULT_MEMBER_BANGLA_NAMES, ...getAllMemberBanglaNames(), ...cloudData };
      cachedBanglaNames = merged;
      localStorage.setItem(BANGLA_NAMES_STORAGE_KEY, JSON.stringify(merged));
      window.dispatchEvent(new Event('canteen_member_bangla_names_updated'));
      return merged;
    }
  } catch (err) {
    console.warn('Failed to pull bangla names from cloud:', err);
  }
  return getAllMemberBanglaNames();
}

/**
  * Get Bengali Rank for a member object or rank string
  */
export function getMemberBanglaRank(rankOrMember: any): string {
  if (!rankOrMember) return '';
  const names = getAllMemberBanglaNames();

  if (typeof rankOrMember === 'object') {
    const rawR = String(rankOrMember['Rank'] || rankOrMember.rank || '').trim();
    if (rawR === '-') return '-';
    if (isCivilianMember(rankOrMember)) return 'সিভিলিয়ান';
    if (rankOrMember.Rank_bn) return String(rankOrMember.Rank_bn).trim();
    if (rankOrMember.rankBn) return String(rankOrMember.rankBn).trim();
    if (rankOrMember.rank_bn) return String(rankOrMember.rank_bn).trim();

    const airmanId = rankOrMember.airman_id ? String(rankOrMember.airman_id).trim() : '';
    const bdNo = String(rankOrMember['BD No'] || rankOrMember.bdNo || '').trim();
    if (airmanId && names[`rank_${airmanId}`]) return names[`rank_${airmanId}`];
    if (bdNo && names[`rank_${bdNo}`]) return names[`rank_${bdNo}`];

    return formatRankBn(rankOrMember['Rank'] || rankOrMember.rank || '');
  }

  const str = String(rankOrMember).trim();
  if (str === '-') return '-';
  if (str.toUpperCase().includes('CIV') || str.includes('বেসামরিক') || str.includes('সিভিলিয়ান')) return 'সিভিলিয়ান';
  if (names[`rank_${str}`]) return names[`rank_${str}`];
  return formatRankBn(str);
}

/**
  * Save or update a member's Bengali Rank in local storage and Supabase Cloud
  */
export async function saveMemberBanglaRank(
  memberIdOrBd: string,
  rankBn: string,
  additionalKeys?: string[]
): Promise<void> {
  const current = getAllMemberBanglaNames();
  const trimmedKey = `rank_${String(memberIdOrBd).trim()}`;
  const trimmedVal = String(rankBn).trim();

  current[trimmedKey] = trimmedVal;

  if (additionalKeys && Array.isArray(additionalKeys)) {
    additionalKeys.forEach(k => {
      if (k) {
        current[`rank_${String(k).trim()}`] = trimmedVal;
      }
    });
  }

  cachedBanglaNames = { ...current };

  try {
    localStorage.setItem(BANGLA_NAMES_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('canteen_member_bangla_names_updated'));
    window.dispatchEvent(new Event('canteen_state_updated'));
    window.dispatchEvent(new Event('storage'));

    await pushKeyToCloud(BANGLA_NAMES_STORAGE_KEY, current);
  } catch (err) {
    console.warn('Error saving Bengali rank:', err);
  }
}


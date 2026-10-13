/**
 * Pure Bengali text and number formatting helpers.
 * Zero external dependencies — ensures ultra-fast, lightweight initial bundle.
 */

// Convert English numbers to Bengali numerals
export const toBengaliNum = (num: number | string): string => {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/\d/g, (d) => bn[parseInt(d, 10)]);
};

// Map BAF military rank to Bengali official abbreviation matching the Excel template
export const formatRankBn = (rankStr?: string): string => {
  if (!rankStr) return '';
  const r = rankStr.toUpperCase().trim();

  // If already Bengali
  if (r.includes('মাঃ ওঃ অঃ') || r.includes('মাঃওঃঅঃ') || r.includes('মাস্টার ওয়ারেন্ট') || r.includes('মাস্টার ওয়ারেন্ট')) return 'মাঃ ওঃ অঃ';
  if (r.includes('সিঃ ওঃ অঃ') || r.includes('সিঃওঃঅঃ') || r.includes('সিনিয়র ওয়ারেন্ট') || r.includes('সিনিয়র ওয়ারেন্ট')) return 'সিঃ ওঃ অঃ';
  if (r.includes('ওঃ অঃ') || r.includes('ওঃঅঃ') || r.includes('ওয়ারেন্ট') || r.includes('ওয়ারেন্ট')) return 'ওঃ অঃ';
  if (r.includes('সার্জেন্ট') || r.includes('সার্জেণ্ট')) return 'সার্জেন্ট';
  if (r.includes('কর্পোরাল')) return 'কর্পোরাল';
  if (r.includes('এলএসি')) return 'এলএসি';
  if (r.includes('এসি')) return 'এসি';

  // Warrant Officers (JCOs)
  if (r === 'MWO' || r.includes('MASTER WARRANT')) return 'মাঃ ওঃ অঃ';
  if (r === 'SWO' || r.includes('SENIOR WARRANT')) return 'সিঃ ওঃ অঃ';
  if (r === 'WO' || r.includes('WARRANT OFFICER')) return 'ওঃ অঃ';

  // Commissioned Officers
  if (r.includes('AIR CHIEF') || r === 'ACM') return 'এসিএম';
  if (r.includes('AIR MSHL') || r === 'AM') return 'এয়ার মার্শাল';
  if (r.includes('AVM') || r.includes('AIR VICE')) return 'এভিএম';
  if (r.includes('AIR CDRE') || r.includes('AIR COMMODORE')) return 'এয়ার কমোডর';
  if (r.includes('GP CAPT') || r.includes('GROUP CAPTAIN')) return 'গ্রুপ ক্যাপ্টেন';
  if (r.includes('WG CDR') || r.includes('WING COMMANDER')) return 'উইং কমান্ডার';
  if (r.includes('SQN LDR') || r.includes('SQUADRON LEADER')) return 'স্কোয়াড্রন লিডার';
  if (r.includes('FLT LT') || r.includes('FLIGHT LIEUTENANT')) return 'ফ্লাইট লেফটেন্যান্ট';
  if (r.includes('FLG OFFR') || r.includes('FLYING OFFICER')) return 'ফ্লাইং অফিসার';
  if (r.includes('PLT OFFR') || r.includes('PILOT OFFICER')) return 'পাইলট অফিসার';

  // Airmen NCOs and ORs
  if (r.includes('SGT') || r.includes('SERGEANT')) return 'সার্জেন্ট';
  if (r.includes('CPL') || r.includes('CORPORAL')) return 'কর্পোরাল';
  if (r.includes('LAC') || r.includes('LEADING AIRCRAFTMAN')) return 'এলএসি';
  if (r.includes('AC-1') || r.includes('AC 1') || r.includes('AC1')) return 'এসি-১';
  if (r.includes('AC-2') || r.includes('AC 2') || r.includes('AC2')) return 'এসি-২';
  if (r.includes('AC') || r.includes('AIRCRAFTMAN')) return 'এসি';

  // Non-Combatant & Civilians
  if (r.includes('NC(E)') || r.includes('NCE')) return 'এনসি(ই)';
  if (r.includes('CIV') || r.includes('CIVILIAN')) return 'বেসামরিক';

  return rankStr;
};

// Map common military personnel surnames and names to official Bengali spellings
export const formatMemberNameBn = (nameStr?: string): string => {
  if (!nameStr) return '';
  const trimmed = nameStr.trim();

  // If already Bengali, return directly
  if (/[\u0980-\u09FF]/.test(trimmed)) {
    return trimmed;
  }

  const nameMap: Record<string, string> = {
    'Mostafa': 'মোস্তফা',
    'Mashiur': 'মশিউর',
    'Jahid': 'জাহিদ',
    'Mojaffar': 'মোজাফফর',
    'A. Baten': 'আঃ বাতেন',
    'Baten': 'বাতেন',
    'Shahin': 'শাহীন',
    'Lutfar': 'লুৎফর',
    'Aminul': 'আমিনুল',
    'Uzzal': 'উজ্জ্বল',
    'Riaz': 'রিয়াজ',
    'Mobarak': 'মোবারক',
    'Rubel': 'রুবেল',
    'Absar': 'আবসার',
    'Mahid': 'মাহিদ',
    'Asad': 'আসাদ',
    'Fokrul': 'ফকরুল',
    'Fakrul': 'ফকরুল',
    'A. Gafur': 'আঃ গফুর',
    'Gafur': 'গফুর',
    'Mehedi': 'মেহেদী',
    'Mahedi': 'মেহেদী',
    'Mustakim': 'মুস্তাকিম',
    'Shishir': 'শিশির',
    'Sojib': 'সজীব',
    'Sajib': 'সজীব',
    'Shohel': 'সোহেল',
    'Ripon': 'রিপন',
    'Imran': 'ইমরান',
    'Omar': 'ওমর',
    'Nahid': 'নাহিদ',
    'Rakib': 'রাকিব',
    'Akash': 'আকাশ',
    'Saidul': 'সাইদুল',
    'Nishad': 'নিশাদ',
    'Zakirul': 'জাকিরুল',
    'Ahasan': 'আহসান',
    'Koraishi': 'কোরাইশী',
    'Maraz': 'মারাজ',
    'Joy': 'জয়',
    'Shariful': 'শরিফুল',
    'Rasel': 'রাসেল',
    'Ismail': 'ইসমাইল',
    'Tusar': 'তুষার',
    'Harun': 'হারুন',
    'Hridoy': 'হৃদয়',
    'Zubayer': 'জুবায়ের',
    'Ashraful': 'আশরাফুল',
    'Rashed': 'রাশেদ',
    'Adnan': 'আদনান',
    'Tanvir': 'তানভীর',
    'Akramul': 'আকরামুল',
    'Nur Nabi': 'নূর নবী',
    'A. Rahman': 'আঃ রহমান',
    'Mizanur': 'মিজানুর',
    'Rezaul': 'রেজাউল',
    'Al Amin': 'আল আমিন',
    'Arif': 'আরিফ',
    'Faruk': 'ফারুক',
    'Monir': 'মনির',
    'Kamrul': 'কামরুল',
    'Habib': 'হাবিব',
    'Nazmul': 'নাজমুল',
    'Masum': 'মাসুম',
    'Shamim': 'শামীম',
    'Shafiq': 'শফিক',
    'Tareq': 'তারেক',
    'Faisal': 'ফয়সাল',
    'Shakil': 'শাকিল',
    'Sumon': 'সুমন',
    'Sabbir': 'সাব্বির',
    'Kawsar': 'কাওসার',
    'Rizwan': 'রিজওয়ান',
    'Rizwan Islam': 'রিজওয়ান ইসলাম'
  };

  if (nameMap[trimmed]) {
    return nameMap[trimmed];
  }

  for (const [en, bn] of Object.entries(nameMap)) {
    if (trimmed.toLowerCase() === en.toLowerCase()) {
      return bn;
    }
  }

  return trimmed;
};

// Guarantee Supply Item always returns crisp, authentic "Supply Item"
export const formatItemNameBn = (rawName?: string): string => {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  const upper = trimmed.toUpperCase();

  if (
    upper === 'SUPPLY ITEM' ||
    upper === 'SUPPLY ITEMS' ||
    upper === 'SUPPLY' ||
    upper.includes('SUPPLY ITEM') ||
    upper.includes('SUPPLY ITEMS') ||
    trimmed.includes('সাপ্লাই')
  ) {
    return 'Supply Item';
  }

  if (/[\u0980-\u09FF]/.test(trimmed)) {
    if (trimmed.includes('পরোটা প্রিমিয়াম') || trimmed.includes('পরোটা প্রিমিয়াম')) {
      return trimmed.replace(/পরোটা\s*প্রিমি[য়াা]ম/g, 'পরোটা').trim();
    }
    return trimmed;
  }

  return trimmed;
};

// Helper to format Bengali Month & Year (e.g., "মার্চ ২০২৫")
export const formatBengaliMonthYear = (monthKey: string): string => {
  if (!monthKey || monthKey === 'ALL') return 'সকল মাস';
  const [yearStr, monthNumStr] = monthKey.split('-');
  const monthIdx = parseInt(monthNumStr, 10) - 1;
  const monthNamesBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
  ];
  const monthName = monthNamesBn[monthIdx] || monthKey;
  const yearBn = toBengaliNum(yearStr || '');
  return `${monthName} ${yearBn}`;
};

/**
 * Official 30 Canteen Menu Items in exact prescribed order.
 * All displays, catalogs, POS grids, inventory lists, and statement breakdowns
 * must strictly preserve this order.
 */
export const OFFICIAL_CANTEEN_MENU_ORDER: string[] = [
  'পরোটা প্রিমিয়াম',
  'পরোটা হোটেল',
  'ডিম ভাজি',
  'ডিম পোচ',
  'ডিম সিদ্ধ',
  'দুধ চা',
  'রং চা',
  'গ্রীন টি',
  'ব্ল্যাক কফি',
  'দুধ কফি',
  'কোল্ড কফি',
  'নুডুলস',
  'ডিম নুডুলস',
  'ড্রাই কেক',
  'নরমাল বিস্কুট',
  'এনার্জি বিস্কুট',
  'লেবুর শরবত',
  'চিকেন অনিয়ন',
  'চিকেন কারি',
  'চিকেন পোলাও',
  'চিকেন বিরিয়ানি',
  'চিকেন খিচুড়ি',
  'ডিম খিচুড়ি',
  'চিকেন হালিম',
  'চটপটি',
  'মিনি বার্গার',
  'পিজ্জা',
  'স্যান্ডউইচ',
  'কলা',
  'সিংগারা'
];

/**
 * Returns the exact 0-indexed order priority (0 to 29) for any food item.
 * Supports English names, Bengali names, catalog keys, and regional spellings.
 */
export function getCanteenMenuItemOrder(rawName?: string): number {
  if (!rawName) return 999;
  const s = String(rawName).toLowerCase().trim();

  // 1. পরোটা প্রিমিয়াম (Unit / Premium Porata)
  if (
    (s.includes('পরোটা') || s.includes('porata') || s.includes('paratha')) &&
    (s.includes('প্রিমিয়াম') || s.includes('premium') || s.includes('ইউনিট') || s.includes('unit'))
  ) {
    return 0;
  }

  // 2. পরোটা হোটেল (Hotel Porata)
  if (
    (s.includes('পরোটা') || s.includes('porata') || s.includes('paratha')) &&
    (s.includes('হোটেল') || s.includes('hotel'))
  ) {
    return 1;
  }

  // Generic porota fallback -> পরোটা প্রিমিয়াম
  if (s === 'পরোটা' || s === 'porata' || s === 'paratha') {
    return 0;
  }

  // 4. ডিম পোচ (check before fry)
  if (s.includes('পোচ') || s.includes('poach')) {
    return 3;
  }

  // 5. ডিম সিদ্ধ / সিদ্ধ ডিম (check before fry)
  if ((s.includes('ডিম') || s.includes('egg')) && (s.includes('সিদ্ধ') || s.includes('boiled'))) {
    return 4;
  }

  // 3. ডিম ভাজি / ফ্রাই / অমলেট
  if (
    (s.includes('ডিম') || s.includes('egg')) &&
    (s.includes('ভাজি') || s.includes('ফ্রাই') || s.includes('fry') || s.includes('অমলেট') || s.includes('omlet') || s.includes('mumlet') || s.includes('omelette'))
  ) {
    return 2;
  }

  // 8. গ্রীন টি (check before regular tea)
  if (s.includes('গ্রীন') || s.includes('গ্রিন') || s.includes('green tea') || s.includes('সবুজ চা')) {
    return 7;
  }

  // 7. রং চা / লিকার চা (check before milk tea)
  if (
    (s.includes('চা') || s.includes('tea')) &&
    (s.includes('রং') || s.includes('লিকার') || s.includes('liquor') || s.includes('raw') || s.includes('লাল') || s.includes('কাঁচা'))
  ) {
    return 6;
  }

  // 6. দুধ চা
  if ((s.includes('চা') || s.includes('tea')) && (s.includes('দুধ') || s.includes('milk'))) {
    return 5;
  }

  // 11. কোল্ড কফি (check before other coffees)
  if (s.includes('কোল্ড') || s.includes('cold')) {
    return 10;
  }

  // 9. ব্ল্যাক কফি
  if (s.includes('ব্ল্যাক') || s.includes('black coffee')) {
    return 8;
  }

  // 10. দুধ কফি / হট কফি / মিল্ক কফি
  if (
    (s.includes('কফি') || s.includes('coffee')) &&
    (s.includes('দুধ') || s.includes('milk') || s.includes('হট') || s.includes('hot'))
  ) {
    return 9;
  }

  // Generic tea/coffee fallbacks
  if (s === 'চা' || s === 'tea') return 5;
  if (s === 'কফি' || s === 'coffee') return 9;

  // 13. ডিম নুডুলস (check before general noodles)
  if (
    (s.includes('নুডুল') || s.includes('নুডল') || s.includes('noodle')) &&
    (s.includes('ডিম') || s.includes('এগ') || s.includes('egg'))
  ) {
    return 12;
  }

  // 12. নুডুলস
  if (s.includes('নুডুল') || s.includes('নুডল') || s.includes('noodle')) {
    return 11;
  }

  // 14. ড্রাই কেক
  if (s.includes('কেক') || s.includes('cake')) {
    return 13;
  }

  // 16. এনার্জি বিস্কুট (check before normal biscuit)
  if ((s.includes('বিস্কুট') || s.includes('biscuit')) && (s.includes('এনার্জি') || s.includes('energy'))) {
    return 15;
  }

  // 15. নরমাল বিস্কুট
  if (s.includes('বিস্কুট') || s.includes('biscuit')) {
    return 14;
  }

  // 17. লেবুর শরবত
  if (s.includes('লেবু') || s.includes('শরবত') || s.includes('lemon')) {
    return 16;
  }

  // 18. চিকেন অনিয়ন
  if (s.includes('অনিয়ন') || s.includes('অনিয়ন') || s.includes('পেঁয়াজু') || s.includes('onion')) {
    return 17;
  }

  // 19. চিকেন কারি
  if ((s.includes('চিকেন') || s.includes('chicken')) && (s.includes('কারি') || s.includes('কারী') || s.includes('curry'))) {
    return 18;
  }

  // 20. চিকেন পোলাও
  if (s.includes('পোলাও') || s.includes('pulaw') || s.includes('polao')) {
    return 19;
  }

  // 21. চিকেন বিরিয়ানি
  if (s.includes('বিরিয়ানি') || s.includes('বিরিয়ানি') || s.includes('biriyani') || s.includes('biryani')) {
    return 20;
  }

  // 23. ডিম খিচুড়ি (check before chicken khichuri if egg mentioned)
  if ((s.includes('খিচু') || s.includes('khichuri')) && (s.includes('ডিম') || s.includes('egg'))) {
    return 22;
  }

  // 22. চিকেন খিচুড়ি
  if (s.includes('খিচু') || s.includes('khichuri')) {
    return 21;
  }

  // 24. চিকেন হালিম / হালিম
  if (s.includes('হালিম') || s.includes('halim') || s.includes('haleem')) {
    return 23;
  }

  // 25. চটপটি
  if (s.includes('চটপটি') || s.includes('chotpoti')) {
    return 24;
  }

  // 26. মিনি বার্গার / বার্গার
  if (s.includes('বার্গার') || s.includes('burger')) {
    return 25;
  }

  // 27. পিজ্জা
  if (s.includes('পিজ্জা') || s.includes('pizza')) {
    return 26;
  }

  // 28. স্যান্ডউইচ
  if (s.includes('স্যান্ডউইচ') || s.includes('sandwich') || s.includes('sandwitch')) {
    return 27;
  }

  // 29. কলা
  if (s.includes('কলা') || s.includes('banana') || s.includes('kola')) {
    return 28;
  }

  // 30. সিংগারা
  if (s.includes('সিংগারা') || s.includes('সিঙ্গারা') || s.includes('singara') || s.includes('shingara')) {
    return 29;
  }

  // Other items (patties, sweet, roll, samosa, pasta, etc.) sort deterministically after 30
  return 100;
}

/**
 * Sorts any list of menu items or statement item rows strictly according to the official order.
 */
export function sortCanteenMenuItems<T>(
  items: T[],
  nameExtractor?: (item: T) => string
): T[] {
  if (!Array.isArray(items)) return [];
  return [...items].sort((a, b) => {
    const nameA = nameExtractor
      ? nameExtractor(a)
      : String((a as any)?.name_bn || (a as any)?.nameBn || (a as any)?.['Name (BN)'] || (a as any)?.itemName || (a as any)?.name || (a as any)?.name_en || '');
    const nameB = nameExtractor
      ? nameExtractor(b)
      : String((b as any)?.name_bn || (b as any)?.nameBn || (b as any)?.['Name (BN)'] || (b as any)?.itemName || (b as any)?.name || (b as any)?.name_en || '');

    const orderA = getCanteenMenuItemOrder(nameA);
    const orderB = getCanteenMenuItemOrder(nameB);

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return nameA.localeCompare(nameB, 'bn');
  });
}

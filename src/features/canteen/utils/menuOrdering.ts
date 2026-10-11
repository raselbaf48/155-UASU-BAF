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
 * Normalizes string for robust Bengali and English comparison.
 */
export function normalizeMenuNameForOrder(raw?: string): string {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/\u09af\u09bc/g, '\u09df') // য় to য়
    .replace(/\u09a1\u09bc/g, '\u09dc') // ড় to ড়
    .replace(/\u09a2\u09bc/g, '\u09dd') // ঢ় to ঢ়
    .replace(/ী/g, 'ি') // dirghoi to hroshwoi
    .replace(/সিঙ্গারা/g, 'সিংগারা')
    .replace(/shingara/g, 'singara')
    .replace(/biryani/g, 'biriyani')
    .replace(/[\s\-_(),.]+/g, ' ')
    .trim();
}

const NORMALIZED_OFFICIAL_ORDER = OFFICIAL_CANTEEN_MENU_ORDER.map(normalizeMenuNameForOrder);

/**
 * Returns the exact 0-indexed order priority (0 to 29) for any food item.
 * Supports English names, Bengali names, catalog keys, and regional spellings.
 */
export function getCanteenMenuItemOrder(rawName?: string): number {
  if (!rawName) return 999;
  const s = normalizeMenuNameForOrder(rawName);
  if (!s) return 999;

  // Direct exact match
  const exactIdx = NORMALIZED_OFFICIAL_ORDER.indexOf(s);
  if (exactIdx !== -1) return exactIdx;

  // 1. পরোটা প্রিমিয়াম (index 0)
  if (
    (s.includes('পরোটা') || s.includes('porata') || s.includes('paratha')) &&
    (s.includes('প্রিমিয়াম') || s.includes('premium') || s.includes('ইউনিট') || s.includes('unit'))
  ) {
    return 0;
  }

  // 2. পরোটা হোটেল (index 1)
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

  // 4. ডিম পোচ (check before fry, index 3)
  if (s.includes('পোচ') || s.includes('poach')) {
    return 3;
  }

  // 5. ডিম সিদ্ধ / সিদ্ধ ডিম (check before fry, index 4)
  if ((s.includes('ডিম') || s.includes('egg') || s.includes('dim')) && (s.includes('সিদ্ধ') || s.includes('সেদ্ধ') || s.includes('boiled') || s.includes('seddho'))) {
    return 4;
  }
  if (s === 'সিদ্ধ ডিম' || s === 'সেদ্ধ ডিম' || s === 'boiled egg') {
    return 4;
  }

  // 13. ডিম নুডুলস (check before general noodles and egg, index 12)
  if (
    (s.includes('নুডুল') || s.includes('নুডল') || s.includes('noodle')) &&
    (s.includes('ডিম') || s.includes('এগ') || s.includes('egg'))
  ) {
    return 12;
  }

  // 23. ডিম খিচুড়ি (check before chicken khichuri and egg, index 22)
  if (
    (s.includes('খিচুড়') || s.includes('khichuri') || s.includes('khicuri')) &&
    (s.includes('ডিম') || s.includes('egg'))
  ) {
    return 22;
  }

  // 3. ডিম ভাজি / ফ্রাই / অমলেট (index 2)
  if (
    (s.includes('ডিম') || s.includes('egg') || s.includes('dim')) &&
    (s.includes('ভাজি') || s.includes('ভাজা') || s.includes('ফ্রাই') || s.includes('fry') || s.includes('অমলেট') || s.includes('omlet') || s.includes('mumlet') || s.includes('omelette'))
  ) {
    return 2;
  }
  if (s === 'ডিম ভাজি' || s === 'ডিম অমলেট' || s === 'egg fry' || s === 'egg mumlet' || s === 'egg omlet') {
    return 2;
  }

  // 8. গ্রীন টি (check before regular tea, index 7)
  if (s.includes('গ্রিন') || s.includes('green tea') || s.includes('সবুজ চা')) {
    return 7;
  }

  // 7. রং চা / লিকার চা (check before milk tea, index 6)
  if (
    (s.includes('চা') || s.includes('tea')) &&
    (s.includes('রং') || s.includes('রঙ') || s.includes('লিকার') || s.includes('liquor') || s.includes('raw') || s.includes('লাল') || s.includes('কাঁচা') || s.includes('black tea'))
  ) {
    return 6;
  }

  // 6. দুধ চা (index 5)
  if ((s.includes('চা') || s.includes('tea')) && (s.includes('দুধ') || s.includes('milk'))) {
    return 5;
  }

  // 11. কোল্ড কফি (check before other coffees, index 10)
  if (s.includes('কোল্ড') || s.includes('cold')) {
    return 10;
  }

  // 9. ব্ল্যাক কফি (index 8)
  if (s.includes('ব্ল্যাক') || s.includes('black coffee') || s.includes('কালো কফি')) {
    return 8;
  }

  // 10. দুধ কফি / হট কফি / মিল্ক কফি (index 9)
  if (
    (s.includes('কফি') || s.includes('coffee')) &&
    (s.includes('দুধ') || s.includes('milk') || s.includes('হট') || s.includes('hot'))
  ) {
    return 9;
  }

  // Generic tea/coffee fallbacks
  if (s === 'চা' || s === 'tea') return 5;
  if (s === 'কফি' || s === 'coffee') return 9;

  // 12. নুডুলস (index 11)
  if (s.includes('নুডুল') || s.includes('নুডল') || s.includes('noodle') || s.includes('maggi')) {
    return 11;
  }

  // 14. ড্রাই কেক (index 13)
  if (s.includes('কেক') || s.includes('cake')) {
    return 13;
  }

  // 16. এনার্জি বিস্কুট (check before normal biscuit, index 15)
  if ((s.includes('বিস্কুট') || s.includes('biscuit')) && (s.includes('এনার্জি') || s.includes('energy'))) {
    return 15;
  }

  // 15. নরমাল বিস্কুট (index 14)
  if (s.includes('বিস্কুট') || s.includes('biscuit')) {
    return 14;
  }

  // 17. লেবুর শরবত (index 16)
  if (s.includes('লেবু') || s.includes('শরবত') || s.includes('সরবত') || s.includes('lemon')) {
    return 16;
  }

  // 18. চিকেন অনিয়ন (index 17)
  if (s.includes('অনিয়ন') || s.includes('অনিয়ন') || s.includes('পেঁয়াজু') || s.includes('onion')) {
    return 17;
  }

  // 19. চিকেন কারি (index 18)
  if ((s.includes('চিকেন') || s.includes('chicken')) && (s.includes('কারি') || s.includes('কারী') || s.includes('curry'))) {
    return 18;
  }

  // 20. চিকেন পোলাও (index 19)
  if (s.includes('পোলাও') || s.includes('pulaw') || s.includes('polao')) {
    return 19;
  }

  // 21. চিকেন বিরিয়ানি (index 20)
  if (s.includes('বিরিয়ানি') || s.includes('biriyani')) {
    return 20;
  }

  // 22. চিকেন খিচুড়ি (index 21)
  if (s.includes('খিচুড়') || s.includes('khichuri') || s.includes('khicuri')) {
    return 21;
  }

  // 24. চিকেন হালিম / হালিম (index 23)
  if (s.includes('হালিম') || s.includes('halim') || s.includes('haleem')) {
    return 23;
  }

  // 25. চটপটি (index 24)
  if (s.includes('চটপটি') || s.includes('chotpoti')) {
    return 24;
  }

  // 26. মিনি বার্গার / বার্গার (index 25)
  if (s.includes('বার্গার') || s.includes('burger')) {
    return 25;
  }

  // 27. পিজ্জা (index 26)
  if (s.includes('পিজ্জা') || s.includes('pizza')) {
    return 26;
  }

  // 28. স্যান্ডউইচ (index 27)
  if (s.includes('স্যান্ডউইচ') || s.includes('sandwich') || s.includes('sandwitch')) {
    return 27;
  }

  // 29. কলা (index 28)
  if (s.includes('কলা') || s.includes('banana') || s.includes('kola')) {
    return 28;
  }

  // 30. সিংগারা (index 29)
  if (s.includes('সিংগারা') || s.includes('singara')) {
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

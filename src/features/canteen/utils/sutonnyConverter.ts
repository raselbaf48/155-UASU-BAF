import { ConvertToASCII, ConvertToUnicode } from 'bijoy-unicode-converter';

/**
 * Converts Unicode Bengali text to Bijoy / SutonnyMJ ANSI format.
 * In Excel, applying the 'SutonnyMJ' font to Bijoy ANSI text allows it
 * to render in authentic SutonnyMJ typography instead of falling back to Nirmala UI.
 */
export function toSutonny(text: any): string {
  if (text === null || text === undefined) return '';
  let str = String(text);
  if (!str.trim()) return str;

  // Convert Bengali numerals ০-৯ to ASCII 0-9 because in SutonnyMJ font, 0-9 glyphs are Bengali numbers ০-৯
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  for (let i = 0; i < 10; i++) {
    str = str.replace(new RegExp(bnDigits[i], 'g'), String(i));
  }

  // If text contains Bengali Unicode characters (\u0980 to \u09FF)
  if (/[\u0980-\u09FF]/.test(str)) {
    try {
      str = ConvertToASCII('bijoy', str);
    } catch {
      // fallback
    }
  }

  // Remove invisible formatting characters (Zero-Width Joiner \u200D, Zero-Width Non-Joiner \u200C, BOM \uFEFF)
  // which prevent Excel font mapping from applying SutonnyMJ
  str = str.replace(/[\u200c\u200d\ufeff]/g, '');

  return str;
}

/**
 * Converts Bijoy / SutonnyMJ ANSI text back to Unicode Bengali format.
 * Useful when parsing imported Excel files containing SutonnyMJ cells.
 */
export function fromSutonny(text: any): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  if (!str.trim()) return str;

  try {
    const converted = ConvertToUnicode('bijoy', str);
    // If conversion produced Bengali Unicode characters, return the converted text
    if (/[\u0980-\u09FF]/.test(converted)) {
      return converted;
    }
  } catch {
    // Return original if conversion fails
  }
  return str;
}

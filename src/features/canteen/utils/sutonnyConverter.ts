import { ConvertToASCII, ConvertToUnicode } from 'bijoy-unicode-converter';

/**
 * Converts Unicode Bengali text to Bijoy / SutonnyMJ ANSI format.
 * In Excel, applying the 'SutonnyMJ' font to Bijoy ANSI text allows it
 * to render in authentic SutonnyMJ typography instead of falling back to Nirmala UI.
 */
export function toSutonny(text: any): string {
  if (text === null || text === undefined) return '';
  const str = String(text);
  if (!str.trim()) return str;

  // If text contains Bengali Unicode characters (\u0980 to \u09FF)
  if (/[\u0980-\u09FF]/.test(str)) {
    try {
      return ConvertToASCII('bijoy', str);
    } catch {
      return str;
    }
  }
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

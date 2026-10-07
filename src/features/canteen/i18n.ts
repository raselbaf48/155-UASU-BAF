import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import bnCanteen from '../../locales/bn/canteen.json';
import enCanteen from '../../locales/en/canteen.json';

// Ensure English is always default unless user explicitly chose Bengali in UI
const getInitialLanguage = (): string => {
  try {
    const explicit = localStorage.getItem('canteen_explicit_lang');
    if (explicit === 'bn') return 'bn';
    // Clear any previous auto-detected 'bn' in i18nextLng
    if (localStorage.getItem('i18nextLng') === 'bn' && !explicit) {
      localStorage.setItem('i18nextLng', 'en');
    }
  } catch {
    // ignore
  }
  return 'en';
};

const initialLanguage = getInitialLanguage();

i18n
  .use(initReactI18next)
  .init({
    resources: {
      bn: { translation: bnCanteen },
      en: { translation: enCanteen }
    },
    lng: initialLanguage,
    fallbackLng: 'en',
    debug: false,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    }
  });

export default i18n;

export const formatMoney = (amount: number, lng: string) => {
  const formatted = new Intl.NumberFormat(lng === 'bn' ? 'bn-BD' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
  return `৳ ${formatted}`;
};

export const formatNumber = (num: number, lng: string) => {
  return new Intl.NumberFormat(lng === 'bn' ? 'bn-BD' : 'en-US').format(num);
};

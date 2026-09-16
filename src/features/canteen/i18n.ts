import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import bnCanteen from '../../locales/bn/canteen.json';
import enCanteen from '../../locales/en/canteen.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      bn: { translation: bnCanteen },
      en: { translation: enCanteen }
    },
    fallbackLng: 'bn',
    debug: false,
    interpolation: {
      escapeValue: false, // not needed for react as it escapes by default
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    }
  });

export default i18n;

export const formatMoney = (amount: number, lng: string) => {
  const formatted = new Intl.NumberFormat(lng === 'bn' ? 'bn-BD' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
  return lng === 'bn' ? `৳ ${formatted}` : `৳ ${formatted}`;
};

export const formatNumber = (num: number, lng: string) => {
  return new Intl.NumberFormat(lng === 'bn' ? 'bn-BD' : 'en-US').format(num);
};

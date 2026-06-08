import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from '../public/locales/en/common.json';
import arCommon from '../public/locales/ar/common.json';

const resources = {
  en: { common: enCommon },
  ar: { common: arCommon },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['cookie', 'htmlTag', 'path', 'subdomain'],
      caches: ['cookie'],
    },
  });

export default i18n;

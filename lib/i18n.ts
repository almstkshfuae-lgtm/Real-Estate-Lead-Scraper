import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .use(resourcesToBackend((language: string, namespace: string) => import(`../public/locales/${language}/${namespace}.json`)))
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['cookie', 'htmlTag', 'path', 'subdomain'],
      caches: ['cookie'],
    },
  });

export default i18n;

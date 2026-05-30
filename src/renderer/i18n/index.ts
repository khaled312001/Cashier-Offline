import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar.json'
import en from './locales/en.json'

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en }
  },
  lng: 'ar',
  fallbackLng: 'ar',
  interpolation: { escapeValue: false }
})

export function applyDirection(lang: 'ar' | 'en') {
  document.documentElement.lang = lang
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  i18n.changeLanguage(lang)
}

export default i18n

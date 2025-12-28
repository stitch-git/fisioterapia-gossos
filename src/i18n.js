import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Importar traducciones directamente
import translationES from './locales/es/translation.json'
import translationCA from './locales/ca/translation.json'

const resources = {
  es: {
    translation: translationES
  },
  ca: {
    translation: translationCA
  }
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ca',
    debug: false,
    
    interpolation: {
      escapeValue: false
    },

    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage']
    }
  })

// Actualizar meta tags cuando i18n se inicialice y cuando cambie el idioma
i18n.on('initialized', () => {
  updateMetaTags()
})

i18n.on('languageChanged', () => {
  updateMetaTags()
})

// Función para actualizar meta tags
const updateMetaTags = () => {
  const lang = i18n.language || 'ca'
  
  // Actualizar atributo lang del HTML
  document.documentElement.lang = lang
  
  // Actualizar título
  document.title = i18n.t('meta.title')
  
  // Actualizar meta description
  const metaDescription = document.querySelector('meta[name="description"]')
  if (metaDescription) {
    metaDescription.setAttribute('content', i18n.t('meta.description'))
  }
  
  // Actualizar meta keywords
  const metaKeywords = document.querySelector('meta[name="keywords"]')
  if (metaKeywords) {
    metaKeywords.setAttribute('content', i18n.t('meta.keywords'))
  }
  
  // Actualizar Open Graph title
  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) {
    ogTitle.setAttribute('content', i18n.t('meta.ogTitle'))
  }
  
  // Actualizar Open Graph description
  const ogDescription = document.querySelector('meta[property="og:description"]')
  if (ogDescription) {
    ogDescription.setAttribute('content', i18n.t('meta.ogDescription'))
  }
  
  // Actualizar Twitter title
  const twitterTitle = document.querySelector('meta[name="twitter:title"]')
  if (twitterTitle) {
    twitterTitle.setAttribute('content', i18n.t('meta.twitterTitle'))
  }
  
  // Actualizar Twitter description
  const twitterDescription = document.querySelector('meta[name="twitter:description"]')
  if (twitterDescription) {
    twitterDescription.setAttribute('content', i18n.t('meta.twitterDescription'))
  }
  
  console.log(`📝 Meta tags actualizados al idioma: ${lang}`)
}

export default i18n
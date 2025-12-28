import i18next from 'i18next'

/**
 * Actualiza los meta tags del documento según el idioma actual
 */
export const updateMetaTags = () => {
  const lang = i18next.language || 'es'
  
  // Actualizar atributo lang del HTML
  document.documentElement.lang = lang
  
  // Actualizar título
  document.title = i18next.t('meta.title')
  
  // Actualizar meta description
  const metaDescription = document.querySelector('meta[name="description"]')
  if (metaDescription) {
    metaDescription.setAttribute('content', i18next.t('meta.description'))
  }
  
  // Actualizar meta keywords
  const metaKeywords = document.querySelector('meta[name="keywords"]')
  if (metaKeywords) {
    metaKeywords.setAttribute('content', i18next.t('meta.keywords'))
  }
  
  // Actualizar Open Graph title
  const ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) {
    ogTitle.setAttribute('content', i18next.t('meta.ogTitle'))
  }
  
  // Actualizar Open Graph description
  const ogDescription = document.querySelector('meta[property="og:description"]')
  if (ogDescription) {
    ogDescription.setAttribute('content', i18next.t('meta.ogDescription'))
  }
  
  // Actualizar Twitter title
  const twitterTitle = document.querySelector('meta[name="twitter:title"]')
  if (twitterTitle) {
    twitterTitle.setAttribute('content', i18next.t('meta.twitterTitle'))
  }
  
  // Actualizar Twitter description
  const twitterDescription = document.querySelector('meta[name="twitter:description"]')
  if (twitterDescription) {
    twitterDescription.setAttribute('content', i18next.t('meta.twitterDescription'))
  }
  
  console.log(`📝 Meta tags actualizados al idioma: ${lang}`)
}

/**
 * Suscribirse a cambios de idioma para actualizar meta tags
 */
export const subscribeToLanguageChanges = () => {
  // Actualizar al cargar
  updateMetaTags()
  
  // Escuchar cambios de idioma
  i18next.on('languageChanged', () => {
    updateMetaTags()
  })
}
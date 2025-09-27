// Verificar si hay consentimiento para cookies
export const hasCookieConsent = () => {
  const consent = localStorage.getItem('cookieConsent')
  return consent === 'accepted'
}

// Verificar si se rechazaron las cookies
export const cookiesRejected = () => {
  const consent = localStorage.getItem('cookieConsent')
  return consent === 'rejected'
}

// Limpiar consentimiento (para testing)
export const clearCookieConsent = () => {
  localStorage.removeItem('cookieConsent')
}
import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function CookieBanner() {
  const { t, i18n } = useTranslation()
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const cookieConsent = localStorage.getItem('cookieConsent')
    if (!cookieConsent) {
      setShowBanner(true)
    }
  }, [])

  const acceptCookies = () => {
    localStorage.setItem('cookieConsent', 'accepted')
    setShowBanner(false)
  }

  const rejectCookies = () => {
    localStorage.setItem('cookieConsent', 'rejected')
    setShowBanner(false)
  }

  if (!showBanner) return null

  const privacyPolicyUrl = `https://fisioterapiagossos.com/${i18n.language}/politica-privacidad/`

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 text-white p-4 z-50 shadow-lg">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 text-sm">
            <p>
              {t('cookieBanner.message')}{' '}
              <a 
                href={privacyPolicyUrl}
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-300 hover:text-blue-200 underline"
              >
                {t('cookieBanner.privacyPolicy')}
              </a>.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={rejectCookies}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium transition-colors"
            >
              {t('cookieBanner.reject')}
            </button>
            <button
              onClick={acceptCookies}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded text-sm font-medium transition-colors"
            >
              {t('cookieBanner.accept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
import React from 'react'
import { useTranslation } from 'react-i18next'

export default function LanguageSelector() {
  const { i18n, t } = useTranslation()

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng)
  }

  return (
    <div className="flex items-center space-x-1">
      <button
        onClick={() => changeLanguage('es')}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors duration-200 ${
          i18n.language === 'es' 
            ? 'bg-white bg-opacity-20 text-white' 
            : 'bg-white bg-opacity-10 text-white hover:bg-opacity-15'
        }`}
        title={t('languageSelector.spanish')}
      >
        ES
      </button>
      <button
        onClick={() => changeLanguage('ca')}
        className={`px-2 py-1 text-xs font-medium rounded transition-colors duration-200 ${
          i18n.language === 'ca' 
            ? 'bg-white bg-opacity-20 text-white' 
            : 'bg-white bg-opacity-10 text-white hover:bg-opacity-15'
        }`}
        title={t('languageSelector.catalan')}
      >
        CA
      </button>
    </div>
  )
}
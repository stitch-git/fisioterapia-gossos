import React from 'react'
import { useTranslation } from 'react-i18next'

export default function TermsModal({ isOpen, onClose }) {
  const { t } = useTranslation()
  
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200" style={{ backgroundColor: '#355F92' }}>
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {t('termsModal.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(85vh-140px)]">
          <div className="prose prose-sm sm:prose max-w-none text-gray-700 space-y-4">
            
            <div className="text-center mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                {t('termsModal.header.mainTitle')}
              </h3>
              <p className="text-base font-semibold text-gray-800">
                {t('termsModal.header.subtitle')}
              </p>
            </div>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                {t('termsModal.section1.title')}
              </h4>
              <p 
                className="text-sm sm:text-base leading-relaxed"
                dangerouslySetInnerHTML={{ __html: t('termsModal.section1.content') }}
              />
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                {t('termsModal.section2.title')}
              </h4>
              <p className="text-sm sm:text-base leading-relaxed mb-2">
                {t('termsModal.section2.intro')}
              </p>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base leading-relaxed ml-4">
                {t('termsModal.section2.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                {t('termsModal.section3.title')}
              </h4>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base leading-relaxed ml-4">
                {t('termsModal.section3.items', { returnObjects: true }).map((item, index) => (
                  <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                {t('termsModal.section4.title')}
              </h4>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base leading-relaxed ml-4">
                {t('termsModal.section4.items', { returnObjects: true }).map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                {t('termsModal.section5.title')}
              </h4>
              <ul className="list-disc list-inside space-y-2 text-sm sm:text-base leading-relaxed ml-4">
                {t('termsModal.section5.items', { returnObjects: true }).map((item, index) => (
                  <li key={index} dangerouslySetInnerHTML={{ __html: item }} />
                ))}
              </ul>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                {t('termsModal.section6.title')}
              </h4>
              <p className="text-sm sm:text-base leading-relaxed">
                {t('termsModal.section6.content')}
              </p>
            </section>

            <section>
              <h4 className="text-base sm:text-lg font-bold text-gray-900 mb-2">
                {t('termsModal.section7.title')}
              </h4>
              <p className="text-sm sm:text-base leading-relaxed mb-2">
                {t('termsModal.section7.intro')}
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <ul className="list-disc list-inside space-y-2 text-sm sm:text-base leading-relaxed ml-4">
                  <li>
                    <strong>{t('termsModal.section7.email')}</strong>{' '}
                    <a 
                      href="mailto:info@fisioterapiagossos.com"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      info@fisioterapiagossos.com
                    </a>
                  </li>
                  <li>
                    <strong>{t('termsModal.section7.phone')}</strong>{' '}
                    <a 
                      href="tel:+34676262863"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      676 26 28 63
                    </a>
                  </li>
                </ul>
              </div>
            </section>

          </div>
        </div>

        <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="btn btn-primary"
            >
              {t('termsModal.understood')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
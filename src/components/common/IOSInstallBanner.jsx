import React from 'react'
import { usePWAInstall } from '../../hooks/usePWAInstall'

export default function IOSInstallBanner() {
  const { showIOSBanner, dismissIOSBanner, browserInfo } = usePWAInstall()

  if (!showIOSBanner || !browserInfo.isSafariIOS) {
    return null
  }

  const deviceType = browserInfo.isIPad ? 'iPad' : 'iPhone'

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg transform transition-all duration-300 ease-in-out">
      <div className="px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          
          {/* Contenido principal - responsive */}
          <div className="flex items-start space-x-3">
            {/* Icono de la app */}
            <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            
            {/* Texto principal */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-white">
                ¡Instala FisioGossos en tu {deviceType}!
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1 leading-tight">
                Accede más rápido y disfruta de una mejor experiencia
              </p>
            </div>
          </div>

          {/* Botones de acción - responsive */}
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <button
              onClick={dismissIOSBanner}
              className="w-full sm:w-auto px-4 py-2 text-xs sm:text-sm font-medium text-blue-100 hover:text-white transition-colors duration-200 text-center"
            >
              Más tarde
            </button>
            <button
              onClick={() => {
                // Scroll to the install button in sidebar (if visible) or show install modal
                const installButton = document.querySelector('[data-install-button]')
                if (installButton) {
                  installButton.scrollIntoView({ behavior: 'smooth' })
                  installButton.click()
                }
                dismissIOSBanner()
              }}
              className="w-full sm:w-auto bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 backdrop-blur-sm"
            >
              Ver cómo instalar
            </button>
          </div>
        </div>

        {/* Indicador de pasos simplificado - solo móvil */}
        <div className="mt-3 sm:hidden">
          <div className="flex items-center justify-center space-x-2 text-blue-100">
            <div className="w-4 h-4 border border-blue-200 rounded flex items-center justify-center">
              <svg className="w-2 h-2" fill="currentColor" viewBox="0 0 8 8">
                <path d="M0 0h8v8H0z"/>
              </svg>
            </div>
            <span className="text-xs">Toca</span>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Añadir a Inicio</span>
          </div>
        </div>
      </div>

      {/* Animación de entrada/salida */}
      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .banner-enter {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
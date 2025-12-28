import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

const CheckCircleIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const DownloadIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const RefreshIcon = ({ spinning = false }) => (
  <svg className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const UpdateNotification = () => {
  const { t, i18n } = useTranslation()
  const [showUpdate, setShowUpdate] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [currentVersion, setCurrentVersion] = useState(null)

  useEffect(() => {
    let interval
    
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/version.json?' + Date.now(), {
          cache: 'no-store'
        })
        
        if (response.ok) {
          const serverVersion = await response.json()
          const localVersion = localStorage.getItem('app_version')
          
          if (!localVersion) {
            localStorage.setItem('app_version', serverVersion.version)
            setCurrentVersion(serverVersion)
            return
          }
          
          if (serverVersion.version !== localVersion && !showUpdate) {
            setShowUpdate(true)
            setCurrentVersion(serverVersion)
          }
        }
      } catch (error) {
        console.log('No se pudo verificar actualizaciones:', error)
      }
    }

    checkForUpdates()
    interval = setInterval(checkForUpdates, 30000)

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!showUpdate) {
          setShowUpdate(true)
        }
      })
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [showUpdate])

  const handleUpdate = async () => {
    setIsUpdating(true)
    
    try {
      if (currentVersion) {
        localStorage.setItem('app_version', currentVersion.version)
      }

      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
      }

      setTimeout(() => {
        window.location.reload()
      }, 1000)

    } catch (error) {
      console.error('Error al actualizar:', error)
      setIsUpdating(false)
      window.location.reload()
    }
  }

  const handleDismiss = () => {
    setShowUpdate(false)
    const dismissTime = Date.now() + (60 * 60 * 1000)
    localStorage.setItem('update_dismissed', dismissTime.toString())
  }

  useEffect(() => {
    const dismissedUntil = localStorage.getItem('update_dismissed')
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil)) {
      setShowUpdate(false)
    }
  }, [])

  return null  // ✅ Siempre retornar null

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <div className="bg-white border border-green-200 rounded-lg shadow-lg p-4 animate-slide-in">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-green-500">
            <CheckCircleIcon />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900">
              {t('updateNotification.title')}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {t('updateNotification.message')}
            </div>
            {currentVersion?.updated && (
              <div className="text-xs text-gray-400 mt-1">
                {t('updateNotification.updated')} {new Date(currentVersion.updated).toLocaleString(i18n.language === 'ca' ? 'ca-ES' : 'es-ES')}
              </div>
            )}
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XIcon />
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className="flex-1 bg-green-600 text-white text-sm font-medium py-2 px-3 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {isUpdating ? (
              <>
                <RefreshIcon spinning={true} />
                {t('updateNotification.updating')}
              </>
            ) : (
              <>
                <DownloadIcon />
                {t('updateNotification.update')}
              </>
            )}
          </button>
          
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            {t('updateNotification.later')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UpdateNotification

const styles = `
@keyframes slide-in {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in {
  animation: slide-in 0.3s ease-out;
}
`

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style")
  styleSheet.innerText = styles
  document.head.appendChild(styleSheet)
}
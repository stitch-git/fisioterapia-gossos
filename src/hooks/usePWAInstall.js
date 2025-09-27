import { useState, useEffect } from 'react'

export const usePWAInstall = () => {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [browserInfo, setBrowserInfo] = useState({})
  const [showIOSBanner, setShowIOSBanner] = useState(false)

  // Detectar información del navegador mejorada para iOS
  const detectBrowser = () => {
    const userAgent = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(userAgent)
    const isAndroid = /Android/.test(userAgent)
    const isChrome = /Chrome/.test(userAgent) && !/Edg/.test(userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)
    const isDesktop = !isIOS && !isAndroid
    
    // Detección más precisa de Chrome en iOS
    const isChromeIOS = isIOS && /CriOS/.test(userAgent)
    const isSafariIOS = isIOS && !isChromeIOS && /Safari/.test(userAgent)
    
    // Detectar versión de iOS para compatibilidad
    const iOSVersion = isIOS ? navigator.userAgent.match(/OS (\d+)_/)?.[1] : null
    
    // Detectar si es iPad específicamente
    const isIPad = /iPad/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    
    return {
      isIOS,
      isAndroid,
      isChrome,
      isSafari,
      isDesktop,
      isChromeIOS,
      isSafariIOS,
      isChromeDesktop: isDesktop && isChrome,
      isChromeAndroid: isAndroid && isChrome,
      iOSVersion: iOSVersion ? parseInt(iOSVersion) : null,
      isIPad,
      deviceType: isIPad ? 'iPad' : isIOS ? 'iPhone' : isAndroid ? 'Android' : 'Desktop'
    }
  }

  useEffect(() => {
    const browser = detectBrowser()
    setBrowserInfo(browser)

    // Verificar si ya está instalada la PWA (mejorado para iOS)
    const checkIfInstalled = () => {
      // Método principal para iOS: navigator.standalone
      const isIOSStandalone = window.navigator.standalone === true
      
      // Método para otros navegadores: display mode
      const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      
      // Método adicional: verificar start_url con parámetros
      const hasHomeScreenParam = window.location.search.includes('utm_source=homescreen')
      
      // Verificar Android PWA
      const isAndroidPWA = document.referrer.includes('android-app://')
      
      const isPWAInstalled = isIOSStandalone || isInStandaloneMode || hasHomeScreenParam || isAndroidPWA

      setIsInstalled(isPWAInstalled)
      
      // Si está instalada, no mostrar banner ni botón
      if (isPWAInstalled) {
        setShowIOSBanner(false)
        return
      }

      // Mostrar banner educativo para iOS Safari (solo primera visita)
      if (browser.isSafariIOS && !localStorage.getItem('ios-install-banner-seen')) {
        setTimeout(() => setShowIOSBanner(true), 3000) // Mostrar después de 3 segundos
      }
    }

    checkIfInstalled()

    // Escuchar el evento beforeinstallprompt (solo Chrome Desktop/Android)
    const handleBeforeInstallPrompt = (event) => {
      console.log('PWA: beforeinstallprompt event fired')
      event.preventDefault()
      setInstallPrompt(event)
      setIsInstallable(true)
    }

    // Escuchar cuando la app se instala
    const handleAppInstalled = () => {
      console.log('PWA: App was installed')
      setIsInstalled(true)
      setIsInstallable(false)
      setInstallPrompt(null)
      setShowIOSBanner(false)
    }

    // Escuchar cambios en display mode (útil para iOS)
    const handleDisplayModeChange = (e) => {
      if (e.matches) {
        console.log('PWA: Display mode changed to standalone')
        setIsInstalled(true)
        setShowIOSBanner(false)
      }
    }

    // Agregar listeners según el navegador
    if (browser.isChromeDesktop || browser.isChromeAndroid) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.addEventListener('appinstalled', handleAppInstalled)
    }

    // Listener para cambios en display mode (iOS principalmente)
    const displayModeQuery = window.matchMedia('(display-mode: standalone)')
    displayModeQuery.addEventListener('change', handleDisplayModeChange)

    // Para iOS (Safari y Chrome), la app es "instalable" si no está ya instalada
    if ((browser.isSafariIOS || browser.isChromeIOS) && !isInstalled) {
      setIsInstallable(true)
    }

    // Cleanup
    return () => {
      if (browser.isChromeDesktop || browser.isChromeAndroid) {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.removeEventListener('appinstalled', handleAppInstalled)
      }
      displayModeQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [isInstalled])

  // Función para instalar la PWA
  const installPWA = async () => {
    // Para Chrome Desktop/Android con prompt disponible
    if (installPrompt && (browserInfo.isChromeDesktop || browserInfo.isChromeAndroid)) {
      try {
        installPrompt.prompt()
        const result = await installPrompt.userChoice
        
        if (result.outcome === 'accepted') {
          setIsInstallable(false)
          setInstallPrompt(null)
          return true
        }
        return false
      } catch (error) {
        console.error('Error during PWA installation:', error)
        return false
      }
    }

    return false
  }

  // Función para obtener instrucciones de instalación manual mejoradas
  const getManualInstallInstructions = () => {
    if (browserInfo.isSafariIOS) {
      const deviceType = browserInfo.isIPad ? 'iPad' : 'iPhone'
      return {
        platform: `Safari iOS (${deviceType})`,
        deviceType,
        steps: [
          `En la parte inferior de Safari, toca el botón de "compartir" (cuadrado con flecha hacia arriba)`,
          'En el menú que aparece, desplázate hacia abajo hasta encontrar "Añadir a pantalla de inicio"',
          'Toca "Añadir a pantalla de inicio"',
          'Confirma tocando "Añadir" en la parte superior derecha',
          'La app aparecerá en tu pantalla de inicio como cualquier otra aplicación'
        ],
        benefits: [
          'Acceso rápido desde tu pantalla de inicio',
          'Experiencia de aplicación nativa',
          'Funciona sin conexión para ciertas funciones',
          'Sin barra de direcciones del navegador'
        ],
        troubleshooting: [
          'Si no ves el botón de compartir, asegúrate de estar usando Safari (no Chrome)',
          'Si "Añadir a pantalla de inicio" no aparece, actualiza Safari a la última versión',
          'Algunos bloqueadores de contenido pueden interferir - desactívalos temporalmente'
        ]
      }
    } 
    
    if (browserInfo.isChromeIOS) {
      return {
        platform: 'Chrome iOS',
        deviceType: browserInfo.isIPad ? 'iPad' : 'iPhone',
        steps: [
          'Toca los tres puntos (⋯) en la esquina superior derecha de Chrome',
          'Busca y selecciona "Añadir a pantalla de inicio"',
          'Confirma tocando "Añadir"'
        ],
        note: 'Chrome en iOS tiene limitaciones para PWAs. Para la mejor experiencia, recomendamos usar Safari.',
        safariRecommendation: true,
        benefits: [
          'Acceso rápido desde tu pantalla de inicio',
          'Marcador mejorado (no es una PWA completa en Chrome iOS)'
        ]
      }
    }

    if (browserInfo.isChromeDesktop && !installPrompt) {
      return {
        platform: 'Chrome Desktop',
        deviceType: 'Desktop',
        steps: [
          'Toca los tres puntos (⋮) en la esquina superior derecha',
          'Busca la opción "Enviar, guardar y compartir"',
          'Haz clic en "Instalar página como aplicación"',
          'La aplicación se abrirá en una ventana independiente'
        ],
        benefits: [
          'Ventana de aplicación independiente',
          'Acceso rápido desde el escritorio',
          'Notificaciones del sistema',
          'Funciona offline para ciertas funciones'
        ]
      }
    }

    if (browserInfo.isChromeAndroid && !installPrompt) {
      return {
        platform: 'Chrome Android',
        deviceType: 'Android',
        steps: [
          'Toca los tres puntos (⋮) en la esquina superior derecha',
          'Selecciona "Añadir a pantalla de inicio" o "Instalar aplicación"',
          'Confirma tocando "Añadir" o "Instalar"',
          'La app aparecerá en tu cajón de aplicaciones y pantalla de inicio'
        ],
        benefits: [
          'Aplicación nativa completa',
          'Notificaciones push',
          'Funciona offline',
          'Acceso desde el cajón de aplicaciones'
        ]
      }
    }
    
    return null
  }

  // Función para verificar si el botón debe mostrarse
  const shouldShowInstallButton = () => {
    if (isInstalled) return false
    
    // Mostrar si hay prompt disponible (Chrome Desktop/Android)
    if (installPrompt) return true
    
    // Mostrar para iOS (necesita instalación manual)
    if (browserInfo.isSafariIOS || browserInfo.isChromeIOS) return true
    
    // Mostrar para Chrome Desktop/Android sin prompt (fallback)
    if (browserInfo.isChromeDesktop || browserInfo.isChromeAndroid) return true
    
    return false
  }

  // Función para obtener el texto del botón según la plataforma
  const getInstallButtonText = () => {
    if (browserInfo.isSafariIOS) {
      return 'Añadir a Inicio'
    }
    
    if (browserInfo.isChromeIOS) {
      return 'Añadir a Inicio'
    }
    
    if (browserInfo.isChromeDesktop || browserInfo.isChromeAndroid) {
      return installPrompt ? 'Instalar App' : 'Instalar App'
    }
    
    return 'Instalar App'
  }

  // Función para cerrar el banner de iOS
  const dismissIOSBanner = () => {
    setShowIOSBanner(false)
    localStorage.setItem('ios-install-banner-seen', 'true')
  }

  return {
    isInstallable,
    isInstalled,
    installPWA,
    getManualInstallInstructions,
    shouldShowInstallButton,
    getInstallButtonText,
    browserInfo,
    showIOSBanner,
    dismissIOSBanner
  }
}
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export const usePWAInstall = () => {
  const { t } = useTranslation()
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [browserInfo, setBrowserInfo] = useState({})
  const [showIOSBanner, setShowIOSBanner] = useState(false)

  const detectBrowser = () => {
    const userAgent = navigator.userAgent
    const isIOS = /iPad|iPhone|iPod/.test(userAgent)
    const isAndroid = /Android/.test(userAgent)
    const isChrome = /Chrome/.test(userAgent) && !/Edg/.test(userAgent)
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent)
    const isDesktop = !isIOS && !isAndroid
    
    const isChromeIOS = isIOS && /CriOS/.test(userAgent)
    const isSafariIOS = isIOS && !isChromeIOS && /Safari/.test(userAgent)
    
    const iOSVersion = isIOS ? navigator.userAgent.match(/OS (\d+)_/)?.[1] : null
    
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

    const checkIfInstalled = () => {
      const isIOSStandalone = window.navigator.standalone === true
      const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches
      const hasHomeScreenParam = window.location.search.includes('utm_source=homescreen')
      const isAndroidPWA = document.referrer.includes('android-app://')
      
      const isPWAInstalled = isIOSStandalone || isInStandaloneMode || hasHomeScreenParam || isAndroidPWA

      setIsInstalled(isPWAInstalled)
      
      if (isPWAInstalled) {
        setShowIOSBanner(false)
        return
      }

      if (browser.isSafariIOS && !localStorage.getItem('ios-install-banner-seen')) {
        setTimeout(() => setShowIOSBanner(true), 3000)
      }
    }

    checkIfInstalled()

    const handleBeforeInstallPrompt = (event) => {
      console.log('PWA: beforeinstallprompt event fired')
      event.preventDefault()
      setInstallPrompt(event)
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      console.log('PWA: App was installed')
      setIsInstalled(true)
      setIsInstallable(false)
      setInstallPrompt(null)
      setShowIOSBanner(false)
    }

    const handleDisplayModeChange = (e) => {
      if (e.matches) {
        console.log('PWA: Display mode changed to standalone')
        setIsInstalled(true)
        setShowIOSBanner(false)
      }
    }

    if (browser.isChromeDesktop || browser.isChromeAndroid) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.addEventListener('appinstalled', handleAppInstalled)
    }

    const displayModeQuery = window.matchMedia('(display-mode: standalone)')
    displayModeQuery.addEventListener('change', handleDisplayModeChange)

    if ((browser.isSafariIOS || browser.isChromeIOS) && !isInstalled) {
      setIsInstallable(true)
    }

    return () => {
      if (browser.isChromeDesktop || browser.isChromeAndroid) {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
        window.removeEventListener('appinstalled', handleAppInstalled)
      }
      displayModeQuery.removeEventListener('change', handleDisplayModeChange)
    }
  }, [isInstalled])

  const installPWA = async () => {
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

  const getManualInstallInstructions = () => {
    if (browserInfo.isSafariIOS) {
      const deviceType = browserInfo.isIPad ? 'iPad' : 'iPhone'
      return {
        platform: t('pwaInstall.platforms.safariIOS', { device: deviceType }),
        deviceType,
        steps: t('pwaInstall.instructions.safariIOS.steps', { returnObjects: true }),
        benefits: t('pwaInstall.instructions.safariIOS.benefits', { returnObjects: true }),
        troubleshooting: t('pwaInstall.instructions.safariIOS.troubleshooting', { returnObjects: true })
      }
    } 
    
    if (browserInfo.isChromeIOS) {
      return {
        platform: t('pwaInstall.platforms.chromeIOS'),
        deviceType: browserInfo.isIPad ? 'iPad' : 'iPhone',
        steps: t('pwaInstall.instructions.chromeIOS.steps', { returnObjects: true }),
        note: t('pwaInstall.instructions.chromeIOS.note'),
        safariRecommendation: true,
        benefits: t('pwaInstall.instructions.chromeIOS.benefits', { returnObjects: true })
      }
    }

    if (browserInfo.isChromeDesktop && !installPrompt) {
      return {
        platform: t('pwaInstall.platforms.chromeDesktop'),
        deviceType: 'Desktop',
        steps: t('pwaInstall.instructions.chromeDesktop.steps', { returnObjects: true }),
        benefits: t('pwaInstall.instructions.chromeDesktop.benefits', { returnObjects: true })
      }
    }

    if (browserInfo.isChromeAndroid && !installPrompt) {
      return {
        platform: t('pwaInstall.platforms.chromeAndroid'),
        deviceType: 'Android',
        steps: t('pwaInstall.instructions.chromeAndroid.steps', { returnObjects: true }),
        benefits: t('pwaInstall.instructions.chromeAndroid.benefits', { returnObjects: true })
      }
    }
    
    return null
  }

  const shouldShowInstallButton = () => {
    if (isInstalled) return false
    if (installPrompt) return true
    if (browserInfo.isSafariIOS || browserInfo.isChromeIOS) return true
    if (browserInfo.isChromeDesktop || browserInfo.isChromeAndroid) return true
    
    return false
  }

  const getInstallButtonText = () => {
    if (browserInfo.isSafariIOS) {
      return t('pwaInstall.buttons.addToHome')
    }
    
    if (browserInfo.isChromeIOS) {
      return t('pwaInstall.buttons.addToHome')
    }
    
    if (browserInfo.isChromeDesktop || browserInfo.isChromeAndroid) {
      return t('pwaInstall.buttons.installApp')
    }
    
    return t('pwaInstall.buttons.installApp')
  }

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
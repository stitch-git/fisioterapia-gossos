import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { usePWAInstall } from '../../hooks/usePWAInstall'
import ConfirmModal from '../../components/common/ConfirmModal'
import IOSInstallBanner from '../../components/common/IOSInstallBanner'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import MyProfile from '../../components/client/MyProfile'

import AdminHeader from '../../components/admin/AdminHeader'
import OccupancyReport from '../../components/admin/OccupancyReport'
import BookingsManagement from '../../components/admin/BookingsManagement'
import ClientsManagement from '../../components/admin/ClientsManagement'
import ConfigurationPanel from '../../components/admin/ConfigurationPanel'
import EmailLogsPanel from '../../components/admin/EmailLogsPanel'
import Footer from '../../components/common/Footer'

export default function AdminDashboard() {
  const { t, i18n } = useTranslation()
  const { profile } = useAuth()
  const [activeSection, setActiveSection] = useState('occupancy')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)

  const {
    shouldShowInstallButton,
    getInstallButtonText,
    installPWA,
    getManualInstallInstructions,
    isInstalled,
    browserInfo
  } = usePWAInstall()

  const handleNavigateToSection = (section) => {
    setActiveSection(section)
    setSidebarOpen(false)
  }

  const handleInstallPWA = async () => {
    setSidebarOpen(false)
    
    const installed = await installPWA()
    
    if (!installed) {
      const instructions = getManualInstallInstructions()
      if (instructions) {
        setShowInstallModal(true)
        return
      }
    }

    if (browserInfo.isSafariIOS || browserInfo.isChromeIOS) {
      setShowInstallModal(true)
      return
    }

    if (!installed) {
      const instructions = getManualInstallInstructions()
      if (instructions) {
        setShowInstallModal(true)
      } else {
        toast(t('adminDashboard.pwa.toastMessage'), {
          icon: '💡',
          duration: 6000
        })
      }
    }
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      const sidebar = document.getElementById('admin-mobile-sidebar')
      const hamburger = document.getElementById('admin-hamburger-button')
      
      if (sidebarOpen && sidebar && !sidebar.contains(event.target) && 
          hamburger && !hamburger.contains(event.target)) {
        setSidebarOpen(false)
      }
    }

    if (sidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [sidebarOpen])

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [sidebarOpen])

  const navigationItems = [
    {
      id: 'occupancy',
      label: t('adminDashboard.navigation.occupancy'),
      icon: (
        <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'bookings',
      label: t('adminDashboard.navigation.bookings'),
      icon: (
        <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'clients',
      label: t('adminDashboard.navigation.clients'),
      icon: (
        <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      )
    },
    {
      id: 'profile',
      label: t('adminDashboard.navigation.profile'),
      icon: (
        <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
    {
      id: 'configuration',
      label: t('adminDashboard.navigation.configuration'),
      icon: (
        <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
    {
    id: 'email-logs',
    label: t('adminDashboard.navigation.emailLogs'),
    icon: (
      <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    )
  }
  ]

  const InstallModal = () => {
    const instructions = getManualInstallInstructions()
    if (!instructions) return null

    const getPlatformIcon = () => {
      if (browserInfo.isSafariIOS) {
        return (
          <svg className="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
        )
      }
      if (browserInfo.isChromeIOS || browserInfo.isChromeDesktop || browserInfo.isChromeAndroid) {
        return (
          <svg className="h-6 w-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 5.568a8 8 0 11-11.136 11.136 8 8 0 0111.136-11.136z"/>
          </svg>
        )
      }
      return (
        <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    }

    return (
      <ConfirmModal
        isOpen={showInstallModal}
        onClose={() => setShowInstallModal(false)}
        onConfirm={() => setShowInstallModal(false)}
        title={t('adminDashboard.installModal.title', { platform: instructions.platform })}
        message={
          <div className="text-left">
            <p className="text-sm text-gray-600 mb-4">
              {t('adminDashboard.installModal.intro')}
            </p>
            <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700">
              {instructions.steps.map((step, index) => (
                <li key={index} className="leading-relaxed pl-2">{step}</li>
              ))}
            </ol>
            
            {browserInfo.isSafariIOS && instructions.benefits && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-xs font-medium text-blue-800 mb-2">
                  {t('adminDashboard.installModal.benefits')}
                </p>
                <ul className="text-xs text-blue-700 space-y-1">
                  {instructions.benefits.slice(0, 3).map((benefit, index) => (
                    <li key={index} className="flex items-start">
                      <span className="mr-2">•</span>
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {browserInfo.isChromeIOS && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-xs text-orange-600 leading-relaxed">
                  💡 <strong>{t('adminDashboard.installModal.recommendation')}</strong> {t('adminDashboard.installModal.chromeIOSNote')}
                </p>
              </div>
            )}
          </div>
        }
        confirmText={t('adminDashboard.installModal.confirm')}
        cancelText={t('adminDashboard.installModal.cancel')}
        confirmButtonClass="bg-blue-600 hover:bg-blue-700"
        cancelButtonClass="bg-red-600 hover:bg-red-700"
        icon={
          <div className="flex items-center justify-center w-10 h-10 mx-auto bg-blue-100 rounded-full">
            {getPlatformIcon()}
          </div>
        }
      />
    )
  }

  return (
    <>
      <IOSInstallBanner />
      
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <AdminHeader setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />
        
        <div className="flex relative flex-1">
          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <aside 
            id="admin-mobile-sidebar"
            className={`
              fixed lg:relative lg:translate-x-0 
              w-64 bg-white shadow-sm border-r min-h-screen z-50
              transition-transform duration-300 ease-in-out
              ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}
          >
            <div className="p-4 lg:p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {t('adminDashboard.title')}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {profile?.nombre_completo || t('adminDashboard.defaultAdmin')}
                  </p>
                </div>
                
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {shouldShowInstallButton() && (
                <div className="mb-6">
                  <button
                    onClick={handleInstallPWA}
                    data-install-button
                    className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-all duration-200 transform hover:scale-105 ${
                      isInstalled 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md hover:shadow-lg hover:from-green-700 hover:to-green-800'
                    }`}
                  >
                    {isInstalled ? (
                      <>
                        <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{t('adminDashboard.pwa.installed')}</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        <span className="hidden sm:inline">
                          {getInstallButtonText()}
                        </span>
                        <span className="sm:hidden">
                          {t('adminDashboard.pwa.installShort')}
                        </span>
                      </>
                    )}
                  </button>
                  
                  <div className="mt-4 border-t border-gray-200"></div>
                </div>
              )}
              
              <nav className="space-y-1 flex-1">
                {navigationItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigateToSection(item.id)}
                    className={`w-full text-left nav-link ${
                      activeSection === item.id ? 'nav-link-active' : 'nav-link-inactive'
                    }`}
                  >
                    {item.icon}
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </nav>

              <div className="mt-8 pt-4 border-t border-gray-200">
                <div className="text-center space-y-1">
                  <p className="text-xs text-gray-500 font-medium">
                    {t('adminDashboard.version.appName')}
                  </p>
                  <p className="text-xs text-gray-400">
                    {t('adminDashboard.version.version')} {__APP_VERSION__ || '1.0.0'}
                  </p>
                  <p className="text-xs text-gray-300">
                    {t('adminDashboard.version.lastUpdate')} {new Date(__BUILD_TIME__ || Date.now()).toLocaleDateString(i18n.language === 'ca' ? 'ca-ES' : 'es-ES')}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <main className="flex-1 w-full lg:w-auto overflow-x-hidden">
            <div className="p-4 sm:p-6 lg:p-8 max-w-full">
              {activeSection === 'occupancy' && <OccupancyReport />}
              {activeSection === 'bookings' && <BookingsManagement />}
              {activeSection === 'clients' && <ClientsManagement />}
              {activeSection === 'profile' && <MyProfile />}
              {activeSection === 'configuration' && <ConfigurationPanel />}
              {activeSection === 'email-logs' && <EmailLogsPanel />}
            </div>
          </main>

        </div>

        <Footer />          
        <InstallModal />
      </div>
    </>
  )
}
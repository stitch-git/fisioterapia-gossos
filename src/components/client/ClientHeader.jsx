import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ConfirmModal from '../common/ConfirmModal'
import { useTranslation } from 'react-i18next'

export default function ClientHeader({ setSidebarOpen, sidebarOpen }) {
  const { profile, signOut, getDisplayName } = useAuth()
  const { t } = useTranslation()
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const dropdownRef = useRef(null)

  const handleSignOut = async () => {
    await signOut()
  }

  const openLogoutModal = () => {
    setShowProfileDropdown(false)
    setShowLogoutModal(true)
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false)
      }
    }

    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showProfileDropdown])

  return (
    <>
      <header className="shadow-sm border-b relative z-30" style={{backgroundColor: '#355F92'}}>
        <div className="container-app">
          <div className="flex justify-between items-center py-3 lg:py-4">
            
            <div className="flex items-center">
              <button
                id="hamburger-button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md text-white hover:bg-white hover:bg-opacity-15 transition-colors duration-200 mr-3"
                aria-label={t('clientHeader.openMenu')}
              >
                <svg 
                  className={`w-6 h-6 transition-transform duration-300 ${sidebarOpen ? 'rotate-90' : ''}`} 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  {sidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>

              <div className="flex items-center">
                <div className="h-8 w-8 lg:h-10 lg:w-10 bg-white rounded-full flex items-center justify-center mr-2 lg:mr-3 overflow-hidden">
                  <img 
                    src="https://uymcuavjzygvsfnqdciy.supabase.co/storage/v1/object/public/app-assets/logos/dog-logo.jpg"
                    alt={t('clientHeader.logoAlt')}
                    className="h-5 w-5 lg:h-7 lg:w-7 object-contain"
                  />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg lg:text-xl font-bold text-white">
                    {t('clientHeader.title')}
                  </h1>
                  <p className="text-xs lg:text-sm text-blue-100">
                    {t('clientHeader.subtitle')}
                  </p>
                </div>
                <div className="sm:hidden">
                  <h1 className="text-base font-bold text-white">
                    {t('clientHeader.title')}
                  </h1>
                </div>
              </div>
            </div>

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                className="flex items-center space-x-2 lg:space-x-3 bg-white bg-opacity-15 rounded-lg px-2 lg:px-4 py-2 text-white hover:bg-opacity-25 transition-colors duration-200"
              >
                <div className="h-6 w-6 lg:h-8 lg:w-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                  <svg className="h-3 w-3 lg:h-5 lg:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                
                <div className="text-left hidden sm:block">
                  <p className="text-xs lg:text-sm font-medium truncate max-w-[120px] lg:max-w-none">
                    {getDisplayName()}
                  </p>
                  <p className="text-xs text-blue-100">
                    {t('clientHeader.client')}
                  </p>
                </div>
                
                <div className="text-left sm:hidden">
                  <p className="text-sm font-medium">
                    {getDisplayName()?.charAt(0) || 'U'}
                  </p>
                </div>
                
                <svg className="h-3 w-3 lg:h-4 lg:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {profile?.nombre_completo}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {profile?.telefono}
                    </p>
                  </div>
                  
                  <button
                    onClick={openLogoutModal}
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-150 flex items-center"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    {t('clientHeader.logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleSignOut}
        title={t('clientHeader.logoutModal.title')}
        message={t('clientHeader.logoutModal.message')}
        confirmText={t('clientHeader.logoutModal.confirm')}
        cancelText={t('clientHeader.logoutModal.cancel')}
        confirmButtonClass="bg-red-600 hover:bg-red-700"
        icon={
          <div className="flex items-center justify-center w-10 h-10 mx-auto bg-red-100 rounded-full">
            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
        }
      />
    </>
  )
}
import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import ConfirmModal from '../common/ConfirmModal'

export default function AdminHeader({ setSidebarOpen, sidebarOpen }) {
  const { user, profile, signOut } = useAuth()
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showLogoutModal, setShowLogoutModal] = useState(false)
  const dropdownRef = useRef(null)

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const openLogoutModal = () => {
    setShowProfileDropdown(false)
    setShowLogoutModal(true)
  }

  // Cerrar dropdown cuando se hace clic fuera
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
      <header className="text-white shadow-sm relative z-30" style={{ backgroundColor: '#355F92' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 lg:h-16">
            
            {/* Botón hamburguesa y logo */}
            <div className="flex items-center">
              <button
                id="admin-hamburger-button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-md text-white hover:bg-white hover:bg-opacity-20 transition-colors duration-200 mr-3"
                aria-label="Abrir menú"
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

              {/* Logo */}
              <div className="flex items-center">
                <div className="h-8 w-8 lg:h-10 lg:w-10 bg-white rounded-full flex items-center justify-center mr-2 lg:mr-3 overflow-hidden">
                  <img 
                    src="https://uymcuavjzygvsfnqdciy.supabase.co/storage/v1/object/public/app-assets/logos/dog-logo.jpg"
                    alt="Fisioterapia Gossos Logo"
                    className="h-5 w-5 lg:h-7 lg:w-7 object-contain"
                  />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg lg:text-xl font-bold text-white">
                    Fisioterapia Gossos
                  </h1>
                  <p className="text-xs lg:text-sm text-blue-100">
                    Sistema de Reservas
                  </p>
                </div>
                {/* Logo solo en móviles muy pequeños */}
                <div className="sm:hidden">
                  <h1 className="text-base font-bold text-white">
                    Fisioterapia Gossos
                  </h1>
                </div>
              </div>
            </div>

            {/* Usuario (sin botón PWA) */}
            <div className="flex items-center space-x-3 lg:space-x-4">
              
              {/* Info usuario - oculta en móviles pequeños */}
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium">Administrador</p>
                <p className="text-xs opacity-80">{profile?.nombre_completo || 'admin'}</p>
              </div>
              
              {/* Dropdown perfil */}
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                  className="flex items-center text-sm rounded-md px-2 lg:px-3 py-2 hover:bg-black hover:bg-opacity-10 transition-colors" 
                  style={{ backgroundColor: 'rgba(0, 0, 0, 0.1)' }}
                >
                  <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  
                  <span className="hidden sm:inline">admin</span>
                  
                  <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showProfileDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b">
                      <p className="font-medium truncate">{profile?.nombre_completo || 'Administrador'}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    
                    <button
                      onClick={openLogoutModal}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Modal logout */}
      <ConfirmModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleSignOut}
        title="Cerrar Sesión"
        message="¿Estás seguro que quieres cerrar sesión? Tendrás que volver a iniciar sesión para acceder a tu cuenta."
        confirmText="Cerrar Sesión"
        cancelText="Cancelar"
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
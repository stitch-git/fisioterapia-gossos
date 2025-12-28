import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

import SuperHeader from '../../components/super/SuperHeader'
import SystemLogsViewer from '../../components/super/SystemLogsViewer'
import Footer from '../../components/common/Footer'

export default function SuperDashboard() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const handleClickOutside = (event) => {
      const sidebar = document.getElementById('super-mobile-sidebar')
      const hamburger = document.getElementById('super-hamburger-button')
      
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <SuperHeader setSidebarOpen={setSidebarOpen} sidebarOpen={sidebarOpen} />
      
      <div className="flex relative flex-1">
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside 
          id="super-mobile-sidebar"
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
                  🔐 Panel Super Admin
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {profile?.nombre_completo || 'Super Administrador'}
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

            <nav className="space-y-1 flex-1">
              <div className="w-full text-left px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center text-blue-900">
                  <svg className="w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium">📋 Logs del Sistema</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600 leading-relaxed">
                  <strong className="text-gray-900">🔒 Acceso Exclusivo</strong><br />
                  Este panel solo está disponible para usuarios Super Admin y muestra todos los logs del sistema.
                </p>
              </div>
            </nav>

            <div className="mt-8 pt-4 border-t border-gray-200">
              <div className="text-center space-y-1">
                <p className="text-xs text-gray-500 font-medium">
                  Super Admin Panel
                </p>
                <p className="text-xs text-gray-400">
                  Sistema de Monitoreo
                </p>
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 w-full lg:w-auto overflow-x-hidden">
          <div className="p-4 sm:p-6 lg:p-8 max-w-full">
            <SystemLogsViewer />
          </div>
        </main>
      </div>

      <Footer />
    </div>
  )
}
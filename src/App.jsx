import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { FontSizeProvider } from './contexts/FontSizeContext'
import NotificationProvider from './components/NotificationProvider'
import CookieBanner from './components/common/CookieBanner'
import { useTranslation } from 'react-i18next'

import LoadingSpinner from './components/common/LoadingSpinner'

import LoginPage from './components/auth/LoginPage'
import RegisterPage from './components/auth/RegisterPage'

import ClientDashboard from './pages/client/ClientDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

import ForgotPasswordPage from './components/auth/ForgotPasswordPage'
import ResetPasswordPage from './components/auth/ResetPasswordPage'

import SuperDashboard from './pages/super/SuperDashboard'

import ErrorTracker from './components/ErrorTracker' // ✅ NUEVO


function ProtectedRoute({ children, roles = [] }) {
  const { t } = useTranslation()
  const { user, profile, loading, initializing } = useAuth()

  if (initializing || loading) {
    return <LoadingSpinner />
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (roles.length > 0 && !roles.includes(profile.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10 text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {t('app.accessDenied.title')}
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              {t('app.accessDenied.message')}
            </p>
            <button
              onClick={() => window.history.back()}
              className="mt-4 btn btn-primary"
            >
              {t('app.accessDenied.back')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return children
}

function PublicRoute({ children }) {
  const { user, profile, loading, initializing } = useAuth()

  if (initializing || loading) {
    return <LoadingSpinner />
  }

  if (user && profile) {
    switch (profile.role) {
      case 'cliente':
        return <Navigate to="/client" replace />
      case 'admin':
        return <Navigate to="/admin" replace />
      case 'super':
        return <Navigate to="/super" replace />
      default:
        return <Navigate to="/client" replace />
    }
  }

  return children
}

function AppRouter() {
  const { t } = useTranslation()
  const { initializing } = useAuth()

  if (initializing) {
    return <LoadingSpinner />
  }

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/register" 
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          } 
        />

        <Route 
          path="/forgot-password" 
          element={
            <PublicRoute>
              <ForgotPasswordPage />
            </PublicRoute>
          } 
        />
        <Route 
          path="/reset-password" 
          element={<ResetPasswordPage />}
        />

        <Route 
          path="/client/*" 
          element={
            <ProtectedRoute roles={['cliente']}>
              <ClientDashboard />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute roles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/super/*" 
          element={
            <ProtectedRoute roles={['super']}>
              <SuperDashboard />
            </ProtectedRoute>
          } 
        />

        <Route path="/" element={<Navigate to="/login" replace />} />
        
        <Route 
          path="*" 
          element={
            <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
              <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10 text-center">
                  <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-100">
                    <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h3 className="mt-4 text-lg font-medium text-gray-900">
                    {t('app.notFound.title')}
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    {t('app.notFound.message')}
                  </p>
                  <a href="/" className="mt-4 btn btn-primary">
                    {t('app.notFound.backToHome')}
                  </a>
                </div>
              </div>
            </div>
          } 
        />
      </Routes>
    </Router>
  )
}

export default function App() {
  const { i18n } = useTranslation()
  
  return (
    <AuthProvider>
      <FontSizeProvider>
        <ErrorTracker /> {/* ✅ NUEVO: Captura errores globalmente */}
        <NotificationProvider>
        <AppRouter />
        
        <Toaster 
          key={i18n.language}
          position="top-right"
          toastOptions={{
            duration: 4000,
            className: '',
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              style: {
                background: '#059669',
              },
            },
            error: {
              style: {
                background: '#DC2626',
              },
            },
          }}
        />
        
        <CookieBanner />
      </NotificationProvider>
      </FontSizeProvider>
    </AuthProvider>
  )
}
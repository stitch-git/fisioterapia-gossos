import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, handleAuthError } from '../lib/supabase'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(true)

  const withTimeout = (promise, timeoutMs = 8000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      )
    ])
  }

  const createFallbackProfile = (currentUser) => {
    return { 
      id: currentUser.id, 
      nombre_completo: currentUser.email?.split('@')[0] || t('auth.user'), 
      telefono: '',
      email: currentUser.email,
      pais_codigo: '+34',
      whatsapp_notifications: true,
      email_notifications: true,
      role: 'cliente'
    }
  }

  const applyUserLanguage = (userProfile) => {
    if (userProfile?.preferred_language && i18n.language !== userProfile.preferred_language) {
      console.log(`🌍 Aplicando idioma del usuario: ${userProfile.preferred_language}`)
      i18n.changeLanguage(userProfile.preferred_language)
    }
  }

  const loadUserProfile = async (userId, currentUser) => {
    if (!userId) return null

    try {
      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single(),
        6000
      )

      if (error) {
        console.warn('Profile not found, using fallback')
        return createFallbackProfile(currentUser)
      }

      return data
      
    } catch (error) {
      console.warn('Error loading profile:', error.message)
      return createFallbackProfile(currentUser)
    }
  }

  useEffect(() => {
    let mounted = true
    let initialized = false
    let currentUser = null
    let currentProfile = null

    const initializeAuth = async () => {
      if (initialized) return
      
      try {
        const isPersistent = localStorage.getItem('persistentSession')
        
        if (isPersistent === 'false') {
          const hasSessionFlag = sessionStorage.getItem('activeSession')
          
          if (!hasSessionFlag) {
            console.log('🔒 Sesión temporal expirada, cerrando sesión...')
            await supabase.auth.signOut()
            localStorage.removeItem('persistentSession')
            
            if (mounted) {
              setUser(null)
              setProfile(null)
              setLoading(false)
              setInitializing(false)
            }
            return
          }
        }
        
        if (isPersistent === 'false') {
          sessionStorage.setItem('activeSession', 'true')
        }
        
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          8000
        )
        
        if (!mounted) return

        if (error || !session?.user) {
          setUser(null)
          setProfile(null)
        } else {
          currentUser = session.user
          setUser(session.user)
          
          const userProfile = await loadUserProfile(session.user.id, session.user)
          if (mounted) {
            currentProfile = userProfile
            setProfile(userProfile)
            applyUserLanguage(userProfile)
          }
        }
        
        initialized = true
        setLoading(false)
        setInitializing(false)
        
      } catch (error) {
        console.warn('Auth initialization error:', error.message)
        if (mounted) {
          setUser(null)
          setProfile(null)
          setLoading(false)
          setInitializing(false)
        }
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && initialized && currentUser) {
        setUser(currentUser)
        setProfile(currentProfile)
        setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        
        if (event === 'SIGNED_IN' && session?.user && !currentUser) {
          currentUser = session.user
          setUser(session.user)
          setLoading(true)
          
          const isPersistent = localStorage.getItem('persistentSession')
          if (isPersistent === 'false') {
            sessionStorage.setItem('activeSession', 'true')
          }
          
          const userProfile = await loadUserProfile(session.user.id, session.user)
          if (mounted) {
            currentProfile = userProfile
            setProfile(userProfile)
            setLoading(false)
            applyUserLanguage(userProfile)
          }
          
        } else if (event === 'SIGNED_OUT') {
          currentUser = null
          currentProfile = null
          setUser(null)
          setProfile(null)
          setLoading(false)
          
          localStorage.removeItem('persistentSession')
          localStorage.removeItem('rememberedEmail')
          sessionStorage.removeItem('activeSession')
        }
      }
    )

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    initializeAuth()

    return () => {
      mounted = false
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      subscription?.unsubscribe()
    }
  }, [])

  const signUp = async (email, password, userData) => {
    try {
      setLoading(true)

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nombre_completo: userData.nombre_completo,
            telefono: userData.telefono,
            pais_codigo: userData.pais_codigo,
            pais_nombre: userData.pais_nombre,
            whatsapp_notifications: userData.whatsapp_notifications,
            email_notifications: userData.email_notifications,
            preferred_language: userData.preferred_language || 'ca',
            role: userData.role || 'cliente'
          }
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error(t('auth.signUp.errorCreatingUser'))

      const profileData = {
        id: authData.user.id,
        nombre_completo: userData.nombre_completo.trim(),
        telefono: userData.telefono.replace(/\s/g, ''),
        email: email,
        pais_codigo: userData.pais_codigo,
        pais_nombre: userData.pais_nombre,
        whatsapp_notifications: userData.whatsapp_notifications,
        email_notifications: userData.email_notifications,
        preferred_language: userData.preferred_language || 'ca',
        role: userData.role || 'cliente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      try {
        const { data: createdProfile } = await withTimeout(
          supabase
            .from('profiles')
            .insert([profileData])
            .select()
            .single(),
          8000
        )
        
        setUser(authData.user)
        setProfile(createdProfile || profileData)
        
      } catch (profileError) {
        console.warn('Profile creation failed, using fallback')
        setUser(authData.user)
        setProfile(profileData)
      }
      
      toast.success(t('auth.signUp.success'))
      
      setTimeout(() => {
        const welcomeEvent = new CustomEvent('sendWelcomeEmail', {
          detail: {
            nombre_completo: userData.nombre_completo,
            email: email,
            user_id: authData.user.id
          }
        })
        window.dispatchEvent(welcomeEvent)
      }, 1000)
      
      return { user: authData.user, error: null }
      
    } catch (error) {
      const message = handleAuthError(error)
      toast.error(message)
      return { user: null, error: message }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password, rememberMe = false) => {
    try {
      setLoading(true)

      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email,
          password
        }),
        10000
      )

      if (error) throw error
      if (!data.user) throw new Error(t('auth.signIn.error'))

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email)
        localStorage.setItem('persistentSession', 'true')
        console.log(t('auth.signIn.persistentSession'))
      } else {
        localStorage.removeItem('rememberedEmail')
        localStorage.setItem('persistentSession', 'false')
        console.log(t('auth.signIn.temporarySession'))
      }

      toast.success(t('auth.signIn.success'))
      return { user: data.user, error: null }

    } catch (error) {
      const message = handleAuthError(error)
      toast.error(message)
      return { user: null, error: message }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setUser(null)
      setProfile(null)
      
      localStorage.removeItem('persistentSession')
      localStorage.removeItem('rememberedEmail')
      sessionStorage.removeItem('activeSession')
      
      toast.success(t('auth.signOut.success'))

    } catch (error) {
      console.error('Error signing out:', error)
      toast.error(t('auth.signOut.error'))
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates) => {
    try {
      setLoading(true)

      if (!user?.id) {
        throw new Error(t('auth.profile.noAuthenticatedUser'))
      }

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data, error } = await withTimeout(
        supabase
          .from('profiles')
          .update(updateData)
          .eq('id', user.id)
          .select()
          .single(),
        8000
      )

      if (error) throw error

      setProfile(data)
      toast.success(t('auth.profile.updateSuccess'))
      return { data, error: null }

    } catch (error) {
      toast.error(t('auth.profile.updateError'))
      return { data: null, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email) => {
    try {
      setLoading(true)

      const { data: profile, error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .select('nombre_completo, email')
          .eq('email', email)
          .single(),
        8000
      )

      if (profileError || !profile) {
        throw new Error(t('auth.passwordReset.noAccountFound'))
      }

      const { error: emailError } = await withTimeout(
        supabase.functions.invoke('resend-email', {
          body: {
            to: email,
            clientName: profile.nombre_completo,
            resetUrl: `${window.location.origin}/reset-password?email=${encodeURIComponent(email)}`,
            expirationTime: '60 minutos',
            emailType: 'password_reset'
          }
        }),
        10000
      )

      if (emailError) throw new Error(t('auth.passwordReset.errorSendingEmail'))

      toast.success(t('auth.passwordReset.success'))
      return { error: null }

    } catch (error) {
      const message = handleAuthError(error)
      toast.error(message)
      return { error: message }
    } finally {
      setLoading(false)
    }
  }

  const hasRole = (role) => {
    if (!profile) return false
    if (Array.isArray(role)) {
      return role.includes(profile.role)
    }
    return profile.role === role
  }

  const isAdmin = () => hasRole(['admin', 'super'])
  const isSuper = () => hasRole('super')
  const isClient = () => hasRole('cliente')

  const getDisplayName = () => {
    return profile?.nombre_completo || user?.email || t('auth.user')
  }

  const getNotificationPreferences = () => {
    if (!profile) return { whatsapp: false, email: false }
    return {
      whatsapp: profile.whatsapp_notifications || false,
      email: profile.email_notifications || false
    }
  }

  const updateNotificationPreferences = async (whatsapp, email) => {
    if (!whatsapp && !email) {
      toast.error(t('auth.notifications.atLeastOne'))
      return { success: false }
    }

    const result = await updateProfile({
      whatsapp_notifications: whatsapp,
      email_notifications: email
    })

    return { success: !result.error }
  }

  const value = {
    user,
    profile,
    loading,
    initializing,
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    hasRole,
    isAdmin,
    isSuper,
    isClient,
    getDisplayName,
    getNotificationPreferences,
    updateNotificationPreferences
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ✅ NUEVO: Interceptor global de toast.error para capturar errores automáticamente
if (typeof window !== 'undefined') {
  const originalToastError = toast.error

  toast.error = (message, options) => {
    // Capturar el error en la BD
    if (message) {
      const captureEvent = new CustomEvent('captureUserError', {
        detail: { message, context: { source: 'toast.error' } }
      })
      window.dispatchEvent(captureEvent)
    }
    
    // Llamar al toast.error original
    return originalToastError(message, options)
  }
}
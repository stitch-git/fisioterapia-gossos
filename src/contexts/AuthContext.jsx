import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, handleAuthError } from '../lib/supabase'
import toast from 'react-hot-toast'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(true)

  // Timeout wrapper for queries
  const withTimeout = (promise, timeoutMs = 8000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
      )
    ])
  }

  // Create fallback profile
  const createFallbackProfile = (currentUser) => {
    return { 
      id: currentUser.id, 
      nombre_completo: currentUser.email?.split('@')[0] || 'Usuario', 
      telefono: '',
      email: currentUser.email,
      pais_codigo: '+34',
      whatsapp_notifications: true,
      email_notifications: true,
      role: 'cliente'
    }
  }

  // Load user profile
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

  // Initialize auth state with tab visibility handling
  useEffect(() => {
    let mounted = true
    let initialized = false
    let currentUser = null
    let currentProfile = null

    const initializeAuth = async () => {
      if (initialized) return
      
      try {
        const { data: { session }, error } = await withTimeout(
          supabase.auth.getSession(),
          8000 // Increased timeout
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

    // Tab visibility handler - prevent reinitialization
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && initialized && currentUser) {
        // Tab became visible again - restore state without re-fetching
        setUser(currentUser)
        setProfile(currentProfile)
        setLoading(false)
      }
    }

    // Auth state listener - SIMPLE
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        
        // Only process real auth changes, ignore token refresh
        if (event === 'SIGNED_IN' && session?.user && !currentUser) {
          currentUser = session.user
          setUser(session.user)
          setLoading(true)
          
          const userProfile = await loadUserProfile(session.user.id, session.user)
          if (mounted) {
            currentProfile = userProfile
            setProfile(userProfile)
            setLoading(false)
          }
          
        } else if (event === 'SIGNED_OUT') {
          currentUser = null
          currentProfile = null
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
        // Ignore TOKEN_REFRESHED and other events that don't change auth state
      }
    )

    // Add visibility listener
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
            role: userData.role || 'cliente'
          }
        }
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('No se pudo crear el usuario')

      const profileData = {
        id: authData.user.id,
        nombre_completo: userData.nombre_completo.trim(),
        telefono: userData.telefono.replace(/\s/g, ''),
        email: email,
        pais_codigo: userData.pais_codigo,
        pais_nombre: userData.pais_nombre,
        whatsapp_notifications: userData.whatsapp_notifications,
        email_notifications: userData.email_notifications,
        role: userData.role || 'cliente',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // Try to create profile in database
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
      
      toast.success('Cuenta creada exitosamente. Revisa tu email para confirmar tu cuenta.')
      
      // Trigger welcome email (será manejado por NotificationProvider)
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

  const signIn = async (email, password) => {
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
      if (!data.user) throw new Error('Error en el inicio de sesión')

      toast.success('Sesión iniciada correctamente')
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
      toast.success('Sesión cerrada correctamente')

    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Error cerrando sesión')
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (updates) => {
    try {
      setLoading(true)

      if (!user?.id) {
        throw new Error('No hay usuario autenticado')
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
      toast.success('Perfil actualizado correctamente')
      return { data, error: null }

    } catch (error) {
      toast.error('Error actualizando perfil')
      return { data: null, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email) => {
    try {
      setLoading(true)

      // 1. Solo verificar que el usuario existe
      const { data: profile, error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .select('nombre_completo, email')
          .eq('email', email)
          .single(),
        8000
      )

      if (profileError || !profile) {
        throw new Error('No encontramos una cuenta registrada con ese email')
      }

      // 2. Enviar ÚNICAMENTE tu email personalizado
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

      if (emailError) throw new Error('Error enviando email de recuperación')

      toast.success('Email de recuperación enviado')
      return { error: null }

    } catch (error) {
      const message = handleAuthError(error)
      toast.error(message)
      return { error: message }
    } finally {
      setLoading(false)
    }
  }

  // Utility functions
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
    return profile?.nombre_completo || user?.email || 'Usuario'
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
      toast.error('Debe mantener al menos una preferencia de notificación activada')
      return { success: false }
    }

    const result = await updateProfile({
      whatsapp_notifications: whatsapp,
      email_notifications: email
    })

    return { success: !result.error }
  }

  // Context value
  const value = {
    // State
    user,
    profile,
    loading,
    initializing,
    
    // Auth methods
    signUp,
    signIn,
    signOut,
    updateProfile,
    resetPassword,
    
    // Utility methods
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
import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const FontSizeContext = createContext()

export const useFontSize = () => {
  const context = useContext(FontSizeContext)
  if (!context) {
    throw new Error('useFontSize debe usarse dentro de FontSizeProvider')
  }
  return context
}

export const FontSizeProvider = ({ children }) => {
  const { user, profile } = useAuth()
  const [fontSize, setFontSize] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  // Detectar si es mobile o desktop
  const isMobile = () => window.innerWidth < 768

  // Cargar tamaño de fuente desde profile o usar defaults
  useEffect(() => {
    if (profile) {
      const deviceFontSize = isMobile() 
        ? (profile.font_size_mobile || 14)
        : (profile.font_size_desktop || 16)
      
      setFontSize(deviceFontSize)
      applyFontSize(deviceFontSize)
      setIsLoading(false)
    } else {
      // Usuario no autenticado - usar defaults
      const defaultSize = isMobile() ? 14 : 16
      setFontSize(defaultSize)
      applyFontSize(defaultSize)
      setIsLoading(false)
    }
  }, [profile])

  // Aplicar tamaño de fuente al documento
  const applyFontSize = (size) => {
    document.documentElement.style.setProperty('--base-font-size', `${size}px`)
  }

  // Actualizar tamaño de fuente
  const updateFontSize = async (newSize) => {
    if (!user) {
      console.warn('Usuario no autenticado, no se puede guardar preferencia')
      setFontSize(newSize)
      applyFontSize(newSize)
      return { success: false, error: 'Usuario no autenticado' }
    }

    // Validar rango
    if (newSize < 12 || newSize > 24) {
      return { success: false, error: 'Tamaño debe estar entre 12 y 24 px' }
    }

    try {
      const column = isMobile() ? 'font_size_mobile' : 'font_size_desktop'
      
      const { error } = await supabase
        .from('profiles')
        .update({ [column]: newSize })
        .eq('id', user.id)

      if (error) throw error

      setFontSize(newSize)
      applyFontSize(newSize)
      
      console.log(`✅ Tamaño de fuente ${isMobile() ? 'móvil' : 'desktop'} actualizado: ${newSize}px`)
      
      return { success: true }
    } catch (error) {
      console.error('Error actualizando tamaño de fuente:', error)
      return { success: false, error: error.message }
    }
  }

  // Escuchar cambios de tamaño de ventana
  useEffect(() => {
    const handleResize = () => {
      if (!profile) return
      
      const deviceFontSize = isMobile()
        ? (profile.font_size_mobile || 14)
        : (profile.font_size_desktop || 16)
      
      if (deviceFontSize !== fontSize) {
        setFontSize(deviceFontSize)
        applyFontSize(deviceFontSize)
        console.log(`📱 Cambio a ${isMobile() ? 'móvil' : 'desktop'}: ${deviceFontSize}px`)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [profile, fontSize])

  const value = {
    fontSize,
    updateFontSize,
    isLoading,
    isMobile: isMobile()
  }

  return (
    <FontSizeContext.Provider value={value}>
      {children}
    </FontSizeContext.Provider>
  )
}
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'

export const useLanguage = (userId) => {
  const { i18n } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)

  // Cargar idioma del usuario desde Supabase
  useEffect(() => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    const loadUserLanguage = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', userId)
          .single()

        if (error) throw error

        // ✅ Solo cambiar si el idioma guardado es diferente al actual
        if (data?.preferred_language && data.preferred_language !== i18n.language) {
          console.log(`🌍 Cambiando idioma de ${i18n.language} a ${data.preferred_language}`)
          i18n.changeLanguage(data.preferred_language)
        } else {
          console.log(`✅ Idioma actual (${i18n.language}) ya es el correcto`)
        }
      } catch (error) {
        console.error('Error loading user language:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadUserLanguage()
  }, [userId, i18n])

  // Función para cambiar y guardar idioma
  const changeLanguage = async (lng) => {
    try {
      // Cambiar idioma en la app
      await i18n.changeLanguage(lng)

      // Guardar en localStorage
      localStorage.setItem('i18nextLng', lng)

      // Si hay usuario, guardar en Supabase
      if (userId) {
        const { error } = await supabase
          .from('profiles')
          .update({ preferred_language: lng })
          .eq('id', userId)

        if (error) throw error
      }

      return { success: true }
    } catch (error) {
      console.error('Error changing language:', error)
      return { success: false, error }
    }
  }

  return {
    currentLanguage: i18n.language,
    changeLanguage,
    isLoading
  }
}
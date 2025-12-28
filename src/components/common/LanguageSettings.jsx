import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLanguage } from '../../hooks/useLanguage'
import toast from 'react-hot-toast'

export default function LanguageSettings({ userId }) {
  const { t } = useTranslation()
  const { currentLanguage, changeLanguage, isLoading } = useLanguage(userId)
  const [saving, setSaving] = useState(false)

  const handleLanguageChange = async (e) => {
    const lng = e.target.value
    if (lng === currentLanguage) return

    // ✅ AÑADIDO: Limpiar todos los toasts antes de cambiar idioma
    toast.dismiss()

    setSaving(true)
    try {
      const result = await changeLanguage(lng)
      
      if (result.success) {
        toast.success(t('profile.languageUpdated') || 'Idioma actualizado correctamente')
      } else {
        toast.error(t('profile.languageUpdateError') || 'Error al actualizar el idioma')
      }
    } catch (error) {
      console.error('Error changing language:', error)
      toast.error(t('profile.languageUpdateError') || 'Error al actualizar el idioma')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor="language-select" className="text-sm font-medium text-gray-700">
          {t('profile.preferredLanguage')}
        </label>
        <select
          id="language-select"
          value={currentLanguage}
          onChange={handleLanguageChange}
          disabled={saving}
          className="pl-3 pr-10 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed appearance-none bg-no-repeat bg-right"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
            backgroundPosition: 'right 0.5rem center',
            backgroundSize: '1.5em 1.5em',
            minWidth: '140px'
          }}
        >
          <option value="es">{t('common.spanish')}</option>
          <option value="ca">{t('common.catalan')}</option>
        </select>
      </div>
      
      <p className="text-xs text-gray-500">
        {t('profile.languageDescription') || 'Selecciona el idioma de la aplicación'}
      </p>

      {saving && (
        <div className="text-xs text-gray-500">
          {t('common.saving') || 'Guardando...'}
        </div>
      )}
    </div>
  )
}
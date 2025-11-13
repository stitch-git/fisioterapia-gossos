import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import CountrySelector, { validatePhoneNumber, getCountryByCode, COUNTRIES } from '../common/CountrySelector'
import NotificationPreferences, { validateNotificationPreferences } from '../common/NotificationPreferences'
import LanguageSettings from '../common/LanguageSettings'
import { useTranslation } from 'react-i18next'

export default function MyProfile() {
  const { user, profile, updateProfile } = useAuth()
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    nombre_completo: '',
    telefono: '',
    pais_codigo: 'ES',
    email_notifications: true
  })
  const [loading, setLoading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [notificationError, setNotificationError] = useState('')

  useEffect(() => {
    if (profile) {
      setFormData({
        nombre_completo: profile.nombre_completo || '',
        telefono: profile.telefono || '',
        pais_codigo: COUNTRIES.find(c => c.codigo === profile.pais_codigo) ? profile.pais_codigo : 'ES',
        email_notifications: profile.email_notifications !== undefined ? profile.email_notifications : true
      })
    }
  }, [profile])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    const hasChange = value !== (profile?.[name] || '')
    checkForChanges({ ...formData, [name]: value })

    if (name === 'telefono') {
      validatePhoneField(value, formData.pais_codigo)
    }
  }

  const handleCountryChange = (country) => {
    const newFormData = {
      ...formData,
      pais_codigo: country.codigo,
      pais_nombre: country.nombre
    }
    setFormData(newFormData)
    checkForChanges(newFormData)
    
    if (formData.telefono) {
      validatePhoneField(formData.telefono, country.codigo)
    }
  }

  const handleNotificationChange = (type, value) => {
    const newFormData = {
      ...formData,
      [type]: value
    }
    setFormData(newFormData)
    checkForChanges(newFormData)

    const email = type === 'email_notifications' ? value : formData.email_notifications
    
    const validation = validateNotificationPreferences(email)
    setNotificationError(validation.valid ? '' : validation.message)
  }

  const validatePhoneField = (phone, countryCode) => {
    if (!phone.trim()) {
      setPhoneError('')
      return
    }

    if (countryCode === 'ES' && phone.trim()) {
      const cleanPhone = phone.replace(/\s/g, '')
      if (!cleanPhone.startsWith('6') && !cleanPhone.startsWith('7')) {
        setPhoneError(t('myProfile.validation.spanishPhoneStart'))
        return
      }
    }

    const validation = validatePhoneNumber(phone, countryCode)
    setPhoneError(validation.valid ? '' : validation.message)
  }

  const checkForChanges = (currentData) => {
    if (!profile) return

    const hasAnyChange = 
      currentData.nombre_completo !== (profile.nombre_completo || '') ||
      currentData.telefono !== (profile.telefono || '') ||
      currentData.pais_codigo !== (profile.pais_codigo || 'ES') ||
      currentData.email_notifications !== (profile.email_notifications !== undefined ? profile.email_notifications : true)
    
    setHasChanges(hasAnyChange)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.nombre_completo.trim()) {
      toast.error(t('myProfile.validation.fullNameRequired'))
      return
    }

    if (!formData.telefono.trim()) {
      toast.error(t('myProfile.validation.phoneRequired'))
      return
    }

    const phoneValidation = validatePhoneNumber(formData.telefono, formData.pais_codigo)
    if (!phoneValidation.valid) {
      toast.error(phoneValidation.message)
      setPhoneError(phoneValidation.message)
      return
    }

    const notificationValidation = validateNotificationPreferences(
      formData.email_notifications
    )
    if (!notificationValidation.valid) {
      toast.error(notificationValidation.message)
      setNotificationError(notificationValidation.message)
      return
    }

    setLoading(true)
    try {
      const country = getCountryByCode(formData.pais_codigo)
      const updates = {
        nombre_completo: formData.nombre_completo.trim(),
        telefono: formData.telefono.replace(/\s/g, ''),
        pais_codigo: formData.pais_codigo,
        pais_nombre: country.nombre,
        email_notifications: formData.email_notifications
      }

      const { error } = await updateProfile(updates)
      
      if (!error) {
        setHasChanges(false)
        setPhoneError('')
        setNotificationError('')
      }
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    if (profile) {
      setFormData({
        nombre_completo: profile.nombre_completo || '',
        telefono: profile.telefono || '',
        pais_codigo: COUNTRIES.find(c => c.codigo === profile.pais_codigo) ? profile.pais_codigo : 'ES',
        email_notifications: profile.email_notifications !== undefined ? profile.email_notifications : true
      })
      setHasChanges(false)
      setPhoneError('')
      setNotificationError('')
    }
  }

  const selectedCountry = getCountryByCode(formData.pais_codigo)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('myProfile.title')}</h2>
        <p className="text-gray-600">{t('myProfile.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">{t('myProfile.personalInfo.title')}</h3>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('myProfile.personalInfo.fullName')} {t('myProfile.form.required')}
                </label>
                <input
                  type="text"
                  name="nombre_completo"
                  value={formData.nombre_completo}
                  onChange={handleChange}
                  className="input"
                  placeholder={t('myProfile.personalInfo.fullNamePlaceholder')}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('myProfile.personalInfo.countryAndPhone')} {t('myProfile.form.required')}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex h-[42px]">
                      <div className="flex items-center justify-center px-2 sm:px-3 bg-gray-50 border border-r-0 border-gray-300 rounded-l-md min-w-[3.5rem] text-xs sm:text-sm">
                        <span className="font-medium text-gray-900 whitespace-nowrap">
                          {selectedCountry?.telefono_codigo}
                        </span>
                      </div>
                      <input
                        type="tel"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleChange}
                        className={`input rounded-l-none border-l-0 flex-1 h-[42px] text-sm sm:text-base ${phoneError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
                        placeholder={selectedCountry?.telefono_descripcion || t('myProfile.personalInfo.phonePlaceholder')}
                        required
                      />
                    </div>
                  </div>
                </div>
                
                {phoneError && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {phoneError}
                  </p>
                )}
                {selectedCountry && !phoneError && (
                  <p className="mt-1 text-xs text-gray-500 flex items-center">
                    <svg className="w-3 h-3 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('myProfile.personalInfo.format')} {selectedCountry.telefono_descripcion}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('myProfile.personalInfo.email')}
                </label>
                <input
                  type="email"
                  value={user?.email || t('myProfile.loading')}
                  className="input bg-gray-50"
                  disabled
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('myProfile.personalInfo.emailCannotChange')}
                </p>
              </div>

              <NotificationPreferences
                emailEnabled={formData.email_notifications}
                onEmailChange={(value) => handleNotificationChange('email_notifications', value)}
                error={notificationError}
                className="pt-4 border-t"
              />

              {hasChanges && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex">
                    <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div className="ml-3">
                      <p className="text-sm text-amber-800">
                        {t('myProfile.form.unsavedChanges')}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                {hasChanges && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="btn btn-secondary"
                    disabled={loading}
                  >
                    {t('myProfile.form.cancel')}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!hasChanges || loading || phoneError || notificationError}
                  className={`btn btn-primary ${(!hasChanges || loading || phoneError || notificationError) ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner mr-2"></div>
                      {t('myProfile.form.saving')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t('myProfile.form.saveChanges')}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">{t('myProfile.accountSummary.title')}</h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <svg className="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {profile?.nombre_completo || t('myProfile.loading')}
                      </p>
                      <p className="text-sm text-gray-500">{t('myProfile.accountSummary.registeredClient')}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">{t('myProfile.accountSummary.contactInfo')}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Email:</span>
                      <span className="text-gray-900 text-right">
                        {user?.email || t('myProfile.accountSummary.notAvailable')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('myProfile.accountSummary.country')}</span>
                      <span className="text-gray-900 flex items-center">
                        <span className="mr-1">{getCountryByCode(profile?.pais_codigo)?.bandera}</span>
                        {profile?.pais_nombre || t('myProfile.accountSummary.notSpecified')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">{t('myProfile.accountSummary.phone')}</span>
                      <span className="text-gray-900">
                        {profile?.telefono ? 
                          `${getCountryByCode(profile?.pais_codigo)?.telefono_codigo} ${profile.telefono}` : 
                          t('myProfile.accountSummary.notSpecified')
                        }
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-3">{t('myProfile.accountSummary.notificationPreferences')}</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 flex items-center">
                        <svg className="h-4 w-4 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                        Email
                      </span>
                      <span className={`text-sm ${profile?.email_notifications ? 'text-green-600' : 'text-gray-400'}`}>
                        {profile?.email_notifications ? t('myProfile.accountSummary.active') : t('myProfile.accountSummary.inactive')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">{t('myProfile.accountSummary.languagePreferences')}</h3>
            </div>
            <div className="card-body">
              <LanguageSettings userId={user?.id} />
            </div>
          </div>
        </div>
    </div>
  </div>
  )
}
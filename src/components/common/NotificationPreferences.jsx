import React from 'react'
import { useTranslation } from 'react-i18next'

export default function NotificationPreferences({
  emailEnabled,
  onEmailChange,
  error = null,
  className = ""
}) {
  const { t } = useTranslation()
  
  const handleEmailChange = (e) => {
    const isChecked = e.target.checked
    if (!isChecked && !emailEnabled) {
      return
    }
    onEmailChange(isChecked)
  }
  
  const atLeastOneRequired = !emailEnabled
  
  return (
    <div className={className}>
      <fieldset>
        <legend className="block text-sm font-medium text-gray-700 mb-3">
          {t('notificationPreferences.title')} {t('notificationPreferences.required')}
        </legend>
        
        <div className="space-y-4">
          
          <div className="flex items-start space-x-3">
            <div className="flex items-center h-5">
              <input
                id="email-notifications"
                name="email-notifications"
                type="checkbox"
                checked={true}
                disabled={true}
                className={`h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed ${
                  atLeastOneRequired ? 'border-red-300' : ''
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="email-notifications" className="flex items-start sm:items-center cursor-pointer">
                <div className="flex flex-col sm:flex-row sm:items-center">
                  <span className="text-sm text-gray-900 leading-tight">
                    {t('notificationPreferences.emailLabel')}
                  </span>
                  <div className="flex items-center mt-1 sm:mt-0 sm:ml-2">
                    <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                    <span className="text-xs text-blue-600 ml-1 hidden sm:inline">
                      {t('notificationPreferences.emailBadge')}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>
        
      </fieldset>
    </div>
  )
}

// Utility function to validate notification preferences
export const validateNotificationPreferences = (email, sms = false, push = false, t = null) => {
  if (!email) {
    return {
      valid: false,
      message: t 
        ? t('notificationPreferences.validation.emailRequired')
        : 'Las notificaciones por email son obligatorias'
    }
  }
  
  return { valid: true, message: null }
}
import { createClient } from '@supabase/supabase-js'
import i18next from 'i18next'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(i18next.t('errors.supabase.missingEnvVars'))
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  }
})

// Helper function to handle auth errors
export const handleAuthError = (error) => {
  if (error?.message) {
    switch (error.message) {
      case 'Invalid login credentials':
        return i18next.t('errors.auth.invalidCredentials')
      case 'User already registered':
        return i18next.t('errors.auth.userAlreadyRegistered')
      case 'Email not confirmed':
        return i18next.t('errors.auth.emailNotConfirmed')
      case 'Password should be at least 6 characters':
        return i18next.t('errors.auth.passwordTooShort')
      default:
        return error.message
    }
  }
  return i18next.t('errors.supabase.unknownError')
}

// Helper function to handle database errors
export const handleDatabaseError = (error) => {
  if (error?.code) {
    switch (error.code) {
      case '23505':
        return i18next.t('errors.database.duplicateEntry')
      case '23503':
        return i18next.t('errors.database.referenceError')
      case '42501':
        return i18next.t('errors.database.permissionDenied')
      default:
        return i18next.t('errors.database.genericError', { message: error.message })
    }
  }
  return error?.message || i18next.t('errors.database.connectionError')
}
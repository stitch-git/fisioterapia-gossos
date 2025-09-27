import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.')
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
        return 'Email o contraseña incorrectos'
      case 'User already registered':
        return 'Este email ya está registrado'
      case 'Email not confirmed':
        return 'Por favor confirma tu email antes de iniciar sesión'
      case 'Password should be at least 6 characters':
        return 'La contraseña debe tener al menos 6 caracteres'
      default:
        return error.message
    }
  }
  return 'Ha ocurrido un error desconocido'
}

// Helper function to handle database errors
export const handleDatabaseError = (error) => {
  if (error?.code) {
    switch (error.code) {
      case '23505':
        return 'Ya existe un registro con estos datos'
      case '23503':
        return 'Error de referencia en la base de datos'
      case '42501':
        return 'No tienes permisos para realizar esta acción'
      default:
        return `Error de base de datos: ${error.message}`
    }
  }
  return error?.message || 'Error de conexión con la base de datos'
}
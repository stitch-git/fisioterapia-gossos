import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

// Función de validación de contraseña (reutilizada de RegisterPage)
const validatePassword = (password) => {
  const requirements = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    symbol: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  }
  
  const isValid = Object.values(requirements).every(req => req)
  return { requirements, isValid }
}

// Componente indicadores de requisitos
const PasswordRequirements = ({ password }) => {
  const validation = validatePassword(password)
  
  const requirementsList = [
    { key: 'length', label: 'Mínimo 8 caracteres', met: validation.requirements.length },
    { key: 'lowercase', label: 'Al menos una minúscula (a-z)', met: validation.requirements.lowercase },
    { key: 'uppercase', label: 'Al menos una mayúscula (A-Z)', met: validation.requirements.uppercase },
    { key: 'number', label: 'Al menos un número (0-9)', met: validation.requirements.number },
    { key: 'symbol', label: 'Al menos un símbolo (!@#$%^&*)', met: validation.requirements.symbol }
  ]
  
  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs font-medium text-gray-700">Requisitos de contraseña:</p>
      <div className="grid grid-cols-1 gap-1">
        {requirementsList.map((req) => (
          <div key={req.key} className="flex items-center text-xs">
            <div className={`mr-2 w-4 h-4 rounded-full flex items-center justify-center ${
              req.met ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              {req.met ? (
                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
              )}
            </div>
            <span className={req.met ? 'text-green-700' : 'text-gray-500'}>
              {req.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [isValidSession, setIsValidSession] = useState(null)
  
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Verificar si el enlace de reset es válido
  // Reemplaza tu useEffect actual (el que verifica checkResetSession) con este:
  useEffect(() => {
    const checkResetSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Error verificando sesión:', error)
          setIsValidSession(false)
          return
        }

        // Verificar si hay parámetros de reset en la URL
        const accessToken = searchParams.get('access_token')
        const refreshToken = searchParams.get('refresh_token')
        const type = searchParams.get('type')
        const email = searchParams.get('email') // Nuevo: email desde nuestro enlace personalizado

        // Caso 1: Enlace oficial de Supabase con tokens
        if (type === 'recovery' && accessToken && refreshToken) {
          setIsValidSession(true)
        } 
        // Caso 2: Ya hay una sesión válida de Supabase
        else if (session && session.user) {
          setIsValidSession(true)
        } 
        // Caso 3: NUEVO - Enlace desde nuestro email personalizado (solo con email)
        else if (email) {
          // Verificar que el email existe en nuestra base de datos
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email')
            .eq('email', decodeURIComponent(email))
            .single()

          if (profile && !profileError) {
            setIsValidSession(true) // Permitir el reset con solo el email
          } else {
            setIsValidSession(false)
          }
        } 
        else {
          setIsValidSession(false)
        }
        
      } catch (error) {
        console.error('Error verificando enlace de reset:', error)
        setIsValidSession(false)
      }
    }

    checkResetSession()
  }, [searchParams])

  // Reemplaza tu función handleSubmit actual con esta:

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!password || !confirmPassword) {
      toast.error('Por favor completa todos los campos')
      return
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      toast.error('La contraseña no cumple todos los requisitos de seguridad')
      return
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return
    }

    try {
      setLoading(true)

      // Verificar si tenemos una sesión de recovery de Supabase
      const { data: { session } } = await supabase.auth.getSession()
      const emailFromUrl = searchParams.get('email')

      // Caso 1: Ya tenemos sesión de recovery de Supabase - usar directamente
      if (session && session.user) {
        const { error } = await supabase.auth.updateUser({
          password: password
        })

        if (error) throw error

      } 
      // Caso 2: Solo tenemos email desde nuestro enlace personalizado
      else if (emailFromUrl) {
        const email = decodeURIComponent(emailFromUrl)
        
        // Crear sesión de recovery usando Supabase (esto NO enviará email porque ya deshabilitamos las plantillas)
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password-confirmed`,
        })

        if (resetError) throw resetError

        // Esperar un momento para que se establezca la sesión
        await new Promise(resolve => setTimeout(resolve, 1000))

        // Intentar actualizar la contraseña
        const { error: updateError } = await supabase.auth.updateUser({
          password: password
        })

        if (updateError) {
          // Si falla, informar al usuario que revise su email
          toast.error('Por favor, verifica tu email y usa el enlace más reciente que recibiste')
          return
        }

      } else {
        throw new Error('No se encontró información de reset válida')
      }

      toast.success('Contraseña actualizada correctamente')
      
      // Redirigir al login después de un breve delay
      setTimeout(() => {
        navigate('/login')
      }, 2000)

    } catch (error) {
      console.error('Error actualizando contraseña:', error)
      toast.error(error.message || 'Error actualizando contraseña')
    } finally {
      setLoading(false)
    }
  }

  // Mostrar loading mientras verificamos la sesión
  if (isValidSession === null) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-gray-600">Verificando enlace...</p>
          </div>
        </div>
      </div>
    )
  }

  // Mostrar error si el enlace no es válido
  if (isValidSession === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Enlace Inválido
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Este enlace de recuperación ha expirado o no es válido
            </p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
            <div className="text-center space-y-6">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <svg className="mx-auto h-12 w-12 text-yellow-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-lg font-medium text-yellow-900 mb-2">
                  Posibles causas
                </h3>
                <ul className="text-sm text-yellow-700 space-y-1 text-left">
                  <li>• El enlace ha expirado (válido por 60 minutos)</li>
                  <li>• El enlace ya fue utilizado</li>
                  <li>• El enlace está incompleto o dañado</li>
                </ul>
              </div>

              <div className="space-y-4">
                <Link 
                  to="/forgot-password" 
                  className="w-full btn btn-primary"
                >
                  Solicitar nuevo enlace
                </Link>

                <Link 
                  to="/login" 
                  className="w-full btn btn-secondary"
                >
                  Volver al inicio de sesión
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Nueva Contraseña
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Crea una contraseña segura para tu cuenta
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Nueva Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Nueva Contraseña <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L12 12m-2.122-2.122L7.758 7.758M12 12l2.122 2.122m-2.122-2.122L16.242 7.758" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <PasswordRequirements password={password} />
            </div>

            {/* Confirmar Contraseña */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar Contraseña <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="input pr-10"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L12 12m-2.122-2.122L7.758 7.758M12 12l2.122 2.122m-2.122-2.122L16.242 7.758" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-sm text-red-600">Las contraseñas no coinciden</p>
              )}
            </div>

            {/* Botón Submit */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full btn btn-primary btn-lg"
              >
                {loading ? (
                  <>
                    <div className="loading-spinner mr-2"></div>
                    Actualizando...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Actualizar Contraseña
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">¿Recordaste tu contraseña?</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link 
                to="/login" 
                className="font-medium text-primary-600 hover:text-primary-500 transition-colors duration-200"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import NotificationPreferences from '../common/NotificationPreferences'
import TermsModal from '../common/TermsModal'

// Lista de países con códigos y banderas - VERSIÓN SIMPLIFICADA
const COUNTRIES = [
  { code: '+34', country: 'ES', name: 'España', flag: '🇪🇸' },
  { code: '+33', country: 'FR', name: 'Francia', flag: '🇫🇷' },
  { code: '+39', country: 'IT', name: 'Italia', flag: '🇮🇹' },
  { code: '+49', country: 'DE', name: 'Alemania', flag: '🇩🇪' },
  { code: '+44', country: 'GB', name: 'Reino Unido', flag: '🇬🇧' },
  { code: '+1', country: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: '+54', country: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: '+52', country: 'MX', name: 'México', flag: '🇲🇽' },
  { code: '+57', country: 'CO', name: 'Colombia', flag: '🇨🇴' },
]

// Caracteres prohibidos en emails
const PROHIBITED_CHARS_EMAIL = [' ', '\t', '\n', '\r', '<', '>', '(', ')', '[', ']', ',', ':', ';', '"', "'", '\\', '/', '?', '=', '&', '#', '!', '$', '%', '^', '*', '|', '`', '~', '{', '}']

// Caracteres permitidos en teléfonos
const ALLOWED_PHONE_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ' ', '-', '(', ')']

// Regex para email válido
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

// Regex para teléfono válido (solo números, espacios, guiones y paréntesis)
const PHONE_REGEX = /^[\d\s\-()]+$/

// Función de validación de email
const validateEmail = (email) => {
  const errors = []
  
  if (!email || email.trim() === '') {
    errors.push('El email es obligatorio')
    return { isValid: false, errors }
  }
  
  // Verificar caracteres prohibidos
  const prohibitedFound = PROHIBITED_CHARS_EMAIL.filter(char => email.includes(char))
  if (prohibitedFound.length > 0) {
    errors.push(`Caracteres no permitidos: ${prohibitedFound.join(', ')}`)
  }
  
  // Verificar espacios específicamente
  if (email.includes(' ')) {
    errors.push('Los emails no pueden contener espacios')
  }
  
  // Verificar múltiples @
  const atCount = (email.match(/@/g) || []).length
  if (atCount === 0) {
    errors.push('El email debe contener @')
  } else if (atCount > 1) {
    errors.push('El email solo puede contener una @')
  }
  
  // Verificar puntos consecutivos
  if (email.includes('..')) {
    errors.push('No se permiten puntos consecutivos')
  }
  
  // Validación final con regex
  if (errors.length === 0 && !EMAIL_REGEX.test(email)) {
    errors.push('Formato de email inválido')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Función de validación de teléfono
const validatePhone = (phone, countryCode) => {
  const errors = []
  
  if (!phone || phone.trim() === '') {
    errors.push('El teléfono es obligatorio')
    return { isValid: false, errors }
  }
  
  // Verificar que solo contenga caracteres permitidos
  if (!PHONE_REGEX.test(phone)) {
    errors.push('Solo se permiten números, espacios, guiones y paréntesis')
  }
  
  // Contar solo los dígitos
  const digitsOnly = phone.replace(/\D/g, '')
  
  if (digitsOnly.length < 9) {
    errors.push('El teléfono debe tener al menos 9 dígitos')
  }
  
  if (digitsOnly.length > 9) {
    errors.push('El teléfono no puede tener más de 9 dígitos')
  }
  
  // Validación específica para España (+34)
  if (countryCode === '+34' && digitsOnly.length >= 9) {
    if (!digitsOnly.startsWith('6') && !digitsOnly.startsWith('7')) {
      errors.push('Los números españoles deben empezar por 6 o 7')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    digitsCount: digitsOnly.length
  }
}

// Función de validación de contraseña
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

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    nombre_completo: '',
    telefono: '',
    email: '',
    password: '',
    confirmPassword: '',
    pais_codigo: '+34',
    email_notifications: true
  })
  
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [showEmailErrors, setShowEmailErrors] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [showPhoneErrors, setShowPhoneErrors] = useState(false)
  const { signUp, loading } = useAuth()

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    
    // Validación en tiempo real para email
    if (name === 'email') {
      if (value.length > 0) {
        const validation = validateEmail(value)
        setEmailError(validation.errors[0] || '')
        setShowEmailErrors(true)
      } else {
        setEmailError('')
        setShowEmailErrors(false)
      }
    }
    
    // Validación en tiempo real para teléfono
    if (name === 'telefono') {
      if (value.length > 0) {
        const validation = validatePhone(value, formData.pais_codigo)
        setPhoneError(validation.errors[0] || '')
        setShowPhoneErrors(true)
      } else {
        setPhoneError('')
        setShowPhoneErrors(false)
      }
    }
  }

  const handleEmailKeyPress = (e) => {
    const char = e.key
    
    // Bloquear caracteres prohibidos
    if (PROHIBITED_CHARS_EMAIL.includes(char)) {
      e.preventDefault()
      
      if (char === ' ') {
        setEmailError('Los emails no pueden contener espacios')
        setShowEmailErrors(true)
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => {
          if (formData.email && formData.email.length > 0) {
            const validation = validateEmail(formData.email)
            setEmailError(validation.errors[0] || '')
          } else {
            setEmailError('')
          }
        }, 3000)
      }
    }
  }

  const handlePhoneKeyPress = (e) => {
    const char = e.key
    
    // Permitir teclas especiales (backspace, delete, arrows, etc.)
    const specialKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']
    if (specialKeys.includes(e.key)) {
      return
    }
    
    // Permitir Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if (e.ctrlKey && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) {
      return
    }
    
    // Bloquear caracteres no permitidos en teléfonos
    if (!ALLOWED_PHONE_CHARS.includes(char)) {
      e.preventDefault()
      
      // Mostrar mensaje específico para letras
      if (/[a-zA-Z]/.test(char)) {
        setPhoneError('Solo se permiten números en el teléfono')
        setShowPhoneErrors(true)
        
        // Limpiar mensaje después de 3 segundos
        setTimeout(() => {
          if (formData.telefono && formData.telefono.length > 0) {
            const validation = validatePhone(formData.telefono, formData.pais_codigo)
            setPhoneError(validation.errors[0] || '')
          } else {
            setPhoneError('')
          }
        }, 3000)
      }
    }
  }

  const handleEmailChange = (value) => {
    setFormData(prev => ({
      ...prev,
      email_notifications: value
    }))
  }

  const validateForm = () => {
    const { nombre_completo, telefono, email, password, confirmPassword } = formData

    if (!nombre_completo?.trim()) {
      toast.error('El nombre completo es requerido')
      return false
    }

    // Validación mejorada de teléfono
    const phoneValidation = validatePhone(telefono, formData.pais_codigo)
    if (!phoneValidation.isValid) {
      toast.error(phoneValidation.errors[0])
      return false
    }

    // Validación mejorada de email
    const emailValidation = validateEmail(email)
    if (!emailValidation.isValid) {
      toast.error(emailValidation.errors[0])
      return false
    }

    if (!password) {
      toast.error('La contraseña es requerida')
      return false
    }

    const passwordValidation = validatePassword(password)
    if (!passwordValidation.isValid) {
      toast.error('La contraseña no cumple todos los requisitos de seguridad')
      return false
    }

    if (password !== confirmPassword) {
      toast.error('Las contraseñas no coinciden')
      return false
    }

    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) return

    const { nombre_completo, telefono, email, password, pais_codigo, email_notifications } = formData
    const selectedCountry = COUNTRIES.find(c => c.code === pais_codigo)

    const { error } = await signUp(email, password, {
      nombre_completo: nombre_completo.trim(),
      telefono: telefono.replace(/\s/g, ''),
      pais_codigo: selectedCountry.country, // "ES" en lugar de "+34"
      pais_nombre: selectedCountry.name,    // AÑADIR esto
      email_notifications,
      role: 'cliente'
    })

    console.log('Registration data sent:', {
      email,
      userData: {
        nombre_completo: nombre_completo.trim(),
        telefono: telefono.replace(/\s/g, ''),
        pais_codigo,
        email_notifications,
        role: 'cliente'
      }
    })

  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
            <svg className="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Crear Cuenta
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Únete a Fisioterapia Gossos
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Nombre Completo */}
            <div>
              <label htmlFor="nombre_completo" className="block text-sm font-medium text-gray-700">
                Nombre Completo <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="nombre_completo"
                  name="nombre_completo"
                  type="text"
                  autoComplete="name"
                  required
                  className="input"
                  placeholder="Juan Pérez García"
                  value={formData.nombre_completo}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">
                Teléfono <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex rounded-lg shadow-sm">
                <select
                  name="pais_codigo"
                  value={formData.pais_codigo}
                  onChange={handleChange}
                  className="w-24 pl-2 pr-6 py-2 border border-gray-300 rounded-l-lg bg-white text-gray-900 text-sm 
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent border-r-0
                           focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
                  title="Código de país"
                >
                  {COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code}
                    </option>
                  ))}
                </select>
                
                <input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  autoComplete="tel"
                  required
                  className={`flex-1 px-3 py-2 border border-gray-300 rounded-r-lg 
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent border-l-0
                           focus:outline-none disabled:bg-gray-50 disabled:text-gray-500 ${
                             phoneError && showPhoneErrors ? 'border-red-500 bg-red-50' : ''
                           }`}
                  placeholder="600 123 456"
                  value={formData.telefono}
                  onChange={handleChange}
                  onKeyPress={handlePhoneKeyPress}
                  onBlur={() => setShowPhoneErrors(true)}
                />
              </div>
              
              {/* Mostrar errores de teléfono */}
              {phoneError && showPhoneErrors && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <span className="inline-block w-4 h-4 mr-2 text-red-500">⚠️</span>
                  {phoneError}
                </p>
              )}
              
              {/* Indicador visual de estado para teléfono */}
              {formData.telefono && formData.telefono.length > 0 && (
                <div className="mt-1 flex items-center text-sm">
                  {!phoneError ? (
                    <span className="text-green-600 flex items-center">
                      <span className="inline-block w-4 h-4 mr-1">✅</span>
                      Teléfono válido ({formData.telefono.replace(/\D/g, '').length} dígitos)
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center">
                      <span className="inline-block w-4 h-4 mr-1">❌</span>
                      Corrige los errores
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className={`input ${emailError && showEmailErrors ? 'border-red-500 bg-red-50' : ''}`}
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  onKeyPress={handleEmailKeyPress}
                  onBlur={() => setShowEmailErrors(true)}
                />
                
                {/* Mostrar errores de email */}
                {emailError && showEmailErrors && (
                  <p className="mt-1 text-sm text-red-600 flex items-center">
                    <span className="inline-block w-4 h-4 mr-2 text-red-500">⚠️</span>
                    {emailError}
                  </p>
                )}
                
                {/* Indicador visual de estado */}
                {formData.email && formData.email.length > 0 && (
                  <div className="mt-1 flex items-center text-sm">
                    {!emailError ? (
                      <span className="text-green-600 flex items-center">
                        <span className="inline-block w-4 h-4 mr-1">✅</span>
                        Email válido
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center">
                        <span className="inline-block w-4 h-4 mr-1">❌</span>
                        Corrige los errores
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Contraseña <span className="text-red-500">*</span>
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
                  value={formData.password}
                  onChange={handleChange}
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
              <PasswordRequirements password={formData.password} />
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
                  value={formData.confirmPassword}
                  onChange={handleChange}
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
            </div>

            {/* Preferencias de Notificación */}
            <NotificationPreferences
              onEmailChange={handleEmailChange}
            />

            {/* Términos y Condiciones */}
            <div className="flex items-center">
              <input
                id="accept-terms"
                name="accept-terms"
                type="checkbox"
                required
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="accept-terms" className="ml-2 block text-sm text-gray-900">
                Acepto los{' '}
                <button 
                  type="button"
                  onClick={() => setShowTermsModal(true)}
                  className="text-primary-600 hover:text-primary-500 underline"
                >
                  términos y condiciones
                </button>
              </label>
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
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Crear Cuenta
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
                <span className="px-2 bg-white text-gray-500">¿Ya tienes cuenta?</span>
              </div>
            </div>

            <div className="mt-6 text-center">
              <Link 
                to="/login" 
                className="font-medium text-primary-600 hover:text-primary-500 transition-colors duration-200"
              >
                Inicia sesión aquí
              </Link>
            </div>
          </div>
        </div>
      </div>
      <TermsModal 
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
      />
    </div>
  )
}
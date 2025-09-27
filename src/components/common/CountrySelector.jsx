import React, { useState, useEffect, useRef } from 'react'

// Lista de países con códigos y reglas de validación
const COUNTRIES = [
  {
    codigo: 'ES',
    nombre: 'España',
    bandera: '🇪🇸',
    telefono_codigo: '+34',
    telefono_regex: /^[67]\d{8}$/,
    telefono_longitud: 9,
    telefono_descripcion: '9 dígitos, empezando por 6 o 7'
  },
  {
    codigo: 'FR',
    nombre: 'Francia', 
    bandera: '🇫🇷',
    telefono_codigo: '+33',
    telefono_regex: /^[1-9]\d{8}$/,
    telefono_longitud: 9,
    telefono_descripcion: '9 dígitos'
  },
  {
    codigo: 'IT',
    nombre: 'Italia',
    bandera: '🇮🇹', 
    telefono_codigo: '+39',
    telefono_regex: /^3\d{8,9}$/,
    telefono_longitud: [9, 10],
    telefono_descripcion: '9-10 dígitos, empezando por 3'
  },
  {
    codigo: 'PT',
    nombre: 'Portugal',
    bandera: '🇵🇹',
    telefono_codigo: '+351',
    telefono_regex: /^9[1236]\d{7}$/,
    telefono_longitud: 9,
    telefono_descripcion: '9 dígitos, empezando por 91, 92, 93 o 96'
  },
  {
    codigo: 'DE',
    nombre: 'Alemania',
    bandera: '🇩🇪',
    telefono_codigo: '+49',
    telefono_regex: /^1[5-7]\d{8,9}$/,
    telefono_longitud: [10, 11],
    telefono_descripcion: '10-11 dígitos, empezando por 15, 16 o 17'
  },
  {
    codigo: 'GB',
    nombre: 'Reino Unido',
    bandera: '🇬🇧',
    telefono_codigo: '+44',
    telefono_regex: /^7\d{9}$/,
    telefono_longitud: 10,
    telefono_descripcion: '10 dígitos, empezando por 7'
  },
  {
    codigo: 'US',
    nombre: 'Estados Unidos',
    bandera: '🇺🇸',
    telefono_codigo: '+1',
    telefono_regex: /^\d{10}$/,
    telefono_longitud: 10,
    telefono_descripcion: '10 dígitos'
  }
]

export const validatePhoneNumber = (phoneNumber, countryCodigo) => {
  const country = COUNTRIES.find(c => c.codigo === countryCodigo)
  if (!country) return { valid: false, message: 'País no soportado' }
  
  // Remove spaces and special characters
  const cleanPhone = phoneNumber.replace(/\s|-/g, '')
  
  // Check length
  const expectedLengths = Array.isArray(country.telefono_longitud) 
    ? country.telefono_longitud 
    : [country.telefono_longitud]
  
  if (!expectedLengths.includes(cleanPhone.length)) {
    return {
      valid: false,
      message: `El teléfono debe tener ${expectedLengths.join(' o ')} dígitos`
    }
  }
  
  // Check format
  if (!country.telefono_regex.test(cleanPhone)) {
    return {
      valid: false,
      message: `Formato incorrecto: ${country.telefono_descripcion}`
    }
  }
  
  return { valid: true, message: 'Válido' }
}

export const getCountryByCode = (codigo) => {
  return COUNTRIES.find(c => c.codigo === codigo) || COUNTRIES[0]
}

export default function CountrySelector({ 
  selectedCountry, 
  onCountryChange, 
  className = "",
  disabled = false 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  const currentCountry = getCountryByCode(selectedCountry) || COUNTRIES[0]
  
  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Cerrar dropdown con ESC
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc, false)
    }

    return () => {
      document.removeEventListener('keydown', handleEsc, false)
    }
  }, [isOpen])
  
  const handleSelect = (country) => {
    onCountryChange(country)
    setIsOpen(false)
  }
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Button responsive */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`input pr-10 text-left flex items-center justify-between w-full ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        {/* Contenido responsive del botón */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <span className="text-lg flex-shrink-0">{currentCountry.bandera}</span>
          <span className="font-medium text-sm sm:text-base flex-shrink-0">
            {currentCountry.telefono_codigo}
          </span>
          {/* Nombre del país - responsive */}
          <span className="text-gray-600 text-sm sm:text-base truncate">
            <span className="hidden sm:inline">{currentCountry.nombre}</span>
            <span className="sm:hidden">{currentCountry.codigo}</span>
          </span>
        </div>
        
        {/* Icono chevron */}
        <svg 
          className={`w-4 h-4 sm:w-5 sm:h-5 text-gray-400 transition-transform flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* Dropdown responsive */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 sm:max-h-72 overflow-auto">
          {COUNTRIES.map((country) => (
            <button
              key={country.codigo}
              type="button"
              onClick={() => handleSelect(country)}
              className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 text-left hover:bg-gray-50 active:bg-gray-100 flex items-center space-x-2 sm:space-x-3 transition-colors min-h-[44px] ${
                country.codigo === currentCountry.codigo 
                  ? 'bg-primary-50 text-primary-700' 
                  : 'text-gray-900'
              }`}
            >
              {/* Layout responsive para opciones */}
              <span className="text-lg flex-shrink-0">{country.bandera}</span>
              <span className="font-medium text-sm sm:text-base min-w-[3rem] flex-shrink-0">
                {country.telefono_codigo}
              </span>
              <span className="flex-1 text-sm sm:text-base truncate">
                {country.nombre}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Export countries data for external use
export { COUNTRIES }
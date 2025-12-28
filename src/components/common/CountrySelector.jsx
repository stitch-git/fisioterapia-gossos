import React, { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const COUNTRIES = [
  {
    codigo: 'ES',
    bandera: '🇪🇸',
    telefono_codigo: '+34',
    telefono_regex: /^[67]\d{8}$/,
    telefono_longitud: 9
  },
  {
    codigo: 'FR',
    bandera: '🇫🇷',
    telefono_codigo: '+33',
    telefono_regex: /^[1-9]\d{8}$/,
    telefono_longitud: 9
  },
  {
    codigo: 'IT',
    bandera: '🇮🇹', 
    telefono_codigo: '+39',
    telefono_regex: /^3\d{8,9}$/,
    telefono_longitud: [9, 10]
  },
  {
    codigo: 'PT',
    bandera: '🇵🇹',
    telefono_codigo: '+351',
    telefono_regex: /^9[1236]\d{7}$/,
    telefono_longitud: 9
  },
  {
    codigo: 'DE',
    bandera: '🇩🇪',
    telefono_codigo: '+49',
    telefono_regex: /^1[5-7]\d{8,9}$/,
    telefono_longitud: [10, 11]
  },
  {
    codigo: 'GB',
    bandera: '🇬🇧',
    telefono_codigo: '+44',
    telefono_regex: /^7\d{9}$/,
    telefono_longitud: 10
  },
  {
    codigo: 'US',
    bandera: '🇺🇸',
    telefono_codigo: '+1',
    telefono_regex: /^\d{10}$/,
    telefono_longitud: 10
  }
]

export const validatePhoneNumber = (phoneNumber, countryCodigo, t) => {
  const country = COUNTRIES.find(c => c.codigo === countryCodigo) || COUNTRIES[0]
  
  const cleanPhone = phoneNumber.replace(/\s|-/g, '')
  
  const expectedLengths = Array.isArray(country.telefono_longitud) 
    ? country.telefono_longitud 
    : [country.telefono_longitud]
  
  if (!expectedLengths.includes(cleanPhone.length)) {
    return {
      valid: false,
      message: t 
        ? t('phoneValidation.invalidLength', { lengths: expectedLengths.join(' o ') })
        : `El teléfono debe tener ${expectedLengths.join(' o ')} dígitos`
    }
  }
  
  if (!country.telefono_regex.test(cleanPhone)) {
    const description = t 
      ? t(`countries.phoneDescriptions.${countryCodigo}`)
      : country.telefono_descripcion
    return {
      valid: false,
      message: t
        ? t('phoneValidation.invalidFormat', { description })
        : `Formato incorrecto: ${description}`
    }
  }
  
  return { valid: true, message: t ? t('phoneValidation.valid') : 'Válido' }
}

export const getCountryByCode = (codigo, t) => {
  const country = COUNTRIES.find(c => c.codigo === codigo) || COUNTRIES[0]
  return {
    ...country,
    nombre: t ? t(`countries.${country.codigo}`) : country.codigo,
    telefono_descripcion: t ? t(`countries.phoneDescriptions.${country.codigo}`) : ''
  }
}

export default function CountrySelector({ 
  selectedCountry, 
  onCountryChange, 
  className = "",
  disabled = false 
}) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  
  const currentCountry = getCountryByCode(selectedCountry, t)
  
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
    const translatedCountry = getCountryByCode(country.codigo, t)
    onCountryChange(translatedCountry)
    setIsOpen(false)
  }
  
  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`input pr-10 text-left flex items-center justify-between w-full ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
          <span className="text-lg flex-shrink-0">{currentCountry.bandera}</span>
          <span className="font-medium text-sm sm:text-base flex-shrink-0">
            {currentCountry.telefono_codigo}
          </span>
          <span className="text-gray-600 text-sm sm:text-base truncate">
            <span className="hidden sm:inline">{currentCountry.nombre}</span>
            <span className="sm:hidden">{currentCountry.codigo}</span>
          </span>
        </div>
        
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
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 sm:max-h-72 overflow-auto">
          {COUNTRIES.map((country) => {
            const translatedCountry = getCountryByCode(country.codigo, t)
            return (
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
                <span className="text-lg flex-shrink-0">{country.bandera}</span>
                <span className="font-medium text-sm sm:text-base min-w-[3rem] flex-shrink-0">
                  {country.telefono_codigo}
                </span>
                <span className="flex-1 text-sm sm:text-base truncate">
                  {translatedCountry.nombre}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { COUNTRIES }
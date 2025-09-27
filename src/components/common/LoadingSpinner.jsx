import React from 'react'

export default function LoadingSpinner({ 
  message = "Cargando...",
  size = "normal", // "small", "normal", "large"
  fullScreen = true 
}) {
  
  // Tamaños responsive del spinner
  const spinnerSizes = {
    small: "h-6 w-6",
    normal: "h-12 w-12", 
    large: "h-16 w-16"
  }
  
  // Si no es full screen, renderizar solo el spinner inline
  if (!fullScreen) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className={`${spinnerSizes[size]} flex items-center justify-center rounded-full bg-primary-100`}>
          <div className="loading-spinner"></div>
        </div>
        {message && (
          <span className="ml-3 text-sm sm:text-base text-gray-600">
            {message}
          </span>
        )}
      </div>
    )
  }
  
  // Renderizar full screen responsive
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-sm sm:max-w-md">
        <div className="bg-white py-6 sm:py-8 px-4 sm:px-6 lg:px-10 shadow-lg rounded-lg sm:rounded-xl">
          <div className="text-center">
            {/* Spinner container responsive */}
            <div className={`mx-auto flex items-center justify-center ${spinnerSizes[size]} rounded-full bg-primary-100`}>
              <div className="loading-spinner"></div>
            </div>
            
            {/* Mensaje responsive */}
            <h3 className="mt-4 sm:mt-6 text-base sm:text-lg font-medium text-gray-900 px-2">
              {message}
            </h3>
            
            {/* Loading dots responsive */}
            <div className="mt-4 sm:mt-6 loading-dots justify-center">
              <div className="loading-dot"></div>
              <div className="loading-dot" style={{ animationDelay: '0.1s' }}></div>
              <div className="loading-dot" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
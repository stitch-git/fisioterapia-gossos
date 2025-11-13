import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function ConfirmModal(props) {
  const { t } = useTranslation()
  
  const {
    isOpen, 
    onClose, 
    onConfirm, 
    title = t('confirmModal.defaultTitle'),
    message = t('confirmModal.defaultMessage'),
    confirmText = t('confirmModal.defaultConfirm'),
    cancelText = t('confirmModal.defaultCancel'),
    confirmButtonClass = "bg-red-600 hover:bg-red-700",
    cancelButtonClass = null,
    icon = null
  } = props

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
        onClose()
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc, false)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEsc, false)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const getCancelButtonClasses = () => {
    if (cancelButtonClass) {
      return `w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200 ${cancelButtonClass}`
    }
    return 'w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200'
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm sm:max-w-md mx-auto animate-fade-in">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="flex items-start sm:items-center">
            {icon && (
              <div className="mr-3 flex-shrink-0">
                {icon}
              </div>
            )}
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 leading-tight">
              {title}
            </h3>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="text-sm sm:text-base text-gray-600 leading-relaxed">
            {message}
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg">
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end space-y-reverse space-y-3 sm:space-y-0 sm:space-x-3">
            {cancelText && (
              <button
                onClick={onClose}
                className={getCancelButtonClasses()}
              >
                {cancelText}
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200 ${confirmButtonClass}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
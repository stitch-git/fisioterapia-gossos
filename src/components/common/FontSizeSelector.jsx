import React, { useState } from 'react'
import { useFontSize } from '../../contexts/FontSizeContext'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'

export default function FontSizeSelector() {
  const { t } = useTranslation()
  const { fontSize, updateFontSize, isMobile } = useFontSize()
  const [tempSize, setTempSize] = useState(fontSize)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleSizeChange = (e) => {
    const newSize = parseInt(e.target.value)
    setTempSize(newSize)
  }

  const handleApply = async () => {
    if (tempSize === fontSize) {
      toast.success(t('fontSize.noChanges'))
      return
    }

    setIsUpdating(true)
    const result = await updateFontSize(tempSize)
    setIsUpdating(false)

    if (result.success) {
      toast.success(t('fontSize.updated'))
    } else {
      toast.error(result.error || t('fontSize.error'))
      setTempSize(fontSize) // Revertir
    }
  }

  const handleReset = async () => {
    const defaultSize = isMobile ? 14 : 16
    setTempSize(defaultSize)
    
    setIsUpdating(true)
    const result = await updateFontSize(defaultSize)
    setIsUpdating(false)

    if (result.success) {
      toast.success(t('fontSize.resetSuccess'))
    } else {
      toast.error(result.error || t('fontSize.error'))
    }
  }

  const getSizeLabel = (size) => {
    if (size <= 13) return t('fontSize.sizes.verySmall')
    if (size <= 15) return t('fontSize.sizes.small')
    if (size <= 17) return t('fontSize.sizes.normal')
    if (size <= 20) return t('fontSize.sizes.large')
    return t('fontSize.sizes.veryLarge')
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {t('fontSize.title')}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {isMobile ? t('fontSize.deviceMobile') : t('fontSize.deviceDesktop')}
          </p>
        </div>
        <div className="text-2xl">
          🔤
        </div>
      </div>

      {/* Preview Text */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 mb-2">{t('fontSize.preview')}:</p>
        <p style={{ fontSize: `${tempSize}px` }} className="text-gray-900">
          {t('fontSize.previewText')}
        </p>
      </div>

      {/* Slider */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-medium text-gray-700">
            {t('fontSize.size')}: {tempSize}px
          </label>
          <span className="text-sm font-medium text-primary-600">
            {getSizeLabel(tempSize)}
          </span>
        </div>
        
        <input
          type="range"
          min="12"
          max={isMobile ? "16" : "24"}
          step="1"
          value={tempSize}
          onChange={handleSizeChange}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
        />
        
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>12px</span>
          <span>{isMobile ? "14px" : "18px"}</span>
          <span>{isMobile ? "16px" : "24px"}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleApply}
          disabled={isUpdating || tempSize === fontSize}
          className="flex-1 btn btn-primary"
        >
          {isUpdating ? (
            <>
              <div className="loading-spinner mr-2"></div>
              {t('fontSize.applying')}
            </>
          ) : (
            t('fontSize.apply')
          )}
        </button>
        
        <button
          onClick={handleReset}
          disabled={isUpdating}
          className="btn btn-secondary"
        >
          {t('fontSize.reset')}
        </button>
      </div>

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs text-blue-800">
          💡 {t('fontSize.info')}
        </p>
      </div>
    </div>
  )
}